# Comments mockup, both placements (#921)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Comments mockup, both placements · prev [Brand lockup](../qa-brand-lockup/README.md) · next [Contact landing](../qa-contact-land/README.md)

<!-- docs-nav:end -->

The stills for the mockup phase of **#921** — the comment feature drawn before it is specified:
one thread component on three subjects (an Aspect opinion, a session summary, a relationship), in
two placements (**A** inline under the subject, **B** in a panel beside it).

The drawing is the review artifact, not a screen:
`docs/review/artifacts/prototype-comments-v1.html`, reachable at
`/admin/review?artifact=prototype-comments-v1`. Nothing in the feature is built — no schema, no
migration, no server action, no `lib/db/` change. The artifact _is_ the deliverable, and these are
pictures of it.

| File                                       | Frame                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `comments-1440-variant-a.png`              | 1440 · variant A · Aspect opinion — all seven states, thread inline       |
| `comments-1440-variant-b.png`              | 1440 · variant B · Aspect opinion — the same states, panel beside         |
| `comments-390-long-body.png`               | 390 · variant A · long body and long author name, wrapping                |
| `comments-1440-variant-a-assessment.png`   | 1440 · variant A · the session summary (verdict band, Gap, table)         |
| `comments-1440-variant-a-relationship.png` | 1440 · variant A · the relationship detail (two parties, shared sessions) |

## How they were taken

No Playwright in this tree. `stills.mjs` drives **headless Chrome over CDP**, the same plumbing as
`docs/qa-873/stills.mjs`, and it needs no server, no cookies and no database: the artifact is a
standalone document, so the shutter opens on `file://<the committed file>` at the address a reviewer
would use.

```bash
node docs/qa-comments-mockup/stills.mjs          # writes the five frames and capture-report.json
```

The artifact carries its own state in the query string (`?variant=A|B&subject=opinion|assessment|relationship&viewport=1440|390&spec=<specimen>`),
which is why the capture and the page the owner clicks are the same document rather than two builds
of it. `spec=` narrows the drawing to one specimen — the 390 frame uses `spec=long` for that reason.

## Asserted before every shutter

- the `<h1>` is the artifact's, so a blank or half-rendered frame cannot pass as a capture;
- `window.innerWidth` is the width asked for, and `document.scrollWidth` equals it — **no horizontal
  overflow**, which is the whole point of the 390 frame;
- no `.card`, `.comment`, `.cbody`, `.ctext` or `.cname` has `scrollWidth > clientWidth` (a long
  author name or an unbroken identifier is where that would show up);
- `data-vw`, `data-variant` and `data-subject` are the drawing asked for, and the specimen count is
  the one the address implies.

`capture-report.json` is the harness's own record of those readings, one entry per frame.

## The page itself: the live check

A unit test proves the route and the manifest; it cannot prove the page. `live-check.mjs` signs in
as the seeded demo admin through the app's own `/api/auth/sign-in/email` and reads two addresses:

```bash
pnpm db:seed --review                                  # the shelf reads review_artifact, not the fixture
pnpm exec next dev --turbo -p 3007                     # on the demo branch
node docs/qa-comments-mockup/live-check.mjs http://127.0.0.1:3007
```

```
known   /admin/review?artifact=prototype-comments-v1             → 200
unknown /admin/review?artifact=prototype-comments-does-not-exist → 404
```

The 200 on its own proves nothing — a page that answered 200 for anything would say nothing about the
new row. The pair is the proof: the id the catalogue carries renders with the artifact's title, its
`/review-artifacts/prototype-comments-v1` frame and the manifest's `lookFor` line in the HTML, and an
id it does not carry is the 404 a mistyped link gets. `live-check.json` is the reading.

Two things that bite here, both recorded elsewhere first: a sign-in that sends an `origin` header is
refused `403 INVALID_ORIGIN` by the branch's trusted-domain list (`docs/qa-stage5`), and no `origin`
header is what `scripts/flow-e2e.mjs` already does.


## Reading the drawing

- **Variant A** puts the thread inside the subject's card, under a rule — the subject scrolls away
  as the thread grows.
- **Variant B** puts it in a panel beside the subject (a sticky rail at 1440, a sheet under the
  subject at 390), so the thing being discussed stays in view.
- **The affordances are drawn, not chosen.** The reader's own comment appears three times — none,
  edit, edit + delete — because whether this feature has votes, edits or deletes is the owner's
  decision. The quiz comment's report flag, vote and reply controls are drawn on the peer rows.
- **Placeholders are marked.** A dotted-underlined string is copy that does not exist in the app
  yet; every comment body says _Placeholder body_ for the same reason. The artifact's Provenance
  panel lists every string with its source and its status.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Comments mockup, both placements · prev [Brand lockup](../qa-brand-lockup/README.md) · next [Contact landing](../qa-contact-land/README.md)

<!-- docs-nav:end -->
