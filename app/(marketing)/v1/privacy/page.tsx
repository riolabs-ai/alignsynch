// template-ancestor: components/legal/legal-page.tsx
import { LegalPage } from "@/components/legal/legal-page";
import { legalPages } from "@/data/pages/legal";

/** `/v1/privacy` — the same draft Privacy Policy the live page renders. */
export default function V1PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <LegalPage copy={legalPages.privacy} />
    </div>
  );
}
