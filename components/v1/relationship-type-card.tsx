// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: one relationship-type card — name, the two roles, who it is for, Aspects and price, with a caller-owned action row; no media, no score, no shelf)

import { formatCurrency } from "@/content/core";
import type { RelationshipType } from "@/data/v1/relationship-types";
import type { ReactNode } from "react";

/**
 * One relationship-type card, drawn the same way on every surface that shows the catalogue.
 *
 * The card is deliberately **dumb**: it prints what the type *is* — the name, the two roles, who
 * it is for, how many Aspects it asks, the price — and renders whatever action row its caller
 * hands it. That is what makes "the same cards as the public `/v1/templates`" a shared component
 * instead of a copy: `TemplateCatalogue` passes `View` + `See an example`, and
 * `V1TemplateLibrary` passes `Start a relationship` + `View details` + the two secondary actions
 * that only an initiator or an admin may take.
 *
 * Nothing here reads the store, the persona or the clock, so a card renders identically on the
 * public marketing surface and inside the dashboard — which is the point of the boundary.
 */
export function RelationshipTypeCard({
  type,
  actions,
  headingLevel = 3,
}: {
  readonly type: RelationshipType;
  /** The action row the caller owns — the whole of the capability difference between surfaces. */
  readonly actions: ReactNode;
  /** The card's title tag: `3` on a page with a group heading, `2` when the card is the group. */
  readonly headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <article className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-action">
      <Heading className="text-sm font-semibold text-foreground">{type.name}</Heading>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {type.roles.initiator} · {type.roles.counterparty}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {type.descriptor.whoItsFor}
      </p>

      <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <dt>Aspects</dt>
          <dd className="text-foreground">{type.aspects.length}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Price</dt>
          <dd className="text-foreground">{formatCurrency(type.price)}</dd>
        </div>
      </dl>

      <div className="mt-auto pt-4">{actions}</div>
    </article>
  );
}
