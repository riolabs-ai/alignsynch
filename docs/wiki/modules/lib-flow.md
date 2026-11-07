# Module: `lib/flow`

22 modules — the two-party session, end to end: create it from a template, claim the invitation,
submit a sheet, accept it, and project the screen a person sees. It is the oldest and most traversed
path in the app, and it is deliberately split into **decisions** (pure, testable with literals) and
**writes** (one transaction each).

## Responsibilities

- Decide what state a session is in from its rows — not from a status column.
- Write the five operations: `createInstanceFromTemplate`, `claimInvite`, `submitAnswers`,
  `acceptSession`, `readFlowScreen`, plus `resendInvite`, `markUnlockSeen` and `writeStep`.
- Own the invitation and notice mail, and the party cookie that binds a browser to a seat.

## Key files

- [`store.ts`](../../../lib/flow/store.ts) — the database half. Every operation is a single
  transaction; every write re-reads under `FOR UPDATE` and resolves the actor inside it. This is the
  file to read first, and its docstring lists the operations in order.
- [`state.ts`](../../../lib/flow/state.ts) — pure. `instanceStatusOf(progress)`, `maySubmit`,
  `parseSubmission`, `waitingOn`, `myInstanceStateOf`, `unlockMarkOf`. `INSTANCE_STATUSES` lives here
  and nowhere else.
- [`screen.ts`](../../../lib/flow/screen.ts) — `projectScreen({ rows, viewer, now })` → the view model
  the instance screen draws (`FlowScreen`, `FlowSeat`, `FlowInvite`, `FlowAspect`).
- [`payment.ts`](../../../lib/flow/payment.ts) — the money's arithmetic: `METHOD_TRIAL_DAYS = 7`,
  `PAYMENT_WINDOW_DAYS = 14`, `PAYMENT_REMINDER_DAYS = [3, 10]`,
  `CHARGE_RETRY_OFFSET_DAYS = [1, 3, 5]`, and the `…DueOf()` predicates.
- [`payment-jobs.ts`](../../../lib/flow/payment-jobs.ts) — `paymentJobsOf({ facts, now })`, ordered by
  consequence: `expire` alone, then `charge` alone, then `remind` and `retry-charge`.
- [`claim.ts`](../../../lib/flow/claim.ts) — the claim's closed refusal vocabulary and the
  name-confirmation check. `tokens.ts` mints and hashes tokens.
- [`session.ts`](../../../lib/flow/session.ts) — `flow_party_<id>` / `flow_invite_<id>`, seven days.
- [`email.ts`](../../../lib/flow/email.ts) — `invitationMessage()`, `sendInvitation()`, and the three
  outcomes `sent | unset | failed`. `join-notice.ts` and `unlock-notice.ts` are the other two mails.
- [`paths.ts`](../../../lib/flow/paths.ts) — every URL the flow redirects to. No handler builds a path
  by hand.

## Public API

`store.ts` exports the operations; everything else exports pure functions and constants. The two
contracts that matter:

- **A refusal is a value, not a throw.** `SubmitResult` is `{ ok: true, … } | { ok: false, code, reason }`;
  the route maps the code to a status. `FlowError` is thrown only where a redirect target must be
  chosen (the create form).
- **`now` is a parameter.** No module here reads a clock, so a test pins an instant and a run cannot
  straddle two.

## Internal structure

`store.ts` and `state.ts` are the same split the rest of the repo uses: `state.ts` decides, `store.ts`
writes. `screen.ts` is a third layer — rows plus a viewer in, a view model out — which is why the
instance page contains no layout logic.

## Dependencies

- **Used by:** [`app/(mainlayout)`](app-mainlayout.md)'s flow routes, [`lib/member`](lib-member.md)
  (publishing opens a session), and `pnpm demo:verify`.
- **Uses:** [`lib/db`](lib-db.md), [`content/`](content.md), `lib/forms`, `lib/auth`.

## Notable patterns / gotchas

- **The freeze is per party, and it is a status code.** A submit answers `409` once _that party_ has
  accepted — not once both have. Before the acceptance the window is open even if the other party has
  already submitted.
- **The mode comes from the row, never from a form.** A post naming a kind the mode does not ask is
  refused with a 409 before the store is called.
- **The role comes from the cookie, and a posted `role` is an assertion, not an instruction.** A
  contradiction is refused (`403`), never quietly written.
- **A void or a lapsed membership freezes both seats**, checked under the same session lock, and the
  lapse is recorded in its own commit so the row explaining the refusal is not lost.
