/**
 * Deleting an account: the auth-side delete, and the scrub it is followed by (#278).
 *
 * `docs/specs/account-deletion-spec.md` is the specification this file implements; §7 is the ordered
 * build plan and the numbers below cite it. Two facts shape everything here.
 *
 * **1. There is no self-service deletion endpoint on the auth server.** `POST /delete-user`
 * answers `404` with a session — the unauthenticated `401` is only the outer gate, which is the
 * mistake the spec exists to prevent (§4.3). The working route is Neon's project API:
 *
 *     DELETE /api/v2/projects/{project_id}/branches/{branch_id}/auth/users/{user_id}
 *
 * authenticated with `NEON_API_KEY`, probed live at `204` (§4.2). `GET` on that path is `405`, so
 * the id must already be known — it is, because it is the session's `user_id`. The key is read on
 * the server, sent only in a header, and never printed: `neon()` takes it from `process.env` at
 * call time and no message below interpolates it.
 *
 * **2. The order is load-bearing, and it is the opposite of the obvious one.** The auth user is
 * deleted **before** `public` is scrubbed (§7 steps 3 → 4). A failed scrub then leaves an account
 * that can no longer sign in — the request is retryable and every remaining step is idempotent —
 * whereas the other order leaves a live account whose data is already gone, which is the one state
 * §2 forbids.
 *
 * **Why one transaction for the scrub.** `public` has no foreign key to `neon_auth` on purpose
 * (§3.2): nothing cascades, so the sweep is application-sequenced and either lands whole or not at
 * all. A half-applied sweep is a person whose seat is anonymised but whose profile still resolves.
 *
 * **What is deliberately retained**, and each is the spec's own exception (§2, §6): the seat's
 * answers (`opinion` rows carry no author column, so they are unattributable once `party.name` is
 * the label and `party.user_id` is NULL), both `accepted_at` stamps (they are half of the
 * `complete` derivation, so clearing them would empty the survivor's report), accounting rows,
 * `template_version.published_by`, and the `news_signup` suppression row.
 *
 * **Two places the spec's wording and the schema disagree, recorded here rather than in a
 * comment on a card:**
 *
 *   - §1.1 says `session.voided_by` and `session_invite.revoked_by` are **set NULL**. `0025`'s
 *     `session_voided_by_comes_with_instant` / `invite_revoked_by_comes_with_instant` CHECKs make
 *     `(voided_at IS NULL) = (voided_by IS NULL)`, so a NULL actor beside a stamped instant is
 *     not a legal row. Clearing the instant too would say "never voided" about a session that
 *     was — a lie the survivor's screen would render. So a seat this sweep voids carries
 *     `DELETION_ACTOR`, and an operator actor id is **retained** the way §6 retains
 *     `template_version.published_by`: a bare id with no name, email or account behind it is
 *     pseudonymous once the auth user is gone.
 *   - §1.1 says a suppressed `news_signup` row "drop[s] `source`". The column is `NOT NULL` with
 *     a path CHECK (`0019`), so the honest write is the `SUPPRESSION_SOURCE` marker: it says why
 *     the row is out of every audience query without inventing a NULL the schema refuses.
 *
 * Server-only by construction, like `lib/db/client.ts`: it reads `DATABASE_URL` and
 * `NEON_API_KEY`, neither of which is in `next.config.mjs`'s `env` block, and only the server
 * action (`app/(mainlayout)/settings/delete-account-actions.ts`) imports it.
 */
import type { QueryResultRow } from "pg";

import { getPool } from "@/lib/db/client";

/**
 * The slice of a `pg` client this module uses.
 *
 * A structural type rather than `Pick<PoolClient, "query">`: `pg`'s `query` is a generic overload
 * whose result type is parameterised by the row shape, and a caller that only needs `rows` and
 * `rowCount` should not have to reproduce it. It is also what lets a test hand in a recorder
 * (`tests/account-purge.test.ts`) and assert the order of statements with no socket.
 */
export interface PurgeQueryClient {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: QueryResultRow[]; rowCount: number | null }>;
}

/** A client that can also be handed back — the pool's `connect()` return shape. */
export interface PurgeConnection extends PurgeQueryClient {
  release(): void;
}

/** The label a deleted participant's seat reads (§1.1). Written, never rendered from here. */
export const DELETED_SEAT_NAME = "Deleted account";

/**
 * Who a void written by this sweep is attributed to.
 *
 * Not a person and not an operator id: the seat was voided because its holder's account was
 * deleted, and `session_voided_by_comes_with_instant` will not accept a stamped instant without
 * an actor. The screen renders the session as `voided` and never reads this value.
 */
export const DELETION_ACTOR = "account-deletion";

/** What a suppression row's `source` becomes (§6). A path, because `0019`'s CHECK demands one. */
export const SUPPRESSION_SOURCE = "/account-deleted";

/** The identity read in §7 step 2, before the auth user is destroyed. */
export interface PurgeIdentity {
  /** Neon Auth's user id — the join key every sweep predicate uses. */
  readonly userId: string;
  /** The address, lowercased: the only key for the email-addressed tables (§1.4). */
  readonly email: string;
  /** Every `party.name` this account holds — the search strings for §1.2's prose rewrite. */
  readonly names: readonly string[];
  /** The roles whose seats this account holds. Decides the `session_invite` row decision (§2.6). */
  readonly roles: readonly string[];
}

/** How many rows each step touched — the audit line a run has to be able to show. */
export interface PurgeCounts {
  readonly sessionsVoided: number;
  readonly sessionInvitesDeleted: number;
  readonly sessionInvitesUnaddressed: number;
  readonly recordSummariesRewritten: number;
  readonly sessionNamesRewritten: number;
  readonly partiesAnonymised: number;
  readonly relationshipsDeidentified: number;
  readonly relationshipMembersDeleted: number;
  readonly coachInvitesDeleted: number;
  readonly adminInvitesDeleted: number;
  readonly passwordResetsDeleted: number;
  readonly adminActionsRedacted: number;
  readonly recordsArchived: number;
  readonly profilesDeleted: number;
  readonly contactMessagesDeleted: number;
  readonly newsSignupsSuppressed: number;
}

/** The zero counts — what a run that changed nothing returns. */
export function emptyPurgeCounts(): PurgeCounts {
  return {
    sessionsVoided: 0,
    sessionInvitesDeleted: 0,
    sessionInvitesUnaddressed: 0,
    recordSummariesRewritten: 0,
    sessionNamesRewritten: 0,
    partiesAnonymised: 0,
    relationshipsDeidentified: 0,
    relationshipMembersDeleted: 0,
    coachInvitesDeleted: 0,
    adminInvitesDeleted: 0,
    passwordResetsDeleted: 0,
    adminActionsRedacted: 0,
    recordsArchived: 0,
    profilesDeleted: 0,
    contactMessagesDeleted: 0,
    newsSignupsSuppressed: 0,
  };
}

/** One statement of the sweep: a count key, the SQL, and how its values are derived. */
export interface PurgeStep {
  readonly key: keyof PurgeCounts;
  readonly sql: string;
  readonly values: (identity: PurgeIdentity) => readonly unknown[];
}

/**
 * The complete-session predicate, as SQL — `instanceStatusOf()` (`lib/flow/state.ts`) restated.
 *
 * A session is `complete` when a seat of each role exists, the copy holds at least one Aspect,
 * both seats have answered every Aspect, and **both** `accepted_at` stamps are set. The
 * acceptance hinge is the half `POPULATION_SQL`/`GAP_ROWS_SQL` predate; it is repeated here
 * because voiding a session the flow considers complete is what empties the survivor's report
 * (§2.3), so this predicate is the guard that must not drift from the product's own rule.
 */
const COMPLETE_SESSIONS = `
  aspect_count AS (
    SELECT i.record_id, count(*)::int AS items FROM item i GROUP BY i.record_id
  ), answered AS (
    SELECT o.session_record_id, o.role, count(*)::int AS answered
    FROM opinion o GROUP BY o.session_record_id, o.role
  ), held AS (
    SELECT p.session_record_id AS record_id, p.role, p.name
    FROM party p
    WHERE p.user_id = $1
  ), complete AS (
    SELECT s.record_id
    FROM session s
    LEFT JOIN aspect_count ac ON ac.record_id = s.record_id
    LEFT JOIN answered ia ON ia.session_record_id = s.record_id AND ia.role = 'initiator'
    LEFT JOIN answered ca ON ca.session_record_id = s.record_id AND ca.role = 'counterparty'
    WHERE EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = s.record_id AND p.role = 'initiator')
      AND EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = s.record_id AND p.role = 'counterparty')
      AND COALESCE(ac.items, 0) > 0
      AND COALESCE(ia.answered, 0) >= COALESCE(ac.items, 0)
      AND COALESCE(ca.answered, 0) >= COALESCE(ac.items, 0)
      AND EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = s.record_id AND p.role = 'initiator'
                     AND p.accepted_at IS NOT NULL)
      AND EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = s.record_id AND p.role = 'counterparty'
                     AND p.accepted_at IS NOT NULL)
  )`;

/**
 * The sweep, in §7 step 4's order — as data, so the order is a thing a test can read.
 *
 * Every statement is self-limiting: it matches only rows still holding what it removes. That is
 * what makes a second run report zeroes and change nothing, which is the property that makes the
 * scrub retryable after a partial failure (the auth user is already gone by then).
 *
 * The order matters in three specific places, and each is a bug if reversed:
 *
 *   - sessions are voided **before** the seat is anonymised, because the guard has to read
 *     `party.accepted_at` while deciding (§2.3 forbids voiding a complete one);
 *   - `record.summary` and `session.name` are rewritten **before** `party.name` is replaced, so
 *     the search string is still the person's name and not the label;
 *   - `user_profile` is deleted last but one, after every statement that joins it by handle.
 */
export function buildPurgeSteps(identity: PurgeIdentity): readonly PurgeStep[] {
  const steps: PurgeStep[] = [];

  // §2.4 — an incomplete session is voided, never a complete one. `voided_by` is stamped with
  // the deletion actor because the pairing CHECK refuses an instant without an actor; see the
  // module docstring.
  steps.push({
    key: "sessionsVoided",
    sql: `
      WITH ${COMPLETE_SESSIONS}
      UPDATE session s
         SET voided_at = now(), voided_by = $2
        FROM held h
       WHERE h.record_id = s.record_id
         AND s.voided_at IS NULL
         AND s.record_id NOT IN (SELECT record_id FROM complete)`,
    values: () => [identity.userId, DELETION_ACTOR],
  });

  // §2.6 — the invitation row decision. The Counterparty's address and name are `NOT NULL`, so
  // the row goes when that seat's holder leaves; the Initiator's address is nullable, so it is
  // cleared and the row (and its consumed token) stays with the session the survivor still owns.
  if (identity.roles.includes("counterparty")) {
    steps.push({
      key: "sessionInvitesDeleted",
      sql: `
        DELETE FROM session_invite i
         USING party p
         WHERE p.user_id = $1
           AND p.role = 'counterparty'
           AND p.session_record_id = i.session_record_id`,
      values: () => [identity.userId],
    });
  }
  if (identity.roles.includes("initiator")) {
    steps.push({
      key: "sessionInvitesUnaddressed",
      sql: `
        UPDATE session_invite i
           SET initiator_email = NULL
          FROM party p
         WHERE p.user_id = $1
           AND p.role = 'initiator'
           AND p.session_record_id = i.session_record_id
           AND i.initiator_email IS NOT NULL`,
      values: () => [identity.userId],
    });
  }

  // §1.2 — the prose, one mechanism for both columns: an exact-substring replacement of the
  // seat's own `party.name`. Scoped to the records of the sessions this account holds a seat in,
  // so a template that happens to carry the same words is not rewritten.
  for (const name of identity.names) {
    if (name.trim() === "" || name === DELETED_SEAT_NAME) continue;
    steps.push({
      key: "recordSummariesRewritten",
      sql: `
        UPDATE record r
           SET summary = replace(r.summary, $2, $3)
          FROM party p
         WHERE p.user_id = $1
           AND p.name = $2
           AND r.id = p.session_record_id
           AND position($2 IN r.summary) > 0`,
      values: () => [identity.userId, name, DELETED_SEAT_NAME],
    });
    steps.push({
      key: "sessionNamesRewritten",
      sql: `
        UPDATE session s
           SET name = replace(s.name, $2, $3)
          FROM party p
         WHERE p.user_id = $1
           AND p.name = $2
           AND s.record_id = p.session_record_id
           AND s.name IS NOT NULL
           AND position($2 IN s.name) > 0`,
      values: () => [identity.userId, name, DELETED_SEAT_NAME],
    });
  }

  // §1.1 — the seat. The name becomes the label, the account binding and every credential-bearing
  // column are cleared, and `submitted_at` / `accepted_at` are retained: they are what keeps the
  // survivor's session `complete` (§2.3).
  steps.push({
    key: "partiesAnonymised",
    sql: `
      UPDATE party
         SET name = $2,
             user_id = NULL,
             access_token_hash = NULL,
             unlock_seen_at = NULL,
             impersonated_by = NULL
       WHERE user_id = $1`,
    values: () => [identity.userId, DELETED_SEAT_NAME],
  });

  steps.push({
    key: "relationshipsDeidentified",
    sql: `
      UPDATE relationship
         SET initiator_user_id = NULLIF(initiator_user_id, $1),
             counterparty_user_id = NULLIF(counterparty_user_id, $1)
       WHERE initiator_user_id = $1 OR counterparty_user_id = $1`,
    values: () => [identity.userId],
  });

  steps.push({
    key: "relationshipMembersDeleted",
    sql: "DELETE FROM relationship_member WHERE user_id = $1",
    values: () => [identity.userId],
  });

  steps.push({
    key: "coachInvitesDeleted",
    sql: "DELETE FROM coach_invite WHERE invited_by_user_id = $1 OR lower(btrim(email)) = $2",
    values: () => [identity.userId, identity.email],
  });

  steps.push({
    key: "adminInvitesDeleted",
    sql: "DELETE FROM admin_invite WHERE lower(btrim(email)) = $1",
    values: () => [identity.email],
  });

  steps.push({
    key: "passwordResetsDeleted",
    sql: "DELETE FROM password_reset WHERE user_id = $1 OR lower(btrim(email)) = $2",
    values: () => [identity.userId, identity.email],
  });

  // §6 — the audit row keeps its action, actor and reason; the two JSONB payloads are the only
  // place a profile field can hide, so they are the thing that goes. The spec names "those keys"
  // without enumerating them; nulling the payload is the fail-closed reading of it.
  steps.push({
    key: "adminActionsRedacted",
    sql: `
      UPDATE admin_action
         SET before = NULL, after = NULL
       WHERE actor_user_id = $1 AND (before IS NOT NULL OR after IS NOT NULL)`,
    values: () => [identity.userId],
  });

  // §1.3 — a private template is archived and de-owned, never deleted: `template_version` and
  // `session` reference it without a cascade, so a delete would either fail or take the
  // survivor's session with it.
  steps.push({
    key: "recordsArchived",
    sql: `
      UPDATE record r
         SET owner_user_id = NULL,
             author_user_id = NULLIF(r.author_user_id, $1),
             status = CASE WHEN r.owner_user_id = $1 THEN 'archived' ELSE r.status END
       WHERE r.owner_user_id = $1 OR r.author_user_id = $1`,
    values: () => [identity.userId],
  });

  steps.push({
    key: "profilesDeleted",
    sql: "DELETE FROM user_profile WHERE user_id = $1",
    values: () => [identity.userId],
  });

  // §6 — a support message is deleted (24 months or on request); its replies cascade with it.
  steps.push({
    key: "contactMessagesDeleted",
    sql: "DELETE FROM contact_message WHERE assigned_user_id = $1 OR lower(btrim(email)) = $2",
    values: () => [identity.userId, identity.email],
  });

  // §6 — the suppression list. The address and the consent instant stay; `source` becomes the
  // marker, and the row leaves every audience query because it is unsubscribed.
  steps.push({
    key: "newsSignupsSuppressed",
    sql: `
      UPDATE news_signup
         SET source = $2, unsubscribed_at = COALESCE(unsubscribed_at, now())
       WHERE lower(btrim(email)) = $1
         AND (source <> $2 OR unsubscribed_at IS NULL)`,
    values: () => [identity.email, SUPPRESSION_SOURCE],
  });

  return steps;
}

/**
 * Run the sweep in one transaction, one statement per step, in the order the spec gives.
 *
 * Returns a count per table so a run is auditable: "the profile row is gone" and "the profile row
 * was never there" are different answers to the question a support reply has to answer.
 *
 * A failure rolls the whole transaction back and rethrows. By the time this runs the auth user is
 * already deleted, so a throw means "the scrub did not land, run it again" — which is the state
 * §7 step 3 chose on purpose.
 */
export async function purgeAccount(
  client: PurgeQueryClient,
  identity: PurgeIdentity,
): Promise<PurgeCounts> {
  const counts: Record<keyof PurgeCounts, number> = { ...emptyPurgeCounts() };
  const steps = buildPurgeSteps(identity);

  await client.query("BEGIN");
  try {
    for (const step of steps) {
      const result = await client.query(step.sql, step.values(identity) as unknown[]);
      counts[step.key] += result.rowCount ?? 0;
    }
    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is already gone; the server rolled the transaction back with it.
    }
    throw error;
  }
  return counts;
}

/* ------------------------------------------------------------------ *
 * The auth-side delete (§4.2, §7 step 3)
 * ------------------------------------------------------------------ */

/** The managed-auth delete did not answer `204`. Nothing has been scrubbed when this is thrown. */
export class AuthUserDeleteError extends Error {
  /** What the API answered, said for a log line — never the request's credential. */
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = "AuthUserDeleteError";
    this.status = status;
  }
}

const NEON_API = "https://console.neon.tech/api/v2";

/**
 * One Neon API request. The key goes in the header and nowhere else.
 *
 * Every message this function builds names the **method, path and status**; none interpolates
 * the key, and a failed response's body is included only for a 4xx/5xx because Neon's errors name
 * the object it refused (never the credential, which is not echoed back).
 */
async function neon(method: string, path: string): Promise<{ status: number; body: unknown }> {
  const key = process.env.NEON_API_KEY?.trim() ?? "";
  if (key === "") {
    throw new AuthUserDeleteError(
      "NEON_API_KEY is not set: the auth user cannot be deleted, so nothing was scrubbed",
      null,
    );
  }
  const response = await fetch(`${NEON_API}${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text === "" ? null : (JSON.parse(text) as unknown);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

/**
 * The project the key is scoped to.
 *
 * **`NEON_PROJECT_ID` is the deployment's answer, and on this project it is the only one that
 * works.** `NEON_API_KEY` is a *project-scoped* key: `GET /projects` answers `404`
 * `not allowed to perform actions outside the project this key is scoped to`, so listing is not a
 * fallback a project key can use — measured 2026-11-07 while building this. The list branch below
 * therefore stays for an org-scoped key (one project visible), and a refusal names the variable to
 * set instead of pretending the project does not exist.
 */
async function projectId(): Promise<string> {
  const named = process.env.NEON_PROJECT_ID?.trim();
  if (named !== undefined && named !== "") return named;
  const { status, body } = await neon("GET", "/projects");
  if (status !== 200) {
    throw new AuthUserDeleteError(
      `NEON_PROJECT_ID is not set and GET /projects answered ${String(status)} — a project-scoped NEON_API_KEY cannot list projects, so set NEON_PROJECT_ID to the project this app runs on`,
      status,
    );
  }
  const projects = (body as { projects?: { id?: string }[] } | null)?.projects ?? [];
  const only = projects.length === 1 ? projects[0]?.id : undefined;
  if (only === undefined) {
    throw new AuthUserDeleteError(
      `NEON_API_KEY sees ${String(projects.length)} project(s) — set NEON_PROJECT_ID so the deletion names one`,
      status,
    );
  }
  return only;
}

/**
 * The branch this deployment's auth server lives on.
 *
 * Read from `NEON_BRANCH` when it is set, else resolved from the endpoint in
 * `NEON_AUTH_BASE_URL` — the auth host names the branch's endpoint (`ep-…neonauth…`), and that is
 * the branch whose users this app can actually sign in. The endpoint → branch mapping is the
 * control-plane's, not ours, so it is asked rather than assumed.
 */
async function branchId(project: string): Promise<string> {
  const { status, body } = await neon("GET", `/projects/${encodeURIComponent(project)}/branches`);
  if (status !== 200) {
    throw new AuthUserDeleteError(
      `GET /projects/${project}/branches answered ${String(status)}`,
      status,
    );
  }
  const branches =
    (body as { branches?: { id?: string; name?: string; default?: boolean }[] } | null)?.branches ??
    [];
  const named = process.env.NEON_BRANCH?.trim();
  if (named !== undefined && named !== "") {
    const match = branches.find((branch) => branch.name === named);
    if (match?.id === undefined) {
      throw new AuthUserDeleteError(
        `NEON_BRANCH names "${named}" and this project has no such branch`,
        status,
      );
    }
    return match.id;
  }
  const fallback = branches.find((branch) => branch.default === true) ?? branches[0];
  if (fallback?.id === undefined) {
    throw new AuthUserDeleteError(`project ${project} has no branch to delete from`, status);
  }
  return fallback.id;
}

/**
 * Delete the managed-auth user (§4.2). Expects `204`.
 *
 * This is **not** a Better Auth call: the deployment does not mount `/delete-user` (§4.3), so the
 * SDK's `deleteUser` is inert here and the project API is the route that exists. `GET` on the
 * same path answers `405` — the id must already be known, which is why the caller passes one.
 */
export async function deleteAuthUser(userId: string): Promise<void> {
  const project = await projectId();
  const branch = await branchId(project);
  const path = `/projects/${encodeURIComponent(project)}/branches/${encodeURIComponent(branch)}/auth/users/${encodeURIComponent(userId)}`;
  const { status, body } = await neon("DELETE", path);
  if (status !== 204) {
    const detail = typeof body === "string" ? body.slice(0, 200) : JSON.stringify(body ?? null);
    throw new AuthUserDeleteError(
      `DELETE ${path} answered ${String(status)}: ${detail} — nothing was scrubbed, the account still works, retry the request`,
      status,
    );
  }
}

/* ------------------------------------------------------------------ *
 * The whole sequence (§7 steps 2 → 3 → 4)
 * ------------------------------------------------------------------ */

/** What one deletion attempt answered. */
export type AccountDeletionOutcome =
  /**
   * The auth user is gone and the sweep committed. A **resume** after a failed scrub answers the
   * same thing, with the counts the sweep produced — which is what makes §7's re-run a re-run and
   * not a second deletion.
   */
  | { readonly kind: "deleted"; readonly counts: PurgeCounts }
  /**
   * No auth user carries that id **and** no deletion was left unfinished: there is nothing to
   * delete and nothing was touched.
   */
  | { readonly kind: "unknown-account" }
  /** The auth-side delete failed, so the scrub never ran. The account still works. */
  | { readonly kind: "auth-failed"; readonly reason: string };

/** Where the auth-side delete comes from — injectable so the failure path can be exercised. */
export interface AccountDeletionOptions {
  /** The managed-auth delete. Defaults to `deleteAuthUser`. */
  readonly deleteAuth?: (userId: string) => Promise<void>;
  /** The connection the sweep runs on. Defaults to the app's pool. */
  readonly connect?: () => Promise<PurgeConnection>;
}

/** The auth users table this branch actually has — `user` on Neon, `users` elsewhere. */
async function authUserOf(
  client: PurgeQueryClient,
  userId: string,
): Promise<{ id: string; email: string } | null> {
  const tables = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'neon_auth' AND table_name IN ('user', 'users')
      ORDER BY table_name`,
  );
  const table = (tables.rows[0] as { table_name?: string } | undefined)?.table_name;
  if (table === undefined) return null;
  const { rows } = await client.query(
    `SELECT id::text AS id, email::text AS email FROM neon_auth."${table}" WHERE id::text = $1`,
    [userId],
  );
  const row = rows[0] as { id: string; email: string } | undefined;
  if (row === undefined) return null;
  return { id: row.id, email: row.email.toLowerCase() };
}

/** The seats an account holds, read before anything is destroyed (§7 step 2). */
async function seatsOf(
  client: PurgeQueryClient,
  userId: string,
): Promise<{ names: string[]; roles: string[] }> {
  const { rows } = await client.query(
    "SELECT name, role FROM party WHERE user_id = $1 ORDER BY session_record_id, role",
    [userId],
  );
  const seats = rows as { name: string; role: string }[];
  return {
    names: [...new Set(seats.map((row) => row.name))],
    roles: [...new Set(seats.map((row) => row.role))],
  };
}

/* ------------------------------------------------------------------ *
 * The identity record (§7 step 2b) — what a failed scrub resumes from
 * ------------------------------------------------------------------ */

/**
 * Write the durable copy of the identity, **before** the auth user is destroyed.
 *
 * `0014_relationship_membership`-era `public` holds no address joined to an account id (`0003` and
 * `0023` both refuse a second copy of a credential store), so an attempt that loses this in memory
 * can never rebuild it: a re-derivation finds the seats and no email, and the email-keyed rows of
 * §1.1 outlive the sweep. This row is the retry, which is why it is written on the near side of
 * the irreversible call and not the far side.
 *
 * Written once per attempt and keyed by the account, so a second attempt (a fresh one, or the
 * resume after a failed scrub) rewrites the same row instead of accumulating. `started_at`
 * deliberately survives the conflict: it is the instant the first attempt began, which is the one
 * an operator wants.
 */
async function recordIntent(client: PurgeQueryClient, identity: PurgeIdentity): Promise<void> {
  await client.query(
    `INSERT INTO account_deletion_job (user_id, email, names, roles, started_at, finished_at)
     VALUES ($1, $2, $3::text[], $4::text[], now(), NULL)
     ON CONFLICT (user_id) DO UPDATE
        SET email = EXCLUDED.email,
            names = EXCLUDED.names,
            roles = EXCLUDED.roles,
            finished_at = NULL`,
    [identity.userId, identity.email, identity.names, identity.roles],
  );
}

/**
 * The identity an unfinished attempt left behind — `null` when there is none.
 *
 * This is the only read that can answer after step 3 has run: the auth user is gone, so
 * `authUserOf()` finds nothing, and the seats cannot supply the address. An id with a **finished**
 * row is a deletion that already landed (the row's identity columns are cleared by then), and one
 * with no row at all was never started, so both answer `null` and the caller reports
 * `unknown-account` — which is also what keeps a second request against a deleted account a no-op.
 */
async function openIntentOf(
  client: PurgeQueryClient,
  userId: string,
): Promise<PurgeIdentity | null> {
  const { rows } = await client.query(
    `SELECT user_id::text AS user_id, email::text AS email, names, roles
       FROM account_deletion_job
      WHERE user_id = $1 AND finished_at IS NULL`,
    [userId],
  );
  const row = rows[0] as
    | { user_id: string; email: string; names: string[]; roles: string[] }
    | undefined;
  if (row === undefined) return null;
  return { userId: row.user_id, email: row.email, names: row.names, roles: row.roles };
}

/**
 * The sweep landed: stamp the instant and drop the identity in one statement.
 *
 * Both halves in one UPDATE, because the table's CHECK refuses a finished row that still carries
 * an address: "finished" and "no longer holding the person's email" are the same fact, and a
 * cleanup that could land separately would be a row that is neither.
 */
async function finishIntent(client: PurgeQueryClient, userId: string): Promise<void> {
  await client.query(
    `UPDATE account_deletion_job
        SET finished_at = now(), email = NULL, names = '{}', roles = '{}'
      WHERE user_id = $1 AND finished_at IS NULL`,
    [userId],
  );
}

/**
 * The auth delete failed, so no deletion happened: the intent row goes with it.
 *
 * Best effort on its own connection and every failure swallowed, deliberately. The account still
 * exists and still works, so a leftover row is a duplicate of what `neon_auth` already holds — not
 * a leak, and the next attempt rewrites it. Turning a cleanup failure into the answer to the
 * request would report a failed deletion as something other than `auth-failed`, which is the one
 * answer that must stay exact.
 */
async function abandonIntent(
  connect: () => Promise<PurgeConnection>,
  userId: string,
): Promise<void> {
  try {
    const client = await connect();
    try {
      await client.query(
        "DELETE FROM account_deletion_job WHERE user_id = $1 AND finished_at IS NULL",
        [userId],
      );
    } finally {
      client.release();
    }
  } catch {
    // Nothing to report: see the docstring.
  }
}

/**
 * Delete one account: read who it is, record it, delete the auth user, then scrub `public`.
 *
 * The steps are the spec's, in the spec's order, and the return value says which of the three
 * states the attempt reached. `unknown-account` is answered from the read: an id with no auth row
 * **and no unfinished deletion behind it** is a deletion that already happened.
 *
 * **A failed scrub is resumable, and that is step 2b's whole purpose.** Everything between the
 * identity read and the sweep is durable or irreversible, so the one state §7 can leave behind —
 * auth gone, `public` rolled back — is answered by `account_deletion_job` rather than by memory: a
 * second call for the same id skips step 3 (there is no auth user to delete, and asking the API
 * again would answer 404 and read as a failure), runs the same steps with the recorded identity,
 * and reports the same counts a first-run success would. The row is cleared by that commit.
 *
 * The person cannot drive that retry themselves: their session dies with the auth user (measured
 * on the demo branch — `get-session` answers `200` and names no user), so `deleteAccountAction`
 * answers `unauthorized` before it could reach this function. The caller that resumes is an
 * operator with the id — the spec's §7 names the query and the call.
 *
 * Nothing here trusts a caller's claim about who they are — the id comes from the session
 * (`currentUser()`) or from the runbook, and the email and seat names come from the database.
 */
export async function runAccountDeletion(
  userId: string,
  options: AccountDeletionOptions = {},
): Promise<AccountDeletionOutcome> {
  const connect = options.connect ?? (() => getPool().connect());
  const deleteAuth = options.deleteAuth ?? deleteAuthUser;

  const reader = await connect();
  let identity: PurgeIdentity | null = null;
  /** Whether the auth row was still there — i.e. whether there is a step 3 left to run. */
  let authUserPresent = false;
  try {
    const user = await authUserOf(reader, userId);
    if (user !== null) {
      const seats = await seatsOf(reader, userId);
      identity = { userId: user.id, email: user.email, ...seats };
      authUserPresent = true;
      // Step 2b, before the irreversible call: if this write fails nothing has been deleted and
      // the caller can simply try again, which is the direction a failure here must point.
      await recordIntent(reader, identity);
    } else {
      identity = await openIntentOf(reader, userId);
    }
  } finally {
    reader.release();
  }
  if (identity === null) return { kind: "unknown-account" };

  // Step 3, before any scrub: an account that cannot be deleted must not lose its data. Skipped on
  // the resume path, where the auth user is already gone and a second DELETE would answer 404.
  if (authUserPresent) {
    try {
      await deleteAuth(userId);
    } catch (error) {
      // A `404` is not "the delete failed", it is "somebody already deleted it" — a second request
      // that raced this one, or an operator's runbook call. The row is then **that** attempt's
      // resume record, so it is left alone; every other failure deleted nothing and takes the row
      // with it.
      const alreadyGone = error instanceof AuthUserDeleteError && error.status === 404;
      if (!alreadyGone) await abandonIntent(connect, userId);
      return {
        kind: "auth-failed",
        reason: error instanceof Error ? error.message : "the auth user could not be deleted",
      };
    }
  }

  const client = await connect();
  try {
    const counts = await purgeAccount(client, identity);
    await finishIntent(client, userId);
    return { kind: "deleted", counts };
  } finally {
    client.release();
  }
}
