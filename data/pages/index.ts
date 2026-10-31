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
import { affiliatePageCopy } from "./affiliate";
import { assessmentPageCopy } from "./assessment";
import { assessmentInstancePageCopy } from "./assessment-instance";
import { myInstancesPageCopy } from "./assessment-instances";
import { assessmentTemplatePageCopy } from "./assessment-template-new";
import { battlePageCopy } from "./battle";
import { categoriesPageCopy } from "./categories";
import { categoryDetailPageCopy } from "./category-detail";
import { creatorTipsPageCopy } from "./creator-tips";
import { creatorTipsDetailPageCopy } from "./creator-tips-detail";
import { dailyChallengePageCopy } from "./daily-challenge";
import { dashboardPageCopy } from "./dashboard";
import { exploreFeaturedPageCopy } from "./explore-featured";
import { explorePageCopy } from "./explore";
import { homePageCopy } from "./home";
import { invitePageCopy } from "./invite";
import { legalPages } from "./legal";
import { loginPageCopy } from "./login";
import { marketingPageCopy } from "./marketing";
import { newsPageCopy } from "./news";
import { newsArticlePageCopy } from "./news-article";
import { notFoundPageCopy } from "./not-found";
import { pricingPageCopy } from "./pricing";
import { profilePageCopy } from "./profile";
import { registerPageCopy } from "./register";
import { settingsPageCopy } from "./settings";
import { shellPageCopy } from "./shell";
import { supportPageCopy } from "./support";
import { supportArticlePageCopy } from "./support-article";
import { tournamentDetailPageCopy } from "./tournament-detail";
import { tournamentsPageCopy } from "./tournaments";

export const pageCopies: PageCopyTable = zPageCopyTable.parse({
  "/": homePageCopy,
  "/affiliate": affiliatePageCopy,
  "/assessment": assessmentPageCopy,
  "/assessment/instances": myInstancesPageCopy,
  "/assessment/instances/[instanceId]": assessmentInstancePageCopy,
  "/assessment/templates/new": assessmentTemplatePageCopy,
  "/battle": battlePageCopy,
  "/categories": categoriesPageCopy,
  "/categories/[slug]": categoryDetailPageCopy,
  "/creator-tips": creatorTipsPageCopy,
  "/creator-tips/[slug]": creatorTipsDetailPageCopy,
  "/daily-challenge": dailyChallengePageCopy,
  "/dashboard/user": dashboardPageCopy,
  "/explore": explorePageCopy,
  "/explore/featured": exploreFeaturedPageCopy,
  "/invite/[token]": invitePageCopy,
  "/login": loginPageCopy,
  "/news": newsPageCopy,
  "/news/[slug]": newsArticlePageCopy,
  "/pricing": pricingPageCopy,
  "/privacy": legalPages.privacy,
  "/profile/[username]": profilePageCopy,
  "/register": registerPageCopy,
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
  "/tournaments": tournamentsPageCopy,
  "/tournaments/[id]": tournamentDetailPageCopy,
  "/welcome": marketingPageCopy,
  shell: shellPageCopy,
  "not-found": notFoundPageCopy,
});
