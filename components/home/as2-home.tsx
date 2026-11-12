// template-ancestor: components/home/alignment-home.tsx   (variation: the AS2 composition — eight bands, an in-page menu under the hero and a page-scoped token paint, instead of the alignment page's hero/worked-example/practice stack)

import { As2Benefits } from "@/components/home/as2-benefits";
import { As2FinalCta } from "@/components/home/as2-final-cta";
import { As2Hero } from "@/components/home/as2-hero";
import { As2HowItWorks } from "@/components/home/as2-how-it-works";
import { As2Model } from "@/components/home/as2-model";
import { As2SectionNav } from "@/components/home/as2-section-nav";
import { As2Stories } from "@/components/home/as2-stories";
import { As2Templates } from "@/components/home/as2-templates";
import type { As2HomeModel } from "@/lib/home-alignsynch";
import type React from "react";

/**
 * The AlignSynch front page since #853 — the approved AS2 redesign, in the order the approval gave.
 *
 * **It renders inside `app/(marketing)/` and mounts no chrome of its own.** The shared header, the
 * shared footer and the footer's product-news band all come from the route group's layout, so this
 * page has exactly one of each. A second header or a second signup band was the first item on the
 * card's "doomed if" list, and the way it was prevented is that this file has nothing to duplicate
 * them with: no `MarketingHeader`, no `Footer`, no `NewsSignup`, and no import that could reach one.
 *
 * **Two things ride on the wrapper `<div>`:**
 *
 *  1. `.home-anchors` — the class `app/globals.css` reads to derive every target's
 *     `scroll-margin-top` from `--site-header-height` plus the menu's own row height. It is on the
 *     wrapper rather than on each section so the offset has one definition, and it also switches on
 *     the page's smooth scroll through `html:has(.home-anchors)`, with `prefers-reduced-motion`
 *     restoring the instant jump.
 *  2. `style={model.tokens}` — the brand's surface roles (`paper`, `mist`, `sand`, `line`, `pale`,
 *     `mark`, `deep`) as custom properties. They are painted *here*, on the page that uses them,
 *     rather than on `<html>`: `lib/brand-theme.ts::brandSurfaceVars` explains why a global paint
 *     would move six unrelated parity renders for no visual change, and why the resolver is still
 *     the brand record's.
 *
 * A `switch` in `app/(marketing)/page.tsx` chooses between this composition and the quiz product's,
 * so neither brand can inherit the other's front page by accident.
 */
export function As2HomeView({ model }: { model: As2HomeModel }): React.ReactElement {
  return (
    <div className="home-anchors bg-background" style={model.tokens as React.CSSProperties}>
      <As2Hero hero={model.hero} />
      <As2SectionNav nav={model.nav} />
      <As2HowItWorks band={model.howItWorks} />
      <As2Templates band={model.templates} />
      <As2Model band={model.model} />
      <As2Stories band={model.stories} />
      <As2Benefits band={model.benefits} />
      <As2FinalCta band={model.finalCta} />
    </div>
  );
}
