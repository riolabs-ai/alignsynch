/**
 * The page-copy table — one entry per route that has a `PageCopy` fixture.
 *
 * The key is the route pattern `content/routes.ts` owns (`/`, `/pricing`,
 * `/news/[slug]`), which is what makes "every route has copy" a checkable
 * statement instead of a hope (E23). WU-7…WU-11 add one entry per unit; nothing
 * else in the repo has to change.
 */
import { zPageCopyTable, type PageCopyTable } from "../../content/pages";
import { categoriesPageCopy } from "./categories";
import { categoryDetailPageCopy } from "./category-detail";
import { exploreFeaturedPageCopy } from "./explore-featured";
import { explorePageCopy } from "./explore";
import { homePageCopy } from "./home";

export const pageCopies: PageCopyTable = zPageCopyTable.parse({
  "/": homePageCopy,
  "/categories": categoriesPageCopy,
  "/categories/[slug]": categoryDetailPageCopy,
  "/explore": explorePageCopy,
  "/explore/featured": exploreFeaturedPageCopy,
});
