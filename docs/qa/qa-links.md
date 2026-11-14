# QA links — the clickable local route list for any change range

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › QA links · prev [P4 dogfood pass](qa-dogfood-p4.md) · next [Rail collapse handle](rail-handle/README.md)

<!-- docs-nav:end -->

`pnpm qa:links [range]` prints every route a change range touches, as a checkbox list grouped by
the issue the change closes. It exists because the rule is now **always QA on local dev, with a
clickable list of the main UI / feature changes** (#863), and a list written by hand names the
screen the author remembers editing — not the three other routes that imported the component they
changed.

```bash
pnpm qa:links                          # origin/main...HEAD
pnpm qa:links 4861f176..610dfff2       # any git range
pnpm qa:links --pr 859                 # one pull request's own file list
pnpm qa:links --probe                  # fetch each link, append the status observed
pnpm qa:links --probe --server http://localhost:3001
```

It is an **authoring aid, not a gate step**: `scripts/verify.sh` does not run it, CI never calls it,
and nothing it prints can fail a build. Without `--probe` it reads the tree and git only — no
server, no network, no database.

## Where the routes come from

Three derivations, in this order, all from the tree:

| the change                                                | the rule                                                                                                                                                                 | example                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| a `page.tsx` under `app/**`                               | the route **is** the file: strip `app/` and every group, keep dynamic segments as written                                                                                | `app/(marketing)/page.tsx` → `/`                         |
| a `layout.tsx` under `app/**`                             | Next applies a layout to its **subtree**, so the routes are the pages beneath it                                                                                         | `app/(mainlayout)/layout.tsx` → every page in the shell  |
| a module under `components/`, `lib/`, `data/`, `content/` | the routes whose `page.tsx` transitively **value-imports** it (`scripts/module-reach.ts`, which reuses `scripts/client-graph.ts`'s parser and resolver — E34's own walk) | `components/dashboard/earnings-chart.tsx` → `/dashboard` |
| a fixture under `data/pages/`                             | the surface row in `data/pages/budget.ts`, which names the page it serves                                                                                                | `data/pages/admin-audit.ts` → `/admin/audit`             |

`import type` is not a reach: it is erased before anything is bundled, so a page that type-imports
a module does not render it.

### A screen, or the layer every screen stands on

The second row is exact, and exact is sometimes useless: this tree's pages all value-import
`content/brand.ts` and `data/media.ts`, so any edit to those reaches most of the app. A list of 62
checkboxes is not a QA list, and dropping them silently would be worse — a brand-token change really
does restyle every screen. So a changed module is printed one of two ways, and which one is a
measured count rather than a judgement:

- **at most 12 routes** (`SHARED_REACH_LIMIT`) — it is a screen: one checkbox per route.
- **more than 12** — it is infrastructure: one `shared:` line naming the module and how many of the
  tree's routes reach it, and no checkboxes.

Measured on this tree at #863: a home band reaches 1 route, the create flow's fixture 5, its draft
store 20, `data/billing-plans.ts` 28, `content/brand.ts` 48, `data/media.ts` 53 of 90 — the limit
sits in the gap between a shared screen and a shared layer.

## What clicking a link costs

Every link carries its auth class, from the same policy `lib/auth/require-role.ts::roleAnswerFor()`
enforces:

| badge                            | meaning                                                                                             |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `public`                         | renders for anyone                                                                                  |
| `member — sign in first`         | a signed-out request is answered with `/login?next=…`                                               |
| `admin — 404 as a member`        | a member gets the 404 an unknown URL gets — marked, because clicking one as a member reads as a bug |
| `quiz-only — 404 on this brand`  | the quiz product's routes, closed on the AlignSynch build by `requireQuizProduct()`                 |
| `dynamic — substitute a real id` | the route has a `[segment]`; the manifest spells it that way, and this tool will not invent an id   |

`tests/qa-links.test.ts` holds the table against the tree: every page that calls `requireAdmin()` (or
asks for the `support` rung) must be classified `admin`, every `requireRole("member")` page must be
`member`, and the quiz-only marker must cover exactly the pages that call `requireQuizProduct()`.

## `--probe`, and the `127.0.0.1` trap

`--probe` fetches each URL and appends the status observed (`200`, `307 → /login`, `404`). If nothing
is listening it says so once and prints the same list without statuses, exit 0.

The default server is **`http://localhost:3001`**, not `127.0.0.1`: Neon Auth's trusted domains
answer `127.0.0.1` with `403 INVALID_ORIGIN`, so every row would look broken for a reason that has
nothing to do with the app. Start the app on that port before probing:

```bash
pnpm dev --port 3001
pnpm qa:links --probe
```

## A real run

```console
$ pnpm qa:links 4861f176..610dfff2
qa:links · 4861f176..610dfff2 · 2 commits · 56 files changed · http://localhost:3001

## #835 — 5 routes · 14 files
- [ ] http://localhost:3001/templates/relationship/[slug]/create — public · dynamic — substitute a real id · via data/pages/assessment-create.ts
- [ ] http://localhost:3001/templates/relationship/[slug]/create/aspects — public · dynamic — substitute a real id · via data/pages/assessment-create.ts
- [ ] http://localhost:3001/templates/relationship/[slug]/create/commit — public · dynamic — substitute a real id · via data/pages/assessment-create.ts
- [ ] http://localhost:3001/templates/relationship/[slug]/create/invite — public · dynamic — substitute a real id
- [ ] http://localhost:3001/templates/relationship/[slug]/create/mode — public · dynamic — substitute a real id · via data/pages/assessment-create.ts
- shared: `data/billing-plans.ts` reaches 28 of 90 routes — every screen it lands on; spot-check one per surface
- shared: `lib/billing/entitlements.ts` reaches 22 of 90 routes — every screen it lands on; spot-check one per surface
- shared: `lib/flow/store.ts` reaches 20 of 90 routes — every screen it lands on; spot-check one per surface

## #853 — 1 route · 42 files
- [ ] http://localhost:3001/ — public
- shared: `content/brand.ts` reaches 90 of 90 routes — every screen it lands on; spot-check one per surface
- shared: `data/brands/alignsynch.ts` reaches 90 of 90 routes — every screen it lands on; spot-check one per surface

— not a route — no QA link
- `app/globals.css` (#853) — global — every route renders through it; no single link
- `docs/reference/billing.md` (#835) — documentation
- `tests/billing-gate.test.ts` (#835) — a test
...

auth: public = renders for anyone
quiz-only = the product's flag is off on this build; the route answers 404

2 groups · 6 routes · 33 files with no QA link
```

## Exit codes, and the one thing that fails

| exit | when                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | the list printed — including when nothing in the range reaches a route                                                                       |
| 1    | a changed page serves a route `content/routes.ts` does not carry (the file and the route are named); or `--pr` / the range could not be read |

A route is only ever printed when the manifest carries it, so a generated list cannot contain a URL
that 404s. The exit-1 case is the same drift `pnpm data:check` **E10** fails on — a page added
without a manifest row — reported here because it is what would otherwise put a dead link on a QA
list.

Files that reach no route are printed with a reason (`a test`, `documentation`, `global — every route
renders through it`, `a module no page reaches`) and do not affect the exit code. A deleted file is
listed under `— removed —`: there is nothing to click, but the range did touch a surface.

## Limits

- **It does not know which route a _behaviour_ would break.** A change to `lib/billing/entitlements.ts`
  reaches 22 routes; the list says so and stops there. Which of them proves the change is the
  reviewer's question.
- **It cannot resolve a dynamic segment.** `/assessment/[slug]` is printed as written; substitute a
  real id from a seeded row.
- **It reads imports, not props.** A component reached through a dynamic `import()` is found
  (`moduleImports` treats it as a runtime edge); a component a server action renders is not.
- **`--pr` needs `gh`** and a networked shell; a plain range needs neither.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › QA links · prev [P4 dogfood pass](qa-dogfood-p4.md) · next [Rail collapse handle](rail-handle/README.md)

<!-- docs-nav:end -->
