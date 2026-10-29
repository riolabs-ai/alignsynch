#!/usr/bin/env bash
# scripts/install-hooks.sh — install the repo's git hooks in this clone.
#
# Points core.hooksPath at scripts/git-hooks/ so hooks are versioned with the
# code instead of copied into .git/hooks (a copy is stale the day it lands).
# Idempotent, repo-local, and undoable:
#
#   bash scripts/install-hooks.sh          # install
#   git config --unset core.hooksPath      # remove
#
# Note: core.hooksPath makes git ignore .git/hooks/* entirely, so any local
# hook you already had must move into scripts/git-hooks/ to keep running.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f scripts/git-hooks/pre-push ]; then
  echo "✗ scripts/git-hooks/pre-push is missing" >&2
  exit 1
fi
chmod +x scripts/git-hooks/pre-push

git config core.hooksPath scripts/git-hooks

printf '✓ pre-push hook installed (core.hooksPath=%s)\n' "$(git config --get core.hooksPath)"
printf '  every `git push` now runs scripts/verify.sh first (~45 s); a failure blocks the push.\n'
printf '  bypass only in a real emergency: git push --no-verify\n'
