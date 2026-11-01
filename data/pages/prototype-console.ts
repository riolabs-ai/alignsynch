/**
 * `/prototype` and `/prototype/admin` — the words for the console's prototype screens (#console
 * cohort 1).
 *
 * Two routes, one module, for the same reason `data/pages/legal.ts` holds both legal pages: the
 * screens are one review surface in two depths, they share one vocabulary (the four stage words, the
 * seat states, the "not yet" badge), and two fixtures would let "Aligned" and "Complete" describe
 * the same rows in two spellings. The index's copy and the overview's are separate `PageCopy`
 * instances because a `PageCopy` is one page's hero plus its bands, and this file is the one place
 * they can be read side by side.
 *
 * `prototypeBandCopy` is the third instance and it is not a page's: it is the sentence every
 * prototype screen carries, rendered once by `app/(mainlayout)/prototype/layout.tsx` so a cohort that
 * adds a screen inherits it instead of remembering to draw it. `heading` + `subtitle` is exactly the
 * shape of an alert's title and description.
 *
 * **No number is authored here.** The counts band's labels carry `{placeholders}` and the page fills
 * them from `data/prototypes/console.ts::prototypeCounts`, so "6 relationships" cannot be written
 * into a sentence and then disagree with the fixture. The one constant a sentence quotes —
 * `{days}`, the staleness threshold in the attention band — is filled from `STALE_DAYS` for the same
 * reason.
 *
 * E23 measures these files' components, not this module: every string the two screens render is a
 * label or a body here, which is what keeps the budget at 0.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

/**
 * The first screen an operator sees on the way in: one card per prototype that renders today, each
 * naming where it lives and what it is standing in for.
 *
 * The card's own words are items keyed by the screen id (`admin`), so `data/prototypes/console.ts`
 * carries `{ id, href, eventualRoute }` and this fixture carries the name and the description. That
 * split is the reason a cohort can append a screen to the record without editing a component.
 */
export const prototypeIndexPageCopy: PageCopy = zPageCopy.parse({
  heading: "Prototype screens",
  subtitle:
    "Screens drawn against fixture records so they can be reviewed before anything is wired to a database. Each card names the screen and the route it is standing in for.",
  sections: [
    {
      id: "screens",
      heading: "Under review",
      body: "One card per prototype that renders today. A screen appears here when it exists, not when it is planned, so this list is the honest answer to what can be looked at right now.",
      items: [
        {
          id: "admin",
          label: "Admin overview",
          body: "Where an operator lands before drilling into relationships or the gaps: four counts over the population, the relationships that need attention, and the screens still to come.",
        },
      ],
    },
    {
      /** The line under each card's description. The route comes from the record, never from here. */
      id: "labels",
      items: [{ id: "eventual", label: "Wired route when it lands: {route}" }],
    },
  ],
});

/**
 * `/prototype/admin` — the overview the owner reviews. Three bands, in the order an operator reads
 * them: what the population is, what is stuck, and what is not built yet.
 */
export const prototypeAdminPageCopy: PageCopy = zPageCopy.parse({
  heading: "Admin overview",
  subtitle:
    "What an operator sees before opening the relationship registry or the gap analysis. Every figure is a count of the six prototype relationships and four templates in the fixture — nothing on this screen is read from a database.",
  sections: [
    {
      id: "counts",
      heading: "The population",
      body: "Four counts, each one the length of a filter over the fixture rows. There is no percentage here and no score: a figure on this screen is either a count of rows or it is not on the screen.",
      items: [
        { id: "relationships", label: "Relationships by stage" },
        {
          id: "relationships-detail",
          label:
            "Invited {invited} · Connected {connected} · Sharing {sharing} · Aligned {aligned}",
        },
        { id: "awaiting-invitation", label: "Seats awaiting an invitation" },
        {
          id: "awaiting-invitation-detail",
          label: "Seats whose invitation is unclaimed or expired, across both parties.",
        },
        { id: "templates", label: "Templates in the library" },
        { id: "templates-detail", label: "{builtIn} built-in · {authored} authored" },
        { id: "complete", label: "Complete relationships" },
        {
          id: "complete-detail",
          label: "Both parties have answered — Sharing and Aligned.",
        },
      ],
    },
    {
      id: "attention",
      heading: "Needs attention",
      body: "A relationship is here when a seat has no account, an invitation expired, or nothing has happened for {days} days. Quietest first, and the seat column is the one the invitation belongs to.",
      items: [
        { id: "relationship", label: "Relationship" },
        { id: "template", label: "Template" },
        { id: "seat", label: "Counterparty" },
        { id: "stage", label: "Stage" },
        { id: "idle", label: "Days idle" },
      ],
    },
    {
      id: "attention-empty",
      heading: "Nothing needs attention",
      body: "Every seat has an account and every relationship has moved in the last week. This band is what an empty attention set reads as — it is not a zero dressed as a chart.",
    },
    {
      /** The ladder's four words, in order — the same vocabulary `/admin/instances` draws. */
      id: "stages",
      items: [
        { id: "invited", label: "Invited" },
        { id: "connected", label: "Connected" },
        { id: "sharing", label: "Sharing" },
        { id: "aligned", label: "Aligned" },
      ],
    },
    {
      /** What a seat column can say. `unnamed` is the line under an invitation nobody claimed. */
      id: "seat",
      items: [
        { id: "claimed", label: "Claimed" },
        { id: "invited", label: "Invited" },
        { id: "unclaimed", label: "Seat, no account" },
        { id: "expired", label: "Expired" },
        { id: "unnamed", label: "Unnamed" },
      ],
    },
    {
      /**
       * The two destinations this overview cannot link to yet. They are rows of text, not links: a
       * link to a route that does not render is a 404 dressed as navigation, and the card that
       * builds each one adds the link.
       */
      id: "coming",
      heading: "Built in a later cohort",
      body: "Two screens this overview will point at are drawn later. They are listed as text for now, with the route that cohort will mount them on.",
      items: [
        {
          id: "relationships",
          label: "Relationships, list and detail",
          value: "/prototype/relationships",
        },
        { id: "gaps", label: "Gap analysis", value: "/prototype/admin/gaps" },
        { id: "state", label: "Not yet" },
      ],
    },
    {
      id: "coming-columns",
      items: [
        { id: "screen", label: "Screen" },
        { id: "route", label: "Prototype route" },
        { id: "status", label: "Status" },
      ],
    },
  ],
});

/**
 * The band every prototype screen carries. One string, one place: the layout renders it, so cohorts
 * 2 to 5 cannot word it differently and cannot forget it.
 */
export const prototypeBandCopy: PageCopy = zPageCopy.parse({
  heading: "Prototype screens",
  subtitle:
    "These screens are prototypes. They render the records in data/prototypes/console.ts, there is no database behind them, and nothing here is a count of a real relationship.",
});
