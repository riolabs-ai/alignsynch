/**
 * `/assessment/templates/[templateId]` — one template, read-only (#console 5/5).
 *
 * The "open" action has to open something. Editing is a separate decision (the spec puts the
 * editor at this same route later), so what this page does is *show* the template: its Aspects in
 * order, each with its two Values, the instances made from it and whether it is archived. Nothing
 * here writes, and no field is editable — a template that could be edited from a page somebody
 * reached by accident is a worse answer than a page that only reads.
 *
 * Read-only also means the page can say the one thing that matters about archiving: an instance
 * copies its Aspects when it is created, so archiving the template does not reach an instance
 * anyone has answered (`archive-note` below).
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const templateDetailPageCopy: PageCopy = zPageCopy.parse({
  heading: "Template",
  sections: [
    {
      id: "back",
      items: [{ id: "all", label: "All templates" }],
    },
    {
      id: "facts",
      heading: "About this template",
      items: [
        { id: "aspects", label: "Aspects" },
        { id: "instances", label: "Relationships made" },
        { id: "status", label: "Status" },
        { id: "created", label: "Created" },
        { id: "authorship-built-in", label: "Built-in — the platform wrote it" },
        { id: "authorship-mine", label: "Yours" },
        { id: "status-published", label: "Published" },
        { id: "status-archived", label: "Archived" },
      ],
    },
    {
      id: "aspects",
      heading: "Aspects",
      body: "Each Aspect asks two things: how it feels now, and how you wish it to be.",
      items: [
        { id: "left", label: "Left Value" },
        { id: "right", label: "Right Value" },
        { id: "empty", label: "This template asks no Aspects." },
      ],
    },
    {
      /** The v1 library's two groups, named on the header band when the type resolves (#409). */
      id: "groups",
      items: [
        { id: "business", label: "Business" },
        { id: "personal", label: "Personal" },
        { id: "other", label: "Other templates" },
      ],
    },
    {
      id: "actions",
      heading: "What you can do with it",
      items: [
        // #618 — the owner's words, verbatim. This page was drawing "Start an instance" and
        // pointing at the library, which is instance language on a product page and a link back to
        // where the reader came from. The control now names the thing that gets created.
        { id: "create", label: "Create Relationship" },
        {
          id: "plans-note",
          label:
            "Creating a relationship is free. Your plan decides how many you may hold at once, and it is chosen when a relationship is ready to complete, not here.",
        },
        { id: "plans", label: "See plans and prices" },
        { id: "duplicate", label: "Duplicate into your templates" },
        { id: "archive", label: "Archive" },
        { id: "unarchive", label: "Unarchive" },
      ],
    },
    {
      /**
       * The landing's identity band (#409). The v1 template page opens with a band naming the
       * realm, the group, the Relationship Type and the two **roles** — never a person: a
       * template holds Aspects, and names are instance facts. `who-its-for` / `who-its-not-for`
       * label the descriptor the catalogue already authored for the type
       * (`data/relationship-types.ts::descriptor`); a template whose slug names no catalogue
       * type has no descriptor, and says so instead of having one written for it.
       */
      id: "identity",
      items: [
        { id: "type", label: "Relationship Type" },
        { id: "realm", label: "Realm" },
        { id: "group", label: "Group" },
        { id: "seats", label: "Seats" },
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "roles", label: "{initiator} / {counterparty}" },
        { id: "who-its-for", label: "Who it is for" },
        { id: "who-its-not-for", label: "Who it is not for" },
        {
          id: "no-type",
          label:
            "This template names no relationship type, so no realm, seat or descriptor is claimed for it here.",
        },
      ],
    },
    {
      /**
       * Mode and Setting, explained where a person decides (#409). Both are the model's own
       * vocabulary (`content/assessment.ts`), so the words beside them are the only copy: a Mode
       * is what each party answers, a Setting is what counts as Aligned, and neither is a number
       * this page prints.
       */
      id: "shape",
      heading: "Mode and Setting",
      body: "Every relationship run on this template records two things before either party answers. They are fixed at creation, and the report is read under them.",
      items: [
        { id: "mode", label: "Mode" },
        { id: "mode-basic", label: "Basic Mode asks Feel and Wish on every Aspect." },
        {
          id: "mode-advanced",
          label:
            "Advanced Mode asks all four — Feel, Wish, Think and Guess — so the report can also measure what each party predicted the other would answer.",
        },
        { id: "setting", label: "Setting" },
        {
          id: "setting-note",
          label:
            "The Setting is a lens over the Gaps, never a Gap: it changes no answer, and decides only what counts as aligned.",
        },
        {
          id: "no-money",
          label:
            "No price is shown here: a relationship's cost depends on the plan chosen when it is ready to complete, and the plan prices are on the pricing page.",
        },
      ],
    },
    {
      id: "archive-note",
      heading: "This template is archived",
      body: "It no longer appears in the catalogue and no new relationship can be started from it. Every relationship already made from it keeps its own copy of the Aspects, so those still open and still read.",
    },
  ],
});
