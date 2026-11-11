import { TemplatesPageView } from "@/components/templates/templates-page";
import { templatesPageCopy } from "@/data/pages/templates";
import { templatesPage } from "@/lib/templates-page";
import type { Metadata } from "next";

/**
 * `/relationship-types` — the public Relationship Types page (#794).
 *
 * The destination the header's `Templates` row points at, and the target of the front page's
 * `#templates` band's one call to action. It lives in `app/(marketing)/` because it is a public
 * product page: the marketing header and footer, no sidebar, no session, and nothing on it that
 * asks a signed-out visitor to sign in.
 *
 * **The address names the taxonomy, not the templates.** What this page sells is the *types* a
 * relationship can be; a `template` is a record a person copies, and since #794 it lives one door
 * over at `/templates/relationship/<slug>`. `/templates` itself is now the template namespace and
 * 308s here, so a bookmark lands on this page rather than a 404.
 *
 * **Nothing here reads a clock, a store or the database.** The page is a projection of
 * `data/relationship-types.ts` through `data/pages/templates.ts`, so it prerenders — which is
 * what a page a search engine and a stranger both land on first should do. The chrome above it
 * (`app/(marketing)/layout.tsx`) is the only request-time thing in the render.
 *
 * The title is relative: the root layout's template composes `Relationship Templates · <brand>`,
 * so the brand is named once, by the layout, and not a second time here.
 */
export const metadata: Metadata = {
  title: "Relationship Templates",
};

export default function RelationshipTemplatesPage() {
  return <TemplatesPageView model={templatesPage(templatesPageCopy)} />;
}
