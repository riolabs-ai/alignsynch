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
import {
  DEFAULT_NAV_SOURCE,
  NAV_SOURCES,
  coverageOf,
  navSourceFrom,
  unplacedOf,
  type NavCoverage,
  type NavDocumentView,
  type NavInventory,
  type NavSource,
  type UnplacedSurface,
} from "./nav-reconcile";
import { navViewer, type NavCapability } from "./nav";
import navDocumentJson from "../data/nav-menu.json" with { type: "json" };
import navInventoryJson from "../data/nav-inventory.json" with { type: "json" };

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
   * A capability the row additionally requires (#1252) — the second, narrower gate beside `needs`.
   *
   * It exists because a rung cannot say this: `admin-spec` needs `stakeholder`, and a `support` seat
   * ranks *above* that rung while being refused the spec. `needs` is the rung the row is drawn for,
   * `capability` is the answer to the question a rung cannot ask, and a row without one is filtered
   * by `needs` alone — every row that existed before #1252.
   */
  readonly capability?: NavCapability;
  /**
   * Match this row's own address only. Overview is the case: it has no children of its own, and
   * a prefix rule lit it beside whichever `/dashboard/*` page the reader was on.
   */
  readonly exact?: true;
  /** The first-run tour's anchor (`data-tour`), for the one row a tour step points at. */
  readonly tourAnchor?: string;
}

/**
 * A run of rows. `id` is the document's handle for the group — and the only identifier a
 * **title-less** group has, which is why it is here rather than being inferred from the heading.
 */
export interface NavGroup {
  readonly id: string;
  /**
   * The heading's label id in `data/pages/shell.ts`, resolved to words by the renderer — or
   * `undefined` for a group drawn with no heading (the project-spec row above the Admin heading).
   */
  readonly label?: string;
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
  // The document's `capability` is validated against `NAV_CAPABILITIES` by `nav:menu --check`
  // (the schema states it as a string — `content/nav.ts` may not import the chrome's module), so
  // this is the narrowing the schema cannot do.
  if (row.capability !== undefined) item.capability = row.capability as NavCapability;
  return item;
}

/**
 * The alignment rail, in the order the owner's review set — **one order for every role** (#929):
 * the project spec, then the operator's group, then the reader's own work, then the support
 * surfaces.
 *
 * **The project spec leads, and it is the one group with no heading.** The owner asked for the row
 * *above the Admin group title* (2026-11-19), and a row above a group's heading cannot live in that
 * group — so it has one of its own, ordered first, with `label` omitted: between the top of the rail
 * and the Admin heading there is nothing to name, and a heading reading "Project Spec" over a row
 * reading "Project Spec" is the same word twice. A group that omits `label` draws no heading
 * (`components/layout/nav-menus.tsx::NavGroup`), and `menuFor` drops it whole for the rungs that
 * cannot read the spec, exactly as it drops any empty group.
 *
 * `needs` gates a row's **visibility only**. A role that cannot reach a row does not see it, and
 * the rows they can see keep the document's order — nobody gets a re-sorted menu. That is why the
 * review shelf and the health page sit inside `group-support` on the document's own terms rather
 * than being moved back to `group-admin` for the roles that can see them: two staff rows inside
 * the Support group is the owner's arrangement, drawn as written, and a later change is a version
 * bump plus a diff, never a second document or a per-role fork.
 *
 * **The Workspace group is three rows — #620 merged four, #877 added one back.** `My
 * Relationships` is `/dashboard/relationships` (the relationship *and* its assessment, in one
 * list), `My Assessments` is `/assessments` (the sessions the member is a party to), and
 * `Templates` is `/dashboard/templates` (one destination, two tabs: the catalogue and what this
 * member owns). The rows #620 replaced were `/dashboard` (the Overview), `My Templates` and
 * `Library`; the last two named three shelves a person had to tell apart, and the third —
 * `/dashboard/library` — is a 308 to the Templates tab that absorbed it (`next.config.mjs`). The
 * Overview keeps answering at `/dashboard`; it is no longer a rail row.
 *
 * **Admin leads with the inbox.** The console is the hub for its own subtree (users, templates,
 * relationships) and it had no entry anywhere in the UI before #542 phase 2, so it stays the
 * second row; `/admin/audit` is last, because the log is where an operator checks what the rows
 * above it did. The review shelf and the health page have moved to `group-support` (#929) and are
 * drawn there for the roles that can reach them.
 *
 * **A staff row may live in Support.** `/admin/review` and `/admin/health` are `needs: "admin"`
 * rows inside `group-support` — the owner's arrangement, and the reason the rule below is about
 * *one named group*, not "no `/admin` href outside `group-admin`".
 *
 * **The group's floor is `support`, and each row carries its own.** A `support` seat sees the one
 * row they work — the inbox — and no page they would be refused. A group draws only when at least
 * one of its rows survives (`menuFor`), so a member sees no Admin heading at all.
 *
 * **No `/admin` destination is outside the document's staff groups.** The five were once a second,
 * separately gated list above the member's rows; one document is what makes "an operator row is in
 * `group-admin` or one of the two staff rows named in `group-support`" a fact a test asserts by
 * looking at one array.
 *
 * **A `hidden` row is in the document and not in this array.** It is the operator's way to take a
 * row off the rail without losing its place, its note and the fact that it exists — the reason it
 * is hidden is written beside it, and `scripts/nav-menu.ts --check` refuses one without.
 */
export const ALIGN_MENU: readonly NavGroup[] = DOCUMENT.groups.map((group) => ({
  id: group.id,
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
 *
 * **`capabilities` is the second gate, and it defaults to the role's own viewer** (#1252). A row
 * that names a `capability` is drawn only when the viewer carries it; `admin-spec` needs
 * `stakeholder` *and* `spec-read`, which is how a `support` seat — admitted by the rung — is still
 * not shown the row. The default is `navViewer(role).capabilities` rather than a hard `false`, so a
 * caller that only has a role (the validator's `--tree`, `tests/nav-menu.test.ts`) gets exactly the
 * set the shell would build for that role.
 */
export function menuFor(
  role: UserRole | null,
  capabilities: ReadonlySet<NavCapability> = navViewer(role).capabilities,
): NavGroup[] {
  const viewer = role ?? DEFAULT_USER_ROLE;
  return ALIGN_MENU.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.filter(
      (item) =>
        roleAdmits(item.needs, viewer) &&
        (item.capability === undefined || capabilities.has(item.capability)),
    ),
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

/* ------------------------------------------------------------------ *
 * The reconciler (#862)
 * ------------------------------------------------------------------ */

/**
 * The tree, as `pnpm nav:menu --inventory` wrote it — the derived half.
 *
 * A committed file rather than a walk, because this module is imported by a client component and
 * the browser has no `app/` to read. `data:check` **E43** re-walks the tree on every gate run and
 * fails when this file and the tree disagree, so the copy cannot drift: the file is a *cache of a
 * fact*, never a second source of it.
 */
const INVENTORY = navInventoryJson as unknown as NavInventory;

/**
 * The document, flattened to the shape the reconciler reads: every row (hidden ones included) and
 * the `unlisted` list. One adapter, so `unplacedOf` and `coverageOf` cannot disagree about what the
 * document says.
 */
const DOCUMENT_VIEW: NavDocumentView = {
  rows: DOCUMENT.groups.flatMap((group) => group.items),
  unlisted: DOCUMENT.unlisted ?? [],
};

/**
 * What the rail reconciles against — `both` unless the build says otherwise.
 *
 * **A build-time value, deliberately.** It is read here at import and inlined into both bundles
 * through `next.config.mjs`'s `env` block, because a *runtime* read would make the server render
 * the document and the hydration render the tree — React `#418`, the exact class of bug
 * `content/core.ts`'s fixture clock exists to prevent. So the toggle is "build this tree with
 * `NAV_SOURCE=derived` and look", not a request-time flag.
 *
 *   `document`  the file is the rail; no findings drawn (trust the document).
 *   `derived`   the tree is the rail; the document is not consulted (the truth test).
 *   `both`      the default: the document draws, the tree fills `Unplaced`.
 */
export const BUILD_NAV_SOURCE: NavSource = navSourceFrom(process.env.NAV_SOURCE);

/** The sources this module understands, re-exported so callers need not import two modules. */
export { NAV_SOURCES, DEFAULT_NAV_SOURCE };
export type { NavSource, UnplacedSurface };

/** The rail as one viewer sees it: the document's groups, and the doors it does not draw. */
export interface Rail {
  readonly groups: NavGroup[];
  /**
   * The `Unplaced` group, as rows. **Drawn for `owner` only** — an operator's rail is where a
   * missing door belongs, and a member's rail is not a to-do list. `derived` is the one mode that
   * has nothing else to draw, so it is the one mode whose groups are empty.
   */
  readonly unplaced: readonly UnplacedSurface[];
}

/**
 * The rail, reconciled (#862): `menuFor` plus the doors the document does not draw.
 *
 * `menuFor` is untouched on purpose — it is the document's own view, and the four rungs' menus are
 * pinned by `tests/nav-menu.test.ts`. This function is the *rail's* view: the same groups, then the
 * `Unplaced` group for the one role that owns the finding. The two are separate so "what the file
 * says" and "what the shell draws" can be compared instead of confused.
 *
 * A `hidden` row, an `unlisted` surface and a route nobody accounted for all land in the same
 * list, in that order, with the reason beside each: losing a door on purpose is fine, discovering
 * one is not.
 */
export function railFor(
  role: UserRole | null,
  capabilities: ReadonlySet<NavCapability> = navViewer(role).capabilities,
  source: NavSource = BUILD_NAV_SOURCE,
): Rail {
  const groups = source === "derived" ? [] : menuFor(role, capabilities);
  const unplaced =
    (role ?? DEFAULT_USER_ROLE) === "owner" ? unplacedOf(DOCUMENT_VIEW, INVENTORY, source) : [];
  return { groups, unplaced };
}

/**
 * The census the gate prints and the CLI reports — `walked / static / in jurisdiction / placed /
 * unlisted / unaccounted`, computed from the same two files the rail reads.
 *
 * Exported so a test can assert the numbers rather than a rendering of them, and so the CLI's
 * `--inventory --check` and `data:check` E43 cannot grow two definitions of "accounted for".
 */
export function navCoverage(): NavCoverage {
  return coverageOf(INVENTORY, DOCUMENT_VIEW);
}
