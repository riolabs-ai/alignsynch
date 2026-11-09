# The relationship flow — the six stages, and what each screen is

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › The six flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

<!-- docs-nav:end -->

**Status: binding.** This document is the spec for the create-and-complete flow. A change to a
stage name, a stage count, a stage's fields or the place the flow ends is a change to this file
first, then to the code. A screen that disagrees with this document is a defect in the screen.

The visual reference is the approved review artifact
[`prototype-relationship-lifecycle-v5`](../review/artifacts/prototype-relationship-lifecycle-v5.html)
(served at `/admin/review?artifact=prototype-relationship-lifecycle-v5`, admin-gated). The build
matches the artifact; the artifact is never edited to match the build.

## The six stages

| #   | Stage        | The screen asks                                                                                                               | Ends by                        |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1   | **Details**  | Who the two seats are, the invitation address, and what the relationship is called                                            | Continue to settings           |
| 2   | **Settings** | The mode (fixed at creation) and the setting a party may later move                                                           | Continue to aspects            |
| 3   | **Aspects**  | Which aspects this relationship asks, in order, each one inspectable in place                                                 | Continue to invite             |
| 4   | **Invite**   | Sending or copying the invitation to the counterparty — the relationship now exists and is waiting                            | Continue to connect            |
| 5   | **Connect**  | The invitation has gone out and the relationship is live — the two seats exist and are connected, waiting on the counterparty | Close — lands on the dashboard |
| 6   | **Align**    | The two parties' answers side by side, aspect by aspect, with the distance between them                                       | —                              |

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

The flow opens as **one overlay over the stage routes**: a fullscreen dialog at ≥ 1024 and a
full-height sheet at 390. A stage URL still renders standalone — a deep link, a refresh or an
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

| Field              | Label                                                                                                 | Help                                                                                                 | Span |
| ------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---- |
| Initiator name     | `Your name — the Initiator`                                                                           | `The seat this relationship is created from.`                                                        | 6    |
| Counterparty name  | `Who you are asking` (placeholder `Their name`)                                                       | `Display only: the seat is filled when they claim the invitation. A name typed here is not a party.` | 6    |
| Counterparty email | `Their email address` (placeholder `name@example.com`)                                                | —                                                                                                    | 6    |
| Title              | `What are you in the middle of` (placeholder `Relationship Basics`)                                   | `The card title both of you see.`                                                                    | 6    |
| Description        | `Description` (placeholder `A sentence on why you are doing this — both of you read it on the card.`) | `Optional. Shown to both parties, never scored.`                                                     | 12   |

Heading `Who and how`, body `One template, two seats, and the facts that shape every screen after
this one.`, primary action `Continue to mode and setting`, secondary action `Back`.

Two rules follow from the inventory:

- **Do not add a field the artifact does not draw**, and do not add a help line to a field that has
  none — an extra sentence is a spec change, not a copy improvement.
- **Do not drop a field.** A form that shows two of the five (or four of the five) is the drift this
  table exists to catch.

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
- The gate itself (`bash scripts/verify.sh`) runs those tests in every code lane. Nothing here is a
  convention a reviewer has to remember.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › The six flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

<!-- docs-nav:end -->
