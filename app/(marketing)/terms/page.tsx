import { LegalPage } from "@/components/legal/legal-page";
import { legalPages } from "@/data/pages/legal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
};

/**
 * `/terms` — the draft Terms of Service (issue #270).
 *
 * The copy is `data/pages/legal.ts`, already resolved for the build's brand (product name, domain
 * and support address come from the `Brand` record, never from a literal here). The page is a
 * server module on purpose: the fixture is parsed at import, the view holds no state, and the
 * draft banner must render first and cannot be dismissed.
 *
 * It is a public surface (#317). The module lives in `app/(marketing)/`, so the surface is
 * whichever chrome that group mounts: a marketing header and footer, never the product shell's
 * sidebar, palette or drawers. The shell's footer used to be mounted here and is not any more —
 * one page, one footer, and the footer a public page gets is the group's.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalPage copy={legalPages.terms} />
    </div>
  );
}
