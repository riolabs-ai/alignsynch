/**
 * The prototype band — the one sentence every prototype screen carries (#console cohort 1).
 *
 * It is `<Alert>` with the fixture's words, and it is a component for two reasons: the sentence must
 * be identical on every prototype screen, and it must be impossible for a later cohort to add a
 * screen without it. The mount is the layout (`app/(mainlayout)/prototype/layout.tsx`), not the page,
 * so the band arrives with the gate rather than being remembered per route.
 *
 * The amber is the console's existing "this is not what it looks like" colour — the same three
 * classes `components/console/overview.tsx` and `components/assessment-flow/template-library.tsx`
 * use for a failure panel. Status hues are outside the brand-class rule on purpose (AGENTS.md), and
 * a prototype marker in the brand's own action colour would read as a product surface.
 *
 * No `"use client"`: markup over a prop, so a server page renders it without a hydration payload.
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { PageCopy } from "@/content/pages";

export function PrototypeBand({ copy }: { copy: PageCopy }) {
  return (
    <Alert
      data-prototype-band="true"
      className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
    >
      <AlertTitle>{copy.heading}</AlertTitle>
      {copy.subtitle === undefined ? null : <AlertDescription>{copy.subtitle}</AlertDescription>}
    </Alert>
  );
}
