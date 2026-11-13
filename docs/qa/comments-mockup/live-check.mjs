/**
 * #921 — the acceptance line, asked of a running server: does `?artifact=prototype-comments-v1`
 * render, and is the answer different from an id the catalogue does not carry?
 *
 * The mockup phase's whole deliverable is "the owner can open this". A unit test proves the route
 * and the manifest; this proves the page. It signs in as the seeded demo admin through the app's
 * own sign-in endpoint (never a parallel auth path), then reads two addresses:
 *
 *   ?artifact=prototype-comments-v1   → expect 200, the artifact's title in the HTML, the iframe
 *                                       pointing at /review-artifacts/prototype-comments-v1
 *   ?artifact=prototype-does-not-exist → expect 404
 *
 * The second read is the point. A page that answers 200 for anything says nothing about the new row;
 * a page that 404s an unknown id and 200s this one is the row resolving.
 *
 * Usage, from the repo root, against a server already running on the demo branch:
 *   node docs/qa-comments-mockup/live-check.mjs [baseUrl] [outFile]
 */
import { writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3007";
const OUT = process.argv[3] ?? "docs/qa-comments-mockup/live-check.json";
const ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL ?? "admin@demo.alignsynch.test";

/** The seeded credential, read where the demo reader reads it. Never printed. */
async function adminPassword() {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    const { rows } = await client.query(
      "SELECT password FROM demo_account WHERE email = $1 AND password IS NOT NULL",
      [ADMIN_EMAIL],
    );
    if (rows.length === 0) throw new Error(`no seeded demo account for ${ADMIN_EMAIL}`);
    return rows[0].password;
  } finally {
    await client.end();
  }
}

async function signIn() {
  const password = await adminPassword();
  const response = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    /* No `origin` header on purpose: the branch's trusted-domain list refuses a page origin with
       `403 INVALID_ORIGIN` (docs/qa-stage5 records the same finding), and a Node client without one
       is exactly the case `scripts/flow-e2e.mjs` signs in through. */
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });
  if (!response.ok) throw new Error(`sign-in answered ${response.status}`);
  const jar = response.headers.getSetCookie().map((line) => line.split(";")[0]);
  if (jar.length === 0) throw new Error("sign-in set no cookie");
  return jar.join("; ");
}

async function read(cookie, path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { cookie },
    redirect: "manual",
  });
  const body = await response.text();
  return { path, status: response.status, location: response.headers.get("location"), body };
}

const cookie = await signIn();

const known = await read(cookie, "/admin/review?artifact=prototype-comments-v1");
const unknown = await read(cookie, "/admin/review?artifact=prototype-comments-does-not-exist");

const facts = {
  base: BASE,
  known: {
    path: known.path,
    status: known.status,
    artifactTitle: known.body.includes("Comments on opinions, sessions and relationships — mockup"),
    frame: known.body.includes("/review-artifacts/prototype-comments-v1"),
    lookFor: known.body.includes("The comment feature drawn before it is specified"),
    heading: known.body.includes("Review"),
  },
  unknown: { path: unknown.path, status: unknown.status },
};

const problems = [];
if (facts.known.status !== 200) problems.push(`known slug answered ${facts.known.status}`);
if (!facts.known.artifactTitle) problems.push("the artifact's title is not in the HTML");
if (!facts.known.frame)
  problems.push("the frame does not point at /review-artifacts/prototype-comments-v1");
if (!facts.known.lookFor) problems.push("the manifest's lookFor line is not drawn");
if (facts.unknown.status !== 404) problems.push(`an unknown slug answered ${facts.unknown.status}`);

writeFileSync(OUT, `${JSON.stringify({ at: new Date().toISOString(), ...facts }, null, 2)}\n`);
for (const [name, value] of Object.entries(facts.known)) {
  if (name !== "path") console.log(`  ${name}: ${value}`);
}
console.log(`  known ${facts.known.path} → ${facts.known.status}`);
console.log(`  unknown ${facts.unknown.path} → ${facts.unknown.status}`);

if (problems.length > 0) {
  console.error(`\n✗ live check failed: ${problems.join("; ")}`);
  process.exit(1);
}
console.log(
  "\n✓ live check: the artifact resolves at ?artifact=prototype-comments-v1 and an unknown id 404s",
);
