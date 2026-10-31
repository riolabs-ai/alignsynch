import { DemoGate } from "@/components/auth/demo-gate";
import { demoMode } from "@/lib/auth/demo-mode";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { unlockDemo } from "./actions";

/**
 * `/demo` — the PIN gate, and nothing else (#218, was #183 part 2 of 2).
 *
 * **The whole route is the gate.** `demoMode()` answers first and a deployment that is not in
 * demo mode gets `notFound()` — no banner, no disabled form, no "demo auth is off" placeholder.
 * A partially-rendered gate is a map of the backdoor for anyone who asks for the URL, and a
 * prompt to flip a flag for anyone who finds it.
 *
 * What changed in #218 is where the flow goes next: this screen used to end in three role buttons
 * on the same card, and now a correct PIN sets a signed unlock cookie and redirects to `/login`,
 * which draws the buttons only for a request that carries it. The gate therefore renders **one
 * field and one submit** — no account label, no role, no credential — and the PIN is the only
 * thing a browser can post from here.
 *
 * `force-dynamic` is not a performance choice here, it is the switch's own requirement. A
 * prerendered `/demo` would freeze the answer at **build** time: build with `DEMO_AUTH=1` and
 * the gate ships inside the HTML to a deployment that then runs without it (the 404 can never
 * come back); build without it and setting `DEMO_AUTH=1` needs a rebuild, which is the same
 * "restart, not redeploy" trap `/leaderboard` documents for its flag. Reading the mode on every
 * request means the environment variable plus a restart is the whole operation, in both
 * directions.
 *
 * The action is passed down as a prop rather than imported by the gate, so the client module
 * never names the `"use server"` file and the page remains the one place the two are wired.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demo sign-in",
  // A demo login is not a search result. The route is a 404 outside demo mode anyway.
  robots: { index: false, follow: false },
};

export default function DemoPage() {
  if (demoMode().kind !== "demo") notFound();
  return <DemoGate action={unlockDemo} />;
}
