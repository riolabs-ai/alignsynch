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
  /**
   * The health screen's recorded artifact, carried into the deployment (#508).
   *
   * `/admin/health` reads `data/health/platform-health.json` at request time — deliberately, so a
   * recorder run changes the page without a rebuild — and Next's output tracing only follows a
   * *statically visible* `fs` path. The path here is a constant in another module, which the
   * tracer cannot resolve, so the file is named: without this a deployment renders the screen's
   * honest "the record could not be read" panel instead of its numbers.
   */
  outputFileTracingIncludes: {
    "/admin/health": ["./data/health/**"],
    /**
     * The review shelf (#665): `/admin/review` reads `docs/review/artifacts.json` at request time and
     * `/review-artifacts/[id]` serves the file that manifest names, both through constants in
     * `lib/review/artifacts.ts` — a path the tracer cannot follow statically. Naming the two
     * directories here is what makes a deployment carry the manifest and the four prototypes instead
     * of rendering the screen's honest "the catalogue could not be read" panel.
     */
    "/admin/review": [
      "./docs/review/artifacts.json",
      "./docs/review/artifacts/**",
      "./docs/changelog/releases.json",
    ],
    "/review-artifacts/[id]": [
      "./docs/review/artifacts.json",
      "./docs/review/artifacts/**",
      "./docs/changelog/releases.json",
    ],
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
   * The reset page's credential must not travel in a `Referer` header (#password-reset).
   *
   * `/reset/<token>` puts a single-use bearer credential in the URL, and a URL in the address bar
   * is a URL in every `Referer` a subresource request sends — an avatar hosted elsewhere, a
   * support widget, a font on a CDN. `no-referrer` on this path is the fix, and it is a *rule* here
   * rather than a per-page decision because it has to survive the next component that fetches
   * something from this page: the alternative is an audit of every request the reset form makes.
   *
   * `no-store` beside it for the same reason the route is `force-dynamic`: a cached copy of a page
   * that says "this link is live" would outlive the link. The meta tag in
   * `app/(auth)/reset/[token]/page.tsx` repeats the referrer rule, because a header this important
   * should not depend on a deployment's config being intact.
   */
  async headers() {
    return [
      {
        source: "/reset/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
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
      /**
       * #620 — the member's menu went from four rows to two, and `Library` was one of the three
       * "templates" doors that became the second tab of `/dashboard/templates`. The page is gone
       * (not hidden behind this redirect: a `permanent: true` source runs before the filesystem
       * route, so a page left in `app/` would be built and unreachable — the rule
       * `tests/route-redirects.test.ts` exists for). A bookmark, an external link or cached
       * markup still lands on the shelf that absorbed it.
       */
      {
        source: "/dashboard/library",
        destination: "/dashboard/templates?tab=mine",
        permanent: true,
      },
      /**
       * #877 — the member's assessment-session listing moved out of the record-kind tree.
       *
       * It lived at `/assessment/instances` and rendered `listRelationshipCards()` with no rail
       * row and no nav entry, beside `/dashboard/relationships` doing the same thing over the same
       * rows: that duplication is the confusion the owner filed. The listing is now `/assessments`
       * (plural, a sibling of `/dashboard/relationships`), and this row is what keeps a bookmark,
       * an external link or cached markup working. The page left the tree in the same commit —
       * `tests/route-redirects.test.ts` fails a `permanent: true` row whose static source is still
       * a route pattern, because a redirect runs before the filesystem route.
       *
       * **One segment, exact.** The session's own screen stays at `/assessment/instances/<id>`,
       * and a `:path*` row would swallow it and every report under it.
       */
      { source: "/assessment/instances", destination: "/assessments", permanent: true },
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
      /**
       * #794 — `assessment` is a record **kind**, and a template is not an assessment: it is the
       * thing an assessment is copied from. Every row below moves a template's address under
       * `/templates/relationship`, and the public catalogue out of the template noun entirely.
       *
       * **Enumerated, no `:path*`, and one row per real screen.** A wildcard would 308
       * `/assessment/templates/<anything>/junk` into a 404, which is worse than the 404 — the same
       * judgment that removed `/testimonials/jessica.png` above. The create tree is therefore five
       * exact rows (`create`, `create/mode`, `create/aspects`, `create/commit`, `create/account`)
       * rather than one over a `:stage` segment, because `:stage` is any one segment and the set
       * that exists is four literals plus the bare stage 1. `create/account` is the one row whose
       * destination is not itself a page under v9 (#825): the post-commit gate is retired, so that
       * bookmark lands on `create/commit`, which is the stage that asks for the account.
       *
       * **The segment is `:slug`, and the destination carries whatever it was given.** A
       * bookmarked id-shaped URL 308s with the id still in it: a redirect row cannot look a row up,
       * so `[slug]`'s read matches `slug OR id` and the page itself answers a 307 to the slug form.
       * That is the one canonicalisation this migration needs, and it lives in the page because it
       * needs a query.
       *
       * **`/templates` is a redirect, not a page.** `tests/route-redirects.test.ts` fails a
       * `permanent: true` row whose *static* source is also a route pattern — a redirect runs
       * before the filesystem route, so a page kept there would be built and unreachable. The
       * catalogue that owned this address moved to `/relationship-types` in the same commit as this
       * row (`content/routes.ts`, `lib/marketing-routes.ts`, `data/pages/budget.ts`).
       */
      { source: "/assessment/templates", destination: "/templates/relationship", permanent: true },
      {
        source: "/assessment/templates/new",
        destination: "/templates/relationship/new",
        permanent: true,
      },
      {
        source: "/assessment/templates/save",
        destination: "/templates/relationship/save",
        permanent: true,
      },
      {
        source: "/assessment/templates/:slug",
        destination: "/templates/relationship/:slug",
        permanent: true,
      },
      {
        source: "/assessment/templates/:slug/status",
        destination: "/templates/relationship/:slug/status",
        permanent: true,
      },
      {
        source: "/assessment/templates/:slug/duplicate",
        destination: "/templates/relationship/:slug/duplicate",
        permanent: true,
      },
      {
        source: "/assessment/templates/:slug/create",
        destination: "/templates/relationship/:slug/create",
        permanent: true,
      },
      {
        source: "/assessment/templates/:slug/create/mode",
        destination: "/templates/relationship/:slug/create/mode",
        permanent: true,
      },
      {
        source: "/assessment/templates/:slug/create/aspects",
        destination: "/templates/relationship/:slug/create/aspects",
        permanent: true,
      },
      {
        source: "/assessment/templates/:slug/create/commit",
        destination: "/templates/relationship/:slug/create/commit",
        permanent: true,
      },
      {
        // #825 — the gate that used to follow the create is retired; the account is stage 4, so a
        // bookmarked gate address lands on the stage that now asks for the account.
        source: "/assessment/templates/:slug/create/account",
        destination: "/templates/relationship/:slug/create/commit",
        permanent: true,
      },
      // #794 — the public catalogue stops owning the template noun. One row per page: the
      // directory and one type.
      // Since #905 the bare noun lands on the catalogue's new endpoint; a *type* id still lands on
      // the type's own page one row below, because the record pages did not move with the listing.
      { source: "/templates", destination: "/relationship-templates", permanent: true },
      //
      // **The type row excludes `relationship`, and that exclusion is load-bearing.** `/templates`
      // is no longer a page but a namespace, and the library now lives one segment inside it
      // (`/templates/relationship`). A bare `:typeId` would match that segment — redirects are
      // checked *before* the filesystem route, so the library page would be a 308 to
      // `/relationship-types/relationship`, a 404, with `next build` still listing the route. The
      // negative lookahead is the shape the Next docs use for exactly this (`/:path((?!page$).*)`),
      // `[^/]+` keeps it a single segment so no child of the library is caught either, and
      // `tests/route-redirects.test.ts` compiles every source against every live route so a future
      // edit to this row cannot reintroduce the shadow silently.
      {
        source: "/templates/:typeId((?!relationship(?:/|$))[^/]+)",
        destination: "/relationship-types/:typeId",
        permanent: true,
      },
      /**
       * #794 follow-up — the worked example was the last surface left hanging off the record
       * *kind*. `/assessment/demo/[type]` is the public report for one relationship type, so it
       * moved under the catalogue noun: `/relationship-types/[slug]/demo`. The page is gone (not
       * hidden behind this row — a `permanent: true` source runs before the filesystem route, so a
       * page left in `app/` would be built and unreachable), and a bookmark, an external link or
       * cached markup lands on the report instead of a 404.
       *
       * **One segment, no `:path*`, no lookahead.** Nothing else lives under `/assessment/demo` and
       * nothing ever lived below it: `/assessment/demo/<type>/junk` has always been a plain 404,
       * and a wildcard here would answer it with a 308 into a second 404 — the judgment that
       * removed `/testimonials/jessica.png`. The same width is why the row can sit under
       * `/assessment` at all: it is pinned to the literal `demo`, so `/assessment/instances/**`
       * (which does not move in this pass) is untouchable by it, and `tests/route-redirects.test.ts`
       * asserts both halves — the old address 308s for every type in
       * `data/relationship-types.ts`, and no instance address is caught.
       *
       * A type with no worked example (`/relationship-types/<type>/demo` answers a 404 — the report
       * needs the type's demo answers) still gets the 308 from its *old* address: the row maps an
       * address family to its canonical shape and cannot look a record up, exactly as
       * `/assessment/templates/:slug` cannot. The destination is the type's own page, so a reader
       * one hop later is on the catalogue rather than on a stale URL.
       */
      {
        source: "/assessment/demo/:type",
        destination: "/relationship-types/:type/demo",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
