/**
 * `/assessment` — the template list and the create form (#146).
 *
 * The route's surface is `app/(mainlayout)/assessment/page.tsx` plus
 * `components/assessment-flow/**`; the words are here so the components hold none (E23).
 *
 * `invitation-email` is the one email this version sends. It carries `{initiator}`,
 * `{counterparty}`, `{template}` and `{link}` placeholders, filled by
 * `fillLabel()` in `lib/flow/email.ts` — the same reader every other band uses, because an
 * email is a user-facing string and belongs with the rest of them. There is exactly one
 * link in it: the invitation, and nothing else.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentPageCopy: PageCopy = zPageCopy.parse({
  heading: "Assessments",
  subtitle:
    "Pick a template and name the person you want to answer with. They answer from one link, blind until you have both submitted.",
  sections: [
    {
      id: "create",
      heading: "Start an instance",
      body: "You answer first. They see none of it until they have answered too — and you see none of theirs.",
      items: [
        { id: "initiator-name", label: "Your name" },
        { id: "initiator-placeholder", label: "Avery" },
        { id: "counterparty-name", label: "Their name" },
        { id: "counterparty-placeholder", label: "Rowan" },
        { id: "email", label: "Their email" },
        { id: "email-placeholder", label: "rowan@example.com" },
        { id: "submit", label: "Create and invite" },
      ],
    },
    {
      id: "templates",
      heading: "Published templates",
      body: "An instance copies the template's Aspects when it is created. Editing a template later never touches an instance someone has answered.",
    },
    {
      id: "empty",
      heading: "No published template",
      body: "A template has to be published before an instance can be created from it.",
    },
    {
      id: "invitation-email",
      items: [
        {
          id: "subject",
          label: "{initiator} wants to compare notes with you on {template}",
        },
        {
          id: "body",
          label:
            "Hi {counterparty},\n\n{initiator} has started an assessment called {template} and asked you to answer it.\n\nEvery Aspect asks two things: how it feels now, and how you wish it to be. Neither of you can see the other's answers until you have both submitted them, and after that the answers are frozen.\n\nOpen your invitation here: {link}\n\nThe link works once.",
        },
      ],
    },
  ],
});
