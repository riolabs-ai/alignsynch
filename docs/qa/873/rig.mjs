/**
 * #873 QA rig — a signed-in initiator with a `draft`, and a bound counterparty on a published one.
 *
 * The product's own path to these rows is the five-stage flow (initiator) and a claimed invitation
 * (counterparty). Both are browser journeys; this script performs the acts their requests perform,
 * labelled as the harness's stand-in:
 *
 *   - two throwaway accounts through the app's own sign-up proxy (never the seeded demo accounts),
 *   - one `draft` relationship for the initiator, pointing at a seeded template copy,
 *   - one `published` relationship with a session, an invite and two party seats, so the
 *     counterparty's read-only screen is reachable at all (`VIEWER_IS_PARTY` needs a bound seat).
 *
 * Everything it writes is prefixed `qa873-` and `scripts/qa873-cleanup.mjs` removes it.
 */
import pg from "pg";

const BASE = "http://localhost:4317";
const PASSWORD = "qa873-capture-passw0rd";
const INITIATOR = "qa873-initiator@alignsynch.test";
const COUNTERPARTY = "qa873-counterparty@alignsynch.test";

async function signUp(name, email) {
  const post = (path, body) =>
    fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify(body),
    });
  let res = await post("/api/auth/sign-up/email", { name, email, password: PASSWORD });
  if (res.status >= 300) {
    // Re-run: the account the first run made is the one to sign in to.
    res = await post("/api/auth/sign-in/email", { email, password: PASSWORD });
  }
  const body = await res.json().catch(() => ({}));
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  return { status: res.status, body, cookies };
}

const a = await signUp("Avery QA", INITIATOR);
const b = await signUp("Rowan QA", COUNTERPARTY);
console.log(
  "sign-up initiator:",
  a.status,
  a.body?.user?.id ?? JSON.stringify(a.body).slice(0, 200),
);
console.log(
  "sign-up counterparty:",
  b.status,
  b.body?.user?.id ?? JSON.stringify(b.body).slice(0, 200),
);
if (a.status >= 300 || b.status >= 300) process.exit(1);
const aId = a.body.user.id;
const bId = b.body.user.id;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await c.connect();
const TEMPLATE = "assessment-relationship-basics";
const now = new Date();

for (const sql of [
  "delete from party where session_record_id = 'qa873-session-record'",
  "delete from session_invite where session_record_id = 'qa873-session-record'",
  "delete from session where relationship_id like 'qa873-%'",
  "delete from relationship_payment where relationship_id like 'qa873-%'",
  "delete from relationship where id like 'qa873-%'",
]) {
  await c.query(sql).catch((e) => console.log("cleanup skip:", sql.slice(0, 40), e.message));
}

// (1) the initiator's draft — no session, no party row: a draft is the initiator's alone.
await c.query(
  `insert into relationship (id, template_id, template_version_id, initiator_user_id, status, created_at)
   values ($1, $2, $3, $4, 'draft', $5)`,
  [
    "qa873-draft",
    TEMPLATE,
    "template-version-assessment-relationship-basics-v1",
    aId,
    now.toISOString(),
  ],
);

// (2) the counterparty's published relationship — a session, an invite, two seats.
const SESSION_RECORD = "qa873-session-record";
await c.query(
  `insert into record (id, slug, record_type, status, date, title, summary, owner_user_id, visibility)
   values ($1, 'qa873-session-record', 'assessment', 'published', $2, $3, $4, $5, 'private')
   on conflict (id) do nothing`,
  [SESSION_RECORD, now.toISOString().slice(0, 10), "QA 873 session", "harness stand-in", aId],
);
await c.query(
  `insert into relationship (id, template_id, template_version_id, initiator_user_id, counterparty_user_id, status, created_at, published_at)
   values ($1, $2, $3, $4, $5, 'published', $6, $7)`,
  [
    "qa873-live",
    TEMPLATE,
    "template-version-assessment-relationship-basics-v1",
    aId,
    bId,
    now.toISOString(),
    now.toISOString(),
  ],
);
await c.query(
  `insert into session (record_id, template_record_id, mode, alignment_setting, name, relationship_id, round)
   values ($1, $2, 'basic', 'soft', 'QA 873 session', $3, 1)`,
  [SESSION_RECORD, TEMPLATE, "qa873-live"],
);
await c.query(
  `insert into session_invite (session_record_id, email, counterparty_name, token_hash, created_at, expires_at, claimed_at)
   values ($1, $2, 'Rowan QA', 'qa873-invite-hash', $3, $4, $3)`,
  [
    SESSION_RECORD,
    COUNTERPARTY,
    now.toISOString(),
    new Date(now.getTime() + 7 * 864e5).toISOString(),
  ],
);
await c.query(
  `insert into party (session_record_id, role, name, user_id) values ($1, 'initiator', 'Avery QA', $2), ($1, 'counterparty', 'Rowan QA', $3)`,
  [SESSION_RECORD, aId, bId],
);
await c.query(
  `insert into relationship_payment (relationship_id, payer_user_id, provider, created_at, updated_at)
   values ('qa873-live', $1, 'mock', $2, $2)`,
  [aId, now.toISOString()],
);

// (3) prove each door renders, from Node, before any browser is involved.
async function page(path, cookies) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookies.join("; "), origin: BASE },
    redirect: "manual",
  });
  const text = await res.text();
  return { status: res.status, location: res.headers.get("location"), text };
}

const DRAFT_PATH = "/dashboard/relationships/qa873-draft";
const LIVE_PATH = "/dashboard/relationships/qa873-live";

function report(label, text) {
  const marks = [
    "data-relationship-edit",
    "data-relationship-aspects",
    'data-aspect-list="true"',
    'data-aspect-add="true"',
    "data-publish-gate",
    'id="publish-name"',
    'data-relationship-read-only="counterparty"',
    'data-relationship-read-only-open="relationships"',
  ];
  console.log(`${label}:`);
  for (const m of marks) console.log(`  ${m}:`, text.includes(m));
}

const draft1 = await page(DRAFT_PATH, a.cookies);
console.log("draft (initiator, no method):", draft1.status, draft1.location ?? "");
report("  step 1-3 (edit · aspects · plan)", draft1.text);

// Step 4 needs a method on file; the product's act is `capturePaymentMethodAction`. This is the
// harness standing in for the card entry: the row that act writes, and nothing else.
await c.query(
  `insert into relationship_payment (relationship_id, payer_user_id, provider, method_captured_at, created_at, updated_at)
   values ('qa873-draft', $1, 'mock', $2, $2, $2)
   on conflict (relationship_id) do update set method_captured_at = excluded.method_captured_at`,
  [aId, now.toISOString()],
);
const draft2 = await page(DRAFT_PATH, a.cookies);
console.log("draft (initiator, method on file):", draft2.status);
report("  step 4 (publish)", draft2.text);

const live = await page(LIVE_PATH, b.cookies);
console.log("live (counterparty):", live.status, live.location ?? "");
report("  read-only seat", live.text);

await c.end();

// The cookies the browser needs, so the driver never signs in from a page (403 INVALID_ORIGIN).
const { writeFileSync } = await import("node:fs");
const out = process.env.QA873_OUT ?? "/tmp";
writeFileSync(
  `${out}/qa873-cookies.json`,
  JSON.stringify({ initiator: a.cookies, counterparty: b.cookies }),
);
console.log(`cookies written to ${out}/qa873-cookies.json`);
