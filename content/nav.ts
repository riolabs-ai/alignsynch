/**
 * The rail, as a versioned **document** (#861) — the schema `data/nav-menu.json` must satisfy.
 *
 * `lib/nav-menu.ts` owns the rail's *shape* (`NavGroup`, `NavItem`, `menuFor`), and since #861 it
 * reads the rows from a JSON document instead of spelling them in the module. This file is that
 * document's contract: one zod schema, `.strict()` at every level, so an unknown key is as loud as
 * a missing one. The order of the groups and their rows **is** the rail's order, and the order of
 * this file's fields is the order an editor reads them in.
 *
 * **Why the schema is separate from the reader.** `lib/nav-menu.ts` is imported by client
 * components (`components/layout/nav-menus.tsx`), and this repo does not put a module carrying zod
 * into the browser bundle — the same rule that gave `content/role-ladder.ts` its own file
 * (`lib/nav-menu.ts` imports that module's *types* only). The reader imports this module's types,
 * which are erased; the validator (`scripts/nav-menu.ts`) is the only runtime caller and it runs
 * in node, where zod costs what it costs.
 *
 * **`NAV_ICON_NAMES` is the one list of glyphs.** `components/layout/nav-menus.tsx` builds a
 * `Record<NavIconName, ComponentType>` from it, so an icon added here without a picture there is a
 * type error, and a picture with no name here is unreachable — the two halves cannot drift.
 *
 * **What the schema cannot say, the validator does.** A schema knows a `needs` is a rung; it does
 * not know the `href` resolves, that the label id exists in `data/pages/shell.ts`, or that a
 * document version is one this build understands. `scripts/nav-menu.ts --check` is the second
 * half, it runs in every gate lane, and a document that fails either half never reaches a build.
 */
import { z } from "zod";
import { USER_ROLES } from "./role-ladder";

/**
 * The document version this build reads.
 *
 * A document that names a newer version is refused by the validator rather than half-read: the
 * version is how a rail edit made against a later schema fails loudly on this tree instead of
 * silently losing the rows this build cannot express.
 *
 * **2 (#929)** — the owner's standard rail: `group-admin` first, and the review shelf + health
 * page inside `group-support`. The schema did not change; the arrangement did, and the version is
 * how a later edit is a bump plus a diff rather than a silent reinterpretation of the same number.
 *
 * **3 (2026-11-19)** — the project spec moved *above* the Admin heading, which the schema could
 * not express: an item above a group's title cannot stay in that group, and a heading of its own
 * would repeat the row's word. So a group may now omit `label` (see `zNavGroup`), and the document
 * opens with the title-less `group-project-spec`. A v3 document is not readable by a v2 build for
 * exactly that reason: v2 would have rendered it with no heading anyway, but the *intent* — a group
 * that is allowed to have none — is new, and the version says so.
 *
 * **4 (2026-11-21, #862)** — the document gained a **second way to account for a surface**, because
 * it is now checked against the tree rather than only against itself. `groups[].items[]` places a
 * destination in the rail (optionally `hidden`, with a reason), and the new `unlisted` list names a
 * surface the rail **does not owe** — the console's detail lists, `/settings`, a failed-create page
 * — by address and reason alone: no glyph, no fixture word, no `needs`, because inventing a menu
 * word for a door nobody draws is how a rail fills with rows that read as destinations. Every route
 * the inventory finds under the shell must be one or the other, and `data:check` **E43** fails the
 * build on the remainder. A v3 document has no `unlisted` list and a v4 build reads that as "none",
 * so the bump is a statement of intent as much as a schema change — the same reason v3 was one.
 */
export const NAV_DOCUMENT_VERSION = 4;

/**
 * Every glyph a rail row may draw. A name, not a component: the descriptor holds no JSX, and the
 * renderer resolves the name to a lucide icon (`NAV_ICONS` in `components/layout/nav-menus.tsx`).
 */
export const NAV_ICON_NAMES = [
  "dashboard",
  "relationships",
  // #877 — the member's assessment-session listing, beside the relationships they belong to.
  "assessments",
  // #1131 — one thread per relationship. Its own glyph rather than the inbox's: the rail's Chat row
  // is a conversation list about these relationships, not a mailbox of notifications.
  "chat",
  "templates",
  "library",
  "help",
  "support",
  "console",
  "instances",
  "gaps",
  "inbox",
  "health",
  "billing",
  "broadcast",
  "review",
  "audit",
  // #1252 — the project spec. Its own glyph: `ClipboardCheck` is the review shelf's and
  // `ScrollText` is the audit log's, and the spec is neither a to-do list nor a log.
  "spec",
] as const;

export type NavIcon = (typeof NAV_ICON_NAMES)[number];

export const zNavIcon = z.enum(NAV_ICON_NAMES);

/**
 * One destination in the rail.
 *
 * `id` is the row's handle **and** its label id in `data/pages/shell.ts`'s `nav-alignsynch`
 * section — the words are the fixture's, never the document's, which is why an unknown id is a
 * gate failure and not a blank heading. `label` exists for the one case the identity cannot
 * express: a second destination that has to reuse an existing word, so one string keeps one home.
 */
export const zNavRow = z
  .object({
    /** The row's handle, and the label id in `data/pages/shell.ts` unless `label` says otherwise. */
    id: z.string().min(1),
    /** The destination. Resolved against `content/routes.ts` by the validator. */
    href: z.string().startsWith("/"),
    icon: zNavIcon,
    /** The lowest rung shown this row — the ladder in `content/role-ladder.ts`, never a new word. */
    needs: z.enum(USER_ROLES),
    /**
     * A capability the row additionally requires (#1252) — `spec-read` is the one value today.
     *
     * A **string** here rather than an enum, and deliberately: the vocabulary is
     * `lib/nav.ts::NAV_CAPABILITIES`, which is chrome, and this module is the document's contract —
     * `content/` never imports `lib/`. `scripts/nav-menu.ts --check` resolves the value against that
     * list (a gate step in every lane), which is the same half-schema/half-validator split `href`
     * and `needs` already use.
     */
    capability: z.string().min(1).optional(),
    /**
     * Match this row's own address only. Overview is the case the field exists for: a prefix rule
     * lit it beside whichever `/dashboard/*` page the reader was on.
     */
    exact: z.literal(true).optional(),
    /** The first-run tour's anchor (`data-tour`), for the one row a tour step points at. */
    tourAnchor: z.string().min(1).optional(),
    /**
     * Kept in the document, drawn by nobody. **Not a role gate** — that is `needs`, and using
     * `hidden` for it would leave a row in the document that reads as a destination nobody can
     * use. A hidden row carries a `reason`; the validator refuses one that does not.
     */
    hidden: z.boolean().optional(),
    /** Why a hidden row is kept. Required whenever `hidden` is true. */
    reason: z.string().min(1).optional(),
    /** The label id to render instead of `id` — for two destinations that share one word. */
    label: z.string().min(1).optional(),
    /** An explicit sort key within the group. Absent means "here, in document order". */
    order: z.number().int().optional(),
    /** Provenance for a row whose position is a decision — carried, never drawn. */
    note: z.string().min(1).optional(),
  })
  .strict();

/**
 * A run of rows — one heading and its rows, or a **title-less** run above the first heading.
 *
 * `label` is a fixture id, like every other word in the rail; `id` is the document's handle for
 * the group and is what a diagnostic names when something inside it is wrong.
 *
 * **`label` is optional since the project-spec group.** A group with no label draws its rows with
 * no heading between it and the group above, which is the shape the rail needs *above* the first
 * heading: `group-project-spec` is the project-spec row sitting on its own above the Admin heading,
 * and a heading there would either repeat the row's own word ("Project Spec" over "Project Spec")
 * or invent one nobody asked for. The absence is the statement — a title-less group is written by
 * omitting the key, never by an empty string, and the validator still refuses a label id that is
 * not an item of the shell's `nav-alignsynch` section.
 */
export const zNavGroup = z
  .object({
    id: z.string().min(1),
    /**
     * The heading's label id in `data/pages/shell.ts`'s `nav-alignsynch` section. **Omitted** for
     * the group that draws no heading — see the docstring above.
     */
    label: z.string().min(1).optional(),
    items: z.array(zNavRow).min(1),
  })
  .strict();

/**
 * A surface the rail **does not owe** (#862) — named by address, with the reason it is not a row.
 *
 * This is the second half of the document's accounting, and it is deliberately not a `zNavRow`:
 * a row carries a glyph, a rung and a fixture word, all of which say "this is a destination".
 * `/admin/console/users` is not a destination — it is the list behind the console's hub — and a
 * menu word for it would be a word nobody should ever see in a rail. So the entry carries the two
 * facts that are true: where it is, and why it is not drawn.
 *
 * The reason is required, for the same reason a `hidden` row's is: a surface with no statement is
 * a finding, and an empty string would be a statement that says nothing. `data:check` E43 also
 * refuses an entry naming a route the tree does not render — a stale statement hides a door.
 */
export const zNavUnlisted = z
  .object({
    /** The route, resolved against `content/routes.ts` and against the inventory by the checks. */
    href: z.string().startsWith("/"),
    /** Why this surface is not a rail row. One sentence an operator can act on. */
    reason: z.string().min(1),
  })
  .strict();

/** The document: a version, then the groups in the order the rail draws them. */
export const zNavDocument = z
  .object({
    version: z.number().int().min(1),
    /**
     * Why this version exists, in one line — the document's own changelog entry (#862).
     *
     * Git is the history; this is the sentence a reader of the JSON gets without opening a log.
     * Optional, because a document is valid without one and a note that is required becomes a
     * note that is copied.
     */
    note: z.string().min(1).optional(),
    groups: z.array(zNavGroup).min(1),
    /**
     * Surfaces the rail does not owe (#862). Absent means none — every v3 document, which is why
     * the v4 build reads it as optional rather than requiring it.
     */
    unlisted: z.array(zNavUnlisted).optional(),
  })
  .strict();

export type NavDocument = z.infer<typeof zNavDocument>;
export type NavGroupRecord = z.infer<typeof zNavGroup>;
export type NavRowRecord = z.infer<typeof zNavRow>;
export type NavUnlistedRecord = z.infer<typeof zNavUnlisted>;
