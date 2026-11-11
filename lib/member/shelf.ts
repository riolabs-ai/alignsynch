/**
 * `/dashboard/templates` — one card model for the two tabs (#620).
 *
 * **Two reads, one card.** The catalogue tab lists what a member may start a relationship from
 * (`listLibraryTemplates`: the platform's templates plus their own), and the "My Templates" tab
 * lists the templates they **own** (`listMemberLibrary`). A relationship does not put a template
 * in that list — it uses one — so the second read is authorship and not membership. A person sees one kind of
 * card, so the projection happens here — once — and the component prints what it is handed.
 *
 * **The price belongs to the plan, not to the record and not to the type.** A template carries no
 * price of its own, and no type is sold on its own: `data/billing-plans.ts` sells Basic at a
 * monthly figure with unlimited relationships, and which plan an account holds is chosen when a
 * relationship is ready to complete, never on this shelf (#619, #796). So the card's one number is
 * **one month of Basic**, read from that fixture — the same chip `/templates/relationship` prints
 * (`components/assessment-flow/template-card.tsx::CATALOGUE_PRICE_CENTS`), so the two shelves
 * cannot disagree about the figure. `data/relationship-types.ts::RELATIONSHIP_PRICE_CENTS` ($9.99)
 * predates the pricing rewrite and is never quoted: a per-relationship price is a promise the
 * completion step would not honour, and the template detail one click away says so in words.
 *
 * **Every word is the fixture's.** The chips, the two buttons and the count sentences resolve
 * through `itemLabel` / `fillLabel` against `data/pages/dashboard-templates.ts`, which is what
 * holds `components/dashboard/template-shelf.tsx` at zero copy literals (E23).
 *
 * No React and no database: a node test drives both builders without a browser, and the page
 * stays the only module that reads a session.
 */
import { formatCurrency } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { billingPlan, type BillingPlan } from "@/data/billing-plans";
import { relationshipType } from "@/data/relationship-types";
import { createRelationshipPath, relationshipTemplatePath } from "@/lib/flow/paths";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import type { LibraryRow } from "@/lib/member/library";
import { MEMBER_TEMPLATES_PATH } from "@/lib/member/templates";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

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
 * `"Basic · $8.95/mo"` — the plan's name and its monthly figure, never a bare price.
 *
 * The name is in the sentence on purpose: `$8.95/mo` alone beside a shelf of templates reads as
 * one subscription per template, and the card is not selling the template.
 */
function planPriceLabel(card: PageCopySection): string {
  return fillLabel(itemLabel(card, "price"), {
    plan: CATALOGUE_PLAN.name,
    price: formatCurrency(CATALOGUE_PLAN.monthlyCents),
  });
}

/**
 * One card, in the shape the shelf draws it.
 *
 * `create` is `null` rather than an absent key: the component's branch is "is there a second
 * action", and a `?:` here would let a card that should offer one render nothing at all.
 */
export interface ShelfCard {
  readonly id: string;
  /** The gradient's seed — the record's slug, the same field `gradientFor()` hashes. */
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** The pills above the title: the template mark, then what the card is (realm, or whose it is). */
  readonly chips: readonly string[];
  /** The one line under the summary: Aspects, then the plan's monthly price or the usage count. */
  readonly meta: readonly string[];
  readonly detail: { readonly href: string; readonly label: string };
  readonly create: { readonly href: string; readonly label: string } | null;
}

/** The two buttons' words, resolved once so both builders and the test agree. */
function actions(copy: PageCopy): { detail: string; create: string } {
  const card = sectionOf(copy, "card");
  return { detail: itemLabel(card, "details"), create: itemLabel(card, "create") };
}

/** `"6 Aspects"` — counted from the row, never typed. */
function aspectsLabel(card: PageCopySection, count: number): string {
  return fillLabel(itemLabel(card, "aspects"), { count: String(count) });
}

/**
 * A catalogue card: what this account may start a relationship from.
 *
 * `View Details` opens the template's own screen (`/templates/relationship/<slug>`), which is the
 * page that lists its Aspects and its instances; `Create Relationship` opens the create step
 * under the same handle (`/templates/relationship/<slug>/create`), which is the shipped flow — the
 * catalogue never says "start an instance", because a relationship is what a person starts and
 * a session is what a published relationship opens.
 *
 * The price line is the plan's, on every card: a template the taxonomy does not name (the
 * hand-authored `relationship-basics`, an operator's own row) is started on the same plan as a
 * taxonomy one, so the card that carries no realm chip still carries the figure that is true.
 */
export function catalogueCard(copy: PageCopy, row: LibraryTemplate): ShelfCard {
  const card = sectionOf(copy, "card");
  const type = relationshipType(row.slug);
  const words = actions(copy);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    chips:
      type === undefined
        ? [itemLabel(card, "template")]
        : [itemLabel(card, "template"), type.realm],
    meta: [aspectsLabel(card, row.aspectCount), planPriceLabel(card)],
    detail: { href: relationshipTemplatePath(row.slug), label: words.detail },
    create: { href: createRelationshipPath(row.slug), label: words.create },
  };
}

/**
 * A "My Templates" card: a template this member owns.
 *
 * The chip says `Owned`, and every row opens the private editor at `/dashboard/templates/<id>`.
 * There is no read-only case: the list is authorship, so a row that is not the member's cannot be
 * in it. What used to be the second case — a template a session named — was the defect, and is
 * gone rather than relabelled.
 */
export function mineCard(copy: PageCopy, row: LibraryRow): ShelfCard {
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
    chips: [itemLabel(card, "template"), itemLabel(card, "owned")],
    meta: [aspectsLabel(card, row.aspectCount), used],
    detail: {
      href: `${MEMBER_TEMPLATES_PATH}/${row.id}`,
      label: words.detail,
    },
    create: { href: createRelationshipPath(row.id), label: words.create },
  };
}

/** The tabs, in the order the page draws them. `catalogue` is the bare URL. */
export const TEMPLATE_TABS = ["catalogue", "mine"] as const;

export type TemplateTab = (typeof TEMPLATE_TABS)[number];

/**
 * `?tab=` → the tab it names, or the catalogue.
 *
 * The bare path is the catalogue tab (`/dashboard/templates`), so the catalogue's own link
 * carries no parameter and the second tab is the one that must be said out loud. An unknown
 * value lands on the catalogue for the reason `flowStageOf()` lands on "all": a list built from
 * a value nothing recognises would say it filtered and would not have.
 */
export function templatesTabOf(value: string | readonly string[] | undefined): TemplateTab {
  const raw = typeof value === "string" ? value : value?.[0];
  return TEMPLATE_TABS.find((tab) => tab === raw) ?? "catalogue";
}

/** The href of one tab: the catalogue is the bare path, the other tab names itself. */
export function templatesTabPath(tab: TemplateTab): string {
  return tab === "catalogue" ? MEMBER_TEMPLATES_PATH : `${MEMBER_TEMPLATES_PATH}?tab=${tab}`;
}
