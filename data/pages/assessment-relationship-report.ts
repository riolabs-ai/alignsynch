/**
 * `/assessment/instances/[instanceId]/report` — the relationship report's words (#409).
 *
 * The route is the one read surface the app did not have: the v1 prototype printed the two
 * Opinions behind every Gap per Aspect, and the port keeps that promise with these words. The
 * fixture is the route's own and is deliberately self-contained — E23 resolves every
 * `sectionOf`/`itemLabel` id against **this** file for this route, so the report's bands cannot
 * borrow a sentence from `data/pages/assessment-report.ts` and leave a typo invisible.
 *
 * What is *not* here, on purpose: the eight Gap names (`GAP_KIND_LABELS`), the three group
 * headings (`GAP_GROUPS`), the four Opinion names and their definitions (`OPINION_LABELS`,
 * `OPINION_DEFINITIONS`), the Mode and Setting names (`MODE_LABELS`, `SETTING_LABELS`,
 * `SETTING_DEFINITIONS`) and the scale's ends. Those are the model's vocabulary, authored once
 * in `content/` — a second copy in a fixture is exactly the drift the schema comments warn
 * about.
 *
 * The placeholders `fillLabel()` fills: `{name}` (the party reading), `{setting}`,
 * `{limit}`, `{count}`, `{gap}`, `{prompt}`, `{min}`, `{max}`, `{answered}`, `{total}`.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const relationshipReportPageCopy: PageCopy = zPageCopy.parse({
  heading: "The report",
  sections: [
    {
      id: "back",
      items: [{ id: "all", label: "Back to the relationship" }],
    },
    {
      /**
       * What this page is and who is reading it. The blind rule is stated here as a promise the
       * page keeps rather than as a policy note: before both parties have submitted there is no
       * report on this route at all, and the `gate` section below is the page instead.
       */
      id: "header",
      items: [
        { id: "viewer", label: "You are reading as {name}" },
        { id: "coach", label: "a coach" },
        { id: "mode", label: "Mode" },
        { id: "setting", label: "Setting" },
        {
          id: "read-only",
          label:
            "Read-only. Every number below is computed from the two parties' stored Opinions when this page is read, and nothing on this page is stored, edited or sent.",
        },
      ],
    },
    {
      /**
       * #503 — an acceptance an operator recorded on a seat's behalf. The report is where an
       * acceptance becomes a fact about the relationship, so it is where the provenance belongs:
       * the answers are the party's own, the acceptance was taken for them. The *operator* is
       * never named here — that is the audit row's job (`/admin/audit`), and the party reading
       * this page has no business being handed an account id.
       */
      id: "provenance",
      heading: "An operator recorded an acceptance",
      items: [
        {
          id: "operator-recorded",
          label:
            "{name} did not accept this session themselves: an operator recorded the acceptance on their behalf, because the seat had answered every Aspect and the relationship was otherwise stuck. The answers on this page are the party's own — only the acceptance was taken for them, and the audit log holds who took it and why.",
        },
      ],
    },
    {
      /**
       * The state a viewer gets *instead of* a report (#409, the blind rule). The report does not
       * exist before both parties have submitted — this is not a redacted report, it is the
       * absence of one: no Aspect prompt, no score, no Gap, and no count of what the other party
       * has answered.
       */
      id: "gate",
      heading: "The report unlocks when both of you have submitted",
      body: "Neither party's answers are shown before that — not greyed out, not redacted: the report is not built. Submit your own Aspect answers and the report appears here as soon as the other party has submitted theirs.",
      items: [
        { id: "own-progress", label: "You have answered {answered} of {total} Aspects." },
        {
          id: "no-leak",
          label:
            "Nothing on this page says what the other party answered, or how far along they are.",
        },
        { id: "continue", label: "Answer your Aspects" },
      ],
    },
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
          id: "tolerance",
          label: "{setting} tolerates a Gap of {limit}; {count} Gap(s) exceed it.",
        },
      ],
    },
    {
      /**
       * One Aspect's card: the prompt, both named ends of the scale, and this Aspect's own
       * verdict — which Gaps on it exceed the Setting, named.
       */
      id: "aspect",
      items: [
        { id: "scale", label: "Scale {min}–{max}" },
        {
          id: "within",
          label: "Within the {setting} Setting — all {count} Gaps on this Aspect are tolerated.",
        },
        {
          id: "over-all",
          label: "All {count} Gaps on this Aspect exceed the {setting} Setting.",
        },
        {
          id: "over-some",
          label: "{count} of {measured} Gaps on this Aspect exceed the {setting} Setting.",
        },
      ],
    },
    {
      /**
       * Both parties' Opinions on one Aspect, as a matrix — the table the report lost (#398,
       * restored here per #409). A dash is a kind that party never answered: never a `0`.
       */
      id: "matrix",
      heading: "Both parties' opinions",
      items: [
        { id: "party", label: "Party" },
        { id: "unanswered", label: "—" },
      ],
    },
    {
      /**
       * The Gap rows: one per kind the Aspect actually has, each printing **the two Opinions it
       * subtracts** — named by party and by value — beside the resulting Gap. A row can never
       * label one pair and compute another: the pair comes from
       * `content/gaps.ts::GAP_KIND_SOURCES`, the same table `gapKindsOf()` reads its arithmetic
       * from.
       */
      id: "gaps",
      heading: "The Gap between the two",
      items: [
        { id: "gap", label: "Gap" },
        { id: "pair", label: "The two opinions it compares" },
        { id: "value", label: "Gap value (0–{max})" },
        { id: "versus", label: "vs" },
        { id: "in-synch", label: "In Synch" },
        { id: "unscored", label: "—" },
        {
          id: "unscored-aspect",
          label:
            "This Aspect is unscored, so it reports no Gap at all — a dash, never a zero: nobody measured it, and a zero would claim they agreed.",
        },
      ],
    },
  ],
});
