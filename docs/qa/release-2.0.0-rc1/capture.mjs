#!/usr/bin/env node
/**
 * Capture the `v2.0.0-rc1` release candidate's nine surfaces at 1440 CSS px (#1166, card `t_5412ae1d`).
 *
 * A release candidate's evidence is a capture, not an assertion: the card says "MUST NOT ship an rc
 * with no QA capture" — an unverified release candidate is a release. So this walks the surfaces the
 * integration branch (`#1170`) ships, asserts **before** every shutter, and writes the whole thing
 * down as `capture-report.json` beside the PNGs it names.
 *
 * No Playwright and no Puppeteer: the client is `scripts/cdp.mjs` (#945), the same hand-rolled
 * DevTools-protocol session the rest of `docs/qa/**` uses. Node 24 has a global `WebSocket`.
 *
 * Two CDP details the stills convention already paid for, and neither is repeated here — `shutter()`
 * owns them: `Page.captureScreenshot` with a clip below the fold returns a blank frame, and
 * `captureBeyondViewport` alone still frames only the viewport, so the viewport is resized to the
 * measured document height before the frame and restored afterwards.
 *
 * ## Signed in through the app's own door
 *
 * The dashboard surfaces need a session. `/demo` takes a PIN and `/login` then offers the dataset's
 * three role buttons (`DEMO_ROLES` in `lib/auth/demo-accounts.ts`); this presses **Initiator**
 * because the relationships, the Aspect drawer and the payment panel belong to that person. A
 * browser sign-in on a loopback origin is the path `references/qa-stills.md` records as working
 * through `DEMO_PIN` — never a credential typed into the page.
 *
 * ## The relationship id is discovered, never typed
 *
 * A relationship id is minted by `pnpm db:seed`, so one written into this file would be a fact about
 * one seed run. The script reads the first id from the Initiator's own list at
 * `/dashboard/relationships` and names it in the report, which is why the report can be re-run and
 * still describe what it shot.
 *
 * ## Every shot is asserted first
 *
 * A still of an error page or a skeleton is worse than no still, so each capture checks the
 * document is complete, the fonts are in, the h1 is non-empty, the page names what the shot claims
 * it names, there is no horizontal overflow at 1440, and no env-shaped secret reached the text.
 * A failure names the shot and the measurement; nothing is written for that surface.
 *
 * Usage: node docs/qa/release-2.0.0-rc1/capture.mjs <base-url> [out-dir]
 *
 * Format the report before committing it:
 * `./node_modules/.bin/biome format --write docs/qa/release-2.0.0-rc1/capture-report.json`.
 * The harness writes `JSON.stringify(…, null, 2)` and biome's formatter collapses the short arrays,
 * so a report committed straight from a run is a `format` error in every lane — a check about a file
 * that has nothing to do with the change it is gating.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  attach,
  chooseDemoRole,
  configureCdp,
  demoGateIsOpen,
  evaluate,
  launchChrome,
  navigate,
  shutter,
  stopChrome,
  submitDemoPin,
  viewport,
} from "../../../scripts/cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? process.env.BASE_URL ?? "http://127.0.0.1:3412").replace(
  /\/+$/,
  "",
);
const OUT = process.argv[3] ?? HERE;
const DEBUG_PORT = Number(process.env.CAPTURE_DEBUG_PORT ?? 9499);
const WIDTH = 1440;

/** What a still must not contain: a secret that reached the render, never a code word. */
const SECRET_SHAPES =
  /(sk-[A-Za-z0-9]{16,}|postgres(?:ql)?:\/\/[^\s]+@|NEON_[A-Z_]+=|BWS_[A-Z_]+=)/;

/**
 * The surfaces this candidate ships. `expect` is the one string the shot claims the page says;
 * `why` is why that surface is in a release candidate at all, and it is the sentence the report and
 * the release page both borrow.
 */
const SURFACES = [
  {
    file: "dashboard-templates-1440.png",
    path: "/dashboard/templates",
    expect: "templates",
    why: "Templates v2 — the Library | My Templates shelf, the page that replaced the retired /templates/relationship catalogue (#1130, #1151)",
  },
  {
    file: "chat-1440.png",
    path: "/dashboard/chat",
    expect: "chat",
    why: "Chat v2 — a thread per relationship, and the rail's fifth row (#1131, #1154)",
  },
  {
    file: "relationship-discussion-1440.png",
    path: "RELATIONSHIP",
    expect: "discussion",
    why: "the relationship detail this candidate ships: six tabs on one record, Discussion in front (#1148, from v1.22.0)",
  },
  {
    file: "relationship-aspects-1440.png",
    path: "RELATIONSHIP#aspects",
    expect: "aspect",
    why: "the Aspect drawer and the live Aspect lock — numbered Aspects with a tolerance in words (#1133, #1155)",
  },
  {
    file: "relationship-payment-1440.png",
    path: "RELATIONSHIP#payment",
    expect: "payment",
    why: "Payment v2 — a trial panel per relationship, priced from the one plan catalogue (#1132, #1156)",
  },
  {
    file: "pricing-1440.png",
    path: "/pricing",
    expect: "$9.99",
    why: "conversion — /pricing reads the same three-plan catalogue the app bills from (#1127, #1159)",
  },
  {
    file: "relationship-templates-1440.png",
    path: "/relationship-templates",
    expect: "template",
    why: "the public template catalogue, now the only catalogue address (#1127 retires /relationship-types) (#1159)",
  },
  {
    file: "relationship-template-detail-1440.png",
    path: "/relationship-templates/colleagues",
    expect: "coworker",
    why: "a template's own public page, and the door into the create walk (#1159)",
  },
];

/** Everything the page can tell us that a still cannot. */
async function measure(send) {
  return await evaluate(
    send,
    `(() => {
      const pick = (selector) => [...document.querySelectorAll(selector)].map((el) => el.textContent.trim()).filter((t) => t !== "");
      return {
        title: document.title,
        path: location.pathname + location.hash,
        h1: pick("h1"),
        h2: pick("h2"),
        tabs: pick('[role="tab"]'),
        rail: pick("nav"),
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        textLength: document.body.innerText.trim().length,
        text: document.body.innerText.replace(/\\s+/g, " ").trim(),
      };
    })()`,
  );
}

const { width } = viewport();
if (width !== WIDTH)
  throw new Error(`the viewport is ${width}px wide — this capture is a 1440 set`);

configureCdp({ port: DEBUG_PORT, width: WIDTH, height: 900, base: BASE });
await launchChrome();
const session = await attach();
const { send } = session;

let failure = null;
const stills = [];

try {
  // --- the session ---------------------------------------------------------
  const onGate = await demoGateIsOpen(send);
  if (onGate !== true) {
    throw new Error(
      `/demo did not render the PIN gate on ${BASE} — is DEMO_AUTH=1 and DEMO_PIN set?`,
    );
  }
  await submitDemoPin(send);
  await chooseDemoRole(send, "initiator");

  // --- the relationship, read from the Initiator's own list ----------------
  await navigate(send, "/dashboard/relationships");
  const relationshipPath = await evaluate(
    send,
    `(() => {
      const link = [...document.querySelectorAll('a[href^="/dashboard/relationships/"]')]
        .map((el) => el.getAttribute("href"))
        .find((href) => href !== "/dashboard/relationships");
      return link ?? null;
    })()`,
  );
  if (relationshipPath === null) {
    throw new Error(
      "no relationship link on /dashboard/relationships — is the demo dataset seeded (pnpm db:seed)?",
    );
  }

  // --- the surfaces -------------------------------------------------------
  for (const surface of SURFACES) {
    const path = surface.path.startsWith("RELATIONSHIP")
      ? surface.path.replace("RELATIONSHIP", relationshipPath)
      : surface.path;

    await navigate(send, path);

    const ready = await evaluate(
      send,
      `document.readyState === "complete" && document.fonts.status === "loaded"`,
    );
    if (ready !== true) throw new Error(`${path}: the document never settled`);

    const measured = await measure(send);
    const where = `${measured.title} · ${measured.path}`;
    if (measured.h1[0] === "404" || measured.text.includes("This page isn't here")) {
      throw new Error(
        `${surface.file}: ${path} rendered the product's 404 — the route this row names is not a surface of this build`,
      );
    }
    if (measured.textLength < 200) {
      throw new Error(
        `${surface.file}: "${where}" rendered ${measured.textLength} characters — a shell, not a screen`,
      );
    }
    if (measured.noHorizontalOverflow !== true) {
      throw new Error(
        `${surface.file}: horizontal overflow at ${WIDTH}px — documentElement.scrollWidth ${measured.scrollWidth}`,
      );
    }
    if (SECRET_SHAPES.test(measured.text)) {
      throw new Error(`${surface.file}: an env-shaped secret reached the rendered text`);
    }
    if (!measured.text.toLowerCase().includes(surface.expect)) {
      throw new Error(
        `${surface.file}: the page does not say "${surface.expect}" — it says "${measured.text.slice(0, 160)}"`,
      );
    }

    const file = join(OUT, surface.file);
    const shot = await shutter(send, file);
    stills.push({
      file: surface.file,
      url: measured.path,
      width: shot.width,
      height: shot.height,
      sha256: shot.sha256,
      asserts: {
        title: measured.title,
        path: measured.path,
        h1: measured.h1[0] ?? "",
        h2: measured.h2,
        tabs: measured.tabs,
        rail: measured.rail.join(" ").replace(/\s+/g, " ").trim(),
        innerWidth: measured.innerWidth,
        scrollWidth: measured.scrollWidth,
        noHorizontalOverflow: measured.noHorizontalOverflow,
        envLeaks: [],
        textLength: measured.textLength,
      },
      why: surface.why,
    });
    console.log(`  ✓ ${surface.file}  ${measured.path}  ${shot.width}×${shot.height}`);
  }
} catch (error) {
  failure = error;
} finally {
  stopChrome();
}

if (failure !== null) {
  console.error(`\ncapture: ${failure.message}`);
  process.exit(1);
}

// --- the report -----------------------------------------------------------
const version = await fetch(`${BASE}/api/version`)
  .then((response) => response.json())
  .catch(() => null);

const report = {
  release: "2.0.0-rc1",
  commit: version?.commit ?? "unknown",
  capturedAt: new Date().toISOString(),
  method:
    "headless Chrome over the DevTools protocol (scripts/cdp.mjs) — Runtime.evaluate asserts, Page.captureScreenshot at the measured document height",
  server: `pnpm dev from this release's own tree, ${BASE}, loopback, demo branch env (.env.local wins over .env), /api/version answered ${JSON.stringify(version)}`,
  session:
    "signed in through the app's own demo door — the PIN at /demo, then the Initiator role on /login (lib/auth/demo-accounts.ts::DEMO_ROLES); no credential was typed into the page",
  relationship: stills.find((still) => still.file.startsWith("relationship-d"))?.url ?? "",
  stills,
};

mkdirSync(OUT, { recursive: true });
const reportPath = join(OUT, "capture-report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

const digest = createHash("sha256")
  .update(JSON.stringify(stills.map((still) => still.sha256)))
  .digest("hex");

console.log(`\ncapture: ${stills.length} still(s) at ${WIDTH}px`);
console.log(`  report   ${reportPath}`);
console.log(`  version  ${JSON.stringify(version)}`);
console.log(`  stills   ${stills.map((still) => still.sha256.slice(0, 12)).join(" ")}`);
console.log(`  set      sha256 ${digest.slice(0, 16)}`);
