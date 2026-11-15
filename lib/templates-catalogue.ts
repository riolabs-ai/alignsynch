/**
 * `/relationship-templates` — the V2 catalogue, joined (issue #905).
 *
 * **What this page is, and what it is not.** It is the public catalogue of relationship
 * *templates*, re-cut on the visual system `docs/specs/spec-design-page-rel-templates-v2/` draws.
 * It is **not** a new design: the package contains no mockup of this page, so the constraint that
 * replaces "pixel for pixel" is that every band here is an instance of a pattern the package
 * already draws — `home/homepage-redesign.html`'s hero, in-page menu, how-it-works, templates,
 * benefits and closing band, in its order, drawn by the same components the AlignSynch `/` uses
 * (`components/home/as2-*.tsx`, #904). Nothing below invents a section: the seven slices of the
 * model are exactly the seven bands those components render.
 *
 * **Two surfaces, one fixture.** The words are `data/pages/templates.ts` — the same fixture the
 * #889 composition at `/relationship-types` reads, which is why this page's rows are its own ids
 * rather than edits to that page's sentences. `lib/templates-page.ts` did not change: the older
 * catalogue keeps rendering the copy it shipped with, so the two pages cannot silently re-cut each
 * other.
 *
 * **The two authored actions are resolved for the viewer (#979).** `membership.cta` and
 * `final-cta.cta` are fixture rows whose `href` is `/register`; a member with a live session must
 * not be sent to the sign-up page, so both pass through `lib/start-path.ts::startHrefFor()` for the
 * `StartViewer` the page resolved. A visitor's hrefs are byte-for-byte what they were.
 *
 * **Records stay records.** Every template name and every link in the band is a row of
 * `data/relationship-types.ts` through `purchasableTypesByGroup()` — the same projection the front
 * page's templates band and the member library read — so a type added to the taxonomy appears here
 * with no copy edit, and a type the shop will not sell cannot appear at all. The plan's name and
 * figure come from `cataloguePriceNote()` over `data/billing-plans.ts` (#798): one price model.
 *
 * **Business leads, personal follows.** `TYPE_GROUPS` is the taxonomy's own order and the canon's
 * (`AUDIENCE-AND-POSITIONING.md`): the work relationships are what the product sells first, and the
 * hero's two doors, the band's two actions and the two groups all read in that order.
 *
 * React-free and Next-free, like `lib/templates-page.ts` and `lib/home-alignsynch.ts`: `data:check`
 * compiles this file under plain node, and `components/templates/**` holds no word of its own (E23
 * keeps the route at 0 leaf literals).
 */
import type { Brand } from "@/content/brand";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { media, type MediaKey } from "@/data/media";
import { purchasableTypesByGroup, TYPE_GROUPS, type TypeGroup } from "@/data/relationship-types";
import { brandSurfaceVars } from "@/lib/brand-theme";
import { catalogueDetailPath, cataloguePriceNote } from "@/lib/template-catalogue";
import { startHrefFor, type StartViewer } from "@/lib/start-path";
import type { As2HomeModel, HomeAnchor, HomeImage } from "@/lib/home-alignsynch";
import { itemBody, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * The seven bands this page draws, typed as the ones the AS2 components already render.
 *
 * A `Pick` and not a new interface, on purpose: the components' props *are* these slices, so a
 * field added to a band on `/` cannot be added here without this module being told, and a page
 * that stopped passing one is a compile error rather than a band that renders half-empty.
 */
export type TemplatesCatalogueModel = Pick<
  As2HomeModel,
  "tokens" | "hero" | "nav" | "howItWorks" | "templates" | "benefits" | "finalCta"
>;

/**
 * The two group anchors, derived from the taxonomy's own group names.
 *
 * The hero's two cards, the catalogue band's two actions and the two "start with" targets all jump
 * here, so the id is written once. `As2Templates` renders `id={group.id}` on each group article and
 * `data-home-anchor` so the jump lands below both sticky bars.
 */
export const GROUP_ANCHORS: Readonly<Record<TypeGroup, string>> = {
  Business: "business-relationships",
  Personal: "personal-relationships",
};

/** The band ids the in-page menu points at — the drawn bands' own ids, not new ones. */
const BAND_ANCHORS = {
  templates: "relationship-templates",
  how: "how-it-works",
  included: "benefits",
} as const;

/**
 * The surface roles this page paints with. It is the same list `lib/home-alignsynch.ts` requires,
 * spelled here because that one is private to `/` — and it is required for the same reason: the
 * bands draw `bg-sand`, `border-line`, `bg-pale`, `text-deep` and `bg-mark`, and a brand that names
 * none of them would render a page with invisible grounds rather than fail loudly. The route only
 * takes this path on the brand that defines them (see the page module's switch).
 */
const SURFACE_ROLES = ["paper", "mist", "sand", "line", "pale", "mark", "deep"] as const;

function surfacePaint(brand: Brand): Record<string, string> {
  const vars = brandSurfaceVars(brand);
  const missing = SURFACE_ROLES.filter((role) => vars[`--${role}`] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `templatesCatalogue: brand "${brand.name}" names no ${missing.join(", ")} — this page draws those surfaces`,
    );
  }
  return vars;
}

/** A registry photograph, narrowed to the four fields `next/image` needs. */
function photograph(key: MediaKey): HomeImage {
  const entry = media[key];
  if (!("src" in entry)) {
    throw new Error(
      `templatesCatalogue: "${key}" is a generated default — the hero needs the file`,
    );
  }
  return { src: entry.src, alt: entry.alt, width: entry.width, height: entry.height };
}

/** `#<id>` — a jump target spelled once, from the id. */
function anchorTo(label: string, id: string): HomeAnchor {
  return { label, href: `#${id}` };
}

/**
 * One group's chip list.
 *
 * The link is `catalogueDetailPath()` — the record's own page — so the chips are doors rather than
 * decoration, and a type whose page has moved cannot leave a dead chip behind.
 */
function groups(copy: PageCopy) {
  return purchasableTypesByGroup().map((entry) => ({
    group: entry.group,
    id: GROUP_ANCHORS[entry.group],
    heading: itemLabel(sectionOf(copy, "choose"), `templates-group-${entry.group.toLowerCase()}`),
    types: entry.types.map((type) => ({
      id: type.id,
      name: type.name,
      href: catalogueDetailPath(type.id),
    })),
  }));
}

/**
 * The page, joined.
 *
 * `types` is a parameter so a test can prove every name and every link on the page follows the
 * taxonomy instead of agreeing with a constant; it defaults to the purchasable gate, so the page
 * cannot be handed a type the product will not sell.
 */
export function templatesCatalogue(
  brand: Brand,
  copy: PageCopy,
  viewer: StartViewer,
  types: readonly TypeGroup[] = TYPE_GROUPS,
): TemplatesCatalogueModel {
  const how = sectionOf(copy, "how");
  const choose = sectionOf(copy, "choose");
  const membership = sectionOf(copy, "membership");
  const finalSection = sectionOf(copy, "final-cta");

  if (copy.subtitle === undefined) {
    throw new Error(
      "templatesCatalogue: the page fixture has no subtitle — the hero copy is one of the two sentences this page opens with",
    );
  }
  /**
   * Every band this page draws is headed, and both drawn band components take `heading` as
   * required. The fixture's section schema makes it optional (a nav column has no title), so the
   * four bands that do resolve through this reader rather than defaulting to an empty string.
   */
  const headingOf = (section: PageCopySection, id: string): string => {
    if (section.heading === undefined) {
      throw new Error(
        `templatesCatalogue: section "${id}" has no heading — its band renders one, and an empty heading is an invisible band`,
      );
    }
    return section.heading;
  };
  const howHeading = headingOf(how, "how");
  const chooseHeading = headingOf(choose, "choose");
  const membershipHeading = headingOf(membership, "membership");
  const finalHeading = headingOf(finalSection, "final-cta");
  if (membership.cta === undefined || finalSection.cta === undefined) {
    throw new Error(
      'templatesCatalogue: the fixture must give "membership" and "final-cta" a cta — both bands draw exactly one action',
    );
  }

  /**
   * The groups, filtered to the ones the caller asked for and to the ones the taxonomy actually
   * populates: a group with no purchasable type is dropped, never drawn empty.
   */
  const templateGroups = groups(copy).filter(
    (group) => types.includes(group.group) && group.types.length > 0,
  );

  /** The plan chip: `{plan}` and `{price}` filled from the billing model, never typed here. */
  const planChip = cataloguePriceNote(itemLabel(membership, "membership-plan"));

  return {
    tokens: surfacePaint(brand),
    hero: {
      eyebrow: pageItemOf(copy, "hero-eyebrow").label,
      heading: copy.heading,
      subtitle: copy.subtitle,
      /**
       * The hero's two actions, drawn as the reference draws them: one solid control and one text
       * link. They jump to *this page's* bands — the catalogue and the steps — because the two
       * group cards beside them already open the work and the personal halves; a third control
       * doing the same job would be one too many.
       */
      action: anchorTo(pageItemOf(copy, "hero-primary").label, BAND_ANCHORS.templates),
      secondary: anchorTo(pageItemOf(copy, "hero-secondary").label, BAND_ANCHORS.how),
      note: pageItemOf(copy, "hero-note").label,
      cards: [
        {
          id: "business",
          kicker: pageItemOf(copy, "life-business-kicker").label,
          title: pageItemOf(copy, "life-business-title").label,
          action: pageItemOf(copy, "life-business-action").label,
          name: pageItemOf(copy, "life-business-name").label,
          href: `#${GROUP_ANCHORS.Business}`,
          image: photograph("home.business-life"),
        },
        {
          id: "personal",
          kicker: pageItemOf(copy, "life-personal-kicker").label,
          title: pageItemOf(copy, "life-personal-title").label,
          action: pageItemOf(copy, "life-personal-action").label,
          name: pageItemOf(copy, "life-personal-name").label,
          href: `#${GROUP_ANCHORS.Personal}`,
          image: photograph("home.personal-life"),
        },
      ],
    },
    nav: {
      name: pageItemOf(copy, "catalogue-nav-name").label,
      /** Three rows: the three bands a reader scrolls to. Every href is a band this page emits. */
      items: [
        anchorTo(pageItemOf(copy, "catalogue-nav-templates").label, BAND_ANCHORS.templates),
        anchorTo(pageItemOf(copy, "catalogue-nav-how").label, BAND_ANCHORS.how),
        anchorTo(pageItemOf(copy, "catalogue-nav-included").label, BAND_ANCHORS.included),
      ],
    },
    howItWorks: {
      eyebrow: itemLabel(how, "how-eyebrow"),
      heading: howHeading,
      body: sectionBody(how),
      /**
       * Four steps, numbered from their position rather than from a number in the fixture — the
       * drawn band is one row of four, and a `03` beside the second row is the defect the ordinal
       * derivation exists to make impossible.
       */
      steps: ["how-step-one", "how-step-two", "how-step-three", "how-step-four"].map(
        (id, index) => ({
          id,
          number: String(index + 1).padStart(2, "0"),
          title: itemLabel(how, id),
          body: itemBody(how, id),
        }),
      ),
      startEyebrow: itemLabel(how, "how-start-eyebrow"),
      startBody: itemLabel(how, "how-start-body"),
      action: anchorTo(itemLabel(how, "how-action"), BAND_ANCHORS.templates),
    },
    templates: {
      eyebrow: itemLabel(choose, "eyebrow-choose"),
      heading: chooseHeading,
      ...(choose.body === undefined ? {} : { body: choose.body }),
      groups: templateGroups,
      action: anchorTo(itemLabel(choose, "choose-action"), GROUP_ANCHORS.Business),
      secondary: anchorTo(itemLabel(choose, "choose-secondary"), GROUP_ANCHORS.Personal),
      note: itemLabel(choose, "templates-note"),
      counselor: {
        lead: itemLabel(choose, "counselor-lead"),
        rest: itemLabel(choose, "counselor-rest"),
      },
    },
    benefits: {
      eyebrow: itemLabel(membership, "membership-eyebrow"),
      heading: membershipHeading,
      ...(membership.body === undefined ? {} : { body: membership.body }),
      /**
       * Four rows, one per fact the membership actually states. The drawn band draws five; four
       * fill the same two-column grid in two even rows, and `membership-test-mode` is the band's
       * closing callout rather than a fifth fact — it is a disclosure, not a benefit.
       */
      items: [
        {
          id: "membership-note",
          title: itemLabel(membership, "membership-note"),
          body: itemBody(membership, "membership-note"),
        },
        {
          id: "membership-days",
          title: itemLabel(membership, "membership-days"),
          body: itemBody(membership, "membership-days"),
        },
        { id: "membership-plan", title: planChip, body: itemBody(membership, "membership-plan") },
        {
          id: "membership-pair",
          title: itemLabel(membership, "membership-pair"),
          body: itemBody(membership, "membership-pair"),
        },
      ],
      action: { label: membership.cta.label, href: startHrefFor(membership.cta.href, viewer) },
      callout: itemLabel(membership, "membership-test-mode"),
    },
    finalCta: {
      heading: finalHeading,
      body: sectionBody(finalSection),
      action: {
        label: finalSection.cta.label,
        href: startHrefFor(finalSection.cta.href, viewer),
      },
    },
  };
}
