import { TemplatesCatalogueView } from "@/components/templates/templates-catalogue-v2";
import { TemplatesPageView } from "@/components/templates/templates-page";
import { brand, brandIdOf } from "@/data/brand";
import { templatesPageCopy } from "@/data/pages/templates";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { startViewer, type StartViewer } from "@/lib/start-path";
import { templatesCatalogue } from "@/lib/templates-catalogue";
import { templatesPage } from "@/lib/templates-page";
import type { Metadata } from "next";

/**
 * `/relationship-templates` — the public catalogue of relationship templates (#905).
 *
 * **The endpoint the catalogue answers at.** `/relationship-types` was the address from #794 until
 * this page; it stays mounted and unchanged as the retained landing variation (see the note below),
 * while every door the product opens — the shared header's `Templates` row, the footer's catalogue
 * link, the landing pages' "start with a template" actions and `/templates` itself — now points
 * here. The taxonomy pages that a template record lives on (`/relationship-types/<slug>` and its
 * worked example) did not move: a template is a record, and its own page kept its address.
 *
 * **The brand switch is the same switch `/` makes, for the same reason.** The V2 composition draws
 * the drawn package's surface roles (`sand`, `line`, `pale`, `mark`, `deep`); a brand that names
 * none of them would render a page of invisible grounds. So the alignment build gets the V2
 * catalogue and the quiz build gets the #889 composition this route replaced — byte for byte the
 * page QuizHub rendered at `/relationship-types`, which is what the card's "change no QuizHub
 * rendering" asks for. `brandIdOf()` is a closed union, so a third brand added without a catalogue
 * is a compile error rather than a template inherited by accident.
 *
 * **The retained variation.** The #889 composition — `TemplatesPageView`, six bands cloned from
 * `docs/specs/spec-as2-style-templates-redesign/templates-listing-redesign.html` (PR #891) — is
 * still live at `/relationship-types`, with its own words and its own model. It is kept, not
 * deleted, because the owner asked for the old page to be saved as a landing variation; the
 * template doctrine is the same rule (nothing is deleted for being unused, it is catalogued). Which
 * of the two is the catalogue is answerable from `lib/flow/paths.ts`: `RELATIONSHIP_TEMPLATES_PATH`
 * is the canonical door, and `RELATIONSHIP_TYPES_PATH` is the variation's address and the record
 * pages' namespace.
 *
 * **Nothing here reads a clock, a store or the database.** Both branches are projections of
 * `data/relationship-types.ts` and `data/pages/templates.ts`, so the page prerenders — which is what
 * a page a search engine and a stranger both land on first should do.
 *
 * The title is relative: the root layout's template composes `Relationship Templates · <brand>`, so
 * the brand is named once, by the layout, and not a second time here.
 */
export const metadata: Metadata = {
  title: "Relationship Templates",
};

/** The V2 catalogue: the drawn package's six bands, this page's model (`lib/templates-catalogue.ts`). */
function AlignSynchCatalogue({ viewer }: { viewer: StartViewer }) {
  return <TemplatesCatalogueView model={templatesCatalogue(brand, templatesPageCopy, viewer)} />;
}

/** The #889 composition, unchanged — what the quiz build already rendered at this address' family. */
function QuizHubCatalogue({ viewer }: { viewer: StartViewer }) {
  return <TemplatesPageView model={templatesPage(templatesPageCopy, viewer)} />;
}

export default async function RelationshipTemplatesPage() {
  /**
   * The viewer, resolved once (#979). Both branches draw authored actions whose `href` is
   * `/register` — the membership band's and the closing band's — and a member with a live session
   * must be sent to their own destination instead of the sign-up page. A visitor's markup is
   * unchanged, which is also what keeps `pnpm parity`'s quiz hashes still.
   */
  const signedIn = (await currentUserIfConfigured()) !== null;
  const viewer = startViewer(brandIdOf(brand), signedIn);
  switch (brandIdOf(brand)) {
    case "quizhub":
      return <QuizHubCatalogue viewer={viewer} />;
    case "alignsynch":
      return <AlignSynchCatalogue viewer={viewer} />;
  }
}
