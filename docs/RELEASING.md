# Releasing

A release is four artefacts that must agree: a **version** in `package.json`, a **CHANGELOG entry**,
an **annotated tag `v<version>`**, and a **GitHub Release** whose body is that entry, byte for byte.
`scripts/release.sh` writes all four, in that order, and refuses when the tree cannot support them.
The script is the procedure; this page is why.

The live prototype is <https://alignsynch-amber.vercel.app/>. The script does not deploy and does not
wait for a deploy, and a tag is not a deploy trigger. A **merge** is: while the project's Git
integration creates production deployments, the push that merges a PR is the deployment, and
production serves `main`'s tip once the build finishes (measured on 2026-11-03 — see
[`main → production`](#main--production-promoting-a-release) below). The API promotion in that
section is the deliberate path for everything a merge does not cover, and
[`DEPLOYING.md`](DEPLOYING.md) is why the build policy is shaped the way it is.

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
was accurate a week ago is still a false claim in a public document. Run the candidate block through
the check before the tag:

```bash
bash scripts/release.sh --check-limits limits.md
```

It derives every path the block names from this tree, and every `path::symbol` from that file's
_exports_ — the half that would have caught `v1.3.0`'s answer-sheet bullet, which named
`lib/flow/paths.ts::answerPath`, a symbol that has never existed. A name that was wrong is struck
through rather than deleted or left plain — the strike is what the check skips, and what tells a
reader the claim is retracted. What the check cannot derive is a _rendered consequence_: a greyed nav
row, a CTA that is not there, a screen that does not follow — that half is still yours, because it is
a claim about the running app and not a name in the tree. Route claims are out of scope in this first
cut, and the mode's usage text says what that would need.

## The version badge points at the tag

Every build prints its own version — on `/login`, in the footer, at the foot of the sidebar —
and that badge links to `releases/tag/v<version>`, the exact tag, deliberately not
`/releases/latest`. The number is `package.json`'s `version`, read once by `next.config.mjs` and
inlined into the bundle; nothing else in the tree spells a version.

**The version badge links to the tag — tag before you deploy, or the badge leads to a 404.** That
is the coupling, not a bug in the badge: a badge that always resolves but never names the deployed
build identifies nothing. `scripts/release.sh` creates the tag and the Release in that order, and
`--tag-only` is what a prepared bump uses, so the ordinary path already satisfies it.

## main → production: promoting a release

A tag fixes the artefact; production is a separate decision, and the first honest sentence about it
is a measurement rather than a policy: **on 2026-11-03 a merge to `main` reached production on its
own.** Two squash merges that day — `94070089` (`perf(db)`, #479) and `f3b76581`
(`chore(release): 1.3.0`) — were each reported by `GET /api/version` within about two minutes of the
merge, with no promotion call from this machine and no deploy hook anywhere in the tree. The
project's Git integration created both. On 2026-10-31 and 2026-11-01 the same project reported
creation _disabled_ (`previewDeploymentsDisabled`, `gitProviderOptions.createDeployments:
"disabled"`), so this setting has already changed twice and can change again: step 1 measures it
instead of trusting either state.

That leaves two paths, and they are not alternatives to choose between on faith:

- **The merge deploys.** While creation is on, the push that merges a PR _is_ the deployment;
  `vercel.json`'s `ignoreCommand` decides whether that deployment builds, and production serves
  `main`'s tip once the build finishes.
- **The API promotes.** `POST /v13/deployments` with `gitSource.repoId` names a commit explicitly.
  It is the only way to deploy what a push did not — another ref, a commit whose deployment failed,
  a re-promotion after a rollback — and the only way while creation is switched off.

Two orderings are not negotiable, and both have already been paid for once:

- **The tag comes first.** The version badge on every build links to `releases/tag/v<version>` (see
  above), so deploying a commit whose version has no tag ships a badge that answers 404.
- **The migrations come before the deploy that reads them — which, while merges deploy, means before
  the merge.** A page selecting a column the database does not have is a 500 at request time, not a
  missing panel — and the relationship list, the template catalogue and the relationship screen all
  read at request time. Migrations `0020` and `0021` (`contact_message`) are what this rule is
  written from: the contact form inserts into a table that must exist before the build posting to it
  is serving. Applied after the merge, the migration is already too late.

### 1. What production serves now

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
git switch main && git pull --ff-only
node scripts/deploy-check.mjs --expect "$(git rev-parse HEAD)"
curl -s https://alignsynch.com/api/version
```

`OK` means production already serves the commit named — for a merge that deployed on push, that is
`main`'s tip about two minutes after the merge. `STALE` prints what it does serve: either the build
is still running (check again in a minute) or the push did not deploy, and step 3 is the fix.
`UNKNOWN` is never `OK`: the script exits 2 and says why.

### 2. Migrations, against production, before anything reads them

The `db:*` scripts take the **unpooled** connection string, and an exported variable wins over
`.env.local` and `.env` (`scripts/load-env.mjs`), so the branch is named on the command line rather
than inherited from whichever file happens to sit in the checkout:

```bash
read -rsp 'production DATABASE_URL (unpooled): ' PROD_DB_URL && echo
DATABASE_URL_UNPOOLED="$PROD_DB_URL" pnpm db:migrate   # idempotent; prints applied and skipped
DATABASE_URL_UNPOOLED="$PROD_DB_URL" pnpm db:verify    # the party rules, read back
unset PROD_DB_URL
```

A release with nothing to migrate still runs it, and a run that applies nothing is the expected
answer — cheaper than discovering the column is missing at request time.

### 2a. When `db:verify` names a V11, clear the mark — never the row it sits on

`party.unlock_seen_at` is written only when a party opens a **complete** instance (#252), and
`complete` is _derived_ from rows: both seats answered every Aspect **and** both accepted
(#427/R2). So an instance can walk backwards underneath a mark that is already set, and V11 names
it — a hand-deleted `opinion` row, or a release that changed the rule itself. Both are one check
apart, and the second has been measured: `avery-rowan` was marked seen at 2026-11-02T08:42Z, three
hours _before_ the merge that made acceptance the completion hinge, and read as `answering` from
that merge on until 2026-11-03, when the mark was cleared.

The repair is the row V11 named, and it is the mark, never the instance:

```sql
UPDATE party SET unlock_seen_at = NULL
 WHERE session_record_id = '<the record id for the slug V11 named>'
   AND role = '<the role V11 named>';
```

Re-run `db:verify` after it; the verdict line should read `0 unlock mark(s) on complete instances
only`. A rule change that moves several instances at once names several lines — drop the `role`
predicate to clear one instance's marks, and walk the slugs the check printed.

`db:seed` and `demo:reset` are not the cause and cannot be the fix: the seed deletes and re-inserts
every `party` row, so a mark cannot survive it, and `demo:reset` refuses the default branch by id.
Do not "repair" a V11 by making the instance complete either — the mark records that somebody read
the unlock, and nobody did.

### 2a (continued). When seeded instances read `answering`, stamp the seed's own instant — do not reseed

Measured 2026-11-03. `#427/R2` (`90afb55e`, merged 2026-11-02T11:52Z) made `party.accepted_at` half
of the `complete` derivation, and `db:seed` stamps it per instance from the fixture's own date
(`scripts/db-seed.mjs`, the `INSERT INTO party (… accepted_at)` in `seedInstance`). Production's
seeded rows were written **before** that stamp existed, so all four seeded instances read
`answering` with every Aspect answered on both seats — their reports and tours locked behind
`complete`. `db:verify` is green on this: nothing requires a seeded instance to be `complete`, which
is why it went unnamed for a day.

The repair is the acceptance column on the parties the fixture owns, and nothing else — one
statement per instance, inside one transaction:

```sql
UPDATE party SET accepted_at = '<the instance record's fixture date>'
 WHERE session_record_id = '<assessment-instance-slug>'
   AND accepted_at IS NULL;
```

On production that was 8 rows (4 instances × 2 seats), 2026-11-03: `avery-rowan` and `ruth-sam`
`2026-10-28`, `marco-priya` `2026-10-29T08:30Z`, `noor-iris` `2026-10-29T09:45Z` — the same instants
`db:seed` writes, read from `data/assessments.ts` rather than typed. Afterwards `readFlowScreen`
answers `complete` with a populated `report` for both demo seats, and `db:verify` still prints 0
violations.

**`pnpm db:seed` is not the fix on production, and the reason is structural, not caution:**

- it `DELETE`s and re-inserts every `party` row of the instances it owns, which drops their
  `user_id` bindings (the ones V10 pins) and any `unlock_seen_at` mark;
- phase 1 always **removes** the three demo auth accounts and, with `DEMO_AUTH=1`, re-creates them
  through the auth server — a write to `neon_auth`, which a content repair must not touch;
- on today's production it refuses outright: `record` holds assessment rows the seed does not
  author (instances and template copies people created in the app), and its "only seeded rows"
  guard throws instead of deleting a row it did not write. Two of those instances belong to real
  accounts, so a wipe would have destroyed live user rows.

The rule that follows: `complete` is **derived**, so a rule change is a data event — after one,
check whether the seeded instances still read `complete`, and if they do not, restore the acceptance
the seed would have written rather than re-running the writer. Row counts, bindings and the
`neon_auth` schema stay untouched; a backup of the affected rows precedes the write. This is a
one-time catch-up, not a routine step: a fixture that needs a new stamp gets it in
`scripts/db-seed.mjs`, never in a hand-written UPDATE.

### 3. Create the deployment, naming the commit

For when the merge did not deploy — creation is off, the commit is not `main`'s tip, a deployment
failed, or a rollback has to be reversed — this is the deliberate path. `.vercel/project.json` is
written by `vercel link` (gitignored), and both ids are also on the project's Settings page:

```bash
export VERCEL_TOKEN=...   # a team token; never committed, never in .env
vercel link --yes --project alignsynch --scope riolabs-ai   # writes .vercel/project.json (gitignored)
read -r PROJECT_ID TEAM_ID <<<"$(node -p 'const p=require("./.vercel/project.json");`${p.projectId} ${p.orgId}`')"
```

The repository id is the one Vercel itself stores for this project, read back rather than typed:

```bash
curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/$PROJECT_ID?teamId=$TEAM_ID" -o /tmp/vercel-project.json
REPO_ID=$(node -p 'require("/tmp/vercel-project.json").link.repoId')
SHA=$(git rev-parse HEAD)
```

Then one `POST`. `forceNew=1` is deliberate: a re-promotion of a commit Vercel has already built is
otherwise deduplicated onto the existing deployment record, and the promotion must be a new build.

```bash
node -e 'const [project, repo, sha] = process.argv.slice(1);
process.stdout.write(JSON.stringify({
  name: "alignsynch", project, target: "production",
  gitSource: { type: "github", repoId: repo, ref: "main", sha },
}))' "$PROJECT_ID" "$REPO_ID" "$SHA" > /tmp/deploy-request.json

curl -sS -X POST "https://api.vercel.com/v13/deployments?forceNew=1&teamId=$TEAM_ID" \
  -H "Authorization: Bearer $VERCEL_TOKEN" -H 'Content-Type: application/json' \
  --data-binary @/tmp/deploy-request.json -o /tmp/deploy.json

node -p 'const d = require("/tmp/deploy.json"); `${d.id} ${d.url} ${d.readyState}`'
```

The answer carries `id` (`dpl_…`), `url` and `readyState`. Watch it reach `READY`; `ERROR`, or a
build that stops at `QUEUED` because the Hobby allowance is spent (100 deployment records per
rolling 24 h, canceled ones included), is a failed promotion, not a slow one:

```bash
DEPLOY_ID=$(node -p 'require("/tmp/deploy.json").id')
for _ in $(seq 1 60); do
  curl -sS -H "Authorization: Bearer $VERCEL_TOKEN" \
    "https://api.vercel.com/v13/deployments/$DEPLOY_ID?teamId=$TEAM_ID" -o /tmp/deploy-state.json
  STATE=$(node -p 'require("/tmp/deploy-state.json").readyState')
  echo "readyState=$STATE"
  case "$STATE" in READY | ERROR | CANCELED) break ;; esac
  sleep 10
done
```

### 4. Prove production is serving it

```bash
node scripts/deploy-check.mjs --expect "$SHA"
curl -s https://alignsynch.com/api/version      # {"version":"…","commit":"…"}
```

Both read `GET /api/version`, which the build answers from the `APP_VERSION` and `APP_COMMIT` values
`next.config.mjs` bakes in — no token, no inference. A `READY` deployment whose alias still points
at the previous build answers `STALE`, and the fix is to promote the new deployment rather than to
build a third one ([`DEPLOYING.md`](DEPLOYING.md), _When the check says `STALE`_).

### 5. When it has to be undone

A deployment is never edited. The previous good deployment is promoted back — the dashboard's
_Promote_, or `POST /v9/projects/$PROJECT_ID/promote` with its `deploymentId` — and a migration that
has been applied stays applied: forward is a new migration file, never a rollback of a row
`schema_migrations` already recorded.

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

**A pushed tag is never moved.** If the tag itself is wrong — the wrong commit, a bump that shipped a
tree nobody gated — report it, delete the tag and the Release, and cut the **next** version
(`v1.0.1`). Re-tagging the same version silently rewrites what someone may already have pinned.
A pre-release is no exception: `v1.1.0-rc1` is not re-pointed at a repaired commit, `v1.1.0-rc2` is.
`--tag-only` refuses an existing tag by design; do not work around it with `git tag -f`.

**A Known limit that is false is the prose, not the tag, and it is corrected in place while that
version is the one readers land on.** The entry is the Release body, and the version badge on every
screen links `releases/tag/v<version>` — so a false bullet there is a page the running product sends
people to, not an archived opinion. Fix the bullet, say inside the bullet that it was corrected after
publication, re-publish the body (`gh release edit v<version> --notes-file <entry>`), and prove the
body and the entry are byte-equal. The tag does not move, so `git show v<version>:CHANGELOG.md` keeps
the wording the cut shipped: that divergence is the cost, and the disclosure in the bullet is what
makes the edit auditable instead of silent. Once a later version exists the older entry is history
rather than a live claim — a false statement _there_ is superseded in the next entry, and the old
wording stays as the record. A release candidate keeps the stricter rule above: it is deleted and
re-cut, because its only reader is the cut itself.

A release is done when all four artefacts agree:

```bash
git tag --list                                    # v1.0.0
git describe --tags                               # v1.0.0 — on main
node -p 'require("./package.json").version'       # 1.0.0
gh release view v1.0.0 --json tagName,isDraft,url # published, not a draft
```

and when `bash scripts/verify.sh` is green on the tagged commit, and on `main` afterwards — the
release step is what proves the CHANGELOG still describes the history it was written for.

Production is not one of those four artefacts. A release can be complete and deployed, complete and
not yet promoted, or promoted without its tag having been cut — and the third of those is the one that
makes the badge lie. Asking production for the tag's own commit is the question a release page cannot
answer on its own:

```bash
VERSION=$(node -p 'require("./package.json").version')
node scripts/deploy-check.mjs --expect "$(git rev-parse "v$VERSION")"
```

and [`main → production`](#main--production-promoting-a-release) above is the procedure that closes
the gap it prints.
