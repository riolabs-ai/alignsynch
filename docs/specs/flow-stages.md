# The relationship flow — the five stages, and what each screen is

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › The five flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

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

| #   | Stage        | The screen asks                                                                                                               | Ends by                                                                                                                                              |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Details**  | Who the two people are, the invitation address, what the relationship is called and why                                       | `Continue to Stage 2` (Settings)                                                                                                                     |
| 2   | **Settings** | The mode (fixed per session) and the setting a party may later move                                                           | `Continue to Stage 3` (Aspects)                                                                                                                      |
| 3   | **Aspects**  | Which aspects this relationship asks, in order, each one inspectable in place, and the creator may add or remove one          | `Continue to Stage 4` (Account)                                                                                                                      |
| 4   | **Account**  | The account the invitation is sent from — signing up or in writes the relationship as a **draft**                             | `Continue to Stage 5` (Invite)                                                                                                                       |
| 5   | **Invite**   | The walk — the plans compared, then the free week (no card at any step) — and the act: send the invitation, or keep the draft | `Send Email to Counterparty Now` → **`/dashboard/relationships/<id>`**, the relationship published; or keep the draft → the same page, still a draft |

**The foot is one shape on stages 1–5** (#760): `[Back][Cancel]` as a single left group and the act
that advances the flow flush right. `Cancel` leaves the flow — it goes where the shell's close goes,
to the template library — while `Back` is the stage before. Below 560px the row cannot hold three
controls, so the advancing act takes a full-width row of its own above the pair. The advance names
the stage it goes to, never what that stage asks.

**Stage 5 is the one exception, and it is the foot's shape all the same** (#1014): its advancing act
is the walk's own last step, so the foot draws `[Back][Cancel]` and no advance. Putting a send in the
foot as well would be a second control for the act the walk already offers, and "one act, one control"
outranks the row's symmetry.

**There is no `Ongoing` stage.** "Ongoing" is not a screen: once the flow completes, the reader is
taken to the **relationship detail page** in the member dashboard, which is where every later cycle
of the relationship lives.

### Align is not a stage

`Align` is the dashboard's surface, not a cell in the rail. It is live once **one or more
assessments are shared** — in progress or completed — and it is read on the relationship detail
page. The creation modal therefore prints **`Stage {n} of 5`** and never numbers `Align`: a cell
the creator can reach inside the flow would claim the flow ends somewhere it does not.

Since #1123 the v2 rail draws `Align` as a **dashed preview row after the five** — the sixth
position, labelled `Starts when <Counterparty> joins`. It is a preview and not a cell: it carries
no step number a person can press, no link, no `aria-current` and no `data-step-cell`, and the card
above it still prints `Stage {n} of 5`. A preview says when the next surface starts; a cell would
say the flow goes there.

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

**Since #1123 the create flow's panel is the wide variant — 1180px, and the cap is the only thing
that changes.** The v2 wizard draws a 260px sticky rail (the setup gauge, the five rows, the Align
preview and the live `Your Relationship` summary) beside one stage card, and a rail plus a readable
card does not fit in the reading width. The overlay, the sheet below 1024, the dismissal and the
one scroll container are unchanged; every other flow screen keeps the 880px cap. The same card adds
the flow's own header inside the panel — `Create Relationship` on the left, `Save and Exit` (a
visitor's `Exit`) as the one close control on the right — so the dismiss word is the bundle's and
the floating X is not drawn twice.

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
`/relationship-templates` and `/pricing` live in `app/(marketing)/**`; their create controls resolve
through `lib/start-path.ts` to **stage 1 of the wizard, for every viewer**, and they are **not**
converted into the flow's dialog. A dialog there would put an app shell on a crawlable page for a
count.

**One intent, one door (#1042).** Every action whose intent is to create a relationship opens stage 1
— for a visitor, a returning signed-out user and a member alike — and the account is settled at
**stage 4**, inside the wizard where the draft already is:

| the action's fixture                                                   | where it goes                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| a template's own action (`template-use`, a catalogue card)             | `/templates/relationship/<slug>/create` — the chosen template travels in the path                                        |
| a **generic** create action ("Create a relationship")                  | `/templates/relationship/blank-template/create` — the platform's blank template; the person names it at Details          |
| an **account-only** action (`/register`: Sign Up, "Start your 7 days") | `/register` for a visitor, the brand's account home for a member — a membership or account intent is not a create intent |

`/register?next=<stage>` was the old form of the first row (#867): the account first, the stage
after sign-up. It landed a signed-out visitor on a sign-up form for a flow whose own first screen
needs no session, so the draft could not survive the round trip and one intent had three doors. The
`next=` unwrapping still exists in `lib/start-path.ts` for an authored link that carries one, and it
now resolves to the same screen for both viewers.

### The invitation is the response path, and it enters at Account

The counterparty opens `/invite/<token>` and gets the same overlay: `StageShell` frames it,
`StageRail` draws the same five cells with **Account** current (nothing above it is available,
because the other person created the relationship), and closing leaves onto `/dashboard`. The stage's
body is `components/assessment-flow/claim-form.tsx`: **two fields, one screen** (#1115 task 4) — the
name the invitation already carries, prefilled, and the address it was sent to. There is no
`?step=1|2|3` addressing any more; the three onboarding screens (_What this is_, _What happens next_,
_Your account_) were retired with their copy, because a claim that asks for a password, a plan or a
price is the friction #1115 exists to remove (US-2: "at most two fields before the counterparty can
begin answering"). An old `?step=` link still resolves — it lands on this screen and the parameter is
ignored, since a copy of the link in somebody's mail client cannot be rewritten. There is no second
stepper: the flow has one progress pattern, the cell rail.

The address is the second credential, because the password went away. A claim whose address is not
the one the invitation was sent to is refused with `email-mismatch` and claims nothing; a repeat
submit from the right address **resumes** the seat in a new browser rather than dead-ending on "used
already" — the person clicking their own link twice is not an error, and the `party` row's own
`access_token_hash` is replaced, never a second row or a second account. The account the claim binds
is resolved before the claim's transaction: `lib/auth/claim-account.ts` answers the id an existing
address already has, or creates one through the branch's own `sign-up/email` (the call
`scripts/db-seed.mjs` makes) and relays that sign-up's session cookies. A tree with no auth server
still claims — the seat is bound to the browser's cookie and the person signs in later.

A completed response exits onto `/dashboard`: with the account resolved, a claim that started signed
out ends signed in, which is the journey #1115 D1 asks for — _both parties able to access the
dashboard and the first assessment session, not when they share or publish their opinions_. A
browser that holds the seat but no session stays on the relationship it just bound, because
`/dashboard` would only bounce it to `/login` and lose the cookie the claim set.

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

**Since #1123 that column is the wizard rail's `Your Relationship` summary (#1123).** The v2 bundle
draws Stage 4 as the account and nothing else, with the shape of the relationship in the rail beside
every stage, so the review card that used to sit inside the stage is gone: one statement of the
facts, on the surface that carries them for all five stages, instead of a second copy inside one of
them.

## Stage 5, Invite — the walk, the act inside it, and the relationship it lands on

**No step of the create flow takes a card (#1115).** The account's seven-day trial is opened by the
**Counterparty's acceptance** — `grantAcceptanceTrial()` in `lib/db/billing.ts`, called from
`claimInvite()` inside the transaction that binds the second seat and turns the relationship
`active` — so a **draft** and a **pending invitation consume no trial days**: an invitation nobody
answers costs nothing. Stage 5's panel therefore states the week, prints its end date only when a
week is actually running (a returning creator whose Counterparty accepted), and its primary action
is **`Continue with 7 days free`** — one press, no plan selection, no price to clear and no card
field anywhere. A rendered create stage contains **0** card-number, expiry, CVC or
billing-postcode inputs, and `tests/trial-no-payment-inputs.test.ts` measures that on every stage of
the flow. The purchase flow the table below describes (plan → card → thank you → the act) is
**retained in `invite-walk.tsx`, not deleted**, because the explicit "add a payment method" upgrade
action is its only caller; the create path mounts the walk with no checkout handler, which is what
makes the card step unreachable from any stage of this flow.

Stage 5 is one decision, drawn as **one four-step walk** in one column
(`components/assessment-flow/invite-walk.tsx`), in this order:

| Step | The panel                                                                                                                                          | Ends by |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1    | **Plan** — the membership plans, and the two things the money buys: _join membership plan_ and _activate relationship_                             | `Next`  |
| 2    | **Card** — the card, bought through `components/billing/stripe-frame.tsx`, the app's one implementation of a card, plus the reason it is asked for | `Next`  |
| 3    | **Thank you** — one message and **one button** that opens the last step                                                                            | the act |
| 4    | **Action** — the send, and under every step of the walk, the draft: **the act is in the walk**                                                     | —       |

**The act is inside the walk, and it is one control per act (#1014).** Step 4 draws
**`Send Email to Counterparty Now`** — the same write stage 5 has always made, `POST
/assessment/instances/<id>/send`, which publishes the relationship, mails the one invitation and
writes the Initiator's own copy of the link — and every step of the walk draws **the draft**, which
is a navigation rather than a write: stage 4 already wrote the row as a `draft`, and nothing but the
send ever publishes it, so the control cannot make a second one. There is no send card beside the
walk and no second send in the foot: the walk carries the act, and the column beside it carries the
two sentences that make keeping a draft safe to choose.

**Both endings land on the relationship** — **`/dashboard/relationships/<id>`**, the new
relationship's own member-dashboard view, showing it in the state the act produced: `Published` with
a live invitation, or `Draft`. Not the session screen, and not the post-send confirmation, which
stays as an unnumbered screen for the send's own outcome and is no longer where the flow ends.

**Both endings `replace` the walk's history entry.** Since #1009 the shell's dismissal is a history
pop, so an entry the flow leaves behind is a dialog `Back` walks into. The draft control is a
`next/link` with `replace`; the send reads the endpoint's own 303 and replaces. `Back` from the
landed relationship therefore goes to whatever the flow was opened from, never back into the walk.

**The walk does not gate the send on a payment, and nothing is drawn for one.** The week a create
opens is not charged to the creator, so there is no membership to wait for at the send: the walk's
send control exists on its last step as soon as the reader gets there, and the **draft** is offered
beside every step. The one lock on the send is the authorisation, and it is in the write:
`sendDraftInvitation()` publishes only a relationship this browser answers as the **Initiator** of,
and only from `draft`/`pending` — a crafted POST cannot publish somebody else's draft or re-publish
one already out.

**No membership fact is read to authorise a send (#1115, spec D3).** #911/#1010 R2 gated the send on
the Initiator's live subscription (`no-payment-method`), which was coherent only while the trial was
granted at creation. The anchor moved to the Counterparty's acceptance — so at the instant a draft is
sent there is no acceptance, no subscription and no week — and the gate would refuse every send the
flow depends on. It is gone, and a pending invitation costs nothing.

**The purchase charges nothing today.** The membership is a subscription with a seven-day trial: the
card is the plan's, and the walk's card step says so in as many words.

**A plan chosen on `/pricing` arrives here already selected (#1043).** The pricing page sells nothing
itself: every action on it opens the public template catalogue, and a plan card's action carries the
tier and the interval (`/pricing/start` → `303` → `/relationship-templates`). The pair is recorded on
the browser as one small intent (`lib/flow/plan-intent.ts`), because the pages between — the
catalogue, the twenty-seven taxonomy pages, stage 1, the sign-in at stage 4 — are prerendered on
purpose and must not learn about it to pass it along. When stage 5 mounts, the matching row is
**already checked** (`data-plan-carried` on the walk, the row's own radio `checked`) and its panel
carries the one control that opens the card step, since a checked radio fires no `change`. Choosing
the other row still starts the checkout directly, exactly as it does when nothing was carried; a
choice that arrived is reviewable, changeable, and **never charged here** — the membership is a
comparison this panel starts from, and the forced downgrade it arrives with is chosen, not charged.

**The words are the product**: _join membership plan_, _activate relationship_, _send email to
counterparty now_. `purchase`, `buy` and `save payment method` appear nowhere in the stage — the
thing being paid for is a membership plan and an activated relationship, and not a checkout.

## How this is enforced

- `tests/flow-stages.test.ts` reads `data/pages/lifecycle.ts` and fails unless the stage words are
  exactly these five, in this order, with `Stage {step} of 5`, and fails on the word `Ongoing`
  anywhere in the flow's copy or routes. It fails if a rail draws a `Connect` cell or an `Align`
  **cell** — neither is a stage of this flow; since #1123 the create flow's own rail may draw
  `Align` only as the dashed preview row, which `tests/wizard-v2-layout.test.tsx` holds to the shape
  above (no step number, no link, no `data-step-cell`).
- `tests/create-fields.test.ts` pins the stage 1 inventory above against
  `data/pages/assessment-create.ts` — field ids, labels, placeholders, required markers and help,
  in order — so a silent eighth field or a dropped seventh is red.
- `tests/stage-one-title.test.tsx` mounts the form's fields in jsdom and types into them: the title
  derives as `Daniel V – Rowan M`, drops an initial when a last name is missing, and **stops**
  following the names the moment somebody types in it — and the module it drives names no browser
  storage, so the derivation cannot survive a reload by writing one.
- `data:check` E10 still holds every flow `href` to the route manifest, so a retired
  `/…/create/account` route cannot quietly return, and a `/…/ongoing` route cannot arrive.
- `tests/pricing-plan-carry.test.tsx` holds the whole carry (#1043): which pairs a card may carry,
  the cookie round trip, the tier→row crossing read backwards off `PLAN_BILLING_TIER`, the route's
  `303` and its clear-on-nothing policy, and the walk drawing the carried row checked with the
  carried interval in the checkout it starts.
- `tests/invite-response-shell.test.tsx` renders the response stage through `StageShell` and fails
  if it stops drawing the five-stage rail at Account, drops off the shared stage column, gains a
  second progress band, or exits onto anything but the screens `afterClaimTarget()` names.
- `tests/stage5-send-gate.test.tsx` renders stage 5 in both gate states and fails if the draft link
  is missing or disabled in either state, if `sendDraftInvitation()` starts refusing a send on a
  membership fact again (the trial opens at acceptance, so no membership exists at the send), or if
  this file's stage-5 section drifts back to send-or-draft.
- `tests/trial-acceptance.test.ts` holds the anchor: a create and a send write **no**
  `billing_subscription` row, the acceptance writer is exported and account-keyed, and no grant call
  survives in the create path. `tests/claim-trial.test.ts` holds the other side — the claim writes
  exactly one `mock`/`trialing` row, ending seven days after the acceptance instant.
- `tests/flow-ui-parity.test.tsx` pins the conformance rules of the v7 pass (#760) to rendered
  markup: the panel's `lg:max-w-[880px]` cap, one foot per stage with `[Back][Cancel]` as a left
  group and the advance flush right, two `fieldset`s on Settings sharing one radio component, and
  an Aspect row that opens with its index and closes only through Save or Cancel.
- The gate itself (`bash scripts/verify.sh`) runs those tests in every code lane. Nothing here is a
  convention a reviewer has to remember.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Specs & design briefs** › The five flow stages (binding spec) · prev [Re-invite](flow-reinvite.md) · next [Maintenance fields](maintenance-fields.md)

<!-- docs-nav:end -->
