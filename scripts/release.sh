#!/usr/bin/env bash
# scripts/release.sh — one command per release (issue #144).
#
#   bash scripts/release.sh --check                 the gate step: the CHANGELOG entry matches
#                                                  package.json, the commits and has a Known limits block
#   bash scripts/release.sh --check-limits <file>   the pre-publication step: every path the candidate
#                                                  Known limits block names exists in this tree, and every
#                                                  `path::symbol` resolves to a binding in that file
#   bash scripts/release.sh --dry-run <version>    print the entry it would write; write nothing
#   bash scripts/release.sh <version>              gate -> entry -> bump -> commit -> tag -> push -> Release
#   bash scripts/release.sh --tag-only <version>   the version and entry are already on `main`
#                                                  (merged in a release-engineering PR): tag HEAD
#
# --limits <file> supplies the Known limits block for a generated entry. Without it a generation
# refuses to write: the block is public release-note content, so a human writes it.
#
# Why --check-limits exists: that block ships verbatim as the GitHub Release body and nothing else
# re-derives a word of it. v1.3.0 published a bullet naming `lib/flow/paths.ts::answerPath` — the
# file exists, the binding never did — and a claim about a nav row no row exists for. The first is
# a name in the tree and is now checked; run this on the candidate block before the tag, not after
# the release. It is deliberately not part of `--check`: a published entry is fixed text, and a
# check that can only report it cannot prevent it. Route claims (`/assessment/...`) are out of
# scope in this first cut — see `scripts/release-limits.mjs` for what that would need.
#
# Why --tag-only exists: a cut can be prepared in a pull request, where the version bump and the
# entry are reviewed like any other change. The tag then belongs on the merge commit, not on a
# second commit nobody reviewed. v1.0.0 was cut that way.
#
# The version source of truth is package.json; the tag is `v<version>`; the release notes are the
# CHANGELOG entry, byte for byte (`gh release create --notes-file`). The commits on main are
# already conventional, so `git log` is the whole generator — no new dependency, no commitlint.
#
# A pre-release is cut the same way: `1.1.0-rc1` is a version (semver's `-suffix`), its entry is
# `## [1.1.0-rc1] - <date>`, and the GitHub Release is created with `--prerelease`. A `+build`
# suffix is build metadata — allowed, equal in precedence to the release it decorates, and so not
# marked pre-release. `scripts/release-version.mjs` is the one classifier: validity, ordering and
# "is this a bump" that the gate, the bump guard and the publish step all share.
#
# A pushed tag is never moved. A botched cut is abandoned (delete the tag and the release) and the
# next attempt is the next version number.
#
# Exit: 0 ok · 1 refused (the message says why) · 2 usage.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHANGELOG="CHANGELOG.md"
VERSION_TOOL="scripts/release-version.mjs"
LIMITS_TOOL="scripts/release-limits.mjs"
CONVENTIONAL='^[a-z]+(\([^)]*\))?!?: '

say() { printf '%s\n' "$*"; }
step() { printf '\n▶ %s\n' "$*"; }
die() { printf 'release: %s\n' "$*" >&2; exit 1; }
# The usage text is the file's own header comment, read to its first non-comment line: a mode
# added at the top can never be left out of `--help` by an off-by-one line range.
usage_die() {
  printf 'release: %s\n\n' "$*" >&2
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "${BASH_SOURCE[0]}" >&2
  exit 2
}

pkg_version() { node -p 'require("./package.json").version'; }

repo_slug() {
  local url
  url="$(git config --get remote.origin.url 2>/dev/null || true)"
  printf '%s' "$url" | sed -E 's#^(git@|https://|ssh://git@)github\.com[:/]##; s#\.git$##'
}

SLUG="$(repo_slug)"
SLUG_URL=""
if [ -n "$SLUG" ]; then SLUG_URL="https://github.com/$SLUG"; fi

# --- versions -----------------------------------------------------------------
# One classifier for the whole script (`scripts/release-version.mjs`), because a version is not
# three integers: `valid` is "is this a semver at all" (`1.1.0.0`, `1.1` and `v1.1.0` are not),
# `prerelease` is "does it carry a `-suffix`", and `bump <from> <to>` is semver precedence — so
# `1.1.0-rc1 -> 1.1.0` is a bump (a release outranks its own pre-release) and `1.1.0 -> 1.1.0-rc1`
# is not. The same module prints VERSION_TOKEN, the ERE the greps below interpolate, so the parser
# cannot drift from the validity rule.

version_cli() { node "$ROOT/$VERSION_TOOL" "$@"; }
is_version() { version_cli valid "$1"; }
is_prerelease() { version_cli prerelease "$1"; }
is_bump() { version_cli bump "$1" "$2"; }

VERSION_TOKEN="$(version_cli token)" || die "cannot read the version pattern from $VERSION_TOOL"

# The footer pattern reaches awk through the environment, not `-v`: awk processes escape sequences
# in `-v` assignments, and gawk (CI's awk) turns `\[` into `[` — which silently turns the pattern
# into a bracket expression, so the footer would end up inside the entry above it. mawk leaves the
# backslash alone, which is why this only failed on the runner. `ENVIRON` is not rewritten by either.
VERSION_LINK_DEF="^\\[$VERSION_TOKEN\\]: "
export VERSION_LINK_DEF

# --- CHANGELOG parsing ---------------------------------------------------------
# An entry is `## [<version>] - <date>` up to the next `## [` heading, where a version is semver
# with an optional `-prerelease`/`+build` suffix (`1.1.0-rc1`). The footer that carries the release
# link is `[1.1.0-rc1]: <url>` — deliberately not an `##` heading, so it never looks like the start
# of an entry; the parser stops at it by shape as well, so a footer can never end up inside the
# notes of the entry above it. (The pattern reaches awk through `-v`, which keeps the backslashes
# mawk and gawk both leave alone for `\[`.)

changelog_versions() {
  [ -f "$CHANGELOG" ] || return 0
  grep -oE "^## \[$VERSION_TOKEN\]" "$CHANGELOG" | tr -d '#[] ' || true
}

newest_version() {
  local all
  all="$(changelog_versions)"
  awk 'NR == 1 { print; exit }' <<<"$all"
}

entry_of() { # <version> -> the entry's lines; the file's link definitions are not the entry
  awk -v want="## [$1] - " '
    index($0, want) == 1 { inside = 1; print; next }
    inside && (/^## \[/ || $0 ~ ENVIRON["VERSION_LINK_DEF"]) { exit }
    inside { print }
  ' "$CHANGELOG"
}

first_entry_line() { # the line the newest entry starts on, or "" when there is none to insert above
  grep -nE "^## \[$VERSION_TOKEN\] - " "$CHANGELOG" | head -1 | cut -d: -f1 || true
}

limits_of() { # <version> -> the Known limits block, body only
  local entry
  entry="$(entry_of "$1")"
  awk '
    /^### Known limits[[:space:]]*$/ { inside = 1; next }
    inside && /^#{2,3} / { exit }
    inside { print }
  ' <<<"$entry"
}

limits_bullets() { # <version> -> count of bullets, 0 when the block is missing or empty
  local n block
  block="$(limits_of "$1")"
  n="$(grep -c '^- ' <<<"$block" || true)"
  printf '%s' "${n:-0}"
}

limits_placeholder() { # <version> -> 0 when the block is still the generated TODO
  local block
  block="$(limits_of "$1")"
  grep -qi 'TODO' <<<"$block"
}

# --- commits -> entry ----------------------------------------------------------

subject_prefix() { # "feat(scope): rest" -> "feat(scope)"; anything else -> ""
  if [[ $1 =~ $CONVENTIONAL ]]; then printf '%s' "${1%%: *}"; fi
}

subject_text() { # the commit subject's words, conventional prefix removed
  local s="$1"
  if [[ $s =~ $CONVENTIONAL ]]; then s="${s#*: }"; fi
  printf '%s' "$s"
}

subject_pr() { # the trailing "(#123)" every squash-merged PR carries, as a number
  local t
  t="$(subject_text "$1")"
  if [[ $t =~ \ \(#([0-9]+)\)$ ]]; then printf '%s' "${BASH_REMATCH[1]}"; fi
}

entry_text() { # what the entry must reproduce: the subject's words, PR marker excluded
  local t pr
  t="$(subject_text "$1")"
  pr="$(subject_pr "$1")"
  if [ -n "$pr" ]; then printf '%s' "${t% \(#"$pr"\)}"; else printf '%s' "$t"; fi
}

subject_class() { # Added | Fixed | Maintenance — every commit lands in one, so none is dropped
  case "$(subject_prefix "$1")" in
    feat | feat\(*) printf 'Added' ;;
    fix | fix\(*) printf 'Fixed' ;;
    *) printf 'Maintenance' ;;
  esac
}

bullet() { # <subject> -> one markdown line; the PR marker becomes its link, so nothing repeats
  local prefix text pr=""
  prefix="$(subject_prefix "$1")"
  text="$(entry_text "$1")"
  pr="$(subject_pr "$1")"
  if [ -n "$prefix" ]; then
    if [ -n "$pr" ] && [ -n "$SLUG_URL" ]; then
      printf -- '- `%s` — %s ([#%s](%s/pull/%s))' "$prefix" "$text" "$pr" "$SLUG_URL" "$pr"
    else
      printf -- '- `%s` — %s' "$prefix" "$text"
    fi
  elif [ -n "$pr" ] && [ -n "$SLUG_URL" ]; then
    printf -- '- %s ([#%s](%s/pull/%s))' "$text" "$pr" "$SLUG_URL" "$pr"
  else
    printf -- '- %s' "$text"
  fi
}

commits_between() { # <from-ref or ""> <to-ref> -> one subject per line
  if [ -n "$1" ]; then
    git log --no-merges --format=%s "$1..$2"
  else
    git log --no-merges --format=%s "$2"
  fi
}

release_commits() { # the commits an entry must account for: everything but the release commit
  grep -vE '^chore\(release\): ' || true
}

previous_tag() { # <tag-ref> -> the nearest older version tag, or "" when this is the first
  git describe --tags --abbrev=0 --match 'v[0-9]*' "$1^" 2>/dev/null || true
}

generate_entry() { # <version> <from> <to> <limits-file>
  local version="$1" from="$2" to="$3" limits="$4" date section body line subjects
  date="${RELEASE_DATE:-$(date -u +%F)}"
  subjects="$(commits_between "$from" "$to" | release_commits)"

  printf '## [%s] - %s\n' "$version" "$date"
  for section in Added Fixed Maintenance; do
    body=""
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      [ "$(subject_class "$line")" = "$section" ] || continue
      body="${body}$(bullet "$line")"$'\n'
    done <<<"$subjects"
    [ -n "$body" ] || continue
    printf '\n### %s\n\n%s' "$section" "$body"
  done

  printf '\n### Known limits\n\n'
  if [ -n "$limits" ]; then
    [ -s "$limits" ] || die "--limits $limits is empty"
    cat "$limits"
    printf '\n'
  else
    printf -- '- TODO: state what this release cannot do. `scripts/release.sh` will not write or tag an entry while this line is here.\n'
  fi
}

# --- modes ---------------------------------------------------------------------

CHECK_FAILED=0
note() { printf '  ✓ %s\n' "$*"; }
complain() {
  printf '  ✗ %s\n' "$*" >&2
  CHECK_FAILED=1
}

cmd_check() {
  [ -f "$CHANGELOG" ] || die "$CHANGELOG is missing — a release is an entry, and there is none"

  local newest pkg version bullets text entry tag from examined=0 missing=0 first_missing=""

  if grep -qE '^## \[Unreleased\]' "$CHANGELOG"; then
    complain "an '## [Unreleased]' heading is present — an entry is a released version, not a parking space"
  fi

  newest="$(newest_version)"
  [ -n "$newest" ] ||
    die "$CHANGELOG has no '## [x.y.z] - <date>' entry — suffixed where the version is a pre-release"
  pkg="$(pkg_version)"

  if [ "$newest" = "$pkg" ]; then
    note "package.json version $pkg is the newest CHANGELOG entry"
  else
    complain "package.json is at $pkg but the newest CHANGELOG entry is [$newest] — the version is one source of truth"
  fi

  local limits_bad=0
  for version in $(changelog_versions); do
    bullets="$(limits_bullets "$version")"
    if [ "$bullets" -lt 1 ]; then
      complain "entry [$version] has no '### Known limits' bullets — the limits are public release notes"
      limits_bad=$((limits_bad + 1))
    elif limits_placeholder "$version"; then
      complain "entry [$version] still carries the generated TODO in its Known limits block"
      limits_bad=$((limits_bad + 1))
    fi
  done
  [ "$limits_bad" -eq 0 ] && note "every entry carries a Known limits block"

  # The entry is generated from the commits, so drift between them is drift in a published
  # document. It is checked once the version is tagged: the tag fixes the range the entry was
  # written for, and a later commit is not something the entry may silently claim.
  tag="refs/tags/v$newest"
  if git rev-parse -q --verify "$tag" >/dev/null 2>&1; then
    from="$(previous_tag "$tag")"
    entry="$(entry_of "$newest")"
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      examined=$((examined + 1))
      text="$(entry_text "$line")"
      # A here-string, not `printf … | grep`: with `pipefail`, grep's early exit closes the pipe
      # and the upstream SIGPIPE turns a match into "missing" — a gate that fails at random.
      if ! grep -Fq -- "$text" <<<"$entry"; then
        missing=$((missing + 1))
        [ -n "$first_missing" ] || first_missing="$text"
      fi
    done < <(commits_between "$from" "$tag" | release_commits)

    if [ "$missing" -eq 0 ]; then
      note "entry [$newest] names all $examined commit(s) in ${from:-the first commit}..v$newest"
    else
      complain "entry [$newest] drops $missing of $examined commit(s) since ${from:-the first commit}, starting with: $first_missing"
    fi
  else
    note "v$newest is not tagged yet — commit coverage is checked from the moment it is"
  fi

  if [ "$CHECK_FAILED" -ne 0 ]; then
    printf '\nrelease: the CHANGELOG and the tree disagree. Fix the entry, not the check.\n' >&2
    exit 1
  fi
  printf '\nrelease: check green — %s entry [%s] matches %s\n' "$CHANGELOG" "$newest" "$pkg"
}

# --- --check-limits ------------------------------------------------------------
# The Known limits block is the release body, and `--limits <file>` takes prose no gate ever
# reads. This mode reads it: `scripts/release-limits.mjs` derives every path the block names from
# the tree, and every `path::symbol` from that file's *exports* — the half that catches v1.3.0's
# `lib/flow/paths.ts::answerPath`, where the file existed and the binding did not. What it cannot
# derive is a rendered consequence ("the nav greys this route"): that is a claim about the running
# app, not a name in the tree, and the block has to be honest about which kind it is making.

cmd_check_limits() { # <file>
  local file="$1" stream="" status=0 verdict token detail count=0 bad=0 retracted=0

  [ -n "$file" ] || usage_die "--check-limits needs a file"
  [ -f "$file" ] || die "--check-limits $file: no such file"
  [ -s "$file" ] || die "--check-limits $file is empty — an empty block is not a block"

  stream="$(node "$ROOT/$LIMITS_TOOL" check "$file")" || status=$?
  # 1 means "findings, and the stream below says which". Anything else is the tool not running,
  # which must never read as a green block.
  case "$status" in
    0 | 1) ;;
    *) die "$LIMITS_TOOL exited $status — the block was not checked" ;;
  esac

  while IFS=$'\t' read -r verdict token detail; do
    [ -n "$verdict" ] || continue
    count=$((count + 1))
    case "$verdict" in
      ok) note "$token — $detail" ;;
      skip)
        printf '  – %s — %s\n' "$token" "$detail"
        retracted=$((retracted + 1))
        ;;
      bad)
        complain "$token — $detail"
        bad=$((bad + 1))
        ;;
      *) die "unknown verdict '$verdict' from $LIMITS_TOOL" ;;
    esac
  done <<<"$stream"

  [ "$count" -gt 0 ] ||
    printf '  · %s quotes no path at all — nothing in it can be derived from the tree\n' "$file"

  if [ "$bad" -ne 0 ]; then
    printf '\nrelease: %s names %d path(s) this tree does not carry. Fix the block, not the check.\n' \
      "$file" "$bad" >&2
    printf '  A name that was wrong and is being retracted is struck through, never deleted and\n' >&2
    printf '  never left plain: `~~lib/flow/nowhere.ts::gone~~`.\n' >&2
    exit 1
  fi

  printf '\nrelease: %s agrees with the tree — %d path claim(s): %d resolved, %d retracted\n' \
    "$file" "$count" "$((count - retracted))" "$retracted"
}

# --- checkout hygiene ----------------------------------------------------------
# A cut is a sequence of writes against one checkout — an entry, a bump, a commit, a tag, a push —
# and every one of them assumes the checkout it started on. Measured 2026-11-14, that assumption is
# not free: the primary checkout was found **detached** at `7a531b43` (`chore(release): 1.16.0`)
# with `origin/main` three commits ahead. From that tree `git push` moved nothing,
# `release_boundary.py` read "0 commits since the tag" and labelled the next cut a patch, and
# `package.json` carried 1.16.0 while production served 1.18.0. The reflog's newest pair was
# `checkout: moving from main to HEAD` and `main: Reset to origin/main` — a cut that detached a
# working tree and never put the branch back.
#
# Two guarantees, and this section is both of them:
#
#   * a cut that cannot be cut from is refused by name, before a byte is written
#     (`require_cut_checkout` below) — detached, dirty, or a commit that does not contain origin/main;
#   * the checkout is put back on the branch it started on, by a trap that runs on success, on
#     failure and on SIGINT/TERM/HUP. That is what covers the case no `git switch` at the end of a
#     successful path can: an interrupted run, or a step inside the run that detaches.
#
# The trap restores the *branch*, never the files. A release script that discards uncommitted work
# is a worse bug than the one it is fixing, so leftover paths are named and left alone.

GUARD_START_BRANCH=""
GUARD_START_SHA=""
GUARD_ARMED=0

guard_current_branch() { git symbolic-ref --quiet --short HEAD 2>/dev/null || printf 'HEAD'; }

# At most five indented paths, in one process. `printf … | head -5` is the repo's documented
# SIGPIPE trap: under `pipefail` head's early exit closes the pipe, the upstream printf dies of
# SIGPIPE, and the pipeline's 141 becomes the script's exit status — so a tree with six dirty
# paths would refuse with half a message and a code nobody can read. `sed` reads its whole input.
show_paths() { sed -e 's/^/  /' -e '6,$d'; }

guard_arm() { # capture the starting state, and make every way out of this run restore it
  [ "$GUARD_ARMED" -eq 1 ] && return 0
  GUARD_START_BRANCH="$(guard_current_branch)"
  GUARD_START_SHA="$(git rev-parse HEAD 2>/dev/null || true)"
  GUARD_ARMED=1
  trap 'guard_restore $?' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  trap 'exit 129' HUP
}

guard_restore() { # <exit code> — the state the caller gets back, and the line that proves it
  local rc="${1:-0}" branch now dirty start
  [ "$GUARD_ARMED" -eq 1 ] || return 0
  GUARD_ARMED=0 # one shot: a trap that can re-enter is how a restore loop happens

  branch="$(guard_current_branch)"
  if [ "$branch" != "$GUARD_START_BRANCH" ] && [ "$GUARD_START_BRANCH" != "HEAD" ]; then
    if git switch --quiet "$GUARD_START_BRANCH" 2>/dev/null; then
      printf 'release: the checkout was left on %s — put back on %s\n' \
        "$branch" "$GUARD_START_BRANCH"
    else
      printf 'release: WARNING the checkout was left on %s and could not be put back on %s — run: git switch %s\n' \
        "$branch" "$GUARD_START_BRANCH" "$GUARD_START_BRANCH" >&2
    fi
    branch="$(guard_current_branch)"
  fi

  now="$(git rev-parse --short HEAD 2>/dev/null || true)"
  dirty="$(git status --porcelain 2>/dev/null || true)"

  if [ "$branch" = "HEAD" ]; then
    printf 'release: the checkout is detached at %s — it was found that way, and a cut will not start from it\n' \
      "$now" >&2
  elif [ -n "$dirty" ]; then
    printf 'release: %s is left with uncommitted changes — this script never discards work:\n' \
      "$branch" >&2
    printf '%s\n' "$dirty" | show_paths >&2
    printf '  commit or `git stash` them before the next cut\n' >&2
  elif [ "$GUARD_START_SHA" != "$(git rev-parse HEAD 2>/dev/null || true)" ]; then
    start="$(git rev-parse --short "$GUARD_START_SHA" 2>/dev/null || printf '%s' "$GUARD_START_SHA")"
    printf 'release: the checkout is on %s at %s, clean — the cut advanced it from %s\n' \
      "$branch" "$now" "$start"
  else
    printf 'release: the checkout is on %s at %s, clean — as it was found\n' "$branch" "$now"
  fi
  return "$rc"
}

require_cut_checkout() { # the three states a cut cannot start from, each refused by name
  git rev-parse --git-dir >/dev/null 2>&1 ||
    die "not a git repository — a cut is made in a checkout of the repo"

  local branch dirty
  branch="$(guard_current_branch)"
  if [ "$branch" = "HEAD" ]; then
    die "HEAD is detached at $(git rev-parse --short HEAD) — a cut is made from a branch, never from a floating commit. Run 'git switch main && git pull --ff-only', then cut again"
  fi
  [ "$branch" = "main" ] ||
    die "a release is cut from main, not from '$branch' — run 'git switch main && git pull --ff-only', then cut again"

  dirty="$(git status --porcelain)"
  if [ -n "$dirty" ]; then
    printf 'release: the tree is dirty — a release is cut from a clean tree, never from work in progress:\n' >&2
    printf '%s\n' "$dirty" | show_paths >&2
    die "commit or 'git stash' those paths, then cut again"
  fi
}

preflight() { # <version> — everything a cut must be true before a single byte is written
  local version="$1"
  is_version "$version" ||
    usage_die "'$version' is not a semantic version (x.y.z, optionally -prerelease or +build)"

  require_cut_checkout

  step "fetch (origin main, tags)"
  git fetch --quiet origin main --tags || die "git fetch origin main --tags failed"
  # The commit being released must *contain* origin/main. A tag whose tree does not carry what main
  # carries is a release nobody can reproduce from the branch — and it is the range the CHANGELOG
  # gate then compares against, so the entry would describe a history that is not main's. This is
  # the wider invariant and it is checked first, so a diverged checkout hears about the divergence
  # rather than about the symlink to it.
  git merge-base --is-ancestor origin/main HEAD ||
    die "$(git rev-parse --short HEAD) does not contain origin/main ($(git rev-parse --short origin/main)) — a release commit carries main. Run 'git switch main && git pull --ff-only', then cut again"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] ||
    die "HEAD is not origin/main — a release ships a commit that exists on the remote; pull --ff-only first"

  if git rev-parse -q --verify "refs/tags/v$version" >/dev/null 2>&1; then
    die "tag v$version already exists — a pushed tag is never moved; the next cut is the next version"
  fi

  step "gate (bash scripts/verify.sh)"
  bash scripts/verify.sh || die "the gate is red — a release is cut from a green tree"
}

entry_to_file() { # <version> <path> — the entry with its trailing blank lines trimmed
  entry_of "$1" | awk '{ line[NR] = $0 } END { last = NR; while (last > 0 && line[last] ~ /^[[:space:]]*$/) last--; for (i = 1; i <= last; i++) print line[i] }' >"$2"
}

tag_and_publish() { # <version> — annotated tag at HEAD, push it, publish the entry verbatim
  local version="$1" notes ref="v$1" prerelease=false flags=() published tag draft pre url
  notes="$(mktemp "${TMPDIR:-/tmp}/release-notes-$version.XXXXXX")"
  entry_to_file "$version" "$notes"

  # Only a `-suffix` is a pre-release. `+build` is metadata on a final version, and marking that
  # pre-release would hide the release GitHub calls latest behind a flag semver does not grant it.
  if is_prerelease "$version"; then
    prerelease=true
    flags=(--prerelease)
  fi

  step "tag (annotated, at HEAD $(git rev-parse --short HEAD))"
  git tag -a "$ref" -m "$ref" HEAD
  git push origin "refs/tags/$ref"

  step "release (gh release create $ref --notes-file${flags[*]:+ --prerelease}, the entry byte for byte)"
  gh release create "$ref" --title "$ref" --notes-file "$notes" ${flags[@]+"${flags[@]}"}

  # Read the flag back instead of trusting the create: `gh release create` succeeds whether or not
  # `--prerelease` took, and a pre-release published as latest is the wrong artefact, not a detail.
  published="$(gh release view "$ref" --json tagName,isDraft,isPrerelease,url \
    -q '"\(.tagName)|\(.isDraft)|\(.isPrerelease)|\(.url)"')"
  rm -f "$notes"
  IFS='|' read -r tag draft pre url <<<"$published"
  [ "$tag" = "$ref" ] || die "gh release view returned $tag, not $ref"
  [ "$draft" = "false" ] || die "release $ref is a draft — a release is published, not staged"
  [ "$pre" = "$prerelease" ] ||
    die "release $ref published with isPrerelease=$pre, expected $prerelease — delete it and cut again"
  say "  published $tag draft=$draft prerelease=$pre $url"
}

cmd_tag_only() { # <version> — the version and entry are already merged on main
  local version="$1"
  guard_arm
  preflight "$version"
  [ "$(pkg_version)" = "$version" ] ||
    die "package.json is at $(pkg_version), not $version — prepare and merge the bump, then re-run --tag-only"
  [ -n "$(entry_of "$version")" ] || die "$CHANGELOG has no [$version] entry"
  [ "$(limits_bullets "$version")" -ge 1 ] ||
    die "the [$version] entry has no Known limits block — this script will not tag without one"
  if limits_placeholder "$version"; then
    die "the [$version] Known limits block is still the generated TODO — write it, then tag"
  fi
  tag_and_publish "$version"
}

cmd_release() { # <version> <limits-file>
  local version="$1" limits="$2" from="" newest existing newfile
  guard_arm
  preflight "$version"
  [ -n "$limits" ] ||
    usage_die "a generated entry needs --limits <file>: the Known limits block ships verbatim in public release notes"

  existing="$(pkg_version)"
  # Semver precedence, not three integers: `1.1.0-rc1 -> 1.1.0` is a bump (a release outranks its
  # own pre-release) and `1.1.0 -> 1.1.0-rc1` is not, which is the pair the awk this replaced got
  # exactly backwards.
  is_bump "$existing" "$version" || die "package.json is at $existing — $version is not a bump"

  newest="$(newest_version)"
  if [ -n "$newest" ] && git rev-parse -q --verify "refs/tags/v$newest" >/dev/null 2>&1; then
    from="refs/tags/v$newest"
  fi

  step "entry ([$version] from ${from:-the first commit}..HEAD)"
  newfile="$(mktemp "${TMPDIR:-/tmp}/release-entry-$version.XXXXXX")"
  generate_entry "$version" "$from" HEAD "$limits" >"$newfile"

  # Insert above the newest entry, keep everything below it.
  local first_entry
  first_entry="$(first_entry_line)"
  local merged
  merged="$(mktemp "${TMPDIR:-/tmp}/release-changelog.XXXXXX")"
  if [ -n "$first_entry" ]; then
    { head -n "$((first_entry - 1))" "$CHANGELOG"; cat "$newfile"; printf '\n'; sed -n "${first_entry},\$p" "$CHANGELOG"; } >"$merged"
  else
    { cat "$CHANGELOG"; printf '\n'; cat "$newfile"; printf '\n'; } >"$merged"
  fi
  mv "$merged" "$CHANGELOG"
  rm -f "$newfile"

  if [ -n "$SLUG" ] && ! grep -qE "^\[$version\]: " "$CHANGELOG"; then
    if [ -n "$from" ]; then
      printf '[%s]: %s/compare/v%s...v%s\n' "$version" "$SLUG_URL" "${from#refs/tags/v}" "$version" >>"$CHANGELOG"
    else
      printf '[%s]: %s/releases/tag/v%s\n' "$version" "$SLUG_URL" "$version" >>"$CHANGELOG"
    fi
  fi

  step "bump (package.json $existing -> $version)"
  VERSION="$version" node -e '
    const fs = require("fs");
    const before = fs.readFileSync("package.json", "utf8");
    const after = before.replace(/("version":\s*")[^"]*(")/, `$1${process.env.VERSION}$2`);
    if (after === before) process.exit(1);
    fs.writeFileSync("package.json", after);
  ' || die "package.json has no \"version\" line to bump"

  step "check (the entry this run wrote must satisfy the gate)"
  bash scripts/release.sh --check

  step "commit + push (chore(release): $version)"
  git add "$CHANGELOG" package.json
  git commit -m "chore(release): $version"
  git push origin main

  tag_and_publish "$version"
}

cmd_dry_run() { # <version> <limits-file>
  local version="$1" limits="$2" from="" newest
  is_version "$version" ||
    usage_die "'$version' is not a semantic version (x.y.z, optionally -prerelease or +build)"

  newest="$(newest_version)"
  if [ -n "$newest" ] && git rev-parse -q --verify "refs/tags/v$newest" >/dev/null 2>&1; then
    from="refs/tags/v$newest"
  fi

  local first_entry
  first_entry="$(first_entry_line)"

  {
    printf 'release: a dry run — nothing is written\n'
    printf '  would run: bash scripts/verify.sh\n'
    if [ -n "$first_entry" ]; then
      printf '  would insert this entry in %s at line %s, above [%s]\n' \
        "$CHANGELOG" "$first_entry" "${newest:-nothing}"
    else
      printf '  would append this entry to %s\n' "$CHANGELOG"
    fi
    printf '  would run: git commit -m "chore(release): %s"\n' "$version"
    printf '  would run: git tag -a v%s -m v%s HEAD\n' "$version" "$version"
    printf '  would run: git push origin main && git push origin refs/tags/v%s\n' "$version"
    if is_prerelease "$version"; then
      printf '  would run: gh release create v%s --title v%s --notes-file <this entry> --prerelease\n' \
        "$version" "$version"
    else
      printf '  would run: gh release create v%s --title v%s --notes-file <this entry>\n' \
        "$version" "$version"
    fi
    printf '  entry for [%s] follows on stdout\n' "$version"
  } >&2

  generate_entry "$version" "$from" HEAD "$limits"
}

cmd_usage() { usage_die "no mode given"; }

# --- argument parsing ----------------------------------------------------------

MODE="" VERSION="" LIMITS=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --check) MODE="check" ;;
    --check-limits)
      [ "$#" -ge 2 ] || usage_die "--check-limits needs a file"
      MODE="check-limits"
      LIMITS="$2"
      shift
      ;;
    --dry-run) MODE="dry-run" ;;
    --tag-only) MODE="tag-only" ;;
    --limits)
      [ "$#" -ge 2 ] || usage_die "--limits needs a file"
      LIMITS="$2"
      shift
      ;;
    -h | --help) cmd_usage ;;
    -*) usage_die "unknown option '$1'" ;;
    *)
      [ -n "$VERSION" ] && usage_die "one version per invocation"
      VERSION="$1"
      ;;
  esac
  shift
done

case "$MODE" in
  check) [ -n "$VERSION" ] && usage_die "--check takes no version"; cmd_check ;;
  check-limits) [ -n "$VERSION" ] && usage_die "--check-limits takes a file, not a version"; cmd_check_limits "$LIMITS" ;;
  dry-run) [ -n "$VERSION" ] || usage_die "--dry-run needs a version"; cmd_dry_run "$VERSION" "$LIMITS" ;;
  tag-only) [ -n "$VERSION" ] || usage_die "--tag-only needs a version"; cmd_tag_only "$VERSION" ;;
  '') [ -n "$VERSION" ] || cmd_usage; cmd_release "$VERSION" "$LIMITS" ;;
  *) usage_die "unknown mode" ;;
esac
