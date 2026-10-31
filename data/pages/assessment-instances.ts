/**
 * `/assessment/instances` — the instances the signed-in account is a party to (#213).
 *
 * The third band is the whole point of the route: `yours-to-answer`, `awaiting-other` and
 * `complete` are the three things a row may say, and `awaiting-other` is the only one that
 * mentions the other party — as *awaiting*, with no score, no count of what they have answered
 * and no Gap. The sentence stops there on purpose: the blind rule holds in the list, so a row is
 * not allowed to tell a reader how far along somebody else is, only that they are not done.
 *
 * `marker` is the second sentence a row may carry (#252), and it only ever appears on a row that
 * already says `complete`: it names the *event* — the other person answered, and this reader has
 * not opened it since — without adding a number, a rating or a Gap value, and without telling the
 * reader anything they would not have seen by opening the row. `unseen` is the only item because
 * "already seen" is an absence, not a sentence.
 *
 * `row` carries the four strings a row composes (`initiator`, `counterparty`, `you`, and `open`),
 * and `unnamed-party` is the fallback for the one case Postgres can leave NULL: an instance whose
 * Counterparty row does not exist yet *and* whose invitation is gone. It should not happen;
 * saying "the other party" is more honest than an empty name.
 *
 * `empty` is a real band, not a blank page: a signed-in person with no instances is told how one
 * starts and given the link that starts it. `unreadable` is the failure state — the list is read
 * from the database on every visit, and a database that does not answer prints the layer's own
 * sentence instead of Next's 500 (`lib/db/client.ts::DatabaseUnavailableError`).
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const myInstancesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Your assessments",
  subtitle:
    "Every instance you are a party to, whichever link brought you in. Open one to answer, or to read the Gap once you have both submitted.",
  sections: [
    {
      id: "list",
      heading: "What you are in the middle of",
      body: "Newest first. A row says only where the instance stands: neither of you sees the other's answers until you have both submitted.",
    },
    {
      id: "row",
      items: [
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "you", label: "you" },
        { id: "unnamed-party", label: "the other party" },
        { id: "open", label: "Open this instance" },
      ],
    },
    {
      id: "state",
      items: [
        { id: "yours-to-answer", label: "Yours to answer" },
        { id: "awaiting-other", label: "Waiting for {name} to answer." },
        { id: "complete", label: "You have both answered — the Gap is open" },
      ],
    },
    {
      // #252. Drawn only on a row that is already `complete` and whose party has not opened it
      // since: the row says *where the instance stands* (band `state`) and this says *that it
      // moved while you were away*. No count, no score, no Gap value — opening the row is still
      // the only way to read one.
      id: "marker",
      items: [{ id: "unseen", label: "Complete since you last looked — open it to read the Gap" }],
    },
    {
      id: "empty",
      heading: "You are not in an assessment yet",
      body: "An instance starts when you pick a template and invite someone, or when someone invites you. Either way it turns up here afterwards, without needing the invitation link again.",
      cta: { label: "Start an assessment", href: "/assessment" },
    },
    {
      /**
       * The three filters the console Overview's cards link with (Console 2/5).
       *
       * `?filter=<id>` holds the same three ids a card counts — `awaiting-other`,
       * `yours-to-answer`, `reports-open` — and `lib/flow/overview.ts` owns the predicate, so this
       * band only supplies the words. `showing` is the line above the list; `show-all` is the way
       * back to the unfiltered list; `empty` is what a filter that keeps no rows says, which is a
       * different sentence from "you are not in an assessment yet" — the reader has relationships,
       * none of them in this state.
       */
      id: "filter",
      items: [
        { id: "showing", label: "Showing one list only" },
        { id: "awaiting-other", label: "Waiting on the other party" },
        { id: "yours-to-answer", label: "Needs your answers" },
        { id: "reports-open", label: "Reports open" },
        { id: "empty", label: "No relationship is in this list right now." },
        { id: "show-all", label: "Show every relationship" },
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
