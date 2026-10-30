import { DemoPanel } from "@/components/auth/demo-panel";
import { demoMode } from "@/lib/auth/demo-mode";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { signInAsDemo } from "./actions";

/**
 * `/demo` — the PIN-gated panel that signs a browser in as one of three seeded accounts
 * (#183, part 2 of 2).
 *
 * **The whole route is the gate.** `demoMode()` answers first and a deployment that is not in
 * demo mode gets `notFound()` — no banner, no disabled form, no "demo auth is off" placeholder.
 * A partially-rendered panel is a map of the backdoor for anyone who asks for the URL, and a
 * prompt to flip a flag for anyone who finds it.
 *
 * `force-dynamic` is not a performance choice here, it is the switch's own requirement. A
 * prerendered `/demo` would freeze the answer at **build** time: build with `DEMO_AUTH=1` and
 * the panel ships inside the HTML to a deployment that then runs without it (the 404 can never
 * come back); build without it and setting `DEMO_AUTH=1` needs a rebuild, which is the same
 * "restart, not redeploy" trap `/leaderboard` documents for its flag. Reading the mode on every
 * request means the environment variable plus a restart is the whole operation, in both
 * directions.
 *
 * The action is passed down as a prop rather than imported by the panel, so the client module
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
  return <DemoPanel action={signInAsDemo} />;
}
