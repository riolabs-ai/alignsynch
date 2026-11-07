# ARD — Move the AlignSynch project into a dedicated GitHub organization

| Field                             | Value                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Status                            | **Proposed — blocked on one owner action** (see §2)                                         |
| Date                              | 2026-11-07                                                                                  |
| Scope                             | `riolabs-ai/alignsynch` (repository), Projects v2 #6 (board), integrations, slug references |
| Out of scope                      | Projects v2 #5 `rio.stack`, every other `riolabs-ai` repository                             |
| Writes performed by this research | **None.** Read-only `gh api` calls plus this document.                                      |
| Author                            | `ase-github` (research worker)                                                              |

---

## 0. Verdict in one paragraph

The move is **feasible and correctly motivated**, and it unlocks one capability the project
cannot have today: merge queue (documented as org-owned-public-repo only). It is **not
executable by the only credential on this machine.** `jadenblack` holds `write` on the
repository, and GitHub requires `admin` on the source repository to transfer it. The sole admin
is the user account `riolabs-ai`, which has **no credential on this host** — `gh-alt.sh`
exits 78. Everything else in this document is preparation for one owner action: mint a
`riolabs-ai` credential (or click Transfer in the web UI). Two further findings change the shape
of the plan rather than its feasibility: `riolabs-ai/alignsynch` **will be permanently retired**
by GitHub on transfer (934 Actions runs in the last 7 days, threshold 100), and the 213-item
board **has no transfer path at all** and must be rebuilt item by item.

---

## 1. What was measured (and three corrections to the brief)

The brief supplied eight facts to verify and extend. Seven reproduce exactly. One does not, and
four premises about the codebase turned out to be wrong in ways that shrink the work.

| #   | Brief's claim                                                            | Measured 2026-11-07                                                                                      | Verdict          |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | `riolabs-ai` is a User, 79 repos                                         | `type: User`, `public_repos: 79`, created 2025-07-08T14:17:28Z                                           | ✅ confirmed     |
| 2   | `alignsynch` login taken by a User                                       | `type: User`, created 2025-12-18T00:54:18Z, 1 public repo                                                | ✅ confirmed     |
| 3   | Org creation is web-only                                                 | `POST admin/organizations` → **404**; `POST organizations` → **404**                                     | ✅ confirmed     |
| 4   | `jadenblack` belongs to zero orgs                                        | `gh api user/orgs` → empty                                                                               | ✅ confirmed     |
| 5   | Repo public, no license, `package.json` 1.4.0                            | public, `license: none`, version `1.4.0`, name `quizhub`                                                 | ✅ (but see C1)  |
| 6   | Project #6 `PVT_kwHODRraYc4BpyJQ`                                        | id matches, title "AlignSynch WebApp", public, open                                                      | ✅               |
| 7   | Project #5 `PVT_kwHODRraYc4Bnz9S`, out of scope                          | id matches, 19 items                                                                                     | ✅               |
| 8   | **124 worktrees under `.worktrees/`, all pushing to the current remote** | **150 registered worktrees / 149 non-main**, spread over **4 roots**; `.worktrees/` holds **26** of them | ❌ **corrected** |

### Corrections

**C1 — `package.json` carries no slug.** The brief expected `repository`/`homepage` fields. There
are none.

```console
$ python3 -c "import json;d=json.load(open('package.json'));print(d.get('repository'),d.get('homepage'),d.get('bugs'))"
None None None
```

**C2 — `scripts/release.sh` and `scripts/health-record.mjs` carry no slug.** `release.sh` derives
it from the remote at call time; `health-record.mjs` has no GitHub reference at all.

```console
$ sed -n '66,76p' scripts/release.sh
repo_slug() {
  local url
  url="$(git config --get remote.origin.url 2>/dev/null || true)"
  printf '%s' "$url" | sed -E 's#^(git@|https://|ssh://git@)github\.com[:/]##; s#\.git$##'
}
SLUG="$(repo_slug)"
```

This is good news: the release tooling **follows the remote automatically** and needs no edit.

**C3 — no `gh:riolabs-ai/alignsynch#<n>` idempotency keys exist.** The brief expected keys of that
form in the kanban DB. There are zero.

```console
$ python3 -c "import sqlite3;c=sqlite3.connect('file:$HOME/.hermes/kanban.db?mode=ro',uri=True).cursor();c.execute(\"select count(*) from tasks where idempotency_key like '%riolabs-ai/alignsynch%'\");print(c.fetchone()[0])"
0
```

`idempotency_key` is null on every row, so no card is keyed to the slug. Nothing to migrate.

**C4 — the worktree redistribution is one command, not 149.** This is the most useful correction.
`git worktree` checkouts share the primary repository's object store **and its config**. The slug
appears in exactly two lines of one file, `<primary>/.git/config`, as `url` and `pushurl`. No
worktree carries a private remote.

```console
$ grep -c "riolabs-ai/alignsynch" .git/config
2
$ find .git/worktrees -maxdepth 2 -name "config*" | wc -l
0
```

So `git remote set-url origin <new>` **and** `git remote set-url --push origin <new>` fix all 150
checkouts atomically. There is no per-worktree step and no need to touch the 119 under
`~/.hermes/worktrees/alignsynch`.

### Worktree distribution (measured)

| Root                                                     | Registered worktrees |
| -------------------------------------------------------- | -------------------- |
| `~/.hermes/worktrees/alignsynch/`                        | 119                  |
| `<primary>/.worktrees/`                                  | 26                   |
| `/home/jadenblack/` (`work-main-t_*`, `work-t_*`)        | 4                    |
| `/home/jadenblack/Desktop/dev.local/alignsynch/quizhub/` | 1                    |
| **Primary checkout itself**                              | 1                    |
| **Total `git worktree list`**                            | **150**              |

Primary checkout: `/home/jadenblack/Desktop/dev.local/alignsynch/quizhub/quizhub`, `main` at
`91bade7f` (6 commits behind `origin/main` = `c8f713c1`). 448 local branches, 21 remote branches,
`.git` is 479 MB.

---

## 2. The decision

**Recommended: Option A — transfer the repository into a new org named `alignsynch-org`, promote
`riolabs-ai` to org owner, and rebuild the board's item list against the new owner.**

The owner action that unblocks everything is one of:

- **(A1) Mint a `riolabs-ai` credential** on this host
  (`GH_CONFIG_DIR=$HOME/.config/gh-alt gh auth login` as `riolabs-ai`). `gh-alt.sh` then works and
  the transfer can be scripted with a checkpoint per step.
- **(A2) Click Transfer in the web UI** while signed in as `riolabs-ai`. No credential is minted;
  the sequence in §8 becomes a checklist a human follows, and every `gh` verification line below
  runs as `jadenblack` (read-only checks still work; admin-only checks do not).

A2 is strictly less machinery and equally safe. A1 is preferable only if the transfer should be
rehearsed or repeated.

### Options considered

| Option                                              | Mechanism                                | Cost                                                                                                                                     | Why not chosen / chosen                                                                                                                                                                                                                                                              |
| --------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Transfer to new org** ✅                       | GitHub repo transfer, then rebuild board | Board rebuild (~213 items), 21 slug files, Vercel relink                                                                                 | **Chosen.** Preserves all 601 issues+PRs, 5 releases, 2 rulesets, 4 secrets, history and contribution graph. Unlocks merge queue.                                                                                                                                                    |
| B. Fresh repo in org, push code, re-create metadata | `git push` to new empty repo             | Destroys PR history; 429 PRs and every `(#NNN)` reference in `CHANGELOG.md` become dangling; 172 issues to re-file; 5 releases to re-cut | Only viable if A1/A2 never happens. Loses the audit trail the project's own gate documentation depends on.                                                                                                                                                                           |
| C. Rename the `alignsynch` user, then take the name | Ask the account holder to rename         | **Impossible to make safe**                                                                                                              | Documented: "your old username becomes available for anyone else to claim" — no reservation, no cooling-off. Username Policy forbids squatting and refuses release requests. And the name is a _user_, so even freed, an org could not be created from it without a race. See §3 Q1. |
| D. Do nothing                                       | —                                        | Merge queue stays unavailable; governance stays on a personal account                                                                    | Rejected: merge queue is documented as org-only, and rule `26350228` is currently a no-op because of it (§3 Q9).                                                                                                                                                                     |

### Why `alignsynch-org` and not `alignsynch`

`alignsynch` is a live user account created 2025-12-18 that owns
`alignsynch/agentic-coding-starter-kit`. Freeing it requires that account holder to rename
_voluntarily_ — GitHub will not release it (Username Policy: "We do not accept requests to
release, transfer, or reclaim usernames"). Even if they did, the old login returns to the open
market immediately, so a race exists between their rename and the org creation, and the loser
cannot recover the name.

**All five candidate alternates were measured free:**

```console
$ for n in alignsynch-org alignsynch-ai alignsynch-app alignsynchhq alignsynch-inc; do
    printf '%s -> ' "$n"; gh api "users/$n" --silent -i | head -1; done
alignsynch-org -> HTTP/2 404      # free
alignsynch-ai  -> HTTP/2 404      # free
alignsynch-app -> HTTP/2 404      # free
alignsynchhq   -> HTTP/2 404      # free
alignsynch-inc -> HTTP/2 404      # free
riolabs        -> HTTP/2 200      # taken
```

> **Caveat, measured honestly:** a 404 proves the login is currently unclaimed. It does **not**
> prove creation will succeed — GitHub also rejects names that are reserved or confusingly similar
> to an existing account, and there is no name reservation of any kind. `alignsynch-org` is the
> recommendation; confirm at creation time and fall back down the list.

---

## 3. The nine questions

### Q1 — Name and namespace

**Answer: the `alignsynch` login cannot be freed safely. Use a different slug. Nothing is
reserved after a rename, for any period.**

| Proposition                                               | Basis                                                                                                                                                  | Verdict        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| A user rename frees the old login immediately, for anyone | Documented — "After changing your username, your old username becomes available for anyone else to claim." No cooling-off period is stated.            | **Documented** |
| GitHub will release a name on request                     | Documented — Username Policy: "We do not accept requests to release, transfer, or reclaim usernames on the basis that they appear inactive or unused." | **Documented** |
| Holding a name on a spare account is allowed              | Documented — "GitHub prohibits account name squatting, and account names may not be reserved or inactively held for future use."                       | **Documented** |
| Deleting an account frees the name after 90 days          | Documented — Personal account reference: "Your username will be available for anyone to use after 90 days."                                            | **Documented** |
| A freed old login redirects to the new one                | Documented — but a _new_ repo at the old location overrides the redirect                                                                               | **Documented** |

Sources (retrieved 2026-11-07):
- https://docs.github.com/en/account-and-profile/concepts/username-changes
- https://docs.github.com/en/site-policy/other-site-policies/github-username-policy
- https://docs.github.com/en/account-and-profile/reference/personal-account-reference

**Reservation period: zero.** There is no window in which the renamer holds a claim. The only
durable protection is that the _retired_ `OWNER/REPONAME` combination cannot be recreated (§ Risk
R2) — which protects the redirect but also forecloses rollback by recreation.

### Q2 — Ownership chain

**Answer: only `riolabs-ai` can perform the transfer, and that is the project's single blocker.**
`jadenblack` has `write`, not `admin`.

```console
$ gh api repos/riolabs-ai/alignsynch/collaborators/jadenblack/permission --jq '.permission'
write
$ gh api repos/riolabs-ai/alignsynch --jq '.permissions'
{"admin":false,"maintain":false,"pull":true,"push":true,"triage":true}
$ gh api "repos/riolabs-ai/alignsynch/collaborators?affiliation=all" --jq '.[]|{login,admin:.permissions.admin}'
{"login":"jadenblack","admin":false}
{"login":"riolabs-ai","admin":true}
```

This also explains every 404 in the inventory: `admin` gates deploy keys, webhooks and secret
scanning alerts, so those three rows are unreadable from this host (§6, §5).

Documented requirements for the action:

| Requirement                                                                                            | Source        | Status here                                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------- | --------------------------------------------------------------------------------------- |
| "To transfer a repository you must have administrator access to the repository"                        | transfer docs | ❌ `jadenblack` = write. `riolabs-ai` = admin, **no credential**.                       |
| "you must have permission to create a repository in the target organization"                           | transfer docs | ⚠️ Not yet true — `jadenblack` is in zero orgs. Becomes true once they own the new org. |
| "The original owner of the repository is added as a collaborator on the transferred repository."       | transfer docs | ✅`riolabs-ai` survives as a collaborator, not as owner.                                |
| "the organization's default repository permission settings … will apply to the transferred repository" | transfer docs | ⚠️ Set base permission to `write` **before** transfer, or `jadenblack` loses push.      |

**The stated intent — `riolabs-ai` becomes PM / steward / standards / reviewer / optimizer — maps
onto org roles like this:**

| Intent              | GitHub mechanism                                                        | Note                                                                                                          |
| ------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Steward / standards | **Org owner** (predefined role)                                         | Full control incl. rulesets, billing, membership. Only one needed.                                            |
| Reviewer            | Repository `write` + being a _different identity_ from the PR author    | This is what makes the 1-approval rule work. Preserved by the "original owner becomes a collaborator" clause. |
| PM / optimizer      | **Outside the org**: keep Projects v2 #6 owned by the `riolabs-ai` user | Legitimate. Projects v2 can be user-owned and reference org repos. Avoids a second migration (§Q4).           |
| Custom roles        | ❌ Not available                                                        | Documented: custom org roles are GitHub Enterprise Cloud only. Free org gets predefined roles only.           |

Sources: transfer docs (below); https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/roles-in-an-organization (retrieved 2026-11-07).

**Critical trap for `jadenblack`:** transferring from a personal account to an org keeps issue
assignees **only if they are org members**; "all other issue assignees are cleared". `jadenblack`
is not a member yet. **Invite and accept `jadenblack` into the org before the transfer**, or every
issue assigned to them loses its assignee.

### Q3 — What travels and what does not

Documented in one sentence by the transfer page: _"When you transfer a repository, its issues,
pull requests, wiki, stars, and watchers are also transferred. If the transferred repository
contains webhooks, services, secrets, or deploy keys, they will remain associated after the
transfer is complete."_

| Asset                             | Measured count                                                         | Travels?                       | Basis                                                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Issues                            | **172**                                                                | ✅                             | Documented                                                                                                                                                              |
| Pull requests                     | **429**                                                                | ✅                             | Documented                                                                                                                                                              |
| Comments / review threads         | 429 PRs' worth                                                         | ✅                             | Documented (part of PRs)                                                                                                                                                |
| Labels                            | **16**                                                                 | ✅                             | Documented (part of issues)                                                                                                                                             |
| Milestones                        | **8**                                                                  | ✅                             | Documented (part of issues)                                                                                                                                             |
| Releases                          | **5** (`v1.0.0`, `v1.1.0-rc1`, `v1.2.0`, `v1.3.0`, `v1.4.0`)           | ✅                             | Documented ("releases")                                                                                                                                                 |
| Tags                              | **5** (same set)                                                       | ✅                             | Git refs travel with the object store                                                                                                                                   |
| Rulesets                          | **2** (`26115314`, `26350228`)                                         | ⚠️ **UNVERIFIED**              | Transfer page is silent. Cheapest test: post-transfer `gh api repos/<org>/alignsynch/rulesets --jq 'length'` — expect 2, restore from the JSON captured in step 2 if 0. |
| Classic branch protection         | **0** (`/branches/main/protection` → 404)                              | n/a                            | Nothing to lose                                                                                                                                                         |
| Actions workflows                 | **4** (`CI`, `Demo reset`, `Release notify`, Dependabot)               | ✅                             | Files in the tree                                                                                                                                                       |
| Actions **secrets**               | **4**: `NEON_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `STAKEHOLDERS` | ✅                             | Documented ("secrets … remain associated"). **Values are unreadable by design** — they survive but cannot be copied, so a rollback that recreates the repo loses them.  |
| Actions variables                 | **0**                                                                  | n/a                            | Nothing to lose                                                                                                                                                         |
| Environments + required reviewers | **0**                                                                  | n/a                            | Nothing to lose                                                                                                                                                         |
| Deploy keys                       | **UNVERIFIED** (404, admin-gated)                                      | ✅ documented                  | Cheapest test: `gh api repos/<org>/alignsynch/keys` as admin, expect the same count                                                                                     |
| Webhooks                          | **UNVERIFIED** (404, needs `admin:repo_hook`)                          | ✅ documented                  | Cheapest test in §5                                                                                                                                                     |
| GitHub Apps                       | **UNVERIFIED** (`/installation` needs an app JWT)                      | ⚠️                             | Installed apps with repo-scoped access can drop on ownership change. Cheapest test: read Settings → GitHub Apps before and after.                                       |
| Packages                          | **0** (no GHCR entries)                                                | n/a                            | Nothing to lose                                                                                                                                                         |
| CODEOWNERS                        | Present, **5 rules**                                                   | ✅                             | File in tree — but see §Q5, handles must be re-validated                                                                                                                |
| Security advisories               | **0**                                                                  | ✅                             | Documented                                                                                                                                                              |
| Secret-scanning alerts            | **UNVERIFIED** (404; needs `security_events`)                          | ⚠️                             | Alerts are repository-scoped; prior measurement recorded 2 open. Cheapest test in §5.                                                                                   |
| Dependabot alerts                 | **0** open                                                             | ✅                             | Measured                                                                                                                                                                |
| Code scanning                     | **0** (no analysis configured)                                         | n/a                            | Nothing to lose                                                                                                                                                         |
| Forks                             | **0**                                                                  | n/a                            | Nothing to lose                                                                                                                                                         |
| Stars / watchers                  | **0 / 0**                                                              | n/a                            | Nothing to lose                                                                                                                                                         |
| Redirects                         | n/a                                                                    | ✅ but **permanently retired** | §R2                                                                                                                                                                     |

Sources (retrieved 2026-11-07): https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository

### Q4 — Projects v2

**Answer: board #6 does not move. There is no transfer operation, and the documented copy
operation deliberately discards every item.** The board must be rebuilt item-by-item, or kept
where it is.

GraphQL type introspection confirms there is no transfer mutation — `ProjectV2` has no such
field, and `CopyProjectV2Input` exposes only four inputs:

```console
$ gh api graphql -f query='{ __type(name:"CopyProjectV2Input"){ inputFields{ name } } }'
projectId, ownerId, title, includeDraftIssues        # that is the entire surface
$ gh api graphql -f query='{ __type(name:"ProjectV2"){ fields{ name } } }'
closed closedAt createdAt creator field fields fullDatabaseId id items number owner public
readme repositories resourcePath shortDescription statusUpdates teams template title
updatedAt url view viewerCanClose viewerCanReopen viewerCanUpdate views workflow workflows
# no transfer/move field
```

Documented behaviour of `copyProjectV2`: _"The new project will not contain the original
project's items, collaborators, or team and repository links."_
(https://github.com/github/docs/blob/main/content/issues/planning-and-tracking-with-projects/creating-projects/copying-an-existing-project.md, retrieved 2026-11-07)

**Measured shape of board #6:**

| Property                       | Value                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Items                          | **213** — **58 Issues + 155 PullRequests + 0 draft issues**                                                                        |
| Fields                         | **19** (incl. `Status` single-select with 5 options: Backlog / Ready / In progress / In review / Done)                             |
| Views                          | **6** — Prioritized backlog (table), Status board (board), Roadmap (roadmap), Bugs 🐛 (table), In review (table), My items (table) |
| Workflows (native automations) | **7**, all enabled — incl. **#13 "Auto-add to project"** and #10 "Auto-add sub-issues to project"                                  |
| Linked repositories            | **1** — `riolabs-ai/alignsynch` only                                                                                               |
| Visibility                     | public                                                                                                                             |

```console
$ gh api graphql --paginate -f query='query($endCursor:String){node(id:"PVT_kwHODRraYc4BpyJQ"){...on ProjectV2{items(first:100,after:$endCursor){pageInfo{hasNextPage endCursor}nodes{content{__typename}}}}}}' \
    --jq '.data.node.items.nodes[].content.__typename'
     58 Issue
    155 PullRequest
```

**Migration path, cheapest first:**

1. **Keep the board where it is (recommended).** A Projects v2 board owned by the `riolabs-ai`
   user can carry items from org repos. Nothing breaks; `riolabs-ai` keeps its PM role exactly as
   intended. Cost: zero. Risk: the board's identity stays tied to the personal account — a
   governance answer, not a technical one.
2. **Rebuild under the org.** `copyProjectV2` with `includeDraftIssues: true` reproduces the 19
   fields, 6 views and (except auto-add) the workflows, but yields **0 of the 213 items**. Re-adding
   each requires `addProjectV2ItemById` per node, plus `updateProjectV2ItemFieldValue` for every
   non-default field on every item; re-create workflow #13 by hand because templates exclude
   auto-add. Estimate the work as **213 add calls + N field writes + 7 workflow re-creations** —
   scriptable, but it is a script, not a transfer.
3. **Wait for a supported transfer.** None exists as of 2026-11-07.

### Q5 — Slug references inside the product

**Answer: 378 occurrences in 21 files, but only 20 occurrences in 10 files are live code or doc
prose. 350 of the 378 are historical `CHANGELOG.md` links and should not be rewritten.**

```console
$ grep -rn "riolabs-ai/alignsynch" . \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.worktrees --exclude-dir=.git | wc -l
378
$ … | cut -d: -f1 | sort -u | wc -l
21
```

| File                                                    | Hits        | Class               | Must change?            | Why                                                                                                                                                                                              |
| ------------------------------------------------------- | ----------- | ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CHANGELOG.md`                                          | **350**     | Historical record   | ❌ **No**               | Generated release notes. Links resolve via redirect. Rewriting fabricates history and churns 350 lines.                                                                                          |
| `docs/GATE.md`                                          | 8           | Operator commands   | ✅ Yes                  | Copy-paste `gh api repos/riolabs-ai/alignsynch/...` lines must point at the new owner or they return 404 for everyone after step 3.                                                              |
| `AGENTS.md`                                             | 2           | Agent instruction   | ✅ Yes                  | Line 10 states the canonical repo; line 409 links issue #32.                                                                                                                                     |
| `tests/parity/summaries/{alignsynch,quizhub}/*.txt`     | 10 (1 each) | **Golden fixtures** | ✅ Yes — **regenerate** | These are asserted output. They contain `https://github.com/riolabs-ai/alignsynch/releases/tag/v1.4.0` rendered from `RELEASE_TAG`. Editing the constant without `pnpm parity:update` breaks CI. |
| `components/layout/app-version.tsx`                     | 1           | **Product code**    | ✅ Yes                  | `const RELEASE_TAG = "https://github.com/riolabs-ai/alignsynch/releases/tag/v"` — the only user-visible slug.                                                                                    |
| `tests/app-version.test.ts`                             | 1           | Test                | ✅ Yes                  | Asserts against the same literal.                                                                                                                                                                |
| `app/api/version/route.ts`                              | 1           | Comment only        | Optional                | Explains why the route is public.                                                                                                                                                                |
| `docs/gate-baseline.py`                                 | 1           | Script constant     | ✅ Yes                  | `REPO = "riolabs-ai/alignsynch"` — the baseline tool queries CI history for that slug.                                                                                                           |
| `README.md`                                             | 1           | Doc prose           | ✅ Yes                  | Issue #214 link.                                                                                                                                                                                 |
| `docs/REPO-LAYERS.md`, `docs/p1-migration/MIGRATION.md` | 1 each      | Doc prose           | ✅ Yes                  | Issue links.                                                                                                                                                                                     |

**References the brief did not name, which do exist:**

| File                 | Hits | Class          | Note                                                                                                                                                                                                                                                                |
| -------------------- | ---- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/CODEOWNERS` | 5    | **Governance** | Five rules of the form `/db/migrations/ @riolabs-ai @jadenblack`. Both handles stay valid post-transfer (usernames do not change), so this survives — **provided both remain write collaborators**. If `riolabs-ai` were demoted, the file silently stops matching. |
| `docs/DEPLOYING.md`  | 1    | Doc prose      | "Vercel project (`alignsynch`, team `riolabs-ai`)" — a **Vercel** scope, unrelated to the GitHub owner. Do not "fix".                                                                                                                                               |
| `docs/RELEASING.md`  | 1    | Doc prose      | `vercel link --scope riolabs-ai` — Vercel scope again.                                                                                                                                                                                                              |
| `docs/ENV-SPEC.md`   | 1    | Doc prose      | `gh project list --owner riolabs-ai` — correct if the board stays user-owned (§Q4 option 1).                                                                                                                                                                        |

**Hermes side. The tooling is already slug-agnostic — only invocation arguments pin it.**

| Item                                            | Finding                                                                                                                               | Action                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `stack/github-specops/tools/proj_sync.py`       | **0 hardcoded** `riolabs-ai/alignsynch`.`--owner`, `--number`, `--repo` are arguments; docstring examples use `riolabs-ai/rio.stack`. | None — pass `--owner <new-org>`                                 |
| `stack/github-specops/tools/issue_card_sync.py` | **0 hardcoded** slug. Takes `--board alignsynch` (a Hermes board name, not a GitHub slug).                                            | None                                                            |
| kanban `idempotency_key`                        | **0 rows** match `gh:riolabs-ai/alignsynch%`; column is null everywhere                                                               | None                                                            |
| Hermes project `p_ab514640`                     | A Hermes project id, primary path is a local directory. No GitHub slug inside it.                                                     | Re-point `primary` only if the clone path changes (it does not) |
| `~/.hermes/profiles/alignsynch/bin/gh-alt.sh`   | `ALT_USER` defaults to `riolabs-ai`; two docstring examples hardcode `-R riolabs-ai/alignsynch`                                       | Cosmetic — update the examples                                  |

> **Why Hermes is clean:** both tools receive the owner and slug as arguments rather than
> constants. That was not accidental — it means the agent layer needs no code change for this
> migration, only a different `-R`/`--owner` value.

### Q6 — Integrations to reconfigure

| Integration                          | Depends on the GitHub slug?     | Evidence                                                                                                                                         | Work required                                                                                                                |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| **Vercel — Git connection**          | ✅**Yes**                       | `docs/DEPLOYING.md:3` — "a Vercel project (`alignsynch`, team `riolabs-ai`) that builds this repository"                                         | Disconnect/reconnect the Git integration to `<org>/alignsynch`. Then confirm the production branch still resolves to `main`. |
| **Vercel — `ignoreCommand`**         | ❌ No                           | `vercel.json`: branches on `$VERCEL_ENV` / `$VERCEL_GIT_COMMIT_REF`, never the slug                                                              | None                                                                                                                         |
| **Vercel — env vars**                | ❌ No                           | They are Vercel-scoped                                                                                                                           | None                                                                                                                         |
| **Vercel — deploy hooks**            | ❌ No                           | `docs/DEPLOYING.md:131` and `docs/RELEASING.md:200` both state "no deploy hook anywhere in the tree"                                             | None. **Confirm** by listing hooks in the Vercel UI; the doc is a claim, not a measurement.                                  |
| **Vercel — team/scope `riolabs-ai`** | ❌ No — **different namespace** | Same string, different product. Vercel team scope ≠ GitHub org.                                                                                  | **None. Do not rename.**                                                                                                     |
| **Resend — webhooks**                | ❌ No                           | `docs/RESEND-INBOUND.md:14` — `POST https://<host>/api/resend/webhook`, "the path is fixed; point the provider's webhook endpoint at the host"   | None — host-based, not repo-based. Verify the deployed host still answers `POST /api/resend/webhook` after redeploy.         |
| **Neon**                             | ❌ No                           | No GitHub-side linkage; the two GitHub-adjacent touches are the `NEON_API_KEY` Actions secret and the `demo-reset` workflow calling the Neon API | None beyond the secret surviving (§Q3).                                                                                      |
| **MCP servers**                      | ❌ No                           | Config holds `context7`, `deepwiki`, `prisma`, `neon`, `stripe` — all URL-based, none repo-scoped                                                | None                                                                                                                         |
| **GitHub Apps**                      | ⚠️ UNVERIFIED                   | `/repos/.../installation` requires an app JWT (401 measured)                                                                                     | Check Settings → GitHub Apps before/after                                                                                    |
| **`gh` credential on this host**     | ✅**Yes**                       | `gh auth status` → `jadenblack` active, `roryskagenart` inactive, **no `riolabs-ai`**                                                            | §Q7                                                                                                                          |

### Q7 — Keys and permissions

**Measured credential state:**

```console
$ gh auth status
github.com
  ✓ Logged in to github.com account jadenblack (keyring)     scopes: gist, project, read:org, repo, workflow
  ✓ Logged in to github.com account roryskagenart (keyring)  scopes: gist, read:org, repo, workflow   (no access to this repo)
$ ~/.hermes/profiles/alignsynch/bin/gh-alt.sh api user --jq .login
gh-alt: no credential for 'riolabs-ai' on this machine.
exit=78
```

| Identity        | Credential                                                     | Repo permission | Can transfer?                      |
| --------------- | -------------------------------------------------------------- | --------------- | ---------------------------------- |
| `jadenblack`    | `gho_` OAuth, scopes `gist, project, read:org, repo, workflow` | **write**       | ❌ no (`admin` required)           |
| `riolabs-ai`    | **none on this host**                                          | admin (owner)   | ✅ yes — _if_ a credential existed |
| `roryskagenart` | `gho_` OAuth                                                   | none            | ❌                                 |

**Minimum scope set after the move:**

| Scope             | Needed for                                                   | Holder                                       |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------- |
| `repo`            | push, PRs, issues, releases                                  | `jadenblack` (has), `riolabs-ai` (must mint) |
| `workflow`        | editing `.github/workflows/*` — **required**, the repo has 4 | both                                         |
| `project`         | Projects v2 read/write — board #6                            | both if the board stays user-owned           |
| `read:org`        | reading org membership/teams                                 | both                                         |
| `security_events` | **missing today**; secret-scanning alerts 404 without it     | either — needed only for §5 verification     |
| `admin:repo_hook` | **missing today**; webhooks 404 without it                   | needed once, to inventory webhooks           |
| `admin:org`       | creating teams, org rulesets, managing membership            | `riolabs-ai` only, if scripted               |

**Org roles needed after creation:** `jadenblack` = **owner** (to create the org and transfer in);
`riolabs-ai` = **owner** (steward intent, §Q2). Base repository permission should be set to
`write` before the transfer lands.

### Q8 — Sequence and rollback

See §8 for the full table. Two mechanical points decide the shape:

**`git remote set-url` is the safe path; do not rely on redirects.** Documented behaviour is that
`clone`/`fetch`/`push` against the old URL are redirected, **and** that "to avoid confusion, we
strongly recommend updating any existing local clones". The redirect is also destroyed — "If you
create a new repository or fork at the previous repository location, the redirects to the
transferred repository will be permanently deleted." Given 150 checkouts and 4 workflows, a
redirect is a hidden failure mode (a push appears to succeed against a URL that no longer
describes the repository). Repoint explicitly, in one command, covering both `url` and `pushurl`.

**All 150 worktrees are repointed by editing one file, twice.** No per-worktree loop, no
`git worktree repair`. Verified in §C4.

### Q9 — Costs and limits

**Answer: every feature this repository uses is free on a GitHub Free organization, and one
feature becomes newly available.**

| Capability                        | Today (user-owned, Free)                                                                           | After (Free org, public repo)                                                                             | Basis                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Merge queue**                   | ❌ **not available** — documented as "available in any public repository owned by an organization" | ✅**available**                                                                                           | Ruleset `26350228` is named "Merge Queue" but carries only `deletion` + `non_fast_forward` — no `merge_queue` rule, because a user account cannot have one. **CI is already ready**: `.github/workflows/ci.yml` triggers on `merge_group` and explicitly avoids cancelling those runs. Moving converts a dead ruleset into a working one. |
| Rulesets                          | ✅ 2 active                                                                                        | ✅ preserved ("available in public repositories with GitHub Free and GitHub Free for organizations")      | Documented                                                                                                                                                                                                                                                                                                                                |
| Actions minutes                   | ✅ free — "standard GitHub-hosted runners in public repositories" are independent of plan          | ✅ identical                                                                                              | Measured 1,400 runs / 934 in the last 7 days                                                                                                                                                                                                                                                                                              |
| Actions storage                   | 500 MB artifacts + 10 GB cache (Free)                                                              | ✅ identical — `GitHub Free for organizations` row = 500 MB / $12 / 10 GB                                 | Documented                                                                                                                                                                                                                                                                                                                                |
| Environments + required reviewers | 0 in use                                                                                           | ✅ available (deployment protection rules are a Free-for-org feature)                                     | Documented                                                                                                                                                                                                                                                                                                                                |
| Required pull request reviewers   | ✅ in use (ruleset `26115314`, count 1, no self-approval)                                          | ✅ preserved — it is a ruleset rule on a **public** repo; the Pro/Team paywall applies to _private_ repos | Documented                                                                                                                                                                                                                                                                                                                                |
| Secret scanning                   | ✅ free on public repos (but alerts unreadable here — §5)                                          | ✅ identical                                                                                              | Documented                                                                                                                                                                                                                                                                                                                                |
| Code owners                       | ✅ 5 rules                                                                                         | ✅ preserved (CODEOWNERS is a file) — paywalled only for private repos                                    | Documented                                                                                                                                                                                                                                                                                                                                |
| Pages / Packages                  | unused (0 packages)                                                                                | n/a                                                                                                       | Measured                                                                                                                                                                                                                                                                                                                                  |

Sources (retrieved 2026-11-07):
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/get-started/learning-about-github/githubs-plans

**Cost verdict: $0.** No capability is lost. One is gained.

---

## 4. Measured inventory

### 4.1 Repository

| Property                     | Value                             | Verification command                                                             |
| ---------------------------- | --------------------------------- | -------------------------------------------------------------------------------- |
| Slug                         | `riolabs-ai/alignsynch`           | `gh api repos/riolabs-ai/alignsynch --jq .full_name`                             |
| Owner type                   | **User**                          | `gh api repos/riolabs-ai/alignsynch --jq .owner.type`                            |
| Visibility                   | public                            | `… --jq .visibility`                                                             |
| License                      | none                              | `… --jq .license.spdx_id`                                                        |
| `package.json` version       | `1.4.0` (name `quizhub`)          | `jq -r .version package.json`                                                    |
| Default branch / HEAD        | `main` / `c8f713c1`               | `gh api repos/riolabs-ai/alignsynch/commits/main --jq .sha`                      |
| Size                         | 57,631 KB (~56 MB); `.git` 479 MB | `… --jq .size`                                                                   |
| Stars / watchers / forks     | 0 / 0 / 0                         | `… --jq '[.stargazers_count,.watchers_count,.forks_count]'`                      |
| Issues (all)                 | **172**                           | `gh api "search/issues?q=repo:riolabs-ai/alignsynch+is:issue" --jq .total_count` |
| Pull requests (all)          | **429**                           | `gh api "search/issues?q=repo:riolabs-ai/alignsynch+is:pr" --jq .total_count`    |
| Open issues / PRs            | 15 / 1                            | same, `+is:open`                                                                 |
| Labels                       | **16**                            | `gh api "repos/riolabs-ai/alignsynch/labels?per_page=100" --jq length`           |
| Milestones                   | **8**                             | `…/milestones?state=all&per_page=100 --jq length`                                |
| Releases                     | **5**                             | `…/releases?per_page=100 --jq length`                                            |
| Tags                         | **5**                             | `…/tags?per_page=100 --jq length`                                                |
| Actions runs (all / last 7d) | **1,400 / 934**                   | `…/actions/runs?created=>=2026-10-31 --jq .total_count`                          |

### 4.2 Governance

| Asset                         | Count / value                                                                                                                                                                                                                                                                                                                                                                                                      | Verification command                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Rulesets                      | **2**                                                                                                                                                                                                                                                                                                                                                                                                              | `gh api repos/riolabs-ai/alignsynch/rulesets --jq '.[]                   | {id,name}'` |
| → `26115314` "Status Checks"  | active, `~DEFAULT_BRANCH`; rules: `deletion`, `non_fast_forward`, `required_status_checks` (context `typecheck / lint / build`, strict, `integration_id` 15368 = GitHub Actions), `pull_request` (`required_approving_review_count: 1`, `require_code_owner_review: false`, `require_last_push_approval: false`), `required_linear_history`. Self-approval is refused by GitHub independently of these parameters. | `gh api repos/riolabs-ai/alignsynch/rulesets/26115314`                   |
| → `26350228` "Merge Queue"    | active, `~DEFAULT_BRANCH`; **deletion + non_fast_forward only — no `merge_queue` rule** (user-owned)                                                                                                                                                                                                                                                                                                               | `gh api repos/riolabs-ai/alignsynch/rulesets/26350228`                   |
| Allowed merge methods         | squash, rebase                                                                                                                                                                                                                                                                                                                                                                                                     | in the ruleset above                                                     |
| Classic branch protection     | **0** — 404                                                                                                                                                                                                                                                                                                                                                                                                        | `gh api repos/riolabs-ai/alignsynch/branches/main/protection`            |
| CODEOWNERS rules              | **5**                                                                                                                                                                                                                                                                                                                                                                                                              | `cat .github/CODEOWNERS`                                                 |
| Workflows                     | **4** active                                                                                                                                                                                                                                                                                                                                                                                                       | `gh api repos/riolabs-ai/alignsynch/actions/workflows --jq '.workflows[] | .name'`     |
| `merge_group` trigger present | **yes**                                                                                                                                                                                                                                                                                                                                                                                                            | `grep -n merge_group .github/workflows/ci.yml`                           |

### 4.3 Secrets, variables, environments, hooks

| Asset             | Count                                                                   | Verification command                                                          |
| ----------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Actions secrets   | **4** — `NEON_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `STAKEHOLDERS` | `gh api repos/riolabs-ai/alignsynch/actions/secrets --jq '[.secrets[].name]'` |
| Actions variables | **0**                                                                   | `…/actions/variables --jq .total_count`                                       |
| Environments      | **0**                                                                   | `…/environments --jq '.environments\|length'`                                 |
| Deploy keys       | **UNVERIFIED** (404 — admin-gated)                                      | `gh api repos/riolabs-ai/alignsynch/keys` _as admin_                          |
| Webhooks          | **UNVERIFIED** (404 — needs `admin:repo_hook`)                          | `gh auth refresh -s admin:repo_hook` then `…/hooks`                           |
| GitHub Apps       | **UNVERIFIED** (401 — needs app JWT)                                    | Settings → GitHub Apps                                                        |
| Packages          | **0**                                                                   | `gh api "users/riolabs-ai/packages?package_type=container" --jq length`       |

### 4.4 Security surface

| Asset                    | Count                                                                     | Verification command                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Secret-scanning alerts   | **UNVERIFIED** (404 — needs `security_events`; prior run recorded 2 open) | `gh auth refresh -s security_events && gh api "repos/riolabs-ai/alignsynch/secret-scanning/alerts?state=open" --jq length` |
| Dependabot alerts (open) | **0**                                                                     | `…/dependabot/alerts?state=open --jq length`                                                                               |
| Code scanning            | **0** (no analysis configured)                                            | `…/code-scanning/alerts`                                                                                                   |
| Security advisories      | **0**                                                                     | `…/security-advisories --jq length`                                                                                        |

### 4.5 Projects v2

| Property     | #6 "AlignSynch WebApp" (in scope)                | #5 "rio.stack" (out of scope) |
| ------------ | ------------------------------------------------ | ----------------------------- |
| Node id      | `PVT_kwHODRraYc4BpyJQ`                           | `PVT_kwHODRraYc4Bnz9S`        |
| Owner        | `riolabs-ai` **User**                            | `riolabs-ai` **User**         |
| Items        | **213** (58 issues, 155 PRs, 0 drafts)           | **19**                        |
| Fields       | **19** (Status has 5 options)                    | —                             |
| Views        | **6**                                            | —                             |
| Automations  | **7** enabled, incl. **#13 Auto-add to project** | —                             |
| Linked repos | **1** — `riolabs-ai/alignsynch`                  | —                             |

### 4.6 Checkouts

| Item                             | Count                           | Note                                                                      |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| Registered worktrees             | **150** (149 non-main)          | 119`~/.hermes/...`, 26 `.worktrees/`, 4 `/home/jadenblack/`, 1 `quizhub/` |
| Files containing the remote URL  | **1** (`<primary>/.git/config`) | 2 lines: `url` + `pushurl`                                                |
| Local branches / remote branches | 448 / 21                        | 448 is a cleanup opportunity, not a migration cost                        |

---

## 5. Permission matrix

| Action                          | `riolabs-ai` (admin, **no credential**) | `jadenblack` (write)       | New org owner (future)                     |
| ------------------------------- | --------------------------------------- | -------------------------- | ------------------------------------------ |
| Create the organization         | ✅ (as a person, web UI)                | ✅                         | n/a                                        |
| Read rulesets                   | ✅                                      | ✅ (read is public)        | ✅                                         |
| **Edit** rulesets               | ✅                                      | ❌                         | ✅                                         |
| Read Actions secrets (names)    | ✅                                      | ✅_(observed)_             | ✅                                         |
| Read deploy keys                | ✅                                      | ❌ 404                     | ✅                                         |
| Read webhooks                   | ✅                                      | ❌ 404 (scope)             | ✅                                         |
| Read secret-scanning alerts     | ✅                                      | ❌ 404 (scope)             | ✅                                         |
| **Transfer the repository out** | ✅                                      | ❌ **needs admin**         | ❌ (source-side permission is what counts) |
| Create a repo in the target org | n/a                                     | ⚠️ only once an owner      | ✅                                         |
| Push / open PRs                 | ✅                                      | ✅                         | ✅                                         |
| Approve `jadenblack`'s PRs      | ✅_(the design)_                        | ❌ self-approval forbidden | ✅                                         |
| Manage board #6                 | ✅                                      | ✅ (via `project` scope)   | n/a                                        |

---

## 6. Sequence

Every step names its checkpoint, verification command and rollback. Steps 1–2 are safe to run
today. **Step 3 is the irreversible one** — everything before it is reversible.

| #   | Step                                                                                                                                                                       | Checkpoint                                                                        | Verification                                                                                                                                                     | Rollback                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0   | **Capture the baseline** — dump rulesets, secrets names, alerts, project metadata to a file **outside the repo**                                                           | All 6 artifacts written                                                           | `ls -1 org-move-baseline/` shows `rulesets.json`, `secrets.json`, `project6.json`, `alerts.json`, `labels.json`, `milestones.json`                               | n/a (read-only)                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1   | **Create the org** (web UI, as `jadenblack`) — name `alignsynch-org`, plan Free, **base permission `write`**                                                               | Org exists, `jadenblack` is owner                                                 | `gh api users/alignsynch-org --jq .type` → `Organization`                                                                                                        | Abandon it. An empty org has no cost and no repo.                                                                                                                                                                                                                                                                                                                                                                              |
| 2   | **Add both identities** — invite `jadenblack` (already owner), invite `riolabs-ai` as **owner** and have it accept                                                         | Both listed as members                                                            | `gh api orgs/alignsynch-org/members --jq '.[].login'`                                                                                                            | Remove the member. No repo yet.                                                                                                                                                                                                                                                                                                                                                                                                |
| 3   | **TRANSFER** — as `riolabs-ai`: Settings → Danger Zone → Transfer → `alignsynch-org`. Or `gh api -X POST repos/riolabs-ai/alignsynch/transfer -f new_owner=alignsynch-org` | Transfer accepted                                                                 | `gh api repos/alignsynch-org/alignsynch --jq '{full_name,owner:.owner.login,visibility}'`                                                                        | ⚠️ **Treat as irreversible.** `riolabs-ai/alignsynch` is permanently retired (R2), so a transfer-back lands at the same retired `OWNER/REPO` combination and GitHub is documented to reject creation there — a back-transfer may therefore be **refused outright**. Rollback is re-pointing to a _differently named_ repo, not restoration. Do not start this step without the step-0 baseline and an explicit owner decision. |
| 4   | **Verify what travelled** — counts must match §4                                                                                                                           | 172 issues, 429 PRs, 16 labels, 8 milestones, 5 releases, 5 tags, 4 secrets       | the §7 block, run verbatim                                                                                                                                       | Nothing to roll back; a mismatch means step 3 lost data → escalate before proceeding                                                                                                                                                                                                                                                                                                                                           |
| 5   | **Verify governance** — rulesets present and still enforced                                                                                                                | 2 rulesets, both active                                                           | `gh api repos/alignsynch-org/alignsynch/rulesets --jq '.[]                                                                                                       | {id,name,enforcement}'`                                                                                                                                                                                                                                                                                                                                                                                                        | Re-`POST` from `org-move-baseline/rulesets.json`.**Do this before step 6** — a repo with no ruleset accepts any push. |
| 6   | **Repoint every checkout** — one command, both URLs                                                                                                                        | `git remote -v` shows the new owner in the primary **and** in 3 sampled worktrees | `git remote get-url origin && git remote get-url --push origin` (run in primary + 3 worktrees)                                                                   | `git remote set-url origin https://github.com/riolabs-ai/alignsynch.git` — the old URL still redirects, so this is safe until step 7                                                                                                                                                                                                                                                                                           |
| 7   | **Update the 10 code/doc files + regenerate parity goldens**                                                                                                               | Diff touches only the 10 files in §Q5 (+350 untouched CHANGELOG lines)            | `pnpm typecheck && pnpm parity && grep -rn "riolabs-ai/alignsynch" --exclude-dir=node_modules --exclude-dir=.worktrees --exclude-dir=.git \| grep -vc CHANGELOG` | `git revert` the single docs/refs commit                                                                                                                                                                                                                                                                                                                                                                                       |
| 8   | **Relink Vercel** — disconnect the Git integration from `riolabs-ai/alignsynch`, connect `alignsynch-org/alignsynch`                                                       | A push to `main` produces a production deployment                                 | `curl -s https://alignsynch.com/api/version \| jq -r .commit` matches `git rev-parse --short origin/main`                                                        | Reconnect the previous repo (`riolabs-ai/alignsynch` redirect still resolves)                                                                                                                                                                                                                                                                                                                                                  |
| 9   | **Rebuild or keep board #6** — decide §Q4 option 1 vs 2                                                                                                                    | If rebuilt: 213 items re-added, 19 fields, 6 views, 7 workflows                   | `gh api graphql -f query='{node(id:"<newId>"){...on ProjectV2{items{totalCount fields{totalCount} views{totalCount} workflows{totalCount}}}}}'`                  | The original board is untouched until you close it — keep it as the rollback                                                                                                                                                                                                                                                                                                                                                   |
| 10  | **Re-mint org credentials** — `gho_` for `riolabs-ai` on this host                                                                                                         | `gh-alt.sh api user --jq .login` → `riolabs-ai`                                   | `~/.hermes/profiles/alignsynch/bin/gh-alt.sh api user --jq .login`                                                                                               | `gh auth logout` the alt account                                                                                                                                                                                                                                                                                                                                                                                               |
| 11  | **Close out** — update `AGENTS.md`, `docs/GATE.md`, `gh-alt.sh` examples; confirm redirects                                                                                | 0 live stale slugs                                                                | `curl -sI https://github.com/riolabs-ai/alignsynch \| head -1` → `301`                                                                                           | Doc revert                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Do NOT attempt in step 3

- Do not create a **new repository or fork at `riolabs-ai/alignsynch`** afterwards — that deletes
  the redirect permanently (R3).
- Do not transfer before `jadenblack` is an **org member** — non-member issue assignees are cleared
  (R5).
- Do not transfer before the org's base permission is `write` — `jadenblack` would be demoted to
  `read` and every worker stops being able to push (R6).

---

## 7. Verification block a human can paste

```bash
# ── BEFORE (record) ────────────────────────────────────────────────────────────
ORG_OLD=riolabs-ai; ORG_NEW=alignsynch-org; REPO=alignsynch
mkdir -p org-move-baseline && cd org-move-baseline
gh api "repos/$ORG_OLD/$REPO/rulesets" > rulesets.json
gh api "repos/$ORG_OLD/$REPO/actions/secrets" > secrets.json
gh api "repos/$ORG_OLD/$REPO/labels?per_page=100" > labels.json
gh api "repos/$ORG_OLD/$REPO/milestones?state=all&per_page=100" > milestones.json
gh api "users/$ORG_OLD/projectsV2" > project6.json
for q in is:issue is:pr; do
  printf '%s %s\n' "$q" "$(gh api "search/issues?q=repo:$ORG_OLD/$REPO+$q" --jq .total_count)"
done
# expect: is:issue 172   is:pr 429

# ── AFTER (compare) ────────────────────────────────────────────────────────────
gh api "repos/$ORG_NEW/$REPO" --jq '{full_name,owner:.owner.type,visibility,license:.license.spdx_id}'
gh api "repos/$ORG_NEW/$REPO/rulesets" --jq '.[]|{id,name,enforcement}'        # expect 2, active
gh api "repos/$ORG_NEW/$REPO/actions/secrets" --jq '[.secrets[].name]'          # expect 4 names
gh api "repos/$ORG_NEW/$REPO/labels?per_page=100"          --jq length          # 16
gh api "repos/$ORG_NEW/$REPO/milestones?state=all&per_page=100" --jq length     # 8
gh api "repos/$ORG_NEW/$REPO/releases?per_page=100"        --jq length          # 5
gh api "repos/$ORG_NEW/$REPO/tags?per_page=100"            --jq length          # 5
for q in is:issue is:pr; do
  printf '%s %s\n' "$q" "$(gh api "search/issues?q=repo:$ORG_NEW/$REPO+$q" --jq .total_count)"
done
# expect: is:issue 172   is:pr 429

# ── Checkouts ──────────────────────────────────────────────────────────────────
cd /home/jadenblack/Desktop/dev.local/alignsynch/quizhub/quizhub
git remote get-url origin && git remote get-url --push origin
git worktree list | awk '{print $1}' | head -3 | while read -r w; do
  printf '%s -> %s\n' "$w" "$(git -C "$w" remote get-url origin)"
done

# ── Redirect intact ────────────────────────────────────────────────────────────
curl -sI "https://github.com/$ORG_OLD/$REPO" | head -1     # expect 301

# ── Board ──────────────────────────────────────────────────────────────────────
gh api graphql -f query='{node(id:"PVT_kwHODRraYc4BpyJQ"){...on ProjectV2{
  items{totalCount} fields{totalCount} views{totalCount} workflows{totalCount} repositories{totalCount}}}}'
# baseline: items 213, fields 19, views 6, workflows 7, repositories 1

# ── Credentials ────────────────────────────────────────────────────────────────
gh auth status                                    # jadenblack + riolabs-ai
~/.hermes/profiles/alignsynch/bin/gh-alt.sh api user --jq .login   # riolabs-ai
```

---

## 8. Risk register

Severity: **S1** blocks or destroys work · **S2** breaks a workflow, recoverable · **S3** cosmetic
or slow-burn.

| ID      | Risk                                                                                                                                                                   | Sev                        | Basis                                                                                                                                 | Mitigation                                                                                                                   | Cheapest test                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **R1**  | **No credential can perform the transfer.** `jadenblack` is `write`; transfer needs `admin`; `riolabs-ai` has no credential on this host                               | **S1**                     | Measured: `permissions.admin=false`; `gh-alt.sh` exit 78; docs: "you must have administrator access"                                  | Owner mints a `riolabs-ai` credential (A1) or clicks Transfer (A2). **This gates the entire plan.**                          | `gh-alt.sh api user --jq .login` — exit 78 means still blocked                                                           |
| **R2**  | **`riolabs-ai/alignsynch` is permanently retired** on transfer — "more than 100 uses of GitHub Actions in the week prior" retires the `OWNER/REPO` combination forever | **S1**                     | Documented + **measured 934 runs in 7 days** (9.3× threshold)                                                                         | Accept and plan for it: back-out is transfer-back, not recreate. Protects the redirect permanently.                          | Already settled — but confirm post-transfer that `POST /user/repos` with name `alignsynch` fails with "has been retired" |
| **R3**  | An operator recreates a repo/fork at `riolabs-ai/alignsynch`, **permanently deleting all redirects**                                                                   | **S1**                     | Documented: "If you create a new repository or fork at the previous repository location, the redirects … will be permanently deleted" | Never create anything at the old location. R2 makes this impossible anyway — belt and braces.                                | `curl -sI https://github.com/riolabs-ai/alignsynch \| head -1` → must stay `301`                                         |
| **R4**  | **Rulesets may not survive the transfer**                                                                                                                              | **S2**                     | **UNVERIFIED** — transfer docs silent; ruleset docs silent on ownership change                                                        | Capture `rulesets.json` in step 0; re-`POST` in step 5 **before** any push                                                   | post-transfer `gh api repos/<org>/alignsynch/rulesets --jq length` → 2                                                   |
| **R5**  | Issue assignees cleared because `jadenblack` is not an org member at transfer time                                                                                     | **S2**                     | Documented: personal→org keeps only assignees who are org members                                                                     | Step 2 (add members) strictly before step 3                                                                                  | `gh api "repos/<org>/alignsynch/issues?assignee=jadenblack&state=all" --jq length` before/after                          |
| **R6**  | Org base permission defaults to `read` → `jadenblack` loses push, every worker stalls                                                                                  | **S2**                     | Documented: "the organization's default repository permission settings … will apply"                                                  | Set base permission `write` at org creation (step 1)                                                                         | `gh api repos/<org>/alignsynch --jq .permissions.push` → true                                                            |
| **R7**  | 213 board items cannot be migrated; board either stays personal-owned or must be rebuilt                                                                               | **S2**                     | Measured: no transfer mutation; documented: copy drops items                                                                          | Choose §Q4 option 1 (keep) unless governance requires otherwise. Keep the original board until the rebuild verifies.         | `gh api graphql` workflow/item counts on the new board                                                                   |
| **R8**  | Parity goldens drift when `RELEASE_TAG` changes → CI red on `main`                                                                                                     | **S2**                     | Measured: 10 goldens contain `…/releases/tag/v1.4.0`; `PARITY_UPDATE=1` regenerates                                                   | Update the constant, `tests/app-version.test.ts` and goldens in **one** commit; run `pnpm parity` before pushing             | `pnpm parity` locally                                                                                                    |
| **R9**  | Vercel Git connection silently loses the repo; production stops deploying                                                                                              | **S2**                     | `docs/DEPLOYING.md:3` states the project builds this repo                                                                             | Relink in step 8; verify via `/api/version` commit match                                                                     | `curl -s https://alignsynch.com/api/version \| jq -r .commit` vs `git rev-parse --short origin/main`                     |
| **R10** | `26350228` "Merge Queue" ruleset stays a no-op if the `merge_queue` rule is never added                                                                                | **S2**                     | Measured: ruleset contains only `deletion` + `non_fast_forward`                                                                       | After transfer, add `merge_queue` to `26350228` — CI already handles `merge_group`                                           | `gh api repos/<org>/alignsynch/rules/branches/main --jq '[.[].type]'` must contain `merge_queue`                         |
| **R11** | Webhooks / deploy keys / GitHub Apps unknown; one may be the sole production trigger                                                                                   | **S2**                     | **UNVERIFIED** — all three 404 from `write` + `repo` scope                                                                            | Inventory in step 0 with admin + `admin:repo_hook`; re-verify after                                                          | `gh api repos/<org>/alignsynch/hooks` and `/keys` as admin                                                               |
| **R12** | Secret-scanning alert count unknown; possibly 2 open on a **public** repo                                                                                              | **S3→S1 if a live secret** | **UNVERIFIED** — 404 without `security_events`; a prior run recorded 2 open                                                           | Add `security_events` scope, enumerate, rotate anything live **before** the transfer so the new owner inherits a clean slate | `gh auth refresh -s security_events && gh api "repos/<r>/secret-scanning/alerts?state=open"`                             |
| **R13** | Org name `alignsynch-org` rejected at creation (reserved / confusingly similar)                                                                                        | **S3**                     | 404 today, but GitHub may still refuse                                                                                                | Four measured alternates: `alignsynch-ai`, `-app`, `alignsynchhq`, `-inc`                                                    | attempt creation; on refusal take the next                                                                               |
| **R14** | Someone claims `alignsynch` during the rename window if Option C is ever attempted                                                                                     | **S3**                     | Documented: no reservation, first-come                                                                                                | Do not attempt Option C                                                                                                      | n/a — avoided by decision                                                                                                |
| **R15** | 448 local branches confuse the post-move audit; stale worktrees point at deleted remotes                                                                               | **S3**                     | Measured: 448 local / 21 remote                                                                                                       | Out of migration scope; note as cleanup after step 6                                                                         | `git branch \| wc -l`                                                                                                    |
| **R16** | `CHANGELOG.md` rewritten by an over-eager find/replace — 350 lines of history churned                                                                                  | **S3**                     | Measured: 350 of 378 hits are in CHANGELOG                                                                                            | Explicitly exclude `CHANGELOG.md` from the ref update; redirects cover the links                                             | `git diff --stat CHANGELOG.md` → must be empty                                                                           |

---

## 9. Open questions and the test that settles each

| #   | Question                                                                 | Status                                                                                 | Cheapest test                                                                                                                        |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Do rulesets survive a user→org transfer?                                 | **UNVERIFIED**                                                                         | Transfer, then `gh api repos/<org>/alignsynch/rulesets --jq length`. Or rehearse on a throwaway public repo with a dummy ruleset.    |
| 2   | Does the `merge_queue` rule become settable immediately after transfer?  | **UNVERIFIED** (docs say the capability is org-public only; not tested on a fresh org) | `gh api -X POST repos/<org>/alignsynch/rulesets/<id>` adding `merge_queue`, then `gh api repos/<org>/alignsynch/rules/branches/main` |
| 3   | How many webhooks exist, and do any drive production?                    | **UNVERIFIED** — 404                                                                   | `gh auth refresh -s admin:repo_hook` → `gh api repos/<r>/hooks`                                                                      |
| 4   | How many deploy keys?                                                    | **UNVERIFIED** — 404                                                                   | as admin → `gh api repos/<r>/keys`                                                                                                   |
| 5   | Which GitHub Apps are installed?                                         | **UNVERIFIED** — 401                                                                   | Settings → GitHub Apps, or an app JWT                                                                                                |
| 6   | Are the 2 secret-scanning alerts real and still open?                    | **UNVERIFIED** — 404                                                                   | `gh auth refresh -s security_events` → list alerts, rotate anything live                                                             |
| 7   | Does the board's repository link survive the transfer, or silently drop? | **UNVERIFIED**                                                                         | post-transfer `gh api graphql … ProjectV2.repositories` → expect 1, now `alignsynch-org/alignsynch`                                  |
| 8   | Does Vercel's existing Git connection survive or silently break?         | **UNVERIFIED**                                                                         | push a no-op commit to `main`, watch `/api/version`                                                                                  |
| 9   | Are there deploy hooks? (`docs/DEPLOYING.md` claims none)                | **UNVERIFIED** — doc claim, not measured                                               | Vercel UI → Settings → Git → Deploy Hooks                                                                                            |

---

## 10. Provenance

Every `gh` output in this document was produced on 2026-11-07 from
`/home/jadenblack/Desktop/dev.local/alignsynch/quizhub/quizhub` (primary checkout, `main`
`91bade7f`) and `/tmp`, using the `jadenblack` `gho_` credential
(`gist, project, read:org, repo, workflow`). Docs were retrieved 2026-11-07; each claim names its
page. Items that could not be measured are marked **UNVERIFIED** and carry a test in §9 — none
were estimated, and none were inferred from a blog where a doc or an API call exists.

**Three claims from the brief were corrected against measurement** (§1 C1–C3) and **one count was
corrected** (124 → 149 non-main worktrees). The four corrections that matter for effort are:
the release tooling is already slug-agnostic, `package.json` needs no edit, the kanban keys do not
exist, and all 150 checkouts are repointed by editing one file twice.
