import { BattlePage } from "@/components/battle/battle-page";
import { battlePageCopy } from "@/data/pages/battle";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quiz Battle",
  description: "Challenge friends or random players to real-time quiz battles",
};

/**
 * The battle route. The words come from `data/pages/battle.ts` and the modes from
 * `data/battle-modes.ts` — the page holds neither, so editing either fixture changes
 * `/battle` with no component edit (E23 measures the copy at 0 literals, E27 holds the
 * modes to the option lists their selects render).
 */
export default function Battle() {
  requireQuizProduct();
  return <BattlePage copy={battlePageCopy} />;
}
