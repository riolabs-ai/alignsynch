# SPEC-DRIFT — where the build differs from the specification

Two authoritative documents describe this product. Neither is code, both are in `docs/`, and they
**disagree with each other** on load-bearing content. This file records what each says, what the
build does, and what should happen about each difference.

Read this before carding work from either PDF. A requirement invented from a document that never
stated it is the most expensive kind of mistake, because it survives review: nobody can check it
against a source that never said it.

| file                                                | version       | date     | scope                                                                                |
| --------------------------------------------------- | ------------- | -------- | ------------------------------------------------------------------------------------ |
| `AlignSynch.com - Glossary v2-01-01h 2023.docx.pdf` | v2-01-01h     | 2023     | vocabulary: record, template, instance, aspect, value, opinion, gap                  |
| `AlignSynch.com - Website Specs.pdf`                | V2-01-01**g** | Dec 2023 | the whole product: model, stages, roles, use cases, pricing, open decisions (139 pp) |

## 0. Which document wins — and where they conflict

**The version suffix is not a reliable precedence signal.** The glossary is `h`, the website spec is
`g`; by suffix the glossary looks later, yet the website spec is the document that describes eight
stages while the glossary says six and defines four. Both are genuinely in force in the sections
they own.

| area                   | glossary (v2-01-01h)                      | website spec (V2-01-01g)                                              | build follows                |
| ---------------------- | ----------------------------------------- | --------------------------------------------------------------------- | ---------------------------- |
| number of stages       | "Six (6) Stages", defines 1, 2, 3, 7 only | "Now 8 Stages": **A–D (stage of User) + 1–4 (stage of Relationship)** | neither — stages are unbuilt |
| gap analysis           | eight kinds                               | eight kinds **plus a third step**, Doubt                              | the eight kinds (steps 1–2)  |
| opinions after sharing | —                                         | "Either party can change their Opinion at any time"                   | **frozen at complete**       |

The stage conflict is resolved by the mockup on p57: **A–D are billing/account states**, not
relationship stages. The glossary's "missing" 4–6 were not deleted; they became the Account Bank
ladder. The build's four relationship stages are the right four — the other four need a billing
product this template does not have.

**The ruling recorded in #261 predates this comparison and should be revisited:** it says "build the
four the glossary defines, document 4–6 as undefined". The better statement is "build relationship
stages 1–4; A–D are billing and out of scope until there is billing".

## 1. The Gap model — verified equivalent, then extended

The build's eight kinds are not an interpretation: they are the specification's steps 1 and 2,
computed from the pairs the spec names, verified kind-by-kind against `content/gaps.ts` and proven
on stored rows (#219).

| spec step    | spec's words (pp. 65–66)                                                                                                                                                                                    | build                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1 Basic      | "Feel Gap = Parties Feel Different"; "Wish Gap = Parties' Wishes Differ"; "Initiator Gap = Initiator Feels & Initiator Wishes Differ"; "Counterparty Gap = Counterparty Feels & Counterparty Wishes Differ" | `feel`, `wish`, `initiator`, `counterparty` — same pairs                               |
| 2 Prediction | "Initiator Think Gap = Initiator Thought Counterparty Felt Different"; "Initiator Guess Gap = Initiator Guessed Counterparty Wished Different"; both mirrored                                               | `initiator-think` = I.think vs C.feel; `initiator-guess` = I.guess vs C.wish; mirrored |
| 3 Doubt      | "AFTER first showing and beyond, Initiator still Thinks Counterparty Feels Different Than Scored"                                                                                                           | **absent — cannot be computed from stored data**                                       |

**Doubt is not a missing formula, it is missing data.** It compares what a party predicted _before_
the reveal against their view _after_. `opinion` holds one value per kind with no history, so nothing
in the schema can answer it. Adding it needs opinion history or a snapshot at unlock — a schema
decision, not a UI task.

The spec does not name its gap groups; the build's grouping lives in `GAP_KIND_SOURCES`. Naming them
(Basic / Prediction / Doubt) is a copy decision, listed as a quick win.

## 2. Use cases 100–150 (spec pp. 118–125)

| event                   | spec requires                                                                                        | build today                                                                                                                                                                                                                                      | tier     |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 100 Create Relationship | copy a template into a relationship; Maintenance fields (relationship name, type, realm, descriptor) | copy is built and atomic (`lib/flow/store.ts`); **no relationship-level name** — the template title is reused; maintenance fields absent                                                                                                         | MOD      |
| 110 Registration        | unique username, first name, last name, email; 30-day saved-relationship expiry with a popup         | real auth (better than the spec); **no username** (email is identity, handle set later at `/settings`); the form asks phone/interests instead; expiry policy absent                                                                              | MOD      |
| 120 Subscribe           | pricing, Account Bank, Relationship Week, coupons                                                    | **absent entirely**; `/pricing` is a quiz fixture                                                                                                                                                                                                | BIG      |
| 130 Pre-invite          | preview the email before sending; void button; empty-email guard                                     | invite fires automatically on creation; **no preview, no void**; empty email refused                                                                                                                                                             | QW       |
| 140 Post-invite         | invitation row: date, +7 days, pending until claim; stage bar                                        | row matches exactly (`lib/flow/tokens.ts`, `lib/flow/store.ts`); **no stage bar**; claim sentences replace a greyed button                                                                                                                       | MOD      |
| 150 Expired invitation  | recipient is told; initiator can re-invite or void                                                   | expiry **is** enforced at claim (7 days); the recipient sees "This invitation has expired"; **the initiator's screen never learns it** (`lib/flow/store.ts` selects `email, counterparty_name, claimed_at` and omits `expires_at`); no re-invite | QW + MOD |

**Where the build does better than the spec, this file says so:** the blind rule is a data shape
rather than a policy; claims have six named refusals plus a name confirmation; email outcomes are
honest (sent / unset / failed) with the link always visible; tokens are hashed; status is derived
rather than stored; the instance list does not leak the other party's answers.

## 3. Stages, roles and the Change system (spec pp. 42–60)

- **Stages** (MOD): the spec is internally inconsistent — it says eight, references "Stage 5" and
  "Stage 6", and separately lists "7 Aligned". The build derives three statuses and has no stage bar.
  There is no Share action: the instance auto-unlocks when both answers land.
- **Roles** (BIG): `party.role` is structurally `initiator|counterparty`
  (`db/migrations/0001_content_model.sql`). Coach and Branded Coach have no representation.
- **Changes / Logs / Approvals** (BIG): Proposer, Approver, Change Shading, Change Log and the two
  change states have **zero equivalent** in the build (grep-verified). This is the largest single
  drift in the document, and it collides with a rule the build enforces — see §4.

## 4. Rulings (Jaden, 2026-10-31)

**4.1 Opinions are frozen at completion.** The build's rule stands; the spec's "either party can
change their Opinion at any time" and its Proposer/Approver workflow are **not** adopted.
Consequence, stated plainly: **Step-3 Doubt gaps are permanently out of scope** — they compare a
prediction against a view _after_ the reveal, and with a freeze there is no "after". The Changes /
Logs / Approvals system is therefore not a backlog item; it is a design this product rejected.

**4.2 Accounts from the start.** Neon Auth stays the identity model. Billing is a later feature, not
a prerequisite. Consequence: the spec's A–D ladder (free week, Account Bank, locked watermarks,
30-day expiry) is **out of scope**, and no work should assume it. Unregistered play with no save is
not adopted — durable rows on play remain, which is the current behaviour.

**4.3 Relationship stages only.** Four stages: **Invited → Connected → Sharing → Aligned**. The
A–D states in the spec are _billing_ states, not relationship stages, and are out of scope with 4.2.
No Stage Bar visual until the four are derived and named.

**1. Edit after sharing — freeze or propose?**
The build freezes every answer when an instance completes, and that is load-bearing for the blind
rule. The spec says "Either party can change their Opinion at any time" and describes a
Proposer/Approver workflow with a Change Log. Both cannot be true.
_Why it matters beyond itself:_ the Step-3 **Doubt** gaps only become meaningful if opinions can
change after the reveal. Keeping the freeze means Doubt stays impossible.

**2. Identity — token-first or accounts-first?**
The spec's premise is that unregistered people play with no save, with loss warnings. The build has
no registration wall for viewing, creates durable rows on play, and requires an account to create or
claim. The spec's freemium ladder (A–D, 30-day expiry, Account Bank) assumes accounts from the first
second. This decides whether the billing work in §2 is reachable at all.

**3. Which stage list — and is there a Stage Bar at all?**
Eight (A–D + 1–4) or four relationship stages plus billing states later? The two documents disagree
and the spec disagrees with itself. Cheap to defer, expensive to get wrong twice.

## 5. Out of scope, and why

Named so they stop reappearing as backlog: **pricing and subscriptions, Account Bank, Relationship
Week, coupons, the freemium ladder, watermarking locked relationships, anniversary reminders, branded
coaches, viral-loop analytics, i18n**. Every one blocks on billing or on a multi-tenant coaching
product. They are a different product from "one codebase, several brands, one template". The repo's
`BRAND` flag is _not_ the spec's white label — different mechanism, different customer.

## 6. Quick wins — one card each, no decision needed

1. **The marketing page denies the database.** `data/pages/marketing.ts`: "The records behind these
   screens are a demonstration set, not a database." There are six Postgres tables and
   `/assessment/[slug]` reads from them. False on the public page.
2. **The initiator is never told an invitation expired.** `lib/flow/store.ts` selects
   `email, counterparty_name, claimed_at` and omits `expires_at`, so a dead link looks live forever.
   The recipient already gets a correct message; the initiator does not.
3. **"In synch" is lower-cased** in the report; the spec treats In Synch as a named state.
4. **Name the gap groups** (Basic / Prediction / Doubt) wherever the report groups them — the spec's
   own headings use those names.

### Rejected on review

- **Template titles keep `&`.** The spec's `/` is list punctuation — a page listing templates as
  "Parent / Child, Staff / Manager" — not a title format, and "Parent & Child" reads better than
  "Parent / Child". Likewise the `Status` item is withdrawn: no such user-facing string exists in
  the tree.

## 7. Moderate — one issue each, discuss before building

- Relationship Maintenance fields (relationship name, type, realm, descriptor).
- Registration identity: username at sign-up, and what the 30-day policy means without billing.
- Stages: no stepper — `docs/specs/ux-stages.md` recommends one derived status sentence naming the
  current stage and who acts next, with Aligned shown as the report's verdict rather than a fourth
  step.
- Re-invite and void for expired invitations.
- The ~10 spec email types with no equivalent (only invitation and unlock exist).
- Written analysis / generated-report emails — the spec defers detail to v3-00-0, and the flag
  vocabulary its mail-merge needs does not exist.
- The marketing surface reads narrower than the spec's ten benefits.
- Template catalogue: four seeded against a spec listing over a dozen, grouped Business / Personal /
  Custom, with a built-in versus My Templates split.
- Answer input: specified in `docs/specs/ux-input.md`, which recommends a segmented radio group (a
  five-segment control with radio semantics) over the spec's slider, with the accessibility and
  survey-method evidence for rejecting it.

## 8. Big — settle before any queue

- **Coach and Branded Coach** — a third party role, and a different product (§5).
- **Full-view Relationship Level** — the spec's spreadsheet against the build's stacked report. The
  decision is reversible, but the wrong one costs a redesign.

## 9. How to read a finding here

Every finding cites a spec page and a place in the build. Where a number was compared — the eight gap
kinds — it was compared as a computation on real rows, not as the presence of eight functions. Where
the spec promises items it never defines, this file says so instead of inventing them. Where the
build is better than the spec, it says that too.

Mockups from the specification are in `docs/reference/mockups/`, indexed by `docs/REFERENCE-MOCKUPS.md`.
They are inspiration, not requirements.

The research behind the recommendations above lives in `docs/specs/`, one file per question, indexed
by `docs/specs/README.md`.
