#!/usr/bin/env node
/**
 * Capture the surface the checkout returns to, as the account that paid: `/pricing` with this
 * session, asserting the page's own words before the shutter.
 *
 * The cookies come from the jar the sign-in wrote (`qa.jar`, Netscape format) and are set on the
 * browser without ever being printed. Nothing here signs in; it adopts a session another step made.
 *
 * Usage: node capture-pricing.mjs <jar> <origin> <out.json> <shot.png>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  attach,
  configureCdp,
  evaluate,
  launchChrome,
  shutter,
  sleep,
  stopChrome,
} from "../../../scripts/cdp.mjs";

const [jarPath, origin, outPath, shotPath] = process.argv.slice(2);
if (!jarPath || !origin || !outPath || !shotPath) {
  console.error("usage: capture-pricing.mjs <jar> <origin> <out.json> <shot.png>");
  process.exit(2);
}

const cookies = readFileSync(jarPath, "utf8")
  .split("\n")
  .filter((line) => line.trim() !== "" && !line.startsWith("# "))
  .map((line) => line.split("\t"))
  .filter((parts) => parts.length >= 7)
  .map((parts) => ({ name: parts[5], value: parts[6], domain: parts[0] }));

configureCdp({ port: Number(process.env.CDP_PORT ?? 9517), width: 1440, height: 1000 });
await launchChrome();
const cdp = await attach();
const { send } = cdp;
const report = { ranAt: new Date().toISOString(), cookiesSet: 0, steps: [] };

try {
  await send("Network.enable");
  for (const cookie of cookies) {
    const result = await send("Network.setCookie", {
      name: cookie.name,
      value: cookie.value,
      url: origin,
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    });
    if (result?.success !== false) report.cookiesSet += 1;
  }
  await send("Page.enable");
  await send("Page.navigate", { url: `${origin}/pricing` });
  await sleep(4000);
  report.url = await evaluate(send, "location.href");
  report.title = await evaluate(send, "document.title");
  const text = await evaluate(send, `document.body.innerText.replace(/\\s+/g, " ").trim()`);
  report.testModeLine =
    /Test mode: the card checkout runs on test keys, so no card is charged\./.test(text);
  report.planLine = (text.match(/(Basic|Single|Family)[^.]{0,80}/) ?? [])[0] ?? "";
  report.signedIn = !/Sign in|Log in/i.test(text.slice(0, 400)) || /Sign out/i.test(text);
  report.pageText = text.slice(0, 1200);
  await sleep(500);
  const shot = await shutter(send, shotPath).catch(() => null);
  if (shot !== null) report.shot = shot;
} catch (error) {
  report.error = error.message;
} finally {
  stopChrome();
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, pageText: undefined }, null, 2));
process.exit(report.error === undefined ? 0 : 1);
