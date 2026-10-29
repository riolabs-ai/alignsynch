/**
 * `BattleMode` — the battle surface's mode data, and why it is not page copy.
 *
 * `/battle` used to spell its two modes into the component: the tab labels, the card
 * titles, four player counts, two question-count lists and two time-limit lists, each
 * one typed twice because the two tabs were two copies of the same form
 * (WU-10, issue #57). A mode is a *record*: it has an identity, a roster size, a round
 * length and a default round — four facts a copy string cannot hold, and the page had
 * no way to answer "what does a group battle actually cost to play".
 *
 * The split this module encodes, and the reason it is not a `PageCopy` item:
 *
 *   copy      the words around a control — "Battle Type", "Select time", the "Lobby"
 *             suffix. `data/pages/battle.ts` owns those (E23).
 *   mode data the numbers a control is *for* — `playersMin/Max`, `questionCount`,
 *             `timeLimitSeconds` — plus the two names and the one description that
 *             travel with them. This module owns those, and the card renders the
 *             record (`mode.name`, `mode.questionCount`), so editing
 *             `data/battle-modes.ts` changes the page with no `.tsx` edit.
 *
 * Three conventions worth knowing before editing:
 *
 *  - `id` is one of `BATTLE_MODE_IDS` (`1v1`, `group`), not free text: the tab value,
 *    the `BattleState.mode` field and the `Tabs` `value` are the same string, so a
 *    third mode is a schema change and a component deliberately has to say where it
 *    renders — not a fixture row that silently never appears.
 *  - `description` is authored per mode and may carry a `{players}` placeholder, which
 *    the view fills from `playersMin`/`playersMax` (`formatCountRange`). A second
 *    number in the sentence would be a copy of the range that no check can compare
 *    against the record; E26 fails a description carrying any *other* placeholder.
 *  - `questionCount`/`timeLimitSeconds` are the mode's *defaults* and must be members
 *    of `BattleRoundOptions`, the two lists the selectors offer. A default outside the
 *    list renders a select whose value matches no option (E26).
 *
 * No React, no `next`: `data:check` compiles this module with
 * `tsconfig.datacheck.json` and validates the fixture under plain node.
 */
import { z } from "zod";

/**
 * The modes `/battle` knows how to render. Closed on purpose: each id is a branch the
 * component already has (a tab value, a `BattleState.mode`, a lobby heading), so a new
 * mode is a component change even when the fixture row would parse.
 */
export const zBattleModeId = z.enum(["1v1", "group"]);

export type BattleModeId = z.infer<typeof zBattleModeId>;

export const BATTLE_MODE_IDS = zBattleModeId.options;

/** One mode, as the card renders it. `strict()`: an unknown key is a fixture drift. */
export const zBattleMode = z
  .object({
    id: zBattleModeId,
    /** The tab label and the card title (`1v1 Battle`, `Group Battle`). */
    name: z.string().min(1),
    /** The card's description; `{players}` is the only placeholder the view fills. */
    description: z.string().min(1),
    /** Roster floor. `1v1` is 2-2: a single-player mode is not a battle. */
    playersMin: z.number().int().min(1),
    playersMax: z.number().int().min(1),
    /** The round length the select starts on. Must be one of `questionCounts`. */
    questionCount: z.number().int().min(1),
    /** Seconds per question the select starts on. Must be one of `timeLimitsSeconds`. */
    timeLimitSeconds: z.number().int().min(1),
  })
  .strict();

export type BattleMode = z.infer<typeof zBattleMode>;

export const zBattleModes = z.array(zBattleMode).min(1);

export type BattleModes = z.infer<typeof zBattleModes>;

/**
 * The round lengths a battle offers, as one record: both modes render the same two
 * selectors, and a second list per mode would be the same numbers typed twice.
 */
export const zBattleRoundOptions = z
  .object({
    questionCounts: z.array(z.number().int().min(1)).min(1),
    timeLimitsSeconds: z.array(z.number().int().min(1)).min(1),
  })
  .strict();

export type BattleRoundOptions = z.infer<typeof zBattleRoundOptions>;

/**
 * The only placeholder a mode description may carry. The view fills it with the
 * roster range; anything else would render literally, so E26 rejects it.
 */
export const BATTLE_DESCRIPTION_PLACEHOLDER = "players";

/** Does this mode's roster read as a range (`3-10`) rather than a fixed pair (`2`)? */
export function isRosterRange(mode: BattleMode): boolean {
  return mode.playersMin !== mode.playersMax;
}
