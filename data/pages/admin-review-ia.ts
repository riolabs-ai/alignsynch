/**
 * `/admin/review/ia` — the words of the IA prototype (issue #721, revised for #731).
 *
 * The page draws the proposal in `lib/app-ia.ts`; this fixture holds every string it prints, so
 * E23 keeps the review screen at zero literals and a reviewer edits a sentence in one file.
 *
 * The sections, and why they are shaped this way:
 *
 *   nav-alignsynch  the proposed rail's own vocabulary — one label per group main item and one per
 *                   submenu row, including the three authoring actions and the "proposed" marker
 *                   that says two of them have no route yet. It is named `nav-alignsynch` on
 *                   purpose: the renderer resolves a label the way the shipped rail does
 *                   (`sectionOf(copy, "nav-alignsynch")` then `itemLabel(nav, row.id)`), so the
 *                   preview is drawn by the same lookup the real menu uses, over a different
 *                   fixture. Today's labels are **not** copied here — the diff table reads them
 *                   from `data/pages/shell.ts`, so a rename in the shipped rail shows up as a
 *                   change rather than as drift between two fixtures.
 *   rail            the band's heading, what the preview is, and the four numbers it counts.
 *   diff            the current-vs-proposed table: three column labels, the "nothing else is
 *                   removed" line, and the call-out for the one product decision in the proposal.
 *   map             the screen map: four column labels, the four navigation patterns in words, and
 *                   one name per screen.
 *
 * No `{placeholders}`: every number this page shows is either a count the view computes (groups,
 * rows, actions, screens) or a row's own field, so nothing here bakes one in.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminReviewIaPageCopy: PageCopy = zPageCopy.parse({
  heading: "Four operator groups, and one console inside them",
  subtitle:
    "The second revision of the proposed information architecture, redrawn to the owner's feedback: the member rail keeps its approved patterns, and operator work is four main items — Users, Templates, Billing, System — each with its pages as a submenu. The console stops being a place you land on and becomes the admin UI itself.",
  sections: [
    {
      id: "nav-alignsynch",
      heading: "The proposed rail",
      items: [
        { id: "group-workspace", label: "Workspace" },
        { id: "group-do", label: "Do" },
        { id: "group-users", label: "Users" },
        { id: "group-templates", label: "Templates" },
        { id: "group-billing", label: "Billing" },
        { id: "group-system", label: "System" },
        { id: "group-support", label: "Support" },

        { id: "overview", label: "Home" },
        { id: "relationships", label: "Relationships" },
        { id: "templates", label: "Templates" },
        { id: "assessments", label: "Assessments" },
        { id: "gap-analysis", label: "Gap Analysis" },
        { id: "invitations", label: "Invitations" },
        { id: "reports", label: "Reports" },

        { id: "users", label: "People" },
        { id: "operations-relationships", label: "Relationships" },
        { id: "admin-invitations", label: "Invitations" },

        { id: "admin-templates", label: "All templates" },
        { id: "operations-templates", label: "Catalogue" },
        { id: "admin-template-editor", label: "Template editor" },
        { id: "review", label: "Review shelf" },
        { id: "template-new", label: "New template" },
        { id: "template-clone", label: "Clone → draft" },
        { id: "template-publish", label: "Publish revision" },

        { id: "billing", label: "Plans & subscriptions" },

        { id: "health", label: "Health" },
        { id: "broadcast", label: "Broadcast" },
        { id: "audit", label: "Audit" },
        { id: "instances", label: "Assessments" },

        { id: "help", label: "Help" },
        { id: "support", label: "Support" },

        {
          id: "proposed-marker",
          label: "Proposed — no route yet",
        },
      ],
    },
    {
      id: "rail",
      heading: "The proposed rail, drawn live",
      body: "The rows below are projected from the proposal, not a picture of it: a group is a main item you open, its pages are the submenu beneath it, and every link resolves to a page that exists today. The row markup is the shell's own row.",
      items: [
        {
          id: "rail-note",
          label:
            "Drawn for an operator, so every group is visible at once. A member would see Workspace, Do and Support — the three groups whose rows are theirs — and none of the four operator groups.",
        },
        {
          id: "rail-count",
          label: "Rows",
        },
        {
          id: "rail-groups",
          label: "Groups",
        },
        {
          id: "rail-actions",
          label: "Actions",
        },
        {
          id: "rail-screens",
          label: "Screens",
        },
        {
          id: "rail-authoring",
          label:
            "Templates carries the three authoring actions the owner asked to see: New template links, because the route exists; Clone → draft and Publish revision are proposed, so they are drawn as controls with a marker and never as links.",
        },
      ],
    },
    {
      id: "diff",
      heading: "Current versus proposed",
      body: "Every row of the rail that ships today, and where it lands. A row is not deleted because a proposal tidies: each one either moves or has a reason written beside it — and exactly one is retired, because the owner asked for the console to stop being a destination.",
      items: [
        { id: "col-today", label: "Today" },
        { id: "col-lands", label: "Lands in" },
        { id: "col-change", label: "What changes" },
        { id: "removed-heading", label: "Removed" },
        {
          id: "removed-none",
          label:
            "No destination is dropped. Every row in today's rail resolves to a row in the proposal; what changes is where it sits and what it is called.",
        },
        {
          id: "gap-note",
          label:
            "Gap Analysis is the one product decision: the proposal shows it in Workspace for a member, and the page keeps its operator gate on this branch. Moving the gate is a separate change with a permission behind it.",
        },
      ],
    },
    {
      id: "map",
      heading: "Screen map",
      body: "A row is a destination; a screen is what a reader looks at once they arrive. Each screen states the shape it is navigated by, so a detail page cannot be a cul-de-sac with no way back.",
      items: [
        { id: "col-screen", label: "Screen" },
        { id: "col-group", label: "Group" },
        { id: "col-row", label: "Row" },
        { id: "col-pattern", label: "Pattern" },

        {
          id: "pattern-list-detail",
          label: "List, then a detail with a back link and a breadcrumb",
        },
        { id: "pattern-tab-rail", label: "Entity detail with one tab rail" },
        { id: "pattern-row-actions", label: "Row action on the list, no rail row of its own" },
        { id: "pattern-single", label: "One screen, no detail behind it" },

        { id: "screen-overview", label: "Home" },
        { id: "screen-relationships", label: "Relationship list" },
        { id: "screen-relationship-detail", label: "One relationship" },
        { id: "screen-templates", label: "My templates" },
        { id: "screen-template-detail", label: "One template" },
        { id: "screen-assessments", label: "Assessment list" },
        { id: "screen-assessment-detail", label: "One assessment" },
        { id: "screen-gap", label: "Gap Analysis" },
        { id: "screen-invitations", label: "Invitations" },
        { id: "screen-report", label: "Relationship report" },
        { id: "screen-users", label: "People directory" },
        { id: "screen-console-relationships", label: "Relationship registry" },
        { id: "screen-console-relationship-detail", label: "One relationship, operator view" },
        { id: "screen-admin-invitations", label: "Support queue" },
        { id: "screen-admin-templates", label: "All templates" },
        { id: "screen-admin-template-detail", label: "Template editor" },
        { id: "screen-console-templates", label: "Template catalogue" },
        { id: "screen-console-template-detail", label: "One catalogue template" },
        { id: "screen-review", label: "Review shelf" },
        { id: "screen-template-new", label: "New template" },
        { id: "screen-template-clone", label: "Clone into a draft" },
        { id: "screen-template-publish", label: "Publish a revision" },
        { id: "screen-billing", label: "Plans & subscriptions" },
        { id: "screen-health", label: "Platform health" },
        { id: "screen-broadcast", label: "Broadcast" },
        { id: "screen-audit", label: "Audit log" },
        { id: "screen-instances", label: "Instance registry" },
        { id: "screen-instance-detail", label: "One instance" },
        { id: "screen-help", label: "Help" },
        { id: "screen-support", label: "Support" },
      ],
    },
  ],
});
