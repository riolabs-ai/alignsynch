// template-ancestor: components/explore/explore-quiz-list.tsx (variation: relationship types, no media, no pagination)
import { RELATIONSHIP_PRICE_CENTS, relationshipTypes } from "@/data/v1/relationship-types";
import { formatCurrency } from "@/content/core";
import { SectionIntro } from "@/components/v1/v1-ui";
import Link from "next/link";

/**
 * `/v1/templates` — the catalogue of relationship types, one card each.
 *
 * The grid classes are the explore list's, copied verbatim (`sm:` is 576px in this tree), so a
 * type card reads the same way a quiz card does: one column on a phone, two or three as the
 * viewport widens. Each card says what a person deciding needs to know — the name, who it is
 * for, how many Aspects it asks, the price — and offers the two actions the owner asked for:
 * `View` (the template page) and `See an example` (the demo report). No social proof, no
 * star scores, no claim of who uses it: the catalogue is the product, shown plainly.
 */
export function TemplateCatalogue() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Relationship types"
        subtitle="Six ways two people can sit down together. Pick one to see what it asks, or look at a finished example first."
      />

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 min-[900px]:grid-cols-2 xxl:grid-cols-3">
        {relationshipTypes.map((type) => (
          <article
            key={type.id}
            className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-action"
          >
            <p className="text-sm font-semibold text-foreground">{type.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{type.whoItsFor}</p>

            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Aspects</dt>
                <dd className="text-foreground">{type.aspects.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Price</dt>
                <dd className="text-foreground">{formatCurrency(RELATIONSHIP_PRICE_CENTS)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              <Link
                href={`/v1/templates/${type.id}`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
              >
                View
              </Link>
              <Link
                href={`/v1/templates/${type.id}/demo`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                See an example
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        One relationship costs {formatCurrency(RELATIONSHIP_PRICE_CENTS)}. The other person joins by
        link and pays nothing.
      </p>
    </div>
  );
}
