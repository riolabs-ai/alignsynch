// template-ancestor: components/console/overview.tsx
import { AdminConsoleOverview } from "@/components/v1/admin-console-overview";
import { requireAdminProduct } from "@/lib/brand-boundary";

/**
 * `/admin/console` — the admin console's overview.
 *
 * A server page that renders one client component, because every figure on it is a count over the
 * in-browser store (`lib/v1/store.tsx`): the page has nothing to read on the server, and shipping
 * a count the server invented would be the one thing this console exists to prevent.
 *
 * The console used to live at `/v1/admin/console` and moved here (#478) so the `/v1` prototype can
 * be deleted without taking it. The role gate is the subtree layout's — `requireAdmin()` in
 * `layout.tsx` — so this page renders only for an allowlisted admin.
 *
 * **The capability gate is here as well as in the layout (#509).** The layout's call is what closes
 * the subtree — this page and the five beside it — and it is the one a request meets. This call is
 * the entry point stating its own boundary where the harness can read it:
 * `tests/parity/parity.check.ts` renders *page modules*, never nested layouts, so a console whose
 * only gate lived one level up would look unconditional to the boundary test. Two calls, one
 * answer, and the ordering rule is the same in both: `requireAdminProduct()` refuses before
 * `requireAdmin()` reads a session.
 */
export default function AdminConsolePage() {
  requireAdminProduct();
  return <AdminConsoleOverview />;
}
