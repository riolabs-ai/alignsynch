// template-ancestor: components/explore/explore-quiz-list.tsx
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { AdminTemplateRegistry } from "@/components/v1/admin-template-registry";

/**
 * `/admin/console/templates` — every template, with the relationships started from each.
 *
 * The page is deliberately unfiltered: a template registry with a search box would be a second
 * way to reach a row the console already lists in full, and the store holds three of them.
 */
export default function AdminTemplatesPage() {
  return (
    <StageColumn>
      <AdminTemplateRegistry />
    </StageColumn>
  );
}
