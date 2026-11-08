/**
 * The app's information architecture, as **data** — the proposal in issue #721, drawn beside the
 * rail that ships instead of replacing it.
 *
 * `lib/nav-menu.ts` is what the rail *does* today: three groups, thirteen rows, and the four rows a
 * member sees. This module is what the owner asked for after using the console — *the console is
 * the product* — written down the same way, so the review screen (`/admin/review/ia`) can render a
 * real rail from it and a test can hold every proposed destination to the route manifest.
 *
 * **The diagnosis the shape answers.** Every capability the product sells — Relationship CRUD, an
 * assessment, the Gap — was reachable only through an operator URL: `ALIGN_MENU`'s member groups
 * hold four rows, and `/assessment/instances` and `/admin/gaps` appear in neither. Meanwhile one
 * noun had two homes that did not know about each other (Relationships at `/dashboard/relationships`
 * *and* `/admin/console/relationships`; Templates at three addresses; instances at two). So the
 * proposal does two things, and only two:
 *
 *   - **one noun, one row.** The four capabilities open the rail in the order the work happens:
 *     who you are working with → what you asked them → what they answered → where you differ.
 *   - **sub-grouping inside Operations.** One flat list of ten operator rows is why the console
 *     "has no navigation": a rail shows *where you can go*, never *what kind of thing you are
 *     looking at*. People · Content · Sessions · Money · System is that kind.
 *
 * **Every `href` is an existing destination.** Nothing here invents a screen; the test
 * `tests/app-ia.test.ts` resolves each one against `content/routes.ts`, and the screen map names
 * the route pattern (`[id]`) rather than a concrete id.
 *
 * **One product decision, recorded and not smuggled in.** Gap Analysis (`/admin/gaps`) is a
 * member's own alignment report, so the proposal draws it in Workspace for a `member` — but the
 * page still answers `requireAdmin()` and this branch does not move that gate. The row's `needs`
 * is the *proposed* rung, and `APP_IA_PLACEMENTS` says in words that the gate is unchanged until
 * #721's decision is taken. A prototype that quietly changed a permission would be a ship.
 *
 * **Pure — no React, no Next, no zod, no clock.** Icons are *names*, resolved to a component by
 * the one renderer (`components/admin/ia-rail-preview.tsx`), which is the same rule
 * `lib/nav-menu.ts` keeps: the descriptor is data, the glyph is how a rail draws it.
 */
import type { UserRole } from "../content/role-ladder";

/**
 * The glyphs this proposal draws. Deliberately a wider vocabulary than `NavIconName` — a
 * destination gets the picture that says what it *is* (`users`, `reports`), and the rail preview
 * owns the table that resolves a name to a lucide component. A name with no entry is a type error
 * rather than a blank square.
 */
export type AppIaIconName =
  | "overview"
  | "relationships"
  | "templates"
  | "assessments"
  | "gap"
  | "invitations"
  | "reports"
  | "console"
  | "users"
  | "instances"
  | "inbox"
  | "health"
  | "billing"
  | "broadcast"
  | "review"
  | "audit"
  | "help"
  | "support";

/**
 * How a screen is navigated — the second half of the fix, and the reason the console "has no
 * navigation" even when every page is reachable. Three shapes cover the proposal; `single` is the
 * honest fourth for a screen with no detail page behind it (a report, a log, a hub).
 *
 *   list-detail  a list, and one row opens a detail with a back link and a breadcrumb
 *   tab-rail     one entity's detail, the same tab strip wherever that entity is drawn
 *   row-actions  a screen reached from a row action on the list — never a rail row of its own
 *   single       one screen, no detail beneath it
 */
export type AppIaPattern = "list-detail" | "tab-rail" | "row-actions" | "single";

/** One destination in the proposed rail. */
export interface AppIaRow {
  /** The copy id in `data/pages/admin-review-ia.ts`'s `nav-alignsynch` section. */
  readonly id: string;
  /** The destination. A literal, so a test (and a reviewer) can resolve it against the manifest. */
  readonly href: string;
  readonly icon: AppIaIconName;
  /**
   * The rung this row is *proposed* for. Not a gate: the page behind a moved row keeps the floor
   * it has today, and `APP_IA_PLACEMENTS` says which row that is.
   */
  readonly needs: UserRole;
  /** One sentence on why the row exists where it does. Rendered by the review screen. */
  readonly note: string;
}

/** A labelled run of rows inside a group — Operations is the only group that has one today. */
export interface AppIaSubGroup {
  /** The copy id for the sub-heading (`people`, `content`, `sessions`, `money`, `system`). */
  readonly id: string;
  readonly items: readonly AppIaRow[];
}

/** One heading in the rail, with its own rows and, where the group is broad, sub-groups. */
export interface AppIaGroup {
  /** The copy id for the heading (`group-workspace` …). */
  readonly id: string;
  /** Rows that sit directly under the heading, above any sub-group. */
  readonly items: readonly AppIaRow[];
  /**
   * **Row actions, not destinations.** A screen reached from one of the group's own rows — the
   * report you open from an instance row — belongs to the group's *verbs*, not to its rail. It
   * carries the same shape so the screen map and the copy stay one table, but nothing renders it
   * as a link: a rail row pointing at `/admin/instances/[id]/report` would link the literal
   * placeholder, because a rail cannot know which instance you meant.
   */
  readonly actions: readonly AppIaRow[];
  readonly subGroups: readonly AppIaSubGroup[];
}

/**
 * The proposal, in the order the work happens.
 *
 * **Workspace is the product.** Five rows, in the lifecycle's own order — Overview, the
 * relationships themselves, the templates they are built from, the assessments they run, and the
 * Gap between the two parties' answers. The Overview returns as a row here after #620 retired it:
 * a dashboard nobody can reach from the rail was the same defect the console hub had.
 *
 * **Do is what a member performs on a relationship.** Invitations is an existing queue
 * (`/admin/inbox`); Reports is the one row that is a *row action* rather than a rail destination,
 * and it is drawn anyway because "where is the report" was one of the questions the console could
 * not answer — the screen map marks its pattern so the prototype does not pretend it is a page.
 *
 * **Operations is the operator's group, sub-grouped for the first time.** Console first (the hub
 * every other console page hangs off), then People, Content, Sessions, Money and System — the five
 * kinds of thing an operator looks at.
 *
 * **Support is unchanged** in membership and order; `How It Works` becomes `Help`, which is the
 * destination it always pointed at.
 */
export const APP_IA_GROUPS: readonly AppIaGroup[] = [
  {
    id: "group-workspace",
    items: [
      {
        id: "overview",
        href: "/dashboard",
        icon: "overview",
        needs: "member",
        note: "The member's home: what needs them today, across every relationship they are in.",
      },
      {
        id: "relationships",
        href: "/dashboard/relationships",
        icon: "relationships",
        needs: "member",
        note: "The relationship and its assessment in one list — who you are working with first, because everything else hangs off it.",
      },
      {
        id: "templates",
        href: "/dashboard/templates",
        icon: "templates",
        needs: "member",
        note: "What the assessment asks: the catalogue and the templates this member owns, one destination with two tabs.",
      },
      {
        id: "assessments",
        href: "/assessment/instances",
        icon: "assessments",
        needs: "member",
        note: "The sessions themselves — what was sent, what came back, and what is still waiting. Reachable today by typing the URL.",
      },
      {
        id: "gap-analysis",
        href: "/admin/gaps",
        icon: "gap",
        needs: "member",
        note: "Where the two parties differ, aspect by aspect. The one row whose audience changes — the page keeps its operator gate on this branch.",
      },
    ],
    actions: [],
    subGroups: [],
  },
  {
    id: "group-do",
    items: [
      {
        id: "invitations",
        href: "/admin/inbox",
        icon: "invitations",
        needs: "member",
        note: "The queue of people who wrote in, read as the invitations and replies a relationship needs — one existing surface, named for the verb.",
      },
    ],
    actions: [
      {
        id: "reports",
        href: "/admin/instances/[id]/report",
        icon: "reports",
        needs: "member",
        note: "One relationship's report, opened from its row rather than from the rail. An action, not a destination: the path carries an instance id the rail cannot know, so the screen map marks it `row-actions` and nothing draws it as a link.",
      },
    ],
    subGroups: [],
  },
  {
    id: "group-operations",
    items: [
      {
        id: "console",
        href: "/admin/console",
        icon: "console",
        needs: "admin",
        note: "The operator's hub, first in its own group — it had no entry anywhere in the UI until #542, and it still explains none of the rows below it.",
      },
    ],
    actions: [],
    subGroups: [
      {
        id: "people",
        items: [
          {
            id: "users",
            href: "/admin/console/users",
            icon: "users",
            needs: "admin",
            note: "The people directory: who has an account, at which rung, in which relationships.",
          },
          {
            id: "operations-relationships",
            href: "/admin/console/relationships",
            icon: "relationships",
            needs: "admin",
            note: "The operator's view of the same noun Workspace opens — deliberately second, because a member's own list is the product and this is its repair screen.",
          },
        ],
      },
      {
        id: "content",
        items: [
          {
            id: "operations-templates",
            href: "/admin/console/templates",
            icon: "templates",
            needs: "admin",
            note: "Every template in the tenant, including the ones no member has used.",
          },
          {
            id: "review",
            href: "/admin/review",
            icon: "review",
            needs: "admin",
            note: "The review shelf: published artifacts, their to-dos and their feedback.",
          },
        ],
      },
      {
        id: "sessions",
        items: [
          {
            id: "instances",
            href: "/admin/instances",
            icon: "instances",
            needs: "admin",
            note: "Every assessment in flight, filterable by stage. Labelled Relationships today, which is the collision this proposal removes.",
          },
          {
            id: "inbox",
            href: "/admin/inbox",
            icon: "inbox",
            needs: "support",
            note: "The support queue's operator view — the same page Invitations names for a member, drawn once per audience.",
          },
        ],
      },
      {
        id: "money",
        items: [
          {
            id: "billing",
            href: "/admin/billing",
            icon: "billing",
            needs: "admin",
            note: "Each relationship's plan, the owner's comp, and the limit a plan sets.",
          },
        ],
      },
      {
        id: "system",
        items: [
          {
            id: "health",
            href: "/admin/health",
            icon: "health",
            needs: "admin",
            note: "The platform's own health: last gate lane, release drift, database verification.",
          },
          {
            id: "broadcast",
            href: "/admin/broadcast",
            icon: "broadcast",
            needs: "admin",
            note: "A one-off notice to the news list, dry-run before it sends.",
          },
          {
            id: "audit",
            href: "/admin/audit",
            icon: "audit",
            needs: "admin",
            note: "The log of what every row above it did. Last, because it is the record.",
          },
        ],
      },
    ],
  },
  {
    id: "group-support",
    items: [
      {
        id: "help",
        href: "/dashboard/help",
        icon: "help",
        needs: "member",
        note: "How it works, in the product. Today's rail calls this row How It Works; the destination is the same.",
      },
      {
        id: "support",
        href: "/dashboard/support",
        icon: "support",
        needs: "member",
        note: "The account's support page, unchanged.",
      },
    ],
    actions: [],
    subGroups: [],
  },
];

/** One screen in the map: what it is, where it hangs, and how a reader moves through it. */
export interface AppIaScreen {
  /** The copy id for the screen's name in the fixture. */
  readonly id: string;
  /** The route pattern, as `content/routes.ts` spells it. */
  readonly href: string;
  /** The group id it hangs under (`group-workspace` …). */
  readonly group: string;
  /** The row id it belongs to. */
  readonly row: string;
  readonly pattern: AppIaPattern;
}

/**
 * The screen map — screen → group → row → navigation pattern.
 *
 * A row is a destination; a screen is what you look at once you are there. The distinction is the
 * whole of the second half of the diagnosis: `/admin/console/users/[id]` had no back link, so the
 * only way out was the browser's own button, and `/admin/instances/[id]` was a cul-de-sac the same
 * way. Every `list-detail` screen below is promised a breadcrumb (`Operations › People › Users ›
 * Ada`) and a back link at the top-left; every `tab-rail` screen the same tab strip its sibling
 * draws.
 */
export const APP_IA_SCREEN_MAP: readonly AppIaScreen[] = [
  {
    id: "screen-overview",
    href: "/dashboard",
    group: "group-workspace",
    row: "overview",
    pattern: "single",
  },
  {
    id: "screen-relationships",
    href: "/dashboard/relationships",
    group: "group-workspace",
    row: "relationships",
    pattern: "list-detail",
  },
  {
    id: "screen-relationship-detail",
    href: "/dashboard/relationships/[id]",
    group: "group-workspace",
    row: "relationships",
    pattern: "tab-rail",
  },
  {
    id: "screen-templates",
    href: "/dashboard/templates",
    group: "group-workspace",
    row: "templates",
    pattern: "list-detail",
  },
  {
    id: "screen-template-detail",
    href: "/dashboard/templates/[id]",
    group: "group-workspace",
    row: "templates",
    pattern: "tab-rail",
  },
  {
    id: "screen-assessments",
    href: "/assessment/instances",
    group: "group-workspace",
    row: "assessments",
    pattern: "list-detail",
  },
  {
    id: "screen-assessment-detail",
    href: "/assessment/instances/[instanceId]",
    group: "group-workspace",
    row: "assessments",
    pattern: "tab-rail",
  },
  {
    id: "screen-gap",
    href: "/admin/gaps",
    group: "group-workspace",
    row: "gap-analysis",
    pattern: "single",
  },
  {
    id: "screen-invitations",
    href: "/admin/inbox",
    group: "group-do",
    row: "invitations",
    pattern: "list-detail",
  },
  {
    id: "screen-report",
    href: "/admin/instances/[id]/report",
    group: "group-do",
    row: "reports",
    pattern: "row-actions",
  },
  {
    id: "screen-console",
    href: "/admin/console",
    group: "group-operations",
    row: "console",
    pattern: "single",
  },
  {
    id: "screen-users",
    href: "/admin/console/users",
    group: "group-operations",
    row: "users",
    pattern: "list-detail",
  },
  {
    id: "screen-console-relationships",
    href: "/admin/console/relationships",
    group: "group-operations",
    row: "operations-relationships",
    pattern: "list-detail",
  },
  {
    id: "screen-console-relationship-detail",
    href: "/admin/console/relationships/[id]",
    group: "group-operations",
    row: "operations-relationships",
    pattern: "tab-rail",
  },
  {
    id: "screen-console-templates",
    href: "/admin/console/templates",
    group: "group-operations",
    row: "operations-templates",
    pattern: "list-detail",
  },
  {
    id: "screen-console-template-detail",
    href: "/admin/console/templates/[id]",
    group: "group-operations",
    row: "operations-templates",
    pattern: "tab-rail",
  },
  {
    id: "screen-instances",
    href: "/admin/instances",
    group: "group-operations",
    row: "instances",
    pattern: "list-detail",
  },
  {
    id: "screen-instance-detail",
    href: "/admin/instances/[id]",
    group: "group-operations",
    row: "instances",
    pattern: "list-detail",
  },
  {
    id: "screen-inbox",
    href: "/admin/inbox",
    group: "group-operations",
    row: "inbox",
    pattern: "list-detail",
  },
  {
    id: "screen-health",
    href: "/admin/health",
    group: "group-operations",
    row: "health",
    pattern: "single",
  },
  {
    id: "screen-billing",
    href: "/admin/billing",
    group: "group-operations",
    row: "billing",
    pattern: "single",
  },
  {
    id: "screen-broadcast",
    href: "/admin/broadcast",
    group: "group-operations",
    row: "broadcast",
    pattern: "single",
  },
  {
    id: "screen-review",
    href: "/admin/review",
    group: "group-operations",
    row: "review",
    pattern: "list-detail",
  },
  {
    id: "screen-audit",
    href: "/admin/audit",
    group: "group-operations",
    row: "audit",
    pattern: "single",
  },
  {
    id: "screen-help",
    href: "/dashboard/help",
    group: "group-support",
    row: "help",
    pattern: "single",
  },
  {
    id: "screen-support",
    href: "/dashboard/support",
    group: "group-support",
    row: "support",
    pattern: "list-detail",
  },
];

/**
 * Where each row of **today's** rail lands — the current-vs-proposed diff, one entry per
 * `ALIGN_MENU` item id.
 *
 * This exists so a reviewer reads the change rather than comparing two lists by eye, and so the
 * test can prove no destination was quietly dropped: every id in `lib/nav-menu.ts` must appear
 * here (with a group and a row that exist in `APP_IA_GROUPS`) or in `APP_IA_REMOVED`.
 */
export interface AppIaPlacement {
  /** The current row's id in `lib/nav-menu.ts`. */
  readonly id: string;
  /** The proposed group, or `null` for a row that is retired. */
  readonly group: string | null;
  /** The proposed row id, or `null` for a row that is retired. */
  readonly row: string | null;
  /** What changes for the reader, in one sentence. */
  readonly change: string;
}

export const APP_IA_PLACEMENTS: readonly AppIaPlacement[] = [
  {
    id: "my-relationships",
    group: "group-workspace",
    row: "relationships",
    change:
      "Same destination. The row stops saying “My”: the rail now names the noun, and Ownership is a filter on the list.",
  },
  {
    id: "templates",
    group: "group-workspace",
    row: "templates",
    change: "Unchanged — same href, same position in the member's work.",
  },
  {
    id: "how-it-works",
    group: "group-support",
    row: "help",
    change:
      "Renamed from “How It Works” to “Help”. The destination never changed; the old word described the page.",
  },
  {
    id: "support",
    group: "group-support",
    row: "support",
    change: "Unchanged.",
  },
  {
    id: "console",
    group: "group-operations",
    row: "console",
    change: "Leads the Operations group instead of opening a flat ten-row list.",
  },
  {
    id: "admin-instances",
    group: "group-operations",
    row: "instances",
    change:
      "Relabelled: today's row reads “Relationships”, which now names the member's page. The page and the href are untouched.",
  },
  {
    id: "console-gaps",
    group: "group-workspace",
    row: "gap-analysis",
    change:
      "Moves to Workspace and is proposed for a `member`. The only permission shift in this proposal — the page keeps `requireAdmin()` until #721's decision is taken.",
  },
  {
    id: "admin-inbox",
    group: "group-do",
    row: "invitations",
    change:
      "Appears twice on purpose: “Invitations” in Do for the member's work, and “Inbox” in Operations › Sessions for the support queue. One page, two audiences.",
  },
  {
    id: "admin-health",
    group: "group-operations",
    row: "health",
    change: "Moves under Operations › System as “Health”.",
  },
  {
    id: "admin-billing",
    group: "group-operations",
    row: "billing",
    change: "Moves under Operations › Money.",
  },
  {
    id: "admin-broadcast",
    group: "group-operations",
    row: "broadcast",
    change: "Moves under Operations › System.",
  },
  {
    id: "review",
    group: "group-operations",
    row: "review",
    change: "Moves under Operations › Content.",
  },
  {
    id: "admin-audit",
    group: "group-operations",
    row: "audit",
    change:
      "Moves under Operations › System, and stays last: it is the record of the rows above it.",
  },
];

/** A row of today's rail the proposal drops, with the reason. Empty, and kept so it can be read. */
export interface AppIaRemoved {
  readonly id: string;
  readonly href: string;
  readonly reason: string;
}

/**
 * Nothing in today's rail is removed.
 *
 * Every one of the thirteen rows lands somewhere in the proposal — which is the point worth
 * stating out loud, because the owner's complaint was that the *console* had no navigation, not
 * that it had too many rows. The array is declared anyway: a later revision that does drop a
 * destination has one place to say so, and `tests/app-ia.test.ts` reads it before it will accept
 * the map as complete.
 */
export const APP_IA_REMOVED: readonly AppIaRemoved[] = [];

/** Every proposed row, in rail order, sub-groups flattened — the whole descriptor. */
export function appIaRows(): AppIaRow[] {
  return APP_IA_GROUPS.flatMap((group) => [
    ...group.items,
    ...group.subGroups.flatMap((subGroup) => [...subGroup.items]),
  ]);
}

/**
 * Every row action, flattened. **Not** part of `appIaRows()`: these are verbs on a group's rows,
 * not destinations, and a rail that drew one would link a path with an id the rail cannot know.
 */
export function appIaActions(): AppIaRow[] {
  return APP_IA_GROUPS.flatMap((group) => [...group.actions]);
}

/** One proposed row by id, or `undefined` — the screen map's link back to the rail. */
export function appIaRowOf(id: string): AppIaRow | undefined {
  return [...appIaRows(), ...appIaActions()].find((row) => row.id === id);
}

/** The four headings in order — the assertion the group order is a fact, not a comment. */
export function appIaGroupIds(): string[] {
  return APP_IA_GROUPS.map((group) => group.id);
}
