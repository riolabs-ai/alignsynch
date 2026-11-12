/**
 * `/assessments` — the member's assessment sessions, as one record list (#877).
 *
 * **The heading is "My Assessments", and it is the page's title too.** The owner's correction
 * (issue #877) was that this listing is plural and core: a sibling of My Relationships and My
 * Templates, reached from the rail, not a page under the `/assessment` record-kind. The surface it
 * replaced — `/assessment/instances`, which read "Your relationships" — is a 308 here.
 *
 * **Three words, and this page only uses two of them.** A *relationship* is the ongoing container
 * — bought once, holding every cycle. A *session* is one cycle of answering inside it. An
 * *assessment* is the scored Gap analysis a finished session produces, so it is never the thing a
 * reader is "in", starts, or opens from this list: the CTA starts a relationship, the empty state
 * is about relationships, and the word assessment does not appear in this file's visible copy —
 * except in the page's own name, which the owner fixed as "My Assessments".
 *
 * **The card's own words are `relationshipCard()`'s.** `lib/member/card.ts` reads the `metric`,
 * `card`, `paid`, `invite`, `state` and `marker` bands below, and it is the projection every
 * relationship card in this tree prints — moving this surface did not change one sentence a reader
 * sees on a card (#795 F2/F4). The bands this surface adds are the shell's: `controls` (the
 * toolbar), `tabs` (the three stored states plus `all`), `links` (the row's destinations) and the
 * two empty states.
 *
 * **Every label here is a word a reader sees; none of them is a figure.** A count comes from the
 * rows the read returned, never from a fixture — the one rule the old fixture stated and this one
 * keeps, which is what lets `metadata.json`-free counts stay honest.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const assessmentsPageCopy: PageCopy = zPageCopy.parse({
  heading: "My Assessments",
  subtitle:
    "Every assessment session you're a party to, whichever link brought you in. Open one to answer, or to read the Gap once you've both accepted.",
  cta: { label: "Start a relationship", href: "/assessment" },
  sections: [
    {
      /**
       * The card's own words — the ancestor is `components/my-quizzes/my-quizzes.tsx`, and this is
       * the translation of its header, filter row and grid. Kept verbatim from the surface this
       * page absorbed: the card is the same card.
       */
      id: "row",
      items: [
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "you", label: "you" },
        { id: "unnamed-party", label: "the other party" },
        { id: "open", label: "Open this relationship" },
      ],
    },
    {
      /**
       * The toolbar — the shell `components/dashboard/relationships-list.tsx` ships: one search
       * box, one state select, one order select, one grid/list toggle. `all-states` is the select's
       * "no narrowing" word; the three state labels themselves are the `tabs` band, because a tab
       * and a select option for one stored state must not be two different sentences.
       */
      id: "controls",
      items: [
        { id: "search", label: "Search your assessments" },
        { id: "state-label", label: "Session state" },
        { id: "all-states", label: "All sessions" },
        { id: "sort-label", label: "Order" },
        { id: "newest", label: "Newest first" },
        { id: "oldest", label: "Oldest first" },
        { id: "grid", label: "Grid view" },
        { id: "list", label: "List view" },
      ],
    },
    {
      /**
       * The tabs are the **three stored states** (`MyInstanceState`), and nothing else: a session
       * is either waiting on this reader, waiting on the other party, or complete and accepted —
       * which is the state that opens the Gap. `all` is the default, so a row is never hidden
       * behind a tab nobody clicked.
       */
      id: "tabs",
      items: [
        { id: "all", label: "All assessments" },
        { id: "yours-to-answer", label: "Needs your answers" },
        { id: "awaiting-other", label: "Waiting on the other party" },
        { id: "complete", label: "Gap ready" },
      ],
    },
    {
      /**
       * The row's four destinations, each one an address that already exists (#877).
       *
       * `session` is `/assessment/instances/<record id>` — the flow's own screen, which did not
       * move. `assessment` is the template the session was copied from. `relationship` is the
       * member's relationship detail. `gap` is the report, and it is drawn **only on a complete
       * row**: before both parties have accepted, that route answers the locked page, so linking
       * it would be a door onto "not yet" on every row.
       */
      id: "links",
      items: [
        { id: "session", label: "Open the session" },
        { id: "assessment", label: "The assessment" },
        { id: "relationship", label: "The relationship" },
        { id: "gap", label: "Gap" },
      ],
    },
    {
      id: "metric",
      items: [
        { id: "sessions", label: "Sessions" },
        { id: "alignment", label: "Avg alignment" },
        { id: "aspects", label: "Aspects" },
        { id: "unscored", label: "No scored session yet" },
      ],
    },
    {
      id: "card",
      items: [
        { id: "with", label: "With" },
        { id: "not-claimed", label: "Not claimed yet" },
        { id: "no-session", label: "No session yet" },
        { id: "last-session", label: "Last session {when}" },
        { id: "view", label: "View" },
      ],
    },
    {
      /**
       * What was paid — the Initiator's card only, and never a total. `nothing` is a sentence, not
       * a figure: a relationship with no plan has been charged nothing, and one relationship is
       * one purchase, so there is no second payment to add.
       */
      id: "paid",
      items: [
        { id: "label", label: "Paid" },
        { id: "nothing", label: "No plan yet" },
        { id: "statement", label: "{plan} · bought {date}" },
      ],
    },
    {
      id: "invite",
      items: [
        // These ids are `INVITE_STATES` (`lib/flow/invite-state.ts`), and they are the only
        // source: the row renders `itemLabel(inviteCopy, instance.inviteState)`, so a state with
        // no item here throws PageCopy at render time and takes the whole list down.
        { id: "unclaimed", label: "Not claimed yet" },
        { id: "expired", label: "Expired" },
        { id: "claimed", label: "Accepted" },
        { id: "revoked", label: "Withdrawn" },
      ],
    },
    {
      id: "state",
      items: [
        { id: "yours-to-answer", label: "Yours to answer" },
        { id: "awaiting-other", label: "Waiting for {name} to answer." },
        { id: "complete", label: "You have both accepted — the Gap is open" },
      ],
    },
    {
      // #252. Drawn only on a row that is already `complete` and whose party has not opened it
      // since: the row says *where the instance stands* and this says *that it moved while you
      // were away*. No count, no score, no Gap value.
      id: "marker",
      items: [{ id: "unseen", label: "Complete since you last looked — open it to read the Gap" }],
    },
    {
      id: "empty",
      heading: "You are not in a relationship yet",
      body: "A relationship starts when you pick a template and invite someone, or when someone invites you. Either way its first session turns up here afterwards, without needing the invitation link again.",
      cta: { label: "Start a relationship", href: "/assessment" },
    },
    {
      /**
       * Rows exist and this narrowing keeps none of them — a different sentence from the band
       * above, because "clear the search" and "start a relationship" are different instructions.
       */
      id: "empty-filter",
      heading: "No session matches this view",
      items: [
        { id: "status", label: "No session is {status} right now." },
        { id: "search", label: "No session matches “{query}”. You have {count} in total." },
      ],
    },
    {
      /**
       * The three lists the console Overview's cards link with (Console 2/5) — `?filter=<id>` on
       * this route, resolved through `lib/flow/overview.ts` so the figure on the card and the length
       * of this list are two passes over one array.
       */
      id: "filter",
      heading: "Nothing in this list right now",
      items: [
        { id: "showing", label: "Showing one list only" },
        { id: "awaiting-other", label: "Waiting on the other party" },
        { id: "yours-to-answer", label: "Needs your answers" },
        { id: "reports-open", label: "Reports open" },
        { id: "empty", label: "No relationship is in this list right now." },
        { id: "show-all", label: "Show every assessment" },
      ],
    },
    {
      id: "unreadable",
      heading: "Your assessments could not be read",
      body: "This list is read from the database on every visit, and this visit did not get an answer. Nothing here came from a cache, and no answers were shown, guessed or reused.",
      items: [{ id: "reload", label: "Try the list again" }],
    },
  ],
});
