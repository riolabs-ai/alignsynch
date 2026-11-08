/**
 * `/admin/review` — the console's review shelf (#665).
 *
 * The words of one screen with three panes, and the sentences that keep it honest:
 *
 *   list      the row's four facts in one line — kind, to-dos done, feedback open and closed —
 *             because a reviewer decides what to open from that line, not from a title.
 *   release   what "active" and "archived" mean. A release is active while it is the newest the
 *             changelog records; the whole group carries that state, so the rows in it never
 *             disagree with the heading above them.
 *   preview   what the frame is: a sandboxed document served from the manifest's own entry, so
 *             scripts run inside it and it cannot reach the page around it.
 *   todos     the checklist, and the sentence that says a tick is not yet possible.
 *   feedback  the issue list, in the shape a GitHub issue list has — `#N`, state, labels, author.
 *   issue     one thread: the report, the replies, and the two controls that need a store.
 *   unreadable  the catalogue could not be read. Never a cached list and never a partial one.
 *
 * `{placeholders}` are filled by the view with numbers and labels it computed
 * (`lib/page-copy.ts::fillLabel`); no sentence here bakes in a count.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminReviewPageCopy: PageCopy = zPageCopy.parse({
  heading: "Review artifacts",
  subtitle:
    "Every prototype, diagram and report the team has published for review, grouped by the release it belongs to. Open one to read the file beside its to-dos and its feedback.",
  sections: [
    {
      id: "list",
      heading: "By release",
      body: "A release is active while it is the newest the changelog records, and archived once a later one ships. The group carries that state as a whole, so the rows inside it read as one.",
      items: [
        {
          id: "empty",
          label: "No artifacts yet. A release gets a group when its first artifact is published.",
        },
        {
          id: "row-meta",
          label: "{kind} · TODO {done} / {total} done · {open} open · {closed} closed",
        },
        { id: "row-published", label: "published {date}" },
        { id: "open", label: "Review" },
        { id: "status-active", label: "active" },
        { id: "status-archived", label: "archived" },
        { id: "group-count", label: "{count} artifacts" },
        { id: "group-count-one", label: "{count} artifact" },
      ],
    },
    {
      id: "preview",
      heading: "The file",
      items: [
        { id: "empty", label: "Choose an artifact on the left to read it here." },
        { id: "frame-title", label: "The artifact: {title} {version}" },
        { id: "open-file", label: "Open the file" },
        {
          id: "served",
          label:
            "Served from the manifest's own entry, as a sandboxed document: its scripts run and the page around it cannot be reached.",
        },
      ],
    },
    {
      id: "artifact",
      heading: "This artifact",
      items: [
        { id: "kind", label: "Kind" },
        { id: "version", label: "Version" },
        { id: "release", label: "Release" },
        { id: "published", label: "Published" },
        { id: "file", label: "File" },
        { id: "sandbox", label: "Sandbox" },
        { id: "id", label: "Manifest id" },
        { id: "look-for", label: "What to look for" },
        { id: "sandbox-value", label: "allow-scripts, no same-origin" },
        { id: "kind-prototype", label: "prototype" },
        { id: "kind-diagram", label: "diagram" },
        { id: "kind-report", label: "report" },
      ],
    },
    {
      id: "todos",
      heading: "To-dos",
      items: [
        { id: "progress", label: "{done} / {total} done" },
        { id: "empty", label: "No to-dos on this artifact yet." },
        { id: "opened-by", label: "opened by {author} on {date}" },
        { id: "done-by", label: "ticked by {actor} on {date}" },
        { id: "state-done", label: "Done" },
        { id: "state-open", label: "Open" },
        {
          id: "read-only",
          label:
            "Ticking a to-do is the store's own write; this cut draws the state, and the control that calls it is the follow-up.",
        },
      ],
    },
    {
      id: "feedback",
      heading: "Feedback",
      items: [
        { id: "summary", label: "{open} open · {closed} closed" },
        { id: "empty", label: "No feedback on this artifact yet." },
        { id: "state-open", label: "open" },
        { id: "state-closed", label: "closed" },
        { id: "opened-by", label: "opened by {author} on {date}" },
        { id: "number", label: "#{number}" },
      ],
    },
    {
      id: "issue",
      heading: "One issue",
      items: [
        { id: "back", label: "All feedback" },
        { id: "body-heading", label: "The report" },
        { id: "thread-heading", label: "Replies" },
        { id: "no-replies", label: "No replies on this issue yet." },
        { id: "reply-label", label: "Write a reply" },
        { id: "comment", label: "Comment" },
        { id: "close", label: "Close issue" },
        {
          id: "closed-note",
          label: "This issue is closed — reopening it lands with the review store.",
        },
        {
          id: "read-only",
          label:
            "Replying and closing are the store's own actions; this cut draws the thread and writes nothing.",
        },
      ],
    },
    {
      id: "unreadable",
      heading: "The review catalogue could not be read",
      body: "This screen reads the manifest and the files it names on every visit, and this visit did not get either. Nothing here is a cached list and no artifact is drawn from memory. Reading the page again is the only way back.",
    },
  ],
});
