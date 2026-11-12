/**
 * `ADMIN_EMAILS` — the allowlist, enforced against a database instead of a sign-in.
 *
 * `lib/auth/admin-allowlist.ts` grants `admin` **when an allowlisted address signs in**: the rule is
 * a session's verified email, so it cannot promote anybody who is not already there. That is the
 * right rule for a request path and the wrong one for seeding, because "always seeded" means the
 * role must be true *before* the person happens to sign in — and on a fresh demo branch nobody has
 * signed in at all.
 *
 * So this module asks the same question from the other side: for every address in `ADMIN_EMAILS`,
 * does an account exist, and is its profile `admin`? Four outcomes, each a fact rather than a guess:
 *
 *   - **an auth user exists, no profile** → the profile is created as `admin` (`apply` only);
 *   - **an auth user exists, profile is `member`** → promoted, and only promoted: the `WHERE role
 *     <> 'admin'` clause is the same one the request path uses, so nothing here can write `member`;
 *   - **no auth user exists** → nothing can be granted, and pretending otherwise would be the lie
 *     this file exists to avoid. It is reported as `pending sign-in`: the allowlist promotes it the
 *     first time that address signs in, and `ADMIN_NN_EMAIL`/`ADMIN_NN_PASS` is how a durable seat is
 *     seeded today;
 *   - **the derived handle is taken** → reported as `failed`, never swallowed into a silent "seeded".
 *
 * The policy is not re-implemented here: the parser and the profile identity are imported from the
 * module the request path uses (`adminAllowlistOf`, `adminProfileHandle`, `adminProfileDisplayName`),
 * so the set that seeds admin is exactly the set a sign-in is judged by.
 *
 * Two callers, one implementation: `scripts/db-admin-ensure.mjs` applies it (`pnpm admin:ensure`),
 * and `scripts/db-verify.mjs` asks it as a check (`mode: "check"` mutates nothing).
 */

/** The allowlist as an array — the request path's own parser, not a second comma-split. */
export async function allowlistedEmails() {
  const { adminAllowlistOf, ADMIN_EMAILS_ENV } = await import("@/lib/auth/admin-allowlist.ts");
  return [...adminAllowlistOf(process.env[ADMIN_EMAILS_ENV])];
}

/** The auth user id for an address, or `null` when no `neon_auth` user answers to it. */
async function authUserId(client, email) {
  const result = await client.query(
    `SELECT id FROM neon_auth."user" WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return result.rows[0]?.id ?? null;
}

/**
 * Every allowlisted address, what its account says, and — in `apply` mode — what was done about it.
 *
 * `mode: "check"` (the default) is read-only: it classifies and changes nothing, which is what
 * `db:verify` needs. `mode: "apply"` creates or promotes the profile.
 */
export async function reconcileAllowlistedAdmins(client, { mode = "check" } = {}) {
  const { adminProfileHandle, adminProfileDisplayName } = await import(
    "@/lib/auth/admin-allowlist.ts"
  );
  const apply = mode === "apply";
  const emails = await allowlistedEmails();
  const rows = [];
  for (const email of emails) {
    const userId = await authUserId(client, email);
    if (userId === null) {
      rows.push({ email, status: "pending" });
      continue;
    }
    const existing = await client.query(`SELECT role FROM user_profile WHERE user_id = $1`, [
      userId,
    ]);
    const role = existing.rows[0]?.role ?? null;
    if (role === "admin") {
      rows.push({ email, status: "admin" });
      continue;
    }
    if (!apply) {
      rows.push({ email, status: role === null ? "would-create" : "would-promote" });
      continue;
    }
    const handle = adminProfileHandle(email, userId);
    const displayName = adminProfileDisplayName("", email);
    try {
      await client.query(
        `INSERT INTO user_profile (user_id, handle, display_name, role)
         VALUES ($1, $2, $3, 'admin')
         ON CONFLICT (user_id) DO UPDATE
           SET role = 'admin', updated_at = now()
           WHERE user_profile.role <> 'admin'`,
        [userId, handle, displayName],
      );
      rows.push({ email, status: role === null ? "created" : "promoted" });
    } catch (error) {
      rows.push({ email, status: `failed: ${error.message.slice(0, 80)}` });
    }
  }
  const count = (wanted) => rows.filter((row) => row.status === wanted).length;
  return {
    rows,
    counts: {
      total: rows.length,
      admin: count("admin"),
      changed: count("created") + count("promoted"),
      wouldChange: count("would-create") + count("would-promote"),
      pending: count("pending"),
      failed: rows.filter((row) => row.status.startsWith("failed")).length,
    },
  };
}

/**
 * The drift a gate can name: an allowlisted address **has an account** and is still not `admin`.
 * A `pending` address is not drift — there is nothing to grant yet — so it is returned as a note.
 */
export async function allowlistedAdminProblems(client) {
  const { rows, counts } = await reconcileAllowlistedAdmins(client, { mode: "check" });
  return {
    notAdmin: rows.filter((row) => row.status === "would-create" || row.status === "would-promote"),
    pending: rows.filter((row) => row.status === "pending"),
    failed: rows.filter((row) => row.status.startsWith("failed")),
    counts,
  };
}
