/**
 * `/dashboard` — **Start**, the signed-in landing of the v2 shell (#1129, bundle 05).
 *
 * The page that says what to do next. Every word is here because the ratchet (E23) counts what a
 * component writes: the two jobs' titles, the chip words, the dashed line a card carries before
 * anybody has answered, the two section links and the failure band are all fixture strings, so a
 * rename is one edit and `components/dashboard/start-page.tsx` stays at zero literals.
 *
 * **`{placeholders}` are the view's.** `fillLabel` fills `{name}`, `{title}`, `{prompt}`,
 * `{count}` and `{aligned}`/`{total}` from the rows the page read. A fixture that spells a person's
 * name would be a second source of truth for session data, which is why `heading` carries
 * `{name}` rather than the bundle's «Marcus».
 *
 * **The header subtitle has two words because there are two states.** The bundle's line —
 * `subtitle` — describes exactly what its demo data holds: one conversation and two small jobs. It
 * is drawn verbatim when that is true, and `subtitle-quiet` is drawn otherwise, because a landing
 * page that counts jobs it does not have is the kind of copy nobody can check. Both are strings an
 * editor edits; neither is composed in the component.
 *
 * **The chip words are the owner's four, and nothing else.** `Stage 6 Live` · `Waiting on Invite` ·
 * `Draft` · `Paused`, mapped from the seven lifecycle values in `lib/member/start.ts`. `Paused`
 * keeps the summary bar with the words `Aligned · Read-Only` (locked rule from bundle 03), and a
 * relationship with no results yet draws `Results appear once you both answer.` rather than a zero.
 *
 * The two section links are the bundle's words, not the issue's paraphrase: `View All` beside the
 * relationships and `Open Library` beside the templates — those are the two labels the approved
 * artifact prints, and a section link that said the same thing twice would hide which shelf it
 * opens.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const startPageCopy: PageCopy = zPageCopy.parse({
  heading: "Welcome Back, {name}",
  subtitle: "One thing to talk about, and two small jobs.",
  sections: [
    {
      id: "welcome",
      items: [
        /** Drawn when the sentence above would be false — no jobs, or one. */
        { id: "subtitle-quiet", label: "Your relationships, and what is next for each." },
        { id: "create", label: "Create Relationship" },
      ],
    },
    {
      id: "next-steps",
      heading: "Your Next Steps",
      body: "The one conversation to have first, then the small jobs that keep a relationship moving.",
      items: [
        { id: "count", label: "{count} to do" },
        { id: "next-step-title", label: "Next Step · {prompt}" },
        { id: "next-step-body", label: "{title} · widest Gap" },
        { id: "open-align", label: "Open Align" },
        { id: "add-card-title", label: "Add a Card to Resume" },
        { id: "add-card-body", label: "{title} · Stage 6 is paused" },
        { id: "add-card", label: "Add a Card" },
        { id: "draft-title", label: "Finish and Send the Invite" },
        { id: "draft-body", label: "{title} · Draft" },
        { id: "continue-setup", label: "Continue Setup" },
      ],
      cta: { label: "Create Relationship", href: "/dashboard/relationships" },
    },
    {
      id: "next-steps-empty",
      heading: "Nothing Is Waiting On You",
      body: "Every relationship you are in is up to date. Start another one, or open My Relationships to see where each stands.",
    },
    {
      id: "active",
      heading: "Active Relationships",
      cta: { label: "View All", href: "/dashboard/relationships" },
      items: [
        {
          id: "empty",
          label: "No relationship is in play yet. A template is where one starts.",
        },
      ],
    },
    {
      id: "templates",
      heading: "Browse Templates",
      cta: { label: "Open Library", href: "/dashboard/templates" },
    },
    {
      /**
       * The card's own words — shared with My Relationships, which renders the same card. Both
       * fixtures carry these ids because E23 attributes a component to every route that mounts it.
       */
      id: "card",
      items: [
        { id: "live", label: "Stage 6 Live" },
        { id: "waiting", label: "Waiting on Invite" },
        { id: "draft", label: "Draft" },
        { id: "paused", label: "Paused" },
        { id: "with", label: "With {name}" },
        { id: "aligned", label: "{aligned} of {total} Aspects Aligned" },
        { id: "read-only", label: "Aligned · Read-Only" },
        { id: "aspects", label: "{count} Aspects" },
        { id: "no-results", label: "Results appear once you both answer." },
        { id: "next", label: "Next Step: {prompt}" },
        { id: "open", label: "Open" },
        { id: "continue", label: "Continue Setup" },
        { id: "add-card-action", label: "Add a Card" },
        { id: "waiting-next", label: "Invite sent. Waiting on {name} to join." },
        { id: "draft-next", label: "Not sent yet." },
        { id: "paused-next", label: "Stage 6 is paused. Nothing is lost." },
        { id: "legend-synch", label: "{count} In Synch" },
        { id: "legend-small", label: "{count} Small Gap" },
        { id: "legend-gap", label: "{count} Gap" },
      ],
    },
    {
      id: "unreadable",
      heading: "Your start page could not be read",
      body: "These are your own relationships, and this visit did not get an answer. Nothing here came from a cache, and nothing was guessed or reused.",
      items: [{ id: "reload", label: "Try Again" }],
    },
  ],
});
