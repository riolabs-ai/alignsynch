# A member can pay — capture a method, complete, and the Gap opens (#739)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Payment capture & completion · prev [Flow validation, 2026-11-07](../qa-flow-validation/2026-11-07.md) · next [#542 phase 2](../qa-542-phase2/README.md)

<!-- docs-nav:end -->

Evidence for the card. The requirement is issue #739: the payment workflow was green on the server
— ledger, member writes, two server actions, the billing routes, the `awaiting_payment` gate, 124
tests — and **nothing called it**. This page is that workflow pressed by a signed-in payer in a real
browser, on the demo branch, with the rows read back afterwards.

## The run

| Fact         | Value                                                                 |
| ------------ | --------------------------------------------------------------------- |
| tree         | `alignsynch/t_f10daf32-…` worktree, node 24.22.0                      |
| app          | `next dev` on `:3100`, `BRAND=alignsynch`, `BILLING_PROVIDER=mock`    |
| branch       | demo (`NEON_BRANCH=demo`), `BILLING_HOST=demo`                        |
| payer        | `payer-1794188…@demo.alignsynch.test`, signed in over `/api/auth`     |
| relationship | `c0cc26e5-fcee-4270-a62b-7bfbd713cadc` (initiator)                    |
| session      | `00879f69-4b03-4f23-a2a2-580db599979a`, both seats sealed, 10 answers |

Three commands, in order, all from the worktree root:

```bash
# 1. the state: a payer with a plan, a four-stage create, a claim, both sheets sealed
pnpm payment:e2e setup          # 20 checks ✔, writes .payment-e2e.json (gitignored)

# 2. the browser: press both acts, read the DOM back, keep the stills
python3 …/cdp-payment.py --state .payment-e2e.json --out docs/qa-payment

# 3. the rows: the method, the fee, the status, the audit trail
pnpm payment:e2e verify         # 7 checks ✔
```

```text
✔ the method is on file — method_captured_at=Sun Nov 08 2026 22:43:08
✔ the fee landed — charged_at=Sun Nov 08 2026 22:43:16 amount=895
✔ the relationship is complete — status=complete
✔ the payer's acts left audit rows — 2 admin_action row(s) on the relationship
✔ the Gap is open to the payer — status 200, alignment rows 20
✔ and the session no longer reads awaiting payment
✔ the screen reports the fee it took — gate=charged
```

## What the browser saw

`cdp-report.json` is the run's own facts, read from the DOM at each step, never from the database —
a still nobody can read back proves a page rendered, not that it rendered the thing. Both widths,
`overflow: false` at 390:

| Step              | `data-completion-gate` | method    | both buttons | status     | Gap rows |
| ----------------- | ---------------------- | --------- | ------------ | ---------- | -------- |
| sealed, no method | `none`                 | `missing` | yes / yes    | `active`   | 0        |
| after capture     | `method-on-file`       | `on-file` | no / yes     | `active`   | 0        |
| after complete    | `charged`              | —         | no / no      | `complete` | —        |
| the session       | —                      | —         | —            | —          | 20       |

The receipt the payer keeps, verbatim from the band after the completion:

> $8.95 was charged Nov 9, 2026. The Gap is open to both of you.

| Still                         | What it shows                                                                           |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `payment-1440-1-before.png`   | the payer's band: amount, deadline, _Add a payment method_, _Complete and open the Gap_ |
| `payment-1440-2-captured.png` | the method on file — nothing charged, the completion still the payer's click            |
| `payment-1440-3-complete.png` | `gate=charged`, the receipt sentence, no act left                                       |
| `payment-390-1-before.png`    | the same screen at 390 — the relationship, complete and paid                            |
| `payment-1440-4-gap.png`      | the Gap, open to the payer: 20 alignment rows                                           |
| `payment-390-4-gap.png`       | the Gap at 390                                                                          |

## The refusal path is tested, not walked by hand

`tests/relationship-completion.test.tsx` presses the same buttons with the action mocked to answer
the way the server does:

- **`payment-method-required`** draws a sentence **and** a link whose `href` is the url the action
  returned (`data-completion-refusal`, `data-completion-link`) — a detour, not a dead end;
- **`charge-declined`** prints the provider's own sentence and draws no link;
- **`not-the-payer`** draws no band on the Counterparty's screen;
- **the receipt** survives the completion: a closed relationship whose fee landed still says what
  was taken, and a closed one whose fee did not draws nothing.

`pnpm payment:e2e setup` also asserts the create wrote `published_at`, because migration 0030's
`relationship_completed_after_published` refuses a completion without it (see below).

## Three defects the run found, and fixed

The card's diagnosis was "nothing calls it". Proving it end to end found three more, each of which
would have answered the payer with something that is not a payment.

1. **The create never published the row.** `lib/flow/store.ts` wrote the schema's `draft` status, so
   `draft → complete` was not a transition and the fee was unreachable on every relationship made
   through the flow. It now writes `published`.
2. **The create opened no payment obligation.** `recordMethodCaptured` is an `UPDATE`, and there was
   no `relationship_payment` row to update — so a capture wrote nothing and the Gap read as free
   (`paymentArmedOf(null)` is "not measured", not "unpaid"). The row is opened in the same
   transaction for a creator with an account.
3. **`published_at` was NULL, so the completion died on a CHECK.** The status alone was not enough:
   Postgres refused the `active → complete` write with `relationship_completed_after_published` and
   the payer got a 500 on the only screen that can take the fee. The instant is written with the
   status now, and the e2e asserts it so it cannot come back quietly.

A fourth was a posture error rather than a crash: `submitAnswers` refused the Initiator's own sheet
until a card was on file. The gate belongs at the Gap — completion needs both sheets sealed, so a
method gate at the answer step made the payer unable to reach their own payment. It now sits at
`completeRelationship()` only.

## `BILLING_HOST`

An unset host is a `503 not-configured` on every checkout. The demo deployment's value is **`demo`**
(production's is `alignsynch`), recorded in `.env.example` beside the key; the demo branch's
`.env.local` carries it. The run above used the keyless mock adapter, so no live key was involved.

## The v1.8.0 Known limit

v1.8.0 shipped with "no member can pay yet". That is answered:

```console
$ pnpm payment:e2e verify
✔ the method is on file — method_captured_at=Sun Nov 08 2026 22:43:08
✔ the fee landed — charged_at=Sun Nov 08 2026 22:43:16 amount=895
✔ the relationship is complete — status=complete
✔ the payer's acts left audit rows — 2 admin_action row(s) on the relationship
✔ the Gap is open to the payer — status 200, alignment rows 20
```

A member pays: a method is captured, the $8.95 fee lands against it, the relationship moves to
`complete`, and both parties can read the Gap.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › Payment capture & completion · prev [Flow validation, 2026-11-07](../qa-flow-validation/2026-11-07.md) · next [#542 phase 2](../qa-542-phase2/README.md)

<!-- docs-nav:end -->
