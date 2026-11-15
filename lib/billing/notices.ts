/**
 * The two notices the provider's events were always supposed to fire (#1055).
 *
 * `lib/email/templates/trial-ending.ts` (#548 template #6) and `membership-lapsed.ts` (template #7)
 * were written before anything could reach them: the receiver subscribed to three
 * `checkout`/`customer.subscription.*` events, so a lapsed pair was never announced and a trial was
 * never warned. This module is the wiring — **the copy is not here**, and neither is the transport.
 * Both go through the band (`renderTemplate()` → `lib/email/band.ts`) and `sendMail()`
 * (`lib/flow/email.ts`), which is the same one `sendMail` half the product already uses.
 *
 * **A notice is mailed per transition, never per state.** `sendMembershipLapsedNotices()` is handed
 * the ids the payment event's `UPDATE … RETURNING` moved, not "every relationship this account has
 * that reads expired": a second failed renewal for an already-lapsed account moves nothing, so it
 * has nothing to announce. That is what keeps the second delivery from being a second letter.
 *
 * **Both seats are told.** A lapse stops both of them (`lib/relationship/membership.ts` — read-only
 * for both, and the counterparty must not read it as their own failure), and template #7 is written
 * so either seat can receive it. The addresses are the ones the relationship already stores
 * (`session_invite.initiator_email` and `session_invite.email`, the same two columns
 * `readUnlockFacts()` uses) — no lookup of an account's address from a mailbox, and no guessed
 * address. A seat with no stored address is counted, not invented.
 *
 * **The trial notice is the account's, and its date is the payload's.** `trialEndsAt` is
 * `customer.subscription.trial_will_end`'s own `trial_end` — the real instant the provider will
 * charge — rather than `current_period_end` re-derived here. The address is the account's own
 * (`neon_auth."user"`), with the relationship's stored `initiator_email` as the fallback for a
 * branch whose auth schema is not readable (a scratch database, a demo reset). The card asks for
 * exactly this: a fact the event does not carry is resolved server-side, and said out loud here.
 *
 * **Nothing here can fail a delivery.** `sendMail()` never throws, and the reads are the only thing
 * that could — so the adapter wraps this call and logs rather than letting a 5xx make the provider
 * retry an event whose write already committed. A notice that did not go out is a line in the log,
 * never a lost subscription.
 */
import { getPool } from "@/lib/db/client";
import {
  membershipLapsedTemplate,
  renderTemplate,
  trialEndingTemplate,
} from "@/lib/email/templates";
import { relationshipLink, sendMail, type MailOutcome, baseUrl } from "@/lib/flow/email";
import type { Sql } from "@/lib/relationship/enforcement";

/** Where a member reads or buys their plan — the trial notice's only address. */
export const PLANS_PATH = "/pricing";

/** The two mails this module sends. */
export type NoticeKind = "membership-lapsed" | "trial-ending";

/** The transport's three outcomes, plus the two ways there was nobody to write to. */
export type NoticeOutcome = MailOutcome | "no-address" | "no-recipient";

/** One relationship (or one account) and what happened to its notice. */
export interface NoticeResult {
  readonly kind: NoticeKind;
  readonly outcome: NoticeOutcome;
  /** How many mailboxes the message went to. `0` when it could not be addressed. */
  readonly recipients: number;
  /** The relationship the notice is about; `null` for the account-level trial notice. */
  readonly relationshipId: string | null;
}

/** One seat, as the relationship's own rows describe it. */
interface Seat {
  readonly name: string;
  readonly email: string | null;
}

/** A seat with an address on file — the only kind a message can be addressed to. */
interface AddressedSeat {
  readonly name: string;
  readonly email: string;
}

/** A relationship that just lapsed, with the two seats' names and stored addresses. */
interface LapsedSeatsRow {
  readonly id: string;
  readonly title: string | null;
  readonly expired_at: Date | string | null;
  readonly initiator_name: string | null;
  readonly initiator_email: string | null;
  readonly counterparty_name: string | null;
  readonly counterparty_email: string | null;
}

/**
 * The seats of the relationships a payment just lapsed, in one statement.
 *
 * `MAX(…) FILTER (…)` rather than a lateral over "the newest session": a notice is addressed to the
 * seats of the relationship, and which round the rows came from does not change who they are. The
 * aggregates also make the query return exactly one row per relationship whatever the session count,
 * which is what lets the caller iterate the ids it was handed and never mail one of them twice.
 */
const LAPSED_SEATS_SQL = `SELECT r.id,
         t.title,
         r.expired_at,
         MAX(p.name) FILTER (WHERE p.role = 'initiator')    AS initiator_name,
         MAX(p.name) FILTER (WHERE p.role = 'counterparty') AS counterparty_name,
         MAX(iv.initiator_email)                            AS initiator_email,
         MAX(iv.email)                                      AS counterparty_email
    FROM relationship r
    JOIN record t ON t.id = r.template_id
    LEFT JOIN session s ON s.relationship_id = r.id
    LEFT JOIN party p ON p.session_record_id = s.record_id
    LEFT JOIN session_invite iv ON iv.session_record_id = s.record_id
   WHERE r.id = ANY($1::text[])
   GROUP BY r.id, t.title, r.expired_at`;

/** Does this database carry the managed-auth schema at all? A scratch branch does not. */
const AUTH_USER_PRESENT_SQL = `SELECT to_regclass('neon_auth."user"') IS NOT NULL AS present`;

/** The account's own name and address. */
const AUTH_USER_SEAT_SQL = `SELECT u.email::text AS email, u.name::text AS name
                              FROM neon_auth."user" u
                             WHERE u.id::text = $1`;

/**
 * The fallback address: the one the account's own relationship rows already store.
 *
 * Only reached when the auth schema is unreadable. It is the address the creator typed at invite
 * time (`session_invite.initiator_email`), which is a fact about the same person, and only when
 * there is one — a signed-out create stores NULL, and that seat then has no address at all.
 */
const STORED_INITIATOR_SEAT_SQL = `SELECT iv.initiator_email AS email, p.name AS name
                                     FROM relationship r
                                     JOIN session s ON s.relationship_id = r.id
                                     LEFT JOIN party p ON p.session_record_id = s.record_id
                                                  AND p.role = 'initiator'
                                     LEFT JOIN session_invite iv ON iv.session_record_id = s.record_id
                                    WHERE r.initiator_user_id = $1
                                      AND iv.initiator_email IS NOT NULL
                                    ORDER BY r.created_at DESC
                                    LIMIT 1`;

/** A stored instant, parsed — a row is read, never trusted to be a `Date`. */
function instantOf(value: Date | string | null): Date | null {
  if (value === null) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A name the template can print. "there" is what `Hi {recipient}` reads without one. */
function nameOrThere(name: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed === "" ? "there" : trimmed;
}

/** An address the transport can use, or `null` — never a guess, never an empty string. */
function addressOf(email: string | null): string | null {
  const trimmed = (email ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** The two seats of one relationship, as the row describes them. */
function seatsOf(row: LapsedSeatsRow): readonly Seat[] {
  return [
    { name: nameOrThere(row.initiator_name), email: addressOf(row.initiator_email) },
    { name: nameOrThere(row.counterparty_name), email: addressOf(row.counterparty_email) },
  ];
}

/**
 * Announce the lapse the payment event just wrote, to both seats of each relationship it moved.
 *
 * `relationshipIds` is `SyncDirection`'s `lapsedIds` — the rows the event's own `UPDATE` returned —
 * and an empty list is a legitimate answer (`invoice.payment_failed` for an account that was
 * already lapsed, a relationship that is `complete`): nothing moved, so nothing is sent.
 */
export async function sendMembershipLapsedNotices(input: {
  readonly relationshipIds: readonly string[];
  readonly base?: string;
  /** Test seam: the connection. Defaults to the app's pool. */
  readonly sql?: Sql;
  /** Test seam: the transport. Defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}): Promise<readonly NoticeResult[]> {
  if (input.relationshipIds.length === 0) return [];
  const sql = input.sql ?? getPool();
  const rows = await sql.query<LapsedSeatsRow>(LAPSED_SEATS_SQL, [input.relationshipIds]);
  const byId = new Map(rows.rows.map((row) => [row.id, row]));

  const results: NoticeResult[] = [];
  for (const relationshipId of input.relationshipIds) {
    const row = byId.get(relationshipId);
    const endedAt = row === undefined ? null : instantOf(row.expired_at);
    if (row === undefined || endedAt === null) {
      // The UPDATE returned this id, so the row exists; a row that cannot be read back (or carries
      // no `expired_at`) is drift, and one operator line is the whole report. No address, no link.
      console.warn(
        `[lapse] relationship ${relationshipId} lapsed but carries no readable ended date — no membership notice was attempted`,
      );
      results.push({
        kind: "membership-lapsed",
        outcome: "no-recipient",
        recipients: 0,
        relationshipId,
      });
      continue;
    }

    const seats = seatsOf(row).filter((seat): seat is AddressedSeat => seat.email !== null);
    if (seats.length === 0) {
      // Neither seat has an address on file (a create that stored none): the relationship is still
      // read-only in the app, which is the state the member acts on, so this is a degraded path.
      console.warn(
        `[lapse] neither seat on relationship ${relationshipId} holds an address — no membership notice was attempted; the relationship is read-only in the app either way`,
      );
      results.push({
        kind: "membership-lapsed",
        outcome: "no-address",
        recipients: 0,
        relationshipId,
      });
      continue;
    }

    const link = relationshipLink(row.id, input.base);
    const outcomes: MailOutcome[] = [];
    for (const seat of seats) {
      const rendered = renderTemplate(membershipLapsedTemplate, {
        recipient: seat.name,
        template: (row.title ?? "").trim() === "" ? "your relationship" : (row.title as string),
        endedAt,
        link,
      });
      outcomes.push(
        await sendMail(
          { to: seat.email, subject: rendered.subject, text: rendered.text, html: rendered.html },
          {
            sender: "lapse",
            ...(input.fetchImpl === undefined ? {} : { fetchImpl: input.fetchImpl }),
          },
        ),
      );
    }
    const delivered = outcomes.filter((outcome) => outcome === "sent").length;
    results.push({
      kind: "membership-lapsed",
      // Every mailbox reached is `sent`; otherwise `failed` outranks `unset`, because one is a
      // provider that refused and the other is a deployment with no mailer — two different repairs.
      outcome:
        delivered === seats.length ? "sent" : outcomes.includes("failed") ? "failed" : "unset",
      recipients: seats.length,
      relationshipId,
    });
  }
  return results;
}

/**
 * Warn the account that the trial is about to end, with the instant the provider gave.
 *
 * The clock that decides *when* to send is the provider's: `customer.subscription.trial_will_end`
 * arrives three days before `trial_end`. This sends on that delivery and does not schedule,
 * re-check or dedupe beyond the event row — the event is the trigger, and a resend of it was already
 * answered `duplicate` before this function was reached (`applyBillingEventOnce`).
 */
export async function sendTrialEndingNotice(input: {
  readonly userId: string;
  /** `customer.subscription.trial_will_end`'s own `trial_end` — the payload's instant. */
  readonly trialEndsAt: Date;
  readonly base?: string;
  readonly sql?: Sql;
  readonly fetchImpl?: typeof fetch;
}): Promise<NoticeResult> {
  const sql = input.sql ?? getPool();
  const seat = await readAccountSeat(sql, input.userId);
  if (seat === null) {
    console.warn(
      "[trial] the account holds no readable address — no trial notice was attempted; the trial has no in-app banner, so this mailbox was the only prompt",
    );
    return { kind: "trial-ending", outcome: "no-address", recipients: 0, relationshipId: null };
  }

  const rendered = renderTemplate(trialEndingTemplate, {
    recipient: seat.name,
    trialEndsAt: input.trialEndsAt,
    link: `${(input.base ?? baseUrl()).replace(/\/+$/, "")}${PLANS_PATH}`,
  });
  const outcome = await sendMail(
    { to: seat.email, subject: rendered.subject, text: rendered.text, html: rendered.html },
    { sender: "trial", ...(input.fetchImpl === undefined ? {} : { fetchImpl: input.fetchImpl }) },
  );
  return { kind: "trial-ending", outcome, recipients: 1, relationshipId: null };
}

/**
 * The address the account itself holds, from the auth schema, with the stored invite as fallback.
 *
 * `to_regclass` first, for the reason `lib/db/admin-audit.ts` gives for its own probe: a scratch
 * branch (the demo reset's database, a migration test) has no `neon_auth` schema, and a `SELECT`
 * against it raises `relation "neon_auth.user" does not exist` — a thrown read where the honest
 * answer is "no address here".
 */
async function readAccountSeat(sql: Sql, userId: string): Promise<AddressedSeat | null> {
  const present = await sql.query<{ present: boolean }>(AUTH_USER_PRESENT_SQL);
  if (present.rows[0]?.present === true) {
    const auth = await sql.query<{ email: string | null; name: string | null }>(
      AUTH_USER_SEAT_SQL,
      [userId],
    );
    const row = auth.rows[0];
    const email = addressOf(row?.email ?? null);
    if (email !== null) return { name: nameOrThere(row?.name ?? null), email };
  }

  const stored = await sql.query<{ email: string | null; name: string | null }>(
    STORED_INITIATOR_SEAT_SQL,
    [userId],
  );
  const row = stored.rows[0];
  const email = addressOf(row?.email ?? null);
  return email === null ? null : { name: nameOrThere(row?.name ?? null), email };
}
