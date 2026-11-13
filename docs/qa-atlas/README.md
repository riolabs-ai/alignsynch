# QA atlas

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › QA atlas · prev [V1 retirement](../V1-RETIREMENT.md) · next [QA atlas — v1.17.0](v1.17.0/index.md)

<!-- docs-nav:end -->

One document per release that answers the question a hash cannot: **does every surface still render
the record it claims?**

`pnpm parity` hashes seven routes and the gate builds one. Neither notices a page that renders
beautifully and reads the wrong record — #936 did exactly that. So the atlas walks every route
`data/pages/budget.ts` registers through a real browser, at three widths, and asserts four things per
capture:

| assertion | how                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| status    | the response code against the brand boundary (`tests/parity/boundary.ts` + the page's own gate call) — `404` where the build does not claim the product               |
| console   | no console error, and React's hydration mismatch (`#418`) specifically                                                                                                |
| headline  | a heading string out of the route's own copy fixture is in the DOM — the words come from `data/pages/<surface>.ts`, so a page reading another record cannot show them |
| main      | a `main` subtree with real content under it, not an empty shell                                                                                                       |

A route that fails one is reported **as a failure in the atlas**, and its screenshot is kept as the
evidence of the failure.

## What is committed, and what is not

- **Committed:** 480 px WebP thumbnails, `manifest.json` and the markdown. The whole directory is
  held to **≤ 5 MB** by the check.
- **Not committed:** the full-size PNG set. `pnpm qa:atlas` packs them into
  `qa-atlas-v<version>-full-size.zip`, which is attached to that version's GitHub Release; the atlas
  page links it.

## Running a capture

The capture needs a running server and the demo branch's own rows, which is why it is **not** a gate
step. The static half is.

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"

# 1. the demo identities — the signed-in passes sign in as these, so a branch with no
#    demo_account row captures the public surfaces only and records the rest as skipped
DEMO_AUTH=1 pnpm db:seed:demo

# 2. a server carrying the demo branch's DATABASE_URL (withenv exports .env/.env.local)
~/.hermes/profiles/alignsynch/bin/withenv.sh <repo> bash -c \
  'cd <worktree> && export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH" BRAND=alignsynch &&
   exec pnpm dev --port 3411 --hostname 127.0.0.1'

# 3. the capture, in another shell
QA_ATLAS_BASE=http://127.0.0.1:3411 pnpm qa:atlas
```

Flags for iterating: `--only=<route>`, `--width=<n>`, `--role=<public|member|admin>`,
`--out=<dir>` (a dry run), `--no-zip`. The run refuses `NEON_BRANCH=production`, and refuses to start
when nothing answers on `/api/version` — reading and signing in against the wrong branch is the one
mistake this script will not make quietly.

## The check

```bash
pnpm qa:atlas:check
```

Static on purpose — no browser, no connection, nothing from `lib/db/**` — so it runs in the gate in
every lane. It fails, by route name, when:

- a route `data/pages/budget.ts` registers has no row in the current version's `manifest.json` (or the
  manifest carries a route the registry does not know);
- a row's `expected` status disagrees with the boundary table, or a capture whose measured status
  differs is reported as anything other than a `fail` — publishing a real mismatch is the atlas's job,
  filing it as a pass is the contradiction the check refuses;
- a failing row carries no measured reason;
- a row's thumbnail is missing;
- a skipped row carries no reason;
- the atlas directory is over the 5 MB budget;
- the manifest documents a different version than `package.json` carries.

Two files, no second route list: `scripts/qa-atlas-registry.mjs` derives the row set from
`data/pages/budget.ts` and reads the boundary out of `tests/parity/boundary.ts`;
`scripts/qa-atlas.mjs` captures and writes the document.

## Reading one

Each version directory holds `index.md` (the document), `manifest.json` (the machine-readable form the
check reads — not the markdown) and `thumbs/`. The index opens with the coverage line, then a row per
route: route · status · widths · thumbnail · verdict. The "changed this release" section diffs against
the previous atlas once there is one; the first atlas says so instead of showing an empty section.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › QA atlas · prev [V1 retirement](../V1-RETIREMENT.md) · next [QA atlas — v1.17.0](v1.17.0/index.md)

<!-- docs-nav:end -->
