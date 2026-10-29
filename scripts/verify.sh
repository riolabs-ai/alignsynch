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
# Budget:  p50 < 90 s locally, < 4 min on CI. If it gets slower, split it into
#          lanes (fast: typecheck+lint+tests / slow: build+e2e) — never make a
#          step optional.
# Exit:    0 = the tree is shippable; non-zero = the first failing step's code.
set -euo pipefail

# Keep in sync with the `version:` under pnpm/action-setup in .github/workflows/ci.yml.
EXPECTED_PNPM="12.16.1"

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- presentation ------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'; C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_OFF=$'\033[0m'
else
  C_BOLD=""; C_DIM=""; C_RED=""; C_GRN=""; C_OFF=""
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
  printf '%s.%ss' "$(( $1 / 1000 ))" "$((( $1 % 1000 ) / 100))"
}

summary() {
  local i name ms total=0
  printf '\n%s── gate summary ──%s\n' "$C_DIM" "$C_OFF"
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
    printf '::error title=verify: %s failed::The gate stopped here. Fix this step, then re-run `bash scripts/verify.sh`.\n' "$name"
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

preflight

# --- the gate ----------------------------------------------------------------
# Order is deliberate: cheap-and-certain first, the 30 s build last.
run_step "deps (pnpm install --frozen-lockfile)" pnpm install --frozen-lockfile || fail
run_step "typecheck (next typegen && tsc --noEmit)" pnpm typecheck || fail
run_step "lint (biome check)" pnpm lint || fail
run_step "format:check (biome format)" pnpm format:check || fail

# data/schema check — present on branches that carry content/ + scripts/data-check.ts.
if has_script "data:check"; then
  run_step "data:check (schema + collection invariants)" pnpm data:check || fail
else
  skip_step "data:check" "no data:check script in package.json"
fi

# unit tests — same rule: run them when the tree has them.
if has_script "test"; then
  run_step "test" pnpm test || fail
else
  skip_step "test" "no test script in package.json"
fi

run_step "build (next build)" pnpm build || fail

STEP=""
summary
printf '%s✓ verify: green%s\n' "$C_GRN" "$C_OFF"
