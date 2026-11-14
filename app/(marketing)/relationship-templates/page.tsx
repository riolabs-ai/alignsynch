import { TemplatesPageView } from "@/components/templates/templates-page";
import { brand, brandIdOf } from "@/data/brand";
import { templatesPageCopy } from "@/data/pages/templates";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { startViewer } from "@/lib/start-path";
import { templatesPage } from "@/lib/templates-page";
import type { Metadata } from "next";

/**
 * `/relationship-templates` — the public catalogue of relationship templates (#905, #1040).
 *
 * **The endpoint the catalogue answers at.** `/relationship-types` was the address from #794 until
 * this page; it stays mounted and unchanged as the retained landing variation (see the note below),
 * while every door the product opens — the shared header's `Templates` row, the footer's catalogue
 * link, the landing pages' "start with a template" actions and `/templates` itself — now points
 * here. The taxonomy pages that a template record lives on (`/relationship-types/<slug>` and its
 * worked example) did not move: a template is a record, and its own page kept its address.
 *
 * **The #889 shop listing, on both builds (#1040).** This route used to switch on `brandIdOf(brand)`
 * and hand the alignment build the V2 composition. #1040 restores the v1 shop listing at the
 * canonical door, so there is no switch left to get wrong: every brand renders
 * `TemplatesPageView`, the six bands cloned from
 * `docs/specs/spec-as2-style-templates-redesign/templates-listing-redesign.html` (PR #891), from
 * `lib/templates-page.ts` over `data/pages/templates.ts`. The quiz build's markup is unchanged —
 * it rendered this composition before the card and still does, byte for byte — and the alignment
 * build now matches it instead of diverging.
 *
 * **The V2 composition is retained, not deleted.** `components/templates/templates-catalogue-v2.tsx`
 * and its model `lib/templates-catalogue.ts` still build and still render (27 templates as chips
 * under two groups, the in-page menu, the benefits grid and the closing band), and
 * `tests/templates-catalogue.test.ts` keeps pinning what they claim. What changed is that no route
 * mounts them: the template doctrine catalogues a surface rather than deleting it, and
 * `docs/ui-registry.md` is where it is catalogued. Re-mounting it is one import in one branch, which
 * is the point of keeping it whole.
 *
 * **Which address is which is answerable from `lib/flow/paths.ts`**, never from this card:
 * `TEMPLATE_CATALOGUE_PATH` / `RELATIONSHIP_TEMPLATES_PATH` is the canonical door and the member's
 * library namespace, and `RELATIONSHIP_TYPES_PATH` is the variation's address and the record pages'
 * namespace.
 *
 * **Nothing here reads a clock, a store or the database.** The page is a projection of
 * `data/relationship-types.ts` and `data/pages/templates.ts`, so it prerenders — which is what a
 * page a search engine and a stranger both land on first should do.
 *
 * The actions are the viewer's (#979): `startViewer()` decides whether a card's action is the create
 * flow's stage 1 or `/register?next=<that stage>`, and a visitor's markup is unchanged.
 *
 * The title is relative: the root layout's template composes `Relationship Templates · <brand>`, so
 * the brand is named once, by the layout, and not a second time here.
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
