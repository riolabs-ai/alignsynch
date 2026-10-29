/** @type {import('next').NextConfig} */
const nextConfig = {
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
      { source: "/dashboard", destination: "/dashboard/user", permanent: true },
      { source: "/earnings", destination: "/dashboard/user?tab=wallet", permanent: true },
      { source: "/analytics", destination: "/dashboard/user?tab=my-quizzes", permanent: true },
      { source: "/signup", destination: "/register", permanent: true },
      { source: "/testimonials/jessica.png", destination: "/avatars/mind.webp", permanent: true },
    ];
  },
};

export default nextConfig;
