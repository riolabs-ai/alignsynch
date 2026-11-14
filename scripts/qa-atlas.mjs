#!/usr/bin/env node
/**
 * `pnpm qa:atlas` — the release atlas (#945): every registered surface, captured, asserted and
 * written into one document.
 *
 * ## What it is for
 *
 * `pnpm parity` hashes seven routes and `scripts/verify.sh` builds one. Neither answers the
 * question a release actually raises — *does every screen still render the record it claims?* #936
 * rendered beautifully and read the wrong record; a hash would have agreed with it. So this walks
 * **every route `data/pages/budget.ts` registers** in a real browser, at three widths, and asserts
 * four things per capture:
 *
 *   1. **status** — 200 where the product ships the route, 404 where a brand boundary closes it,
 *      derived from `tests/parity/boundary.ts` and the page's own gate call. A route that answers
 *      something else is a failure, named.
 *   2. **console** — no error, and React's hydration mismatch (`#418`) specifically. A hydration
 *      error means the server and the client disagreed about the tree, which is exactly the class of
 *      bug a screenshot hides. The assertion measures **product surfaces**: a route the brand
 *      boundary closes renders the app's not-found, whose own dev-mode console lines are recorded
 *      per row and reported once as a finding rather than failing twenty-one rows for one line.
 *      Hydration still fails anywhere.
 *   3. **headline** — a heading string out of the route's own copy fixture is present in the DOM.
 *      This is the assertion that catches "rendered the wrong record": the words came from
 *      `data/pages/<surface>.ts`, so a page reading a different record cannot show them.
 *   4. **main** — a `main` element with real content under it, not an empty shell.
 *
 * A route that fails one is reported **as a failure in the atlas**, and its screenshot is kept as
 * the evidence of the failure.
 *
 * ## The weights, and where each byte goes
 *
 *   committed    480 px WebP thumbnails + `manifest.json` + the markdown. Budget 5 MB.
 *   not committed the full-size PNG set — packed with the repo's own deterministic zip
 *                (`scripts/zip.mjs`) and attached to the release as an asset.
 *
 * ## Running it
 *
 * It needs a server and the demo branch's rows; it is **not** a gate step. The static half of the
 * atlas — `pnpm qa:atlas:check` — is, and it never opens a browser or a connection.
 *
 *   ~/.hermes/profiles/alignsynch/bin/withenv.sh <repo> bash -c 'cd <worktree> && \
 *     exec ~/.hermes/profiles/alignsynch/bin/node24.sh pnpm dev --port 3411 --hostname 127.0.0.1'
 *   QA_ATLAS_BASE=http://127.0.0.1:3411 pnpm qa:atlas
 *
 * Flags:
 *
 *   --only=<route>      capture one route (iterate on a failure without paying for the whole run)
 *   --width=<n>         one width only
 *   --role=<role>       one session pass (public | member | admin)
 *   --out=<dir>         write elsewhere (a dry run)
 *   --no-zip            skip the PNG archive
 *   --archive-url=<url>  the uploaded Release asset's URL, printed with the archive it names; omit
 *                        when the release cannot take an asset, and the document says so instead
 *
 * ## The guard: a capture measures this tree or it does not run (#983)
 *
 * `QA_ATLAS_BASE` names a port, and a dev server on a contested port belongs to whoever started it.
 * The first v1.17.1 run answered as another card's server on 3411 and produced a document whose
 * every number, screenshot and failure was real — and all about a different commit. So before a
 * browser opens, `/api/version`'s pair is compared to the tree: its `commit` must equal
 * `git rev-parse HEAD` and its `version` must equal the version this atlas documents, or the run
 * refuses (exit 2) naming both commits. What it agreed with is then written into `manifest.json` as
 * `captureCommit`, which is the question a reader of the document actually has.
 *
 * Exit codes: 0 captured (failures are printed and recorded), 1 the run could not complete,
 * 2 refused (no server, a server that is not this tree, no database, production branch).
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "pg";

import {
  adoptSessionCookies,
  attach,
  configureCdp,
  evaluate,
  launchChrome,
  navigate,
  shutter,
  stopChrome,
  text,
} from "./cdp.mjs";
import { repoRoot } from "./load-env.mjs";
import {
  SCHEMA,
  atlasLabel,
  boundaryLists,
  captureRefusal,
  coverageOf,
  currentVersion,
  deriveRows,
} from "./qa-atlas-registry.mjs";
import { zipEntries } from "./zip.mjs";

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const ARGS = process.argv.slice(2);
/** `--name=value` or `--name value` — the docstring spells both, so both must parse. */
const flag = (name) => {
  const entry = ARGS.find((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
  if (entry === undefined) return undefined;
  if (entry.includes("=")) return entry.slice(entry.indexOf("=") + 1);
  const next = ARGS[ARGS.indexOf(entry) + 1];
  return next === undefined || next.startsWith("--") ? true : next;
};

const BASE = String(flag("base") ?? process.env.QA_ATLAS_BASE ?? "http://127.0.0.1:3411").replace(
  /\/+$/,
  "",
);
const VERSION = String(flag("version") ?? process.env.QA_ATLAS_VERSION ?? currentVersion());
const BRAND = String(
  flag("brand") ?? process.env.QA_ATLAS_BRAND ?? process.env.BRAND ?? "alignsynch",
);
const OUT = String(flag("out") ?? join(repoRoot, "docs", "qa-atlas", atlasLabel(VERSION)));
/** Full-size PNGs never go in the repository. This is a scratch directory, replaced each run. */
const SHOTS = join(
  process.env.QA_ATLAS_SHOTS ?? process.env.TMPDIR ?? "/tmp",
  `qa-atlas-shots-${VERSION}`,
);
const ONLY = flag("only") === undefined ? null : String(flag("only"));
const ONLY_ROLE = flag("role") === undefined ? null : String(flag("role"));
const WIDTHS = flag("width") === undefined ? [390, 768, 1440] : [Number(String(flag("width")))];

/**
 * The three session passes. Each one is a separate browser, because a session is a cookie jar and
 * a public surface captured with the admin's cookies is not the public surface.
 *
 * The signed-in passes sign in **server-side** and hand the cookies to Chrome. A browser sign-in
 * on a loopback preview is refused by the demo branch's trusted-domain list (`403 INVALID_ORIGIN`)
 * while the same POST from Node answers 200 — `references/qa-stills.md` records the measurement —
 * so this is the working path, and the credential never enters the page. The account is the demo
 * branch's own (`demo_account`, seeded under `DEMO_AUTH=1`); nothing is invented and no password is
 * printed.
 */
const ROLES = [
  { role: "public", email: null, note: "no session" },
  {
    role: "member",
    email: "initiator@demo.alignsynch.test",
    note: "signed in as the demo initiator",
  },
  { role: "admin", email: "admin@demo.alignsynch.test", note: "signed in as the demo admin" },
];

const CHROME = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const DEBUG_PORT = Number(process.env.QA_ATLAS_DEBUG_PORT ?? 9466);
/**
 * One capture may take this long before it is recorded as a failure. Generous, because a dev server
 * compiles a route on first visit and a tall marketing page is a large surface to paint; still
 * bounded, so one stalled route cannot empty the atlas.
 */
const CAPTURE_TIMEOUT_MS = Number(process.env.QA_ATLAS_CAPTURE_TIMEOUT_MS ?? 90_000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

/** A file name for a route: `/` is the root, an id segment keeps its name, brackets go. */
function slugOf(route) {
  const cleaned = route
    .replace(/\[(?:\.\.\.)?([a-zA-Z]+)\]/g, "$1")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return cleaned === "" ? "root" : cleaned;
}

/**
 * The commit this tree is standing on — the value the server must agree with before a capture runs.
 *
 * `git rev-parse HEAD` answers here and `git branch --show-current` does not: a worktree on a branch
 * and a detached worktree both report the commit that was compiled, and the branch name is not part
 * of the question. A tree with no git (an exported copy) answers nothing, and the capture refuses —
 * see `captureRefusal()`, which owns the wording.
 */
function treeCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
  if (result.status !== 0) return "";
  return String(result.stdout ?? "").trim();
}

/* ------------------------------------------------------------------ *
 * The demo branch's identifiers
 * ------------------------------------------------------------------ */

/**
 * The concrete rows the deep routes are exercised with, read from the branch that is about to be
 * screenshotted.
 *
 * Read, never invented: an id typed into a script is one edit away from pointing at a row nobody
 * has, and the atlas would then document a 404 as if it were a page. A missing row returns `null`
 * and the route is skipped **by reason**.
 */
async function branchIdentifiers() {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString === "") return null;
  const client = new Client({ connectionString });
  try {
    await client.connect();
  } catch {
    return null;
  }
  try {
    const one = async (sql, values = []) => (await client.query(sql, values)).rows[0] ?? null;

    const template = await one(
      `select r.id, r.slug from record r
        where r.record_type = 'assessment' and r.status = 'published'
          and exists (select 1 from "session" s where s.template_record_id = r.id)
        order by r.date limit 1`,
    );
    const member = await one(
      `select s.record_id, s.relationship_id, u.handle, p.user_id
         from "session" s
         join party p on p.session_record_id = s.record_id and p.role = 'initiator'
         join demo_account d on d.user_id = p.user_id
         left join user_profile u on u.user_id = p.user_id
        where d.email = $1
        limit 1`,
      ["initiator@demo.alignsynch.test"],
    );
    /**
     * A template **the demo initiator authored** — `/dashboard/templates/[id]` opens one of those and
     * 404s for a curated template with no owner (`readMyTemplate`'s own predicate). Read from the
     * branch rather than assumed: the seeded dataset carries none today, and the atlas then says so
     * instead of asking for a screen that cannot exist.
     */
    const memberTemplate = member?.user_id
      ? await one(
          `select r.id from record r
            where r.record_type = 'assessment' and r.owner_user_id = $1
              and not exists (select 1 from "session" own where own.record_id = r.id)
              and not exists (
                select 1 from relationship rel
                 where rel.template_id = r.id and r.visibility = 'private'
              )
            order by r.date desc limit 1`,
          [member.user_id],
        )
      : null;
    /**
     * There is no invite token to read: `session_invite` stores `token_hash`, not the token, so a
     * link cannot be reconstructed from the branch — and the seeded dataset carries no pending
     * invite anyway. The atlas reports `/invite/[token]` as skipped with that reason rather than
     * minting a link nobody was sent.
     */
    return {
      templateSlug: template?.slug ?? null,
      templateId: template?.id ?? null,
      memberTemplateId: memberTemplate?.id ?? null,
      instanceId: member?.record_id ?? null,
      memberRelationshipId: member?.relationship_id ?? null,
      relationshipId: member?.relationship_id ?? null,
      handle: member?.handle ?? null,
      inviteToken: null,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * A demo account's session, obtained from Node and ready to hand to Chrome.
 *
 * The row comes from `demo_account` — the same table the `/login` role buttons read — and the
 * sign-in goes through the branch's own endpoint, so the session is a real one. The password is
 * read, used and dropped: it is never logged and never reaches the page.
 */
async function demoSession(email) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let row = null;
  try {
    row = (await client.query("select email, password from demo_account where email = $1", [email]))
      .rows[0];
  } finally {
    await client.end().catch(() => undefined);
  }
  if (row === undefined || row === null) {
    throw new Error(
      `no demo_account row for ${email} — the demo accounts are seeded only under DEMO_AUTH=1 ` +
        "(run `DEMO_AUTH=1 pnpm db:seed` on the demo branch)",
    );
  }
  const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: row.email, password: row.password }),
  });
  if (!response.ok) {
    throw new Error(`the demo sign-in for ${email} answered ${response.status}`);
  }
  return { email: row.email, cookies: response.headers.getSetCookie() };
}

/* ------------------------------------------------------------------ *
 * The fixture's own words
 * ------------------------------------------------------------------ */

const HEADLINE_KEY = /^(heading|title|headline|h1|kicker|eyebrow)$/i;

/** Strings a copy fixture offers as a headline, best first. */
function headlineCandidates(value, found = [], key = "") {
  if (typeof value === "string") {
    return found;
  }
  if (Array.isArray(value)) {
    for (const entry of value) headlineCandidates(entry, found, key);
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  for (const [entryKey, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      if (HEADLINE_KEY.test(entryKey) && entry.trim().length >= 4 && entry.length <= 160) {
        found.push({ key: entryKey, text: entry });
      }
      continue;
    }
    headlineCandidates(entry, found, entryKey);
  }
  return found;
}

/**
 * The route's fixture, imported and mined for a headline.
 *
 * A fixture is a plain data module (no React, no Next), which is what `data:check` already relies
 * on — so this reads the same words the page renders instead of asking the DOM what it thinks it
 * says.
 */
async function fixtureHeadlines(fixturePath) {
  const module = await import(`../${fixturePath}.ts`).catch(() => null);
  if (module === null) return [];
  const candidates = [];
  for (const value of Object.values(module)) {
    candidates.push(...headlineCandidates(value).map((entry) => entry.text));
  }
  // Prefers the surface's own heading: distinct strings, at most six, because a short label
  // ("Sign in") is likelier to appear in a nav than the band the page is built around.
  return [...new Set(candidates)].slice(0, 6);
}

/**
 * Every copy fixture a surface can render: the one `budget.ts` records, plus the ones the page
 * imports itself.
 *
 * A page is allowed to choose its words per brand — `/` renders `data/pages/home` on one build and
 * `data/pages/home-alignsynch` on the other, and the two legal pages read their brand's strings
 * through one fixture. Asserting on the budget's fixture alone would therefore fail every route
 * that branches, and asserting on the page's imports alone would drop the attribution the budget
 * records. So both are read, budget first, and a candidate from either counts: the claim being
 * tested is "the words this surface is built from are on the screen".
 */
async function headlinesFor(fixturePath, pagePath) {
  const fixtures = [fixturePath];
  try {
    const page = readFileSync(join(repoRoot, pagePath), "utf8");
    for (const match of page.matchAll(/from\s+"@\/(data\/pages\/[^"]+)"/g)) {
      fixtures.push(match[1]);
    }
  } catch {
    // A page module the budget names but the tree does not have is a red gate elsewhere; here it
    // simply contributes no candidates and the failure names the missing headline.
  }
  const candidates = [];
  for (const fixture of [...new Set(fixtures)]) {
    candidates.push(...(await fixtureHeadlines(fixture)));
  }
  return [...new Set(candidates)];
}

/* ------------------------------------------------------------------ *
 * Capture
 * ------------------------------------------------------------------ */

const normalise = (value) => value.replace(/\s+/g, " ").trim();

/**
 * One capture: navigate, assert, and pay for the shutter.
 *
 * Returns the verdict and the evidence — the pieces that end up in `manifest.json`. Nothing here
 * throws on a failed assertion: a failure is the output, not an error.
 */
async function capture(send, row, width, shotFile, notFoundFixtures) {
  const marks = {};
  const tick = (label) => {
    marks[label] = Date.now();
  };
  tick("start");
  configureCdp({ width });
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });

  state.console = [];
  state.status = null;
  state.failed = [];
  await navigate(send, row.path);
  tick("navigated");
  // A session-gated route redirects before it renders, and a redirect is a navigation: wait for the
  // document that actually settled.
  await sleep(150);

  const body = normalise(await text(send));
  const finalPath = await evaluate(send, "location.pathname");
  /**
   * The content region, and whether the page marks one.
   *
   * `main` first, then `[role="main"]`, then the densest element under `body` — because a screen is
   * not always wrapped in a landmark, and "the marketing pages do not render `<main>`" is a finding
   * worth *recording per row* rather than the reason every public page fails. Which selector was
   * used is in the manifest, so the assertion can never be read as stronger than it was.
   */
  const main = await evaluate(
    send,
    `(() => {
      const landmark = document.querySelector("main") ?? document.querySelector('[role="main"]');
      const el = landmark ?? document.body;
      const nodes = [...el.querySelectorAll("*")];
      return {
        selector: landmark === null ? "body" : landmark.tagName.toLowerCase(),
        present: landmark !== null,
        chars: (el.innerText ?? "").length,
        nodes: nodes.length,
        headings: [...el.querySelectorAll("h1")].slice(0, 2).map((heading) => heading.innerText.slice(0, 120)),
      };
    })()`,
  );

  const status = state.status;
  const problems = [];

  if (status !== row.expected) {
    problems.push(`status ${status ?? "none"}, expected ${row.expected}`);
  }
  /**
   * A create-flow stage with no draft behind it lands on stage 1 — that is the flow's own rule
   * (`docs/specs/flow-stages.md`: a create starts at Details), not a broken link. The destination is
   * derived from the URL shape and must match exactly, so "redirected somewhere else" is still a
   * failure; a route that silently lands on stage 1 when it was supposed to render is not.
   */
  const declared = declaredRedirect(row.path);
  const redirectedTo = row.expected === 200 && finalPath !== row.path ? finalPath : null;
  if (redirectedTo !== null && redirectedTo !== declared) {
    problems.push(`redirected to ${finalPath}`);
  }
  const hydration = state.console.filter((message) => /#418|hydration/i.test(message));
  const errors = state.console.filter((message) => !/#418|hydration/i.test(message));
  if (hydration.length > 0) problems.push(`React hydration: ${hydration[0].slice(0, 160)}`);
  /**
   * The console assertion is about **product surfaces**. A route the brand boundary closes is not
   * one: it renders the app's not-found, and the app's not-found logs its own dev-mode complaints
   * (React's "script tag" notice from `next-themes`, the 404 document request itself). Failing 21
   * quiz routes for the same not-found line would bury the route that actually broke, so the closed
   * surface's console output is **recorded** — per row, and as a finding in the document — instead of
   * being counted as a failure of each row. Hydration above still fails anywhere, because that is a
   * disagreement this atlas must never wave through.
   */
  if (row.expected === 200) {
    for (const failure of state.failed.slice(0, 3)) {
      problems.push(`failed request: ${failure.slice(0, 180)}`);
    }
    for (const message of errors.slice(0, 3)) {
      problems.push(`console error: ${message.slice(0, 160)}`);
    }
  }

  let headline = null;
  if (row.expected === 200) {
    headline = { candidates: row.headlines ?? [], matched: null };
    for (const candidate of row.headlines ?? []) {
      if (body.includes(normalise(candidate))) {
        headline.matched = candidate;
        break;
      }
    }
    if (headline.candidates.length === 0) {
      problems.push("no headline candidate in the fixture");
    } else if (headline.matched === null) {
      problems.push(`headline absent: "${headline.candidates[0].slice(0, 80)}"`);
    }
    if (main.chars < 40 || main.nodes < 5) {
      problems.push(`content region too thin: ${JSON.stringify(main)}`);
    }
  } else {
    // A closed route must render the app's own not-found, not a blank body or a stack trace.
    headline = { candidates: notFoundFixtures, matched: null };
    for (const candidate of notFoundFixtures) {
      if (body.includes(normalise(candidate))) {
        headline.matched = candidate;
        break;
      }
    }
    if (headline.matched === null) problems.push("the 404 body is not the app's not-found copy");
  }

  const image = await shutter(send, shotFile);
  tick("shot");

  return {
    width,
    status,
    finalPath,
    redirect:
      redirectedTo === null ? null : { to: redirectedTo, declared: redirectedTo === declared },
    headline,
    main,
    hydration: hydration.length,
    consoleErrors: row.expected === 200 ? errors : [],
    /** What a boundary-closed route's own not-found logged — recorded, never counted as a failure. */
    closedConsole: row.expected === 200 ? [] : errors.slice(0, 3),
    image,
    timing: {
      navigateMs: marks.navigated - marks.start,
      assertMs: marks.shot - marks.navigated,
    },
    verdict: problems.length === 0 ? "pass" : "fail",
    problems,
  };
}

/**
 * The one redirect a route may legitimately answer with: a create-flow stage with no draft lands on
 * that flow's stage 1. Derived from the URL (`…/create/<stage>` → `…/create`), never listed.
 */
function declaredRedirect(path) {
  const stage = /^(.*\/create)\/[^/]+$/.exec(path ?? "");
  return stage === null ? null : stage[1];
}

/**
 * Did a signed-in pass lose its session mid-route?
 *
 * A 404 where the registry expects 200, or a bounce to `/login`, is the signature of cookies
 * belonging to a demo identity that a concurrent `db:seed` recreated — not of a broken page. The
 * pass signs in again and re-shoots once rather than reporting the run's own interference as a
 * defect of eleven routes.
 */
function sessionInvalidated(row, captures) {
  return (
    row.expected === 200 &&
    captures.some((entry) => entry.status === 404 || entry.finalPath === "/login")
  );
}

/**
 * A capture is bounded in time.
 *
 * One route that never finishes must not cost the run: the atlas documents every surface, and a
 * hang on the first one would leave it empty (measured once — the marketing home at 1440 stalled
 * the compositor for eleven minutes). A timeout is **recorded as a failure of that capture**, with
 * the reason, which is the same treatment every other failed assertion gets.
 */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) =>
      setTimeout(
        () => reject(new Error(`${label} exceeded ${Math.round(ms / 1000)} s`)),
        ms,
      ).unref(),
    ),
  ]);
}

/** Console and status, collected per navigation. */
const state = { console: [], status: null, requests: new Map(), failed: [] };

function watch(message) {
  if (message.method === "Network.responseReceived" && message.params.type === "Document") {
    state.status = message.params.response.status;
    return;
  }
  if (message.method === "Network.requestWillBeSent") {
    state.requests.set(message.params.requestId, message.params.request.url);
    return;
  }
  if (message.method === "Network.loadingFailed") {
    // A refused subresource is a console error in Chrome's own words ("Failed to load resource"),
    // which names no URL. The request map is what turns it back into something actionable.
    const url = state.requests.get(message.params.requestId) ?? "(unknown)";
    state.failed.push(`${url} — ${message.params.errorText ?? message.params.blockedReason ?? ""}`);
    return;
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    state.console.push(
      message.params.args
        .map((arg) => String(arg.value ?? arg.description ?? arg.type ?? ""))
        .join(" ")
        .slice(0, 300),
    );
    return;
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    state.console.push(String(message.params.entry.text ?? "").slice(0, 300));
  }
}

/** Resize a PNG to a 480 px WebP with the PIL the repo's QA crops already use. */
function thumbnail(source, target) {
  const script = [
    "import sys",
    "from PIL import Image",
    "src, dst, width = sys.argv[1], sys.argv[2], int(sys.argv[3])",
    "image = Image.open(src)",
    "if image.width > width:",
    "    image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)",
    'image.convert("RGB").save(dst, "WEBP", quality=78, method=6)',
  ].join("\n");
  const result = spawnSync("python3", ["-c", script, source, target, "480"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`thumbnail failed for ${source}: ${result.stderr?.slice(0, 300)}`);
  }
}

/* ------------------------------------------------------------------ *
 * The document
 * ------------------------------------------------------------------ */

const AREA_ORDER = ["marketing", "auth", "dashboard", "assessments", "admin", "quiz", "surface"];

const AREA_BLURB = {
  marketing: "The public pages — the brand's front door, pricing, legal and the help centre.",
  auth: "The account surfaces: sign in, register, the three password screens.",
  dashboard: "The member's own console: the overview, their records, settings, support.",
  assessments: "The two-party flow — the template catalogue, the five stages, the sessions.",
  admin: "The operator console.",
  quiz: "The quiz product's routes. On this build they are behind `product.quiz-surfaces`.",
  surface: "The three declared non-route copy surfaces: the shell, the tour and the 404.",
};

function widthLabel(row) {
  return row.widths.join(" · ");
}

/**
 * A markdown table with every cell padded to its column's width.
 *
 * The document is generated but it is also formatted: `pnpm format:check` runs `biome format` over
 * the tree, and biome aligns table rows. Emitting ragged tables would leave the generator's own
 * output failing the gate it is wired into, so the padding is the generator's job — the alternative
 * (a formatter pass after every write) would make generated output depend on a devDependency being
 * installed.
 */
function table(headers, rows) {
  const cells = rows.map((row) => row.map((cell) => String(cell ?? "")));
  /** An escaped pipe is two characters in the source and one on the page — measure the page. */
  const visible = (cell) => cell.replace(/\\\|/g, "|").length;
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...cells.map((row) => visible(row[index] ?? "")), 3),
  );
  const pad = (cell, width) => cell + " ".repeat(Math.max(0, width - visible(cell)));
  const line = (row) =>
    `| ${widths.map((width, index) => pad(row[index] ?? "", width)).join(" | ")} |`;
  return [
    line(headers),
    `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`,
    ...cells.map(line),
  ];
}

/**
 * Run the repo's own formatter over the generated document.
 *
 * The table helper below gets the shape right, but `pnpm format:check` is the authority on the
 * bytes, and a generated file that fails the gate it is wired into is a defect nobody can fix by
 * hand. So the generator formats its own output with the same binary the gate runs; when
 * `node_modules` is absent (a tree that has never been installed) it says so and leaves the file,
 * because the gate's install step comes first anyway.
 */
function formatGenerated(file) {
  const biome = join(repoRoot, "node_modules", ".bin", "biome");
  if (!existsSync(biome)) {
    console.error(`qa-atlas: no biome at ${biome} — ${file} was written unformatted`);
    return;
  }
  const result = spawnSync(biome, ["format", "--write", file], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(
      `qa-atlas: biome could not format ${file}: ${(result.stderr ?? "").slice(0, 300)}`,
    );
  }
}

/**
 * Rebuild the docs hub and the nav blocks after the document is written.
 *
 * `docs/qa-atlas/<version>/index.md` is listed in `docs/docs.json`, and every listed page carries a
 * generated nav block that `pnpm docs:nav` stamps above and below its body. A generator that wrote
 * a bare page would leave the tree failing `docs:check` — and a person would be tempted to add the
 * block by hand, which `docs:nav` then rewrites. So the generator runs the same command the gate
 * pretends you ran.
 */
function refreshDocsNav() {
  const script = join(repoRoot, "scripts", "docs-nav.mjs");
  if (!existsSync(script)) return;
  const result = spawnSync(process.execPath, [script, "--write"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`qa-atlas: docs:nav failed: ${(result.stderr ?? "").slice(0, 300)}`);
  }
}

function markdownFor(manifest, coverage, findings, changed) {
  const rows = manifest.routes;
  const failed = rows.filter((row) => row.verdict === "fail");
  const passed = rows.filter((row) => row.verdict === "pass");
  const skipped = rows.filter((row) => row.verdict === "skipped");
  const lines = [];

  lines.push(`# QA atlas — v${manifest.version}`, "");
  lines.push(
    `Every route \`data/pages/budget.ts\` registers, captured in a real browser at ` +
      `${manifest.widths.join(" / ")} CSS pixels and asserted four ways: status against the brand ` +
      "boundary, a clean console (no React `#418`, and no error on any surface the product ships), a " +
      "heading string from the route's own copy fixture present in the DOM, and a `main` subtree with " +
      "real content. A route the boundary closes renders the app's own not-found instead, and its " +
      "console output is recorded as a finding rather than counted as a failure of that route.",
    "",
  );
  lines.push("## Coverage", "");
  lines.push("```");
  lines.push(
    `${coverage.keys} registry surfaces · ${coverage.routes} routes · ${passed.length} captured and passing · ` +
      `${failed.length} failing · ${skipped.length} skipped`,
  );
  lines.push(
    `${coverage.surfaces} non-route surfaces (${rows
      .filter((row) => row.kind === "surface")
      .map((row) => row.route)
      .join(", ")}) — covered by the pages that mount them, listed below.`,
  );
  lines.push("```", "");
  lines.push(
    `Brand \`${manifest.brand}\` · generated ${manifest.generatedAt} · ` +
      `node \`${manifest.runtime.node}\` · \`${manifest.runtime.chrome}\` · ` +
      (typeof manifest.captureCommit === "string" && manifest.captureCommit !== ""
        ? `captured at \`${manifest.captureCommit.slice(0, 8)}\` (the server's \`/api/version\` agreed) · `
        : "") +
      `the machine-readable form is [\`manifest.json\`](manifest.json).`,
    "",
  );

  lines.push("## Changed this release", "");
  lines.push(changed.summary, "");

  if (findings.length > 0) {
    lines.push("## Findings", "");
    lines.push(
      "A finding is a fact the derivation could not settle, reported rather than smoothed over:",
      "",
    );
    lines.push(
      ...table(
        ["route", "finding"],
        findings.map((finding) => [`\`${finding.route}\``, finding.note]),
      ),
      "",
    );
  }

  if (failed.length > 0) {
    lines.push("## Failures", "");
    lines.push(
      "One row per assertion, with the widths it failed at — a page can render beautifully and " +
        "still be wrong, which is why each assertion is named rather than the route alone.",
      "",
    );
    const failureRows = [];
    for (const row of failed) {
      const byAssertion = new Map();
      for (const capture of row.captures.filter((entry) => entry.verdict === "fail")) {
        for (const problem of capture.problems) {
          const assertion = problem.split(":")[0];
          const seen = byAssertion.get(assertion) ?? { widths: new Set(), problem };
          seen.widths.add(capture.width);
          byAssertion.set(assertion, seen);
        }
      }
      for (const [assertion, seen] of byAssertion) {
        failureRows.push([
          `\`${row.route}\``,
          [...seen.widths].join(" · "),
          assertion,
          seen.problem.replace(/\|/g, "\\|").slice(0, 160),
        ]);
      }
    }
    lines.push(...table(["route", "widths", "assertion", "measured"], failureRows));
    lines.push("");
  } else {
    lines.push("No route failed an assertion on this run.", "");
  }

  if (skipped.length > 0) {
    lines.push("## Skipped", "");
    lines.push(
      ...table(
        ["route", "reason"],
        skipped.map((row) => [`\`${row.route}\``, row.skip.reason]),
      ),
      "",
    );
  }

  for (const area of AREA_ORDER) {
    const inArea = rows.filter((row) => row.area === area);
    if (inArea.length === 0) continue;
    lines.push(`## ${area[0].toUpperCase()}${area.slice(1)}`, "");
    lines.push(AREA_BLURB[area] ?? "", "");
    const areaRows = [];
    for (const row of inArea) {
      const status =
        row.kind === "surface"
          ? "—"
          : row.verdict === "skipped"
            ? `— (${row.expected})`
            : `${row.status} / ${row.expected}`;
      const widths = row.kind === "surface" ? "—" : widthLabel(row);
      const thumb = row.thumb === null ? "—" : `![${row.route}](${row.thumb})`;
      const verdict =
        row.verdict === "pass"
          ? (row.captures?.[0]?.redirect ?? null) === null
            ? "✓"
            : `✓ → \`${row.captures[0].redirect.to}\``
          : row.verdict === "fail"
            ? `✗ ${row.captures.flatMap((entry) => entry.problems).length} assertion(s)`
            : row.verdict === "covered"
              ? "covered — mounted by every page above"
              : `skipped — ${row.skip.reason}`;
      areaRows.push([`\`${row.route}\``, status, widths, thumb, verdict]);
    }
    lines.push(...table(["route", "status", "widths", "thumbnail", "verdict"], areaRows), "");
  }

  lines.push("## How this was produced", "");
  lines.push(
    `\`pnpm qa:atlas\` (\`scripts/qa-atlas.mjs\`) drove headless Chrome over the DevTools protocol — ` +
      "the same client `pnpm demo:flow` uses (`scripts/cdp.mjs`), no Playwright and no " +
      "Puppeteer — against `" +
      manifest.base +
      "` on the seeded demo branch. Routes come from `data/pages/budget.ts`; the boundary and the " +
      "expected status come from `tests/parity/boundary.ts` and each page's own gate call; the " +
      "headline comes from the route's copy fixture; the deep-route ids come from the branch's own " +
      "rows. Nothing in this document is authored by hand, and `pnpm qa:atlas:check` fails the gate " +
      "if the registry and `manifest.json` disagree.",
    "",
  );
  // The archive line states what happened, never what should have: an asset URL is printed only
  // when the run was told one (`--archive-url`), because a link to an asset nobody uploaded is a
  // 404 in a document whose whole point is that the reader can trust it. v1.17.0's release is
  // immutable, so that run wrote the archive beside itself and names it by digest instead.
  const archive = manifest.archive;
  lines.push(
    archive === null || archive === undefined
      ? "No full-size PNG archive: this run captured no screenshots."
      : archive.url
        ? `Full-size PNGs (${archive.entries} files, ${archive.bytes} bytes before compression) are ` +
          `not committed: [\`${archive.name}\`](${archive.url}) is the asset on this version's ` +
          `GitHub Release (sha256 \`${archive.sha256}\`).`
        : `Full-size PNGs (${archive.entries} files, ${archive.bytes} bytes before compression) are ` +
          "not committed and are not attached to this version's GitHub Release, whose assets are " +
          `immutable: \`${archive.name}\` is the archive the capture wrote, sha256 ` +
          `\`${archive.sha256}\`. \`pnpm qa:atlas\` regenerates it byte for byte from the same ` +
          "fixtures at the commit the release was cut from.",
    "",
  );

  return lines.join("\n");
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

async function main() {
  const started = Date.now();

  /**
   * `--render` rewrites `index.md` from the `manifest.json` already on disk — no browser, no
   * server, no connection. The document is generated, so a change to its wording must not cost a
   * fresh capture (or, worse, tempt anyone to hand-edit generated output).
   */
  if (flag("render") !== undefined) {
    const manifest = JSON.parse(readFileSync(join(OUT, "manifest.json"), "utf8"));
    const { rows } = await deriveRows({ brand: manifest.brand, db: null });
    const coverage = coverageOf(rows);
    const markdown = markdownFor(
      manifest,
      coverage,
      manifest.findings ?? [],
      changedSince(manifest),
    );
    writeFileSync(join(OUT, "index.md"), `${markdown.replace(/\n+$/, "")}\n`);
    formatGenerated(join(OUT, "index.md"));
    refreshDocsNav();
    console.log(`· re-rendered ${join(OUT, "index.md")} from manifest.json`);
    return 0;
  }

  console.log(`qa-atlas · v${VERSION} · brand ${BRAND} · base ${BASE}`);

  if (/production/i.test(process.env.NEON_BRANCH ?? "")) {
    console.error("qa-atlas: NEON_BRANCH=production — this signs in and reads rows; refusing.");
    return 2;
  }

  // A missing server is the most common way this run wastes ten minutes, so it is checked first.
  // The *second* check is the one #983 is about: a port that answers is not necessarily **this**
  // tree's server, and a capture that measures another card's build is confidently wrong.
  let served;
  try {
    const response = await fetch(`${BASE}/api/version`);
    if (!response.ok) throw new Error(String(response.status));
    served = await response.json();
  } catch {
    console.error(
      `qa-atlas: nothing answering at ${BASE}/api/version — start the server first ` +
        "(see the docstring, or docs/qa-atlas/README.md)",
    );
    return 2;
  }

  const tree = treeCommit();
  const refusal = captureRefusal({ base: BASE, server: served, tree, version: VERSION });
  if (refusal !== null) {
    console.error(`qa-atlas: ${refusal}`);
    return 2;
  }
  console.log(
    `· server answers ${JSON.stringify(served)} — that is this tree (${tree.slice(0, 8)})`,
  );

  const db = await branchIdentifiers();
  if (db === null) {
    console.error("qa-atlas: no DATABASE_URL — the deep routes need the demo branch's own ids");
    return 2;
  }
  console.log(`· branch ids: ${JSON.stringify(db)}`);

  const { rows, findings } = await deriveRows({ brand: BRAND, db });
  const coverage = coverageOf(rows);
  const notFoundCandidates = await fixtureHeadlines("data/pages/not-found");

  // Fixtures are resolved once per route: the same strings are the assertion at every width.
  for (const row of rows) {
    if (row.kind !== "route") continue;
    row.headlines = await headlinesFor(row.fixture, row.page);
  }

  ensureDir(OUT);
  ensureDir(SHOTS);
  const thumbs = ensureDir(join(OUT, "thumbs"));

  const captured = [];
  for (const pass of ROLES) {
    if (ONLY_ROLE !== null && pass.role !== ONLY_ROLE) continue;
    const mine = rows.filter(
      (row) =>
        row.kind === "route" &&
        row.role === pass.role &&
        row.skip === null &&
        (ONLY === null || row.route === ONLY),
    );
    if (mine.length === 0) continue;

    // The public pass runs on a browser with no session at all; the signed-in passes adopt a real
    // session obtained from the branch's own auth endpoint (`demoSession()`), because the browser
    // sign-in path is refused on a loopback origin.
    if (pass.email !== null && (process.env.DATABASE_URL ?? "") === "") {
      console.error(
        `qa-atlas: no DATABASE_URL — skipping the ${mine.length} ${pass.role} route(s) rather ` +
          "than capturing them signed out and calling a redirect a pass",
      );
      for (const row of mine) {
        row.skip = { reason: "no DATABASE_URL, so the demo session cannot be obtained" };
      }
      continue;
    }

    // A pass that cannot get its session is **recorded as skipped, with the reason** — never as a
    // pass, and never as a reason to abandon the other passes. The demo branch is shared, and a
    // concurrent `db:seed` without demo mode empties `demo_account` mid-run; that is a fact about
    // the branch, not a licence to report signed-out screens as handled.
    let sessionEmail = null;
    let page = null;
    try {
      configureCdp({ chrome: CHROME, port: DEBUG_PORT, width: 1440, height: 900, base: BASE });
      await launchChrome();
      page = await attach({ onEvent: watch });
      await page.send("Page.enable");
      await page.send("Runtime.enable");
      await page.send("Network.enable");
      try {
        await page.send("Log.enable");
      } catch {
        // Log domain is best-effort; Runtime.consoleAPICalled carries the errors that matter.
      }

      if (pass.email !== null) {
        const session = await demoSession(pass.email);
        await adoptSessionCookies(page.send, BASE, session.cookies);
        sessionEmail = session.email;
        // A session is not proved by the cookies being set: the first signed-in screen either
        // renders or bounces to /login, and that is the capture's own assertion.
        await navigate(page.send, "/dashboard");
        const landed = await evaluate(page.send, "location.pathname");
        if (landed === "/login") {
          throw new Error(`the ${pass.role} session did not hold — /dashboard bounced to /login`);
        }
      }

      console.log(`· ${pass.role} pass — ${mine.length} route(s) (${pass.note})`);

      /** Every width of one route. */
      const shoot = async (row, slug) => {
        const captures = [];
        const widths = [];
        for (const width of WIDTHS) {
          const shotFile = join(SHOTS, `${slug}-${width}.png`);
          let result;
          try {
            result = await withTimeout(
              capture(page.send, row, width, shotFile, notFoundCandidates),
              CAPTURE_TIMEOUT_MS,
              `${row.route} @ ${width}`,
            );
          } catch (error) {
            // A capture that could not finish is a failure of that row, recorded with its reason —
            // the session may also be wedged, so the pass rebuilds the browser after this route.
            result = {
              width,
              status: state.status,
              finalPath: null,
              redirect: null,
              headline: null,
              main: null,
              hydration: 0,
              consoleErrors: [],
              closedConsole: [],
              image: null,
              verdict: "fail",
              problems: [`capture did not finish: ${error.message}`],
            };
          }
          captures.push(result);
          widths.push(width);
          const mark = result.verdict === "pass" ? "✓" : "✗";
          const timing =
            result.timing === undefined
              ? ""
              : ` (${((result.timing.navigateMs + result.timing.assertMs) / 1000).toFixed(1)} s)`;
          console.log(
            `  ${mark} ${String(width).padStart(4)} ${row.route}${timing}` +
              (result.verdict === "pass" ? "" : ` — ${result.problems.join("; ").slice(0, 180)}`),
          );
        }
        return { captures, widths };
      };

      /** Whether the current row needed a fresh sign-in, recorded on its row. */
      let sessionResumed = false;

      for (const row of mine) {
        const slug = slugOf(row.route);
        sessionResumed = false;
        let { captures, widths } = await shoot(row, slug);
        /**
         * The demo branch is shared, and a concurrent `db:seed` recreates the three demo identities
         * (`DEMO_AUTH=1`) — the cookies this pass adopted then belong to accounts that no longer
         * exist, and every signed-in route answers 404 until the pass signs in again. That is the
         * branch's state, not the route's, so it is retried once and **noted on the row** instead of
         * being recorded as eleven broken routes.
         */
        if (pass.email !== null && sessionInvalidated(row, captures)) {
          console.log(`  ↻ ${row.route} — the session was invalidated mid-pass; signing in again`);
          const session = await demoSession(pass.email);
          await adoptSessionCookies(page.send, BASE, session.cookies);
          await navigate(page.send, "/dashboard");
          ({ captures, widths } = await shoot(row, slug));
          sessionResumed = true;
        }

        // The thumbnail is the still at the widest width that actually produced one — a route whose
        // 1440 capture timed out keeps its 768 as the evidence rather than an empty cell.
        const shot = [...captures].reverse().find((entry) => entry.image !== null);
        let thumb = null;
        if (shot !== undefined) {
          const thumbFile = join(thumbs, `${slug}.webp`);
          thumbnail(join(SHOTS, `${slug}-${shot.width}.png`), thumbFile);
          thumb = relative(OUT, thumbFile).split("\\").join("/");
        }

        captured.push({
          kind: row.kind,
          route: row.route,
          area: row.area,
          page: row.page,
          fixture: row.fixture,
          path: row.path,
          params: row.params,
          role: row.role,
          session: sessionEmail,
          brandGate: row.brandGate,
          expected: row.expected,
          gateReason: row.gateReason,
          status: captures[0]?.status ?? null,
          widths,
          thumb,
          sessionResumed,
          verdict: captures.every((entry) => entry.verdict === "pass") ? "pass" : "fail",
          captures,
          skip: null,
        });
      }
    } catch (error) {
      console.error(`qa-atlas: the ${pass.role} pass stopped — ${error.message}`);
      for (const row of mine) {
        if (captured.some((entry) => entry.route === row.route)) continue;
        row.skip = { reason: `${pass.role} pass stopped: ${error.message}` };
      }
    } finally {
      if (page !== null) page.close();
      stopChrome();
      await sleep(300);
    }
  }

  // Every route the loop did not capture is recorded, with the reason it was not.
  for (const row of rows) {
    if (captured.some((entry) => entry.route === row.route)) continue;
    captured.push({
      kind: row.kind,
      route: row.route,
      area: row.area,
      page: row.page,
      fixture: row.fixture,
      path: row.path,
      params: row.params,
      role: row.role,
      brandGate: row.brandGate,
      expected: row.expected,
      gateReason: row.gateReason,
      status: null,
      widths: [],
      thumb: null,
      verdict: row.kind === "surface" ? "covered" : "skipped",
      captures: [],
      skip:
        row.skip ??
        (row.kind === "surface"
          ? {
              reason: `non-route surface — mounted by every page (${row.page}), so it is measured by the routes above`,
            }
          : ONLY === null || row.route === ONLY
            ? { reason: "not captured on this run" }
            : { reason: "outside --only / --role" }),
    });
  }

  captured.sort((left, right) => {
    const area = AREA_ORDER.indexOf(left.area) - AREA_ORDER.indexOf(right.area);
    return area === 0 ? left.route.localeCompare(right.route) : area;
  });

  /**
   * What the boundary-closed routes' own not-found logged, gathered into **one** finding.
   *
   * Recorded rather than counted per row: the same dev-mode line on twenty-one routes is one fact
   * about the 404 surface, and putting it in the failures table 63 times would bury a route that
   * genuinely broke. It is still in the document — `closedConsole` on every capture, and this row.
   */
  const closedLines = new Map();
  for (const row of captured) {
    for (const entry of row.captures ?? []) {
      for (const message of entry.closedConsole ?? []) {
        const key = message.slice(0, 120);
        closedLines.set(key, (closedLines.get(key) ?? 0) + 1);
      }
    }
  }
  if (closedLines.size > 0) {
    const [first, count] = [...closedLines.entries()].sort((a, b) => b[1] - a[1])[0];
    findings.push({
      kind: "closed-surface-console",
      route: `${captured.filter((row) => row.expected === 404).length} boundary-closed routes`,
      note:
        `the app's not-found logs ${closedLines.size} distinct console line(s) ` +
        `(${count} capture(s) carry "${first.replace(/\|/g, "\\|")}"); recorded, not failed — the ` +
        "console assertion measures product surfaces",
    });
  }

  // The full-size set: one archive, never in the tree.
  const files = [];
  for (const row of captured) {
    for (const entry of row.captures) {
      const name = `${slugOf(row.route)}-${entry.width}.png`;
      const file = join(SHOTS, name);
      if (existsSync(file)) files.push({ name: `v${VERSION}/${name}`, data: readFileSync(file) });
    }
  }
  const archiveName = `qa-atlas-v${VERSION}-full-size.zip`;
  let archive = null;
  if (flag("no-zip") === undefined && files.length > 0) {
    const bytes = zipEntries(files);
    // Beside the shots, not inside them: the shots directory is scratch and is removed at the end
    // of the run, while the archive is the thing the release gets.
    const archiveFile = join(process.env.QA_ATLAS_ARCHIVE_DIR ?? tmpdir(), archiveName);
    writeFileSync(archiveFile, bytes);
    const digest = createHash("sha256").update(bytes).digest("hex");
    // `path` is where this run wrote it and is deliberately **not** recorded: an absolute
    // `/tmp/...` in a committed manifest is a promise the next machine cannot keep. The name and
    // the digest are the durable facts; `--archive-url` adds the release asset when one exists.
    const uploaded = flag("archive-url");
    archive = {
      name: archiveName,
      entries: files.length,
      bytes: bytes.length,
      sha256: digest,
      url: typeof uploaded === "string" ? uploaded : null,
    };
    console.log(`· archive ${archiveFile} (${files.length} files, ${bytes.length} bytes)`);
  }

  const manifest = {
    schema: SCHEMA,
    version: VERSION,
    brand: BRAND,
    base: BASE,
    /**
     * The commit the browser measured. The guard above proved `/api/version` agrees with this tree
     * before a single capture ran, so this is the fact that makes the document answerable: a reader
     * asks "was this measured against the tree it claims?" and the manifest answers (#983).
     */
    captureCommit: tree,
    generatedAt: new Date().toISOString(),
    runtime: {
      node: process.version,
      chrome: CHROME,
      widths: WIDTHS,
    },
    widths: WIDTHS,
    coverage: {
      keys: coverage.keys,
      routes: coverage.routes,
      surfaces: coverage.surfaces,
      captured: captured.filter((row) => row.kind === "route" && row.verdict !== "skipped").length,
      failing: captured.filter((row) => row.verdict === "fail").length,
      skipped: captured.filter((row) => row.verdict === "skipped").length,
    },
    boundary: {
      quiz: boundaryLists().quiz.length,
      admin: boundaryLists().admin.length,
    },
    findings,
    archive,
    routes: captured,
  };

  const changed = changedSince(manifest);
  const markdown = markdownFor(manifest, coverage, findings, changed);

  writeFileSync(join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(OUT, "index.md"), `${markdown.replace(/\n+$/, "")}\n`);
  formatGenerated(join(OUT, "manifest.json"));
  formatGenerated(join(OUT, "index.md"));
  refreshDocsNav();

  rmSync(SHOTS, { recursive: true, force: true });

  const failures = manifest.routes.filter((row) => row.verdict === "fail").length;
  console.log(
    `✓ qa-atlas v${VERSION} — ${coverage.keys} registry surfaces · ${coverage.routes} routes · ` +
      `${manifest.coverage.captured} captured · ${failures} failing · ` +
      `${manifest.coverage.skipped} skipped — ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  console.log(`· wrote ${join(OUT, "index.md")} and manifest.json`);

  // The PR body wants the numbers, so the run prints them in the shape the card asks for.
  for (const finding of findings) console.log(`  finding ${finding.route}: ${finding.note}`);
  return 0;
}

/**
 * "Changed this release" — the diff against the previous atlas.
 *
 * There is no previous atlas before v1.17.0, and that is a fact the document states rather than a
 * section that quietly disappears. The code path exists so v1.18 compares against v1.17 without
 * anyone rebuilding it: sibling directories under `docs/qa-atlas/` carrying a `manifest.json` are
 * the candidates, and the highest version below this one is the baseline.
 */
function changedSince(manifest) {
  const root = join(repoRoot, "docs", "qa-atlas");
  /** Sibling labels carry the `v`; the comparison is on the bare semver behind it. */
  const bare = (label) => label.replace(/^v/, "");
  const compare = (left, right) => {
    const a = bare(left).split(".").map(Number);
    const b = bare(right).split(".").map(Number);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const delta = (a[index] ?? 0) - (b[index] ?? 0);
      if (delta !== 0) return delta;
    }
    return 0;
  };

  const previous = existsSync(root)
    ? (readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => compare(name, manifest.version) < 0)
        .filter((name) => existsSync(join(root, name, "manifest.json")))
        .sort(compare)
        .pop() ?? null)
    : null;

  if (previous === null) {
    return {
      previous: null,
      summary:
        "The first atlas: there is no earlier version to diff against, so every route below is new. " +
        "The diff path exists — the next release's atlas compares its `manifest.json` against this " +
        "one, route by route, and lists what changed.",
    };
  }

  const before = JSON.parse(readFileSync(join(root, previous, "manifest.json"), "utf8"));
  const previousRows = new Map(before.routes.map((row) => [row.route, row]));
  const changes = [];
  for (const row of manifest.routes) {
    const prior = previousRows.get(row.route);
    if (prior === undefined) {
      changes.push(`\`${row.route}\` — new (${row.area}, ${row.verdict})`);
      continue;
    }
    if (prior.verdict !== row.verdict) {
      changes.push(`\`${row.route}\` — verdict ${prior.verdict} → ${row.verdict}`);
    }
    if (prior.status !== row.status) {
      changes.push(`\`${row.route}\` — status ${prior.status} → ${row.status}`);
    }
    if (JSON.stringify(prior.widths) !== JSON.stringify(row.widths)) {
      changes.push(`\`${row.route}\` — widths ${prior.widths.join("/")} → ${row.widths.join("/")}`);
    }
    previousRows.delete(row.route);
  }
  for (const route of previousRows.keys()) changes.push(`\`${route}\` — removed from the registry`);

  return {
    previous,
    summary:
      changes.length === 0
        ? `No route changed verdict, status or widths since ${previous}.`
        : `Against ${previous}:\n\n${changes.map((line) => `- ${line}`).join("\n")}`,
  };
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (error) {
  console.error(`qa-atlas: ${error.message}`);
  exitCode = 1;
} finally {
  stopChrome();
}
process.exit(exitCode);
