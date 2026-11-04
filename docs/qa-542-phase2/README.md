# #542 phase 2 — the rail as role-constrained data, and focused-flow chrome

Evidence for the card. Captured against the **demo branch** (`ep-crimson-truth`), `next start` on
`:3199`, `BRAND=alignsynch`, with the seeded demo accounts (`pnpm db:seed`).

## The defect this phase exists for

On `origin/main` the alignment rail's admin rows were a separate block of JSX and `/admin/console` —
the hub every one of those five destinations hangs off — was in neither list. An admin could reach
the console only by typing the URL.

## The three rails, as rendered

`member` (`initiator@demo.alignsynch.test`) — `member-rail-1440.png`:

```
WORKSPACE   Dashboard · My Relationships · My Templates · Library
SUPPORT     How It Works · Support
```

`admin` (`admin@demo.alignsynch.test`) — `admin-rail-1440.png`:

```
WORKSPACE   Dashboard · My Relationships · My Templates · Library
SUPPORT     How It Works · Support
ADMIN       Console · Relationships · Gap Analysis · Inbox · Platform health · Billing ·
            Broadcast · Audit log
```

`support` is not seeded as an account, so its rung is proved where it is decided: `tests/nav-menu.test.ts`
renders the rail for all four rungs and asserts `member` (6 rows) ⊂ `support` (7 — adds `/admin/inbox`)
⊂ `admin` (14) = `owner` (14). The descriptor, not the screenshot, is the artefact for that rung.

## Authorisation is not the menu

| request          | as     | result                             |
| ---------------- | ------ | ---------------------------------- |
| `/admin/console` | member | **404** (`member-404-1440.png`)    |
| `/admin/console` | admin  | **200** (`admin-console-1440.png`) |

Hiding a row is not the rule that refuses a route: `lib/auth/require-role.ts` answers `notFound()`
for a member on every `/admin/*` page, and `lib/admin/act.ts` re-asks the floor inside the
transaction of every audited write.

## Focused flow

`/assessment/templates/new` — a create flow — as the member (`focus-flow-1440.png`): the rail is
**not rendered**, the content takes the width, the header keeps the wordmark, the account menu and
`Back to dashboard` (`/dashboard`). Leaving through that link restores the 250 px rail
(`focus-exit-1440.png`).

## The rail's width survives a reload

The choice is a cookie, `shell.rail`, written by the server action
`app/(mainlayout)/rail-actions.ts` and read in `app/(mainlayout)/layout.tsx` before any HTML exists —
so the first paint is the width asked for, not a post-hydration correction (the failure mode that
removed the previous `localStorage` toggle from this tree).

```
toggle  → Set-Cookie: shell.rail=collapsed   rail renders icon-only, labels gone
reload  → same request carries the cookie    rail renders icon-only again
toggle  → shell.rail=expanded                labels return, rail back to 250 px
```

`tests/rail-preference.test.ts` holds the state machine and the wiring, including the prohibition on
browser storage.

## The gate

| step                          | result                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `pnpm typecheck`              | pass                                                                         |
| `pnpm data:check`             | 692 `node:test` cases, 0 failures                                            |
| `pnpm test`                   | 2041 passed / 153 files                                                      |
| `pnpm lint` / `format:check`  | clean for the changed files                                                  |
| `BRAND=alignsynch pnpm build` | pass                                                                         |
| `pnpm parity`                 | manifest regenerated (the rail is in the shell on every gated route)         |
| E10 negative run              | `/admin/consolex` in `lib/nav-menu.ts` → `[E10] lib/nav-menu.ts:144 links …` |
