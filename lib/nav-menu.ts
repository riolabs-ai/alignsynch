/**
 * The alignment rail's menu, as **data** — the role-constrained navigation of #542 phase 2, and
 * since #861 a versioned document (`data/nav-menu.json`) with a schema (`content/nav.ts`) and a
 * validator (`pnpm nav:menu --check`).
 *
 * Before #542 the rail was six `NavRow` elements written one after another in
 * `components/layout/nav-menus.tsx`, and the one thing the markup could not say was *who* a row
 * was for. The operator's rows were gated whole (`sees(viewer, "admin-console")`), so the menu
 * knew two classes of person — operator and not — and `/admin/console`, the hub every other
 * console page hangs off, was in neither list: an admin could reach it only by typing the URL.
 *
 * Three properties make that class of defect visible instead of shipped:
 *
 *   - **A row names its rung.** `needs` is a `UserRole` from the same ladder
 *     (`lib/admin/roles.ts`, `content/identity.ts::USER_ROLES`), and `menuFor()` is one rank
 *     comparison against it. A member is not shown a row they cannot use; a `support` seat is
 *     shown the one queue they work; `owner` passes every gate `admin` passes without a second
 *     list to keep in step.
 *   - **A row is one record.** Adding a destination is one object with its fixture id, its href,
 *     its icon and its floor, so "the console has no way in" is a missing *line* a reviewer can
 *     count rather than a missing block of JSX nobody diffs.
 *   - **The descriptor cannot disagree with the link gate.** The rows are records with `href`
 *     properties, which `data:check` E10 reads specially (`scripts/ui-refs.ts` matches `href:`
 *     too, not only `href=` attributes). Since #861 the hrefs live in JSON, where no source
 *     scanner can see them, so the gate moved with them: `scripts/nav-menu.ts --check` resolves
 *     every row against `content/routes.ts`, and it runs in every lane of `scripts/verify.sh`.
 *     The E10 entry for this file stays — a typo'd literal here is still a red build.
 *
 * **Hiding is not authorisation.** Nothing here is a gate: every `/admin/*` page answers a signed-
 * in member with `notFound()` (`lib/auth/require-role.ts`) and every audited write re-asks its
 * floor inside the transaction (`lib/admin/act.ts`). This module decides what a rail *draws*; the
 * route and the action decide what it *does*, and the two are deliberately separate statements of
 * the same policy.
 *
 * **Pure — no React, no Next, no zod, no clock.** The icon is a *name*, resolved to a lucide
 * component by the renderer, so a node test can drive every rung against the whole descriptor
 * without a browser (`tests/nav-menu.test.ts`), and the label ids are checked against
 * `data/pages/shell.ts` by the same file. `content/nav.ts` carries the schema and zod; this module
 * imports its **types only**, which are erased — the browser bundle never sees the schema.
 *
 * **The document is read once, at import.** The JSON is a compile-time import, so the rail costs
 * one parse per process and no I/O at request time, and a row that is in `data/nav-menu.json` is in
 * the build. What the parse cannot prove — that a href resolves, that a label id exists, that a
 * hidden row says why — is `nav:menu --check`'s half of the contract, and it is a gate step.
 */
import { DEFAULT_USER_ROLE, roleAdmits, type UserRole } from "../content/role-ladder";
import type { NavDocument, NavIcon, NavRowRecord } from "../content/nav";
import navDocumentJson from "../data/nav-menu.json" with { type: "json" };

/** The glyphs a rail row may draw. A name, not a component: this module holds no JSX. */
export type NavIconName = NavIcon;

/** One destination in the rail. */
export interface NavItem {
  /** The label id in `data/pages/shell.ts`'s `nav-alignsynch` section. */
  readonly id: string;
  /** The destination. A literal, so the validator resolves it against the route manifest. */
  readonly href: string;
  readonly icon: NavIconName;
  /**
   * The lowest rung that is shown this row — the ladder in `lib/admin/roles.ts`, never a new
   * vocabulary. A row a role cannot use is not rendered (not hidden, not disabled): the route
   * behind it answers 404 for that role, and a row pointing at a 404 advertises a surface.
   */
  readonly needs: UserRole;
  /**
   * Match this row's own address only. Overview is the case: it has no children of its own, and
   * a prefix rule lit it beside whichever `/dashboard/*` page the reader was on.
   */
  readonly exact?: true;
  /** The first-run tour's anchor (`data-tour`), for the one row a tour step points at. */
  readonly tourAnchor?: string;
}

/** A labelled run of rows. The label is a fixture id, like every other word in the rail. */
export interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

/**
 * The document, narrowed to the shape this module reads.
 *
 * TS checks the {@link NavDocument} assertion is structurally possible (an `icon: string` in the
 * JSON is comparable to the icon union), and `pnpm nav:menu --check` — a gate step in every lane —
 * is what proves the *values*: the rung, the route, the label id, the hidden row's reason.
 */
const DOCUMENT = navDocumentJson as NavDocument;

/**
 * A group's rows in drawing order: `order` when a row carries one, document order otherwise.
 *
 * `order` is the escape hatch for the one edit the document's own order cannot make — a row that
 * belongs between two rows of a group being edited elsewhere — and it is deliberately not the
 * default: reading a group top to bottom is the common case, and a document that reads that way
 * should not need a number on every row to say so.
 */
function drawnRows(row: readonly NavRowRecord[]): NavRowRecord[] {
  return row
    .map((candidate, index) => ({ candidate, index }))
    .sort((a, b) => (a.candidate.order ?? a.index) - (b.candidate.order ?? b.index))
    .map(({ candidate }) => candidate);
}

/** One document row as the rail's `NavItem` — the extra document fields (`note`, `reason`) dropped. */
function toItem(row: NavRowRecord): NavItem {
  const item: { -readonly [K in keyof NavItem]: NavItem[K] } = {
    id: row.label ?? row.id,
    href: row.href,
    icon: row.icon,
    needs: row.needs,
  };
  if (row.exact === true) item.exact = true;
  if (row.tourAnchor !== undefined) item.tourAnchor = row.tourAnchor;
  return item;
}

/**
 * The alignment rail, in the order the owner's review set: the reader's own work, then the support
 * surfaces, then the operator's group.
 *
 * **The Workspace group is two rows — #620 merged the four.** `My Relationships` is
 * `/dashboard/relationships` (the relationship *and* its assessment, in one list) and `Templates`
 * is `/dashboard/templates` (one destination, two tabs: the catalogue and what this member owns).
 * The rows this replaced were `/dashboard` (the Overview), `My Templates` and `Library`; the last
 * two named three shelves a person had to tell apart, and the third — `/dashboard/library` — is a
 * 308 to the Templates tab that absorbed it (`next.config.mjs`). The Overview keeps answering at
 * `/dashboard`; it is no longer a rail row, because the two rows above are the work and the
 * brand's own link is the way home.
 *
 * **Admin leads with `/admin/console`.** The console is the hub for its own subtree (users,
 * templates, relationships), and it had no entry anywhere in the UI — the defect this card exists
 * for. It is the group's first row, then the console's five existing destinations, then the two
 * staff surfaces that were also unreachable (`/admin/inbox`, `/admin/health`), and `/admin/audit`
 * last: the log is where an operator checks what the rows above it did.
 *
 * **The group's floor is `support`, and each row carries its own.** A `support` seat sees the one
 * row they work — the inbox — and no page they would be refused. The group is drawn when at least
 * one of its rows survives (`menuFor`), so a member sees no Admin heading at all.
 *
 * **No admin destination exists outside this group.** The five were once a second, separately
 * gated list above the member's rows; one group is what makes "an operator row is in the operator
 * group" a fact a test can assert by looking at one array.
 *
 * **A `hidden` row is in the document and not in this array.** It is the operator's way to take a
 * row off the rail without losing its place, its note and the fact that it exists — the reason it
 * is hidden is written beside it, and `scripts/nav-menu.ts --check` refuses one without.
 */
export const ALIGN_MENU: readonly NavGroup[] = DOCUMENT.groups.map((group) => ({
  label: group.label,
  items: drawnRows(group.items)
    .filter((row) => row.hidden !== true)
    .map(toItem),
}));

/**
 * What this role's rail draws: every row they may use, and only the groups that keep a row.
 *
 * `null` is nobody signed in — the shell is mounted on pages a visitor can read (`/`, `/pricing`
 * and every marketing route are outside this group, but `/profile/<handle>` and the public
 * catalogue's detail pages are inside it). A signed-out reader is shown the **member** menu, the
 * one the rail has always drawn for them: every one of those routes answers a signed-out request
 * with `redirect(/login?next=…)`, which is a working destination, so the rows are honest. They are
 * never shown a staff row, because `null` is below every rung.
 *
 * An empty group is not drawn: a heading over no rows is a promise the rail does not keep.
 */
export function menuFor(role: UserRole | null): NavGroup[] {
  const viewer = role ?? DEFAULT_USER_ROLE;
  return ALIGN_MENU.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => roleAdmits(item.needs, viewer)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Every row the rail can ever draw, flattened — the whole descriptor, unfiltered.
 *
 * The gate's view: `tests/nav-menu.test.ts` holds it equal to the union of `menuFor("owner")` and
 * `ALIGN_MENU` (they must be the same set, in the same order) and `scripts/nav-menu.ts` reads the
 * document the same way `data:check` reads any other file's links.
 */
export function allItems(): NavItem[] {
  return ALIGN_MENU.flatMap((group) => [...group.items]);
}
