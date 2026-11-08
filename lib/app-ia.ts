/**
 * The app's information architecture, as **data** — the proposal in issue #721, revised to the
 * owner's feedback in **#731**, drawn beside the rail that ships instead of replacing it.
 *
 * `lib/nav-menu.ts` is what the rail *does* today: three groups, thirteen rows, and the rows a
 * member sees. This module is what the owner asked for after using the console, written down the
 * same way, so the review screen (`/admin/review/ia`) can render a real rail from it and a test can
 * hold every proposed destination to the route manifest.
 *
 * **v1's defect, and what v2 changes.** v1 answered "the console has no navigation" with one
 * `Operations` group: a `console` hub row on top of five sub-groups (people, content, sessions,
 * money, system) — nineteen rows, and every operator page still behind a hub you had to land on
 * first. The owner read that as *"way too many menu groups"* and asked for the shape a SaaS product
 * has: **four operator groups, each a main item whose pages are its submenu**, and the console's
 * pages folded into them rather than hung off it. So v2 does three things, and only three:
 *
 *   - **the member rail is untouched** in membership and order — Workspace, Do, and the Support
 *     band — because those are the patterns already approved;
 *   - **`Operations` is gone**, replaced by `Users`, `Templates`, `Billing` and `System`, each of
 *     which is a main item with its pages beneath it;
 *   - **`/admin/console` stops being a destination.** Its pages are the four groups' submenu rows,
 *     which is the owner's *"console functionality is part of core Admin UI"*. The hub row is
 *     recorded in `APP_IA_REMOVED` rather than silently dropped.
 *
 * **Template authoring is visible, and two thirds of it is proposed.** The owner asked that admins
 * "create or clone new templates drafts and publish revisions". `New template` is a real route
 * (`/assessment/templates/new`) and links. **Clone → draft** and **Publish revision** have no route
 * yet, so they carry `proposed: true`: they are drawn as controls, never as links, because a rail
 * must never point at a placeholder (the `isLinkableHref` rule the crash in #721 taught us).
 *
 * **One row shape, three renders.** A row is `{ id, href, icon, needs, note }` plus two flags:
 *
 *   proposed: true      no route exists — drawn as a `<button>`, never an `<a>`
 *   bracketed href      a route *pattern* (`/admin/templates/[id]`) — drawn as text, never a link
 *
 * Everything else is a destination and links. The renderer (`components/admin/ia-rail-preview.tsx`)
 * decides from those two facts only, so the preview cannot disagree with the tests.
 *
 * **Every `href` is an existing destination, unless it is marked proposed.** The test
 * `tests/app-ia.test.ts` resolves each one against `content/routes.ts`, and asserts a *proposed*
 * href resolves to nothing — a proposal that quietly became a route would otherwise look shipped.
 *
 * **One product decision, recorded and not smuggled in.** Gap Analysis (`/admin/gaps`) is a
 * member's own alignment report, so the proposal draws it in Workspace for a `member` — but the
 * page still answers `requireAdmin()` and this branch does not move that gate. The row's `needs`
 * is the *proposed* rung, and `APP_IA_PLACEMENTS` says in words that the gate is unchanged until
 * the decision is taken. A prototype that quietly changed a permission would be a ship.
 *
 * **Pure — no React, no Next, no zod, no clock.** Icons are *names*, resolved to a component by
 * the one renderer, which is the same rule `lib/nav-menu.ts` keeps: the descriptor is data, the
 * glyph is how a rail draws it.
 */
import type { UserRole } from "../content/role-ladder";

/**
 * The glyphs this proposal draws. Deliberately a wider vocabulary than `NavIconName` — a
 * destination gets the picture that says what it *is* (`users`, `catalogue`), and the rail preview
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
  | "users"
  | "inbox"
  | "library"
  | "new-template"
  | "clone"
  | "publish"
  | "instances"
  | "health"
  | "billing"
  | "broadcast"
  | "review"
  | "audit"
  | "system"
  | "help"
  | "support";

/**
 * Who a group is drawn for. This is what makes "two member groups and four admin groups" a fact a
 * test can count rather than a sentence in a docblock:
 *
 *   member   the reader's own work — Workspace and Do
 *   admin    platform operation — Users, Templates, Billing, System
 *   shared   the Support band, drawn under both rails because the same two pages serve both
 */
export type AppIaAudience = "member" | "admin" | "shared";

/**
 * How a screen is navigated — the second half of the fix, and the reason the console "has no
 * navigation" even when every page is reachable. Three shapes cover the proposal; `single` is the
 * honest fourth for a screen with no detail page behind it (a report, a log).
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
  /**
   * The destination. A literal, so a test (and a reviewer) can resolve it against the manifest.
   * For a **proposed** action this is the route the action would live at — a pattern, because no
   * page answers it yet, and the renderer refuses to link it.
   */
  readonly href: string;
  readonly icon: AppIaIconName;
  /**
   * The rung this row is *proposed* for. Not a gate: the page behind a moved row keeps the floor
   * it has today, and `APP_IA_PLACEMENTS` says which row that is.
   */
  readonly needs: UserRole;
  /** One sentence on why the row exists where it does. Rendered by the review screen. */
  readonly note: string;
  /**
   * **No route exists yet.** A proposed action is drawn as a button with its label and a
   * "proposed — no route yet" marker, and never as an `<a>`: a link to a page nobody has written
   * is the 404 the review artifact exists to prevent.
   */
  readonly proposed?: true;
}

/**
 * One group: **a main item, and the pages that are its submenu.**
 *
 * The group's own id is the main item's copy id — `Users`, `Templates`, `Billing`, `System` — and
 * the renderer draws it as a row-shaped control that opens and closes `items` beneath it. There is
 * no `subGroups` field any more: v1 nested five sub-headings inside `Operations`, which is the
 * structure the owner counted as "too many menu groups". One level is the whole point.
 */
export interface AppIaGroup {
  /** The copy id for the main item (`group-users` …). */
  readonly id: string;
  readonly audience: AppIaAudience;
  /** The main item's glyph. */
  readonly icon: AppIaIconName;
  /** The rung the whole group is proposed for — every row in it carries the same one. */
  readonly needs: UserRole;
  /** The submenu: the pages that hang off the main item. Drawn in this order. */
  readonly items: readonly AppIaRow[];
  /**
   * **Row actions, not destinations.** A screen reached from one of the group's own rows — the
   * report you open from an instance row — belongs to the group's *verbs*, not to its rail. It
   * carries the same shape so the screen map and the copy stay one table, but nothing renders it
   * in the preview: a rail row pointing at `/admin/instances/[id]/report` would link the literal
   * placeholder, because a rail cannot know which instance you meant.
   */
  readonly actions: readonly AppIaRow[];
}

/**
 * The proposal.
 *
 * **Workspace and Do are the member's own work, unchanged in membership and order.** Workspace is
 * the lifecycle — Home, the relationships, the templates they are built from, the assessments they
 * run, and the Gap between the two parties' answers. Do is what a member performs on a
 * relationship: Invitations, with Reports as a *row action* rather than a rail destination.
 *
 * **Users, Templates, Billing and System are the operator's four.** The console's pages are the
 * submenu rows here; `/admin/console` itself is not in the rail at all.
 *
 * **Support is a band both rails draw** — the same two pages serve a member and an operator, so
 * counting it as either audience would make one of them a lie.
 */
export const APP_IA_GROUPS: readonly AppIaGroup[] = [
  {
    id: "group-workspace",
    audience: "member",
    icon: "overview",
    needs: "member",
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
  },
  {
    id: "group-do",
    audience: "member",
    icon: "invitations",
    needs: "member",
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
        note: "One relationship's report, opened from its row rather than from the rail. An action, not a destination: the path carries an instance id the rail cannot know, so the screen map marks it `row-actions` and nothing draws it as a row.",
      },
    ],
  },
  {
    id: "group-users",
    audience: "admin",
    icon: "users",
    needs: "admin",
    items: [
      {
        id: "users",
        href: "/admin/console/users",
        icon: "users",
        needs: "admin",
        note: "The people directory: who has an account, at which rung, in which relationships. The group's landing page, because a user is what this group is about.",
      },
      {
        id: "operations-relationships",
        href: "/admin/console/relationships",
        icon: "relationships",
        needs: "admin",
        note: "The operator's view of the same noun Workspace opens — deliberately second, because a member's own list is the product and this is its repair screen.",
      },
      {
        id: "admin-invitations",
        href: "/admin/inbox",
        icon: "inbox",
        needs: "admin",
        note: "The support queue's operator view — the same page Do names for a member, drawn once per audience.",
      },
    ],
    actions: [],
  },
  {
    id: "group-templates",
    audience: "admin",
    icon: "templates",
    needs: "admin",
    items: [
      {
        id: "admin-templates",
        href: "/admin/templates",
        icon: "templates",
        needs: "admin",
        note: "All templates in the tenant, including the ones no member has used — the group's landing page, and the list an operator opens a template from.",
      },
      {
        id: "operations-templates",
        href: "/admin/console/templates",
        icon: "library",
        needs: "admin",
        note: "The catalogue view: the same templates as shelf cards, which is how an operator compares what is on offer rather than what exists.",
      },
      {
        id: "admin-template-editor",
        href: "/admin/templates/[id]",
        icon: "new-template",
        needs: "admin",
        note: "One template's editor. The path carries an id, so it is drawn as a pattern rather than a link — you arrive here from a row, never from the rail.",
      },
      {
        id: "review",
        href: "/admin/review",
        icon: "review",
        needs: "admin",
        note: "The review shelf: published artifacts, their to-dos and their feedback — kept in this group because what it reviews is authored content.",
      },
      {
        id: "template-new",
        href: "/assessment/templates/new",
        icon: "new-template",
        needs: "admin",
        note: "Create. A real route, so it links: the first of the three authoring actions the owner asked to see named here.",
      },
      {
        id: "template-clone",
        href: "/admin/templates/[id]/clone",
        icon: "clone",
        needs: "admin",
        note: "Clone an existing template into a draft. **Proposed** — no route answers this yet, so it is drawn as an action with a marker and never as a link.",
        proposed: true,
      },
      {
        id: "template-publish",
        href: "/admin/templates/[id]/publish",
        icon: "publish",
        needs: "admin",
        note: "Publish a revision of a template without forking it. **Proposed** — no route answers this yet, so it is drawn as an action with a marker and never as a link.",
        proposed: true,
      },
    ],
    actions: [],
  },
  {
    id: "group-billing",
    audience: "admin",
    icon: "billing",
    needs: "admin",
    items: [
      {
        id: "billing",
        href: "/admin/billing",
        icon: "billing",
        needs: "admin",
        note: "Each relationship's plan, the owner's comp, and the limit a plan sets. One page, so this group is one row.",
      },
    ],
    actions: [],
  },
  {
    id: "group-system",
    audience: "admin",
    icon: "system",
    needs: "admin",
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
      {
        id: "instances",
        href: "/admin/instances",
        icon: "instances",
        needs: "admin",
        note: "Every assessment in flight, filterable by stage. Labelled Relationships today, which is the collision this proposal removes.",
      },
    ],
    actions: [],
  },
  {
    id: "group-support",
    audience: "shared",
    icon: "support",
    needs: "member",
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
  },
];

/** One screen in the map: what it is, where it hangs, and how a reader moves through it. */
export interface AppIaScreen {
  /** The copy id for the screen's name in the fixture. */
  readonly id: string;
  /** The route pattern, as `content/routes.ts` spells it. */
  readonly href: string;
  /** The group id it hangs under (`group-templates` …). */
  readonly group: string;
  /** The row id it belongs to. */
  readonly row: string;
  readonly pattern: AppIaPattern;
  /** **No route exists yet** — the screen a proposed authoring action would open. */
  readonly proposed?: true;
}

/**
 * The screen map — screen → group → row → navigation pattern.
 *
 * A row is a destination; a screen is what you look at once you are there. The distinction is the
 * whole of the second half of the diagnosis: `/admin/console/users/[id]` had no back link, so the
 * only way out was the browser's own button, and `/admin/instances/[id]` was a cul-de-sac the same
 * way. Every `list-detail` screen below is promised a breadcrumb (`Users › People › Ada`) and a
 * back link at the top-left; every `tab-rail` screen the same tab strip its sibling draws.
 *
 * **The two proposed screens are the authoring flows' landing places**, not pages anyone can
 * visit: `/admin/templates/[id]/clone` and `/admin/templates/[id]/publish` are named so the map
 * says *what shape* each action opens, and marked `proposed` so nothing draws them as a link.
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
    id: "screen-users",
    href: "/admin/console/users",
    group: "group-users",
    row: "users",
    pattern: "list-detail",
  },
  {
    id: "screen-console-relationships",
    href: "/admin/console/relationships",
    group: "group-users",
    row: "operations-relationships",
    pattern: "list-detail",
  },
  {
    id: "screen-console-relationship-detail",
    href: "/admin/console/relationships/[id]",
    group: "group-users",
    row: "operations-relationships",
    pattern: "tab-rail",
  },
  {
    id: "screen-admin-invitations",
    href: "/admin/inbox",
    group: "group-users",
    row: "admin-invitations",
    pattern: "list-detail",
  },
  {
    id: "screen-admin-templates",
    href: "/admin/templates",
    group: "group-templates",
    row: "admin-templates",
    pattern: "list-detail",
  },
  {
    id: "screen-admin-template-detail",
    href: "/admin/templates/[id]",
    group: "group-templates",
    row: "admin-template-editor",
    pattern: "tab-rail",
  },
  {
    id: "screen-console-templates",
    href: "/admin/console/templates",
    group: "group-templates",
    row: "operations-templates",
    pattern: "list-detail",
  },
  {
    id: "screen-console-template-detail",
    href: "/admin/console/templates/[id]",
    group: "group-templates",
    row: "operations-templates",
    pattern: "tab-rail",
  },
  {
    id: "screen-review",
    href: "/admin/review",
    group: "group-templates",
    row: "review",
    pattern: "list-detail",
  },
  {
    id: "screen-template-new",
    href: "/assessment/templates/new",
    group: "group-templates",
    row: "template-new",
    pattern: "single",
  },
  {
    id: "screen-template-clone",
    href: "/admin/templates/[id]/clone",
    group: "group-templates",
    row: "template-clone",
    pattern: "single",
    proposed: true,
  },
  {
    id: "screen-template-publish",
    href: "/admin/templates/[id]/publish",
    group: "group-templates",
    row: "template-publish",
    pattern: "single",
    proposed: true,
  },
  {
    id: "screen-billing",
    href: "/admin/billing",
    group: "group-billing",
    row: "billing",
    pattern: "single",
  },
  {
    id: "screen-health",
    href: "/admin/health",
    group: "group-system",
    row: "health",
    pattern: "single",
  },
  {
    id: "screen-broadcast",
    href: "/admin/broadcast",
    group: "group-system",
    row: "broadcast",
    pattern: "single",
  },
  {
    id: "screen-audit",
    href: "/admin/audit",
    group: "group-system",
    row: "audit",
    pattern: "single",
  },
  {
    id: "screen-instances",
    href: "/admin/instances",
    group: "group-system",
    row: "instances",
    pattern: "list-detail",
  },
  {
    id: "screen-instance-detail",
    href: "/admin/instances/[id]",
    group: "group-system",
    row: "instances",
    pattern: "list-detail",
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
    id: "admin-instances",
    group: "group-system",
    row: "instances",
    change:
      "Relabelled: today's row reads “Relationships”, which now names the member's page. The page and the href are untouched.",
  },
  {
    id: "console-gaps",
    group: "group-workspace",
    row: "gap-analysis",
    change:
      "Moves to Workspace and is proposed for a `member`. The only permission shift in this proposal — the page keeps `requireAdmin()` until the decision is taken.",
  },
  {
    id: "admin-inbox",
    group: "group-users",
    row: "admin-invitations",
    change:
      "Appears twice on purpose: “Invitations” in Do for the member's work, and “Invitations” in Users for the support queue. One page, two audiences.",
  },
  {
    id: "admin-health",
    group: "group-system",
    row: "health",
    change: "Moves into System, beside the two rows it is a fact about.",
  },
  {
    id: "admin-billing",
    group: "group-billing",
    row: "billing",
    change:
      "Becomes the whole Billing group — one page, so one row, which is what a group of one means.",
  },
  {
    id: "admin-broadcast",
    group: "group-system",
    row: "broadcast",
    change: "Moves into System, between Health and Audit.",
  },
  {
    id: "review",
    group: "group-templates",
    row: "review",
    change:
      "Moves into Templates: the shelf reviews authored content, so it sits with the authoring rather than in a group of its own.",
  },
  {
    id: "admin-audit",
    group: "group-system",
    row: "audit",
    change: "Moves into System, and stays last: it is the record of the rows above it.",
  },
];

/** A row of today's rail the proposal drops, with the reason. */
export interface AppIaRemoved {
  readonly id: string;
  readonly href: string;
  readonly reason: string;
}

/**
 * **The hub is the one destination v2 retires**, and it is retired on purpose.
 *
 * The owner's words are "console functionality is part of core Admin UI", so `/admin/console`
 * cannot stay a row: its pages are the four admin groups' submenu rows now, and a hub between the
 * rail and the page is the extra click the console's navigation was missing in the first place.
 * The URL keeps answering — nothing is deleted — but the rail does not point at it.
 */
export const APP_IA_REMOVED: readonly AppIaRemoved[] = [
  {
    id: "console",
    href: "/admin/console",
    reason:
      "The hub stops being a destination: its pages are the Users, Templates, Billing and System submenus, so an operator is one click from the page they wanted instead of two.",
  },
];

/** Every proposed row, in rail order — the whole descriptor, actions excluded. */
export function appIaRows(): AppIaRow[] {
  return APP_IA_GROUPS.flatMap((group) => [...group.items]);
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

/** The groups one audience is drawn for — `member` excludes the four operator groups. */
export function appIaGroupsFor(audience: AppIaAudience): AppIaGroup[] {
  return APP_IA_GROUPS.filter((group) => group.audience === audience);
}

/**
 * Can this `href` be handed to `<Link>`?
 *
 * The proposal names the **route pattern** a screen lives at, so some rows read
 * `/dashboard/relationships/[id]` — a shape, not a destination. A pattern in a `Link` is the
 * dynamic-href error Next raises (`app-directory/dynamic-href`), and on `/admin/review/ia` it
 * crashed the client render rather than merely mis-linking. This predicate is the one place that
 * decides, so the renderer cannot disagree with the test.
 */
export function isLinkableHref(href: string): boolean {
  return !href.includes("[");
}

/** The group headings in order — the assertion the group order is a fact, not a comment. */
export function appIaGroupIds(): string[] {
  return APP_IA_GROUPS.map((group) => group.id);
}
