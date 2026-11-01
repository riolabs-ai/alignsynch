/**
 * The prototype subtree's layout — the gate, and the band, in one place (#console cohort 1).
 *
 * **Why the gate is here and not in a page.** `requirePrototypeScreens()` is called once, before
 * anything renders, and every segment below inherits it: `/prototype` and `/prototype/admin` today,
 * `/prototype/relationships` in cohort 2 and `/prototype/admin/gaps` in cohort 4. A check repeated in
 * each page is a check a new page can omit, and the page it was omitted from is the one that ships.
 * The other half of the reason is the import graph: `lib/prototype-gate.ts` reaches the session
 * through `lib/auth/require-role.ts` and therefore `lib/db/**`, and a page that called it would put
 * the database layer in its *own* graph — the edge `data/ui-registry.ts` reads to decide a surface's
 * `status`. Gating here keeps each page's graph a fixture and a render, so the route can claim
 * `fixture` and be telling the truth.
 *
 * **Why the band is here too.** Every prototype screen carries the same sentence
 * (`data/pages/prototype-console.ts::prototypeBandCopy`), and it is the layout that mounts it — so a
 * cohort cannot word it differently, and cannot forget it.
 *
 * **`force-dynamic`.** The gate reads the request's session, so the answer is per request; Next must
 * not try to prerender the subtree (`requirePrototypeScreens` would run with no session at build
 * time, and `pnpm build` has no `NEON_AUTH_*`). The same segment config on a parent segment covers
 * every page below it.
 *
 * The layout holds no words of its own: the band's come from the fixture, and it declares no `dirs`
 * in `data/pages/budget.ts` itself — both `/prototype` entries name this file as a `mount`, which is
 * what keeps the band's component inside the copy ratchet.
 *
 * **The container is the console's, not a new one.** `container mx-auto max-w-4xl space-y-6` is
 * `components/identity/account-home.tsx`'s outer div, which `components/console/overview.tsx`
 * copied and `components/admin/instance-registry.tsx` inherits; the shell already pads the main
 * region (`<main className="flex-1 overflow-auto p-3 md:p-4 xxl:p-6">` in
 * `components/layout/main-layout.tsx`), so a second `px-4 py-10` here would be the page-padding
 * divergence `docs/UI-DIVERGENCE.md` records rather than a fix for it.
 */
import { PrototypeBand } from "@/components/prototype/prototype-band";
import { prototypeBandCopy } from "@/data/pages/prototype-console";
import { requirePrototypeScreens } from "@/lib/prototype-gate";
import type React from "react";

export const dynamic = "force-dynamic";

export default async function PrototypeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePrototypeScreens();

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <PrototypeBand copy={prototypeBandCopy} />
      {children}
    </div>
  );
}
