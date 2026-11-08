/**
 * template-ancestor: components/assessment-flow/wizard-steps.tsx   (variation: the rail's sibling — the column the stage renders inside, a fixed left edge at one max width, so no screen centres itself)
 *
 * The onboarding flow's column (#687) — the one container every stage renders inside.
 *
 * **Left-justified on purpose.** The approved layout
 * (`docs/review/artifacts/prototype-relationship-lifecycle-v5.html`) measures its content at
 * 1126px against a fixed left edge: `main` pads the side, `.column` takes `width: 100%` up to
 * `--stage-max`. A centred column (`mx-auto max-w-*`) moves as the viewport changes, so every
 * screen's text starts somewhere different — which is what the three flow screens shipped before
 * this card (`accept-session.tsx:151`, `create-relationship.tsx:146`,
 * `counterparty-wizard.tsx:79`). The width therefore lives here and nowhere else: a stage that
 * spells `max-w-*` again is the regression this file exists to prevent.
 *
 * **Spacing stays the screen's own.** The bands are not all the same height, and a container
 * cannot know their rhythm, so `space-y-6` (where a screen wants it) sits inside the column, not
 * in it. What this file owns is the geometry the whole flow shares: full width up to 1126px, and
 * padding on every side.
 *
 * **A separate module from the rail, deliberately.** `stage-rail.tsx` reads the `stages` copy
 * section, and E23 resolves every id a reachable file asks for against *that surface's* fixture.
 * A screen that wants the column but is not one of the six stages (the Counterparty's onboarding,
 * the acceptance screen) must not inherit that dependency and be forced to declare six stage
 * names it never prints.
 *
 * A server component: a `div` is a `div`, and the shell ships no JavaScript of its own.
 */
import type { ReactNode } from "react";

export function StageColumn({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[1126px] p-4 sm:p-8">{children}</div>;
}
