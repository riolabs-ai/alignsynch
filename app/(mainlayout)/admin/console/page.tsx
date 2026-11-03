// template-ancestor: components/console/overview.tsx
import { AdminConsoleOverview } from "@/components/v1/admin-console-overview";

/**
 * `/admin/console` — the admin console's overview.
 *
 * A server page that renders one client component, because every figure on it is a count over the
 * in-browser store (`lib/v1/store.tsx`): the page has nothing to read on the server, and shipping
 * a count the server invented would be the one thing this console exists to prevent.
 *
 * The console used to live at `/v1/admin/console` and moved here (#478) so the `/v1` prototype can
 * be deleted without taking it. The gate is the subtree layout's — `requireAdmin()` in
 * `layout.tsx` — so this page renders only for an allowlisted admin.
 */
export default function AdminConsolePage() {
  return <AdminConsoleOverview />;
}
