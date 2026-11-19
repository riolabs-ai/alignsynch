/**
 * `/templates/relationship/[slug]` — **the in-app template page's one projection** (#1259).
 *
 * The sibling of `lib/member/shelf.ts`: that file turns a library row into a **card**, this one
 * turns the same row into the **page** the card's `View Details` opens. Both read the record the
 * library read returned, and both take the words as a prop — so no component owns a string, and a
 * template cannot draw as one thing on the shelf and another on its own page.
 *
 * **The row is the record's; the taxonomy is the type's.** Three facts come from different homes
 * and are joined here rather than in the page:
 *
 *   the record     its title, its summary and its Aspects (with each Aspect's two named ends),
 *                  read through `readLibraryTemplate()` — the same read the shelf's row came from,
 *                  so a member's own copy renders as faithfully as a catalogue template;
 *   the type       the shelf it files under (`data/template-categories.ts`), the two descriptor
 *                  sentences and the Counterparty's role word (`data/relationship-types.ts`),
 *                  looked up by slug — the join `data/assessments.ts` already documents, and
 *                  `undefined` for a hand-authored template no type names;
 *   the plan       the catalogue's one price (`data/billing-plans.ts`), never a per-relationship
 *                  figure, and the same tier `/dashboard/templates` prints on every card.
 *
 * **Nothing is invented where the type is absent.** A member's own template has no shelf, no
 * authored "who it's not for" sentence and no role word, so the page draws the plain `Template`
 * chip (the shelf's own fallback), its descriptor block falls back to the record's summary, and
 * the start panel uses its generic wording. A page that filled those in with a default would be a
 * second catalogue.
 *
 * **What the artifact draws that this model does not is named here on purpose.** Bundle 06's
 * `relationship-template.html` carries a *What It Covers* card — three titled themes per type
 * ("How You Stay in Touch", "Old Roles", "Family Decisions"). Nothing in this repo authors them:
 * `RelationshipType` carries a descriptor and its Aspects and no theme grouping, and writing one
 * into the page would be exactly the page-local catalogue these pages are not allowed to become.
 * The card is therefore absent rather than faked, and a theme field on the taxonomy is the change
 * that would bring it back.
 *
 * Pure: no React, no `lib/db`, no clock. `pnpm test` drives it with a fixture row, and the page
 * module is the only thing that reads a session.
 */
import { formatCurrency } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { BillingPlan } from "@/data/billing-plans";
import type { RelationshipType } from "@/data/relationship-types";
import { templateCategoryOf } from "@/data/template-categories";
import {
  createRelationshipPath,
  relationshipTemplatePath,
  TEMPLATE_LIBRARY_TAB_PATH,
} from "@/lib/flow/paths";
import { minutesForAspects } from "@/lib/member/shelf";
import { fillLabel, itemLabel, itemOf, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";

/** One Aspect, as the detail read hands it over — the storage row's fields, nothing added. */
export interface TemplatePageAspect {
  readonly id: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/**
 * The row the library read returned, in the four fields this page prints.
 *
 * Structural rather than an import of `LibraryTemplate`: this module is reached from a page
 * component, and a value-or-type import from `lib/db/**` is the crossing `data:check` E34 exists to
 * refuse. `LibraryTemplate` satisfies this shape, which is what keeps one read behind both screens.
 */
export interface TemplatePageRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
}

/** One Aspect, numbered and framed for the view. */
export interface TemplatePageAspectRow {
  readonly id: string;
  /** `01` … — positional, so a re-ordered template renumbers itself. */
  readonly ordinal: string;
  readonly prompt: string;
  /** The words at notch 1 and notch 5, already framed (`"1 · Far short"`). */
  readonly left: string;
  readonly right: string;
}

/** One step of the aside's How It Works panel. */
export interface TemplatePageStep {
  readonly id: string;
  /** `"1–5"`, `"6"`, `"→"` — the badge beside the step, from the fixture's own frame. */
  readonly ordinal: string;
  readonly label: string;
  readonly body: string;
}

/** Everything `components/templates/template-page.tsx` prints, already joined. */
export interface TemplatePageModel {
  /** The `[slug]` segment this page was rendered for. */
  readonly slug: string;
  /** The kicker above the name. */
  readonly kicker: string;
  readonly name: string;
  readonly summary: string;
  /** The shelf · Aspect count · minutes · two people, in the artifact's order. */
  readonly chips: readonly string[];
  /** The create flow's stage 1 — the page's one primary action. */
  readonly create: { readonly label: string; readonly href: string };
  /** `Save to My Templates`: the shipped copy writer, keyed on the record's id. */
  readonly save: { readonly label: string; readonly templateId: string };
  /** Back to the shelf this page was opened from. */
  readonly back: { readonly label: string; readonly href: string };
  /** The two headings over the type's own sentences; the "not for" pair is absent when unauthored. */
  readonly descriptor: {
    readonly forHeading: string;
    readonly forBody: string;
    readonly notForHeading?: string;
    readonly notForBody?: string;
  };
  /**
   * The Aspects band. `empty` is drawn instead of `rows` when the template carries none — a real
   * row (a private copy saved before it was filled in), never a blank frame.
   */
  readonly aspects: {
    readonly heading: string;
    readonly body: string;
    readonly legend: { readonly lead: string; readonly feel: string; readonly wish: string };
    readonly advanced: string;
    readonly rows: readonly TemplatePageAspectRow[];
    readonly empty: { readonly heading: string; readonly body: string } | null;
  };
  /** The aside's start panel, addressed to the Counterparty's own role where the type names one. */
  readonly startPanel: { readonly heading: string; readonly body: string };
  /** The aside's trial panel: what starts free, what follows it, who never pays. */
  readonly trial: { readonly heading: string; readonly items: readonly string[] };
  /** The aside's How It Works panel. */
  readonly how: { readonly heading: string; readonly steps: readonly TemplatePageStep[] };
  /** The closing band — the same action, once more, where the reader finishes. */
  readonly closing: { readonly heading: string };
  /** The canonical path this page is served at, `/templates/relationship/<slug>`. */
  readonly path: string;
}

/** The How It Works steps, in the order the artifact draws them. */
const HOW_STEPS = ["setup", "align", "talk"] as const;

/** `"2"` — the two people a relationship is between, named once so the chip cannot drift. */
const RELATIONSHIP_PARTIES = "2";

/** `"01"` — the badge an Aspect's row carries. */
function ordinalOf(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/**
 * The shelf a type files under, as the filter row spells it; `null` for a template no type names.
 *
 * Read from the shelf's own fixture (`data/pages/dashboard-templates.ts`) rather than a second
 * table here: a Library card and the page it opens print one word for one shelf, and the key →
 * word join is `data/template-categories.ts`'s. A key the fixture carries no row for is `null`, not
 * a throw — the section is a closed table of five words and the record is not.
 */
function categoryChip(shelfCopy: PageCopy, slug: string): string | null {
  const section: PageCopySection | undefined = shelfCopy.sections?.find(
    (candidate) => candidate.id === "categories",
  );
  const key = templateCategoryOf(slug);
  if (section === undefined || key === null) return null;
  return section.items?.find((candidate) => candidate.id === key)?.label ?? null;
}

/**
 * The page's model.
 *
 * `plan` is passed rather than looked up so the caller owns which tier the page prices against —
 * the member shelf prices from Basic (`lib/member/shelf.ts`), and a page that picked its own tier
 * would be a second answer to "what does this cost me".
 */
export function templatePageModel(input: {
  readonly copy: PageCopy;
  /** `data/pages/dashboard-templates.ts` — the shelf's own words, read for the shared chips. */
  readonly shelfCopy: PageCopy;
  readonly template: TemplatePageRow;
  readonly aspects: readonly TemplatePageAspect[];
  readonly plan: BillingPlan;
  /** The relationship type this template is derived from, when it names one. */
  readonly type?: RelationshipType;
}): TemplatePageModel {
  const { copy, shelfCopy, template, aspects, plan, type } = input;
  const card = sectionOf(shelfCopy, "card");
  const aspectsSection = sectionOf(copy, "aspects");
  const startItems = sectionOf(copy, "start");
  const aspectCount = String(aspects.length);
  const pageItem = (id: string): string => pageItemOf(copy, id).label;
  /** The type's Counterparty role, where the template names a type at all. */
  const role = type?.roles.counterparty;

  const emptySection = sectionOf(copy, "aspects-empty");
  const trialSection = sectionOf(copy, "trial");
  const howSection = sectionOf(copy, "how");

  return {
    slug: template.slug,
    kicker: copy.eyebrow ?? "",
    name: template.title,
    summary: template.summary,
    chips: [
      categoryChip(shelfCopy, template.slug) ?? itemLabel(card, "template"),
      fillLabel(pageItem("aspects"), { count: aspectCount }),
      fillLabel(pageItem("minutes"), {
        count: String(minutesForAspects(aspects.length)),
      }),
      fillLabel(pageItem("people"), { count: RELATIONSHIP_PARTIES }),
    ],
    create: { label: pageItem("create"), href: createRelationshipPath(template.slug) },
    save: { label: pageItem("save"), templateId: template.id },
    back: { label: pageItem("back"), href: TEMPLATE_LIBRARY_TAB_PATH },
    descriptor: {
      forHeading: pageItem("for-heading"),
      /** The type's authored sentence, or the record's own summary for a template that has none. */
      forBody: type?.descriptor.whoItsFor ?? template.summary,
      ...(type === undefined
        ? {}
        : {
            notForHeading: pageItem("not-for-heading"),
            notForBody: type.descriptor.whoItsNotFor,
          }),
    },
    aspects: {
      heading: fillLabel(aspectsSection.heading ?? "", { count: aspectCount }),
      body: sectionBody(aspectsSection),
      legend: {
        lead: itemLabel(aspectsSection, "legend"),
        feel: itemLabel(aspectsSection, "feel"),
        wish: itemLabel(aspectsSection, "wish"),
      },
      advanced: itemLabel(aspectsSection, "advanced"),
      rows: aspects.map((aspect, index) => ({
        id: aspect.id,
        ordinal: ordinalOf(index),
        prompt: aspect.prompt,
        left: fillLabel(pageItem("scale-left"), { left: aspect.leftValue }),
        right: fillLabel(pageItem("scale-right"), { right: aspect.rightValue }),
      })),
      empty:
        aspects.length === 0
          ? { heading: emptySection.heading ?? "", body: sectionBody(emptySection) }
          : null,
    },
    startPanel: {
      heading:
        role === undefined
          ? itemLabel(startItems, "heading-generic")
          : fillLabel(itemLabel(startItems, "heading"), { role }),
      body:
        role === undefined
          ? itemLabel(startItems, "body-generic")
          : /** The role is a Title Case word ("Sister"); mid-sentence it reads as a common noun. */
            fillLabel(itemLabel(startItems, "body"), { role: role.toLowerCase() }),
    },
    trial: {
      heading: trialSection.heading ?? "",
      items: [
        itemLabel(trialSection, "no-card"),
        /**
         * The one figure on the page, and it is the plan's: a `$` typed here would be a price that
         * can disagree with the one a checkout charges.
         */
        fillLabel(itemLabel(trialSection, "after"), {
          price: formatCurrency(plan.monthlyCents),
        }),
        itemLabel(trialSection, "invitee"),
      ],
    },
    how: {
      heading: howSection.heading ?? "",
      steps: HOW_STEPS.map((id) => {
        const item = itemOf(howSection, id);
        return { id, ordinal: item.value ?? "", label: item.label, body: item.body ?? "" };
      }),
    },
    closing: { heading: sectionOf(copy, "closing").heading ?? "" },
    path: relationshipTemplatePath(template.slug),
  };
}
