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
 *   3a. response  the invitation renders inside the flow's modal (#710): the server's own HTML
 *                  carries the shell, the six-stage rail reads Connect, a `?step=2` deep link
 *                  lands on the same shell, and the completed claim leaves onto a screen that
 *                  is never an `Ongoing` surface — `/dashboard` signed in, the relationship
 *                  signed out
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
 * is safe to re-run against a database another process is reading. **What it deletes is what it
 * created, and all of it (#865):** the instance `record`, the `relationship` the create wrote (not
 * a child of the record — `DELETE FROM record` never took it), its payment/membership rows, and the
 * account it signed up. Cleanup runs in a `finally`, and on `SIGINT`/`SIGTERM` too, because the
 * runs that drifted the shared branch were killed rather than failed. A `kill -9` still cannot be
 * caught — that is what `pnpm db:seed`'s bundle-scoped sweep is for.
 *
 * **A failed run prints what the demo branch looks like (#704).** The create commits a `record`
 * row on the branch every card shares, so a throw before that row is registered for cleanup
 * leaves it behind — and `pnpm db:seed` then refuses ("record holds assessment row(s) this seed
 * does not author") until somebody deletes it by hand. The instance id is therefore registered the
 * moment it is parsed, and a failure ends with the branch's own `session` / `party` / `record`
 * counts, so "did this run leave a row" is answered by the output.
 */
import { writeFileSync } from "node:fs";
import { Client } from "pg";
import { sendInvitationPath } from "@/lib/flow/paths";

/**
 * Write a judged page to disk, when `FLOW_E2E_DUMP` names a directory.
 *
 * A failing assertion on rendered markup is otherwise a guessing game: the message says the marker
 * was absent, and nothing says what was drawn instead. `FLOW_E2E_DUMP=/tmp/e2e pnpm flow:e2e` leaves
 * the page beside the failure, so the assertion is corrected against the real render rather than a
 * remembered one. Off unless asked for — a suite that writes files by default litters the tree.
 */
function dumpPage(name, html) {
  const dir = process.env.FLOW_E2E_DUMP;
  if (!dir) return;
  try {
    writeFileSync(`${dir}/${name}.html`, html);
  } catch {
    // A dump is a diagnostic; never fail a run because the directory was not there.
  }
}

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TEMPLATE_ID = "assessment-relationship-basics";
/** The same fixture row's `slug` — what every stage's URL carries since #794. */
const TEMPLATE_SLUG = "relationship-basics";
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

/**
 * `/templates/relationship/<slug>/create` — the stem every create stage hangs off (#688, #794).
 *
 * The segment is the template's **slug**, because that is what the app redirects with: stage 1's
 * handler resolves the posted id to the slug before it answers, so an assertion built from the id
 * would be asserting the address the app deliberately does not use.
 */
function createStem(templateSlug = TEMPLATE_SLUG) {
  return `/templates/relationship/${templateSlug}/create`;
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
 * **The stages are the app's, not this script's, and the endpoint no longer accepts a short cut.**
 * A post to `POST /assessment/new` with no `draft=1` is refused with `?problem=create-not-from-flow`
 * (#957's server half), so the pre-#688 single-post create this script used to do is gone — the only
 * way to a relationship is stages 1–3's draft and stage 4's write, followed by stage 5's send. What
 * is driven here is what a person does: two form posts that only write a draft cookie, one JSON save
 * from the list, then the commit that writes, and then the send that publishes it.
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
    initiatorFirst,
    initiatorLast,
    counterpartyFirst,
    counterpartyLast,
    email,
    title,
    mode,
    setting = "soft",
    aspects,
    templateSlug = TEMPLATE_SLUG,
  },
) {
  const stem = createStem(templateSlug);

  /* stage 1 — Who ---------------------------------------------------- */
  /* #825 — each seat is first + last now, so the post carries four halves rather than two names. */
  const who = await jar.post("/assessment/new/who", {
    templateRecordId,
    initiatorFirst,
    initiatorLast,
    counterpartyFirst,
    counterpartyLast,
    email,
    title,
    description: "",
  });
  check(
    `stage 1 Who answers 303 to the Mode stage (${initiatorFirst} ${initiatorLast})`,
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

  /* stage 4 — Account (#825, #828) ------------------------------------ */
  // The stage that asks for the account and then **writes the relationship as a `draft`**. It used
  // to be a second gate reached after the commit (#690/#794); v9 made it the stage, and the draft
  // is what stage 5 either sends or keeps.
  const commitScreen = await jar.get(`${stem}/commit`);
  check(
    "stage 4 Account renders for the signed-in creator, drawing the account column",
    commitScreen.status === 200 && commitScreen.html.includes('data-create-account="true"'),
    `status ${commitScreen.status}`,
  );

  // `draft=1` is the whole difference (#828): the endpoint writes `relationship.status = 'draft'`
  // with `published_at` NULL and sends nothing, then hands the person to stage 5.
  const committed = await jar.post("/assessment/new", { templateRecordId, draft: "1" });
  const location = committed.location ?? "";
  const instanceId = instanceIdIn(location);
  if (instanceId !== null) created.push(instanceId);
  check(
    "stage 4 writes the draft and answers 303 to stage 5 Invite",
    committed.status === 303 &&
      instanceId !== null &&
      new URL(location, BASE_URL).pathname.endsWith(`${stem}/invite`),
    `${committed.status} ${location}`,
  );

  // #865 — the relationship the stage just wrote, registered here because it is **not** deleted by
  // `DELETE FROM record` and used to survive every run on the shared branch. Read back rather than
  // assumed: the id is minted by the app (`cryptoRandomId()`), so a guess is exactly the kind of
  // assumption this harness exists to avoid.
  if (instanceId !== null) {
    const state = await relationshipState(instanceId);
    if (state?.id) relationships.push(state.id);
  }
  return { location, instanceId };
}

/**
 * Sign a creator in, through the app's own auth (#844).
 *
 * Before v9 this script ran signed out and the create committed a relationship with no owner; that
 * is no longer a path the product has — stage 4 writes a draft *for the signed-in Initiator*, and a
 * signed-out browser cannot get past it. So the walk starts by making a real account, through the
 * same endpoint the sign-up form posts to.
 *
 * **The origin matters.** Neon Auth answers `403 INVALID_ORIGIN` for a host that is not on the
 * branch's trusted-domain list, so this runs against whatever `BASE_URL` names and fails loudly when
 * the host is not trusted, rather than silently continuing as a guest.
 */
async function signUpCreator(jar, { name }) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = "E2e-Passw0rd!2026";
  const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password, name }),
  });
  jar.absorb(response);
  const body = await response.text();
  check(
    "a creator account is created through the app's own sign-up endpoint",
    response.status === 200,
    `status ${response.status} ${body.slice(0, 90)}`,
  );
  // #865 — the account is a real auth user on the shared branch, so it is registered for cleanup
  // the moment the id is readable: a run that never deletes it leaves an identity behind on a
  // branch every card signs into. `body` is parsed defensively — a refusal has already been
  // reported by the check above, and cleanup must not be the thing that throws first.
  let userId = null;
  try {
    userId = JSON.parse(body)?.user?.id ?? null;
  } catch {
    // Not JSON: no id to register, and the check above already says the sign-up did not answer.
  }
  if (typeof userId === "string") createdAccounts.push({ email, userId });
  // A gated page answers 200 only with a live session; 307 is the signed-out redirect.
  // #867 — `/assessment/instances` is a 308 to `/assessments` since the list moved (one segment,
  // `next.config.mjs`), so asserting 200 on the old address asserted a redirect. The new address is
  // the gated one: signed out it answers `307 → /login?next=/assessments`.
  const gated = await jar.get("/assessments");
  check(
    "and the session it returns is accepted by a gated page",
    gated.status === 200,
    `status ${gated.status}`,
  );
  return { email, password };
}

/**
 * The relationship a session id belongs to — the two columns #828 made the draft/published
 * difference live in. The invitation row is written either way (stage 5 needs a token to send), so
 * status and `published_at` are what say whether anything went out.
 */
async function relationshipState(instanceRecordId) {
  const { rows } = await db.query(
    `SELECT r.id, r.status, r.published_at, r.initiator_user_id
       FROM relationship r
       JOIN session s ON s.relationship_id = r.id
      WHERE s.record_id = $1`,
    [instanceRecordId],
  );
  return rows[0] ?? null;
}

/**
 * The card entry a person makes in stage 5's walk, written as the row a completed capture writes.
 *
 * **#911 gated the send on the walk** — a plan joined and a card on file — so a harness that POSTs
 * `/send` with no method is refused `no-payment-method`. That refusal is the gate working, and this
 * script used to fail on it in two places while the product was correct: it POSTed the send the way
 * the pre-#911 screen allowed. Stripe's fields belong to the provider's own page, so the card entry
 * cannot be typed here; the harness writes `relationship_payment` — the row `paymentArmedOf()`
 * reads — and says so in its own line. Every other act in the walk is driven through the app.
 */
async function captureMethodStandIn(state, label) {
  if (state === null || state?.id === undefined) {
    console.log(`· ${label}: no relationship to put a method on`);
    return false;
  }
  await db.query(
    `INSERT INTO relationship_payment
       (relationship_id, payer_user_id, provider, provider_payment_method_id, method_captured_at,
        charge_due_at)
     VALUES ($1, $2, 'stripe', 'pm_e2e_harness', now(), now() + interval '7 days')
     ON CONFLICT (relationship_id) DO UPDATE
       SET method_captured_at = EXCLUDED.method_captured_at,
           charge_due_at = EXCLUDED.charge_due_at`,
    [state.id, state.initiator_user_id],
  );
  console.log(`· ${label}: method stand-in written (the card entry is the browser's act)`);
  return true;
}

/**
 * The method stand-in taken back off the obligation — the state "no card on file".
 *
 * Stage 5's send needs the card (#911) and the fee gate needs its absence, and both are the product's
 * rules: a published relationship whose payer has not finished the walk is exactly what the gate
 * shuts. The **row stays** and only its capture is cleared, because `paymentArmedOf()` answers
 * `undefined` — "not measured" — for a missing obligation and only `false` closes the gate
 * (`lib/flow/payment.ts:157`). Section 6e puts the capture back through the provider's own endpoint.
 */
async function clearMethodStandIn(instanceRecordId, label) {
  await db.query(
    `UPDATE relationship_payment
        SET method_captured_at = NULL, charge_due_at = NULL
      WHERE relationship_id = (SELECT relationship_id FROM session WHERE record_id = $1)`,
    [instanceRecordId],
  );
  console.log(`· ${label}: method stand-in cleared (the "no card on file" state)`);
}

/**
 * A fixture string as React writes it into a text node: `&` is `&amp;`, and the two quotes are
 * entities. Needed because a title like "Staff & Manager" is *drawn* escaped — comparing the raw
 * value against the markup would fail on a page that renders it correctly.
 */
function textOf(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

/**
 * The words a template's stage 1 prints, read the way the page reads them
 * (`lib/db/template-library.ts::LIBRARY_COLUMNS`): the **published version's** payload, falling
 * back to the row's own copy for a template that has never been published. Reading `record.title`
 * alone would assert a string the screen may not draw — the catalogue's types carry a live version
 * whose `title` is what stage 1 renders.
 */
async function templateWords(slug) {
  const { rows } = await db.query(
    `SELECT COALESCE(live.payload->>'title', r.title)   AS title,
            COALESCE(live.payload->>'summary', r.summary) AS summary
       FROM record r
       LEFT JOIN LATERAL (
         SELECT v.payload
           FROM template_version v
          WHERE v.template_record_id = r.id
          ORDER BY v.version DESC
          LIMIT 1
       ) live ON true
      WHERE r.record_type = 'assessment' AND r.slug = $1`,
    [slug],
  );
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * The run
 * ------------------------------------------------------------------ */

const db = new Client({ connectionString: process.env.DATABASE_URL });
const created = [];
/**
 * What this run created that is **not** a child of the `record` (#865).
 *
 * `DELETE FROM record` cascades the session, its parties, its opinions and its invitation, so
 * that one statement used to look like a complete cleanup — and left the `relationship` row the
 * create wrote standing on the shared demo branch, with a `relationship_payment` row on it. Thirty
 * of those were what made `pnpm db:seed` refuse with
 * `relationship: expected 4 row(s) from demo-dataset.alignsynch.json, found 38`.
 *
 * So both are registered the moment they exist and removed by `cleanup()`: the account this run
 * signed up (`createdAccounts`) and the relationship id the create wrote (`relationships`). The
 * seed's sweep is the net for a `kill -9` that skips all of this, not the plan.
 */
const createdAccounts = [];
const relationships = [];
/**
 * Templates this run **authored** (#870), which `DELETE FROM record` does not clean up on its own:
 * a template is a parent of its `item` rows and of its `template_version`, and the version's FK
 * would refuse the delete. Registered the moment the save's `?created=` id is readable, and removed
 * by `cleanup()` children-first — the same rule the rest of this file follows, because the demo
 * branch is shared and `pnpm db:seed` refuses on a stray authored record.
 */
const createdTemplates = [];
/** One cleanup per run: the signal handler and the `finally` must not both sweep the branch. */
let cleaned = false;

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

  /* 0a. the catalogue's action survives the account gate (#867) -------- */
  // The one moment in the product where intent already exists: a stranger has chosen a template
  // and has no account. Before this card the action was a bare `/register`, so the account was
  // created and the person arrived on the brand's landing page with the choice gone.
  const visitor = new Jar("visitor");
  const catalogue = await visitor.get("/relationship-types");
  dumpPage("catalogue", catalogue.html);
  check(
    "the public catalogue renders for a signed-out visitor",
    catalogue.status === 200,
    `status ${catalogue.status}`,
  );

  // The action's own href, read off the page — never a path typed here.
  const startHref = catalogue.html.match(/href="(\/register\?next=[^"]+)"/)?.[1] ?? "";
  const chosenStem =
    (startHref === "" ? null : new URL(startHref, BASE_URL).searchParams.get("next")) ?? "";
  check(
    "a card's use action carries the template it sells into the sign-up gate",
    /^\/templates\/relationship\/[a-z-]+\/create$/.test(chosenStem),
    startHref === "" ? "no `/register?next=` action on the page" : `href = "${startHref}"`,
  );
  const chosenSlug = chosenStem.split("/")[3] ?? "";
  const words = chosenSlug === "" ? null : await templateWords(chosenSlug);

  // The gate promises no wall: the destination is a screen whether or not an account exists
  // (#690 — stage 1 never asked for one).
  const stageOneFirst = await visitor.get(chosenStem);
  check(
    "the destination renders for the signed-out visitor too",
    stageOneFirst.status === 200 && stageOneFirst.html.includes('data-wizard-rail="1"'),
    `status ${stageOneFirst.status}`,
  );

  // The gate remembers it. `?next=` is the one parameter `/register` reads, and it puts what it
  // will navigate to on the page (`signInDestination`) rather than the brand's default.
  const gate = await visitor.get(startHref);
  const gatePayload = gate.html.replaceAll('\\"', '"');
  check(
    "the account gate keeps that destination instead of the brand's landing page",
    gate.status === 200 && gatePayload.includes(`"destination":"${chosenStem}"`),
    `status ${gate.status}`,
  );

  // What the form does when it succeeds: the app's own sign-up endpoint, into the same jar.
  await signUpCreator(visitor, { name: "Nadia Visitor" });

  // …and then the view's `router.push(destination)` — the same address, now signed in.
  const arrived = await visitor.get(chosenStem);
  dumpPage("stage-1-after-signup", arrived.html);
  check(
    "signing up lands on stage 1 of the template the visitor chose",
    arrived.status === 200 &&
      arrived.html.includes('data-wizard-rail="1"') &&
      arrived.html.includes('data-step-state="current"'),
    `status ${arrived.status}`,
  );
  check(
    "and that stage names the template, not an empty flow",
    words !== null && arrived.html.includes(textOf(words.title)),
    words === null ? `no template row for "${chosenSlug}"` : `title = "${words.title}"`,
  );
  note(
    `#867 — intent carried: ${startHref} → sign-up → ${chosenStem} (stage 1 of "${words?.title ?? chosenSlug}")`,
  );

  /* 0. an account — stage 4 writes the draft for one (#844) ----------- */
  // v9 has no account-less path: stage 4 is the Account stage, and the draft it writes is owned by
  // the browser's account. This script used to run signed out, which is how it kept passing while
  // the signed-in journey was never walked at all.
  await signUpCreator(initiator, { name: "Avery E2E" });

  /* 1. create — five stages: Details, Settings, Aspects, Account, Invite (#825) --- */
  const firstCreate = await createThroughStages(initiator, {
    templateRecordId: TEMPLATE_ID,
    initiatorFirst: "Avery",
    initiatorLast: "E2E",
    counterpartyFirst: "Rowan",
    counterpartyLast: "E2E",
    email: "rowan-e2e@example.com",
    title: "Avery and Rowan E2E",
    mode: "basic",
    aspects: templateAspects,
  });
  if (firstCreate.instanceId === null) throw new Error("no instance id in the create redirect");
  const instanceId = firstCreate.instanceId;

  const instancePath = `/assessment/instances/${instanceId}`;

  /* 1a. the draft — written, owned, unpublished (#828) ------------------ */
  const drafted = await relationshipState(instanceId);
  check(
    "stage 4 wrote the relationship as a draft, owned and unpublished",
    drafted !== null && drafted.status === "draft" && drafted.published_at === null,
    JSON.stringify(drafted),
  );

  /* 1b. stage 5 Invite draws the walk, and no act until it is paid for -------- */
  const inviteStage = await initiator.get(firstCreate.location);
  check(
    "stage 5 Invite draws the walk and the keep-as-draft way out",
    inviteStage.status === 200 &&
      inviteStage.html.includes('data-pay-step="plan"') &&
      inviteStage.html.includes('data-send-gate="locked"') &&
      inviteStage.html.includes('data-create-keep-draft="true"'),
    `status ${inviteStage.status}`,
  );
  check(
    "and no send control exists before the membership is live (#1014)",
    !inviteStage.html.includes('data-create-send="true"'),
    "a send control was drawn on an unpaid stage",
  );

  /* 1c. no payment, no send: keeping the draft ------------------------ */
  // `Continue as Draft` is a link, not a server act — so the proof is that the relationship is
  // *still* an unpublished draft and that the control lands on the draft itself (#1014). The list
  // the relationship appears in is one Back away, which the next block checks.
  const keepDraftTag = inviteStage.html.match(/<a[^>]*data-create-keep-draft[^>]*>/)?.[0] ?? "";
  const keepDraftHref = keepDraftTag.match(/href="([^"]+)"/)?.[1] ?? "";
  check(
    "Continue as Draft links at the relationship itself, not the list and not the dashboard home",
    keepDraftHref.startsWith("/dashboard/relationships/"),
    `href = "${keepDraftHref}"`,
  );
  const dashboard = await initiator.get(
    keepDraftHref === "" ? "/dashboard/relationships" : keepDraftHref,
  );
  dumpPage("relationship-draft", dashboard.html);
  check(
    "keeping the draft lands the creator on that relationship",
    dashboard.status === 200,
    `status ${dashboard.status}`,
  );
  check(
    "and the relationship is drawn there by the title stages 1–3 chose",
    dashboard.html.includes("Avery and Rowan E2E"),
    "title not found in the relationship render",
  );
  const stillDraft = await relationshipState(instanceId);
  check(
    "nothing was sent and nothing was published: still a draft, no publish instant",
    stillDraft !== null && stillDraft.status === "draft" && stillDraft.published_at === null,
    JSON.stringify(stillDraft),
  );

  /* 1d. the send, gated on the walk (#911) --------------------------- */
  // Without a method the send is refused and nothing moves — the gate, asserted first so the pair
  // reads as one rule: no card, no publish; a card, publish.
  const ungated = await initiator.post(sendInvitationPath(instanceId), {});
  check(
    "stage 5's send is refused before the walk: no card, no publish",
    ungated.status === 303 && String(ungated.location ?? "").includes("resend=no-payment-method"),
    `${ungated.status} ${ungated.location}`,
  );
  const stillUnsent = await relationshipState(instanceId);
  check(
    "and the row is still a draft after that refusal",
    stillUnsent !== null && stillUnsent.status === "draft",
    JSON.stringify(stillUnsent),
  );

  /* 1e. the walk's card step, then Send and Continue publishes it ----- */
  await captureMethodStandIn(await relationshipState(instanceId), "stage 5 · draft");
  const sent = await initiator.post(sendInvitationPath(instanceId), {});
  check("Send and Continue answers 303", sent.status === 303, `${sent.status} ${sent.location}`);
  // #1014 — the send lands on the **relationship**, not the session and not the Sent screen: the flow
  // ends where every later cycle of the relationship lives.
  const sendLocation = String(sent.location ?? "");
  const sendTarget = new URL(sendLocation, "http://localhost");
  check(
    "and it lands on the relationship it published, carrying the mailer's own outcome",
    /^\/dashboard\/relationships\/[^/]+$/.test(sendTarget.pathname) &&
      sendTarget.searchParams.has("invite"),
    `location = "${sendLocation}"`,
  );
  check(
    "and it does not land on the session screen or the retired Sent confirmation",
    !/^\/assessment\/instances\//.test(sendTarget.pathname) && !/\/sent$/.test(sendTarget.pathname),
    `location = "${sendLocation}"`,
  );
  const published = await relationshipState(instanceId);
  check(
    "and it moves the draft to published, with the publish instant written",
    published !== null && published.status === "published" && published.published_at !== null,
    JSON.stringify(published),
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
    // Seven days from the instant the token was **issued**, which since #825 is the send, not the
    // draft: `sendDraftInvitation` reissues the token, so `expires_at` moves with it. A couple of
    // seconds of slack, because the two instants are written by different statements.
    "the invitation expires seven days after its token was issued",
    Math.abs(
      new Date(stored.expires_at).getTime() -
        new Date(stored.created_at).getTime() -
        7 * 24 * 60 * 60 * 1000,
    ) < 60_000,
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
  dumpPage("invite-page", invitePage.html);
  check(
    "the invitation page renders for the Counterparty",
    invitePage.status === 200,
    `status ${invitePage.status}`,
  );
  check("it names the Initiator", invitePage.html.includes("Avery E2E"));
  check("it names the Template", invitePage.html.includes("Relationship Basics"));
  // #t_0aa81144 — the invitation lands on step 1 of the onboarding wizard, not on a claim button.
  // #710 — and that wizard now renders inside the flow's modal, under the six-stage rail at
  // Connect, closing onto the dashboard. Three facts, because a shell that only *looks* modal
  // (a client overlay that mounts after hydration) would still 404 the deep link.
  check(
    "it opens on step 1 of the wizard",
    invitePage.html.includes("Avery E2E invited you to answer Relationship Basics."),
  );
  check(
    "the response renders inside the flow's modal, in the server's own HTML",
    invitePage.html.includes('data-stage-shell="true"') &&
      invitePage.html.includes('role="dialog"') &&
      invitePage.html.includes('data-stage-close="/dashboard"'),
  );
  check(
    // v9 (#825): five stages, `Stage {n} of 5`, and Connect is retired. It reads **4**, not 5:
    // the counterparty is arriving at the Account stage — the relationship's Invite stage is the
    // Initiator's, and a rail that told a stranger they were on it would be telling them about
    // somebody else's step. The band says Stage 4 of 5 and the fifth cell still exists.
    "and under the five-stage rail, at the Account stage — Stage 4 of 5",
    invitePage.html.includes("Stage 4 of 5") &&
      ["Details", "Settings", "Aspects", "Account", "Invite"].every((name) =>
        invitePage.html.includes(name),
      ) &&
      invitePage.html.includes('data-step-cell="5"'),
  );
  const stepTwo = await counterparty.get(`/invite/${token}?step=2`);
  dumpPage("invite-step-2", stepTwo.html);
  check(
    // The shell is the contract; the sentence on the step is copy and changes without notice.
    "a ?step=2 deep link survives a refresh and lands on the same shell",
    stepTwo.status === 200 &&
      stepTwo.html.includes('data-stage-shell="true"') &&
      stepTwo.html.includes("Stage 4 of 5"),
    `status ${stepTwo.status}`,
  );
  const stepThree = await counterparty.get(`/invite/${token}?step=3`);
  check(
    "step 3 is the account gate and claims nothing on a GET",
    stepThree.html.includes("Accepting costs you nothing") &&
      stepThree.html.includes("You are joining as Rowan E2E, the Counterparty.") === false &&
      stepThree.html.includes('data-stage-shell="true"'),
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
  // #710 — the exit is `afterClaimTarget()`: a signed-in claimer closes onto `/dashboard`, and a
  // signed-out one (this run — it posted the endpoint directly, which the screens never offer
  // because step 3 asks for an account) stays on the relationship it just bound, where the party
  // cookie it was given is what makes the screen readable.
  check(
    "claiming answers 303 to the relationship for a signed-out claimer",
    claim.status === 303 && (claim.location ?? "").endsWith(instancePath),
    `${claim.status} ${claim.location}`,
  );
  check(
    "and the exit is never an `Ongoing` surface",
    !/ongoing/i.test(claim.location ?? ""),
    claim.location ?? "",
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

  /* 6d. the fee gate — the method is taken away, and the report shuts ----- */
  // Since #911 the send needs a card, so a published relationship always has one when it is created
  // through the walk. The gate this section proves is the one *after* that: a method that is not on
  // file. Removing the stand-in row is how the harness reaches it, and 6e puts it back through the
  // provider's own capture.
  await clearMethodStandIn(instanceId, "6d · the fee gate");
  const reportViaAccept = await counterparty.get(counterpartyAccept.location ?? instancePath);
  dumpPage("report", reportViaAccept.html);
  check(
    // #619, read from `lib/flow/screen.ts`: the fee is the last gate. Both sheets sealed and no
    // method on file is `awaiting_payment`, and the report is built only for a `complete` session —
    // so the acceptance lands on the *shut* report, by design. This assertion used to demand the
    // Gap and had been failing since the fee gate shipped; the paid half is `pnpm payment:e2e`'s.
    "the report the acceptance redirects to is the gate, not the Gap — the fee is the last gate (#619)",
    reportViaAccept.status === 200 && reportViaAccept.html.includes('data-report-gated="true"'),
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

  // The blind rule outlives both sheets: with no method on file the report is shut, so neither
  // party's scores may be drawn. That is the **hard gate at publish opinions** the payment posture
  // names, and the method was taken away above for exactly this state.
  const unpaidScreen = await initiator.get(instancePath);
  check(
    "no Gap is drawn while the fee is unpaid — the blind rule holds after both acceptances",
    alignmentGaps(unpaidScreen.html, TIME).length === 0,
    `${alignmentGaps(unpaidScreen.html, TIME).length} gap row(s) rendered before payment`,
  );
  check(
    "and the counterparty's screen draws none either",
    alignmentGaps((await counterparty.get(instancePath)).html, TIME).length === 0,
  );

  /* 6e. the payer's act — capture the method, and the Gap opens ---------- */
  // #619: the report is built only for a `complete` session, and a session with no method on file
  // is `awaiting_payment`. `POST /api/billing/payment` captures a method through the adapter and
  // charges nothing, which is the act the payer's screen performs — so the script can drive the
  // whole workflow, not just its gated half.
  const paidState = await relationshipState(instanceId);
  const captured = await initiator.postJson("/api/billing/payment", {
    relationshipId: paidState?.id,
  });
  // The request is the contract, and it was broken until the adapter carried a `currency` on both
  // presentations: this used to answer `400 invalid-request — Missing required param: currency`,
  // i.e. no payer could ever put a method on file. With the Stripe adapter the session is *hosted*,
  // so finishing it needs a card typed into the provider's own page — the harness proves the
  // capture is accepted (`captured`, or a URL to send the browser to) and stops there.
  check(
    "the payment capture is accepted by the provider (no refusal, no 400)",
    captured.status === 200 &&
      (captured.body?.captured === true || typeof captured.body?.url === "string"),
    `${captured.status} ${JSON.stringify(captured.body)}`,
  );

  // The card entry itself belongs to a browser, so the row a completed capture writes is written
  // here instead — `relationship_payment` (`0036`), which is what `paymentArmedOf()` reads. The Gap
  // assertions below are made against that row, and cleanup removes the relationship it belongs to.
  await db.query(
    `INSERT INTO relationship_payment
       (relationship_id, payer_user_id, provider, provider_payment_method_id, method_captured_at,
        charge_due_at)
     VALUES ($1, $2, 'stripe', 'pm_e2e_harness', now(), now() + interval '7 days')
     ON CONFLICT (relationship_id) DO UPDATE
       SET method_captured_at = EXCLUDED.method_captured_at,
           charge_due_at = EXCLUDED.charge_due_at`,
    [paidState?.id, paidState?.initiator_user_id],
  );

  const paidScreen = await initiator.get(instancePath);
  const gapAttribute = alignmentGaps(paidScreen.html, TIME);
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
  const moneyRow = alignmentGaps(paidScreen.html, MONEY);
  check(
    "the agreed Aspect renders 'In Synch'",
    moneyRow.length > 0 &&
      moneyRow.every(([, gap]) => gap === 0) &&
      paidScreen.html.includes("In Synch"),
    moneyRow.length === 0 ? "no difference rows" : `${moneyRow.length} rows, all 0`,
  );

  const paidReport = await counterparty.get(`${instancePath}/report`);
  dumpPage("report-paid", paidReport.html);
  check(
    // The report has its own vocabulary: `data-feel-gap` / `data-counterparty-gap` per Aspect,
    // where the instance screen uses `data-alignment-gap` per row. It is the *page* that was shut
    // before the method was captured, not the numbers.
    "and now the report the acceptance redirected to opens, with the Gap drawn",
    paidReport.status === 200 &&
      !paidReport.html.includes('data-report-gated="true"') &&
      paidReport.html.includes('data-feel-gap="3"') &&
      paidReport.html.includes('data-counterparty-gap="2"'),
    `status ${paidReport.status} gated=${paidReport.html.includes('data-report-gated="true"')}`,
  );
  const counterpartyPaid = await counterparty.get(instancePath);
  const counterpartyGap = gapOfKind(alignmentGaps(counterpartyPaid.html, TIME), "feel");
  check(
    "both parties see the same Gap",
    counterpartyGap === 3,
    `counterparty feel gap = ${String(counterpartyGap)}`,
  );
  note(
    `rendered after the method was captured: data-alignment-aspect="${TIME}" feel ${String(gapOfKind(gapAttribute, "feel"))} · wish ${String(gapOfKind(gapAttribute, "wish"))}`,
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
  // v9: stage 4 writes the draft *for the signed-in Initiator*, so a fresh jar needs its own
  // account. Without this the create 303s to /login and the whole Advanced section is skipped —
  // which is exactly how it failed the first time the five-stage walk was run.
  await signUpCreator(advInitiator, { name: "Noor E2E" });
  const advCreate = await createThroughStages(advInitiator, {
    templateRecordId: TEMPLATE_ID,
    initiatorFirst: "Noor",
    initiatorLast: "E2E",
    counterpartyFirst: "Iris",
    counterpartyLast: "E2E",
    email: "iris-e2e@example.com",
    title: "Noor and Iris E2E",
    mode: "advanced",
    aspects: templateAspects,
  });
  if (advCreate.instanceId === null) throw new Error("no instance id in the advanced redirect");
  const advInstanceId = advCreate.instanceId;
  const advPath = `/assessment/instances/${advInstanceId}`;

  // The draft is published the same way the first relationship's is: stage 5's send, after the
  // walk's card step (the method stand-in — see `captureMethodStandIn`). The invitation row the
  // create wrote holds the token the counterparty's link is built from.
  await captureMethodStandIn(await relationshipState(advInstanceId), "stage 5 · advanced");
  const advSent = await advInitiator.post(sendInvitationPath(advInstanceId), {});
  const advPublished = await relationshipState(advInstanceId);
  check(
    "the Advanced relationship publishes when its own stage 5 sends",
    advSent.status === 303 &&
      advPublished !== null &&
      advPublished.status === "published" &&
      advPublished.published_at !== null,
    `${advSent.status} ${JSON.stringify(advPublished)}`,
  );

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

  // Same #619 gate as the free path: the eight kinds are drawn only once a method is on file.
  const advState = await relationshipState(advInstanceId);
  const advCaptured = await advInitiator.postJson("/api/billing/payment", {
    relationshipId: advState?.id,
  });
  check(
    "the Advanced payer's capture is accepted too",
    advCaptured.status === 200 &&
      (advCaptured.body?.captured === true || typeof advCaptured.body?.url === "string"),
    `${advCaptured.status} ${JSON.stringify(advCaptured.body)}`,
  );
  await db.query(
    `INSERT INTO relationship_payment
       (relationship_id, payer_user_id, provider, provider_payment_method_id, method_captured_at,
        charge_due_at)
     VALUES ($1, $2, 'stripe', 'pm_e2e_harness', now(), now() + interval '7 days')
     ON CONFLICT (relationship_id) DO UPDATE
       SET method_captured_at = EXCLUDED.method_captured_at,
           charge_due_at = EXCLUDED.charge_due_at`,
    [advState?.id, advState?.initiator_user_id],
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

  /* 11. a template the member authored is usable (#870) -------------- */
  // The report the card came from: the owner wrote a template in the app, walked four stages with
  // it, and stage 5 answered "that template is not published" — four screens after the typing. The
  // cause was a template with Aspects and no `template_version`: a relationship is bound to a
  // version, so nothing could copy it.
  //
  // Step 0 of #870 makes authoring write v1 in the same transaction as the record and its Aspects.
  // This walks it end to end rather than trusting that it does: author a template, read the version
  // back, then take the create flow through stage 4 and assert stage 5 is a screen with the walk,
  // the send and the keep-as-draft act on it.
  //
  // A **fresh account**, because the plan gate allows one active relationship on the free tier and
  // every relationship this run has created so far belongs to the first creator.
  const author = new Jar("author");
  await signUpCreator(author, { name: "Avery Author" });

  const authoredTitle = `E2E Authored ${Date.now()}`;
  const authoredSave = await author.post("/templates/relationship/save", {
    title: authoredTitle,
    "aspect-1-prompt": "How often we speak",
    "aspect-1-leftValue": "Rarely",
    "aspect-1-rightValue": "Daily",
    "aspect-2-prompt": "Who decides",
    "aspect-2-leftValue": "Shared",
    "aspect-2-rightValue": "Clear",
    "aspect-3-prompt": "What we do when we disagree",
    "aspect-3-leftValue": "Avoid",
    "aspect-3-rightValue": "Name it",
  });
  const authoredId =
    authoredSave.status === 303
      ? (new URL(authoredSave.location ?? "/", BASE_URL).searchParams.get("created") ?? null)
      : null;
  // Registered before anything below can throw: a stray authored record is what makes `db:seed`
  // refuse for the next card on this shared branch.
  if (authoredId !== null) createdTemplates.push(authoredId);
  check(
    "authoring a template answers 303 with its new record's id",
    authoredSave.status === 303 && authoredId !== null,
    `${authoredSave.status} ${authoredSave.location}`,
  );

  const authoredRow =
    authoredId === null
      ? { rows: [] }
      : await db.query("SELECT slug, status FROM record WHERE id = $1", [authoredId]);
  const authoredSlug = authoredRow.rows[0]?.slug ?? "";
  check(
    "and the row it wrote is published and addressable by slug",
    authoredRow.rows[0]?.status === "published" && authoredSlug !== "",
    `${authoredRow.rows[0]?.status} / "${authoredSlug}"`,
  );

  // The step-0 assertion: exactly one version, numbered 1, carrying every Aspect that was typed.
  const authoredVersions =
    authoredId === null
      ? { rows: [] }
      : await db.query(
          "SELECT version, payload FROM template_version WHERE template_record_id = $1 ORDER BY version",
          [authoredId],
        );
  const authoredItems = authoredVersions.rows[0]?.payload?.items ?? [];
  check(
    "authoring writes exactly one template_version, numbered 1 (#870 step 0)",
    authoredVersions.rows.length === 1 && authoredVersions.rows[0]?.version === 1,
    `${authoredVersions.rows.length} row(s): ${authoredVersions.rows.map((row) => row.version).join(", ")}`,
  );
  check(
    "and its payload carries every Aspect that was typed",
    authoredItems.length === 3 && authoredItems[0]?.prompt === "How often we speak",
    `${authoredItems.length} item(s): ${authoredItems.map((item) => item.prompt).join(" · ")}`,
  );

  const authoredAspects = authoredItems.map((item) => ({
    id: item.id,
    prompt: item.prompt,
    leftValue: item.leftValue,
    rightValue: item.rightValue,
  }));

  // The path the owner walked: their own template, four stages, stage 5.
  const authoredCreate =
    authoredId === null || authoredSlug === ""
      ? { instanceId: null, location: "" }
      : await createThroughStages(author, {
          templateRecordId: authoredId,
          templateSlug: authoredSlug,
          initiatorFirst: "Avery",
          initiatorLast: "Author",
          counterpartyFirst: "Rowan",
          counterpartyLast: "Author",
          email: "rowan-author-e2e@example.test",
          title: "Avery and Rowan, authored",
          mode: "basic",
          aspects: authoredAspects,
        });
  check(
    "the create flow runs to stage 5 from a template this account authored (#870)",
    authoredCreate.instanceId !== null,
    authoredCreate.location,
  );

  const authoredInvite =
    authoredCreate.location === ""
      ? { status: 0, html: "" }
      : await author.get(authoredCreate.location);
  dumpPage("stage5-authored", authoredInvite.html);
  check(
    "and stage 5 draws the walk and the keep-as-draft act (#870, #1014)",
    authoredInvite.status === 200 &&
      authoredInvite.html.includes("data-pay-step=") &&
      authoredInvite.html.includes('data-send-gate="locked"') &&
      authoredInvite.html.includes('data-create-keep-draft="true"'),
    `status ${authoredInvite.status}`,
  );
  check(
    "stage 5 of the authored path carries no refusal band",
    !authoredInvite.html.includes('data-create-problem="true"'),
    "a band at stage 5 — the template was refused after four stages",
  );

  // Stage 1 is the door, so the same template must be *accepted* there rather than refused: the
  // guard asks the store's own question, and a published, versioned template answers it yes.
  const authoredStageOne = await author.get(`/templates/relationship/${authoredSlug}/create`);
  check(
    "stage 1 draws the form for it — the guard lets a copyable template through",
    authoredStageOne.status === 200 &&
      authoredStageOne.html.includes('name="templateRecordId"') &&
      !authoredStageOne.html.includes('data-create-problem="true"'),
    `status ${authoredStageOne.status}`,
  );

  // And the refusal that started all of this: archive the template, and stage 1 refuses **before**
  // a field is collected, with the author's own publish control under the sentence.
  const archivedPost = await author.post(`/templates/relationship/${authoredSlug}/status`, {
    status: "archived",
  });
  check(
    "archiving answers 303 to the library",
    archivedPost.status === 303,
    `${archivedPost.status} ${archivedPost.location}`,
  );
  const refusedStageOne = await author.get(`/templates/relationship/${authoredSlug}/create`);
  dumpPage("stage1-refused", refusedStageOne.html);
  check(
    "stage 1 refuses an archived template at the door, before any field is collected",
    refusedStageOne.status === 200 &&
      refusedStageOne.html.includes('data-create-problem="true"') &&
      !refusedStageOne.html.includes('name="templateRecordId"'),
    `status ${refusedStageOne.status}`,
  );
  check(
    "and the refusal carries the author's one-click publish, pointed back at this stage",
    refusedStageOne.html.includes('data-create-publish="true"') &&
      refusedStageOne.html.includes(`action="/templates/relationship/${authoredSlug}/status"`) &&
      refusedStageOne.html.includes('value="create"'),
    "no publish control under the band",
  );

  // Pressing it is the existing status transition, and it comes back to stage 1 rather than the
  // library — the person is mid-flow, not browsing.
  const republished = await author.post(`/templates/relationship/${authoredSlug}/status`, {
    status: "published",
    return: "create",
  });
  check(
    "publishing from the refusal answers 303 back to stage 1",
    republished.status === 303 &&
      new URL(republished.location ?? "/", BASE_URL).pathname ===
        `/templates/relationship/${authoredSlug}/create`,
    `${republished.status} ${republished.location}`,
  );
  const reopened = await author.get(`/templates/relationship/${authoredSlug}/create`);
  check(
    "and stage 1 draws the form again — one click, no research project",
    reopened.status === 200 &&
      reopened.html.includes('name="templateRecordId"') &&
      !reopened.html.includes('data-create-problem="true"'),
    `status ${reopened.status}`,
  );

  /* 12. the other producer — a forked template must be usable too ------ */
  // #785 added a second writer of templates: the Counterparty forks the relationship's template into
  // their own library. It writes a `record` and its `item` rows, so it owes a `template_version` for
  // exactly the reason authoring does, and it goes through the same `writeFirstVersion` — one
  // writer, two callers. This asserts that, because the defect this card fixes is precisely a
  // producer that forgot.
  //
  // Called in-process: the fork is a server action (`dashboard/relationships/actions.ts`), not a
  // form post, so there is no HTTP shape to drive. The rows it writes are checked by the same read
  // the create flow uses (`readLibraryTemplate`) and by the door guard's own input.
  const { forkRelationshipTemplate } = await import("@/lib/flow/templates");
  const { readLibraryTemplate } = await import("@/lib/db/template-library");
  const { templateCopyRefusal } = await import("@/lib/flow/create-copy");

  const boundRelationship = await relationshipState(instanceId);
  const forked =
    boundRelationship === null
      ? null
      : await forkRelationshipTemplate(boundRelationship.id, boundRelationship.initiator_user_id);
  if (forked !== null && forked.ok) createdTemplates.push(forked.template.id);
  check(
    "forking a relationship's template answers with a template of the caller's own",
    forked !== null && forked.ok && forked.template.aspectCount > 0,
    JSON.stringify(forked),
  );

  const forkVersions =
    forked === null || !forked.ok
      ? { rows: [] }
      : await db.query(
          "SELECT version, payload FROM template_version WHERE template_record_id = $1 ORDER BY version",
          [forked.template.id],
        );
  const forkItems = forkVersions.rows[0]?.payload?.items ?? [];
  check(
    "a fork carries exactly one template_version, numbered 1 (#785 + #870)",
    forkVersions.rows.length === 1 && forkVersions.rows[0]?.version === 1,
    `${forkVersions.rows.length} row(s): ${forkVersions.rows.map((row) => row.version).join(", ")}`,
  );
  check(
    "and its payload is the version the parties were asked on",
    forkItems.length === ASPECT_IDS.length && forkItems[0]?.id === ASPECT_IDS[0],
    `${forkItems.length} item(s): ${forkItems.map((item) => item.id).join(" · ")}`,
  );

  const forkRead =
    forked === null || !forked.ok
      ? undefined
      : await readLibraryTemplate(
          forked.template.slug,
          boundRelationship?.initiator_user_id ?? null,
        );
  check(
    "and a relationship can be started from it — the door guard lets a fork through",
    forkRead !== undefined &&
      forkRead.hasVersion === true &&
      templateCopyRefusal({
        status: forkRead.template.status,
        aspectCount: forkRead.aspects.length,
        authorship: forkRead.template.authorship,
        hasVersion: forkRead.hasVersion,
      }) === null,
    `${forkRead?.aspects.length ?? 0} aspect(s), hasVersion=${String(forkRead?.hasVersion)}`,
  );
}

/**
 * The auth tables, discovered rather than assumed — the same rule `db-seed.mjs` follows.
 *
 * Better Auth's own migration calls them `user`/`session`, Neon's console docs call them
 * `users`/`sessions`, and which one this branch has is a fact about the branch.
 */
async function authUserTable() {
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'neon_auth' ORDER BY table_name`,
  );
  const names = rows.map((row) => row.table_name);
  return names.find((name) => name === "user" || name === "users") ?? null;
}

/**
 * Removes one run's rows from the shared branch: the relationships it created, the records they
 * hang off, and the accounts it signed up.
 *
 * **Order matters in two places.** `DELETE FROM record` cascades the session (and its parties,
 * opinions and invitation) but *not* the relationship — `relationship` is keyed by the template,
 * not by the instance — so the relationship is deleted after the record whose session names it,
 * and `relationship_payment` before the relationship because `0036`'s FK has no cascade.
 *
 * Every statement is `ANY(ids)` and every list is what this run registered, so a re-entry (the
 * signal handler, then the `finally`) is a no-op rather than a second sweep of the branch.
 */
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    // Registered ids first, then anything a session of ours names: the registration can miss only
    // if the run died between the create's commit and the read-back, and the session row is what
    // closes that gap.
    const strays = new Set(relationships);
    if (created.length > 0) {
      const { rows } = await db.query(
        `SELECT DISTINCT relationship_id AS id FROM session
          WHERE record_id = ANY($1::text[]) AND relationship_id IS NOT NULL`,
        [created],
      );
      for (const row of rows) strays.add(row.id);
    }

    if (strays.size > 0) {
      const ids = [...strays];
      await db.query("DELETE FROM relationship_payment WHERE relationship_id = ANY($1::text[])", [
        ids,
      ]);
      await db.query("DELETE FROM relationship_member WHERE relationship_id = ANY($1::text[])", [
        ids,
      ]);
      await db.query("DELETE FROM coach_invite WHERE relationship_id = ANY($1::text[])", [ids]);
    }

    // The instance records: `DELETE FROM record` cascades the session, its parties, its opinions
    // and its invitation — everything that hangs off the record itself.
    for (const instanceId of created) {
      await db.query("DELETE FROM record WHERE id = $1", [instanceId]);
    }

    if (strays.size > 0) {
      await db.query("DELETE FROM relationship WHERE id = ANY($1::text[])", [[...strays]]);
    }

    // #870 — the templates this run authored, children first. The `item` rows and the
    // `template_version` both point at the record, so deleting the record alone refuses on the FK
    // and leaves the row `pnpm db:seed` reports as a stray.
    for (const templateId of createdTemplates) {
      await db.query("DELETE FROM template_version WHERE template_record_id = $1", [templateId]);
      await db.query("DELETE FROM item WHERE record_id = $1", [templateId]);
      await db.query("DELETE FROM record WHERE id = $1", [templateId]);
    }

    if (createdAccounts.length > 0) {
      const accounts = createdAccounts.map((account) => account.userId);
      await db.query("UPDATE party SET user_id = NULL WHERE user_id = ANY($1::text[])", [accounts]);
      await db.query("DELETE FROM relationship_member WHERE user_id = ANY($1::text[])", [accounts]);
      await db.query("DELETE FROM coach_invite WHERE invited_by_user_id = ANY($1::text[])", [
        accounts,
      ]);
      await db.query("DELETE FROM user_profile WHERE user_id = ANY($1::text[])", [accounts]);
      const users = await authUserTable();
      if (users !== null) {
        await db.query(`DELETE FROM neon_auth."${users}" WHERE id::text = ANY($1::text[])`, [
          accounts,
        ]);
      }
    }

    if (
      created.length > 0 ||
      strays.size > 0 ||
      createdAccounts.length > 0 ||
      createdTemplates.length > 0
    ) {
      console.log(
        `· cleaned up ${created.length} instance(s), ${strays.size} relationship(s), ${createdTemplates.length} template(s), ${createdAccounts.length} account(s)`,
      );
    }
  } catch (error) {
    console.error(
      `! cleanup failed: ${error.message} — delete record ${created.join(", ")} / relationship ${relationships.join(", ")} / account ${createdAccounts.map((account) => account.email).join(", ")} by hand`,
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
    console.log(
      "! a stray record still makes `pnpm db:seed` refuse — name it by hand; a stray relationship (and its children) is swept by the next seed (#865)",
    );
  } catch (error) {
    console.error(`! could not read the demo branch's counts: ${error.message}`);
  }
}

/**
 * A killed run cleans up too (#865).
 *
 * `finally` runs on a normal exit and on a thrown assertion, and neither is how this harness
 * actually left rows behind: the runs that drifted the branch were **killed** — `kill -TERM` from a
 * shell, a dispatcher timeout, `Ctrl-C`. Both catchable signals therefore clean up before the
 * process goes, and a `kill -9` is precisely why the seed's sweep exists as the net rather than the
 * plan: it cannot be caught, so nothing in this file can promise it.
 */
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`\n! ${signal} — cleaning up what this run created before exiting`);
  await cleanup();
  await db.end().catch(() => {});
  process.exit(130);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await main();
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.error(error);
} finally {
  if (!stopping) {
    await cleanup();
    // #704 — a red run says what state it left the shared branch in, so nobody has to probe.
    if (failures.length > 0) await reportBranch();
    await db.end();
  }
  console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"} — ${failures.length} failure(s)`);
  for (const failure of failures) console.log(`  ✘ ${failure}`);
  process.exit(failures.length === 0 ? 0 : 1);
}
