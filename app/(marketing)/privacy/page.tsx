import { LegalPage } from "@/components/legal/legal-page";
import { legalPages } from "@/data/pages/legal";
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
 *
 * It is a public surface (#317): the module lives in `app/(marketing)/`, so it inherits that
 * group's header and footer and never the product shell — no `<aside>`, no app navigation. The
 * shell's footer is gone from this page for the same reason: the group's footer is the chrome.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <LegalPage copy={legalPages.privacy} />
    </div>
  );
}
