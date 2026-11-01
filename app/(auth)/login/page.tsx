import { LoginView } from "@/components/auth/login-view";
import { brand, brandIdOf } from "@/data/brand";
import { loginPageCopy } from "@/data/pages/login";
import { demoMode } from "@/lib/auth/demo-mode";
import type { DemoViewProps } from "@/lib/auth/demo-form";
import { demoCopyFor, demoSurfaceFor } from "@/lib/auth/demo-surface";
import { readDemoUnlock } from "@/lib/auth/demo-unlock-cookie";
import { signInDestination } from "@/lib/auth/next-path";
import { AFTER_SIGN_IN_BY_BRAND, GOOGLE_FAILURE_VALUE } from "@/lib/auth/paths";
import { loginCopyFor } from "@/lib/auth-copy";
import type { Metadata } from "next";
import { signInAsDemoRole } from "./demo-actions";
import { startGoogleSignIn } from "./google-actions";
import { isGoogleOnlySignIn } from "./provider-hint-actions";

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
 * two questions, in this order, and passes the answer down:
 *
 *   1. **same-site** — `safeNextPath` (`lib/auth/paths.ts`) keeps a path on this site and replaces
 *      anything else (`//host/…`, `https://…`, `javascript:…`) with the brand's destination;
 *   2. **exists on this build** — `signInDestination` (`lib/auth/next-path.ts`) replaces a path whose
 *      surface this build does not ship with that same destination. A `next` naming a quiz-only
 *      surface used to reproduce the very dead end #351 is about: `/dashboard/user` answers 404
 *      before it resolves the session, so the verifier Neon appended to the callback is never
 *      exchanged and a person who just signed in lands signed out.
 *
 * Reading `searchParams` makes this route request-time — correct for a form that must never be
 * cached with somebody's `next=`.
 *
 * **The destination is per brand** (#351): `AFTER_SIGN_IN_BY_BRAND[brandIdOf(brand)]` — `/dashboard`
 * on AlignSynch (the console Overview, ungated, and it resolves the session before anything else),
 * `/dashboard/user` on QuizHub. It is resolved here and never in the view: the view is a client
 * module and `lib/flags.ts` is server-only.
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
 *
 * The **copy** is assembled here from two server decisions and handed down as one prop. The brand
 * is resolved here (issue #225): `loginCopyFor` picks which of the fixture's hero sentences and
 * stat tiles this build renders, so the view keeps asking for the same two ids (`sign-in`,
 * `stats`) and never sees a brand; the choice lives in `lib/auth-copy.ts` because both auth routes
 * need it. The demo state then adds its own section (`demoCopyFor`): the view is handed one
 * `PageCopy` and Next serialises it into the response, so a section left in the prop is text in
 * the HTML even when nothing draws it — with demo mode off those words are absent entirely.
 *
 * **The Google-only hint is wired here** (#281, part 2). `isGoogleOnlySignIn` is a server action
 * (`./provider-hint-actions.ts`) that the form calls after a refused password, and it arrives the
 * way the demo actions do: as a function reference. The view can therefore ask one question of
 * the account rows — "does this address exist only through Google?" — and never holds a database
 * handle, a `DATABASE_URL` or a `neon_auth` query of its own.
 */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; google?: string | string[] }>;
}) {
  const { next, google } = await searchParams;
  const target = Array.isArray(next) ? next[0] : next;
  const googleFailure = (Array.isArray(google) ? google[0] : google) === GOOGLE_FAILURE_VALUE;

  /**
   * This build's post-sign-in page (#351), and the fallback for every `?next=` that fails either
   * of the two validations above. Resolved from the brand record, never from a literal, so a third
   * brand is a `tsc` error in `lib/auth/paths.ts` rather than an inherited dead end.
   */
  const brandId = brandIdOf(brand);
  const destination = AFTER_SIGN_IN_BY_BRAND[brandId];

  const mode = demoMode();
  const surface = demoSurfaceFor(mode, mode.kind === "demo" ? await readDemoUnlock() : null);
  const demo: DemoViewProps =
    surface.kind === "roles"
      ? { kind: "roles", action: signInAsDemoRole }
      : surface.kind === "entry"
        ? { kind: "entry" }
        : { kind: "off" };

  return (
    <LoginView
      copy={demoCopyFor(surface, loginCopyFor(loginPageCopy, brandId), loginPageCopy)}
      next={signInDestination(target, destination)}
      googleFailure={googleFailure}
      demo={demo}
      providerHint={isGoogleOnlySignIn}
      startGoogle={startGoogleSignIn}
    />
  );
}
