/**
 * `/admin/audit` — the audit log, for an operator (#501b, completing #501).
 *
 * The words are the *log's* vocabulary rather than a product's: a row says when, who, what action,
 * which target, why, and what changed. Three of those are deliberately narrow:
 *
 *   - **a value is truncated until it is opened.** `changes` carries the disclosure's own words and
 *     nothing else; `lib/admin/audit-log.ts::auditChangeOf()` is what cuts a `before`/`after` value
 *     down to a key and 48 characters, so a party's name cannot appear in a screenshot of this
 *     table — the screen does not have the sentence to print.
 *   - **an empty log is not an empty filter.** `empty-all` is "nothing has ever been written here"
 *     and `empty` is "nothing matches this URL"; the first is a fact about the database and the
 *     second is a fact about the filter, and a single band would tell an operator to widen a filter
 *     on a log with no rows to widen.
 *   - **the empty log states its instant, and the instant is the tree's clock.** `as-of` is filled
 *     with `DEMO_NOW_ISO` (rendered by `formatDateTimeLong`) rather than `new Date()`: a wall-clock
 *     read is rendered once on the server and again at hydration, which is the `#418` mismatch
 *     `AGENTS.md` forbids, and an audit screen is exactly where a label nobody can reproduce would
 *     be worse than a fixed one. The instant is only ever drawn when the log holds no row at all,
 *     so the sentence is true whenever it appears.
 *
 * `summary` is a placeholder sentence filled by `fillLabel` with the count the view produced, so
 * "3 rows" is never authored here. `filters` carries both the form's labels and the chip
 * templates: an applied axis is drawn as its own removable chip, which is how a filtered view is
 * read at a glance instead of inferred from what a select happens to show.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminAuditPageCopy: PageCopy = zPageCopy.parse({
  heading: "Audit log",
  subtitle:
    "Every audited admin write, in the order it landed: who did it, the rung they held at that moment, what it touched and why. This screen reads the log and nothing else — there is no action on this page that writes one.",
  sections: [
    {
      id: "list",
      heading: "The log",
      body: "Newest first, at most the newest two hundred rows of this view. The filters run in the database and live in the URL, so a view can be pasted into an incident instead of described from memory.",
      items: [
        {
          id: "scroll-hint",
          label: "Scroll sideways for the action, target, reason and change.",
        },
      ],
    },
    {
      /** The column labels, in the order the table draws them. */
      id: "columns",
      items: [
        { id: "when", label: "When" },
        { id: "actor", label: "Actor" },
        { id: "action", label: "Action" },
        { id: "target", label: "Target" },
        { id: "reason", label: "Reason" },
        { id: "changes", label: "Before and after" },
      ],
    },
    {
      /** The four axes, their options, and the chip templates an applied axis renders as. */
      id: "filters",
      items: [
        { id: "actor-label", label: "Actor" },
        {
          id: "actor-placeholder",
          label: "An address or a user id",
          body: "Matched exactly. Paste the address from a row, or the id when the account has none.",
        },
        { id: "action-label", label: "Action" },
        { id: "action-all", label: "Every action" },
        { id: "table-label", label: "Target table" },
        { id: "table-all", label: "Every table" },
        { id: "from-label", label: "From" },
        { id: "to-label", label: "To" },
        { id: "apply", label: "Apply" },
        { id: "clear", label: "Clear all" },
        { id: "chip-actor", label: "Actor: {value}" },
        { id: "chip-action", label: "Action: {value}" },
        { id: "chip-table", label: "Table: {value}" },
        { id: "chip-from", label: "From {value}" },
        { id: "chip-to", label: "To {value}" },
        { id: "chip-remove", label: "Remove this filter" },
      ],
    },
    {
      id: "summary",
      items: [
        { id: "count", label: "{shown} rows in this view" },
        /** One row is a row, not "1 rows" — the view picks the sentence by the count. */
        { id: "count-one", label: "{shown} row in this view" },
        {
          id: "capped",
          label:
            "{shown} rows — the newest this view holds. Narrow a filter to reach further back.",
        },
      ],
    },
    {
      id: "empty",
      heading: "Nothing matches this view",
      body: "No audited write matches the filter this URL carries. That is a fact about the filter, not about the log — widen an axis to see the rest.",
      items: [{ id: "clear", label: "Clear the filters" }],
    },
    {
      id: "empty-all",
      heading: "No admin action is recorded",
      body: "The log fills in the same transaction as the write it describes, so an empty log means nothing has been written through the audit path yet — not that this screen failed to read one.",
      items: [{ id: "as-of", label: "The log is empty as of {at}." }],
    },
    {
      id: "unreadable",
      heading: "The log could not be read",
      body: "This table is a database read on every visit, and this visit did not get an answer. Nothing here came from a cache, and no row was guessed or reused.",
      items: [{ id: "reload", label: "Try the log again" }],
    },
    {
      /** The disclosure: one key and its truncation, and the full value only after a click. */
      id: "changes",
      items: [
        { id: "before", label: "Before" },
        { id: "after", label: "After" },
        { id: "none", label: "Nothing was here" },
        { id: "key", label: "Key" },
        { id: "recorded", label: "Recorded" },
      ],
    },
    {
      /** What an actor column says when either half is missing, and it says which half. */
      id: "actor",
      items: [
        { id: "role-not-recorded", label: "Role not recorded" },
        { id: "role-label", label: "Role at the time" },
        { id: "account-gone", label: "No address on this database" },
      ],
    },
    {
      /**
       * The reason column when nobody stated one.
       *
       * `reason` is nullable by design since `0038` (#732): the owner removed every required
       * Reason field because *"a sentence typed to satisfy a constraint is not provenance, it is
       * a tax on the operator"*. So `NULL` means exactly one thing — nobody stated one — and the
       * column says so in words instead of rendering a blank cell, which reading as "we lost it"
       * is the defect this row exists to prevent.
       */
      id: "reason",
      items: [{ id: "not-stated", label: "No reason stated" }],
    },
  ],
});
