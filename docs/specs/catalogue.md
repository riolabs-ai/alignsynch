# Spec: the assessment template catalogue

## Recommendation (read this first)

**Ship 6 catalogue entries: 5 playable named templates plus 1 blank starting point.**
Three categories, the spec's own words: **Business / Personal / Custom**. Grouping is a
curation-only module (`data/assessment-catalogue.ts`, mirroring `data/quiz-catalogue.ts`),
not a schema field and not a table. "My Templates" is a _surface split_ on `/assessment`
(shown only when the signed-in viewer authored at least one template), not a new record
type. Search is cut — it has no job at six entries. The blank entry is rendered as a
"Start from blank" call-to-action that routes to the existing authoring form
(`/assessment/templates/new`), because that form **is** the blank path and the draft
fixture cannot be copied anyway.

Concrete catalogue:

| Category | Template                 | Status today                                                                |
| -------- | ------------------------ | --------------------------------------------------------------------------- |
| Business | Staff & Manager          | exists (`assessment-business-staff-manager`)                                |
| Business | Co-Founders              | **new** — peer work: direction, share of effort, decisions, risk, growth    |
| Personal | Relationship Basics      | exists (the couple-shaped one: time, housework, money, conflict, affection) |
| Personal | Parent & Child           | exists                                                                      |
| Personal | Friends                  | **new** — non-romantic: contact frequency, support, plans, honesty, effort  |
| Custom   | Blank (start from blank) | exists as a draft fixture; re-render as CTA, do not list                    |

## Why this number, and not the spec's "over a dozen"

The obvious approach is the spec's own mockup (02-dashboard-your-relationships-templates.png,
p9 of the Website Specs): ~14 rows grouped Business / Personal / Custom, each row a title
plus an aspect preview. It looks right and it is wrong for this product, and the mockup
itself is the evidence:

- **The mockup's padding is visible on the page.** Three Personal templates —
  _Girlfriend / Boyfriend_, _Committed Significant Others_, _Spouses_ — carry the
  **identical** aspect string ("Goals, Amount of Time Together, Quality Time, Fun, Intimacy,
  Home, Friends…"). Two Business rows — _Customer / Vendor_ and _Investor / Sponsor Manager_
  — also share one string. When a count is forced, authorship degrades into filler, and
  filler is uniquely fatal here: every Aspect is a question two real people answer about
  each other. A junk question is not noise; it is a bad conversation at the worst moment.
- **Aspect count is multiplicative.** 14 templates × 5 Aspects = 70 authored
  (prompt + Left Value + Right Value) triplets. The repo's own quality bar
  (`data:check` E0–E21, `db:seed` mirrors `data/assessments.ts`, every fixture record is a
  thing the model can say) prices each triplet. Six entries = 30 triplets, which is what a
  small team keeps good.
- **Coverage is the real complaint, not volume.** The demo's defect is that a visitor who
  is neither a manager nor a parent has nothing. Two additions fix it: _Friends_ (Personal)
  and _Co-Founders_ (Business, peer — the existing Business template is strictly
  hierarchical). Five playable templates then cover the two glossary types at both ends of
  each. Roommates/Siblings overlap Friends at this depth; Customer/Vendor overlaps
  Staff/Manager. Cut them rather than author them thin.
- **External catalogues that look like "more is better" are UGC platforms.** Notion's
  gallery (600 → 5,000+ templates, 21 → 250+ categories) and Miro's picker (300+ templates,
  Miroverse at 7,000+) are community marketplaces, not hand-authored collections. The
  pattern that _does_ transfer is structural, not numeric: categories + search + blank
  always reachable + "mine" separated from built-ins (sources below).

Growth path, from the spec itself: the Relationship Maintenance mockup has a
"Copy Aspects & Values To My Templates" button. Let My Templates grow by
_promoting_ a played relationship into a template — every entry in My Templates is then a
template someone actually answered, which is exactly the quality filter a curated list
needs. Until that exists, the authoring form feeds the same list.

## How "My Templates" differs from built-ins

The spec's mockup defines My Templates as "Relationships you copied to Templates… then you
edit freely." The build's `/assessment/templates/new` (#255) already lets a person author a
template directly, which is the same capability without the copy step. The difference that
matters is **attribution**, and the build documents its own gap:

> `lib/flow/templates.ts`: "No new table, no new column, and **no author column** — the model
> has no field for who wrote a template… The card asks for that to be reported rather than added."

So the split requires one column, nothing else:

- **Built-ins** — seeded in `data/assessments.ts`, mirrored by `pnpm db:seed`, validated by
  `data:check`, owned by nobody, never deleted, listed under Business / Personal.
- **My Templates** — rows with `record.author_user_id = <session user>`; listed in a third
  group that renders **only when it has a row** (the Base44 pattern: the tab "appears once
  you've created one"). No empty-state sentence to author, no dead group header.
- **Reuse** — a person's template lands in their My Templates group on `/assessment` the
  moment they save it (today it lands in the flat published list, `ORDER BY title`, mixed
  with built-ins), and they can create instances from it exactly as from a built-in. Nothing
  else changes: `createInstanceFromTemplate` copies rows, never joins back.

## Rejected alternatives

1. **Fourteen templates to match the spec's count.** Rejected: the spec's own rows prove
   the filler failure mode (identical aspect strings), and 70 authored triplets cannot be
   kept at this repo's quality bar. Twelve generic templates are worse than five good ones —
   this is the instruction's own bias, and the mockup confirms it.
2. **Categories as a schema field / CHECK column on `record`** (e.g. migration adding
   `category TEXT`). Rejected: the house pattern for "which record is in which group" is a
   curation module (`data/quiz-catalogue.ts` — "This module holds **no `Quiz` records**"),
   and a column would force every future template to declare a category while the fixture
   already names its type in `title`/`summary`. Curation-only keeps the content model the
   single source of truth.
3. **A "Custom" category with more than the blank entry.** Rejected: any second Custom entry
   is by definition a named template and belongs in Business or Personal. Custom = the blank
   entry point only; render it as a CTA, not a group header with one row.
4. **Search box on the catalogue page.** Rejected: Miro and Notion have search because they
   have hundreds of items; at six, every entry is visible on one screen and a search box is
   machinery with no job. Revisit when the catalogue is user-generated or exceeds ~15.
5. **A separate `template` table / "template" record type.** Rejected: a template is a
   record with no `assessment_instance` row, structurally and in the schema (`strict()`);
   a second table would be the exact "two collections, one winner" mistake
   `data/quiz-catalogue.ts` documents.
6. **Deleting the blank draft fixture.** Rejected: `assessment-blank-template` is one of the
   "one fixture per thing the model can say" records (a draft is a state the model can
   hold), and `data:check` E31/W1 lean on it. Keep the fixture; stop treating it as a
   listable template. The CTA points at the authoring form, which is the blank path that
   works.

## What happens to existing users' data

- **No schema change for categories** — nothing to migrate. The blank fixture stays a draft.
- **`0009_template_author.sql`** adds `author_user_id TEXT` to `record` (nullable, **no FK**:
  users live in Neon Auth's `neon_auth` schema which the app never migrates — the precedent
  is `party.user_id`, same shape). Existing rows backfill to NULL: pre-0009 user-authored
  templates are **unattributable** and stay in the flat published list (the "unowned"
  fallback). They are not deleted, not hidden, and become attributable the moment a re-save
  path exists. This limitation is stated, not patched over with a fake author.
- **No instance, party or opinion row is touched.** `db:verify`'s no-`gap` rule is untouched;
  the migration adds no column to `assessment_instance`, so the "no Gap column anywhere"
  invariant holds.

## Implementation sketch (real files, plain SQL, no ORM)

1. **`db/migrations/0009_template_author.sql`**
   `ALTER TABLE record ADD COLUMN author_user_id TEXT;`
   `CREATE INDEX record_author_user_id_idx ON record (author_user_id) WHERE author_user_id IS NOT NULL;`
   (No FK, no gap column, nothing else.)
2. **`data/assessments.ts`** — add two fixtures:
   `assessment-business-co-founders` (Aspects: direction, share of effort, decisions,
   risk & money, growth) and `assessment-personal-friends` (contact, support, plans,
   honesty, effort), five Aspects each, distinct `aspect-*` ids, published, summaries
   naming "Relationship Type: Business/Personal — Descriptor …" exactly as the existing
   fixtures do.
3. **`data/assessment-catalogue.ts`** (new, curation-only — the pattern of
   `data/quiz-catalogue.ts`): `assessmentCatalogue = { business: [...], personal: [...],
   custom: ["assessment-blank-template"] }` plus a `templatesFor(category)` resolver against
   `data/assessments.ts` that throws on an unresolvable id.
4. **`scripts/data-check.ts`** — one new invariant (E32, say): every published assessment
   fixture is shelved in exactly one category; every shelved id resolves. This is the E11
   for assessments.
5. **`lib/flow/store.ts`** — `listPublishedTemplates()` gains a sibling
   `listMyTemplates(viewerUserId: string | null)` filtering `r.author_user_id = $1`;
   `/assessment/page.tsx` calls both and passes three groups to the list component.
6. **`components/assessment-flow/template-list.tsx`** — render Business and Personal groups
   (headings + cards, the existing per-card create form unchanged), the Start-from-blank CTA
   to `NEW_TEMPLATE_PATH`, and the My Templates group only when non-empty. Words for the new
   headings go in `data/pages/assessment.ts` (E23 — the component holds no words).
7. **`lib/flow/templates.ts` + `app/(mainlayout)/assessment/templates/route.ts`** —
   `createAssessmentTemplate(draft, { authorUserId })`; the route already resolves
   `currentUser()` for the gate, so the id is at hand; write the column in the same INSERT.
8. **`scripts/db-seed.mjs`** — mirrors the two new fixtures; `pnpm db:seed` stays idempotent,
   `pnpm db:verify` stays green.

## Acceptance criteria (verifiable)

1. `pnpm data:check` passes with the new shelving invariant: every published assessment
   fixture appears in exactly one category and every category id resolves to a fixture.
2. Rendering `/assessment` shows a Business group with 2 cards, a Personal group with 3
   cards, and a Start-from-blank CTA — with no "Custom" group header and no blank template
   card (published-filter unchanged).
3. A signed-out visitor sees built-in groups only; a signed-in visitor who has authored a
   template sees a My Templates group containing it; a signed-in visitor with none sees no
   My Templates group at all (hidden, not an empty-state paragraph).
4. Saving a template at `/assessment/templates/new` writes `author_user_id` from the session,
   and the redirect to `/assessment?created=<id>` renders the new template under My
   Templates; `pnpm db:verify` exits 0 with that row present.
5. `pnpm db:seed` is idempotent with the two new fixtures, and `pnpm db:verify` still fails
   on any row or column named `gap` (the Gap remains `gapOf()` over opinions).
6. Creating an instance from a built-in **or** a My Templates row succeeds with an
   unchanged `createInstanceFromTemplate` path (template record id only — no category in the
   payload).
7. `pnpm build` passes with `DATABASE_URL` unset and both brands render the catalogue
   identically (`pnpm parity` updated with a named reason if any hash moves).
8. `data/assessment-catalogue.ts` holds ids and no record objects, and `pnpm lint`'s brand
   rule plus E21-style island checks find no template text pasted into the list component.

## Sources (what external practice shows)

- Spec mockup 02 (`docs/reference/mockups/02-dashboard-your-relationships-templates.png`,
  Website Specs p9): grouped Business/Personal/Custom rows, title + aspect preview per row,
  a separate "My Templates" section, and the identical-aspect-string padding cited above.
- Notion help, "The ultimate guide to Notion templates"
  (https://www.notion.com/help/guides/the-ultimate-guide-to-notion-templates): gallery =
  search + categories + collections; templates are grouped by need, not by author.
- Notion blog, "The reimagined Notion Template Gallery"
  (https://www.notion.com/blog/new-notion-template-gallery): the 600 → 5,000 / 21 → 250+
  growth is UGC economics — the transferable idea is curation into collections, not the
  number.
- Miro help, "Templates"
  (https://help.miro.com/hc/en-us/articles/360017572134-Templates): template picker groups
  300+ templates by category with search; custom templates appear **alongside** built-ins in
  the same picker; blank is always one click away ("deselect Show when creating a new
  board").
- Base44 docs, "Using app templates" (https://docs.base44.com/Getting-Started/App-templates):
  tabs Built-in / Community / Workspace / My Templates, where the My Templates tab "appears
  once you've created one" — the hidden-until-non-empty pattern recommended above.
- Paired (paired.com FAQ): the closest product (two-person relationship Q&A) organizes
  content by **topic packs** (conflict, money, future plans), not by relationship
  demographic — supporting topic-shaped templates over descriptor-spam.
