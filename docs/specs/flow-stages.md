# The relationship flow — the six stages, and what each screen is

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › The six flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

<!-- docs-nav:end -->

**Status: binding.** This document is the spec for the create-and-complete flow. A change to a
stage name, a stage count, a stage's fields or the place the flow ends is a change to this file
first, then to the code. A screen that disagrees with this document is a defect in the screen.

The visual reference is the approved review artifact
[`prototype-relationship-lifecycle-v7`](../review/artifacts/prototype-relationship-lifecycle-v7.html)
(served at `/admin/review?artifact=prototype-relationship-lifecycle-v7`, admin-gated). The build
matches the artifact; the artifact is never edited to match the build.

## The six stages

| #   | Stage        | The screen asks                                                                                                               | Ends by                          |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 1   | **Details**  | Who the two seats are, the invitation address, and what the relationship is called                                            | `Continue to Stage 2` (Settings) |
| 2   | **Settings** | The mode (fixed at creation) and the setting a party may later move                                                           | `Continue to Stage 3` (Aspects)  |
| 3   | **Aspects**  | Which aspects this relationship asks, in order, each one inspectable in place                                                 | `Continue to Stage 4` (Invite)   |
| 4   | **Invite**   | Sending or copying the invitation to the counterparty — the relationship now exists and is waiting                            | Continue to connect              |
| 5   | **Connect**  | The invitation has gone out and the relationship is live — the two seats exist and are connected, waiting on the counterparty | Close — lands on the dashboard   |
| 6   | **Align**    | The two parties' answers side by side, aspect by aspect, with the distance between them                                       | —                                |

**The foot is one shape on stages 1–4** (#760): `[Back][Cancel]` as a single left group and the act
that advances the flow flush right. `Cancel` leaves the flow — it goes where the shell's close goes,
to the template library — while `Back` is the stage before. Below 560px the row cannot hold three
controls, so the advancing act takes a full-width row of its own above the pair. The advance names
the stage it goes to, never what that stage asks.

**There is no `Ongoing` stage.** "Ongoing" is not a screen: once the flow completes, the reader is
taken to the **relationship detail page in the member dashboard**, which is where everything that
used to be called Ongoing lives — the parties, the answers, the Gap, the report — and to **Align**
once assessments are shared. A seventh rail word, a `/…/ongoing` route or an `Ongoing` label
anywhere in the flow is a defect.

The rail prints `Stage {n} of 6` and draws six cells. Names are capitalised as written above:
`Details`, `Settings`, `Aspects`, `Invite`, `Connect`, `Align`.

### Align is the conditional stage

**Align exists when there is something to align**: it is live once **one or more assessments are
shared** — in progress or completed. Before that, the sixth cell is drawn as the stage that is not
yet available; it is never a step the wizard advances the creator into. A completed relationship
with no shared assessment has no Align screen to show, and one with a shared assessment reads it
without going back through the flow.

### What changed from the six-word rail

The old rail read `Who · Mode · Aspects · Create · Sent · Ongoing`. The rename is not cosmetic:

| Old     | New                    | Why                                                                                                      |
| ------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Who     | **Details**            | The stage collects more than people — address, title, description.                                       |
| Mode    | **Settings**           | Mode and Setting are both chosen here; one is fixed, one is not.                                         |
| Aspects | **Aspects**            | Unchanged.                                                                                               |
| Create  | **Invite**             | The stage's verb is the invitation, not the record.                                                      |
| Sent    | _(folded into Invite)_ | "Sent" described a state after the act, not a step of its own.                                           |
| Ongoing | _(removed)_            | Living work belongs to the relationship, not to a wizard.                                                |
| —       | **Align**              | New: the stage that only exists once assessments are shared, and the reason to have a sixth cell at all. |

## The modal is the presentation

The flow opens as **one overlay over the stage routes**: a dialog centred and capped at
`min(100% - 48px, 880px)` at ≥ 1024 — 880px on a 1024, a 1440 and a 3400 screen alike (#760) — and
a full-height sheet at 390. A stage URL still renders standalone — a deep link, a refresh or an
invitation link must never 404. The account gate is a step _inside_ the overlay, after Invite, not
a page and not a stage.

### The invitation is the response path, and it enters at Connect

The counterparty opens `/invite/<token>` and gets the same overlay: `StageShell` frames it,
`StageRail` draws the same six cells with **Connect** current (`Align` unavailable — nothing is
shared yet), and closing leaves onto `/dashboard`. The three onboarding screens — _What this is_,
_What happens next_, _Your account_ — are that stage's body, addressed by `?step=1|2|3` with the
token in the path, so a refresh, a deep link and the sign-in round trip all land on the same
screen. There is no second stepper: the flow has one progress pattern, the cell rail.

A completed response exits onto `/dashboard` for a signed-in claimer — the relationship is under
My relationships from that redirect on. A signed-out claim (postable, though the screens never
offer it: step 3 asks for an account instead) stays on the relationship it just bound, because
`/dashboard` would only bounce the browser to `/login` and lose the seat the claim set.

The refusal bands — a spent, expired, withdrawn or lapsed link, and a browser that is already a
party — are **not** the response path: there is nothing to respond to, so they keep their own
surface and draw no rail.

## Stage 1, Details — the field inventory

This is the part that has drifted before, so it is written out. The card head carries the template's
name and its aspect count. Then, in a 12-column grid:

| Field              | Label                                                                                                                           | Help                                                                       | Span |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---- |
| Initiator name     | `Your Name as the Relationship Initiator`                                                                                       | `The seat this relationship is created from.`                              | 6    |
| Counterparty name  | `Counterparty's Name as Seen on the Invite` (placeholder `Their name`)                                                          | `They will complete their name preference when they claim the invitation.` | 6    |
| Counterparty email | `Email Address used to send the Counterparty Invite` (placeholder `name@example.com`)                                           | —                                                                          | 6    |
| Title              | `Your Personalized Relationship Title` (placeholder `Relationship Basics`)                                                      | `The personalized name of the created Relationship.`                       | 6    |
| Description        | `Personalized Relationship Description` (placeholder `A sentence on why you are doing this — both of you read it on the card.`) | `Optional. Shown to both parties, never scored.`                           | 12   |

Every label above is the owner's saved copy from the v7 artifact's Edit-copy pass (#760), character
for character — the stage does not "clarify" them. Heading `Relationship Details`, body `One
template, two seats, and the facts that shape every screen after this one.`, primary action
`Continue to Stage 2`, secondary actions `Back` and `Cancel` in the foot's left group.

Two rules follow from the inventory:

- **Do not add a field the artifact does not draw**, and do not add a help line to a field that has
  none — an extra sentence is a spec change, not a copy improvement.
- **Do not drop a field.** A form that shows two of the five (or four of the five) is the drift this
  table exists to catch.

## Stage 2, Settings — two peers, one control

Mode and Setting are two independent dimensions of equal weight, so they are drawn with **one**
single-select component: two `fieldset`s side by side from `sm` up and one column below it, each
with its own legend, one bordered cell per option, and the option's one-line glossary help
(#760). The headings are `Opinions Mode` and `Alignment Setting`, under the stage heading
`Relationship Settings`; `Fixed at creation` rides beside the Opinions Mode legend as a chip, and
the Alignment Setting carries its lens line above the cells and its threshold line
(`Soft tolerates a Small Gap (1); Full accepts only In Synch.`) below them. The option words and
their definitions are the model's (`MODE_LABELS`, `SETTING_LABELS`, `SETTING_DEFINITIONS` in
`content/assessment.ts`), never a second copy of them.

## Stage 3, Aspects — the row is one line

A collapsed row reads `01 · ⠿ · name · opinions · ✎`: the position at the far left, read off the
row's index so a drag renumbers it and drawn as a span (a position, never a field); the drag
handle; the Aspect's name; the two ends of its scale; and the edit control as an icon carrying the
fixture's own word as its accessible name. No per-row origin chip — the template is named once, in
the stage body (#760). An open row closes through **Save or Cancel only**, and Cancel with
unsaved words asks first; the prompt is fixture copy.

## How this is enforced

- `tests/flow-stages.test.ts` reads `data/pages/lifecycle.ts` and fails unless the stage words are
  exactly these six, in this order, with `Stage {step} of 6`, and fails on the word `Ongoing`
  anywhere in the flow's copy or routes. It also fails if `Align` is drawn unconditionally — the
  sixth cell is only live when a shared assessment exists.
- `tests/create-fields.test.ts` pins the stage 1 inventory above against
  `data/pages/assessment-create.ts` — field ids, labels and help in order — so a silent sixth field
  or a dropped fifth is red.
- `data:check` E10 still holds every flow `href` to the route manifest, so a `/…/ongoing` route
  cannot quietly return.
- `tests/invite-response-shell.test.tsx` renders the response stage through `StageShell` and fails
  if it stops drawing the six-stage rail at Connect, drops off the shared stage column, gains a
  second progress band, or exits onto anything but the screens `afterClaimTarget()` names.
- `tests/flow-ui-parity.test.tsx` pins the four conformance rules of the v7 pass (#760) to rendered
  markup: the panel's `lg:max-w-[880px]` cap, one foot per stage with `[Back][Cancel]` as a left
  group and the advance flush right, two `fieldset`s on Settings sharing one radio component, and
  an Aspect row that opens with its index and closes only through Save or Cancel.
- The gate itself (`bash scripts/verify.sh`) runs those tests in every code lane. Nothing here is a
  convention a reviewer has to remember.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › The six flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

<!-- docs-nav:end -->
