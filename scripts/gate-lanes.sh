#!/usr/bin/env bash
# scripts/gate-lanes.sh — the lane classifier. Sourced by scripts/verify.sh.
#
# Four lanes, one gate. A lane decides how DEEP the gate runs; it never decides
# whether the gate reports. CI keeps one job named `typecheck / lint / build`
# (the ruleset matches on that context) and the depth happens inside the script,
# so a skipped job can never leave a PR waiting on a check nobody reports.
#
# Highest lane wins — code > config > content > docs. A PR that touches
# `content/**` and `components/**` is a code PR, no exceptions: the cheaper lane
# is only ever allowed to drop steps that cannot see the file that changed.
#
# Unknown paths resolve to `code`. A new top-level directory is not a reason to
# run less of the gate.
#
# These functions are pure over a path, so they are testable without a git tree:
#   bash -c 'source scripts/gate-lanes.sh; lane_of_path components/x.tsx'   # code
#
# THE BASE REF IS RESOLVED BEFORE ANYTHING IS CLASSIFIED, AND THE PATH THAT
# RESOLVED IT IS PRINTED. A diff against a missing ref is not evidence about what
# changed, so the fallback is the full gate — but in a fresh worktree or a fresh
# clone the ref is usually one `git fetch` away, and paying 90 s of `next build`
# for a docs-only card is exactly what the lanes exist to drop. Order:
#
#   1. the ref already in the object database (shared clone, CI's fetch-depth: 0);
#   2. `git fetch --no-tags ... origin main`, only when the ref is the default
#      `origin/main`, the caller did not name a ref, `origin` exists with a URL,
#      the git dir is writable, and the fetch answers within $GATE_BASE_TIMEOUT;
#   3. no base — full gate, with the reason printed.
#
# The fetch never touches the working tree: no checkout, no pull, no branch, no
# reset, no stash. It writes the remote-tracking ref the classifier reads and
# nothing else (`--no-write-fetch-head` keeps even FETCH_HEAD off the shared file
# set, `--no-auto-gc` keeps a fetch from racing another worker's gc).
#
# DEPTH is `--depth=1` only when the repository is ALREADY shallow. A depth-1
# fetch into a full clone writes `.git/shallow`, which truncates history for every
# worktree sharing that object database and destroys the `git merge-base` the
# three-dot diff needs — it damages other workers and makes the lane unresolvable
# anyway. In a full clone the incremental one-branch fetch is small and carries
# the same timeout.
#
# Docs: docs/REPO-LAYERS.md.

# lane_rank <lane> -> 0..3, higher = deeper gate
lane_rank() {
  case "$1" in
    docs) printf '0' ;;
    content) printf '1' ;;
    config) printf '2' ;;
    *) printf '3' ;; # code, and anything unrecognised
  esac
}

# lane_of_path <path> -> docs | content | config | code
lane_of_path() {
  case "$1" in
    # --- code: what `next build` compiles into routes -----------------------
    app/* | components/* | lib/* | hooks/*)
      printf 'code\n'
      return
      ;;

    # --- config: the repo's own machinery -----------------------------------
    # AGENTS.md is prose but it is the AI-tooling config: changing it can change
    # what every future card runs, so it is gated like the scripts it describes.
    .github/* | scripts/* | AGENTS.md | CLAUDE.md | components.json | \
      biome.json | biome.jsonc | tsconfig.json | tsconfig.*.json | \
      package.json | pnpm-lock.yaml | next.config.* | postcss.config.* | \
      tailwind.config.* | .nvmrc | .editorconfig | .gitignore | .gitattributes)
      printf 'config\n'
      return
      ;;

    # --- content + media: schema, fixtures, assets --------------------------
    content/* | data/* | public/*)
      printf 'content\n'
      return
      ;;

    # --- documentation ------------------------------------------------------
    docs/* | *.md)
      printf 'docs\n'
      return
      ;;

    # Unknown path: full gate. Never a silent skip.
    *)
      printf 'code\n'
      ;;
  esac
}

# lane_paths <lane> -> the paths that lane owns, for the docs line in the banner.
lane_paths() {
  case "$1" in
    docs) printf 'docs/**, *.md' ;;
    content) printf 'content/**, data/**, public/**' ;;
    config) printf '.github/**, scripts/**, package.json, tsconfig*, biome.jsonc' ;;
    code) printf 'app/**, components/**, lib/**, hooks/** (and anything unclassified)' ;;
  esac
}

# --- the diff base -----------------------------------------------------------
# See the header: resolve first, classify second, say which path resolved it.

GATE_BASE_TIMEOUT="${GATE_BASE_TIMEOUT:-10}" # seconds; a slow network is not a gate failure
GATE_BASE_CACHE_REF=''                       # the ref this run resolved (the cache key)
GATE_BASE_REF=''                             # the ref that resolved, or '' when there is none
GATE_BASE_SHA=''                             # its commit, abbreviated
GATE_BASE_HOW=''                             # local | fetched | ''
GATE_BASE_WHY=''                             # why there is no base (the conservative reason)

_gate_base_ms() { # ms since the epoch, for the fetch line only
  local ns
  ns="$(date +%s%N 2>/dev/null || true)"
  case "$ns" in
    '' | *[!0-9]*) printf '%s' "$(($(date +%s) * 1000))" ;;
    *) printf '%s' "$((ns / 1000000))" ;;
  esac
}

# gate_base_remote -> 0 when `origin` is a remote this tree may fetch from.
# A missing remote, no URL, or a read-only git dir (sandbox, read-only mount) is
# detected here rather than discovered by a fetch that hangs or fails loudly.
gate_base_remote() {
  local common
  git remote 2>/dev/null | grep -qx 'origin' || return 1
  [ -n "$(git config --get remote.origin.url 2>/dev/null || true)" ] || return 1
  common="$(git rev-parse --git-common-dir 2>/dev/null || true)"
  [ -n "$common" ] && [ -d "$common" ] || return 1
  [ -w "$common" ] || return 1
  return 0
}

# gate_base_fetch <ref> -> 0 when the ref arrived. Bounded, non-mutating.
# Sets GATE_BASE_WHY on every failure path, so the fallback is never silent.
gate_base_fetch() {
  local ref="$1" branch="${1#origin/}" depth=() t0 t1 rc=0
  [ "$ref" = "origin/main" ] || {
    GATE_BASE_WHY="GATE_REF=${ref} is an override and is never fetched"
    return 1
  }
  gate_base_remote || {
    GATE_BASE_WHY="no writable 'origin' remote to fetch ${ref} from"
    return 1
  }
  if [ "$(git rev-parse --is-shallow-repository 2>/dev/null || printf 'false')" = "true" ]; then
    depth=(--depth=1)
  fi

  # No `timeout` on PATH means the fetch cannot be bounded, and an unbounded
  # fetch is the one thing this must never do: skip it and say so.
  if ! command -v timeout >/dev/null 2>&1; then
    GATE_BASE_WHY="no 'timeout' on PATH, so fetching ${ref} cannot be bounded"
    return 1
  fi

  t0="$(_gate_base_ms)"
  timeout "$GATE_BASE_TIMEOUT" git fetch --no-tags --no-write-fetch-head --no-auto-gc \
    ${depth[@]+"${depth[@]}"} origin "+refs/heads/${branch}:refs/remotes/origin/${branch}" \
    >/dev/null 2>&1 || rc=$?
  t1="$(_gate_base_ms)"

  if [ "$rc" -ne 0 ]; then
    if [ "$rc" -eq 124 ]; then
      GATE_BASE_WHY="fetching ${ref} timed out after ${GATE_BASE_TIMEOUT}s"
    else
      GATE_BASE_WHY="fetching ${ref} failed (git exit ${rc})"
    fi
    return 1
  fi
  GATE_BASE_FETCH_MS=$((t1 - t0))
  return 0
}

# gate_base_resolve <ref> -> fills GATE_BASE_REF/SHA/HOW/WHY, once per gate run.
# Calling it again with the same ref is free: nineteen steps must not re-resolve,
# and a second fetch would be a second network round-trip inside one gate.
gate_base_resolve() {
  local ref="$1" sha='' mb=''
  if [ -n "$GATE_BASE_CACHE_REF" ] && [ "$GATE_BASE_CACHE_REF" = "$ref" ]; then
    return 0
  fi
  GATE_BASE_CACHE_REF="$ref"
  GATE_BASE_REF=''
  GATE_BASE_SHA=''
  GATE_BASE_HOW=''
  GATE_BASE_WHY=''
  GATE_BASE_FETCH_MS=0

  if sha="$(git rev-parse --verify --quiet "${ref}^{commit}" 2>/dev/null)" && [ -n "$sha" ]; then
    GATE_BASE_HOW='local'
  elif gate_base_fetch "$ref"; then
    sha="$(git rev-parse --verify --quiet "${ref}^{commit}" 2>/dev/null || true)"
    [ -n "$sha" ] && GATE_BASE_HOW='fetched'
  fi

  if [ -z "$sha" ]; then
    [ -n "$GATE_BASE_WHY" ] || GATE_BASE_WHY="no ${ref} to diff against"
    return 1
  fi

  # The three-dot diff needs a real merge base. With one (a full clone) it is a
  # diff; without one (a depth-1 clone of an unrelated tip) every file reads as
  # changed, which is a worse lie than the full gate.
  if ! mb="$(git merge-base "$ref" HEAD 2>/dev/null || true)" || [ -z "$mb" ]; then
    GATE_BASE_WHY="no merge base with ${ref} (shallow or unrelated history)"
    GATE_BASE_SHA=''
    GATE_BASE_HOW=''
    return 1
  fi

  GATE_BASE_REF="$ref"
  GATE_BASE_SHA="${sha:0:7}"
  return 0
}

# gate_base_label -> "origin/main@abc1234 (local ref)" — printed, never inferred.
gate_base_label() {
  local how=''
  case "$GATE_BASE_HOW" in
    local) how='local ref' ;;
    fetched) how="fetched in $((GATE_BASE_FETCH_MS / 1000)).$(((GATE_BASE_FETCH_MS % 1000) / 100))s" ;;
  esac
  printf '%s@%s (%s)' "$GATE_BASE_REF" "$GATE_BASE_SHA" "$how"
}

# resolve_lane -> fills LANE, LANE_REASON, LANE_FILES (newline-separated).
#
# GATE_LANE=auto (default) classifies. GATE_LANE=full forces the code lane; it
# is the escape hatch, not a second lane definition. GATE_REF (default
# origin/main) is the ref the diff is taken against — override it for a stacked
# branch or a test harness. It is resolved first (see "the diff base" above):
# local ref, else a bounded fetch of the default, else no base — full gate.
#
# Returns 2 on a bad GATE_LANE.
resolve_lane() {
  local req="${GATE_LANE:-auto}" ref="${GATE_REF:-origin/main}" f lane rank sha
  local best='docs' best_rank='-1'
  LANE=''
  LANE_REASON=''
  LANE_FILES=''

  case "$req" in
    full)
      LANE='code'
      LANE_REASON='GATE_LANE=full (forced)'
      GATE_BASE_HOW='forced' # nothing to classify, so nothing to resolve
      # ...but `check_whitespace` still wants a base, and it must not pay for a
      # fetch the caller did not ask for: look at the object database only, and
      # leave the check skipped (as a missing ref always was) when it is absent.
      if sha="$(git rev-parse --verify --quiet "${ref}^{commit}" 2>/dev/null)" &&
        [ -n "$sha" ]; then
        GATE_BASE_REF="$ref"
        GATE_BASE_SHA="${sha:0:7}"
      fi
      return 0
      ;;
    auto) ;;
    *)
      printf 'GATE_LANE=%s is not a lane: use auto (default) or full\n' "$req" >&2
      return 2
      ;;
  esac

  # The base first, then the classification. `gate_base_resolve` is cached for
  # the life of this run, so the fetch happens at most once and every step that
  # needs the base (this classifier, `check_whitespace`) reads the same answer.
  if ! gate_base_resolve "$ref"; then
    LANE='code'
    LANE_REASON="${GATE_BASE_WHY} — full gate (conservative)"
    return 0
  fi

  LANE_FILES="$(
    {
      git diff --name-only --no-renames "${ref}...HEAD" 2>/dev/null || true
      git diff --name-only --no-renames HEAD 2>/dev/null || true # uncommitted
      git ls-files --others --exclude-standard 2>/dev/null || true # untracked
    } | sed '/^[[:space:]]*$/d' | sort -u
  )"

  if [ -z "$LANE_FILES" ]; then
    LANE='code'
    LANE_REASON="no changed files vs $(gate_base_label) — full gate"
    return 0
  fi

  while IFS= read -r f; do
    [ -n "$f" ] || continue
    lane="$(lane_of_path "$f")"
    rank="$(lane_rank "$lane")"
    if [ "$rank" -gt "$best_rank" ]; then
      best="$lane"
      best_rank="$rank"
    fi
  done <<<"$LANE_FILES"

  LANE="$best"
  LANE_REASON="$(printf '%s\n' "$LANE_FILES" | wc -l | tr -d ' ') changed file(s) · base $(gate_base_label)"
  return 0
}

# lane_changed <regex> -> print the changed paths matching <regex> that still
# exist in the working tree (a deleted file has no links to check).
lane_changed() {
  local f
  [ -n "$LANE_FILES" ] || return 0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
      $1) [ -e "$f" ] && printf '%s\n' "$f" ;;
    esac
  done <<<"$LANE_FILES"
}
