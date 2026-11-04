#!/usr/bin/env node
/**
 * `pnpm flow:e2e` — the two-party flow, end to end, through the running app (#146).
 *
 * This is not part of `scripts/verify.sh`: the gate must stay database-free and build-free.
 * It is the dogfood the issue asks for, written down so it can be repeated:
 *
 *   1. create      an Instance from a published Template, over the create form
 *   2. invite      the invitation link is on the screen (no RESEND_API_KEY, so no email)
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
 *                  the completing acceptance is the one that mails the other seat
 *   6c. locked     an edit after the seat accepted is a 409 and the stored row is unchanged
 *   6d. gap        both parties now see `data-feel-gap="3"` where Feel 2 meets Feel 5, and
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
    const response = await fetch(`${BASE_URL}${path}`, {
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
    "SELECT item_id FROM item WHERE record_id = $1 ORDER BY position",
    [TEMPLATE_ID],
  );
  ASPECT_IDS = templateItems.rows.map((row) => row.item_id);
  check(
    "the template has the five Aspects the run answers",
    ASPECT_IDS.length === 5,
    ASPECT_IDS.join(", "),
  );

  const initiator = new Jar("initiator");
  const counterparty = new Jar("counterparty");
  const stranger = new Jar("stranger");

  /* 1. create ------------------------------------------------------- */
  const createdResponse = await initiator.post("/assessment/new", {
    templateRecordId: TEMPLATE_ID,
    initiatorName: "Avery E2E",
    counterpartyName: "Rowan E2E",
    email: "rowan-e2e@example.com",
    // The create form's radios (#213). Without one the store refuses: a mode is chosen, never
    // defaulted, so a post cannot pick a sheet the form did not offer.
    mode: "basic",
  });
  check(
    "POST /assessment/new answers 303",
    createdResponse.status === 303,
    `status ${createdResponse.status}`,
  );
  const location = createdResponse.location ?? "";
  const instanceMatch = location.match(/\/assessment\/instances\/([0-9a-f-]{36})/);
  check("it redirects to the new instance", instanceMatch !== null, location);
  if (instanceMatch === null) throw new Error("no instance id in the redirect");
  const instanceId = instanceMatch[1];
  created.push(instanceId);

  const instancePath = `/assessment/instances/${instanceId}`;
  const inviteNotice = new URL(location, BASE_URL).searchParams.get("invite");
  check(
    "with no RESEND_API_KEY the redirect says the emailer was not configured",
    inviteNotice === "unset",
    `invite=${inviteNotice}`,
  );
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
  // The creation redirect carries `?invite=unset` (no key in this run); the notice is a fact
  // about that instant, so the probe reads the screen the redirect pointed at.
  const initiatorScreen = await initiator.get(`${instancePath}?invite=${inviteNotice}`);
  check(
    "the initiator's screen renders",
    initiatorScreen.status === 200,
    `status ${initiatorScreen.status}`,
  );
  const linkMatch = initiatorScreen.html.match(/http:\/\/[^\s"<>]+\/invite\/[A-Za-z0-9_-]{43}/);
  check(
    "the screen shows the invitation link, because no email was sent",
    linkMatch !== null,
    linkMatch?.[0],
  );
  if (linkMatch === null) throw new Error("no invitation link on the screen");
  const link = linkMatch[0];
  const token = link.split("/invite/")[1];
  check("the screen says no email was sent", initiatorScreen.html.includes("No email was sent"));
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
  check(
    "a second claim of the spent token is refused",
    secondClaim.status === 303 &&
      (secondClaim.location ?? "").endsWith(`/invite/${token}?claim=claimed`),
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
  check(
    "the Counterparty sees no Gap at all",
    !blindScreen.html.includes("data-feel-gap") && !blindScreen.html.includes("data-wish-gap"),
  );
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
    !afterBoth.html.includes("data-feel-gap") && !afterBoth.html.includes("data-wish-gap"),
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

  const initiatorAccept = await initiator.post(`${instancePath}/accepts`, {});
  check(
    "the Initiator's acceptance answers 303 to the accept page",
    initiatorAccept.status === 303 &&
      (initiatorAccept.location ?? "").endsWith(`${instancePath}/accept`),
    `${initiatorAccept.status} ${initiatorAccept.location}`,
  );
  const afterFirstAccept = await initiator.get(instancePath);
  check(
    "one acceptance: the Gap is still sealed for both of you",
    !afterFirstAccept.html.includes("data-feel-gap") &&
      !afterFirstAccept.html.includes("data-wish-gap"),
  );
  const counterpartyAccept = await counterparty.post(`${instancePath}/accepts`, {});
  check(
    "the completing acceptance answers 303 to the report",
    counterpartyAccept.status === 303 &&
      (counterpartyAccept.location ?? "").endsWith(`${instancePath}/report`),
    `${counterpartyAccept.status} ${counterpartyAccept.location}`,
  );
  const afterAcceptance = await initiator.get(instancePath);

  const gapAttribute = afterAcceptance.html.match(
    /data-aspect="aspect-time-together" data-feel-gap="(\d)" data-wish-gap="(\d)"/,
  );
  check(
    "Feel 2 against Feel 5 renders a Gap of 3",
    gapAttribute !== null && gapAttribute[1] === "3",
    gapAttribute === null ? "attribute not found" : `data-feel-gap="${gapAttribute[1]}"`,
  );
  check(
    "Wish 5 against Wish 3 renders a Gap of 2",
    gapAttribute !== null && gapAttribute[2] === "2",
    gapAttribute === null ? "" : `data-wish-gap="${gapAttribute[2]}"`,
  );
  const moneyRow = afterAcceptance.html.match(
    /data-aspect="aspect-money" data-feel-gap="(\d)" data-wish-gap="(\d)"/,
  );
  check(
    "the agreed Aspect renders 'In synch'",
    moneyRow !== null && moneyRow[1] === "0" && afterAcceptance.html.includes("In Synch"),
    moneyRow === null ? "" : "gap 0",
  );
  note(
    `rendered: data-aspect="aspect-time-together" data-feel-gap="${gapAttribute?.[1]}" data-wish-gap="${gapAttribute?.[2]}"`,
  );

  const counterpartyReport = await counterparty.get(instancePath);
  const counterpartyGap = counterpartyReport.html.match(
    /data-aspect="aspect-time-together" data-feel-gap="(\d)"/,
  );
  check(
    "both parties see the same Gap",
    counterpartyGap?.[1] === "3",
    `counterparty data-feel-gap="${counterpartyGap?.[1]}"`,
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
  const advCreate = await advInitiator.post("/assessment/new", {
    templateRecordId: TEMPLATE_ID,
    initiatorName: "Noor E2E",
    counterpartyName: "Iris E2E",
    email: "iris-e2e@example.com",
    mode: "advanced",
  });
  check(
    "an Advanced instance is created with 303",
    advCreate.status === 303,
    `status ${advCreate.status}`,
  );
  const advMatch = (advCreate.location ?? "").match(/\/assessment\/instances\/([0-9a-f-]{36})/);
  if (advMatch === null) throw new Error("no instance id in the advanced redirect");
  const advInstanceId = advMatch[1];
  created.push(advInstanceId);
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
    !(await advInitiator.get(advPath)).html.includes("data-feel-gap"),
  );
  const advAccept1 = await advInitiator.post(`${advPath}/accepts`, {});
  const advAccept2 = await advCounterparty.post(`${advPath}/accepts`, {});
  check(
    "both Advanced acceptances answer 303",
    advAccept1.status === 303 && advAccept2.status === 303,
    `${advAccept1.status} / ${advAccept2.status}`,
  );

  const advReport = await advInitiator.get(advPath);
  const advRow = advReport.html.match(new RegExp(`<section[^>]*data-aspect="${TIME}"[^>]*>`))?.[0];
  check(
    "the Advanced report draws all eight Gap kinds (#219)",
    advRow?.includes('data-feel-gap="3"') === true &&
      advRow.includes('data-wish-gap="2"') &&
      advRow.includes('data-initiator-gap="3"') &&
      advRow.includes('data-counterparty-gap="2"') &&
      // A prediction against the other party's actual: Initiator Think 4 vs Counterparty
      // Feel 5 → 1; Initiator Guess 1 vs Counterparty Wish 3 → 2; Counterparty Think 3 vs
      // Initiator Feel 2 → 1; Counterparty Guess 4 vs Initiator Wish 5 → 1.
      advRow.includes('data-initiator-think-gap="1"') &&
      advRow.includes('data-initiator-guess-gap="2"') &&
      advRow.includes('data-counterparty-think-gap="1"') &&
      advRow.includes('data-counterparty-guess-gap="1"'),
    advRow?.slice(0, 260) ?? "no row",
  );
  const advGapAttributes = (advReport.html.match(/data-[a-z]+(?:-[a-z]+)*-gap=/g) ?? []).length;
  check(
    "every Aspect carries eight Gaps (5 × 8)",
    advGapAttributes === ASPECT_IDS.length * 8,
    `${advGapAttributes} gap attributes`,
  );
  note(
    `rendered: data-aspect="${TIME}" feel 3 · wish 2 · initiator 3 · counterparty 2 · I-think 1 · I-guess 2 · C-think 1 · C-guess 1`,
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

try {
  await main();
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.error(error);
} finally {
  await cleanup();
  await db.end();
  console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"} — ${failures.length} failure(s)`);
  for (const failure of failures) console.log(`  ✘ ${failure}`);
  process.exit(failures.length === 0 ? 0 : 1);
}
