// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: the public directory page — a product list grouped by realm, each row a card with its own two actions, no curation tabs and no per-card progress, because the surface is a shop shelf rather than a feed)

import { TemplateCard } from "@/components/templates/template-card";
import type { TemplatesPageModel } from "@/lib/templates-page";
import Link from "next/link";

/**
 * `/templates` — the public Relationship Templates directory, drawn.
 *
 * Holds no words: every string arrives in the model (`lib/templates-page.ts`), which joins
 * `data/pages/templates.ts` with `data/relationship-types.ts`. E23 attributes this directory to
 * that fixture at a budget of 0, so a sentence typed here is a red build.
 *
 * **Two bands, and that is the whole page.** The hero names the page and offers the one action a
 * stranger can take; the catalogue is everything under it — the counted sentence, then every card
 * grouped by realm. The explainer bands this page used to carry (what a template is, what a
 * purchase buys, a closing sales band) are gone: the front page's `#templates` band is the pitch,
 * and a reader who arrives here already wants the list, so a second pitch between the hero and the
 * shelf only delays it.
 *
 * The catalogue is **grouped by realm** rather than one long grid because the taxonomy groups by
 * it (`REALMS`), and a reader looking for the pair they have in mind scans seven headings faster
 * than twenty-six cards. Each group is a `section` with its own `data-catalogue-realm`, so a
 * structural check can count what the page really rendered.
 *
 * No band reads a clock, a store or an env var: the page is a fixture render and the marketing
 * layout's chrome is the only request-time thing above it.
 */
export function TemplatesPageView({ model }: { model: TemplatesPageModel }) {
  return (
    <div className="bg-background">
      {/* The hero: the product's name, what it lists, and the one action a stranger can take. */}
      <section className="border-b border-border bg-muted/40" data-templates-hero="">
        <div className="mx-auto w-full max-w-6xl px-6 py-12 md:py-16">
          <div className="max-w-3xl">
            {model.hero.eyebrow && (
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-action">
                {model.hero.eyebrow}
              </p>
            )}
            <h1 className="mt-4 text-[2.5rem] font-extrabold leading-[1.07] tracking-[-0.02em] text-foreground md:text-5xl">
              {model.hero.heading}
            </h1>
            {model.hero.subtitle && (
              <p className="mt-5 text-[18px] leading-relaxed text-muted-foreground">
                {model.hero.subtitle}
              </p>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {model.hero.primary && (
                <Link
                  className="inline-flex w-full items-center justify-center rounded-lg bg-action px-6 py-3.5 text-[16px] font-bold text-action-foreground shadow-sm transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2 sm:w-auto"
                  href={model.hero.primary.href}
                >
                  {model.hero.primary.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* The directory: the counted sentence, then every template by realm. */}
      <section className="bg-background py-14 md:py-16" id="catalogue">
        <div className="mx-auto w-full max-w-6xl px-6">
          <BandHeading eyebrow={model.catalogue.eyebrow} heading={model.catalogue.heading} />
          {model.catalogue.body && (
            <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-muted-foreground">
              {model.catalogue.body}
            </p>
          )}
          <p
            className="mt-6 text-[14px] font-semibold tabular-nums text-foreground"
            data-catalogue-count=""
          >
            {model.catalogue.count}
          </p>
          <div className="mt-10 space-y-12">
            {model.catalogue.realms.map((group) => (
              <div data-catalogue-realm={group.realm} key={group.realm}>
                <h3 className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.realm}
                </h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.cards.map((card) => (
                    <TemplateCard card={card} key={card.id} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/** The eyebrow-and-heading pair the catalogue opens with. */
function BandHeading({ eyebrow, heading }: { eyebrow?: string; heading?: string }) {
  return (
    <>
      {eyebrow && (
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-action">{eyebrow}</p>
      )}
      {heading && (
        <h2 className="mt-3 max-w-3xl text-[26px] font-bold leading-[1.15] tracking-[-0.01em] text-foreground md:text-[32px]">
          {heading}
        </h2>
      )}
    </>
  );
}

/** Kept as a named export shape so a test can render the page without the router. */
export type { TemplatesPageModel };

export default TemplatesPageView;
