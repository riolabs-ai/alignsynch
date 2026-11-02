/**
 * `/assessment/instances/[instanceId]/answer` — the answer sheet, shipped as **in-progress UI**
 * (#409, R1-E).
 *
 * The screen is real; the write is not. Every word here describes the sheet the app will ask,
 * and one of them says plainly that nothing on it is saved yet — the honest-action rule this
 * card is built on: a control that cannot work says so at the point of action, and no screen
 * ever reports a submission that did not happen.
 *
 * `sheet` owns the band the component renders: the heading, the Mode-independent body, the
 * blind-rule sentence (the one rule this product never relaxes), the not-wired notice, the
 * two seat names, and the submit's own note. `rules` owns the two facts a reader needs about
 * what the sheet keeps — the Mode is fixed at creation, and the Setting is the bar the report
 * is judged against later.
 *
 * `{left}`/`{right}` are the Aspect's two Values, `{name}` a party's own name and `{seat}` its
 * role, filled by `fillLabel()` from the rows the page read — the fixture authors no person.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentAnswerPageCopy: PageCopy = zPageCopy.parse({
  heading: "Answer your side",
  subtitle:
    "Every Aspect of this relationship, asked in the shape its Mode defines. Your answers stay sealed until both parties accept.",
  sections: [
    {
      id: "sheet",
      heading: "The Aspect sheet",
      body: "Each Aspect is one line of the relationship. You score it from the left Value to the right Value, once for every Opinion kind your Mode asks.",
      items: [
        {
          id: "blind-rule",
          label:
            "Until both parties accept, neither of you sees the other's answers — not filtered, absent.",
        },
        {
          id: "not-wired",
          label:
            "Not wired yet — this sheet does not save. Anything you mark here is not recorded, and the submit button stays disabled until the write path ships.",
        },
        { id: "scale", label: "{left} — {right}" },
        { id: "seat-row", label: "{name} · {seat}" },
        { id: "seat-initiator", label: "Initiator" },
        { id: "seat-counterparty", label: "Counterparty" },
        {
          id: "row-help",
          label:
            "Both seats are drawn so the sheet's full shape is on screen. A party answers only their own row.",
        },
        { id: "submit", label: "Submit answers" },
        {
          id: "submit-note",
          label:
            "Not wired yet — the answer write path is not connected, so this button records nothing.",
        },
        { id: "back", label: "Back to the relationship" },
      ],
    },
    {
      id: "rules",
      heading: "What this sheet keeps",
      items: [
        {
          id: "mode-fixed",
          label:
            "The Mode is fixed at creation. Basic asks Feel and Wish on every Aspect; Advanced adds Think and Guess.",
        },
        {
          id: "setting",
          label:
            "The Setting ({setting}) is the bar these answers are judged against later. It changes the verdict, never a question.",
        },
      ],
    },
  ],
});
