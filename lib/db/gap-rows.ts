/**
 * The Gap population read — every **complete** session, nameless (#289 follow-up).
 *
 * This is the one statement `/admin/gaps` needs: for each completed relationship, both parties'
 * four answers on every Aspect of the session's own copy. `gapOf` is applied to those answers
 * in `lib/admin/gap-aggregates.ts`, so nothing here computes or stores a Gap: the read is the
 * rows, the aggregate is the function, and the screen is a projection of the two.
 *
 * **Complete is decided in SQL, and it is the same rule the flow uses.** Completeness is
 * `sessionStatusOf`'s derivation (`lib/flow/state.ts`): a counterparty exists, the copy holds
 * at least one Aspect, and both parties have answered at least every Aspect. The inner joins
 * below repeat that statement structurally — one row per Aspect requires an `opinion` on both
 * sides — and the `complete` CTE states it in words so a reader can check the intent instead of
 * inferring it from a join. An incomplete session contributes no row, so it cannot contribute
 * a number: a partial relationship has no Gap.
 *
 * **Names never leave Postgres.** The statement selects no `party.name`, no `session_invite`
 * and no `user_id`, so the screen cannot print a party even by accident. The party rows are
 * joined only for their Opinions. That is the population rule held structurally rather than by
 * a promise: the aggregate's input type has no field a name could travel in.
 *
 * **The Setting is carried, not applied.** `alignment_setting` travels with each session so the
 * screen can judge each one under the lens its parties chose; this module never collapses Soft
 * and Full. The verdict (`sessionAlignment`) is derived per session in the aggregate.
 *
 * Reads through `queryRows` (`lib/db/client.ts`), so this route gets the same dead-socket retry
 * and the same `DatabaseUnavailableError` the assessment screen has, and the page prints that
 * error's own sentence instead of Next's 500.
 */
import type { AlignmentSetting } from "@/content/assessment";
import type { Score } from "@/content/record";
import type { GapAspect, GapSession, GapOpinions, GapPopulation } from "@/lib/admin/gap-aggregates";
import { queryRows } from "@/lib/db/client";

/** How many rows exist at all, and how many are complete — the screen states both. */
interface PopulationCountRow {
  readonly total: number;
  readonly complete: number;
}

/** One answered Aspect of one complete session: both parties' four scores. */
interface GapAspectRow {
  readonly session_record_id: string;
  readonly alignment_setting: string;
  readonly item_id: string;
  readonly item_position: number;
  readonly initiator_feel: number;
  readonly initiator_wish: number;
  readonly initiator_think: number | null;
  readonly initiator_guess: number | null;
  readonly counterparty_feel: number;
  readonly counterparty_wish: number;
  readonly counterparty_think: number | null;
  readonly counterparty_guess: number | null;
}

/**
 * The population counters: every `session` on an assessment record, and how many of
 * those are complete. One statement, so the two numbers cannot be read a minute apart and
 * disagree with the rows below them.
 */
const POPULATION_SQL = `
  WITH aspect_count AS (
    SELECT i.record_id, count(*)::int AS items FROM item i GROUP BY i.record_id
  ), answered AS (
    SELECT o.session_record_id, o.role, count(*)::int AS answered
    FROM opinion o GROUP BY o.session_record_id, o.role
  )
  SELECT
    count(*)::int AS total,
    count(*) FILTER (
      WHERE EXISTS (SELECT 1 FROM party p
                     WHERE p.session_record_id = ai.record_id AND p.role = 'initiator')
        AND EXISTS (SELECT 1 FROM party p
                     WHERE p.session_record_id = ai.record_id AND p.role = 'counterparty')
        AND COALESCE(ac.items, 0) > 0
        AND COALESCE(ia.answered, 0) >= COALESCE(ac.items, 0)
        AND COALESCE(ca.answered, 0) >= COALESCE(ac.items, 0)
    )::int AS complete
  FROM session ai
  JOIN record r ON r.id = ai.record_id AND r.record_type = 'assessment'
  LEFT JOIN aspect_count ac ON ac.record_id = ai.record_id
  LEFT JOIN answered ia ON ia.session_record_id = ai.record_id AND ia.role = 'initiator'
  LEFT JOIN answered ca ON ca.session_record_id = ai.record_id AND ca.role = 'counterparty'
  -- #1100b — **a draft session is not in the population.** The two numbers this statement feeds
  -- are "how many sessions exist" and "how many are complete", and a create nobody accepted is
  -- neither: it has no Counterparty seat and no answers, so counting it only widens a denominator
  -- on the one screen whose whole value is that its two numbers agree with its rows. The
  -- completeness half was already unaffected (it requires both seats and every Aspect answered);
  -- this is the total catching up.
  WHERE ai.state = 'active'
`;

/**
 * The rows: one per (complete session × Aspect), with both parties' answers side by side.
 *
 * `ORDER BY r.date DESC, r.slug, i.position` is a stable order and nothing else — the aggregate
 * is order-independent, but a read that returns the same rows in the same order makes a
 * hand-count reproducible.
 */
const GAP_ROWS_SQL = `
  WITH aspect_count AS (
    SELECT i.record_id, count(*)::int AS items FROM item i GROUP BY i.record_id
  ), answered AS (
    SELECT o.session_record_id, o.role, count(*)::int AS answered
    FROM opinion o GROUP BY o.session_record_id, o.role
  ), complete AS (
    SELECT ai.record_id, ai.alignment_setting
    FROM session ai
    JOIN record r ON r.id = ai.record_id AND r.record_type = 'assessment'
    LEFT JOIN aspect_count ac ON ac.record_id = ai.record_id
    LEFT JOIN answered ia ON ia.session_record_id = ai.record_id AND ia.role = 'initiator'
    LEFT JOIN answered ca ON ca.session_record_id = ai.record_id AND ca.role = 'counterparty'
    WHERE EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = ai.record_id AND p.role = 'initiator')
      AND EXISTS (SELECT 1 FROM party p
                   WHERE p.session_record_id = ai.record_id AND p.role = 'counterparty')
      AND COALESCE(ac.items, 0) > 0
      AND COALESCE(ia.answered, 0) >= COALESCE(ac.items, 0)
      AND COALESCE(ca.answered, 0) >= COALESCE(ac.items, 0)
  )
  SELECT
    c.record_id                        AS session_record_id,
    c.alignment_setting                AS alignment_setting,
    i.item_id                          AS item_id,
    i.position                         AS item_position,
    io.feel                            AS initiator_feel,
    io.wish                            AS initiator_wish,
    io.think                           AS initiator_think,
    io.guess                           AS initiator_guess,
    co.feel                            AS counterparty_feel,
    co.wish                            AS counterparty_wish,
    co.think                           AS counterparty_think,
    co.guess                           AS counterparty_guess
  FROM complete c
  JOIN record r ON r.id = c.record_id
  JOIN item i ON i.record_id = c.record_id
  JOIN opinion io ON io.session_record_id = c.record_id
                 AND io.role = 'initiator' AND io.item_id = i.item_id
  JOIN opinion co ON co.session_record_id = c.record_id
                 AND co.role = 'counterparty' AND co.item_id = i.item_id
  ORDER BY r.date DESC, r.slug, i.position
`;

/** A score the schema allows (1..5). Anything else is a row the CHECK constraints should have
 *  refused, so it is thrown rather than rendered — a Gap of a value nothing authored is a bug. */
function scoreOf(value: number, column: string, sessionId: string): Score {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error(
      `gap rows: ${column} = ${String(value)} on session ${sessionId} is not a score 1..5`,
    );
  }
  return value as Score;
}

/** The optional half of an Advanced session's answers: think and guess come together. */
function predictionOf(
  think: number | null,
  guess: number | null,
  sessionId: string,
): { think?: Score; guess?: Score } {
  if (think === null && guess === null) return {};
  if (think === null || guess === null) {
    throw new Error(`gap rows: session ${sessionId} carries half a prediction (think/guess)`);
  }
  return {
    think: scoreOf(think, "think", sessionId),
    guess: scoreOf(guess, "guess", sessionId),
  };
}

/** The Setting column: two values exist, and the screen has a section for each. */
function settingOf(value: string, sessionId: string): AlignmentSetting {
  if (value === "soft" || value === "full") return value;
  throw new Error(`gap rows: session ${sessionId} carries setting "${value}"`);
}

/**
 * Read the population and return it in the aggregate's shape.
 *
 * Two statements on one pooled socket (~2 RTT): the counters, then the rows. The rows are
 * grouped here rather than in SQL because the grouping is the aggregate's input contract —
 * session → Aspect → two parties' answers — and expressing it once means the pure module and
 * the screen never disagree about what one row is.
 */
export async function readGapPopulation(): Promise<GapPopulation> {
  const [counts, rows] = await Promise.all([
    queryRows<PopulationCountRow>(POPULATION_SQL, []),
    queryRows<GapAspectRow>(GAP_ROWS_SQL, []),
  ]);

  const counters = counts[0];
  const total = counters?.total ?? 0;

  const bySession = new Map<string, { setting: AlignmentSetting; aspects: GapAspect[] }>();
  const order: string[] = [];
  for (const row of rows) {
    const existing = bySession.get(row.session_record_id);
    const aspect = {
      itemId: row.item_id,
      initiator: {
        feel: scoreOf(row.initiator_feel, "initiator_feel", row.session_record_id),
        wish: scoreOf(row.initiator_wish, "initiator_wish", row.session_record_id),
        ...predictionOf(row.initiator_think, row.initiator_guess, row.session_record_id),
      } satisfies GapOpinions,
      counterparty: {
        feel: scoreOf(row.counterparty_feel, "counterparty_feel", row.session_record_id),
        wish: scoreOf(row.counterparty_wish, "counterparty_wish", row.session_record_id),
        ...predictionOf(row.counterparty_think, row.counterparty_guess, row.session_record_id),
      } satisfies GapOpinions,
    };
    if (existing === undefined) {
      bySession.set(row.session_record_id, {
        setting: settingOf(row.alignment_setting, row.session_record_id),
        aspects: [aspect],
      });
      order.push(row.session_record_id);
      continue;
    }
    existing.aspects.push(aspect);
  }

  const sessions: GapSession[] = order.map((sessionId) => {
    const entry = bySession.get(sessionId);
    if (entry === undefined) throw new Error(`gap rows: session ${sessionId} lost its aspects`);
    return { sessionId, setting: entry.setting, aspects: entry.aspects };
  });

  return {
    sessions,
    excluded: Math.max(total - (counters?.complete ?? sessions.length), 0),
    total,
  };
}
