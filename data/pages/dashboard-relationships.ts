/**
 * `/dashboard/relationships` — the relationships this member is a party to (#533 phase 2, #706).
 *
 * One card per relationship: its title, the state the lifecycle stores (`draft`, `pending`,
 * `published`, `active`, …), the Aspect count, when it was created, and — once published — who was
 * invited and whether the link is still inside its seven-day window. The card links to the detail
 * screen, which is the only place that writes.
 *
 * **Two people read this list, and the copy says so (#706).** `role-initiator` and
 * `role-counterparty` are the seats; the person who started the relationship sees the two write
 * controls, the person who was invited sees the same card without them. The empty state is about
 * having no relationship at all — never about not being the initiator, which was the rule before
 * this card and is what made a Counterparty's screen read "No relationships yet".
 *
 * **"My Relationships" is this page's name and the rail row's name, deliberately.** The other list
 * (`/assessment/instances`) has been renamed away from it: two screens may not both read "My
 * Relationships" while one means something narrower.
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
  heading: "My Relationships",
  subtitle:
    "Every relationship you're a party to, newest first — the ones you started and the ones you were invited into. A draft is a configuration nobody has been invited to yet; publishing one opens the session and mints the invitation, and only the person who started it can publish.",
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
      body: "A relationship is a template copied and given two people. Both of them see it here; the one who started it configures the Aspects and publishes it, and the card says which seat you hold.",
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
        /**
         * #533 phase 3 — the derived membership state, drawn beside the stored status. "Read-only"
         * rather than a second lifecycle word: the row's status is the lifecycle, and this is the
         * consequence the money has on it.
         */
        { id: "read-only", label: "Read-only" },
      ],
    },
    /**
     * #620 — the card's own words. The four actions are the owner's labels, verbatim, and the
     * note under them says out loud why two of the four are disabled: a person should be able to
     * read that completion is coming rather than find four buttons where two do nothing.
     */
    {
      id: "card",
      items: [
        { id: "template", label: "Template" },
        { id: "with", label: "with" },
        { id: "not-claimed", label: "Not claimed yet" },
        { id: "the-other", label: "the other party" },
        /**
         * #706 — the viewer's own seat. Two people read one list, and a card that did not say
         * whose it is read as the initiator's to both of them.
         */
        { id: "role-initiator", label: "Initiator" },
        { id: "role-counterparty", label: "Counterparty" },
        { id: "aspects", label: "{count} Aspects" },
        { id: "open-assessment", label: "Open Assessment" },
        { id: "publish-assessment", label: "Publish Assessment" },
        /**
         * #706 — the card's primary action for the seat that cannot publish. The destination is
         * the same screen; only the verb is honest for a reader who will not be writing.
         */
        { id: "open-relationship", label: "View Relationship" },
        { id: "activate", label: "Activate Relationship" },
        { id: "gap", label: "Gap Analysis" },
        {
          id: "disabled-note",
          label:
            "Payment is not built yet, so Activate Relationship stays disabled. Gap Analysis opens once both people have accepted the assessment.",
        },
        { id: "last-session", label: "Started {when}" },
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
        { id: "role-too-low", label: "Your role may not start a relationship." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The relationship was not started." },
      ],
    },
    {
      id: "empty",
      heading: "No relationships yet",
      body: "Nobody has started one with you, and you have not started one. Start from a template you own — its Aspects are yours to tune until you publish it — or open the invitation somebody sends you, and it appears here.",
    },
    {
      id: "unreadable",
      heading: "Your relationships could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
