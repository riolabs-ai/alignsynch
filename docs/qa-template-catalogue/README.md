# Template catalogue — the pages, looked at

Four screenshots from the AlignSynch build (`BRAND=alignsynch pnpm build`, `next start` on
`:3137`), captured at 1440×900 and 390×844 through Chrome's device emulation. They exist because
a string assertion cannot tell you what a 27-type catalogue looks like: the markup can be right
and the page can still read as a wall of repeated chips.

| file                          | what it is                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `templates-1440.png`          | `/assessment/templates`, whole catalogue: 28 cards in 8 groups, desktop        |
| `templates-1440-filtered.png` | the same page with `?realm=Home` applied — 10 cards, count line moved, desktop |
| `templates-390.png`           | the whole catalogue at phone width                                             |
| `templates-390-filtered.png`  | `?realm=Home` at phone width — no horizontal overflow at either width          |

## `/assessment/templates` needs a session, and these shots do not enter one

The route answers `307` to `/login` for any request without a session
(`lib/auth/session.ts::currentUser`), which is the correct answer for a visitor and the wrong one
for a screenshot. There is no credential to type here and none was manufactured, so the shots come
from a throwaway `/preview/templates` route that mounted **the same `TemplateLibrary` component**
the page mounts, with **the same props the page computes** — the fixture's templates as
`LibraryTemplate` rows, run through `filterLibrary`, `templatesInRealm`, `libraryStateOf` and
`groupCountsOf` in the page's own order — inside the real `(mainlayout)` chrome. The route was
deleted before the commit; `git log --diff-filter=D` on the branch has it.

What that proves: the layout, the filter row, the count line, the realm headings, and the card
anatomy at both widths. What it does not prove: the database read underneath the page, which
`tests/template-catalogue.test.ts` drives with a mocked session and a mocked read.

## What the shots decided

The first capture (of the tree preserved at `90afde25`) showed 28 cards each carrying two chip rows
and a three-line admin stanza: the relationship type repeated the title, the realm repeated the
heading above it, and `0 instances · Created Oct 29, 2026` / `Duplicate` / `Published` repeated 28
times. At 1440 that was 6,646 px of scroll. The committed card drops the two repeating chips (the
realm stays on the card as `data-template-card-realm`), the admin stanza appears only when it says
something, the realm headings carry their counts, and a count line states how many cards the
filter is showing. The page is 5,804 px at 1440 and no card is taller than its row's neighbours
(`flex h-full flex-col` on the shell, `mt-auto` on the action row).

The one deliberate asymmetry left is `Parent & Child`, whose summary is longer than the 27 derived
records': it is the hand-authored starter template from #409, and rewriting its copy is not this
card's business.
