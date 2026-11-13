/**
 * scripts/qa-atlas-registry.mjs — the atlas's row set, derived and never listed.
 *
 * The release atlas (#945) documents every surface the product ships. Its row set comes from
 * **`data/pages/budget.ts`**, because that table is already the one place a surface is registered:
 * a page added there is a page E23 measures, and a page nobody registered has no copy budget and
 * no route. So this module reads `Object.keys(pageCopyBudget)` and derives everything else from
 * what the table already carries plus the tree around it — it does not keep a second list, and a
 * route it cannot describe is reported as a **finding**, never quietly marked unknown.
 *
 * Per row:
 *
 *   route     the key. `shell`, `not-found` and `tour` are the three declared non-route surfaces
 *             (`NON_ROUTE_COPY_SURFACES` in `content/pages.ts`), reported as `kind: "surface"`.
 *   area      marketing · auth · admin · quiz · assessments · dashboard, from the page path the
 *             table already carries, with `quiz` decided by `tests/parity/boundary.ts` — the
 *             existing statement of which routes the quiz product owns.
 *   brand     the boundary a page is behind: `quiz` (`requireQuizProduct()`), `alignment`
 *             (`requireAlignmentProduct()`), `admin` (`requireAdminProduct()`) or `none`. Found by
 *             reading the page module **and the layouts it inherits**, because `/admin/console` is
 *             gated once in its subtree layout.
 *   auth      `public`, or `session` when the page (or a layout) resolves a session, with `admin`
 *             split out when it asks for a role. Read from the same file chain, so "signed-in" is
 *             a fact about the module, not a guess from the URL.
 *   params    a concrete value per dynamic segment, from a fixture or from the demo branch's own
 *             rows. A segment with no source is a **skip with a reason**, which the atlas prints.
 *
 * `status` is the expectation the capture is measured against: a route behind a boundary the build
 * does not claim answers 404, and everything else must reach its own URL with a 200.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { isNonRouteCopySurface } from "../content/pages.ts";
import { pageCopyBudget } from "../data/pages/budget.ts";
import { repoRoot } from "./load-env.mjs";

/** The manifest's schema tag. A reader keys on it, so it moves only with the writer. */
export const SCHEMA = "qa-atlas/v1";

/** The release this atlas documents — the version `package.json` carries. */
export function currentVersion() {
  return JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
}

/**
 * The directory label for a version: `docs/qa-atlas/v1.17.0`.
 *
 * The manifest's own `version` field stays bare semver (`1.17.0`) because that is what
 * `package.json` and the release tag's neighbours compare as numbers; the directory carries the
 * `v` because that is the name a person types and the card names. One function, so the generator
 * and the check cannot disagree about where the atlas lives — a directory they spelled differently
 * would make the check report a missing atlas for an atlas that exists.
 */
export function atlasLabel(version) {
  return version.startsWith("v") ? version : `v${version}`;
}

/* ------------------------------------------------------------------ *
 * The boundary table — read, not forked
 * ------------------------------------------------------------------ */

/**
 * The route patterns `tests/parity/boundary.ts` lists, by list.
 *
 * The file cannot be imported: it statically imports twenty-two page modules (React, JSX, `next/*`)
 * so that `tsc` sees them, which no plain node process can load. Its **patterns** are what this
 * needs, and they are literals at the head of each entry, so they are read out of the source text.
 * That is deliberate: the atlas must fail when parity's list and the tree disagree, and importing a
 * second copy of the list would make the two agree by construction.
 */
export function boundaryLists() {
  const file = join(repoRoot, "tests", "parity", "boundary.ts");
  const source = readFileSync(file, "utf8");
  const blockOf = (name) => {
    const start = source.indexOf(`export const ${name}`);
    if (start === -1) return "";
    // The list ends on the first line that closes the array — `];` or `] as const;`, whichever the
    // declaration uses. Matching a literal `\n];` missed the `as const` form and swallowed the next
    // list, which made every admin route look quiz-only.
    const close = /\n\][^\n]*;/.exec(source.slice(start));
    return close === null ? source.slice(start) : source.slice(start, start + close.index);
  };
  const patterns = (name) => {
    const block = blockOf(name);
    return [...block.matchAll(/route:\s*"([^"]+)"/g)].map((match) => match[1]);
  };
  return {
    file,
    quiz: patterns("quizOnlyRoutes"),
    admin: patterns("adminProductRoutes"),
  };
}

/* ------------------------------------------------------------------ *
 * Reading the module chain
 * ------------------------------------------------------------------ */

/** The page module and every `layout.tsx` it inherits, nearest first. */
function moduleChain(pagePath) {
  const chain = [pagePath];
  let dir = dirname(pagePath);
  while (dir !== "." && dir !== "/" && dir !== "") {
    for (const name of ["layout.tsx", "layout.ts"]) {
      const candidate = dir === "." ? name : `${dir}/${name}`;
      if (existsSync(join(repoRoot, candidate))) {
        chain.push(candidate);
        break;
      }
    }
    dir = dirname(dir);
  }
  return chain;
}

/** Every chain module's text, with the file each line came from. */
function chainSources(pagePath) {
  return moduleChain(pagePath).map((path) => ({
    path,
    text: stripComments(readFileSync(join(repoRoot, path), "utf8")),
  }));
}

/**
 * The module's text with its comments taken out.
 *
 * A docstring that *describes* a gate — "**Not gated by `requireQuizProduct()`.**" on `/dashboard`,
 * or "`requireAdminProduct()` first" on `/admin/audit` — is a mention, not a call, and reading it as
 * one would mark the console quiz-only and the console's own overview gated when it is deliberately
 * not. The scan therefore runs on code only.
 */
function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return !trimmed.startsWith("//") && !trimmed.startsWith("*");
    })
    .join("\n");
}

const GATES = [
  { kind: "quiz", call: "requireQuizProduct(" },
  { kind: "alignment", call: "requireAlignmentProduct(" },
  { kind: "admin", call: "requireAdminProduct(" },
];

/**
 * The brand gate a surface sits behind, and where it was found.
 *
 * A page that calls none of them is behind no product gate — and that is a statement the atlas
 * makes explicitly (`none`), because "unknown" would let a real gate go unmeasured.
 */
function brandGateOf(chain) {
  for (const source of chain) {
    for (const gate of GATES) {
      if (source.text.includes(gate.call)) {
        return { kind: gate.kind, at: `${source.path}:${gate.call}` };
      }
    }
  }
  return { kind: "none", at: null };
}

/**
 * The role a surface asks for: an admin console asks `requireAdmin()`, a member page a session.
 *
 * The member gate is `requireRole("member", { next })` (#184) — the call that redirects a
 * signed-out visitor to `/login?next=…` — so it is read as a gate, in the same pass as
 * `requireAdmin()`. Missing it was not cosmetic: `/dashboard/templates` and
 * `/dashboard/relationships` were classified `public`, captured with no session, and every one of
 * their captures was a redirect to `/login` reported as a failed surface. `support` is the
 * operator's grant, so it belongs to the signed-in pass that can hold it.
 */
function roleOf(chain, brandGate) {
  const adminAt = chain.find((source) => /requireAdmin\(/.test(source.text));
  // A page behind `requireAdminProduct()` is the console even when the role check is one call
  // deeper (a shared component, `lib/auth/require-role.ts`): the gate is the module's own statement.
  if (adminAt !== undefined) return { role: "admin", at: adminAt.path };
  if (brandGate.kind === "admin") return { role: "admin", at: brandGate.at };
  for (const source of chain) {
    const gate = /requireRole\(\s*["']([a-z]+)["']/.exec(source.text);
    if (gate !== null) {
      return {
        role: gate[1] === "member" ? "member" : "admin",
        at: `${source.path}:requireRole("${gate[1]}")`,
      };
    }
  }
  const sessionAt = chain.find(
    (source) =>
      /currentUser\(\)/.test(source.text) || /currentUserIfConfigured\(\)/.test(source.text),
  );
  if (sessionAt !== undefined) return { role: "member", at: sessionAt.path };
  return { role: "public", at: null };
}

/* ------------------------------------------------------------------ *
 * Area
 * ------------------------------------------------------------------ */

const AREA_BY_PAGE = [
  { area: "marketing", match: (page) => page.includes("app/(marketing)/") },
  { area: "auth", match: (page) => page.includes("app/(auth)/") },
  { area: "admin", match: (page) => page.includes("app/(mainlayout)/admin/") },
  {
    area: "assessments",
    match: (route) => /^\/(assessment|assessments|templates|invite)\b/.test(route),
  },
];

function areaOf(route, page, boundary) {
  if (boundary.quiz.includes(route)) return "quiz";
  for (const entry of AREA_BY_PAGE) {
    if (entry.match(entry.area === "assessments" ? route : page)) return entry.area;
  }
  return "dashboard";
}

/* ------------------------------------------------------------------ *
 * Concrete URLs — a params table, not a route list
 * ------------------------------------------------------------------ */

/**
 * A value per dynamic segment, keyed by the **route pattern**.
 *
 * This is not a second route list: the route set above comes from `budget.ts` alone, and a pattern
 * that is not here is simply captured only if it has no dynamic segment. Each entry names a source
 * the product already has — a fixture collection or the demo branch's own rows — so the atlas
 * screenshots a real record rather than a slug invented for a screenshot.
 *
 * `db` is passed in by the generator (the check never opens a connection); a resolver that needs a
 * row returns `null` when there is none, and the row is skipped **by reason** rather than tried.
 */
function paramResolvers(db, brand) {
  // `slug` where the record carries one, `id` where the id *is* the slug (`relationship-types`' own
  // docstring: "The slug — the `[type]` route segment").
  const firstSlug = (values) => {
    const row = values.find((candidate) => candidate.slug !== undefined) ?? values[0];
    return row?.slug ?? row?.id ?? null;
  };
  return {
    "/categories/[slug]": async () => {
      const { categories } = await import("../data/categories.ts");
      return { slug: firstSlug(categories) };
    },
    "/news/[slug]": async () => {
      const { newsData } = await import("../data/news-data.ts");
      return { slug: firstSlug(newsData) };
    },
    "/creator-tips/[slug]": async () => {
      const { tips } = await import("../data/creator-tips-data.ts");
      return { slug: firstSlug(tips) };
    },
    "/support/articles/[slug]": async () => {
      // The knowledge base is brand-aware (#309): `data/knowledge-base-data.ts` is QuizHub's
      // catalogue and the alignment build reads `knowledge-base-alignsynch-data.ts`. Taking the
      // first quiz article on this brand asks for an article this product does not publish, and the
      // 404 that follows is the harness's mistake, not the route's.
      const { kbArticlesByBrand } = await import("../data/knowledge-base.ts");
      const articles = kbArticlesByBrand[brand] ?? [];
      return { slug: firstSlug(articles) };
    },
    "/relationship-types/[slug]": async () => {
      const { relationshipTypes } = await import("../data/relationship-types.ts");
      return { slug: firstSlug(relationshipTypes) };
    },
    "/tournaments/[id]": async () => {
      const { TOURNAMENT_IDS } = await import("../components/tournaments/tournament-ids.ts");
      return { id: TOURNAMENT_IDS[0] ?? null };
    },
    "/profile/[username]": async () => ({ username: db?.handle ?? null }),
    "/templates/relationship/[slug]": async () => ({ slug: db?.templateSlug ?? null }),
    "/templates/relationship/[slug]/create": async () => ({ slug: db?.templateSlug ?? null }),
    "/templates/relationship/[slug]/create/mode": async () => ({ slug: db?.templateSlug ?? null }),
    "/templates/relationship/[slug]/create/aspects": async () => ({
      slug: db?.templateSlug ?? null,
    }),
    "/templates/relationship/[slug]/create/commit": async () => ({
      slug: db?.templateSlug ?? null,
    }),
    "/templates/relationship/[slug]/create/invite": async () => ({
      slug: db?.templateSlug ?? null,
    }),
    "/admin/templates/[id]": async () => ({ id: db?.templateId ?? null }),
    "/dashboard/templates/[id]": Object.assign(async () => ({ id: db?.memberTemplateId ?? null }), {
      reason:
        "the seeded demo dataset owns no member template (`record.owner_user_id` is null on every " +
        "row), and this screen opens a template the member authored — so there is no id to open",
    }),
    "/admin/instances/[id]": async () => ({ id: db?.instanceId ?? null }),
    "/admin/instances/[id]/report": async () => ({ id: db?.instanceId ?? null }),
    "/dashboard/relationships/[id]": async () => ({ id: db?.memberRelationshipId ?? null }),
    "/assessment/instances/[instanceId]": async () => ({ instanceId: db?.instanceId ?? null }),
    "/assessment/instances/[instanceId]/report": async () => ({
      instanceId: db?.instanceId ?? null,
    }),
    "/assessment/instances/[instanceId]/answer": async () => ({
      instanceId: db?.instanceId ?? null,
    }),
    "/assessment/instances/[instanceId]/accept": async () => ({
      instanceId: db?.instanceId ?? null,
    }),
    "/assessment/instances/[instanceId]/sent": async () => ({ instanceId: db?.instanceId ?? null }),
    "/invite/[token]": Object.assign(async () => ({ token: db?.inviteToken ?? null }), {
      reason:
        "the demo branch holds no claimable invite token — `session_invite` stores `token_hash`, and " +
        "the seeded dataset carries no pending invite",
    }),
    "/reset/[token]": Object.assign(async () => ({ token: null }), {
      reason:
        "a reset token is minted per request by the password-reset endpoint and is stored nowhere " +
        "the atlas can read, so this surface is captured only by a run that holds one",
    }),
    "/admin/docs/[...slug]": async () => {
      // `findDoc` keys on the manifest's own `path` — `.md` included, and a nested path keeps its
      // slashes (`pay-to-complete/README.md`). Stripping the suffix asked for a document the
      // manifest does not carry, and the 404 that followed was the harness's mistake.
      const manifest = JSON.parse(readFileSync(join(repoRoot, "docs", "docs.json"), "utf8"));
      const first = manifest.sections[0]?.docs[0]?.path ?? null;
      return { slug: first };
    },
  };
}

/** Fill a pattern's segments, or say which segment has no value. */
function fillParams(pattern, values) {
  const segments = [...pattern.matchAll(/\[(?:\.\.\.)?([a-zA-Z]+)\]/g)].map((match) => match[1]);
  if (segments.length === 0) return { path: pattern, params: {} };
  const params = {};
  for (const segment of segments) {
    const value = values?.[segment];
    if (value === undefined || value === null || value === "") {
      return { path: null, params: null, missing: segment };
    }
    params[segment] = value;
  }
  let path = pattern;
  for (const [segment, value] of Object.entries(params)) path = path.replace(`[${segment}]`, value);
  path = path.replace("[...slug]", segments.map((segment) => params[segment]).join("/"));
  return { path, params };
}

/* ------------------------------------------------------------------ *
 * The rows
 * ------------------------------------------------------------------ */

/**
 * Every row the atlas documents, in `budget.ts` key order.
 *
 * `db` carries the demo branch's identifiers (`{ templateSlug, templateId, relationshipId,
 * memberRelationshipId, instanceId, handle, inviteToken }`); pass `null` to derive the row set with
 * no database, which is what the static check does — a row whose params cannot be resolved then
 * reports its skip reason instead of a URL.
 */
export async function deriveRows({ brand = "alignsynch", db = null } = {}) {
  const boundary = boundaryLists();
  const resolvers = paramResolvers(db, brand);
  const keys = Object.keys(pageCopyBudget);
  const rows = [];
  const findings = [];

  for (const key of keys) {
    const entry = pageCopyBudget[key];

    if (isNonRouteCopySurface(key)) {
      rows.push({
        kind: "surface",
        route: key,
        area: "surface",
        page: entry.page,
        fixture: entry.fixture,
        brandGate: { kind: "none", at: null },
        role: "public",
        path: null,
        params: {},
        expected: null,
        skip: null,
        capturedBy: null,
      });
      continue;
    }

    const chain = chainSources(entry.page);
    const brandGate = brandGateOf(chain);
    const { role, at } = roleOf(chain, brandGate);
    const area = areaOf(key, entry.page, boundary);

    const resolve = resolvers[key];
    const filled = resolve ? fillParams(key, await resolve()) : fillParams(key, null);
    const hasSegments = /\[/.test(key);
    const skip =
      hasSegments && filled.path === null
        ? {
            // A resolver may state the reason its own segment cannot be filled — "no invite token on
            // this branch" is a different fact from "the atlas has no resolver for this pattern",
            // and the document prints whichever is true.
            reason: resolve?.reason ?? `no value for segment [${filled.missing ?? "?"}]`,
            params: null,
          }
        : null;

    const gatedOff =
      (brandGate.kind === "quiz" && brand !== "quizhub") ||
      (brandGate.kind === "alignment" && brand !== "alignsynch");

    rows.push({
      kind: "route",
      route: key,
      area,
      page: entry.page,
      fixture: entry.fixture,
      brandGate,
      role: role === "public" ? "public" : role === "admin" ? "admin" : "member",
      roleAt: at,
      path: skip === null ? filled.path : null,
      params: skip === null ? filled.params : {},
      expected: gatedOff ? 404 : 200,
      gateReason: gatedOff ? `${brandGate.kind} boundary — not claimed by ${brand}` : null,
      skip,
      boundaryListed: boundary.quiz.includes(key) || boundary.admin.includes(key),
    });
  }

  // A route the parity boundary lists but `budget.ts` does not carry cannot be documented at all,
  // and that is worth saying out loud instead of leaving it to whoever notices the count is short.
  for (const pattern of [...boundary.quiz, ...boundary.admin]) {
    if (!(pattern in pageCopyBudget)) {
      findings.push({
        kind: "unregistered-route",
        route: pattern,
        note: "tests/parity/boundary.ts lists this route; data/pages/budget.ts carries no row for it",
      });
    }
  }

  return { rows, findings, boundary, version: currentVersion() };
}

/** The count the atlas prints: registry keys, routes, surfaces, and what each resolves to. */
export function coverageOf(rows) {
  const routes = rows.filter((row) => row.kind === "route");
  return {
    keys: rows.length,
    routes: routes.length,
    surfaces: rows.length - routes.length,
    capture: routes.filter((row) => row.skip === null).length,
    skipped: routes.filter((row) => row.skip !== null),
  };
}
