/**
 * Which build is answering — one implementation, two readers (#893).
 *
 * `GET /api/version` answers this pair so a freshness check can ask production directly instead of
 * trusting a deploy list (`scripts/deploy-check.mjs`). `/admin/docs/releases` prints the same pair
 * beside the release the record says is newest, which is how an operator sees whether the build
 * they are looking at is the release they think it is.
 *
 * **Both values are `next.config.mjs`'s, inlined at build time.** `env` carries `APP_VERSION` from
 * `package.json` and `APP_COMMIT` from the commit that was compiled, so both describe the artifact
 * that is serving — nothing here reads a request, a clock or the filesystem.
 *
 * **Why a module rather than a second read.** The screen must not fetch its own route: a render has
 * no business opening a socket (the gate has no network, and a self-call during a build or behind an
 * auth wall is a failure nobody asked for). Importing the function the route calls is the same
 * answer with no request, and it keeps one spelling of the two variable names.
 */

/** The build's own version and commit, as the serving artifact knows them. */
export interface BuildInfo {
  /** `package.json`'s version at build time, or `""` on a build that could not read it. */
  readonly version: string;
  /** The compiled commit, or `"unknown"` — a real answer, never a guess. */
  readonly commit: string;
}

/** The pair `GET /api/version` answers, read from the build-time values. */
export function buildInfo(): BuildInfo {
  return {
    version: process.env.APP_VERSION ?? "",
    commit: process.env.APP_COMMIT ?? "unknown",
  };
}
