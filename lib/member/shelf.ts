/**
 * `/dashboard/templates` — one shelf model for the two tabs (#620, #1130).
 *
 * **Two reads, one card.** The **Library** tab lists what a member may start a relationship from
 * (`listLibraryTemplates`), and **My Templates** lists the templates they **own**
 * (`listMemberLibrary`). A relationship does not put a template in that list — it uses one — so the
 * second read is authorship and not membership. A person sees one kind of card, so the projection
 * happens here — once — and the component prints what it is handed.
 *
 * **The category is the type's, not the record's** (`data/template-categories.ts`): a template row
 * carries no shelf, and the five Library categories are a filing of the relationship type the
 * template is derived from. A template no type names — the hand-authored starters, a member's own
 * copy — draws the plain `Template` chip instead of a shelf nobody chose.
 *
 * **The price belongs to the plan, not to the record and not to the type.** A template carries no
 * price of its own, and no type is sold on its own: `data/billing-plans.ts` sells Basic at a
 * monthly figure with unlimited relationships, and which plan an account holds is chosen when a
 * relationship is ready to complete, never on this shelf (#619, #796). So the Library card's one
 * number is **one month of Basic**, read from that fixture — the same chip
 * `/templates/relationship` prints, so the two shelves cannot disagree about the figure.
 * `data/relationship-types.ts::RELATIONSHIP_PRICE_CENTS` predates the pricing rewrite and is never
 * quoted: a per-relationship price is a promise the completion step would not honour.
 *
 * **Every word is the fixture's.** The chips, the buttons and the count sentences resolve through
 * `itemLabel` / `fillLabel` against `data/pages/dashboard-templates.ts`, which is what holds
 * `components/dashboard/template-shelf.tsx` at zero copy literals (E23).
 *
 * **The card type is not this file's.** Both builders below return `TemplateShelfCard`
 * (`lib/member/card.ts`), because the relationship shelf prints the same one (#795 F2): a template
 * card is one expression of the shared shape, not a second card model, and `relationship: null` is
 * the honest answer here — a template has no stage, no second party and nothing paid.
 *
 * No React and no database: a node test drives both builders without a browser, and the page stays
 * the only module that reads a session.
 */
import { formatCurrency } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { billingPlan, type BillingPlan } from "@/data/billing-plans";
import { relationshipType } from "@/data/relationship-types";
import {
  FEATURED_TEMPLATE_SLUG,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
  templateCategoryOf,
} from "@/data/template-categories";
import {
  createRelationshipPath,
  dashboardTemplateEditorPath,
  relationshipTemplatePath,
} from "@/lib/flow/paths";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import type { LibraryRow } from "@/lib/member/library";
import type { TemplateShelfCard } from "@/lib/member/card";
import { MEMBER_TEMPLATES_PATH } from "@/lib/member/templates";
import { fillLabel, itemLabel, itemLabelOr, sectionOf } from "@/lib/page-copy";

/**
 * The plan that includes every catalogue type, and so the one price a card prints.
 *
 * `basic` cannot be missing — `billingPlanProblems()` in `data/billing-plans.ts` fails on a fixture
 * that loses a tier — and a lookup that resolved to nothing here would be a card printing an
 * invented `$0.00`, so this throws rather than guessing. The figure itself has one home: the
 * fixture. This module names the plan; it never types a number.
 */
const CATALOGUE_PLAN: BillingPlan = (() => {
  const plan = billingPlan("basic");
  if (plan === undefined) {
    throw new Error('data/billing-plans.ts has no "basic" plan to price the catalogue from');
  }
  return plan;
})();

/**
 * `"Basic · $9.99/mo"` — the plan's name and its monthly figure, never a bare price.
 *
 * The name is in the sentence on purpose: the figure alone beside a shelf of templates reads as
 * one subscription per template, and the card is not selling the template.
 */
function planPriceLabel(card: PageCopySection): string {
  return fillLabel(itemLabel(card, "price"), {
    plan: CATALOGUE_PLAN.name,
    price: formatCurrency(CATALOGUE_PLAN.monthlyCents),
  });
}

/** The card actions' words, resolved once so both builders and the test agree. */
function actions(copy: PageCopy): { detail: string; create: string; open: string } {
  const card = sectionOf(copy, "card");
  return {
    detail: itemLabel(card, "details"),
    create: itemLabel(card, "create"),
    open: itemLabel(card, "open"),
  };
}

/** `"6 Aspects"` — counted from the row, never typed. */
function aspectsLabel(card: PageCopySection, count: number): string {
  return fillLabel(itemLabel(card, "aspects"), { count: String(count) });
}

/**
 * How long one person's answers take, from the number of Aspects: **about 35 seconds each**, rounded
 * to the nearest minute, and never less than one.
 *
 * A template carries no duration of its own, so this is a *reading* of the work rather than a stored
 * field — which is why it is a pure function here and not a column. The constant reproduces bundle
 * 06's own samples exactly (`templates.html` draws `4 Aspects` / `About 2 Minutes`,
 * `5 Aspects` / `About 3 Minutes`, `6 Aspects` / `About 4 Minutes`), so the port cannot drift from
 * the artifact it was taken from.
 */
export function minutesForAspects(aspects: number): number {
  if (!Number.isFinite(aspects) || aspects <= 0) return 1;
  return Math.max(1, Math.round((aspects * 35) / 60));
}

/** `"About 3 Minutes"` — bundle 06's third card chip, derived from the Aspect count. */
function minutesLabel(card: PageCopySection, count: number): string {
  return fillLabel(itemLabel(card, "minutes"), { count: String(minutesForAspects(count)) });
}

/**
 * The shelf a template is filed under, as the filter row spells it.
 *
 * `null` for a template no relationship type names: the card draws the plain `Template` chip, and the
 * filter cannot file it under a shelf nobody chose.
 */
export function categoryLabelOf(copy: PageCopy, slug: string): string | null {
  const key = templateCategoryOf(slug);
  if (key === null) return null;
  return itemLabelOr(sectionOf(copy, "categories"), key) ?? null;
}

/**
 * A Library card: what this account may start a relationship from.
 *
 * `View Details` opens the template's own screen (`/templates/relationship/<slug>`), which is the page
 * that lists its Aspects; `Create Relationship` opens the create step under the same handle, which is
 * the shipped flow — the Library never says "start an instance", because a relationship is what a
 * person starts and a session is what a published relationship opens.
 *
 * The chips are bundle 06's three, in its order: the shelf, the Aspect count, and how long the
 * answers take (`Family` · `5 Aspects` · `About 3 Minutes`). The meta line keeps #796's one price —
 * the plan's monthly figure, never a per-relationship charge — which the artifact does not draw but
 * the owner asked for on this card, so it is a line rather than a fourth chip.
 */
export function catalogueCard(copy: PageCopy, row: LibraryTemplate): TemplateShelfCard {
  const card = sectionOf(copy, "card");
  const words = actions(copy);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    chips: [
      categoryLabelOf(copy, row.slug) ?? itemLabel(card, "template"),
      aspectsLabel(card, row.aspectCount),
      minutesLabel(card, row.aspectCount),
    ],
    meta: [planPriceLabel(card)],
    detail: { href: relationshipTemplatePath(row.slug), label: words.detail },
    create: { href: createRelationshipPath(row.slug), label: words.create },
    relationship: null,
  };
}

/**
 * The featured band's card — a Library card whose buttons are the band's own words.
 *
 * One projection, not a second: the band draws the same template the shelf does, with `View Template`
 * where a card says `View Details`. The fixture carries both pairs on purpose — a card is one row of a
 * grid and the band is an introduction to it.
 */
export function featuredCard(copy: PageCopy, row: LibraryTemplate): TemplateShelfCard {
  const card = catalogueCard(copy, row);
  const featured = sectionOf(copy, "featured");
  return {
    ...card,
    detail: { ...card.detail, label: itemLabel(featured, "view") },
    create: { ...card.create, label: itemLabel(featured, "create") },
  };
}

/**
 * The one template the band draws: the curated pick, or the first row when it is not in the read.
 *
 * A curated slug that is missing (unpublished, archived, or a database that answered with nothing)
 * falls back to the first card, so the band is never an empty frame.
 */
export function featuredTemplateOf(rows: readonly LibraryTemplate[]): LibraryTemplate | undefined {
  return rows.find((row) => row.slug === FEATURED_TEMPLATE_SLUG) ?? rows[0];
}

/**
 * A "My Templates" card: a template this member owns.
 *
 * The chip says `My Copy` — every row here is a copy this account holds, whether it was started blank
 * or cloned from the Library — and the `Open` action opens the template's own page at
 * `/dashboard/templates/<id>`, which is where Edit, Propose to Library and the retire band live. The
 * meta line is the Aspect count and how many relationships were built from it, because "is this one in
 * use" is the question that decides whether it can be deleted at all.
 *
 * There is no read-only case: the list is authorship, so a row that is not the member's cannot be in it.
 */
export function mineCard(copy: PageCopy, row: LibraryRow): TemplateShelfCard {
  const card = sectionOf(copy, "card");
  const words = actions(copy);
  const used =
    row.relationshipCount === 0
      ? itemLabel(card, "unused")
      : fillLabel(
          itemLabel(card, row.relationshipCount === 1 ? "relationship-one" : "relationships"),
          { count: String(row.relationshipCount) },
        );
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    chips: [itemLabel(card, "copy")],
    meta: [aspectsLabel(card, row.aspectCount), used],
    detail: { href: dashboardTemplateEditorPath(row.id), label: words.open },
    create: { href: createRelationshipPath(row.id), label: words.create },
    relationship: null,
  };
}

/** The tabs, in the order the page draws them. `library` is the bare URL. */
export const TEMPLATE_TABS = ["library", "mine"] as const;

export type TemplateTab = (typeof TEMPLATE_TABS)[number];

/**
 * `?tab=` → the tab it names, or the Library.
 *
 * The bare path is the Library tab (`/dashboard/templates`), so the Library's own link carries no
 * parameter and the second tab is the one that must be said out loud. An unknown value lands on the
 * Library for the reason `flowStageOf()` lands on "all": a list built from a value nothing recognises
 * would say it filtered and would not have.
 *
 * **`?tab=catalogue` still lands on the Library.** That was this tab's value before #1130 named the
 * shelf `Library`, and a bookmark or a report written last month must not open a page it does not
 * describe.
 */
export function templatesTabOf(value: string | readonly string[] | undefined): TemplateTab {
  const raw = typeof value === "string" ? value : value?.[0];
  if (raw === "catalogue") return "library";
  return TEMPLATE_TABS.find((tab) => tab === raw) ?? "library";
}

/** The href of one tab: the Library is the bare path, the other tab names itself. */
export function templatesTabPath(tab: TemplateTab): string {
  return tab === "library" ? MEMBER_TEMPLATES_PATH : `${MEMBER_TEMPLATES_PATH}?tab=${tab}`;
}

/** One filter value: `all`, or one of the five shelves. */
export const LIBRARY_FILTERS = ["all", ...TEMPLATE_CATEGORIES] as const;

export type LibraryFilter = (typeof LIBRARY_FILTERS)[number];

/**
 * `?filter=` → the shelf it names, or `all`.
 *
 * A value nothing recognises is `all`, for the reason an unknown `?tab=` is the Library: the filter
 * row's counts are the honest answer to "what am I looking at", and a screen that filtered on a shelf
 * it cannot name would print an empty grid over a full catalogue.
 */
export function libraryFilterOf(value: string | readonly string[] | undefined): LibraryFilter {
  const raw = typeof value === "string" ? value : value?.[0];
  return LIBRARY_FILTERS.find((filter) => filter === raw) ?? "all";
}

/** Where one filter link points: the Library tab, with the shelf and the search kept. */
export function libraryFilterPath(filter: LibraryFilter, query = ""): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (query !== "") params.set("q", query);
  const search = params.toString();
  return search === "" ? MEMBER_TEMPLATES_PATH : `${MEMBER_TEMPLATES_PATH}?${search}`;
}

/** Where the search form submits: the Library tab, with the shelf kept and the query replaced. */
export function librarySearchPath(filter: LibraryFilter): string {
  return libraryFilterPath(filter);
}

/** One row of the filter row: the shelf's key, its word, its count and where it points. */
export interface LibraryFilterRow {
  readonly filter: LibraryFilter;
  readonly label: string;
  readonly count: number;
  readonly href: string;
}

/**
 * The filter row, with **the count each shelf would show** — not the count it is showing.
 *
 * The counts are computed over the search's own result set, so a person who types `sibling` sees
 * `Family 3`, `All 3` and `Work 0`: a filter that counted the unfiltered catalogue would promise rows
 * the search has already removed. `all` is the search's total.
 */
export function libraryFilters(
  copy: PageCopy,
  rows: readonly LibraryTemplate[],
  query = "",
): readonly LibraryFilterRow[] {
  const section = sectionOf(copy, "categories");
  return LIBRARY_FILTERS.map((filter) => ({
    filter,
    label: itemLabel(section, filter),
    count:
      filter === "all"
        ? rows.length
        : rows.filter((row) => templateCategoryOf(row.slug) === filter).length,
    href: libraryFilterPath(filter, query),
  }));
}

/** One shelf's rows, or every row for `all`. The filter is a filing, never a read. */
export function shelfRowsOf(
  rows: readonly LibraryTemplate[],
  filter: LibraryFilter,
): readonly LibraryTemplate[] {
  return filter === "all" ? rows : rows.filter((row) => templateCategoryOf(row.slug) === filter);
}

/**
 * The rows a Library search keeps: a case-insensitive substring of the title or the summary.
 *
 * `query` is trimmed and an empty one keeps everything — a search box that filtered on a stray space
 * is a screen that lost its catalogue to a keystroke.
 */
export function searchRowsOf(
  rows: readonly LibraryTemplate[],
  query: string,
): readonly LibraryTemplate[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return rows;
  return rows.filter(
    (row) => row.title.toLowerCase().includes(needle) || row.summary.toLowerCase().includes(needle),
  );
}

/** The realm a template's type lives in, or `null` for a template no type names. */
export function realmOf(slug: string): string | null {
  return relationshipType(slug)?.realm ?? null;
}

/** The category key a slug files under, for a view that needs the key rather than its word. */
export function categoryKeyOf(slug: string): TemplateCategory | null {
  return templateCategoryOf(slug);
}
