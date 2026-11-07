# Current screenshots — the registry

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Screenshot registry · next [P1 migration](../../p1-migration/MIGRATION.md)

<!-- docs-nav:end -->

`docs/` holds ~330 images, almost all of them `qa-*/` before/after pairs captured for the ticket that
changed a screen. Those are evidence for their own tickets: they show a layout that was under
discussion, and several of them show a layout the product no longer has. **Nothing there tells a
reader what the product looks like now.**

This directory is that answer. One row per surface, one file per row, captured from the code the
commit names:

- `docs/assets/screens/quizhub/{desktop,mobile}/` — the QuizHub build (`BRAND=quizhub`)
- `docs/assets/screens/alignsynch/{desktop,mobile}/` — the AlignSynch build (`BRAND=alignsynch`)
- `docs/assets/og-image.png` — the 1200×630 share card (see [The share card](#the-share-card))

A surface appears under a brand only when that brand renders it: `/explore` and a quiz in play are
the quiz product's routes and answer `404` on an AlignSynch build (`lib/brand-boundary.ts`), so they
have QuizHub rows and no AlignSynch row. The member surfaces render under both brands, because the
chrome is shared and only its copy and colour differ.

## The current set

Captured **2026-11-07** at `bcc3bd66` (the `app/`, `components/`, `lib/` and `data/` trees at
`46900371` are identical — everything merged between them is under `docs/wiki/`). Viewports are
`1440×900` (desktop) and `390×844` (mobile), device scale factor 1, viewport only: a page taller than
the frame is cut at the fold, deliberately, so every file in a directory is the same size.

| surface                         | route                                           | brand      | viewport | file                                   | captured   | commit     |
| ------------------------------- | ----------------------------------------------- | ---------- | -------- | -------------------------------------- | ---------- | ---------- |
| home                            | `/`                                             | AlignSynch | desktop  | `alignsynch/desktop/home.png`          | 2026-11-07 | `bcc3bd66` |
| home                            | `/`                                             | AlignSynch | mobile   | `alignsynch/mobile/home.png`           | 2026-11-07 | `bcc3bd66` |
| login                           | `/login`                                        | AlignSynch | desktop  | `alignsynch/desktop/login.png`         | 2026-11-07 | `bcc3bd66` |
| dashboard, member rail (#620)   | `/dashboard`                                    | AlignSynch | desktop  | `alignsynch/desktop/dashboard.png`     | 2026-11-07 | `bcc3bd66` |
| dashboard, member rail (#620)   | `/dashboard`                                    | AlignSynch | mobile   | `alignsynch/mobile/dashboard.png`      | 2026-11-07 | `bcc3bd66` |
| relationship card + edit (#642) | `/dashboard/relationships/<id>`                 | AlignSynch | desktop  | `alignsynch/desktop/relationship.png`  | 2026-11-07 | `bcc3bd66` |
| relationship card + edit (#642) | `/dashboard/relationships/<id>`                 | AlignSynch | mobile   | `alignsynch/mobile/relationship.png`   | 2026-11-07 | `bcc3bd66` |
| admin console                   | `/admin/console`                                | AlignSynch | desktop  | `alignsynch/desktop/admin-console.png` | 2026-11-07 | `bcc3bd66` |
| admin console                   | `/admin/console`                                | AlignSynch | mobile   | `alignsynch/mobile/admin-console.png`  | 2026-11-07 | `bcc3bd66` |
| home                            | `/`                                             | QuizHub    | desktop  | `quizhub/desktop/home.png`             | 2026-11-07 | `bcc3bd66` |
| home                            | `/`                                             | QuizHub    | mobile   | `quizhub/mobile/home.png`              | 2026-11-07 | `bcc3bd66` |
| login                           | `/login`                                        | QuizHub    | desktop  | `quizhub/desktop/login.png`            | 2026-11-07 | `bcc3bd66` |
| explore                         | `/explore`                                      | QuizHub    | desktop  | `quizhub/desktop/explore.png`          | 2026-11-07 | `bcc3bd66` |
| explore                         | `/explore`                                      | QuizHub    | mobile   | `quizhub/mobile/explore.png`           | 2026-11-07 | `bcc3bd66` |
| quiz detail                     | `/quiz/quiz-ultimate-world-history-trivia`      | QuizHub    | desktop  | `quizhub/desktop/quiz.png`             | 2026-11-07 | `bcc3bd66` |
| a quiz in play                  | `/quiz/quiz-ultimate-world-history-trivia/play` | QuizHub    | desktop  | `quizhub/desktop/quiz-play.png`        | 2026-11-07 | `bcc3bd66` |
| a quiz in play                  | `/quiz/quiz-ultimate-world-history-trivia/play` | QuizHub    | mobile   | `quizhub/mobile/quiz-play.png`         | 2026-11-07 | `bcc3bd66` |
| dashboard, member rail (#620)   | `/dashboard`                                    | QuizHub    | desktop  | `quizhub/desktop/dashboard.png`        | 2026-11-07 | `bcc3bd66` |
| dashboard, member rail (#620)   | `/dashboard`                                    | QuizHub    | mobile   | `quizhub/mobile/dashboard.png`         | 2026-11-07 | `bcc3bd66` |

`<id>` is a relationship's own id. The capture used one started through the shipped create step on the
demo branch, with the demo dataset's names (`Avery Quinn`, `Rowan Hale`,
`rowan.hale@demo.alignsynch.test` — the reserved `.test` domain, which cannot receive mail). It is a
draft, so no invitation was minted and no token appears in the frame; publishing is what mints one.

## The share card

`docs/assets/og-image.png` — **1200×630**, which is 1.91:1: the one aspect ratio neither Facebook's
`og:image` nor Twitter's `summary_large_image` crops. It is not drawn by hand. The card is
`app/opengraph-image.tsx`, which is four lines of wiring around `lib/brand-og.tsx`, and every colour
on it is read from `data/brand.ts`, so the committed file is a **render of the route** rather than a
second design to keep in step:

```bash
# against a running AlignSynch build
curl -s http://localhost:3000/opengraph-image.png -o docs/assets/og-image.png
```

Re-render it whenever `data/brand.ts` or `lib/brand-og.tsx` changes — the file is a snapshot, and the
route is the thing crawlers are served. `docs/assets/og_image.png` was the same bytes under a second
name; it is deleted rather than kept as a copy, and the root `README.md` now points at this one.
`docs/qa-og-card/` keeps the ticket's own evidence (including a 600×315 render) and is not promoted.

## How these were captured

No new dependency: Chrome headless over the DevTools protocol, against a **local production build** of
one brand at a time (the dev overlay's badge would be in every frame).

```bash
# 1. a build of the brand, and a server on the dev origin the auth server trusts
withenv.sh <repo> bash -c 'BRAND=alignsynch node24.sh pnpm build'
PORT=3000 withenv.sh <repo> node24.sh pnpm start

# 2. signed-out surfaces: /, /login, /explore, a quiz in play
#    (the driver sets Emulation.setDeviceMetricsOverride to 1440x900 or 390x844 and calls
#     Page.captureScreenshot — one file per row above)

# 3. member surfaces: sign in through the demo gate, never with a real credential
#    /demo  ->  the PIN (DEMO_PIN)  ->  /login  ->  a role button  ->  /dashboard
```

The demo sign-in is `docs/DEMO-AUTH.md`: `/demo` takes a PIN and sets a signed fifteen-minute unlock
cookie; `/login` then draws one button per seeded account, and the server signs in with a credential
the browser never receives. **The demo stack is the only stack these are captured from**
(`NEON_BRANCH=demo`, `DEMO_AUTH=1`): the production branch holds real client relationships, and a
screenshot is the wrong place to discover that. Every name and address in these files is from
`data/bundles/demo-dataset.alignsynch.json` (`Avery Quinn`, `Rowan Hale`, `@demo.alignsynch.test`).

## What holds the registry honest

`tests/docs-screens-registry.test.ts` runs in `pnpm test` and asserts three things: every file listed
above exists, every promoted file is listed above, and each one's real PNG dimensions match what its
row claims — `1440×900` in `desktop/`, `390×844` in `mobile/`, `1200×630` for the share card. A row
pointing at a missing image, a file nobody registered, or a mobile shot filed under `desktop/` is a
red test rather than a broken link somebody finds later.

## Not here, on purpose

- `docs/qa-*/` — per-ticket before/after evidence. Left untouched: those frames exist to show what a
  change did, and promoting one would turn a picture of a proposal into a picture of the product.
- `docs/assets/screens/brand-marks/` — the header and footer lockup evidence from #470, four crops
  rather than surfaces. Unchanged by this set.
- Anything dated after the commit in its row. If a screen has moved since, the row is stale and the
  fix is a new capture, not a new paragraph.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Records & QA** › Screenshot registry · next [P1 migration](../../p1-migration/MIGRATION.md)

<!-- docs-nav:end -->
