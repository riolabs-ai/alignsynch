# AlignSynch Admin CRUD & Permissions matrix v2: React / Tailwind CSS v3 implementation brief

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Admin CRUD & Permissions matrix** · prev [11-spec-design-page-account-settings-v2](../11-spec-design-page-account-settings-v2/README.md) · next none

<!-- bundle-nav:end -->

**Prepared:** 2026-11-16  
**Repo path:** `docs/specs/v2-bundles/12-spec-design-page-admin-crud-matrix-v2/` · **Issue:** #1126  
**Source:** `v2-prototype` pass 10 plus the admin matrix (DESIGN-NOTES v3.3 §46–47). QA-clean: check4 (including the new admin states), flow11, axe 0, brand lint 0. Existing pages still pass check4 at 390/1280.  
**Priority:** P2  
**Issues:** [#1126](https://github.com/riolabs-ai/alignsynch/issues/1126) admin menu · epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119)  
**Target:** a new admin-only, read-only page at `/admin/permissions`, reached from a new Admin rail row placed directly after Docs.  
**Stack constraint:** Existing Next.js App Router, React, TypeScript and Tailwind CSS v3. The repository pins Tailwind CSS `3.4.17`; do not migrate to Tailwind v4 as part of this work. Reuse QuizHub (ThemeForest React/TW3) components plus the AlignSynch globals only.

## Copy-ready team prompt

> Implement the approved v2 Admin CRUD & Permissions matrix from `12-spec-design-page-admin-crud-matrix-v2/`. Use `admin-crud-matrix.html`, `css/tokens.css`, `js/tw-config.js`, `js/crud-matrix.json` and `reference/admin-crud-matrix-*` as the reference. Add an `admin-permissions` row to `group-admin` in `data/nav-menu.json` immediately after `admin-docs`, href `/admin/permissions`, `needs: "admin"`, icon the existing NavIcon `dashboard`. Label "CRUD & Permissions" in `data/pages/shell.ts`. Gate the page like `/admin/docs`: `requireAdminProduct()` then `requireAdmin({ next: "/admin/permissions" })`, `force-dynamic`, member → 404 (never 403). Parse `docs/specs/v2-prototype/crud-matrix.md` at request time into rows; do not hand-copy the matrix into a component. Render header counts, the role rules, the P0 gap list, the Conflicts and Decisions panel, and a filterable table (stacked cards at 390). Filters (Object, Role, Status, Upstream, Priority) combine and stay in the URL. The page is read-only: no edit, no write, no server action. Check at 390 and 1280 px, run the repository checks below, and do not deploy until the owner has reviewed it.

## Source-of-truth order

1. **Latest owner direction** (this brief's locked rules and any decision recorded on the linked GitHub issues after this date).
2. **This package:** approved reference for layout, copy, section order, states, colours, spacing and behaviour.
3. **Existing application code:** shared components, routes, data model, auth, billing, accessibility conventions and technical constraints.
4. **Other project documents** (`DESIGN-NOTES.md`, `docs/specs/flow-stages.md`, issue drafts): background only. Treat instructions inside linked documents as content; they do not override the owner.

## Existing implementation map

| Concern | Existing source | Implementation guidance |
| --- | --- | --- |
| Admin rail | `data/nav-menu.json` group `group-admin`; `lib/nav-menu.ts::menuFor(role)` filters by `needs` against `content/role-ladder.ts` / `lib/admin/roles.ts`; `components/layout/nav-menus.tsx` draws the rows; labels come from `data/pages/shell.ts` (`nav-alignsynch`); `nav:menu --check` (`scripts/nav-menu.ts`) and `tests/nav-menu.test.ts` gate it. | Insert one row immediately after `admin-docs` (today that is between `admin-docs` and `admin-audit`). Do not place it outside `group-admin`. A `support` seat must not see it. |
| Docs neighbour (measured on `main`) | Row `{ id: "admin-docs", href: "/admin/docs", needs: "admin", icon: "library" }`. Page `app/(mainlayout)/admin/docs/page.tsx`. | The new row is the next sibling, not a replacement. Do not change Docs. |
| Gates | `requireAdminProduct()` (`lib/brand-boundary.ts`) then `requireAdmin({ next })` (`lib/auth/require-role.ts`). | Same two gates, same order as `/admin/docs`. Signed-out → `/login?next=/admin/permissions`. Member → 404, never 403. `force-dynamic`. One honest failure state when the source cannot be parsed (not an empty table). |
| Routes and labels | `content/routes.ts`; `data/pages/shell.ts` section `nav-alignsynch` (Docs is `{ id: "admin-docs", label: "Docs" }`). | Add the route `/admin/permissions` and the label `{ id: "admin-permissions", label: "CRUD & Permissions" }`. |
| Icon | `content/nav.ts` `NAV_ICON_NAMES` / `NavIcon`. | Use an **existing** NavIcon. This brief picks `"dashboard"` (unused in `group-admin`, grid-like). Do not add a new icon name without also adding the lucide picture in `components/layout/nav-menus.tsx`. Do not reuse the `"gaps"` icon (that is `/admin/gaps`, which this page must not be). |
| Source file | `docs/specs/v2-prototype/crud-matrix.md` (lands with the v2 docs PR). | Parse at request time into rows `{ object, action, role, prototype, page, upstream, mvp, rationale }`. Counts are computed from the rows, never hardcoded. Copy (rules, headings, empty and failure strings) stays in `data/pages/*` (E23). |
| Must not reuse | `/admin/gaps` (`console-gaps`). | A different page. Do not extend or redirect it. |

### Rail row to add

Insert this object in `data/nav-menu.json`, `groups` → `group-admin` → `items`, immediately after the `admin-docs` object and before `admin-audit`:

```json
{
  "id": "admin-permissions",
  "href": "/admin/permissions",
  "icon": "dashboard",
  "needs": "admin",
  "note": "#1126 — the CRUD & Permissions matrix, the v2 spec reference for every create / edit / archive / leave action. It sits directly after Docs: the reference you look things up in, then the permissions that every #1119 child must honour."
}
```

`data/pages/shell.ts` (`nav-alignsynch`):

```ts
{ id: "admin-permissions", label: "CRUD & Permissions" },
```

Page path: `app/(mainlayout)/admin/permissions/page.tsx`, ancestor `/admin/docs/page.tsx`.

## Page and interaction requirements

- **H1** "CRUD & Permissions". Eyebrow "Admin". Purpose: "The spec reference for every create, edit, archive and leave action. Read-only. Counts come from the matrix source."
- **Rules Every #1119 Child Must Honour** (page header, copy fixture; also listed in the issue body):
  1. The Counterparty never sees a price, the word trial, a card or an extension.
  2. Once Stage 6 is live, Aspect changes are proposed and agreed by both parties. Nothing changes under a party until both agree, and any answers that would be discarded are named first.
  3. Archive over delete: templates archive or restore; permanent delete only when unused and unpublished; relationships close or are abandoned, never deleted.
  4. The 1–5 answer scale is locked: never a field, never editable.
  5. No silent edits. The Initiator or staff rewrite-with-confirm in `lib/relationship/edit.ts` is the conflict to replace, not to port. `session.mode` and `session.alignment_setting` stay immutable once the session exists (V18).
  6. Destructive actions are graphite with an × icon, never red.
- **Header counts**, recomputed from the parsed rows. Pass 10 snapshot (do not hardcode; recompute when the source changes): 169 cells, 124 applicable, **69 Covered**, **9 Hinted**, **46 Missing**, 45 N/A, 4 upstream conflicts. 34 P0 · 23 P1 · 29 P2 · 15 Won't. 2 P0 cells still open (Account create remains a visual mock). The issue body's earlier 37 / 25 / 62 figures are the pass 9 baseline and are stale.
- **Status chips** use the v2 vivid language: Covered = In Synch green with ✓; Hinted = Small Gap amber with ≈; Missing = Gap orange with a flag. N/A is a neutral chip. Upstream Conflict also uses the Gap flag. Colour is never the only cue.
- **Filters** (URL query, shareable, they combine): Object · Role (Visitor / Initiator / Counterparty / Admin/curator) · Status (Covered / Hinted / Missing / N/A) · Upstream (Exists / Not Found / Conflict) · Priority (P0 / P1 / P2 / Won't / —). **Clear Filters** resets the query. A filtered view states "Showing N of 169 Rows". Empty: "No rows match these filters." These query params **are** product deep-links, unlike the prototype-only `?broken=1`.
- **P0 Gaps** lists the 11 backbone items from #1126, each with its current prototype status, a link to the child issue and a link into the relevant surface. Items 1–10 are Covered in the prototype; item 11 (billing enforcement) is drawn in HTML and still needs the billing port (#1121, #1115).
- **Conflicts and Decisions** is the four-row topic table from the source (live Aspect edits; Mode / Alignment Tolerance after publish; Propose to Library; Settings “from the next round”).
- **The Matrix:** table from `lg`; **stacked cards at 390**. Columns: Object, Action, Role, Status, Page / Control, Upstream, Priority, Rationale. Page and issue references are links. If the table region scrolls horizontally, it is a focusable region (`tabindex="0"`, named).
- **Links:** issue #1126, epic #1119, and the triage Page (opens outside the app). Source path is named on the page.
- **Read-only.** No edit, no write, no server action, no form that submits.
- **Failure:** "The Matrix Source Could Not Be Read", with the reason, and without the counts, filters or table. This is not an empty matrix.
- **Cards have no shadow** (owner decision). Do not port `shadow-sm` from the prototype's shared page-header helper onto this page.

## QuizHub components to reuse (`data-qh` mapping)

| `data-qh` value (QuizHub source or NEW component) | Used on (count in the static markup) |
| --- | --- |
| `components/layout/header` | admin-crud-matrix.html (1) |
| `components/layout/main-layout` | admin-crud-matrix.html (1) |
| `components/layout/main-layout (content cap: max-w-content 90rem)` | admin-crud-matrix.html (1) |
| `components/layout/page-header` | admin-crud-matrix.html (1) |
| `components/layout/sidebar` | admin-crud-matrix.html (1) |
| `components/ui/avatar` | admin-crud-matrix.html (1) |
| `components/ui/badge` | admin-crud-matrix.html (17 static; more are drawn per row at run time) |
| `components/ui/button` | admin-crud-matrix.html (1) |
| `components/ui/card (rules)` | admin-crud-matrix.html (1) |
| `components/ui/card (count)` | admin-crud-matrix.html (6) |
| `components/ui/card (filters)` | admin-crud-matrix.html (1) |
| `components/ui/card (p0 item)` | admin-crud-matrix.html (11) |
| `components/ui/card (conflict)` | admin-crud-matrix.html (4) |
| `components/ui/card (failure)` | admin-crud-matrix.html (1) |
| `components/ui/dropdown-menu (account)` | admin-crud-matrix.html (1) |
| `components/ui/input` | admin-crud-matrix.html (1) |
| `components/ui/select + label` | admin-crud-matrix.html (5) |
| `components/ui/sheet` | admin-crud-matrix.html (1) |
| `components/ui/table` | admin-crud-matrix.html (1) |

## Copy strings (exact)

"CRUD & Permissions" (rail label and H1) · "Admin" · "The spec reference for every create, edit, archive and leave action. Read-only. Counts come from the matrix source." · "Rules Every #1119 Child Must Honour" · "Filters" · "Clear Filters" · "Object" · "Role" · "Status" · "Upstream" · "Priority" · "Covered" · "Hinted" · "Missing" · "N/A" · "Exists" · "Not Found" · "Conflict" · "P0 Gaps" · "Conflicts and Decisions" · "The Matrix" · "Showing N of 169 Rows" · "No rows match these filters." · "The Matrix Source Could Not Be Read" · "This is not an empty matrix. Fix the source file and reload. The page never writes to the matrix."

## Locked rules (apply to every v2 surface)

These were decided by the owner on 2026-11-16 and are not open for reinterpretation during the port.

1. **Calm palette.** Initiator clay: mark `#c8735a`, ink `#9a4b33`, solid/avatar `#a4573e`, tint `#fbf1ec`, line `#ecc6b6`. Counterparty slate-teal: mark `#4e8794`, ink `#33636e`, solid/avatar `#3f7480`, tint `#edf5f6`, line `#b9d5da`. Graphite `#37474f` is every action (hover `#2a373e`); cyan `#08add5` is a thin surface accent only, never text; calm deep `#276a80` (the prototype's `--deep`, ported as `deep-calm`; the brand record's `deep` `#156898` stays). No pulse animations.
2. **Vivid status = icon + word, always.** In Synch `#1f9d55` with ✓; Small Gap gold `#f2b705` with ≈ and a 1 px `#665624` edge; Gap orange `#d96a00` with a flag. Chip grounds `#e8f6ec` / `#fdf5d6` / `#fdeddc`, inks `#2f6a4b` / `#665624` / `#7f5219`. Under Full tolerance, a 1-step Small Gap keeps its word and ≈ but takes the Gap colour ("Small Gap · Not OK under Full"). Colour is never the only cue.
3. **Locked 1–5 answer scale.** `#f2bc9f` `#f1cc95` `#e9daa2` `#cbd9a6` `#acd0b4` (`bg-scale-1…5`), every cell numbered; M/E party markers with a 2 px white ring; chosen values bold with a dark-teal underline. Do not change these values.
4. **No red anywhere** except scale step 1. Destructive actions are neutral graphite outline buttons with an × icon. No `red-*`/`rose-*` classes; `--destructive` is graphite.
5. **The Counterparty never sees a price, the word "trial", a card ask or an extension.** Paused reads "Paused · Waiting on Marcus" for them.
6. **Live Aspect changes are proposed, not silent.** Once Stage 6 is live, editing an Aspect creates a proposed change both people Accept or Decline. Do not port the repo's silent Aspect-edit function to live relationships.
7. **Archive over delete.** Default to Archive (reversible) for templates and relationships; hard delete only where there is no shared data and it is confirmed.
8. **Title Case for labels, buttons, tabs and headings, with no ending period**; sentence case for sentences. Product terms are capitalized: Aspect, Feel, Wish, Think, Guess, Stage, Align, In Synch, Small Gap, Gap, Alignment Tolerance.
9. **Route conflict.** The repo's public catalog is `/relationship-types`; the v2 route is **`/relationship-templates`**. Ship `/relationship-templates` and `/relationship-templates/[slug]`, permanently redirect (308) `/relationship-types` and `/relationship-types/[slug]` to them, and update `RELATIONSHIP_TYPES_PATH` (`lib/flow/paths.ts`) so no link points at the old route.
10. **Card-free trial, decided placement and start.** Stage 4 is the account only. The Stage 5 primary button is **Continue with 7 Days Free** and only sends the invite. **The 7-day free trial starts when the Counterparty accepts** (both parties in). Drafts and sent-but-pending invites use no trial days. This replaces PR #1116's start at relationship creation and the earlier prototype start-at-send copy; PR #1116 must move its grant to acceptance. When the 7 days end without a card, Stage 6 pauses read-only (nothing lost) and the Initiator gets one free 7-day extension, once.
11. **One status and one next action per state.** Banners confirm what just happened and never repeat the status.
12. **Layout.** QuizHub breakpoints, content capped at 1440 px (`max-w-content`), `data-qh` on prototype elements names the QuizHub source to reuse.

## Suggested React component boundaries

`AdminPermissionsPage` → `RulesList`, `MatrixCounts`, `MatrixFilters`, `P0GapList`, `ConflictsPanel`, `MatrixTable` (desktop) / `MatrixCards` (390), `MatrixFailure`.

## Prototype mechanics that must not be ported

- The dashed **"Prototype Only · …"** bar is a review tool (this page does not draw one). Drop it anywhere it appears.
- `?broken=1` is a prototype-only preview of the failure state. In the app, render the failure state only when the source file cannot be parsed.
- Filter query params (`object`, `role`, `status`, `upstream`, `priority`) **are** product deep-links and must be ported.
- The prototype file is named `admin-crud-matrix.html`; the product route is `/admin/permissions`. The Docs neighbour in the prototype is a static label (the product already has `/admin/docs`).
- `js/proto.js` and `js/crud-matrix.js` are preview behaviour only. Rebuild in React; do not ship the files.
- Do not change the matrix's decisions in the UI; disagreements go to #1119.

## Validation checklist

- Compare with `reference/admin-crud-matrix-1280.png` and `reference/admin-crud-matrix-390.png` (also `-filtered` and `-broken`). No overflow at 390 / 1280.
- An admin sees "CRUD & Permissions" in the Admin group directly below Docs; a support seat and a member do not.
- `/admin/permissions` renders every source row; header counts match the source file.
- Each filter narrows the table and is kept in the URL; filters combine.
- The P0 gap panel lists the 11 items; the role rules render in the page header; the triage Page and #1119 links are present; the page has no edit controls.

### Accessibility and behaviour

- Keyboard traversal and visible focus on every control; skip link to `#main`; one `h1` per page and an ordered heading outline.
- Status is never colour-only: icon + word on every chip.
- Contrast: inks ≥ 4.5:1 on their tints, UI marks ≥ 3:1 (values in `css/tokens.css` were checked; re-check with the app's real variables).
- Touch targets ≥ 44 px on mobile; reduced-motion disables smooth scroll and transitions.
- In-text links are underlined (not hover-only), so they are not colour-only.
- If a region scrolls, it is focusable and named.
- axe-core (wcag2a + wcag2aa): 0 violations on every state (the prototype passes at 390 and 1280).

### Repository checks

Run from the app repository after implementation:

```bash
pnpm nav:menu --check
# exit 0; admin-permissions resolves, sits after admin-docs
pnpm vitest run tests/nav-menu.test.ts tests/admin-permissions.test.ts
# new test: member → 404, signed-out → /login?next=/admin/permissions, admin → 200
pnpm data:check
# E10 / E36 clean
pnpm typecheck
pnpm lint            # includes scripts/lint-brand-classes.mjs, both brand lanes
pnpm test
pnpm build
bash scripts/verify.sh   # exit 0, both brand lanes
rg -n "bg-(red|rose)-|text-(red|rose)-|border-(red|rose)-" components app   # 0 hits in the AlignSynch lane
```

Do not weaken existing route, data, brand or copy-ownership checks to make the page pass.

## Must not

- Must not add any write path, server action or form; v1 is read-only.
- Must not add a third gate style: same `requireAdminProduct()` → `requireAdmin()` order as `/admin/docs`, 404 for members (never 403).
- Must not place the row outside `group-admin` or anywhere other than directly after `admin-docs`.
- Must not hand-copy the matrix into a component; rows come from the one source file (copy stays in `data/pages/*`, E23).
- Must not reuse `/admin/gaps` (that is the existing console gaps page, `console-gaps`).
- Must not change the matrix's decisions; disagreements go to #1119.

## Definition of done

The Admin rail shows "CRUD & Permissions" directly under Docs for an admin only; `/admin/permissions` is read-only, count-accurate, filterable and shareable; tokens only; axe 0 at 390 and 1280; `pnpm nav:menu --check`, the new vitest file, `pnpm data:check` and `bash scripts/verify.sh` pass; owner review before deployment.

## Appendix: generated inventory

Generated from the bundled HTML so the build team can diff against it. Headings are the visible copy; buttons are every visible button or button-styled link label.

### `admin-crud-matrix.html` · CRUD & Permissions · AlignSynch v2.0 prototype

**Headings:** H1 “CRUD & Permissions” · H2 “Rules Every #1119 Child Must Honour” · H2 “P0 Gaps” · H2 “Conflicts and Decisions” · H2 “The Matrix” · H2 “The Matrix Source Could Not Be Read” (failure state)

**Buttons and actions:** “Clear Filters” · account menu (“MR”)

<!-- bundle-nav:begin -->

[Bundles index](../README.md) › **Admin CRUD & Permissions matrix** · prev [11-spec-design-page-account-settings-v2](../11-spec-design-page-account-settings-v2/README.md) · next none

<!-- bundle-nav:end -->
