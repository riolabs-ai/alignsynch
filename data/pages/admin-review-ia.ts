/**
 * `/admin/review/ia` — the words of the IA prototype (issue #721).
 *
 * The page draws the proposal in `lib/app-ia.ts`; this fixture holds every string it prints, so
 * E23 keeps the review screen at zero literals and a reviewer edits a sentence in one file.
 *
 * The sections, and why they are shaped this way:
 *
 *   nav-alignsynch  the proposed rail's own vocabulary — four group headings, five sub-headings
 *                   inside Operations, and one label per row. It is named `nav-alignsynch` on
 *                   purpose: the renderer resolves a label the way the shipped rail does
 *                   (`sectionOf(copy, "nav-alignsynch")` then `itemLabel(nav, row.id)`), so the
 *                   preview is drawn by the same lookup the real menu uses, over a different
 *                   fixture. Today's labels are **not** copied here — the diff table reads them
 *                   from `data/pages/shell.ts`, so a rename in the shipped rail shows up as a
 *                   change rather than as drift between two fixtures.
 *   rail            the band's heading, what the preview is, and the one sentence that says the
 *                   rail is drawn from data rather than photographed.
 *   diff            the current-vs-proposed table: three column labels, the "nothing is removed"
 *                   line, and the call-out for the one product decision in the proposal.
 *   map             the screen map: four column labels, the four navigation patterns in words, and
 *                   one name per screen.
 *
 * No `{placeholders}`: every number this page shows is either a count the view computes (rows,
 * screens) or a row's own field, so nothing here bakes one in.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminReviewIaPageCopy: PageCopy = zPageCopy.parse({
  heading: "The console becomes the product",
  subtitle:
    "A proposed information architecture for the relationship product, drawn beside the rail that ships today. One noun per row; the console becomes operations, and the four capabilities a member pays for open the menu.",
  sections: [
    {
      id: "nav-alignsynch",
      heading: "The proposed rail",
      items: [
        { id: "group-workspace", label: "Workspace" },
        { id: "group-do", label: "Do" },
        { id: "group-operations", label: "Operations" },
        { id: "group-support", label: "Support" },

        { id: "people", label: "People" },
        { id: "content", label: "Content" },
        { id: "sessions", label: "Sessions" },
        { id: "money", label: "Money" },
        { id: "system", label: "System" },

        { id: "overview", label: "Overview" },
        { id: "relationships", label: "Relationships" },
        { id: "templates", label: "Templates" },
        { id: "assessments", label: "Assessments" },
        { id: "gap-analysis", label: "Gap Analysis" },
        { id: "invitations", label: "Invitations" },
        { id: "reports", label: "Reports" },
        { id: "console", label: "Console" },
        { id: "users", label: "Users" },
        { id: "operations-relationships", label: "Relationships" },
        { id: "operations-templates", label: "Templates" },
        { id: "review", label: "Review" },
        { id: "instances", label: "Instances" },
        { id: "inbox", label: "Inbox" },
        { id: "billing", label: "Billing" },
        { id: "health", label: "Health" },
        { id: "broadcast", label: "Broadcast" },
        { id: "audit", label: "Audit" },
        { id: "help", label: "Help" },
        { id: "support", label: "Support" },
      ],
    },
    {
      id: "rail",
      heading: "The proposed rail, drawn live",
      body: "The rows below are projected from the proposal, not a picture of it: every href resolves to a page that exists today, and the row markup is the shell's own row.",
      items: [
        {
          id: "rail-note",
          label:
            "Drawn for an operator, so every group is visible at once. A member would see Workspace, Do and Support, and one row inside Operations if they answer the support queue.",
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
          id: "rail-screens",
          label: "Screens",
        },
      ],
    },
    {
      id: "diff",
      heading: "Current versus proposed",
      body: "Every row of the rail that ships today, and where it lands. A row is not deleted because a proposal tidies: each one either moves or has a reason written beside it.",
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

        { id: "screen-overview", label: "Overview" },
        { id: "screen-relationships", label: "Relationship list" },
        { id: "screen-relationship-detail", label: "One relationship" },
        { id: "screen-templates", label: "My templates" },
        { id: "screen-template-detail", label: "One template" },
        { id: "screen-assessments", label: "Assessment list" },
        { id: "screen-assessment-detail", label: "One assessment" },
        { id: "screen-gap", label: "Gap Analysis" },
        { id: "screen-invitations", label: "Invitations" },
        { id: "screen-report", label: "Relationship report" },
        { id: "screen-console", label: "Console" },
        { id: "screen-users", label: "Users" },
        { id: "screen-console-relationships", label: "Relationship registry" },
        { id: "screen-console-relationship-detail", label: "One relationship, operator view" },
        { id: "screen-console-templates", label: "Template registry" },
        { id: "screen-console-template-detail", label: "One template, operator view" },
        { id: "screen-instances", label: "Instance registry" },
        { id: "screen-instance-detail", label: "One instance" },
        { id: "screen-inbox", label: "Inbox" },
        { id: "screen-health", label: "Platform health" },
        { id: "screen-billing", label: "Billing" },
        { id: "screen-broadcast", label: "Broadcast" },
        { id: "screen-review", label: "Review shelf" },
        { id: "screen-audit", label: "Audit log" },
        { id: "screen-help", label: "Help" },
        { id: "screen-support", label: "Support" },
      ],
    },
  ],
});
