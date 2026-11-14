import { TemplatesPageView } from "@/components/templates/templates-page";
import { brand, brandIdOf } from "@/data/brand";
import { templatesPageCopy } from "@/data/pages/templates";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { startViewer } from "@/lib/start-path";
import { templatesPage } from "@/lib/templates-page";
import type { Metadata } from "next";

/**
 * `/relationship-types` — the public Relationship Templates catalogue (#794, rebuilt in #889).
 *
 * The destination the header's `Templates` row points at, and the target of the front page's
 * `#templates` band's one call to action. It lives in `app/(marketing)/` because it is a public
 * product page: the marketing header and footer, no sidebar, no session check that swaps the
 * chrome, and nothing on it that *gates* a signed-out visitor.
 *
 * **The address names the taxonomy, not the templates.** What this page sells is the *types* a
 * relationship can be; a `template` is a record a person copies, and since #794 it lives one door
 * over at `/templates/relationship/<slug>`. `/templates` itself is now the template namespace and
 * 308s here, so a bookmark lands on this page rather than a 404.
 *
 * **The page is the approved artifact's composition.** `docs/specs/spec-as2-style-templates-redesign/`
 * is the binding reference (#889): a split hero over one framed photograph, a short explainer
 * carrying a real Staff–Manager Aspect, one membership line, a sticky realm menu, the catalogue
 * itself, and a compact journey band. `components/templates/templates-page.tsx` draws those six
 * bands and says what each one is for; `lib/templates-page.ts` is the join and the only place a
 * number is counted.
 *
 * **The chrome above it is the layout's, not this page's.** `MarketingHeader`, `PublicNav`,
 * `PublicAccountSlot`, `Footer` and `NewsSignup` come from `app/(marketing)/layout.tsx`; the
 * artifact's static header and footer are not reproduced here, which is the one thing about the
 * bundle that cannot survive contact with the real app.
 *
 * **And the actions are the viewer's (#979).** A member with a live session was offered `/register`
 * on all twenty-seven cards — asked to create the account they already had, on the front door of the
 * product's only paid flow. The page therefore resolves the session (once, here) and hands
 * `startViewer()`'s answer to the join: a card's action is the create flow's stage 1 for a member and
 * `/register?next=<that stage>` for a visitor, and the membership band's authored CTA is resolved the
 * same way (`lib/start-path.ts` owns both rules). A signed-out visitor's markup is byte-identical to
 * what this page shipped before (#317's rule: the chrome is chosen by route group, never by session;
 * only the *destination of an action* follows the session).
 *
 * The extra cost is one session read on a route whose layout already makes one for the account slot
 * (`shellSession()`); a page cannot read its layout's answer, and the alternative — patching the href
 * in the browser after paint — shows a member the sign-up page for a moment, which is the defect.
 *
 * **Nothing here reads a clock, a store or the database.** The page is a projection of
 * `data/relationship-types.ts` through `data/pages/templates.ts`, so with no auth environment (the
 * gate, CI) `currentUserIfConfigured()` answers `null` without touching a cookie store and the page
 * prerenders exactly as it did; the catalogue's search is a client enhancement over markup that
 * already contains every card.
 *
 * The title is relative: the root layout's template composes `Relationship Templates · <brand>`,
 * so the brand is named once, by the layout, and not a second time here.
 */
export const metadata: Metadata = {
  title: "Relationship Templates",
};

export default async function RelationshipTemplatesPage() {
  const signedIn = (await currentUserIfConfigured()) !== null;
  return (
    <TemplatesPageView
      model={templatesPage(templatesPageCopy, startViewer(brandIdOf(brand), signedIn))}
    />
  );
}
