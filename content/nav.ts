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
 */
export const NAV_DOCUMENT_VERSION = 2;

/**
 * Every glyph a rail row may draw. A name, not a component: the descriptor holds no JSX, and the
 * renderer resolves the name to a lucide icon (`NAV_ICONS` in `components/layout/nav-menus.tsx`).
 */
export const NAV_ICON_NAMES = [
  "dashboard",
  "relationships",
  // #877 — the member's assessment-session listing, beside the relationships they belong to.
  "assessments",
  "templates",
  "library",
  "help",
  "support",
  "console",
  "instances",
  "gaps",
  // #920 — the growth model: cohorts, plan mix and churn from one committed artifact.
  "growth",
  "inbox",
  "health",
  "billing",
  "broadcast",
  "review",
  "audit",
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
 * A labelled run of rows — one heading and its rows, one level, no submenus.
 *
 * `label` is a fixture id, like every other word in the rail; `id` is the document's handle for
 * the group and is what a diagnostic names when something inside it is wrong.
 */
export const zNavGroup = z
  .object({
    id: z.string().min(1),
    /** The heading's label id in `data/pages/shell.ts`'s `nav-alignsynch` section. */
    label: z.string().min(1),
    items: z.array(zNavRow).min(1),
  })
  .strict();

/** The document: a version, then the groups in the order the rail draws them. */
export const zNavDocument = z
  .object({
    version: z.number().int().min(1),
    groups: z.array(zNavGroup).min(1),
  })
  .strict();

export type NavDocument = z.infer<typeof zNavDocument>;
export type NavGroupRecord = z.infer<typeof zNavGroup>;
export type NavRowRecord = z.infer<typeof zNavRow>;
