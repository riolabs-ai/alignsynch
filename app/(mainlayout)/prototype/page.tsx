/**
 * `/prototype` — the index of prototype screens that render today (#console cohort 1).
 *
 * The page does three things and no more: it reads the two fixtures, it resolves the metadata the
 * tab shows, and it mounts the view. The gate is the layout's (`app/(mainlayout)/prototype/layout.tsx`),
 * so this module reaches no session and no database — which is also why it is not `async`.
 *
 * `title` is the fixture's own `heading` rather than a second authored string: a screen called
 * "Prototype screens" in the `h1` and something else in the tab is two claims about one page.
 * `robots` is `noindex` for the reason `/admin/instances` carries it — a crawler must not publish a
 * surface nobody approved.
 */
import { PrototypeIndex } from "@/components/prototype/prototype-index";
import { prototypeIndexPageCopy } from "@/data/pages/prototype-console";
import { prototypeScreens } from "@/data/prototypes/console";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: prototypeIndexPageCopy.heading,
  robots: { index: false, follow: false },
};

export default function PrototypeIndexPage() {
  return <PrototypeIndex copy={prototypeIndexPageCopy} screens={prototypeScreens} />;
}
