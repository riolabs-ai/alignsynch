/**
 * `data/template-categories.ts` — the Library's shelf grouping (bundle 06).
 *
 * **The Library is filterable by five categories, and the category is not on the record.** A
 * template row (`record`) carries a slug, a title, a summary and its Aspects; the shelf it is filed
 * under belongs to the **relationship type** the template is derived from (`data/relationship-types.ts`),
 * which is the taxonomy the product already sells and the only place a type's identity lives. So this
 * module is a lookup from a template's slug to the category of the type it names, not a new column on
 * anything: no migration, no record field, and a re-filing is one line here.
 *
 * **The five names are bundle 06's**, and they are the Library's own grouping — not `REALMS`, which
 * is the catalogue's seven (Office, Business, Property, School, Medical, Home, Social). The two are
 * different questions asked of the same rows: a realm says what *world* a relationship lives in, and a
 * Library category says which shelf a person browsing templates would look on. Where they disagree,
 * the type's own name decides — `parent-teacher` is a School realm and a Family shelf, because the
 * person looking for it is a parent, not a teacher.
 *
 * **Every purchasable type carries a category, and a test says so.** `templates-categories.test.ts`
 * walks `relationshipTypes` and fails on a type with no row, so a 30th type cannot land uncategorised
 * and silently disappear from every filter. The three `purchasable: false` dating types are filed too:
 * they are excluded from the catalogue today, and a filter that counted them would be counting rows
 * nobody can open.
 *
 * **No React, no `lib/db`.** `tsconfig.datacheck.json` compiles this file with the rest of `data/`
 * (relative imports only, `commonjs`), and the page imports it on the server.
 */

/** The Library's five shelves, in the order the filter row draws them. */
export const TEMPLATE_CATEGORIES = ["family", "couples", "friends", "work", "home"] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/**
 * One shelf per relationship type, by the type's id — which is the template's slug.
 *
 * The right-hand column is the judgement, and it is editable: filing `hoa-board-owner` under `home`
 * rather than `work` is a product call this table states in one place instead of in a component.
 */
const CATEGORY_BY_TYPE: Readonly<Record<string, TemplateCategory>> = {
  /* Work — an employment, business or institutional role pair. */
  "staff-manager": "work",
  colleagues: "work",
  "business-partners": "work",
  "project-manager-member": "work",
  team: "work",
  "customer-vendor-product": "work",
  "customer-vendor-services": "work",
  "investor-entrepreneur": "work",
  "co-founders": "work",
  /** A School realm, filed with Work: the pair is an institutional role, not a household. */
  "teacher-student": "work",

  /* Home — people who share a dwelling, a building or a table. */
  "hoa-board-owner": "home",

  /* Family — a kinship, by blood, marriage, care or a child's schooling. */
  "parent-child": "family",
  "father-son": "family",
  "father-daughter": "family",
  "mother-son": "family",
  "mother-daughter": "family",
  siblings: "family",
  "brother-sister": "family",
  sisters: "family",
  brothers: "family",
  "parent-teacher": "family",
  /** A Medical realm, filed with Family: a caregiver is usually kin, and this is who looks for it. */
  "patient-caregiver": "family",

  /* Friends — chosen company, with no household and no contract. */
  friends: "friends",
  "guy-friends": "friends",
  "gal-friends": "friends",
  "guy-friend-gal-friend": "friends",

  /* Couples — the romantic set, including the married pair. Filed, and not sold:
     `purchasable: false` keeps the dating types out of the library. */
  spouses: "couples",
  "girlfriend-boyfriend": "couples",
  dating: "couples",
  "committed-significant-others": "couples",
};

/**
 * The category of the template with this slug, or `null` for a template no type names.
 *
 * `null` is a real answer: `relationship-basics` and `blank-template` are hand-authored templates the
 * taxonomy does not carry, and a member's own copy carries whatever slug they were given. The shelf
 * draws no category chip for those rather than filing them under a shelf nobody chose.
 */
export function templateCategoryOf(slug: string): TemplateCategory | null {
  return CATEGORY_BY_TYPE[slug] ?? null;
}

/** Every filed type id, for the test that holds this table equal to the taxonomy. */
export const FILED_TEMPLATE_SLUGS: readonly string[] = Object.keys(CATEGORY_BY_TYPE);

/**
 * The template the Library's featured band draws.
 *
 * Curated on purpose: "featured" is an editorial pick, and a band that showed whichever row the read
 * happened to return first would change when a template was published. One slug, changed by editing
 * this line — the page falls back to the first card when the row is absent, so an unpublished pick
 * cannot leave the band empty.
 */
export const FEATURED_TEMPLATE_SLUG = "brother-sister";
