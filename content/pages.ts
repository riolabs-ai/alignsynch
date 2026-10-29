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
 */
export const zPageCopySection = z
  .object({
    id: zId,
    heading: z.string().min(1),
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
 * The routes that have copy, keyed by the route pattern (`/`, `/pricing`,
 * `/news/[slug]`). A record, not an array — the key *is* the join.
 */
export const zPageCopyTable = z.record(z.string().min(1), zPageCopy);

export type PageCopyTable = z.infer<typeof zPageCopyTable>;

/**
 * Where a route's copy lives and how many literals may remain inside it.
 *
 * `page` is the route module the attribution walks from (the file Next renders),
 * `dirs` are the directories whose *reachable* files are attributed to the route,
 * and `fixture` must be reachable from `page` — the proof the copy is wired in, not
 * written and forgotten. `budget` is the number of leaf literals E23 tolerates; it
 * is measured, recorded, and only ever lowered by a later work unit.
 */
export const zPageCopyBudgetEntry = z
  .object({
    page: z.string().min(1),
    dirs: z.array(z.string().min(1)).min(1),
    fixture: z.string().min(1),
    budget: z.number().int().min(0),
  })
  .strict();

export const zPageCopyBudget = z.record(z.string().min(1), zPageCopyBudgetEntry);

export type PageCopyBudgetEntry = z.infer<typeof zPageCopyBudgetEntry>;
export type PageCopyBudget = z.infer<typeof zPageCopyBudget>;
