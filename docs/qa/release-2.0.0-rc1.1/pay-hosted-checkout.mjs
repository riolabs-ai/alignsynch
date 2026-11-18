#!/usr/bin/env node
/**
 * Pay a Stripe **hosted** Checkout Session in test mode, in headless Chrome, and record what the
 * browser and the network actually did.
 *
 * The session is created by the app (`POST /api/billing/checkout` on production); this script only
 * opens the provider's page and types the card Stripe documents for test mode. It decides nothing
 * and proves nothing by itself: the caller reads the session back from the provider's API and the
 * rows back from the database.
 *
 * Usage:
 *   node docs/qa/release-2.0.0-rc1.1/pay-hosted-checkout.mjs <checkout-url> \
 *     <card-number> <success-origin> <out.json> [--decline]
 *
 * Prints only field names, the final URL and the page's own words — never a secret, never the full
 * session object. A declined card is expected to stay on the provider's page with a message.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  attach,
  configureCdp,
  evaluate,
  launchChrome,
  shutter,
  sleep,
  stopChrome,
} from "../../../scripts/cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const [checkoutUrl, cardNumber, successOrigin, outPath] = process.argv.slice(2);
const DECLINE = process.argv.includes("--decline");
if (!checkoutUrl || !cardNumber || !successOrigin) {
  console.error("usage: pay-hosted-checkout.mjs <checkout-url> <card> <success-origin> <out.json>");
  process.exit(2);
}
const OUT = outPath ?? join(HERE, "payment-step.json");

/** Run an expression inside an announced JS context (a cross-origin frame's world). */
async function evaluateIn(cdp, door, expression) {
  const params = { expression, returnByValue: true, awaitPromise: true, userGesture: true };
  if (door.contextId !== undefined) params.contextId = door.contextId;
  const result = await cdp.send("Runtime.evaluate", params, door.sessionId);
  if (result.exceptionDetails !== undefined) {
    throw new Error(`frame threw: ${result.exceptionDetails.text}`);
  }
  return result.result.value;
}

/**
 * The provider's frame that actually holds the card form.
 *
 * On the hosted page there are several `stripe.com` documents: the outer page (checkout.stripe.com)
 * and at least one inner frame for the card fields. The one that has a visible card input is the
 * only one worth typing into, so the door is chosen by a survey rather than by position.
 */
async function cardDoor(cdp, { timeout = 90000 } = {}) {
  const deadline = Date.now() + timeout;
  const surveys = [];
  while (Date.now() < deadline) {
    for (const [id, context] of cdp.contexts) {
      if (!/stripe\.com/.test(context.origin ?? "")) continue;
      if (context.auxData?.isDefault === false) continue;
      const door = { contextId: id, sessionId: context.sessionId };
      try {
        const survey = await evaluateIn(
          cdp,
          door,
          `(() => {
            const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
            const visible = inputs.filter((el) => el.type !== "hidden" && el.offsetParent !== null);
            return {
              href: location.href.split("?")[0],
              ready: document.readyState,
              fields: visible.map((el) => ({
                tag: el.tagName.toLowerCase(),
                type: el.type ?? "",
                name: el.name ?? "",
                id: el.id ?? "",
                autocomplete: el.autocomplete ?? "",
                label: (el.labels && el.labels[0] && (el.labels[0].textContent || "").trim()) || "",
                placeholder: el.placeholder ?? "",
              })),
            };
          })()`,
        );
        if (survey.fields.length > 0) {
          surveys.push({ origin: context.origin, href: survey.href, fields: survey.fields.length });
          const hasCard = survey.fields.some((f) =>
            /card.?number|cc-number/i.test(`${f.name} ${f.autocomplete} ${f.label}`),
          );
          if (hasCard) return { door, survey, seen: surveys };
        }
      } catch {
        // A context replaced mid-survey is a retry, not a failure.
      }
    }
    await sleep(500);
  }
  return { door: null, seen: surveys };
}

/** Type into a field the way a person does, then accept the value the field kept. */
async function typeInto(cdp, doorOf, selector, value) {
  const door = await doorOf();
  const focused = await evaluateIn(
    cdp,
    door,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el === null) return false;
      el.focus();
      return document.activeElement === el;
    })()`,
  );
  if (focused === true) {
    await cdp.send("Input.insertText", { text: value });
  }
  let landed = await evaluateIn(
    cdp,
    door,
    `document.querySelector(${JSON.stringify(selector)})?.value ?? null`,
  );
  const bare = (text) => String(text ?? "").replace(/[\s-]/g, "");
  if (bare(landed) !== bare(value)) {
    await evaluateIn(
      cdp,
      doorOf(),
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el === null) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()`,
    );
    landed = await evaluateIn(
      cdp,
      door,
      `document.querySelector(${JSON.stringify(selector)})?.value ?? null`,
    );
  }
  return landed;
}

const report = {
  ranAt: new Date().toISOString(),
  checkoutUrlHost: checkoutUrl.split("/")[2] ?? "",
  declined: DECLINE,
  steps: [],
};

configureCdp({ port: Number(process.env.CDP_PORT ?? 9512), width: 1440, height: 1000 });
await launchChrome();
const cdp = await attach();
const { send } = cdp;

try {
  await send("Page.enable");
  await send("Page.navigate", { url: checkoutUrl });
  report.steps.push({ step: "opened the provider's page", url: checkoutUrl.split("?")[0] });

  const found = await cardDoor(cdp);
  if (found.door === null) {
    report.failure = "the provider's page never drew a card field";
    report.seenContexts = found.seen;
    throw new Error(report.failure);
  }

  const doorOf = async () => {
    const again = await cardDoor(cdp, { timeout: 10000 });
    if (again.door === null) throw new Error("the card frame disappeared");
    return again.door;
  };

  report.fields = found?.survey?.fields?.map((f) => `${f.tag}[${f.type}] ${f.name || f.label}`);
  report.steps.push({ step: "the card form drew", fields: report.fields.length });

  const wanted = {
    email: /email/i,
    card: /card.?number|cc-number/i,
    expiry: /exp|cc-exp/i,
    cvc: /cvc|cvv|security/i,
    postal: /postal|zip|postcode/i,
  };
  const values = {
    email: process.env.QA_EMAIL ?? "",
    card: cardNumber.replace(/\s+/g, ""),
    expiry: "12/34",
    cvc: "123",
  };
  const fields = found.survey.fields;

  for (const [key, pattern] of Object.entries(wanted)) {
    if (values[key] === undefined) continue;
    const field = fields.find(
      (f) =>
        f.tag === "input" &&
        f.type !== "hidden" &&
        (pattern.test(f.name) || pattern.test(f.autocomplete) || pattern.test(f.label)),
    );
    if (field === undefined) continue;
    const selector = field.id !== "" ? `#${field.id}` : `input[name="${field.name}"]`;
    const landed = await typeInto(cdp, doorOf, selector, values[key]);
    report.steps.push({
      step: `typed ${key}`,
      field: `${field.name || field.label}`,
      landed: landed !== null,
    });
  }

  // Any field the page still demands (a country select, a name) is reported rather than guessed.
  // The provider's own submit. The trial session draws **"Start trial"**, and above it sits a
  // Link/saved-method control that opens a modal instead of paying — so the trial's control is
  // chosen first by name, and the generic labels are only a fallback.
  const pressSubmit = async () =>
    await evaluateIn(
      cdp,
      found.door,
      `(() => {
        const buttons = Array.from(document.querySelectorAll("button")).filter(
          (el) => el.offsetParent !== null && (el.textContent || "").trim() !== "" && !el.disabled,
        );
        const pick =
          buttons.find((el) => /start trial|subscribe|complete/i.test(el.textContent || "")) ??
          buttons.find((el) => /pay|confirm|continue/i.test(el.textContent || ""));
        if (pick === undefined) return null;
        const label = (pick.textContent || "").trim();
        pick.click();
        return label;
      })()`,
    );
  const submitLabel = await pressSubmit();
  report.steps.push({ step: "pressed the provider's submit", label: submitLabel });

  // The outcome: a completed test payment leaves for the app's return URL; a declined card stays on
  // the provider's page and prints a message there.
  const deadline = Date.now() + 120000;
  let finalUrl = "";
  while (Date.now() < deadline) {
    try {
      finalUrl = await evaluate(send, "location.href");
    } catch {
      finalUrl = "";
    }
    if (finalUrl.startsWith(successOrigin)) break;
    if (DECLINE) {
      const said = await cardDoor(cdp, { timeout: 5000 }).catch(() => null);
      if (said?.door !== null && said?.door !== undefined) {
        const words = await evaluateIn(
          cdp,
          said.door,
          `document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 600)`,
        ).catch(() => "");
        const message = await evaluateIn(
          cdp,
          said.door,
          `Array.from(document.querySelectorAll('[role="alert"], .Error, [data-testid*="error"]')).map((el) => el.textContent.trim()).join(" | ").slice(0, 400)`,
        ).catch(() => "");
        if (/declin|card was|insufficient|failed/i.test(`${words} ${message}`)) {
          report.declined = { words: words.slice(0, 400), alert: message };
          finalUrl = finalUrl || checkoutUrl.split("?")[0];
          break;
        }
      }
    }
    await sleep(1000);
  }

  report.finalUrl = finalUrl;
  report.reachedApp = finalUrl.startsWith(successOrigin);
  try {
    report.pageText = (
      await evaluate(send, `document.body.innerText.replace(/\\s+/g, " ").trim()`)
    ).slice(0, 1200);
  } catch {
    report.pageText = "";
  }

  mkdirSync(dirname(OUT), { recursive: true });
  const shot = await shutter(
    send,
    join(dirname(OUT), DECLINE ? "decline-step.png" : "payment-complete.png"),
  ).catch(() => null);
  if (shot !== null) report.shot = shot;
} catch (error) {
  report.error = error.message;
} finally {
  stopChrome();
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, pageText: undefined }, null, 2));
process.exit(
  report.error === undefined && (report.reachedApp || report.declined !== undefined || DECLINE)
    ? 0
    : 1,
);
