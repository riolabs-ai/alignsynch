/**
 * `/admin/gaps` — the Gap across completed relationships (#289 follow-up).
 *
 * The words of a population view, and the three sentences that keep it honest:
 *
 *   population   what is counted, and what was left out. "a partial relationship has no Gap" is
 *                not a footnote — the count of excluded rows is on the screen so a reader can
 *                see the population was narrowed on purpose.
 *   statistic    why a median and a range, and why not a mean. The Gap is ordinal, so the centre
 *                is the first value at which half the Gaps are at or below it, and the spread is
 *                the smallest and widest Gap. An `average` would be arithmetic on named steps and
 *                would print values the model does not contain.
 *   absence      a kind with no reading is a row carrying its reason. Withholding is stated with
 *                the count and the floor, so "fewer than three" is visible rather than silent.
 *
 * `soft` and `full` are separate sections on purpose: Soft tolerates a Gap of 1 and Full does not,
 * so the same eight numbers answer differently under the two lenses and this fixture never
 * supplies a sentence that mixes them. `{placeholders}` are filled by the view with numbers the
 * aggregate computed (`lib/page-copy.ts::fillLabel`).
 *
 * Nothing here names a party, and nothing here ranks: no score, no health, no total. The kind
 * labels are the glossary's and live in `content/gaps.ts`, not here, so a rename cannot drift.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminGapsPageCopy: PageCopy = zPageCopy.parse({
  heading: "The Gap across completed relationships",
  subtitle:
    "The eight Gaps the model defines, counted over the relationships both parties have finished. No name, no score and no ranking: there are eight kinds, so this screen shows eight.",
  sections: [
    {
      id: "population",
      heading: "What is counted",
      body: "A Gap is the difference between two answers, so it takes two answers to exist. Only a relationship where both parties answered every Aspect contributes to the numbers below; the ones left out are counted here, not quietly dropped.",
      items: [
        { id: "complete", label: "Complete relationships" },
        { id: "excluded", label: "Left out — not finished by both parties" },
        { id: "soft", label: "Finished under Soft" },
        { id: "full", label: "Finished under Full" },
      ],
    },
    {
      id: "statistic",
      heading: "How these numbers are read",
      body: "Each kind is summarised by its median and its range, never by an average. A Gap is an ordinal value from 0 to 4 — In Synch, then the glossary's small and big Gaps — and the steps are named categories, not a distance, so adding them up would be arithmetic on labels. The median is the first size at which half the Gaps are at or below it, which is always one of the five sizes the model has; the arithmetic middle of two rows can land on 1.5, a Gap that does not exist. The range is the smallest and widest Gap actually measured, in the model's own units. Averaging per-relationship figures first would also give a relationship with fewer Aspects the same weight as one with more, which is the average of averages this screen refuses.",
    },
    {
      id: "soft",
      heading: "Under Soft",
      body: "Soft is the tolerant lens: a Gap of 1 is still in range, so a relationship is aligned unless one of its Gaps is 2 or wider. Only relationships finished under Soft are counted in this section — a Soft figure never borrows a Full relationship, and the two are never added together.",
      items: [
        {
          id: "outcome",
          label:
            "{aligned} of {instances} aligned under Soft; {unmet} carry at least one Gap wider than {limit}.",
        },
        {
          id: "withheld",
          label:
            "Not charted: {count} finished under Soft, and a distribution is read from {floor}.",
        },
        { id: "none", label: "No relationship has been finished under Soft yet." },
        { id: "chart", label: "Gaps of each kind, by size" },
      ],
    },
    {
      id: "full",
      heading: "Under Full",
      body: "Full tolerates nothing: every one of a relationship's Gaps has to be 0 for it to be aligned. Only relationships finished under Full are counted here. A Full figure on a small population is a fact about a handful of relationships, so it is withheld below the floor rather than drawn.",
      items: [
        {
          id: "outcome",
          label:
            "{aligned} of {instances} aligned under Full; {unmet} carry at least one Gap wider than {limit}.",
        },
        {
          id: "withheld",
          label:
            "Not charted: {count} finished under Full, and a distribution is read from {floor}.",
        },
        { id: "none", label: "No relationship has been finished under Full yet." },
        { id: "chart", label: "Gaps of each kind, by size" },
      ],
    },
    {
      id: "kinds",
      heading: "Each of the eight kinds",
      body: "The four Basic kinds compare two answers of the same sort — the parties' Feel, their Wish, and each party's own Feel against their own Wish. The four prediction kinds compare what one party thought or guessed about the other with what the other actually answered, so they exist only where an Advanced relationship asked them. The last column counts how many Gaps of that kind are 0, 1, 2, 3 and 4, in that order.",
      items: [
        { id: "column-kind", label: "Kind" },
        { id: "column-gaps", label: "Gaps" },
        { id: "column-median", label: "Median" },
        { id: "column-range", label: "Range" },
        { id: "column-spread", label: "At size 0 / 1 / 2 / 3 / 4" },
        { id: "count", label: "{count} Gaps measured across {instances} relationships" },
        { id: "count-one", label: "{count} Gaps measured in this one relationship" },
      ],
    },
    {
      id: "absence",
      heading: "Absent, and why",
      items: [
        {
          id: "withheld",
          label:
            "Withheld — {count} finished under this setting, and a distribution is read from {floor}.",
        },
        {
          id: "no-advanced",
          label: "Absent — no Advanced relationship here, so nobody was asked to predict.",
        },
        { id: "no-answer", label: "Absent — the pair was asked and both answers are not here." },
      ],
    },
    {
      id: "unreadable",
      heading: "The Gap could not be read",
      body: "This screen asks the database for the completed relationships on every visit, and this visit did not get an answer. Nothing here came from a cache, no partial relationship was counted and no number was guessed. Reading the page again is the only way back.",
    },
  ],
});
