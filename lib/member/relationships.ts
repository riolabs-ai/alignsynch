/**
 * The member's relationships — `/dashboard/relationships`, read and written (#533 phase 2, #706).
 *
 * **The list is every relationship the viewer is a party to; the writes are the initiator's.**
 * #706 fixed a read that filtered `initiator_user_id` and therefore answered a Counterparty with
 * nothing: the relationship was theirs to answer on `/assessment/instances` and absent from the
 * console's own list, so the screen said the relationship did not exist. The two questions are now
 * answered in two places and never merged — `viewerIsPartyOf` decides *membership* (the row is
 * listed), `relationshipOf` decides *permission* (`MemberRelationshipRow.isInitiator`, and the
 * three write flags on the detail view).
 *
 * **Permission has two sources, in one order (#958).** The account column
 * (`relationship.initiator_user_id`) answers first and always wins when it names somebody; when it
 * names nobody — the relationship has *no initiator member*, which is every row the demo seed
 * writes — the viewer's own **Initiator seat** answers. `lib/relationship/initiator.ts` owns that
 * rule and this module never re-derives it, because a screen's flag and a transaction's refusal
 * disagreeing is the bug on both sides of it.
 *
 * **A relationship is configured before it is sent, and this module is the "before".** #533's
 * lifecycle (`0030_relationship_lifecycle.sql`) stores its seven states; `lib/relationship/
 * status.ts` owns which move each actor may make. What phase 2 adds is the three writes that take a
 * member's own template to a live invitation:
 *
 *   createRelationship   copy the member's template into the relationship's **own** private record,
 *                        bind a version snapshot, and store the relationship at `draft`. No
 *                        session, no party, no invitation — nothing exists yet that a counterparty
 *                        could reach, and `draft` is the honest status for that.
 *   saveAspects          edit that copy's Aspects while `draft`/`pending`, re-snapshot the version
 *                        the relationship is bound to, and move `draft → pending`.
 *   publishRelationship  start the 14-day trial **or** require a checkout, move `→ published`,
 *                        open the session and mint the invitation with its seven-day window.
 *   republishRelationship  re-mint a lapsed (or revoked) invitation on a published relationship,
 *                        one click, with no Aspects re-entered.
 *
 * **Why a relationship gets its own copy of the template.** #533 says the Aspects are the
 * initiator's until they publish, and that two relationships are two configurations. Writing those
 * Aspects onto the member's template instead would mean editing one relationship silently rewrote
 * every other draft that named the same template. So `createRelationship` copies the template into
 * a private `record` and points `relationship.template_id` at it. That copy is exactly what
 * `lib/flow/store.ts` calls "a template" — an assessment record with no session — and it is
 * filtered out of the member's template list by the `visibility = 'private' AND EXISTS
 * (relationship.template_id = r.id)` predicate in `lib/member/templates.ts`, so a relationship never
 * appears as a phantom template to author.
 *
 * **Nothing is created at publish that phase 3 has to undo.** The session (the assessment round) and
 * its record copy come into being in the publish transaction, from the **version the relationship is
 * bound to** — not from the working copy — because that is what `db:verify` V4 compares an instance
 * against and what every party-facing read draws. `published_at`, in `0030`'s words, is "when the
 * invite went out and the initiator's own session opened"; this is the statement that makes that
 * sentence true.
 *
 * **Every write is `act()`, and ownership is checked inside its transaction.** Three actions
 * (`relationship.create`, `relationship.aspects`, `relationship.publish`,
 * `relationship.republish` — `lib/admin/roles.ts`), all floored at `member`, so each write leaves
 * an `admin_action` row with the actor's reason beside it. The row is read `FOR UPDATE` and
 * `initiator_user_id` is compared with the actor's id **after** the lock: a screen that hid a button
 * is not enforcement, and #533 says so.
 *
 * **The counterparty's seat is not this module's.** `published` invites; the invitation is claimed
 * by the counterparty (`claimInvite`, `lib/flow/store.ts`), and that is what binds them and moves
 * the relationship to `active` (`system`). Phase 2 never writes a counterparty `party` row — the
 * claim's `INSERT … ON CONFLICT DO NOTHING` is what makes a seat exactly one person's.
 *
 * **No clock of its own at the boundary.** `now` is an injectable argument on every write, defaulted
 * once per call; the trial window, the invitation's `expires_at` and `published_at` all come from
 * that one instant, so a test can pin all three and a live publish cannot straddle two.
 */
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { AlignmentSetting, Assessment, AssessmentMode, PartyRole } from "@/content/assessment";
import type { BillingInterval, BillingPlanId } from "@/data/billing-plans";
import { readActiveSubscription } from "@/lib/db/billing";
import { queryRows } from "@/lib/db/client";
import { readRelationshipPayment } from "@/lib/db/relationship-payment";
import {
  assessmentTemplateFromPayload,
  assessmentTemplateFromRows,
  type ItemRow,
  type OptionRow,
  type RecordRow,
} from "@/lib/db/rows";
import { emailLooksDeliverable } from "@/lib/flow/resend";
import { invitationLink } from "@/lib/flow/email";
import { RELATIONSHIPS_PATH } from "@/lib/flow/paths";
import { hashToken, mintToken } from "@/lib/flow/tokens";
import { readCompletionGate, type CompletionGate } from "@/lib/member/payment";
import { freeSlug } from "@/lib/member/templates";
import type { Subscription } from "@/lib/billing/types";
import { canTransition, type RelationshipStatus } from "@/lib/relationship/status";
import {
  lapseIfDue,
  recordLapseIfDue,
  trialHolderOf,
  type Sql,
} from "@/lib/relationship/enforcement";
import { membershipOf, membershipSentence, type Membership } from "@/lib/relationship/membership";
import { initiatorIsViewer } from "@/lib/relationship/initiator";
import { trialStateOf, type TrialFacts, type TrialState } from "@/lib/relationship/trial";
import {
  aspectsEditable,
  inviteExpiresAt,
  isClosed,
  MemberRefused,
  publishViewOf,
  publishable,
  republishable,
  trialRunningWithoutLiveInvite,
  type PublishView,
} from "@/lib/member/publish-basis";

/**
 * Where the relationship screens live. One place, because a redirect and a link agree.
 *
 * The literal lives in `lib/flow/paths.ts` (`RELATIONSHIPS_PATH`) — that module is pure, so the
 * card can import the child path from it without dragging `pg` into the browser graph (#841).
 */
export const MEMBER_RELATIONSHIPS_PATH = RELATIONSHIPS_PATH;

/**
 * The pool in the shape `lib/relationship/enforcement.ts` reads through.
 *
 * The two pre-flight reads below (`trialHolderOf`) happen outside `act()`'s transaction, because
 * they only decide *which* refusal to answer with; the transaction re-reads everything it writes.
 * The same literal appears in `lib/flow/store.ts` for the same reason: `pg`'s `Pool` and `PoolClient`
 * share the query surface, so one function serves both.
 */
const poolSql: Sql = {
  query: async <R = Record<string, unknown>>(text: string, values?: readonly unknown[]) => {
    const rows = await queryRows<R & Record<string, unknown>>(text, values);
    return { rows };
  },
};

/**
 * The tier a trial starts on, and the interval a checkout buys.
 *
 * Basic is the fixture's `popular` tier and the cheapest paid one, so it is what a trial shows the
 * product as — not a fourth "trial plan" the pricing page would have to explain. `month` because a
 * fourteen-day trial is measured in days and the monthly price is the smallest commitment the page
 * offers; a yearly trial would hand a year's product away for the same fourteen days.
 *
 * The plan row must exist for the FK (`billing_plan`), which `pnpm db:seed` writes from the fixture
 * and `db:verify` V13 compares back — so a database where a trial cannot start is a database whose
 * plans are not seeded, and the failure names the constraint.
 */
export const TRIAL_PLAN_ID: BillingPlanId = "basic";
export const CHECKOUT_INTERVAL: BillingInterval = "month";

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** One relationship in the list's shape. Everything the row draws, and no rows of its own. */
export interface MemberRelationshipRow {
  readonly id: string;
  readonly status: RelationshipStatus;
  /**
   * #706 — which seat the **viewer** holds, read from their own `party` row (their session) and
   * falling back to the `initiator_user_id` comparison for a draft, which has no session yet.
   *
   * It is a label, not a permission: the card prints it so one list reads correctly for both
   * people — "with Walt · Counterparty" rather than a row that looks like its initiator's.
   */
  readonly viewerRole: PartyRole;
  /**
   * #706 — is the viewer the account that starts this relationship?
   *
   * The one source of every write flag on the detail view (`aspectsEditable`, `publishable`,
   * `offersRepublish`) and of the controls this row's screen draws.
   *
   * **#958 — two sources, in one order.** `relationship.initiator_user_id` when it names an
   * account; otherwise the viewer's own **Initiator seat** (`party.role = 'initiator'` bound to
   * them), which is the state a relationship with *no initiator member* is in. A party row that
   * exists does **not** grant it while the column names somebody else — that order is #706's
   * protection and `lib/relationship/initiator.ts` is where it lives.
   */
  readonly isInitiator: boolean;
  /** The relationship's own copy of the template — its title above the Aspects. */
  readonly templateId: string;
  /**
   * The **address** of that copy (#912) — `record.slug`, which the invite stage resolves
   * (`readLibraryTemplate` takes a slug or an id, and #794 says the URL carries the slug).
   *
   * Carried on the row because the draft CTAs are on a **client** component and the pay modal's
   * address is `createInviteForPath(slug, instanceRecordId)` from `lib/flow/paths.ts` — a pure
   * module. Building the address from `templateId` instead would put a storage handle in the URL,
   * which is the one thing #794 retired.
   */
  readonly templateSlug: string;
  readonly title: string;
  /**
   * The creator's own title from stage 1 (#841) — `undefined`/`null` before a session exists, and
   * absent from fixtures written before the field did, which is why it is optional: the card falls
   * back to the template's title, which is what those fixtures are about.
   */
  readonly relationshipTitle?: string | null;
  readonly summary: string;
  readonly createdAt: string;
  readonly publishedAt: string | null;
  /** The assessment round that exists once the relationship is published; `null` before. */
  readonly sessionRecordId: string | null;
  readonly aspectCount: number;
  /** The invitation, when one exists. `null` is "not sent yet" (or a defect, see `view`). */
  readonly invite: {
    readonly claimed: boolean;
    readonly revoked: boolean;
    readonly expiresAt: Date;
  } | null;
  readonly counterpartyName: string | null;
  /**
   * The initiator's name, from their `party` row on the latest round — the "with ·" name a
   * Counterparty's card prints. `null` for a draft (no session, so no seats) and for a
   * relationship whose initiator has no party row; the card falls back to its own word.
   */
  readonly initiatorName: string | null;
  /**
   * #975 D9 — the Counterparty's name **as a seat**, not as an invitation.
   *
   * `counterpartyName` above is what the initiator typed into the invitation; this is the name on
   * the `party` row that actually holds the Counterparty seat. A screen that names the pair needs
   * the second one for every relationship whose seats are bound without an invitation row — the
   * demo branch's four, and any relationship carried over from the pre-#825 create path.
   *
   * Optional because a fixture written before this field exists the same way `relationshipTitle`
   * does; `readMyRelationship` always fills it.
   */
  readonly counterpartySeatName?: string | null;
  /** What the band says, derived at the instant the read was given. */
  readonly view: PublishView;
  /**
   * #533 phase 3 — the membership, derived at the same instant. A relationship whose trial ran out
   * reads `lapsed` here even before a write has flipped its stored status to `expired`, so the list
   * never shows a relationship as writable that the answer sheet would refuse.
   */
  readonly membership: Membership;
}

interface RelationshipQueryRow {
  readonly id: string;
  readonly status: string;
  readonly initiator_user_id: string | null;
  /** The viewer's own seat in `party`, or `null` for a draft (no session exists to hold one). */
  readonly viewer_role: string | null;
  readonly created_at: Date | string;
  readonly published_at: Date | string | null;
  /** #533 phase 3 — the lapse, when the row records one (`0032`). */
  readonly expired_at: Date | string | null;
  readonly lapse_reason: string | null;
  readonly template_id: string;
  /** The copy's slug — the address the pay modal is reached by (#912). */
  readonly template_slug: string;
  readonly title: string;
  /** The session copy's title — stage 1's answer; `null` before a session exists. */
  readonly relationship_title: string | null;
  readonly summary: string;
  readonly session_record_id: string | null;
  readonly aspect_count: number;
  readonly counterparty_name: string | null;
  readonly initiator_name: string | null;
  /** #975 — the Counterparty's **seat** name, from `party`; present when `counterparty_name` is not. */
  readonly counterparty_seat_name: string | null;
  readonly claimed: boolean | null;
  readonly revoked: boolean | null;
  readonly expires_at: Date | string | null;
}

/**
 * The one read both surfaces use.
 *
 * **Membership and permission are two predicates, deliberately.** `VIEWER_IS_PARTY` decides which
 * rows a reader sees: the account that started the relationship, **or** any account bound to one of
 * its seats — `party.user_id`, reached through `session.relationship_id`, which is the rule
 * `lib/db/my-instances.ts` follows. The initiator half is not a permission leaking into the list; it
 * is what keeps a **draft** visible, because a draft has no session and therefore no `party` row to
 * bind anybody (#706).
 *
 * `VIEWER_ROLE` is the label beside the row, read from the viewer's own `party` row on the latest
 * round. Permission is a separate comparison in `relationshipOf` (`initiator_user_id` against the
 * viewer), so a Counterparty row is listed *and* read-only, and a hand-edited role can never grant a
 * write.
 *
 * The session is the **latest round** (`ORDER BY round DESC`), because a relationship may hold
 * several and the list is about the relationship, not one cycle. The invitation hangs off that
 * session, so a draft has none.
 */
const VIEWER_ROLE = `(
    SELECT p.role
      FROM session vs
      JOIN party p ON p.session_record_id = vs.record_id
     WHERE vs.relationship_id = rel.id AND p.user_id = $1
     ORDER BY vs.round DESC
     LIMIT 1
  ) AS viewer_role`;

/** Who may see the row. `$1` is the viewer, in both statements below. */
const VIEWER_IS_PARTY = `(
    rel.initiator_user_id = $1
    OR EXISTS (
      SELECT 1
        FROM session vs
        JOIN party p ON p.session_record_id = vs.record_id
       WHERE vs.relationship_id = rel.id AND p.user_id = $1
    )
  )`;

/**
 * The name of the seat that is *not* the viewer's — what the card's "with ·" line prints.
 *
 * `session_invite.counterparty_name` is the invited person, which is the right name for the
 * initiator's card and the wrong one for the Counterparty's (it would be their own). So the
 * initiator's `party.name` is read here and the card picks by `viewerRole` (#706).
 */
const INITIATOR_NAME = `(
    SELECT p.name
      FROM session vs
      JOIN party p ON p.session_record_id = vs.record_id
     WHERE vs.relationship_id = rel.id AND p.role = 'initiator'
     ORDER BY vs.round DESC
     LIMIT 1
  ) AS initiator_name`;

/**
 * The name of the account holding the **Counterparty seat** — the second half of the pair.
 *
 * `INITIATOR_NAME` above reads one seat; a screen that names "whose relationship is this" (#975
 * D9) needs both, and the two are not interchangeable with `counterparty_name`: that column is
 * `session_invite.counterparty_name`, the words the *initiator typed* when they invited somebody,
 * which exists only once an invitation row does. The seat is the binding the session actually
 * carries, so it is the name of the person who answers as the Counterparty — present on a
 * relationship the seed wrote, whose seats are bound while `session_invite` is empty.
 *
 * `NULL` when nobody holds the seat: a draft the flow has not sent yet, or a relationship whose
 * invitation was never claimed.
 */
const COUNTERPARTY_SEAT_NAME = `(
    SELECT p.name
      FROM session vs
      JOIN party p ON p.session_record_id = vs.record_id
     WHERE vs.relationship_id = rel.id AND p.role = 'counterparty'
     ORDER BY vs.round DESC
     LIMIT 1
  ) AS counterparty_seat_name`;

const RELATIONSHIP_COLUMNS = `
  rel.id, rel.status, rel.created_at, rel.published_at, rel.expired_at, rel.lapse_reason,
  rel.initiator_user_id, ${VIEWER_ROLE}, ${INITIATOR_NAME}, ${COUNTERPARTY_SEAT_NAME},
  t.id AS template_id, t.slug AS template_slug, t.title, t.summary,
  -- #841 — the relationship's own title, written at create from stage 1, beside the template's.
  -- The list used to head every card with the template's title, so two relationships made from one
  -- template read identically and the draft a creator had just named could not be found by name.
  sr.title AS relationship_title,
  s.record_id AS session_record_id,
  -- #936 — the count is of the Aspects this relationship **holds**, and for a relationship the
  -- flow created those live on the session's copy (s.record_id), not on the template it names.
  (SELECT count(*)::int FROM item i WHERE i.record_id = COALESCE(s.record_id, t.id)) AS aspect_count,
  inv.counterparty_name,
  (inv.claimed_at IS NOT NULL) AS claimed,
  (inv.revoked_at IS NOT NULL) AS revoked,
  inv.expires_at
`;

const RELATIONSHIP_FROM = `
  FROM relationship rel
  JOIN record t ON t.id = rel.template_id
  LEFT JOIN LATERAL (
    SELECT si.record_id
      FROM session si
     WHERE si.relationship_id = rel.id
     ORDER BY si.round DESC
     LIMIT 1
  ) s ON true
  LEFT JOIN record sr ON sr.id = s.record_id
  LEFT JOIN session_invite inv ON inv.session_record_id = s.record_id
`;

function instantOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** `party.role` is CHECK-constrained; a value that is neither is drift, so the comparison decides. */
function viewerRoleOf(row: RelationshipQueryRow, isInitiator: boolean): PartyRole {
  if (row.viewer_role === "initiator" || row.viewer_role === "counterparty") return row.viewer_role;
  return isInitiator ? "initiator" : "counterparty";
}

/* ------------------------------------------------------------------ *
 * The initiator, inside a transaction (#958)
 * ------------------------------------------------------------------ */

/**
 * The seat **this account** holds on a relationship, read from its own `party` row.
 *
 * The same binding `VIEWER_ROLE` carries in the list's statement and `relationshipRoleOf()` reads
 * for the flow, asked here for a write that must not trust a flag: the relationship's latest round
 * first, because a relationship may hold several sessions and the newest is the live pair. `null`
 * when the account holds no seat — a Counterparty's *opponent*, a coach, a stranger.
 *
 * `ORDER BY round DESC` and no `LIMIT`-less scan: `party`'s key is `(session_record_id, role)`, so
 * one account has at most one row per round, and one row is all this asks for.
 */
async function seatOf(
  sql: ActSql | Sql,
  relationshipId: string,
  userId: string,
): Promise<PartyRole | null> {
  const rows = await sql.query<{ role: string }>(
    `SELECT p.role
       FROM session s
       JOIN party p ON p.session_record_id = s.record_id
      WHERE s.relationship_id = $1 AND p.user_id = $2
      ORDER BY s.round DESC
      LIMIT 1`,
    [relationshipId, userId],
  );
  const role = rows.rows[0]?.role;
  return role === "initiator" || role === "counterparty" ? role : null;
}

/**
 * **Is this actor the relationship's initiator?** — the question every write refuses on.
 *
 * The read's flags (`readMyRelationship`) and the writes (`saveAspects`, `publishRelationship`,
 * `republishRelationship`) must answer it the same way, or a screen offers a control the
 * transaction refuses — which is the whole defect #958 fixes from the other side: the demo
 * relationship's Initiator is told they are a Counterparty, and when the flag is mended the write
 * must follow it, not keep comparing a `NULL` column against an account id.
 *
 * The seat is read **only when the column names nobody**, which is also the only case where the
 * extra statement runs: a relationship whose column names an account costs what it always did, and
 * a hand-edited `party` row can never re-open that path while the column is set (#706).
 */
async function actorIsInitiator(
  sql: ActSql | Sql,
  relationship: { readonly id: string; readonly initiator_user_id: string | null },
  actorUserId: string,
): Promise<boolean> {
  const column = relationship.initiator_user_id;
  const viewerSeat =
    column === null || column.trim() === ""
      ? await seatOf(sql, relationship.id, actorUserId)
      : null;
  return initiatorIsViewer({
    initiatorUserId: column,
    viewerSeat,
    viewerUserId: actorUserId,
  });
}

function relationshipOf(
  row: RelationshipQueryRow,
  now: Date,
  subscription: TrialFacts | null,
  viewerUserId: string,
): MemberRelationshipRow {
  const status = row.status as RelationshipStatus;
  /*
   * #706 — **the write permission, and the only place it is decided.**
   *
   * `relationship.initiator_user_id` compared with the viewer. The list itself is keyed on the
   * party binding, so being *in* a relationship and being allowed to *change* it are two different
   * facts; this is the second one, and every flag downstream (`aspectsEditable`, `publishable`,
   * `offersRepublish`) is gated on it. A Counterparty is listed and reads the screen; they never
   * get the controls, and the server actions refuse `not-yours` inside their transaction if a form
   * were posted anyway.
   *
   * **#958 — and the column is not the only half of the answer.** When it is `NULL` the
   * relationship has *no initiator member*, and the person in the **Initiator seat** is its
   * initiator: that is the state the demo seed ships on every row and the state every pre-#825
   * signed-out create wrote, and reading the column alone told those people they were the
   * Counterparty of their own relationship — no publish band, no Invite Members, so no route to
   * the pay modal. `initiatorIsViewer()` owns the order (the column first, always), and
   * `viewer_role` — the viewer's own `party` row, already in this query — is the seat.
   */
  const isInitiator = initiatorIsViewer({
    initiatorUserId: row.initiator_user_id,
    viewerSeat: row.viewer_role,
    viewerUserId,
  });
  const invite =
    row.expires_at === null
      ? null
      : {
          claimed: row.claimed === true,
          revoked: row.revoked === true,
          expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
        };
  return {
    id: row.id,
    status,
    viewerRole: viewerRoleOf(row, isInitiator),
    isInitiator,
    templateId: row.template_id,
    templateSlug: row.template_slug,
    title: row.title,
    relationshipTitle: row.relationship_title ?? null,
    summary: row.summary,
    createdAt: instantOf(row.created_at),
    publishedAt: row.published_at === null ? null : instantOf(row.published_at),
    sessionRecordId: row.session_record_id,
    aspectCount: Number(row.aspect_count),
    invite,
    counterpartyName: row.counterparty_name,
    initiatorName: row.initiator_name,
    counterpartySeatName: row.counterparty_seat_name ?? null,
    view: publishViewOf({ status, invite, now }),
    membership: membershipOf({
      status,
      subscription,
      expiredAt: row.expired_at === null ? null : new Date(row.expired_at),
      lapseReason: row.lapse_reason,
      now,
    }),
  };
}

/**
 * Every relationship this member is a party to, newest first (#706).
 *
 * The membership predicate is `VIEWER_IS_PARTY`: the initiator **or** any account bound to a party
 * seat. A Counterparty therefore sees the relationship they were invited into — the defect #706
 * fixed, where this list filtered `initiator_user_id` and answered them with nothing while
 * `/assessment/instances` showed it.
 *
 * No permission falls out of it. The row carries `isInitiator` (the comparison) and `viewerRole`
 * (the label), and the detail view gates its three write flags on the first.
 */
export async function listMyRelationships(
  userId: string,
  now: Date = new Date(),
): Promise<MemberRelationshipRow[]> {
  const rows = await queryRows<RelationshipQueryRow>(
    `SELECT ${RELATIONSHIP_COLUMNS}
     ${RELATIONSHIP_FROM}
      WHERE ${VIEWER_IS_PARTY}
      ORDER BY rel.created_at DESC, rel.id DESC`,
    [userId],
  );
  // One subscription read for the whole list: the membership is the *account's* fact, so asking
  // per row would be the same query N times and could return two different answers if a payment
  // landed between two of them.
  const subscription = rows.length === 0 ? null : await readActiveSubscription(userId);
  return rows.map((row) => relationshipOf(row, now, subscription, userId));
}

/** The detail screen's view: the row above, plus the Aspects it configures. */
export interface MemberRelationshipView extends MemberRelationshipRow {
  readonly template: Assessment;
  /**
   * May the Aspects be edited right now? `draft` and `pending` only (`aspectsEditable`), **and**
   * only for the initiator — a Counterparty's screen is read-only (#706).
   */
  readonly aspectsEditable: boolean;
  /**
   * May it be published from its current status? `publishable()` — the detail screen's band.
   *
   * **Status is only half the answer since #690.** Publishing is the hard gate for payment: a
   * relationship with no method on file gets no publish control at all, and this flag says only
   * what the status allows. The screen reads both (`publishable && hasPaymentMethod`).
   */
  readonly publishable: boolean;
  /**
   * Is a payment method on file for this relationship? #690's hard gate.
   *
   * Read from `relationship_payment.method_captured_at` — the same obligation the completion fee
   * is charged against — and `false` when the row does not exist. The soft prompt belongs to the
   * create (stage 4's plans); this is the half that is not optional.
   */
  readonly hasPaymentMethod: boolean;
  /**
   * #739 — **the completion gate, as facts.** The payer's two acts live on this screen: put a
   * method on file, and complete and open the Gap. This is what the band draws from — the sheets'
   * seal, the obligation's phase, whether a card is already on file, what the fee is and by when.
   *
   * `null` for a relationship with no session (a draft, or a publish that never opened one): there
   * is nothing to complete yet, and a band that offered completion would be offering a write the
   * transaction refuses with `no-such-relationship`.
   */
  readonly completion: CompletionGate | null;
  /** Does the invitation's state offer the one-click reissue? `republishable()` — `expired`/`revoked`. */
  readonly offersRepublish: boolean;
  /**
   * #785 — may this reader take the relationship's template into their own library?
   *
   * `true` for a party who does not own the words: the Counterparty on a relationship whose
   * template the initiator authored, which is every relationship `createRelationship` makes. The
   * initiator already has the template, and a stranger never reaches this view at all — the read
   * filters on `VIEWER_IS_PARTY` before it builds one. `forkRelationshipTemplate` re-asks the seat
   * inside its transaction, so this flag is what the screen draws, never the permission.
   */
  readonly canForkTemplate: boolean;
  /**
   * Is a trial running with no live invitation? (`trialRunningWithoutLiveInvite()`)
   *
   * Decided here rather than in the client component because the answer is a function of
   * `lib/member/publish-basis.ts`, and that module reaches `node:crypto` through
   * `lib/flow/tokens.ts` — a `"use client"` import of it is E34's failure mode (#228). The screen
   * draws the three booleans; the server decides them.
   */
  readonly trialWithoutLiveInvite: boolean;
  /** Has the relationship ended? `isClosed()` — the detail screen's terminal band. */
  readonly closed: boolean;
  /** The trial, read from the account's subscription rather than from any relationship column. */
  readonly trial: TrialState;
  readonly trialEndsAt: string | null;
  /**
   * #533 phase 3 — whether the membership paying for this relationship is still running, derived
   * at the instant the page was given. `lapsed` is the read-only state, and `lapseSentence` is the
   * sentence the screen prints: it names the initiator's membership and the instant it ended, which
   * is what keeps the counterparty from reading a lapse as their own failure.
   */
  readonly membership: Membership;
  readonly lapseSentence: string | null;
  /** The invitation's link, when the read can produce one — never: only a mint returns a token. */
  readonly inviteLinkAvailable: boolean;
}

/**
 * Which `record` holds this relationship's Aspects (#936).
 *
 * There are two, and which one is the relationship's own depends on how it was created:
 *
 *   the member write   `createRelationship()` copies the member's template into a **private
 *                      `record`** and points `relationship.template_id` at it. No session exists
 *                      yet, so that copy is the relationship's own Aspect list.
 *   the flow           `createInstanceFromTemplate()` copies the version into the **instance
 *                      record** (`session.record_id`) and keeps `template_id` naming the template
 *                      it was copied from — V23 requires the pin to be a version *of that
 *                      template*, so `template_id` cannot move. The instance copy is the list.
 *
 * Every reader on the relationship screen used `template_id`, which is only ever right for the
 * first. For a relationship the flow created it is the shared template itself, so an Aspect the
 * creator added at stage 3 — written to the instance copy, and present in the session the pair
 * answers — was simply not in the list the detail screen drew. That is #936: saved, never shown.
 *
 * The rule is one line: the session's copy when there is a session, the private copy otherwise.
 * Pure, so the read and the save cannot answer it differently (see `saveAspects`).
 */
export function aspectsRecordOf(input: {
  readonly templateId: string;
  readonly sessionRecordId: string | null;
}): string {
  return input.sessionRecordId ?? input.templateId;
}

/**
 * One relationship, if this member is a party to it — and the Aspects it was configured with.
 *
 * **A stranger's id is still `undefined`** — the page turns it into `notFound()` — but "stranger"
 * now means *neither* the initiator *nor* a bound party seat (#706): the same predicate the list
 * uses, so a Counterparty can open the relationship that lists them and reads it, read-only. The
 * three write flags below are gated on `isInitiator`, so the read-only half is the derivation, not
 * the route.
 *
 * The Aspects are read from the relationship's **own copy** — see `aspectsRecordOf()` (#936): the
 * session's record when the flow created this relationship, `template_id` when the member write
 * did. The pin (`template_version_id`) still names a version of `template_id` for both, which is
 * why the two are not the same column. After publish the lock is the model's (`aspectsEditable`)
 * and the copy is frozen for the same reason: the pair was invited on those words, and the session
 * that runs them holds its own snapshot of the same version.
 */
export async function readMyRelationship(
  userId: string,
  relationshipId: string,
  now: Date = new Date(),
): Promise<MemberRelationshipView | undefined> {
  const rows = await queryRows<RelationshipQueryRow>(
    `SELECT ${RELATIONSHIP_COLUMNS}
     ${RELATIONSHIP_FROM}
      WHERE rel.id = $2 AND ${VIEWER_IS_PARTY}`,
    [userId, relationshipId],
  );
  const row = rows[0];
  if (row === undefined) return undefined;

  /*
   * #936 — **the list is read from the relationship's own copy, not from `template_id`.**
   *
   * `template_id` names the template for a relationship the flow created and the private copy for
   * one the member write created (`aspectsRecordOf`). Reading the template there meant the detail
   * screen drew the catalogue's Aspects and never the creator's added one: saved, in the session,
   * and invisible. The title above the list comes from the same copy for the same reason.
   */
  const aspectsRecordId = aspectsRecordOf({
    templateId: row.template_id,
    sessionRecordId: row.session_record_id,
  });
  const record = await queryRows<RecordRow & { id: string; owner_user_id: string | null }>(
    `SELECT id, slug, record_type, status, date, title, summary, owner_user_id
       FROM record WHERE id = $1`,
    [aspectsRecordId],
  );
  const items = await queryRows<ItemRow>(
    `SELECT record_id, item_id, position, prompt, scale_kind, left_value, right_value
       FROM item WHERE record_id = $1 ORDER BY position`,
    [aspectsRecordId],
  );
  const options = await queryRows<OptionRow>(
    `SELECT record_id, item_id, option_id, position, text
       FROM response_option WHERE record_id = $1 ORDER BY position`,
    [aspectsRecordId],
  );
  const primary = record[0];
  if (primary === undefined) return undefined;

  const subscription = await readActiveSubscription(userId);
  const base = relationshipOf(row, now, subscription, userId);
  const trial = trialStateOf(subscription, now);
  /*
   * #690 — **the hard gate at publish, as a fact.**
   *
   * The plans on stage 4 are a soft prompt: a relationship is created and invited with no method.
   * Publishing is the other half, and it needs a card on file — so the screen has to know whether
   * one is, and the answer lives on the payment obligation this relationship already carries
   * (`relationship_payment.method_captured_at`, written by `recordMethodCaptured()`). A
   * relationship with no row at all reads `false` here rather than "not measured": the question
   * this field answers is asked of the screen, and a screen that cannot show the fact must not
   * draw the control.
   */
  const payment = await readRelationshipPayment(row.id);
  const hasPaymentMethod =
    payment?.method_captured_at !== null && payment?.method_captured_at !== undefined;
  /*
   * #739 — the completion gate, read beside the method fact.
   *
   * Two reads rather than one because they answer two different questions: `hasPaymentMethod`
   * above is the publish gate's (#690 — a draft has no session, so nothing here could answer it),
   * and this is the payer's band once a session exists. Both come from
   * `relationship_payment.method_captured_at`, so they cannot disagree about the card; what this
   * adds is the seal, the phase and the deadline, none of which the relationship row carries.
   */
  const completion =
    base.sessionRecordId === null
      ? null
      : ((await readCompletionGate(base.sessionRecordId, now)) ?? null);
  // #533 phase 3 — derived at the instant the page was handed, never written here (a render may
  // not write). The same function the claim and the answer submit refuse with, so the band and the
  // refusal can never disagree about whether this relationship may be written to.
  const membership = base.membership;
  return {
    ...base,
    /*
     * #936 — the identity of the record this list came from, and the template's **slug** with it.
     *
     * The copy's own slug is derived (`staff-manager-95505193`), and `relationshipTypeOf()` reads
     * the catalogue's slug to name the type in the identity band — so the parsed copy is drawn
     * under `template_slug`, which is the one address this screen already carried. Every writer on
     * this page sends `templateId` back as the record to write, so it has to be the copy the read
     * drew: a save that named the template would write the words here and nowhere the screen looks.
     */
    templateId: aspectsRecordId,
    template: {
      ...assessmentTemplateFromRows({ record: primary, items, options }),
      slug: row.template_slug,
    },
    /*
     * #706 — **every write flag is `isInitiator && …`.**
     *
     * The status question (`aspectsEditable`, `publishable`) and the invitation's question
     * (`republishable`) are unchanged; what is new is that the viewer must also own the write. A
     * Counterparty reads the same screen with all four false, so no editor, no publish panel and
     * no reissue control is drawn — and the server actions still re-ask ownership under a row lock,
     * because a flag here is a screen, not a refusal.
     */
    aspectsEditable: base.isInitiator && aspectsEditable(base.status),
    publishable: base.isInitiator && publishable(base.status),
    // #690 — a method on file, or nothing to click at publish. `publishable` stays the status
    // question the transaction re-asks; this is the second half the screen must not guess.
    hasPaymentMethod,
    completion,
    offersRepublish: base.isInitiator && republishable(base.view) && membership.state !== "lapsed",
    trialWithoutLiveInvite: base.isInitiator && trialRunningWithoutLiveInvite(trial, base.view),
    /*
     * #785 — **the fork, drawn for a party who does not own the words.**
     *
     * The action takes the template this relationship was configured with into the reader's own
     * library, so it is drawn for the reader who does not already own it: `owner_user_id` is the
     * initiator on every copy `createRelationship` writes (`0029_record_ownership_visibility.sql`),
     * which makes the second half the Counterparty's case. The `isInitiator` half is the same fact
     * for a legacy copy whose owner column is NULL — the person who started it is still not its
     * audience. Neither half is the permission: `forkRelationshipTemplate` re-asks seat membership
     * inside its transaction.
     */
    canForkTemplate: !base.isInitiator && primary.owner_user_id !== userId,
    closed: isClosed(base.status),
    trial,
    membership,
    lapseSentence: membership.state === "lapsed" ? membershipSentence(membership) : null,
    trialEndsAt:
      subscription !== null && subscription.status === "trialing"
        ? subscription.currentPeriodEnd
        : null,
    // A token is never stored, so a read can never hand one back: the link exists only in the
    // response to the publish (or republish) that minted it. `lib/flow/tokens.ts` is why.
    inviteLinkAvailable: false,
  };
}

/* ------------------------------------------------------------------ *
 * freeRecordIdentity — the copy's id and slug
 * ------------------------------------------------------------------ */

/** Six hex characters — enough to make a slug or id unique, short enough to read. */
function suffix(): string {
  return Math.random().toString(16).slice(2, 8);
}

/**
 * A record id and slug nothing answers to.
 *
 * The id is a token generated here, and the slug comes from `freeSlug` — the same helper the member
 * template path uses, so "the slug is checked against `record` inside the transaction" is one
 * statement in one place rather than two that could drift. The copy of a template keeps the
 * template's own slug stem, which is why starting two relationships from one template reads as
 * `<slug>-<token>` rather than `<slug>-1`, `<slug>-2`.
 */
async function freeRecordIdentity(
  sql: ActSql,
  base: string,
  idPrefix: string,
): Promise<{ id: string; slug: string }> {
  const id = `${idPrefix}-${suffix()}${suffix().slice(0, 4)}`;
  return { id, slug: await freeSlug(sql, base) };
}

/** `row.version` for a template, or `0` when it has never been snapshotted. */
async function latestVersion(sql: ActSql, templateId: string): Promise<number> {
  const rows = await sql.query<{ version: number | null }>(
    "SELECT max(version) AS version FROM template_version WHERE template_record_id = $1",
    [templateId],
  );
  const value = rows.rows[0]?.version;
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * The version a relationship is pinned to, by id — the answer a save to a session's own copy gives
 * for "which version is this", because that save writes no version at all (#936).
 *
 * `0` when the pin is absent, the same answer `latestVersion` gives a template nobody has
 * snapshotted; nothing reads the number as more than a label on the saved line.
 */
async function pinnedVersion(sql: ActSql, versionId: string | null): Promise<number> {
  if (versionId === null) return 0;
  const rows = await sql.query<{ version: number | null }>(
    "SELECT version FROM template_version WHERE id = $1",
    [versionId],
  );
  const value = rows.rows[0]?.version;
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * Write the next immutable version of a template and return its id.
 *
 * A relationship is **bound to a version** (`0026` made the column `NOT NULL`), and the version is
 * what the session's copy is compared with (`db:verify` V4) and what every party-facing read
 * parses. So every write that changes a template's Aspects writes a new version: the previous one
 * is superseded in the same statement, and the relationship is repointed by the caller.
 *
 * `published_by` is the actor, because a member's snapshot is a real publication of those words to
 * their own relationship — it is not the catalogue's publish (`template.publish`, admin-floored);
 * `record.status` stays `draft` and the catalogue never sees it.
 *
 * Exported for `lib/member/relationship-edit.ts` (#623): an edit after the invitation went out
 * writes the same next version through the same statements, so the pin moves in exactly one way.
 */
export async function snapshotVersion(
  sql: ActSql,
  input: {
    readonly templateId: string;
    readonly record: Assessment;
    readonly actorUserId: string;
    readonly now: Date;
  },
): Promise<{ id: string; version: number }> {
  const version = (await latestVersion(sql, input.templateId)) + 1;
  const id = `template-version-${input.templateId}-v${version}`;
  await sql.query(
    `INSERT INTO template_version
       (id, template_record_id, version, payload, published_at, published_by, superseded_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, NULL)`,
    [
      id,
      input.templateId,
      version,
      JSON.stringify(input.record),
      input.now.toISOString(),
      input.actorUserId,
    ],
  );
  await sql.query(
    `UPDATE template_version
        SET superseded_at = $3
      WHERE template_record_id = $1 AND version < $2 AND superseded_at IS NULL`,
    [input.templateId, version, input.now.toISOString()],
  );
  return { id, version };
}

/*
 * **There is no member-side create (#913).** This module used to export a `createRelationship` that
 * copied the template itself, and the relationships list called it — writing a relationship with no
 * session and no seats, which meant the dashboard card's `Invite Members` had no pay modal to open
 * and publishing it had no invitation to mint. The create flow's modal is the one writer
 * (`lib/flow/store.ts::createInstanceFromTemplate`), because stage 4 is where the session and the
 * staged invitation are written and stage 5 is what sends them.
 */

/* ------------------------------------------------------------------ *
 * saveAspects
 * ------------------------------------------------------------------ */

/** How a save leaves the relationship: a draft, or the saved-and-waiting state. */
export type SaveAs = "draft" | "pending";

/** What an Aspects save is asked for. */
export interface SaveAspectsRequest {
  readonly actorUserId: string;
  readonly reason: string;
  readonly relationshipId: string;
  /** The relationship's copy as the editor built it (`zAssessment`-validated by the action). */
  readonly record: Assessment;
  readonly saveAs: SaveAs;
  readonly now?: Date;
}

/** What a save answers: the status it left, the aspect ids it wrote, the version it bound. */
export interface SavedAspects {
  readonly relationshipId: string;
  readonly status: RelationshipStatus;
  readonly version: number;
  readonly aspectIds: readonly string[];
}

/**
 * Save the Aspects of a `draft`/`pending` relationship.
 *
 * The lock order is fixed and it is the reason this is one transaction: the **relationship** row is
 * read `FOR UPDATE` first (ownership and status), then its copy's record row, then the items are
 * rewritten, a version is written and the binding moved. A concurrent save waits on the
 * relationship, so two editors cannot interleave two versions of the same words.
 *
 * The status write goes through `canTransition`, never a string: `draft → pending` is the edge
 * #533 names, and `pending → draft` exists for reopening a saved draft. `saveAs: "pending"` on an
 * already-pending row is not a transition (`from === to` is never a move) and writes nothing,
 * which is the honest answer to "save again".
 */
export async function saveAspects(
  request: SaveAspectsRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<SavedAspects>> {
  const now = request.now ?? new Date();

  return act<SavedAspects>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.aspects" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const locked = await sql.query<{
          id: string;
          status: string;
          template_id: string;
          template_version_id: string | null;
          initiator_user_id: string | null;
        }>(
          `SELECT id, status, template_id, template_version_id, initiator_user_id
             FROM relationship WHERE id = $1 FOR UPDATE`,
          [request.relationshipId],
        );
        const rel = locked.rows[0];
        if (rel === undefined) {
          throw new MemberRefused(
            "no-such-relationship",
            `no relationship holds the id "${request.relationshipId}"`,
          );
        }
        // #958 — the same question the screen asks, asked where the write would happen: the
        // column first, the Initiator seat when the column names nobody.
        if (!(await actorIsInitiator(sql, rel, request.actorUserId))) {
          throw new MemberRefused(
            "not-yours",
            `relationship "${rel.id}" was started by another account — Aspects and the invitation are the initiator's`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (!aspectsEditable(status)) {
          throw new MemberRefused(
            "not-editable",
            `relationship "${rel.id}" is ${status}: its Aspects are fixed once the invitation has gone out`,
          );
        }
        /*
         * #936 — **the same record the screen drew, so a save lands where the person is looking.**
         *
         * A relationship the flow created holds its Aspects on the session's copy, not on
         * `template_id` (`aspectsRecordOf`), and the detail page now draws that copy. Writing
         * `template_id` here would have saved the words onto the template behind the list — on a
         * built-in template, onto a row every member shares. One resolver, both halves.
         */
        const session = await sql.query<{ record_id: string }>(
          `SELECT record_id FROM session WHERE relationship_id = $1
            ORDER BY round DESC LIMIT 1`,
          [rel.id],
        );
        const aspectsRecordId = aspectsRecordOf({
          templateId: rel.template_id,
          sessionRecordId: session.rows[0]?.record_id ?? null,
        });
        if (request.record.id !== aspectsRecordId) {
          throw new MemberRefused(
            "invalid-draft",
            `the Aspects name record "${request.record.id}" and this relationship configures "${aspectsRecordId}"`,
          );
        }

        const copy = await sql.query<{ id: string }>(
          "SELECT id FROM record WHERE id = $1 FOR UPDATE",
          [aspectsRecordId],
        );
        if (copy.rows[0] === undefined) {
          throw new MemberRefused(
            "no-such-relationship",
            `relationship "${rel.id}" names a copy record that does not exist`,
          );
        }

        const before = (
          await sql.query<{
            item_id: string;
            prompt: string;
            left_value: string | null;
            right_value: string | null;
          }>(
            `SELECT item_id, prompt, left_value, right_value FROM item
              WHERE record_id = $1 ORDER BY position`,
            [aspectsRecordId],
          )
        ).rows.map((item) => ({
          id: item.item_id,
          prompt: item.prompt,
          leftValue: item.left_value,
          rightValue: item.right_value,
        }));

        await sql.query("UPDATE record SET title = $2, summary = $3 WHERE id = $1", [
          aspectsRecordId,
          request.record.title,
          request.record.summary,
        ]);
        // Replace, do not diff. The copy has no `opinion` row and no session until publish, so
        // nothing cascades from these items and a replaced set cannot leave a stale Aspect behind.
        await sql.query("DELETE FROM item WHERE record_id = $1", [aspectsRecordId]);
        for (const [position, item] of request.record.items.entries()) {
          await sql.query(
            `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
             VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
            [aspectsRecordId, item.id, position, item.prompt, item.leftValue, item.rightValue],
          );
        }

        /*
         * **The pin moves only when the list IS what the pin describes.**
         *
         * For the member write, `template_id` is the private copy and `template_version` rows hang
         * off it, so a save writes the next version and repins — V4 compares the session's copy to
         * it. For a relationship the flow created, the list lives on the instance copy and the pin
         * names a version of the *template*; writing this list as a version of that template would
         * publish one member's private words to everyone who copies it (#502b), so the pin stays
         * where it is. That copy is an authored one (#699) — `session.aspects_authored_at` is what
         * tells V4 to validate its structure instead of comparing it to a version it deliberately
         * left — and V18 forbids rewriting that column from here, so this path may not stamp it.
         */
        const version =
          aspectsRecordId === rel.template_id
            ? await (async () => {
                const snapshot = await snapshotVersion(sql, {
                  templateId: rel.template_id,
                  record: request.record,
                  actorUserId: request.actorUserId,
                  now,
                });
                await sql.query("UPDATE relationship SET template_version_id = $2 WHERE id = $1", [
                  rel.id,
                  snapshot.id,
                ]);
                return snapshot.version;
              })()
            : await pinnedVersion(sql, rel.template_version_id);

        let after = status;
        if (request.saveAs === "pending" && canTransition(status, "pending", "initiator")) {
          after = "pending";
        } else if (request.saveAs === "draft" && canTransition(status, "draft", "initiator")) {
          after = "draft";
        }
        if (after !== status) {
          await sql.query("UPDATE relationship SET status = $2 WHERE id = $1", [rel.id, after]);
        }

        return {
          before: {
            status,
            // The member write wrote a version, so "before" is the one it superseded; a save to
            // the session's own copy moves no version, so before and after name the same pin (#936).
            version: aspectsRecordId === rel.template_id ? version - 1 : version,
            aspects: before,
          },
          after: {
            relationshipId: rel.id,
            status: after,
            version,
            aspectIds: request.record.items.map((item) => item.id),
          },
        };
      },
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * publishRelationship
 * ------------------------------------------------------------------ */

/** What a publish is asked for. The counterparty is named here because the invitation is minted here. */
export interface PublishRequest {
  readonly actorUserId: string;
  readonly reason: string;
  readonly relationshipId: string;
  /** The initiator's own name — the seat's, from the session, never from the body. */
  readonly initiatorName: string;
  readonly initiatorEmail: string | null;
  readonly counterpartyName: string;
  readonly email: string;
  /**
   * #623 — the mode and the Setting the session opens under.
   *
   * They are chosen **here** and not on the edit screen, and that is a schema fact rather than a
   * preference: both are columns of `session`, and `db:verify` V18 refuses an `UPDATE session` that
   * touches them once the row exists (a scored session is immutable). Publish is the last instant
   * at which they can be a choice — before it there is no row, after it there is a sheet whose
   * answers were shaped by the mode that was written.
   *
   * Absent means `basic`/`soft`, which is what this call hard-coded before #623 and what a caller
   * that has not been taught to ask still gets.
   */
  readonly mode?: AssessmentMode;
  readonly setting?: AlignmentSetting;
  /** Where a hosted checkout sends the browser back to. */
  readonly returnUrl: string;
  readonly now?: Date;
}

/** What a publish answers: the new status, the invitation to show once, and what was started. */
export interface PublishedRelationship {
  readonly relationshipId: string;
  readonly status: RelationshipStatus;
  /** The raw token — returned once and never stored (`lib/flow/tokens.ts`). */
  readonly inviteToken: string;
  readonly inviteLink: string;
  readonly inviteExpiresAt: string;
  readonly sessionRecordId: string;
  /** The trial this publish started, or `null` when the account already paid for it. */
  readonly trialEndsAt: string | null;
}

/**
 * What the **audit row** records — `PublishedRelationship` without the token and its link.
 *
 * A token is a bearer credential; `admin_action` is durable, readable by every support seat through
 * `/admin/audit`, and never deleted. So the mutation's payload is this type and the credential is
 * added to the returned value afterwards, in memory, where it lives only long enough for the screen
 * to draw it once.
 */
export type PublishedAudit = Omit<PublishedRelationship, "inviteToken" | "inviteLink">;

/**
 * Publish: billing first, then the status, the session and the invitation — one transaction for
 * everything that is ours, and the checkout deliberately outside it.
 *
 * **Why the checkout is not inside `act()`.** A hosted checkout is a network call to somebody
 * else's service, and holding a `FOR UPDATE` lock on the relationship across it would block every
 * other action on the row for as long as their API takes. So the flow is:
 *
 *   1. read the relationship and the account's subscription (no lock — a pre-flight);
 *   2. decide the basis (`publishBasisOf`): a running trial is a refusal that names its end
 *      instant, `paid` needs nothing, `checkout` calls the adapter **before** the transaction;
 *   3. if the checkout could not complete inline, answer `checkout-required` with its url and write
 *      **nothing** — the relationship stays `pending`, and no invitation exists for a seat nobody
 *      has paid for;
 *   4. otherwise one `act()` transaction locks the relationship, re-asks the status question
 *      (`canTransition`), starts the trial if that is the basis, opens the session from the bound
 *      version, mints the invitation and writes the audit row.
 *
 * **The trial's start is one statement, and the database is the rule.** `billing_subscription_live_
 * user_key` (0009) is `UNIQUE (user_id) WHERE status IN ('active','trialing','past_due')`, so a
 * second live row for one account is refused by Postgres and not by a clock comparison that a
 * concurrent publish could slip past. The `23505` is caught and translated into a refusal that
 * names the trial — which is #533's acceptance: "refused with the trial named (the server error,
 * not a disabled button)".
 */
export async function publishRelationship(
  request: PublishRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<PublishedRelationship>> {
  const now = request.now ?? new Date();
  const counterpartyName = request.counterpartyName.trim();
  const email = request.email.trim().toLowerCase();
  if (counterpartyName === "") {
    throw new MemberRefused(
      "invalid-counterparty",
      "the invitation needs the other person's name — it is what they are asked to confirm when they join",
    );
  }
  if (!emailLooksDeliverable(email) || email.length > 254) {
    throw new MemberRefused(
      "invalid-counterparty",
      `"${email}" is not an address an invitation can be sent to`,
    );
  }

  // The pre-flight read. No lock: it decides *which* transaction to open, and the transaction
  // re-reads everything it writes under `FOR UPDATE`.
  const preflight = await queryRows<{
    id: string;
    status: string;
    initiator_user_id: string | null;
    template_id: string;
    template_version_id: string;
  }>(
    `SELECT id, status, initiator_user_id, template_id, template_version_id
       FROM relationship WHERE id = $1`,
    [request.relationshipId],
  );
  const row = preflight[0];
  if (row === undefined) {
    throw new MemberRefused(
      "no-such-relationship",
      `no relationship holds the id "${request.relationshipId}"`,
    );
  }
  if (!(await actorIsInitiator(poolSql, row, request.actorUserId))) {
    throw new MemberRefused(
      "not-yours",
      `relationship "${row.id}" was started by another account — only its initiator may publish it`,
    );
  }
  if (!publishable(row.status as RelationshipStatus)) {
    throw new MemberRefused(
      "not-publishable",
      `relationship "${row.id}" is ${row.status}: only a draft or a saved draft can be published`,
    );
  }

  /*
   * #619 — **publishing bills nothing.**
   *
   * This used to decide a basis (`publishBasisOf`): start a 14-day trial, or open a checkout, or
   * need neither because the account already paid. That was the charge-at-creation model, and it is
   * retired here rather than left beside the new one: the money now belongs to **completion**
   * (`lib/member/payment.ts`), and a publish that also billed would charge twice for one
   * relationship.
   *
   * What is left at publish is what the word means: the status moves `→ published`, the session
   * opens from the bound version, and the invitation is minted. The invitation is never blocked on
   * a card (#619: "the invite sends either way").
   */

  const inviteToken = mintToken();
  const expiresAt = inviteExpiresAt(now);
  /** The raw token never enters `act()`'s payload — the audit row is durable and a token is not. */
  const invite = { token: inviteToken, link: invitationLink(inviteToken), expiresAt };

  const result = await act<PublishedAudit>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.publish" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const locked = await sql.query<{
          id: string;
          status: string;
          template_id: string;
          template_version_id: string;
          initiator_user_id: string | null;
          published_at: Date | null;
        }>(
          `SELECT id, status, template_id, template_version_id, initiator_user_id, published_at
             FROM relationship WHERE id = $1 FOR UPDATE`,
          [request.relationshipId],
        );
        const rel = locked.rows[0];
        if (rel === undefined) {
          throw new MemberRefused(
            "no-such-relationship",
            `no relationship holds the id "${request.relationshipId}"`,
          );
        }
        if (!(await actorIsInitiator(sql, rel, request.actorUserId))) {
          throw new MemberRefused(
            "not-yours",
            `relationship "${rel.id}" was started by another account — only its initiator may publish it`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (!canTransition(status, "published", "initiator")) {
          throw new MemberRefused(
            "not-publishable",
            `relationship "${rel.id}" is ${status}: the initiator may not move it to published`,
          );
        }

        // #619 — nothing is billed here. The fee belongs to completion, and the obligation row
        // written at creation is what will carry it.

        // The version the relationship is bound to — never the working copy, which may have moved
        // since the last save. This is what V4 compares the copy against.
        const version = await sql.query<{ payload: unknown }>(
          "SELECT payload FROM template_version WHERE id = $1",
          [rel.template_version_id],
        );
        const payload = version.rows[0]?.payload;
        if (payload === undefined) {
          throw new MemberRefused(
            "invalid-draft",
            `relationship "${rel.id}" is bound to version "${rel.template_version_id}", which does not exist — save its Aspects before publishing`,
          );
        }
        const offered = assessmentTemplateFromPayload(
          payload,
          `template version "${rel.template_version_id}"`,
        );

        const sessionRecordId = await freeRecordIdentity(
          sql,
          `${offered.slug}-session`,
          "member-session",
        );

        await sql.query(
          `INSERT INTO record
             (id, slug, record_type, status, date, title, summary,
              author_user_id, owner_user_id, visibility)
           VALUES ($1, $2, 'assessment', 'draft', $3, $4, $5, $6, $6, 'private')`,
          [
            sessionRecordId.id,
            sessionRecordId.slug,
            now.toISOString(),
            offered.title,
            offered.summary,
            request.actorUserId,
          ],
        );
        await sql.query(
          `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
           SELECT $1, i.item_id, i.position, i.prompt, 'score', i.left_value, i.right_value
             FROM item i WHERE i.record_id = $2 ORDER BY i.position`,
          // The copy comes from the **bound version's** rows, which are the config record's rows as
          // they stood at the last save — the version's payload and those rows agree by construction
          // (`saveAspects` writes both), and reading the rows keeps the item ids the version names.
          [sessionRecordId.id, rel.template_id],
        );

        const round = await sql.query<{ round: number | null }>(
          "SELECT max(round) AS round FROM session WHERE relationship_id = $1",
          [rel.id],
        );
        const nextRound = Number(round.rows[0]?.round ?? 0) + 1;

        await sql.query(
          `INSERT INTO session
             (record_id, template_record_id, mode, alignment_setting, relationship_id, round)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            sessionRecordId.id,
            rel.template_id,
            request.mode ?? "basic",
            request.setting ?? "soft",
            rel.id,
            nextRound,
          ],
        );

        await sql.query(
          `INSERT INTO party (session_record_id, role, name, access_token_hash, user_id)
           VALUES ($1, 'initiator', $2, $3, $4)`,
          [
            sessionRecordId.id,
            request.initiatorName.trim(),
            hashToken(mintToken()),
            request.actorUserId,
          ],
        );

        await sql.query(
          `INSERT INTO session_invite
             (session_record_id, email, counterparty_name, token_hash, created_at, expires_at,
              initiator_email)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            sessionRecordId.id,
            email,
            counterpartyName,
            hashToken(inviteToken),
            now.toISOString(),
            expiresAt.toISOString(),
            request.initiatorEmail,
          ],
        );

        await sql.query(
          `UPDATE relationship
              SET status = 'published', published_at = $2
            WHERE id = $1`,
          [rel.id, now.toISOString()],
        );

        return {
          before: {
            status,
            publishedAt: rel.published_at === null ? null : rel.published_at.toISOString(),
            invite: null,
            /* #619 — publishing no longer starts a trial, so there is no trial fact to record. */
            trial: "none",
          },
          after: {
            relationshipId: rel.id,
            status: "published" as const,
            inviteExpiresAt: expiresAt.toISOString(),
            sessionRecordId: sessionRecordId.id,
            trialEndsAt: null,
          },
        };
      },
    },
    runner,
  );

  // The link is handed back only here: the mutation's `after` is the audit row's content and may
  // not carry a bearer credential (`lib/flow/tokens.ts` stores a hash and nothing else).
  return { ...result, after: { ...result.after, inviteToken, inviteLink: invite.link } };
}

/**
 * The checkout had not completed when publish asked: the browser has somewhere to go, and **no
 * relationship state changed**.
 *
 * A distinct class rather than a code on the refusal union, because it carries a url and because it
 * is not a failure — it is an instruction. The action maps it to `{ ok: false, code:
 * "checkout-required", url }`, and the screen sends the browser there; when the checkout completes,
 * publish is one click again and this time the account is entitled.
 */
export class MemberCheckoutRequired extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`a checkout must complete before this relationship can be published: ${url}`);
    this.name = "MemberCheckoutRequired";
    this.url = url;
  }
}

/** Is this error the named unique violation? `pg`'s error carries `code` and `constraint`. */
function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === "23505" && candidate.constraint === constraint;
}

/* ------------------------------------------------------------------ *
 * republishRelationship
 * ------------------------------------------------------------------ */

/** What a re-publish is asked for — and it is only an id and a reason, on purpose. */
export interface RepublishRequest {
  readonly actorUserId: string;
  readonly reason: string;
  readonly relationshipId: string;
  readonly now?: Date;
}

/** What a re-publish answers: the new link, its window, and how the old one died. */
export interface RepublishedInvite {
  readonly relationshipId: string;
  readonly inviteToken: string;
  readonly inviteLink: string;
  readonly inviteExpiresAt: string;
  /** The window the replaced link had — `expired` or `revoked`, which is why it was offered. */
  readonly replaced: string;
}

/** The audit-safe half of a re-publish — same rule as `PublishedAudit`: never the token. */
export type RepublishedAudit = Omit<RepublishedInvite, "inviteToken" | "inviteLink">;

/**
 * Re-mint a lapsed invitation — one click, and **no Aspects re-entered**.
 *
 * #533's card says "a new invite row and a new link". Phase 1 measured the row and corrected it:
 * `session_invite`'s primary key is the session, so there is one row per assessment round, and
 * `0010_invite_resend.sql` made a reissue an `UPDATE` of `token_hash`/`expires_at` rather than a
 * second row. The old link dies because its hash is gone — the row that answered it now holds a
 * different one, and `claimInvite` answers `unknown` for a token no hash matches.
 *
 * **`resent_at`/`resent_count` are deliberately untouched.** Those two columns are #275's guard on
 * *sending*: one send a day, three a lifetime, so a person's inbox cannot be flooded. A re-publish
 * is not a send — nothing is mailed here, the member copies the link — and the thing it replaces is
 * a **dead** link, which the send counter has no opinion about. The bound is the relationship's own
 * status and the link's own expiry (phase 3 enforces the lapse), not the mailer's cooldown. The
 * audit row says `relationship.republish` and the reason, so a reader of `/admin/audit` still sees
 * every re-mint.
 */
export async function republishRelationship(
  request: RepublishRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<RepublishedInvite>> {
  const now = request.now ?? new Date();
  const inviteToken = mintToken();
  const expiresAt = inviteExpiresAt(now);
  const invite = { token: inviteToken, link: invitationLink(inviteToken), expiresAt };

  // `act()` rolls the transaction back on every refusal, which is right for the invitation (nothing
  // is minted) but would also discard the `expired` correction `lapseIfDue()` made. A lapsed pair
  // can never write successfully, so "correct it on the next write" would be never: the refusal
  // itself records the lapse, in its own transaction, after the rollback.
  try {
    const result = await act<RepublishedAudit>(
      {
        actorUserId: request.actorUserId,
        action: "relationship.republish" satisfies AdminAction,
        target: { table: "relationship", id: request.relationshipId },
        reason: request.reason,
        mutate: async (sql) => {
          const locked = await sql.query<{
            id: string;
            status: string;
            initiator_user_id: string | null;
          }>(`SELECT id, status, initiator_user_id FROM relationship WHERE id = $1 FOR UPDATE`, [
            request.relationshipId,
          ]);
          const rel = locked.rows[0];
          if (rel === undefined) {
            throw new MemberRefused(
              "no-such-relationship",
              `no relationship holds the id "${request.relationshipId}"`,
            );
          }
          if (!(await actorIsInitiator(sql, rel, request.actorUserId))) {
            throw new MemberRefused(
              "not-yours",
              `relationship "${rel.id}" was started by another account — only its initiator may reissue the invitation`,
            );
          }
          // #533 phase 3 — a lapsed membership is not a broken link. Re-minting a token would hand
          // out a link to a relationship nobody can write to, so the answer names the lapse instead
          // of the invitation. Asked **before** the status guard: a row the last refusal already
          // corrected to `expired` must still answer with the lapse sentence, which is the one that
          // says what happened, rather than with "only a published relationship has an invitation".
          const reading = await lapseIfDue(sql, rel.id, now);
          if (reading !== undefined && reading.membership.state === "lapsed") {
            throw new MemberRefused("lapsed", membershipSentence(reading.membership));
          }
          if ((rel.status as RelationshipStatus) !== "published") {
            throw new MemberRefused(
              "not-publishable",
              `relationship "${rel.id}" is ${rel.status}: only a published relationship has an invitation to reissue`,
            );
          }

          const found = await sql.query<{
            session_record_id: string;
            expires_at: Date;
            claimed_at: Date | null;
            revoked_at: Date | null;
          }>(
            `SELECT inv.session_record_id, inv.expires_at, inv.claimed_at, inv.revoked_at
             FROM session s
             JOIN session_invite inv ON inv.session_record_id = s.record_id
            WHERE s.relationship_id = $1
            ORDER BY s.round DESC
            LIMIT 1
            FOR UPDATE OF inv`,
            [rel.id],
          );
          const invite = found.rows[0];
          if (invite === undefined) {
            throw new MemberRefused(
              "no-invite",
              `relationship "${rel.id}" is published and has no invitation row — that is a repair, not a re-publish`,
            );
          }

          const view = publishViewOf({
            status: "published",
            invite: {
              claimed: invite.claimed_at !== null,
              revoked: invite.revoked_at !== null,
              expiresAt: invite.expires_at,
            },
            now,
          });
          if (!republishable(view)) {
            throw new MemberRefused(
              view === "invite-live" ? "invite-live" : "not-publishable",
              view === "invite-live"
                ? `the invitation on "${rel.id}" is still live until ${invite.expires_at.toISOString()} — there is nothing to reissue yet`
                : `the invitation on "${rel.id}" is ${view}: a seat somebody took is not reissued`,
            );
          }

          await sql.query(
            `UPDATE session_invite
              SET token_hash = $2,
                  expires_at = $3,
                  revoked_at = NULL,
                  revoked_by = NULL
            WHERE session_record_id = $1`,
            [invite.session_record_id, hashToken(inviteToken), expiresAt.toISOString()],
          );

          return {
            before: {
              sessionRecordId: invite.session_record_id,
              expiresAt: invite.expires_at.toISOString(),
              claimed: invite.claimed_at !== null,
              revoked: invite.revoked_at !== null,
              state: view,
            },
            after: {
              relationshipId: rel.id,
              inviteExpiresAt: expiresAt.toISOString(),
              replaced: view,
            },
          };
        },
      },
      runner,
    );

    return { ...result, after: { ...result.after, inviteToken, inviteLink: invite.link } };
  } catch (error) {
    if (error instanceof MemberRefused && error.reason === "lapsed") {
      await recordLapseIfDue(request.relationshipId, now);
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ *
 * The billing basis, for the screens
 * ------------------------------------------------------------------ */

/**
 * The account's live subscription, as the detail screen's trial band reads it.
 *
 * Exported because the detail page needs the same row the publish path decides with: the trial
 * state on screen and the refusal at publish must be the same fact, or a member reads "no trial"
 * and then gets "a trial is running".
 */
export async function readMemberSubscription(userId: string): Promise<Subscription | null> {
  return readActiveSubscription(userId);
}
