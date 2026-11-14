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
# LANES — the gate costs what the change costs (docs/operations/repo-layers.md)
#
# One job, one script, four depths. The lane is resolved once, up front, from
# the files that differ from $GATE_REF (default origin/main), highest wins:
#
#   lane=docs     docs/**, *.md            whitespace + biome (links run in every lane)
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
# THE REGISTRY STEP IS IN EVERY LANE, for the third time and the same reason (#173).
# `docs/ui-registry.md` is generated from `components/`, `app/` and `data/ui-registry.ts`, so a
# new component domain with no judgement entry, an entry whose surface is gone, and a page that
# was not regenerated are all drift no typecheck can see — and the three paths involved
# (`components/`, `data/`, `docs/`) classify into three different lanes. It costs ~0.2 s.
#
# THE RELEASE STEP IS IN EVERY LANE, for the same reason (#144). `CHANGELOG.md`
# is generated from the commits, and it is also the published release notes: an
# entry that names a version `package.json` does not carry, or that has lost its
# Known limits block, is drift in a document people read. The file is docs, the
# script is config, `package.json` is config — three lanes, one check, ~0.1 s.
#
# THE RELEASE BLOG STEP IS IN EVERY LANE TOO (#652). `docs/changelog/` is a view of
# `CHANGELOG.md` — the date, the tag, the entry's sections and the Known limits block
# are copied into each page by `scripts/changelog-view.mjs` — so the entry is docs,
# the generator is config and the pages are docs: the same three lanes, one check.
#
# THE COLUMNS STEP IS IN EVERY LANE TOO (#858). `data/surface-columns.ts` is the registry of
# which width each `app/(mainlayout)/` page draws in, and `scripts/column-refs.ts` holds it against
# the tree: a page with no row, a `wide` with no reason, a `bleed` whose `back` does not resolve,
# or a column page whose view still centres itself all fail here. The registry is data, the check
# is a script, the pages are app — three lanes, one check, ~0.4 s.
#
# CI classifies too, and only because it pays for the base ref: ci.yml checks
# out full history and fetches origin/main, so GATE_REF resolves there (a
# depth-1 checkout has no such ref, and until ci.yml was fixed every CI run
# logged "no origin/main to diff against — full gate (conservative)"). A
# worktree pays the same way now: gate-lanes.sh resolves the base itself before
# classifying — the local ref, else one bounded `git fetch --no-tags origin main`
# (no checkout, no pull, no branch — see scripts/gate-lanes.sh), and the lane
# line names the sha and the path that resolved it: `base origin/main@abc1234
# (local ref)` / `(fetched in 0.4s)`. The fallback is unchanged and stays
# conservative: no ref, no merge base, or an empty diff — a push to main, where
# HEAD *is* origin/main — means the full gate, because "I could not tell what
# changed" is never evidence that a change is cheap. A failed fetch is a reason
# to run MORE gate, never a reason to fail it.
#
# GATE SLOTS — one CPU budget for the whole heavy section, not just the build.
# `next typegen`, `tsc --noEmit`, `biome check`, `biome format --check`, the `data:check`
# compile, `parity` and `next build` are the phases that saturate the box. The slot used to
# wrap `next build` alone — one step out of nineteen — so two gate runs in flight measured
# **load 20.7 / 15.9 / 13.7** on this 8-core host with every one of those phases running 5–10x
# its documented cost, workers heartbeating for 55 min without progress, and cards reclaimed
# while their process kept compiling.
#
# One slot is now taken at the first heavy step and held for the whole section — not
# re-acquired per step, because a run that released after `tsc` and re-acquired for `next build`
# would interleave with another run's build, which is the interleaving the slot exists to
# prevent. The section ends when the run finishes its build (or fails — the EXIT trap hands the
# slot back either way), and every wait is printed with the seconds it cost.
#
# The lock *files* keep their old names (`build.lock.N`) on purpose: a gate running from an
# older tree still holds them during its `next build`, so a mixed fleet budgets one set of slots
# rather than two that cannot see each other.
#
# SHARED BUILD CACHE — the slot buys ordering, not warmth, so the cache is shared
# too (`scripts/build-cache.mjs`). `.next` is per-worktree, so every worktree used
# to start `next build` with an empty Turbopack cache and recompile all 34 routes:
# 70 worktrees held 64 separate caches totalling 27 GB. While the slot is held, the
# step links `.next/cache` to `~/.cache/quizhub/next/<key>/` and unlinks it after,
# so a worktree with nothing built yet reads what the last build left there — and a
# dev server never opens a store a build holds. `pnpm typecheck` does the same for
# its `tsc` buildinfo. The key is a hash of the `next` version, the `typescript`
# version, the Node major and the `pnpm-lock.yaml` digest, so a bump lands on a
# different directory and misses; every directory carries a `.cache-key` sentinel
# and one that does not match is deleted, never read. Slot 1 uses the key's own
# directory and the other slots use siblings, because the store is a single-writer
# RocksDB and a second concurrent build on it fails rather than merges.
# `node scripts/build-cache.mjs status` prints the key, the paths and their sizes.
#
# TEST RUNNERS — `pnpm test` is `vitest run` over `tests/**/*.test.ts` (#8): app-side
# units that import `lib/quiz-cards.ts` and `data/searchdata.ts` through the `@/` alias.
# The `node --test` suite over `.datacheck/scripts/__tests__/*.test.js` stays inside
# `data:check`, because it is compiled by `tsconfig.datacheck.json` with the content
# model. Two runners, one gate: the `test` step runs in every non-docs lane, directly
# after `data:check`, and costs ~1.3 s in vitest (~2.7 s wall through pnpm) on 4 files.
#
# BRAND PARITY (#171) — `pnpm parity` renders the seven routes in `tests/parity/routes.ts`
# under `BRAND=quizhub` and `BRAND=alignsynch` and compares each render to one line of
# `tests/parity/manifest.txt` (`route | brand | sha256`) plus its committed structural summary.
# One brand per process (`data/brand.ts` resolves the flag at import, the way the build
# inlines it), so `scripts/parity.mjs` spawns vitest twice: ~7 s per brand, ~15 s for the
# step. It is a gate step and not a CI-only check, and it runs in every non-docs lane,
# because a `data/` fixture edit changes rendered text exactly as a component edit does —
# a lane that skipped it would hand a green local gate to a red CI run. A hash is rewritten
# by `pnpm parity:update --reason "…"`, and the PR that carries it says which routes moved
# and why (tests/parity/README.md). Full HTML is never committed: a mismatch writes the
# render to `tests/parity/artifacts/` (gitignored) and CI uploads it on a red leg.
#
# BUDGET — measured 2026-10-29, Node 24.22.0 / pnpm 12.16.1, warm node_modules,
# on an 8-core box that was ALSO running other agents' builds (load 7–14), so
# every row is "as measured under real fleet load", not on a quiet box:
#
#   lane=docs      1–2 s    (n=4: 1.15 / 1.6 / 1.9 / 2.2)
#   lane=content  16–30 s   (n=3: 15.6 / 27.9 / 30.4) — typecheck + data:check, no build
#   lane=config   20–31 s   (n=4: 20.5 / 21.0 / 31.2 / 31.3) — content depth + bash -n
#   lane=code     65 s warm .next (n=1), 82 s cold (n=1), and 95–150 s when a
#                 sibling run holds the other slot (n=2: 94.5 / 147.5 — the
#                 difference is the lock wait, printed by the gate-slot step).
#                 Target: p50 < 90 s. The flat gate was 145 s under the same load.
#                 The gate slot now covers the whole heavy section rather than the
#                 build alone; the measured table and why the default is 3 are in
#                 docs/operations/repo-layers.md ("The gate slot").
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
# `git am` / a reviewer would see them. The base is the one `resolve_lane` already
# resolved (cached for the run) — a second resolution here would be a second fetch.
check_whitespace() {
  local ref="${GATE_BASE_REF:-}" rc=0
  if [ -n "$ref" ]; then
    git diff --check "${ref}...HEAD" || rc=$?
  fi
  git diff --check HEAD || rc=$?
  [ "$rc" -eq 0 ] && printf '  no whitespace errors\n'
  return "$rc"
}

# --- gate slots: one CPU budget for the whole heavy section -------------------
# Taken once, at the first heavy step, and held to the end of the build. See the header for why
# the section is not re-acquired per step and why the lock files kept their old names.
GATE_LOCK_DIR="${QUIZHUB_GATE_LOCK_DIR:-${QUIZHUB_BUILD_LOCK_DIR:-$HOME/.cache/quizhub}}"
# Default 3, not 2: measured on this 8-core host (docs/operations/repo-layers.md carries the table). Two slots
# cost a whole extra wave the moment a third run arrives — 3 runs at 2 slots took 315 s against
# 200 s with no cap — while three slots never queue at the concurrency the fleet reaches and beat
# the uncapped gate at five: 333 s against 358 s, peak 1-min load 29.9 against 41.3.
GATE_SLOTS="${QUIZHUB_GATE_SLOTS:-${QUIZHUB_BUILD_SLOTS:-3}}"
GATE_LOCK_WAIT="${QUIZHUB_GATE_LOCK_WAIT:-${QUIZHUB_BUILD_LOCK_WAIT:-1800}}" # seconds before giving up
GATE_FD=""
GATE_SLOT=""
GATE_WAIT_S=0
GATE_HOLD_0=0

gate_slot_try() { # $1 = slot number; on success sets GATE_FD/GATE_SLOT
  local slot="$1" fd
  fd=$((40 + slot))
  eval "exec ${fd}>>\"${GATE_LOCK_DIR}/build.lock.${slot}\""
  if flock -n -x "$fd" 2>/dev/null; then
    GATE_FD="$fd"
    GATE_SLOT="$slot"
    return 0
  fi
  eval "exec ${fd}>&-"
  return 1
}

gate_slot_acquire() {
  [ -z "$GATE_FD" ] || return 0 # already held: one slot for the whole section
  case "$GATE_SLOTS" in
    '' | *[!0-9]*)
      printf '✗ gate slot: the slot count must be a positive integer, got "%s"\n' "$GATE_SLOTS" >&2
      return 1
      ;;
  esac
  if [ "$GATE_SLOTS" -lt 1 ] || [ "$GATE_SLOTS" -gt 16 ]; then
    printf '✗ gate slot: %s slot(s) is outside 1..16\n' "$GATE_SLOTS" >&2
    return 1
  fi
  mkdir -p "$GATE_LOCK_DIR"

  local slot start waited note_at
  for slot in $(seq 1 "$GATE_SLOTS"); do
    if gate_slot_try "$slot"; then
      GATE_HOLD_0="$(date +%s)"
      printf '  gate slot: slot %s/%s free, heavy section starts now (%s/build.lock.%s)\n' \
        "$slot" "$GATE_SLOTS" "$GATE_LOCK_DIR" "$slot"
      return 0
    fi
  done

  start="$(date +%s)"
  note_at="$start"
  printf '%s  gate slot: all %s slot(s) busy — waiting (this is the queue, not a failure)%s\n' \
    "$C_YEL" "$GATE_SLOTS" "$C_OFF"
  while :; do
    waited=$(($(date +%s) - start))
    if [ "$waited" -ge "$GATE_LOCK_WAIT" ]; then
      printf '✗ gate slot: waited %ss for a slot, giving up\n' "$GATE_LOCK_WAIT" >&2
      return 1
    fi
    sleep 1
    for slot in $(seq 1 "$GATE_SLOTS"); do
      if gate_slot_try "$slot"; then
        GATE_WAIT_S=$(($(date +%s) - start))
        GATE_HOLD_0="$(date +%s)"
        printf '  gate slot: waited %ss, now holds slot %s/%s — heavy section starts\n' \
          "$GATE_WAIT_S" "$slot" "$GATE_SLOTS"
        return 0
      fi
    done
    # A wait long enough to matter says so while it happens, not only when it ends.
    if [ $(($(date +%s) - note_at)) -ge 15 ]; then
      note_at="$(date +%s)"
      printf '%s  gate slot: still waiting (%ss) — all %s slot(s) held%s\n' \
        "$C_DIM" "$((note_at - start))" "$GATE_SLOTS" "$C_OFF"
    fi
  done
}

gate_slot_release() { # idempotent: explicit release at the end of the section, trap on failure
  local held
  [ -n "$GATE_FD" ] || return 0
  # A gate that stopped anywhere after the typecheck link must not leave the tree's
  # `.next/cache` pointing at the shared store: a dev server would then open the
  # store a later gate build holds. Idempotent — nothing is linked on the normal path.
  node scripts/build-cache.mjs unlink >/dev/null 2>&1 || true
  eval "exec ${GATE_FD}>&-" 2>/dev/null || true
  held=$(( $(date +%s) - GATE_HOLD_0 ))
  printf '  gate slot: released slot %s/%s (held %ss, waited %ss)\n' \
    "$GATE_SLOT" "$GATE_SLOTS" "$held" "$GATE_WAIT_S"
  GATE_FD=""
  GATE_SLOT=""
}

build_in_slot() { # the slot is already held by the section; this is a guard, not a second lock
  local rc
  gate_slot_acquire || return 1
  # The shared cache is keyed per slot (scripts/build-cache.mjs): the store is a
  # single-writer RocksDB, so the slot that is held decides which directory it opens.
  export QUIZHUB_BUILD_SLOT="$GATE_SLOT"
  node scripts/build-cache.mjs link
  set +e
  pnpm build
  rc=$?
  set -e
  # A dev server keeps its own cache under the same path and must never open the
  # shared store a build holds; put the tree's own empty directory back.
  node scripts/build-cache.mjs unlink || true
  return "$rc"
}

trap gate_slot_release EXIT

# --- run ---------------------------------------------------------------------
preflight

if ! resolve_lane; then
  printf '%s✗ lane classification failed%s\n' "$C_RED" "$C_OFF" >&2
  exit 2
fi

printf '%s%s lane=%s%s %s(%s — %s)%s\n' "$C_BOLD" "$C_CYN" "$LANE" "$C_OFF" \
  "$C_DIM" "$(lane_paths "$LANE")" "$LANE_REASON" "$C_OFF"

# WHICH BASE, AND HOW IT GOT HERE. The lane line above names the sha; this line
# names the path that resolved it whenever the answer was not simply "it was
# already here" — a silent fetch, or a silent fallback, is the failure mode this
# resolution exists to remove.
case "${GATE_BASE_HOW:-}" in
  fetched)
    printf '%s  base: %s was not in this clone — %s%s\n' \
      "$C_DIM" "${GATE_REF:-origin/main}" "$(gate_base_label)" "$C_OFF"
    ;;
  '')
    printf '%s! base: %s — full gate (conservative)%s\n' \
      "$C_YEL" "${GATE_BASE_WHY:-no base ref}" "$C_OFF" >&2
    ;;
esac

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

# The UI registry is generated from the tree and the judgement half beside it (#173): a component
# domain with no entry, an entry whose surface is gone, or a page regenerated by hand all fail
# here. Same placement as the glossary step, for the same lane-splitting reason — see the header.
if has_script "ui:registry:check"; then
  run_step "ui-registry (docs/ui-registry.md matches the tree and data/ui-registry.ts)" pnpm ui:registry:check || fail
else
  skip_step "ui-registry" "no ui:registry:check script in package.json"
fi

# The left edge (#858). `data/surface-columns.ts` says which width every `app/(mainlayout)/` page
# draws in; `scripts/column-refs.ts` holds it against the filesystem in both directions and fails
# a column page that re-centres its body. Same placement as the glossary step and for the fifth
# time the same reason: the registry is a fixture (data/), the check is a script (scripts/), the
# pages are code (app/), and those three paths classify into three different lanes — a lane that
# skipped it would hand a green local gate to a red CI run. ~0.4 s.
if has_script "columns:check"; then
  run_step "columns (every shell page declares its width; no column page re-centres)" pnpm columns:check || fail
else
  skip_step "columns" "no columns:check script in package.json"
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

# The release blog under `docs/changelog/` is a *view* of `CHANGELOG.md` (#652): the date, the tag,
# the entry's own sections and the whole Known limits block are copied into the pages by
# `scripts/changelog-view.mjs`, so an entry edited without regenerating the blog is drift in a
# document people read — and a second opinion about a fact `release:check` already owns. In every
# lane for the third time and the same reason as above: the entry is docs, the generator is config,
# the pages are docs, and a lane that skipped it would be green over a red CI run. ~0.2 s.
if has_script "changelog:check"; then
  run_step "changelog:check (docs/changelog is a view of CHANGELOG.md)" pnpm changelog:check || fail
else
  skip_step "changelog:check" "no changelog:check script in package.json"
fi

# The docs hub (`docs/README.md`) and the nav block on every page are generated from `docs/docs.json`
# by `scripts/docs-nav.mjs` (#651), and the same step is the docs graph's proof: every relative link
# and image in the checkout resolves, every document under `docs/` is listed in the hub exactly once,
# no page is an orphan, and every nav block matches the manifest. It replaces the old docs-lane
# `links` step, which read only the markdown *this branch touched* — a link that was already broken
# stayed broken, and it could not see a hub at all. In every lane for the fourth time and the same
# reason: a new page is docs, its row is docs, the generator is config. ~0.3 s.
if has_script "docs:check"; then
  run_step "docs:check (hub, nav, links and images)" pnpm docs:check || fail
else
  skip_step "docs:check" "no docs:check script in package.json"
fi

# Markdown style (#937). `docs/` is 142 pages and nothing enforced their shape: Biome formats them
# (wrapping, table padding) but a fence with no language tag, an issue number at the start of a line
# GitHub renders as an `<h1>`, or a `#620`-style heading that swallowed a sentence all stayed green.
# `pnpm md:check` is `markdownlint-cli2` (the rules in `.markdownlint-cli2.jsonc`, none of them a
# line-length rule — paragraphs are never re-wrapped) plus `scripts/md-style.mjs --check`, the two
# rewrites no linter can autofix. It runs in **every lane beside `docs:check`**, not only in the
# content lane: a formatting defect lands in a `docs/**` diff, which classifies as the docs lane,
# and a step that only ran for `content/**` would be green over exactly the change it exists to
# catch. Measured on this host: 106 files linted in 4.8–9.6 s (markdownlint-cli2, a fresh process each
# run and 8–19 MB of dependencies to resolve) plus 0.15 s for the codemod — the docs lane is the one
# that pays it most, and it is still seconds, not the build.
if has_script "md:check"; then
  run_step "md:check (markdownlint-cli2 + md-style: fences, escapes, alerts)" pnpm md:check || fail
else
  skip_step "md:check" "no md:check script in package.json"
fi

# The email bodies. `content/email-bodies.md` is where every template's prose is written and
# `lib/email/bodies.generated.ts` is what the build imports, so a body edited without regenerating
# — or a template with no section — is drift no typecheck can see: the type is a string either way.
# Same placement as the glossary step and for the same reason: the markdown is content, the
# generator is scripts, the generated module is lib, and those three paths classify into three
# different lanes. It also fails by name on a body that still carries the retired marker, an orphan
# section, a duplicate id and an undeclared placeholder. ~0.4 s.
if has_script "email:bodies:check"; then
  run_step "email:bodies (content/email-bodies.md generates lib/email/bodies.generated.ts)" pnpm email:bodies:check || fail
else
  skip_step "email:bodies" "no email:bodies:check script in package.json"
fi

# The release atlas (#945): every route `data/pages/budget.ts` registers has a row in the current
# version's `docs/qa-atlas/<version>/manifest.json`, every claimed status agrees with the boundary
# table (`tests/parity/boundary.ts`), every thumbnail the manifest points at exists, and the atlas
# directory stays inside its 5 MB budget. **Static on purpose** — no browser, no connection, nothing
# from `lib/db/**` — because the capture needs a server and the demo branch's rows, which CI has not
# got, while the *claim* that every route was captured is exactly what a gate can hold. In every lane
# for the fifth time and the same reason as the steps above: the registry is `data/`, the boundary is
# `tests/`, the generator is `scripts/`, the manifest is `docs/`, and a lane that skipped it would be
# green over a stale atlas. ~0.2 s. A route the manifest does not carry fails **by route name**.
if has_script "qa:atlas:check"; then
  run_step "qa:atlas:check (the registry and the atlas manifest agree)" pnpm qa:atlas:check || fail
else
  skip_step "qa:atlas:check" "no qa:atlas:check script in package.json"
fi

# The recorded demo walk (#898). `docs/qa/demo-flow/transcript.json` + its 55 committed PNGs are
# what `/how-it-works` replays, so a transcript that has drifted from the screenshots it names is a
# page describing a walk nobody took — and nothing above can see it: the JSON parses, `typecheck`
# never reads it and `data:check` has no invariant over it. **Static on purpose** — no browser, no
# connection, nothing from `lib/db/**` — because `pnpm demo:flow` (and its `--check`) drive a live
# demo instance through a real Chrome and seed the demo branch, which CI has not got. That makes the
# transcript regenerable by a maintainer and not by CI; what a gate *can* hold is that the committed
# transcript still describes its own screenshots, which is exactly what `--verify` asserts: the
# schema the file declares about itself (`$doc.fields`), 1..n contiguous steps grouped in the order
# `paths[]` carries, every `shot` present as a PNG whose IHDR matches its recorded `w`×`h` (the check
# behind the missing/re-cropped image), and `paths[]`/`summary`/`findings` agreeing with the arrays
# they count. It pins **no text**, so a re-record that moves routes or typed values stays green, and
# it needs no other step to notice a driver that starts writing a field the schema does not declare.
# In every lane for the sixth time and the same reason as the steps above: the transcript is
# `docs/`, the driver is `scripts/`, the entry is `package.json` — three lanes, one check, and a
# docs-only diff is exactly the one that can edit a transcript. ~0.2 s.
if has_script "demo:flow:verify"; then
  run_step "demo:flow:verify (the replay transcript still describes its own screenshots)" pnpm demo:flow:verify || fail
else
  skip_step "demo:flow:verify" "no demo:flow:verify script in package.json"
fi

# The rail's document (`data/nav-menu.json`, #861) is the Admin sidebar: the groups, their rows,
# their order, their rung and their visibility. The schema is `content/nav.ts`; this step is the
# other half — every href resolves in `content/routes.ts`, every icon is a `NavIconName`, every
# label id exists in `data/pages/shell.ts`, every `needs` is a rung, every hidden row says why, and
# no id or href is drawn twice. It reads files only (~0.1 s), so it runs in every lane for the same
# reason the steps above do: the document is `data/`, the schema is `content/`, the script and this
# line are `scripts/` — three lanes, one check, and a malformed rail must fail the gate rather
# than a request.
if has_script "nav:menu"; then
  run_step "nav:menu (data/nav-menu.json — routes, icons, labels, rungs)" pnpm nav:menu --check || fail
else
  skip_step "nav:menu" "no nav:menu script in package.json"
fi

if [ "$LANE" = "config" ]; then
  run_step "bash -n (every script parses)" check_shell_syntax || fail
fi

# The heavy section starts here and holds one gate slot to the end of the build: `next typegen`,
# `tsc --noEmit`, `biome check`, `biome format --check`, the `data:check` compile, `parity` and
# `next build` all saturate the box, and two runs of them at once cost more than they save.
STEP="gate slot (heavy section)"
gate_slot_acquire || fail

if [ "$LANE" = "docs" ]; then
  run_step "whitespace (git diff --check)" check_whitespace || fail
else
  # The typecheck writes the **build's own** buildinfo, so `next build` later in this
  # section resumes from the program this step already checked instead of repeating
  # it: one pass, two verdicts, nothing skipped. That only works while `.next/cache`
  # is linked at this slot (scripts/build-cache.mjs names the path), so the link is
  # taken here and handed straight back — narrower than the build's own window, and
  # restored on failure by the trap as well. Measured: 63.9 s → 16.1 s wall for the
  # build's check, docs/operations/gate.md.
  export QUIZHUB_BUILD_SLOT="$GATE_SLOT"
  node scripts/build-cache.mjs link
  if ! run_step "typecheck (next typegen && tsc --noEmit, shared with build)" pnpm typecheck; then
    node scripts/build-cache.mjs unlink >/dev/null 2>&1 || true
    fail
  fi
  node scripts/build-cache.mjs unlink >/dev/null 2>&1 || true
fi

# Biome formats markdown too, so this is the docs lane's real gate as well as
# the code lane's: a hand-wrapped doc fails `lint` before CI ever sees it.
# The step is `pnpm lint` = `biome check && node scripts/lint-brand-classes.mjs`: the brand rule
# (#187 stage 4) rides inside the existing lint step, in every lane, so there is no second
# pipeline and no CI-only check. It prints its own census there — `brand classes: N file(s) …
# 0 palette steps, 0 gradient utilities` — which is what makes it visible in the gate output.
run_step "lint (biome check + brand classes)" pnpm lint || fail
run_step "format:check (biome format)" pnpm format:check || fail

if [ "$LANE" != "docs" ]; then
  if has_script "data:check"; then
    run_step "data:check (schema + collection invariants)" pnpm data:check || fail
  else
    skip_step "data:check" "no data:check script in package.json"
  fi

  # The growth model (#920). `data/demo/growth-model.json` is generated from
  # `content/growth-model.ts` by `pnpm growth`, and every number `/admin/growth` charts comes out of
  # it — so a parameter edited without regenerating is a page describing a business the code no
  # longer computes, and nothing above can see it: `typecheck` is happy, `data:check` has no
  # invariant over the model, and the JSON parses. The step regenerates the model from the committed
  # file's own parameters and diffs field by field, naming the first path that moved. ~0.6 s.
  # It runs in the content lane because that is the lane a model or fixture edit classifies into —
  # and in every other non-docs lane for the reason the steps above run everywhere: the content is
  # `content/` + `data/`, the generator is `scripts/`, and the page is `app/`.
  if has_script "growth:check"; then
    run_step "growth:check (data/demo/growth-model.json is what this tree generates)" pnpm growth:check || fail
  else
    skip_step "growth:check" "no growth:check script in package.json"
  fi

  # The demo dataset, end to end: seed it, drive the app, diff against
  # `data/verify/demo-expectations.json`. It is **not** a CI step — CI has no database and no
  # server — so the step runs in `--gate` mode: a full, hard check when the environment can
  # support it (a `DATABASE_URL`, an auth base URL and something listening at `BASE_URL`), and a
  # printed skip with the reason when it cannot. The skip is a `○` line, never a silent pass, so a
  # green gate never claims to have verified something it did not run.
  if has_script "demo:verify"; then
    run_step "demo:verify (demo dataset, UI + rows)" pnpm demo:verify --gate || fail
  else
    skip_step "demo:verify" "no demo:verify script in package.json"
  fi

  if has_script "test"; then
    run_step "test" pnpm test || fail
  else
    skip_step "test" "no test script in package.json"
  fi

  # Both brands, both hashes (#171). Placed beside `test` rather than beside `build`
  # because it renders, it does not compile: the step is ~15 s and a cheaper lane may pay
  # that, which is why it is not part of the code lane's build. It cannot be dropped from a
  # lane that changes content either — a fixture edit is exactly the drift this catches.
  if has_script "parity"; then
    run_step "parity (both brands render the committed manifest)" pnpm parity || fail
  else
    skip_step "parity" "no parity script in package.json"
  fi
fi

if [ "$LANE" = "code" ]; then
  run_step "build (next build)" build_in_slot || fail
else
  skip_step "build (next build)" "lane=$LANE has no build step — CI re-runs the full gate on the merge head"
fi

# End of the heavy section: hand the slot back before the summary prints. The EXIT trap is the
# same call, so a failing step releases it too — a crashed gate must not hold a slot.
gate_slot_release

STEP=""
summary
printf '%s✓ verify: green (lane=%s)%s\n' "$C_GRN" "$LANE" "$C_OFF"
