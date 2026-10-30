import { LoginView } from "@/components/auth/login-view";
import { loginPageCopy } from "@/data/pages/login";
import { demoMode } from "@/lib/auth/demo-mode";
import type { DemoViewProps } from "@/lib/auth/demo-form";
import { demoSurfaceFor } from "@/lib/auth/demo-surface";
import { readDemoUnlock } from "@/lib/auth/demo-unlock-cookie";
import { safeNextPath } from "@/lib/auth/paths";
import type { Metadata } from "next";
import { signInAsDemoRole } from "./demo-actions";

export const metadata: Metadata = {
  title: "Log In",
};

/**
 * `/login`. A server module on purpose: the copy is parsed here (import of
 * `data/pages/login.ts`) and handed to the client view as a prop, so the fixture's zod
 * stays out of the bundle. `data:check` E23 attributes this module and
 * `components/auth/**` to the `/login` surface.
 *
 * `?next=` is read **here**, not in the client view (issue #164): `useSearchParams()` in the
 * client component would need a `<Suspense>` boundary around a form that renders nothing async,
 * and the value would then be read from a URL the browser controls. The server validates it with
 * `safeNextPath` (a same-site path, or `/dashboard/user`) and passes the result down, so the
 * client only ever receives something it is allowed to navigate to. Reading `searchParams` makes
 * this route request-time — correct for a form that must never be cached with somebody's `next=`.
 *
 * **The demo block is a server decision too** (#218), and the same three states `/demo` already
 * understands (`lib/auth/demo-surface.ts`):
 *
 *   off     demo mode is not on → neither the link nor the buttons. Not a disabled control and
 *           not a hint: `/login` renders exactly what it rendered before #218.
 *   entry   demo mode is on, this request has no valid unlock → an anchor to `/demo` and no
 *           buttons. The gate is the one door, so the link goes there and the role buttons do
 *           not exist yet.
 *   roles   the unlock cookie verifies → the three role buttons, each a server action that
 *           re-verifies the same cookie, and no link back to the gate (the buttons already switch
 *           accounts; asking for the PIN again would repeat the first step for nothing).
 *
 * The cookie is only read when demo mode is on: a tree with no `DEMO_*` env (the gate, CI, the
 * parity render) must not need an auth secret to render `/login`, and `demoSurfaceFor()` takes
 * `null` for exactly that case. The actions are passed as props, so this module is the one place
 * the two `"use server"` files are wired to the view.
 */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = Array.isArray(next) ? next[0] : next;

  const mode = demoMode();
  const surface = demoSurfaceFor(mode, mode.kind === "demo" ? await readDemoUnlock() : null);
  const demo: DemoViewProps =
    surface.kind === "roles"
      ? { kind: "roles", action: signInAsDemoRole }
      : surface.kind === "entry"
        ? { kind: "entry" }
        : { kind: "off" };

  return <LoginView copy={loginPageCopy} next={safeNextPath(target)} demo={demo} />;
}
