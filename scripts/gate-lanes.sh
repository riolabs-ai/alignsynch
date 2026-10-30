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

# resolve_lane -> fills LANE, LANE_REASON, LANE_FILES (newline-separated).
#
# GATE_LANE=auto (default) classifies. GATE_LANE=full forces the code lane; it
# is the escape hatch, not a second lane definition. GATE_REF (default
# origin/main) is the ref the diff is taken against — override it for a stacked
# branch or a test harness.
#
# Returns 2 on a bad GATE_LANE.
resolve_lane() {
  local req="${GATE_LANE:-auto}" ref="${GATE_REF:-origin/main}" f lane rank
  local best='docs' best_rank='-1'
  LANE=''
  LANE_REASON=''
  LANE_FILES=''

  case "$req" in
    full)
      LANE='code'
      LANE_REASON='GATE_LANE=full (forced)'
      return 0
      ;;
    auto) ;;
    *)
      printf 'GATE_LANE=%s is not a lane: use auto (default) or full\n' "$req" >&2
      return 2
      ;;
  esac

  # No base ref -> no evidence about what changed -> the full gate. This is the
  # safety net, not the CI case: ci.yml checks out full history and fetches
  # `origin/main` precisely so that this branch is not taken on every run (a
  # depth-1 checkout has no such ref, which is how CI silently ran lane=code
  # for every PR). A missing ref, a bad GATE_REF, or a diff that cannot be
  # computed still costs the full gate — never a cheaper lane.
  if ! git rev-parse --verify --quiet "${ref}^{commit}" >/dev/null 2>&1; then
    LANE='code'
    LANE_REASON="no ${ref} to diff against — full gate (conservative)"
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
    LANE_REASON="no changed files vs ${ref} — full gate"
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
  LANE_REASON="$(printf '%s\n' "$LANE_FILES" | wc -l | tr -d ' ') changed file(s) vs ${ref}"
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
