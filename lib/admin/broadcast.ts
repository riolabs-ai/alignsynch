/**
 * `lib/admin/broadcast.ts` — the console's broadcast: compose, dry run, and the one send (#507, epic
 * #500).
 *
 * Four promises, and every one of them is a property of this file rather than of the screen:
 *
 *   **One audience function.** `previewBroadcast()` and `sendBroadcast()` both call
 *   `lib/db/news-signups.ts::broadcastAudience()`. The dry run reads it through the pool; the send
 *   reads it inside `act()`'s transaction, so the addresses it mails are the rows it records. A
 *   count with its own `WHERE` clause is how a dry run says 12 and a send reaches 11, which is why
 *   there is no second statement anywhere in this feature.
 *
 *   **Consent is applied in the query, not to a rendered list.** Unsubscribed, bounced and
 *   complained rows are excluded by `broadcastAudience()`'s own predicate. Nothing on this path ever
 *   holds a list of addresses that a screen filtered: the screen is handed counts, and the only two
 *   places an address exists at all are inside the audience read and the transport loop below.
 *
 *   **Every send is one `act()` write.** The mutation resolves the audience, refuses or records the
 *   send and its per-address rows, and `act()` inserts the `admin_action` row in the same
 *   transaction — so a refused or failed send leaves neither a send row nor an audit row. The audit
 *   row carries `bodyHash` and `recipientCount` and **not** the body or the addresses: a send is
 *   auditable without a second copy of what was sent.
 *
 *   **The mail key decides first.** `sendBroadcast()` reads the deployment's key mode before it
 *   opens a transaction, and refuses `test-key` / `no-mail-key`. The banner on the compose screen is
 *   the same answer drawn for the operator (`lib/email/key-mode.ts`), so the screen and the action
 *   cannot disagree — and the banner is not the enforcement, the action is.
 *
 * **Sending happens after the commit, deliberately.** The transaction records *what was decided*
 * (this audience, this body, this count) and releases; the transport loop then mails each address.
 * If the loop ran inside the transaction, a provider refusal on address 3 of 5 would roll back the
 * audit row for the two messages that did go out — a log that hides a real send is worse than one
 * that says "5 recorded, 4 accepted". The send row is the record of the attempt; `email_event`
 * (0027) is the record of what the provider then said.
 *
 * The numbers and the refusal codes are `lib/admin/broadcast-rules.ts`, which has no imports, so the
 * screen can value-import them across the client boundary (E34) while this module reaches
 * `node:crypto` and the pool.
 */
import { createHash, randomUUID } from "node:crypto";

import {
  type ActResult,
  act,
  ActRefused,
  POOL_RUNNER,
  type ActTransactionRunner,
} from "@/lib/admin/act";
import {
  BROADCAST_BODY_MAX,
  BROADCAST_COOLDOWN_HOURS,
  BROADCAST_MAX_RECIPIENTS,
  BROADCAST_SUBJECT_MAX,
  type BroadcastFailure,
  type BroadcastFormInput,
  type BroadcastRefusal,
} from "@/lib/admin/broadcast-rules";
import { broadcastAudience, type BroadcastSegment, dryRunAudience } from "@/lib/db/news-signups";
import {
  type MailKeyMode,
  mailKeyMode as readMailKeyMode,
  mailKeyModeRefusal,
  mailKeyModeSends,
} from "@/lib/email/key-mode";
import { type MailEnv, sendMail } from "@/lib/flow/email";

export {
  BROADCAST_BODY_MAX,
  BROADCAST_COOLDOWN_HOURS,
  BROADCAST_FAILURES,
  BROADCAST_MAX_RECIPIENTS,
  type BroadcastFailure,
  type BroadcastFormInput,
  BROADCAST_REFUSALS,
  BROADCAST_SUBJECT_MAX,
  type BroadcastPreviewResult,
  type BroadcastRefusal,
  type BroadcastSendResult,
} from "@/lib/admin/broadcast-rules";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/** A refused broadcast: nothing ran, nothing was written, nothing was mailed, no audit row. */
export class BroadcastRefused extends Error {
  readonly reason: BroadcastRefusal;

  constructor(reason: BroadcastRefusal, message: string) {
    super(message);
    this.name = "BroadcastRefused";
    this.reason = reason;
  }
}

/* ------------------------------------------------------------------ *
 * Compose
 * ------------------------------------------------------------------ */

/** A validated composition: the words, and the segment resolved to instants. */
export interface BroadcastCompose {
  readonly subject: string;
  readonly body: string;
  readonly segment: BroadcastSegment;
}

/**
 * Resolve one form post, or refuse it — before a transaction and before a query.
 *
 * Every refusal here costs nothing: no connection is opened, so a hand-crafted post naming a third
 * segment or an unparseable date is answered by a sentence rather than by a failed statement. The
 * order is the screen's: the words first, then the segment, because "you did not write anything" is
 * the answer an operator needs whether or not their date was also wrong.
 */
export function composeOf(input: BroadcastFormInput | BroadcastComposeInput): BroadcastCompose {
  const subject = (input.subject ?? "").trim();
  const body = (input.body ?? "").trim();
  if (subject === "") {
    throw new BroadcastRefused("empty-subject", "a broadcast with no subject line is not a notice");
  }
  if (body === "") {
    throw new BroadcastRefused("empty-body", "a broadcast with no body is not a notice");
  }
  if (subject.length > BROADCAST_SUBJECT_MAX || body.length > BROADCAST_BODY_MAX) {
    throw new BroadcastRefused(
      "too-long",
      `the subject ceiling is ${BROADCAST_SUBJECT_MAX} characters and the body's is ${BROADCAST_BODY_MAX}`,
    );
  }

  const kind = (input.segmentKind ?? "").trim();
  if (kind === "all") return { subject, body, segment: { kind: "all", since: null } };
  if (kind !== "since") {
    throw new BroadcastRefused(
      "invalid-segment",
      `"${kind}" is not a segment — the segments are all and since`,
    );
  }

  const raw = (input.segmentSince ?? "").trim();
  // A date input posts `YYYY-MM-DD`; `Date.parse` reads it as UTC midnight, which is the instant a
  // "since this day" segment means. A time is accepted too, because the action is also callable
  // without the form, and an unparseable string is a refusal rather than an `Invalid Date`.
  const since = raw === "" ? Number.NaN : Date.parse(raw);
  if (Number.isNaN(since)) {
    throw new BroadcastRefused("invalid-date", `"${raw}" is not a date a segment can start at`);
  }
  return { subject, body, segment: { kind: "since", since: new Date(since) } };
}

/** The three words a compose may carry, before a segment is resolved. */
export interface BroadcastComposeInput {
  readonly subject?: string;
  readonly body?: string;
  readonly segmentKind?: string;
  readonly segmentSince?: string;
}

/**
 * The body's identity: SHA-256 over the subject and the body, lowercase hex.
 *
 * The two are hashed with a blank line between them, so `("a", "b")` and `("a\n", "b")` cannot
 * collide. This is the `broadcast_send.body_hash` and the `admin_action.after.bodyHash` value: it is
 * how an audit row answers "which words went out" without Postgres holding a second copy of the
 * message, and how two sends of the same notice are recognisable as the same.
 */
export function bodyDigest(compose: Pick<BroadcastCompose, "subject" | "body">): string {
  return createHash("sha256").update(`${compose.subject}\n\n${compose.body}`, "utf8").digest("hex");
}

/* ------------------------------------------------------------------ *
 * The dry run
 * ------------------------------------------------------------------ */

/** What a dry run answers. Counts only — there is no field here an address could be returned in. */
export interface BroadcastPreview {
  /** The number the send will mail. The card's first acceptance is that this equals `sent`. */
  readonly count: number;
  /** Consented rows in the segment, before the cooldown. */
  readonly consented: number;
  /** Consented rows held back by the window. */
  readonly heldByCooldown: number;
  /** The segment is larger than the cap, so the send will refuse. */
  readonly overCap: boolean;
  /** The cap in force, so the screen can say what it is. */
  readonly cap: number;
  /** The body's hash, so an operator can see the identity the audit row will carry. */
  readonly bodyHash: string;
}

export interface BroadcastOptions {
  /** The instant the cooldown is measured from. An argument, so a test pins it. */
  readonly now?: Date;
  readonly env?: MailEnv;
  readonly fetchImpl?: typeof fetch;
  readonly runner?: ActTransactionRunner;
}

/** The one audience input both paths build, so a preview and a send cannot differ by a field. */
function audienceInputOf(compose: BroadcastCompose, now: Date) {
  return {
    segment: compose.segment,
    cap: BROADCAST_MAX_RECIPIENTS,
    cooldownHours: BROADCAST_COOLDOWN_HOURS,
    now,
  };
}

/**
 * Report the recipient count before anything sends.
 *
 * It answers through `broadcastAudience()` — the same function, the same predicate, the same cap —
 * and it returns `count` and never the addresses: no recipient list leaves this module, which is the
 * card's fourth hard rule at its narrowest point.
 */
export async function previewBroadcast(
  input: BroadcastFormInput | BroadcastComposeInput,
  options: BroadcastOptions = {},
): Promise<BroadcastPreview> {
  const compose = composeOf(input);
  const now = options.now ?? new Date();
  const audience = await dryRunAudience(audienceInputOf(compose, now));
  return {
    count: audience.eligible.length,
    consented: audience.consented,
    heldByCooldown: audience.heldByCooldown,
    overCap: audience.overCap,
    cap: BROADCAST_MAX_RECIPIENTS,
    bodyHash: bodyDigest(compose),
  };
}

/* ------------------------------------------------------------------ *
 * The send
 * ------------------------------------------------------------------ */

/** One broadcast, as the action receives it. `actorUserId` comes from the session, never the body. */
export interface BroadcastRequest extends BroadcastComposeInput {
  readonly actorUserId: string;
  /** Why. `act()` requires at least eight characters, and the audit row stores it. */
  readonly reason: string;
}

/** What a send answers. `sent` is what the transport accepted; the addresses are not in it. */
export interface BroadcastSent {
  readonly sendId: string;
  readonly actionId: string;
  readonly bodyHash: string;
  readonly recipientCount: number;
  readonly sent: number;
  readonly failed: number;
  readonly keyMode: MailKeyMode;
}

/** The insert of the send row. `id` is the caller's, because the audit row targets it (0028). */
const SEND_INSERT_SQL = `
  INSERT INTO broadcast_send
    (id, actor_user_id, segment, segment_since, body_hash, subject, recipient_count, key_mode, created_at)
  VALUES ($1::uuid, $2, $3, $4::timestamptz, $5, $6, $7::int, $8, $9::timestamptz)`;

/** The per-address rows: `unnest` so a 200-address send is one statement, not 200. */
const RECIPIENT_INSERT_SQL = `
  INSERT INTO broadcast_recipient (broadcast_id, email, created_at)
  SELECT $1::uuid, email, $3::timestamptz FROM unnest($2::text[]) AS email`;

/**
 * Send one notice, or say exactly why it did not go.
 *
 * The order is the card's: **key mode, then composition, then one transaction, then the transport.**
 *
 *   - a test key or no key refuses before any statement (the banner's answer, enforced);
 *   - a bad composition refuses before any query;
 *   - `act()` reads the actor's rung inside the transaction (a `support` session gets
 *     `ActRefused("role-too-low")` and no row — the floor is `broadcast.send`, `admin`);
 *   - the mutation reads the audience, refuses an empty / cooling / over-cap one, writes the send
 *     row and one row per address, and returns the counts. `act()` then writes the audit row and
 *     commits — with `after = { bodyHash, recipientCount, segment, keyMode }` and nothing else;
 *   - only after the commit does the transport loop run, one `sendMail()` per address, through the
 *     repo's one mailer. `sent` + `failed` is what the operator is told.
 *
 * The addresses travel out of the transaction in a closure variable rather than in the mutation's
 * return value, and that is deliberate: `act()` serialises what the mutation returns into
 * `admin_action.after`, and a 200-address array in an audit row would be the recipient-list leak
 * this feature exists to avoid.
 */
export async function sendBroadcast(
  request: BroadcastRequest,
  options: BroadcastOptions = {},
): Promise<BroadcastSent> {
  const env = options.env ?? process.env;
  const keyMode = readMailKeyMode(env);
  const mailRefusal = mailKeyModeRefusal(keyMode);
  if (mailRefusal !== undefined || !mailKeyModeSends(keyMode)) {
    throw new BroadcastRefused(
      mailRefusal ?? "test-key",
      keyMode === "unset"
        ? "no mail key is configured on this deployment, so no broadcast was attempted"
        : `the mail key on this deployment is a ${keyMode} key, so no broadcast was attempted`,
    );
  }

  const compose = composeOf(request);
  const now = options.now ?? new Date();
  const bodyHash = bodyDigest(compose);
  const sendId = randomUUID();
  const segmentSince = compose.segment.since === null ? null : compose.segment.since.toISOString();

  // Filled inside the transaction, read after the commit. Never part of the audit row.
  let recipients: readonly string[] = [];

  const result: ActResult<{
    readonly sendId: string;
    readonly bodyHash: string;
    readonly recipientCount: number;
    readonly segment: string;
    readonly keyMode: MailKeyMode;
  }> = await act(
    {
      actorUserId: request.actorUserId,
      action: "broadcast.send",
      target: { table: "broadcast_send", id: sendId },
      reason: request.reason,
      mutate: async (sql) => {
        const audience = await broadcastAudience(sql, audienceInputOf(compose, now));

        if (audience.overCap) {
          throw new BroadcastRefused(
            "over-cap",
            `${audience.ready} addresses pass consent and the cooldown, which is over the ${BROADCAST_MAX_RECIPIENTS}-address cap — narrow the segment`,
          );
        }
        if (audience.consented === 0) {
          throw new BroadcastRefused(
            "no-recipients",
            "the segment matches no address that has consented — nothing to send",
          );
        }
        if (audience.eligible.length === 0) {
          throw new BroadcastRefused(
            "cooldown",
            `all ${audience.heldByCooldown} consented addresses in this segment were mailed inside the last ${BROADCAST_COOLDOWN_HOURS} hours`,
          );
        }

        await sql.query(SEND_INSERT_SQL, [
          sendId,
          request.actorUserId,
          compose.segment.kind,
          segmentSince,
          bodyHash,
          compose.subject,
          audience.eligible.length,
          keyMode,
          now.toISOString(),
        ]);
        await sql.query(RECIPIENT_INSERT_SQL, [sendId, audience.eligible, now.toISOString()]);

        recipients = audience.eligible;

        return {
          before: null,
          after: {
            sendId,
            bodyHash,
            recipientCount: audience.eligible.length,
            segment: compose.segment.kind,
            keyMode,
          },
        };
      },
    },
    options.runner ?? POOL_RUNNER,
  );

  let sent = 0;
  let failed = 0;
  for (const to of recipients) {
    const outcome = await sendMail(
      { to, subject: compose.subject, text: compose.body },
      {
        sender: "broadcast",
        ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
      },
    );
    if (outcome === "sent") sent += 1;
    else failed += 1;
  }

  return {
    sendId,
    actionId: result.actionId,
    bodyHash,
    recipientCount: recipients.length,
    sent,
    failed,
    keyMode,
  };
}

/**
 * Map a thrown error to the code a screen draws, or `null` when it is a real failure.
 *
 * A refusal is a value the screen has words for; anything else must be rethrown rather than
 * described as "nothing happened" — the rule `app/(mainlayout)/admin/billing/actions.ts` applies to
 * `ActRefused`. `ActRefused`'s remaining two codes (`unknown-action`, `unknown-target-table`) cannot
 * come from this call site — both are literals in this file — so they map to `null` and surface.
 */
export function broadcastFailureOf(error: unknown): BroadcastFailure | null {
  if (error instanceof BroadcastRefused) return error.reason;
  if (error instanceof ActRefused) {
    if (error.reason === "role-too-low") return "role-too-low";
    if (error.reason === "reason-too-short") return "reason-too-short";
  }
  return null;
}
