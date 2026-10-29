/**
 * mode-invariants — E27: a mode is a record, and the record is the one it renders.
 *
 * WU-10 turned `/battle`'s mode list and `/daily-challenge`'s badge set into fixtures
 * (`data/battle-modes.ts`, `data/daily-challenge.ts`). A fixture on its own proves
 * nothing: a mode whose `questionCount` is 7 (not one of the lengths its select offers)
 * renders a `<Select>` showing no selection, and a badge set nobody imports is a file
 * that drifts. Two rules, deliberately paired — the schema is E0's job, these are the
 * statements a single record cannot make:
 *
 *   * every mode id is unique and the pair the component branches on (`1v1`, `group`)
 *     exists — the positive control, so the check cannot pass on an empty fixture;
 *   * `playersMin <= playersMax`, and both round defaults are members of the option
 *     lists the selectors render — a default outside its list is a select that shows
 *     nothing, which is exactly what "changing questionCount changes the card" would
 *     otherwise mean in the other direction;
 *   * a description may carry `{players}` and nothing else — a second placeholder is
 *     text the view never fills and the page renders literally;
 *   * every badge id is unique, and the set is populated;
 *   * the surface actually imports the fixture. This is the "written and not wired"
 *     direction: `data/battle-modes.ts` can be perfect and the page can still be
 *     rendering stale literals if nothing references it.
 *
 * Pure (no `fs`) so the negative cases drive it with arrays and source strings, like
 * `copy-refs.ts` and `metric-invariants.ts`.
 */
import {
  BATTLE_DESCRIPTION_PLACEHOLDER,
  BATTLE_MODE_IDS,
  type BattleMode,
  type BattleRoundOptions,
} from "../content/battle";
import type { DailyChallengeReward } from "../content/daily-challenge";
import type { SourceFile } from "./ui-refs";

export const MODE_RULE = "E27";

/** Every `{placeholder}` a string carries, in order of appearance. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? "");
}

/**
 * The mode fixture's invariants. `label` names the fixture in the diagnostic, so the
 * same function can be pointed at a generated set later without rewriting the messages.
 */
export function battleModeProblems(
  modes: readonly BattleMode[],
  options: BattleRoundOptions,
  label = "data/battle-modes.ts",
): string[] {
  const problems: string[] = [];

  // Positive control: an empty fixture would pass every loop below.
  if (modes.length === 0) {
    problems.push(`${label}: no battle modes — the cards have nothing to render`);
    return problems;
  }

  const seen = new Set<string>();
  for (const mode of modes) {
    if (seen.has(mode.id)) {
      problems.push(`${label}: mode id "${mode.id}" is declared twice — the card joins on it`);
    }
    seen.add(mode.id);
  }

  for (const id of BATTLE_MODE_IDS) {
    if (!seen.has(id)) {
      problems.push(
        `${label}: no "${id}" mode — the battle page branches on it, so that tab renders nothing`,
      );
    }
  }

  for (const mode of modes) {
    if (mode.playersMin > mode.playersMax) {
      problems.push(
        `${label}: mode "${mode.id}" has playersMin ${mode.playersMin} > playersMax ${mode.playersMax} — the roster range would render backwards`,
      );
    }
    if (!options.questionCounts.includes(mode.questionCount)) {
      problems.push(
        `${label}: mode "${mode.id}" defaults to ${mode.questionCount} questions, which is not one of [${options.questionCounts.join(", ")}] — the selector would render no selection`,
      );
    }
    if (!options.timeLimitsSeconds.includes(mode.timeLimitSeconds)) {
      problems.push(
        `${label}: mode "${mode.id}" defaults to ${mode.timeLimitSeconds}s per question, which is not one of [${options.timeLimitsSeconds.join(", ")}] — the selector would render no selection`,
      );
    }
    for (const placeholder of placeholdersIn(mode.description)) {
      if (placeholder !== BATTLE_DESCRIPTION_PLACEHOLDER) {
        problems.push(
          `${label}: mode "${mode.id}" description carries {${placeholder}}; the view fills only {${BATTLE_DESCRIPTION_PLACEHOLDER}}, so this renders literally`,
        );
      }
    }
  }

  return problems;
}

/** The daily-challenge badge set: unique ids, and a set that is not empty. */
export function dailyChallengeRewardProblems(
  badges: readonly DailyChallengeReward[],
  label = "data/daily-challenge.ts",
): string[] {
  const problems: string[] = [];
  if (badges.length === 0) {
    problems.push(`${label}: no badges — the daily-challenge reward card renders an empty grid`);
    return problems;
  }
  const seen = new Set<string>();
  for (const badge of badges) {
    if (seen.has(badge.id)) {
      problems.push(`${label}: badge id "${badge.id}" is declared twice — the view joins on it`);
    }
    seen.add(badge.id);
  }
  return problems;
}

/**
 * The "written and not wired" direction: the surface must import the fixture, or the
 * page is still rendering the literals the fixture replaced and both files are green.
 *
 * `identifier` is matched as a whole word, so `battleModes` does not satisfy a check for
 * `battleMode` and a comment that mentions the name does not count as a use: the pattern
 * requires the identifier in an `import` statement.
 */
export function modeWiringProblems(
  sources: readonly SourceFile[],
  surface: string,
  identifier: string,
  fixture: string,
): string[] {
  const files = sources.filter((file) => file.path.startsWith(`${surface}/`));
  if (files.length === 0) {
    return [
      `${fixture}: "${surface}/" holds no source files — the wiring check is looking at a renamed or deleted surface`,
    ];
  }
  const imported = files.some((file) =>
    new RegExp(
      `import[^;]*\\b${identifier}\\b[^;]*from\\s*["'][^"']*${fixture.split("/").pop()}["']`,
    ).test(file.source),
  );
  if (imported) return [];
  return [
    `${fixture}: nothing in ${surface}/ imports \`${identifier}\` from ${fixture} — the fixture was written and never wired, so the page still renders its literals`,
  ];
}
