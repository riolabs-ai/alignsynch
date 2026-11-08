/**
 * `/admin/instances/[id]/report` — one relationship's Gap report, as an operator sees it (#504).
 *
 * The words are the operator's, and the shape of the fixture is the shape of the screen:
 *
 *   facts         what the report is, and which row it was derived from
 *   status        the four derived states, with the one sentence each needs
 *   verdict       aligned / not aligned, and the widest unmet Gap
 *   aspects       one heading per Aspect, both parties' answers and the eight kinds
 *   notComputable **Doubt**, stated as a gap step this build cannot answer, with the reason
 *   export        the two buttons, in the report card's own footer — no second toolbar
 *   regenerate    the reason field, the button and the one line that proves the digest
 *   submission    the PII read: which seat, the button, and the banner saying it was recorded
 *   refusals      one sentence per refusal code, so a refusal is a sentence and never the
 *                 server's diagnostic text
 *   unreadable    the database did not answer
 *
 * **The Doubt reason is the report's, not the fixture's.** The sentence a reader is owed lives in
 * `lib/report/document.ts::NOT_COMPUTABLE` — the same sentence the exported JSON and the PDF carry
 * — so the screen renders the document's own words instead of a second copy that could drift from
 * the file. The fixture carries only the *heading* and the "not computable" handle.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminReportPageCopy: PageCopy = zPageCopy.parse({
  heading: "Report operations",
  subtitle:
    "The Gap report for one relationship. Read it, export it as JSON or PDF, reissue it with a reason, or open one seat's raw answers — which is recorded in the audit log before you see them.",
  sections: [
    {
      id: "facts",
      heading: "This report",
      body: "Every number below is derived from the two parties' answers on every Aspect: a Gap is the difference of two scores, and nothing here is a stored value. The instant and the template version it names are the fixture clock and this build's version, never a wall clock.",
      items: [
        { id: "instance", label: "Instance" },
        { id: "template", label: "Template" },
        { id: "mode", label: "Mode" },
        { id: "setting", label: "Setting" },
        { id: "status", label: "Status" },
        { id: "aspects", label: "Aspects" },
        { id: "gaps", label: "Gaps measured" },
        { id: "version", label: "Template version {version}" },
        { id: "back", label: "Back to the relationship" },
      ],
    },
    {
      id: "status",
      items: [
        { id: "awaiting-counterparty", label: "Awaiting counterparty" },
        { id: "answering", label: "Answering" },
        { id: "awaiting-payment", label: "Awaiting payment" },
        { id: "complete", label: "Complete" },
        { id: "voided", label: "Voided" },
      ],
    },
    {
      id: "verdict",
      heading: "Verdict",
      body: "The Setting is the lens: Soft tolerates a Small Gap of 1, Full tolerates none. The verdict is the Setting compared with every Gap the report actually has.",
      items: [
        { id: "aligned", label: "Aligned under the {setting} Setting — all {gaps} Gaps meet it." },
        {
          id: "unmet",
          label:
            "Not aligned under the {setting} Setting — {unmet} of {gaps} Gaps exceed its limit of {limit}.",
        },
        { id: "widest", label: "The widest is a Gap of {gap} — {kind} on “{prompt}”." },
      ],
    },
    {
      id: "aspects",
      heading: "Aspects",
      body: "One row per Aspect, with both parties' answers beside the Gaps they make. The scale runs 1 to 5 between the two Values the Aspect names.",
      items: [
        { id: "aspect", label: "Aspect {index}" },
        { id: "scale", label: "1 = {left}, 5 = {right}" },
        { id: "initiator", label: "Initiator" },
        { id: "counterparty", label: "Counterparty" },
        { id: "answers", label: "feel {feel}, wish {wish}" },
        { id: "answers-advanced", label: "feel {feel}, wish {wish}, think {think}, guess {guess}" },
        { id: "gaps", label: "Gaps" },
      ],
    },
    {
      id: "not-computable",
      heading: "Not computable",
      body: "The specification's third gap step is stated here rather than printed as a number. A report that silently omitted it would read as though the eight kinds above were the whole of the analysis.",
      items: [{ id: "doubt", label: "Doubt Gap — not computable" }],
    },
    {
      id: "export",
      heading: "Export",
      body: "The JSON is the document this screen was drawn from, and it carries the record itself, so it can be read back into the model. The PDF is the same report laid out for a reader. Both are a read of both parties' answers, so both are recorded in the audit log.",
      items: [
        { id: "json", label: "Download JSON" },
        { id: "pdf", label: "Download PDF" },
        { id: "note", label: "Each download writes one read_submission entry to the audit log." },
        { id: "not-ready", label: "There is no report to export until the session is complete." },
      ],
    },
    {
      id: "regenerate",
      heading: "Reissue the report",
      body: "Rebuilds the report from the answers as they stand. Regenerating the same complete session twice produces the same bytes — the answers are frozen at completion — and the audit row carries the digest of both, so the log itself shows the two are identical.",
      items: [
        { id: "button", label: "Regenerate" },
        { id: "submitting", label: "Regenerating…" },
        { id: "done", label: "Regenerated. The audit row carries the digest {sha}." },
        { id: "unchanged", label: "The digest is the one the previous regeneration recorded." },
      ],
    },
    {
      id: "submission",
      heading: "Read a party's submission",
      body: "One seat's raw answers, one Aspect at a time. This is the PII read the epic gates: support and above may open it, and the read is written to the audit log in the same transaction that reads the rows — so a read nobody can see is not a state this screen can reach.",
      items: [
        { id: "initiator", label: "Open the Initiator's answers" },
        { id: "counterparty", label: "Open the Counterparty's answers" },
        { id: "reading", label: "Reading…" },
        {
          id: "banner",
          label:
            "This read was recorded in the audit log at {at}, entry {action}. Opening a seat again writes another entry.",
        },
        { id: "audit-link", label: "Open the audit log" },
        { id: "seat", label: "{role}: {name}" },
        { id: "submitted", label: "Submitted {at}" },
        { id: "not-submitted", label: "Not submitted yet" },
        { id: "accepted", label: "Accepted {at}" },
        { id: "no-answers", label: "This seat has answered no Aspect yet." },
      ],
    },
    {
      id: "refusals",
      items: [
        { id: "no-such-instance", label: "No session has that id any more." },
        {
          id: "not-complete",
          label:
            "This session is not complete, so it has no report — both seats must answer every Aspect and accept.",
        },
        { id: "voided", label: "This session was voided; its report is not reissued." },
        {
          id: "template-missing",
          label:
            "The template this instance copies no longer resolves, so there is no title to report under.",
        },
        { id: "no-such-party", label: "That seat is not on this relationship." },
        { id: "role-too-low", label: "Reissuing a report needs a higher role than yours." },
        { id: "signed-out", label: "The sign-in expired while this form was open." },
        { id: "failed", label: "The operation did not commit. Nothing was changed." },
      ],
    },
    {
      id: "unreadable",
      heading: "This report could not be read",
      body: "The console reads the row from the database on every visit, and this visit did not get an answer. Nothing here came from a cache.",
      items: [{ id: "back", label: "Back to the relationship" }],
    },
  ],
});
