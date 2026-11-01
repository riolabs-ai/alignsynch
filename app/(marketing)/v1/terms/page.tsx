// template-ancestor: components/legal/legal-page.tsx
import { LegalPage } from "@/components/legal/legal-page";
import { legalPages } from "@/data/pages/legal";

/** `/v1/terms` — the same draft Terms the live page renders. */
export default function V1TermsPage() {
  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-8">
      <LegalPage copy={legalPages.terms} />
    </div>
  );
}
