import { Footer } from "@/components/layout/footer";
import { LegalPage } from "@/components/legal/legal-page";
import { legalPages } from "@/data/pages/legal";
import { shellPageCopy } from "@/data/pages/shell";
import { hiddenNavHrefs } from "@/lib/flags";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

/**
 * `/privacy` — the draft Privacy Policy (issue #270).
 *
 * Same module, same view, same banner as `/terms`: both pages read one fixture
 * (`data/pages/legal.ts`) so a sentence cannot be corrected on one page and left on the other.
 * There is deliberately no separate `/cookies` route — §9 of this page is the cookie policy, and
 * the issue's refinement says a third page would be a route nobody asked for.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalPage copy={legalPages.privacy} />
      <Footer copy={shellPageCopy} hiddenNav={hiddenNavHrefs()} />
    </div>
  );
}
