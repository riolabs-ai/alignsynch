import { LoginView } from "@/components/auth/login-view";
import { brand, brandIdOf } from "@/data/brand";
import { loginPageCopy } from "@/data/pages/login";
import { loginCopyFor } from "@/lib/auth-copy";
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
 *
 * The brand is resolved here too (issue #225): `loginCopyFor` picks which of the fixture's hero
 * sentences and stat tiles this build renders, so the view keeps asking for the same two ids
 * (`sign-in`, `stats`) and never sees a brand. The choice lives in `lib/auth-copy.ts` because
 * both auth routes need it; the shape is the one `/` already uses — one route, one component,
 * the composition chosen on the server.
 */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const target = Array.isArray(next) ? next[0] : next;

  return (
    <LoginView copy={loginCopyFor(loginPageCopy, brandIdOf(brand))} next={safeNextPath(target)} />
  );
}
