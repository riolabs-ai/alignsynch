/**
 * The member's own alignment rows — both parties' answers, per Aspect, for the relationships this
 * account is a party to (#1129).
 *
 * **Why a second read beside `lib/db/gap-rows.ts`.** That one is the *population* read: every
 * complete instance on the platform, nameless, for `/admin/gaps`. A member's Start page and
 * My Relationships ask a narrower question — *mine* — and they need the Aspect's **prompt** as well
 * as its id, because the card prints "Next Step: talk about Parent Decisions". It is the same
 * completeness rule, the same columns and the same `WHERE … party.user_id = $1` the rest of the
 * member layer uses, so the two statements answer different questions over one definition rather
 * than one statement answering both badly.
 *
 * **No name leaves Postgres.** The statement selects no `party.name`, no `user_id` and no
 * invitation row: the parties are joined for their opinions only, exactly like the population read
 * this file's shape follows.
 *
 * **Nothing is computed here.** The rows are handed to `lib/member/alignment-summary.ts`, which
 * calls `content/gaps.ts`'s own `gapKindsOf`; this module must never grow an arithmetic step, or
 * the dashboard and the Align screen become two definitions of one subtraction.
 *
 * Reads through `queryRows` (`lib/db/client.ts`), so a dead socket raises the
 * `DatabaseUnavailableError` every console page already prints instead of Next's 500.
 */
import type { AlignmentSetting, Opinions } from "@/content/assessment";
import type { Score } from "@/content/record";
import { queryRows } from "@/lib/db/client";
import type { AspectAnswers } from "@/lib/member/alignment-summary";

/** One row: one Aspect of one of the viewer's relationships, both parties' answers. */
interface MemberAspectRow {
  readonly session_record_id: string;
  readonly alignment_setting: string;
  readonly item_id: string;
  readonly item_position: number;
  readonly item_prompt: string;
  readonly initiator_feel: number;
  readonly initiator_wish: number;
  readonly initiator_think: number | null;
  readonly initiator_guess: number | null;
  readonly counterparty_feel: number;
  readonly counterparty_wish: number;
  readonly counterparty_think: number | null;
  readonly counterparty_guess: number | null;
}

/** One relationship's alignment: its Setting and an entry per Aspect, in the authored order. */
export interface MemberAlignment {
  readonly sessionRecordId: string;
  readonly setting: AlignmentSetting;
  readonly answers: readonly AspectAnswers[];
}

/**
 * One statement, keyed on the session.
 *
 * Completeness is decided in SQL and it is `instanceStatusOf`'s rule (`lib/flow/state.ts`): a
 * Counterparty seat exists, the copy holds at least one Aspect, and both parties answered every
 * Aspect. The inner joins on the two `opinion` rows state that structurally — one row per Aspect
 * requires an answer on both sides — so a half-answered relationship contributes no rows at all
 * rather than a summary that would read as aligned.
 */
const MEMBER_ALIGNMENT_SQL = `
  WITH aspect_count AS (
    SELECT i.record_id, count(*)::int AS items FROM item i GROUP BY i.record_id
  ), answered AS (
    SELECT o.session_record_id, o.role, count(*)::int AS answered
    FROM opinion o GROUP BY o.session_record_id, o.role
  ), mine AS (
    SELECT ai.record_id, ai.alignment_setting
    FROM session ai
    JOIN party vp ON vp.session_record_id = ai.record_id AND vp.user_id = $1
    LEFT JOIN aspect_count ac ON ac.record_id = ai.record_id
    LEFT JOIN answered ia ON ia.session_record_id = ai.record_id AND ia.role = 'initiator'
    LEFT JOIN answered ca ON ca.session_record_id = ai.record_id AND ca.role = 'counterparty'
    WHERE ai.voided_at IS NULL
      AND EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = ai.record_id AND p.role = 'initiator')
      AND EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = ai.record_id AND p.role = 'counterparty')
      AND COALESCE(ac.items, 0) > 0
      AND COALESCE(ia.answered, 0) >= COALESCE(ac.items, 0)
      AND COALESCE(ca.answered, 0) >= COALESCE(ac.items, 0)
  )
  SELECT
    m.record_id        AS session_record_id,
    m.alignment_setting AS alignment_setting,
    i.item_id          AS item_id,
    i.position         AS item_position,
    i.prompt           AS item_prompt,
    io.feel            AS initiator_feel,
    io.wish            AS initiator_wish,
    io.think           AS initiator_think,
    io.guess           AS initiator_guess,
    co.feel            AS counterparty_feel,
    co.wish            AS counterparty_wish,
    co.think           AS counterparty_think,
    co.guess           AS counterparty_guess
  FROM mine m
  JOIN record r ON r.id = m.record_id
  JOIN item i ON i.record_id = m.record_id
  JOIN opinion io ON io.session_record_id = m.record_id
                 AND io.role = 'initiator' AND io.item_id = i.item_id
  JOIN opinion co ON co.session_record_id = m.record_id
                 AND co.role = 'counterparty' AND co.item_id = i.item_id
  ORDER BY r.date DESC, r.slug, i.position
`;

/** A score the schema allows (1..5); anything else is drift and is thrown, never rendered. */
function scoreOf(value: number, column: string, sessionRecordId: string): Score {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(
      `member alignments: ${column} = ${String(value)} on ${sessionRecordId} is not a score 1..5`,
    );
  }
  return value as Score;
}

/** The optional half of an Advanced instance: think and guess come together, or neither. */
function predictionOf(
  think: number | null,
  guess: number | null,
  sessionRecordId: string,
): { think?: Score; guess?: Score } {
  if (think === null && guess === null) return {};
  if (think === null || guess === null) {
    throw new Error(
      `member alignments: ${sessionRecordId} carries half a prediction (think/guess)`,
    );
  }
  return {
    think: scoreOf(think, "think", sessionRecordId),
    guess: scoreOf(guess, "guess", sessionRecordId),
  };
}

/** The Setting column: two values exist, and a third is a row the CHECK refused to write. */
function settingOf(value: string, sessionRecordId: string): AlignmentSetting {
  if (value === "soft" || value === "full") return value;
  throw new Error(
    `member alignments: ${sessionRecordId} carries setting "${value}" — the column's CHECK allows soft and full`,
  );
}

/**
 * Every relationship `userId` is a party to that has both answer sheets, newest first.
 *
 * `[]` is a member with nothing answered — the empty state, not an error.
 */
export async function readMemberAlignments(userId: string): Promise<MemberAlignment[]> {
  const rows = await queryRows<MemberAspectRow>(MEMBER_ALIGNMENT_SQL, [userId]);

  const bySession = new Map<string, { setting: AlignmentSetting; answers: AspectAnswers[] }>();
  for (const row of rows) {
    const existing = bySession.get(row.session_record_id);
    const bucket = existing ?? {
      setting: settingOf(row.alignment_setting, row.session_record_id),
      answers: [] as AspectAnswers[],
    };
    bucket.answers.push({
      itemId: row.item_id,
      position: row.item_position,
      prompt: row.item_prompt,
      initiator: {
        feel: scoreOf(row.initiator_feel, "initiator_feel", row.session_record_id),
        wish: scoreOf(row.initiator_wish, "initiator_wish", row.session_record_id),
        ...predictionOf(row.initiator_think, row.initiator_guess, row.session_record_id),
      } satisfies Opinions,
      counterparty: {
        feel: scoreOf(row.counterparty_feel, "counterparty_feel", row.session_record_id),
        wish: scoreOf(row.counterparty_wish, "counterparty_wish", row.session_record_id),
        ...predictionOf(row.counterparty_think, row.counterparty_guess, row.session_record_id),
      } satisfies Opinions,
    });
    bySession.set(row.session_record_id, bucket);
  }

  return [...bySession].map(([sessionRecordId, bucket]) => ({
    sessionRecordId,
    setting: bucket.setting,
    answers: [...bucket.answers].sort((left, right) => left.position - right.position),
  }));
}
