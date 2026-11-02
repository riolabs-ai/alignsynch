// template-ancestor: components/explore/explore-quiz-list.tsx
import { AdminTemplateRegistry } from "@/components/v1/admin-template-registry";

/**
 * `/v1/admin/console/templates` — every template, with the relationships started from each.
 *
 * The page is deliberately unfiltered: a template registry with a search box would be a second
 * way to reach a row the console already lists in full, and the store holds three of them.
 */
export default function AdminTemplatesPage() {
  return <AdminTemplateRegistry />;
}
