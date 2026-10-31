/**
 * `/assessment/templates/new` — the form that authors a template (#255).
 *
 * The route's surface is `app/(mainlayout)/assessment/templates/new/page.tsx` plus
 * `components/assessment-flow/template-form.tsx`; the words are here so the component holds none
 * (E23). The refusals live here too, for the same reason: `lib/flow/template-draft.ts` decides
 * *whether* a draft can be saved and answers with a code, and these are the sentences a person
 * reads. One sentence, one home — a validation message authored in both places is a message that
 * will disagree with itself.
 *
 * `{aspect}` is replaced by `fillLabel()` with the Aspect's number; `no-aspects`, `no-title` and
 * `duplicate-prompt` carry no number, because none of them is about one row.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentTemplatePageCopy: PageCopy = zPageCopy.parse({
  heading: "Write a template",
  subtitle:
    "Name the assessment, then write each Aspect as a question with two ends: the Left Value it is at its lowest and the Right Value at its highest.",
  sections: [
    {
      id: "form",
      heading: "The template",
      body: "Fill in as many Aspects as you need — one is enough, eight is the most. A blank row is a row you did not use, so leave it empty rather than half-filled.",
      items: [
        { id: "title", label: "Template title" },
        { id: "title-placeholder", label: "How we talk about money" },
        { id: "aspects-heading", label: "Aspects" },
        { id: "aspect", label: "Aspect {number}" },
        { id: "prompt", label: "Question" },
        { id: "prompt-placeholder", label: "We talk openly about what we spend" },
        { id: "left-value", label: "Left Value" },
        { id: "left-placeholder", label: "Never" },
        { id: "right-value", label: "Right Value" },
        { id: "right-placeholder", label: "Always" },
        { id: "submit", label: "Save template" },
      ],
    },
    {
      id: "scale",
      heading: "How the scale reads",
      body: "Left Value is the low end, a 1; Right Value is the high end, a 5. Both of you answer the same Aspects, and neither of you sees the other's answers until you have both submitted.",
    },
    {
      id: "copy-note",
      heading: "What a template is",
      body: "A template is a copy, not a live source. An instance takes its own copy of these Aspects when it is created, so nothing you save here can ever change a question somebody has already answered — which is also why a saved template cannot be edited.",
    },
    {
      id: "problems",
      heading: "This template was not saved",
      items: [
        {
          id: "no-title",
          label: "A template needs a title. It is the name the person you invite will see.",
        },
        {
          id: "no-aspects",
          label:
            "A template needs at least one Aspect. Fill in a question, a Left Value and a Right Value on at least one row.",
        },
        {
          id: "too-many-aspects",
          label:
            "A template holds at most eight Aspects. This one has more, so it was not saved — take a row out and try again.",
        },
        {
          id: "missing-question",
          label:
            "Aspect {aspect} has no question. Every Aspect needs one, or there is nothing for either of you to answer.",
        },
        {
          id: "missing-value",
          label:
            "Aspect {aspect} is missing a Value. Every Aspect needs both a Left Value and a Right Value — they are the two ends of the scale, and the report has nothing to measure without them.",
        },
        {
          id: "duplicate-prompt",
          label:
            "Two Aspects ask the same question. Each Aspect has to be a different question, or the report would count one answer twice.",
        },
      ],
    },
  ],
});
