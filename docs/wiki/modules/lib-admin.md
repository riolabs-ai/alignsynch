# Module: `lib/admin`

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › lib/admin · prev [lib/member](lib-member.md) · next [Class diagram](../diagrams/class-diagram.md)

<!-- docs-nav:end -->

21 modules — the operator's side. Two halves: the **write gate** every admin action must pass
through, and the per-surface operations the console calls.

## Responsibilities

- Make every privileged write auditable: one transaction, the role read inside it, one `admin_action`
  row, or nothing at all.
- Hold the role ladder and the catalogue of actions, with the minimum role for each.
- Serve the console: relationships, templates, users, gaps, instances, health, inbox, billing control,
  broadcast, repairs.

## Key files

- [`act.ts`](../../../lib/admin/act.ts) — `act()`, the only write path an admin action may take:
  `begin → read the actor's role → refuse, or run the mutation → insert admin_action → commit`.
  `transactionRunner()` and `POOL_RUNNER` are the two ways to supply a connection.
- [`roles.ts`](../../../lib/admin/roles.ts) — `ROLE_LADDER`, `ADMIN_ACTIONS`, `ACTION_REQUIREMENTS`,
  `can(role, action)`, `AUDIT_TARGET_TABLES`. Adding an action is a row here plus a call site.
- [`audit-log.ts`](../../../lib/admin/audit-log.ts) — the read side of `admin_action`. Every admin
  write names its target as `{ table, id }` from `AUDIT_TARGET_TABLES`.
- [`relationship-ops.ts`](../../../lib/admin/relationship-ops.ts) — void, revive, reassign: the
  operator moves on a relationship that is stuck.
- [`repairs.ts`](../../../lib/admin/repairs.ts) — the drift repairs `db:verify` reports.
- [`platform-health.ts`](../../../lib/admin/platform-health.ts) — the health screen's facts.
- [`inbox.ts`](../../../lib/admin/inbox.ts) / [`inbox-ops.ts`](../../../lib/admin/inbox-ops.ts) — the
  support inbox and its replies.
- [`billing-control.ts`](../../../lib/admin/billing-control.ts) — plan grants and the billing switches.
- [`templates.ts`](../../../lib/admin/templates.ts) / [`template-draft.ts`](../../../lib/admin/template-draft.ts) —
  authoring and validating the templates the product sells.
- [`broadcast.ts`](../../../lib/admin/broadcast.ts) / [`broadcast-rules.ts`](../../../lib/admin/broadcast-rules.ts) —
  a send, and who may receive it.

## Public API

`act<T>(request)` is the contract everything else is built on:

```ts
act({ actorUserId, action, target: { table, id }, reason, mutate });
// → { actionId, before, after } | throws ActRefused
```

Four properties come from the order of the statements, not from discipline:

- the role is read `FOR SHARE` inside the writing transaction, so a concurrent demotion cannot commit
  between the check and the write;
- a refusal happens **before** the mutation, so a rejected call has run none of the caller's SQL;
- a thrown mutation leaves nothing — the audit insert is the last statement before `COMMIT`;
- `reason` has a minimum length (`REASON_MIN_LENGTH`), because an audit row without a reason explains
  nothing a year later.

## Internal structure

One module per console surface, each exporting `…Input` validators, `…Ops` writers and read helpers.
None of them opens its own transaction: a writer either takes an `ActSql` from `act()` or a `client`
from its caller, because a nested transaction is two commits waiting to disagree.

## Dependencies

- **Used by:** [`app/(mainlayout)/admin/**`](app-mainlayout.md) and
  [`lib/member`](lib-member.md) — a member write is an admin action too, floored at `member`.
- **Uses:** [`lib/db`](lib-db.md), [`lib/auth/require-role.ts`](../../../lib/auth/require-role.ts)
  for the page-level gate.

## Notable patterns / gotchas

- **The console is gated twice.** `requireAdminProduct()` (the `product.admin` flag → `404`) runs
  before `requireAdmin()` (the role → sign-in). A template without the console must not answer a
  sign-in page, which would admit the surface exists.
- **A role is never a parameter.** The caller passes a `userId`; the role comes from
  `user_profile.role`.
- **A refused action is a `role-too-low` or a `reason-too-short`, not a 500.** `ActRefused` carries the
  code the screen has a sentence for.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › lib/admin · prev [lib/member](lib-member.md) · next [Class diagram](../diagrams/class-diagram.md)

<!-- docs-nav:end -->
