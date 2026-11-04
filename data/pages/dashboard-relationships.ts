/**
 * `/dashboard/relationships` — the relationships this member started (#533 phase 2).
 *
 * One row per relationship: its title, the state the lifecycle stores (`draft`, `pending`,
 * `published`, `active`, …), the Aspect count, when it was created, and — once published — who was
 * invited and whether the link is still inside its seven-day window. The row links to the detail
 * screen, which is the only place that writes.
 *
 *   list       what the screen is, and what a relationship is
 *   columns    the table's headings, in the order the table draws them
 *   status     the seven lifecycle words, as the badges print them
 *   view       what the invitation's state reads as on a row (`live`, `expired`, `claimed`, …)
 *   empty      no relationships yet
 *   unreadable the database did not answer
 *
 * **A status is drawn, never derived here.** `relationship.status` is stored (`0030`), the
 * invitation's state is `inviteStateOf()` over its two instants, and the two are one value on the
 * row (`publishViewOf`) so the list cannot disagree with the detail screen.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardRelationshipsPageCopy: PageCopy = zPageCopy.parse({
  heading: "My relationships",
  subtitle:
    "Every relationship you started, newest first. A draft is a configuration nobody has been invited to yet; publishing one starts your trial (or a checkout), opens the session and mints the invitation.",
  items: [
    { id: "aspects", label: "{count} Aspects" },
    { id: "open", label: "Open" },
    { id: "none", label: "—" },
    { id: "new-template", label: "Start from a template" },
  ],
  sections: [
    {
      id: "list",
      heading: "The list",
      body: "A relationship is a template copied and given two people. Yours are the ones you started; being invited to somebody else's is not a relationship you own, so it is not here.",
    },
    {
      id: "columns",
      items: [
        { id: "title", label: "Relationship" },
        { id: "status", label: "State" },
        { id: "aspects", label: "Aspects" },
        { id: "invited", label: "Invited" },
        { id: "created", label: "Started" },
        { id: "open", label: "Open" },
      ],
    },
    {
      id: "status",
      items: [
        { id: "draft", label: "Draft" },
        { id: "pending", label: "Ready to publish" },
        { id: "published", label: "Published" },
        { id: "active", label: "Running" },
        { id: "complete", label: "Complete" },
        { id: "void", label: "Void" },
        { id: "expired", label: "Expired" },
      ],
    },
    {
      id: "view",
      items: [
        { id: "not-published", label: "Not sent" },
        { id: "invite-live", label: "Link live" },
        { id: "invite-expired", label: "Link expired" },
        { id: "invite-claimed", label: "Joined" },
        { id: "invite-revoked", label: "Link revoked" },
        { id: "invite-missing", label: "No invitation" },
      ],
    },
    {
      id: "new",
      heading: "Start a relationship",
      body: "Pick one of your templates. The relationship gets its own copy of the Aspects, so tuning them here never changes the template you started from.",
      items: [
        { id: "choose", label: "Template" },
        { id: "reason", label: "Reason" },
        { id: "submit", label: "Start the relationship" },
        { id: "starting", label: "Starting…" },
        { id: "created", label: "Started. Open it to configure the Aspects." },
        { id: "open", label: "Open it" },
        { id: "none", label: "You have no templates yet." },
        { id: "new-template", label: "Create a template first" },
        { id: "not-yours", label: "That template belongs to another account." },
        { id: "no-such-template", label: "That template is not in this database." },
        {
          id: "not-editable",
          label: "That template is archived — it cannot start a relationship.",
        },
        { id: "reason-too-short", label: "A reason of at least eight characters is required." },
        { id: "role-too-low", label: "Your role may not start a relationship." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The relationship was not started." },
      ],
    },
    {
      id: "empty",
      heading: "No relationships yet",
      body: "Start one from a template you own. Its Aspects are yours to tune until you publish it, and publishing is what invites the other person.",
    },
    {
      id: "unreadable",
      heading: "Your relationships could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
