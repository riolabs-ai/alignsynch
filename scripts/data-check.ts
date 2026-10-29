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
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

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
import { zQuiz, zQuizCard, selectQuizCard } from "../content/quiz";
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

/* ------------------------------------------------------------------ *
 * report
 * ------------------------------------------------------------------ */

const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warn");

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

if (warnings.length > 0) {
  console.log(`WARN  ${warnings.length}`);
  for (const warning of warnings) console.log(`  [${warning.code}] ${warning.message}`);
}

if (errors.length > 0) {
  console.log(`FAIL  ${errors.length} error(s) across ${counts}`);
  for (const error of errors) console.log(`  [${error.code}] ${error.message}`);
  process.exit(1);
}

console.log(`PASS  ${counts}`);
console.log(
  `      ${ROUTE_PATTERNS.length} routes match app/, 0 unknown category ids, 0 dead links`,
);
