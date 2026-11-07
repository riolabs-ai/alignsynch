/**
 * Editing a relationship that already exists — the write half of #623.
 *
 * `lib/relationship/edit.ts` decides what a change costs; this module carries the change out in one
 * `act()` transaction, and it **re-asks the cost from the locked rows** rather than trusting the
 * confirmation a screen sent. That ordering is the point of the card: a preview a client can skip
 * is a warning that does not exist, so the write recomputes the same invalidation list and refuses
 * until the caller has confirmed *that* list (`unconfirmed-invalidation`).
 *
 * **Four things are written here, and the fifth — the pin — is the version.**
 *
 *   record.title / record.summary   the relationship's copy, and each session copy a party reads.
 *                                   Nothing derives a score from either.
 *   item.*                          the Aspects, replaced wholesale exactly as `saveAspects` does,
 *                                   because the copy is a copy and a diff would leave a stale row.
 *   template_version + the pin      a save writes the next immutable version and moves
 *                                   `relationship.template_version_id` to it — the only way the pin
 *                                   ever moves, and the reason V4 can compare a copy to a version.
 *   session_invite.*                the counterparty's name and address, and the invitation's
 *                                   window — while the seat is unclaimed. A claimed seat is an
 *                                   account binding (`party.user_id`), not a text field.
 *
 * **What is deliberately absent, and why it is absent rather than refused late.** `mode`,
 * `setting`, `status`, `completed_at`, `expired_at`, `void_reason`, `lapse_reason` are not written
 * by this module. The first two are `session` columns a scored row may not be rewritten
 * (`db-verify` V18), the middle one is a transition's outcome, and the last three are recorded
 * facts written beside the transition that ended the relationship. `EDITABLE_FIELDS` in the pure
 * module is the same statement in a table, so the surface and the writer cannot disagree.
 *
 * **The answers a removal strands are deleted, and the count is the audit row's.** The owner's
 * decision on #623 authorises that ("the invalidation is stated before saving"), and there is no
 * other honest option: an `opinion` row keyed to an Aspect the sheet no longer asks leaves the
 * instance incomplete (`V6`/`V15`) and a reader unable to say what was answered. Deleting the item
 * and its answers together keeps every count consistent, which is what those checks measure.
 *
 * **Ownership is checked inside the transaction, and so is the audience.** A member may edit their
 * own row; staff may edit any row (`audience: "staff"`, which reads the actor's rung from
 * `user_profile` under `FOR SHARE` in the same transaction). The two are different questions and
 * neither is answered by a hidden button.
 */
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { AlignmentSetting, Assessment, AssessmentMode, PartyRole } from "@/content/assessment";
import { assessmentTemplateFromPayload } from "@/lib/db/rows";
import { queryRows } from "@/lib/db/client";
import { emailLooksDeliverable } from "@/lib/flow/resend";
import { MemberRefused } from "@/lib/member/publish-basis";
import { snapshotVersion } from "@/lib/member/relationships";
import {
  blockedOf,
  invalidationsOf,
  isNoChange,
  refusalFor,
  statedOf,
  type AnswerTally,
  type EditAspect,
  type EditInvalidation,
  type EditSnapshot,
} from "@/lib/relationship/edit";
import { isClosedRelationshipStatus, type RelationshipStatus } from "@/lib/relationship/status";
import type {
  EditDraft,
  EditableVersion,
  RelationshipEditState,
} from "@/lib/relationship/edit-view";

/** The longest invitation window an edit may set, in days. A guard, not a policy. */
export const MAX_INVITE_WINDOW_DAYS = 60;

/** The relationship columns this module reads, in one shape. */
interface RelationshipEditRow {
  readonly id: string;
  readonly status: string;
  readonly template_id: string;
  readonly template_version_id: string | null;
  readonly initiator_user_id: string | null;
}

interface SessionEditRow {
  readonly record_id: string;
  readonly mode: string;
  readonly alignment_setting: string;
}

interface InviteEditRow {
  readonly counterparty_name: string | null;
  readonly email: string;
  readonly claimed_at: Date | string | null;
  readonly expires_at: Date | string | null;
}

interface CopyRow {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

interface AspectEditRow {
  readonly item_id: string;
  readonly prompt: string;
  readonly left_value: string | null;
  readonly right_value: string | null;
}

interface AnswerEditRow {
  readonly item_id: string;
  readonly role: string;
  readonly name: string;
  readonly answers: number;
}

/** One version the pin may move to, as the select draws it. */
export type {
  EditableVersion,
  EditDraft,
  RelationshipEditState,
} from "@/lib/relationship/edit-view";

export interface EditRelationshipRequest {
  readonly actorUserId: string;
  readonly relationshipId: string;
  readonly reason: string;
  /**
   * `initiator` enforces ownership; `staff` requires `admin` and accepts any row. The default is
   * `initiator` so a caller that forgets cannot widen its own authority.
   */
  readonly audience?: "initiator" | "staff";
  readonly draft: EditDraft;
  /**
   * True once the surface has shown the invalidation list and the person confirmed it. The write
   * refuses without it whenever the statement has a cost — and never asks when it has none.
   */
  readonly confirmInvalidation?: boolean;
  readonly now?: Date;
}

/** What an edit answers, inside the audit row. */
export interface EditedRelationship {
  readonly relationshipId: string;
  readonly status: RelationshipStatus;
  readonly version: number | null;
  readonly title: string;
  /** The costs that were confirmed, so the audit row says what the edit discarded. */
  readonly confirmed: readonly EditInvalidation[];
  readonly discardedAnswers: number;
  readonly aspects: readonly string[];
}

/** What a preview answers: the costs, the block, and the state the surface should re-render. */
export interface EditPreview {
  readonly blocked: {
    readonly code: "mode-fixed" | "answers-sealed";
    readonly message: string;
  } | null;
  readonly invalidations: readonly EditInvalidation[];
  readonly state: RelationshipEditState;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** An `Assessment`'s items as the editor's four fields — the shape the invalidation arithmetic takes. */
function aspectsOf(record: Assessment): EditAspect[] {
  return record.items.map((item) => ({
    id: item.id,
    prompt: item.prompt,
    leftValue: item.leftValue ?? "",
    rightValue: item.rightValue ?? "",
  }));
}

/**
 * The state, read with no lock — for a screen or a preview.
 *
 * `undefined` when the relationship does not exist or belongs to somebody else, which the page
 * turns into the same 404 a stranger's URL gets (`readMyRelationship`'s rule).
 */
export async function readRelationshipEditState(input: {
  readonly actorUserId: string;
  readonly relationshipId: string;
  readonly audience?: "initiator" | "staff";
  readonly now?: Date;
}): Promise<RelationshipEditState | undefined> {
  const now = input.now ?? new Date();
  const [row] = await queryRows<RelationshipEditRow>(
    `SELECT id, status, template_id, template_version_id, initiator_user_id
       FROM relationship WHERE id = $1`,
    [input.relationshipId],
  );
  if (row === undefined) return undefined;
  if (
    (input.audience ?? "initiator") === "initiator" &&
    row.initiator_user_id !== input.actorUserId
  ) {
    return undefined;
  }

  const copyRows = await queryRows<CopyRow>("SELECT id, title, summary FROM record WHERE id = $1", [
    row.template_id,
  ]);
  const copy = copyRows[0];
  if (copy === undefined) return undefined;

  const sessions = await queryRows<SessionEditRow>(
    `SELECT record_id, mode, alignment_setting FROM session
      WHERE relationship_id = $1 ORDER BY round DESC LIMIT 1`,
    [row.id],
  );
  const session = sessions[0];

  const aspects = await readAspects(row.template_id);
  const answers = await readAnswers(row.id);
  const versions = await readVersions(row.template_id, row.template_version_id);
  const record = await readCopyRecord(row.template_id, row.template_version_id);

  const invites =
    session === undefined
      ? []
      : await queryRows<InviteEditRow>(
          `SELECT counterparty_name, email, claimed_at, expires_at
             FROM session_invite WHERE session_record_id = $1`,
          [session.record_id],
        );
  const inviteRow = invites[0];
  const invite =
    inviteRow === undefined || inviteRow.expires_at === null
      ? null
      : {
          name: inviteRow.counterparty_name ?? "",
          email: inviteRow.email,
          claimed: inviteRow.claimed_at !== null,
          expiresAt: iso(inviteRow.expires_at),
          daysLeft: Math.max(
            0,
            Math.floor(
              (new Date(inviteRow.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
            ),
          ),
        };

  return {
    relationshipId: row.id,
    status: row.status as RelationshipStatus,
    closed: isClosedRelationshipStatus(row.status as RelationshipStatus),
    record,
    title: copy.title,
    summary: copy.summary,
    mode: (session?.mode as AssessmentMode | undefined) ?? "basic",
    setting: (session?.alignment_setting as AlignmentSetting | undefined) ?? "soft",
    aspects,
    versions,
    versionId: row.template_version_id,
    invite,
    answers,
    sessionExists: session !== undefined,
  };
}

async function readAspects(templateId: string): Promise<EditAspect[]> {
  const rows = await queryRows<AspectEditRow>(
    `SELECT item_id, prompt, left_value, right_value FROM item
      WHERE record_id = $1 ORDER BY position`,
    [templateId],
  );
  return rows.map((row) => ({
    id: row.item_id,
    prompt: row.prompt,
    leftValue: row.left_value ?? "",
    rightValue: row.right_value ?? "",
  }));
}

/**
 * How many answers each seat holds on each Aspect, across every round of the relationship.
 *
 * A **count**, never a value: the blind rule (#623's non-negotiable) is that an edit screen may
 * not expose one party's answers to the other, and `lib/db/admin-relationship.ts` already draws the
 * same line — "a count is arithmetic over rows, not a score". The name is the seat's, because the
 * owner's sentence names the person: "turning off Aspect 3 discards 2 answers from Avery".
 */
async function readAnswers(relationshipId: string): Promise<AnswerTally[]> {
  const rows = await queryRows<AnswerEditRow>(
    `SELECT o.item_id,
            o.role,
            COALESCE(p.name, o.role) AS name,
            count(*)::int          AS answers
       FROM opinion o
       JOIN session s ON s.record_id = o.session_record_id
       LEFT JOIN party p
         ON p.session_record_id = o.session_record_id AND p.role = o.role
      WHERE s.relationship_id = $1
      GROUP BY o.item_id, o.role, p.name
      ORDER BY o.item_id, o.role`,
    [relationshipId],
  );
  return rows.map((row) => ({
    aspectId: row.item_id,
    role: (row.role === "counterparty" ? "counterparty" : "initiator") as PartyRole,
    name: row.name,
    answers: Number(row.answers),
  }));
}

async function readVersions(
  templateId: string,
  currentId: string | null,
): Promise<EditableVersion[]> {
  const rows = await queryRows<{ id: string; version: number; published_at: Date | string }>(
    `SELECT id, version, published_at FROM template_version
      WHERE template_record_id = $1 ORDER BY version DESC`,
    [templateId],
  );
  return rows.map((row) => ({
    id: row.id,
    version: Number(row.version),
    publishedAt: iso(row.published_at),
    current: row.id === currentId,
  }));
}

/**
 * The relationship's copy as a whole record, from the version it is bound to.
 *
 * The pin is not decoration: `0026` made it the thing every party-facing read parses, so the same
 * payload a session is compared against (V4) is the object the editor posts back. A copy read from
 * the `item` rows instead would be a second reading of the same words, and the two could disagree
 * the moment a version was written without its rows.
 */
async function readCopyRecord(templateId: string, versionId: string | null): Promise<Assessment> {
  if (versionId === null) {
    throw new MemberRefused(
      "not-editable",
      `template "${templateId}" has no bound version — that is a repair, not an edit`,
    );
  }
  const [row] = await queryRows<{ payload: unknown; template_record_id: string }>(
    "SELECT payload, template_record_id FROM template_version WHERE id = $1",
    [versionId],
  );
  if (row === undefined || row.template_record_id !== templateId) {
    throw new MemberRefused(
      "not-editable",
      `relationship's bound version "${versionId}" belongs to no template "${templateId}"`,
    );
  }
  return assessmentTemplateFromPayload(row.payload, `template version "${versionId}"`);
}

/** The version a pin move is asking for, or a refusal — read under the transaction's lock. */
async function payloadOfVersion(
  sql: ActSql,
  templateId: string,
  versionId: string,
): Promise<Assessment> {
  const rows = await sql.query<{ payload: unknown; template_record_id: string }>(
    "SELECT payload, template_record_id FROM template_version WHERE id = $1",
    [versionId],
  );
  const row = rows.rows[0];
  if (row === undefined || row.template_record_id !== templateId) {
    throw new MemberRefused(
      "no-such-version",
      `no version "${versionId}" belongs to this relationship's template "${templateId}"`,
    );
  }
  return assessmentTemplateFromPayload(row.payload, `template version "${versionId}"`);
}

/** A pinned version's payload, or `undefined` when the id names no version of this template. */
async function pinnedPayloadOf(
  versionId: string,
  state: RelationshipEditState,
): Promise<Assessment | undefined> {
  if (state.versions.every((version) => version.id !== versionId)) return undefined;
  const [row] = await queryRows<{ payload: unknown }>(
    "SELECT payload FROM template_version WHERE id = $1",
    [versionId],
  );
  if (row === undefined) return undefined;
  return assessmentTemplateFromPayload(row.payload, `template version "${versionId}"`);
}

/**
 * What an edit *would* cost, computed from the rows as they stand — the preview the surface draws
 * before it offers the save button.
 *
 * Nothing is written and nothing is locked: this is the read a screen makes when the person types,
 * and its answer is advisory. `editRelationship` recomputes it under `FOR UPDATE` and is the
 * answer that counts.
 */
export async function previewRelationshipEdit(input: {
  readonly actorUserId: string;
  readonly relationshipId: string;
  readonly audience?: "initiator" | "staff";
  readonly draft: EditDraft;
  readonly now?: Date;
}): Promise<EditPreview> {
  const state = await readRelationshipEditState(input);
  if (state === undefined) {
    throw new MemberRefused(
      "no-such-relationship",
      `no relationship holds the id "${input.relationshipId}" that this account may edit`,
    );
  }

  const pinned =
    input.draft.versionId === undefined || input.draft.versionId === null
      ? undefined
      : await pinnedPayloadOf(input.draft.versionId, state);

  const before: EditSnapshot = {
    title: state.title,
    summary: state.summary,
    mode: state.mode,
    setting: state.setting,
    aspects: state.aspects,
  };
  const after: EditSnapshot = {
    title: pinned?.title ?? input.draft.record.title,
    summary: pinned?.summary ?? input.draft.record.summary,
    mode: state.mode,
    setting: state.setting,
    aspects: aspectsOf(pinned ?? input.draft.record),
  };

  return previewOf({ before, after, state });
}

function previewOf(input: {
  readonly before: EditSnapshot;
  readonly after: EditSnapshot;
  readonly state: RelationshipEditState;
}): EditPreview {
  const invalidations = invalidationsOf({
    before: input.before,
    after: input.after,
    answers: input.state.answers,
    sessionExists: input.state.sessionExists,
  });
  const blocked = blockedOf(invalidations);
  return {
    blocked:
      blocked === undefined
        ? null
        : {
            code: refusalFor(blocked),
            message:
              blocked.code === "adds-question"
                ? "a new Aspect cannot be added once a sheet has been answered — the sheet would be incomplete for whoever already answered, and the honest path to a new question is a new round"
                : `the ${blocked.code === "changes-mode" ? "mode" : "Setting"} is fixed once the session exists: it decided which questions were asked, and a scored session is never rewritten`,
          },
    invalidations,
    state: input.state,
  };
}

/**
 * Write an edit — one audited transaction, and the cost recomputed under the lock.
 *
 * The refusal order is deliberate: **who**, then **what state**, then **what it costs**, then the
 * write. A person who is not the initiator is told that before they are told anything about the
 * row's contents, and a relationship that ended is told so before its Aspects are diffed.
 */
export async function editRelationship(
  request: EditRelationshipRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<EditedRelationship>> {
  const now = request.now ?? new Date();
  const audience = request.audience ?? "initiator";

  return act<EditedRelationship>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.edit" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        if (audience === "staff") await requireStaff(sql, request.actorUserId);

        const locked = await sql.query<RelationshipEditRow>(
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
        if (audience === "initiator" && rel.initiator_user_id !== request.actorUserId) {
          throw new MemberRefused(
            "not-yours",
            `relationship "${rel.id}" was started by another account — only its initiator may edit it`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (isClosedRelationshipStatus(status)) {
          throw new MemberRefused(
            "not-editable",
            `relationship "${rel.id}" is ${status}: a completed or voided relationship is not a form`,
          );
        }
        if (rel.template_version_id === null) {
          throw new MemberRefused(
            "not-editable",
            `relationship "${rel.id}" is bound to no template version — that is a repair, not an edit`,
          );
        }

        const copyRows = await sql.query<CopyRow>(
          "SELECT id, title, summary FROM record WHERE id = $1 FOR UPDATE",
          [rel.template_id],
        );
        const copy = copyRows.rows[0];
        if (copy === undefined) {
          throw new MemberRefused(
            "no-such-relationship",
            `relationship "${rel.id}" names a copy record that does not exist`,
          );
        }

        const sessionRows = await sql.query<SessionEditRow>(
          `SELECT record_id, mode, alignment_setting FROM session
            WHERE relationship_id = $1 ORDER BY round DESC`,
          [rel.id],
        );
        const session = sessionRows.rows[0];

        const bound = await payloadOfVersion(sql, rel.template_id, rel.template_version_id);
        const pin = request.draft.versionId ?? null;
        const pinned = pin !== null && pin !== rel.template_version_id;
        const pinnedTemplate = pinned
          ? await payloadOfVersion(sql, rel.template_id, pin)
          : undefined;
        if (pinnedTemplate === undefined && request.draft.record.id !== rel.template_id) {
          throw new MemberRefused(
            "invalid-draft",
            `the Aspects name record "${request.draft.record.id}" and this relationship configures "${rel.template_id}"`,
          );
        }

        // The pin's payload *is* the new content, so a pin move replaces the caller's fields
        // rather than merging with them — a half-pin (new Aspects, old title) would be a version
        // no row in `template_version` ever held.
        const record: Assessment = pinnedTemplate ?? request.draft.record;
        const afterAspects = aspectsOf(record);
        const beforeAspects = aspectsOf(bound);

        const before: EditSnapshot = {
          title: copy.title,
          summary: copy.summary,
          // A relationship with no session has no stored mode; `basic`/`soft` are what publish
          // writes, so the diff against them is empty and the guard stays quiet.
          mode: (session?.mode as AssessmentMode | undefined) ?? "basic",
          setting: (session?.alignment_setting as AlignmentSetting | undefined) ?? "soft",
          aspects: beforeAspects,
        };
        const after: EditSnapshot = { ...before, ...record, aspects: afterAspects };

        const answerRows = await sql.query<AnswerEditRow>(
          `SELECT o.item_id, o.role, COALESCE(p.name, o.role) AS name, count(*)::int AS answers
             FROM opinion o
             JOIN session s ON s.record_id = o.session_record_id
             LEFT JOIN party p ON p.session_record_id = o.session_record_id AND p.role = o.role
            WHERE s.relationship_id = $1
            GROUP BY o.item_id, o.role, p.name`,
          [rel.id],
        );
        const answers: AnswerTally[] = answerRows.rows.map((row) => ({
          aspectId: row.item_id,
          role: (row.role === "counterparty" ? "counterparty" : "initiator") as PartyRole,
          name: row.name,
          answers: Number(row.answers),
        }));

        const invalidations = invalidationsOf({
          before,
          after,
          answers,
          sessionExists: session !== undefined,
        });
        const blocked = blockedOf(invalidations);
        if (blocked !== undefined) {
          throw new MemberRefused(
            refusalFor(blocked),
            `relationship "${rel.id}": ${
              blocked.code === "adds-question"
                ? "a new Aspect on an answered sheet would leave it incomplete — that is a new round, not an edit"
                : `the ${blocked.code === "changes-mode" ? "mode" : "Setting"} of a session is never rewritten once it exists`
            }`,
          );
        }
        const costs = statedOf(invalidations);
        if (costs.length > 0 && request.confirmInvalidation !== true) {
          throw new MemberRefused(
            "unconfirmed-invalidation",
            `relationship "${rel.id}": this edit costs ${costs.reduce(
              (sum, cost) => sum + cost.total,
              0,
            )} answer(s) — the invalidation has to be confirmed before it is written`,
          );
        }

        const aspectsMoved = !sameAspects(beforeAspects, afterAspects);
        const titleMoved = before.title !== after.title || before.summary !== after.summary;
        if (!aspectsMoved && !titleMoved && !pinned && !seatOrWindowIsAsked(request.draft)) {
          throw new MemberRefused(
            "no-change",
            `relationship "${rel.id}": nothing in this edit differs from the row`,
          );
        }

        // The counterparty fields and the invitation's window, while the seat is unclaimed: a
        // claimed seat is `party.user_id`, and re-pointing it is an account repair.
        let inviteChanged: Record<string, unknown> | null = null;
        if (session !== undefined && seatOrWindowIsAsked(request.draft)) {
          inviteChanged = await writeInvite(sql, {
            relationshipId: rel.id,
            sessionRecordId: session.record_id,
            draft: request.draft,
            now,
          });
        }

        // The copy: title and summary on the configuration the initiator edits and on every sheet
        // a party reads. `record` is not a scored row, so both are ordinary writes.
        for (const row of [copy.id, ...sessionRows.rows.map((round) => round.record_id)]) {
          await sql.query("UPDATE record SET title = $2, summary = $3 WHERE id = $1", [
            row,
            after.title,
            after.summary,
          ]);
        }

        let versionNumber: number | null = null;
        let discarded = 0;

        if (aspectsMoved) {
          // Replace, do not diff — the same rule `saveAspects` follows, for the same reason: a
          // stale Aspect that survives a removal is a question nobody can answer.
          await sql.query("DELETE FROM item WHERE record_id = $1", [rel.template_id]);
          for (const [position, aspect] of record.items.entries()) {
            await sql.query(
              `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
               VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
              [
                rel.template_id,
                aspect.id,
                position,
                aspect.prompt,
                aspect.leftValue ?? null,
                aspect.rightValue ?? null,
              ],
            );
          }

          const snapshot = await snapshotVersion(sql, {
            templateId: rel.template_id,
            record: { ...record, title: after.title, summary: after.summary },
            actorUserId: request.actorUserId,
            now,
          });
          versionNumber = snapshot.version;
          await sql.query("UPDATE relationship SET template_version_id = $2 WHERE id = $1", [
            rel.id,
            snapshot.id,
          ]);

          // Every round's copy follows the bound version — V4 compares each one to it, and a party
          // reading an old round must not be told a question exists that the sheet no longer asks.
          const removed = beforeAspects
            .filter((aspect) => !afterAspects.some((next) => next.id === aspect.id))
            .map((aspect) => aspect.id);
          for (const round of sessionRows.rows) {
            // **Before the items, never after.** `opinion` cascades on `item` (`0001`: the
            // `(record_id, item_id)` foreign key, ON DELETE CASCADE), so deleting the Aspect first
            // takes its answers with it and leaves nothing to count — the audit row would report a
            // free edit for an edit that discarded two answers. Counting the cascade is not
            // possible; deleting explicitly first is, and the row count is then the real cost.
            if (removed.length > 0) {
              const cleared = await sql.query<{ item_id: string }>(
                `DELETE FROM opinion
                  WHERE session_record_id = $1 AND item_id = ANY($2::text[])
                  RETURNING item_id`,
                [round.record_id, removed],
              );
              discarded += cleared.rows.length;
            }

            /*
             * A round's copy is **diffed**, not replaced — the opposite of the template record
             * above, and for a reason the wholesale form hides: `DELETE FROM item` on a round
             * cascades to *every* answer it holds, so "turn off Aspect 3" would also take the
             * answers to Aspect 1 and 2 while the confirmation named only Aspect 3's. The cost
             * printed before the save has to be the cost actually paid. The pin still moves to a
             * new version, and V4 compares the copy to it, so a diff that leaves both equal is
             * the whole requirement.
             */
            for (const aspectId of removed) {
              await sql.query("DELETE FROM item WHERE record_id = $1 AND item_id = $2", [
                round.record_id,
                aspectId,
              ]);
            }
            for (const [position, aspect] of record.items.entries()) {
              const existed = beforeAspects.some((was) => was.id === aspect.id);
              if (existed) {
                await sql.query(
                  `UPDATE item
                      SET position = $3, prompt = $4, left_value = $5, right_value = $6
                    WHERE record_id = $1 AND item_id = $2`,
                  [
                    round.record_id,
                    aspect.id,
                    position,
                    aspect.prompt,
                    aspect.leftValue ?? null,
                    aspect.rightValue ?? null,
                  ],
                );
              } else {
                await sql.query(
                  `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
                   VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
                  [
                    round.record_id,
                    aspect.id,
                    position,
                    aspect.prompt,
                    aspect.leftValue ?? null,
                    aspect.rightValue ?? null,
                  ],
                );
              }
            }
          }
        }

        return {
          before: {
            status,
            versionId: rel.template_version_id,
            title: copy.title,
            summary: copy.summary,
            aspects: beforeAspects,
            invite: inviteChanged,
          },
          after: {
            relationshipId: rel.id,
            status,
            version: versionNumber,
            title: after.title,
            confirmed: costs,
            discardedAnswers: discarded,
            aspects: afterAspects.map((aspect) => aspect.id),
          },
        };
      },
    },
    runner,
  );
}

/** The seat fields or the window — the two writes that are not the copy. */
function seatOrWindowIsAsked(draft: EditDraft): boolean {
  return (
    draft.counterpartyName !== undefined ||
    draft.counterpartyEmail !== undefined ||
    draft.inviteDays !== undefined
  );
}

/**
 * The invitation's name, address and window — inside the lock, and only while the seat is open.
 *
 * A claimed seat refuses before anything is written: the row is the same one `claimInvite` fills,
 * and re-pointing a taken seat is a repair (`lib/admin/relationship-ops.ts`), not an edit.
 */
async function writeInvite(
  sql: ActSql,
  input: {
    readonly relationshipId: string;
    readonly sessionRecordId: string;
    readonly draft: EditDraft;
    readonly now: Date;
  },
): Promise<Record<string, unknown> | null> {
  const invites = await sql.query<InviteEditRow>(
    `SELECT counterparty_name, email, claimed_at, expires_at
       FROM session_invite WHERE session_record_id = $1 FOR UPDATE`,
    [input.sessionRecordId],
  );
  const invite = invites.rows[0];
  if (invite === undefined) return null;

  if (invite.claimed_at !== null) {
    throw new MemberRefused(
      "seat-claimed",
      `the invitation on "${input.relationshipId}" was claimed — the seat is an account binding, not a text field`,
    );
  }

  const name = input.draft.counterpartyName?.trim();
  const email = input.draft.counterpartyEmail?.trim().toLowerCase();
  if (name !== undefined && name === "") {
    throw new MemberRefused(
      "invalid-counterparty",
      "the invitation needs the other person's name — it is what they are asked to confirm when they join",
    );
  }
  if (email !== undefined && !emailLooksDeliverable(email)) {
    throw new MemberRefused(
      "invalid-counterparty",
      `"${email}" is not an address an invitation can be sent to`,
    );
  }
  if (input.draft.inviteDays !== undefined) {
    const days = input.draft.inviteDays;
    if (!Number.isInteger(days) || days < 1 || days > MAX_INVITE_WINDOW_DAYS) {
      throw new MemberRefused(
        "invalid-window",
        `an invitation window is a whole number of days between 1 and ${MAX_INVITE_WINDOW_DAYS}`,
      );
    }
  }

  const expiresAt =
    input.draft.inviteDays === undefined
      ? null
      : new Date(input.now.getTime() + input.draft.inviteDays * 24 * 60 * 60 * 1000);

  if (name === undefined && email === undefined && expiresAt === null) return null;

  await sql.query(
    `UPDATE session_invite
        SET counterparty_name = COALESCE($2, counterparty_name),
            email = COALESCE($3, email),
            expires_at = COALESCE($4, expires_at)
      WHERE session_record_id = $1`,
    [
      input.sessionRecordId,
      name === undefined || name === "" ? null : name,
      email ?? null,
      expiresAt === null ? null : expiresAt.toISOString(),
    ],
  );

  return {
    name: name ?? null,
    email: email ?? null,
    expiresAt: expiresAt === null ? null : expiresAt.toISOString(),
  };
}

/** `admin` and above, read under `FOR SHARE` in the same transaction — staff edits any row. */
async function requireStaff(sql: ActSql, actorUserId: string): Promise<void> {
  const rows = await sql.query<{ role: string }>(
    "SELECT role FROM user_profile WHERE user_id = $1 FOR SHARE",
    [actorUserId],
  );
  const role = rows.rows[0]?.role;
  if (role !== "admin" && role !== "owner") {
    throw new MemberRefused(
      "not-yours",
      `user "${actorUserId}" holds "${role ?? "no profile"}" — editing another account's relationship needs admin`,
    );
  }
}

/** Same ids, prompts, ends and order? Then the Aspect set did not move and no version is written. */
function sameAspects(before: readonly EditAspect[], after: readonly EditAspect[]): boolean {
  if (before.length !== after.length) return false;
  return before.every((aspect, index) => {
    const other = after[index];
    return (
      other !== undefined &&
      other.id === aspect.id &&
      other.prompt === aspect.prompt &&
      other.leftValue === aspect.leftValue &&
      other.rightValue === aspect.rightValue
    );
  });
}
