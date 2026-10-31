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
        { id: "instances", label: "Instances made" },
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
      id: "actions",
      heading: "What you can do with it",
      items: [
        { id: "start", label: "Start an instance" },
        { id: "duplicate", label: "Duplicate into your templates" },
        { id: "archive", label: "Archive" },
        { id: "unarchive", label: "Unarchive" },
      ],
    },
    {
      id: "archive-note",
      heading: "This template is archived",
      body: "It no longer appears in the catalogue and no new instance can be started from it. Every instance already made from it keeps its own copy of the Aspects, so those still open and still read.",
    },
  ],
});
