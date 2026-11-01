/**
 * `GET /api/version` — which build is answering, unauthenticated, so a freshness check can ask
 * production directly instead of trusting a deploy list.
 *
 * Why this route exists at all: `bash scripts/verify.sh` is network-free by contract (`AGENTS.md`:
 * the gate "never opens a connection"), so it can never see a deployment, and `alignsynch.com`
 * served a stale build three times in one day with every local check green. The remedy is an
 * out-of-band check (`scripts/deploy-check.mjs`), and a check can only be honest if production
 * states its own commit rather than having one inferred from a list of deployments.
 *
 * Why it is the badge's information and not a second source: both values come from `next.config.mjs`
 * at build time (`APP_VERSION` from `package.json`, `APP_COMMIT` the commit that was compiled), and
 * both are inlined into the bundle. Nothing is read from the request, the clock or the environment
 * at run time, so the answer describes the artifact that is serving — which is the question.
 *
 * Why it is public: it carries no user, no session and no secret, and the repository is public, so
 * a commit SHA here reveals nothing that `github.com/riolabs-ai/alignsynch` does not. Requiring a
 * token would mean the check could only run where a token exists, which is precisely the state
 * that let production go stale unnoticed.
 *
 * Why `no-store`: the value belongs to one deployment. A CDN copy of a `READY` answer must never
 * outlive the deployment it describes, or the check would report the previous build as current —
 * the failure it exists to catch.
 *
 * `unknown` is a real answer, not a fallback: a build made without git and without Vercel cannot
 * know its commit, and `deploy-check.mjs` reports `UNKNOWN` (exit 2) for it. Never substitute a
 * guess.
 */
export const dynamic = "force-dynamic";

/** The build's own version and commit. Both are `next.config.mjs` values, inlined at build time. */
export function GET(): Response {
  return Response.json(
    {
      version: process.env.APP_VERSION ?? "",
      commit: process.env.APP_COMMIT ?? "unknown",
    },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "cdn-cache-control": "no-store",
      },
    },
  );
}
