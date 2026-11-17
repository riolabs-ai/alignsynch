/**
 * The page-copy table — one entry per surface that has a `PageCopy` fixture.
 *
 * The key is the surface id: the route pattern `content/routes.ts` owns (`/`,
 * `/pricing`, `/news/[slug]`), or one of the declared non-route surfaces (`shell`,
 * `not-found`) that every page renders and no route therefore owns. WU-7…WU-11 add one
 * entry per unit; nothing else in the repo has to change.
 *
 * WU-9 (#56) added the marketing surfaces: the affiliate programme, pricing, the news
 * index and its article reader, the support centre and its article reader, and creator
 * tips in both its list and detail shapes. Each *route* owns copy even where two routes
 * share one component directory — `/news` and `/news/[slug]` both render out of
 * `components/news/`, and the page decides which fixture's section a component receives,
 * never the component itself.
 */
import { zPageCopyTable, type PageCopyTable } from "../../content/pages";
import { adminAuditPageCopy } from "./admin-audit";
import { adminBillingPageCopy } from "./admin-billing";
// #906 — the brand and audience profile, behind the console's gate.
import { adminBrandPageCopy } from "./admin-brand";
import { adminBroadcastPageCopy } from "./admin-broadcast";
// #892 — the documentation home and one document of the tree under `docs/`.
import { adminDocPageCopy } from "./admin-docs-document";
import {
  adminDocsFeaturesPageCopy,
  adminDocsPageCopy,
  adminDocsReleasesPageCopy,
} from "./admin-docs";
import { adminGapsPageCopy } from "./admin-gaps";
// #920 — the growth model: cohorts, plan mix, churn and invoices from one committed artifact.
import { adminGrowthPageCopy } from "./admin-growth";
import { adminHealthPageCopy } from "./admin-health";
import { adminInboxPageCopy } from "./admin-inbox";
import { adminInstancesPageCopy } from "./admin-instances";
// #1126 — the CRUD & Permissions matrix: the v2 spec reference, read from one markdown source.
import { adminPermissionsPageCopy } from "./admin-permissions";
import { adminRelationshipPageCopy } from "./admin-relationship";
// #665 — the review shelf: artifacts grouped by release, with to-dos and feedback.
import { adminReviewPageCopy } from "./admin-review";
import { adminTemplateEditorPageCopy } from "./admin-template-editor";
import { adminTemplatesPageCopy } from "./admin-templates";
import { adminReportPageCopy } from "./admin-report";
import { affiliatePageCopy } from "./affiliate";
import { assessmentPageCopy } from "./assessment";
import { assessmentInstancePageCopy } from "./assessment-instance";
import { assessmentsPageCopy } from "./assessments";
import { relationshipReportPageCopy } from "./assessment-relationship-report";
import { assessmentAcceptPageCopy } from "./assessment-accept";
import { assessmentAnswerPageCopy } from "./assessment-answer";
import { assessmentSentPageCopy } from "./assessment-sent";
import { assessmentCreatePageCopy } from "./assessment-create";
import { battlePageCopy } from "./battle";
import { categoriesPageCopy } from "./categories";
import { categoryDetailPageCopy } from "./category-detail";
/**
 * #1131 — Chat v2: one thread per relationship, in the member's dashboard.
 */
import { chatPageCopy } from "./chat";
import { creatorTipsPageCopy } from "./creator-tips";
import { creatorTipsDetailPageCopy } from "./creator-tips-detail";
import { dailyChallengePageCopy } from "./daily-challenge";
import { dashboardPageCopy } from "./dashboard";
// #542 phase 1 — support and help, inside the dashboard.
import { dashboardSupportPageCopy } from "./dashboard-support";
// #533 phase 2 — the initiator's own templates and relationships.
import { dashboardRelationshipDetailPageCopy } from "./dashboard-relationship-detail";
// #1132 — the member's billing surface: one trial panel per relationship, and the Counterparty view.
import { paymentPageCopy } from "./payment";
import { dashboardRelationshipsPageCopy } from "./dashboard-relationships";
import { dashboardTemplateEditorPageCopy } from "./dashboard-template-editor";
import { dashboardTemplateProposalPageCopy } from "./dashboard-template-proposal";
import { dashboardTemplatesPageCopy } from "./dashboard-templates";
import { exploreFeaturedPageCopy } from "./explore-featured";
import { explorePageCopy } from "./explore";
import { homePageCopy } from "./home";
import { helpPageCopy } from "./help";
import { howItWorksPageCopy } from "./how-it-works";
import { invitePageCopy } from "./invite";
import { legalPages } from "./legal";
import { loginPageCopy } from "./login";
import { marketingPageCopy } from "./marketing";
import { newsPageCopy } from "./news";
import { newsArticlePageCopy } from "./news-article";
import { notFoundPageCopy } from "./not-found";
import { resetCompletePageCopy, resetFormPageCopy, resetRequestPageCopy } from "./password-reset";
import { pricingPageCopy } from "./pricing";
import { profilePageCopy } from "./profile";
import { registerPageCopy } from "./register";
import { settingsPageCopy } from "./settings";
import { shellPageCopy } from "./shell";
import { startPageCopy } from "./start";
import { supportPageCopy } from "./support";
import { supportArticlePageCopy } from "./support-article";
// The public catalogue — the page the header's `Templates` row names, and one template's page.
import { templatesDetailPageCopy } from "./templates-detail";
import { templatesPageCopy } from "./templates";
import { tourPageCopy } from "./tour";
import { tournamentDetailPageCopy } from "./tournament-detail";
import { tournamentsPageCopy } from "./tournaments";

export const pageCopies: PageCopyTable = zPageCopyTable.parse({
  "/": homePageCopy,
  "/admin/audit": adminAuditPageCopy,
  // #507 — the broadcast: compose, dry run, send, and the sends already made.
  "/admin/broadcast": adminBroadcastPageCopy,
  // #505 — the billing control screen: one row per relationship, and the owner's comp.
  "/admin/billing": adminBillingPageCopy,
  // #906 — the brand and audience profile: the canon, rendered for the operator who writes from it.
  "/admin/brand": adminBrandPageCopy,
  // #892 — the documentation home, and one document in it. Two fixtures because they say different
  // things: the hub is a list with a filter, the document is its own chrome around a body the tree
  // owns.
  "/admin/docs": adminDocsPageCopy,
  "/admin/docs/[...slug]": adminDocPageCopy,
  // #893 — the two derived views. Each export is its own fixture in `data/pages/admin-docs.ts`,
  // because each screen says different things: the features index prints the rule it matches on,
  // the releases shelf prints the build answering.
  "/admin/docs/features": adminDocsFeaturesPageCopy,
  "/admin/docs/releases": adminDocsReleasesPageCopy,
  "/admin/gaps": adminGapsPageCopy,
  // #920 — the growth model and the sampled operational set beside it.
  "/admin/growth": adminGrowthPageCopy,
  "/admin/health": adminHealthPageCopy,
  "/admin/instances": adminInstancesPageCopy,
  "/admin/instances/[id]": adminRelationshipPageCopy,
  // #665 — the review shelf, grouped by release; the manifest is the catalogue.
  "/admin/review": adminReviewPageCopy,
  "/admin/templates": adminTemplatesPageCopy,
  "/admin/templates/[id]": adminTemplateEditorPageCopy,
  "/admin/instances/[id]/report": adminReportPageCopy,
  // #506 — the support inbox: the contact form's queue, one thread, the reply.
  "/admin/inbox": adminInboxPageCopy,
  // #1126 — the CRUD & Permissions matrix, read from `docs/specs/v2-prototype/crud-matrix.md`.
  "/admin/permissions": adminPermissionsPageCopy,
  "/affiliate": affiliatePageCopy,
  "/assessment": assessmentPageCopy,
  // #877 — the member's assessment-session listing, plural and a sibling of `/dashboard/
  // relationships`. It replaced `/assessment/instances`, which is a 308 here now; the three
  // session routes below it did not move.
  "/assessments": assessmentsPageCopy,
  "/assessment/instances/[instanceId]": assessmentInstancePageCopy,
  "/assessment/instances/[instanceId]/report": relationshipReportPageCopy,
  // R1-E (#409) — the three write surfaces, shipped as in-progress UI.
  "/assessment/instances/[instanceId]/answer": assessmentAnswerPageCopy,
  "/assessment/instances/[instanceId]/accept": assessmentAcceptPageCopy,
  // #691 — stage 5, Sent. Its own fixture: the status sentences and the timeline exist on no other
  // screen, and the two bands it shares (the six stage names, one invitation's vocabulary) are
  // referenced from their own homes rather than copied here.
  "/assessment/instances/[instanceId]/sent": assessmentSentPageCopy,
  "/battle": battlePageCopy,
  "/categories": categoriesPageCopy,
  "/categories/[slug]": categoryDetailPageCopy,
  "/creator-tips": creatorTipsPageCopy,
  "/creator-tips/[slug]": creatorTipsDetailPageCopy,
  "/daily-challenge": dailyChallengePageCopy,
  // #1129 — the v2 landing (Start). The console's four counts moved off this route: the approved
  // bundle draws a greeting, one next step and two shelves, and the counts' own lists are one click
  // away at `/assessments?filter=…` (which is where those cards pointed anyway).
  "/dashboard": startPageCopy,
  /**
   * #1131 — one thread per relationship. The AlignSynch build's chat, beside the member's other
   * record lists: `/chat` stays the **quiz** product's conversations (#300 gates it to that brand),
   * so this is a sibling of the three routes below rather than a replacement for a quiz surface.
   */
  "/dashboard/chat": chatPageCopy,
  // #542 phase 1 — the work the dashboard used to leave the app to do.
  "/dashboard/support": dashboardSupportPageCopy,
  // #533 phase 2 — the initiator's own templates and relationships. Four routes, four fixtures:
  // the two lists, the private template editor, and one relationship's detail.
  "/dashboard/relationships": dashboardRelationshipsPageCopy,
  "/dashboard/relationships/[id]": dashboardRelationshipDetailPageCopy,
  "/dashboard/templates": dashboardTemplatesPageCopy,
  "/dashboard/templates/[id]": dashboardTemplateEditorPageCopy,
  "/dashboard/templates/[id]/propose": dashboardTemplateProposalPageCopy,
  "/dashboard/payment": paymentPageCopy,
  "/dashboard/user": dashboardPageCopy,
  "/explore": explorePageCopy,
  "/explore/featured": exploreFeaturedPageCopy,
  "/forgot-password": resetRequestPageCopy,
  "/help": helpPageCopy,
  "/how-it-works": howItWorksPageCopy,
  "/invite/[token]": invitePageCopy,
  "/login": loginPageCopy,
  "/news": newsPageCopy,
  "/news/[slug]": newsArticlePageCopy,
  "/pricing": pricingPageCopy,
  "/privacy": legalPages.privacy,
  "/profile/[username]": profilePageCopy,
  "/register": registerPageCopy,
  "/reset/[token]": resetFormPageCopy,
  "/reset/complete": resetCompletePageCopy,
  /**
   * `/search` is the one route that points at the shell's fixture (issue #156 follow-up).
   *
   * Its field, its result-group headings and its empty states are the search vocabulary the
   * palette already speaks, and the palette is chrome — so the words live in `data/pages/shell.ts`
   * under `search` / `search-alignsynch` / `search-body` / `search-body-alignsynch`, and this
   * entry is what gives the route's own component directory a budget (`data/pages/budget.ts`).
   * Two fixtures for one field is the drift the shell's search sections exist to prevent.
   */
  "/search": shellPageCopy,
  "/settings": settingsPageCopy,
  "/support": supportPageCopy,
  "/support/articles/[slug]": supportArticlePageCopy,
  "/terms": legalPages.terms,
  // #794 — the six-stage create flow, under the template's own noun. #1109 retired the member's
  // library listing, its authoring form and its read-only detail page (they 308 to
  // `/dashboard/templates`), so their three entries are gone from this table with them: a path here
  // is a promise that the route renders a fixture, and E23 checks the two directions.
  "/templates/relationship/[slug]/create": assessmentCreatePageCopy,
  // #688 — stage 2 renders the same fixture: one flow, one copy table, two steps that must not
  // drift into two vocabularies.
  "/templates/relationship/[slug]/create/mode": assessmentCreatePageCopy,
  // #689 — stage 3, the third register of the same fixture.
  "/templates/relationship/[slug]/create/aspects": assessmentCreatePageCopy,
  // #690 — stage 4 and stage 5 of one flow: the same fixture again, because a second copy of these
  // words is how a flow grows two dialects. #825 — the account gate that used to sit behind the
  // create is retired; stage 4 is the account and stage 5 is the invite.
  "/templates/relationship/[slug]/create/commit": assessmentCreatePageCopy,
  "/templates/relationship/[slug]/create/invite": assessmentCreatePageCopy,
  /**
   * The public catalogue, one address and one fixture (#905, consolidated in #1127).
   *
   * `/relationship-templates` is the catalogue the header, the footer and every "start with a
   * template" action point at, and `/relationship-templates/[slug]` is one row of it. The second
   * surface `/relationship-types` (the retained #889 variation) is retired with its 308, so this
   * table has one catalogue row rather than two that must be kept saying the same thing.
   */
  "/relationship-templates": templatesPageCopy,
  "/relationship-templates/[slug]": templatesDetailPageCopy,
  "/tournaments": tournamentsPageCopy,
  "/tournaments/[id]": tournamentDetailPageCopy,
  "/welcome": marketingPageCopy,
  shell: shellPageCopy,
  "not-found": notFoundPageCopy,
  /**
   * The first-run tour (#455), a declared non-route surface like the shell: its callout renders
   * over `/dashboard` and points into the rail, and no route owns those words. Registered here so
   * `data/pages/budget.ts` has a copy to attribute and E23 can hold `components/tour/**` at 0 —
   * the alternative was a second, unratcheted home for the same sentences.
   */
  tour: tourPageCopy,
});
