/**
 * The daily challenge's mode data — the badge set, and why it is a record.
 *
 * `/daily-challenge` renders six achievement badges in `daily-rewards.tsx`. They were
 * six JSX blocks typed one by one: a label ("First Try"), an icon, a colour, and — for
 * the three not yet earned — an `opacity-50` class that said "locked" in CSS. Three
 * facts that belong to the badge were therefore spread across three layers, and "which
 * badges has this player earned" was answerable only by reading the component.
 *
 * `DailyChallengeReward` is not this: the coins and XP a day pays are metric snapshots
 * (`data/metrics.ts`, `daily.challenge.reward.*`) and the streak bands are
 * `streakRewards` there. A badge is an *achievement identity* — the label and whether
 * it is unlocked — so it lives here.
 *
 * What a badge deliberately does not carry: the icon and the colour. Those are
 * presentation and this module may not import React (it is compiled by `data:check`
 * and run under plain node), so the view maps `id` → icon. A badge whose id has no icon
 * still renders — `data:check` E26 proves the set is populated, not that the view has a
 * case for every new id.
 */
import { z } from "zod";

import { zId } from "./core";

/** One badge: a stable id, the words on it, and whether it is earned. */
export const zDailyChallengeReward = z
  .object({
    id: zId,
    label: z.string().min(1),
    /**
     * Earned or not. The view renders an unearned badge dimmed and an earned one in
     * colour; before this field the difference was a class on three of the six blocks.
     */
    unlocked: z.boolean(),
  })
  .strict();

export type DailyChallengeReward = z.infer<typeof zDailyChallengeReward>;

export const zDailyChallengeRewards = z.array(zDailyChallengeReward).min(1);

export type DailyChallengeRewards = z.infer<typeof zDailyChallengeRewards>;
