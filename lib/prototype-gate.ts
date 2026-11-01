/**
 * The prototype screens' gate — the console's review path, one helper for the whole subtree
 * (#console cohort 1).
 *
 * `/prototype` and everything under it renders `data/prototypes/console.ts`: fixture records that
 * describe screens the owner has not approved yet. There are no rows behind them, no opinion, no
 * report and no write — which is exactly why they must not be reachable by a visitor. A prototype
 * that answers `200` is a mock presented as working, and the delta table in `docs/UI-DIVERGENCE.md`
 * is the standing evidence that this tree can grow one.
 *
 * ## Why a flag and not `requireAdmin()`
 *
 * The surfaces are admin-only *in practice* and not by policy: an operator is the reader, but a
 * prototype is not an operator tool, and gating it on the role would say that it is. What it needs
 * is one switch that says "these screens exist, they are off, and here is who may look at them",
 * and the repo already owns that switch: `console.prototypes` is `default: false` with
 * `adminBypass: true` (`data/flags.ts`), and `lib/auth/flag-gate.ts::enabledForCaller` resolves the
 * role server-side from the request's own session. A member and a signed-out visitor both resolve
 * it off — the same answer for both, because a caller who may not see a surface and a caller who
 * has no business knowing it exists must not be distinguishable.
 *
 * ## Why the layout and not each page
 *
 * The gate is called once, from `app/(mainlayout)/prototype/layout.tsx`, and that placement is the
 * pattern the later cohorts copy:
 *
 *   - **every child segment is gated in one place.** Cohort 2 adds `/prototype/relationships` and
 *     its detail page, cohort 4 adds `/prototype/admin/gaps`; none of them restates the check, so
 *     none of them can forget it and be reachable because it did.
 *   - **each page's import graph stays free of `lib/db/`.** `enabledForCaller` reaches the session
 *     through `lib/auth/require-role.ts`, which imports the `user_profile` read. Calling it from a
 *     page would put `lib/db/**` in that page's own graph — the thing `data/ui-registry.ts` reads to
 *     decide a surface's `status`. A page that only imports its fixture and its components can
 *     honestly claim `fixture`; the gate belongs to the layout, where it is one edge for the whole
 *     subtree.
 *
 * ## The order
 *
 * `notFound()` is before anything renders, for the reason `lib/brand-boundary.ts` documents: a
 * gated surface that renders nothing because nothing was read is what a 404 means, and a `403` would
 * tell the visitor the surface exists. `force-dynamic` on the layout keeps the decision per request
 * — the role cannot be prerendered at build time, and `pnpm build` has no session to read.
 */
import type { FlagName } from "@/data/flags";
import { enabledForCaller } from "@/lib/auth/flag-gate";
import { notFound } from "next/navigation";

/**
 * The gate's flag. Typed as `FlagName`, so renaming it in `data/flags.ts` fails `tsc` here rather
 * than resolving an undeclared name at request time.
 */
export const PROTOTYPE_FLAG: FlagName = "console.prototypes";

/**
 * May **this request's** caller see the prototype screens? `true` for an admin (the flag's
 * `adminBypass`), and for anyone when `FLAG_CONSOLE_PROTOTYPES=1` is set — the operator's review
 * lever. `false` for a member and for a signed-out visitor.
 *
 * Exported beside the gate so a caller that wants to *label* something (a future index that says
 * whether a screen is live or a prototype) asks the same question the gate asks. It is not a
 * substitute for the gate: this answers, `requirePrototypeScreens` refuses.
 */
export function prototypeScreensEnabled(): Promise<boolean> {
  return enabledForCaller(PROTOTYPE_FLAG);
}

/**
 * The route gate. Call it in a layout that wraps every prototype segment, before it renders:
 *
 * ```ts
 * export default async function PrototypeLayout({ children }: { children: React.ReactNode }) {
 *   await requirePrototypeScreens();
 *   return <>{children}</>;
 * }
 * ```
 *
 * Returns nothing when the screens are on for this caller, and throws Next's not-found when they
 * are not — the same 404 an unknown URL gets, so nobody can tell a prototype they may not see from a
 * page that never existed.
 */
export async function requirePrototypeScreens(): Promise<void> {
  if (!(await prototypeScreensEnabled())) notFound();
}
