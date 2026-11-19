/**
 * `/dashboard/templates` — one Templates page, two tabs: **Library | My Templates** (bundle 06, #1130).
 *
 * The screen is the member's one door to templates. **Library** is what this account can start a
 * relationship from — the platform's published templates — with a category filter, a search and a
 * featured band; **My Templates** is the templates this account owns, each opening its own page.
 * Both write a row this account reads (`visibility = 'private'`, `status = 'draft'` when created),
 * which is why nothing here offers to publish: public listing is the console's decision (#533), and
 * a proposal to the Library is a *form*, never a publish (the review queue is undecided — #1130).
 *
 *   tabs        the two tabs, and the count pill each carries
 *   featured    the Library's one featured template, and its two actions
 *   categories  the filter row: All, then the five shelves
 *   search      the search field
 *   propose     the proposal door
 *   card        the card's own words, shared by both tabs
 *   library     what the Library tab is
 *   mine        what My Templates is, and how a row is opened
 *   no-match    a filter or a search that matched nothing
 *   list/new/clone  the two ways to start a template (the shipped bands)
 *   refusals/unreadable  one sentence per answer the actions can give
 *
 * **`{placeholders}` are filled by `fillLabel`** and every `{count}` is counted from the rows the read
 * returned, never typed here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const dashboardTemplatesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Templates",
  /**
   * The header line is bundle 06's own (`templates.html`'s `<h1>Templates</h1>` followed by
   * `Start from the Library, or reuse one of your own.`), verbatim — the reference draws one short
   * sentence and the screen printed a longer one that said the same thing.
   */
  subtitle: "Start from the Library, or reuse one of your own.",
  items: [
    { id: "aspects", label: "{count} Aspects" },
    { id: "relationships", label: "{count} relationships" },
    { id: "open", label: "Open" },
    { id: "none", label: "—" },
    { id: "draft", label: "Draft" },
    /** The one number the tabs and the filter row print beside a name. */
    { id: "count", label: "{count}" },
  ],
  sections: [
    /**
     * The two tabs. `library` is the bare path and `mine` is `?tab=mine`, so a link to either is a URL
     * a `curl` can ask for. The words are bundle 06's, verbatim.
     */
    {
      id: "tabs",
      items: [
        { id: "library", label: "Library" },
        { id: "mine", label: "My Templates" },
      ],
    },
    /**
     * The featured band. One template, picked by the fixture (`FEATURED_TEMPLATE_SLUG`), with an
     * outline View Template and the primary Create Relationship — the same pair every Library card
     * carries, drawn once at the top of the shelf.
     */
    {
      id: "featured",
      items: [
        { id: "label", label: "Featured Template" },
        { id: "view", label: "View Template" },
        { id: "create", label: "Create Relationship" },
      ],
    },
    /**
     * The category filter. `all` is the absence of a filter; the five shelves are the keys in
     * `data/template-categories.ts`, and each link carries `?filter=<key>` beside `?tab=`.
     */
    {
      id: "categories",
      heading: "Categories",
      items: [
        { id: "all", label: "All" },
        { id: "family", label: "Family" },
        { id: "couples", label: "Couples" },
        { id: "friends", label: "Friends" },
        { id: "work", label: "Work" },
        { id: "home", label: "Home" },
        /** The count beside each shelf's name — `{count}` from the search's own result set. */
        { id: "count", label: "{count}" },
      ],
    },
    {
      id: "search",
      items: [
        { id: "label", label: "Search the Library" },
        { id: "placeholder", label: "Search templates" },
        { id: "submit", label: "Search" },
        { id: "clear", label: "Clear" },
      ],
    },
    {
      id: "propose",
      body: "Have a template of your own that would help someone else? You can propose it to the Library from its page. A proposal is reviewed before anything is shared, and it never publishes itself.",
      items: [{ id: "cta", label: "Propose a Template" }],
    },
    /**
     * The card's own words, shared by both tabs — one shelf, two reads. `details` and `create` are the
     * owner's button labels, and neither tab ever says "instance": a relationship is what a person
     * starts, and a session is what publishing one opens.
     */
    {
      id: "card",
      items: [
        { id: "template", label: "Template" },
        { id: "copy", label: "My Copy" },
        { id: "details", label: "View Details" },
        { id: "open", label: "Open" },
        { id: "create", label: "Create Relationship" },
        { id: "aspects", label: "{count} Aspects" },
        /**
         * The third chip bundle 06 draws on every Library card (`templates.html`: `Family`,
         * `5 Aspects`, `About 3 Minutes`), and the one #1130 names beside the Aspect count. `{count}`
         * is derived from the Aspect count by `minutesForAspects()` — a template carries no duration
         * of its own, so this is a reading of the work, never a stored field.
         */
        { id: "minutes", label: "About {count} Minutes" },
        /**
         * The card's one price (#796) — the *plan's*, never a per-relationship charge. It is the
         * same chip `/assessment/templates` prints (`{plan} · {price}/mo`, the entry plan's monthly
         * figure from `data/billing-plans.ts`), and the name is in the line because a bare figure
         * beside nine cards reads as nine subscriptions. `{price}` is `formatCurrency`.
         */
        { id: "price", label: "{plan} · {price}/mo" },
        { id: "unused", label: "Not used yet" },
        { id: "relationship-one", label: "used in 1 relationship" },
        { id: "relationships", label: "used in {count} relationships" },
      ],
    },
    /**
     * The card's kebab (#1134). One `More actions` trigger on every card; the rows behind it are
     * the tab's, and both lists are bundle 06's own words — a Library card offers the two things a
     * catalogue row can do, a My Template offers the three that act on a row you own.
     */
    {
      id: "menu",
      items: [
        { id: "more", label: "More actions for {title}" },
        { id: "create", label: "Create Relationship" },
        { id: "save-copy", label: "Save a Copy" },
        { id: "edit", label: "Edit" },
        { id: "duplicate", label: "Duplicate" },
        { id: "archive", label: "Archive" },
      ],
    },
    /** What a menu write says when it lands — the bundle's three toasts, verbatim. */
    {
      id: "menu-notices",
      items: [
        { id: "save-copy", label: "Saved {title} to My Templates" },
        { id: "duplicate", label: "Duplicated {title}" },
        { id: "archive", label: "Archived {title}" },
      ],
    },
    /**
     * `?tab=mine&new=<id>` — where `Save a Copy` lands (#1134).
     *
     * The bundle's toast carries a `View` link to that address rather than navigating; the issue
     * asks the copy to *open*, so the confirmation is drawn on arrival instead and the link it
     * carries is the copy's own page.
     */
    {
      id: "copied",
      heading: "Saved to My Templates",
      body: "{title} is yours. Open it to edit its words or its Aspects.",
      items: [{ id: "view", label: "View" }],
    },
    {
      id: "library",
      heading: "Library",
      body: "The templates this account can start a relationship from. Each card carries the price of the plan that includes it — one monthly figure, never a per-relationship charge. Opening one shows its Aspects, and Create Relationship copies them into a relationship you configure.",
    },
    {
      id: "library-empty",
      heading: "The Library is Empty",
      body: "No template is published yet, so there is nothing to start a relationship from. An operator publishes the Library's templates.",
    },
    {
      id: "mine",
      heading: "My Templates",
      /**
       * Bundle 06's own line for this tab, verbatim (`templates.html`: `Your saved copies. Changes
       * never touch relationships you've already started.`). The screen printed three sentences
       * here, and the third explained a rule the doc's own *How It Works* carries — "starting a
       * relationship from the Library does not put that template here" — above an empty state,
       * which is the wall of text the reference's one line replaces.
       */
      body: "Your saved copies. Changes never touch relationships you’ve already started.",
    },
    {
      id: "mine-empty",
      heading: "No Templates Yet",
      /**
       * The notice draws only on `owned.length === 0` (`app/(mainlayout)/dashboard/templates/page.tsx`),
       * so its sentence may not point at the shelf above it: "A template you already own can also be
       * opened above" described a list that is empty by definition whenever a reader sees it. The two
       * doors it names are the bands drawn below it (`Start Blank`, `Copy a Template`), which the
       * reference's empty state does not carry — bundle 06's own sentence there is
       * `Save a Library template to make it yours: reword Aspects, turn some off, reuse it.`, and it
       * would be wrong here for the opposite reason.
       */
      body: "Start one below — blank, or copied from a template in the Library.",
      items: [{ id: "browse", label: "Browse the Library" }],
    },
    {
      id: "no-match",
      heading: "Nothing Matches",
      body: "No template on this shelf matches that search. Clear it, or pick another category.",
      items: [{ id: "clear", label: "Clear the Search" }],
    },
    {
      id: "list",
      heading: "Your Templates",
      body: "Every template you own, newest first. Opening one edits its words and its Aspects; starting a relationship from one copies its Aspects into that relationship, so editing here never changes a relationship you have already configured.",
    },
    {
      id: "new",
      heading: "Start Blank",
      body: "A title, a summary and the first Aspect. A template needs at least one Aspect — it is what both people answer — so this is the one field the model will not let you leave empty. The save lands in the audit log in the same transaction, with a sentence written for you.",
      items: [
        { id: "title", label: "Title" },
        { id: "summary", label: "Summary" },
        { id: "prompt", label: "First Aspect" },
        { id: "left", label: "Left Value (1)" },
        { id: "right", label: "Right Value (5)" },
        { id: "submit", label: "Create the template" },
        { id: "submitting", label: "Creating…" },
        { id: "created", label: "{title} is ready to open." },
        { id: "open-created", label: "Open it" },
      ],
    },
    {
      id: "clone",
      heading: "Copy a Template",
      body: "Copy a template into one of your own — the Library's, which the operators of this site curate, or a template you already own. The copy carries the words and the Aspects, it is private to you, and the original does not change.",
      items: [
        { id: "choose", label: "Choose a template" },
        { id: "submit", label: "Copy it" },
        { id: "cloning", label: "Copying…" },
        { id: "cloned", label: "{title} is now yours." },
        { id: "none", label: "There are no templates to copy yet." },
      ],
    },
    {
      id: "empty",
      heading: "No Templates Yet",
      body: "Start one below — blank, or copied from a template you can use. A relationship starts from a template, so this is where the work begins.",
    },
    {
      id: "refusals",
      items: [
        { id: "invalid-draft", label: "The model refused that template — check the fields." },
        { id: "slug-taken", label: "That name is already in use. Try another title." },
        { id: "no-such-template", label: "That template is not in this database." },
        { id: "not-yours", label: "That template belongs to another account." },
        { id: "not-editable", label: "That template is archived — it cannot be edited." },
        { id: "not-publishable", label: "Your role may not start a relationship." },
        { id: "trial-already-running", label: "A trial is already running on this account." },
        { id: "signed-out", label: "Your session ended. Sign in and try again." },
        { id: "failed", label: "The save did not go through." },
      ],
    },
    {
      id: "unreadable",
      heading: "Your Templates Could Not Be Read",
      body: "The database did not answer. Nothing was changed.",
    },
  ],
});
