# Module: `components`

41 directories, 295 `.tsx` files. One directory per feature; [`ui/`](../../../components/ui) is the
shadcn primitives and nothing else. This page documents the shape and the rules, not an inventory.

## Responsibilities

- Render every screen the routes compose. A page owns data; a component owns markup and state.
- Hold the two cross-cutting markup rules of the repo, each with exactly one home:
  [leaving-link.tsx](../../../components/layout/leaving-link.tsx) is the only markup that leaves the
  app, and [form-surface.tsx](../../../components/ui/form-surface.tsx) is the only form card.
- Keep the shell's client pieces — sidebar, header, drawers, palette — free of anything the server
  must decide. The session, the role's capability set, the parsed copy and the brand mark are passed
  in as props.

## Key files

- [`layout/main-layout.tsx`](../../../components/layout/main-layout.tsx) — the product shell.
  Mounted by `app/(mainlayout)/layout.tsx`.
- [`layout/sidebar.tsx`](../../../components/layout/sidebar.tsx) — the member rail; draws a `NavItem`
  with `hidden` for a flagged-off surface and renders nothing.
- [`layout/leaving-link.tsx`](../../../components/layout/leaving-link.tsx) — `target="_blank"`,
  `rel="noopener noreferrer"`, the external marker, and an accessible name ending "opens in a new tab".
- [`ui/form-surface.tsx`](../../../components/ui/form-surface.tsx) — border + background contrast, **no
  shadow**.
- [`assessment-flow/`](../../../components/assessment-flow) — the two-party flow's screens: answer
  form, sheet, wizard, invite view, report view, steps panel.

## Public API

Components are default-exported React components consumed by pages, not a published library. Three
conventions are load-bearing:

- props are plain data — a zod object never crosses to a `"use client"` component;
- an identity is `{ name, handle, email } | null`, resolved on the server; a client component never
  reads a session;
- class merging goes through `cn()` from [`lib/utils.ts`](../../../lib/utils.ts).

## Internal structure

- **`ui/`** — shadcn primitives. Extend them; do not hand-roll a second `Button`.
- **`layout/`** — the shell and the public chrome share these files, which is why `Footer` accepts a
  `leaving` prop rather than existing twice.
- **one directory per feature** — `dashboard`, `relationship`, `admin`, `console`, `assessment`,
  `assessment-flow`, `marketing`, `home`, `quiz`, `explore`, `search`, `support`, `identity`, `shell`.
- **`v1/`** — the retired prototype's components, kept for reference by
  [`docs/V1-RETIREMENT.md`](../../V1-RETIREMENT.md); nothing in the build imports them.

## Dependencies

- **Used by:** [`app/`](app-mainlayout.md) only.
- **Uses:** [`content/`](content.md) for types, [`data/`](data.md) for copy through props, and
  [`lib/`](../../../lib) for pure helpers. **Never** `lib/db/**` from a `"use client"` module (E34).

## Notable patterns / gotchas

- **A brand colour is a token, never a palette step.** `pnpm lint` runs
  [`scripts/lint-brand-classes.mjs`](../../../scripts/lint-brand-classes.mjs) and fails `indigo-*`,
  `purple-*`, `violet-*` and `bg-gradient-to-*` anywhere here. There is no allowlist: add a role to
  [`data/brand.ts`](../../../data/brand.ts) instead.
- **`next/image` needs an intrinsic size.** Without `width`/`height` or `fill` (inside a
  `position: relative` parent) dev renders a 500 and `next build` stays green.
- **A fixture row is imported, never pasted.** `data:check` E21 fails a module-scope record array or a
  pasted quiz title in `components/search/**`, `components/chat/**` and the header palette.
- **No shadow on a form, no bare `Card` under `components/auth/**`** — both are lint failures.
