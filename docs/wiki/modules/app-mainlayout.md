# Module: `app/(mainlayout)`

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › app/(mainlayout) · prev [app/api](app-api.md) · next [app/(marketing)](app-marketing.md)

<!-- docs-nav:end -->

The product route group: 68 pages, 10 route handlers and 9 `actions.ts` files, all mounted under the
shell — sidebar, header, search palette, notification and message drawers, account menu.

## Responsibilities

- Mount the app chrome once, in `app/(mainlayout)/layout.tsx`,
  and resolve everything the client shell cannot: the session's account, the role, the capability set,
  the parsed copy and the brand mark.
- Serve every signed-in surface — dashboard, relationships, templates, assessments, the operator
  console, admin screens, profile and settings.
- Own the flow's HTML-form endpoints (`route.ts` under `assessment/**` and `invite/**`), so the
  two-party flow is drivable with `curl` and its refusals are status codes.
- Host the member and admin server actions (`dashboard/**/actions.ts`, `admin/**/actions.ts`).

## Key files

- `layout.tsx` — the shell's mount point. One session read
  (`shellSession()`) feeds the header's name and the menu's role; the role never crosses to the client,
  the **capability set** does (`lib/nav.ts::navViewer`).
- `dashboard/relationships/actions.ts` —
  the initiator's four writes plus the two payment acts. Each resolves the actor from `currentUser()`.
- `assessment/new/route.ts` — create an instance
  from a template, then send the invitation; a mail failure does not fail the creation
  (`?invite=sent|unset|failed`).
- `assessment/instances/[instanceId]/answers/route.ts` — one party's whole sheet, or a 409/403/404
  refusal. The seat comes from the `flow_party_<id>` cookie, never from a form field.
- `assessment/instances/[instanceId]/accepts/route.ts` — an acceptance; the second one completes the
  session and opens the report.
- `assessment/[slug]/page.tsx` — the **only** route in the tree that reads Postgres to render.
  `force-dynamic`, no `generateStaticParams()`.
- `admin/console/layout.tsx` — the console's own
  layout, behind `requireAdminProduct()` and then `requireAdmin()`.
- `invite/[token]/claim/route.ts` — spends an invitation exactly once and binds the counterparty.

## Public surface

Every directory under the group is a route segment. The groups that matter:

| Segment                                                                                   | What lives there                                                                                                 |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `dashboard/**`                                                                            | The initiator's home: relationships, templates, support, help, the profile screen.                               |
| `assessment/**`                                                                           | Template library, create, the instance screen, answers, accept, report, steps.                                   |
| `admin/**`                                                                                | Audit, billing, broadcast, console (relationships, templates, users), gaps, health, inbox, instances, templates. |
| `invite/[token]`                                                                          | The three-step counterparty onboarding wizard and its claim endpoint.                                            |
| `explore`, `categories`, `quiz`, `my-quizzes`, `leaderboard`, `battle`, `daily-challenge` | The quiz product — gated by `requireQuizProduct()`, so `404` on the alignment build.                             |

## Internal structure

A page is a Server Component that resolves a session, then either reads a fixture (usually through a
projection in [`lib/`](../../../lib)) or calls a `lib/db/**` reader, and hands plain props down. A
`"use client"` component never receives a zod object and never imports `lib/db/**` (E34).

Writes split two ways, and the choice is deliberate:

- **server actions** where a person is present and the screen is a real client component —
  `dashboard/**/actions.ts`, `admin/**/actions.ts`;
- **route handlers** where the acceptance is a `curl`, where the answer must be a status code, or
  where a form must work with no client bundle — the flow's create, claim, answer, accept, invite.

## Dependencies

- **Used by:** the browser only. Nothing imports this directory.
- **Uses:** [`components/`](components.md) for every rendered piece, [`content/`](content.md) for
  types, [`data/`](data.md) for copy and fixtures, and [`lib/`](../../../lib) for everything else.

## Notable patterns / gotchas

- **A gated page calls the gate first.** `notFound()` is the first statement — ahead of `await params`
  and ahead of any read ([`lib/brand-boundary.ts`](../../../lib/brand-boundary.ts)).
- **`params` is a Promise in Next 16.** `params: Promise<{ id: string }>` and `await params`.
- **A page that renders a campaign slot must be `force-dynamic`** (`/explore`, `/explore/featured`),
  and hands one server instant down, or the campaign window is frozen at build time.
- **A gated console route with no auth env answers 500 `NEON_AUTH_BASE_URL is not set`, on purpose** —
  `currentUser()` builds the auth server outside its `try`. `/support` and `/how-it-works` answer
  `307 → /login` instead because they use `currentUserIfConfigured()`.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › app/(mainlayout) · prev [app/api](app-api.md) · next [app/(marketing)](app-marketing.md)

<!-- docs-nav:end -->
