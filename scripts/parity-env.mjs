/**
 * The environment the parity renders see — the gate's, never the developer's (#1066).
 *
 * `pnpm parity` renders pages in two child processes, one per brand, and used to hand them
 * `...process.env`. That made the harness a fact about the caller's shell rather than about the
 * tree: with a connection string in the environment, the brand boundary's render of
 * `/admin/billing` read the **live `billing_subscription` rows of whichever branch `.env.local`
 * points at** and drew a table; with none — CI, and the gate's documented assumption that
 * `bash scripts/verify.sh` never opens a connection — the same page took its own
 * `DatabaseUnavailableError` path and drew the "could not be read" band. One harness, two renders.
 *
 * Both failure directions of that are bad. A red parity step could mean "a neighbour's seed
 * wrote a row this render parses" instead of "a rendered byte changed", which sends the next
 * reader looking for a product defect that is not there; and a developer re-running until green
 * was re-running against a branch whose contents had nothing to do with their diff.
 *
 * So the child env is built from an allowlist-by-exclusion here rather than from whatever the
 * caller had. What is stripped is exactly what a *render* could read to stop being a render: the
 * connection string and the driver's own fallbacks, the Postgres family a platform injects, and
 * the Neon namespaces — auth host and cookie secret, object storage, branch label, API key.
 * Everything else (`PATH`, the `TZ`/locale `parity.mjs` pins, the brand and version constants it
 * sets, `HOME`) passes through untouched, because those are part of the measurement.
 *
 * `process.env` is never mutated. The caller keeps its own environment: the gate runs more steps
 * after `parity`, and a `db:*` script in the same shell must still see its credentials.
 */

/**
 * Key patterns a render must not be able to read.
 *
 * Anchored on purpose, in both directions: `DATABASE_URL` is matched exactly, so a variable that
 * merely mentions it (`DATABASE_URL_LEGACY`) still reaches the child rather than being stripped by
 * a substring match; and `PG[A-Z]*` is the whole driver fallback family (`PGHOST`, `PGPORT`,
 * `PGUSER`, `PGPASSWORD`, `PGDATABASE`), which `pg` reads on its own when no URL is given.
 */
export const HERMETIC_STRIP = [/^DATABASE_URL(_UNPOOLED)?$/, /^PG[A-Z]*$/, /^POSTGRES_/, /^NEON_/];

/**
 * Would this variable name be stripped from the child env?
 *
 * @param {string} key
 * @returns {boolean}
 */
export function isStripped(key) {
  return HERMETIC_STRIP.some((pattern) => pattern.test(key));
}

/**
 * The environment to hand a parity render: `base` minus everything {@link isStripped} names.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [base]
 * @returns {Record<string, string | undefined>}
 */
export function hermeticEnv(base = process.env) {
  /** @type {Record<string, string | undefined>} */
  const clean = {};
  for (const [key, value] of Object.entries(base)) {
    if (isStripped(key)) continue;
    clean[key] = value;
  }
  return clean;
}

/**
 * The variable names {@link hermeticEnv} would drop from `base`, sorted.
 *
 * Names only, never values: this is what lets a parity run say *that* it had to become hermetic,
 * and a reader who sees `DATABASE_URL` in the gate log knows the difference between a run that
 * measured the tree and one that measured an environment without having to reproduce either.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} [base]
 * @returns {string[]}
 */
export function strippedKeys(base = process.env) {
  return Object.keys(base).filter(isStripped).sort();
}
