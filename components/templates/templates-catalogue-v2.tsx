// template-ancestor: components/home/as2-home.tsx   (variation: the catalogue page's six bands — the drawn hero, the in-page menu, the templates band, how it works, what's included and the closing band — assembled for a page whose job is choosing a template rather than selling the product)

import { As2Benefits } from "@/components/home/as2-benefits";
import { As2FinalCta } from "@/components/home/as2-final-cta";
import { As2Hero } from "@/components/home/as2-hero";
import { As2HowItWorks } from "@/components/home/as2-how-it-works";
import { As2SectionNav } from "@/components/home/as2-section-nav";
import { As2Templates } from "@/components/home/as2-templates";
import type { TemplatesCatalogueModel } from "@/lib/templates-catalogue";
import type React from "react";

/**
 * `/relationship-templates` — the V2 catalogue (issue #905).
 *
 * **Every band is a component the approved package already drew.** The package
 * (`docs/specs/spec-design-page-rel-templates-v2/`) contains a home page and a brand profile; it
 * does not contain this page. So "rebuild it on the V2 system" cannot mean cloning a drawing that
 * does not exist — it means every element here is an *instance* of a pattern the package does draw:
 * the same `hero` with its two life cards, the same sticky in-page menu, the same four-step
 * `how-it-works` row, the same `sand` templates band with its chips and counselor note, the same
 * ruled `benefits` grid, the same graphite closing band. Not one of them is re-typed here: they are
 * `components/home/as2-hero.tsx`, `as2-section-nav.tsx`, `as2-templates.tsx`,
 * `as2-how-it-works.tsx`, `as2-benefits.tsx` and `as2-final-cta.tsx`, rendered with this page's
 * model. That is what makes the heading scale, the card anatomy, the spacing and the tokens
 * identical to `/` rather than "in the spirit of" it (#904 measured those values off the same
 * stylesheet).
 *
 * **The order is the page's job, not the front page's.** On `/` the templates band sits fourth,
 * after the argument for the product. Here it is the page, so it comes straight after the hero and
 * the menu, and the bands that usually precede it — how it works, what's included — follow as the
 * answer to "what happens if I pick one". Six bands, the drawn six, in the order a reader deciding
 * between work and home needs them.
 *
 * **Two mechanisms ride on the wrapper `<div>`, both inherited from `/`:**
 *
 *  1. `.home-anchors` — the class `app/globals.css` reads to derive every anchor target's
 *     `scroll-margin-top` from `--site-header-height` plus the menu's own row height, and to switch
 *     the page's smooth scroll on with `prefers-reduced-motion` restoring the instant jump. The
 *     offset has one definition rather than a number per section.
 *  2. `style={model.tokens}` — the brand's surface roles (`sand`, `line`, `pale`, `mark`, `deep`) as
 *     custom properties, painted on the page that uses them. `lib/templates-catalogue.ts` refuses a
 *     brand that names none, and `app/(marketing)/relationship-templates/page.tsx` sends that brand
 *     down the other branch, so this file can only ever paint a brand that defines them.
 *
 * **No chrome.** `app/(marketing)/layout.tsx` mounts the marketing header, the public menu, the
 * account slot, the footer and the news band above and below this file; nothing here imports one.
 * The page therefore has exactly one header and one footer, which is the first item on the card's
 * "doomed if" list.
 *
 * **The one client-side thing is the browser's own anchor scrolling.** Every band is a server
 * render, so the document a crawler or a JavaScript-less browser receives is the whole page: the
 * hero, all twenty-seven templates as links, the four steps and the four membership facts.
 *
 * Holds no words: every string arrives on the model (E23 keeps this route at 0 leaf literals).
 */
export function TemplatesCatalogueView({
  model,
}: {
  model: TemplatesCatalogueModel;
}): React.ReactElement {
  return (
    <div className="home-anchors bg-background" style={model.tokens as React.CSSProperties}>
      <As2Hero hero={model.hero} />
      <As2SectionNav nav={model.nav} />
      <As2Templates band={model.templates} />
      <As2HowItWorks band={model.howItWorks} />
      <As2Benefits band={model.benefits} />
      <As2FinalCta band={model.finalCta} />
    </div>
  );
}

export default TemplatesCatalogueView;
