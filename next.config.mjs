/** @type {import('next').NextConfig} */
const nextConfig = {
  // typescript: {
  //   ignoreBuildErrors: true,
  // },
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
