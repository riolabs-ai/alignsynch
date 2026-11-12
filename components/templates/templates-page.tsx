// template-ancestor: components/home/as2-home.tsx   (variation: the public catalogue's six bands — hero, explainer, one membership line, sticky realm menu, the shelf, the journey — with no header, no footer and no newsletter, because `app/(marketing)/layout.tsx` already mounts all three)

import { HowItWorksPreview } from "@/components/templates/how-it-works-preview";
import { MembershipSummary } from "@/components/templates/membership-summary";
import { TemplateCatalogue } from "@/components/templates/template-catalogue";
import { TemplateJourney } from "@/components/templates/template-journey";
import { TemplateRealmNav } from "@/components/templates/template-realm-nav";
import { TemplatesHero } from "@/components/templates/templates-hero";
import type { TemplatesPageModel } from "@/lib/templates-page";

/**
 * `/relationship-types` — the public Templates catalogue, drawn (issue #889).
 *
 * The approved artifact is `docs/specs/spec-as2-style-templates-redesign/`, and this composition
 * is its six bands in its order: hero → how AlignSynch works → one membership line → the sticky
 * realm menu → the catalogue → the journey. The four components the artifact names as *not* to be
 * copied — the static header, the static footer, the newsletter and the logo lockup — are absent
 * by construction: `app/(marketing)/layout.tsx` mounts `MarketingHeader`, `PublicNav`,
 * `PublicAccountSlot`, `Footer` and `NewsSignup` above and below this file, and nothing here
 * imports one.
 *
 * **Two things ride on the wrapper `<div>`, and both are mechanisms the AS2 home page shipped
 * first:**
 *
 *  1. `.templates-anchors` — the class `app/globals.css` reads to derive every anchor target's
 *     `scroll-margin-top` from `--site-header-height` plus the realm menu's own row height. The
 *     offset is one definition rather than a number per section, because a per-section number
 *     survives review and then lies the first time the header row grows. It also switches the
 *     page's smooth scroll on through `html:has(.templates-anchors)`, with `prefers-reduced-motion`
 *     restoring the instant jump.
 *  2. **No brand-token paint.** The AS2 home page paints its surface roles on its wrapper because
 *     it draws `bg-mist` / `border-line` / `text-deep`; this page draws the app's ordinary
 *     `background` / `muted` / `border` / `action` roles, which every brand already resolves. That
 *     is deliberate: this route is not AlignSynch-only, and a page that threw on a brand naming no
 *     `mist` would be a page that 500s on the other template.
 *
 * **The catalogue is the one client component.** Everything else is a server render, so the
 * document a crawler or a JavaScript-less browser receives is the whole page — hero copy, all
 * twenty-seven cards, and the journey. `TemplateCatalogue`'s own docstring says why its search is
 * an enhancement rather than a gate.
 *
 * Holds no words: every string arrives on the model (E23 keeps this route at 0 leaf literals).
 */
export function TemplatesPageView({ model }: { model: TemplatesPageModel }) {
  return (
    <div className="templates-anchors bg-background">
      <TemplatesHero hero={model.hero} />
      <HowItWorksPreview how={model.how} mark={model.hero.mark} />
      <MembershipSummary membership={model.membership} />
      <TemplateRealmNav catalogue={model.catalogue} />
      <TemplateCatalogue catalogue={model.catalogue} mark={model.hero.mark} />
      <TemplateJourney journey={model.journey} />
    </div>
  );
}

/** Kept as a named export shape so a test can render the page without the router. */
export type { TemplatesPageModel };

export default TemplatesPageView;
