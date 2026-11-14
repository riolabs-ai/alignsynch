# Module: `app/(marketing)`

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › app/(marketing) · prev [app/(mainlayout)](app-mainlayout.md) · next [components](components.md)

<!-- docs-nav:end -->

The public route group: 8 pages behind a marketing header and footer, and **never** the product
shell.

## Responsibilities

- Serve the surfaces a person can reach signed out: `/`, `/welcome`, `/pricing`, `/help`, `/terms`,
  `/privacy`, `/templates`, and `/support/articles/[slug]`.
- Draw the public chrome exactly once, in
  `layout.tsx`, by composing the shell's own pieces
  (`MarketingHeader`, `Footer`) rather than a second header.
- Stay enumerated: the group is the runtime table's source of truth, not a list someone maintains
  by hand.

## Key files

- `layout.tsx` — the group's chrome. Its docstring is the
  decision record for #317: moving the pages out of the shell was right, taking the navigation with
  them was not.
- `page.tsx` — `/`, the front page. Composed from
  [`components/home/`](../../../components/home) and the copy fixtures.
- `templates/page.tsx` — the public template catalogue.
- `pricing/page.tsx` — the plan cards; a click posts to
  `app/api/billing/checkout`.

## Public API

There is none: every page is a default-exported async Server Component with no exported helpers. The
group's contract is the **route list**, held by [`lib/marketing-routes.ts`](../../../lib/marketing-routes.ts)
and checked by `data:check` **E39**, which fails when the table and the pages under this group
disagree.

## Internal structure

One directory level per route, no `actions.ts`. The only writes reachable from these pages are
`app/api` handlers (`contact`, `news/subscribe`, `billing/checkout`), which is why the group needs no
server actions and holds no `"use client"` state beyond the components it mounts.

## Dependencies

- **Used by:** the browser, and the dashboard — a dashboard link to one of these routes must go
  through [`components/layout/leaving-link.tsx`](../../../components/layout/leaving-link.tsx), which
  is what E39 checks.
- **Uses:** [`components/marketing/`](../../../components/marketing),
  [`components/layout/footer.tsx`](../../../components/layout/footer.tsx), and the copy fixtures in
  [`data/pages/`](../../../data/pages).

## Notable patterns / gotchas

- **The group is the boundary.** A page is either in `(mainlayout)` and gets the app, or here and gets
  a wordmark. There is no session check that swaps the chrome — the sidebar is `position: fixed` on
  the app side, so a shared component cannot be reused across the line without a layout decision.
- **A form surface carries no shadow.** These pages use
  [`components/ui/form-surface.tsx`](../../../components/ui/form-surface.tsx); `pnpm lint` fails a
  `shadow-*` on a form surface.
- **Adding a page here is a two-file change**: the page and the row in
  [`lib/marketing-routes.ts`](../../../lib/marketing-routes.ts), or E39 fails the gate.

<!-- docs-nav:begin -->

[Docs hub](../../README.md) › **Code wiki** › app/(marketing) · prev [app/(mainlayout)](app-mainlayout.md) · next [components](components.md)

<!-- docs-nav:end -->
