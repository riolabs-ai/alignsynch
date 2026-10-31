import { Footer } from "@/components/layout/footer";
import { LegalPage } from "@/components/legal/legal-page";
import { legalPages } from "@/data/pages/legal";
import { shellPageCopy } from "@/data/pages/shell";
import { hiddenNavHrefs } from "@/lib/flags";
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
 * The footer is mounted here as it is on the marketing pages, so the legal row that links this
 * page also links the other one from it.
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalPage copy={legalPages.terms} />
      <Footer copy={shellPageCopy} hiddenNav={hiddenNavHrefs()} />
    </div>
  );
}
