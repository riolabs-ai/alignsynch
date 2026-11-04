#!/usr/bin/env node
/**
 * env-sync — push a local env file into Vercel env targets, idempotently, and report
 * drift without writing.
 *
 * The env FILE is the source of truth; this script is the only thing in the repo that
 * talks to the dashboard. It prints key NAMES only — never a value, never a prefix of one
 * — on every path, including errors. A value is used in exactly one place: the body of a
 * write request.
 *
 *   node scripts/env-sync.mjs --from .env.demo --target preview --branch demo
 *   node scripts/env-sync.mjs --from .env.demo --target preview --branch demo --apply
 *   node scripts/env-sync.mjs --from .env.demo --target preview --branch demo --diff
 *   node scripts/env-sync.mjs --from .env.production --target production --diff
 *   node scripts/env-sync.mjs --from .env.production --target production --apply --confirm-production
 *
 * A run without --apply (and without --diff) is a dry run. `--apply` against
 * `--target production` is refused unless --confirm-production is also given: rewriting
 * the live project's environment is the one mistake a typo can make expensive, and a flag
 * nobody types by accident is the cheapest guard against it.
 *
 * NEVER_PREVIEW and NEVER_AT_ALL below are release policy, not local preference — they
 * decide which keys may reach a demo target. That is why this file is versioned in the
 * repo instead of living in an operator's home directory: the decision has to be visible
 * in a review, next to the commit that changed it.
 *
 * Exit codes: 0 ok (a --diff that found drift included) · 1 usage/config error ·
 *             2 apply failed on at least one key.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT = "prj_jvt3U5GpGv5TnmWfyqkQ5kbbou5k";
const TEAM = "team_kA2uEuTmRU2RhACF1Len0GES";
const API = "https://api.vercel.com";

/**
 * Keys that must never be synced to a preview/demo target, even when the file carries
 * them. The value is the reason printed beside the decision, so the argument is visible
 * where the rule fires instead of living only in this comment.
 *
 *   ADMIN_EMAILS — the console's operator allowlist. A demo target is signed into by demo
 *   identities and shown to whoever is being shown the product; inheriting the real
 *   operators' addresses would put a working console account behind a demo login. The
 *   demo carries its own allowlist, or none.
 */
const NEVER_PREVIEW = new Map([
  ["ADMIN_EMAILS", "operator allowlist — a demo target must not admit the real operators"],
]);

/**
 * Never app configuration, at any target. Each entry is a local tool credential or a
 * stray field from a pasted curl. Syncing one hands the deployment a credential the app
 * does not use, and hides a real configuration mistake behind a key that looks set.
 *
 *   VERCEL_OIDC_TOKEN        minted per deployment by Vercel for the build to call Vercel
 *                            APIs. A copy in a local file is a captured, short-lived
 *                            credential — stale by the next deploy, and a secret the
 *                            deployment already mints for itself.
 *   BWS_ACCESS_TOKEN         Bitwarden Secrets Manager token: a local tool credential.
 *                            The deployment reads its secrets from Vercel, not Bitwarden,
 *                            so nothing there has a consumer for it.
 *   STRIPE_TEST_WEBHOOK_URL  the Stripe dashboard owns the endpoint URL and the app reads
 *                            only the signing secret. Syncing the URL lets a local value
 *                            silently disagree with the endpoint Stripe posts to.
 *   client_id, client_secret, scope, grant_type
 *                            request parameters from an OAuth token exchange that was
 *                            pasted into a scratch file as a curl. They are not app env,
 *                            and encrypted they would look like configuration.
 */
const NEVER_AT_ALL = new Map([
  ["VERCEL_OIDC_TOKEN", "minted per deployment — a local copy is stale, not config"],
  ["BWS_ACCESS_TOKEN", "Bitwarden access token — a local tool credential"],
  ["STRIPE_TEST_WEBHOOK_URL", "Stripe owns the endpoint URL; the app reads the signing secret"],
  ["client_id", "OAuth parameter left over from a pasted curl — never app env"],
  ["client_secret", "OAuth parameter left over from a pasted curl — never app env"],
  ["scope", "OAuth parameter left over from a pasted curl — never app env"],
  ["grant_type", "OAuth parameter left over from a pasted curl — never app env"],
]);

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}

const from = arg("from");
const target = arg("target", "preview");
/* no default: a preview sync has to name the branch it is syncing, or it is refused */
const branch = arg("branch");
const apply = Boolean(arg("apply", false));
const force = Boolean(arg("force", false));
const diff = Boolean(arg("diff", false));
const confirmProduction = Boolean(arg("confirm-production", false));

function refuse(message) {
  console.error(`env-sync: ${message}`);
  process.exit(1);
}

if (!from || !fs.existsSync(from)) {
  refuse(`--from <file> is required and must exist (got ${from ?? "nothing"})`);
}
if (!["preview", "production", "development"].includes(target)) {
  refuse(`--target must be preview|production|development (got ${target})`);
}
if (branch === true) {
  refuse("--branch needs a value — the git branch the preview deploys from");
}
if (target === "preview" && !branch) {
  refuse("--target preview needs --branch <git branch> so it cannot leak to other previews");
}
if (diff && apply) {
  refuse("--diff reports drift and never writes — use one of --diff or --apply, not both");
}
if (diff && force) {
  refuse("--diff never writes, so --force has nothing to do — drop it");
}
if (apply && target === "production" && !confirmProduction) {
  refuse(
    "--apply --target production rewrites the live project's environment; " +
      "add --confirm-production to mean it",
  );
}

function token() {
  const p = path.join(os.homedir(), ".local/share/com.vercel.cli/auth.json");
  const t = JSON.parse(fs.readFileSync(p, "utf8")).token;
  if (!t) throw new Error("no token in the Vercel CLI auth file — run `vercel login`");
  return t;
}

function parseEnv(text) {
  const out = new Map();
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out.set(key, val);
  }
  return out;
}

/* Vercel's type for a key this script creates. `sensitive` is never readable back. */
const typeFor = (key) =>
  /SECRET|KEY|TOKEN|PASSWORD|DATABASE_URL/.test(key) ? "sensitive" : "encrypted";

async function call(method, url, body, tok) {
  const res = await fetch(`${API}${url}`, {
    method,
    headers: { Authorization: `Bearer ${tok}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const code = json?.error?.code ? ` ${json.error.code}` : "";
    let msg = json?.error?.message ?? res.statusText;
    /* A validation error can quote the payload, and the payload carries the value:
       scrub it before the string can reach a terminal or an operator's log. */
    if (body?.value) msg = msg.split(body.value).join("<redacted>");
    throw new Error(`${res.status}${code} ${msg}`);
  }
  return json;
}

const tok = token();
const desired = parseEnv(fs.readFileSync(from, "utf8"));

const existing = await call("GET", `/v9/projects/${PROJECT}/env?teamId=${TEAM}`, null, tok);
const rows = existing.envs ?? [];

const matches = (e) =>
  (e.target ?? []).includes(target) && (target !== "preview" || (e.gitBranch ?? "") === branch);

const present = new Map();
for (const e of rows) if (matches(e)) present.set(e.key, e);

const mode = diff ? "DIFF" : apply ? "APPLY" : "DRY RUN";
const where = `${target}${branch ? ` (branch ${branch})` : ""}`;

console.log(
  `env-sync: ${from} → ${where} · ` +
    `${desired.size} keys in file · ${present.size} already on that target · ${mode}`,
);

const dropped = []; // [key, reason] — release policy, never synced
const todo = []; // { verb: "create" | "replace", key, value }
const keep = []; // [key, row] — present, and left alone without --force

for (const [key, value] of desired) {
  if (NEVER_AT_ALL.has(key)) {
    dropped.push([key, NEVER_AT_ALL.get(key)]);
    continue;
  }
  if (target === "preview" && NEVER_PREVIEW.has(key)) {
    dropped.push([key, NEVER_PREVIEW.get(key)]);
    continue;
  }
  const have = present.get(key);
  if (!have) {
    todo.push({ verb: "create", key, value });
  } else if (force) {
    todo.push({ verb: "replace", key, value });
  } else {
    keep.push([key, have]);
  }
}
const extra = [...present].filter(([key]) => !desired.has(key));

if (diff) {
  for (const [key, why] of dropped) console.log(`  policy  ${key.padEnd(30)} not synced (${why})`);
  for (const { key } of todo) {
    console.log(
      `  missing ${key.padEnd(30)} in the file, not on the target — --apply would create it`,
    );
  }
  for (const [key, row] of extra) {
    console.log(
      `  extra   ${key.padEnd(30)} on the target, not in the file (${row.type ?? "unknown"}) ` +
        "— left alone",
    );
  }
  /* Types are compared only where the file and the target both hold the key: a key the
     script never writes cannot drift from the file's opinion of it. */
  const typeDrift = keep.filter(([key, row]) => row.type && row.type !== typeFor(key));
  for (const [key, row] of typeDrift) {
    console.log(
      `  type    ${key.padEnd(30)} the target holds ${row.type}, this script writes ` +
        `${typeFor(key)} — --apply sends a value, not a type`,
    );
  }
  const missing = todo.filter((t) => t.verb === "create").length;
  const found = missing + extra.length + typeDrift.length;
  const agree = keep.length - typeDrift.length;
  console.log(
    found
      ? `env-sync: diff — ${missing} missing, ${extra.length} on the target only, ` +
          `${typeDrift.length} type mismatch(es), ${agree} in agreement. Presence and type ` +
          "only: values are encrypted and never readable back, so this is not a value " +
          "comparison. Nothing was written."
      : `env-sync: diff — no drift: the file and ${where} agree on every key ` +
          `(${keep.length} present, ${agree} type-compatible). Presence and type only: ` +
          "values are encrypted and never readable back, so this is not a value comparison. " +
          "Nothing was written.",
  );
  process.exit(0);
}

for (const [key, why] of dropped) console.log(`  drop    ${key.padEnd(30)} ${why}`);
for (const [key, row] of keep) {
  console.log(
    `  keep    ${key.padEnd(30)} already present (${row.type}) — use --force to overwrite`,
  );
}
for (const [key] of extra) {
  console.log(`  extra   ${key.padEnd(30)} on target but not in the file — left alone`);
}

if (!todo.length) {
  console.log("env-sync: nothing to do");
  process.exit(0);
}
for (const { verb, key } of todo) console.log(`  ${verb.padEnd(7)} ${key}`);

if (!apply) {
  console.log("env-sync: dry run — re-run with --apply to write these");
  process.exit(0);
}

let failed = 0;
for (const { verb, key, value } of todo) {
  const body = {
    key,
    value,
    type: typeFor(key),
    target: [target],
    ...(target === "preview" ? { gitBranch: branch } : {}),
  };
  try {
    if (verb === "create") {
      await call("POST", `/v10/projects/${PROJECT}/env?teamId=${TEAM}`, body, tok);
    } else {
      await call(
        "PATCH",
        `/v9/projects/${PROJECT}/env/${present.get(key).id}?teamId=${TEAM}`,
        { value },
        tok,
      );
    }
    console.log(`  wrote   ${key}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAILED  ${key}: ${err.message}`);
  }
}
console.log(
  `env-sync: ${todo.length - failed}/${todo.length} written — ` +
    `a new deployment is required on ${target} for these to take effect`,
);
process.exit(failed ? 2 : 0);
