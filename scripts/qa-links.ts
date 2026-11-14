#!/usr/bin/env node
/**
 * scripts/qa-links.ts — the clickable local route list for a change range (#863).
 *
 * The owner's rule is *always QA HIL on local dev, with a clickable list of the main UI / feature
 * changes*. Written by hand, that list was a guess: it named the screen the author remembered
 * editing, and missed the three other routes that imported the component they changed. So this
 * script derives the list from the tree — never from the diff's shape, never from the nearest
 * page — and prints one checkbox per route, grouped by the issue the change closes.
 *
 *   pnpm qa:links                          # origin/main...HEAD
 *   pnpm qa:links 4861f176..610dfff2       # any git range
 *   pnpm qa:links --pr 859                 # a pull request's own file list
 *   pnpm qa:links --probe                  # fetch each link, append the status observed
 *   pnpm qa:links --server http://localhost:3001
 *
 * ## The three derivations, in order
 *
 *   1. a changed `page.tsx` under `app/**` **is** the route: strip the `app/` prefix and every
 *      route group (`(mainlayout)`, `(marketing)`, `(auth)`), keep dynamic segments as written
 *      (`/assessment/[slug]`). A `app/**\/layout.tsx` is not a page but its **subtree** — Next
 *      applies a layout to every page beneath it, which is a directory fact, not a guess.
 *   2. a changed module under `components/**`, `lib/**`, `data/**` or `content/**` → the routes
 *      whose `page.tsx` transitively *value-imports* it. The walk is `scripts/module-reach.ts`,
 *      which reuses `scripts/client-graph.ts`'s parser and resolver (E34's own walk) instead of
 *      writing a second import scanner.
 *   3. a changed fixture under `data/pages/` → the surface row in `data/pages/budget.ts`, which
 *      already names the page that serves it. The row is a second opinion on the same question, so
 *      a fixture that only reaches its page through a `mounts` entry still gets its route.
 *
 * ## A screen, or the layer every screen stands on
 *
 * Derivation 2 is exact but it does not stop at `components/home/as2-hero.tsx` (one page): this
 * tree's pages all value-import `content/brand.ts` and `data/media.ts`, so *any* edit to those
 * reaches most of the app. A list of 62 checkboxes is not a QA list, and silently dropping them
 * would be worse — a brand-token change really does restyle every screen. So the two are printed
 * differently, by a measured line rather than a judgement:
 *
 *   - a changed module that reaches **at most `SHARED_REACH_LIMIT` pages** is a screen: one
 *     checkbox per route it reaches, on the same list as a changed page.
 *   - a module that reaches **more** is infrastructure: one `shared:` line naming the module and
 *     the count, and no checkboxes. Measured on this tree at #863 — a home band reaches 1 route,
 *     the create flow's fixture 5, its draft store 20, `content/brand.ts` 48, `data/media.ts` 53
 *     of 90 — so the limit sits in the gap between a shared screen and a shared layer.
 *
 * A route is only ever printed if `content/routes.ts` carries it. If a changed page's route is not
 * in the manifest the command **exits 1 and names the file** — the same drift `data:check` E10
 * fails on, reported here where it keeps a QA list from carrying a URL that 404s.
 *
 * Every other file is listed under `— not a route — no QA link` with the reason, and the command
 * still exits 0: "this range touched no screen" is a real answer, not a failure.
 *
 * ## The auth class, and the brand boundary
 *
 * A link is only useful if the person clicking it knows what they will see. `AUTH_CLASS_TABLE`
 * below is the same policy `lib/auth/require-role.ts::roleAnswerFor()` enforces — a member is
 * answered with the 404 an unknown URL returns, so an `admin` row clicked as a member reads as a
 * bug unless it is marked. `tests/qa-links.test.ts` holds the table against the tree: every page
 * that calls `requireAdmin()` must classify `admin`, every `requireRole("member")` page must
 * classify `member`, and the quiz product's routes must be marked `quiz-only` in exactly the pages
 * that call `requireQuizProduct()`.
 *
 * ## `--probe` never gates the list
 *
 * Without `--probe` the command needs no server and no network: it reads the tree and git. With
 * it, each URL is fetched and its status appended; if nothing is listening the tool says so once
 * and prints the same list without statuses, exit 0. The default server is
 * **`http://localhost:3001`** and not `127.0.0.1`, which answers `403 INVALID_ORIGIN` against Neon
 * Auth's trusted domains — a "wrong" status on every row that says nothing about the app.
 *
 * ## Not a gate step
 *
 * This is an authoring aid. `scripts/verify.sh` does not run it and CI never calls it; a QA list
 * that could fail a build would be a check, and this is not one.
 *
 * **Runs as plain source.** `node scripts/qa-links.ts` on a fresh clone: Node 24 strips the types,
 * and the repo's resolver (`scripts/ts-modules.mjs`) is registered below so the `@/` alias and
 * this tree's extensionless imports resolve. Registration happens only when this file *is* the
 * entry point, so `tests/qa-links.test.ts` imports the pure functions without a loader hook.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { register } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/* ------------------------------------------------------------------ *
 * Paths → routes
 * ------------------------------------------------------------------ */

/** A route group is a parenthesised segment: `app/(mainlayout)/dashboard/page.tsx`. */
const ROUTE_GROUP = /^\([^)]*\)$/;

/**
 * A parallel-route slot (`@flow`) and an interception marker (`(.)`, `(..)`, `(...)`).
 *
 * Neither adds an address. A slot is a hole in its layout, and an intercepted page renders in that
 * hole while the browser stays on the address being *intercepted* — the target page already serves
 * it. `app/(mainlayout)/dashboard/relationships/@flow/(...)templates/relationship/[slug]/create/page.tsx`
 * is `/templates/relationship/[slug]/create` for QA purposes, because that is what is in the URL,
 * and it is that page's row in the manifest which vouches for it.
 */
const SLOT = /^@/;
const INTERCEPTION = /^\(\.{1,3}\)/;

/**
 * The route a `page.tsx` serves, or `null` for any other file.
 *
 * `app/(marketing)/page.tsx` is `/` — the group is stripped, not substituted. A dynamic segment is
 * kept as written (`/quiz/[id]/play`), because the route manifest spells it that way and a made-up
 * id would be a link the tree cannot vouch for. A page inside a slot, or one that intercepts another
 * route, serves no address of its own (#979 B) and is `null` here rather than a route nobody links.
 */
export function routeForPagePath(path: string): string | null {
  if (!path.startsWith("app/") || !path.endsWith("/page.tsx")) return null;
  const segments = path.slice("app/".length).split("/");
  const page = segments.pop();
  if (page !== "page.tsx") return null;
  if (segments.some((segment) => SLOT.test(segment) || INTERCEPTION.test(segment))) return null;
  const kept = segments.filter((segment) => !ROUTE_GROUP.test(segment));
  return `/${kept.join("/")}`;
}

/** `app/**\/layout.tsx` — a subtree, not a route of its own. */
export function isLayoutPath(path: string): boolean {
  return path.startsWith("app/") && path.endsWith("/layout.tsx");
}

/** The directory a layout governs: `app/(mainlayout)/admin/layout.tsx` → `app/(mainlayout)/admin`. */
export function treeOfLayoutPath(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

/** Every page under a layout's directory, in path order. A layout does not reach a sibling. */
export function pagesUnderTree(tree: string, pages: readonly string[]): string[] {
  const prefix = `${tree}/`;
  return pages.filter((page) => page.startsWith(prefix)).sort();
}

/* ------------------------------------------------------------------ *
 * The auth class — the same policy `roleAnswerFor()` enforces
 * ------------------------------------------------------------------ */

/** What clicking a link costs. The three answers `lib/auth/require-role.ts` can give. */
export type AuthClass = "public" | "member" | "admin";

/**
 * The table, by path prefix.
 *
 * `lib/auth/require-role.ts::roleAnswerFor()` is the source of truth, and it answers in three
 * shapes: a redirect to `/login` (nobody signed in), the 404 an unknown URL gets (signed in, wrong
 * rung) or a grant. So:
 *
 *   `public`  — renders for anyone; a signed-out visitor is a welcome reader.
 *   `member`  — a signed-out request is answered with `redirect(/login?next=…)`; sign in first.
 *   `admin`   — a member (and a signed-out visitor who signs in) gets the **404**, which is why
 *               these rows are marked: clicking one as a member looks like a broken build.
 *
 * A prefix matches on a segment boundary (`/quiz` matches `/quiz/[id]`, never `/quiz-discussions`),
 * and the **longest** match wins, so a specific row beats the group above it. `tests/qa-links.test.ts`
 * fails on a duplicate prefix and holds the table against the tree's own gates.
 */
export const AUTH_CLASS_TABLE: readonly {
  readonly prefix: string;
  readonly auth: AuthClass;
  readonly why: string;
}[] = [
  // admin — `requireAdmin()` in the page, or in the subtree layout above it.
  {
    prefix: "/admin",
    auth: "admin",
    why: "requireAdmin() — the console layout above it; two rows ask for `support`",
  },
  { prefix: "/demo/admin", auth: "admin", why: "requireAdmin()" },
  {
    prefix: "/leaderboard",
    auth: "admin",
    why: "flag `community.leaderboard` is off; only an admin bypass renders it",
  },
  // member — signed out is `redirect(/login?next=…)`, not a page.
  { prefix: "/dashboard", auth: "member", why: 'requireRole("member") / currentUser()' },
  { prefix: "/settings", auth: "member", why: "currentUser()" },
  {
    prefix: "/templates/relationship",
    auth: "member",
    why: "currentUser() — the creator's own templates",
  },
  {
    prefix: "/assessment/instances",
    auth: "member",
    why: "currentUser() — the member's own instances",
  },
  {
    prefix: "/how-it-works",
    auth: "member",
    why: "currentUserIfConfigured(), then redirect(/login)",
  },
  { prefix: "/support", auth: "member", why: "signed out redirects to /help" },
  // public — the exceptions a broader row above would otherwise swallow.
  { prefix: "/support/articles", auth: "public", why: "the marketing article page — no session" },
  {
    prefix: "/templates/relationship/[slug]/create",
    auth: "public",
    why: "an anonymous draft — currentUserIfConfigured(), no sign-in gate",
  },
  {
    prefix: "/assessment/instances/[instanceId]",
    auth: "public",
    why: "a party link — the invitation's token or cookie is the credential",
  },
];

/** The route's auth class. Longest matching prefix; `public` when nothing matches. */
export function authClassFor(route: string): { readonly auth: AuthClass; readonly why: string } {
  let best: { prefix: string; auth: AuthClass; why: string } | null = null;
  for (const row of AUTH_CLASS_TABLE) {
    if (!prefixMatches(route, row.prefix)) continue;
    if (best === null || row.prefix.length > best.prefix.length) best = row;
  }
  if (best === null) return { auth: "public", why: "no gate" };
  return { auth: best.auth, why: best.why };
}

/** Segment-boundary prefix match: `/quiz` matches `/quiz` and `/quiz/[id]`, never `/quiz-discussions`. */
export function prefixMatches(route: string, prefix: string): boolean {
  return route === prefix || route.startsWith(`${prefix}/`);
}

/**
 * Routes the quiz product owns — `404` on the AlignSynch build (#300).
 *
 * Not an auth class: the gate is `requireQuizProduct()`, which reads `product.quiz-surfaces` and
 * answers the same 404 a member gets on an admin screen. It is here for the same reason the auth
 * class is — a QA list that links `/categories` on an alignment build shows a person a 404 and
 * tells them nothing. These twenty-two routes are the ones `lib/brand-boundary.ts` documents, and
 * `tests/qa-links.test.ts` keeps the list equal to the pages that call the gate.
 */
export const QUIZ_ONLY_PREFIXES: readonly string[] = [
  "/affiliate",
  "/battle",
  "/categories",
  "/chat",
  "/create",
  "/creator-tips",
  "/daily-challenge",
  "/dashboard/user",
  "/explore",
  "/my-quizzes",
  "/quiz",
  "/quiz-discussions",
  "/tournaments",
];

/** Does this build 404 the route because it belongs to the quiz product? */
export function isQuizOnly(route: string): boolean {
  return QUIZ_ONLY_PREFIXES.some((prefix) => prefixMatches(route, prefix));
}

/* ------------------------------------------------------------------ *
 * The derivations
 * ------------------------------------------------------------------ */

/**
 * A module that reaches more pages than this is the layer, not a screen.
 *
 * Measured on this tree at #863 (`4861f176..610dfff2`): a home band reaches 1 route, the create
 * flow's fixture 5, its draft store 20, `data/billing-plans.ts` 28, `content/brand.ts` 48,
 * `data/media.ts` 53 — of 90 pages. A shared *screen* sits under 6 and shared *infrastructure*
 * starts at 20, so the line is drawn at 12 where no measured file sits.
 */
export const SHARED_REACH_LIMIT = 12;

/** Where a link came from. */
export type LinkVia = "page" | "layout" | "import" | "fixture";

/** One route, and the changed files that put it on the list. */
export interface RouteLink {
  readonly route: string;
  readonly via: LinkVia;
  readonly files: readonly string[];
}

/** A changed module that reaches too many routes to be one screen. */
export interface SharedModule {
  readonly file: string;
  /** How many of the tree's routes reach it. */
  readonly pages: number;
  /** How many pages the tree has, for the "48 of 90" reading. */
  readonly of: number;
}
/** A changed file that reaches no route, and one sentence saying why. */
export interface UnroutedFile {
  readonly file: string;
  readonly reason: string;
}

/** A changed page whose route `content/routes.ts` does not carry — the exit-1 case. */
export interface MissingRoute {
  readonly file: string;
  readonly route: string;
}

export interface DerivationInput {
  /** Repo-relative changed paths. Files deleted in the range are excluded by the caller. */
  readonly changed: readonly string[];
  /** Every `app/**\/page.tsx` in the tree. */
  readonly pages: readonly string[];
  /** `content/routes.ts`'s patterns, as a set. */
  readonly knownRoutes: ReadonlySet<string>;
  /** `data/pages/budget.ts`: fixture module path (no extension) → the route its page serves. */
  readonly fixtureRoutes: Readonly<Record<string, string>>;
  /**
   * The entries whose import closure contains a path — `module-reach.entriesReaching`, injected so
   * this module imports no graph code and stays a pure function the tests can drive.
   */
  readonly entriesFor: (file: string) => readonly string[];
}

export interface Derivation {
  readonly links: readonly RouteLink[];
  readonly shared: readonly SharedModule[];
  readonly unrouted: readonly UnroutedFile[];
  readonly missing: readonly MissingRoute[];
}

/** `data/pages/home.ts` → `data/pages/home`; `lib/utils.tsx` → `lib/utils`. */
export function modulePathOf(file: string): string {
  return file.replace(/\.(tsx|ts|mjs|jsx|js)$/, "");
}

/**
 * The routes a set of changed files reaches, plus the files that reach none.
 *
 * One file can reach several routes (a shared component) and several files can reach one route (a
 * page and its fixture); both collapse into one link per route, carrying every file that named it.
 * That is the shape a person wants to click, and the count a reviewer wants to read.
 */
export function deriveRoutes(input: DerivationInput): Derivation {
  const links = new Map<string, { via: LinkVia; files: Set<string> }>();
  const shared = new Map<string, SharedModule>();
  const unrouted: UnroutedFile[] = [];
  const missing: MissingRoute[] = [];

  const add = (route: string, via: LinkVia, file: string) => {
    if (!input.knownRoutes.has(route)) {
      missing.push({ file, route });
      return;
    }
    const row = links.get(route);
    if (row === undefined) {
      links.set(route, { via, files: new Set([file]) });
      return;
    }
    row.files.add(file);
  };

  for (const file of input.changed) {
    const pageRoute = routeForPagePath(file);
    if (pageRoute !== null) {
      add(pageRoute, "page", file);
      continue;
    }

    if (isLayoutPath(file)) {
      // A layout is not a page: Next applies it to every page beneath it.
      const under = pagesUnderTree(treeOfLayoutPath(file), input.pages);
      if (under.length === 0) {
        unrouted.push({ file, reason: "a layout with no page beneath it" });
        continue;
      }
      for (const page of under) {
        const route = routeForPagePath(page);
        if (route !== null) add(route, "layout", file);
      }
      continue;
    }

    let reached = 0;

    const fixtureRoute = input.fixtureRoutes[modulePathOf(file)];
    if (fixtureRoute !== undefined) {
      add(fixtureRoute, "fixture", file);
      reached += 1;
    }

    const routes = new Set<string>();
    const entries = input.entriesFor(file);
    for (const entry of entries) {
      for (const route of routesForEntry(entry, input.pages)) routes.add(route);
    }
    if (routes.size > SHARED_REACH_LIMIT) {
      shared.set(file, { file, pages: routes.size, of: input.pages.length });
      reached += 1;
    } else {
      for (const entry of entries) {
        for (const route of routesForEntry(entry, input.pages)) add(route, "import", file);
      }
      reached += routes.size;
    }

    if (reached === 0) unrouted.push({ file, reason: reasonForUnrouted(file) });
  }

  return {
    links: [...links.entries()]
      .map(([route, row]) => ({ route, via: row.via, files: [...row.files].sort() }))
      .sort((a, b) => a.route.localeCompare(b.route)),
    shared: [...shared.values()].sort((a, b) => b.pages - a.pages),
    unrouted: unrouted.sort((a, b) => a.file.localeCompare(b.file)),
    missing: missing.sort((a, b) => a.file.localeCompare(b.file)),
  };
}

/**
 * The routes an entry speaks for: a page is its own route, a layout is every page beneath it.
 *
 * The two cases are the whole reason a walk needs entry types — the shell's sidebar is reached by
 * `app/(mainlayout)/layout.tsx` and by no page, so attributing it to nothing would drop the most
 * rendered component in the tree off the QA list.
 */
export function routesForEntry(entry: string, pages: readonly string[]): string[] {
  const pageRoute = routeForPagePath(entry);
  if (pageRoute !== null) return [pageRoute];
  if (!isLayoutPath(entry)) return [];
  return pagesUnderTree(treeOfLayoutPath(entry), pages)
    .map((page) => routeForPagePath(page))
    .filter((route): route is string => route !== null);
}

/**
 * Why a changed file put no route on the list — one honest sentence.
 *
 * The point is that the reader can tell "nothing to QA here" from "the tool failed to work it
 * out": a stylesheet every route renders through is a different fact from a test, and both are
 * different from a component nobody imports.
 */
export function reasonForUnrouted(file: string): string {
  if (
    /(^|\/)(globals|global)\.(css|scss)$/.test(file) ||
    /^(tailwind|next|postcss)\.config\./.test(file) ||
    /^tsconfig[^/]*\.json$/.test(file)
  ) {
    return "global — every route renders through it; no single link";
  }
  if (/^app\/.*\/route\.ts$/.test(file)) return "a route handler — an endpoint, not a page";
  if (/^(package\.json|pnpm-lock\.yaml)$/.test(file))
    return "the dependency manifest — no page renders it";
  if (file.startsWith("app/")) return "an app file that is not a page";
  if (file.startsWith("tests/")) return "a test";
  if (file.startsWith("docs/")) return "documentation";
  if (file.startsWith("public/")) return "a static asset";
  if (file.startsWith("scripts/")) return "a tooling script";
  if (file.startsWith("data/")) return "a fixture no page reaches";
  if (file.startsWith("content/")) return "a content module no page reaches";
  return "a module no page reaches";
}

/* ------------------------------------------------------------------ *
 * Grouping by the issue the change closes
 * ------------------------------------------------------------------ */

/**
 * The issue a merge subject closes: `feat(home): … (#853) (#857)` → `853`.
 *
 * The first `(#n)` is the issue and the last is the pull request (squash-merge writes both), so
 * the first match wins. `null` when the subject names neither — those files print under their own
 * heading instead of being guessed into an issue the commit did not claim.
 */
export function issueFromSubject(subject: string): number | null {
  const match = /\(#(\d+)\)/.exec(subject);
  return match === null ? null : Number(match[1]);
}

/** The issue a pull request body links, by the same words GitHub's own close keywords use. */
export function issueFromBody(body: string): number | null {
  const linked = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*#(\d+)/i.exec(body);
  if (linked !== null) return Number(linked[1]);
  const any = /#(\d+)/.exec(body);
  return any === null ? null : Number(any[1]);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

/** `http://localhost:3001/quiz/[id]` — one trailing slash, never two. */
export function urlFor(server: string, route: string): string {
  return `${server.replace(/\/+$/, "")}${route}`;
}

/**
 * The badge after a link: what clicking it costs.
 *
 * Deliberately short — the list is read by someone clicking, not by someone auditing the gate, and
 * the reasons are printed once in the legend under it. `admin` is the one that must never be
 * missing: a member clicking it gets a 404 and reads it as a bug (#863's brief).
 */
export function authBadge(route: string): string {
  const { auth } = authClassFor(route);
  const marks: string[] = [];
  if (auth === "admin") marks.push("admin — 404 as a member");
  else if (auth === "member") marks.push("member — sign in first");
  else marks.push("public");
  if (isQuizOnly(route)) marks.push("quiz-only — 404 on this brand");
  if (route.includes("[")) marks.push("dynamic — substitute a real id");
  return marks.join(" · ");
}

/** One line per auth class in use, so the badge's words are defined once. */
export function legend(used: ReadonlySet<AuthClass>): string[] {
  const lines: string[] = [];
  if (used.has("public")) lines.push("public = renders for anyone");
  if (used.has("member"))
    lines.push("member = a signed-out request is answered with /login?next=…");
  if (used.has("admin")) lines.push("admin = a member gets the 404 an unknown URL gets");
  return lines;
}

/** `1 route` / `3 routes` — a count and the noun that agrees with it. */
export function count(n: number, noun: string): string {
  return `${n} ${n === 1 ? noun : `${noun}s`}`;
}

/* ------------------------------------------------------------------ *
 * The command
 * ------------------------------------------------------------------ */

interface Commit {
  readonly sha: string;
  readonly subject: string;
  readonly files: readonly string[];
}

interface Group {
  readonly label: string;
  readonly issue: number | null;
  readonly files: Set<string>;
  readonly routes: Map<string, RouteLink>;
  readonly shared: Map<string, SharedModule>;
}

const USAGE = [
  "pnpm qa:links [range] [--pr <n>] [--probe] [--server <url>]",
  "",
  "  range            a git range (default: origin/main...HEAD)",
  "  --pr <n>         group by the issue pull request <n> links, from its own file list",
  "  --probe          fetch every link and append the status observed",
  "  --server <url>   where the app is running (default: http://localhost:3001)",
  "  --help           this text",
].join("\n");

function isMainEntry(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url);
}

function git(args: readonly string[]): string {
  return execFileSync("git", ["-C", ROOT, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** Every non-merge commit in the range, with the files it touched. */
function commitsInRange(range: string): Commit[] {
  const out = git([
    "log",
    "--no-merges",
    "--no-renames",
    "--format=%x1e%H%x1f%s",
    "--name-only",
    range,
  ]);
  const commits: Commit[] = [];
  for (const chunk of out.split("\u001e")) {
    const body = chunk.trim();
    if (body === "") continue;
    const [head = "", ...rest] = body.split("\n");
    const [sha = "", subject = ""] = head.split("\u001f");
    commits.push({
      sha,
      subject,
      files: rest.map((line) => line.trim()).filter((line) => line !== ""),
    });
  }
  return commits;
}

interface PullRequest {
  readonly number: number;
  readonly title: string;
  readonly files: readonly string[];
  readonly issue: number | null;
}

/** A pull request's title, file list and linked issue, through `gh` (the only network call). */
function pullRequest(number: number): PullRequest {
  const raw = execFileSync(
    "gh",
    ["pr", "view", String(number), "--json", "number,title,body,files"],
    {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const parsed = JSON.parse(raw) as {
    number: number;
    title: string;
    body: string;
    files: { path: string }[];
  };
  return {
    number: parsed.number,
    title: parsed.title,
    files: parsed.files.map((file) => file.path),
    issue: issueFromBody(parsed.body ?? "") ?? issueFromSubject(parsed.title),
  };
}

const GRAPH_DIRS = ["app", "components", "lib", "data", "content", "hooks"] as const;
const SOURCE_EXTENSIONS = /\.(tsx|ts|mjs|jsx|js)$/;

/** Every source file under the graph's directories, repo-relative and sorted. */
function sourceTree(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (SOURCE_EXTENSIONS.test(entry.name)) found.push(path);
    }
  };
  for (const dir of GRAPH_DIRS) walk(dir);
  return found.sort();
}

function exists(path: string): boolean {
  try {
    return statSync(join(ROOT, path)).isFile();
  } catch {
    return false;
  }
}

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

/** The status one fetch observed: `200`, `307 → /login`, `no response` when it failed. */
async function probe(url: string, signal: AbortSignal): Promise<string> {
  try {
    const response = await fetch(url, { redirect: "manual", signal });
    const location = response.headers.get("location");
    return location === null ? String(response.status) : `${response.status} → ${location}`;
  } catch {
    return "no response";
  }
}

/** The issue whose commit touched this file, for the not-a-route heading. */
function issueClaiming(
  commits: readonly Commit[],
  file: string,
  pr: PullRequest | null,
): number | null {
  if (pr !== null) return pr.issue;
  for (const commit of commits) {
    if (!commit.files.includes(file)) continue;
    const issue = issueFromSubject(commit.subject);
    if (issue !== null) return issue;
  }
  return null;
}

async function main(argv: readonly string[]): Promise<number> {
  const positional: string[] = [];
  let prNumber: number | null = null;
  let doProbe = false;
  let server = "http://localhost:3001";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg === "--help" || arg === "-h") {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    if (arg === "--probe") {
      doProbe = true;
      continue;
    }
    if (arg === "--pr") {
      const value = argv[index + 1];
      if (value === undefined || !/^\d+$/.test(value)) {
        process.stderr.write("qa:links: --pr needs a pull request number\n");
        return 1;
      }
      prNumber = Number(value);
      index += 1;
      continue;
    }
    if (arg === "--server") {
      const value = argv[index + 1];
      if (value === undefined || !/^https?:\/\//.test(value)) {
        process.stderr.write(
          "qa:links: --server needs an http(s) URL, e.g. http://localhost:3001\n",
        );
        return 1;
      }
      server = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      process.stderr.write(`qa:links: unknown flag ${arg}\n${USAGE}\n`);
      return 1;
    }
    positional.push(arg);
  }

  const range = positional[0] ?? "origin/main...HEAD";

  // The repo's TypeScript sources are loaded after the resolver is registered, which is why they
  // are dynamic imports rather than top-level ones.
  const [reachModule, routes, budget] = await Promise.all([
    import("./module-reach"),
    import("../content/routes"),
    import("../data/pages/budget"),
  ]);

  const sources: Record<string, string> = {};
  for (const path of sourceTree()) sources[path] = read(path);

  const pages = Object.keys(sources).filter((path) => routeForPagePath(path) !== null);
  const layouts = Object.keys(sources).filter((path) => isLayoutPath(path));
  const knownRoutes = new Set<string>(routes.ROUTE_PATTERNS);

  const fixtureRoutes: Record<string, string> = {};
  for (const [route, row] of Object.entries(budget.pageCopyBudget)) {
    const fixture = (row as { fixture?: unknown }).fixture;
    if (typeof fixture === "string" && knownRoutes.has(route)) fixtureRoutes[fixture] = route;
  }

  const reach = reachModule.reachability({ sources, entries: [...pages, ...layouts] });

  let commits: Commit[];
  let pr: PullRequest | null = null;
  if (prNumber === null) {
    try {
      commits = commitsInRange(range);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`qa:links: git cannot read ${range}\n${message}\n`);
      return 1;
    }
  } else {
    try {
      pr = pullRequest(prNumber);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `qa:links: gh cannot read pull request ${prNumber} — is it authenticated?\n${message}\n`,
      );
      return 1;
    }
    commits = [{ sha: `pr-${pr.number}`, subject: pr.title, files: pr.files }];
  }

  // One derivation per file, so a file named by two commits is not walked twice.
  const everything = new Set<string>();
  for (const commit of commits) for (const file of commit.files) everything.add(file);

  const gone: string[] = [];
  const derivations = new Map<string, Derivation>();
  for (const file of everything) {
    if (!exists(file)) {
      gone.push(file);
      continue;
    }
    derivations.set(
      file,
      deriveRoutes({
        changed: [file],
        pages,
        knownRoutes,
        fixtureRoutes,
        entriesFor: (target) => reachModule.entriesReaching(reach, target),
      }),
    );
  }

  // Group: by the issue in the subject, or the pull request's one linked issue.
  const groups = new Map<string, Group>();
  const groupFor = (issue: number | null, label: string): Group => {
    const key = `${issue ?? "none"}\u0000${label}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = { label, issue, files: new Set(), routes: new Map(), shared: new Map() };
      groups.set(key, group);
    }
    return group;
  };

  for (const commit of commits) {
    const issue = pr === null ? issueFromSubject(commit.subject) : pr.issue;
    const label =
      pr === null
        ? issue === null
          ? "no issue in the subject"
          : `#${issue}`
        : issue === null
          ? `PR #${pr.number}`
          : `#${issue} · PR #${pr.number}`;
    const group = groupFor(issue, label);
    for (const file of commit.files) {
      const derived = derivations.get(file);
      if (derived === undefined) continue;
      group.files.add(file);
      for (const link of derived.links) {
        if (!group.routes.has(link.route)) group.routes.set(link.route, link);
      }
      for (const module of derived.shared) {
        if (!group.shared.has(module.file)) group.shared.set(module.file, module);
      }
    }
  }

  const missing = [...derivations.values()].flatMap((derived) => derived.missing);
  const unrouted = new Map<string, string>();
  for (const derived of derivations.values()) {
    for (const row of derived.unrouted) unrouted.set(row.file, row.reason);
  }

  // Probe, when asked — every URL once, after the list is known.
  const statuses = new Map<string, string>();
  let serverDown = false;
  if (doProbe) {
    const urls = [...new Set([...groups.values()].flatMap((group) => [...group.routes.keys()]))]
      .filter((route) => !route.includes("["))
      .map((route) => urlFor(server, route));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      if ((await probe(server, controller.signal)) === "no response") {
        serverDown = true;
      } else {
        const results = await Promise.all(urls.map((url) => probe(url, controller.signal)));
        for (const [index, url] of urls.entries())
          statuses.set(url, results[index] ?? "no response");
      }
    } finally {
      clearTimeout(timer);
    }
  }

  // Print.
  const lines: string[] = [];
  const ordered = [...groups.values()].sort((a, b) => (a.issue ?? 10 ** 9) - (b.issue ?? 10 ** 9));
  const totalRoutes = new Set(ordered.flatMap((group) => [...group.routes.keys()])).size;
  const head =
    pr === null ? `${range} · ${commits.length} commits` : `PR #${pr.number} · ${pr.title}`;
  lines.push(`qa:links · ${head} · ${count(everything.size, "file")} changed · ${server}`);
  lines.push("");

  if (serverDown) {
    lines.push(
      `no server at ${server} — start \`pnpm dev\` (port 3001) or pass --server <url>. Printing the list without statuses.`,
    );
    lines.push("");
  }

  const usedClasses = new Set<AuthClass>();

  for (const group of ordered) {
    const routes = [...group.routes.keys()].sort();
    const shared = [...group.shared.values()].sort((a, b) => b.pages - a.pages);
    lines.push(
      `## ${group.label} — ${count(routes.length, "route")} · ${count(group.files.size, "file")}`,
    );
    for (const route of routes) {
      usedClasses.add(authClassFor(route).auth);
      const url = urlFor(server, route);
      const status = statuses.get(url);
      const link = group.routes.get(route) as RouteLink;
      const via =
        link.via === "import" || link.via === "layout"
          ? ` · via ${link.files[0]}${link.files.length > 1 ? ` +${link.files.length - 1}` : ""}`
          : "";
      lines.push(
        `- [ ] ${url} — ${authBadge(route)}${via}${status === undefined ? "" : ` → ${status}`}`,
      );
    }
    for (const module of shared) {
      lines.push(
        `- shared: \`${module.file}\` reaches ${module.pages} of ${module.of} routes — every screen it lands on; spot-check one per surface`,
      );
    }
    if (routes.length === 0 && shared.length === 0) {
      lines.push("- (no route — every file in this group is a non-surface)");
    }
    lines.push("");
  }

  if (unrouted.size > 0) {
    lines.push("— not a route — no QA link");
    for (const [file, reason] of [...unrouted.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const issue = issueClaiming(commits, file, pr);
      lines.push(`- \`${file}\`${issue === null ? "" : ` (#${issue})`} — ${reason}`);
    }
    lines.push("");
  }

  if (gone.length > 0) {
    lines.push("— removed — not in the tree any more, so there is nothing to click");
    for (const file of gone.sort()) lines.push(`- \`${file}\``);
    lines.push("");
  }

  const legendLines = legend(usedClasses);
  if (legendLines.length > 0) {
    lines.push(`auth: ${legendLines.join(" · ")}`);
    lines.push("quiz-only = the product's flag is off on this build; the route answers 404");
    lines.push("");
  }

  lines.push(
    `${count(ordered.length, "group")} · ${count(totalRoutes, "route")} · ${count(unrouted.size, "file")} with no QA link`,
  );

  process.stdout.write(`${lines.join("\n")}\n`);

  if (missing.length > 0) {
    process.stderr.write(
      "\nqa:links: a changed page serves a route content/routes.ts does not carry:\n",
    );
    for (const row of missing) {
      process.stderr.write(`  ${row.file} → ${row.route} (add it to content/routes.ts)\n`);
    }
    return 1;
  }

  return 0;
}

if (isMainEntry()) {
  register("./ts-modules.mjs", import.meta.url);
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      process.stderr.write(`qa:links: ${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    },
  );
}
