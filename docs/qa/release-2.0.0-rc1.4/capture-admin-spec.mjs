#!/usr/bin/env node
/**
 * Capture `/admin/spec` on the tree being released — the still the release page carries for
 * v2.0.0-rc1.4 (`docs/changelog/v2-0-0-rc1-4.md`).
 *
 * **Why this route.** The window's largest change is the Project Spec reader (#1254, #1263,
 * #1267, #1296, #1297): three routes, one fixture, and a register generated from
 * `data/spec/validation.json`. A still of the Overview is the release's own claim — that the
 * agreement is now readable inside the app instead of in a PDF — and nothing else in the window
 * has a screen that says it.
 *
 * **What the shutter proves, in order.** Four assertions run *before* the file is written, and a
 * disagreement fails without producing an image:
 *
 *   1. `/api/version` names this tree — the version the bumped `package.json` carries and the
 *      commit `git rev-parse HEAD` answers. A still of some other server is a still of some other
 *      release, and the atlas states the same guard for the same reason (#983).
 *   2. the frame is 1440 CSS px and something actually painted it — a page with no stylesheet
 *      renders a document, not the product, and a 200 cannot tell the difference.
 *   3. the page's own words are on it: the heading, the subtitle's opening clause, the CTA and the
 *      read-only chip, all from `data/pages/admin-spec.ts`.
 *   4. the brand is AlignSynch — the QuizHub build renders the same tree with the template's own
 *      chrome, so a still of `BRAND=quizhub` would pass 2 and 3 and show the wrong product.
 *
 * **The seat.** `/admin/spec` is admin-gated, so the capture signs in as the demo branch's own
 * administrator and hands the cookies to Chrome, exactly as `scripts/qa-atlas.mjs` does — a browser
 * sign-in on a loopback preview is refused by the branch's trusted-domain list (`403
 * INVALID_ORIGIN`) while the same POST from Node answers 200. The password is read from
 * `demo_account`, used, and dropped: it is never printed and never reaches the page.
 *
 * Usage (`BRAND=alignsynch`, the demo branch's env loaded, port 3411):
 *
 *     pnpm dev --port 3411 --hostname 127.0.0.1        # in this worktree
 *     node docs/qa/release-2.0.0-rc1.4/capture-admin-spec.mjs [origin] [out.png]
 *
 * The origin must be the dev server's own (`127.0.0.1`, never a public host): a cross-origin
 * `_next` request is blocked and the frame comes out unstyled.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
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
  viewport,
} from "../../../scripts/cdp.mjs";

const ROOT = resolve(import.meta.dirname, "../../..");
const origin = process.argv[2] ?? "http://127.0.0.1:3411";
const out = process.argv[3] ?? "docs/qa/release-2.0.0-rc1.4/admin-spec-1440.png";
const WIDTH = 1440;
const ADMIN_EMAIL = "admin@demo.alignsynch.test";

/** The pair `/api/version` must answer for this capture to be about this tree. */
function treeIdentity() {
  const version = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
  return { version, commit };
}

/** A demo administrator's session, obtained server-side and ready to hand to Chrome. */
async function adminSession() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let row = null;
  try {
    row = (
      await client.query("select email, password from demo_account where email = $1", [ADMIN_EMAIL])
    ).rows[0];
  } finally {
    await client.end().catch(() => undefined);
  }
  if (row === undefined || row === null) {
    throw new Error(
      `no demo_account row for ${ADMIN_EMAIL} — the demo accounts are seeded only under ` +
        "`DEMO_AUTH=1 pnpm db:seed` on the demo branch",
    );
  }
  const response = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: row.email, password: row.password }),
  });
  if (!response.ok) throw new Error(`the demo admin sign-in answered ${response.status}`);
  return response.headers.getSetCookie();
}

const tree = treeIdentity();
const served = await (await fetch(`${origin}/api/version`)).json();
if (served.version !== tree.version || served.commit !== tree.commit) {
  console.error(
    `✗ capture refused: ${origin} answers ${served.version} @ ${String(served.commit).slice(0, 9)}, ` +
      `this tree is ${tree.version} @ ${tree.commit.slice(0, 9)} — a still of another server is a ` +
      "still of another release",
  );
  process.exit(2);
}
console.log(
  `· server answers ${served.version} @ ${String(served.commit).slice(0, 9)} — this tree`,
);

const cookies = await adminSession();
configureCdp({ port: 9522, width: WIDTH, height: 1000, base: origin });
await launchChrome();
const { send } = await attach();

const failures = [];
try {
  await adoptSessionCookies(send, origin, cookies);
  await navigate(send, "/admin/spec");

  const innerWidth = await evaluate(send, "innerWidth");
  if (innerWidth !== WIDTH) failures.push(`viewport is ${innerWidth} CSS px, not ${WIDTH}`);
  const styleSheets = await evaluate(send, "document.styleSheets.length");
  if (styleSheets === 0) failures.push("no stylesheet loaded — the frame would be unstyled");

  const path = await evaluate(send, "location.pathname");
  if (path !== "/admin/spec") failures.push(`the admin session did not hold — landed on ${path}`);

  const body = await text(send);
  for (const word of ["Project Spec", "Read-only", "Open Validation", "Confidential"]) {
    if (!body.includes(word)) failures.push(`the page does not carry "${word}"`);
  }
  if (/QuizHub/.test(body))
    failures.push("this is the QuizHub brand — run the dev server with BRAND=alignsynch");

  if (failures.length > 0) {
    console.error(`✗ /admin/spec capture refused:\n  - ${failures.join("\n  - ")}`);
    process.exitCode = 1;
  } else {
    mkdirSync(dirname(out), { recursive: true });
    const shot = await shutter(send, out);
    console.log(
      JSON.stringify(
        {
          route: "/admin/spec",
          width: viewport().width,
          role: "admin",
          tree: `${tree.version} @ ${tree.commit.slice(0, 9)}`,
          asserted: ["Project Spec", "Read-only", "Open Validation", "Confidential", "not QuizHub"],
          out,
          ...shot,
        },
        null,
        2,
      ),
    );
  }
} finally {
  stopChrome();
}
