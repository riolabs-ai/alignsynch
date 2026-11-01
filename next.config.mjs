import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** This file's directory — the repository root, for `git` and for `package.json`. */
const ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * The running version, read from `package.json` — the one source (issue #269).
 *
 * Read here and in no other build-time place: the badge
 * (`components/layout/app-version.tsx`) prints whatever this file inlines, so a version bump is
 * one line in `package.json` and nothing else. `scripts/parity.mjs` imports *this* config rather
 * than parsing `package.json` again, so the parity render and the built page cannot disagree.
 *
 * It goes in `env` for the same reason `BRAND` does: Next inlines `env` into the browser bundle,
 * so a client component (the sidebar, the sign-in card) can print the version without a prop
 * threaded through every mount. Only public values belong here — `package.json`'s version is
 * public, `DATABASE_URL` and friends are not and must never move into this block.
 *
 * The path is resolved from this file, not `process.cwd()`: `next build` may run from a parent
 * directory in a monorepo, and a relative read would then throw at the wrong time.
 */
const { version: APP_VERSION } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

/**
 * The commit this build was made from — the value `scripts/deploy-check.mjs` reads back out of
 * production to answer "is the site serving `main`?".
 *
 * A version is not a commit. `package.json` carries one version per release candidate, so every
 * merge between two release cuts ships the same badge; the badge cannot tell a fresh production
 * from one three merges behind, which is exactly the failure that froze `alignsynch.com` at an
 * old build for hours with every check in this repository green. The commit can.
 *
 * It is baked into the artifact at build time rather than read at request time: a runtime lookup
 * would describe the environment the function happens to run in, and the point of the value is
 * to be a fact about the code that is answering.
 *
 * Three sources, in order, each a fact about this build rather than a guess:
 *
 *   1. `VERCEL_GIT_COMMIT_SHA` — the commit Vercel is building. Public, and Vercel sets it.
 *   2. `git rev-parse HEAD` — a local or CI build of a real checkout.
 *   3. `"unknown"` — no git and no Vercel (a tarball, a Docker build without `.git`).
 *
 * Case 3 is not papered over: `scripts/deploy-check.mjs` reports `UNKNOWN` for it and exits 2.
 * Inventing a plausible SHA here would be the one reading that says `OK` while production is
 * stale, which is worse than no check at all.
 */
function resolveCommit() {
  const SHA = /^[0-9a-f]{40}$/;
  const fromVercel = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").trim().toLowerCase();
  if (SHA.test(fromVercel)) return fromVercel;

  try {
    const local = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .toLowerCase();
    if (SHA.test(local)) return local;
  } catch {
    // Not a checkout. Fall through to the honest answer below.
  }

  return "unknown";
}

const APP_COMMIT = resolveCommit();

/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * The brand this build renders: `BRAND=quizhub` (default) or `BRAND=alignsynch`.
   *
   * `data/brand.ts` picks the record and the whole tree reads it from there, so this is
   * the only place the flag is turned into a value. It is declared in `env` — and not
   * just read from the shell — because Next inlines `env` into the *browser* bundle as
   * well: `brand` reaches client components (settings, the affiliate dashboard), and a
   * shell-only lookup would give the server one brand and the browser another, which is a
   * hydration mismatch and a `BRAND=alignsynch` build that still says QuizHub wherever
   * React re-renders.
   *
   * Unset or empty means the default, which is why the fallback is `||` and not `??`.
   * An unknown value is a build failure, raised by `resolveBrand` with the accepted ids.
   */
  env: {
    BRAND: process.env.BRAND || "quizhub",
    /** `package.json`'s `version`, read at the top of this file — see `AppVersion` (#269). */
    APP_VERSION,
    /**
     * The commit this build came from, resolved above. Public (the repository is public) and
     * baked in, so `/api/version` can report it and `scripts/deploy-check.mjs` can compare it
     * with `main`. Never a secret, and never resolved at request time.
     */
    APP_COMMIT,
  },
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
  /**
   * Image Optimization is off on purpose (issue #6). Deleting the flag is not the fix.
   *
   * There is no deploy target (P4): the only server is `next start` on a dev box, with no CDN
   * and no long-lived origin to amortise `/_next/image` against, so there is nothing to tune.
   *
   * Turning it on is not the config-only change `next build` makes it look like. The optimizer
   * hard-requires `sharp` (`next/dist/server/image-optimizer.js`: `require('sharp')`, and without
   * it `Module \`sharp\` not found`), while `sharp` is only next's *optionalDependency* — a
   * platform binary this repo never declares. `scripts/verify.sh` runs `next build` and never
   * `next start` plus an image fetch, so a missing or ABI-mismatched sharp is invisible to the
   * gate: green build, 500 on every image.
   *
   * It also cannot pay off on today's call sites. 21 of the 57 `<Image>` tags use `fill` and none
   * passes `sizes`, so optimized output collapses to `sizes="100vw"` with a `w=3840` candidate
   * (measured in the prerendered `/`) for a ~340 px tile. Earn the win with `sizes` first.
   *
   * Revisit when a deploy target exists (P4), those `fill` tags carry `sizes`, and the five
   * call-site dimension bugs listed under "Images" in README.md are fixed.
   */
  images: {
    unoptimized: true,
  },
  /**
   * Legacy paths the pre-P1 shell emitted and never had a page for (issue #20).
   *
   * The components now link at the real routes (`/dashboard/user`, `/register`) and
   * `data:check` fails if a hardcoded `href` drifts again. These redirects exist only
   * so an external link, a bookmark or cached markup that already points at the old
   * path does not land on a 404 — a redirect is not a second page: `app/` and
   * `content/routes.ts` stay the single source of routes.
   */
  async redirects() {
    return [
      /**
       * `/dashboard` used to be here — `{ source: "/dashboard", destination: "/dashboard/user" }`,
       * the pre-P1 shell's account path. It is gone because `/dashboard` is now a page
       * (`app/(mainlayout)/dashboard/page.tsx`, the signed-in console's Overview), and a
       * `permanent: true` redirect runs **before** the filesystem route: the page was live and
       * answering 308 to the quiz account home on every brand, i.e. built and unreachable. The
       * rule the list below states — "these exist only so a stale external link does not land on a
       * 404" — is exactly why the entry has to go: a redirect may not shadow a page, and
       * `tests/route-redirects.test.ts` now holds the whole list to it.
       */
      { source: "/earnings", destination: "/dashboard/user?tab=wallet", permanent: true },
      { source: "/analytics", destination: "/dashboard/user?tab=my-quizzes", permanent: true },
      { source: "/signup", destination: "/register", permanent: true },
      // `/testimonials/jessica.png` is deliberately NOT redirected any more (issue #155).
      // It pointed at `/avatars/mind.webp`, one of the nine shared avatar files #152
      // deleted, so it became a 308 to a 404 — worse than the 404 it replaced, because a
      // client that follows it spends a round trip to learn nothing. The honest target is
      // the generated default a person's slot draws, and a drawn default has no URL to
      // redirect to: it is a gradient and an inline SVG in the markup. The legacy path was
      // a portrait, and a portrait is what the generated avatar exists not to fabricate.
      /**
       * The tournament CTA band's two buttons (issue #112). They were never tournament
       * ids — they only reached a page because `/tournaments/[id]` answered every value
       * with the mock, which is the 200-on-unknown-id bug. With the route gating on
       * `components/tournaments/tournament-ids.ts` they would 404, so the intent paths
       * point at the route that does the job: signing up, and the editor.
       */
      { source: "/tournaments/register", destination: "/register", permanent: true },
      { source: "/tournaments/create", destination: "/create/editor", permanent: true },
      /**
       * The help centre's old URL shape (issue #165). `/support/articles/[id]` took the
       * record id — `/support/articles/kb-account-setup` — and now takes the slug like
       * the other two editorial detail routes. The id is the slug behind a `kb-` prefix
       * (`content/article.ts` §2 composes it that way), so the whole old shape is one
       * pattern, answered before the page renders: an external link, a bookmark or cached
       * markup lands on the article (308) instead of a 404.
       *
       * It is a redirect and not a second lookup in the page: an id is not a URL, and a
       * page that also resolved ids would be a second way to address one record.
       */
      {
        source: "/support/articles/kb-:slug",
        destination: "/support/articles/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
