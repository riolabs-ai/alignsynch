#!/usr/bin/env node
/**
 * `scripts/demo-walkthrough.mjs` — the demo walkthrough as **scripted capture**: ten named steps,
 * each walked by a real browser, each captured at **390** and **1280**, each proved by the text on
 * the screen rather than by the fact that a PNG exists.
 *
 *   node scripts/demo-walkthrough.mjs            walk the ten steps, write 20 captures + a run report
 *   node scripts/demo-walkthrough.mjs --check    offline: the committed report is what the manifest
 *                                                 renders (no browser, no network, no credentials)
 *   node scripts/demo-walkthrough.mjs --write    regenerate the committed report from the manifest
 *
 * ## A screenshot is not proof, and this file is built around that
 *
 * The failure mode a capture harness invites is a green run that photographs **the wrong screen**:
 * a route that redirects to `/login`, a session that never arrives, a 404 with the app's chrome
 * still around it. All three produce a beautiful PNG and exit 0. So every step carries the strings
 * the screen must say (`expect`), the strings it must **not** say (`absent`), and where the step is
 * about a control rather than a sentence, the DOM facts that prove it (`selectors`, `roles`,
 * `field`). A step whose text does not hold is printed with what was actually measured, its capture
 * is still written (the evidence of what the screen *did* say), and the run exits **1**. The capture
 * documents the failure; the assertion is what passes.
 *
 * ## Zero new dependencies
 *
 * There is no Playwright, no Puppeteer and no Selenium in `package.json`, and this file adds none.
 * Chrome is already on the host (`/usr/bin/google-chrome`), and Node 24 has a global `WebSocket`, so
 * a headless Chrome driven over the DevTools Protocol is enough. The client is
 * `scripts/cdp.mjs` — the one copy in this repo, shared with `scripts/demo-flow.mjs` and
 * `scripts/qa-atlas.mjs` — rather than a second hand-rolled session that would drift from it on the
 * first geometry change.
 *
 * `scripts/design-audit.mjs` proves the smaller form (`google-chrome --headless=new
 * --screenshot=…`). That form is not enough here: a one-shot `--screenshot` cannot read the DOM, and
 * every step below asserts on text, so the run needs one Chrome session it can interrogate between
 * clicks. Same browser, same flags, one connection.
 *
 * ## Where the captures go, and why they are not committed
 *
 * `.artifacts/demo-walkthrough/` — gitignored, like `tests/parity/artifacts/`. Two reasons, both
 * measured rather than stylistic:
 *
 *   * **A committed PNG cannot be re-verified.** Twenty screenshots of a live branch are ~10 MB of
 *     bytes nobody can check against anything; the assertion in this file is what can be re-run.
 *   * **`docs/qa/` has a retention rule** (`scripts/capture-retention.mjs`): every directory there
 *     needs a register row, a live pointer or an open issue, and a `keep` row's weight must equal the
 *     directory's weight on disk *exactly*. A capture directory that changes every run would fail
 *     `pnpm docs:check` on the second run. The refusal below is that rule, stated where a caller can
 *     meet it rather than in a docstring they will not read.
 *
 * ## Which steps need a counterparty, and why they are declared instead of captured
 *
 * The run is **one session** — an anonymous visitor who signs in through the demo gate and stays as
 * the Initiator — because a second identity per step would make the capture order depend on the
 * parent card's answer to *"can a counterparty be signed in as?"* (`t_2e61c4c8`). The counterparty
 * screens are therefore listed in `BLOCKED` and rendered into the report as **declared, not
 * captured**: the table names them so nothing pretends the walk covered them, and no step claims a
 * proof nobody took. Measured on 2026-11-20 against the demo branch: `/login`'s demo panel does draw
 * a `counterparty` role button and it signs a browser in as the seeded counterparty — so the door
 * exists; what the parent card owns is whether that seat is **bound to a relationship whose Gap is
 * computable**. Until it answers, these three stay blocked.
 *
 * ## The report is generated, so it cannot describe a walk that no longer exists
 *
 * `docs/operations/demo-walkthrough.md` carries a generated region —
 * `<!-- demo-walkthrough:begin -->` … `<!-- demo-walkthrough:end -->` — rendered from `STEPS` and
 * `BLOCKED` by `renderRegion()`. `--check` fails when the committed region is not what the manifest
 * would write, and `tests/demo-walkthrough.test.ts` holds the same comparison inside `pnpm test`, so
 * editing a step without regenerating the table is a red gate rather than a quietly stale document.
 * The same test pins the shape the card asks for: **ten** steps, two widths each, and no step that
 * belongs to a counterparty.
 *
 * ## Exit codes
 *
 *   0  every step held, every capture was written
 *   1  a step did not hold (printed with what was measured), or `--check` found a stale report
 *   2  refused: a production origin, no `DEMO_PIN`, no Chrome, or a capture directory under `docs/qa`
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  attach,
  chooseDemoRole,
  click,
  configureCdp,
  demoGateIsOpen,
  evaluate,
  fill,
  launchChrome,
  navigate,
  shutter,
  sleep,
  stopChrome,
  submitDemoPin,
  text,
  url,
} from "./cdp.mjs";
import { repoRoot } from "./load-env.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The repo root this module reads the committed report from. */
export const ROOT = repoRoot ?? resolve(HERE, "..");

/** The two widths every step is captured at — the narrow layout and the desktop one. */
export const WIDTHS = [390, 1280];

/** The viewport height each width is measured in. `390 × 844` is the phone frame the card names. */
const HEIGHTS = { 390: 844, 1280: 900 };

/** Where the run writes its captures and its machine report. Gitignored — see the docstring. */
export const CAPTURE_DIR = ".artifacts/demo-walkthrough";

/** The committed report, and the two markers that bound the region this file owns inside it. */
export const REPORT_PAGE = "docs/operations/demo-walkthrough.md";
export const REPORT_BEGIN = "<!-- demo-walkthrough:begin -->";
export const REPORT_END = "<!-- demo-walkthrough:end -->";

/** The demo branch. A walk against a tree nobody deployed is a walk of nothing. */
export const DEFAULT_BASE = "https://demo.alignsynch.com";

/** The template the create flow is entered through — the seed's own slug, as `demo-flow` uses. */
const TEMPLATE_SLUG = "relationship-basics";

/** What step 10 types. A constant: a run-specific string would make two runs disagree. */
const WALK_TITLE = "Demo walkthrough — ten steps";

/**
 * The ten steps, in the order a visitor meets them.
 *
 * `needs` is `visitor` before the demo gate and `initiator` after it. `route` is the **declared**
 * path — the run records the observed one beside it, and a step whose route is chosen at run time
 * (step 8 opens whichever relationship the dashboard lists first) declares its shape and carries a
 * `routePattern` that the observed path must match.
 *
 * `acts` are the verbatim browser actions: `{ navigate }`, `{ pin: true }` (the demo gate),
 * `{ role }` (one of `/login`'s demo buttons), `{ clickFirst }` (the first element matching a
 * selector) and `{ fill: { selector, value } }`.
 */
export const STEPS = [
  {
    n: 1,
    id: "home",
    title: "Signed out, the home page names the promise",
    needs: "visitor",
    route: "/",
    acts: [{ navigate: "/" }],
    expect: ["Bring expectations into the open at work.", "Explore business templates"],
    selectors: ["h1"],
  },
  {
    n: 2,
    id: "templates",
    title: "The template gallery, with a worked example",
    needs: "visitor",
    route: "/relationship-templates",
    acts: [{ navigate: "/relationship-templates" }],
    expect: [
      "RELATIONSHIP TEMPLATES",
      "See Where You Agree. Talk About the Rest.",
      "Search Templates",
    ],
  },
  {
    n: 3,
    id: "pricing",
    title: "Pricing, in the visitor's words",
    needs: "visitor",
    route: "/pricing",
    acts: [{ navigate: "/pricing" }],
    expect: ["Simple Pricing. Start Free.", "The person you invite never pays."],
  },
  {
    n: 4,
    id: "how-it-works",
    title: "How it works, replayed from the recorded walk",
    needs: "visitor",
    route: "/how-it-works",
    acts: [{ navigate: "/how-it-works" }],
    expect: ["One relationship, six moves", "pnpm demo:flow"],
  },
  {
    n: 5,
    id: "demo-gate",
    title: "The demo gate asks for the PIN",
    needs: "visitor",
    route: "/demo",
    acts: [{ navigate: "/demo" }],
    expect: ["Demo sign-in", "Demo PIN"],
    selectors: ["#demo-pin"],
  },
  {
    n: 6,
    id: "demo-unlocked",
    title: "The PIN unlocks three demo seats",
    needs: "visitor",
    route: "/login",
    acts: [{ pin: true }],
    expect: ["Demo accounts"],
    roles: ["initiator", "counterparty", "admin"],
  },
  {
    n: 7,
    id: "dashboard",
    title: "Signed in as the Initiator, the dashboard is the next step",
    needs: "initiator",
    route: "/dashboard",
    acts: [{ role: "initiator" }, { navigate: "/dashboard" }],
    expect: ["Welcome Back", "Your Next Steps", "Active Relationships"],
  },
  {
    n: 8,
    id: "relationship",
    title: "A relationship opens from the dashboard",
    needs: "initiator",
    route: "/dashboard/relationships/<relationship>",
    routePattern: "^/dashboard/relationships/[a-z0-9-]+$",
    acts: [{ navigate: "/dashboard" }, { clickFirst: 'a[href^="/dashboard/relationships/"]' }],
    expect: ["At a Glance", "Discussion", "Initiator"],
  },
  {
    n: 9,
    id: "create-stage-1",
    title: "Stage 1 of 5: Details, with the six-cell rail and no Ongoing stage",
    needs: "initiator",
    route: `/dashboard/templates/${TEMPLATE_SLUG}/create`,
    acts: [{ navigate: `/dashboard/templates/${TEMPLATE_SLUG}/create` }],
    expect: ["STAGE 1 OF 5", "Relationship Details", "Starts when they join"],
    absent: ["Ongoing"],
    selectors: ["#create-title"],
  },
  {
    n: 10,
    id: "stage-1-typed",
    title: "Stage 1 takes a typed title and offers stage 2",
    needs: "initiator",
    route: `/dashboard/templates/${TEMPLATE_SLUG}/create`,
    acts: [{ fill: { selector: "#create-title", value: WALK_TITLE } }],
    expect: ["Continue to Stage 2"],
    field: { selector: "#create-title", value: WALK_TITLE },
  },
];

/**
 * The counterparty steps the run **declares and does not take** — see the docstring's last section.
 *
 * They are here rather than in `STEPS` because the ten-step walk is one session, and a step this
 * run cannot prove must not be scored as proved. Each names what it would prove, so the report says
 * what is missing instead of implying the demo's two-party half was covered.
 */
export const BLOCKED = [
  {
    id: "counterparty-invitation",
    title: "The counterparty opens the invitation and accepts",
    wouldProve: "the invitation link lands on the accept screen for the other seat",
  },
  {
    id: "counterparty-answers",
    title: "The counterparty answers the same sheet",
    wouldProve: "the second seat can submit, and neither sheet is readable before both submit",
  },
  {
    id: "counterparty-gap",
    title: "The counterparty reads the Gap once both sheets are sealed",
    wouldProve: "the report renders for the counterparty, not only for the Initiator",
  },
];

/* ------------------------------------------------------------------ *
 * The committed report
 * ------------------------------------------------------------------ */

/** The caption a capture cell carries: `01-home-390.png` … one per width, in `WIDTHS` order. */
function captureNames(step) {
  return WIDTHS.map((width) => `${String(step.n).padStart(2, "0")}-${step.id}-${width}.png`);
}

/** Every DOM fact a step asserts beyond its text, in the report's words. Empty for most steps. */
function beyondText(step) {
  const facts = [];
  if (step.absent !== undefined) facts.push(`no "${step.absent.join('", no "')}"`);
  if (step.selectors !== undefined) facts.push(step.selectors.map((s) => `\`${s}\``).join(", "));
  if (step.roles !== undefined) facts.push(step.roles.join(" · "));
  if (step.field !== undefined) facts.push(`\`${step.field.selector}\` holds what was typed`);
  if (step.routePattern !== undefined) facts.push("the open path matches the declared shape");
  return facts.length === 0 ? "" : facts.join("; ");
}

/**
 * A markdown table **as both formatters leave it**: every cell padded to its column's width, the
 * separator dashes the same width, and a floor of three so a one-character column still draws `---`.
 *
 * This is not cosmetic. `pnpm format:check` runs Biome over `docs/**`, Biome re-pads every table it
 * meets, and the generated region is compared byte for byte by `--check` and by
 * `tests/demo-walkthrough.test.ts`. Emitting the unpadded form would mean the gate's formatter and
 * this generator each rewriting the other's bytes forever — the two-author drift `docs-nav.mjs` and
 * `gen-glossary.mjs` avoid the same way, by writing the final form themselves.
 */
function table(head, rows) {
  const widths = head.map((cell, column) =>
    Math.max(3, cell.length, ...rows.map((row) => row[column].length)),
  );
  const line = (cells) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(" | ")} |`;
  return [line(head), line(widths.map((width) => "-".repeat(width))), ...rows.map(line)];
}

/**
 * The generated region: `step → route → capture path → expected text`, plus what the run does not
 * cover. A pure function of `STEPS` and `BLOCKED` — no clock, no filesystem, no run — so `--check`
 * can compare it byte for byte and the test can call it without a browser.
 */
export function renderRegion() {
  const lines = [];
  lines.push("---");
  lines.push("");
  const rows = STEPS.map((step) => {
    const [narrow, wide] = captureNames(step);
    return [
      String(step.n),
      step.title,
      step.needs,
      `\`${step.route}\``,
      `\`${narrow}\` · \`${wide}\``,
      step.expect.map((needle) => `"${needle}"`).join(" · "),
    ];
  });
  lines.push(
    ...table(["#", "step", "who", "route", "captures (390 · 1280)", "the screen must say"], rows),
  );
  lines.push("");
  const facts = STEPS.filter((step) => beyondText(step) !== "");
  if (facts.length > 0) {
    lines.push("Beyond the text, a step also proves:");
    lines.push("");
    for (const step of facts) lines.push(`- **${step.n} ${step.title}** — ${beyondText(step)}`);
    lines.push("");
  }
  lines.push("**Declared, not captured — a counterparty session:**");
  lines.push("");
  for (const step of BLOCKED) lines.push(`- **${step.title}** — would prove ${step.wouldProve}`);
  lines.push("");
  lines.push(`Captures land in \`${CAPTURE_DIR}/\`, beside the run's own \`report.json\`.`);
  lines.push("");
  return lines.join("\n");
}

/** The region as committed, or `null` when the two markers are not both there. */
export function committedRegion(page) {
  const begin = page.indexOf(REPORT_BEGIN);
  const end = page.indexOf(REPORT_END);
  if (begin === -1 || end === -1 || end < begin) return null;
  // Trimmed on both sides: the markers' own blank lines are not part of what is compared, so a
  // formatter that adds one above the table is not a stale report.
  return page.slice(begin + REPORT_BEGIN.length, end).trim();
}

/** The markers are the contract between this script and the page, so a missing pair is a failure. */
function regionBounds(page) {
  const begin = page.indexOf(REPORT_BEGIN);
  const end = page.indexOf(REPORT_END);
  if (begin === -1 || end === -1 || end < begin) {
    throw new Error(
      `${REPORT_PAGE}: the generated region needs ${REPORT_BEGIN} above it and ${REPORT_END} ` +
        "below it — this script owns the rows between them and nothing else on the page",
    );
  }
  return { begin, end };
}

/**
 * What is wrong with the manifest itself. Shape, not content: ten steps numbered 1..10, two widths
 * each, at least one expected string per step, no counterparty step smuggled into the run, and no
 * duplicate id — the failure modes of an edit made in a hurry.
 */
export function manifestProblems() {
  const problems = [];
  if (STEPS.length !== 10)
    problems.push(`STEPS holds ${STEPS.length} steps — the walk is ten by contract`);
  if (WIDTHS.length !== 2)
    problems.push(`WIDTHS holds ${WIDTHS.length} widths, and every step is 390 + 1280`);
  const ids = new Set();
  for (const [index, step] of STEPS.entries()) {
    if (step.n !== index + 1) problems.push(`step ${String(index + 1)} is numbered ${step.n}`);
    if (ids.has(step.id)) problems.push(`step ${step.n}: duplicate id "${step.id}"`);
    ids.add(step.id);
    if (!Array.isArray(step.expect) || step.expect.length === 0)
      problems.push(
        `step ${step.n} (${step.id}) asserts no text — a capture with no assertion is a printout`,
      );
    if (!["visitor", "initiator"].includes(step.needs))
      problems.push(
        `step ${step.n} (${step.id}): needs "${step.needs}" — a counterparty step does not belong in this run`,
      );
    if (typeof step.route !== "string" || !step.route.startsWith("/"))
      problems.push(`step ${step.n} (${step.id}): route "${step.route}" is not a path`);
    if ((step.acts ?? []).length === 0) problems.push(`step ${step.n} (${step.id}) does nothing`);
  }
  for (const step of BLOCKED) {
    if (STEPS.some((walked) => walked.id === step.id))
      problems.push(`"${step.id}" is both declared and walked — a blocked step must not be scored`);
  }
  return problems;
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

/** `/dashboard/relationships/<relationship>` — run-specific ids normalised out of an observed path. */
function normalisePath(observed, base) {
  const path = observed.startsWith(base) ? observed.slice(base.length) : observed;
  return path
    .split("?")[0]
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\/(relationship|assessment)-[a-z0-9-]+$/i, "/<relationship>");
}

/** Run one declared action. A missing control is a thrown error, not a step that scores false. */
async function perform(send, act) {
  if (act.navigate !== undefined) return await navigate(send, act.navigate);
  if (act.pin === true) {
    if ((await demoGateIsOpen(send)) !== true) {
      throw new Error("/demo drew no PIN gate — is DEMO_AUTH=1 on the branch, and DEMO_PIN set?");
    }
    return await submitDemoPin(send);
  }
  if (act.role !== undefined) return await chooseDemoRole(send, act.role);
  if (act.clickFirst !== undefined) {
    const drawn = await evaluate(
      send,
      `!!document.querySelector(${JSON.stringify(act.clickFirst)})`,
    );
    if (drawn !== true)
      throw new Error(`nothing matches ${act.clickFirst} — the screen did not offer it`);
    return await click(send, act.clickFirst);
  }
  if (act.fill !== undefined) return await fill(send, act.fill.selector, act.fill.value);
  throw new Error(`unknown action ${JSON.stringify(act)}`);
}

/**
 * Judge a step on **what the screen says**, and return what did not hold.
 *
 * Every check runs even when an earlier one has already failed: a step that says four things and
 * three of them are missing should report three, because the next reader is fixing a screen, not a
 * boolean.
 */
async function judge(send, step) {
  const body = await text(send);
  const observations = {};
  const failures = [];

  const missing = step.expect.filter((needle) => !body.includes(needle));
  if (missing.length > 0) failures.push(`does not say ${missing.map((m) => `"${m}"`).join(", ")}`);

  const leaked = (step.absent ?? []).filter((needle) => body.includes(needle));
  if (leaked.length > 0) failures.push(`says ${leaked.map((m) => `"${m}"`).join(", ")}`);

  for (const selector of step.selectors ?? []) {
    const drawn = await evaluate(send, `!!document.querySelector(${JSON.stringify(selector)})`);
    if (drawn !== true) failures.push(`draws no ${selector}`);
  }

  if (step.roles !== undefined) {
    const drawn = await evaluate(
      send,
      `[...document.querySelectorAll('input[name="as"]')].map((i) => i.value)`,
    );
    observations.roles = drawn;
    const want = JSON.stringify(step.roles);
    if (JSON.stringify(drawn) !== want)
      failures.push(`offers ${JSON.stringify(drawn)}, not ${want}`);
  }

  if (step.field !== undefined) {
    const held = await evaluate(
      send,
      `document.querySelector(${JSON.stringify(step.field.selector)})?.value ?? null`,
    );
    observations.field = held;
    if (held !== step.field.value) failures.push(`the field holds ${JSON.stringify(held)}`);
  }

  const observed = await url(send);
  const raw = (
    observed.startsWith(BASE_FOR_RUN) ? observed.slice(BASE_FOR_RUN.length) : observed
  ).split("?")[0];
  observations.path = normalisePath(observed, BASE_FOR_RUN);
  if (step.routePattern !== undefined && !new RegExp(step.routePattern).test(raw)) {
    failures.push(`opened ${raw}, which is not ${step.routePattern}`);
  }

  return { failures, observations, said: body.slice(0, 300) };
}

/**
 * One capture at one width.
 *
 * The width is set **before** the document height is measured, because the height of a page is a
 * function of its width: measuring at 1280 and then shooting at 390 clips the bottom third of the
 * narrow layout. `shutter()` measures at the width it is told and restores the height afterwards, so
 * the order here is the whole correctness argument.
 */
async function capture(send, file, width) {
  await setViewport(send, width);
  const shot = await shutter(send, file);
  return { width, file, sha256: shot.sha256, height: shot.height };
}

/** Put the viewport at one width and let the layout settle before anything is measured. */
async function setViewport(send, width) {
  configureCdp({ width, height: HEIGHTS[width] });
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: HEIGHTS[width],
    deviceScaleFactor: 1,
    mobile: false,
  });
  await evaluate(send, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await sleep(150);
}

/**
 * Every step is **judged at 1280**.
 *
 * The narrow layout hides things the wide one draws — a rail becomes a drawer, a table becomes
 * cards — so an assertion made at 390 and a capture made at 1280 would be two different screens, and
 * a step could pass or fail on capture order. Today `WIDTHS` happens to end at 1280, which would
 * make that true by accident; waking the desktop viewport before each step makes it true by
 * construction, so reordering `WIDTHS` cannot silently move where the assertions are made.
 */
async function wakeWide(send) {
  await setViewport(send, WIDTHS[WIDTHS.length - 1]);
}

/** The origin this run walks. Module scope because `judge()` normalises observed paths against it. */
let BASE_FOR_RUN = DEFAULT_BASE;

/** Refuse the capture directory the retention rule would fail on, before anything is written. */
function assertOutputDir(outDir) {
  const governed = resolve(ROOT, "docs", "qa");
  if (resolve(outDir).startsWith(governed)) {
    throw new Error(
      `${outDir} is under docs/qa/, whose retention rule (scripts/capture-retention.mjs) needs a ` +
        "register row whose weight equals the directory on disk — a capture directory that changes " +
        "every run fails pnpm docs:check on the next one",
    );
  }
}

async function run({ base, outDir, only }) {
  assertOutputDir(outDir);
  const pin = process.env.DEMO_PIN?.trim() ?? "";
  if (pin === "") {
    throw new Error(
      "DEMO_PIN is not set — the demo sign-in is the only door this walk may use. Run it through " +
        "bin/withenv.sh, which loads the repo's .env.local without copying a secret into the tree",
    );
  }

  const steps = only.length === 0 ? STEPS : STEPS.filter((step) => only.includes(step.n));
  BASE_FOR_RUN = base;
  configureCdp({
    base,
    chrome: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
    port: Number(process.env.CDP_PORT ?? 9461),
    width: WIDTHS[1],
    height: HEIGHTS[1280],
  });

  mkdirSync(outDir, { recursive: true });
  await launchChrome();
  const { send, close } = await attach();

  const rows = [];
  let aborted = null;
  try {
    for (const step of steps) {
      if (aborted !== null) {
        rows.push({ step, held: false, skipped: `not reached — ${aborted}` });
        continue;
      }
      try {
        await wakeWide(send);
        for (const act of step.acts) await perform(send, act);
        const verdict = await judge(send, step);
        const captures = [];
        for (const width of WIDTHS) {
          const file = `${String(step.n).padStart(2, "0")}-${step.id}-${width}.png`;
          captures.push(await capture(send, join(outDir, file), width));
        }
        const held = verdict.failures.length === 0;
        rows.push({ step, held, captures, ...verdict });
        const sizes = captures.map((shot) => `${shot.width}×${shot.height}`).join(" ");
        console.log(
          `${held ? "✔" : "✘"} ${String(step.n).padStart(2, "0")} ${step.route} — ${step.title}` +
            `  [${sizes}]`,
        );
        if (!held) for (const failure of verdict.failures) console.log(`   ✘ ${failure}`);
        if (!held) console.log(`   said: ${verdict.said.replace(/\s+/g, " ").slice(0, 240)}`);
      } catch (error) {
        // A missing control or a route that never arrives strands the session, so the remaining
        // steps are reported as not reached rather than walked into a second failure each. The
        // screen's own words are captured too: a refused demo sign-in answers with an alert and no
        // navigation, and "timed out waiting for the role button" alone would not say why.
        const said =
          (await text(send).catch(() => "")) || "(the page could not be read after the failure)";
        aborted = `${step.id}: ${error.message.slice(0, 200)}`;
        rows.push({
          step,
          held: false,
          failures: [error.message.slice(0, 400)],
          captures: [],
          said,
        });
        console.log(
          `✘ ${String(step.n).padStart(2, "0")} ${step.route} — ${error.message.slice(0, 240)}`,
        );
        console.log(`   said: ${said.replace(/\s+/g, " ").slice(0, 240)}`);
      }
    }
  } finally {
    close();
    stopChrome();
  }

  const captures = rows.reduce((total, row) => total + (row.captures?.length ?? 0), 0);
  const held = rows.filter((row) => row.held).length;
  const report = {
    $doc: {
      schema: "demo-walkthrough/run",
      purpose:
        "What one run of scripts/demo-walkthrough.mjs measured. Run-specific by design — the " +
        "committed report is docs/operations/demo-walkthrough.md, which is a pure function of the " +
        "manifest. This file carries the observed routes, the sha256 of each capture and what a " +
        "failed step actually said.",
      howTo: "node scripts/demo-walkthrough.mjs — writes this beside the captures it names",
    },
    base,
    widths: WIDTHS,
    summary: { steps: steps.length, captures, held, failed: rows.length - held },
    blocked: BLOCKED,
    steps: rows.map((row) => ({
      n: row.step.n,
      id: row.step.id,
      title: row.step.title,
      needs: row.step.needs,
      route: row.step.route,
      held: row.held,
      observed: row.observations?.path ?? null,
      roles: row.observations?.roles ?? null,
      field: row.observations?.field ?? null,
      captures: (row.captures ?? []).map((shot) => ({
        width: shot.width,
        height: shot.height,
        file: `${CAPTURE_DIR}/${shot.file.split("/").pop()}`,
        sha256: shot.sha256,
      })),
      failures: row.failures ?? [],
      said: row.held ? null : (row.said ?? null),
      skipped: row.skipped ?? null,
    })),
  };
  writeFileSync(join(outDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    `\ndemo-walkthrough · ${steps.length} steps · ${captures} captures · ${held} held · ` +
      `${rows.length - held} failed`,
  );
  const shown = outDir.startsWith(ROOT) ? outDir.slice(ROOT.length + 1) : outDir;
  console.log(`  captures  ${shown}/`);
  console.log(`  report    ${shown}/report.json`);
  if (steps.length === STEPS.length && BLOCKED.length > 0) {
    console.log(
      `  declared, not captured — ${BLOCKED.length} counterparty step(s); see the report`,
    );
  }
  return rows.length === held ? 0 : 1;
}

/* ------------------------------------------------------------------ *
 * Entry
 * ------------------------------------------------------------------ */

function main(argv) {
  const has = (flag) => argv.includes(flag);
  const value = (flag) => {
    const at = argv.indexOf(flag);
    return at === -1 ? null : (argv[at + 1] ?? null);
  };

  const problems = manifestProblems();
  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`);
    return 2;
  }

  const page = join(ROOT, REPORT_PAGE);

  if (has("--check")) {
    if (!existsSync(page)) {
      console.error(`✗ ${REPORT_PAGE} is missing — run --write to create its rows`);
      return 1;
    }
    const committed = committedRegion(readFileSync(page, "utf8"));
    if (committed === null) {
      console.error(`✗ ${REPORT_PAGE} carries no ${REPORT_BEGIN} … ${REPORT_END} region`);
      return 1;
    }
    if (committed.trimEnd() !== renderRegion().trimEnd()) {
      console.error(
        `✗ ${REPORT_PAGE}: the committed table is not what the manifest renders — a step was edited ` +
          "without regenerating the report. Run: node scripts/demo-walkthrough.mjs --write",
      );
      return 1;
    }
    console.log(
      `  ${STEPS.length} step(s), ${WIDTHS.length} width(s), ${STEPS.length * WIDTHS.length} ` +
        `capture(s) — the committed report is what the manifest renders`,
    );
    return 0;
  }

  if (has("--write")) {
    if (!existsSync(page)) {
      console.error(`✗ ${REPORT_PAGE} is missing — create the page, with its markers, first`);
      return 1;
    }
    const original = readFileSync(page, "utf8");
    const { begin, end } = regionBounds(original);
    const next = `${original.slice(0, begin)}${REPORT_BEGIN}\n\n${renderRegion().trimEnd()}\n\n${REPORT_END}${original.slice(end + REPORT_END.length)}`;
    if (next === original) {
      console.log(`  ${REPORT_PAGE}: already current`);
      return 0;
    }
    writeFileSync(page, next);
    console.log(
      `  ${REPORT_PAGE}: rewritten from the manifest (${STEPS.length} rows + blocked list)`,
    );
    return 0;
  }

  const base = (value("--base") ?? process.env.BASE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
  const host = new URL(base).hostname;
  if (/(^|\.)alignsynch\.com$/.test(host) && !host.startsWith("demo.")) {
    console.error(
      `✗ ${base} is the production origin — this walk signs in through the demo gate and types ` +
        "into forms. Nothing was launched.",
    );
    return 2;
  }

  const outDir = resolve(ROOT, value("--out") ?? CAPTURE_DIR);
  const only = (value("--only") ?? "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 0);

  return run({ base, outDir, only })
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`✗ demo-walkthrough: ${error.message}`);
      process.exit(2);
    });
}

// Named entry points: `--check`, `--write` and the walk are all this file, but the manifest and its
// renderer are imported by `tests/demo-walkthrough.test.ts`, which must not launch a browser.
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(HERE, "demo-walkthrough.mjs")
) {
  const outcome = main(process.argv.slice(2));
  // `--check` and `--write` answer a number; the walk answers a promise that exits the process
  // itself, because it holds a browser and a socket it must shut down before the exit.
  if (typeof outcome === "number") process.exitCode = outcome;
}
