# Spec: Relationship Maintenance form fields (the "one more field" problem)

## Recommendation (read this first)

**Create-relationship form (the per-template card on `/assessment`) keeps exactly what it
has today, plus one pre-filled optional field:**

| Field                   | Recommendation                                                                                              | Cost                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Mode (Basic / Advanced) | **Keep** — required, as today                                                                               | already there; load-bearing (decides which opinions exist; immutable)    |
| Initiator name          | **Keep** — required                                                                                         | already there                                                            |
| Counterparty name       | **Keep** — required                                                                                         | already there                                                            |
| Counterparty email      | **Keep** — required                                                                                         | already there                                                            |
| **Relationship name**   | **Add, optional, pre-filled with the template title**                                                       | zero: submit untouched and the default is what today's build does anyway |
| Setting (Soft / Full)   | **Keep off this form.** Default Soft at creation (today's behaviour), editable later on the instance screen | —                                                                        |

**Cut outright as form fields: Relationship Type, Relationship Realm, Relationship
Descriptor.** Also out: Coach fields (SPEC-DRIFT §8 already rules Coach a different
product). The minimum set is therefore **five inputs**, only one of which is new, and that
one is invisible to a user in a hurry.

## The verdict per field, argued

### Relationship name — earns its place, but only as a pre-filled optional

The build's own data makes the case: instance titles are the template title
("Staff & Manager"), and `createInstanceFromTemplate` composes
`summary = "<template title>, answered by A and B."` — so two relationships built from one
template are **indistinguishable in `/assessment/instances`**. A manager with two staff, or
a person running "Relationship Basics" with a partner and again with a friend, sees two
identical rows. The spec's dashboard mockup even shows the answer in its My Templates
section ("Manager / Staff - My Analysts" — a name, not a template title). External practice
agrees it is a real, recurring want: Miro's help tells users to rename the board created
from a template "so your team can find it easily later"
(https://help.miro.com/hc/en-us/articles/360017572134-Templates — the Arclet guide
summarizes the same step). The name also rides into the invitation subject ("{initiator}
wants to compare notes with you on {template}") and the unlock notice, where "Sofia
check-in" beats "Relationship Basics" a second time.

But the field only earns its place because it is **pre-filled and optional**. Research on
field cost is consistent in direction: Expedia removed one optional field (Company) and
gained ~$12M/year; Imagescape cut 11 fields to 4 for a 120% conversion lift; phone-number
fields alone cost ~5% (Unbounce, via https://www.storylane.io/blog/demo-requests and
https://www.marquiz.io/blog/conversion-optimization-case-studies). A blank, _required_ name
box would be exactly the Expedia field — friction with no computation behind it. A
pre-filled one costs nothing at completion time and pays off at list time. Storage is
`record.title` — no schema change.

### Type, Realm, Descriptor — cut, and the build already said why

`data/assessments.ts` settled Type two fixtures ago: "Relationship Type is not a field…
the type is named in each template's `title` and `summary`". Choosing the template **is**
choosing the type, so a type field re-asks a question the click already answered. Realm
("Office", "Home") feeds nothing: no list, report, email or computation reads it — the
definition of a field that exists only to be filled (the Expedia Company field, whose only
observable effect was that customers typed their bank's name into it). Descriptor
("Staff / Manager") is the template's title; a second copy on the instance is redundancy
that can disagree with the first. All three survive where they already live — as words in
template titles and summaries, which the list, the screen and the email all already draw
from. The spec's own mockup (03-relationship-maintenance.png, Website Specs p10) fills
them with values derived from the template choice, which is the mockup accidentally proving
they are derived data.

### Setting (Soft/Full) — real, but it belongs on the maintenance screen, not the create form

The Setting exists (`assessment_instance.alignment_setting`, migration 0008; schema field
required; `SETTING_GAP_LIMITS`; fixtures author it explicitly; the report reads it). It is
a genuine decision — "how closely do we want to Align" changes which Gaps count as unmet.

But asking it _at creation_ is wrong, and asking it as an extra required radio is
double-wrong. Pre-committing to "Full — no Gap OK" before either party has answered is a
commitment to a standard you cannot yet see; the moment anyone _knows_ whether Full is
achievable is after the reveal, and the spec itself ("Either party can change their
Opinion" era aside) models the Setting as a maintenance box, not a creation gate. So: keep
today's default (`DEFAULT_ALIGNMENT_SETTING = "soft"`, written by
`createInstanceFromTemplate`), and add the **one** post-creation control the model is
missing: a change endpoint on the instance screen. Soft-first is also the migration's own
stated rule — the least-strict reading is the only one that cannot retroactively mark a
relationship unmet that its parties never agreed to play by Full
(`DEFAULT_ALIGNMENT_SETTING` comment, `content/assessment.ts`).

### Mode, names, email — keep, because they are not optional metadata

Mode decides which opinions the sheet asks and is immutable by design; the two names and
the address are the only way the blind two-party flow can address anyone (invitation,
unlock notice). The build already collapsed the spec's FirstName/LastName pairs into one
name per party — a prior "one more field" cut, and the right one; nothing here re-opens it.

## Rejected alternatives

1. **The spec's full maintenance form verbatim** (name + type + realm + descriptor + mode +
   setting + first/last names + email + Coach block). Rejected: three of the four
   "definition" fields are derived data, the Coach block is out of scope (SPEC-DRIFT §8),
   and the form-length evidence (3–5 fields ≈ 40–50% completion vs 13+ ≈ 8–15%,
   https://seolevelup.com/how-to-fix-a-website-that-gets-traffic-but-no-leads/) applies
   harder here than in lead-gen: this form is the front door to the whole product.
2. **A required, blank relationship-name field.** Rejected: reintroduces the Expedia
   failure with zero payoff for the majority user who has one relationship.
3. **Making Setting a required radio on the create form.** Rejected: forces a commitment
   to a standard the parties cannot yet assess; the report would then judge the reveal by a
   bar chosen blind. Default-then-edit keeps the model's required-ness (no NULL rows) and
   the user's agency.
4. **Dropping the Setting from the form/screen entirely (Soft forever).** Rejected: the
   glossary defines both values, `noor-iris` already plays Full, and the report already
   reads the column — refusing the control would make the model's lens a dead letter.
5. **A realm/descriptor free-text pair stored on the instance for "search and filtering"
   later.** Rejected: speculating a query no surface runs today is exactly how metadata
   fields get added and never used; add them only when a real surface needs them.

## What happens to existing users' data

- **Nothing changes for any existing row.** No migration is required by this spec: the name
  is `record.title` (exists), the Setting column exists since 0008 and is already written as
  `soft` on every created instance, and the cut fields were never columns.
- **Optional name:** instances created before the field exist keep template titles —
  identical to the default, so the list renders exactly as it does today. Renaming an
  existing instance, if wanted later, is one UPDATE on `record.title`; not part of this card.
- **Setting edits:** new rows created after the change still default `soft`; an edited row
  simply has the other legal value, which every read path (`readInstanceBundle`,
  `lib/assessment-report.ts`) already handles. `db:verify`'s checks (no NULL, value in
  CHECK) are unaffected.
- **No Gap column** is added anywhere; the verdict stays derived (`gapMeetsSetting` over
  opinion rows) at every read, before and after an edit.

## Implementation sketch (real files, plain SQL, no ORM)

1. **`components/assessment-flow/template-list.tsx`** — one new input per create form:
   `<input name="instanceTitle" placeholder={itemLabel(create, "instance-title-placeholder")} />`
   pre-filled with `template.title` via `value`/default (plain HTML: `value={template.title}`),
   and one fixture item pair in `data/pages/assessment.ts` for the label/placeholder (E23 —
   the component holds no words).
2. **`app/(mainlayout)/assessment/new/route.ts`** — read `instanceTitle` from the form and
   pass it into `createInstanceFromTemplate`.
3. **`lib/flow/store.ts`** — `CreateInstanceInput` gains optional `instanceTitle: string`;
   `required`-style trim; empty → `found.title` (today's behaviour); the INSERT writes it to
   `record.title` and composes `summary` from it; `invitationMessage`'s `templateTitle` arg
   takes the instance title so the email names the relationship the person named.
4. **`app/(mainlayout)/assessment/instances/[instanceId]/setting/route.ts`** (new, the
   sibling of `answers/route.ts`): POST-only; resolve the viewer from the party cookie via
   `roleForToken` (same as submit — a request cannot name a role); `zAlignmentSetting.safeParse`
   the posted value; `UPDATE assessment_instance SET alignment_setting = $2 WHERE record_id = $1`.
   No new column, no migration.
5. **`components/assessment-flow/instance-view.tsx` + `data/pages/assessment-instance.ts`** —
   a small two-radio control on the instance screen rendered when the instance is complete
   (or always), words from the fixture; the report below re-reads the same column and
   renders per `SETTING_GAP_LIMITS`, so an edit re-verdicts on the next render.
6. **No `content/` schema change** beyond none: `setting` stays required on the instance
   object; the optional title lives on the already-optional-free `record.title`.

## Acceptance criteria (verifiable)

1. Grep of `components/assessment-flow/` and `data/pages/` finds no input for type, realm,
   or descriptor anywhere in the create path; the only new create-form input is the
   optional pre-filled title.
2. Submitting the create form with the title field untouched creates an instance whose
   `record.title` equals the template title — the existing `tests/flow-store.test.ts`
   expectations keep passing unchanged.
3. Submitting with a title of "Sofia check-in" stores it, renders it on the instance screen,
   and puts it in the invitation email's `{template}` slot and the unlock notice (assert via
   `invitationMessage` unit test and `scripts/flow-e2e.mjs`).
4. Every new instance row has `alignment_setting = 'soft'` (unchanged create path), and
   POSTing `setting=full` from a party session of the instance updates only that row;
   POSTing `setting=banana`, or posting from a non-party browser, is refused with a named
   code and changes nothing.
5. The report verdict flips Soft → Full only where `SETTING_GAP_LIMITS` says it must:
   extend `tests/assessment-setting.test.ts` with a post-edit re-read case.
6. `pnpm typecheck` passes with the new optional inputs typed, and `pnpm build` passes with
   `DATABASE_URL` unset (the new endpoint is request-time, no build-time reads).
7. `pnpm db:verify` still passes — and still fails on any column, table or view named
   `gap` — after creating, editing, and re-reading an instance end-to-end.
8. Existing seeded instances (`avery-rowan` … `noor-iris`) render unchanged after the
   change: titles, settings and reports identical to the parity fixtures, so
   `pnpm parity` needs no hash rewrite for untouched routes.

## Sources (what external practice shows)

- Spec mockup 03 (`docs/reference/mockups/03-relationship-maintenance.png`, Website Specs
  p10): the full maintenance form this spec cuts down — name, type, realm, descriptor,
  mode, setting, first/last names, email, Coach block. Type/realm/descriptor values are
  all derivable from the template choice, which is the mockup showing them to be derived
  data.
- Unbounce form research, via Storylane's demo-request study
  (https://www.storylane.io/blog/demo-requests): Expedia deleted one optional field —
  "Company" — worth ~$12M/year; Imagescape 11 → 4 fields, +120% conversions; phone fields
  ≈ 5% conversion dip. Direction of the evidence: every extra field costs completion, and
  confusion costs more than typing.
- Marquiz case-study roundup (https://www.marquiz.io/blog/conversion-optimization-case-studies):
  the Expedia field's failure mode was users typing their _bank_ into it — an optional
  field nobody needs is not neutral, it is actively misleading. This is the Realm
  argument: metadata that feeds no computation gets filled wrong.
- SEOLevelup field-count table
  (https://seolevelup.com/how-to-fix-a-website-that-gets-traffic-but-no-leads/): 3–5 fields
  ≈ 40–50% completion, 13+ ≈ 8–15% — the five-field create form sits in the healthy band.
- Miro help (https://help.miro.com/hc/en-us/articles/360017572134-Templates) and Arclet's
  guide (https://arclet.io/guides/miro/use-templates): "Rename the board… so your team can
  find it easily later" — the product-standard evidence that a name distinct from the
  template title pays off as soon as a person has two of anything.
