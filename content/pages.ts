/**
 * PageCopy — the one object P2 introduces on the copy side.
 *
 * A route's editorial copy is *storage*, not a projection: the words are authored
 * per route and carry no record data. `data/pages/<route>.ts` holds one parsed
 * instance per route, keyed in `data/pages/index.ts` by the route pattern
 * `content/routes.ts` already owns, and the page module passes each section down
 * as a prop — so no component holds the string (E23).
 *
 * The shape, and why each field exists:
 *
 *   eyebrow?      a kicker above the heading (unused on `/`, kept because the other
 *                 editorial pages in the vertical have one)
 *   heading       the page's hero line. A hard line break is spelled `\n` inside the
 *                 string and rendered as `<br />` by the view, so the break is copy,
 *                 not markup
 *   subtitle?     the sentence under the heading
 *   cta?          the primary action, as `{ label, href }` — a link, because a
 *                 button with no destination is a bug, not copy
 *   secondaryCta? the second action beside it (hero: "Join Contest")
 *   sections?     the page's bands, each `{ id, heading, body?, cta?, secondaryCta?, items? }`
 *
 * `items` is the field that keeps the shape from turning into a junk drawer: a
 * section's *repeated* strings (tab labels, stat captions, an inline "N players
 * joined", an empty state) are an ordered list of `{ id, label, value?, body? }`.
 * The fixture owns the wording, the view owns which ids it renders and in what order,
 * and both sides meet on the id — `data:check` E23 fails when a component asks for
 * an id the fixture does not carry. An unfilled `{count}` placeholder in a `label`
 * is left visible on purpose: it shows in the page instead of vanishing.
 *
 * `items` also exists at the *page* level, for the strings a route renders that no
 * band owns: a search field's placeholder, the "Most Popular"/"Newest" options of a
 * sort menu, the "Play Now" on every card in a wall of cards. Before that slot
 * existed the choice was a second field on `sections` that rendered nowhere or the
 * literal staying in the component, and both are worse than a bag keyed by id.
 *
 * Never a `labelOverride` on a record (a `Quiz` does not carry its own page copy),
 * and never JSX in a fixture: this module has no React import, which is what lets
 * `data:check` compile it with `tsconfig.datacheck.json` and run it under plain node.
 *
 * Reading a fixture is `lib/page-copy.ts`, deliberately a different module: the
 * readers run in client components, zod does not.
 */
import { z } from "zod";
import { zId } from "./core";

/**
 * A link the copy emits: a root-relative path plus the words on it. The path is
 * checked against the route manifest by E23 — moving a link out of JSX would
 * otherwise hide it from E10, which only reads literal `href` attributes.
 */
export const zPageCopyLink = z
  .object({
    label: z.string().min(1),
    href: z
      .string()
      .regex(/^\/(?!\/)/, "href must be root-relative: /explore, never //host or a bare word"),
  })
  .strict();

export type PageCopyLink = z.infer<typeof zPageCopyLink>;

/**
 * One repeated string inside a section (or a page). `value` is for the pairs that
 * render as value-over-caption (a stat): `{ id: "stat-subscribers",
 * label: "Subscribers", value: "10k+" }`. A single label is a pair whose `value` is
 * omitted.
 *
 * `body` is for the repeated things that carry a *paragraph* as well as a title — a
 * card in a three-up grid ("Compete & Win" over "Join tournaments, climb the
 * leaderboards, …"). It is a separate field rather than a second `label` because the
 * two render in different type and a reader asking for the description must not get
 * the heading back; `itemBody()` is the reader.
 *
 * `label` may carry `{placeholders}` for numbers the view supplies
 * (`"Only {count} spots left"`); `fillLabel` in `lib/page-copy.ts` is the one way
 * to replace them.
 */
export const zPageCopyItem = z
  .object({
    id: zId,
    label: z.string().min(1),
    value: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
  })
  .strict();

export type PageCopyItem = z.infer<typeof zPageCopyItem>;

/**
 * A band of the page. `id` is the handle `sectionOf()` resolves — kebab-case and
 * stable across a rename of the heading, because the view joins on it.
 *
 * `heading` is optional because not every band is headed: a nav column, an avatar
 * menu and a search palette are lists of `items` with no title above them. Requiring
 * a heading there forces the fixture to invent one the view must not render, which
 * is the junk-drawer failure `items` exists to prevent (WU-7).
 */
export const zPageCopySection = z
  .object({
    id: zId,
    heading: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    cta: zPageCopyLink.optional(),
    secondaryCta: zPageCopyLink.optional(),
    items: z.array(zPageCopyItem).optional(),
  })
  .strict();

export type PageCopySection = z.infer<typeof zPageCopySection>;

/** One route's copy. `strict()`: an unknown key is a fixture drift, not a carried field. */
export const zPageCopy = z
  .object({
    eyebrow: z.string().min(1).optional(),
    heading: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    cta: zPageCopyLink.optional(),
    secondaryCta: zPageCopyLink.optional(),
    /** Strings the route renders that no band owns — see the module comment. */
    items: z.array(zPageCopyItem).optional(),
    sections: z.array(zPageCopySection).optional(),
  })
  .strict();

export type PageCopy = z.infer<typeof zPageCopy>;

/**
 * The routes that have copy, keyed by the surface id (`/`, `/pricing`,
 * `/news/[slug]`). A record, not an array — the key *is* the join.
 *
 * A surface id is a route pattern, or one of `NON_ROUTE_COPY_SURFACES` below: the
 * shell (header, sidebar, footer) and Next's `not-found.tsx` are copy with no route
 * of their own, and they are rendered on every page, so they cannot be attributed to
 * one. E23 holds both halves: a route-pattern key must resolve in
 * `content/routes.ts`, and every named surface must carry copy and a budget, so
 * neither can be quietly dropped from the gate.
 */
export const zPageCopyTable = z.record(z.string().min(1), zPageCopy);

export type PageCopyTable = z.infer<typeof zPageCopyTable>;

/**
 * Copy surfaces that are not routes. `shell` is the `(mainlayout)` chrome, mounted by
 * `app/(mainlayout)/layout.tsx` (header, sidebar) and by the pages that render the
 * footer; `not-found` is `app/not-found.tsx`, which Next renders for any path that
 * matches nothing. Named on purpose: an unnamed key is a typo, and a surface that is
 * neither a route nor one of these would silently skip the ratchet.
 */
export const NON_ROUTE_COPY_SURFACES = ["shell", "not-found"] as const;

export type NonRouteCopySurface = (typeof NON_ROUTE_COPY_SURFACES)[number];

/** Is this key a declared non-route surface rather than a route pattern? */
export function isNonRouteCopySurface(key: string): key is NonRouteCopySurface {
  return (NON_ROUTE_COPY_SURFACES as readonly string[]).includes(key);
}

/**
 * Where a surface's copy lives and how many literals may remain inside it.
 *
 * `page` is the module the attribution walks from — the file Next renders: a
 * `page.tsx` for a route, a `layout.tsx` for the shell, or a special file such as
 * `app/not-found.tsx`. `mounts` are further modules that mount the same copy, for a
 * surface that is not rendered by one module: the footer is mounted by the pages
 * that render it, not by the layout the header and sidebar hang off, and its strings
 * belong to the same fixture. `dirs` are the directories whose *reachable* files are
 * attributed to the surface — empty only for a surface that renders no component of its
 * own, and `copy-refs.ts` fails an empty `dirs` whose module imports one. `fixture` must
 * be reachable from `page` or a mount: the proof the
 * copy is wired in, not written and forgotten. `budget` is the number of leaf
 * literals E23 tolerates; it is measured, recorded, and only ever lowered.
 */
export const zPageCopyBudgetEntry = z
  .object({
    page: z.string().min(1),
    mounts: z.array(z.string().min(1)).optional(),
    dirs: z.array(z.string().min(1)),
    fixture: z.string().min(1),
    budget: z.number().int().min(0),
  })
  .strict();

export const zPageCopyBudget = z.record(z.string().min(1), zPageCopyBudgetEntry);

export type PageCopyBudgetEntry = z.infer<typeof zPageCopyBudgetEntry>;
export type PageCopyBudget = z.infer<typeof zPageCopyBudget>;
