/**
 * #923 QA rig — a signed-in initiator with one `draft` and one relationship **past invite**.
 *
 * The product's own path to these rows is the five-stage flow (which needs a card on file) and a
 * claimed invitation. Both are browser journeys; this script performs the acts their requests
 * perform, labelled as the harness's stand-in:
 *
 *   - two throwaway accounts through the app's own sign-up proxy (never the seeded demo accounts),
 *   - `qarel-edit-draft` — the initiator's draft, no session, no seat: the state the owner's
 *     screenshot showed ("Not sent yet — nothing has been invited or charged"),
 *   - `qarel-edit-live` — published, with a session, a claimed invitation and two party seats, so
 *     the "past invite" frame is reachable at all.
 *
 * Everything it writes is prefixed `qarel-edit-` and `cleanup.mjs` removes it. Run it against a
 * dev server with the demo env (`.env.local` wins), from this worktree:
 *
 *   withenv.sh <main-checkout> bash -c 'cd <worktree> && node24.sh pnpm dev --port 4317'
 *   withenv.sh <main-checkout> bash -c 'cd <worktree> && node24.sh node docs/qa/rel-detail-edit/rig.mjs'
 */
import pg from "pg";

const BASE = "http://localhost:4317";
const PASSWORD = "qarel-edit-passw0rd";
const INITIATOR = "qarel-edit-initiator@alignsynch.test";
const COUNTERPARTY = "qarel-edit-counterparty@alignsynch.test";
const DRAFT = "qarel-edit-draft";
const LIVE = "qarel-edit-live";
const SESSION_RECORD = "qarel-edit-session";
const TEMPLATE = "assessment-relationship-basics";
const VERSION = "template-version-assessment-relationship-basics-v1";

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
  const cookies = res.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
  return { status: res.status, body, cookies };
}

const a = await signUp("Avery QA", INITIATOR);
const b = await signUp("Rowan QA", COUNTERPARTY);
console.log(
  "sign-up initiator:",
  a.status,
  a.body?.user?.id ?? JSON.stringify(a.body).slice(0, 160),
);
console.log(
  "sign-up counterparty:",
  b.status,
  b.body?.user?.id ?? JSON.stringify(b.body).slice(0, 160),
);
if (a.status >= 300 || b.status >= 300) process.exit(1);
const aId = a.body.user.id;
const bId = b.body.user.id;

const c = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await c.connect();
const now = new Date();

for (const sql of [
  `delete from party where session_record_id = '${SESSION_RECORD}'`,
  `delete from session_invite where session_record_id = '${SESSION_RECORD}'`,
  `delete from session where relationship_id like 'qarel-edit-%'`,
  `delete from relationship_payment where relationship_id like 'qarel-edit-%'`,
  `delete from relationship where id like 'qarel-edit-%'`,
  `delete from record where id = '${SESSION_RECORD}'`,
]) {
  await c
    .query(sql)
    .catch((error) => console.log("cleanup skip:", sql.slice(0, 44), error.message));
}

// (1) the draft — the state the owner reported: nothing invited, nothing charged.
await c.query(
  `insert into relationship (id, template_id, template_version_id, initiator_user_id, status, created_at)
   values ($1, $2, $3, $4, 'draft', $5)`,
  [DRAFT, TEMPLATE, VERSION, aId, now.toISOString()],
);

// (2) the relationship past invite — published, a session, a claimed seat, two parties, a method.
await c.query(
  `insert into record (id, slug, record_type, status, date, title, summary, owner_user_id, visibility)
   values ($1, $1, 'assessment', 'published', $2, $3, $4, $5, 'private')
   on conflict (id) do nothing`,
  [SESSION_RECORD, now.toISOString().slice(0, 10), "QA #923 session", "harness stand-in", aId],
);
await c.query(
  `insert into relationship (id, template_id, template_version_id, initiator_user_id, counterparty_user_id, status, created_at, published_at)
   values ($1, $2, $3, $4, $5, 'published', $6, $7)`,
  [LIVE, TEMPLATE, VERSION, aId, bId, now.toISOString(), now.toISOString()],
);
await c.query(
  `insert into session (record_id, template_record_id, mode, alignment_setting, name, relationship_id, round)
   values ($1, $2, 'basic', 'soft', 'QA #923 session', $3, 1)`,
  [SESSION_RECORD, TEMPLATE, LIVE],
);
await c.query(
  `insert into session_invite (session_record_id, email, counterparty_name, token_hash, created_at, expires_at, claimed_at)
   values ($1, $2, 'Rowan QA', 'qarel-edit-invite-hash', $3, $4, $3)`,
  [
    SESSION_RECORD,
    COUNTERPARTY,
    now.toISOString(),
    new Date(now.getTime() + 7 * 864e5).toISOString(),
  ],
);
await c.query(
  `insert into party (session_record_id, role, name, user_id)
   values ($1, 'initiator', 'Avery QA', $2), ($1, 'counterparty', 'Rowan QA', $3)`,
  [SESSION_RECORD, aId, bId],
);
await c.query(
  `insert into relationship_payment (relationship_id, payer_user_id, provider, method_captured_at, created_at, updated_at)
   values ($1, $2, 'mock', $3, $3, $3)`,
  [LIVE, aId, now.toISOString()],
);

// (3) prove the page answers the way this card claims, from Node, before any browser is involved.
async function page(path, cookies) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: cookies.join("; "), origin: BASE },
    redirect: "manual",
  });
  return { status: res.status, location: res.headers.get("location"), text: await res.text() };
}

function report(label, text) {
  /*
   * The serialized RSC payload carries the elements the page *passed* to the client component,
   * whether or not they render — so a raw `includes()` on the HTML reports the panel as present
   * on a closed page. Strip the script blocks first; what is left is the markup the browser
   * draws. `stills.mjs` re-asserts the same claim against the live DOM.
   */
  const markup = text.replace(/<script[\s\S]*?<\/script>/g, "");
  const marks = [
    'data-relationship-edit-open="true"',
    /* The FormSurface inside the panel. Exact form on purpose: the trigger's own hook is
       `data-relationship-edit-open`, and a bare prefix match reports it as the form. */
    'data-relationship-edit="true"',
    "data-relationship-aspects",
    'data-aspect-list="true"',
  ];
  console.log(`${label}:`);
  for (const mark of marks) console.log(`  ${mark}:`, markup.includes(mark));
}

const draft = await page(`/dashboard/relationships/${DRAFT}`, a.cookies);
console.log("draft (initiator):", draft.status, draft.location ?? "");
report("  draft", draft.text);

const live = await page(`/dashboard/relationships/${LIVE}`, a.cookies);
console.log("past invite (initiator):", live.status, live.location ?? "");
report("  past invite", live.text);

await c.end();

const { writeFileSync } = await import("node:fs");
const out = process.env.QA_OUT ?? "/tmp";
writeFileSync(
  `${out}/qarel-edit-cookies.json`,
  JSON.stringify({ initiator: a.cookies, counterparty: b.cookies }),
);
console.log(`cookies written to ${out}/qarel-edit-cookies.json`);
