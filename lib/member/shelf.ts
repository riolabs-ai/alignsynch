/**
 * `/dashboard/templates` — one card model for the two tabs (#620).
 *
 * **Two reads, one card.** The catalogue tab lists what a member may start a relationship from
 * (`listLibraryTemplates`: the platform's templates plus their own), and the "My Templates" tab
 * lists what they have got (`listMemberLibrary`: the rows they own or that one of their
 * relationships names). The two reads answer different questions, but a person sees one kind of
 * card, so the projection happens here — once — and the component prints what it is handed.
 *
 * **The price and the two roles belong to the type, not to the record.** `data/assessments.ts`
 * derives one template per purchasable type with `slug = type.id` and records no price on it, for
 * the reason its own docblock gives: the catalogue reads them from the taxonomy by slug
 * (`relationshipType(record.slug)`), so a price change is a change in one place. That is what
 * `catalogueCard()` does — and a template the taxonomy does not name (the hand-authored
 * `relationship-basics`, an operator's own row) simply carries no price line rather than a
 * figure nobody wrote down.
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
import { relationshipType } from "@/data/relationship-types";
import { createRelationshipPath, templateDetailPath } from "@/lib/flow/paths";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import type { LibraryRow } from "@/lib/member/library";
import { MEMBER_TEMPLATES_PATH } from "@/lib/member/templates";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

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
  /** The one line under the summary: Aspects, then the price or the usage count. */
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
 * `View Details` opens the template's own screen (`/assessment/templates/<id>`), which is the
 * page that lists its Aspects and its instances; `Create Relationship` opens the create step
 * under the same id (`/assessment/templates/<id>/create`), which is the shipped flow — the
 * catalogue never says "start an instance", because a relationship is what a person starts and
 * a session is what a published relationship opens.
 */
export function catalogueCard(copy: PageCopy, row: LibraryTemplate): ShelfCard {
  const card = sectionOf(copy, "card");
  const price = itemLabel(card, "price");
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
    meta:
      type === undefined
        ? [aspectsLabel(card, row.aspectCount)]
        : [
            aspectsLabel(card, row.aspectCount),
            fillLabel(price, { price: formatCurrency(type.price) }),
          ],
    detail: { href: templateDetailPath(row.id), label: words.detail },
    create: { href: createRelationshipPath(row.id), label: words.create },
  };
}

/**
 * A "My Templates" card: a row this member owns or has adopted.
 *
 * The chip says which, because the two are different facts and only one of them may be edited:
 * a row you own opens the private editor at `/dashboard/templates/<id>`, a row you adopted opens
 * the catalogue entry, and neither screen is guessed from a second badge.
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
    chips: [itemLabel(card, "template"), itemLabel(card, row.owned ? "owned" : "adopted")],
    meta: [aspectsLabel(card, row.aspectCount), used],
    detail: {
      href: row.owned ? `${MEMBER_TEMPLATES_PATH}/${row.id}` : templateDetailPath(row.id),
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
