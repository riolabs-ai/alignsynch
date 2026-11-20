/**
 * `/admin/permissions` — the CRUD & Permissions reference screen's words (#1126).
 *
 * **What belongs here.** The sentences the matrix source cannot say about itself: the page's own
 * heading and subtitle, the role × action rules the page states in its header, the eleven P0 gaps
 * that are this release's spec backbone, the column names, the status vocabulary, and the one
 * honest panel a source that cannot be read is drawn as.
 *
 * **What does not.** Every cell, and every header figure. Rows come from
 * `docs/specs/v2-prototype/crud-matrix.md` and nowhere else — copying the 169 rows into a fixture
 * would be a second source of truth for the matrix, which is the thing #1126 exists to stop. The
 * counts are `lib/admin/crud-matrix.ts::countsOf`'s, recomputed per request; no number is typed
 * here, which is why the acceptance line "header counts match the source file" is checkable.
 *
 * **The 11 P0 items and the six rules are the issue's own text.** #1126 §3 enumerates the gaps and
 * §4 states the rules, so they live here as the owner wrote them — a card that later disagrees with
 * one of them changes #1119, never this fixture. Their titles are the issue's bolded titles, and a
 * `{placeholder}` is filled by the view (`lib/page-copy.ts::fillLabel`).
 *
 * `data/pages/index.ts` keys this export by `/admin/permissions`; E23 measures the page module's
 * import closure against it at budget 0.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminPermissionsPageCopy: PageCopy = zPageCopy.parse({
  heading: "CRUD & Permissions",
  subtitle:
    "The spec reference for every v2 card that adds a create, edit, archive or leave action: what each object and action is worth to each role, what the prototype draws for it, and what upstream already answers. Read-only — this page states the matrix, it never edits it.",
  items: [
    { id: "read-only", label: "Read-only" },
    { id: "triage-link", label: "Open the Triage Page" },
    { id: "epic-link", label: "Epic #1119" },
    // The four filters' headings and the two words that let a reader out of a filter.
    { id: "filter-object", label: "Object" },
    { id: "filter-role", label: "Role" },
    // The reference names this facet **Status** — the prototype column's own word is the heading on
    // the table, and the filter above it asks the same question the artifact asks: "Status".
    { id: "filter-prototype", label: "Status" },
    { id: "filter-upstream", label: "Upstream" },
    { id: "filter-priority", label: "Priority" },
    { id: "filter-all", label: "All" },
    { id: "filter-clear", label: "Clear Filters" },
    // The matrix's own count line, in the artifact's words: the whole matrix prints its size bare,
    // a narrowed one says what it is showing — "169 Rows" / "Showing 18 of 169 Rows".
    { id: "rows", label: "{cells} Rows" },
    { id: "showing", label: "Showing {count} of {cells} Rows" },
    {
      id: "matches-nothing",
      label: "No rows match these filters. Clearing them shows all {cells} rows.",
    },
    // The prototype's vocabulary, as the page prints it.
    { id: "status-covered", label: "Covered" },
    { id: "status-hinted", label: "Hinted" },
    { id: "status-missing", label: "Missing" },
    { id: "status-not-applicable", label: "N/A" },
    // What upstream answers.
    { id: "upstream-exists", label: "Exists" },
    { id: "upstream-not-found", label: "Not Found" },
    { id: "upstream-conflict", label: "Conflict" },
    // The priorities, including the dash the matrix uses for "not scheduled".
    { id: "priority-p0", label: "P0" },
    { id: "priority-p1", label: "P1" },
    { id: "priority-p2", label: "P2" },
    { id: "priority-wont", label: "Won't" },
    { id: "priority-none", label: "—" },
    // The table's columns, in the order the source's header names them.
    { id: "col-object", label: "Object" },
    { id: "col-action", label: "Action" },
    { id: "col-role", label: "Role" },
    { id: "col-prototype", label: "Prototype" },
    { id: "col-selector", label: "Selector" },
    { id: "col-upstream", label: "Upstream" },
    { id: "col-mvp", label: "MVP" },
    { id: "col-rationale", label: "Rationale" },
    { id: "col-priority", label: "Priority" },
  ],
  sections: [
    {
      id: "rules",
      heading: "Rules Every #1119 Child Must Honour",
      body: "Every card that adds a write states these, and the matrix is the evidence behind them. They are #1119's decisions, not this page's.",
      items: [
        {
          id: "rule-counterparty-price",
          label: "The Counterparty never sees a price, the word trial, a card or an extension.",
        },
        {
          id: "rule-propose-change",
          label:
            "Once Stage 6 is live, Aspect changes are proposed and agreed by both parties. Nothing changes under a party until both agree, and any answers that would be discarded are named first.",
        },
        {
          id: "rule-archive-over-delete",
          label:
            "Archive over delete: templates archive or restore; permanent delete only when unused and unpublished; relationships close or are abandoned, never deleted.",
        },
        {
          id: "rule-locked-scale",
          label: "The 1–5 answer scale is locked: never a field, never editable.",
        },
        {
          id: "rule-no-silent-edit",
          label:
            "No silent edits. The Initiator or staff rewrite-with-confirm in lib/relationship/edit.ts is the conflict to replace, not to port. session.mode and session.alignment_setting stay immutable once the session exists (V18).",
        },
        {
          id: "rule-destructive-graphite",
          label: "Destructive actions are graphite with an × icon, never red.",
        },
      ],
    },
    {
      id: "gaps",
      heading: "P0 Gaps",
      body: "The eleven items the matrix ranks P0 — the backbone of this release, each one a child of the epic or a card of its own.",
      items: [
        {
          id: "p0-aspect-drawer",
          label: "Aspect drawer",
          body: "Wizard Stage 3's pencil and Add an Aspect, and My Template Edit: title, prompt, left pole, right pole. The 1–5 cells are locked and are not fields, and at least one Aspect is kept.",
        },
        {
          id: "p0-card-kebab",
          label: "Card kebab",
          body: "My Templates: Edit · Duplicate · Archive, with Delete only in the editor and only when unused. Library cards: Create Relationship · Save a Copy.",
        },
        {
          id: "p0-save-to-my-templates",
          label: "Save to My Templates actually copies",
          body: "Through the existing clonePublic action, on /dashboard/templates.",
        },
        {
          id: "p0-counterparty-fork",
          label: "Counterparty fork on a live relationship",
          body: "Save these Aspects as a My Template (#785, data-fork-template). The Initiator does not see it.",
        },
        {
          id: "p0-draft-stays-editable",
          label: "Draft and invited stay editable",
          body: "After Save and Exit, Stages 1–3 reopen, or Relationship Detail carries an Edit panel.",
        },
        {
          id: "p0-propose-a-change",
          label: "Live Aspect changes are proposed, not silent",
          body: "Propose a Change on the Aspects tab for both roles, with accept and decline. Do not port the silent Initiator write in lib/relationship/edit.ts.",
        },
        {
          id: "p0-assessment-taking",
          label: "Assessment-taking UI on the locked 1–5 scale",
          body: "Answers stay private until both parties finish; the answer route exists upstream already.",
        },
        {
          id: "p0-invitation-hygiene",
          label: "Invitation hygiene",
          body: "Copy Invite Link, Resend, Cancel Invite (graphite × plus a confirm), and Decline (one click, optional reason).",
        },
        {
          id: "p0-leave-not-delete",
          label: "Leave / close, not delete",
          body: "Remove Counterparty, Leave Relationship / Request My Removal, Abandon a draft (upstream void). There is no Delete Relationship.",
        },
        {
          id: "p0-account-menu",
          label: "Account menu on the header avatar",
          body: "Account Settings and Sign Out (port /settings; account deletion is P1).",
        },
        {
          id: "p0-billing-trial",
          label: "Billing: trial pause / extra week enforced in billing, not only in HTML",
          body: "#1121, #1115: Stage 6 pauses read-only, one free extra week, and the Counterparty never sees a price or a trial.",
        },
      ],
    },
    {
      id: "counts",
      heading: "The Matrix at a Glance",
      body: "Recomputed from the source rows on every request. No figure here is typed, so a matrix that changes changes this band.",
      items: [
        { id: "count-cells", label: "{count} cells" },
        { id: "count-applicable", label: "{count} applicable" },
        { id: "count-covered", label: "{count} covered" },
        { id: "count-hinted", label: "{count} hinted" },
        { id: "count-missing", label: "{count} missing" },
        { id: "count-p0", label: "{count} P0" },
        { id: "count-p1", label: "{count} P1" },
        { id: "count-p2", label: "{count} P2" },
        { id: "count-wont", label: "{count} won't" },
        { id: "count-conflicts", label: "{count} upstream conflicts" },
        // The artifact's summary line under the band (#rectification 12). Every figure is the
        // parser's, including the triage pass the source states about itself — and the P0-open
        // count, which is the P0 rank intersected with the prototype's hinted/missing answers.
        {
          id: "snapshot",
          label:
            "Pass {pass} snapshot · {p0} P0 · {p1} P1 · {p2} P2 · {wont} Won't · {p0Open} P0 still open (hinted or missing). Counts are computed from the source file, not hardcoded.",
        },
        {
          id: "snapshot-undated",
          label:
            "{p0} P0 · {p1} P1 · {p2} P2 · {wont} Won't · {p0Open} P0 still open (hinted or missing). Counts are computed from the source file, not hardcoded.",
        },
      ],
    },
    {
      id: "matrix",
      heading: "Every Cell",
      body: "One row per object × action × role, in the order the source file lists them. The address carries the filters, so a narrowed table is a link.",
      items: [
        {
          id: "unreadable",
          label:
            "The matrix source {path} could not be read: {reason}. The cells, the header counts and the conflicts table are all built from that one file, so none of them is drawn — an empty table would claim the matrix has no rows. An owner supplies the file; when it lands, this page renders every cell with no edit.",
        },
      ],
    },
    {
      id: "conflicts",
      heading: "Conflicts and Decisions",
      body: "The cells whose upstream answer disagrees with the prototype — the places a card has to settle a question rather than port a screen.",
      items: [
        {
          id: "no-conflicts",
          label: "No cell in the matrix records an upstream conflict.",
        },
      ],
    },
  ],
});
