# Releasing

A release is four artefacts that must agree: a **version** in `package.json`, a **CHANGELOG entry**,
an **annotated tag `v<version>`**, and a **GitHub Release** whose body is that entry, byte for byte.
`scripts/release.sh` writes all four, in that order, and refuses when the tree cannot support them.
The script is the procedure; this page is why.

The live prototype is <https://alignsynch-amber.vercel.app/>. The script does not deploy and does not
wait for a deploy: Vercel deploys `main`, and a tag is not a deploy trigger for this repository.
Whether that deploy actually landed is a separate, out-of-band question — which pushes are allowed
to build and how to prove the site is serving the merged commit are in
[`DEPLOYING.md`](DEPLOYING.md).

## Prerequisites

- Node **24** (`.nvmrc`) and pnpm **12.16.1** on `PATH` — `nvm use`. The gate refuses any other pair.
- `gh` authenticated with `repo` scope — the script creates the Release. `gh auth status` to check.
- The pre-push hook installed once per clone: `bash scripts/install-hooks.sh`.
- `main`, clean, fast-forwarded. A release is cut from a green tree, never from work in progress.

## Two ways to cut one

### 1. The version was prepared in a pull request (what v1.0.0 did)

The bump and the entry are reviewed like any other change, so the tag belongs on the **merge
commit**, not on a second commit nobody reviewed.

```bash
git switch main && git pull --ff-only
bash scripts/release.sh --dry-run 1.0.0 --limits limits.md   # the entry it would write; writes nothing
# ... put the entry in CHANGELOG.md, set package.json to 1.0.0, open the PR ...
# after the squash-merge, on the merge commit:
bash scripts/release.sh --tag-only 1.0.0
```

`--tag-only` refuses unless `package.json`, the CHANGELOG entry and HEAD agree: the version is the
same, the entry exists, its Known limits block is written, the tag is not already used, the tree is
clean, `HEAD == origin/main`, and the gate is green.

### 2. Everything at once, on `main`

```bash
bash scripts/release.sh 1.0.1 --limits limits.md
```

Gate → entry → version bump → `chore(release): 1.0.1` → annotated tag → push → `gh release create`.
`--limits <file>` is not optional: the Known limits block is public release-note content, so a human
writes it. Without the flag the script generates the entry with a `TODO` placeholder and stops before
writing anything.

`--dry-run <version>` prints every command it would run (on stderr) and the entry it would write (on
stdout, so it can be redirected), and writes nothing.

## Pre-releases

A release candidate is a version with a semver `-suffix` — `1.1.0-rc1`, `1.1.0-beta.2` — and it is
cut by the same two paths above. The procedure does not change; three things about the artefacts do:

- the heading is `## [1.1.0-rc1] - <date>`, and `--check` reads it as the newest entry, so a tree
  carrying a candidate still passes the gate (`release:check` is a step of that gate, in every lane);
- the GitHub Release is created with `--prerelease`, and the script reads `isPrerelease` back and
  fails the cut when the flag did not take. A candidate published as "latest" is the wrong
  artefact, not a cosmetic detail;
- the candidate's entry stays in `CHANGELOG.md` when the final release lands: `1.1.0` is cut _above_
  it, like any other version.

The order is semver precedence, not three integers — `scripts/release-version.mjs` is the one
classifier the gate, the bump guard and the publish step share. `1.0.0 → 1.1.0-rc1` is a bump and
`1.1.0-rc1 → 1.1.0` is a bump (a release outranks its own candidate), while `1.1.0 → 1.1.0-rc1`,
`1.1.0-rc1 → 1.1.0-rc1` and `1.0.0 → 0.9.9` are not. A `+build` suffix (`1.1.0+build.5`) is build
metadata: a final release of equal precedence to `1.1.0`, so it is not marked pre-release.

```bash
bash scripts/release.sh --dry-run 1.1.0-rc1 --limits limits.md  # the entry, with --prerelease in the command block
# ... put the entry in CHANGELOG.md, set package.json to 1.1.0-rc1, merge the PR ...
bash scripts/release.sh --tag-only 1.1.0-rc1                    # tag the merge commit, publish, then read the flag back
gh release view v1.1.0-rc1 --json tagName,isPrerelease          # prerelease: true
```

**A pre-release is abandoned, never moved** — exactly like any other tag (see _Failure path_). A
candidate cut from the wrong commit, or with notes that are no longer true, is deleted, and the next
attempt is `1.1.0-rc2`; the final release is still `1.1.0`, and it is the only number anyone is
expected to have pinned.

## The entry comes from the commits

`git log <previous tag>..HEAD` is the whole generator — no commitlint, no semantic-release, no new
dependency. Every commit lands in exactly one section, so no merged PR can be dropped:

- `feat` → **Added**
- `fix` → **Fixed**
- `perf`, `refactor`, `chore`, `docs`, `test`, `build`, `ci`, `style`, and anything unprefixed →
  **Maintenance**
- `chore(release): <version>` → omitted: it is the act of recording the entry, not a change in it

The trailing `(#NNN)` every squash-merged commit carries becomes a link to that pull request. The
version heading is `## [x.y.z] - <date>` — `## [1.1.0-rc1] - <date>` for a candidate; the release
link is a plain footer definition (`[x.y.z]: <url>`), deliberately not a heading. The entry parser
stops at both, so the footer is never part of an entry — and therefore never part of the release
notes, which are the entry.

## Known limits are mandatory

Every entry ends with a `### Known limits` block, and the script will not tag without one. This is
not a ritual: the release notes are the only place a reader learns that, say, nothing is stored or
that a screen reads a fixture. An empty block is how a prototype ships as if it were a product.

Write what is true **on the commit being tagged**, and check it there before writing it. A limit that
was accurate a week ago is still a false claim in a public document.

## The version badge points at the tag

Every build prints its own version — on `/login`, in the footer, at the foot of the sidebar —
and that badge links to `releases/tag/v<version>`, the exact tag, deliberately not
`/releases/latest`. The number is `package.json`'s `version`, read once by `next.config.mjs` and
inlined into the bundle; nothing else in the tree spells a version.

**The version badge links to the tag — tag before you deploy, or the badge leads to a 404.** That
is the coupling, not a bug in the badge: a badge that always resolves but never names the deployed
build identifies nothing. `scripts/release.sh` creates the tag and the Release in that order, and
`--tag-only` is what a prepared bump uses, so the ordinary path already satisfies it.

## The gate runs the check

`scripts/verify.sh` runs `release:check` in **every lane**, next to the glossary step, for the same
reason: `CHANGELOG.md` is docs, `scripts/release.sh` is config, `package.json` is config, so each path
selects a different (cheaper) lane and a lane that skipped the check would be a green local gate over
a red CI run. `bash scripts/release.sh --check` is the same check without the gate around it.

It fails when:

- `package.json`'s version is not the newest CHANGELOG entry's version;
- an `## [Unreleased]` heading exists — an entry is a released version, not a parking space;
- any entry has an empty Known limits block, or still carries the generated `TODO`;
- **once the version is tagged**, a commit in `<previous tag>..v<version>` does not appear in the
  entry. Before the tag exists there is no range to compare against, and the check says so on its
  own line rather than pretending it verified something.

## Failure path

**A pushed tag is never moved.** If a cut is wrong — the wrong commit, a typo in the notes, a limit
that is no longer true — report it, delete the tag and the Release, and cut the **next** version
(`v1.0.1`). Re-tagging the same version silently rewrites what someone may already have pinned.
A pre-release is no exception: `v1.1.0-rc1` is not re-pointed at a repaired commit, `v1.1.0-rc2` is.
`--tag-only` refuses an existing tag by design; do not work around it with `git tag -f`.

A release is done when all four artefacts agree:

```bash
git tag --list                                    # v1.0.0
git describe --tags                               # v1.0.0 — on main
node -p 'require("./package.json").version'       # 1.0.0
gh release view v1.0.0 --json tagName,isDraft,url # published, not a draft
```

and when `bash scripts/verify.sh` is green on the tagged commit, and on `main` afterwards — the
release step is what proves the CHANGELOG still describes the history it was written for.
