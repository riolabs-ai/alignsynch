// template-ancestor: components/ui/card.tsx
import { SectionStub } from "@/components/v1/section-stub";
import { SECTION_SUMMARIES } from "@/lib/v1/persona";

/** `/v1/admin/console` — the admin console stub (admin only; the sidebar gates the row). */
export default function AdminConsoleStubPage() {
  return <SectionStub section="Admin console" persona="admin" summary={SECTION_SUMMARIES.admin} />;
}
