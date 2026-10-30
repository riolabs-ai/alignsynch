/**
 * The flow's database half — create, claim, submit, read (#146).
 *
 * Four operations, and every one of them is a single transaction:
 *
 *   createInstanceFromTemplate   copy the template's Aspects into the instance's own rows,
 *                                write the Initiator's party row and the invitation
 *   claimInvite                  consume the token exactly once, bind the Counterparty
 *   submitAnswers                write one party's whole sheet, or refuse
 *   readFlowScreen               rows + viewer → the view model the screen draws
 *
 * **The copy is `INSERT … SELECT`.** An instance's Aspects are its own `item` rows,
 * copied out of the template's at creation time (#145 made that the shape: a record owns
 * its items). Nothing joins the instance's copy back to the template to render it, so a
 * template edited afterwards cannot reach an answered instance — `tests/flow-store.test.ts`
 * and `scripts/flow-e2e.mjs` both prove it against live rows.
 *
 * **The blind rule is a query.** `readFlowScreen` derives the status from counts, calls
 * `visibleRoles()`, and then reads the opinions for those roles **only**. Before both
 * parties submit, the other party's scores are not in memory at all.
 *
 * **The freeze is a row lock.** `submitAnswers` takes `FOR UPDATE` on the instance row,
 * recomputes the status, and refuses a write when both parties have submitted — an error,
 * never a silent no-op. The lock is what makes two simultaneous submits serialise instead
 * of both reading "answering" and both writing.
 *
 * No `gap` is written anywhere: the report is `gapOf()` over two opinion rows, computed by
 * `lib/assessment-report.ts` on every render.
 */
import type { Assessment, PartyRole } from "@/content/assessment";
import { getPool } from "@/lib/db/client";
import {
  assessmentTemplateFromRows,
  type InstanceRow,
  type ItemRow,
  type OpinionRow,
  type OptionRow,
  type PartyRow,
  type RecordRow,
} from "@/lib/db/rows";
import { invitationLink } from "@/lib/flow/email";
import {
  instanceStatusOf,
  parseSubmission,
  visibleRoles,
  type InstanceStatus,
  type RawAnswer,
  type SubmissionRejection,
} from "@/lib/flow/state";
import { hashToken, inviteExpiry, mintToken, tokenIsWellFormed } from "@/lib/flow/tokens";
import { projectScreen, type FlowInstanceRows, type FlowScreen } from "@/lib/flow/screen";
import type { PoolClient } from "pg";

/* ------------------------------------------------------------------ *\
 * Errors and codes
 * ------------------------------------------------------------------ */

/** A refusal a caller must surface. Never thrown for "not found" — that is `undefined`. */
export class FlowError extends Error {
  constructor(
    readonly code: FlowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FlowError";
  }
}

export type FlowErrorCode =
  | "invalid-input"
  | "unknown-template"
  | "template-not-published"
  | "template-has-no-aspects"
  | "record-is-an-instance";

/* ------------------------------------------------------------------ *\
 * Create
 * ------------------------------------------------------------------ */

export interface CreateInstanceInput {
  readonly templateRecordId: string;
  readonly initiatorName: string;
  readonly counterpartyName: string;
  readonly email: string;
  /** A clock, injectable so a test can pin `expires_at`. */
  readonly now?: Date;
}

export interface CreatedInstance {
  readonly instanceRecordId: string;
  readonly slug: string;
  /** The template's title — the email names it, and the screen draws it. */
  readonly templateTitle: string;
  /** The Initiator's session token — set as their cookie, never stored raw. */
  readonly initiatorToken: string;
  /** The invitation token — the one link, shown or emailed. Never stored raw. */
  readonly inviteToken: string;
}

function required(value: string, field: string): string {
  const text = value.trim();
  if (text === "") throw new FlowError("invalid-input", `${field} is required`);
  return text;
}

function emailLooksDeliverable(value: string): boolean {
  // One `@`, something before it, a dot after it: the same bar the SQL CHECK sets, kept in
  // the same place a reader looks for validation. Not RFC 5322 — an invitation does not
  // need to know more than "can a message be addressed here".
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Create an instance from a published template, in one transaction.
 *
 * The template must be a **published assessment record with no instance row**. A draft
 * template has Aspects nobody has agreed to; a record that is itself an instance is a copy
 * of a copy, and the title a report draws would be an instance's caption.
 */
export async function createInstanceFromTemplate(
  input: CreateInstanceInput,
): Promise<CreatedInstance> {
  const initiatorName = required(input.initiatorName, "your name");
  const counterpartyName = required(input.counterpartyName, "their name");
  const email = required(input.email, "their email");
  if (!emailLooksDeliverable(email)) {
    throw new FlowError("invalid-input", "their email is not an address");
  }

  const now = input.now ?? new Date();
  const initiatorToken = mintToken();
  const inviteToken = mintToken();
  const instanceRecordId = cryptoRandomId();
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const template = await client.query<{
      id: string;
      slug: string;
      title: string;
      record_type: string;
      status: string;
      aspects: number;
      is_instance: boolean;
    }>(
      `SELECT r.id, r.slug, r.title, r.record_type, r.status,
              (SELECT count(*) FROM item i WHERE i.record_id = r.id)::int AS aspects,
              EXISTS (SELECT 1 FROM assessment_instance ai WHERE ai.record_id = r.id) AS is_instance
         FROM record r
        WHERE r.id = $1
          FOR SHARE OF r`,
      [input.templateRecordId],
    );
    const found = template.rows[0];
    if (found === undefined) {
      throw new FlowError("unknown-template", `no record "${input.templateRecordId}" to copy`);
    }
    if (found.is_instance) {
      throw new FlowError(
        "record-is-an-instance",
        `record "${found.id}" is an instance; an instance is created from a template`,
      );
    }
    if (found.record_type !== "assessment") {
      throw new FlowError("unknown-template", `record "${found.id}" is not an assessment`);
    }
    if (found.status !== "published") {
      throw new FlowError(
        "template-not-published",
        `template "${found.slug}" is ${found.status}; only a published template can be copied`,
      );
    }
    if (found.aspects === 0) {
      throw new FlowError("template-has-no-aspects", `template "${found.slug}" has no Aspects`);
    }

    const slug = `${found.slug}-${instanceRecordId.slice(0, 8)}`;

    // The instance record. `draft` on purpose: a template is the published thing, an
    // instance is one relationship's private copy, and `zPublishStatus` has no value that
    // means "live but not a template" — draft is the honest one, and nothing reads it.
    await client.query(
      `INSERT INTO record (id, slug, record_type, status, date, title, summary)
       VALUES ($1, $2, 'assessment', 'draft', $3, $4, $5)`,
      [
        instanceRecordId,
        slug,
        now.toISOString(),
        found.title,
        `${found.title}, answered by ${initiatorName} and ${counterpartyName}.`,
      ],
    );

    // THE COPY. Rows owned by the instance, taken from the template at this instant and
    // never joined back — `position` travels with them, because order is part of what a
    // party answers.
    await client.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       SELECT $1, item_id, position, prompt, scale_kind, left_value, right_value
         FROM item
        WHERE record_id = $2`,
      [instanceRecordId, found.id],
    );
    await client.query(
      `INSERT INTO response_option (record_id, item_id, option_id, position, text)
       SELECT $1, item_id, option_id, position, text
         FROM response_option
        WHERE record_id = $2`,
      [instanceRecordId, found.id],
    );

    await client.query(
      "INSERT INTO assessment_instance (record_id, template_record_id) VALUES ($1, $2)",
      [instanceRecordId, found.id],
    );

    await client.query(
      `INSERT INTO party (instance_record_id, role, name, access_token_hash)
       VALUES ($1, 'initiator', $2, $3)`,
      [instanceRecordId, initiatorName, hashToken(initiatorToken)],
    );

    await client.query(
      `INSERT INTO instance_invite
         (instance_record_id, email, counterparty_name, token_hash, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        instanceRecordId,
        email,
        counterpartyName,
        hashToken(inviteToken),
        now.toISOString(),
        inviteExpiry(now).toISOString(),
      ],
    );

    await client.query("COMMIT");
    return {
      instanceRecordId,
      slug,
      templateTitle: found.title,
      initiatorToken,
      inviteToken,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** `crypto.randomUUID()`, imported lazily so this module stays a thin wrapper over SQL. */
function cryptoRandomId(): string {
  return globalThis.crypto.randomUUID();
}

/* ------------------------------------------------------------------ *\
 * Claim
 * ------------------------------------------------------------------ */

export type ClaimResult =
  | { readonly ok: true; readonly instanceRecordId: string; readonly sessionToken: string }
  | {
      readonly ok: false;
      readonly code: "unknown" | "claimed" | "expired";
      readonly reason: string;
    };

/**
 * Claim an invitation, exactly once.
 *
 * Three refusals, each named: an unknown token, a token already claimed, and a token past
 * `expires_at`. The `FOR UPDATE` on the invite row is what makes "exactly once" true under
 * two simultaneous claims — the second one waits, then reads `claimed_at` and is refused.
 */
export async function claimInvite(token: string, now = new Date()): Promise<ClaimResult> {
  if (!tokenIsWellFormed(token)) {
    return { ok: false, code: "unknown", reason: "that token is not an invitation token" };
  }
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{
      instance_record_id: string;
      counterparty_name: string;
      claimed_at: Date | null;
      expires_at: Date;
    }>(
      `SELECT instance_record_id, counterparty_name, claimed_at, expires_at
         FROM instance_invite
        WHERE token_hash = $1
          FOR UPDATE`,
      [hashToken(token)],
    );
    const invite = found.rows[0];
    if (invite === undefined) {
      await client.query("ROLLBACK");
      return { ok: false, code: "unknown", reason: "no invitation carries that token" };
    }
    if (invite.claimed_at !== null) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        code: "claimed",
        reason: `that invitation was claimed at ${invite.claimed_at.toISOString()}`,
      };
    }
    if (invite.expires_at.getTime() <= now.getTime()) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        code: "expired",
        reason: `that invitation expired at ${invite.expires_at.toISOString()}`,
      };
    }

    const sessionToken = mintToken();
    await client.query(
      `INSERT INTO party (instance_record_id, role, name, access_token_hash)
       VALUES ($1, 'counterparty', $2, $3)`,
      [invite.instance_record_id, invite.counterparty_name, hashToken(sessionToken)],
    );
    await client.query("UPDATE instance_invite SET claimed_at = $2 WHERE instance_record_id = $1", [
      invite.instance_record_id,
      now.toISOString(),
    ]);
    await client.query("COMMIT");
    return { ok: true, instanceRecordId: invite.instance_record_id, sessionToken };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------ *\
 * Submit
 * ------------------------------------------------------------------ */

export type SubmitResult =
  | { readonly ok: true; readonly status: InstanceStatus }
  | {
      readonly ok: false;
      readonly code: SubmissionRejection;
      readonly reason: string;
      readonly problems?: readonly string[];
    };

export interface SubmitInput {
  readonly instanceRecordId: string;
  /** The viewer's cookie token. The role is looked up from its hash, never from the form. */
  readonly token: string | undefined;
  readonly answers: ReadonlyMap<string, RawAnswer>;
  readonly now?: Date;
}

/**
 * Write one party's whole sheet, or refuse.
 *
 * The order matters: the instance row is locked, the party is resolved from the token (so
 * a request cannot claim to be the other party), the status is recomputed **under the
 * lock**, and only then are the rows written. A submit after both parties have answered is
 * `frozen` — a rejection the caller returns as a 409, not a redirect that looks like
 * success.
 */
export async function submitAnswers(input: SubmitInput): Promise<SubmitResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ record_id: string }>(
      "SELECT record_id FROM assessment_instance WHERE record_id = $1 FOR UPDATE",
      [input.instanceRecordId],
    );
    if (locked.rows[0] === undefined) {
      await client.query("ROLLBACK");
      return { ok: false, code: "no-such-instance", reason: "no instance has that id" };
    }

    const role =
      input.token === undefined
        ? undefined
        : await partyRoleOf(client, input.instanceRecordId, input.token);
    if (role === undefined) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        code: "not-a-party",
        reason: "this browser holds no party token for the instance",
      };
    }

    const aspects = await client.query<{ item_id: string }>(
      "SELECT item_id FROM item WHERE record_id = $1 ORDER BY position",
      [input.instanceRecordId],
    );
    const progress = await progressOfClient(client, input.instanceRecordId, aspects.rows.length);
    const status = instanceStatusOf(progress);
    if (status === "complete") {
      await client.query("ROLLBACK");
      return {
        ok: false,
        code: "frozen",
        reason: "both parties have submitted; the answers are frozen",
      };
    }

    const submission = parseSubmission(
      aspects.rows.map((row) => row.item_id),
      input.answers,
    );
    if (!submission.ok) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        code: "incomplete",
        reason: "the submission does not answer every Aspect",
        problems: submission.problems,
      };
    }

    // Delete-then-insert: a submit is the party's whole sheet, so an Aspect they cleared
    // is gone rather than left behind from the previous version of the sheet.
    await client.query("DELETE FROM opinion WHERE instance_record_id = $1 AND role = $2", [
      input.instanceRecordId,
      role,
    ]);
    for (const answer of submission.answers) {
      await client.query(
        `INSERT INTO opinion (instance_record_id, role, item_id, feel, wish)
         VALUES ($1, $2, $3, $4, $5)`,
        [input.instanceRecordId, role, answer.itemId, answer.opinions.feel, answer.opinions.wish],
      );
    }

    const after = await progressOfClient(client, input.instanceRecordId, aspects.rows.length);
    await client.query("COMMIT");
    return { ok: true, status: instanceStatusOf(after) };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function partyRoleOf(
  client: PoolClient,
  instanceRecordId: string,
  token: string,
): Promise<PartyRole | undefined> {
  const found = await client.query<{ role: PartyRole }>(
    `SELECT role FROM party
      WHERE instance_record_id = $1 AND access_token_hash = $2`,
    [instanceRecordId, hashToken(token)],
  );
  return found.rows[0]?.role;
}

async function progressOfClient(client: PoolClient, instanceRecordId: string, aspectCount: number) {
  const counts = await client.query<{ role: PartyRole; answered: number }>(
    `SELECT p.role, (SELECT count(*) FROM opinion o
                      WHERE o.instance_record_id = p.instance_record_id
                        AND o.role = p.role)::int AS answered
       FROM party p
      WHERE p.instance_record_id = $1`,
    [instanceRecordId],
  );
  const answered = (role: PartyRole) => counts.rows.find((row) => row.role === role)?.answered ?? 0;
  return {
    aspectCount,
    hasCounterparty: counts.rows.some((row) => row.role === "counterparty"),
    initiatorAnswered: answered("initiator"),
    counterpartyAnswered: answered("counterparty"),
  };
}

/* ------------------------------------------------------------------ *\
 * Read
 * ------------------------------------------------------------------ */

export interface InstanceBundle {
  readonly record: RecordRow;
  readonly items: readonly ItemRow[];
  readonly options: readonly OptionRow[];
  readonly instance: InstanceRow;
  readonly parties: readonly PartyRow[];
  readonly invite: {
    readonly email: string;
    readonly counterpartyName: string;
    readonly claimed: boolean;
  } | null;
  readonly answerCounts: Readonly<Record<PartyRole, number>>;
}

/** One instance's rows, minus every opinion — the opinions are read separately, blind. */
export async function readInstanceBundle(
  instanceRecordId: string,
): Promise<InstanceBundle | undefined> {
  const [instance] = await query(
    `SELECT to_jsonb(r) AS record,
            COALESCE((SELECT json_agg(to_jsonb(i) ORDER BY i.position) FROM item i WHERE i.record_id = r.id), '[]'::json) AS items,
            COALESCE((SELECT json_agg(to_jsonb(o) ORDER BY o.position) FROM response_option o WHERE o.record_id = r.id), '[]'::json) AS options
       FROM record r
       JOIN assessment_instance ai ON ai.record_id = r.id
      WHERE r.id = $1 AND r.record_type = 'assessment'`,
    [instanceRecordId],
  );
  if (instance === undefined) return undefined;

  const parties = await query<PartyRow>(
    "SELECT instance_record_id, role, name FROM party WHERE instance_record_id = $1 ORDER BY role",
    [instanceRecordId],
  );
  const [invite] = await query<{
    email: string;
    counterparty_name: string;
    claimed_at: Date | null;
  }>(
    `SELECT email, counterparty_name, claimed_at FROM instance_invite WHERE instance_record_id = $1`,
    [instanceRecordId],
  );
  const counts = await query<{ role: PartyRole; answered: number }>(
    `SELECT p.role, (SELECT count(*) FROM opinion o
                      WHERE o.instance_record_id = p.instance_record_id AND o.role = p.role)::int AS answered
       FROM party p
      WHERE p.instance_record_id = $1`,
    [instanceRecordId],
  );

  const answered = (role: PartyRole) => counts.find((row) => row.role === role)?.answered ?? 0;
  const row = instance as unknown as {
    record: RecordRow;
    items: ItemRow[];
    options: OptionRow[];
  };

  return {
    record: row.record,
    items: row.items,
    options: row.options,
    instance: {
      record_id: instanceRecordId,
      template_record_id: await templateIdOf(instanceRecordId),
    },
    parties,
    invite:
      invite === undefined
        ? null
        : {
            email: invite.email,
            counterpartyName: invite.counterparty_name,
            claimed: invite.claimed_at !== null,
          },
    answerCounts: { initiator: answered("initiator"), counterparty: answered("counterparty") },
  };
}

async function templateIdOf(instanceRecordId: string): Promise<string> {
  const [row] = await query<{ template_record_id: string }>(
    "SELECT template_record_id FROM assessment_instance WHERE record_id = $1",
    [instanceRecordId],
  );
  return row?.template_record_id ?? "";
}

/** A template's rows, parsed through `zAssessment` — the words a report draws above the rows. */
export async function readTemplate(recordId: string): Promise<Assessment | undefined> {
  const [template] = await query<{
    record: RecordRow;
    items: ItemRow[];
    options: OptionRow[];
  }>(
    `SELECT to_jsonb(r) AS record,
            COALESCE((SELECT json_agg(to_jsonb(i) ORDER BY i.position) FROM item i WHERE i.record_id = r.id), '[]'::json) AS items,
            COALESCE((SELECT json_agg(to_jsonb(o) ORDER BY o.position) FROM response_option o WHERE o.record_id = r.id), '[]'::json) AS options
       FROM record r
      WHERE r.id = $1
        AND r.record_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM assessment_instance ai WHERE ai.record_id = r.id)`,
    [recordId],
  );
  if (template === undefined) return undefined;
  return assessmentTemplateFromRows(template);
}

export interface TemplateSummary {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly aspectCount: number;
}

/** The published templates a new instance can be copied from, in title order. */
export async function listPublishedTemplates(): Promise<TemplateSummary[]> {
  const rows = await query<{
    id: string;
    slug: string;
    title: string;
    summary: string;
    aspects: number;
  }>(
    `SELECT r.id, r.slug, r.title, r.summary,
            (SELECT count(*) FROM item i WHERE i.record_id = r.id)::int AS aspects
       FROM record r
      WHERE r.record_type = 'assessment'
        AND r.status = 'published'
        AND NOT EXISTS (SELECT 1 FROM assessment_instance ai WHERE ai.record_id = r.id)
        AND EXISTS (SELECT 1 FROM item i WHERE i.record_id = r.id)
      ORDER BY r.title`,
    [],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    aspectCount: row.aspects,
  }));
}

/** The role a party token belongs to on one instance, or `undefined`. */
export async function roleForToken(
  instanceRecordId: string,
  token: string | undefined,
): Promise<PartyRole | undefined> {
  if (token === undefined || token === "") return undefined;
  const [row] = await query<{ role: PartyRole }>(
    "SELECT role FROM party WHERE instance_record_id = $1 AND access_token_hash = $2",
    [instanceRecordId, hashToken(token)],
  );
  return row?.role;
}

/**
 * The role a **signed-in account** is on one instance, or `undefined` (#183, part 2).
 *
 * The second way to be a party, beside the bearer token. `0005_demo_account.sql` gives a party
 * `user_id`, and the demo panel signs in as a person rather than handing out a link, so the
 * screen has to be able to answer "which party is this session" — otherwise a demo sign-in as
 * Counterparty would land on a 404 and prove nothing about the blind rule.
 *
 * The token is still asked first (`readFlowScreen` below): a browser that carries the cookie
 * keeps the identity the invitation gave it, and a session is the fallback, not an override.
 * Both resolve to a `PartyRole` from Postgres; neither reads a claim out of the request.
 */
export async function roleForUser(
  instanceRecordId: string,
  userId: string | null | undefined,
): Promise<PartyRole | undefined> {
  if (userId === null || userId === undefined || userId === "") return undefined;
  const [row] = await query<{ role: PartyRole }>(
    "SELECT role FROM party WHERE instance_record_id = $1 AND user_id = $2",
    [instanceRecordId, userId],
  );
  return row?.role;
}

/**
 * The screen for one viewer, or `undefined` when the browser is not a party to it.
 *
 * The opinions are read **after** the status is known, and only for the roles
 * `visibleRoles()` names. That ordering is the blind rule: there is no code path here that
 * loads the other party's scores into memory before deciding whether it may.
 */
export async function readFlowScreen(input: {
  instanceRecordId: string;
  token: string | undefined;
  /** The raw invitation token, held by the Initiator's own browser, if it still has it. */
  inviteToken?: string | null;
  /**
   * The signed-in account, when there is one (#183, part 2). Consulted only if the cookie
   * resolved nothing, so an invited party keeps the identity its link gave it.
   */
  viewerUserId?: string | null;
}): Promise<FlowScreen | undefined> {
  const viewerRole =
    (await roleForToken(input.instanceRecordId, input.token)) ??
    (await roleForUser(input.instanceRecordId, input.viewerUserId));
  if (viewerRole === undefined) return undefined;

  const bundle = await readInstanceBundle(input.instanceRecordId);
  if (bundle === undefined) return undefined;
  const template = await readTemplate(bundle.instance.template_record_id);
  if (template === undefined) return undefined;

  const status = instanceStatusOf({
    aspectCount: bundle.items.length,
    hasCounterparty: bundle.parties.some((party) => party.role === "counterparty"),
    initiatorAnswered: bundle.answerCounts.initiator,
    counterpartyAnswered: bundle.answerCounts.counterparty,
  });
  const roles = visibleRoles(viewerRole, status);
  const opinions = await query<OpinionRow>(
    `SELECT instance_record_id, role, item_id, feel, wish, think, guess
       FROM opinion
      WHERE instance_record_id = $1 AND role = ANY($2::text[])`,
    [input.instanceRecordId, roles],
  );

  const rows: FlowInstanceRows = {
    record: bundle.record,
    items: bundle.items,
    options: bundle.options,
    instance: bundle.instance,
    parties: bundle.parties,
    opinions,
    answerCounts: bundle.answerCounts,
  };

  return projectScreen({
    rows,
    template,
    viewerRole,
    invite:
      bundle.invite === null
        ? null
        : {
            email: bundle.invite.email,
            counterpartyName: bundle.invite.counterpartyName,
            claimed: bundle.invite.claimed,
            link:
              status === "awaiting_counterparty" &&
              !bundle.invite.claimed &&
              input.inviteToken !== null &&
              input.inviteToken !== undefined
                ? invitationLink(input.inviteToken)
                : null,
          },
  });
}

export type InviteState = "claimable" | "claimed" | "expired" | "unknown";

export interface InvitePreview {
  readonly state: InviteState;
  readonly initiatorName: string | null;
  readonly counterpartyName: string | null;
  readonly templateTitle: string | null;
}

/**
 * What the claim page may show, without claiming anything.
 *
 * A GET must not spend the token — a mail client's link preview would burn an invitation
 * the person has not opened yet. So the page asks this, and the button posts.
 */
export async function previewInvite(token: string, now = new Date()): Promise<InvitePreview> {
  if (!tokenIsWellFormed(token)) {
    return { state: "unknown", initiatorName: null, counterpartyName: null, templateTitle: null };
  }
  const [row] = await query<{
    instance_record_id: string;
    counterparty_name: string;
    claimed_at: Date | null;
    expires_at: Date;
    initiator_name: string | null;
    title: string;
  }>(
    `SELECT iv.instance_record_id, iv.counterparty_name, iv.claimed_at, iv.expires_at,
            (SELECT p.name FROM party p
              WHERE p.instance_record_id = iv.instance_record_id AND p.role = 'initiator') AS initiator_name,
            t.title
       FROM instance_invite iv
       JOIN assessment_instance ai ON ai.record_id = iv.instance_record_id
       JOIN record t ON t.id = ai.template_record_id
      WHERE iv.token_hash = $1`,
    [hashToken(token)],
  );
  if (row === undefined) {
    return { state: "unknown", initiatorName: null, counterpartyName: null, templateTitle: null };
  }
  const state: InviteState =
    row.claimed_at !== null
      ? "claimed"
      : row.expires_at.getTime() <= now.getTime()
        ? "expired"
        : "claimable";
  return {
    state,
    initiatorName: row.initiator_name,
    counterpartyName: row.counterparty_name,
    templateTitle: row.title,
  };
}

/* ------------------------------------------------------------------ *\
 * Plumbing
 * ------------------------------------------------------------------ */

async function query<T>(text: string, values: readonly unknown[]): Promise<T[]> {
  const result = await getPool().query(text, values as unknown[]);
  return result.rows as T[];
}
