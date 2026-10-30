#!/usr/bin/env bash
# scripts/verify.sh — THE gate.
#
# CI (.github/workflows/ci.yml) runs this script and nothing else. The pre-push
# hook (scripts/git-hooks/pre-push, installed by scripts/install-hooks.sh) runs
# the same script. Keep it that way:
#
#   * a check that lives only in YAML  -> every push is a red CI run
#   * a check that lives only here     -> "green locally" means nothing
#
# Usage:   bash scripts/verify.sh
#          GATE_LANE=full bash scripts/verify.sh   # force the code lane
#
# LANES — the gate costs what the change costs (docs/REPO-LAYERS.md)
#
# One job, one script, four depths. The lane is resolved once, up front, from
# the files that differ from $GATE_REF (default origin/main), highest wins:
#
#   lane=docs     docs/**, *.md            whitespace + relative links + biome
#   lane=content  content/**, data/**, public/**
#                                          + typecheck + data:check, NO next build
#   lane=config   .github/**, scripts/**, package.json, tsconfig*, AGENTS.md
#                                          + bash -n on every script
#   lane=code     app/**, components/**, lib/**, hooks/** (and anything unknown)
#                                          full gate, incl. next build
#
# GATE_LANE=auto is the default and what CI and the pre-push hook use.
# GATE_LANE=full forces the code lane — use it after a dependency bump, a
# tsconfig change, or any diff you do not trust the classifier with.
#
# THE GLOSSARY STEP IS IN EVERY LANE. `docs/glossary.md` is generated from the
# schema comments (#138), so a stale page is drift no typecheck can see: the page
# is docs, the comments are content, the generator is config, and each of those
# paths selects a different (cheaper) lane. It costs ~0.1 s, so it runs before
# the lane branch — one check, four depths, no exceptions.
#
# THE RELEASE STEP IS IN EVERY LANE, for the same reason (#144). `CHANGELOG.md`
# is generated from the commits, and it is also the published release notes: an
# entry that names a version `package.json` does not carry, or that has lost its
# Known limits block, is drift in a document people read. The file is docs, the
# script is config, `package.json` is config — three lanes, one check, ~0.1 s.
#
# CI classifies too, and only because it pays for the base ref: ci.yml checks
# out full history and fetches origin/main, so GATE_REF resolves there (a
# depth-1 checkout has no such ref, and until ci.yml was fixed every CI run
# logged "no origin/main to diff against — full gate (conservative)"). The
# fallback is unchanged and stays conservative: no ref, or an empty diff — a
# push to main, where HEAD *is* origin/main — means the full gate, because "I
# could not tell what changed" is never evidence that a change is cheap.
#
# BUILD SEMAPHORE — the build is 90 % of the code lane, and eight workers each
# compiling 34 routes took load average from ~6 to 39.5 on this 8-core box,
# which is why the same gate measured 145 s here and 50–71 s on CI. `next build`
# now runs inside one of QUIZHUB_BUILD_SLOTS (default 2) flock slots under
# ~/.cache/quizhub/, and the step prints whether it waited.
#
# TEST RUNNERS — `pnpm test` is `vitest run` over `tests/**/*.test.ts` (#8): app-side
# units that import `lib/quiz-cards.ts` and `data/searchdata.ts` through the `@/` alias.
# The `node --test` suite over `.datacheck/scripts/__tests__/*.test.js` stays inside
# `data:check`, because it is compiled by `tsconfig.datacheck.json` with the content
# model. Two runners, one gate: the `test` step runs in every non-docs lane, directly
# after `data:check`, and costs ~1.3 s in vitest (~2.7 s wall through pnpm) on 4 files.
#
# BRAND PARITY (#171) — `pnpm parity` renders the seven routes in `tests/parity/routes.ts`
# under `BRAND=quizhub` and `BRAND=alignsynch` and compares each to a committed snapshot.
# One brand per process (`data/brand.ts` resolves the flag at import, the way the build
# inlines it), so `scripts/parity.mjs` spawns vitest twice: ~7 s per brand, ~15 s for the
# step. It is a gate step and not a CI-only check, and it runs in every non-docs lane,
# because a `data/` fixture edit changes rendered text exactly as a component edit does —
# a lane that skipped it would hand a green local gate to a red CI run. The snapshots in
# `tests/parity/snapshots/` are generated: rewriting one is `pnpm parity:update`, and the
# PR that carries it says which routes moved and why (tests/parity/README.md).
#
# BUDGET — measured 2026-10-29, Node 24.22.0 / pnpm 12.16.1, warm node_modules,
# on an 8-core box that was ALSO running other agents' builds (load 7–14), so
# every row is "as measured under real fleet load", not on a quiet box:
#
#   lane=docs      1–2 s    (n=4: 1.15 / 1.6 / 1.9 / 2.2)
#   lane=content  16–30 s   (n=3: 15.6 / 27.9 / 30.4) — typecheck + data:check, no build
#   lane=config   20–31 s   (n=4: 20.5 / 21.0 / 31.2 / 31.3) — content depth + bash -n
#   lane=code     65 s warm .next (n=1), 82 s cold (n=1), and 95–150 s when a
#                 sibling build holds the other slot (n=2: 94.5 / 147.5 — the
#                 difference is the lock wait, printed by the build step).
#                 Target: p50 < 90 s. The flat gate was 145 s under the same load.
#
# If a lane gets slower than its row, measure before adding a step: the build is
# the only expensive one, and it is the only one a cheaper lane is allowed to
# drop.
#
# Exit:    0 = the tree is shippable; non-zero = the first failing step's code.
set -euo pipefail

# Keep in sync with the `version:` under pnpm/action-setup in .github/workflows/ci.yml.
EXPECTED_PNPM="12.16.1"

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- presentation ------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'
  C_CYN=$'\033[36m'; C_OFF=$'\033[0m'
else
  C_BOLD=""; C_DIM=""; C_RED=""; C_GRN=""; C_YEL=""; C_CYN=""; C_OFF=""
fi

STEP=""
STEP_NAMES=()
STEP_MS=()   # -1 marks a skipped step

now_ms() {
  local ns
  ns="$(date +%s%N 2>/dev/null || true)"
  case "$ns" in
    '' | *[!0-9]*) printf '%s' "$(($(date +%s) * 1000))" ;;
    *) printf '%s' "$((ns / 1000000))" ;;
  esac
}

secs() { # ms -> "1.2s"
  printf '%s.%ss' "$(( $1 / 1000 ))" "$((( $1 % 1000) / 100))"
}

summary() {
  local i name ms total=0
  printf '\n%s── gate summary ──%s\n' "$C_DIM" "$C_OFF"
  printf '%s  lane %-42s %s%s\n' "$C_DIM" "$LANE" "${LANE_REASON}" "$C_OFF"
  for i in "${!STEP_NAMES[@]}"; do
    name="${STEP_NAMES[$i]}"
    ms="${STEP_MS[$i]}"
    if [ "$ms" -lt 0 ]; then
      printf '%s○ %-46s skipped%s\n' "$C_DIM" "$name" "$C_OFF"
    else
      total=$((total + ms))
      printf '  %-46s %s\n' "$name" "$(secs "$ms")"
    fi
  done
  printf '%s  %-46s %s%s\n' "$C_DIM" "total" "$(secs "$total")" "$C_OFF"
}

fail() {
  local code=$? name="$STEP" n=${#STEP_MS[@]} ms=0
  [ "$n" -gt 0 ] && ms="${STEP_MS[$((n - 1))]}"
  [ "$code" -eq 0 ] && code=1
  printf '\n%s✗ verify: %s FAILED (exit %s)%s\n' "$C_RED" "$name" "$code" "$C_OFF" >&2
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    printf '::error title=verify: %s failed::The gate stopped here (%s). Fix this step, then re-run `bash scripts/verify.sh`.\n' "$name" "lane=$LANE"
  fi
  summary >&2
  printf '%s  fix it, then re-run: bash scripts/verify.sh%s\n' "$C_DIM" "$C_OFF" >&2
  exit "$code"
}

run_step() {
  local name="$1" ms0 ms1 status
  shift
  STEP="$name"
  printf '\n%s▶ %s%s\n' "$C_BOLD" "$name" "$C_OFF"
  ms0="$(now_ms)"
  set +e
  "$@"
  status=$?
  set -e
  ms1="$(now_ms)"
  STEP_NAMES+=("$name")
  STEP_MS+=("$((ms1 - ms0))")
  return "$status"
}

skip_step() {
  printf '\n%s○ %s — skipped (%s)%s\n' "$C_DIM" "$1" "$2" "$C_OFF"
  STEP_NAMES+=("$1")
  STEP_MS+=("-1")
}

has_script() { # has_script <name>  — is it a package.json script?
  node -e 'const s=require("./package.json").scripts||{};process.exit(s[process.argv[1]]?0:1)' "$1" 2>/dev/null
}

# --- lane classifier ---------------------------------------------------------
# shellcheck source=scripts/gate-lanes.sh
. "$ROOT/scripts/gate-lanes.sh"

# --- preflight: one runtime, local and CI ------------------------------------
preflight() {
  printf '%sverify: %s%s\n' "$C_DIM" "$ROOT" "$C_OFF"

  local pinned pinned_major node_major pnpm_v
  if [ ! -f .nvmrc ]; then
    printf '%s✗ .nvmrc is missing — local and CI must pin the same Node.%s\n' "$C_RED" "$C_OFF" >&2
    exit 1
  fi
  pinned="$(tr -dc '0-9.' < .nvmrc)"
  pinned_major="${pinned%%.*}"
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo missing)"
  if [ "$node_major" != "$pinned_major" ]; then
    printf '%s✗ runtime parity: .nvmrc pins Node %s, this shell has Node %s.%s\n' \
      "$C_RED" "$pinned" "$(node -v 2>/dev/null || echo none)" "$C_OFF" >&2
    printf '  switch first (CI already reads .nvmrc):  nvm use\n' >&2
    printf '  then:  bash scripts/verify.sh\n' >&2
    exit 1
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    printf '%s✗ pnpm is not on PATH; the lockfile is pnpm-lock.yaml (%s).%s\n' \
      "$C_RED" "$EXPECTED_PNPM" "$C_OFF" >&2
    exit 1
  fi
  pnpm_v="$(pnpm -v)"
  if [ "${pnpm_v%%.*}" != "${EXPECTED_PNPM%%.*}" ]; then
    printf '%s✗ pnpm %s on PATH, this repo needs pnpm %s.%s\n' \
      "$C_RED" "$pnpm_v" "$EXPECTED_PNPM" "$C_OFF" >&2
    printf '  npm i -g pnpm@%s\n' "$EXPECTED_PNPM" >&2
    exit 1
  fi
  if [ "$pnpm_v" != "$EXPECTED_PNPM" ]; then
    printf '%s! pnpm %s on PATH, CI pins %s — lockfile-format drift risk.%s\n' \
      "$C_RED" "$pnpm_v" "$EXPECTED_PNPM" "$C_OFF" >&2
  fi

  if [ ! -f pnpm-lock.yaml ]; then
    printf '%s✗ pnpm-lock.yaml is missing — --frozen-lockfile cannot work.%s\n' "$C_RED" "$C_OFF" >&2
    exit 1
  fi

  # Nudge, never fail: the hook is per-clone, and a clone in CI has no hooks.
  if [ -z "${GITHUB_ACTIONS:-}" ] && [ "$(git config --get core.hooksPath || true)" != "scripts/git-hooks" ]; then
    printf '%s! pre-push hook not installed in this clone: bash scripts/install-hooks.sh%s\n' \
      "$C_DIM" "$C_OFF" >&2
  fi
}

# --- the steps each lane can pick from ---------------------------------------

# bash -n every shell script in the repo, plus the hook.
check_shell_syntax() {
  local f rc=0 n=0
  for f in scripts/*.sh scripts/git-hooks/*; do
    [ -f "$f" ] || continue
    case "$f" in *.sh | */pre-push | */pre-commit | */commit-msg) ;; *) continue ;; esac
    n=$((n + 1))
    if ! bash -n "$f"; then
      printf '✗ %s: syntax error\n' "$f" >&2
      rc=1
    fi
  done
  [ "$rc" -eq 0 ] && printf '  %s script(s) parse\n' "$n"
  return "$rc"
}

# Whitespace errors in what this branch adds (and in the working tree), the way
# `git am` / a reviewer would see them.
check_whitespace() {
  local ref="${GATE_REF:-origin/main}" rc=0
  if git rev-parse --verify --quiet "${ref}^{commit}" >/dev/null 2>&1; then
    git diff --check "${ref}...HEAD" || rc=$?
  fi
  git diff --check HEAD || rc=$?
  [ "$rc" -eq 0 ] && printf '  no whitespace errors\n'
  return "$rc"
}

# Every relative link/image in the markdown this branch touched must resolve.
# Absolute URLs, anchors, and mailto: are not this gate's business.
check_doc_links() {
  local f target path bad=0 checked=0 files=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    [ -f "$f" ] || continue
    files=$((files + 1))
    while IFS= read -r target; do
      [ -n "$target" ] || continue
      target="${target#<}"
      target="${target%>}"
      target="${target%% *}"
      case "$target" in
        '' | '#'* | '//'*) continue ;;
        *://* | mailto:* | tel:* | data:*) continue ;;
      esac
      path="${target%%#*}"
      case "$path" in
        '' | *'{'* | *'}'* | *'<'* | *'$'*) continue ;; # template/placeholder links
      esac
      checked=$((checked + 1))
      if [ "${path#/}" != "$path" ]; then
        path="${path#/}" # root-relative: resolve from the repo root
        [ -e "$path" ] || { printf '✗ %s: %s — no such path\n' "$f" "$target" >&2; bad=$((bad + 1)); }
      else
        [ -e "$(dirname -- "$f")/$path" ] || [ -e "$path" ] ||
          { printf '✗ %s: %s — no such path\n' "$f" "$target" >&2; bad=$((bad + 1)); }
      fi
    done < <(grep -oE '\]\([^)[:space:]]+\)' "$f" 2>/dev/null | sed -e 's/^](//' -e 's/)$//' || true)
  done < <(lane_changed '*.md')

  if [ "$bad" -gt 0 ]; then
    printf '✗ %s broken relative link(s)\n' "$bad" >&2
    return 1
  fi
  printf '  %s relative link(s) in %s markdown file(s) resolve\n' "$checked" "$files"
}

# --- next build, at most QUIZHUB_BUILD_SLOTS at a time ------------------------
BUILD_LOCK_DIR="${QUIZHUB_BUILD_LOCK_DIR:-$HOME/.cache/quizhub}"
BUILD_SLOTS="${QUIZHUB_BUILD_SLOTS:-2}"
BUILD_LOCK_WAIT="${QUIZHUB_BUILD_LOCK_WAIT:-1800}" # seconds before giving up
BUILD_FD=""

build_slot_try() { # $1 = slot number; on success sets BUILD_FD
  local slot="$1" fd
  fd=$((40 + slot))
  eval "exec ${fd}>>\"${BUILD_LOCK_DIR}/build.lock.${slot}\""
  if flock -n -x "$fd" 2>/dev/null; then
    BUILD_FD="$fd"
    return 0
  fi
  eval "exec ${fd}>&-"
  return 1
}

build_release() {
  [ -n "$BUILD_FD" ] || return 0
  eval "exec ${BUILD_FD}>&-" 2>/dev/null || true
  BUILD_FD=""
}

build_with_lock() {
  local waited=0 slot deadline rc
  mkdir -p "$BUILD_LOCK_DIR"

  for slot in $(seq 1 "$BUILD_SLOTS"); do
    if build_slot_try "$slot"; then
      printf '  build lock: slot %s/%s free, building now (%s/build.lock.%s)\n' \
        "$slot" "$BUILD_SLOTS" "$BUILD_LOCK_DIR" "$slot"
      break
    fi
  done

  if [ -z "$BUILD_FD" ]; then
    waited=1
    printf '%s  build lock: all %s slot(s) busy — waiting (this is the queue, not a failure)%s\n' \
      "$C_YEL" "$BUILD_SLOTS" "$C_OFF"
    deadline=$(($(date +%s) + BUILD_LOCK_WAIT))
    while [ -z "$BUILD_FD" ]; do
      if [ "$(date +%s)" -ge "$deadline" ]; then
        printf '✗ build lock: waited %ss for a slot, giving up\n' "$BUILD_LOCK_WAIT" >&2
        return 1
      fi
      sleep 1
      for slot in $(seq 1 "$BUILD_SLOTS"); do
        if build_slot_try "$slot"; then break; fi
      done
    done
    printf '  build lock: waited, now holds slot %s/%s (waited lock)\n' "$slot" "$BUILD_SLOTS"
  fi

  set +e
  pnpm build
  rc=$?
  set -e
  build_release
  [ "$waited" -eq 1 ] && printf '  build lock: released slot after %s\n' "$([ "$rc" -eq 0 ] && echo green || echo failure)"
  return "$rc"
}

# --- run ---------------------------------------------------------------------
preflight

if ! resolve_lane; then
  printf '%s✗ lane classification failed%s\n' "$C_RED" "$C_OFF" >&2
  exit 2
fi

printf '%s%s lane=%s%s %s(%s — %s)%s\n' "$C_BOLD" "$C_CYN" "$LANE" "$C_OFF" \
  "$C_DIM" "$(lane_paths "$LANE")" "$LANE_REASON" "$C_OFF"
if [ "$LANE" = "code" ] && [ -n "$LANE_FILES" ]; then
  printf '%s  deepest match: %s%s\n' "$C_DIM" \
    "$(printf '%s\n' "$LANE_FILES" | while IFS= read -r f; do
      [ "$(lane_of_path "$f")" = code ] && printf '%s ' "$f"
    done | cut -c1-120)" "$C_OFF"
fi

# A dependency or tsconfig change is the one config edit a shallow lane can
# miss: the install proves the lockfile agrees, the build proves the tree still
# compiles against it. Say so instead of pretending.
if [ "$LANE" != "code" ] && printf '%s\n' "$LANE_FILES" |
  grep -qE '^(package\.json|pnpm-lock\.yaml|tsconfig.*\.json|next\.config\.\*)'; then
  printf '%s! dependency/config manifest changed — a bump wants the full gate: GATE_LANE=full bash scripts/verify.sh%s\n' \
    "$C_YEL" "$C_OFF" >&2
fi

# Order is deliberate: cheap-and-certain first, the build last.
run_step "deps (pnpm install --frozen-lockfile)" pnpm install --frozen-lockfile || fail

# Generated docs are a drift check, not a compile: `docs/glossary.md` is rebuilt from the
# schema comments and compared byte for byte (#138). It runs before the lane branch because
# the three files it reads classify into three different lanes — see the header — so a lane
# that skipped it would hand a green local gate to a red CI run.
if has_script "glossary:check"; then
  run_step "glossary (docs/glossary.md is generated from the schema comments)" pnpm glossary:check || fail
else
  skip_step "glossary" "no glossary:check script in package.json"
fi

# The CHANGELOG is generated from the commits and is the source of the release notes (#144), so
# drift here is drift in a published document: `--check` proves the newest entry names the version
# in `package.json`, that no entry has lost its Known limits block, and — once the version is
# tagged — that every commit since the previous tag appears in the entry. Same placement as the
# glossary step and for the same reason: docs, scripts and package.json classify into three
# different lanes, and a lane that skipped it would be a green local gate over a red CI run.
if has_script "release:check"; then
  run_step "release:check (CHANGELOG entry matches the version and the commits)" pnpm release:check || fail
else
  skip_step "release:check" "no release:check script in package.json"
fi

if [ "$LANE" = "config" ]; then
  run_step "bash -n (every script parses)" check_shell_syntax || fail
fi

if [ "$LANE" = "docs" ]; then
  run_step "whitespace (git diff --check)" check_whitespace || fail
  run_step "links (relative links resolve)" check_doc_links || fail
else
  run_step "typecheck (next typegen && tsc --noEmit)" pnpm typecheck || fail
fi

# Biome formats markdown too, so this is the docs lane's real gate as well as
# the code lane's: a hand-wrapped doc fails `lint` before CI ever sees it.
run_step "lint (biome check)" pnpm lint || fail
run_step "format:check (biome format)" pnpm format:check || fail

if [ "$LANE" != "docs" ]; then
  if has_script "data:check"; then
    run_step "data:check (schema + collection invariants)" pnpm data:check || fail
  else
    skip_step "data:check" "no data:check script in package.json"
  fi

  if has_script "test"; then
    run_step "test" pnpm test || fail
  else
    skip_step "test" "no test script in package.json"
  fi

  # Both brands, both snapshots (#171). Placed beside `test` rather than beside `build`
  # because it renders, it does not compile: the step is ~15 s and a cheaper lane may pay
  # that, which is why it is not part of the code lane's build. It cannot be dropped from a
  # lane that changes content either — a fixture edit is exactly the drift this catches.
  if has_script "parity"; then
    run_step "parity (both brands render the committed snapshot)" pnpm parity || fail
  else
    skip_step "parity" "no parity script in package.json"
  fi
fi

if [ "$LANE" = "code" ]; then
  run_step "build (next build, flock slot)" build_with_lock || fail
else
  skip_step "build (next build)" "lane=$LANE has no build step — CI re-runs the full gate on the merge head"
fi

STEP=""
summary
printf '%s✓ verify: green (lane=%s)%s\n' "$C_GRN" "$LANE" "$C_OFF"
