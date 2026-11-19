#!/usr/bin/env node
/**
 * Capture `/pricing` on the tree being released — the still the release page carries for v2.0.0-rc1.3.
 *
 * `/pricing` is public, so the honest frame is the signed-out one: no cookie jar, no role. What the
 * shutter proves is the pool's one-plan change (#1237 removed Family, #1241 narrowed the catalogue to
 * a single card), so the script asserts the page's own words **before** it takes the picture and fails
 * without writing a file if they disagree.
 *
 * Usage: BRAND=alignsynch pnpm dev --port 3101  then
 *        node docs/qa/release-2.0.0-rc1.3/capture-pricing.mjs [origin] [out.png]
 *
 * The brand is part of the frame, not decoration: `BRAND` defaults to `quizhub`, and QuizHub's
 * `/pricing` carries the same `Basic` / `$9.99` words, so a still of the template passes every
 * price assertion while showing the wrong product. The origin must be the dev server's own
 * (`localhost`, never `127.0.0.1`) too — a cross-origin `_next` request is blocked and the frame
 * comes out unstyled.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
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

const origin = process.argv[2] ?? "http://127.0.0.1:3100";
const out = process.argv[3] ?? "docs/qa/release-2.0.0-rc1.3/pricing-1440.png";
const WIDTH = 1440;

configureCdp({ port: 9521, width: WIDTH, height: 1000, base: origin });
await launchChrome();
const { send } = await attach();

const failures = [];
try {
  await navigate(send, "/pricing");

  const innerWidth = await evaluate(send, "innerWidth");
  if (innerWidth !== WIDTH) failures.push(`viewport is ${innerWidth} CSS px, not ${WIDTH}`);

  // A still of an unstyled page proves the page rendered, not that it rendered the thing: the dev
  // server blocks `_next` assets requested cross-origin, so read the resolved styles back before
  // the shutter instead of trusting a 200.
  const styleSheets = await evaluate(send, "document.styleSheets.length");
  if (styleSheets === 0) failures.push("no stylesheet loaded — the frame would be unstyled");
  const cardBackground = await evaluate(
    send,
    `(() => {
      const card = [...document.querySelectorAll("div,article,section")].find((el) =>
        /\\$9\\.99/.test(el.textContent ?? ""),
      );
      return card === undefined ? "no element carries the price" : getComputedStyle(card).backgroundColor;
    })()`,
  );
  if (cardBackground.includes("no element")) failures.push(cardBackground);
  else if (cardBackground === "rgba(0, 0, 0, 0)")
    failures.push("the price card computes a transparent background — styles did not apply");

  const body = await text(send);
  if (!body.includes("Basic")) failures.push("the page does not name Basic");
  if (!body.includes("$9.99")) failures.push("the page does not carry the $9.99 price");
  if (/Family/.test(body)) failures.push("the page still offers a Family plan");
  // The template's own pricing page carries the same price words, so the brand needs its own check.
  if (/QuizHub/.test(body))
    failures.push("this is the QuizHub brand — run the dev server with BRAND=alignsynch");

  if (failures.length > 0) {
    console.error(`✗ pricing capture refused:\n  - ${failures.join("\n  - ")}`);
    process.exitCode = 1;
  } else {
    mkdirSync(dirname(out), { recursive: true });
    const shot = await shutter(send, out);
    console.log(
      JSON.stringify(
        {
          route: "/pricing",
          width: viewport().width,
          signedIn: false,
          asserted: ["Basic", "$9.99", "no Family"],
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
