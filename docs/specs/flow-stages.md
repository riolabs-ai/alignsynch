# The relationship flow — the five stages, and what each screen is

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › The five flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

<!-- docs-nav:end -->

**Status: binding.** This document is the spec for the create-and-complete flow. A change to a
stage name, a stage count, a stage's fields or the place the flow ends is a change to this file
first, then to the code. A screen that disagrees with this document is a defect in the screen.

The visual reference is the approved review artifact
[`prototype-relationship-lifecycle-v9`](../review/artifacts/prototype-relationship-lifecycle-v9.html)
(served at `/admin/review?artifact=prototype-relationship-lifecycle-v9`, admin-gated). The build
matches the artifact; the artifact is never edited to match the build. v9 supersedes v7, which
superseded v5; each was approved in its turn and the decisions it carried are recorded below.

## The five stages

| #   | Stage        | The screen asks                                                                                                      | Ends by                                                                                          |
| --- | ------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | **Details**  | Who the two people are, the invitation address, what the relationship is called and why                              | `Continue to Stage 2` (Settings)                                                                 |
| 2   | **Settings** | The mode (fixed per session) and the setting a party may later move                                                  | `Continue to Stage 3` (Aspects)                                                                  |
| 3   | **Aspects**  | Which aspects this relationship asks, in order, each one inspectable in place, and the creator may add or remove one | `Continue to Stage 4` (Account)                                                                  |
| 4   | **Account**  | The account the invitation is sent from — signing up or in writes the relationship as a **draft**                    | `Continue to Stage 5` (Invite)                                                                   |
| 5   | **Invite**   | The pay walk — choose a membership plan, then the card — the invitation it unlocks, and the option to keep the draft | `send email to counterparty now` → the confirmation, once the card is on file; or keep the draft |

**The foot is one shape on stages 1–5** (#760): `[Back][Cancel]` as a single left group and the act
that advances the flow flush right. `Cancel` leaves the flow — it goes where the shell's close goes,
to the template library — while `Back` is the stage before. Below 560px the row cannot hold three
controls, so the advancing act takes a full-width row of its own above the pair. The advance names
the stage it goes to, never what that stage asks.

**There is no `Ongoing` stage.** "Ongoing" is not a screen: once the flow completes, the reader is
taken to the **relationship detail page** in the member dashboard, which is where every later cycle
of the relationship lives.

### Align is not a stage

`Align` is the dashboard's surface, not a cell in the rail. It is live once **one or more
assessments are shared** — in progress or completed — and it is read on the relationship detail
page. The creation modal therefore prints **`Stage {n} of 5`** and never draws `Align`: a cell the
creator can reach inside the flow would claim the flow ends somewhere it does not.

This replaces the earlier rule (#735) that Align was the flow's conditional sixth stage. The
dashboard behaviour it described is unchanged; only its position moved.

### What changed from the six-stage rail

| Was                                             | Now                    | Why                                                                                                                                                                                                                     |
| ----------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invite was stage 4                              | **Invite is stage 5**  | The account comes before the invitation, not after it.                                                                                                                                                                  |
| Connect was stage 5                             | **Removed**            | Its affordances — resend, copy link, the waiting status, what happens next — already exist on the dashboard's relationship detail and on the post-send confirmation, which stays as an **unnumbered** screen.           |
| Align was stage 6, conditional                  | **Not in the flow**    | Align is the dashboard, where completion lands.                                                                                                                                                                         |
| Account was a gate _after_ stage 4, not a stage | **Account is stage 4** | #659 said "Account is not a stage"; that decision is **superseded**. The creator signs up before the relationship exists, so the Initiator is known when the row is written instead of being attached to it afterwards. |

## The modal is the presentation

The flow opens as **one overlay over the stage routes**: a dialog centred and capped at
`min(100% - 48px, 880px)` at ≥ 1024 — 880px on a 1024, a 1440 and a 3400 screen alike (#760) — and
a full-height sheet at 390. A stage URL still renders standalone — a deep link, a refresh or an
invitation link must never 404. **Account is stage 4 _inside_ the overlay**; there is no longer a
gate step after Invite, and no page whose only job is to demand an account.

### Where the flow is entered — three classes, one rule

The inventory behind #979 counted **36 entry controls** (`21 full page · 7 wizard route · 6 in-flow
stage · 2 external · 0 modal`). One rule decides what each one does, and it is a property of the
**destination**, never of the surface's tidiness:

| the control's destination                                                                          | what pressing it does                                                       | why                                                                                                       |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **a stage of the flow** (`/templates/relationship/<slug>/create{,/mode,/aspects,/commit,/invite}`) | opens the flow **in place**, in the dialog, over the page it was pressed on | the user keeps their context; that is the whole point of the shell                                        |
| **any other page** — a marketing surface, an auth page, a catalogue, a relationship                | **navigates**, exactly as before                                            | a dialog over a crawlable page breaks its first paint and its back button, and there is no stage to mount |
| **a third party** (Google, the payment provider)                                                   | unchanged: it leaves the product and returns                                | it is not ours to mount                                                                                   |

A wizard-route entry is therefore a `FlowEntryLink` (`components/assessment-flow/flow-entry-link.tsx`)
and nothing else: a `next/link` **soft navigation** — which is what lets the intercepted route draw
the stage over the page — that remembers the page and the control it was pressed on, so `Esc`, the X
and the overlay close back onto them with focus restored.

**The slot is declared per host segment, never on the product shell.** `@flow` sits beside the page
in each segment that carries a door — `/assessment`, `/templates/relationship` (and its `[slug]`),
`/dashboard/templates`, `/dashboard/relationships` — and intercepts all five stages there. Declared
once at `(mainlayout)/layout.tsx` it would also intercept one stage navigating to the next (stage 3's
"Continue" is a link) and draw a modal over the flow itself.

**Marketing keeps navigating.** `/relationship-types`, `/relationship-types/<slug>[/demo]`,
`/relationship-templates` and `/pricing` live in `app/(marketing)/**`; their controls resolve through
`lib/start-path.ts` to `/register?next=<stage>` for a visitor and the stage for a member, and they are
**not** converted. A dialog there would put an app shell on a crawlable page for a count.

### The invitation is the response path, and it enters at Account

The counterparty opens `/invite/<token>` and gets the same overlay: `StageShell` frames it,
`StageRail` draws the same five cells with **Account** current (nothing above it is available,
because the other person created the relationship), and closing leaves onto `/dashboard`. The three
onboarding screens — _What this is_, _What happens next_, _Your account_ — are that stage's body,
addressed by `?step=1|2|3` with the token in the path, so a refresh, a deep link and the sign-in
round trip all land on the same screen. There is no second stepper: the flow has one progress
pattern, the cell rail.

A completed response exits onto `/dashboard` for a signed-in claimer — the relationship is under My
relationships from that redirect on. A signed-out claim (postable, though the screens never offer
it: step 3 asks for an account instead) stays on the relationship it just bound, because
`/dashboard` would only bounce the browser to `/login` and lose the seat the claim set.

The refusal bands — a spent, expired, withdrawn or lapsed invitation link, and a browser that is
already a party — are **not** the response path: there is nothing to respond to, so they keep their
own surface and draw no rail.

## Stage 1, Details — the field inventory

This is the part that has drifted before, so it is written out. The card head carries the template's
name and its aspect count. **The completion order is the reading order** and is fixed:

| #   | Field                   | Label                                                            | Required    | Help                                                                                        | Column |
| --- | ----------------------- | ---------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------- | ------ |
| 1   | Title                   | `Your Personalized Relationship Title`                           | **yes (✱)** | `The personalized name of the created Relationship.`                                        | 6      |
| 2   | Initiator first name    | `Initiator First Name`                                           | **yes (✱)** | `The seat this relationship is created from.` (under the pair)                              | pair   |
| 3   | Initiator last name     | `Initiator Last Name` (placeholder `Required`)                   | **yes (✱)** | —                                                                                           | pair   |
| 4   | Counterparty first name | `Counterparty First Name` (placeholder `Their name`)             | **yes (✱)** | `They will complete their name preference when they claim the invitation.` (under the pair) | pair   |
| 5   | Counterparty last name  | `Counterparty Last Name` (placeholder `Optional`)                | no          | —                                                                                           | pair   |
| 6   | Counterparty email      | `Counterparty Email for Invite` (placeholder `name@example.com`) | **yes (✱)** | —                                                                                           | 6      |
| 7   | Description             | `Personalized Relationship Description`                          | no          | `Optional. Shown to both parties, never scored.`                                            | 12     |

The layout follows that order in two columns — the title beside the Initiator pair, the Counterparty
pair beside the email, and the description closing the form full width. **A pair is two controls in
one column** (title | pair, pair | email) and it collapses to one control each below 720px. A pair's
help line sits **under the pair**, never under one half of it, because half a column is too narrow
to read a sentence in.

Three rules follow from the inventory:

- **The title's default is derived, and it yields to the typist.** It reads `First L – First L`
  (`Daniel V – Rowan M`) from fields 2–5, recomputed on every keystroke, and it stops the moment
  someone types in the title itself. It is a default, never a value that overwrites an answer — and
  the "has been typed in" fact lives in the form's own state, never in `localStorage`, a second
  cookie or a hidden key: a title the draft already carries is the answer, and a draft with no title
  is a form that has not been typed in.
- **The description opens carrying the template's own sentence** (`template.summary`), because that
  is the sentence both people read on the card. It is the template's, not a second fixture; clearing
  it stores nothing, and a description the person wrote is theirs.
- **Required fields carry the red asterisk at the end of the label**, `aria-hidden` with a
  visually-hidden `required` beside it, so the requirement is audible and not only visible. The
  inputs also carry the browser's own `required`. Optional fields carry no marker and never the word
  "optional" in the label — the two `Required`/`Optional` **placeholders** above are the artifact's
  own, and they sit on the two halves whose requirement is not obvious from the label.

A refusal names the half it is about (`?field=initiator-last`), so the band says `Initiator Last Name
is required.` rather than naming a seat's full name for a field the person can see.

Heading `Relationship Details`, body `Name both people and the relationship. Everything here can
change later.`, primary action `Continue to Stage 2`, secondary actions `Back` and `Cancel` in the
foot's left group.

**Do not add a field the artifact does not draw**, and do not add a help line to a field that has
none — an extra sentence is a spec change, not a copy improvement. **Do not drop a field.** A form
that shows six of the seven is the drift this table exists to catch.

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

**Nothing is pre-selected, and the press says what is missing.** A default would be this form
choosing a bar for two people who never saw the question, so both groups arrive unchecked and both
are `required`. The consequence the stage has to own is what happens on a press with nothing chosen:
the group nobody answered prints the fixture's own `{field} is required.` sentence (`Opinions Mode is
required.`, `Alignment Setting is required.`) **at that group**, its radios carry `aria-describedby`
and `aria-invalid` while it stands, and the cursor lands on the first of them. The advance is never
disabled — a disabled control cannot be focused, so its reason cannot be reached from the keyboard —
and the sentence is never a toast, because it has to still be there while the person reads it. The
refusal clears group by group as choices land; with both answered the press posts. The form carries
`noValidate` to make that possible (a native-invalid form fires no `submit` event, so the screen could
draw nothing), which relaxes no field: every radio keeps `required`, and a crafted post is refused by
`modeDraft()` and lands back here as `?problem=invalid-input`.

**Fixed at creation means fixed per session.** `session.mode` is a column of the session row, and a
relationship holds rounds (`session.round`, unique per relationship) — so the next round is a new
session and may carry its own mode. What the chip forbids is a _mid-cycle_ switch: one party cannot
have answered two Opinion questions while the other answered four (#213). Choosing a mode between
rounds has no surface yet and is not this spec's promise.

## Stage 3, Aspects — the row is one line

A collapsed row reads `01 · ⠿ · name · opinions · ✎`: the position at the far left, read off the
row's index so a drag renumbers it and drawn as a span (a position, never a field); the drag
handle; the Aspect's name; the two ends of its scale; and the edit control as an icon carrying the
fixture's own word as its accessible name. No per-row origin chip — the template is named once, in
the stage body (#760). An open row closes through **Save or Cancel only**, and Cancel with
unsaved words asks first; the prompt is fixture copy.

**The list is editable, not just rewritable** (#699). Below the rows sit `Add an Aspect` and, on
each row, a remove control; the list can be added to, removed from and reordered, and the create
writes what the creator left. The **last** Aspect cannot be removed — at one row the control is
disabled and the stage body's floor sentence says why, because a relationship asks at least one and
`zAssessmentInstance.items` is `.min(1)`; the store refuses an emptied list (`aspects-none`) rather
than writing an instance no page can parse.

What the create writes is one of two things, and the database records which:

| The list at create                   | What is written                                                | V4 asks                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Reworded only (same ids, same order) | The version's ids and order, the person's words                | The copy **equals** its pinned version                                                                   |
| Added, removed or reordered          | The creator's list, in their order, an id minted per added row | The copy **is a list of Aspects**: at least one, unique ids, dense positions, each row through `zAspect` |

The second row stamps `session.aspects_authored_at`; the first leaves it `NULL`, which is also the
answer for every copy written before the column existed. V4 is not weakened by this — it is asked
of exactly the copies that are still copies, and the authored ones are held to the model instead of
to an equality that was never true.

The stage body ends with the drag instruction — `… and drag to reorder them.` — rather than a
separate "Drag to Reorder Aspects" line above the list. The gesture belongs to the sentence that
tells the reader what the list is.

## Stage 4, Account — the invitation is sent from here

Account is where the creator gets an account: it mounts the app's **one** sign-in implementation,
`components/auth/login-view.tsx`, with `layout="embedded"` (#824) — no hero panel, no page-level
`min-h-screen` frame, sized for the stage column. It opens on **sign-up**, and the sign-in /
sign-up switch happens **in place**: leaving the overlay for `/register` and coming back would lose
the stage the person was in.

Completing stage 4 writes the relationship with `status = 'draft'` and the signed-in account as its
Initiator, then advances to stage 5. Nothing is sent by that write. A visitor who abandons here
leaves no relationship behind — the draft cookie is the only thing that existed before it.

The relationship's shape — one template, two seats, the aspect count, the parties, the title — is
drawn in this stage's right column, because those facts are all known before the account is chosen
and repeating them on Invite is one card too many.

## Stage 5, Invite — the payment walk, and the send it unlocks

Stage 5 is one decision drawn in two columns, and the gate between them is the stage (#911). The
**left column is a three-step walk** (`components/assessment-flow/invite-walk.tsx`), in this order:

| Step | The panel                                                                                                                                   | Ends by |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | **Plan** — the membership plans, and the two things the money buys: _join membership plan_ and _activate relationship_                      | `Next`  |
| 2    | **Card** — the card, captured by `components/billing/stripe-frame.tsx`, the app's one implementation of a card                              | `Next`  |
| 3    | **Thank you** — one message and **no button**. The walk ends here, and its sentence says where the reader goes next: the send, or the draft | nothing |

**The right column is the send, and the walk gates it.** Before the card is on file the column is
inactive — `data-send-gate="locked"`, a dashed border, a muted heading — and the confirm control is
`disabled` **beside the sentence that says what unlocks it**, never a bare greyed button. Once the
card is on file the column takes the action border and the confirm control enables, reading
**`send email to counterparty now`**. The lock is enforced twice: the disabled attribute is the
courtesy, and `sendDraftInvitation()` refuses a relationship with no captured method
(`no-payment-method`) in the write, so a crafted POST cannot publish an unpaid draft.

**Saving a card charges nothing.** The method goes on file and the trial starts; the fee is taken by
the product's own completion path, never by the walk. The card step says so in as many words.

**Keeping the draft is always the other choice.** An ordinary link beside the walk, present in both
states at every step: no plan, no card, nothing charged, the relationship stays `draft` and the
dashboard lists it. That link is what makes the locked state a decision instead of a dead end.

**The words are the product**: _join membership plan_, _activate relationship_, _send email to
counterparty now_. `purchase`, `buy` and `save payment method` appear nowhere in the stage — the
thing being paid for is a membership plan and an activated relationship, and not a checkout.

The confirmation that follows is **unnumbered**: it is proof the invitation left, not a sixth stage.
It carries the resend control, the copy-link control, the waiting status (`Invited — waiting for
<name> to accept`) and the "what happens next" explainer. Those affordances are the ones the retired
Connect stage used to hold; the dashboard's relationship detail owns the same two controls for every
later visit.

## How this is enforced

- `tests/flow-stages.test.ts` reads `data/pages/lifecycle.ts` and fails unless the stage words are
  exactly these five, in this order, with `Stage {step} of 5`, and fails on the word `Ongoing`
  anywhere in the flow's copy or routes. It fails if the rail draws a `Connect` cell or an `Align`
  cell — neither is a stage of this flow.
- `tests/create-fields.test.ts` pins the stage 1 inventory above against
  `data/pages/assessment-create.ts` — field ids, labels, placeholders, required markers and help,
  in order — so a silent eighth field or a dropped seventh is red.
- `tests/stage-one-title.test.tsx` mounts the form's fields in jsdom and types into them: the title
  derives as `Daniel V – Rowan M`, drops an initial when a last name is missing, and **stops**
  following the names the moment somebody types in it — and the module it drives names no browser
  storage, so the derivation cannot survive a reload by writing one.
- `data:check` E10 still holds every flow `href` to the route manifest, so a retired
  `/…/create/account` route cannot quietly return, and a `/…/ongoing` route cannot arrive.
- `tests/invite-response-shell.test.tsx` renders the response stage through `StageShell` and fails
  if it stops drawing the five-stage rail at Account, drops off the shared stage column, gains a
  second progress band, or exits onto anything but the screens `afterClaimTarget()` names.
- `tests/stage5-send-gate.test.tsx` renders stage 5 in both gate states and fails if the send is
  ever enabled before a card is on file, if the locked column loses the sentence that explains the
  disabled control, if the draft link is missing or disabled in either state, if
  `sendDraftInvitation()` stops refusing `no-payment-method`, or if this file's stage-5 section
  drifts back to send-or-draft.
- `tests/flow-ui-parity.test.tsx` pins the conformance rules of the v7 pass (#760) to rendered
  markup: the panel's `lg:max-w-[880px]` cap, one foot per stage with `[Back][Cancel]` as a left
  group and the advance flush right, two `fieldset`s on Settings sharing one radio component, and
  an Aspect row that opens with its index and closes only through Save or Cancel.
- The gate itself (`bash scripts/verify.sh`) runs those tests in every code lane. Nothing here is a
  convention a reviewer has to remember.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › The five flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

<!-- docs-nav:end -->
