/**
 * Search — DERIVED, never authored (D18).
 *
 * `docs/P2-INVENTORY.md` counted 37 literals in `components/search/search-results.tsx` (8
 * quizzes, 6 categories, 4 creators, 4 pages, none of which existed in a collection) plus the
 * 4/4/3/15 catalog in `data/searchdata.ts`. Both are one call to `buildSearchIndex()` now, so
 * every row below is copied from a real record or counted over real records:
 *
 *   quizzes[]     -> the public quizzes in data/, path = /quiz/<slug>
 *   categories[]  -> the quiz-scoped taxonomy rows that have at least one quiz
 *   creators[]    -> the user collection, quizCount = quizzes authored by that user
 *   pages[]       -> the curated indexable routes in content/routes.ts
 *
 * Anything that does not resolve against the route manifest throws at import, so a dead link is
 * a red build rather than a 404 in the palette. `data:check` E21 fails if any component writes
 * one of these rows back into itself, which is how the second copy was found in the first place.
 *
 * ## One index per brand, and one per viewer (issue #156)
 *
 * The palette is chrome — it is in the header on every route — so a quiz row offered on an
 * AlignSynch page is the same defect as a Leaderboard link in the sidebar: a click into a
 * product the visitor did not sign up for. So the index is built for a *brand and a viewer*:
 *
 *   quizhub                the index above, unchanged — every public quiz, category, creator
 *                          and page row the template build has always searched
 *   alignsynch, platform   the assessment instances this build actually holds
 *                          (`data/assessments.ts`) plus the three pages an alignment visitor
 *                          can reach (`lib/nav.ts`'s `ALIGNMENT_ROUTES`). No quizzes, no quiz
 *                          categories, no creators: there are no records behind them here.
 *   alignsynch, elevated   the quiz index plus the instance rows. An admin still finds
 *                          everything; that is the visibility rule, not a deletion.
 *
 * `searchIndex` stays the shipped template's instance, because that is what `data:check` and
 * `tests/search-index.test.ts` prove resolves; a second brand's index must not weaken that.
 */
import {
  buildSearchIndex,
  type SearchIndex,
  type SearchPageRow,
  zSearchIndex,
} from "../content/search";
import { isValidRoute, routeTitle, type RouteManifest } from "../content/route-manifest";
import { routeManifest } from "../content/routes";
import { users } from "../lib/data/users";
import { ALIGNMENT_ROUTES, type NavViewer, PLATFORM_VIEWER, sees } from "../lib/nav";
import { assessmentInstances } from "./assessments";
import type { BrandId } from "./brand";
import { categories } from "./categories";
import { quizzes } from "./quizzes";

/** Only `public` quizzes enter the index; the 20 generator templates are private drafts. */
const searchableQuizzes = quizzes.map((quiz) => ({
  id: quiz.id,
  slug: quiz.slug,
  title: quiz.title,
  difficulty: quiz.difficulty,
  categoryIds: quiz.categoryIds,
  visibility: quiz.settings.visibility,
  ...(quiz.author ? { author: { id: quiz.author.id } } : {}),
}));

export const searchIndex = buildSearchIndex(
  searchableQuizzes,
  categories,
  users.map((user) => ({ id: user.id, username: user.username, name: user.name })),
  routeManifest,
);

/**
 * One row per assessment instance — the records an alignment build actually holds.
 *
 * The title is derived, never authored: the instance's own title (the template's) and the two
 * parties the schema requires. That is what a person types — the template's name ("Parent &
 * Child") or a name on it ("Iris") — and the path is the instance's real route, so a hit is a
 * door rather than a 404. `buildSearchIndex` validates the rows it builds; these are validated
 * here instead, against the same manifest.
 */
function instanceResults(): SearchPageRow[] {
  return assessmentInstances.map((instance) => {
    const path = `/assessment/${instance.slug}`;
    if (!isValidRoute(routeManifest, path)) {
      throw new Error(
        `data/searchdata: "${instance.slug}" has no route — ${path} does not resolve`,
      );
    }
    return {
      id: `assessment-${instance.slug}`,
      title: `${instance.title} — ${instance.parties.map((party) => party.name).join(" and ")}`,
      path,
    };
  });
}

const byPath = (a: SearchPageRow, b: SearchPageRow): number => (a.path < b.path ? -1 : 1);

/** The alignment build's index: the instances, and the pages its visitors can reach. */
function alignmentIndex(): SearchIndex {
  const manifest: RouteManifest = routeManifest;
  const pages: SearchPageRow[] = ALIGNMENT_ROUTES.map((path) => {
    if (!isValidRoute(manifest, path)) {
      throw new Error(
        `data/searchdata: ALIGNMENT_ROUTES names "${path}", which resolves to nothing`,
      );
    }
    // The curated title where `content/routes.ts` carries one (it does for `/` and `/support`),
    // the manifest's own de-slugged fallback otherwise — the same rule `buildSearchIndex` uses,
    // so a page the index lists and a page the palette prints never disagree.
    const page = manifest.pages.find((entry) => entry.path === path);
    return {
      id: `page-${path === "/" ? "home" : path.slice(1)}`,
      title: page?.title || routeTitle(path),
      path,
    };
  });

  return zSearchIndex.parse({
    quizzes: [],
    categories: [],
    creators: [],
    pages: [...pages, ...instanceResults()].sort(byPath),
  });
}

const alignment = alignmentIndex();

/**
 * The index this brand's palette and `/search` page render.
 *
 * A `switch` over the brand literal rather than a lookup, for the reason `resolveBrand` gives:
 * the quiz brand's index is returned untouched, the alignment brand gets the rows it has, and a
 * brand added without a decision here is a compile error rather than an inherited catalog.
 */
export function searchIndexFor(brandId: BrandId, viewer: NavViewer): SearchIndex {
  switch (brandId) {
    case "quizhub":
      return searchIndex;
    case "alignsynch":
      return sees(viewer, "quiz-surfaces")
        ? { ...searchIndex, pages: [...searchIndex.pages, ...instanceResults()].sort(byPath) }
        : alignment;
    default: {
      const unhandled: never = brandId;
      throw new Error(`no search index for brand ${String(unhandled)}`);
    }
  }
}

/** The shipped template's index, for the callers that render no brand of their own. */
export const platformSearchIndex: SearchIndex = searchIndexFor("quizhub", PLATFORM_VIEWER);
