// template-ancestor: components/console/overview.tsx
import { AdminConsoleOverview } from "@/components/v1/admin-console-overview";

/**
 * `/v1/admin/console` — the admin console's overview.
 *
 * A server page that renders one client component, because every figure on it is a count over the
 * in-browser store (`lib/v1/store.tsx`): the page has nothing to read on the server, and shipping
 * a count the server invented would be the one thing this console exists to prevent.
 */
export default function AdminConsolePage() {
  return <AdminConsoleOverview />;
}
