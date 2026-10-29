/**
 * `pnpm data:check` — every fixture in `data/` is validated against the zod model
 * at build time.
 *
 * Two layers, deliberately separate:
 *
 *  1. PER-RECORD  — the schema in `content/`. An unknown key is an error (every
 *     object is `strict()`), which is what makes a fixture drift a red build
 *     instead of a silently carried field.
 *  2. COLLECTION  — the invariants a single record cannot see: unique ids across
 *     collections, category scope, referential links, route existence.
 *
 * Diagnostics are collected, not thrown, so one run reports every problem instead
 * of the first one. Exit code is 1 if any E* check fails.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";

import { zArticleCollection, zKbArticle, zNewsArticle, zTip } from "../content/article";
import {
  assertCategoryScopes,
  assertRenderableCategories,
  zCategories,
  type Category,
} from "../content/category";
import {
  categories as quizCategoryTable,
  categories as taxonomyTable,
  quizCategories as quizSubjects,
} from "../content/categories";
import {
  zQuiz,
  zQuizAuthoringCard,
  zQuizCard,
  zQuizPromotion,
  selectQuizAuthoringCard,
  selectQuizCard,
  type Question,
  type Quiz,
  type QuizPromotion,
} from "../content/quiz";
import { zQuizComment, zQuizResult, zQuizReview } from "../content/quiz-result";
import { ROUTE_PATTERNS, routeManifest } from "../content/routes";
import { matchRoute, normalizePath } from "../content/route-manifest";
import {
  NOTIFICATION_ICON_KEYS,
  checkContactRefs,
  checkConversationRefs,
  checkNotificationRefs,
  checkSocialInstants,
  zContact,
  zConversation,
  zNotification,
  type RouteResolution,
} from "../content/social";
import { DEMO_NOW_ISO } from "../content/core";
import { categories as quizCategoryRows } from "../data/categories";
import { contacts as modelContacts, conversations as modelConversations } from "../data/chat-data";
import { categories as tipCategoryTable, tips } from "../data/creator-tips-data";
import { articlesData } from "../data/knowledge-base-data";
import { categories as newsCategoryTable, newsData } from "../data/news-data";
import { notifications } from "../data/notifications";
import { browseQuizzes } from "../data/browse-quizzes";
import { catalogueAliases, quizShelves, shelvedIds } from "../data/quiz-catalogue";
import { quizAnalytics } from "../data/quiz-analytics";
import { promotions } from "../data/promotions";
import { quizzes as quizRecords } from "../data/quizzes";
import { authoredQuizzes } from "../data/authored-quizzes";
import { createdQuizzes } from "../data/created-quizzes";
import { currentQuiz } from "../data/currentQuiz";
import { mockQuizzes } from "../data/mock-quizzes";
import { searchIndex } from "../data/searchdata";
import { users } from "../lib/data/users";
import { zMediaRegistry } from "../content/media";
import { zLeaderboardRow, zPlayer, zWinEvent } from "../content/people";
import { zMetricTable } from "../content/metrics";
import { media } from "../data/media";
import { affiliateTiers, earningSources, metricTable, streakRewards } from "../data/metrics";
import { battleModes, battleRoundOptions } from "../data/battle-modes";
import { dailyChallengeBadges } from "../data/daily-challenge";
import { quizComments } from "../data/quiz-comments";
import { quizResults } from "../data/quiz-results";
import { quizReviews } from "../data/quiz-reviews";
import { leaderboards, players, winEvents } from "../data/players";
import { promotionFindings } from "./data-check-promotions";
import { peopleFindings } from "./data-check-people";
import { COPY_LITERAL_MAX, copyProblems, measureRoute } from "./copy-refs";
import { pageCopies } from "../data/pages";
import { pageCopyBudget } from "../data/pages/budget";
import { copiedFixtureText, moduleRecordArrays } from "./island-refs";
import {
  breakdownProblems,
  metricKeyProblems,
  rangeProblems,
  renderedTableKeys,
  streakRewardProblems,
  tierBandProblems,
  unusedMetricKeys,
} from "./metric-invariants";
import {
  MODE_RULE,
  battleModeProblems,
  dailyChallengeRewardProblems,
  modeWiringProblems,
} from "./mode-invariants";
import { durationLabels, findMetricLiterals, relativeLabels } from "./metric-refs";
import {
  danglingEntries,
  registryProblems,
  unregisteredFiles,
  unregisteredRefs,
} from "./media-refs";
import {
  assetOf,
  assetReferences,
  findDeadLinks,
  findMissingAssets,
  navigationReferences,
  type SourceFile,
} from "./ui-refs";
import { findTaxonomyLiterals, taxonomyEntries, taxonomyVocabulary } from "./taxonomy-refs";

type Severity = "error" | "warn";
interface Diagnostic {
  code: string;
  severity: Severity;
  message: string;
}

const diagnostics: Diagnostic[] = [];
const err = (code: string, message: string) =>
  diagnostics.push({ code, severity: "error", message });
const warn = (code: string, message: string) =>
  diagnostics.push({ code, severity: "warn", message });

const nodeRequire = createRequire(__filename);

/**
 * The generated fixtures (P3 bulk variation) are gitignored and present only after
 * `pnpm gen`. When the source file exists, its compiled CommonJS module — produced by the
 * same `tsc -p tsconfig.datacheck.json` that compiled this validator — is required and its
 * exported array returned; when it is absent the generated set is simply empty. A present
 * but unloadable module is an E26 error, never a silent skip. (E20 is reserved for WU-5's
 * DUP tier — `docs/P2-INVENTORY.md` — so the generator takes the next free code.)
 */
function loadGenerated<T>(label: string, exportName: string): readonly T[] {
  const source = join(process.cwd(), "data", "generated", `${label}.ts`);
  if (!existsSync(source)) return [];
  let moduleValue: unknown;
  try {
    moduleValue = nodeRequire(join(__dirname, "..", "data", "generated", label));
  } catch (cause) {
    err(
      "E26",
      `data/generated/${label}.ts exists but its compiled module failed to load: ${String(cause)}`,
    );
    return [];
  }
  const value = (moduleValue as Record<string, unknown>)[exportName];
  if (!Array.isArray(value)) {
    err("E26", `data/generated/${label}.ts must export \`${exportName}\` as an array`);
    return [];
  }
  return value as T[];
}

/* ------------------------------------------------------------------ *
 * E0 — per-record schema
 * ------------------------------------------------------------------ */

function validateCollection<T>(
  code: string,
  label: string,
  schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: unknown[] } } },
  records: readonly T[],
): T[] {
  const kept: T[] = [];
  records.forEach((record, index) => {
    const result = schema.safeParse(record);
    if (result.success) kept.push(record);
    else {
      for (const issue of result.error?.issues ?? []) {
        const detail = issue as { path: (string | number)[]; message: string };
        err(code, `${label}[${index}] ${detail.path.join(".") || "(root)"}: ${detail.message}`);
      }
    }
  });
  return kept;
}

const quizzes = validateCollection("E0", "quiz", zQuiz, [...quizRecords]);
const news = validateCollection("E0", "news", zNewsArticle, [...newsData]);
const tipRecords = validateCollection("E0", "tip", zTip, [...tips]);
const kbRecords = validateCollection("E0", "kb", zKbArticle, [...articlesData]);
const contacts = validateCollection("E0", "contact", zContact, [...modelContacts]);
const conversations = validateCollection("E0", "conversation", zConversation, [
  ...modelConversations,
]);
const notificationRecords = validateCollection("E0", "notification", zNotification, [
  ...notifications,
]);

/* the whole taxonomy table, in one pass */
const categoryTable: readonly Category[] = taxonomyTable;
const parsedTable = zCategories.safeParse(categoryTable);
if (!parsedTable.success) {
  for (const issue of parsedTable.error.issues) {
    err("E0", `category table ${issue.path.join(".")}: ${issue.message}`);
  }
}
for (const [label, table] of [
  ["news", newsCategoryTable],
  ["tip", tipCategoryTable],
] as const) {
  for (const row of table) {
    if (!categoryTable.some((category) => category.id === row.id)) {
      err(
        "E0",
        `data/${label}-data re-exports category "${row.id}" which is not in the taxonomy table`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * P3 — generated fixtures (bulk variation), validated when present
 *
 * `pnpm gen` writes `data/generated/quizzes.ts` + `promotions.ts`, which are
 * gitignored. When the files exist the records are folded into every collection
 * check below, so a generated record is held to exactly the same invariants as a
 * hand-authored one; when they are absent `allQuizzes === quizzes` and this
 * validator behaves as it did before P3.
 * ------------------------------------------------------------------ */

const generatedQuizRecords = loadGenerated<Quiz>("quizzes", "generatedQuizzes");
const generatedPromotionRecords = loadGenerated<QuizPromotion>("promotions", "generatedPromotions");
const generatedQuizzes = validateCollection("E0", "generated quiz", zQuiz, [
  ...generatedQuizRecords,
]);
const generatedPromotions = validateCollection("E0", "generated promotion", zQuizPromotion, [
  ...generatedPromotionRecords,
]);
const allQuizzes = [...quizzes, ...generatedQuizzes];
const allPromotions = [...promotions, ...generatedPromotions];

/* ------------------------------------------------------------------ *
 * E1 — ids and slugs are unique
 * ------------------------------------------------------------------ */

function assertUnique<T extends { id: string; slug: string; kind?: string }>(
  code: string,
  label: string,
  rows: readonly T[],
  keyOf: (row: T) => string,
) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    const key = keyOf(row);
    const owner = seen.get(key);
    if (owner) err(code, `${label}: "${key}" is used by both ${owner} and ${row.id}`);
    else seen.set(key, row.id);
  }
}

const articleCollection = zArticleCollection.safeParse({
  news: newsData,
  tips,
  kb: articlesData,
});
if (!articleCollection.success) {
  for (const issue of articleCollection.error.issues)
    err("E1", `article collection: ${issue.message}`);
}
assertUnique(
  "E1",
  "content ids",
  [...allQuizzes, ...news, ...tipRecords, ...kbRecords],
  (row) => row.id,
);
assertUnique(
  "E2",
  "content slugs",
  [...allQuizzes, ...news, ...tipRecords, ...kbRecords],
  (row) => `${row.kind}/${row.slug}`,
);
assertUnique("E1", "category ids", categoryTable, (row) => row.id);

/* ------------------------------------------------------------------ *
 * E3 — the collections the UI joins on
 * ------------------------------------------------------------------ */

const questionOwners = new Map<string, string>();
for (const quiz of allQuizzes) {
  for (const question of quiz.questions) {
    const owner = questionOwners.get(question.id);
    if (owner && owner !== quiz.id)
      err("E3", `question id "${question.id}" in both "${owner}" and "${quiz.id}"`);
    questionOwners.set(question.id, quiz.id);
  }
  if (quiz.status === "published" && quiz.questions.length === 0) {
    warn("W1", `published quiz "${quiz.id}" has no questions`);
  }
  if (quiz.status === "published" && quiz.publishedAt === undefined) {
    warn("W2", `published quiz "${quiz.id}" has no publishedAt (no date is invented for it)`);
  }
  if (quiz.stats.rewardCents !== undefined && quiz.stats.limitedTimeEndsAt === undefined) {
    warn("W4", `quiz "${quiz.id}" offers a reward with no limited-time window`);
  }
  const card = selectQuizCard(quiz, () => undefined);
  if (!zQuizCard.safeParse(card).success)
    err("E3", `quiz "${quiz.id}": selectQuizCard() output is not a QuizCard`);
}

/* ------------------------------------------------------------------ *
 * E11 — the card shelves resolve against the one collection
 *
 * A shelf is the only authored thing left about a card grid: an ordered list of
 * quiz ids. A typo would render an empty carousel, so it fails here instead. The
 * reverse direction matters too: a card-only browse record no shelf shows is a
 * fixture that exists only to satisfy its own type.
 *
 * The ids resolve against `data/quizzes.ts` — the one collection — not against a
 * catalogue of its own. That is the point of the reconciliation: a shelf cannot be
 * right about a quiz the collection does not hold.
 * ------------------------------------------------------------------ */

const collectionIds = new Set(quizzes.map((quiz) => quiz.id));
for (const [shelf, ids] of Object.entries(quizShelves)) {
  for (const id of ids) {
    if (!collectionIds.has(id)) err("E11", `shelf "${shelf}" references unknown quiz "${id}"`);
  }
}
const shelved = new Set(shelvedIds);

for (const quiz of browseQuizzes) {
  if (!shelved.has(quiz.id)) warn("W5", `browse quiz "${quiz.id}" is on no shelf`);
  if (!zQuizAuthoringCard.safeParse(selectQuizAuthoringCard(quiz, () => undefined)).success) {
    err("E3", `quiz "${quiz.id}": selectQuizAuthoringCard() output is not a QuizAuthoringCard`);
  }
}

/* ------------------------------------------------------------------ *
 * E12 — one record per subject
 *
 * The failure mode D2 exists to remove, encoded so it cannot come back: the card
 * grids held 7 cards under ids they invented while the migration held the same
 * cards under the frozen §8 ids. E1 only sees ids, so both trees were "valid" and
 * the collection would have shown two cards with one title.
 *
 * The key is the lifted title, normalised (`&` -> `and`, punctuation and case
 * dropped). It is a *subject* key, not a join key: two records for one card never
 * legitimately share one.
 * ------------------------------------------------------------------ */

const subjectKey = (title: string) =>
  title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
assertUnique("E12", "quiz subjects", allQuizzes, (row) => subjectKey(row.title));

/** An alias is only evidence while it stays out of the collection: if one is ever
 *  added back as a record, E12 above catches the duplicate title — this catches the
 *  quieter case where the alias record's title was also edited. */
for (const [alias, target] of Object.entries(catalogueAliases)) {
  if (collectionIds.has(alias)) err("E12", `catalogue alias "${alias}" is also a record`);
  if (!collectionIds.has(target))
    err("E12", `catalogue alias "${alias}" points at missing "${target}"`);
}

/* ------------------------------------------------------------------ *
 * E13 — every analytics key names a record
 *
 * Analytics is keyed by record id. A key that names no record is a snapshot of a
 * quiz the collection does not have: the surface renders "no data" forever without
 * failing anything. The card grids keyed `Sports Trivia Challenge` by an invented
 * id exactly once, and that is the case this invariant exists for.
 * ------------------------------------------------------------------ */

for (const quizId of Object.keys(quizAnalytics)) {
  if (!collectionIds.has(quizId)) err("E13", `analytics key "${quizId}" is not a record`);
}

/* ------------------------------------------------------------------ *
 * E14/E15/E16/E17/W6 — the promotion overlays (B-01, P3)
 *
 * The collection rules a single overlay cannot see: the join and the identity
 * (E14), the window and the prize (E15), concurrent overlays agreeing field-wise
 * (E16), the slot actually being a place a shelf renders (E17 — the rule that
 * stops a campaign from silently never running), and a campaign staged outside
 * the quiz's published life (W6, a warning — preparing a campaign against a
 * draft is legitimate).
 *
 * Issue #27 numbered these E11/E12/E13, which are already taken above (shelves,
 * one record per subject, analytics keys), so they continue the set. The checks
 * themselves live in `scripts/data-check-promotions.ts` and every one of them has
 * a negative case in `scripts/__tests__/promotion-invariants.test.ts`.
 * ------------------------------------------------------------------ */

for (const finding of promotionFindings(allPromotions, allQuizzes)) {
  diagnostics.push({ code: finding.rule, severity: finding.severity, message: finding.message });
}

/* ------------------------------------------------------------------ *
 * E4 — category scope: a record may only point at its own vocabulary
 * ------------------------------------------------------------------ */

const scopeProblems = assertCategoryScopes(
  [...allQuizzes, ...news, ...tipRecords, ...kbRecords],
  categoryTable,
);
for (const problem of scopeProblems) err("E4", problem);

for (const problem of assertRenderableCategories(quizCategoryTable)) warn("W3", problem);

const categoryIds = new Set(categoryTable.map((row) => row.id));
for (const row of quizCategoryRows) {
  if (!categoryIds.has(row.id))
    err("E4", `data/categories row "${row.id}" is not in the taxonomy table`);
  if (row.count < 0) err("E4", `data/categories row "${row.id}" has a negative derived count`);
}

/* ------------------------------------------------------------------ *
 * E5/E6 — social referential integrity
 * ------------------------------------------------------------------ */

function resolveRoute(link: string): RouteResolution {
  const normalized = normalizePath(link);
  if (normalized === null) return { ok: false, reason: `"${link}" is not a normalized path` };
  const match = matchRoute(routeManifest, normalized);
  if (!match) return { ok: false, reason: `no route matches ${normalized}` };
  // A dynamic match only counts when the value is a real record, which is what the
  // old `/profile/achievements` link got wrong: it matched `/profile/[username]`
  // and would have rendered the profile of a user named "achievements".
  if (match.kind === "dynamic") {
    const segments = normalized.split("/").filter(Boolean);
    const pattern = match.pattern.split("/").filter(Boolean);
    for (let i = 0; i < pattern.length; i += 1) {
      if (!/^\[.+\]$/.test(pattern[i])) continue;
      const value = segments[i];
      if (pattern[i] === "[username]" && !users.some((user) => user.username === value)) {
        return { ok: false, reason: `"${value}" is not a known username` };
      }
      if (pattern[i] === "[id]" && !knownIds.has(value)) {
        return { ok: false, reason: `"${value}" is not a known record id` };
      }
    }
  }
  return { ok: true, pattern: match.pattern };
}

const knownIds = new Set<string>([
  ...quizzes.map((quiz) => quiz.id),
  ...quizzes.map((quiz) => quiz.slug),
  ...news.map((article) => article.slug),
  ...tipRecords.map((article) => article.slug),
  ...kbRecords.map((article) => article.id),
  ...categoryTable.map((row) => row.slug),
]);

for (const issue of checkContactRefs(contacts))
  err("E5", `contact "${issue.id}" ${issue.field}: ${issue.reason}`);
for (const issue of checkConversationRefs(conversations)) {
  err("E6", `conversation "${issue.id}" ${issue.field}: ${issue.reason}`);
}
for (const issue of checkNotificationRefs(notificationRecords, {
  resolveRoute,
  iconKeys: NOTIFICATION_ICON_KEYS,
})) {
  err("E5", `notification "${issue.id}" ${issue.field}: ${issue.reason}`);
}
for (const conversation of conversations) {
  if (!contacts.some((contact) => contact.id === conversation.contactId)) {
    err(
      "E6",
      `conversation "${conversation.id}" references unknown contact "${conversation.contactId}"`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * E7 — the route manifest matches the filesystem, both directions
 * ------------------------------------------------------------------ */

function walkRoutes(dir: string, prefix = ""): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith("_") || entry.endsWith(".test")) continue;
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // Route groups `(mainlayout)` and `(auth)` do not appear in the URL.
    const segment = /^\(.+\)$/.test(entry) ? "" : `/${entry}`;
    const next = `${prefix}${segment}`;
    const hasPage = readdirSync(full).includes("page.tsx");
    if (hasPage) found.push(next === "" ? "/" : next);
    found.push(...walkRoutes(full, next));
  }
  return found;
}

const filesystemRoutes = walkRoutes(join(process.cwd(), "app")).sort();
const manifestRoutes = [...ROUTE_PATTERNS].sort();
for (const route of filesystemRoutes) {
  if (!manifestRoutes.includes(route))
    err("E7", `app/ has a page at ${route} that content/routes.ts does not list`);
}
for (const route of manifestRoutes) {
  if (!filesystemRoutes.includes(route))
    err("E7", `content/routes.ts lists ${route} but app/ has no page for it`);
}

/* ------------------------------------------------------------------ *
 * E8 — the search index is derived, and every row resolves
 * ------------------------------------------------------------------ */

const indexProblems: string[] = [];
for (const row of searchIndex.quizzes) {
  if (!knownIds.has(row.id)) indexProblems.push(`quiz row "${row.id}" names no quiz`);
}
for (const row of searchIndex.categories) {
  if (!categoryIds.has(row.id)) indexProblems.push(`category row "${row.id}" names no category`);
}
for (const row of searchIndex.pages) {
  if (!routeManifest.pages.some((page) => page.path === row.path)) {
    indexProblems.push(`page row "${row.id}" is not a curated page`);
  }
}
for (const problem of indexProblems) err("E8", problem);

/* ------------------------------------------------------------------ *
 * E9 — exactly one Quiz type
 *
 * D1 was two hand-written `Quiz` interfaces imported under the same name.
 * `content/quiz.ts` is now the only definition; keep the legacy file from
 * coming back, and keep the replacement from being deleted (the positive
 * control: without it this check would pass on an empty tree).
 * ------------------------------------------------------------------ */

const legacyQuizType = join(process.cwd(), "types", "quiz.ts");
if (existsSync(legacyQuizType)) {
  err(
    "E9",
    "types/quiz.ts exists again: a second `Quiz` interface reintroduces drift D1. Import the type from content/quiz.ts instead.",
  );
}
if (!existsSync(join(process.cwd(), "content/quiz.ts"))) {
  err("E9", "content/quiz.ts is missing: the single source of truth for the Quiz type is gone");
}

/**
 * The same drift in one file: a component that declares its own `Quiz` looks like
 * the model but is hand-maintained against it (`components/quiz/quiz-play.tsx` did).
 * Renderer-local *views* stay legal — they just may not be called `Quiz`.
 *
 * The lookahead is load-bearing: a *declaration* is always followed by `{`, `=`, `<`
 * or `extends`, while `import { type Quiz }` / `type Quiz,` inside an import list is
 * a use of the model's type and must stay legal (`lib/quiz-cards.ts` re-exports it).
 */
const QUIZ_DECLARATION =
  /^[ \t]*(?:export[ \t]+)?(?:interface|type)[ \t]+Quiz\b(?=[ \t]*(?:[={<]|extends\b))/m;

function walkSourceFiles(dir: string): string[] {
  const found: string[] = [];
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      found.push(...walkSourceFiles(full));
      continue;
    }
    if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

for (const root of ["components", "app", "lib", "hooks"]) {
  for (const file of walkSourceFiles(join(process.cwd(), root))) {
    const declaration = QUIZ_DECLARATION.exec(readFileSync(file, "utf8"));
    if (declaration) {
      const where = file.slice(process.cwd().length + 1);
      err(
        "E9",
        `${where}: declares its own \`Quiz\` (${declaration[0].trim()}). Drift D1 — import the type, or name the local view something else.`,
      );
    }
  }
}

/* ------------------------------------------------------------------ *
 * E10 — no route exports a metadata function Next never reads
 *
 * D14 was `export function Metadata(...)` on categories/[slug]: the right body
 * under a name Next ignores, so the route shipped the layout title and the
 * function was dead code. The same bug had already been fixed by hand once
 * (creator-tips/[slug] exported `GenerateMetadata`). Next reads exactly two
 * forms — `generateMetadata` (async) and `metadata` (a value) — so any other
 * metadata-shaped export is dead. The positive control keeps this check from
 * passing on a page that lost its metadata export entirely.
 * ------------------------------------------------------------------ */

const DEAD_METADATA_EXPORT =
  /^export\s+(?:async\s+)?(?:function\s+|const\s+)(Metadata|GenerateMetadata|GetMetadata|getMetadata)\b/m;
const METADATA_EXPORT =
  /^export\s+(?:async\s+)?(?:function\s+|const\s+)(generateMetadata|metadata)\b/m;

function walkRouteFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry.startsWith(".") || entry === "node_modules") continue;
    if (statSync(full).isDirectory()) {
      found.push(...walkRouteFiles(full));
    } else if (entry === "page.tsx" || entry === "layout.tsx") {
      found.push(full);
    }
  }
  return found;
}

const routeFiles = walkRouteFiles(join(process.cwd(), "app"));
for (const file of routeFiles) {
  const dead = DEAD_METADATA_EXPORT.exec(readFileSync(file, "utf8"));
  if (dead) {
    err(
      "E10",
      `${relative(process.cwd(), file)} exports \`${dead[1]}\`, which Next never reads (D14). Export \`generateMetadata\` instead.`,
    );
  }
}

const categoryRoute = join(
  process.cwd(),
  "app",
  "(mainlayout)",
  "categories",
  "[slug]",
  "page.tsx",
);
const categoryRouteSource = existsSync(categoryRoute) ? readFileSync(categoryRoute, "utf8") : "";
if (!METADATA_EXPORT.test(categoryRouteSource)) {
  err(
    "E10",
    "app/(mainlayout)/categories/[slug]/page.tsx exports no `generateMetadata` or `metadata`: the D14 fix is missing or regressed",
  );
}

/* ------------------------------------------------------------------ *
 * E10 — the hardcoded references in the shell resolve
 *
 * E5/E6/E8 prove the links the *model* emits. The links a user clicks in the
 * header, sidebar and footer are written inline in components, so nothing saw
 * `/dashboard`, `/signup`, `/earnings` or `/analytics` 404 while every gate
 * stayed green (issue #20). Same for the avatar that pointed at a
 * `public/testimonials/jessica.png` that never existed.
 *
 * Scan every literal `href`, `router.push`/`replace` and `redirect`, resolve it
 * against the route manifest, and scan every `public/` asset literal against the
 * filesystem. Dynamic values (`href={item.href}`, template literals) are skipped:
 * the model already proves those.
 * ------------------------------------------------------------------ */

const UI_ROOTS = ["components", "app"];

function walkSources(root: string, dir = join(process.cwd(), root), files: SourceFile[] = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".datacheck") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSources(root, full, files);
      continue;
    }
    if (!entry.endsWith(".tsx") && !entry.endsWith(".ts")) continue;
    files.push({ path: full.slice(process.cwd().length + 1), source: readFileSync(full, "utf8") });
  }
  return files;
}

const uiSources = UI_ROOTS.flatMap((root) => {
  const dir = join(process.cwd(), root);
  if (!existsSync(dir)) {
    err("E10", `${root}/ is missing: the hardcoded-reference scan has nothing to read`);
    return [];
  }
  return walkSources(root);
});

const deadLinkRefs = findDeadLinks(
  uiSources,
  (route) => matchRoute(routeManifest, route) !== undefined,
);
for (const dead of deadLinkRefs) {
  err(
    "E10",
    `${dead.file}:${dead.line} links "${dead.value}", which no route in content/routes.ts resolves — point it at an existing page or add the route (app/ + content/routes.ts)`,
  );
}
if (uiSources.length === 0) {
  err("E10", "the hardcoded-reference scan read 0 files: components/ and app/ were not walked");
}

const missingAssets = findMissingAssets(uiSources, (asset) =>
  existsSync(join(process.cwd(), "public", asset)),
);
for (const missing of missingAssets) {
  err(
    "E10",
    `${missing.file}:${missing.line} references "${missing.value}", which is not in public/ — add the file or point at an existing one (a 404 image is invisible to every other gate)`,
  );
}

/* ------------------------------------------------------------------ *
 * E17/E18/E19 — the media registry is the only way to address a file
 *
 * E10 proved a literal path was not a 404. It could not prove the *model* owned the
 * asset: 280 literal paths (27 distinct files) sat in JSX while `public/` held 103 files,
 * so a fixture swap could never change what a page showed and nobody noticed, because the
 * paths all resolved. Three checks close that:
 *
 *   E17  no `components/**` or `app/**` file writes a `public/` asset path at all — a
 *        component asks the registry for a key (`media["quiz.q1"].src`).
 *   E18  registry <-> disk is a bijection, both directions, plus the map's own integrity
 *        (path-derived key, one key per file, real dimensions).
 *   E19  every `ImageRef.src` a fixture carries equals a registry `src` (decision D-P2-1:
 *        the fixture still holds a path in P2, so this is what keeps it honest).
 *
 * The registry is generated (`node scripts/gen-media.mjs`) precisely so E18 stays a
 * zero-config check: adding a file is a one-command fix, and forgetting is a red build.
 * ------------------------------------------------------------------ */

const registry = media as unknown as Record<string, (typeof media)[keyof typeof media]>;
const parsedRegistry = zMediaRegistry.safeParse(registry);
if (!parsedRegistry.success) {
  for (const issue of parsedRegistry.error.issues) {
    err("E0", `media ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
}

for (const problem of registryProblems(registry)) err("E18", problem);

for (const problem of danglingEntries(registry, (src) =>
  existsSync(join(process.cwd(), "public", assetOf(src))),
)) {
  err("E18", problem);
}

function walkPublic(dir = join(process.cwd(), "public"), files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkPublic(full, files);
    else
      files.push(
        full
          .slice(join(process.cwd(), "public").length + 1)
          .split("\\")
          .join("/"),
      );
  }
  return files;
}

const publicFiles = existsSync(join(process.cwd(), "public")) ? walkPublic() : [];
if (publicFiles.length === 0) {
  err("E18", "public/ is empty or missing: the registry<->disk check has nothing to compare");
}
for (const file of unregisteredFiles(registry, publicFiles)) {
  err(
    "E18",
    `public/${file} has no media registry key — run \`node scripts/gen-media.mjs\` so a component can address it, or delete the file if nothing uses it`,
  );
}

for (const literal of assetReferences(uiSources)) {
  err(
    "E17",
    `${literal.file}:${literal.line} writes the media path "${literal.value}" — read it from the registry instead (media["<key>"].src, data/media.ts)`,
  );
}

/**
 * Every `ImageRef` reachable from a fixture, found structurally: the shape is
 * `{ src, alt }` (the strict schema in `content/core.ts`). Walking the imported records
 * rather than grepping `data/` means a ref assembled at runtime is still checked, and a
 * ref inside a nested block (a question's media, a person's avatar) is found too.
 * `data/media.ts` is skipped on purpose: it *is* the registry.
 */
function imageRefs(node: unknown, where: string, found: { where: string; src: string }[] = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      imageRefs(item, `${where}[${index}]`, found);
    });
  } else if (node !== null && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typeof record.src === "string" && typeof record.alt === "string") {
      found.push({ where, src: record.src });
    }
    for (const [key, value] of Object.entries(record)) {
      if (value !== null && typeof value === "object") imageRefs(value, `${where}.${key}`, found);
    }
  }
  return found;
}

const fixtureImageRefs = [
  ...imageRefs(quizzes, "data/quizzes"),
  ...imageRefs(generatedQuizzes, "data/generated/quizzes"),
  ...imageRefs(news, "data/news-data"),
  ...imageRefs(tipRecords, "data/creator-tips-data"),
  ...imageRefs(kbRecords, "data/knowledge-base-data"),
  ...imageRefs(contacts, "data/chat-data"),
  ...imageRefs(conversations, "data/chat-data"),
  ...imageRefs(notificationRecords, "data/notifications"),
  ...imageRefs(promotions, "data/promotions"),
].filter((ref) => ref.src.startsWith("/"));

for (const problem of unregisteredRefs(registry, fixtureImageRefs)) err("E19", problem);

/*
 * Five fixture covers retired by E19 when this rule landed, recorded here so the deletion is
 * not mistaken for an accident: `/easy-quiz-1.png`, `/easy-quiz-2.png`, `/easy-quiz-3.png`
 * (data/authored-quizzes.ts), `/history-quiz.png` (data/currentQuiz.ts) and `/quiz/q16.png`
 * (data/browse-quizzes.ts) were paths `public/` never held. `cover` is optional on the schema,
 * so the record keeps its identity and loses a reference that was already a 404. Restoring a
 * cover means adding the file (then `node scripts/gen-media.mjs`); inventing one here would
 * have made the registry describe a file that does not exist, which is what E18 forbids.
 */

/* ------------------------------------------------------------------ *
 * E22/E25 — a rendered number comes from a MetricSnapshot
 *
 * E10/E17 proved a *reference* resolves. A number was invisible to every check: `+4 from last
 * month`, `$124.50`, `Save 20%` resolve by definition, so 69 of them sat in JSX while
 * `data/quiz-analytics.ts` carried per-quiz completion only (issue #49, WU-4). Two rules close
 * that, and they are deliberately paired — a rule without a fixture is untestable, a fixture
 * without a rule drifts:
 *
 *   E22  no metric literal in `components/**` or `app/**`. A rendered quantity (a percent, an
 *        amount, a signed delta, a compressed count, a count with a unit) is the fixture's to
 *        supply and `content/metrics.ts`'s to format. The scan is AST-based (`metric-refs.ts`),
 *        so `{formatCurrency(cents)}` is invisible to it — that is the shape the fix takes.
 *   E25  the fixture is honest: a key names `owner.name`, every key is rendered somewhere (a
 *        snapshot nothing reads is drift), and the tables add up — a breakdown's cents equal
 *        its total and its shares equal 100, tier bands tile without a gap, streak rewards
 *        climb.
 *
 * The two classes E22 leaves out are counted, not hidden: relative instants (`2 hours ago`)
 * belong to the fixture clock (`DEMO_NOW_ISO` + `formatRelative`) and durations (`Last 30
 * days`, `5 seconds` from a picker) to the window/control that owns them. Both print on the
 * pass line so the gap stays visible in every run instead of being discovered later.
 * ------------------------------------------------------------------ */

const metricLiterals = findMetricLiterals(uiSources);
for (const literal of metricLiterals) {
  err(
    "E22",
    `${literal.file}:${literal.line} renders "${literal.value}" — a metric literal (${literal.kind}). ` +
      "The value belongs in `data/metrics.ts` as a MetricSnapshot and the string in " +
      "`content/metrics.ts` (`formatMetricValue` / `formatMetricDelta` / `formatDeltaWithPeriod`)",
  );
}

const parsedMetrics = zMetricTable.safeParse(metricTable);
if (!parsedMetrics.success) {
  for (const issue of parsedMetrics.error.issues) {
    err("E25", `data/metrics.ts ${issue.path.join(".")}: ${issue.message}`);
  }
}

for (const problem of metricKeyProblems(metricTable)) err("E25", problem);
for (const problem of unusedMetricKeys(
  metricTable,
  uiSources,
  renderedTableKeys(
    [
      { name: "affiliateTiers", keys: affiliateTiers.map((tier) => tier.rate) },
      { name: "earningSources", keys: earningSources.map((source) => source.amount) },
      { name: "streakRewards", keys: [] },
    ],
    uiSources,
  ),
)) {
  err("E25", problem);
}

for (const problem of breakdownProblems(metricTable["dashboard.balance"]?.value ?? 0, [
  ...earningSources.map((source) => ({
    label: source.label,
    amountCents: metricTable[source.amount]?.value ?? 0,
    sharePct: source.sharePct,
  })),
])) {
  err("E25", problem);
}

for (const problem of tierBandProblems(
  affiliateTiers.map((tier) => ({
    id: tier.id,
    from: tier.from,
    to: tier.to,
    ratePct: metricTable[tier.rate]?.value ?? 0,
  })),
)) {
  err("E25", problem);
}

for (const problem of streakRewardProblems(streakRewards)) err("E25", problem);

for (const problem of rangeProblems(
  "the group battle player range",
  battleModes.find((mode) => mode.id === "group")?.playersMin ?? 0,
  battleModes.find((mode) => mode.id === "group")?.playersMax ?? 0,
)) {
  err("E25", problem);
}

if (metricLiterals.length === 0 && Object.keys(metricTable).length === 0) {
  err(
    "E22",
    "the metric scan found 0 literals and data/metrics.ts holds 0 snapshots: the scan walked no sources or the fixture was not parsed",
  );
}

/* ------------------------------------------------------------------ *
 * E27 — a mode is a record, and the record is the one the page renders
 *
 * WU-10 moved `/battle`'s mode list and `/daily-challenge`'s badge set out of the
 * components. A fixture is not a gate: a mode whose `questionCount` is not one of the
 * lengths its `<Select>` offers renders a control showing no selection, and a fixture
 * nothing imports leaves the page rendering the literals it was meant to replace while
 * every other check stays green. So: the mode set has the ids the page branches on,
 * each default is an offered option, the only description placeholder is `{players}`,
 * the badge ids are unique, and each surface imports its fixture.
 *
 * `data/battle-modes.ts` owns the roster range now, so E25's "group battle is a range"
 * check reads it there instead of `metricTable` (see the call above).
 * ------------------------------------------------------------------ */

for (const problem of battleModeProblems(battleModes, battleRoundOptions)) {
  err(MODE_RULE, problem);
}

for (const problem of dailyChallengeRewardProblems(dailyChallengeBadges)) {
  err(MODE_RULE, problem);
}

for (const problem of modeWiringProblems(
  uiSources,
  "components/battle",
  "battleModes",
  "data/battle-modes",
)) {
  err(MODE_RULE, problem);
}

for (const problem of modeWiringProblems(
  uiSources,
  "components/daily-challenge",
  "dailyChallengeBadges",
  "data/daily-challenge",
)) {
  err(MODE_RULE, problem);
}

/* ------------------------------------------------------------------ *
 * E20 — no component types a label the model already owns
 *
 * E17/E18/E19 made a *file path* the registry's business. This is the same rule one
 * layer up: a category name, a quiz title and a badge label are the fixtures' business.
 * The shape it forbids is a whole node — `<span>Science</span>`, `label="Science"` —
 * because that is exactly the copy that drifts: rename the subject in
 * `content/categories.ts` and the page keeps saying the old name while typecheck, lint,
 * data:check and build all stay green (docs/P2-INVENTORY.md, DUP tier: 26 hits).
 *
 * The vocabulary is built from the model here, never from the component tree, so the
 * scan cannot agree with the code it is checking. Record-shaped literals inside a
 * component-level mock (`category: "Science"`) are E21's business, not this rule's.
 *
 * Quiz scope only, on purpose: the editorial categories (`news`/`tip`/`kb`) are ordinary
 * prose words — a chat settings tab called "Privacy" is not the `kb-privacy` category, and
 * "Tournaments" is a nav label in three places — so a whole-node rule over them reports
 * chrome, not a duplicated label. Their copy is the editorial work units' business.
 * ------------------------------------------------------------------ */

const taxonomy = taxonomyVocabulary(
  taxonomyEntries({
    categories: quizSubjects,
    quizzes: [
      ...quizRecords,
      ...browseQuizzes,
      ...authoredQuizzes,
      ...mockQuizzes,
      ...createdQuizzes,
      currentQuiz,
    ],
    badges: promotions,
  }),
);

for (const literal of findTaxonomyLiterals(uiSources, taxonomy)) {
  err(
    "E20",
    `${literal.file}:${literal.line} types the ${literal.kind} label "${literal.label}", which "${literal.owner}" already owns — render it from ${literal.from} instead of writing it again`,
  );
}

/* ------------------------------------------------------------------ *
 * E23 — page copy lives in a fixture, and the budget only goes down
 *
 * The inventory found 1,809 page-copy strings with no home. A number in a document
 * is not a gate, so this is the gate: for each route with a `PageCopy` fixture,
 * attribute the files the route actually renders (its page module plus the import
 * closure inside the directories the route declares), extract the literals they
 * still write, and compare against the recorded budget.
 *
 * Two rules, because one cannot do the job:
 *
 *   leaf rule   a literal longer than COPY_LITERAL_MAX chars is a sentence, and a
 *               sentence in a component is an error on its own — the diagnostic
 *               names `file:line` and the fixture, so the fix is mechanical.
 *   budget      the *count* may not rise, including short labels. That is what
 *               makes the ratchet a ratchet: every later copy unit lowers one number
 *               and cannot quietly re-add a label to buy headroom.
 *
 * Attribution is by reachability, not by directory listing: a file in `components/home/`
 * that no page imports is not this route's copy, and counting it would make two cards
 * fight over one number — deleting a dead component would look like a budget regression.
 *
 * The same pass proves the fixture is wired (reachable from the page module) and that
 * every id a component asks for exists in the fixture — `sectionOf(copy, "x")` and
 * `itemLabel(copy, "y")` throw at runtime, so a typo would otherwise be a blank band.
 * ------------------------------------------------------------------ */

const copySources: SourceFile[] = [...uiSources, ...walkSources("data")];

for (const finding of copyProblems({
  copies: pageCopies,
  budget: pageCopyBudget,
  sources: copySources,
  routePatterns: ROUTE_PATTERNS,
  resolves: (href) => resolveRoute(href).ok,
})) {
  err(finding.code, finding.message);
}

/** Measured per route, so the summary prints what the tree actually contains. */
const copyMeasured = Object.entries(pageCopyBudget).map(([route, entry]) => ({
  route,
  budget: entry.budget,
  measured: measureRoute(entry, copySources).literals.length,
}));

/* ------------------------------------------------------------------ *
 * E24 — the quiz activity resolves against the quiz it names
 *
 * The quiz surface (detail page, review screen, discussions feed) reads three
 * collections joined by id: results, comments, reviews. A dangling `quizId` does
 * not throw — it renders an empty page, which is the failure mode that makes a
 * fixture look finished while the page is blank. So the join is checked here.
 *
 *   * every `result.quizId` / `comment.quizId` / `review.quizId` names a `Quiz`;
 *   * every `comment.questionId` names a question of THAT quiz, and a reply's
 *     parent is a top-level comment on the same quiz (one level, like the UI);
 *   * every answer in a sheet names a question of that quiz and, when the player
 *     did not skip, an option of that question — an answer key pointing at a
 *     renamed option is exactly the drift the option-id rule (D4) exists to stop;
 *   * `score.total` never exceeds the quiz's question count, so a 10-answer result
 *     cannot hang off a 5-question record;
 *   * no instant is after the fixture clock — a card dated in the future renders
 *     "in 2 days", the same defect E10 blocks for the social fixtures.
 *
 * Numbering: E20–E23 are reserved by `docs/P2-INVENTORY.md` (DUP / MOCK / METRIC /
 * PageCopy), so the next free code is E24 rather than reusing a reserved one.
 * ------------------------------------------------------------------ */

const activityResults = validateCollection("E0", "quiz result", zQuizResult, [...quizResults]);
const activityComments = validateCollection("E0", "quiz comment", zQuizComment, [...quizComments]);
const activityReviews = validateCollection("E0", "quiz review", zQuizReview, [...quizReviews]);

const recordById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
const questionIdsOf = new Map(
  quizzes.map((quiz) => [
    quiz.id,
    new Map(quiz.questions.map((question) => [question.id, question])),
  ]),
);

const uniqueIds = (code: string, label: string, rows: readonly { id: string }[]) => {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) err(code, `${label}: duplicate id "${row.id}"`);
    seen.add(row.id);
  }
};
uniqueIds("E24", "quiz result", activityResults);
uniqueIds("E24", "quiz comment", activityComments);
uniqueIds("E24", "quiz review", activityReviews);

for (const result of activityResults) {
  const quiz = recordById.get(result.quizId);
  if (quiz === undefined) {
    err("E24", `result "${result.id}" references unknown quiz "${result.quizId}"`);
    continue;
  }
  if (result.score.total > quiz.questions.length) {
    err(
      "E24",
      `result "${result.id}" scores out of ${result.score.total}, but quiz "${quiz.id}" has ${quiz.questions.length} question(s)`,
    );
  }
  const questions = questionIdsOf.get(quiz.id) ?? new Map<string, Question>();
  for (const answer of result.answers ?? []) {
    const question = questions.get(answer.questionId);
    if (question === undefined) {
      err(
        "E24",
        `result "${result.id}" answers "${answer.questionId}", which is not a question of "${quiz.id}"`,
      );
      continue;
    }
    if (
      answer.selectedOptionId !== null &&
      !question.options.some((option) => option.id === answer.selectedOptionId)
    ) {
      err(
        "E24",
        `result "${result.id}" selects option "${answer.selectedOptionId}" on "${question.id}" (options: ${question.options.map((option) => option.id).join(", ")})`,
      );
    }
  }
  if (new Date(result.completedAt).getTime() > new Date(DEMO_NOW_ISO).getTime()) {
    err("E24", `result "${result.id}" completed after the fixture clock (${DEMO_NOW_ISO})`);
  }
}

const commentById = new Map(activityComments.map((comment) => [comment.id, comment]));
for (const comment of activityComments) {
  const quiz = recordById.get(comment.quizId);
  if (quiz === undefined) {
    err("E24", `comment "${comment.id}" references unknown quiz "${comment.quizId}"`);
  } else if (comment.questionId !== undefined) {
    const questions = questionIdsOf.get(quiz.id) ?? new Map<string, Question>();
    if (!questions.has(comment.questionId)) {
      err(
        "E24",
        `comment "${comment.id}" is about "${comment.questionId}", which is not a question of "${quiz.id}"`,
      );
    }
  }
  if (comment.parentId !== undefined) {
    const parent = commentById.get(comment.parentId);
    if (parent === undefined) {
      err("E24", `comment "${comment.id}" replies to unknown comment "${comment.parentId}"`);
    } else if (parent.quizId !== comment.quizId) {
      err(
        "E24",
        `comment "${comment.id}" replies across quizzes ("${parent.quizId}" → "${comment.quizId}")`,
      );
    } else if (parent.parentId !== undefined) {
      err("E24", `comment "${comment.id}" is a reply to a reply — threads are one level`);
    }
  }
  if (new Date(comment.createdAt).getTime() > new Date(DEMO_NOW_ISO).getTime()) {
    err("E24", `comment "${comment.id}" created after the fixture clock (${DEMO_NOW_ISO})`);
  }
}

for (const review of activityReviews) {
  if (!recordById.has(review.quizId)) {
    err("E24", `review "${review.id}" references unknown quiz "${review.quizId}"`);
  }
  if (new Date(review.createdAt).getTime() > new Date(DEMO_NOW_ISO).getTime()) {
    err("E24", `review "${review.id}" created after the fixture clock (${DEMO_NOW_ISO})`);
  }
}

/* ------------------------------------------------------------------ *
 * E21 — no component authors a search result or a chat message
 *
 * The P2 inventory found 68 literals in WU-3 alone: `components/search/search-results.tsx`
 * carried 8 quizzes, 6 categories, 4 creators and 4 pages, and `components/chat/chat-window.tsx`
 * carried 5 contacts and 6 messages. Not one of those rows existed in `data/`, so no fixture
 * edit could reach them — the same failure the media registry (E17) closed for files.
 *
 * Two rules, because the defect has two shapes:
 *
 *   islands   a module-scope array of ≥ 2 record objects in `components/search/**` or
 *             `components/chat/**`. Those are the two surfaces whose collections are derived
 *             (`buildSearchIndex`, `data/chat-data.ts`), so an island there is a second
 *             catalog by construction. The other feature directories still hold islands that
 *             their own work unit removes; this check widens to all of `components/**` when
 *             the last of them lands (E21 in docs/P2-INVENTORY.md is the whole-tree rule).
 *   copies    a quiz title from the search index, or a chat message body from
 *             `data/chat-data.ts`, written into one of the components that render them — as a
 *             literal, a JSX text node or a comment. No baseline on these files: the count is
 *             0 now, so every hit is a new copy.
 *
 * The scan itself is repo-wide and the remainder is *counted*, not ignored: 17 quiz titles are
 * still written into `/profile`, `/quiz/*`, `/my-quizzes/*`, `/tournaments` and `/daily-challenge`
 * components that their own units own. The summary line prints that number every run, so it
 * ratchets down instead of disappearing.
 * ------------------------------------------------------------------ */

const E21_ISLAND_SURFACES = ["components/search/", "components/chat/"];

/** The components that render search results or chat rows — the files E21 binds today. */
const E21_COPY_SURFACES = [...E21_ISLAND_SURFACES, "components/layout/header.tsx"];

const searchChatIslands = moduleRecordArrays(uiSources).filter((island) =>
  E21_ISLAND_SURFACES.some((surface) => island.file.startsWith(surface)),
);
for (const island of searchChatIslands) {
  err(
    "E21",
    `${island.file}:${island.line} declares the module-level array "${island.name}" (${island.records} records) — a collection belongs in data/ (or is derived in content/); import it and render it, never paste it`,
  );
}

const fixtureText = [
  ...searchIndex.quizzes.map((row) => row.title),
  ...conversations.flatMap((conversation) =>
    conversation.messages.map((message) => message.body ?? ""),
  ),
];
const fixtureCopies = copiedFixtureText(uiSources, fixtureText);
const ownedCopies = fixtureCopies.filter((copy) =>
  E21_COPY_SURFACES.some((surface) => copy.file === surface || copy.file.startsWith(surface)),
);
for (const copy of ownedCopies) {
  err(
    "E21",
    `${copy.file}:${copy.line} writes "${copy.value}", which is a fixture row — render it from data/searchdata.ts (buildSearchIndex) or data/chat-data.ts instead of copying it`,
  );
}

/** Debt on surfaces another work unit owns: measured and printed, never silently allowed. */
const e21DebtCopies = fixtureCopies.length - ownedCopies.length;

/* ------------------------------------------------------------------ *
 * E24 — the people and leaderboard fixture resolves
 *
 * Six surfaces (`/leaderboard` ×3, `/daily-challenge`, the two home widgets) each authored
 * their own records: 107 literals in eight files, and no fixture could reach one of them.
 * `content/people.ts` now owns `Player`, `LeaderboardRow` and `WinEvent`; this is the half a
 * single record cannot prove — that a row's `playerId` is a player, that a win's `quizId` is
 * a quiz, that a player's `avatarKey` is a registered **avatar** file, that a board's ranks
 * match its positions, and that a board carrying movement is ordered by it. Every one of
 * those failures renders a plausible page (a board one person short, a crown on the wrong
 * head, a payout for a quiz nobody can play) which is why they are errors, not warnings.
 *
 * The per-record pass is E0 like every other collection; the rules themselves live in
 * `scripts/data-check-people.ts` so `scripts/__tests__/people-invariants.test.ts` can violate
 * each of them without a filesystem.
 * ------------------------------------------------------------------ */

const playerRecords = validateCollection("E0", "player", zPlayer, [...players]);
const winRecords = validateCollection("E0", "win", zWinEvent, [...winEvents]);
for (const [board, rows] of Object.entries(leaderboards)) {
  validateCollection("E0", `leaderboard "${board}"`, zLeaderboardRow, [...rows]);
}

const leaderboardRowCount = Object.values(leaderboards).reduce(
  (total, rows) => total + rows.length,
  0,
);

for (const finding of peopleFindings({
  players: playerRecords,
  leaderboards,
  wins: winRecords,
  quizIds: new Set(quizzes.map((quiz) => quiz.id)),
  media: {
    entry: (key) => registry[key],
    /** The registry addresses one file per key (E18); this is the file-exists half. */
    fileExists: (src) => existsSync(join(process.cwd(), "public", assetOf(src))),
  },
  nowIso: DEMO_NOW_ISO,
})) {
  err(finding.rule, finding.message);
}

/* ------------------------------------------------------------------ *
 * E10 — social instants sit at or before the fixture clock
 *
 * The UI renders relative labels against `DEMO_NOW_ISO` (content/core.ts), so an instant
 * dated after it renders `in 1 hour` — the P1 fixtures did. One clock, never the wall clock,
 * is what makes those labels a pure function of their input; React #418 was the server and
 * the browser reading two different clocks.
 * ------------------------------------------------------------------ */

for (const issue of checkSocialInstants(
  { contacts, conversations, notifications: notificationRecords },
  DEMO_NOW_ISO,
)) {
  err("E10", `social "${issue.id}" ${issue.field} ${issue.reason}`);
}

/* ------------------------------------------------------------------ *
 * report
 * ------------------------------------------------------------------ */

const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warn");

/**
 * Measured, not asserted: the two counts the summary line used to claim as string
 * literals. Both are already gated above (E4 scope, E5 route resolution); printing
 * the real numbers means the line can never congratulate a tree it did not check.
 */
const unknownCategoryRefs = [...allQuizzes, ...news, ...tipRecords, ...kbRecords]
  .flatMap((record) => record.categoryIds)
  .filter((categoryId) => !categoryIds.has(categoryId)).length;
const deadLinks = notificationRecords.filter((record) => !resolveRoute(record.link).ok).length;

const counts = [
  `${quizzes.length} quizzes`,
  `${questionOwners.size} questions`,
  `${news.length} news`,
  `${tipRecords.length} tips`,
  `${kbRecords.length} kb`,
  `${categoryTable.length} categories`,
  `${contacts.length} contacts`,
  `${conversations.length} conversations`,
  `${notificationRecords.length} notifications`,
  `${promotions.length} promotions`,
  `${activityResults.length} quiz results, ${activityComments.length} comments, ${activityReviews.length} reviews`,
  `${Object.keys(registry).length} media entries`,
  `${Object.keys(pageCopies).length} page-copy routes`,
  `${battleModes.length} battle modes, ${dailyChallengeBadges.length} daily-challenge badges`,
  `${playerRecords.length} players`,
  `${leaderboardRowCount} leaderboard rows`,
  `${winRecords.length} wins`,
  `${searchIndex.quizzes.length + searchIndex.categories.length + searchIndex.creators.length + searchIndex.pages.length} search rows`,
  ...(generatedQuizzes.length > 0 || generatedPromotions.length > 0
    ? [
        `${generatedQuizzes.length} generated quizzes`,
        `${generatedPromotions.length} generated promotions`,
      ]
    : []),
].join(", ");

/** Printed on both paths: a validator that only reports its coverage when it passes
 *  is telling you the same number either way. */
const coverage = `${ROUTE_PATTERNS.length} routes match app/, ${unknownCategoryRefs} unknown category ids, ${deadLinks} dead links`;

if (warnings.length > 0) {
  // A fixture-wide gap (the catalogue is 40 card records with no questions) would
  // otherwise print the same sentence 40 times and bury the individual findings.
  // Group by code + message template, printing each distinct id when the group is
  // small and a count when it is not.
  const groups = new Map<string, Diagnostic[]>();
  for (const warning of warnings) {
    const template = warning.message.replace(/"[^"]*"/g, '"…"');
    const key = `${warning.code}\u0000${template}`;
    const group = groups.get(key);
    if (group) group.push(warning);
    else groups.set(key, [warning]);
  }
  console.log(`WARN  ${warnings.length}`);
  for (const group of groups.values()) {
    if (group.length === 1) {
      console.log(`  [${group[0].code}] ${group[0].message}`);
      continue;
    }
    const ids = group.map((warning) => warning.message.match(/"([^"]*)"/)?.[1] ?? "?");
    const shown = ids.length <= 3 ? ids.join(", ") : `${ids.slice(0, 3).join(", ")}, …`;
    const template = group[0].message.replace(/"[^"]*"/g, '"<id>"');
    console.log(`  [${group[0].code}] ×${group.length} ${template}  (${shown})`);
  }
}

if (errors.length > 0) {
  console.log(`FAIL  ${errors.length} error(s) across ${counts}`);
  for (const error of errors) console.log(`  [${error.code}] ${error.message}`);
  console.log(`      ${coverage}`);
  process.exit(1);
}

const navRefs = navigationReferences(uiSources);
const assetRefs = assetReferences(uiSources);

console.log(`PASS  ${counts}`);
console.log(`      ${coverage}`);
console.log(
  `      ${copyMeasured.map((row) => `${row.route} ${row.measured}/${row.budget} page-copy literals`).join(", ")} (measured/budget, E23; a literal longer than ${COPY_LITERAL_MAX} chars is an error on its own)`,
);
console.log(
  `      ${navRefs.length} hardcoded links + ${assetRefs.length} asset refs resolve in components/ and app/ (${missingAssets.length} known-missing assets)`,
);
console.log(
  `      ${searchChatIslands.length} module-scope record arrays on the search/chat surfaces + ${ownedCopies.length} fixture rows copied into a search/chat component`,
);
console.log(
  `      ${e21DebtCopies} fixture title(s) still written into components another work unit owns (E21 debt, counted not allowed)`,
);
console.log(`      0 social instants after the fixture clock ${DEMO_NOW_ISO}`);
console.log(
  `      ${metricLiterals.length} metric literals in components/ and app/, ${Object.keys(metricTable).length} metric snapshots (${relativeLabels(uiSources).length} relative-instant and ${durationLabels(uiSources).length} duration labels declared out of E22 — see scripts/metric-refs.ts)`,
);
