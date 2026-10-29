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
} from "../content/categories";
import {
  zQuiz,
  zQuizAuthoringCard,
  zQuizCard,
  selectQuizAuthoringCard,
  selectQuizCard,
} from "../content/quiz";
import { ROUTE_PATTERNS, routeManifest } from "../content/routes";
import { matchRoute, normalizePath } from "../content/route-manifest";
import {
  NOTIFICATION_ICON_KEYS,
  checkContactRefs,
  checkConversationRefs,
  checkNotificationRefs,
  zContact,
  zConversation,
  zNotification,
  type RouteResolution,
} from "../content/social";
import { categories as quizCategoryRows } from "../data/categories";
import { contacts as modelContacts, conversations as modelConversations } from "../data/chat-data";
import { categories as tipCategoryTable, tips } from "../data/creator-tips-data";
import { articlesData } from "../data/knowledge-base-data";
import { categories as newsCategoryTable, newsData } from "../data/news-data";
import { notifications } from "../data/notifications";
import { quizzes as quizRecords } from "../data/quizzes";
import { searchIndex } from "../data/searchdata";
import { users } from "../lib/data/users";

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
 * E1 — ids and slugs are unique
 * ------------------------------------------------------------------ */

function assertUnique(
  code: string,
  label: string,
  rows: ReadonlyArray<{ id: string; kind?: string; slug: string }>,
  keyOf: (row: { id: string; kind?: string; slug: string }) => string,
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
  [...quizzes, ...news, ...tipRecords, ...kbRecords],
  (row) => row.id,
);
assertUnique(
  "E2",
  "content slugs",
  [...quizzes, ...news, ...tipRecords, ...kbRecords],
  (row) => `${row.kind}/${row.slug}`,
);
assertUnique("E1", "category ids", categoryTable, (row) => row.id);

/* ------------------------------------------------------------------ *
 * E3 — the collections the UI joins on
 * ------------------------------------------------------------------ */

const questionOwners = new Map<string, string>();
for (const quiz of quizzes) {
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
 * E10 — the card shelves resolve, and nothing is orphaned
 *
 * A shelf is the only authored thing left about a card grid: an ordered list of
 * quiz ids. A typo would render an empty carousel, so it fails here instead. The
 * reverse direction matters too: a catalogue record no shelf shows is a fixture
 * that exists only to satisfy its own type.
 * ------------------------------------------------------------------ */

const catalogueIds = new Set(quizCatalogue.map((quiz) => quiz.id));
const shelved = new Set<string>();
for (const [shelf, ids] of Object.entries(quizShelves)) {
  for (const id of ids) {
    shelved.add(id);
    if (!catalogueIds.has(id)) err("E10", `shelf "${shelf}" references unknown quiz "${id}"`);
  }
  const missing = ids.filter((id) => !catalogueIds.has(id));
  if (missing.length > 0) err("E10", `shelf "${shelf}" has ${missing.length} unresolvable id(s)`);
}
for (const quiz of quizCatalogue) {
  if (!shelved.has(quiz.id)) warn("W5", `catalogue quiz "${quiz.id}" is on no shelf`);
  if (!zQuizAuthoringCard.safeParse(selectQuizAuthoringCard(quiz, () => undefined)).success) {
    err("E3", `quiz "${quiz.id}": selectQuizAuthoringCard() output is not a QuizAuthoringCard`);
  }
}

/* ------------------------------------------------------------------ *
 * E4 — category scope: a record may only point at its own vocabulary
 * ------------------------------------------------------------------ */

const scopeProblems = assertCategoryScopes(
  [...quizzes, ...news, ...tipRecords, ...kbRecords],
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
 * report
 * ------------------------------------------------------------------ */

const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warn");

/**
 * Measured, not asserted: the two counts the summary line used to claim as string
 * literals. Both are already gated above (E4 scope, E5 route resolution); printing
 * the real numbers means the line can never congratulate a tree it did not check.
 */
const unknownCategoryRefs = [...quizzes, ...news, ...tipRecords, ...kbRecords]
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
  `${searchIndex.quizzes.length + searchIndex.categories.length + searchIndex.creators.length + searchIndex.pages.length} search rows`,
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

console.log(`PASS  ${counts}`);
console.log(`      ${coverage}`);
