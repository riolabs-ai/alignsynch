/**
 * The initiator's relationships — `/dashboard/relationships`, read and written (#533 phase 2).
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
import type { Assessment } from "@/content/assessment";
import type { BillingInterval, BillingPlanId } from "@/data/billing-plans";
import { billingProvider } from "@/lib/billing";
import { readActiveSubscription } from "@/lib/db/billing";
import { queryRows } from "@/lib/db/client";
import { openPaymentObligation } from "@/lib/db/relationship-payment";
import {
  assessmentTemplateFromPayload,
  assessmentTemplateFromRows,
  type ItemRow,
  type OptionRow,
  type RecordRow,
} from "@/lib/db/rows";
import { emailLooksDeliverable } from "@/lib/flow/resend";
import { invitationLink } from "@/lib/flow/email";
import { hashToken, mintToken } from "@/lib/flow/tokens";
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

/** Where the relationship screens live. One place, because a redirect and a link agree. */
export const MEMBER_RELATIONSHIPS_PATH = "/dashboard/relationships";

/**
 * One relationship's own screen (#620).
 *
 * The only surface that configures or publishes a relationship, so both the card's title and its
 * `Publish Assessment` action point here — a path spelled in two components would be two copies of
 * one route, which is the drift `lib/flow/paths.ts` exists to prevent.
 */
export function memberRelationshipPath(relationshipId: string): string {
  return `${MEMBER_RELATIONSHIPS_PATH}/${relationshipId}`;
}

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
  /** The relationship's own copy of the template — its title above the Aspects. */
  readonly templateId: string;
  readonly title: string;
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
  readonly created_at: Date | string;
  readonly published_at: Date | string | null;
  /** #533 phase 3 — the lapse, when the row records one (`0032`). */
  readonly expired_at: Date | string | null;
  readonly lapse_reason: string | null;
  readonly template_id: string;
  readonly title: string;
  readonly summary: string;
  readonly session_record_id: string | null;
  readonly aspect_count: number;
  readonly counterparty_name: string | null;
  readonly claimed: boolean | null;
  readonly revoked: boolean | null;
  readonly expires_at: Date | string | null;
}

/**
 * The one read both surfaces use.
 *
 * `rel.initiator_user_id = $1` is the whole permission, in the query rather than in a component —
 * the rule `lib/db/my-instances.ts` follows for `party.user_id`. The session is the **latest
 * round** (`ORDER BY round DESC`), because a relationship may hold several and the list is about
 * the relationship, not one cycle. The invitation hangs off that session, so a draft has none.
 */
const RELATIONSHIP_COLUMNS = `
  rel.id, rel.status, rel.created_at, rel.published_at, rel.expired_at, rel.lapse_reason,
  t.id AS template_id, t.title, t.summary,
  s.record_id AS session_record_id,
  (SELECT count(*)::int FROM item i WHERE i.record_id = t.id) AS aspect_count,
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
  LEFT JOIN session_invite inv ON inv.session_record_id = s.record_id
`;

function instantOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function relationshipOf(
  row: RelationshipQueryRow,
  now: Date,
  subscription: TrialFacts | null,
): MemberRelationshipRow {
  const status = row.status as RelationshipStatus;
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
    templateId: row.template_id,
    title: row.title,
    summary: row.summary,
    createdAt: instantOf(row.created_at),
    publishedAt: row.published_at === null ? null : instantOf(row.published_at),
    sessionRecordId: row.session_record_id,
    aspectCount: Number(row.aspect_count),
    invite,
    counterpartyName: row.counterparty_name,
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

/** Every relationship this member started, newest first. */
export async function listMyRelationships(
  userId: string,
  now: Date = new Date(),
): Promise<MemberRelationshipRow[]> {
  const rows = await queryRows<RelationshipQueryRow>(
    `SELECT ${RELATIONSHIP_COLUMNS}
     ${RELATIONSHIP_FROM}
      WHERE rel.initiator_user_id = $1
      ORDER BY rel.created_at DESC, rel.id DESC`,
    [userId],
  );
  // One subscription read for the whole list: the membership is the *account's* fact, so asking
  // per row would be the same query N times and could return two different answers if a payment
  // landed between two of them.
  const subscription = rows.length === 0 ? null : await readActiveSubscription(userId);
  return rows.map((row) => relationshipOf(row, now, subscription));
}

/** The detail screen's view: the row above, plus the Aspects it configures. */
export interface MemberRelationshipView extends MemberRelationshipRow {
  readonly template: Assessment;
  /** May the Aspects be edited right now? `draft` and `pending` only (`aspectsEditable`). */
  readonly aspectsEditable: boolean;
  /** May it be published from its current status? `publishable()` — the detail screen's band. */
  readonly publishable: boolean;
  /** Does the invitation's state offer the one-click reissue? `republishable()` — `expired`/`revoked`. */
  readonly offersRepublish: boolean;
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
 * One relationship, if it is this member's — and the Aspects it was configured with.
 *
 * The Aspects are read from the relationship's **own copy** (`rel.template_id`), which is what the
 * member is editing while the relationship is a draft. After publish the lock is the model's
 * (`aspectsEditable`) and the copy is frozen for the same reason: the pair was invited on those
 * words, and the session that runs them holds its own snapshot of the same version.
 *
 * `undefined` for a stranger's id, exactly as `readMyTemplate` answers — the page turns it into
 * `notFound()`.
 */
export async function readMyRelationship(
  userId: string,
  relationshipId: string,
  now: Date = new Date(),
): Promise<MemberRelationshipView | undefined> {
  const rows = await queryRows<RelationshipQueryRow>(
    `SELECT ${RELATIONSHIP_COLUMNS}
     ${RELATIONSHIP_FROM}
      WHERE rel.id = $2 AND rel.initiator_user_id = $1`,
    [userId, relationshipId],
  );
  const row = rows[0];
  if (row === undefined) return undefined;

  const record = await queryRows<RecordRow & { id: string }>(
    `SELECT id, slug, record_type, status, date, title, summary FROM record WHERE id = $1`,
    [row.template_id],
  );
  const items = await queryRows<ItemRow>(
    `SELECT record_id, item_id, position, prompt, scale_kind, left_value, right_value
       FROM item WHERE record_id = $1 ORDER BY position`,
    [row.template_id],
  );
  const options = await queryRows<OptionRow>(
    `SELECT record_id, item_id, option_id, position, text
       FROM response_option WHERE record_id = $1 ORDER BY position`,
    [row.template_id],
  );
  const primary = record[0];
  if (primary === undefined) return undefined;

  const subscription = await readActiveSubscription(userId);
  const base = relationshipOf(row, now, subscription);
  const trial = trialStateOf(subscription, now);
  // #533 phase 3 — derived at the instant the page was handed, never written here (a render may
  // not write). The same function the claim and the answer submit refuse with, so the band and the
  // refusal can never disagree about whether this relationship may be written to.
  const membership = base.membership;
  return {
    ...base,
    template: assessmentTemplateFromRows({ record: primary, items, options }),
    aspectsEditable: aspectsEditable(base.status),
    publishable: publishable(base.status),
    offersRepublish: republishable(base.view) && membership.state !== "lapsed",
    trialWithoutLiveInvite: trialRunningWithoutLiveInvite(trial, base.view),
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
 * createRelationship
 * ------------------------------------------------------------------ */

/** What creating a relationship is asked for: who, why, and which of the member's templates. */
export interface CreateRelationshipRequest {
  readonly actorUserId: string;
  readonly reason: string;
  readonly templateId: string;
  /** A clock, injectable so a test can pin the relationship's instants. */
  readonly now?: Date;
}

/** What a create answers, inside the audit row's `after`. */
export interface CreatedRelationship {
  readonly relationshipId: string;
  readonly templateId: string;
  readonly status: RelationshipStatus;
  readonly version: number;
}

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
 */
async function snapshotVersion(
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

/**
 * Start a relationship from one of the member's own templates.
 *
 * Three rows, in one transaction, and each has a job:
 *
 *   1. the **copy** (`record` + `item`) — the relationship's own Aspects, which the member will
 *      edit until they publish and which no other relationship shares;
 *   2. the **version** (`template_version`) — the immutable snapshot the relationship is bound to,
 *      so the session created at publish has something to be compared with (`V4`);
 *   3. the **relationship** at `draft` — the row the rest of the lifecycle moves.
 *
 * No session and no invitation: a draft is a configuration, and "the invitation goes out and the
 * session opens" is publish's sentence (`0030`). `relationship_member` records the initiator, the
 * same row `createInstanceFromTemplate` writes, so a coach seat could later be invited.
 */
export async function createRelationship(
  request: CreateRelationshipRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<CreatedRelationship>> {
  const now = request.now ?? new Date();
  const relationshipId = `relationship-member-${suffix()}`;

  return act<CreatedRelationship>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.create" satisfies AdminAction,
      target: { table: "relationship", id: relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const source = await sql.query<{
          id: string;
          slug: string;
          record_type: string;
          status: string;
          title: string;
          summary: string;
          owner_user_id: string | null;
        }>(
          `SELECT id, slug, record_type, status, title, summary, owner_user_id
             FROM record
            WHERE id = $1
              AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = record.id)
              FOR SHARE`,
          [request.templateId],
        );
        const from = source.rows[0];
        if (from === undefined || from.record_type !== "assessment") {
          throw new MemberRefused(
            "no-such-template",
            `no template record holds the id "${request.templateId}" to start a relationship from`,
          );
        }
        if (from.owner_user_id !== request.actorUserId) {
          throw new MemberRefused(
            "not-yours",
            `template "${from.slug}" belongs to another account; a relationship starts from a template you own`,
          );
        }
        const aspects = await sql.query<{ count: number }>(
          "SELECT count(*)::int AS count FROM item WHERE record_id = $1",
          [from.id],
        );
        if (Number(aspects.rows[0]?.count ?? 0) === 0) {
          throw new MemberRefused(
            "invalid-draft",
            `template "${from.slug}" has no Aspects — a relationship with nothing to ask cannot be published`,
          );
        }

        // The copy. Its id is derived from the relationship so the two are recognisable together,
        // and its slug keeps the template's stem with the same short suffix.
        const copy = await freeRecordIdentity(sql, from.slug, "member-config");
        await sql.query(
          `INSERT INTO record
             (id, slug, record_type, status, date, title, summary,
              author_user_id, owner_user_id, visibility)
           VALUES ($1, $2, 'assessment', 'draft', $3, $4, $5, $6, $6, 'private')`,
          [copy.id, copy.slug, now.toISOString(), from.title, from.summary, request.actorUserId],
        );
        await sql.query(
          `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
           SELECT $1, i.item_id, i.position, i.prompt, 'score', i.left_value, i.right_value
             FROM item i WHERE i.record_id = $2 ORDER BY i.position`,
          [copy.id, from.id],
        );

        const configRows = await sql.query<RecordRow & { id: string }>(
          `SELECT id, slug, record_type, status, date, title, summary FROM record WHERE id = $1`,
          [copy.id],
        );
        const configItems = await sql.query<ItemRow>(
          `SELECT record_id, item_id, position, prompt, scale_kind, left_value, right_value
             FROM item WHERE record_id = $1 ORDER BY position`,
          [copy.id],
        );
        const configOptions = await sql.query<OptionRow>(
          `SELECT record_id, item_id, option_id, position, text
             FROM response_option WHERE record_id = $1 ORDER BY position`,
          [copy.id],
        );
        const configRecord = configRows.rows[0];
        if (configRecord === undefined) {
          throw new Error("member/relationships: the copy was written and cannot be read back");
        }
        const config = assessmentTemplateFromRows({
          record: configRecord,
          items: configItems.rows,
          options: configOptions.rows,
        });

        const version = await snapshotVersion(sql, {
          templateId: copy.id,
          record: config,
          actorUserId: request.actorUserId,
          now,
        });

        await sql.query(
          `INSERT INTO relationship
             (id, template_id, template_version_id, initiator_user_id, counterparty_user_id,
              purchased_at, plan, created_at, status)
           VALUES ($1, $2, $3, $4, NULL, $5, NULL, $5, 'draft')`,
          [relationshipId, copy.id, version.id, request.actorUserId, now.toISOString()],
        );
        await sql.query(
          `INSERT INTO relationship_member (relationship_id, user_id, role, joined_at)
           VALUES ($1, $2, 'initiator', $3)`,
          [relationshipId, request.actorUserId, now.toISOString()],
        );

        /*
         * #619 — the payment obligation opens with the relationship, and names its one payer.
         *
         * Written here rather than at publish because the payer is fixed **at creation**: a second
         * round the counterparty opens still bills this account, and a create that was abandoned
         * leaves an obligation that simply never captures a method (which is `none`, not a charge).
         * `ON CONFLICT DO NOTHING` inside the insert keeps a retried create a no-op.
         */
        await openPaymentObligation(sql, {
          relationshipId,
          payerUserId: request.actorUserId,
          provider: billingProvider(),
        });

        return {
          before: null,
          after: {
            relationshipId,
            templateId: copy.id,
            status: "draft" as const,
            version: version.version,
          },
        };
      },
    },
    runner,
  );
}

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
          initiator_user_id: string | null;
        }>(
          `SELECT id, status, template_id, initiator_user_id
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
        if (rel.initiator_user_id !== request.actorUserId) {
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
        if (request.record.id !== rel.template_id) {
          throw new MemberRefused(
            "invalid-draft",
            `the Aspects name record "${request.record.id}" and this relationship configures "${rel.template_id}"`,
          );
        }

        const copy = await sql.query<{ id: string }>(
          "SELECT id FROM record WHERE id = $1 FOR UPDATE",
          [rel.template_id],
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
            [rel.template_id],
          )
        ).rows.map((item) => ({
          id: item.item_id,
          prompt: item.prompt,
          leftValue: item.left_value,
          rightValue: item.right_value,
        }));

        await sql.query("UPDATE record SET title = $2, summary = $3 WHERE id = $1", [
          rel.template_id,
          request.record.title,
          request.record.summary,
        ]);
        // Replace, do not diff. The copy has no `opinion` row and no session until publish, so
        // nothing cascades from these items and a replaced set cannot leave a stale Aspect behind.
        await sql.query("DELETE FROM item WHERE record_id = $1", [rel.template_id]);
        for (const [position, item] of request.record.items.entries()) {
          await sql.query(
            `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
             VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
            [rel.template_id, item.id, position, item.prompt, item.leftValue, item.rightValue],
          );
        }

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
          before: { status, version: snapshot.version - 1, aspects: before },
          after: {
            relationshipId: rel.id,
            status: after,
            version: snapshot.version,
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
  if (row.initiator_user_id !== request.actorUserId) {
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
        if (rel.initiator_user_id !== request.actorUserId) {
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
           VALUES ($1, $2, 'basic', 'soft', $3, $4)`,
          [sessionRecordId.id, rel.template_id, rel.id, nextRound],
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
          if (rel.initiator_user_id !== request.actorUserId) {
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
