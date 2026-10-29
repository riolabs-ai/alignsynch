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
import { searchIndex } from "../data/searchdata";
import { users } from "../lib/data/users";
import { zMediaRegistry } from "../content/media";
import { media } from "../data/media";
import { promotionFindings } from "./data-check-promotions";
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
assertUnique("E12", "quiz subjects", quizzes, (row) => subjectKey(row.title));

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

for (const finding of promotionFindings(promotions, quizzes)) {
  diagnostics.push({ code: finding.rule, severity: finding.severity, message: finding.message });
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
  `${promotions.length} promotions`,
  `${Object.keys(registry).length} media entries`,
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

const navRefs = navigationReferences(uiSources);
const assetRefs = assetReferences(uiSources);

console.log(`PASS  ${counts}`);
console.log(`      ${coverage}`);
console.log(
  `      ${navRefs.length} hardcoded links + ${assetRefs.length} asset refs resolve in components/ and app/ (${missingAssets.length} known-missing assets)`,
);
console.log(`      0 social instants after the fixture clock ${DEMO_NOW_ISO}`);
