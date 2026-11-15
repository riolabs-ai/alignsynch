/**
 * `/admin/docs` — the documentation screens' words (#892, #893).
 *
 * The screens are *renderers*: the section titles, the blurbs and every document's title and
 * question are `docs/docs.json`'s, the release facts are `CHANGELOG.md`'s, and the two one-line
 * judgements are `docs/changelog/releases.json`'s. What belongs here is what none of those files can
 * say — the filter's placeholder, the sentence an empty filter gets, the two singular/plural counts,
 * the panel a reader sees when a source cannot be built, and the rule the features index matches on.
 *
 * **Three fixtures, one file.** The hub (this export), the features index and the releases shelf are
 * three screens of one feature; one file keeps them from growing three vocabularies for the same
 * two nouns, and `data/pages/index.ts` maps each route to its own export.
 *
 * `{placeholders}` are filled by the view with what it counted (`lib/page-copy.ts::fillLabel`); no
 * sentence here bakes in a number, so 142 documents today and 160 tomorrow need no fixture edit —
 * and on the two #893 screens that is the whole point: a release that adds an area adds a card, not
 * an edit.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminDocsPageCopy: PageCopy = zPageCopy.parse({
  heading: "Documentation",
  subtitle:
    "Every page under docs/, grouped by the question it answers. The tree is the gate's own: this screen renders the manifest, it never keeps a second copy of the navigation.",
  sections: [
    {
      id: "hub",
      heading: "By section",
      body: "Nine sections, read live from docs/docs.json. A page added to the tree and the manifest appears here on the next request — a page added to only one of them fails pnpm docs:check.",
      items: [
        { id: "search-placeholder", label: "Filter by title or question" },
        { id: "search-clear", label: "Clear filter" },
        { id: "doc-count", label: "{count} documents" },
        { id: "doc-count-one", label: "{count} document" },
        { id: "result-count", label: "{count} matching pages" },
        { id: "result-count-one", label: "{count} matching page" },
        {
          id: "empty-search",
          label: "No page matches “{query}”. Clearing the filter shows all {count} documents.",
        },
        { id: "section-count", label: "{count} pages" },
        { id: "section-count-one", label: "{count} page" },
        { id: "open", label: "Read" },
        {
          id: "unreadable",
          label:
            "The documentation manifest could not be built: {reason}. Nothing is listed, because an empty list would claim the tree is empty.",
        },
      ],
    },
  ],
});

/**
 * `/admin/docs/features` (#893) — what has been built, grouped by area.
 *
 * The `body` of the `index` section is the *rule*, printed on the page: the areas and the pages
 * beside them are derived, and a reader who can read the derivation can audit the list instead of
 * trusting it. `no-docs` is the same idea in the negative — an area the tree does not document says
 * so, rather than being given a fuzzy neighbour to look complete.
 */
export const adminDocsFeaturesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Features",
  subtitle:
    "Every feat(<area>) scope the release notes carry, grouped by area, with the releases it shipped in and the pages that explain it. Read from CHANGELOG.md and docs/changelog/releases.json on every request: no list here is maintained by hand, so a release adds its rows and changes nothing.",
  cta: { label: "Read the release notes", href: "/admin/docs/releases" },
  sections: [
    {
      id: "index",
      heading: "By area",
      body: "A page explains an area when its title or path names every token of the area — db-verify needs a page naming both db and verify, and flow matches the pages filed under it. The changelog pages are excluded: they are the release notes themselves, not the writing about an area.",
      items: [
        { id: "area-count", label: "{count} areas" },
        { id: "area-count-one", label: "{count} area" },
        { id: "commit-count", label: "{count} feature commits" },
        { id: "commit-count-one", label: "{count} feature commit" },
        { id: "stat-detail", label: "{releases} releases · {pages} pages" },
        { id: "releases-heading", label: "Released in" },
        { id: "docs-heading", label: "Where it is written down" },
        {
          id: "no-docs",
          label:
            "No page in docs/ names this area yet. That is the gap, printed rather than papered over.",
        },
        { id: "area-commit-count", label: "{count} commits" },
        { id: "area-commit-count-one", label: "{count} commit" },
        { id: "area-release-count", label: "{count} releases" },
        { id: "area-release-count-one", label: "{count} release" },
        { id: "area-doc-count", label: "{count} pages" },
        { id: "area-doc-count-one", label: "{count} page" },
        {
          id: "unreadable",
          label:
            "The release record could not be built: {reason}. Nothing is listed, because an empty page would claim nothing has shipped.",
        },
      ],
    },
  ],
});

/**
 * `/admin/docs/releases` (#893) — the release record, one release at a time.
 *
 * Three panes and one list, the `/admin/review` arrangement: the list is every release newest first,
 * the panes are the selected release's judgement, the facts behind it, and which build is serving
 * the page. The last pane is the reason this screen exists beside the release note: the note says
 * what shipped, this says *whether you are looking at it*.
 */
export const adminDocsReleasesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Releases",
  subtitle:
    "Every release CHANGELOG.md records, newest first, with the judgement docs/changelog/releases.json keeps beside it and the page the generator wrote from the entry. Selection is an address — ?release=<version> — so a release somebody quotes is a link they can send.",
  cta: { label: "Every feature, by area", href: "/admin/docs/features" },
  sections: [
    {
      id: "list",
      heading: "The record",
      body: "Newest first, the order CHANGELOG.md holds. A row opens its release in the panes beside it; an address the record does not carry is a 404, never the newest release wearing its name.",
      items: [
        { id: "release-count", label: "{count} releases" },
        { id: "release-count-one", label: "{count} release" },
        { id: "row-meta", label: "{pullRequests} pull requests · {areas} areas" },
        { id: "empty", label: "No release is recorded." },
      ],
    },
    {
      id: "detail",
      heading: "This release",
      body: "The entry's own facts, and the two one-line judgements a person wrote in the record. Neither is copied into the other: pnpm changelog:check fails when the two disagree about which versions exist.",
      items: [
        { id: "theme-label", label: "Theme" },
        { id: "headline-label", label: "Turned on" },
        { id: "released-label", label: "Released" },
        { id: "tag-label", label: "Tag" },
        { id: "pull-requests-label", label: "Pull requests named" },
        { id: "page-label", label: "Release note" },
        {
          id: "page-missing",
          label:
            "docs/docs.json lists no page at {path}. The generator still writes it — pnpm docs:check names the row that is missing.",
        },
        { id: "areas-label", label: "Feature areas" },
        {
          id: "no-features",
          label: "This entry names no feat(<area>) scope: it is a fix, a chore or a test release.",
        },
        { id: "limits-label", label: "Known limits" },
        { id: "limits-present", label: "The entry ends with its Known limits block." },
        {
          id: "limits-absent",
          label: "The entry carries no Known limits block, which pnpm release:check refuses.",
        },
      ],
    },
    {
      id: "build",
      heading: "The build answering",
      body: "The version and commit next.config.mjs inlined when this bundle was compiled — the same pair GET /api/version answers, read in process rather than by a request this render would have to open.",
      items: [
        { id: "serving", label: "Serving {version} at {commit}" },
        {
          id: "newest-match",
          label: "This build is the newest release the record holds.",
        },
        {
          id: "newest-behind",
          label:
            "This build is not the newest release the record holds. The record's newest is {version}.",
        },
        { id: "unknown", label: "A build made without git cannot know its commit." },
      ],
    },
    {
      id: "unreadable",
      heading: "The release record could not be built",
      body: "{reason}. Nothing is listed, because an empty shelf would claim nothing has shipped.",
    },
  ],
});
