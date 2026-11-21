/**
 * nav-reconcile — the **derived half** of the rail (#862): what the tree contains, and what the
 * document says about it.
 *
 * `data/nav-menu.json` (schema `content/nav.ts`) is the *authored* half: an operator decides the
 * groups, the order and the rung a row is drawn for. It cannot decide whether a route exists —
 * and for years it did not have to, because the routes were listed by hand in a component.
 * That is the defect this module closes: **a destination can be in the tree and in nobody's
 * rail**, and nothing fails. #542 phase 2 found `/admin/console` in exactly that state; `/admin/growth`
 * is off the rail on the owner's ruling (#1095) and says so nowhere a check can read.
 *
 * The model is subtraction:
 *
 * ```text
 * inventory (derived from app/**)  ──┐
 *                                    ├──> reconcile ──> rail (+ Unplaced: always drawn for `owner`)
 * order document (authored)        ──┘
 * ```
 *
 * The document may order, group, role-gate and hide a surface. It may never **lose** one: every
 * route the inventory finds under the shell is either
 *
 *   - **placed** — a row in a group, drawn or `hidden` (a row that had a place and gave it up, and
 *     says why — `/admin/growth`'s shape), or
 *   - **unlisted** — named by address in the document's `unlisted` list with a reason, because it
 *     is a surface the rail was never meant to draw (the console's three detail lists, `/settings`,
 *     a failed-create page), or
 *   - **unaccounted** — in neither. That is a finding, it is drawn in the `Unplaced` group, and
 *     `data:check` **E43** fails the build on it. A dead end is impossible by construction instead
 *     of by review.
 *
 * **Why two ways to say "not drawn".** `hidden` is a *rail row*: it keeps its word, its glyph and
 * its place, and comes back by deleting one key. `unlisted` is a *surface the rail does not owe*:
 * it has no glyph and no fixture copy, because inventing a word for a door nobody draws is how a
 * menu fills with rows that read as destinations. The difference is who is lying if the entry is
 * removed: a `hidden` row says "this belongs here"; an `unlisted` entry says "this exists and does
 * not belong here". Both carry a reason and both are checked.
 *
 * **Pure, and client-safe.** No `fs`, no zod, no React, no clock — the tree arrives as data
 * (`scripts/nav-inventory.ts` walks it, `data/nav-inventory.json` is the committed result), so the
 * shell can reconcile without an I/O at request time and this file's cases can drive every shape
 * without touching disk. `content/nav.ts` carries the document's schema and is where an editor
 * looks for the contract; this module reads the *types* it infers.
 */

/**
 * What a route's **brand** boundary is, read off its own source: which product's build answers at
 * this address.
 *
 * `any` is a route no brand gate covers; `quiz` is one gated by `requireQuizProduct()` (404 on the
 * alignment build); `alignment` is one gated by `requireAlignmentProduct()` (404 on a quiz-only
 * build). The distinction is what makes the rail's jurisdiction derivable: a quiz-only surface is
 * not a door the alignment rail lost, it is a door this product does not sell.
 */
export const NAV_BOUNDARIES = ["any", "quiz", "alignment"] as const;

export type NavBoundary = (typeof NAV_BOUNDARIES)[number];

/**
 * The lowest rung a page admits, read off the page's own gate call, or `null` when its source
 * carries none.
 *
 * `"spec-reader"` is not a rung: `/admin/spec` admits `stakeholder`+ by the ladder and refuses
 * `support` by membership (`lib/auth/require-role.ts::requireSpecReader`), which is a question a
 * rung cannot answer — so it is its own value rather than a floor that would read as a lie.
 *
 * **`null` means "no gate in this file", never "public".** A console detail page is gated by its
 * parent layout, and a layout is not part of a page's source; the field states what this file
 * says, which is the fact the inventory is built from.
 */
export type NavRoleFloor = "member" | "stakeholder" | "support" | "admin" | "owner" | "spec-reader";

/** One route the tree contains, with the two facts a rail row needs to be honest about it. */
export interface NavSurface {
  /** The route, exactly as `content/routes.ts` would spell it. */
  readonly href: string;
  /** The `page.tsx` that renders it, repo-relative — the file a finding points at. */
  readonly file: string;
  /** The route group it lives under (`(mainlayout)`, `(marketing)`, `(auth)`), or `null`. */
  readonly group: string | null;
  readonly boundary: NavBoundary;
  /** `requireAdminProduct()` — the `product.admin` capability, on for both templates today. */
  readonly console: boolean;
  readonly roleFloor: NavRoleFloor | null;
}

/** The walk's result: what was seen, and what came out of it. */
export interface NavInventory {
  /** `page.tsx` files the walk looked at, before the route rules dropped any. */
  readonly walked: number;
  readonly surfaces: readonly NavSurface[];
}

/** The route group whose pages the alignment rail is the navigation for. */
export const SHELL_GROUP = "(mainlayout)";

/**
 * Is this surface the document's business?
 *
 * Two rules, both facts already in the tree: it must live under the shell (`(mainlayout)`, the
 * group that mounts the rail — `(marketing)` and `(auth)` carry their own chrome), and it must not
 * be quiz-only. A quiz surface answers 404 on the alignment build, so a rail row for it would
 * advertise a door this product does not sell — the one thing the brand boundary exists to stop.
 */
export function inJurisdiction(surface: NavSurface): boolean {
  return surface.group === SHELL_GROUP && surface.boundary !== "quiz";
}

/** A document row, as this module reads it — the fields the reconciler needs and no more. */
export interface NavDocumentRow {
  readonly href: string;
  readonly hidden?: boolean;
  readonly reason?: string;
}

/** An `unlisted` entry: a surface the rail does not owe, named by address with a reason. */
export interface NavUnlistedEntry {
  readonly href: string;
  readonly reason: string;
}

/** The authored half, narrowed to what a decision needs. */
export interface NavDocumentView {
  readonly rows: readonly NavDocumentRow[];
  readonly unlisted?: readonly NavUnlistedEntry[];
}

/** Why a surface is drawn in `Unplaced`. */
export type UnplacedKind = "hidden" | "unlisted" | "unaccounted";

/** One row of the `Unplaced` group. No glyph and no fixture word: the address is the label. */
export interface UnplacedSurface {
  readonly href: string;
  readonly kind: UnplacedKind;
  readonly reason: string;
  /** The page that renders it, when the inventory knew — absent for a document-only statement. */
  readonly file?: string;
}

/**
 * What the reconciler was asked to trust.
 *
 *   `document`  the file is the rail — no inventory, no `Unplaced`.
 *   `derived`   the tree is the rail — the document is not consulted at all, which is the truth
 *               test: "what doors does this build actually have?"
 *   `both`      the default — the document draws, the tree fills `Unplaced`.
 */
export const NAV_SOURCES = ["document", "derived", "both"] as const;

export type NavSource = (typeof NAV_SOURCES)[number];

/** `both` — reconciliation is the rail, and the other two are the truth tests. */
export const DEFAULT_NAV_SOURCE: NavSource = "both";

/** The version of `data/nav-inventory.json` this build writes and reads (#862). */
export const NAV_INVENTORY_VERSION = 1;

/** The committed inventory document — the file, as a value. */
export interface NavInventoryDocument {
  readonly version: number;
  readonly note: string;
  readonly walked: number;
  readonly surfaces: readonly NavSurface[];
}

/**
 * The note written beside the version, for the same reason the rail document carries one: git is
 * the history, and this is the sentence a reader of the file gets without opening a log.
 */
const INVENTORY_NOTE =
  "Generated by `pnpm nav:menu --inventory` (#862). Do not edit: every field is a fact read off a page.tsx, and `data:check` E43 compares this file with a fresh walk of app/** on every gate run.";

/** The inventory as the committed file — one shape, written by the CLI and compared by E43. */
export function inventoryDocument(inventory: NavInventory): NavInventoryDocument {
  return {
    version: NAV_INVENTORY_VERSION,
    note: INVENTORY_NOTE,
    walked: inventory.walked,
    surfaces: inventory.surfaces,
  };
}

/** Resolve a raw value onto the three sources, falling back to the default rather than throwing. */
export function navSourceFrom(raw: string | undefined): NavSource {
  return (NAV_SOURCES as readonly string[]).includes(raw ?? "")
    ? (raw as NavSource)
    : DEFAULT_NAV_SOURCE;
}

/** Every surface a `derived` rail draws — the tree, in address order, with nothing left out. */
function derivedUnplaced(inventory: NavInventory): UnplacedSurface[] {
  return inventory.surfaces.filter(inJurisdiction).map((surface) => ({
    href: surface.href,
    kind: "unaccounted" as const,
    reason: derivedReason(surface),
    file: surface.file,
  }));
}

/** Why a `derived` row exists: the tree put it there and the document was not asked. */
function derivedReason(surface: NavSurface): string {
  const floor = surface.roleFloor === null ? "no gate in the page" : `${surface.roleFloor}`;
  return `in the tree (${floor}); the document is not consulted under NAV_SOURCE=derived`;
}

/**
 * The `Unplaced` group: every door the rail does not draw, and why.
 *
 * Order is deliberate and it is not the tree's: rows the document *states* come first — a `hidden`
 * row (it had a place and gave it up), then an `unlisted` surface (named on purpose) — and
 * `unaccounted` last, because that is the finding, and a reader scrolls to the bottom for it. Each
 * list is then in document order, so an operator's edit moves one line.
 */
export function unplacedOf(
  document: NavDocumentView,
  inventory: NavInventory,
  source: NavSource = DEFAULT_NAV_SOURCE,
): UnplacedSurface[] {
  if (source === "document") return [];
  if (source === "derived") return derivedUnplaced(inventory);

  const stated = new Set(document.rows.map((row) => row.href));
  const listed = new Set((document.unlisted ?? []).map((entry) => entry.href));

  const hidden = document.rows
    .filter((row) => row.hidden === true)
    .map((row) => ({
      href: row.href,
      kind: "hidden" as const,
      reason: (row.reason ?? "").trim() === "" ? "hidden with no reason" : (row.reason as string),
    }));

  const unlisted = (document.unlisted ?? []).map((entry) => ({
    href: entry.href,
    kind: "unlisted" as const,
    reason: entry.reason,
  }));

  const unaccounted = inventory.surfaces
    .filter(inJurisdiction)
    .filter((surface) => !stated.has(surface.href) && !listed.has(surface.href))
    .map((surface) => ({
      href: surface.href,
      kind: "unaccounted" as const,
      reason: `in the tree (${surface.file}) and in no group and no unlisted entry`,
      file: surface.file,
    }));

  return [...hidden, ...unlisted, ...unaccounted];
}

/**
 * The census, as numbers — what the gate prints every run and what the CLI reports.
 *
 * `unjustified` is the part a build fails on: a surface that is neither placed nor unlisted, an
 * `unlisted` entry with no reason, or an entry naming a page the tree does not have (a stale
 * statement is as wrong as a missing one — it hides a door behind a reason nobody can read).
 */
export interface NavCoverage {
  readonly walked: number;
  readonly surfaces: number;
  readonly shell: number;
  readonly quizOnly: number;
  readonly outsideShell: number;
  readonly inJurisdiction: number;
  readonly placed: number;
  readonly hidden: number;
  readonly unlisted: number;
  readonly unaccounted: readonly UnplacedSurface[];
  readonly unjustified: readonly string[];
}

/** Everything the gate needs to know about one inventory ⊕ document pair. */
export function coverageOf(inventory: NavInventory, document: NavDocumentView): NavCoverage {
  const stated = new Set(document.rows.map((row) => row.href));
  const surfaces = new Set(inventory.surfaces.map((surface) => surface.href));

  const shell = inventory.surfaces.filter((surface) => surface.group === SHELL_GROUP);
  const quizOnly = shell.filter((surface) => surface.boundary === "quiz").length;
  const jurisdiction = inventory.surfaces.filter(inJurisdiction);
  const unaccounted = unplacedOf(document, inventory, "both").filter(
    (surface) => surface.kind === "unaccounted",
  );

  const unjustified: string[] = [];
  for (const surface of unaccounted) {
    unjustified.push(
      `${surface.href} (${surface.file ?? "unknown file"}) is in the tree and neither placed in a group nor unlisted`,
    );
  }
  for (const entry of document.unlisted ?? []) {
    if (entry.reason.trim() === "") {
      unjustified.push(`unlisted "${entry.href}" carries no reason — name what it is instead`);
    }
    if (!surfaces.has(entry.href)) {
      unjustified.push(
        `unlisted "${entry.href}" renders no page.tsx in the tree — a stale statement`,
      );
    }
  }

  return {
    walked: inventory.walked,
    surfaces: inventory.surfaces.length,
    shell: shell.length,
    quizOnly,
    outsideShell: inventory.surfaces.length - shell.length,
    inJurisdiction: jurisdiction.length,
    placed: jurisdiction.filter((surface) => stated.has(surface.href)).length,
    hidden: document.rows.filter((row) => row.hidden === true).length,
    unlisted: (document.unlisted ?? []).length,
    unaccounted,
    unjustified,
  };
}

/** The one line the gate prints whether or not anything failed — the census, like E34's. */
export function coverageLine(coverage: NavCoverage): string {
  return `${coverage.walked} page.tsx walked, ${coverage.surfaces} static routes, ${coverage.inJurisdiction} in the rail's jurisdiction (${coverage.placed} placed, ${coverage.unlisted} unlisted, ${coverage.unaccounted.length} unaccounted), ${coverage.quizOnly} quiz-only, ${coverage.outsideShell} outside the shell`;
}
