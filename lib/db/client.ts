/**
 * The `pg` pool — the only database driver in this repo (#145).
 *
 * Server-only by construction rather than by a marker: this module reads `DATABASE_URL`,
 * which is in no `next.config.mjs` `env` block and never reaches a browser bundle, and it is
 * imported only from server components (`app/(mainlayout)/assessment/[slug]/page.tsx`) and
 * from node scripts. There is no `server-only` package in this tree and adding one would be a
 * dependency, which this issue's scope forbids.
 *
 * The pool is created lazily, on the first query, so importing this module costs nothing and
 * `pnpm build` (which imports it to compile the route) never needs a connection string. A
 * missing `DATABASE_URL` is an error at query time with a message that names what to set.
 */
import { Pool, type QueryResultRow } from "pg";

let pool: Pool | undefined;

/** `DATABASE_URL` or a named error — never a silent `undefined` connection string. */
export function databaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (url === undefined || url === "") {
    throw new Error(
      "DATABASE_URL is not set: run `neon env pull` in the repo root (or set it in the shell) before reading an assessment from the database",
    );
  }
  return url;
}

/** The one pool. Pooled URL at runtime; `db:migrate` / `db:seed` use the unpooled one. */
export function getPool(): Pool {
  if (pool === undefined) {
    pool = new Pool({
      connectionString: databaseUrl(),
      // A serverless deployment opens many short-lived instances; five connections each is
      // already generous against Neon's pooler, and a larger pool only moves the queue.
      max: 5,
      application_name: "alignsynch",
    });
  }
  return pool;
}

/** Parameterised query, rows only. The returned shape is the caller's to validate (zod). */
export async function queryRows<T extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values as unknown[]);
  return result.rows;
}
