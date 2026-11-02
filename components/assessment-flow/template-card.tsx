/**
 * template-ancestor: components/v1/relationship-type-card.tsx   (variation: one Postgres template record per card, the type resolved from the catalogue by slug, and the action row supplied by the surface)
 *
 * The assessment catalogue's one card, and the grid that draws it (#409).
 *
 * `components/v1/relationship-type-card.tsx` is the v1 prototype's shared card: the public
 * catalogue (`/v1/templates`) and the dashboard library (`/v1/[persona]/templates`) both draw it,
 * and the only difference between the two is the action row the surface owns. This module is the
 * same decision for the app's two catalogue surfaces — `/assessment` (pick a template, then create
 * an instance from it) and `/assessment/templates` (open, duplicate, archive) — so a card looks the
 * same wherever a person meets a template, and neither surface re-implements one.
 *
 * **Why this file reads no page copy.** E23 attributes every component a route renders to that
 * route's fixture, so a module shared by three routes may not look a section up by id: the id it
 * asked for would have to exist in all three fixtures, and a shared card that declares the union
 * of three vocabularies is a card arguing with itself. Every string arrives as a
 * `CatalogueCardCopy` the surface resolved from **its own** fixture, which is also what lets the
 * picker say "Create and invite" where the library says "Duplicate" without the card knowing
 * either word.
 *
 * **The group is a field, never a guess.** `data/v1/relationship-types.ts` authors the catalogue
 * with a `realm` on every record and the v1 library's own `Business · Personal` projection
 * (`REALM_GROUP`). A template record carries no realm — its `slug` is the type it is a template
 * of, and `relationshipType(slug)` resolves it. The platform's starter template
 * (`relationship-basics`), the blank draft and everything an account wrote resolve to no type, and
 * those are drawn in the third group with the card saying, in words, that no type is named:
 * inferring `Business` from a title would be the card inventing a fact about somebody's template.
 *
 * **A card states the record's own facts.** The title, the summary, `count(item)` for the Aspect
 * count, and the type/realm/roles the catalogue authors. No price, because this read holds no
 * price and nothing has been paid; no people, because a template is a template and names are
 * instance facts; no rating and no "N people use this", because nothing here measures one.
 */
import { REALM_GROUP, relationshipType, type RelationshipType } from "@/data/v1/relationship-types";
import { templateDetailPath } from "@/lib/flow/paths";
import type { ReactNode } from "react";

const SHELL = "rounded-lg border border-border bg-card p-5";
const CHIP = "rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground";
const MUTED = "text-sm text-muted-foreground";
const PRIMARY =
  "inline-flex h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90";

/**
 * The narrow shape both reads satisfy: `TemplateSummary` (`lib/flow/store.ts`) and
 * `LibraryTemplate` (`lib/flow/template-library.ts`). A card draws only these four facts, so it
 * cannot start reading an authorship or a status that one of the two reads does not carry.
 */
export interface CatalogueTemplate {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly aspectCount: number;
}

/** The three groups, in the order they are drawn — the v1 library's two, then the rest. */
export const TEMPLATE_GROUPS = ["business", "personal", "other"] as const;

export type TemplateGroupId = (typeof TEMPLATE_GROUPS)[number];

/** One group and the templates in it, in the order the read returned them. */
export interface TemplateGroup<T extends CatalogueTemplate> {
  readonly id: TemplateGroupId;
  readonly templates: readonly T[];
}

/**
 * Every word this module draws, resolved by the surface from its own fixture.
 *
 * `rolesOf` and `aspectsOf` are functions rather than strings because both are per template —
 * `{initiator} / {counterparty}` and `{count} Aspects` are filled with the record's own values,
 * and `fillLabel` belongs on the surface that owns the id.
 */
export interface CatalogueCardCopy {
  readonly viewDetails: string;
  readonly typeLabel: string;
  readonly realmLabel: string;
  readonly unnamedType: string;
  readonly unnamedRealm: string;
  readonly rolesOf: (type: RelationshipType) => string;
  readonly aspectsOf: (count: number) => string;
}

/** The catalogue record a slug names, or `undefined` — the one lookup the grouping does. */
export function relationshipTypeOf(slug: string): RelationshipType | undefined {
  return relationshipType(slug);
}

/** Which group a template is drawn in. No type named means `other`, never a default realm. */
export function templateGroupOf(slug: string): TemplateGroupId {
  const type = relationshipTypeOf(slug);
  if (type === undefined) return "other";
  return REALM_GROUP[type.realm] === "Business" ? "business" : "personal";
}

/**
 * The templates grouped, empty groups dropped.
 *
 * Dropping matters: a heading over no card is the "Gap of 0 about a question nobody asked" defect
 * one level up — an account with only its own template must not be shown two empty `Business` and
 * `Personal` shelves.
 */
export function templateGroupsOf<T extends CatalogueTemplate>(
  templates: readonly T[],
): readonly TemplateGroup<T>[] {
  return TEMPLATE_GROUPS.map((id) => ({
    id,
    templates: templates.filter((template) => templateGroupOf(template.slug) === id),
  })).filter((group) => group.templates.length > 0);
}

/** One template, as a card: the title, the summary, its type, its Aspects, and its own actions. */
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
      className={SHELL}
    >
      <h3 className="text-base font-semibold text-foreground">{template.title}</h3>
      <p className={`mt-1 ${MUTED}`}>{template.summary}</p>

      <dl className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{copy.typeLabel}</dt>
          <dd className={CHIP} data-template-card-type={type?.id ?? "none"}>
            {type === undefined ? copy.unnamedType : type.shortName}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">{copy.realmLabel}</dt>
          <dd className={CHIP} data-template-card-realm={type?.realm ?? "none"}>
            {type === undefined ? copy.unnamedRealm : type.realm}
          </dd>
        </div>
        {type === undefined ? null : (
          <dd className={CHIP} data-template-card-roles="true">
            {copy.rolesOf(type)}
          </dd>
        )}
        <dd className={CHIP}>{copy.aspectsOf(template.aspectCount)}</dd>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a className={PRIMARY} href={templateDetailPath(template.id)}>
          {copy.viewDetails}
        </a>
        {actions}
      </div>
    </article>
  );
}

/**
 * A catalogue: one section per group, with its heading and a grid of cards.
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {groupLabelOf(group.id)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
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
