/**
 * `BattleMode` — the two modes `/battle` renders, as records instead of literals.
 *
 * Before this file the mode list lived in `components/battle/battle-mode-selection.tsx`
 * twice over: four player counts (3-10) came from `data/metrics.ts` but the two tab
 * labels, the two card titles, the two descriptions, the `10`-question default, the
 * `10`-second default and eleven `<SelectItem>` lengths were typed into JSX. The card
 * was therefore un-editable: changing a mode's question count to 15 meant editing a
 * component, and the number appeared twice (2 modes × 4 options).
 *
 * What lives here, and what does not:
 *
 *   here      id, name, description, the roster range, the two round defaults
 *   here      `battleRoundOptions` — the lengths the two selectors offer
 *   not here  any *word around* a control ("Select time", "Battle Type", "Lobby").
 *             That is page copy: `data/pages/battle.ts` (E23)
 *   not here  the player roster (`data/players.ts`, WU-1) or the questions the battle
 *             plays — this file owns how a mode is *configured*, not what is played
 *
 * `playersMin`/`playersMax` moved here from `data/metrics.ts`, where they had been
 * `battle.group.minPlayers`/`maxPlayers`: a metric snapshot is a rendered *quantity*,
 * and a roster bound is a domain fact the mode owns. `metricTable` no longer carries
 * them and E25's range check now reads the record (see `docs/P2-INVENTORY.md`, WU-10).
 */
import {
  zBattleModes,
  zBattleRoundOptions,
  type BattleMode,
  type BattleModeId,
  type BattleModes,
  type BattleRoundOptions,
} from "../content/battle";

/**
 * The modes, in render order — tab order is this array's order, so a fixture edit
 * reorders the tabs without touching the component.
 *
 * `1v1` is 2-2 (a pair, no range to show); `group` is 3-10, which is the number the
 * card's description renders through its `{players}` placeholder.
 */
export const battleModes: BattleModes = zBattleModes.parse([
  {
    id: "1v1",
    name: "1v1 Battle",
    description:
      "Challenge a friend or get matched with a random player for a head-to-head quiz battle.",
    playersMin: 2,
    playersMax: 2,
    questionCount: 10,
    timeLimitSeconds: 10,
  },
  {
    id: "group",
    name: "Group Battle",
    description: "Create or join a group battle with {players} players competing simultaneously.",
    playersMin: 3,
    playersMax: 10,
    questionCount: 10,
    timeLimitSeconds: 10,
  },
]);

/** The lengths both selectors offer, in render order. */
export const battleRoundOptions: BattleRoundOptions = zBattleRoundOptions.parse({
  questionCounts: [5, 10, 15, 20],
  timeLimitsSeconds: [5, 10, 15],
});

/** One mode by id. Throws with the ids that exist — a missing mode is fixture drift. */
export function battleMode(id: BattleModeId): BattleMode {
  const mode = battleModes.find((candidate) => candidate.id === id);
  if (!mode) {
    throw new Error(
      `BattleMode: no mode "${id}" in data/battle-modes.ts (have: ${battleModes.map((m) => m.id).join(", ")})`,
    );
  }
  return mode;
}
