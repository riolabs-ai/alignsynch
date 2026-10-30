import { LoginView } from "@/components/auth/login-view";
import { loginPageCopy } from "@/data/pages/login";
import { safeNextPath } from "@/lib/auth/paths";
import type { Metadata } from "next";

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
 */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = Array.isArray(next) ? next[0] : next;

  return <LoginView copy={loginPageCopy} next={safeNextPath(target)} />;
}
