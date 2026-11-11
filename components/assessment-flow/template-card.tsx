/**
 * template-ancestor: components/explore/explore-quiz-list.tsx   (variation: one Postgres template record per card, the type — realm, roles, price, demo — resolved from the catalogue by slug, and the action row supplied by the surface)
 *
 * The assessment catalogue's one card, and the grid that draws it (#409, catalogue essentials).
 *
 * `components/v1/relationship-type-card.tsx` is the v1 prototype's shared card: the public
 * catalogue (`/v1/templates`) and the dashboard library (`/v1/[persona]/templates`) both draw it,
 * and the only difference between the two is the action row the surface owns. This module is the
 * same decision for the app's two catalogue surfaces — `/assessment` (pick a template, then create
 * an instance from it) and `/templates/relationship` (the catalogue: open, use, duplicate, archive) —
 * so a card looks the same wherever a person meets a template, and neither surface re-implements
 * one.
 *
 * **Why this file reads no page copy.** E23 attributes every component a route renders to that
 * route's fixture, so a module shared by three routes may not look a section up by id: the id it
 * asked for would have to exist in all three fixtures, and a shared card that declares the union
 * of three vocabularies is a card arguing with itself. Every string arrives as a
 * `CatalogueCardCopy` the surface resolved from **its own** fixture, which is also what lets the
 * picker say "Create and invite" where the catalogue says "Duplicate" without the card knowing
 * either word.
 *
 * **The group is a field, never a guess.** `data/relationship-types.ts` authors the catalogue
 * with a `realm` on every record. A template record carries no realm — its `slug` is the type it
 * is a template of, and `relationshipType(slug)` resolves it — so the card is drawn under its
 * realm, in the taxonomy's own order (`REALMS`). The platform's starter template
 * (`relationship-basics`), the blank draft and everything an account wrote resolve to no type, and
 * those are drawn in the last group with the card saying, in words, that no type is named:
 * inferring `Office` from a title would be the card inventing a fact about somebody's template.
 *
 * **A card states the record's own facts, and one price that is the plan's.** The title, the
 * summary, `count(item)` for the Aspect count, and the type/realm/roles/price the catalogue
 * authors. The price is not per relationship: `RELATIONSHIP_PRICE_CENTS` ($9.99) predates the
 * pricing rewrite, which sells Basic at $8.95/month with unlimited relationships, so a card
 * charging $9.99 beside a plan page selling $8.95 would be two price models in one product. The
 * card therefore prints **one month of Basic** — `CATALOGUE_PRICE_CENTS`, read from the pricing
 * fixture — which is what using any type here actually costs. No people, no rating and no "N
 * people use this": nothing here measures one.
 */
import type { PublishStatus } from "@/content/core";
import { Chip } from "@/components/ui/badge";
import { billingPlan } from "@/data/billing-plans";
import type { BillingPlan } from "@/data/billing-plans";
import {
  REALMS,
  demoAnswersFor,
  relationshipType,
  type Realm,
  type RelationshipType,
} from "@/data/relationship-types";
import {
  assessmentDemoPath,
  createRelationshipPath,
  relationshipTemplatePath,
} from "@/lib/flow/paths";
import type { ReactNode } from "react";

/**
 * The card's shell — a column that fills the grid cell, so one long summary cannot leave its
 * neighbours' action rows floating halfway up the row. The actions sit on `mt-auto` below.
 */
const SHELL = "flex h-full flex-col rounded-lg border border-border bg-card p-5";
const MUTED = "text-sm text-muted-foreground";
const PRIMARY =
  "inline-flex h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover";
const SECONDARY =
  "inline-flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-muted";

/**
 * The plan that includes every catalogue type, and so the one price a card prints.
 *
 * `basic` cannot be missing — `billingPlanProblems()` in `data/billing-plans.ts` fails on a
 * fixture that loses a tier — and a lookup that resolved to nothing here would be a card printing
 * an invented `$0.00`, so this throws rather than guessing.
 */
const CATALOGUE_PLAN: BillingPlan = (() => {
  const plan = billingPlan("basic");
  if (plan === undefined) {
    throw new Error('data/billing-plans.ts has no "basic" plan to price the catalogue from');
  }
  return plan;
})();

/**
 * What one catalogue card costs per month, in integer cents: Basic's monthly price.
 *
 * One constant with one home (`data/billing-plans.ts`), so the catalogue and `/pricing` cannot
 * disagree. `billingPlans` is read above rather than a literal here, and a price literal in this
 * file is the defect `tests/billing-plans.test.ts` already refuses under `components/pricing/`.
 */
export const CATALOGUE_PRICE_CENTS: number = CATALOGUE_PLAN.monthlyCents;

/**
 * The narrow shape both reads satisfy: `TemplateSummary` (`lib/flow/store.ts`) and
 * `LibraryTemplate` (`lib/flow/template-library.ts`). A card draws only these four facts, so it
 * cannot start reading an authorship or an instance count that one of the two reads does not
 * carry.
 *
 * `status` is optional for the same reason `TemplateSummary` does not have one: the picker only
 * ever lists published templates, while the library also draws archived rows — and a card cannot
 * offer "Use this template" on a record the store will refuse to copy. Absent means "the surface
 * has already promised this can be created".
 */
export interface CatalogueTemplate {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly aspectCount: number;
  readonly status?: PublishStatus;
}

/** The seven realms, in the taxonomy's order, then the one group for templates naming no type. */
export const TEMPLATE_GROUPS = [...REALMS, "other"] as const;

export type TemplateGroupId = Realm | "other";

/** One group and the templates in it, in the order the read returned them. */
export interface TemplateGroup<T extends CatalogueTemplate> {
  readonly id: TemplateGroupId;
  readonly templates: readonly T[];
}

/**
 * Every word this module draws, resolved by the surface from its own fixture.
 *
 * `rolesOf`, `aspectsOf` and `priceOf` are functions rather than strings because all three are per
 * template — `{initiator} / {counterparty}`, `{count} Aspects` and `{price}/mo` are filled with
 * the record's own values, and `fillLabel` belongs on the surface that owns the id.
 */
export interface CatalogueCardCopy {
  readonly viewDetails: string;
  readonly unnamedType: string;
  readonly rolesOf: (type: RelationshipType) => string;
  readonly aspectsOf: (count: number) => string;
  /** What the price chip means, for a screen reader: `Included in`. */
  readonly priceLabel: string;
  /**
   * `{plan} · {price}/mo` — the plan's own name and Basic's monthly price, so the visible chip
   * says which plan the catalogue is included in rather than a bare figure beside nine cards.
   */
  readonly priceOf: (plan: string, cents: number) => string;
  /** The card's primary action: start an instance from this template. */
  readonly useTemplate: string;
  /** The exemplar link, drawn only where a finished sheet exists. */
  readonly seeExample: string;
}

/** The catalogue record a slug names, or `undefined` — the one lookup the grouping does. */
export function relationshipTypeOf(slug: string): RelationshipType | undefined {
  return relationshipType(slug);
}

/** Which group a template is drawn in. No type named means `other`, never a default realm. */
export function templateGroupOf(slug: string): TemplateGroupId {
  const type = relationshipTypeOf(slug);
  if (type === undefined) return "other";
  return type.realm;
}

/**
 * The templates grouped by realm, empty groups dropped.
 *
 * Dropping matters: a heading over no card is the "Gap of 0 about a question nobody asked" defect
 * one level up — an account with only its own template must not be shown seven empty realm
 * shelves.
 */
export function templateGroupsOf<T extends CatalogueTemplate>(
  templates: readonly T[],
): readonly TemplateGroup<T>[] {
  return TEMPLATE_GROUPS.map((id) => ({
    id,
    templates: templates.filter((template) => templateGroupOf(template.slug) === id),
  })).filter((group) => group.templates.length > 0);
}

/**
 * The catalogue with one realm's cards, or every card when no realm is named.
 *
 * A pure function over the list the page already read: the filter is a URL (`?realm=Home`), so
 * every state of the catalogue is a page a `curl` can ask for and there is no client bundle
 * holding 27 cards in memory.
 */
export function templatesInRealm<T extends CatalogueTemplate>(
  templates: readonly T[],
  realm: TemplateGroupId | null,
): readonly T[] {
  if (realm === null) return templates;
  return templates.filter((template) => templateGroupOf(template.slug) === realm);
}

/** The realm a query parameter names, or `null` for every realm. */
export function parseRealmFilter(value: string | undefined): TemplateGroupId | null {
  return TEMPLATE_GROUPS.find((id) => id === value) ?? null;
}

/** How many of the list's cards sit in each group — the filter row's counts, from the list. */
export function groupCountsOf<T extends CatalogueTemplate>(
  templates: readonly T[],
): readonly { readonly id: TemplateGroupId; readonly count: number }[] {
  return TEMPLATE_GROUPS.map((id) => ({
    id,
    count: templates.filter((template) => templateGroupOf(template.slug) === id).length,
  })).filter((entry) => entry.count > 0);
}

/** Whether a card may offer "Use this template": a published record, or a surface that promised it. */
function createable(template: CatalogueTemplate): boolean {
  return template.status === undefined || template.status === "published";
}

/**
 * One template, as a card: the title, the summary, its type, its realm, its roles, its Aspects,
 * the plan's price, and its own actions.
 */
export function TemplateCard<T extends CatalogueTemplate>({
  copy,
  template,
  actions,
}: {
  copy: CatalogueCardCopy;
  template: T;
  /** The surface's own controls — the picker's create form, the library's row actions. */
  actions?: ReactNode;
}) {
  const type = relationshipTypeOf(template.slug);

  return (
    <article
      data-template-card={template.id}
      data-template-group={templateGroupOf(template.slug)}
      data-template-card-type={type?.id ?? "none"}
      data-template-card-realm={type?.realm ?? "none"}
      className={SHELL}
    >
      <h3 className="text-base font-semibold text-foreground">{template.title}</h3>
      <p className={`mt-1 ${MUTED}`}>{template.summary}</p>

      {/*
       * The chips a realm heading has not already said.
       *
       * A card sits under its realm's heading, so a `Office` chip on every card in the Office
       * group is the same fact twice (and the `shortName` chip is the title again on every
       * derived record). What is left is the three things the heading cannot say: who the two
       * parties are, how many Aspects it asks, and what it costs. The realm and the type stay on
       * the article as `data-` attributes, so the grouping is still machine-readable from a card.
       */}
      <dl className="mt-3 flex flex-wrap items-center gap-2">
        {type === undefined ? (
          <Chip as="dd" variant="neutral" data-template-card-unnamed="true">
            {copy.unnamedType}
          </Chip>
        ) : (
          <Chip as="dd" variant="neutral" data-template-card-roles="true">
            {copy.rolesOf(type)}
          </Chip>
        )}
        <Chip as="dd" variant="neutral" data-template-card-aspects={template.aspectCount}>
          {copy.aspectsOf(template.aspectCount)}
        </Chip>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{copy.priceLabel}</dt>
          {/*
           * One price per card, and it is the plan's: no type is sold on its own. The plan's name
           * is in the visible chip, because "$8.95/mo" alone beside nine cards reads as nine
           * subscriptions.
           */}
          <Chip as="dd" variant="neutral" data-template-card-price={CATALOGUE_PRICE_CENTS}>
            {copy.priceOf(CATALOGUE_PLAN.name, CATALOGUE_PRICE_CENTS)}
          </Chip>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
        {createable(template) ? (
          <a className={PRIMARY} href={createRelationshipPath(template.slug)}>
            {copy.useTemplate}
          </a>
        ) : null}
        <a className={SECONDARY} href={relationshipTemplatePath(template.slug)}>
          {copy.viewDetails}
        </a>
        {type !== undefined && demoAnswersFor(type.id) !== undefined ? (
          <a className={SECONDARY} href={assessmentDemoPath(type.id)}>
            {copy.seeExample}
          </a>
        ) : null}
        {actions}
      </div>
    </article>
  );
}

/**
 * A catalogue: one section per realm, with its heading and a grid of cards.
 *
 * `groupLabelOf` rather than a copy section, for the reason the module comment gives: the heading's
 * words are the surface's, and the group id is this module's.
 */
export function TemplateCatalogueGrid<T extends CatalogueTemplate>({
  copy,
  groups,
  groupLabelOf,
  actionsOf,
}: {
  copy: CatalogueCardCopy;
  groups: readonly TemplateGroup<T>[];
  groupLabelOf: (id: TemplateGroupId) => string;
  actionsOf?: (template: T) => ReactNode;
}) {
  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.id} data-template-group-section={group.id} className="space-y-3">
          {/*
           * The heading is the realm's own word, at heading weight, with its count beside it —
           * `Home 10` tells a person what the shelf holds before they read a single card, and it
           * is the same number the filter row offers above.
           */}
          <h2 className="flex items-baseline gap-2 border-b border-border pb-2 text-lg font-semibold text-foreground">
            {groupLabelOf(group.id)}
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              data-template-group-count={group.templates.length}
            >
              {group.templates.length}
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.templates.map((template) => (
              <TemplateCard
                key={template.id}
                copy={copy}
                template={template}
                {...(actionsOf === undefined ? {} : { actions: actionsOf(template) })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
