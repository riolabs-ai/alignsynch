#!/usr/bin/env node
/**
 * Follow the provider's return: open a Checkout Session URL in headless Chrome and record where the
 * browser lands, the app's own words there, and a still of the surface.
 *
 * A completed test session redirects to the `success_url` the app minted, which is the "return URL"
 * half of this card's evidence. Nothing is typed; nothing is decided.
 *
 * Usage: node follow-return.mjs <checkout-url> <expect-origin> <out.json> [<shot.png>]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  attach,
  configureCdp,
  evaluate,
  launchChrome,
  shutter,
  sleep,
  stopChrome,
} from "../../../scripts/cdp.mjs";

const [checkoutUrl, expectOrigin, outPath, shotPath] = process.argv.slice(2);
if (!checkoutUrl || !expectOrigin || !outPath) {
  console.error("usage: follow-return.mjs <checkout-url> <expect-origin> <out.json> [shot.png]");
  process.exit(2);
}

configureCdp({ port: Number(process.env.CDP_PORT ?? 9516), width: 1440, height: 1000 });
await launchChrome();
const cdp = await attach();
const { send } = cdp;
const report = { ranAt: new Date().toISOString(), opened: checkoutUrl.split("?")[0], steps: [] };

try {
  await send("Page.enable");
  await send("Page.navigate", { url: checkoutUrl });
  const deadline = Date.now() + 90000;
  let current = "";
  while (Date.now() < deadline) {
    try {
      current = await evaluate(send, "location.href");
    } catch {
      current = "";
    }
    if (current.startsWith(expectOrigin)) break;
    await sleep(1000);
  }
  report.finalUrl = current.split("#")[0];
  report.landedOnApp = current.startsWith(expectOrigin);
  report.steps.push({
    step: "opened the session, waited for the app's origin",
    finalUrl: report.finalUrl,
  });
  if (report.landedOnApp) {
    await sleep(2500);
    report.pageTitle = await evaluate(send, "document.title");
    report.pageText = (
      await evaluate(send, `document.body.innerText.replace(/\\s+/g, " ").trim()`)
    ).slice(0, 1400);
    const shot = await shutter(
      send,
      shotPath ?? join(dirname(outPath), "pricing-after-checkout.png"),
    ).catch(() => null);
    if (shot !== null) report.shot = shot;
  }
} catch (error) {
  report.error = error.message;
} finally {
  stopChrome();
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.error === undefined && report.landedOnApp ? 0 : 1);
