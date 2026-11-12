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
 *   controls   the toolbar: the search field's placeholder, the two selects, the view toggle
 *   tabs       the six filters, in the order the rail draws them (`Drafts` filters `draft`)
 *   status     the seven lifecycle words, as the badges print them
 *   kind       the record's own kind, as the card's first chip prints it (a relationship,
 *              never the template it was copied from — #874)
 *   view       what the invitation's state reads as on a row (`live`, `expired`, `claimed`, …)
 *   card       the card's own words, including the per-row menu's four acts and their reasons
 *   empty      no relationships yet
 *   empty-filter  rows exist, none matching the search or the tab
 *   unreadable the database did not answer
 *
 * **The page is the record list My Quizzes draws (#841 part 2).** The header carries the create
 * action, the toolbar carries the search, the two selects and the grid/list toggle, six status
 * tabs filter the rows, and each row carries one primary action plus a menu — the shape
 * `components/my-quizzes/my-quizzes.tsx` ships, over a relationship's stored lifecycle instead of
 * a quiz's publication state. The approved artifact is
 * `docs/review/artifacts/mockup-relationships-list-v1.html`; where this file and that artifact
 * disagree, the artifact wins.
 *
 * **A status is drawn, never derived here.** `relationship.status` is stored (`0030`), the
 * invitation's state is `inviteStateOf()` over its two instants, and the two are one value on the
 * row (`publishViewOf`) so the list cannot disagree with the detail screen.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardRelationshipsPageCopy: PageCopy = zPageCopy.parse({
  heading: "My Relationships",
  subtitle: "Every relationship you are part of, on both sides of the invitation",
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
      /**
       * #841 part 2 — the toolbar, verbatim from the approved artifact
       * (`docs/review/artifacts/mockup-relationships-list-v1.html`).
       *
       * The two selects are the two real controls: the status one is the same filter the tabs
       * write, and the sort one orders the rows the read already returned by `createdAt` — a
       * client-side order over rows in hand, never a claim that the SQL sorts. There is no
       * "Most popular" or "Highest revenue" here because the read carries neither.
       */
      id: "controls",
      items: [
        { id: "search", label: "Search your relationships…" },
        { id: "status-label", label: "Status" },
        { id: "all-statuses", label: "All statuses" },
        { id: "sort-label", label: "Sort by" },
        { id: "newest", label: "Newest" },
        { id: "oldest", label: "Oldest" },
        { id: "grid", label: "Grid view" },
        { id: "list", label: "List view" },
      ],
    },
    {
      /**
       * The six tabs the owner approved. Five are stored statuses (`draft`, `published`,
       * `active`, `complete`, `expired`) — `running` reads stored `active` — and `all` is the
       * default. `Drafts` is the tab's word, `Draft` is the badge's: one is a filter, the other
       * is a state, and `data/pages` keeps both.
       */
      id: "tabs",
      items: [
        { id: "all", label: "All" },
        { id: "draft", label: "Drafts" },
        { id: "published", label: "Published" },
        { id: "active", label: "Running" },
        { id: "complete", label: "Complete" },
        { id: "expired", label: "Expired" },
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
     * #874 — the record's **own kind**, keyed by the kind's value rather than by the name of
     * the field it came from.
     *
     * A relationship is not a Template: a template is the product a person copies, and a
     * relationship is the two-party pairing made from one. The card's kind chip resolves
     * through this table (`wordFor`, beside the `status` and `view` tables it already reads),
     * so the chip prints a value like every other chip on the card. It used to ask for a
     * `card` item whose only job was to name the concept, which is why every relationship
     * read as a "Template". `/templates`, Template records and the catalogue keep their own
     * noun — this table is the card's, and it says one thing.
     */
    {
      id: "kind",
      items: [{ id: "relationship", label: "Relationship" }],
    },
    /**
     * #620 — the card's own words. The three actions are the owner's labels, verbatim.
     *
     * #739 removed the two controls #620 shipped disabled (`Activate Relationship`, `Gap
     * Analysis`) and the note under them: the acts exist now, on the relationship's own screen,
     * and a card that cannot read the seal is the wrong place to draw them. `complete-relationship`
     * is the initiator's primary once the relationship has a session.
     *
     * #841 part 2 — the card keeps one primary act in its action row and moves the secondary ones
     * into the per-row menu, exactly as the approved artifact draws it. `open-assessment` is the
     * row's secondary while a session exists and the menu's disabled item — with
     * `open-assessment-why` — while it does not; `view-relationship` and `copy-invite` are the
     * other two acts, and `archive` is drawn disabled with its reason because no delete or
     * archive path exists (#743). `view` is the footer's own control, the one My Quizzes draws.
     */
    {
      id: "card",
      items: [
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
        { id: "open-assessment-why", label: "No session yet — publish first" },
        { id: "publish-assessment", label: "Publish Assessment" },
        /**
         * #912 — **a draft's two CTAs, and the owner's words for them.** A draft is where money and
         * the counterparty both still have to be decided, so the card draws both acts front and
         * centre instead of one verb and a menu:
         *
         *   invite-members        the pay modal (`…/create/invite?instance=`), which is the only
         *                         surface that takes a card. It needs a session to open, which is
         *                         the second label below: a draft written by this list's own create
         *                         band has none, and the card says so rather than drawing a link that
         *                         would land on stage 1 again.
         *   publish-to-counterparty  the relationship's own screen, where the publish band is.
         */
        { id: "invite-members", label: "Invite Members" },
        { id: "invite-members-why", label: "No invitation yet — this draft has no session" },
        { id: "publish-to-counterparty", label: "Publish to Counterparty" },
        /**
         * #706 — the card's primary action for the seat that cannot publish. The destination is
         * the same screen; only the verb is honest for a reader who will not be writing.
         */
        { id: "open-relationship", label: "Open Relationship" },
        /** #739 — the initiator's primary once there is a session: the screen with the two acts. */
        { id: "complete-relationship", label: "Complete Relationship" },
        /** #841 part 2 — the three controls the per-row menu and the footer carry. */
        { id: "view", label: "View" },
        { id: "actions", label: "Actions" },
        { id: "view-relationship", label: "View Relationship" },
        { id: "copy-invite", label: "Copy invitation link" },
        { id: "copy-invite-why", label: "Nothing sent yet" },
        /**
         * #220 — the link exists only at mint time (`invitationLink` from the publish outcome),
         * so a row that was sent has nothing here to copy. The menu says so instead of offering
         * a copy that would copy nothing.
         */
        {
          id: "copy-invite-why-sent",
          label: "The link is shown once, when it is sent — open the relationship",
        },
        { id: "archive", label: "Archive" },
        { id: "archive-why", label: "Not built yet (#743)" },
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
        /** #841 part 2 — the header action's word, and the empty state's. */
        { id: "start", label: "Start a relationship" },
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
    /**
     * #841 part 2 — the second empty state, and the one the artifact draws: a list that has rows
     * but none matching what the reader asked for. Two sentences, because the two ways to get here
     * are different: a search that matched nothing, and a tab with nothing in it.
     */
    {
      id: "empty-filter",
      heading: "No relationships found",
      items: [
        {
          id: "search",
          label:
            "Nothing matches “{query}”. Try a different search, or clear it to see all {count}.",
        },
        { id: "status", label: "You have no {status} relationships yet. Try another tab." },
      ],
    },
    {
      id: "unreadable",
      heading: "Your relationships could not be read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
