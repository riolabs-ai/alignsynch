#!/usr/bin/env node
/**
 * Create one relationship through the app's own four stages, as the account whose session the cookie
 * jar holds, then send the invitation — the two acts that turn a `draft` into a published
 * relationship and grant the publish trial.
 *
 * Nothing here writes a row directly: every step is a request a person's form makes. The script
 * reads the status codes and the ids the app answers with, and prints them. It deletes nothing.
 *
 * Usage:
 *   node create-relationship.mjs <jar> <origin> <templateRecordId> <templateSlug> <aspects.json> <out.json>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const [jarPath, BASE, templateRecordId, templateSlug, aspectsPath, outPath] = process.argv.slice(2);
if (!jarPath || !BASE || !templateRecordId || !templateSlug || !aspectsPath || !outPath) {
  console.error(
    "usage: create-relationship.mjs <jar> <origin> <templateRecordId> <slug> <aspects.json> <out.json>",
  );
  process.exit(2);
}

const cookies = new Map();
for (const line of readFileSync(jarPath, "utf8").split("\n")) {
  if (line.trim() === "" || line.startsWith("# ")) continue;
  const parts = line.split("\t");
  if (parts.length < 7) continue;
  cookies.set(parts[5], parts[6]);
}
const COOKIE = () => [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

function absorb(response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (value === "") cookies.delete(name);
    else cookies.set(name, value);
  }
}

const form = async (path, fields) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: {
      cookie: COOKIE(),
      "content-type": "application/x-www-form-urlencoded",
      origin: BASE,
    },
    body: new URLSearchParams(fields).toString(),
  });
  absorb(response);
  return {
    status: response.status,
    location: response.headers.get("location"),
    body: await response.text(),
  };
};

const json = async (path, payload) => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: COOKIE(), "content-type": "application/json", origin: BASE },
    body: JSON.stringify(payload),
  });
  absorb(response);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return { status: response.status, location: response.headers.get("location"), body };
};

const get = async (path) => {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const response = await fetch(url, { redirect: "manual", headers: { cookie: COOKIE() } });
  absorb(response);
  return {
    status: response.status,
    location: response.headers.get("location"),
    html: await response.text(),
  };
};

const { aspects } = JSON.parse(readFileSync(aspectsPath, "utf8"));
const report = {
  ranAt: new Date().toISOString(),
  base: BASE,
  template: { id: templateRecordId, slug: templateSlug },
  steps: [],
};
const stem = `/templates/relationship/${templateSlug}/create`;

try {
  const who = await form("/assessment/new/who", {
    templateRecordId,
    initiatorFirst: "Qa",
    initiatorLast: "Billing",
    counterpartyFirst: "Qa",
    counterpartyLast: "Counterpart",
    email: process.env.QA_COUNTERPARTY_EMAIL ?? "qa-counterparty-rc11@alignsynch.com",
    title: "QA billing checkout",
    description: "",
  });
  report.steps.push({ step: "stage 1 Who", status: who.status, location: who.location });

  const mode = await form("/assessment/new/mode", {
    templateRecordId,
    mode: "basic",
    alignmentSetting: "soft",
  });
  report.steps.push({ step: "stage 2 Mode", status: mode.status, location: mode.location });

  const aspectsScreen = await get(mode.location ?? `${stem}/aspects`);
  report.steps.push({
    step: "stage 3 Aspects screen",
    status: aspectsScreen.status,
    listsAspects: aspectsScreen.html.includes('data-aspect-list="true"'),
  });

  const saved = await json("/assessment/new/aspects", {
    templateRecordId,
    aspects: aspects.map((a) => ({
      id: a.item_id,
      prompt: a.prompt,
      leftValue: a.left_value,
      rightValue: a.right_value,
    })),
  });
  report.steps.push({ step: "stage 3 saved aspects", status: saved.status, body: saved.body });

  const commit = await form("/assessment/new", { templateRecordId, draft: "1" });
  const location = commit.location ?? "";
  const instanceId =
    location.match(/\/assessment\/instances\/([0-9a-f-]{36})/)?.[1] ??
    location.match(/[?&]instance=([0-9a-f-]{36})/)?.[1] ??
    null;
  report.instanceId = instanceId;
  report.steps.push({
    step: "stage 4 commit (draft)",
    status: commit.status,
    location,
    instanceId,
    // A 500's own words, with anything secret-shaped removed — the failing hop must be named.
    body:
      commit.status >= 500
        ? commit.body
            .replace(/sk_(test|live)_[A-Za-z0-9]+/g, "<key>")
            .replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "<database-url>")
            .slice(0, 600)
        : undefined,
  });

  if (instanceId === null)
    throw new Error(`no instance id in the stage-4 answer: ${commit.status} ${location}`);

  const invite = await get(location);
  const gate = invite.html.match(/data-send-gate="([^"]+)"/)?.[1] ?? "(no gate marker)";
  report.steps.push({ step: "stage 5 Invite screen", status: invite.status, sendGate: gate });

  const sent = await form(`/assessment/instances/${instanceId}/send`, {});
  report.steps.push({ step: "stage 5 send", status: sent.status, location: sent.location });
} catch (error) {
  report.error = error.message;
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(report.error === undefined ? 0 : 1);
