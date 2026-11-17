/**
 * `/dashboard/templates/[id]/propose` — Propose a Template (#1130, bundle 06 `template-proposal.html`).
 *
 * **A proposal is a request, never a publish.** The Library is admin-curated (#533), and the review
 * queue behind a proposal is **undecided** (crud-matrix "Conflicts: Propose to Library"), so this
 * surface may draw the form and must not write into the public catalogue. The action behind Submit for
 * Review validates the form and answers; it publishes nothing, and the sent panel says in words that
 * nothing has been reviewed yet.
 *
 *   intro        what this page is, and the template it is about
 *   fields       the four fields: name, category, who it is for, the optional note for reviewers
 *   consent      the required box, and the sentence it agrees to
 *   send         Submit for Review, Cancel, and the four refusals the action can answer
 *   sent         Sent for Review — and the honest state of the queue behind it
 *   shared       the aside: exactly what is shared, and exactly what is never shared
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardTemplateProposalPageCopy: PageCopy = zPageCopy.parse({
  eyebrow: "Propose to Library",
  heading: "Propose a Template",
  subtitle:
    "Send a template of yours to the AlignSynch team. A proposal is reviewed before anything is shared, and it never publishes itself.",
  items: [
    { id: "required", label: "Required" },
    { id: "optional", label: "Optional" },
  ],
  sections: [
    {
      id: "fields",
      items: [
        { id: "name", label: "Template Name" },
        { id: "name-placeholder", label: "What should the Library call it?" },
        { id: "category", label: "Category" },
        { id: "category-placeholder", label: "Choose a category" },
        { id: "family", label: "Family" },
        { id: "couples", label: "Couples" },
        { id: "friends", label: "Friends" },
        { id: "work", label: "Work" },
        { id: "home", label: "Home" },
        { id: "who", label: "Who It’s For" },
        { id: "who-placeholder", label: "The people you had in mind when you wrote it." },
        { id: "note", label: "Note for Reviewers" },
        { id: "note-placeholder", label: "Anything the reviewer should know about this template." },
      ],
    },
    {
      id: "consent",
      items: [
        { id: "label", label: "Nothing Personal" },
        {
          id: "body",
          label:
            "This template contains nothing personal — no names, no answers and nothing about a relationship of mine — and I understand that submitting it does not publish it.",
        },
      ],
    },
    {
      id: "send",
      items: [
        { id: "submit", label: "Submit for Review" },
        { id: "sending", label: "Sending…" },
        { id: "cancel", label: "Cancel" },
        { id: "back", label: "Back to My Template" },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "name-required", label: "Give the proposal a name." },
        { id: "category-required", label: "Choose the category it belongs on." },
        { id: "who-required", label: "Say who the template is for." },
        {
          id: "consent-required",
          label: "Tick the box to confirm the template carries nothing personal.",
        },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "not-yours", label: "That template belongs to another account." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The proposal did not go through." },
      ],
    },
    {
      id: "sent",
      heading: "Sent for Review",
      /**
       * The sent state is **honest about the queue**: the review flow is undecided, so nothing has been
       * reviewed and nothing can reach the Library until that decision lands. The alternative — a
       * confirmation that implies a reviewer is reading it today — would be the surface promising a
       * service that does not exist yet.
       */
      body: "Your proposal is recorded for this session. The review queue is not open yet, so nothing has been reviewed and nothing will be added to the Library until it is.",
      items: [{ id: "back", label: "Back to My Template" }],
    },
    {
      id: "shared",
      heading: "What Gets Shared",
      body: "Exactly this, and nothing else.",
      items: [
        { id: "name", label: "The template’s name and the category you chose" },
        { id: "who", label: "Who you said it is for" },
        { id: "aspects", label: "Its Aspects — the prompts and both named ends" },
        { id: "note", label: "Your note for the reviewer, if you wrote one" },
      ],
    },
    {
      id: "never",
      heading: "What Is Never Shared",
      items: [
        { id: "relationships", label: "Any relationship of yours, or who is in it" },
        { id: "answers", label: "Any answer either person gave" },
        { id: "account", label: "Your account details" },
      ],
    },
  ],
});
