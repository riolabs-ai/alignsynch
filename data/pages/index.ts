/**
 * The page-copy table — one entry per surface that has a `PageCopy` fixture.
 *
 * The key is the surface id: the route pattern `content/routes.ts` owns (`/`,
 * `/pricing`, `/news/[slug]`), or one of the declared non-route surfaces (`shell`,
 * `not-found`) that every page renders and no route therefore owns. WU-7…WU-11 add one
 * entry per unit; nothing else in the repo has to change.
 */
import { zPageCopyTable, type PageCopyTable } from "../../content/pages";
import { battlePageCopy } from "./battle";
import { categoriesPageCopy } from "./categories";
import { categoryDetailPageCopy } from "./category-detail";
import { dailyChallengePageCopy } from "./daily-challenge";
import { exploreFeaturedPageCopy } from "./explore-featured";
import { explorePageCopy } from "./explore";
import { homePageCopy } from "./home";
import { loginPageCopy } from "./login";
import { notFoundPageCopy } from "./not-found";
import { registerPageCopy } from "./register";
import { shellPageCopy } from "./shell";

export const pageCopies: PageCopyTable = zPageCopyTable.parse({
  "/": homePageCopy,
  "/battle": battlePageCopy,
  "/categories": categoriesPageCopy,
  "/categories/[slug]": categoryDetailPageCopy,
  "/daily-challenge": dailyChallengePageCopy,
  "/explore": explorePageCopy,
  "/explore/featured": exploreFeaturedPageCopy,
  "/login": loginPageCopy,
  "/register": registerPageCopy,
  shell: shellPageCopy,
  "not-found": notFoundPageCopy,
});
