import type { PageCopy, PageCopyLink, PageCopySection } from "@/content/pages";
import { itemBody, sectionBody, sectionOf } from "@/lib/page-copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import type React from "react";

/**
 * `/welcome`, drawn — the public landing page (issue #159).
 *
 * Seven bands in the order the issue gives them: the hero (the page's own heading, subtitle and
 * CTA), then the six in `data/pages/marketing.ts::sections` — two domains, how it works, the four
 * opinions, what a Gap is, two limits, the closing CTA. Every word arrives from that fixture
 * through `sectionOf`/`itemBody`, and this file holds neither a sentence nor a colour: E23 holds
 * `components/marketing/**` at zero leaf literals, and the palette is the theme's.
 *
 * **What it composes** (`docs/UI-DIVERGENCE.md`, this file's row). The verdict is *"wrap
 * `components/ui/card.tsx` — the boxes are cards, and `border-slate-200` is not the `--border`
 * token, so the warm-edge decision in `app/globals.css` never reaches this page; the two CTAs are
 * `components/ui/button.tsx`"*. So:
 *
 *   the eleven boxes  `components/ui/card.tsx`. Nine solid ones are `Card`; the two limits keep
 *                     their dashed edge as `Card className="border-dashed …"`, which is a
 *                     configuration of the card rather than a second box. `bg-card` is the token
 *                     `bg-white` stood in for, and the border is `--border`.
 *   the two CTAs      `components/ui/button.tsx` through `asChild`, so the anchor is still the
 *                     anchor and the fill is the button's. The closing band's light-on-brand
 *                     variant is a token override, not a second button.
 *   the three chips   `components/ui/badge.tsx`. The opinions chip was the scope's one arbitrary
 *                     value (`text-[0.65rem]`, invented to fit a four-column grid); as a `Badge`
 *                     it is `text-xs`, the same chip the domains band already drew.
 *
 * The one deliberate difference kept in the boxes: the limits band's dashed border says "this is
 * not a promise", so it survives as `border-dashed` on the card. Flattening it to a solid card
 * would change what the band means, which is a product decision, not a composition one.
 *
 * **Why classes and not inline brand styles.** `lib/brand-theme.ts` paints a brand's colours onto
 * `<html>` as `H S% L%` triples and `tailwind.config.ts` resolves `bg-primary` / `text-accent`
 * through them, so the class is already the brand's blue in the AlignSynch build and the template's
 * ink in the QuizHub one. Inlining `style={{ color: brand.colors.primary }}` would also work — it is
 * what the product's own surfaces do — but it writes the resolved value into the HTML, and a
 * marketing page whose markup carries `hsl(0 0% 9%)` fails the card's own "zero percentage signs"
 * grep on a token rather than on a claim. Tokens keep the claim measurable, and they leave this
 * file without a brand import it does not need.
 *
 * Why the mode is read from the copy and not computed here: a "Basic"/"Advanced" chip is the
 * `value` of the opinion item, and the fixture states it beside the opinion's name. The view
 * renders the pair it is given and never decides which opinions a mode holds — that rule lives in
 * `content/assessment.ts` (`BASIC_OPINION_KINDS`, `ADVANCED_OPINION_KINDS`), and the band's
 * paragraph is the one place it is said in prose.
 *
 * No state, no effect, no clock: the prerendered markup is the whole screen, so the built HTML is
 * what a grep and a screenshot see.
 */
export function MarketingLanding({ copy }: { copy: PageCopy }) {
  const domains = sectionOf(copy, "domains");
  const howItWorks = sectionOf(copy, "how-it-works");
  const opinions = sectionOf(copy, "opinions");
  const gap = sectionOf(copy, "gap");
  const limits = sectionOf(copy, "limits");
  const closing = sectionOf(copy, "cta");

  return (
    <main>
      {/* Band 1 — the hero. */}
      <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-20 md:pt-24 md:pb-28">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-primary md:text-5xl xl:text-6xl">
            {copy.heading}
          </h1>
          {copy.subtitle ? (
            <p className="text-lg leading-relaxed text-foreground md:text-xl">{copy.subtitle}</p>
          ) : null}
          {copy.cta ? (
            <div className="pt-2">
              <Action link={copy.cta} />
            </div>
          ) : null}
        </div>
      </section>

      {/* Band 2 — the two domains: Align the business life, Synch the personal one. */}
      <Band section={domains}>
        <div className="grid gap-5 md:grid-cols-2">
          {domains.items?.map((item) => (
            <Card className="p-6" key={item.id}>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-primary">{item.label}</h3>
                {item.value ? <Chip>{item.value}</Chip> : null}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {itemBody(domains, item.id)}
              </p>
            </Card>
          ))}
        </div>
      </Band>

      {/* Band 3 — the three beats of the flow the app implements. */}
      <Band section={howItWorks} tinted>
        <ol className="grid gap-5 md:grid-cols-3">
          {howItWorks.items?.map((item, index) => (
            <li key={item.id}>
              <Card className="h-full p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground tabular-nums">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {itemBody(howItWorks, item.id)}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </Band>

      {/* Band 4 — the four opinions, with each one's mode stated beside its name. */}
      <Band section={opinions}>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {opinions.items?.map((item) => (
            <Card className="p-6" key={item.id}>
              <div className="flex items-center gap-2">
                <dt className="text-lg font-semibold text-primary">{item.label}</dt>
                {item.value ? <Chip>{item.value}</Chip> : null}
              </div>
              <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {itemBody(opinions, item.id)}
              </dd>
            </Card>
          ))}
        </dl>
      </Band>

      {/* Band 5 — what a Gap is, in one paragraph. */}
      <section className="border-y border-slate-200 bg-slate-50" id={gap.id}>
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="max-w-3xl space-y-4 border-l-4 border-accent pl-6">
            <h2 className="text-2xl font-semibold tracking-tight text-primary md:text-3xl">
              {gap.heading}
            </h2>
            <p className="text-base leading-relaxed text-foreground md:text-lg">
              {sectionBody(gap)}
            </p>
          </div>
        </div>
      </section>

      {/* Band 6 — the two honest limits. */}
      <Band section={limits}>
        <ul className="grid gap-5 md:grid-cols-2">
          {limits.items?.map((item) => (
            <li key={item.id}>
              <Card className="h-full border-dashed bg-transparent p-6 shadow-none">
                <h3 className="text-base font-semibold text-foreground">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {itemBody(limits, item.id)}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Band>

      {/* Band 7 — the one action, repeated. */}
      <section className="mt-4 bg-primary text-primary-foreground" id={closing.id}>
        <div className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {closing.heading}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed opacity-90">
            {sectionBody(closing)}
          </p>
          {closing.cta ? (
            <div className="mt-8">
              <Action inverted link={closing.cta} />
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

/** A headed band with a body paragraph — the shape six of the seven bands share. */
function Band({
  children,
  section,
  tinted,
}: {
  children: React.ReactNode;
  section: PageCopySection;
  tinted?: boolean;
}) {
  return (
    <section
      className={`border-t border-slate-200 ${tinted ? "bg-slate-50" : "bg-white"}`}
      id={section.id}
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-16">
        <div className="max-w-3xl space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-primary md:text-3xl">
            {section.heading}
          </h2>
          <p className="text-base leading-relaxed text-foreground md:text-lg">
            {sectionBody(section)}
          </p>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

/** An item's mode, as a chip: the same badge both the domains band and the opinions band draw. */
function Chip({ children }: { children: React.ReactNode }) {
  return <Badge className="bg-accent text-accent-foreground">{children}</Badge>;
}

/**
 * The CTA, as a link. `inverted` is the closing band's copy: the same action drawn light-on-brand
 * inside a brand-coloured band, rather than brand-on-light inside a white one — a token override on
 * the button's default fill, not a second button.
 */
function Action({ inverted, link }: { inverted?: boolean; link: PageCopyLink }) {
  return (
    <Button
      asChild
      size="lg"
      className={inverted ? "bg-primary-foreground text-primary hover:bg-primary-foreground" : ""}
    >
      <Link href={link.href}>{link.label}</Link>
    </Button>
  );
}
