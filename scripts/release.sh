#!/usr/bin/env bash
# scripts/release.sh — one command per release (issue #144).
#
#   bash scripts/release.sh --check                 the gate step: the CHANGELOG entry matches
#                                                  package.json, the commits and has a Known limits block
#   bash scripts/release.sh --dry-run <version>    print the entry it would write; write nothing
#   bash scripts/release.sh <version>              gate -> entry -> bump -> commit -> tag -> push -> Release
#   bash scripts/release.sh --tag-only <version>   the version and entry are already on `main`
#                                                  (merged in a release-engineering PR): tag HEAD
#
# --limits <file> supplies the Known limits block for a generated entry. Without it a generation
# refuses to write: the block is public release-note content, so a human writes it.
#
# Why --tag-only exists: a cut can be prepared in a pull request, where the version bump and the
# entry are reviewed like any other change. The tag then belongs on the merge commit, not on a
# second commit nobody reviewed. v1.0.0 was cut that way.
#
# The version source of truth is package.json; the tag is `v<version>`; the release notes are the
# CHANGELOG entry, byte for byte (`gh release create --notes-file`). The commits on main are
# already conventional, so `git log` is the whole generator — no new dependency, no commitlint.
#
# A pushed tag is never moved. A botched cut is abandoned (delete the tag and the release) and the
# next attempt is the next version number.
#
# Exit: 0 ok · 1 refused (the message says why) · 2 usage.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHANGELOG="CHANGELOG.md"
SEMVER='^[0-9]+\.[0-9]+\.[0-9]+$'
CONVENTIONAL='^[a-z]+(\([^)]*\))?!?: '

say() { printf '%s\n' "$*"; }
step() { printf '\n▶ %s\n' "$*"; }
die() { printf 'release: %s\n' "$*" >&2; exit 1; }
usage_die() { printf 'release: %s\n\n' "$*" >&2; sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//' >&2; exit 2; }

pkg_version() { node -p 'require("./package.json").version'; }

repo_slug() {
  local url
  url="$(git config --get remote.origin.url 2>/dev/null || true)"
  printf '%s' "$url" | sed -E 's#^(git@|https://|ssh://git@)github\.com[:/]##; s#\.git$##'
}

SLUG="$(repo_slug)"
SLUG_URL=""
if [ -n "$SLUG" ]; then SLUG_URL="https://github.com/$SLUG"; fi

# --- CHANGELOG parsing ---------------------------------------------------------
# An entry is `## [<x.y.z>] - <date>` up to the next `## [` heading. The footer that carries
# the release link is `[1.0.0]: <url>` — deliberately not an `##` heading, so it never looks
# like the start of an entry.

changelog_versions() {
  [ -f "$CHANGELOG" ] || return 0
  grep -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' "$CHANGELOG" | tr -d '#[] ' || true
}

newest_version() {
  local all
  all="$(changelog_versions)"
  awk 'NR == 1 { print; exit }' <<<"$all"
}

entry_of() { # <version> -> the entry's lines; the file's link definitions are not the entry
  awk -v want="## [$1] - " '
    index($0, want) == 1 { inside = 1; print; next }
    inside && (/^## \[/ || /^\[[0-9]+\.[0-9]+\.[0-9]+\]: /) { exit }
    inside { print }
  ' "$CHANGELOG"
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
  [ -n "$newest" ] || die "$CHANGELOG has no '## [x.y.z] - <date>' entry"
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

preflight() { # <version> — everything a cut must be true before a single byte is written
  local version="$1"
  [[ $version =~ $SEMVER ]] || usage_die "'$version' is not a semantic version (x.y.z)"

  git rev-parse --git-dir >/dev/null 2>&1 || die "not a git repository"
  [ -z "$(git status --porcelain)" ] ||
    die "the tree is dirty — a release is cut from a clean tree, never from work in progress"
  [ "$(git symbolic-ref --short HEAD 2>/dev/null || echo detached)" = "main" ] ||
    die "a release is cut from main, not from '$(git symbolic-ref --short HEAD 2>/dev/null || echo detached)'"

  step "fetch (origin main, tags)"
  git fetch --quiet origin main --tags || die "git fetch origin main --tags failed"
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
  local version="$1" notes ref="v$1"
  notes="$(mktemp "${TMPDIR:-/tmp}/release-notes-$version.XXXXXX")"
  entry_to_file "$version" "$notes"

  step "tag (annotated, at HEAD $(git rev-parse --short HEAD))"
  git tag -a "$ref" -m "$ref" HEAD
  git push origin "refs/tags/$ref"

  step "release (gh release create $ref --notes-file, the entry byte for byte)"
  gh release create "$ref" --title "$ref" --notes-file "$notes"
  gh release view "$ref" --json tagName,isDraft,url -q '"published \(.tagName) draft=\(.isDraft) \(.url)"'
  rm -f "$notes"
}

cmd_tag_only() { # <version> — the version and entry are already merged on main
  local version="$1"
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
  preflight "$version"
  [ -n "$limits" ] ||
    usage_die "a generated entry needs --limits <file>: the Known limits block ships verbatim in public release notes"

  existing="$(pkg_version)"
  awk -v a="$existing" -v b="$version" 'BEGIN {
    split(a, x, "."); split(b, y, ".")
    for (i = 1; i <= 3; i++) if (x[i] + 0 < y[i] + 0) exit 0
    exit 1
  }' || die "package.json is at $existing — $version is not a bump"

  newest="$(newest_version)"
  if [ -n "$newest" ] && git rev-parse -q --verify "refs/tags/v$newest" >/dev/null 2>&1; then
    from="refs/tags/v$newest"
  fi

  step "entry ([$version] from ${from:-the first commit}..HEAD)"
  newfile="$(mktemp "${TMPDIR:-/tmp}/release-entry-$version.XXXXXX")"
  generate_entry "$version" "$from" HEAD "$limits" >"$newfile"

  # Insert above the newest entry, keep everything below it.
  local first_entry
  first_entry="$(grep -nE '^## \[[0-9]+\.[0-9]+\.[0-9]+\] - ' "$CHANGELOG" | head -1 | cut -d: -f1 || true)"
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
  [[ $version =~ $SEMVER ]] || usage_die "'$version' is not a semantic version (x.y.z)"

  newest="$(newest_version)"
  if [ -n "$newest" ] && git rev-parse -q --verify "refs/tags/v$newest" >/dev/null 2>&1; then
    from="refs/tags/v$newest"
  fi

  {
    printf 'release: a dry run — nothing is written\n'
    printf '  would run: bash scripts/verify.sh\n'
    printf '  would insert this entry in %s, above [%s]\n' "$CHANGELOG" "${newest:-nothing}"
    printf '  would run: git commit -m "chore(release): %s"\n' "$version"
    printf '  would run: git tag -a v%s -m v%s HEAD\n' "$version" "$version"
    printf '  would run: git push origin main && git push origin refs/tags/v%s\n' "$version"
    printf '  would run: gh release create v%s --notes-file <this entry>\n' "$version"
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
  dry-run) [ -n "$VERSION" ] || usage_die "--dry-run needs a version"; cmd_dry_run "$VERSION" "$LIMITS" ;;
  tag-only) [ -n "$VERSION" ] || usage_die "--tag-only needs a version"; cmd_tag_only "$VERSION" ;;
  '') [ -n "$VERSION" ] || cmd_usage; cmd_release "$VERSION" "$LIMITS" ;;
  *) usage_die "unknown mode" ;;
esac
