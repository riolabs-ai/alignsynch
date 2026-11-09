# Prototype copy: saving a reviewer's edits into the repository

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Reference** › Prototype copy saves · prev [V1 prototype](V1-PROTOTYPE.md)

<!-- docs-nav:end -->

The review artifact (`docs/review/artifacts/prototype-relationship-lifecycle-v7.html`) is a
self-contained page with an **Edit copy** mode: a reviewer turns it on, types over any string, and the
page keeps their words in `localStorage`. That was the end of the line — the edits lived in one
browser profile, and the only way out was a JSON download that an embedded preview pane swallows. The
words a reviewer typed had to be recovered from `localStorage` by hand before anything could be built.

`Save .json` now writes them into the repository.

## Why a local service, and not a download

A browser cannot write to a repository. `file://` downloads do not land anywhere useful inside a
preview pane, and a commit from a page is not a thing that exists. So the page POSTs its copy tree to a
sink that runs on the machine the reviewer is already on:

```bash
pnpm prototype:save          # http://127.0.0.1:8791, loopback only
```

It binds `127.0.0.1`, takes no write path from the request, and refuses a page name that is not a file
in `docs/review/artifacts/`. Nothing it does is reachable from off the machine, and it needs no
credential.

With the sink down the button still works — it exports the JSON exactly as it did before, and the
toast says the sink was not running and how to start it. A save that silently did nothing would be
worse than the download it replaced.

## What one save writes

| Artefact                                        | What it is                                                                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| the page itself                                 | its `DEFAULT_COPY` literal, rewritten **value by value** for the keys that changed                      |
| `prototype-relationship-lifecycle-v7.copy.json` | the whole copy tree exactly as saved, plus the Aspect list                                              |
| `PROTOTYPE-CHANGES.md`                          | an append-only log: one dated section per save, every changed key with its old value beside its new one |

The page is rewritten key by key rather than as a whole literal, because the copy block carries
provenance comments between its entries and a whole-literal rewrite deletes them. Only keys whose
value moved are touched, so the page's diff is exactly the reviewer's edit.

**Both the read and the rewrite are scoped to the `DEFAULT_COPY` literal.** This is not tidiness. The
page is full of `"key": "otherKey"` pairs outside that literal — `isGallery ? "s1.galleryNote" :
"s1.dashboardNote"` reads as one — and an unscoped scan diffed every key against the _name_ of its
fallback and then rewrote the ternary. Measured: nine nonsense rows in the change log and two wrong
values in the page, caught by reading the diff before committing it.

## What the implementation reads

`PROTOTYPE-CHANGES.md` is the handover. Each row is a string the reviewer changed, with what it said
before, so the implementing card can move it into `data/pages/*` — the fixtures the build renders —
rather than reading it out of the artifact. The key's prefix names the screen it reaches: `s4.` Details,
`s5.` Settings, `s6.` Aspects, `s7.` Invite, `s8.`/`s9.` Connect, `s10.` the dashboard's relationship,
`s11.` the report.

A save with no differences writes "No copy differs from the committed page" rather than an empty
table, so a press of the button is always visible in the log and never looks like a lost save.

## Verifying it without a reviewer

```bash
node scripts/prototype-save.mjs --once <payload.json> --dry-run   # reports the diff, writes nothing
```

`--once` writes one payload and exits; `--dry-run` prints the summary — how many keys moved, how many
were added or removed — against the page on disk. That is how the scoping bug above was found: a
payload carrying one edited key must report exactly one change, never nine.

## Limits

- **It saves one page.** The sink's page is named in the request and validated against
  `docs/review/artifacts/`; there is no directory walk.
- **It does not commit.** A save writes files; landing them is a normal branch and PR, which is what
  keeps the copy changes reviewable in `git diff`.
- **`localStorage` still shadows the file.** The page reads its saved copy from `localStorage` over
  `DEFAULT_COPY`, and the save diffs against the _file_, not the browser — so an older override cannot
  be reported as a new change, but it will keep rendering until it is saved once or the `STORE` key is
  bumped.

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Reference** › Prototype copy saves · prev [V1 prototype](V1-PROTOTYPE.md)

<!-- docs-nav:end -->
