/**
 * The demo branch's **trusted origins**, and the proof that they are back (#1086).
 *
 * `scripts/demo-reset.mjs` resets the demo branch with Neon's branch **restore**, and Neon
 * implements a restore as a branch *creation* (`scripts/demo-branch-prune.mjs` records the same
 * fact about the branch slot). The branch's Managed Auth **integration** survives that — measured
 * on 2026-11-15, `GET …/branches/br-wispy-frog-b43188n8/auth` answered `200` with its
 * `created_at` from 2026-10-30, before and after a reset — but the integration's **trusted-domain
 * list does not**. A reset hands back a branch that is correct in every other way and whose auth
 * server trusts no site at all:
 *
 *   GET …/branches/br-wispy-frog-b43188n8/auth/domains
 *     09:41Z  {"domains":[{"domain":"https://demo.alignsynch.com",…}]}
 *     09:47Z  {"domains":[]}                                    ← a reset ran in between
 *
 * The consequence is not cosmetic and it is not gradual. `403 INVALID_ORIGIN` is the auth server
 * refusing the *site*, before any password is compared, so after a reset **no identity can sign in
 * on the demo — admin seats included** — while `/api/version` answers `200`, every gate stays
 * green, and the deployment is untouched. The demo's entire purpose is that a visitor presses a
 * role button and is inside the product.
 *
 * Two rules follow, and they are what this module is for:
 *
 *   1. **The origin list is re-applied, never assumed.** It is branch configuration that a restore
 *      does not preserve, so a completed reset *writes* it back (one `POST`, only when the list does
 *      not already carry the origin) rather than trusting that it survived.
 *   2. **The reset proves sign-in works, in its own output.** A branch that answers `403` on
 *      sign-in is not a successful reset, whatever the row counts say. The probe is a single
 *      sign-in with `Origin: <the demo origin>` and a **deliberately wrong** credential, and only
 *      `401 INVALID_EMAIL_OR_PASSWORD` is a pass: the origin decision has already been made by
 *      then, so a `401` is the origin being accepted without any real credential ever being
 *      handled. `403` fails the run with a named error.
 *
 * **A loopback origin is not evidence.** Neon Auth trusts `http://localhost:*` and `127.0.0.1`
 * implicitly, on a branch whose list is empty (measured: an empty list answers `401` for
 * `Origin: http://localhost:3000` and `403` for anything else). A probe posted from a loopback
 * origin therefore says nothing about whether the demo's public origin is trusted, which is exactly
 * the false pass a nightly job would settle into. The reset says so instead of banking it.
 *
 * Everything here is pure — no `fetch`, no environment, no clock — so `tests/demo-auth-domains.test.ts`
 * can prove the refusal of a wildcard, the add-nothing-when-present rule and the `403`-fails-the-run
 * verdict without a Neon key or a network call.
 */

/** The origin the demo is entered from. `DEMO_ORIGIN` overrides it; nothing else does. */
export const DEFAULT_DEMO_ORIGIN = "https://demo.alignsynch.com";

/**
 * The address the probe signs in as, and the credential it deliberately gets wrong.
 *
 * Neither is a secret and neither can belong to anybody: `.invalid` is reserved by RFC 2606 and
 * `PROBE_PASSWORD` is a literal chosen so that it cannot be a real one. That is the point of the
 * probe — `401 INVALID_EMAIL_OR_PASSWORD` proves the **origin** was accepted, and it proves nothing
 * about an account, so no real seat is ever the subject of a failed sign-in and no lockout counter
 * is touched.
 */
export const PROBE_EMAIL = "origin-probe@demo.alignsynch.invalid";
export const PROBE_PASSWORD = "not-a-credential-origin-probe";

/** `401` is the status that proves the origin: the server reached the credential comparison. */
export const ORIGIN_ACCEPTED = 401;

/** `403` is the status that proves the origin was refused, before any credential was read. */
export const ORIGIN_REFUSED = 403;

/** The auth-provider name the API wants beside a domain; the demo branch is `better_auth`. */
export const AUTH_PROVIDER = "better_auth";

/** The one route that reads and writes a branch's trusted origins. */
export function authDomainsPath(projectId, branchId) {
  return `/projects/${encodeURIComponent(projectId)}/branches/${encodeURIComponent(branchId)}/auth/domains`;
}

/** Hosts Neon Auth trusts implicitly, on any branch, whether or not the list names them. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Why an origin cannot be trusted, or `null` when it can.
 *
 * The rule is deliberately narrow, because this function is the only thing standing between "the
 * demo origin" and an allowlist that accepts anybody: a **bare origin**, `https`, no wildcard, no
 * path, no query, no fragment, no credentials in the URL. `http` is accepted only for a loopback
 * host, which is the one case a local run legitimately needs and the one case that cannot be a
 * phishing surface.
 *
 * `*` is refused as a substring rather than as a parsed host: `https://*.example.com` parses
 * happily, and a wildcard domain on a demo auth server is a phishing surface wearing a test badge.
 *
 * @param {unknown} value the candidate, usually `DEMO_ORIGIN`
 * @returns {string | null} the refusal, or `null`
 */
export function originRefusal(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return "no origin is configured — set DEMO_ORIGIN to the demo's own origin (https://demo.alignsynch.com)";
  }
  const candidate = value.trim();
  if (candidate.includes("*")) {
    return `"${candidate}" contains a wildcard — a demo auth server that trusts any origin is a phishing surface, so the list carries exact origins only`;
  }
  if (!/^https?:\/\//i.test(candidate)) {
    return `"${candidate}" is not an absolute http(s) origin — it must read like https://demo.alignsynch.com`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return `"${candidate}" does not parse as a URL — it must read like https://demo.alignsynch.com`;
  }

  if (url.hostname === "" || url.username !== "" || url.password !== "") {
    return `"${candidate}" must be a bare origin: no credentials in the URL`;
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return `"${candidate}" carries a path, query or fragment — the trusted list holds origins, so it must be the site and nothing after it (${url.origin})`;
  }
  if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
    return `"${candidate}" is plain http on a public host — the demo origin must be https, and http is accepted only for a loopback host`;
  }
  if (candidate !== url.origin) {
    // A trailing slash, an upper-case scheme, a default port: the API stores what it is given, and
    // a stored `https://demo.alignsynch.com/` would not match the browser's `Origin` header.
    return `"${candidate}" is not in the canonical form the API stores — write it as ${url.origin}`;
  }
  return null;
}

/**
 * Whether an origin is one Neon Auth trusts without the list naming it.
 *
 * A probe from one of these is a false pass, so the reset prints that it proved nothing rather
 * than reporting a `401` as if it had.
 *
 * @param {string} origin
 */
export function isLoopbackOrigin(origin) {
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/**
 * The origins the API's payload names, normalised to the value a browser sends in `Origin`.
 *
 * A payload the API did not shape the documented way is **not** silently read as "empty" — an
 * unreadable answer must not be mistaken for an empty list, because "empty" is the state this whole
 * module exists to repair and a `!== undefined` slip is what makes that mistake survivable.
 *
 * @param {unknown} payload the body of `GET …/auth/domains`
 * @returns {string[]}
 */
export function trustedOrigins(payload) {
  const rows = payload?.domains;
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => (typeof row === "string" ? row : row?.domain))
    .filter((domain) => typeof domain === "string" && domain !== "")
    .map((domain) => domain.trim().replace(/\/+$/, ""));
}

/**
 * What the reset must do about one origin: nothing, or one `POST`.
 *
 * There is no "replace" and no "sync to this list": the demo branch carries only its own origin, so
 * a missing one is added and a present one is left alone. Anything else — removing what somebody
 * else added, or writing the list wholesale — is a widening or a deletion nobody asked for.
 *
 * @param {{ trusted: string[], origin: string }} input
 * @returns {{ action: "present" | "add", reason: string }}
 */
export function domainPlan({ trusted, origin }) {
  const want = origin.trim().replace(/\/+$/, "");
  const already = trusted.some((domain) => domain.toLowerCase() === want.toLowerCase());
  if (already) {
    return { action: "present", reason: `${want} is already trusted — nothing to re-apply` };
  }
  const others =
    trusted.length === 0 ? "the list is empty" : `the list holds ${trusted.join(", ")}`;
  return { action: "add", reason: `${others} and not ${want}` };
}

/**
 * What one probe's status means.
 *
 * `accepted` is only ever `401`: the server compared a credential, so it had already decided the
 * origin was allowed. `refused` is `403`, which is the origin decision going the other way.
 * Everything else is `inconclusive` — a `429` from the auth service rate-limiting a run that has
 * just created thirty accounts, a `5xx`, a `000` from a network failure — and it is not read as a
 * pass, because the reset must not report success for a fact it could not establish.
 *
 * @param {{ status: number }} reply
 * @returns {"accepted" | "refused" | "inconclusive"}
 */
export function probeOutcome(reply) {
  if (reply?.status === ORIGIN_ACCEPTED) return "accepted";
  if (reply?.status === ORIGIN_REFUSED) return "refused";
  return "inconclusive";
}

/**
 * `0` is a fetch that never answered (a network failure, a timeout); every other value is a status
 * the server sent. Printed in words so a log line does not read as "the server said 0".
 *
 * @param {number} status
 */
function statusLabel(status) {
  return status === 0 ? "no HTTP answer" : String(status);
}

/**
 * One line for the run log, in the vocabulary the rest of the reset prints (`○` proved, `!` refused,
 * `?` unproven).
 *
 * @param {{ status: number, origin: string }} reply
 */
export function probeLine(reply) {
  const outcome = probeOutcome(reply);
  if (outcome === "accepted") {
    return `  ○ origin    ${reply.origin} — sign-in ${reply.status} INVALID_EMAIL_OR_PASSWORD, so the origin is trusted (the credential sent was a deliberate wrong one)`;
  }
  if (outcome === "refused") {
    return `  ! origin    ${reply.origin} — sign-in ${reply.status} INVALID_ORIGIN, so this branch trusts no such site`;
  }
  return `  ? origin    ${reply.origin} — ${statusLabel(reply.status)} did not reach the credential check, so this run cannot prove the origin`;
}

/**
 * The named failure a probe raises, or `null` when it passed.
 *
 * A `403` gets its own sentence because it is the defect this module was written for and the fix is
 * not "re-run": the branch's trusted-domain list is empty, which means the re-apply was skipped,
 * refused, or overwritten by something after it. An inconclusive answer gets a sentence that says
 * the run proved nothing rather than borrowing the vocabulary of a failure.
 *
 * @param {{ status: number, origin: string, authBaseUrl?: string }} reply
 * @returns {string | null}
 */
export function probeFailure(reply) {
  const outcome = probeOutcome(reply);
  if (outcome === "accepted") return null;
  if (outcome === "refused") {
    return [
      `the sign-in probe from ${reply.origin} was REFUSED with ${reply.status} INVALID_ORIGIN — this branch does not trust that origin,`,
      "so nobody can sign in on the demo: no password is compared until the origin is accepted, which is why the row counts and",
      "/api/version both still look healthy.",
      "  · the trusted-domain list is branch configuration, and a branch restore does not preserve it — re-apply it and re-run:",
      `    POST …/branches/<id>/auth/domains {"domain":"${reply.origin}","auth_provider":"better_auth"}${reply.authBaseUrl ? `, against ${reply.authBaseUrl}` : ""}`,
      "  · never widen the list to make this pass: an auth server that trusts any origin is a phishing surface.",
    ].join("\n");
  }
  return [
    `the sign-in probe from ${reply.origin} answered ${statusLabel(reply.status)}, which is not the 401 INVALID_EMAIL_OR_PASSWORD that proves the`,
    "origin was accepted — the probe never reached the credential check, so this reset cannot claim the demo is enterable.",
    ...(reply.status === 404
      ? [
          "  · 404 is the branch's auth service having no configuration behind its integration: `GET …/auth` still reports the",
          '    integration while the auth endpoints answer "Project config not found" (measured on this branch, 2026-10-30). The source',
          "    branch must carry `neon_auth.project_config` and `neon_auth.jwks`, which is what the pre-reset source check refuses without.",
        ]
      : []),
    "  · 429 is the auth service rate-limiting a run that has just created accounts: retry once the limiter has cooled",
    "  · 5xx or a network failure is the auth service itself; the branch's state was reported above and nothing was weakened.",
  ].join("\n");
}

/* ------------------------------------------------------------------ *\
 * Retrying the origin step — a bounded wait for a service that is not ready
 * ------------------------------------------------------------------ */

/**
 * Why this exists (#1090). The origin step runs **after** the restore, so a failure in it is not a
 * no-op: the branch has already been emptied. Measured twice in a row on 2026-11-15 —
 *
 *   GET …/branches/br-wispy-frog-b43188n8/auth/domains → 500 AUTH_FAILURE
 *   (a manual GET twenty seconds later answered 200)
 *
 * — and the request itself was proved correct: the same `POST` with the same body answers
 * `400 "Domain already exists"` when the origin is already listed, and `400 … auth_provider (field
 * required)` without the field the script sends. So the `500` is the branch's auth server not being
 * ready for the integration call in the seconds after a restore, and a script with no retry turned
 * that transient condition into a demo with zero rows.
 *
 * Two rules follow, and they are the whole design:
 *
 *   1. **Retry, but only what can succeed.** `5xx` and a fetch that never answered are a server
 *      that may be ready in a second; `4xx` is a fact about the request (a bad shape, a key the
 *      project does not accept, a branch with no integration) and retrying it turns a refusal into
 *      a timeout.
 *   2. **Name the budget, and make it cover the measured window.** Five attempts, `2s → 4s → 8s →
 *      16s` between them — **30s of waiting** and a **45s ceiling** for the whole step. The window
 *      this was measured in was about twenty seconds (a manual `GET` answered `200` twenty seconds
 *      after the `500`), so a budget shorter than that would have been a retry that gives up inside
 *      the outage it exists for. A run that has not converged by then is a repair for a human, not a
 *      longer sleep.
 *
 * The loop is here rather than in `demo-reset.mjs` because it is a decision with an elapsed-time
 * dimension, and `tests/demo-auth-domains.test.ts` proves it with an injected clock and no key.
 */

/** How many times the origin step is attempted before the run gives up. */
export const ORIGIN_ATTEMPTS = 5;

/** The first wait between attempts. Each later wait doubles: 2s, 4s, 8s, 16s. */
export const ORIGIN_RETRY_BASE_MS = 2_000;

/** The ceiling for the whole step, waits included. Past it, a retry is a hang, not a repair. */
export const ORIGIN_RETRY_CEILING_MS = 45_000;

/**
 * The wait after the `completedAttempt`-th failure: 1000, 2000, 4000…
 *
 * @param {number} completedAttempt 1 for the first failure
 * @param {number} [base] the first wait; `ORIGIN_RETRY_BASE_MS` unless a caller injects one
 * @returns {number} milliseconds
 */
export function originRetryDelayMs(completedAttempt, base = ORIGIN_RETRY_BASE_MS) {
  if (!Number.isFinite(completedAttempt) || completedAttempt < 1) return 0;
  return base * 2 ** (completedAttempt - 1);
}

/**
 * Whether another attempt could turn this failure into a success.
 *
 * `status` is what `request()` in the reset attaches: a number the server sent, or `0` for a fetch
 * that never landed. A refusal the script raised itself (`exitCode`, a `Refused`) is never retried
 * — it is a decision about this project, not a flake. `transient: true` covers the one non-HTTP case
 * that really is a lag: the API accepted the origin but the list it read back did not carry it yet.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isRetryableOriginFailure(error) {
  if (error === null || typeof error !== "object") return false;
  if (error.exitCode !== undefined) return false;
  if (error.transient === true) return true;
  const status = error.status;
  if (status === 0) return true;
  if (typeof status !== "number") return false;
  return status >= 500;
}

/**
 * The attempt log, in the form the card asks for:
 *
 *   attempt 1: 500 (0.4s) → attempt 2: 500 (0.5s) → attempt 3: 200 (0.3s)
 *
 * `0` prints as "no answer", because "attempt 1: 0" would read as the server having said `0`.
 *
 * @param {{ attempt: number, status: number | null, ms?: number }[]} entries
 * @returns {string}
 */
export function attemptTrace(entries) {
  if (entries.length === 0) return "no attempt completed";
  return entries
    .map((entry) => {
      const status =
        entry.status === null || entry.status === undefined
          ? "ok"
          : entry.status === 0
            ? "no answer"
            : String(entry.status);
      const elapsed = typeof entry.ms === "number" ? ` (${(entry.ms / 1000).toFixed(1)}s)` : "";
      return `attempt ${entry.attempt}: ${status}${elapsed}`;
    })
    .join(" → ");
}

/**
 * Runs `run({ attempt })` until it answers or the budget is spent.
 *
 * `run` returns `{ status, value, lines }`: the status of the request that decided the attempt (so
 * the trace can print it), whatever the caller wants back, and the lines to print once the attempt
 * has actually succeeded — a retried attempt's "before: the list is empty" is not worth reading
 * three times.
 *
 * On exhaustion the last error is rethrown with `attempts` attached, so the caller can print the
 * same trace for a failure that it prints for a success.
 *
 * @template T
 * @param {(input: { attempt: number }) => Promise<{ status: number, value: T, lines?: string[] }>} run
 * @param {{
 *   attempts?: number,
 *   baseMs?: number,
 *   ceilingMs?: number,
 *   sleep?: (ms: number) => Promise<void>,
 *   now?: () => number,
 *   onAttempt?: (input: { entry: { attempt: number, status: number | null, ms: number }, retryInMs: number | null }) => void,
 * }} [options]
 * @returns {Promise<{ value: T, entries: { attempt: number, status: number | null, ms: number }[], lines: string[] }>}
 */
export async function retryOriginStep(
  run,
  {
    attempts = ORIGIN_ATTEMPTS,
    baseMs = ORIGIN_RETRY_BASE_MS,
    ceilingMs = ORIGIN_RETRY_CEILING_MS,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now = Date.now,
    onAttempt = () => {},
  } = {},
) {
  const entries = [];
  const startedAt = now();
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const attemptStarted = now();
    try {
      const outcome = await run({ attempt });
      const entry = { attempt, status: outcome?.status ?? null, ms: now() - attemptStarted };
      entries.push(entry);
      onAttempt({ entry, retryInMs: null });
      return { value: outcome?.value, entries, lines: outcome?.lines ?? [] };
    } catch (error) {
      const entry = { attempt, status: error?.status ?? null, ms: now() - attemptStarted };
      entries.push(entry);
      lastError = error;

      const retryable = isRetryableOriginFailure(error);
      const delay = originRetryDelayMs(attempt, baseMs);
      const elapsed = now() - startedAt;
      // The ceiling is about the step, not about one wait: a run that has already spent its window
      // stops with the failure it has rather than sleeping one more time.
      const fits = retryable && attempt < attempts && elapsed + delay <= ceilingMs;
      onAttempt({ entry, retryInMs: fits ? delay : null });
      if (!fits) break;
      await sleep(delay);
    }
  }

  const failure = lastError ?? new Error("the origin step did not run");
  failure.attempts = entries;
  throw failure;
}
