/**
 * `/admin/audit` — every audited write, newest first (#503, epic #500).
 *
 * The screen is the second half of the `act()` contract: the first half is that a mutation and its
 * audit row commit together (`lib/admin/act.ts`), and this is the half a person reads. So the
 * fixture is the reader's question in order — when, who, what, to which row, why, and what
 * changed — and the two sides of the change are the only columns that need explaining:
 *
 *   before / after   the row as it was and as it is, as JSON. `none` is the absence on one side,
 *                    which is a real answer for a create (`before` is NULL) or a delete
 *                    (`after` is NULL) and is drawn as a dash rather than as `{}` — an empty
 *                    object would claim a row existed and was empty.
 *
 * **Why the two sides are printed as JSON and not as a rich diff.** Every action keeps its own
 * bounded shape (`lib/admin/relationship-ops.ts` writes instants, roles and counts — never a token
 * or an opinion), and a screen that rendered each one richly would be a second model of every
 * action, drifting from the writer the first time an action gained a field. A log's job is to show
 * what was recorded without reinterpreting it.
 *
 * **`empty` is a fact, not a failure.** A database with no audited writes says so; it is not an
 * error panel and not a spinner, because a fresh install legitimately has nothing to show.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminAuditPageCopy: PageCopy = zPageCopy.parse({
  heading: "Audit log",
  subtitle:
    "Every write an operator has made through the console, newest first. Each row was committed in the same transaction as the change it describes: a repair that failed is not here, and a row here always happened.",
  sections: [
    {
      id: "list",
      heading: "What has been done",
      body: "The log is append-only — nothing in this application updates or deletes a row of it. `Before` and `After` are the values the writer recorded inside the transaction, so they cannot go stale the way a later read of the same row would.",
    },
    {
      /** The column labels, in the order the table draws them. */
      id: "columns",
      items: [
        { id: "when", label: "When" },
        { id: "actor", label: "Operator" },
        { id: "action", label: "Action" },
        { id: "target", label: "Target" },
        { id: "reason", label: "Reason" },
        { id: "before", label: "Before" },
        { id: "after", label: "After" },
      ],
    },
    {
      /**
       * The absence on one side of a change. A dash, never `{}` and never `null` spelled out: one
       * says there was no row here, and the other two are JSON values a reader would take for one.
       */
      id: "side",
      items: [{ id: "none", label: "—" }],
    },
    {
      /** An account with no profile row: the id is the actor, and the screen says so plainly. */
      id: "actor",
      items: [{ id: "unknown", label: "No profile row" }],
    },
    {
      id: "empty",
      heading: "Nothing has been audited yet",
      body: "No operator has written through this console on this database. The first repair, role change or invitation appears here the moment it commits — there is no separate step that files it.",
    },
    {
      id: "unreadable",
      heading: "The log could not be read",
      body: "This screen reads the audit table on every visit, and this visit did not get an answer. Nothing here came from a cache, and no entry was guessed.",
      items: [{ id: "reload", label: "Try the log again" }],
    },
  ],
});
