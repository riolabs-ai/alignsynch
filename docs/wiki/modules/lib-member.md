# Module: `lib/member`

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › lib/member · prev [lib/flow](lib-flow.md) · next [Code wiki index](../README.md)

<!-- docs-nav:end -->

11 modules — the initiator's side of the product. Where `lib/flow` serves a session to whoever holds
the link, `lib/member` serves an **account**: its relationships, its templates and its membership.

## Responsibilities

- Create a relationship from a template the account owns, edit its Aspects, and publish it.
- Read the membership a relationship runs on — the trial, the period end, and whether either party
  may still write — and complete a relationship without taking money (#1010).
- Refuse a write from either party when the membership behind the relationship has lapsed, and say
  so in one sentence the screen and the refusal both read.
- Give the member's own pages the data they need: the relationship list, this month's outcomes, the
  template shelf.

## Key files

- [`relationships.ts`](../../../lib/member/relationships.ts) — `createRelationship`, `saveAspects`,
  `publishRelationship`, `republishRelationship`. Every one ends in an `act()` write, so each leaves an
  `admin_action` row in the same transaction as the change. Publishing copies the template's Aspects,
  opens the session round, writes the Initiator's party row and the invitation, and moves the
  relationship to `published` — **and bills nothing**.
- [`payment.ts`](../../../lib/member/payment.ts) — `completeRelationship` and the completion gate. It
  is **the whole money story for a relationship since #1010**: nothing. The membership bought at stage
  5 covers it, so completion reads the seal, writes the status and opens the Gap, and the module
  imports no billing code at all.
- [`relationship-edit.ts`](../../../lib/member/relationship-edit.ts) — the edit surface's preview and
  write, so the invalidation a change costs is stated before it is saved.
- [`publish-basis.ts`](../../../lib/member/publish-basis.ts) — `MemberRefused` and the sentences a
  refused publish carries.
- [`templates.ts`](../../../lib/member/templates.ts), [`library.ts`](../../../lib/member/library.ts),
  [`outcomes.ts`](../../../lib/member/outcomes.ts), [`shelf.ts`](../../../lib/member/shelf.ts) — the
  member's template library and dashboards.

## Public API

Every export is an `async` function taking a request object and returning an `ActResult<T>` — the
audit id plus `before`/`after`. The actor is always `actorUserId`, resolved by the caller from
`currentUser()`; the library re-checks ownership under the row lock anyway, so a crafted call site
cannot act as somebody else.

## Internal structure

Two layers, and the split is the point: `lib/relationship/**` holds the rules (status transitions,
membership, trial, enforcement) as pure functions, and `lib/member/**` holds the account-facing
operations that use them. `lib/relationship/status.ts` is the state machine —
`draft → pending → published → active → complete`, with `expired`, `void` and the lapse edges.

## Dependencies

- **Used by:** [`app/(mainlayout)`](app-mainlayout.md)'s dashboard actions and the payment job
  route.
- **Uses:** [`lib/admin/act`](lib-admin.md), [`lib/db`](lib-db.md), `lib/billing`,
  [`lib/flow`](lib-flow.md) and `lib/relationship`.

## Notable patterns / gotchas

- **The identity in a publish comes from the session, never the body.** The Initiator's name and
  address are `user.name` / `user.email`; the body carries only the counterparty's.
- **A refusal is a value.** `{ ok: false, code }` — including the trial-already-running case, which
  carries the server's sentence with the trial's last instant in it.
- **A checkout that has not completed is not a failure.** It returns the URL the browser must visit;
  nothing was written and the relationship is still `pending`.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › lib/member · prev [lib/flow](lib-flow.md) · next [Code wiki index](../README.md)

<!-- docs-nav:end -->
