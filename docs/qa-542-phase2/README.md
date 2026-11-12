# #542 phase 2 — the rail as role-constrained data, and focused-flow chrome

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › #542 phase 2 · prev [Payment capture & completion](../qa-payment/README.md) · next [Rail collapse handle](../qa-rail-handle/README.md)

<!-- docs-nav:end -->

Evidence for the card. Captured against the **demo branch** (`ep-crimson-truth`), `next start` on
`:3199`, `BRAND=alignsynch`, with the seeded demo accounts (`pnpm db:seed`). Re-measured after
merging `origin/main` (`7d4c859b`, the `/help` two-column layout) into `feat/role-menus`, so these
numbers describe the tree that ships.

## The defect this phase exists for

On `origin/main` the alignment rail's admin rows were a separate block of JSX and `/admin/console` —
the hub every one of those five destinations hangs off — was in neither list. An admin could reach
the console only by typing the URL.

## The three rails, as rendered

Read from the served HTML of `/dashboard` (every `href` inside the rail's `<nav>`), not from a
descriptor dump:

`member` (`initiator@demo.alignsynch.test`) — 6 rows, `member-rail-1440.png`:

```
WORKSPACE   Dashboard /dashboard · My Relationships /dashboard/relationships ·
            My Templates /dashboard/templates · Library /dashboard/library
SUPPORT     How It Works /dashboard/help · Support /dashboard/support
```

`support` (the same account, `user_profile.role` flipped to `support`) — 7 rows:

```
WORKSPACE   Dashboard · My Relationships · My Templates · Library
SUPPORT     How It Works · Support
ADMIN       Inbox /admin/inbox
```

`admin` (`admin@demo.alignsynch.test`) — 14 rows, `admin-rail-1440.png`:

```
WORKSPACE   Dashboard · My Relationships · My Templates · Library
SUPPORT     How It Works · Support
ADMIN       Console /admin/console · Relationships /admin/instances · Gap Analysis /admin/gaps ·
            Inbox /admin/inbox · Platform health /admin/health · Billing /admin/billing ·
            Broadcast /admin/broadcast · Audit log /admin/audit
```

The Admin group **leads with `/admin/console`**, and the only `/admin` hrefs anywhere in the document
are that group's eight:

```
admin   → /admin/console /admin/instances /admin/gaps /admin/inbox /admin/health
          /admin/billing /admin/broadcast /admin/audit
member  → (none)
support → /admin/inbox
```

`owner` renders the same 14 rows as `admin`; the ladder `member` (6) ⊂ `support` (7) ⊂ `admin` (14) =
`owner` (14) is asserted in `tests/nav-menu.test.ts`, which renders the rail component for all four
rungs — the artefact for a rung is the render, not a screenshot.

## Authorisation is not the menu

| request          | as      | result                                               |
| ---------------- | ------- | ---------------------------------------------------- |
| `/admin/console` | member  | **404** (`member-404-1440.png`)                      |
| `/admin/console` | support | **404** (a support seat gets the queue, not the hub) |
| `/admin/console` | admin   | **200** (`admin-console-1440.png`)                   |

Hiding a row is not the rule that refuses a route: `lib/auth/require-role.ts` answers `notFound()`
for a member on every `/admin/*` page, and `lib/admin/act.ts` re-asks the floor inside the
transaction of every audited write.

## Focused flow

`/assessment/templates/new` — a create flow — as the member (`focus-flow-1440.png`): the rail's
`<aside>` is **not in the served HTML**, exactly one dashboard link survives (`/dashboard`, the
`Back to dashboard` control), and the top bar keeps the wordmark and the account menu. Leaving
through that link restores the 250 px rail (`focus-exit-1440.png`).

## The rail's width survives a reload

The choice is a cookie, `shell.rail`, written by the server action
`app/(mainlayout)/rail-actions.ts` and read in `app/(mainlayout)/layout.tsx` before any HTML exists —
so the first paint is the width asked for, not a post-hydration correction (the failure mode that
removed the previous `localStorage` toggle from this tree).

Measured by submitting the rail form and re-requesting `/dashboard` with the jar:

```
POST /dashboard (the rail form)  → Set-Cookie: shell.rail=collapsed; Path=/; Max-Age=31536000; HttpOnly; SameSite=lax
GET  /dashboard  (same cookie)   → <aside … md:w-16 lg:w-16>   toggle reads "Expand"
POST /dashboard (the rail form)  → Set-Cookie: shell.rail=expanded
GET  /dashboard  (same cookie)   → <aside … lg:w-[250px]>      toggle reads "Collapse"
```

`tests/rail-preference.test.ts` holds the state machine and the wiring, including the prohibition on
browser storage.

## The gate

`env -i` (nothing inherited, no `.env.local` in the worktree), after merging `origin/main`:

| step                              | result                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------- |
| `BRAND=alignsynch GATE_LANE=full` | green, 160.2 s                                                               |
| `BRAND=quizhub GATE_LANE=full`    | green, 144.2 s                                                               |
| `pnpm data:check`                 | 692 `node:test` cases, 0 failures, 0 warnings                                |
| `pnpm test`                       | 2041 passed / 153 files                                                      |
| `pnpm parity`                     | manifest regenerated (the rail is in the shell on every gated route)         |
| E35                               | 240 components walked, 234 with an ancestor, 6 approved exceptions           |
| E39                               | 280 dashboard files against 8 public routes, 1 departure surface             |
| E10 negative run                  | `/admin/consolex` in `lib/nav-menu.ts` → `[E10] lib/nav-menu.ts:144 links …` |

## Related

- [UI-MAPPING.md](../UI-MAPPING.md) — which quiz surface the rail and chrome vary from.
- [ui-registry.md](../ui-registry.md) — the surfaces these frames capture.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Records & QA** › #542 phase 2 · prev [Payment capture & completion](../qa-payment/README.md) · next [Rail collapse handle](../qa-rail-handle/README.md)

<!-- docs-nav:end -->
