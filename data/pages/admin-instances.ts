/**
 * `/admin/instances` — every relationship in the system, for an operator (console-ia §3.5,
 * card 3/5).
 *
 * The words here are the *operator's* vocabulary, and the page is written so the fixture can be
 * read as the answer to "what can this screen say?". Two of those answers are deliberately
 * narrow:
 *
 *   - **A seat is described by its state, not by a person.** `seat` says a party row exists with
 *     no account (the seeded dataset), `invited` and `expired` say the Counterparty has no seat
 *     yet, and only `claimed`/`seat` draw a name — the one the *seat* carries. The invitation's
 *     own name and address are not copy this fixture can print, because the read never selects
 *     them.
 *   - **A stage is a name, never a distance.** `stages` carries the ladder's four words exactly as
 *     `content/stages.ts` authors them; the screen may say an instance is `aligned`, and it may
 *     not say by how much. That is the blind rule in an operator's hands, and `gap-analysis`
 *     (4/5) is where measures get an argument of their own.
 *
 * `summary` is a placeholder sentence, filled by `fillLabel` with the two counts the filter
 * produced — so "3 of 6" is computed from the rows on screen, never authored here.
 *
 * `empty` and `empty-all` are different facts: one is "nothing matches these filters", the other
 * is "there are no relationships in this database yet". A single empty state would tell an
 * operator to change the filters on a database that has no rows to filter.
 *
 * `unreadable` is the failure panel, for the same reason `assessment-instances.ts` has one: this
 * list is a database read on every visit, and a database that does not answer is a state the
 * screen can describe instead of Next's 500 with a digest.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminInstancesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Relationships",
  subtitle:
    "Every relationship in this database, across accounts — who is stuck, which template is being used, and where an invitation died. This screen reads; it does not act on anybody's relationship.",
  sections: [
    {
      id: "list",
      heading: "The registry",
      body: "Newest first. A seat, a mode, a Setting and a derived stage; no opinions, no scores and no count of what either party answered. An operator may see that a seat was answered, and where the relationship stands, and nothing a party wrote.",
    },
    {
      /**
       * The column labels, in the order the table draws them. `initiator` and `counterparty` are
       * the seats — their state and, when the seat carries one, its name.
       */
      id: "columns",
      items: [
        { id: "id", label: "Id" },
        { id: "template", label: "Template" },
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "mode", label: "Mode" },
        { id: "setting", label: "Setting" },
        { id: "stage", label: "Stage" },
        { id: "created", label: "Created" },
        { id: "last-activity", label: "Last activity" },
      ],
    },
    {
      /** What the two seat columns can say. The state words are the read's own vocabulary. */
      id: "seat",
      items: [
        { id: "claimed", label: "Claimed" },
        { id: "seat", label: "Seat, no account" },
        { id: "invited", label: "Invited" },
        { id: "expired", label: "Expired" },
        { id: "none", label: "No seat" },
        { id: "unnamed", label: "Unnamed" },
      ],
    },
    {
      /**
       * The stage tabs. `all` first, then the ladder in `content/stages.ts`'s order — the same
       * four words, so a filter cannot offer a stage the model does not have.
       */
      id: "stage-filter",
      items: [
        { id: "all", label: "All stages" },
        { id: "invited", label: "Invited" },
        { id: "connected", label: "Connected" },
        { id: "sharing", label: "Sharing" },
        { id: "aligned", label: "Aligned" },
      ],
    },
    {
      /** The two selects and the one toggle. Each earns its place by changing the row set. */
      id: "filters",
      items: [
        { id: "mode-all", label: "All modes" },
        { id: "setting-all", label: "All settings" },
        { id: "stalled", label: "Stalled only" },
        { id: "stalled-body", label: "Invited, and past its expiry" },
      ],
    },
    {
      id: "summary",
      items: [{ id: "count", label: "{shown} of {total} relationships" }],
    },
    {
      id: "empty",
      heading: "Nothing matches these filters",
      body: "Every relationship is still in the registry; this combination of stage, mode, Setting and the stalled toggle selects none of them. Widen a filter to see the rest.",
      items: [{ id: "clear", label: "Clear the filters" }],
    },
    {
      id: "empty-all",
      heading: "No relationships yet",
      body: "This database holds no instances at all, so there is nothing an operator can triage. A relationship appears here the moment somebody starts one from a template.",
    },
    {
      id: "unreadable",
      heading: "The registry could not be read",
      body: "This list is read from the database on every visit, and this visit did not get an answer. Nothing here came from a cache, and no opinion was shown, guessed or reused.",
      items: [{ id: "reload", label: "Try the registry again" }],
    },
  ],
});
