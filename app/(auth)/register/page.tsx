import { RegisterView } from "@/components/auth/register-view";
import { brand, brandIdOf } from "@/data/brand";
import { loginPageCopy } from "@/data/pages/login";
import { registerPageCopy } from "@/data/pages/register";
import { AUTH_MARK_SRC_BY_BRAND, AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { signInDestination } from "@/lib/auth/next-path";
import { AFTER_SIGN_IN_BY_BRAND } from "@/lib/auth/paths";
import { heroTilesFor, registerCopyFor } from "@/lib/auth-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
};

/**
 * `/register`. A server module on purpose: the copy is parsed here (import of
 * `data/pages/register.ts`) and handed to the client view as a prop, so the fixture's zod
 * stays out of the bundle. `data:check` E23 attributes this module and `components/auth/**`
 * to the `/register` surface.
 *
 * The brand is resolved here too (issue #225), exactly like `/login`: `registerCopyFor`
 * swaps the hero and the mobile header's line for the build's brand and leaves the form
 * alone — its two steps and its fields are one product's sign-up, shared by both brands.
 * The quiz-interests and quiz-skill step that used to open the flow was removed in #291.
 *
 * **The destination is a prop for the same reason** (#351). The view used to hardcode
 * `router.push("/dashboard/user")`, which is QuizHub's account home and a 404 on an AlignSynch
 * build — so a successful sign-up landed on a not-found page. `AFTER_SIGN_IN_BY_BRAND` names the
 * page per brand, and it is read here because the view is a client module: the brand table is
 * `lib/auth/paths.ts` (pure strings), but the choice belongs to the server half, exactly like
 * `copy`. The client never imports a brand.
 *
 * **The marks are props for the same reason** — the panel glyph and the button glyph. The view
 * used to import `BookOpen` and `Trophy` directly, so the alignment build's sign-up page carried a
 * quiz book and a quiz trophy. `AUTH_MARKS_BY_BRAND` names the mark ids per brand, and it is read
 * here because the view is a client module: the table is `lib/auth/marks.ts` (ids, no zod, no
 * components), but the choice belongs to the server half.
 *
 * **The hero is the sign-in panel, and its tiles are `/login`'s band (#971).** The owner's
 * decision (2026-11-13) is one welcome hero on both full-page auth routes and a compact stage
 * inside the create flow, so `/register` mounts the panel `login-view.tsx` used to own alone
 * (`components/auth/auth-hero.tsx`) with the same two tiles — `heroTilesFor(loginPageCopy,
 * brandId)` reads the brand's band, which is why `data/pages/register.ts` is untouched: the
 * claims about the product have one home, and a tile is reworded once.
 */
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const raw = Array.isArray(next) ? next[0] : next;
  const brandId = brandIdOf(brand);
  const destination = signInDestination(raw, AFTER_SIGN_IN_BY_BRAND[brandId]);
  return (
    <RegisterView
      copy={registerCopyFor(registerPageCopy, brandId)}
      /**
       * `?next=` is honoured here for the same reason `/login` honours it, and since #t_0aa81144
       * for one concrete caller: the Counterparty's onboarding wizard sends a visitor who has no
       * account yet to `/register?next=<step 3>`, and a sign-up that landed on the console
       * instead would drop the invitation. `signInDestination` is the same two-question
       * validation the login page runs, so an unsafe or unshipped path still falls back to the
       * brand's own destination.
       */
      destination={destination}
      marks={AUTH_MARKS_BY_BRAND[brandId]}
      markSrc={AUTH_MARK_SRC_BY_BRAND[brandId]}
      stats={heroTilesFor(loginPageCopy, brandId)}
    />
  );
}
