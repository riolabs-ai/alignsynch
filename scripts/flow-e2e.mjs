#!/usr/bin/env node
/**
 * `pnpm flow:e2e` — the two-party flow, end to end, through the running app (#146).
 *
 * This is not part of `scripts/verify.sh`: the gate must stay database-free and build-free.
 * It is the dogfood the issue asks for, written down so it can be repeated:
 *
 *   1. create      an Instance from a published Template through the **four stages** the create
 *                  is (#688 Who → Mode, #689 Aspects, #690 Create), then follow whichever of the
 *                  two redirect shapes the endpoint answers with: **Sent** for a signed-in
 *                  creator, the **account gate** for a signed-out one (#704)
 *   2. invite      the invitation link is on the screen — drawn whether or not this deployment
 *                  has a mailer, because a send that did not happen must never make the link
 *                  unshareable (#220)
 *   2b. self-claim the Initiator's own browser cannot claim its own invitation: the page
 *                  names them as the party they already are, the claim is refused with
 *                  `already-a-party`, and the token stays live (#202)
 *   3. claim       the Counterparty confirms joining as their own name; a claim that
 *                  confirms nothing, or the wrong name, is refused with `unconfirmed` and
 *                  spends nothing; the successful claim happens once (#202)
 *   3b. named      the instance screen names the answering party on every visit (#202)
 *   3c. cross-post a session bound as the Initiator that POSTs `role=counterparty` is
 *                  refused 403 and writes no Counterparty opinion (#202)
 *   4. blind       the Counterparty's screen shows no report and no Gap while only the
 *                  Initiator has answered
 *   4b. cta        the locked report's "continue" CTA opens that party's own sheet — `/answer`,
 *                  200 — and never the POST-only `/answers`, which a GET answers 405
 *   5. submit      the Counterparty answers differently on one Aspect
 *   6. hinge       both sheets are in and the report is still locked: acceptance, not submission,
 *                  is what completes a session (#R2)
 *   6b. accept     the Initiator accepts (still locked), the Counterparty accepts (the Gap opens);
 *                  the completing acceptance is the one that mails the other seat. Both arrive
 *                  through links and form actions **the app drew** — the confirmation band, the
 *                  instance screen, the accept page — because posting `/accepts` by hand is what
 *                  let the accept step ship with no entry point at all (#617)
 *   6c. locked     an edit after the seat accepted is a 409 and the stored row is unchanged
 *   6d. gap        both parties now see a Feel Gap of 3 where Feel 2 meets Feel 5 (the
 *                  `data-alignment-gap` rows of stage 6, #692), and
 *                  "In synch" where they agree; an Advanced instance draws all eight kinds,
 *                  the four prediction ones against the other party's actual (#219)
 *   8. copy        editing the Template's prompt afterwards does not change the instance
 *   9. hashes      the invitation row stores the SHA-256 of the token, never the token
 *
 * Usage:
 *   BASE_URL=http://localhost:3100 DATABASE_URL=postgres://… node --import ./scripts/ts-modules.mjs scripts/flow-e2e.mjs
 *
 * It creates its own instance and deletes it (and the Template edit) before it exits, so it
 * is safe to re-run against a database another process is reading.
 *
 * **A failed run prints what the demo branch looks like (#704).** The create commits a `record`
 * row on the branch every card shares, so a throw before that row is registered for cleanup
 * leaves it behind — and `pnpm db:seed` then refuses ("record holds assessment row(s) this seed
 * does not author") until somebody deletes it by hand. The instance id is therefore registered the
 * moment it is parsed, and a failure ends with the branch's own `session` / `party` / `record`
 * counts, so "did this run leave a row" is answered by the output.
 */
import { Client } from "pg";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TEMPLATE_ID = "assessment-relationship-basics";
const TIME = "aspect-time-together";
const MONEY = "aspect-money";

const failures = [];
const notes = [];

function check(name, ok, detail = "") {
  console.log(`${ok ? "✔" : "✘"} ${name}${detail === "" ? "" : ` — ${detail}`}`);
  if (!ok) failures.push(name);
}

function note(text) {
  notes.push(text);
  console.log(`· ${text}`);
}

/**
 * The markup a browser paints, with Next's inlined flight payload removed.
 *
 * Both `next dev` and `next start` embed the RSC stream in `<script>` tags, and that stream
 * carries *props* — the copy fixture, the template's rows — that are never on screen. A
 * negative assertion over the raw response ("the edited prompt is not in the page") therefore
 * fails on bytes the reader cannot see: proven identical on unmodified `main`, which is how
 * this helper got here. Anything that asserts what is **absent** from the screen reads
 * `rendered()`; anything asserting a filled sentence can read the raw HTML, because the
 * payload carries the fixture's `{placeholders}`, never the filled text.
 */
function rendered(html) {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

/**
 * The href of the anchor a reader clicks, found by the attribute the component gave it (#617).
 *
 * Nothing in this script types an acceptance path: the link is drawn on the page, this reads it,
 * and the next request follows it. That is the half the earlier version of this file skipped — it
 * POSTed `/accepts` directly, which proved the endpoint worked and never that a person could reach
 * it, which is exactly how the accept step shipped unreachable.
 */
function anchorHref(html, attribute) {
  const anchor = html.match(new RegExp(`<a\\b[^>]*\\b${attribute}="true"[^>]*>`))?.[0];
  if (anchor === undefined) return null;
  return anchor.match(/href="([^"]*)"/)?.[1] ?? null;
}

/**
 * The `action` of the form that records an acceptance, read off the rendered page.
 *
 * Found by what it posts to rather than by position: the layout's own forms (sign-out, search)
 * are in the same document, and a reader clicks the one button the acceptance page offers.
 */
function acceptFormAction(html) {
  for (const form of html.match(/<form\b[^>]*>/g) ?? []) {
    const action = form.match(/action="([^"]*)"/)?.[1];
    if (action?.endsWith("/accepts")) return action;
  }
  return null;
}

/**
 * The Alignment rows of one Aspect on the relationship screen (#692).
 *
 * The completed screen draws one `data-alignment-gap-kind` row per Gap the Aspect has, and each
 * row prints the two Opinions it subtracts beside the number, so this reads the numbers off the
 * markup instead of parsing a sentence — the same discipline the old `data-feel-gap` attributes
 * carried. Returns `[[kind, gap], …]` in glossary order; `[]` when the Aspect is not drawn (the
 * report is still locked, or the id is not on the page).
 */
function alignmentGaps(html, itemId) {
  const start = html.indexOf(`data-alignment-aspect="${itemId}"`);
  if (start === -1) return [];
  const next = html.indexOf('data-alignment-aspect="', start + 1);
  const section = html.slice(start, next === -1 ? undefined : next);
  return [
    ...section.matchAll(/data-alignment-gap-kind="([a-z-]+)"[\s\S]*?data-alignment-gap="(\d)"/g),
  ].map((match) => [match[1], Number(match[2])]);
}

/** One kind's Gap out of a list `alignmentGaps()` returned, or `undefined`. */
function gapOfKind(gaps, kind) {
  return gaps.find(([name]) => name === kind)?.[1];
}

/* ------------------------------------------------------------------ *
 * A cookie jar, so two "people" can be two jars of one script
 * ------------------------------------------------------------------ */

class Jar {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  absorb(response) {
    const set = response.headers.getSetCookie?.() ?? [];
    for (const raw of set) {
      const pair = raw.split(";")[0];
      const index = pair.indexOf("=");
      if (index === -1) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async get(path) {
    // A redirect's `Location` is absolute (Next builds it from the request URL); a link drawn on a
    // page is root-relative. Both are followed the same way, so the caller never has to know which.
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    const response = await fetch(url, {
      redirect: "manual",
      headers: { cookie: this.header() },
    });
    this.absorb(response);
    return {
      status: response.status,
      location: response.headers.get("location"),
      html: await response.text(),
    };
  }

  async post(path, fields) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: this.header(),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(fields).toString(),
    });
    this.absorb(response);
    return {
      status: response.status,
      location: response.headers.get("location"),
      html: await response.text(),
    };
  }

  /**
   * A JSON post — the shape `POST /assessment/new/aspects` takes (#689).
   *
   * Stage 3's list is the one step of the create that is not a form: it saves itself on each
   * committed gesture and answers `{ok: true}`, so its reply is read as data rather than as a
   * redirect or a page.
   */
  async postJson(path, body) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: this.header(), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    this.absorb(response);
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON: the assertion below reports the status and the body's first line instead.
    }
    return { status: response.status, body: json, html: text };
  }
}

/* ------------------------------------------------------------------ *
 * The four-stage create (#688 → #690), driven like a person drives it
 * ------------------------------------------------------------------ */

/** `/assessment/templates/<id>/create` — the stem every create stage hangs off (#688). */
function createStem(templateRecordId) {
  return `/assessment/templates/${templateRecordId}/create`;
}

/**
 * The instance id in a create redirect, in **either** shape it has (#704).
 *
 * `…/assessment/instances/<id>` is the committed relationship (where a post that names no
 * template lands, and where a signed-in creator is sent on from), and
 * `…/create/account?instance=<id>` is the account gate a signed-out creator is sent to since
 * #690. The id is in both addresses, so the flow continues from it either way — which shape the
 * app answers with is the app's decision, and this reads it rather than picking one.
 */
function instanceIdIn(location) {
  return (
    location.match(/\/assessment\/instances\/([0-9a-f-]{36})/)?.[1] ??
    location.match(/[?&]instance=([0-9a-f-]{36})/)?.[1] ??
    null
  );
}

/**
 * One relationship, created through the four stages: Who, Mode, Aspects, then Create's own control.
 *
 * **The stages are the app's, not this script's.** A single post to `POST /assessment/new` still
 * works — the endpoint keeps the pre-#688 shape for a post that carries no draft — and that is
 * what this script used to do, which is how three slices of the create (#688 who, #689 aspects,
 * #690 commit) shipped without the e2e ever seeing them (#704). What is driven here is what a
 * person does: two form posts that only write a draft cookie, one JSON save from the list, and
 * then the commit that writes.
 *
 * **The id is registered before anything after it can throw.** `created` is what `cleanup()`
 * deletes, and a throw between the commit and the registration is what left `record` rows on the
 * demo branch — where `pnpm db:seed` then refuses to run for every other card. So the parse and
 * the push happen together, and the assertion about them comes after.
 */
async function createThroughStages(
  jar,
  {
    templateRecordId,
    initiatorName,
    counterpartyName,
    email,
    title,
    mode,
    setting = "soft",
    aspects,
  },
) {
  const stem = createStem(templateRecordId);

  /* stage 1 — Who ---------------------------------------------------- */
  const who = await jar.post("/assessment/new/who", {
    templateRecordId,
    initiatorName,
    counterpartyName,
    email,
    title,
    description: "",
  });
  check(
    `stage 1 Who answers 303 to the Mode stage (${initiatorName})`,
    who.status === 303 && (who.location ?? "").endsWith(`${stem}/mode`),
    `${who.status} ${who.location}`,
  );

  /* stage 2 — Mode --------------------------------------------------- */
  const modeScreen = await jar.get(who.location ?? `${stem}/mode`);
  check(
    "stage 2 Mode asks its two questions, and nothing was created to get here",
    modeScreen.status === 200 &&
      modeScreen.html.includes('name="mode"') &&
      modeScreen.html.includes('name="alignmentSetting"'),
    `status ${modeScreen.status}`,
  );

  const modePost = await jar.post("/assessment/new/mode", {
    templateRecordId,
    mode,
    alignmentSetting: setting,
  });
  check(
    "stage 2 answers 303 to the Aspects stage",
    modePost.status === 303 && (modePost.location ?? "").endsWith(`${stem}/aspects`),
    `${modePost.status} ${modePost.location}`,
  );

  /* stage 3 — Aspects ------------------------------------------------ */
  const aspectsScreen = await jar.get(modePost.location ?? `${stem}/aspects`);
  check(
    "stage 3 Aspects renders the template's list",
    aspectsScreen.status === 200 &&
      aspectsScreen.html.includes('data-aspect-list="true"') &&
      aspectsScreen.html.includes(`data-aspect-row="${aspects[0].id}"`),
    `status ${aspectsScreen.status}, ${aspects.length} row(s) offered`,
  );

  const saved = await jar.postJson("/assessment/new/aspects", { templateRecordId, aspects });
  check(
    "stage 3 saves the list into the draft",
    saved.status === 200 && saved.body?.ok === true,
    `status ${saved.status} ${JSON.stringify(saved.body)}`,
  );

  /* stage 4 — Create ------------------------------------------------- */
  const commitScreen = await jar.get(`${stem}/commit`);
  check(
    "stage 4 Create reviews what the three stages decided and offers the one control that writes",
    commitScreen.status === 200 &&
      commitScreen.html.includes('data-create-review="true"') &&
      commitScreen.html.includes('data-create-commit="true"'),
    `status ${commitScreen.status}`,
  );

  const committed = await jar.post("/assessment/new", { templateRecordId });
  const location = committed.location ?? "";
  const instanceId = instanceIdIn(location);
  if (instanceId !== null) created.push(instanceId);
  check(
    "the commit on stage 4 answers 303 to the new relationship, in either of its two shapes",
    committed.status === 303 && instanceId !== null,
    `${committed.status} ${location}`,
  );
  return { location, instanceId };
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

const db = new Client({ connectionString: process.env.DATABASE_URL });
const created = [];

function answers({ feel, wish, think, guess }, overrides = {}) {
  const fields = {};
  for (const itemId of ASPECT_IDS) {
    const pair = overrides[itemId] ?? { feel, wish, think, guess };
    fields[`feel:${itemId}`] = String(pair.feel);
    fields[`wish:${itemId}`] = String(pair.wish);
    // Advanced kinds only when the caller names them: a Basic sheet must not carry a field
    // its instance's mode does not ask, or the refusal this card adds would be swallowed.
    if (pair.think !== undefined) fields[`think:${itemId}`] = String(pair.think);
    if (pair.guess !== undefined) fields[`guess:${itemId}`] = String(pair.guess);
  }
  return fields;
}

let ASPECT_IDS = [];

async function main() {
  await db.connect();

  const templateItems = await db.query(
    "SELECT item_id, prompt, left_value, right_value FROM item WHERE record_id = $1 ORDER BY position",
    [TEMPLATE_ID],
  );
  ASPECT_IDS = templateItems.rows.map((row) => row.item_id);
  // The list stage 3 saves (#689): read before the run edits anything below, so a run that later
  // touches the template's copy cannot put its own edit into the draft.
  const templateAspects = templateItems.rows.map((row) => ({
    id: row.item_id,
    prompt: row.prompt,
    leftValue: row.left_value,
    rightValue: row.right_value,
  }));
  check(
    "the template has the five Aspects the run answers",
    ASPECT_IDS.length === 5,
    ASPECT_IDS.join(", "),
  );

  const initiator = new Jar("initiator");
  const counterparty = new Jar("counterparty");
  const stranger = new Jar("stranger");

  /* 1. create — the four stages: Who, Mode, Aspects, Create (#688 → #690) --- */
  // #704 — the create is four screens, and its redirect has two shapes: a signed-in creator is
  // sent on to Sent (stage 5, #691) and a signed-out one to the account gate, which names the
  // relationship stage 4 just committed. This run is signed out, so the gate is the shape it
  // should meet; the id is in the address either way, and that is where the flow continues.
  const firstCreate = await createThroughStages(initiator, {
    templateRecordId: TEMPLATE_ID,
    initiatorName: "Avery E2E",
    counterpartyName: "Rowan E2E",
    email: "rowan-e2e@example.com",
    title: "Avery and Rowan E2E",
    mode: "basic",
    aspects: templateAspects,
  });
  if (firstCreate.instanceId === null) throw new Error("no instance id in the create redirect");
  const instanceId = firstCreate.instanceId;

  const instancePath = `/assessment/instances/${instanceId}`;
  const destination = new URL(firstCreate.location, BASE_URL);
  const onTheGate = destination.pathname.endsWith("/create/account");
  check(
    "the create sends the creator to one of the two screens it has: the gate, or Sent",
    (onTheGate && destination.searchParams.get("instance") === instanceId) ||
      destination.pathname === `${instancePath}/sent`,
    `${destination.pathname}${destination.search}`,
  );

  if (onTheGate) {
    const gateScreen = await initiator.get(firstCreate.location);
    check(
      "the gate draws its own three-step strip and the account form, for the browser that committed",
      gateScreen.status === 200 &&
        gateScreen.html.includes('data-account-gate-progress="true"') &&
        gateScreen.html.includes('data-account-gate-form="true"'),
      `status ${gateScreen.status}`,
    );
    check(
      "and it offers the way back into the relationship it just committed",
      gateScreen.html.includes(`href="${instancePath}"`),
      instancePath,
    );
  }

  check(
    "the initiator's party cookie is set",
    initiator.cookies.has(`flow_party_${instanceId}`),
    [...initiator.cookies.keys()].join(", "),
  );

  const copy = await db.query(
    "SELECT item_id, prompt FROM item WHERE record_id = $1 ORDER BY position",
    [instanceId],
  );
  check(
    "creating the instance copied the template's five Aspects into its own rows",
    copy.rows.length === 5 && copy.rows.map((row) => row.item_id).join() === ASPECT_IDS.join(),
    `${copy.rows.length} rows`,
  );

  /* 2. invite ------------------------------------------------------- */
  // The screen the create handed the creator to is the account gate, which is about the account
  // and carries no mailer outcome; the relationship's own screen is one click behind it (the gate
  // draws that link) and is what draws the invitation. **The link is what matters here** — it is
  // drawn whether the mailer sent, refused or was never configured (#220), which is why this
  // reads the screen rather than a `?invite=` sentence the create no longer hands along (#704).
  const initiatorScreen = await initiator.get(instancePath);
  check(
    "the initiator's screen renders",
    initiatorScreen.status === 200,
    `status ${initiatorScreen.status}`,
  );
  const linkMatch = initiatorScreen.html.match(/http:\/\/[^\s"<>]+\/invite\/[A-Za-z0-9_-]{43}/);
  check(
    "the screen shows the invitation link, so the invitation is shareable whatever the mailer did",
    linkMatch !== null,
    linkMatch?.[0],
  );
  if (linkMatch === null) throw new Error("no invitation link on the screen");
  const link = linkMatch[0];
  const token = link.split("/invite/")[1];
  check(
    "and draws the invitation's own state beside it",
    initiatorScreen.html.includes('data-invite-state="unclaimed"'),
    initiatorScreen.html.match(/data-invite-state="([a-z]+)"/)?.[1] ?? "(no state)",
  );
  // #220: the reader is told the outcome, never the deployment's configuration.
  check(
    "the screen names no environment variable",
    !initiatorScreen.html.includes("RESEND_API_KEY"),
  );
  check(
    "the screen shows the answer sheet while the invite is unclaimed",
    initiatorScreen.html.includes(`name="feel:${TIME}"`),
  );

  /* 1b. the sheet Basic Mode asks (#213) ----------------------------- */
  // The sheet is radios since #427's answer card — five notches per Opinion kind, per Aspect —
  // so the count is "Aspects × the Mode's kinds × the 1..5 band", not a `<select>` per question.
  const basicRadios = (initiatorScreen.html.match(/type="radio"/g) ?? []).length;
  check(
    "a Basic instance asks two scores on every Aspect, and only two",
    basicRadios === ASPECT_IDS.length * 2 * 5,
    `${basicRadios} radios for ${ASPECT_IDS.length} Aspects × 2 kinds × 5 notches`,
  );
  check(
    "it asks Feel then Wish, and names no Think or Guess field",
    initiatorScreen.html.includes(`name="feel:${TIME}"`) &&
      initiatorScreen.html.includes(`name="wish:${TIME}"`) &&
      !initiatorScreen.html.includes(`name="think:${TIME}"`) &&
      !initiatorScreen.html.includes(`name="guess:${TIME}"`),
  );
  check(
    "the instance screen names the mode it was played in",
    initiatorScreen.html.includes('data-mode="basic"') &&
      initiatorScreen.html.includes("Basic Mode"),
    'data-mode="basic"',
  );
  const basicModeRow = await db.query("SELECT mode FROM session WHERE record_id = $1", [
    instanceId,
  ]);
  check(
    "the row records mode=basic",
    basicModeRow.rows[0]?.mode === "basic",
    `mode=${basicModeRow.rows[0]?.mode}`,
  );

  const inviteRow = await db.query(
    "SELECT email, counterparty_name, token_hash, claimed_at, expires_at, created_at FROM session_invite WHERE session_record_id = $1",
    [instanceId],
  );
  const stored = inviteRow.rows[0];
  check(
    "the invite row stores a SHA-256 hash, never the token",
    stored.token_hash !== token && /^[0-9a-f]{64}$/.test(stored.token_hash),
    stored.token_hash.slice(0, 12),
  );
  check(
    "the invitation expires seven days after it was created",
    new Date(stored.expires_at).getTime() - new Date(stored.created_at).getTime() ===
      7 * 24 * 60 * 60 * 1000,
    `${stored.created_at} → ${stored.expires_at}`,
  );

  /* 2b. the Initiator opens their own invitation (#202) -------------- */
  // The defect: this used to spend the token and silently move the session into the
  // Counterparty's column. Now it is a refusal, and the link is still good for Rowan.
  const initiatorInvite = await initiator.get(`/invite/${token}`);
  check(
    "the Initiator's own invitation page renders",
    initiatorInvite.status === 200,
    `status ${initiatorInvite.status}`,
  );
  check(
    "it names the party this session already answers as",
    initiatorInvite.html.includes("You are answering as Avery E2E, the Initiator."),
    "the answering-party band",
  );
  check(
    "it does not offer the claim control to a browser that is already a party",
    !initiatorInvite.html.includes("Accept and answer"),
  );

  const selfClaim = await initiator.post(`/invite/${token}/claim`, { confirm: "Rowan E2E" });
  check(
    "the Initiator's own claim is refused with already-a-party",
    selfClaim.status === 303 &&
      (selfClaim.location ?? "").endsWith(`/invite/${token}?step=3&claim=already-a-party`),
    `${selfClaim.status} ${selfClaim.location}`,
  );
  const selfRefusal = await initiator.get(`/invite/${token}?step=3&claim=already-a-party`);
  check(
    "the refusal says nothing was claimed and the link is still unused",
    selfRefusal.html.includes("Nothing was claimed") &&
      selfRefusal.html.includes("The link is still unused."),
  );

  const afterSelfClaim = await db.query(
    `SELECT iv.claimed_at,
            (SELECT count(*) FROM party p WHERE p.session_record_id = iv.session_record_id)::int AS parties
       FROM session_invite iv WHERE iv.session_record_id = $1`,
    [instanceId],
  );
  check(
    "the refused claim consumed nothing: token live, one party row",
    afterSelfClaim.rows[0].claimed_at === null && afterSelfClaim.rows[0].parties === 1,
    `claimed_at=${afterSelfClaim.rows[0].claimed_at} parties=${afterSelfClaim.rows[0].parties}`,
  );
  const stillInitiator = await initiator.get(instancePath);
  check(
    "the Initiator's session still answers as the Initiator",
    stillInitiator.html.includes("You are answering as Avery E2E, the Initiator."),
  );

  /* 3. the stranger, then the claim --------------------------------- */
  const strangerScreen = await stranger.get(instancePath);
  check(
    "a browser with no party token gets a 404, not the screen",
    strangerScreen.status === 404,
    `status ${strangerScreen.status}`,
  );

  const invitePage = await counterparty.get(`/invite/${token}`);
  check(
    "the invitation page renders for the Counterparty",
    invitePage.status === 200,
    `status ${invitePage.status}`,
  );
  check("it names the Initiator", invitePage.html.includes("Avery E2E"));
  check("it names the Template", invitePage.html.includes("Relationship Basics"));
  // #t_0aa81144 — the invitation lands on step 1 of the onboarding wizard, not on a claim button.
  check(
    "it opens on step 1 of the wizard",
    invitePage.html.includes("Step 1 of 3") &&
      invitePage.html.includes("Avery E2E invited you to answer Relationship Basics."),
  );
  const stepTwo = await counterparty.get(`/invite/${token}?step=2`);
  check("step 2 keeps the token and explains the order", stepTwo.html.includes("Step 2 of 3"));
  const stepThree = await counterparty.get(`/invite/${token}?step=3`);
  check(
    "step 3 is the account gate and claims nothing on a GET",
    stepThree.html.includes("Step 3 of 3") &&
      stepThree.html.includes("You are joining as Rowan E2E, the Counterparty.") === false &&
      stepThree.html.includes("Accepting costs you nothing"),
  );
  check(
    "it does not name an answering party for a browser that is not one",
    !rendered(invitePage.html).includes("You are answering as"),
  );
  check(
    "the GET did not claim the invite",
    (
      await db.query("SELECT claimed_at FROM session_invite WHERE session_record_id = $1", [
        instanceId,
      ])
    ).rows[0].claimed_at === null,
  );

  const unconfirmed = await counterparty.post(`/invite/${token}/claim`, {});
  check(
    "a claim that confirms nothing is refused with unconfirmed",
    unconfirmed.status === 303 &&
      (unconfirmed.location ?? "").endsWith(`/invite/${token}?step=3&claim=unconfirmed`),
    `${unconfirmed.status} ${unconfirmed.location}`,
  );
  const wrongName = await counterparty.post(`/invite/${token}/claim`, { confirm: "Avery E2E" });
  check(
    "a claim that confirms the other party's name is refused with unconfirmed",
    wrongName.status === 303 &&
      (wrongName.location ?? "").endsWith(`/invite/${token}?step=3&claim=unconfirmed`),
    `${wrongName.status} ${wrongName.location}`,
  );
  const afterRefusals = await db.query(
    `SELECT iv.claimed_at,
            (SELECT count(*) FROM party p WHERE p.session_record_id = iv.session_record_id)::int AS parties
       FROM session_invite iv WHERE iv.session_record_id = $1`,
    [instanceId],
  );
  check(
    "both refused claims consumed nothing: token live, one party row",
    afterRefusals.rows[0].claimed_at === null && afterRefusals.rows[0].parties === 1,
    `claimed_at=${afterRefusals.rows[0].claimed_at} parties=${afterRefusals.rows[0].parties}`,
  );

  const claim = await counterparty.post(`/invite/${token}/claim`, { confirm: "Rowan E2E" });
  check(
    "claiming answers 303 to the instance screen",
    claim.status === 303 && (claim.location ?? "").includes(instancePath),
    `${claim.status} ${claim.location}`,
  );
  check(
    "the Counterparty's party cookie is set",
    counterparty.cookies.has(`flow_party_${instanceId}`),
  );
  const claimed = await db.query(
    "SELECT claimed_at,(SELECT count(*) FROM party WHERE session_record_id = $1)::int AS parties FROM session_invite WHERE session_record_id = $1",
    [instanceId],
  );
  check(
    "the claim is recorded, and both party rows exist",
    claimed.rows[0].claimed_at !== null && claimed.rows[0].parties === 2,
    `parties=${claimed.rows[0].parties}`,
  );

  /* 3b. the screen names the answering party, every visit ------------ */
  const counterpartyScreen = await counterparty.get(instancePath);
  check(
    "the instance screen names the party this session answers as",
    counterpartyScreen.html.includes("You are answering as Rowan E2E, the Counterparty."),
    "You are answering as Rowan E2E, the Counterparty.",
  );
  const counterpartyRevisit = await counterparty.get(instancePath);
  check(
    "and names it again on a later visit (not a one-time notice)",
    counterpartyRevisit.html.includes("You are answering as Rowan E2E, the Counterparty."),
  );
  check(
    "the two screens disagree about which party they answer as",
    stillInitiator.html.includes("the Initiator.") &&
      counterpartyRevisit.html.includes("the Counterparty.") &&
      !counterpartyRevisit.html.includes("You are answering as Avery E2E"),
  );
  note(
    "rendered: " +
      (counterpartyRevisit.html.match(/You are answering as [^<]*\./) ?? ["(not found)"])[0],
  );

  const secondClaim = await stranger.post(`/invite/${token}/claim`, { confirm: "Rowan E2E" });
  // The refusal keeps whatever step the wizard had reached (#538 put `?step=` on this URL), so the
  // assertion is the page and the code, not the whole query string.
  const secondClaimUrl = new URL(secondClaim.location ?? "http://invalid.invalid/");
  check(
    "a second claim of the spent token is refused",
    secondClaim.status === 303 &&
      secondClaimUrl.pathname === `/invite/${token}` &&
      secondClaimUrl.searchParams.get("claim") === "claimed",
    `${secondClaim.status} ${secondClaim.location}`,
  );
  const secondClaimPage = await stranger.get(`/invite/${token}?claim=claimed`);
  check(
    "the second claim lands on the 'used already' band",
    secondClaimPage.html.includes("This invitation was used already"),
  );

  /* 3c. a bound session cannot record the other party's opinion ------ */
  // Through the form the role is the cookie's; a direct POST that *asserts* the other
  // party must be refused rather than quietly written under the cookie's role.
  const crossPost = await initiator.post(`${instancePath}/answers`, {
    ...answers({ feel: 5, wish: 5 }),
    role: "counterparty",
  });
  check(
    "a direct POST asserting the Counterparty is refused with 403",
    crossPost.status === 403,
    `status ${crossPost.status}`,
  );
  check(
    "the refusal says which party this session answers as",
    crossPost.html.includes(
      "this session answers as the initiator; the request asked to answer as the counterparty",
    ),
    "reason line",
  );
  const counterpartyOpinions = await db.query(
    "SELECT count(*)::int AS n FROM opinion WHERE session_record_id = $1 AND role = 'counterparty'",
    [instanceId],
  );
  check(
    "the refused POST wrote no Counterparty opinion",
    counterpartyOpinions.rows[0].n === 0,
    `n=${counterpartyOpinions.rows[0].n}`,
  );
  const initiatorAfterRefusal = await db.query(
    "SELECT count(*)::int AS n FROM opinion WHERE session_record_id = $1 AND role = 'initiator'",
    [instanceId],
  );
  check(
    "and no Initiator opinion either — the request was refused, not reinterpreted",
    initiatorAfterRefusal.rows[0].n === 0,
    `n=${initiatorAfterRefusal.rows[0].n}`,
  );

  /* 3d. a Basic instance refuses an Advanced field (#213) ------------ */
  // The sheet is the mode's sheet. A Think score posted against a Basic instance is a
  // refusal, not a field the server quietly drops — the same "silent success" rule the
  // freeze and the missing-score cases already enforce.
  const advancedFieldOnBasic = await initiator.post(`${instancePath}/answers`, {
    ...answers({ feel: 2, wish: 5 }),
    [`think:${TIME}`]: "4",
  });
  check(
    "a Basic submit carrying a Think score is refused with 409",
    advancedFieldOnBasic.status === 409,
    `status ${advancedFieldOnBasic.status}`,
  );
  check(
    "the refusal names the kind and the mode",
    advancedFieldOnBasic.html.includes("is not an opinion kind this instance"),
    advancedFieldOnBasic.html.match(/<li>[^<]*<\/li>/)?.[0],
  );
  const afterBasicRefusal = await db.query(
    "SELECT count(*)::int AS n FROM opinion WHERE session_record_id = $1",
    [instanceId],
  );
  check(
    "the refused Basic+Think post wrote no opinion row",
    afterBasicRefusal.rows[0].n === 0,
    `n=${afterBasicRefusal.rows[0].n}`,
  );

  /* 4. blind: only the Initiator has answered ----------------------- */
  const initiatorSubmit = await initiator.post(
    `${instancePath}/answers`,
    answers({ feel: 2, wish: 5 }, { [MONEY]: { feel: 4, wish: 4 } }),
  );
  check(
    "the Initiator's submit answers 303",
    initiatorSubmit.status === 303,
    `status ${initiatorSubmit.status}`,
  );

  const blindScreen = await counterparty.get(instancePath);
  check(
    "the Counterparty's screen renders while the Initiator has answered",
    blindScreen.status === 200,
  );
  check("the Counterparty sees no Gap at all", !blindScreen.html.includes("data-alignment-gap"));
  check(
    "the Counterparty's page names no score of the Initiator's",
    !/aria-label="Avery E2E (feel|wish):/.test(blindScreen.html) &&
      !blindScreen.html.includes("In synch"),
    "no 'Avery E2E feel: …' label and no report row",
  );
  check(
    "the Counterparty still has their own answer sheet",
    blindScreen.html.includes(`name="feel:${TIME}"`),
  );
  const initiatorWhileBlind = await initiator.get(instancePath);
  check(
    "the Initiator sees no Gap either, while they wait",
    !initiatorWhileBlind.html.includes("data-feel-gap"),
  );
  check(
    "the Initiator is told who is still to answer",
    initiatorWhileBlind.html.includes("Rowan E2E"),
  );

  /* 4b. the locked report's continue CTA is the sheet, not the endpoint --------------- */
  // The Counterparty has not submitted, so their report page is the gate — and the gate's one
  // control is the button this card fixes. It used to be `answersPath()`, the POST-only handler,
  // so the click was a GET and the party finished their own sheet against a 405.
  const lockedReport = await counterparty.get(`${instancePath}/report`);
  check(
    "the Counterparty's report page renders the gate while their sheet is unfinished",
    lockedReport.status === 200 && lockedReport.html.includes('data-report-gated="true"'),
    `status ${lockedReport.status}`,
  );
  const continueAnchor = lockedReport.html.match(/<a [^>]*data-report-continue="true"[^>]*>/);
  const continueHref = continueAnchor?.[0].match(/href="([^"]*)"/)?.[1];
  check(
    "the gate's continue CTA points at the answer sheet",
    continueHref === `${instancePath}/answer`,
    `href ${continueHref ?? "(no anchor)"}`,
  );
  const viaContinue = continueHref === undefined ? undefined : await counterparty.get(continueHref);
  check(
    "clicking it answers 200 and draws that party's own sheet",
    viaContinue?.status === 200 && viaContinue.html.includes(`name="feel:${TIME}"`),
    `status ${viaContinue?.status ?? "(not followed)"}`,
  );
  const getTheEndpoint = await counterparty.get(`${instancePath}/answers`);
  check(
    "a GET of the endpoint the CTA used to name is a 405 — the defect this card fixes",
    getTheEndpoint.status === 405,
    `status ${getTheEndpoint.status}`,
  );

  /* 5-6. the Counterparty answers, and the Gap unlocks --------------- */
  const counterpartySubmit = await counterparty.post(
    `${instancePath}/answers`,
    answers({ feel: 5, wish: 3 }, { [MONEY]: { feel: 4, wish: 4 } }),
  );
  check(
    "the Counterparty's submit answers 303",
    counterpartySubmit.status === 303,
    `status ${counterpartySubmit.status}`,
  );

  const afterBoth = await initiator.get(instancePath);
  // #R2 — the hinge. Both sheets are in, and that is *not* completion: the report stays locked
  // until both parties accept, which is the review window the accept page exists for.
  check(
    "both submitted: the report is still locked, with no Gap on the instance screen",
    !afterBoth.html.includes("data-alignment-gap"),
  );
  const editBeforeAccept = await initiator.post(
    `${instancePath}/answers`,
    answers({ feel: 2, wish: 5 }, { [MONEY]: { feel: 4, wish: 4 } }),
  );
  check(
    "a re-submit before this seat accepts is allowed (the edit-before-accept window)",
    editBeforeAccept.status === 303,
    `status ${editBeforeAccept.status}`,
  );

  /* 5b. the way to the accept step, drawn on the pages (#617) ------------------------- */
  // Every earlier version of this file posted `/accepts` by hand, so the suite proved the endpoint
  // worked and never that a person could arrive at it — and the accept page shipped with no link
  // anywhere in the tree. From here the script follows only anchors and form actions the app drew.
  const submittedVisit = await counterparty.get(counterpartySubmit.location ?? instancePath);
  check(
    "the Counterparty's submit lands on the confirmation band",
    submittedVisit.status === 200 && submittedVisit.html.includes("data-submitted-confirmation"),
    `status ${submittedVisit.status}`,
  );
  const submittedAcceptHref = anchorHref(submittedVisit.html, "data-accept-link");
  check(
    "the confirmation band links to the accept step",
    submittedAcceptHref === `${instancePath}/accept`,
    `href ${submittedAcceptHref ?? "(no anchor)"}`,
  );

  // A party coming back later sees the same route on the instance screen — the confirmation band is
  // drawn once, but the step it points at stays reachable.
  const initiatorLaterScreen = await initiator.get(instancePath);
  const initiatorAcceptHref = anchorHref(initiatorLaterScreen.html, "data-accept-link");
  check(
    "the instance screen links to the accept step on a later visit",
    initiatorAcceptHref === `${instancePath}/accept`,
    `href ${initiatorAcceptHref ?? "(no anchor)"}; status ${initiatorLaterScreen.status}; band ${/data-accept-step="([a-z]+)"/.exec(initiatorLaterScreen.html)?.[1] ?? "absent"}`,
  );

  const acceptanceBefore = await db.query(
    "SELECT role, accepted_at FROM party WHERE session_record_id = $1 ORDER BY role",
    [instanceId],
  );
  note(
    `party rows before any acceptance: ${acceptanceBefore.rows
      .map((row) => `${row.role} accepted_at=${row.accepted_at === null ? "null" : "set"}`)
      .join(", ")}`,
  );

  const initiatorAcceptPage = await initiator.get(initiatorAcceptHref ?? `${instancePath}/accept`);
  check(
    "following it answers 200 and draws the acceptance for this party",
    initiatorAcceptPage.status === 200 &&
      initiatorAcceptPage.html.includes('data-party="counterparty"') &&
      initiatorAcceptPage.html.includes("Accept this session"),
    `status ${initiatorAcceptPage.status}`,
  );
  const initiatorAcceptAction = acceptFormAction(initiatorAcceptPage.html);
  check(
    "the page's own form posts to the accept endpoint",
    initiatorAcceptAction === `${instancePath}/accepts`,
    `action ${initiatorAcceptAction ?? "(no form)"}`,
  );

  const initiatorAccept = await initiator.post(
    initiatorAcceptAction ?? `${instancePath}/accepts`,
    {},
  );
  check(
    "the Initiator's acceptance answers 303 to the accept page",
    initiatorAccept.status === 303 &&
      (initiatorAccept.location ?? "").endsWith(`${instancePath}/accept`),
    `${initiatorAccept.status} ${initiatorAccept.location}`,
  );
  const afterFirstAccept = await initiator.get(instancePath);
  check(
    "one acceptance: the Gap is still sealed for both of you",
    !afterFirstAccept.html.includes("data-alignment-gap"),
  );
  check(
    "and the instance screen replaces the link with the wait",
    anchorHref(afterFirstAccept.html, "data-accept-link") === null &&
      afterFirstAccept.html.includes('data-accept-step="accepted"'),
  );

  const counterpartyLaterScreen = await counterparty.get(instancePath);
  const counterpartyAcceptHref = anchorHref(counterpartyLaterScreen.html, "data-accept-link");
  check(
    "the Counterparty's screen still offers the accept step",
    counterpartyAcceptHref === `${instancePath}/accept`,
    `href ${counterpartyAcceptHref ?? "(no anchor)"}; band ${/data-accept-step="([a-z]+)"/.exec(counterpartyLaterScreen.html)?.[1] ?? "absent"}`,
  );
  const counterpartyAcceptPage = await counterparty.get(
    counterpartyAcceptHref ?? `${instancePath}/accept`,
  );
  check(
    "and that page reads the Initiator's seat as accepted",
    counterpartyAcceptPage.status === 200 &&
      counterpartyAcceptPage.html.includes('data-party="initiator" data-accepted="yes"'),
    `status ${counterpartyAcceptPage.status}`,
  );
  const counterpartyAcceptAction = acceptFormAction(counterpartyAcceptPage.html);
  const counterpartyAccept = await counterparty.post(
    counterpartyAcceptAction ?? `${instancePath}/accepts`,
    {},
  );
  check(
    "the completing acceptance answers 303 to the report",
    counterpartyAccept.status === 303 &&
      (counterpartyAccept.location ?? "").endsWith(`${instancePath}/report`),
    `${counterpartyAccept.status} ${counterpartyAccept.location}`,
  );

  const reportViaAccept = await counterparty.get(counterpartyAccept.location ?? instancePath);
  check(
    "the report the acceptance redirects to opens, with the Gap drawn",
    reportViaAccept.status === 200 &&
      reportViaAccept.html.includes("data-feel-gap") &&
      !reportViaAccept.html.includes('data-report-gated="true"'),
    `status ${reportViaAccept.status}`,
  );

  const acceptanceAfter = await db.query(
    "SELECT role, accepted_at FROM party WHERE session_record_id = $1 ORDER BY role",
    [instanceId],
  );
  check(
    "both seats now record party.accepted_at",
    acceptanceAfter.rows.length === 2 &&
      acceptanceAfter.rows.every((row) => row.accepted_at !== null),
    acceptanceAfter.rows
      .map((row) => `${row.role} accepted_at=${String(row.accepted_at)}`)
      .join(", "),
  );
  note(
    `party rows after both acceptances: ${acceptanceAfter.rows
      .map((row) => `${row.role} accepted_at=${String(row.accepted_at)}`)
      .join(", ")}`,
  );

  const afterAcceptance = await initiator.get(instancePath);
  check(
    "the session derives `complete` — the stage the report is opened by",
    afterAcceptance.html.includes('data-stage-badge="sharing"'),
  );

  const gapAttribute = alignmentGaps(afterAcceptance.html, TIME);
  check(
    "Feel 2 against Feel 5 renders a Gap of 3",
    gapOfKind(gapAttribute, "feel") === 3,
    `feel = ${String(gapOfKind(gapAttribute, "feel"))}`,
  );
  check(
    "Wish 5 against Wish 3 renders a Gap of 2",
    gapOfKind(gapAttribute, "wish") === 2,
    `wish = ${String(gapOfKind(gapAttribute, "wish"))}`,
  );
  const moneyRow = alignmentGaps(afterAcceptance.html, MONEY);
  check(
    "the agreed Aspect renders 'In Synch'",
    moneyRow.length > 0 &&
      moneyRow.every(([, gap]) => gap === 0) &&
      afterAcceptance.html.includes("In Synch"),
    moneyRow.length === 0 ? "no difference rows" : `${moneyRow.length} rows, all 0`,
  );
  note(
    `rendered: data-alignment-aspect="${TIME}" feel ${String(gapOfKind(gapAttribute, "feel"))} · wish ${String(gapOfKind(gapAttribute, "wish"))}`,
  );

  const counterpartyReport = await counterparty.get(instancePath);
  const counterpartyGap = gapOfKind(alignmentGaps(counterpartyReport.html, TIME), "feel");
  check(
    "both parties see the same Gap",
    counterpartyGap === 3,
    `counterparty feel gap = ${String(counterpartyGap)}`,
  );

  /* 7. the freeze, now per party (#R2) -------------------------------- */
  const editAttempt = await initiator.post(
    `${instancePath}/answers`,
    answers({ feel: 4, wish: 4 }),
  );
  check(
    "editing after this seat accepted answers 409",
    editAttempt.status === 409,
    `status ${editAttempt.status}`,
  );
  check(
    "the refusal names the acceptance as the reason, not the other party's submit",
    editAttempt.html.includes("You have accepted this session, so an answer cannot be changed."),
  );
  const storedFeel = await db.query(
    "SELECT feel, wish FROM opinion WHERE session_record_id = $1 AND role = 'initiator' AND item_id = $2",
    [instanceId, TIME],
  );
  check(
    "the refused edit wrote nothing (still 2/5)",
    storedFeel.rows[0]?.feel === 2 && storedFeel.rows[0]?.wish === 5,
    JSON.stringify(storedFeel.rows[0]),
  );

  /* 8. copy, not alias ---------------------------------------------- */
  const original = copy.rows.find((row) => row.item_id === TIME)?.prompt ?? "";
  await db.query("UPDATE item SET prompt = $2 WHERE record_id = $1 AND item_id = $3", [
    TEMPLATE_ID,
    "TEMPLATE EDITED AFTER ANSWERING",
    TIME,
  ]);
  try {
    const afterEdit = await initiator.get(instancePath);
    check(
      "editing the template afterwards does not change the instance's screen",
      rendered(afterEdit.html).includes(original) &&
        !rendered(afterEdit.html).includes("TEMPLATE EDITED AFTER ANSWERING"),
      "the original prompt is still drawn",
    );
    const instanceRow = await db.query(
      "SELECT prompt FROM item WHERE record_id = $1 AND item_id = $2",
      [instanceId, TIME],
    );
    check("the instance's own copy row is unchanged", instanceRow.rows[0]?.prompt === original);
  } finally {
    await db.query("UPDATE item SET prompt = $2 WHERE record_id = $1 AND item_id = $3", [
      TEMPLATE_ID,
      original,
      TIME,
    ]);
  }

  /* 9. every party is reachable by hash only ------------------------- */
  const partyHashes = await db.query(
    "SELECT role, access_token_hash FROM party WHERE session_record_id = $1 ORDER BY role",
    [instanceId],
  );
  check(
    "both parties carry a 64-hex token hash and no raw token",
    partyHashes.rows.length === 2 &&
      partyHashes.rows.every((row) => /^[0-9a-f]{64}$/.test(row.access_token_hash ?? "")),
  );
  const gapColumns = await db.query(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name ILIKE '%gap%'`,
  );
  check(
    "no column anywhere is named like a Gap",
    gapColumns.rows[0].n === 0,
    `${gapColumns.rows[0].n}`,
  );

  /* 10. Advanced Mode: four scores, four Gaps (#213) ------------------ */
  // The card's second instance. It is created here rather than seeded, so the proof is that
  // the *flow* can produce an Advanced instance — the gap #213 names was that only the seeded
  // demo showed all four, and a newly created instance could not.
  const advInitiator = new Jar("advanced-initiator");
  const advCounterparty = new Jar("advanced-counterparty");
  const advCreate = await createThroughStages(advInitiator, {
    templateRecordId: TEMPLATE_ID,
    initiatorName: "Noor E2E",
    counterpartyName: "Iris E2E",
    email: "iris-e2e@example.com",
    title: "Noor and Iris E2E",
    mode: "advanced",
    aspects: templateAspects,
  });
  if (advCreate.instanceId === null) throw new Error("no instance id in the advanced redirect");
  const advInstanceId = advCreate.instanceId;
  const advPath = `/assessment/instances/${advInstanceId}`;

  const advScreen = await advInitiator.get(advPath);
  check(
    "the Advanced instance screen renders",
    advScreen.status === 200,
    `status ${advScreen.status}`,
  );
  const advRadios = (advScreen.html.match(/type="radio"/g) ?? []).length;
  check(
    "an Advanced instance asks four scores on every Aspect, and only four",
    advRadios === ASPECT_IDS.length * 4 * 5,
    `${advRadios} radios for ${ASPECT_IDS.length} Aspects × 4 kinds × 5 notches`,
  );
  const advFieldOrder = [
    ...new Set(
      [...advScreen.html.matchAll(new RegExp(`name="(\\w+):${TIME}"`, "g"))].map(
        (match) => match[1],
      ),
    ),
  ];
  check(
    "the four are asked in the glossary's order",
    advFieldOrder.join(",") === "feel,wish,think,guess",
    advFieldOrder.join(","),
  );
  check(
    "the screen names Advanced Mode",
    advScreen.html.includes('data-mode="advanced"') && advScreen.html.includes("Advanced Mode"),
    'data-mode="advanced"',
  );
  const advModeRow = await db.query("SELECT mode FROM session WHERE record_id = $1", [
    advInstanceId,
  ]);
  check(
    "the row records mode=advanced",
    advModeRow.rows[0]?.mode === "advanced",
    `mode=${advModeRow.rows[0]?.mode}`,
  );

  const advLink = advScreen.html.match(/https?:\/\/[^\s"<>]+\/invite\/[A-Za-z0-9_-]{43}/)?.[0];
  check("the Advanced screen shows its invitation link", advLink !== undefined, advLink);
  if (advLink === undefined) throw new Error("no invitation link on the advanced screen");
  const advToken = advLink.split("/invite/")[1];
  const advInvitePage = await advCounterparty.get(`/invite/${advToken}`);
  check(
    "the Advanced invitation page renders for the Counterparty",
    advInvitePage.status === 200,
    `status ${advInvitePage.status}`,
  );
  const advClaim = await advCounterparty.post(`/invite/${advToken}/claim`, {
    confirm: "Iris E2E",
  });
  check(
    "claiming the Advanced invitation answers 303",
    advClaim.status === 303,
    `status ${advClaim.status}`,
  );

  const shortSheet = await advInitiator.post(`${advPath}/answers`, answers({ feel: 2, wish: 5 }));
  check(
    "an Advanced submit that skips Think and Guess is refused with 409",
    shortSheet.status === 409,
    `status ${shortSheet.status}`,
  );
  check(
    "the refusal says the pair comes together",
    shortSheet.html.includes("Think and Guess come together"),
    "the pair rule",
  );

  const advInitiatorSubmit = await advInitiator.post(
    `${advPath}/answers`,
    answers({ feel: 2, wish: 5, think: 4, guess: 1 }),
  );
  check(
    "the Advanced Initiator submits four scores",
    advInitiatorSubmit.status === 303,
    `status ${advInitiatorSubmit.status}`,
  );
  const advCounterpartySubmit = await advCounterparty.post(
    `${advPath}/answers`,
    answers({ feel: 5, wish: 3, think: 3, guess: 4 }),
  );
  check(
    "the Advanced Counterparty submits four scores",
    advCounterpartySubmit.status === 303,
    `status ${advCounterpartySubmit.status}`,
  );
  check(
    "and the Advanced report is still locked until both accept",
    !(await advInitiator.get(advPath)).html.includes("data-alignment-gap"),
  );
  const advAccept1 = await advInitiator.post(`${advPath}/accepts`, {});
  const advAccept2 = await advCounterparty.post(`${advPath}/accepts`, {});
  check(
    "both Advanced acceptances answer 303",
    advAccept1.status === 303 && advAccept2.status === 303,
    `${advAccept1.status} / ${advAccept2.status}`,
  );

  const advReport = await advInitiator.get(advPath);
  const advRow = alignmentGaps(advReport.html, TIME);
  check(
    "the Advanced report draws all eight Gap kinds (#219)",
    advRow.length === 8 &&
      gapOfKind(advRow, "feel") === 3 &&
      gapOfKind(advRow, "wish") === 2 &&
      gapOfKind(advRow, "initiator") === 3 &&
      gapOfKind(advRow, "counterparty") === 2 &&
      // A prediction against the other party's actual: Initiator Think 4 vs Counterparty
      // Feel 5 → 1; Initiator Guess 1 vs Counterparty Wish 3 → 2; Counterparty Think 3 vs
      // Initiator Feel 2 → 1; Counterparty Guess 4 vs Initiator Wish 5 → 1.
      gapOfKind(advRow, "initiator-think") === 1 &&
      gapOfKind(advRow, "initiator-guess") === 2 &&
      gapOfKind(advRow, "counterparty-think") === 1 &&
      gapOfKind(advRow, "counterparty-guess") === 1,
    `${advRow.length} rows: ${advRow.map(([kind, gap]) => `${kind} ${gap}`).join(" · ")}`,
  );
  const advGapAttributes = (advReport.html.match(/data-alignment-gap="/g) ?? []).length;
  check(
    "every Aspect carries eight Gaps (5 × 8)",
    advGapAttributes === ASPECT_IDS.length * 8,
    `${advGapAttributes} gap attributes`,
  );
  note(
    `rendered: data-alignment-aspect="${TIME}" feel 3 · wish 2 · initiator 3 · counterparty 2 · I-think 1 · I-guess 2 · C-think 1 · C-guess 1`,
  );
}

async function cleanup() {
  try {
    for (const instanceId of created) {
      await db.query("DELETE FROM record WHERE id = $1", [instanceId]);
    }
    if (created.length > 0) console.log(`· cleaned up ${created.length} instance(s)`);
  } catch (error) {
    console.error(
      `! cleanup failed: ${error.message} — delete record ${created.join(", ")} by hand`,
    );
  }
}

/**
 * What the demo branch looks like when the run failed (#704).
 *
 * Read **after** `cleanup()`, so the numbers are what this run left rather than what it made: a
 * relationship whose id reached `created` is deleted above, one that never did is not. `session`
 * and `party` are the two tables a stray create grows; `record` is the one `pnpm db:seed` refuses
 * on ("record holds assessment row(s) this seed does not author"), and the branch is shared with
 * every other card, so the three counts together answer the question an operator actually has —
 * without a second probe against a branch somebody else may be using.
 */
async function reportBranch() {
  try {
    const { rows } = await db.query(
      `SELECT (SELECT count(*) FROM session)::int AS sessions,
              (SELECT count(*) FROM party)::int AS parties,
              (SELECT count(*) FROM record WHERE record_type = 'assessment')::int AS records`,
    );
    const { sessions, parties, records } = rows[0];
    console.log(
      `! the demo branch holds ${sessions} session row(s), ${parties} party row(s), ${records} assessment record(s)`,
    );
    console.log(
      `! registered for cleanup: ${created.length === 0 ? "(none)" : created.join(", ")}`,
    );
    console.log("! a stray record makes `pnpm db:seed` refuse — delete it before the next seed");
  } catch (error) {
    console.error(`! could not read the demo branch's counts: ${error.message}`);
  }
}

try {
  await main();
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.error(error);
} finally {
  await cleanup();
  // #704 — a red run says what state it left the shared branch in, so nobody has to probe.
  if (failures.length > 0) await reportBranch();
  await db.end();
  console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"} — ${failures.length} failure(s)`);
  for (const failure of failures) console.log(`  ✘ ${failure}`);
  process.exit(failures.length === 0 ? 0 : 1);
}
