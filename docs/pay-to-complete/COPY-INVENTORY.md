# Payer copy inventory — what is already shipped, and where

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Payer copy inventory · prev [Research](RESEARCH.md) · next [Payer-present state](PAYER-PRESENT.md)

<!-- docs-nav:end -->

The payer surfaces (a card on file, a fee at completion, a method-capture choice) have **no UI** in
this tree. The two actions exist — `capturePaymentMethodAction` (`app/(mainlayout)/dashboard/relationships/actions.ts:405`)
and `completeRelationshipAction` (`…actions.ts:445`) — and **nothing calls either**: `grep -rn
"capturePaymentMethodAction\|completeRelationshipAction" app components lib tests` returns no hit
outside the file that defines them. Every control that would pay is `disabled`
(`components/dashboard/relationship-cards.tsx:191-196`).

So the words are the part that already exists. This document is the inventory of them: each row is
the **exact text** and the **file:line** that holds it. No row invents a string. A row marked
**ABSENT** is a string a payer surface needs and the tree does not have; those are the owner's copy
to write, not this document's.

Two rules the inventory rests on:

- **Copy is a fixture, never a component.** Every reader-visible word resolves from
  `data/pages/<surface>.ts` through `itemLabel` / `sectionOf` (`data:check` E23 holds each surface to
  a literal budget), so a label's real home is the fixture line, and the component line only renders
  it.
- **A quote is verbatim or it is absent.** A string assembled from data (`formatCurrencyAmount`,
  `fillLabel`) is listed as **composed** with its parts, because there is no literal to reuse.

## 1. The list card — `Paid`, and the block the counterparty is never handed

`components/assessment-flow/my-instances.tsx:455-479` draws the block; `:198` binds the section;
`:52` is the absent figure. A non-initiator is handed `paid: null` by the read
(`lib/db/assessments.ts:522`), so the block is not drawn at all for them.

| exact text               | where                                            | kind                    |
| ------------------------ | ------------------------------------------------ | ----------------------- |
| `Paid`                   | `data/pages/assessment-instances.ts:130`         | label                   |
| `No plan yet`            | `data/pages/assessment-instances.ts:131`         | label (the empty state) |
| `{plan} · bought {date}` | `data/pages/assessment-instances.ts:132`         | fill template           |
| `—`                      | `components/assessment-flow/my-instances.tsx:52` | absent figure           |

## 2. The instance screen — the payer's own paid panel

Rendered where the plan and the purchase instant are facts about the initiator alone
(`data/pages/assessment-instance.ts:266-276`).

| exact text                                    | where                                   |
| --------------------------------------------- | --------------------------------------- |
| `What was paid`                               | `data/pages/assessment-instance.ts:271` |
| `Plan`                                        | `data/pages/assessment-instance.ts:273` |
| `Bought {date}`                               | `data/pages/assessment-instance.ts:274` |
| `Nothing has been paid on this relationship.` | `data/pages/assessment-instance.ts:275` |

The state this panel sits under — both sheets sealed, the fee unsettled
(`data/pages/assessment-instance.ts:66-68`):

> `Sharing — both sheets are sealed; the Gap opens when the assessment is published.`

## 3. The dashboard card — the four actions, two of them disabled

Fixture `data/pages/dashboard-relationships.ts:73-90`; rendered
`components/dashboard/relationship-cards.tsx:170-201`.

| exact text              | where                                      | shipped state                             |
| ----------------------- | ------------------------------------------ | ----------------------------------------- |
| `Open Assessment`       | `data/pages/dashboard-relationships.ts:79` | link when a session exists, else disabled |
| `Publish Assessment`    | `data/pages/dashboard-relationships.ts:80` | link                                      |
| `Activate Relationship` | `data/pages/dashboard-relationships.ts:81` | **disabled**                              |
| `Gap Analysis`          | `data/pages/dashboard-relationships.ts:82` | **disabled**                              |

The sentence under the four controls (`:85-87`), which is the only place the product says out loud
why two of them do nothing — and the string that must be **replaced**, not kept, when payment ships:

> `Payment is not built yet, so Activate Relationship stays disabled. Gap Analysis opens once both people have accepted the assessment.`

## 4. The publish panel — the closest shipped thing to a pay step

`data/pages/dashboard-relationship-detail.ts:101-135`; rendered
`components/dashboard/relationship-detail.tsx:435-525`.

| exact text                          | where                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `Publish`                           | `data/pages/dashboard-relationship-detail.ts:103` (heading)                                   |
| `Publish and invite`                | `data/pages/dashboard-relationship-detail.ts:131`                                             |
| `A checkout has to complete first.` | `data/pages/dashboard-relationship-detail.ts:134`, and again as `checkout-required` at `:296` |

`Publish and invite` is the shipped label for the act `completeRelationshipAction` performs — it is
**not** the same string as the card's `Publish Assessment`. The mockup uses the card's, which will
read as a second name for one act on the screen that actually charges.

## 5. The create stages — where the choice would go, and what is there instead

The rail and the last step, `data/pages/assessment-create.ts:39-43` and `:113-119`:

| exact text                | where                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| `Products`                | `data/pages/assessment-create.ts:39`                                    |
| `This product`            | `data/pages/assessment-create.ts:40`                                    |
| `Create the relationship` | `data/pages/assessment-create.ts:41`, and as the submit label at `:115` |
| `Step {step} of 3`        | `data/pages/assessment-create.ts:42`                                    |
| `Creating a relationship` | `data/pages/assessment-create.ts:43`                                    |

> `Submitting copies the Aspects, creates the relationship and sends one invitation. Nobody has answered anything yet.` — `data/pages/assessment-create.ts:116-119`

**There is no payment step and no pay-now/pay-later control on this screen.** `CreateRelationship`
(`components/assessment-flow/create-relationship.tsx`) renders template, seats, Mode, Setting, submit
— nothing else.

**The shipped pay-later sentence already exists, one screen earlier**
(`data/pages/assessment-template-detail.ts:82-84`):

> `Creating a relationship is free. Your plan decides how many you may hold at once, and it is chosen when a relationship is ready to complete, not here.`

with `Create Relationship` (`:80`) and `See plans and prices` (`:86`) beside it. That is the tree's
one statement of the model the payer UI is being drawn for, and it is on the **template detail**
page, not at the end of the create stages.

## 6. Plan and price labels a payer surface may reuse

| exact text                     | where                                                                                        | kind                   |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------- |
| `Free` / `Basic` / `Principal` | `data/billing-plans.ts:107`, `:125`, `:144`                                                  | tier names             |
| `Start free`                   | `data/billing-plans.ts:119`                                                                  | free plan CTA          |
| `Choose Basic`                 | `data/billing-plans.ts:138`                                                                  | CTA                    |
| `Choose Principal`             | `data/billing-plans.ts:157`                                                                  | CTA                    |
| `mo`                           | `data/pages/pricing.ts:80`                                                                   | price suffix           |
| `mo, billed yearly`            | `data/pages/pricing.ts:81`                                                                   | price suffix           |
| `{price} per relationship`     | `data/pages/templates.ts:57`, `data/pages/dashboard-templates.ts:63`                         | fill template          |
| `Ready to publish`             | `data/pages/dashboard-relationships.ts:53`, `data/pages/dashboard-relationship-detail.ts:53` | status                 |
| `Read-only`                    | `data/pages/dashboard-relationships.ts:64`                                                   | membership consequence |

`$8.95/mo` is **composed, not literal**: the tier's `name` plus
`formatCurrencyAmount(monthlyCents)` (`data/billing-plans.ts:127`, `monthlyCents: 895`) plus the
`mo` suffix. No file contains that string.

## 7. Payer-adjacent strings the counterparty's screen also carries

Useful because the blind rule has to hold in words, not only in markup.

| exact text                                                                                                           | where                                          |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `The membership behind this relationship ended`                                                                      | `data/pages/assessment-instance.ts:254`        |
| `… until a payment lands this relationship is read-only for both of you …`                                           | `data/pages/assessment-instance.ts:255` (body) |
| `Your answers are kept and stay readable. The relationship becomes writable again if the initiator's payment lands.` | `data/pages/assessment-instance.ts:260`        |
| `You have both answered`                                                                                             | `data/pages/assessment-instance.ts:117`        |
| `Yours to answer`                                                                                                    | `data/pages/assessment-instances.ts:154`       |
| `Waiting for {name} to answer.`                                                                                      | `data/pages/assessment-instances.ts:155`       |
| `You have both accepted — the Gap is open`                                                                           | `data/pages/assessment-instances.ts:156`       |
| `Waiting on the other party`                                                                                         | `data/pages/assessment-instances.ts:187`       |

## 8. Strings a payer surface needs that the tree does **not** have

Each row is a grep that returned no label. They are not omissions of this inventory — they are the
copy that has to be written before the surfaces in the mockup can ship.

| what the surface needs                  | the search                                     | result                                                                                                                 |
| --------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| card number / expiry / CVC field labels | `grep -rni "card number\|\bCVC\b\|expiry"`     | only `data/pages/legal.ts:337` prose and invitation-expiry rows — no field label                                       |
| a card-capture surface at all           | `grep -rln "stripe\|Elements" components app`  | no capture component; `app/api/billing/**` only                                                                        |
| `Approve payment`                       | `grep -rn "Approve payment"`                   | zero                                                                                                                   |
| `Your bank needs you …` (§9 band)       | `grep -rn "Your bank needs you"`               | zero                                                                                                                   |
| a `needs-action` outcome word           | `grep -rn "needs-action"`                      | prose only — `docs/pay-to-complete/ADR.md:67`, `RESEARCH.md:97`                                                        |
| a pay-now / pay-later control label     | `grep -rni "pay now\|pay later\|decide later"` | comments only — `actions.ts:399`, `lib/member/payment.ts:8`, `lib/billing/port.ts:44`, `PRD.md:91`; no rendered string |
| reminder / retry / expiry copy          | `grep -rni "reminder"` on fixtures             | no payer reminder label                                                                                                |

`lib/member/payment.ts:12-14` says `capturePaymentMethod` "is offered at the end of the create
stages and again when the payer publishes". That is a promise in a docstring; §5 above is the
measurement that no screen offers it.

## 9. Gaps against `mockup-pay-to-complete-v2-final.html`

The revision this section asks for now exists:
[`mockup-pay-to-complete-v1.html`](mockup-pay-to-complete-v1.html) — committed beside this file so it
is reviewable in a diff rather than living in a card attachment. It carries the three surfaces #619
asks for, marks every string with a kind and a source, and generates its copy ledger from the page
instead of typing one over it. It is **not** production UI: no route renders it and nothing imports it.

The filename is `v1` because that is the path the card and this document name. The older artifact is
`/home/jadenblack/.hermes/kanban/boards/alignsynch/attachments/t_5d16034f/mockup-pay-to-complete-v2-final.html`,
whose own copy ledger is at its line 545ff ("15 verbatim, 1 near-verbatim, 7 proposed"). The two rows
below are why it was not revised in place: its ledger claims verbatim status for strings that are
stale, composed or absent, and a ledger typed by hand over a screen drifts from the screen.

Verified row by row against the tree:

| the ledger claims                                                                                                                                     | the tree says                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Publish Assessment` — `dashboard-relationships.ts:80`                                                                                                | correct                                                                                                                                                                                                                                                 |
| `Activate Relationship` — `:81`                                                                                                                       | correct                                                                                                                                                                                                                                                 |
| `Open Assessment` — `:79`                                                                                                                             | correct                                                                                                                                                                                                                                                 |
| `Gap Analysis` — `:82`                                                                                                                                | correct                                                                                                                                                                                                                                                 |
| `Plan` — `assessment-instance.ts:273`                                                                                                                 | correct                                                                                                                                                                                                                                                 |
| `Paid` — `assessment-instances.ts:130`                                                                                                                | correct                                                                                                                                                                                                                                                 |
| `Nothing has been paid on this relationship.` — `:275`                                                                                                | correct                                                                                                                                                                                                                                                 |
| `Sharing — both sheets are sealed …` — `:66-68`                                                                                                       | correct (label on line 68)                                                                                                                                                                                                                              |
| `You have both answered` — `assessment-instance.ts:141`                                                                                               | **stale line** — it is `:117`                                                                                                                                                                                                                           |
| `Create the relationship` — `assessment-create.ts:123`                                                                                                | **stale line** — submit label is `:115`, the rail item `:41`                                                                                                                                                                                            |
| `Step 3 of 3 · Creating a relationship · Products · This product` — `:42-45`                                                                          | real, but the labels are `:39-43`, not `:42-45`                                                                                                                                                                                                         |
| `Basic · $8.95/mo` — `billing-plans.ts:124-127`, `template-card.tsx`                                                                                  | **composed, not literal** — see §6                                                                                                                                                                                                                      |
| `per relationship` — `templates.ts:57`                                                                                                                | correct (`:57`)                                                                                                                                                                                                                                         |
| `Ready to publish · Publish · Your instance` — `dashboard-relationships.ts:53` · `dashboard-relationship-detail.ts:103` · `assessment-instance.ts:26` | correct                                                                                                                                                                                                                                                 |
| `Waiting for Daniel to publish` — "verbatim (owner's rule), issue #619"                                                                               | **no source in the tree**. The nearest shipped shape is `Waiting for {name} to answer.` (`assessment-instances.ts:155`), a _state_ sentence about answering, not a publish sentence. As it stands this row is invented copy carrying a verbatim marker. |
| `pay now · later` — near-verbatim                                                                                                                     | correct to call it near-verbatim: the phrase lives only in code comments and `PRD.md:91`, never in a rendered string                                                                                                                                    |

Shipped labels the ledger **does not list**, and the mockup therefore does not use:

| shipped text                         | where                                                     | why the mockup needs it                                    |
| ------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------- |
| `No plan yet`                        | `data/pages/assessment-instances.ts:131`                  | the list card's own empty state for an unpaid relationship |
| `{plan} · bought {date}`             | `data/pages/assessment-instances.ts:132`                  | how that card says what was paid, once it is               |
| `What was paid`                      | `data/pages/assessment-instance.ts:271`                   | the panel's heading on the instance screen                 |
| `Bought {date}`                      | `data/pages/assessment-instance.ts:274`                   | the date half, already worded                              |
| `Publish and invite`                 | `data/pages/dashboard-relationship-detail.ts:131`         | the shipped label for the act that charges                 |
| `A checkout has to complete first.`  | `data/pages/dashboard-relationship-detail.ts:134`, `:296` | the shipped sentence for a payment-required outcome        |
| `Payment is not built yet …`         | `data/pages/dashboard-relationships.ts:85-87`             | the note that ships today, and must be replaced not kept   |
| `Creating a relationship is free. …` | `data/pages/assessment-template-detail.ts:82-84`          | the model's one shipped statement of pay-later             |
| `Read-only`                          | `data/pages/dashboard-relationships.ts:64`                | the membership consequence the payer changes               |

**Net gap list for the mockup, in one line each:**

1. The card-input widget has **no copy anywhere**; its three field labels are new strings by
   definition (§8). Either they are approved as new copy, or the widget is a hosted-page redirect and
   the tree gains nothing to label.
2. The pay-now/pay-later _choice_ has no shipped label (§8) — but the model it implements already has
   a shipped sentence, `assessment-template-detail.ts:82-84`, which the mockup does not use.
3. The create stages end at `Create the relationship` + the submit note (§5). A payment choice there
   is a new screen, not a new sentence on an existing one.
4. `Waiting for Daniel to publish` is the one ledger row claiming verbatim status without a source.
   It must be replaced by a `{name}`-shaped fixture string, or dropped.
5. The §9 payer-present state (`Approve payment`, the band's sentence) has no shipped copy at all,
   matching ADR §9's own "what remains" note.
6. The mockup labels the charging act `Publish Assessment` on the panel where the tree already ships
   `Publish and invite`; pick one, per surface, before the UI is written.

## How to re-check this document

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
grep -n "label" data/pages/assessment-instances.ts      # §1
sed -n '266,276p' data/pages/assessment-instance.ts     # §2
sed -n '73,90p'  data/pages/dashboard-relationships.ts  # §3
sed -n '101,135p' data/pages/dashboard-relationship-detail.ts  # §4
sed -n '39,43p;113,119p' data/pages/assessment-create.ts # §5
grep -rn "capturePaymentMethodAction\|completeRelationshipAction" app components lib tests  # §0
```

A row in §8 stays true only while its grep returns no label: if a label appears, move the row into
its surface table with the new `file:line` rather than editing the absence claim.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Product** › Payer copy inventory · prev [Research](RESEARCH.md) · next [Payer-present state](PAYER-PRESENT.md)

<!-- docs-nav:end -->
