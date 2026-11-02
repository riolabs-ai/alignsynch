// template-ancestor: components/explore/explore-quiz-list.tsx (variation: relationship types grouped by realm, no media, no pagination)
import {
  RELATIONSHIP_PRICE_CENTS,
  demoAnswersFor,
  purchasableTypesByRealm,
} from "@/data/v1/relationship-types";
import { formatCurrency } from "@/content/core";
import { SectionIntro } from "@/components/v1/v1-ui";
import Link from "next/link";

/**
 * `/v1/templates` — the catalogue of relationship types, grouped by realm.
 *
 * The grid classes are the explore list's, copied verbatim (`sm:` is 576px in this tree), so a
 * type card reads the same way a quiz card does: one column on a phone, two or three as the
 * viewport widens. The catalogue groups from data — `realm` is a real field on every record,
 * and `purchasableTypesByRealm()` is the one grouping the shop's type picker reads too — so a
 * type lands in its realm without any authored shelf. Each card says what a person deciding
 * needs to know — the name, the two roles, who it is for, how many Aspects it asks, the
 * price — and offers `View` (the template page) and, when a demo exists, `See an example`.
 * No social proof, no star scores, no claim of who uses it: the catalogue is the product,
 * shown plainly. A dating type never appears here — the gate excludes it before grouping.
 */
export function TemplateCatalogue() {
  const groups = purchasableTypesByRealm();

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <SectionIntro
        title="Relationship types"
        subtitle="Every way two people can sit down together, grouped by where the relationship lives. Pick one to see what it asks, or look at a finished example first."
      />

      {groups.map((group) => (
        <section key={group.realm} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.realm}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 min-[900px]:grid-cols-2 xxl:grid-cols-3">
            {group.types.map((type) => (
              <article
                key={type.id}
                className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-action"
              >
                <p className="text-sm font-semibold text-foreground">{type.name}</p>
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

                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/v1/templates/${type.id}`}
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
                  >
                    View
                  </Link>
                  {demoAnswersFor(type.id) === undefined ? null : (
                    <Link
                      href={`/v1/templates/${type.id}/demo`}
                      className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      See an example
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-muted-foreground">
        One relationship costs {formatCurrency(RELATIONSHIP_PRICE_CENTS)}. The other person joins by
        link and pays nothing.
      </p>
    </div>
  );
}
