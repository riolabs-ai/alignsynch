/**
 * The proof that each platform-admin seat can sign in — the rule, the verdict and the wording,
 * with no database, no HTTP and no environment.
 *
 * `scripts/db-seed.mjs` runs its seed at import, which makes any rule left inside it untestable —
 * the same reason `db-seed-lock.mjs` exists. This module holds the part of the admin pass that
 * *decides* something.
 *
 * Why the seed asks at all. Converging a seat (`created` / `reconciled` / `rotated`) proves a row
 * was written, not that anybody can get in: the branch can carry `user_profile.role = 'admin'` and
 * an auth user the sign-in endpoint refuses, which is precisely what "the two Admin users auth
 * working" looked like on the demo — a `401 INVALID_EMAIL_OR_PASSWORD` on both seats while the
 * profile rows said `admin`. So for every configured seat the seed signs in through the branch's
 * own `/sign-in/email` with the credential it just converged the seat on, and this module says what
 * the answer means. Three rules, each one a decision:
 *
 *   - **`200` is proved, and it is the only proof.** Nothing else is read as success — not a
 *     session row, not the profile, not a sign-up that returned an id.
 *   - **`401` and `403` fail the run.** `401 INVALID_EMAIL_OR_PASSWORD` after the seed itself wrote
 *     that credential means the auth server it talked to is not the one behind the `DATABASE_URL`
 *     it wrote rows into (a credential on file with somebody else, or none at all), and
 *     `403 INVALID_ORIGIN` means the branch does not trust `DEMO_ORIGIN`. Both are states the
 *     product cannot ship in, and a seed that prints `created` beside either is the reason this
 *     module exists.
 *   - **Every other status is inconclusive and does not fail the run.** A `429` is the auth
 *     service rate-limiting the seed's own traffic (it has just signed five accounts up) and a
 *     `5xx` is the service being unwell; neither is evidence about the credential, and failing on
 *     them would make a content seed flaky for a fact it cannot establish. They are printed, so the
 *     operator sees that this run proved less than a green line suggests.
 *
 * **No function here accepts a password.** That is why no line can print one: the guarantee is the
 * shape of the arguments, not a review of the strings. A caller that passes extra fields gets them
 * ignored, which `tests/demo-admin-seats.test.ts` asserts by handing a sentinel value in.
 */

/** The only status that proves the seat's credential is the account's. */
export const SEAT_SIGN_IN_PROVED = 200;

/** Statuses that mean the seat is refused rather than unproven — the two the seed fails on. */
export const SEAT_SIGN_IN_REFUSED = new Set([401, 403]);

/**
 * What one seat's answer means: `proved` (200), `refused` (401/403 — the run fails) or `unknown`
 * (anything else — printed, not fatal).
 *
 * @param {{ email: string, status: number }} proof
 * @returns {"proved" | "refused" | "unknown"}
 */
export function seatProofOutcome(proof) {
  if (proof.status === SEAT_SIGN_IN_PROVED) return "proved";
  return SEAT_SIGN_IN_REFUSED.has(proof.status) ? "refused" : "unknown";
}

/**
 * One line per seat: `○` proved, `!` refused, `?` inconclusive.
 *
 * The address and the status are the whole line. A refused seat says what it means in the same
 * breath, because the operator's next question is always "so what do I do" — and the answer is not
 * "retry the seed". The inconclusive line says the run proved nothing about that seat instead of
 * borrowing the vocabulary of a failure.
 *
 * @param {{ email: string, status: number }} proof
 */
export function seatProofLine(proof) {
  const outcome = seatProofOutcome(proof);
  if (outcome === "proved") return `  ○ admins: ${proof.email} sign-in ${proof.status}`;
  if (outcome === "refused") {
    return `  ! admins: ${proof.email} sign-in ${proof.status} — the seat does not accept the credential this seed converged it on`;
  }
  return `  ? admins: ${proof.email} sign-in ${proof.status} — inconclusive (the auth service answered, but not about the credential), so this run cannot prove the seat`;
}

/**
 * The verdict over every seat: `ok` unless one was refused, plus the refused and unproven proofs
 * themselves so a failure message can name them without a second pass.
 *
 * The returned proofs are **re-narrowed to `{ email, status }`**, never the caller's objects. That
 * is what makes "a proof line cannot carry a password" structural rather than a convention: the
 * seed's own seat records carry the credential (it has to sign in with it), and a verdict that
 * passed them through would put it one `console.log(JSON.stringify(...))` away from a log line.
 *
 * An empty list is `ok` — no seat configured is the gate's and CI's state, and the pass is skipped
 * before it ever reaches here.
 *
 * @param {{ email: string, status: number }[]} proofs
 */
export function seatProofVerdict(proofs) {
  const narrow = (proof) => ({ email: proof.email, status: proof.status });
  const refused = proofs.filter((proof) => seatProofOutcome(proof) === "refused").map(narrow);
  const unknown = proofs.filter((proof) => seatProofOutcome(proof) === "unknown").map(narrow);
  return { ok: refused.length === 0, refused, unknown };
}

/**
 * The summary line: how many of the configured seats signed in, and which ones did not.
 *
 * `2 of 2 seat(s) sign in` is the sentence the card's acceptance asks for, and it is worth printing
 * on every run rather than only when something is wrong: a branch whose seats have quietly stopped
 * authenticating is the defect this pass was written for, and a line that only appears on failure
 * cannot show that it was checked.
 *
 * @param {{ email: string, status: number }[]} proofs
 */
export function seatProofSummary(proofs) {
  const proved = proofs.filter((proof) => seatProofOutcome(proof) === "proved").length;
  const { refused, unknown } = seatProofVerdict(proofs);
  const parts = refused.map((proof) => `${proof.email} refused (${proof.status})`);
  for (const proof of unknown) parts.push(`${proof.email} unproven (${proof.status})`);
  const tail = parts.length === 0 ? "" : ` — ${parts.join(", ")}`;
  return `  · admins: ${proved} of ${proofs.length} seat(s) sign in${tail}`;
}

/**
 * The sentence a rotated seat earns — printed whenever phase 1 removed a seat and phase 2
 * re-created it, because that is the moment one credential becomes the only one that works.
 *
 * This is the line the demo needed and did not have. Rotation is correct behaviour on a password
 * change, but its side effect is invisible: the seat now answers to the credential **this seed ran
 * with**, so any other copy of it — the `demo` branch's Preview scope on Vercel, another tree's
 * `.env.local`, a password manager entry — is stale from that moment and answers
 * `401 INVALID_EMAIL_OR_PASSWORD`. That is a supported state (rotate, then update the copies), and
 * it stops being a mystery only if the run says so.
 *
 * @param {string[]} emails the seats whose password changed, by address
 */
export function rotationNotice(emails) {
  const plural = emails.length === 1 ? "password" : "passwords";
  return [
    `  · admins: ${emails.length} ${plural} rotated (${emails.join(", ")}) — the credential this seed ran with is now the only one that answers.`,
    "    Any other copy of it (the demo branch's Preview scope on Vercel, another tree's .env.local) is stale and will answer",
    "    401 INVALID_EMAIL_OR_PASSWORD until it is updated; the seats themselves are fine.",
  ].join("\n");
}

/**
 * The error a refused seat raises, thrown before phase 2 commits.
 *
 * It names the seats and the statuses and nothing else, then says what the reader would otherwise
 * have to work out: a `401` immediately after the seed wrote that credential is not a password to
 * retry, it is two URLs pointing at different places. `NEON_AUTH_BASE_URL` (where accounts are
 * created) and `DATABASE_URL` (where the grant is written) have to be the same Neon branch, and
 * `403` is the branch not trusting `DEMO_ORIGIN`.
 *
 * @param {{ email: string, status: number }[]} proofs
 */
export function seatProofFailure(proofs) {
  const { refused } = seatProofVerdict(proofs);
  const named = refused.map((proof) => `${proof.email} (${proof.status})`).join(", ");
  return [
    `platform admins: ${refused.length} of ${proofs.length} seat(s) refused the credential this seed converged them on — ${named}.`,
    "A seat the seed has just created or reconciled must sign in with the same credential, so this is not a password to retry:",
    "  · 401 INVALID_EMAIL_OR_PASSWORD — NEON_AUTH_BASE_URL (where the account is created) and DATABASE_URL (where the grant is",
    "    written) are not the same Neon branch, so the profile row names a user the auth server has never heard of.",
    "  · 403 INVALID_ORIGIN — this branch does not trust DEMO_ORIGIN, so no server-side sign-in can be checked at all.",
    "Nothing was committed: point both URLs at one branch (or fix DEMO_ORIGIN) and run the seed again.",
  ].join("\n");
}
