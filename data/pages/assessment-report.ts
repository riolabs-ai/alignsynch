/**
 * `/assessment/[slug]` — the report's words, and the ones the instance screen borrows when
 * it draws the same report below its "You have both answered" band (#274).
 *
 * Three sections, and each one exists because the alternative was a literal in a component:
 *
 *   `verdict`  the band above the cards. Two sentences, not one: "Aligned under Soft" is the
 *              answer, and "{n} Gaps exceed Soft — the widest is a Gap of 4 on {prompt}" is
 *              what a reader does with a report that is not aligned. The Setting's own
 *              definition (`SETTING_DEFINITIONS`) and the bar's tick legend sit beside them,
 *              because "Aligned" without naming the Setting is ambiguous — the same numbers
 *              are aligned under Full and not under Soft only if the numbers are 0 vs 1.
 *   `table`    the three column headings each group's table carries, plus the word a Gap of
 *              0 prints in place of a number. `In Synch` is the glossary's own word, and it
 *              is capitalised the way the source capitalises it (SPEC-DRIFT quick win #4).
 *   `groups`   deliberately absent: the three group headings are the specification's
 *              vocabulary and live in `content/gaps.ts` as `GAP_GROUPS`, so a kind cannot
 *              be added to the model without the report deciding which heading it sits under.
 *
 * The placeholders are filled by `fillLabel()`: `{setting}` is the glossary's "Soft"/"Full"
 * (`SETTING_LABELS`), `{count}`, `{gap}`, `{limit}` and `{prompt}` come from the projection.
 * Two `unmet` sentences rather than one, because "1 Gap exceeds" and "3 Gaps exceed" are not
 * the same sentence with a number swapped — no placeholder can pluralise an English noun.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentReportPageCopy: PageCopy = zPageCopy.parse({
  heading: "The Gap Report",
  sections: [
    {
      id: "verdict",
      heading: "Where you stand",
      items: [
        { id: "aligned", label: "Aligned under {setting} — every Gap on this report meets it." },
        {
          id: "unmet-one",
          label: "1 Gap exceeds {setting}. The widest is a Gap of {gap} on {prompt}",
        },
        {
          id: "unmet-many",
          label: "{count} Gaps exceed {setting}. The widest is a Gap of {gap} on {prompt}",
        },
        { id: "setting", label: "{setting} Setting: {definition}" },
        {
          id: "tick-legend",
          label:
            "Each Gap's bar has a tick at {limit} of 4: the widest Gap your {setting} Setting tolerates.",
        },
      ],
    },
    {
      id: "table",
      items: [
        { id: "gap", label: "Gap" },
        { id: "pair", label: "The two Opinions it compares" },
        { id: "value", label: "Gap value" },
        { id: "in-synch", label: "In Synch" },
      ],
    },
  ],
});
