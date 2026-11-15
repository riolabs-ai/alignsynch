/**
 * What mode this deployment's mail key is in — the one question the broadcast screen has to answer
 * before it may send (#507, epic #500).
 *
 * The card's hard rule is that a **test** key can never broadcast without the test-mode banner on
 * the compose screen. Two things follow, and this module is the first of them: the mode is derived
 * once, from the environment, by a pure function, so the banner the page draws and the refusal the
 * server action raises are the *same* answer rather than two guesses that can disagree.
 *
 * Four modes, and each is a different sentence to an operator:
 *
 *   live      a non-empty key, no test marker, Resend's own endpoint. The only mode where a send
 *             reaches a real mailbox.
 *   test      the key says it is a test key (`re_test…` / `sk_test…`, or `RESEND_KEY_MODE=test`).
 *             `lib/news/*` and `tests/news-signup.test.ts` already spell the same marker, so this
 *             is the tree's existing convention rather than a new one. **Refused**: no broadcast
 *             is attempted, whatever the screen looks like.
 *   captured  `RESEND_ENDPOINT` points somewhere other than Resend. That is the documented capture
 *             server (`lib/flow/email.ts::mailEndpoint`, used by `docs/specs/two-party-flow.md` and by
 *             #507's own proof): messages are delivered to a local endpoint, no mailbox receives
 *             them. It may send — that is what makes the path provable — and the banner says so.
 *   unset     no key at all, so `sendMail()` would return `unset` and nothing would go out.
 *             **Refused**, because a broadcast that reports success and mails nobody is worse than
 *             one that says why it did not.
 *
 * **The order matters and it is fail-closed.** A test marker is checked before the capture
 * override, so pointing a capture endpoint at a deployment that also carries a test key still says
 * `test` (refuse) rather than `captured` (send). Unknown keys are `live` — a key with no marker is
 * what production carries, and treating every unmarked key as a test key would make the screen
 * unusable on the deployment it exists for. That is the one direction this file deliberately does
 * not fail closed in, and it is why the marker is a *marker in the key* rather than an absence.
 *
 * Pure: no `process`, no I/O. `mailKeyMode()` defaults to `process.env`, and a test passes its own
 * record.
 */
import { mailEndpointIsCapture, type MailEnv } from "@/lib/flow/email";

/** The four states, in the order the screen's banner table names them. */
export const MAIL_KEY_MODES = ["live", "test", "captured", "unset"] as const;

export type MailKeyMode = (typeof MAIL_KEY_MODES)[number];

/** Is this string one of `MAIL_KEY_MODES`? The runtime half of the closed union a prop carries. */
export function isMailKeyMode(value: unknown): value is MailKeyMode {
  return typeof value === "string" && (MAIL_KEY_MODES as readonly string[]).includes(value);
}

/**
 * The marker a test key carries: `re_test…`, `sk_test…`, or `RESEND_KEY_MODE=test`.
 *
 * A prefix test rather than an equality, because a real Resend test key is `re_test_` followed by
 * an opaque secret, and the repo's own fixtures use `re_test_key` — one rule covers both. The
 * explicit `RESEND_KEY_MODE` is the escape hatch for a deployment whose key does not carry the
 * marker.
 */
function looksLikeATestKey(key: string, declared: string): boolean {
  if (declared === "test") return true;
  return /^(re|sk)_test/i.test(key);
}

/**
 * The mode, from an env record.
 *
 * `RESEND_KEY_MODE=live` is accepted and changes nothing — `live` is already what an unmarked key
 * resolves to. It is documented rather than required so an operator can state the mode without a
 * second code path to keep true, and it never overrides a test marker or a capture endpoint.
 */
export function mailKeyMode(env: MailEnv = process.env): MailKeyMode {
  const key = (env.RESEND_API_KEY ?? "").trim();
  if (key === "") return "unset";
  const declared = (env.RESEND_KEY_MODE ?? "").trim().toLowerCase();
  if (looksLikeATestKey(key, declared)) return "test";
  if (mailEndpointIsCapture(env)) return "captured";
  return "live";
}

/**
 * May a broadcast be attempted in this mode?
 *
 * Exactly two may: `live` and `captured`. `test` and `unset` are refusals, and the refusal code
 * names which one (`lib/admin/broadcast.ts::sendBroadcast`), so the screen can draw the sentence
 * from its own fixture instead of a generic "cannot send".
 */
export function mailKeyModeSends(mode: MailKeyMode): boolean {
  return mode === "live" || mode === "captured";
}

/**
 * The refusal a mode raises, or `undefined` when it sends.
 *
 * Returned rather than thrown so the page can ask the same question without a `try`, and so the
 * two refusal codes live next to the mode that produces them.
 */
export function mailKeyModeRefusal(mode: MailKeyMode): "test-key" | "no-mail-key" | undefined {
  if (mode === "test") return "test-key";
  if (mode === "unset") return "no-mail-key";
  return undefined;
}
