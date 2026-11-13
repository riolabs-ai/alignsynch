/**
 * The AS2 home page (`/`, #853), joined — copy, records and media into one view-model.
 *
 * `data/pages/home-alignsynch.ts::alignSynchHomeAs2Copy` owns every word, `data/relationship-types.ts`
 * owns the template groups, `data/media.ts` owns the four photographs, and this module is the join.
 * The components under `components/home/` then render what they are handed: E23 holds
 * `components/home/**` at zero leaf literals on `/`, so a section that wanted a sentence of its own
 * would fail the gate rather than quietly invent one.
 *
 * **Why the join is here and not in the page module.** Two reasons, both measured. `app/(marketing)/
 * page.tsx` is an *entry module* for the `/` budget: a leaf literal written there counts against a
 * budget of 0, and a `sectionOf(copy, "how-it-works")` there resolves against `data/pages/home`
 * (QuizHub's fixture — the route's declared copy), not this one, so the reference would be reported
 * as a typo. `lib/` is attributed to no surface, which is why `lib/alignment-home.ts` does the same
 * job for the retired composition.
 *
 * **React-free and Next-free**, like `lib/alignment-home.ts` and `lib/templates-page.ts`: a node
 * test renders the model, and `data:check` compiles this tree under plain node. Only `@/content`,
 * `@/data` and `@/lib` value imports appear below — nothing that needs a bundler.
 *
 * ## Three conventions the fixture and this module share
 *
 *  1. **A section's copy id is the band's anchor target.** `questions` is both the fixture's section
 *     id and the DOM id, which is what keeps `/#questions` — the anchor the shared header and footer
 *     have linked to since before this page — landing on the model band.
 *  2. **An ordered list is a numeric prefix.** `step-N`, `benefit-N`, `prompt-N` and `story-N-*` are
 *     read in the order the fixture declares them, so renumbering or adding a row is a copy edit
 *     with no `.tsx` change. The reading is by pattern, and a list that matches nothing throws:
 *     a band that silently renders zero cards is worse than a red build.
 *  3. **A missing id throws here**, at render, while `/` is prerendered by the gate.
 */
import type { Brand } from "@/content/brand";
import type { PageCopy, PageCopyItem, PageCopySection } from "@/content/pages";
import { media, type MediaKey } from "@/data/media";
import { purchasableTypesByGroup, type TypeGroup } from "@/data/relationship-types";
import { brandSurfaceVars } from "@/lib/brand-theme";
import { catalogueDetailPath } from "@/lib/template-catalogue";
import { itemBody, itemLabel, pageItemOf, sectionOf } from "@/lib/page-copy";

/** An in-page jump. The href is derived from the target's id, never typed twice. */
export interface HomeAnchor {
  readonly label: string;
  readonly href: string;
}

/** A photograph, as `next/image` needs it: a path, the alt text the registry owns, and a size. */
export interface HomeImage {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

/** The heading furniture every band shares. `eyebrow` and `body` are optional per band. */
export interface HomeHead {
  readonly eyebrow?: string;
  readonly heading: string;
  readonly body?: string;
}

/** One of the hero's two relationship cards — the whole card is one link. */
export interface HomeLifeCard {
  readonly id: "personal" | "business";
  readonly kicker: string;
  readonly title: string;
  readonly action: string;
  /** The card's accessible name: it is a single anchor, so its words alone are not enough. */
  readonly name: string;
  readonly href: string;
  readonly image: HomeImage;
}

/** One numbered step in the how-it-works band. `number` is the ordinal, zero-padded. */
export interface HomeStep {
  readonly id: string;
  readonly number: string;
  readonly title: string;
  readonly body: string;
}

/** One template group: the business or personal half of the taxonomy, with its type links. */
export interface HomeTemplateGroup {
  readonly group: TypeGroup;
  readonly id: string;
  readonly heading: string;
  readonly types: readonly { readonly id: string; readonly name: string; readonly href: string }[];
}

/** A line inside the model band's card: the emphasised word over its sentence. */
export interface HomeModelLine {
  readonly lead: string;
  readonly body: string;
}

/** One half of the model band — the Bread (where a gap comes from) or the Butter (the scale). */
export interface HomeModelCard {
  readonly stepLabel: string;
  readonly step: string;
  readonly kicker: string;
  readonly title: string;
  readonly deck: string;
  readonly lines: readonly HomeModelLine[];
  readonly listName: string;
  readonly image: HomeImage;
  /** The Bread's closing note, and the Butter's scale panel — one card carries one, not both. */
  readonly note?: { readonly lead: string; readonly rest: string };
  readonly scale?: {
    readonly name: string;
    readonly yes: string;
    readonly no: string;
    readonly middle: string;
  };
}

/** One participant reflection. `alternate` is the second quote two of the three cards carry. */
export interface HomeStory {
  readonly id: string;
  readonly title: string;
  readonly quotes: readonly string[];
  readonly support: string;
}

/** One benefit row. */
export interface HomeBenefit {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

/** The whole page. One object, so the composition renders from one prop. */
export interface As2HomeModel {
  /** The brand's surface roles, painted on the page (see `brandSurfaceVars`). */
  readonly tokens: Record<string, string>;
  readonly hero: {
    readonly eyebrow: string;
    readonly heading: string;
    readonly subtitle: string;
    readonly action: HomeAnchor;
    readonly secondary: HomeAnchor;
    readonly note: string;
    readonly cards: readonly HomeLifeCard[];
  };
  readonly nav: {
    /** The menu's accessible name (`aria-label`) — "On this page". */
    readonly name: string;
    readonly items: readonly HomeAnchor[];
  };
  readonly howItWorks: HomeHead & {
    readonly steps: readonly HomeStep[];
    readonly startEyebrow: string;
    readonly startBody: string;
    readonly action: HomeAnchor;
  };
  readonly templates: HomeHead & {
    readonly groups: readonly HomeTemplateGroup[];
    readonly action: HomeAnchor;
    readonly secondary: HomeAnchor;
    readonly note: string;
    /**
     * The band's one bounded callout for counselors, therapists and coaches (#904). Lead and rest
     * are two fields because the lead is the bolded subject of the sentence, not a styling choice.
     */
    readonly counselor: { readonly lead: string; readonly rest: string };
  };
  readonly model: HomeHead & { readonly cards: readonly HomeModelCard[] };
  readonly stories: HomeHead & {
    readonly cards: readonly HomeStory[];
    readonly prompts: {
      readonly title: string;
      readonly note: string;
      readonly name: string;
      readonly items: readonly string[];
    };
    readonly actionBody: string;
    readonly action: HomeAnchor;
  };
  readonly benefits: HomeHead & {
    readonly items: readonly HomeBenefit[];
    readonly action: HomeAnchor;
    readonly callout: string;
  };
  readonly finalCta: {
    readonly heading: string;
    readonly body: string;
    readonly action: HomeAnchor;
  };
}

/* ------------------------------------------------------------------ *
 * Reading the fixture
 * ------------------------------------------------------------------ */

/** `#<id>` — the one place a jump target is spelled, and it is spelled from the id. */
function anchorTo(label: string, id: string): HomeAnchor {
  return { label, href: `#${id}` };
}

/** A section's items, in declared order, whose ids match `pattern`. Throws when none match. */
function numbered(section: PageCopySection, pattern: RegExp): PageCopyItem[] {
  const found = (section.items ?? []).filter((item) => pattern.test(item.id));
  if (found.length === 0) {
    throw new Error(
      `as2Home: section "${section.id}" declares no item matching ${String(pattern)} — the band would render empty (have: ${(
        section.items ?? []
      )
        .map((item) => item.id)
        .join(", ")})`,
    );
  }
  return found;
}

/** A registry photograph, narrowed to the four fields `next/image` needs. */
function photograph(key: MediaKey): HomeImage {
  const entry = media[key];
  if (!("src" in entry)) {
    throw new Error(`as2Home: "${key}" is a generated default — this page needs the real file`);
  }
  return { src: entry.src, alt: entry.alt, width: entry.width, height: entry.height };
}

/**
 * The band's heading furniture, read once. The eyebrow is an item (`eyebrow-<section id>`), not a
 * section field — `zPageCopySection` carries a heading, a body and a cta, and a kicker above the
 * heading is a repeated string like any other, so it is resolved by id like one.
 */
function headOf(section: PageCopySection): HomeHead {
  if (section.heading === undefined) {
    throw new Error(`as2Home: section "${section.id}" has no heading — the band renders one`);
  }
  const eyebrow = (section.items ?? []).find((item) => item.id === `eyebrow-${section.id}`)?.label;
  return {
    ...(eyebrow === undefined ? {} : { eyebrow }),
    heading: section.heading,
    ...(section.body === undefined ? {} : { body: section.body }),
  };
}

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

/**
 * The seven roles the page draws, in paint order. `lib/brand-theme.ts` owns the resolver; this is
 * the list the *page* requires, which is a different question from what a brand happens to define.
 */
const SURFACE_ROLE_NAMES = ["paper", "mist", "sand", "line", "pale", "mark", "deep"] as const;

/**
 * The brand's surface roles, and a refusal when the brand names none.
 *
 * `brandSurfaceVars` emits only the roles a record defines, which is right for a shared resolver and
 * wrong here: this page's bands are `bg-mist`, `bg-sand` and `border-line`, and a brand that names
 * no such role leaves those utilities resolving to nothing — a white band with white text, on a
 * route that still renders and still builds. So the page asks for the seven it draws and throws on
 * a missing one. QuizHub names none of them, which is exactly why the AS2 page may not render under
 * it, and the throw is what says so at the point of composition instead of at the point of reading.
 */
function surfacePaint(brand: Brand): Record<string, string> {
  const vars = brandSurfaceVars(brand);
  const missing = SURFACE_ROLE_NAMES.filter((role) => vars[`--${role}`] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `as2Home: brand "${brand.name}" names no ${missing.join(", ")} — the AS2 page draws these surfaces and cannot render without them`,
    );
  }
  return vars;
}

/**
 * The AS2 home page, joined.
 *
 * `brand` is a parameter rather than a module import for the reason `alignmentHome` takes one: a
 * test can hand it either brand, and `lib/brand-theme.ts` is the one module that decides what a
 * record's colours become. `copy` is the AS2 fixture — a page that passed the wrong fixture would
 * fail on the first missing section, by name.
 */
export function as2Home(brand: Brand, copy: PageCopy): As2HomeModel {
  const navSection = sectionOf(copy, "section-nav");
  const howSection = sectionOf(copy, "how-it-works");
  const templatesSection = sectionOf(copy, "relationship-templates");
  const questionsSection = sectionOf(copy, "questions");
  const storiesSection = sectionOf(copy, "stories");
  const benefitsSection = sectionOf(copy, "benefits");
  const finalSection = sectionOf(copy, "final-cta");

  /**
   * The menu, and the promise it makes: every href it draws is a band this page emits. The
   * comparison is against the fixture's own section list, so a menu row added for an `id` no band
   * carries throws here instead of scrolling nowhere.
   */
  const sectionIds = new Set((copy.sections ?? []).map((section) => section.id));
  const navItems = (navSection.items ?? []).map((item) => {
    if (!sectionIds.has(item.id)) {
      throw new Error(
        `as2Home: the in-page menu names "#${item.id}", and no section carries that id (have: ${[...sectionIds].join(", ")})`,
      );
    }
    return anchorTo(item.label, item.id);
  });

  const hero: As2HomeModel["hero"] = {
    eyebrow: copy.eyebrow ?? "",
    heading: copy.heading,
    subtitle: copy.subtitle ?? "",
    /* The reference points this action at the **business group**, not at the templates band's top:
       the button says "Explore business templates", so it lands on the business half. */
    action: anchorTo(pageItemOf(copy, "hero-action").label, "business-relationships"),
    secondary: anchorTo(pageItemOf(copy, "hero-secondary").label, "how-it-works"),
    note: pageItemOf(copy, "hero-note").label,
    /* Business first, then personal — the order the reference draws and the order the page leads
       with (#904). The pair is a fixed two, not a list read from the fixture, so the ids here are
       the only place the order can be changed. */
    cards: [
      {
        id: "business",
        kicker: pageItemOf(copy, "life-business-kicker").label,
        title: pageItemOf(copy, "life-business-title").label,
        action: pageItemOf(copy, "life-business-action").label,
        name: pageItemOf(copy, "life-business-name").label,
        href: "#business-relationships",
        image: photograph("home.business-life"),
      },
      {
        id: "personal",
        kicker: pageItemOf(copy, "life-personal-kicker").label,
        title: pageItemOf(copy, "life-personal-title").label,
        action: pageItemOf(copy, "life-personal-action").label,
        name: pageItemOf(copy, "life-personal-name").label,
        href: "#personal-relationships",
        image: photograph("home.personal-life"),
      },
    ],
  };

  /**
   * The steps are numbered from their position, not from a number in the copy: a fixture that
   * carries `01` beside a `step-1` id has two answers to the same question, and reordering the
   * rows would renumber the ids and not the labels.
   */
  const steps: HomeStep[] = numbered(howSection, /^step-\d+$/).map((item, index) => ({
    id: item.id,
    number: String(index + 1).padStart(2, "0"),
    title: item.label,
    body: itemBody(howSection, item.id),
  }));

  /**
   * The template groups come from the taxonomy, not from the page: `purchasableTypesByGroup()` is
   * what the public catalogue and the dashboard library both read, so the front page cannot offer a
   * type the product does not sell, and a type added to `data/relationship-types.ts` appears here
   * with no copy edit. The words above each half are the fixture's.
   */
  const groupHeadings: Record<TypeGroup, string> = {
    Business: itemLabel(templatesSection, "templates-group-business"),
    Personal: itemLabel(templatesSection, "templates-group-personal"),
  };
  const groups: HomeTemplateGroup[] = purchasableTypesByGroup().map((entry) => ({
    group: entry.group,
    id: entry.group === "Business" ? "business-relationships" : "personal-relationships",
    heading: groupHeadings[entry.group],
    types: entry.types.map((type) => ({
      id: type.id,
      name: type.name,
      href: catalogueDetailPath(type.id),
    })),
  }));

  /** The model band's two cards, read from their `bread-` / `butter-` prefixes. */
  const modelLines = (prefix: string): HomeModelLine[] =>
    numbered(questionsSection, new RegExp(`^${prefix}-line-`)).map((item) => ({
      lead: item.label,
      body: itemBody(questionsSection, item.id),
    }));

  const cards: HomeModelCard[] = [
    {
      stepLabel: itemLabel(questionsSection, "bread-step"),
      step: "01",
      kicker: itemLabel(questionsSection, "bread-kicker"),
      title: itemLabel(questionsSection, "bread-title"),
      deck: itemLabel(questionsSection, "bread-deck"),
      lines: modelLines("bread"),
      listName: itemLabel(questionsSection, "bread-list-name"),
      image: photograph("home.relationship-gaps"),
      note: {
        lead: itemLabel(questionsSection, "bread-note-lead"),
        rest: itemLabel(questionsSection, "bread-note-rest"),
      },
    },
    {
      stepLabel: itemLabel(questionsSection, "butter-step"),
      step: "02",
      kicker: itemLabel(questionsSection, "butter-kicker"),
      title: itemLabel(questionsSection, "butter-title"),
      deck: itemLabel(questionsSection, "butter-deck"),
      lines: modelLines("butter"),
      listName: itemLabel(questionsSection, "butter-list-name"),
      image: photograph("home.opinions-scale"),
      scale: {
        name: itemLabel(questionsSection, "butter-scale-name"),
        yes: itemLabel(questionsSection, "butter-scale-yes"),
        no: itemLabel(questionsSection, "butter-scale-no"),
        middle: itemLabel(questionsSection, "butter-scale-middle"),
      },
    },
  ];

  /**
   * The story cards are found by their `story-<n>-title` rows, and each one then reads its own
   * quotes and support sentence. A card that carries a `-quote-alt` row renders two quotes and one
   * that does not renders one, which is the difference the approved page draws between the first
   * card and the other two.
   */
  const storyIds = (storiesSection.items ?? [])
    .map((item) => /^story-(\d+)-title$/.exec(item.id))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => match[1] ?? "");
  if (storyIds.length === 0) {
    throw new Error(
      `as2Home: section "stories" declares no "story-<n>-title" — the reflections band would render empty`,
    );
  }
  const stories: HomeStory[] = storyIds.map((n) => {
    /*
     * `quote-alt` is optional by design: two of the three cards carry a second quote and the first
     * carries one. Reading it with `itemOf` would throw on the card that legitimately has none, so
     * the lookup is over the fixture's rows rather than through the throwing reader.
     */
    const quotes = [`story-${n}-quote`, `story-${n}-quote-alt`]
      .map((id) => (storiesSection.items ?? []).find((item) => item.id === id)?.label)
      .filter((label): label is string => label !== undefined);
    return {
      id: n,
      title: itemLabel(storiesSection, `story-${n}-title`),
      quotes,
      support: itemLabel(storiesSection, `story-${n}-support`),
    };
  });

  const benefits: HomeBenefit[] = numbered(benefitsSection, /^benefit-\d+$/).map((item) => ({
    id: item.id,
    title: item.label,
    body: itemBody(benefitsSection, item.id),
  }));

  return {
    tokens: surfacePaint(brand),
    hero,
    nav: { name: pageItemOf(copy, "nav-name").label, items: navItems },
    howItWorks: {
      ...headOf(howSection),
      steps,
      startEyebrow: itemLabel(howSection, "how-start-eyebrow"),
      startBody: itemLabel(howSection, "how-start-body"),
      action: anchorTo(itemLabel(howSection, "how-action"), "relationship-templates"),
    },
    templates: {
      ...headOf(templatesSection),
      groups,
      action: anchorTo(itemLabel(templatesSection, "templates-action"), "business-relationships"),
      secondary: anchorTo(
        itemLabel(templatesSection, "templates-secondary"),
        "personal-relationships",
      ),
      note: itemLabel(templatesSection, "templates-note"),
      counselor: {
        lead: itemLabel(templatesSection, "templates-counselor-lead"),
        rest: itemLabel(templatesSection, "templates-counselor-rest"),
      },
    },
    model: { ...headOf(questionsSection), cards },
    stories: {
      ...headOf(storiesSection),
      cards: stories,
      prompts: {
        title: itemLabel(storiesSection, "prompts-title"),
        note: itemLabel(storiesSection, "prompts-note"),
        name: itemLabel(storiesSection, "prompts-name"),
        items: numbered(storiesSection, /^prompt-\d+$/).map((item) => item.label),
      },
      actionBody: itemLabel(storiesSection, "stories-action-body"),
      action: anchorTo(itemLabel(storiesSection, "stories-action"), "relationship-templates"),
    },
    benefits: {
      ...headOf(benefitsSection),
      items: benefits,
      action: anchorTo(itemLabel(benefitsSection, "benefits-action"), "relationship-templates"),
      callout: itemLabel(benefitsSection, "benefits-callout"),
    },
    finalCta: {
      heading: finalSection.heading ?? "",
      body: finalSection.body ?? "",
      /* "Explore business templates", so it lands on the business group — as the reference draws. */
      action: anchorTo(itemLabel(finalSection, "final-cta-action"), "business-relationships"),
    },
  };
}
