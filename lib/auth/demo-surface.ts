/**
 * What `/login` may render for the demo — one decision, three states (#218).
 *
 * The loop this module exists to prevent: PIN → `/login` → role buttons, where `/login` also
 * carries a link to `/demo`. If the link stayed visible after unlocking, a reader could bounce
 * `/login → /demo → /login` forever and the flow would have no end. So the surface is a function
 * of the mode and the unlock verdict, and the three states are mutually exclusive:
 *
 *   off     demo mode is not on in this deployment (`demoMode()` said off or refused).
 *           **Nothing renders** — no link, no block, no disabled button, no hint. The same
 *           answer `/demo` gives by calling `notFound()`.
 *   entry   demo mode is on and this request carries no valid unlock. `/login` renders the
 *           **link to `/demo`** (the one door) and no role buttons.
 *   roles   demo mode is on and the unlock verifies. `/login` renders the three role buttons,
 *           each a server action that re-verifies the same cookie, and **not** the link: the
 *           buttons already switch between the three demo accounts, so sending the reader back
 *           to the PIN step would ask for something the cookie already grants.
 *
 * Pure — no `process.env`, no cookie store, no React — so `tests/demo-surface.test.ts` drives all
 * three without a request, and the page is the only caller that knows how to answer the two
 * questions.
 */
import type { DemoMode } from "@/lib/auth/demo-mode";
import type { UnlockVerdict } from "@/lib/auth/demo-unlock";

/** The three states, in the order the flow reaches them. */
export const DEMO_SURFACES = ["off", "entry", "roles"] as const;

export type DemoSurfaceKind = (typeof DEMO_SURFACES)[number];

/** The decision, as a value. `unlock` is `null` when demo mode is off and it was never asked. */
export interface DemoSurfaceDecision {
  readonly kind: DemoSurfaceKind;
}

/**
 * The whole policy.
 *
 * `unlock` is `null` only when demo mode is off: the caller must not read a cookie or a secret it
 * has no use for, and a tree with no auth env (the gate, CI, the parity render) must not need one.
 * A `no-secret` or `malformed` verdict is `entry` like any other refusal — the reader sees the
 * PIN link, which is the correct next step for every non-ok verdict.
 */
export function demoSurfaceFor(mode: DemoMode, unlock: UnlockVerdict | null): DemoSurfaceDecision {
  if (mode.kind !== "demo") return { kind: "off" };
  return unlock?.ok === true ? { kind: "roles" } : { kind: "entry" };
}
