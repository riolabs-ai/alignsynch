# The template doctrine — one core, many expressions

Owner statement, 2026-10-31, verbatim:

> "we will use or reuse all UI surfaces in extending the base core webapp, and this template and other
> with quiz and form based interactivity. just for vision context to codify when deciding new
> functionality for AlignSynch."

This page turns that into a decision rule. It is normative: a card that adds a screen answers the three
questions below before it writes a component, and a card that cannot answer them says so in its handoff
instead of guessing.

Two worked tables of the answer, per file: [UI-DIVERGENCE.md](UI-DIVERGENCE.md) audits every bespoke surface, and [UI-MAPPING.md](UI-MAPPING.md) maps every quiz ancestor to its AlignSynch variation with the measured mobile mechanics.

## This repo is a base core webapp

AlignSynch is one expression of the core. QuizHub is the second: one route table, one `components/ui`,
one `lib/`, configured by `data/brand.ts` and the `BRAND` variable, with `pnpm parity` hashing seven
routes under both brands so neither moves without the other noticing. The form-based interactivity the
owner names — a questionnaire in, an answer out — is the third, not built yet.

The core is the product. A template is a configuration of it: a brand record, a copy fixture set, and
the subset of the catalogue its product story claims. That is why `data/brand.ts` swaps a record and
not a page, and why the registry's `templates` field is a scope decision rather than a render fact.

A feature therefore lands in the core or it does not land. A screen only one expression can ever use is
a screen the next expression has to rebuild, and the second one is always cheaper than the third.

## Every UI surface is a catalogue asset

`docs/ui-registry.md` is the catalogue, regenerated and checked on every gate run: **45 routes** and
**33 component domains** (237 files under `components/`) as of this writing, each with a `status`, the
templates that claim it, a `capability` sentence and an optional `notes`.

Nothing is deleted for being unused by the current brand. `/chat` is the standing example: a
conversation list, a thread, a composer and a conversation search over `data/chat-data.ts`, claimed by
no template, and deliberately kept — `components/chat` and `/chat` sit under _No template yet_ with the
note that says why. Deleting it would delete the messaging story for whichever expression wants it next.

**Adoption cost is recorded, not guessed.** The judgement half of the registry (`data/ui-registry.ts`,
#173) carries three facts per surface, and the gate checks the one that is checkable against the tree:

- `status` — `mock`, `fixture`, `db` or `live`: how far the surface is from real data. `db` must reach
  `lib/db/`, `live` must reach an `/api` write, `fixture` must reach `data/`, and `mock` must reach
  neither a database module nor a record fixture.
- `capability` — what the surface does, in one sentence, so the next person picks it without reading
  it.
- `notes` — what a future template would have to pay. The registry's own example of a real note is
  "no route imports this domain since #164"; the ones that matter here say the numbers are literals,
  the empty state is unwritten, or the write path is missing.

The bijection is enforced in both directions: a new component domain or route without an entry fails
the gate, and an entry whose surface is gone fails too. `pnpm ui:registry` writes the page; no half of
it is hand-edited.

## New functionality is decided in this order

**1. Which existing surface is the template for this screen? Name the file.**

Not "which pattern", not "something like the dashboard": the file. A second list screen is
`components/my-quizzes/` and `app/(mainlayout)/my-quizzes/page.tsx` before it is anything new; a second
detail view is `components/profile` or the article page under `app/(mainlayout)/news/[slug]/`. The
answer is a path a reviewer can open, and a card that cannot name one has answered question 3 by
accident.

**2. What is the variation? Name the axis that changes.**

| axis         | what changes                                                |
| ------------ | ----------------------------------------------------------- |
| columns      | which fields the row or card carries                        |
| filters      | what narrows the set, and where the control lives           |
| row actions  | what a row offers beside opening it                         |
| empty state  | what the screen says with no records                        |
| detail panel | whether the record opens beside the list or on its own page |
| data source  | fixture, database or live write — the `status` axis         |

One axis is a configuration of an existing surface. Several at once, or an axis that turns out to be a
different object, is a new surface — go to 3.

**3. Only if nothing fits: propose the generic version, and name it generically.**

Name the surface for what it does, not for the brand that asked for it: `components/leaderboard`, not a
quiz-winners panel; a record list, not an aspect table. Then say where it belongs — a domain under
`components/<feature>/` plus a route under `app/(mainlayout)/` — and register it with `templates: []`
and a `notes` line naming the expression that prompted it. The page groups it under _No template yet_,
which is where a candidate for the next vertical starts its life, and the next expression picks it up
instead of rebuilding it.

An AlignSynch noun in a component's name or props is the signal that question 3 was skipped.

## The schema already thinks this way

`content/record.ts` is one root type for both products: a `record` holding `item`s, and an `opinion` per
item per party (`content/assessment.ts`). Those nouns are deliberately generic, and the alignment
product's vocabulary is a layer over them rather than a second model:

- "aspect" is an `item`; an item's id is `aspect-<name>`.
- "gap" is a function, `gapOf(left, right)` returning 0..4 — never a column. `db:migrate` and
  `db:verify` both fail on a `gap` column, table, view or generated column.
- the eight named gaps in `content/gaps.ts` are pairs of `opinion`s, built from the four opinion kinds
  `feel` / `wish` / `think` / `guess`. "In Synch" is `0`.

A field named for the alignment product would have made the quiz template a copy of it. The UI is held
to the same discipline: the shared component names the capability, and the brand supplies its
configuration.

## Three things this repo calls a template

Worth stating because the word is overloaded, and a card that confuses them asks the wrong question:

- **a product expression** — AlignSynch, QuizHub, a future form-based product. This page.
- **a content template** — `content/quiz.ts` or `content/assessment.ts`, the two content models that
  both import `content/record.ts` (`docs/DATA-MODEL.md`, #128).
- **an assessment template** — a fixture record in `data/assessments.ts` that an instance is copied
  from.

Only the first one decides where a screen belongs.

## What this is not

- **Not an excuse to keep dead code.** A surface is kept because it is reusable, and reuse is a claim
  the registry can be checked against. An entry nobody can write a `capability` for, whose `status` is
  `mock` with no note about what it would take, and which no template claims, is a candidate for
  removal — decided in a card that says so, not preserved by this page.
- **Not a justification for a mock.** "It is mocked" is a status, not a reason to ship it. A mock
  surface is catalogued and labelled; presenting one as working is a different defect with its own
  card.
- **Not a ban on a brand-shaped surface.** A quiz player is quiz-shaped and is named for it. What the
  doctrine forbids is a general capability written in one brand's vocabulary, because the next
  expression then rewrites it rather than reusing it.
- **Checked, not merely stated.** `scripts/gen-ui-registry.mjs --check` runs in every lane, the
  `status` check reads the import graph, and `tests/parity/boundary.ts` holds the brand boundary;
  the decision _order_ is still a review question, but the answered question is mechanical —
  `data:check` **E35** (below) fails a component that renders JSX and names no ancestor, and
  `.github/pull_request_template.md` asks the three questions so a reviewer reads the answer beside
  the diff.

## The header, and the check that reads it

Question 1 is a comment now. Every file under `components/` that renders JSX carries, in its first
comment block:

```tsx
// template-ancestor: components/quiz/quiz-play.tsx   (variation: five-notch bands, no timer)
// template-ancestor: none — approved #336
```

`pnpm data:check` walks `components/**/*.tsx` (`components/ui/**` is excluded — the vendored
primitives are the bottom of every chain, and they are legal _targets_), reads the header, and
fails on a missing header, an ancestor path that does not exist, a file naming itself, an ancestry
that closes on itself, a `(variation: …)` that says nothing, or a `none` whose approval is not a
row in `TEMPLATE_ANCESTOR_EXEMPTIONS` (`scripts/template-ancestor.ts`). The census prints every run —
`187 components walked, 181 with an ancestor, 6 approved exceptions` — because a walk that quietly
found nothing passes every tree.

The exemption array **only shrinks**. Each row names the issue that approved the surface, and a row
whose file has since been rebuilt onto a real ancestor is itself a failure, so a rebuild card
deletes its row rather than leaving a stale permission behind. It has already shrunk once: it opened
at eight rows, and #335 took two (the public header became a variation of `nav-menus.tsx`, and the
public footer was deleted rather than kept as a second one).

A header that names the honest ancestor while the file hand-writes it (`the profile band
hand-written — … no page-header primitive`) is a correct header and a recorded divergence: that is
how the remaining debt stays visible instead of becoming invisible.

## A seam, so nobody reads it as a contradiction

`lib/brand-boundary.ts::requireQuizProduct()` answers `404` on the AlignSynch build for the twenty-two
routes the quiz product owns (`tests/parity/boundary.ts`, #300). That is a product decision, not a
deletion: the surface stays catalogued, still renders on QuizHub, and the boundary records which
expression sells it. Dropping a surface from the catalogue because one brand does not render it is
exactly the deletion this page forbids.
