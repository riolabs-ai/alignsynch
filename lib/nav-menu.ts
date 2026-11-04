/**
 * The alignment rail's menu, as **data** — the role-constrained navigation of #542 phase 2.
 *
 * Before this module the rail was six `NavRow` elements written one after another in
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
 *   - **The descriptor cannot disagree with the link gate.** The hrefs here are literals in a
 *     `lib/` module, which `data:check` E10 does not walk by default; `scripts/ui-refs.ts` reads
 *     `href:` properties too (not only `href=` attributes) and this file is in the scanned roots,
 *     so every row is still resolved against `content/routes.ts` and a typo is a red build.
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
 * `data/pages/shell.ts` by the same file.
 */
import { DEFAULT_USER_ROLE, roleAdmits, type UserRole } from "../content/role-ladder";

/** The glyphs a rail row may draw. A name, not a component: this module holds no JSX. */
export type NavIconName =
  | "dashboard"
  | "relationships"
  | "templates"
  | "library"
  | "help"
  | "support"
  | "console"
  | "instances"
  | "gaps"
  | "inbox"
  | "health"
  | "billing"
  | "broadcast"
  | "audit";

/** One destination in the rail. */
export interface NavItem {
  /** The label id in `data/pages/shell.ts`'s `nav-alignsynch` section. */
  readonly id: string;
  /** The destination. A literal, so E10 resolves it against the route manifest. */
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
 * The alignment rail, in the order the owner's review set: the reader's own work, then the support
 * surfaces, then the operator's group.
 *
 * **The Workspace rows are the member's four dashboards, and the two catalogue rows are gone.**
 * "My Relationships" and "My Templates" are `/dashboard/relationships` and `/dashboard/templates` —
 * the pages #533 phase 2 shipped, titled after these words — rather than the two `/assessment/*`
 * lists the rail used to point at (a party's assessment list and the public catalogue). Those two
 * are not deleted: the Overview's own cards open the first, and My Templates' clone band is the
 * second, so the rail keeps the four rows that are *this person's work* and the hub keeps the rest.
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
 */
export const ALIGN_MENU: readonly NavGroup[] = [
  {
    label: "group-app",
    items: [
      { id: "dashboard", href: "/dashboard", icon: "dashboard", needs: "member", exact: true },
      {
        id: "my-relationships",
        href: "/dashboard/relationships",
        icon: "relationships",
        needs: "member",
      },
      { id: "my-templates", href: "/dashboard/templates", icon: "templates", needs: "member" },
      { id: "template-library", href: "/dashboard/library", icon: "library", needs: "member" },
    ],
  },
  {
    label: "group-support",
    items: [
      {
        id: "how-it-works",
        href: "/dashboard/help",
        icon: "help",
        needs: "member",
      },
      {
        id: "support",
        href: "/dashboard/support",
        icon: "support",
        needs: "member",
        tourAnchor: "help",
      },
    ],
  },
  {
    label: "group-admin",
    items: [
      { id: "console", href: "/admin/console", icon: "console", needs: "admin" },
      { id: "admin-instances", href: "/admin/instances", icon: "instances", needs: "admin" },
      { id: "console-gaps", href: "/admin/gaps", icon: "gaps", needs: "admin" },
      { id: "admin-inbox", href: "/admin/inbox", icon: "inbox", needs: "support" },
      { id: "admin-health", href: "/admin/health", icon: "health", needs: "admin" },
      { id: "admin-billing", href: "/admin/billing", icon: "billing", needs: "admin" },
      { id: "admin-broadcast", href: "/admin/broadcast", icon: "broadcast", needs: "admin" },
      { id: "admin-audit", href: "/admin/audit", icon: "audit", needs: "admin" },
    ],
  },
];

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
 * `ALIGN_MENU` (they must be the same set, in the same order) and `scripts/__tests__` reads the
 * hrefs out of this module the way E10 reads any other file's.
 */
export function allItems(): NavItem[] {
  return ALIGN_MENU.flatMap((group) => [...group.items]);
}
