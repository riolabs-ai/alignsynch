#!/usr/bin/env node
/**
 * `coach-acceptance.mjs` — the coach's hard read-only boundary, end to end against a seeded
 * database (dogfood, like `flow-e2e.mjs`; not part of `scripts/verify.sh`).
 *
 * A coach is a role on the relationship (`relationship_member.role = 'coach'`), never a
 * `party.role` value. This run proves the four things the coach card's acceptance asks for:
 *
 *   1. after seeding, one relationship holds an Initiator and a Counterparty member — then the
 *      same relationship after a coach is invited and the invitation is claimed;
 *   2. a coach opening an **unfinished** session gets the blind state — no Gap, no score, no
 *      answer control, just the Coach badge;
 *   3. a coach POSTing an answer is refused `not-a-party` (answering is party-only, and a coach
 *      is not a party — they hold no `flow_party_*` token);
 *   4. and the other side of the boundary: a coach *can* read a **completed** session's report.
 *
 * The write paths (`createInstanceFromTemplate`, `inviteCoach`, `claimCoachInvite`,
 * `readFlowScreen`, `submitAnswers`) are the exact functions the routes call, loaded through the
 * same `ts-modules` loader `db:seed` uses, so a green run is evidence about the shipped code.
 *
 * Usage (a seeded demo branch, DEMO_AUTH=1):
 *   DATABASE_URL=postgres://… NEON_AUTH_BASE_URL=https://… node --import ./scripts/ts-modules.mjs scripts/coach-acceptance.mjs
 *
 * It creates one fresh instance and one coach membership, then deletes both before it exits, so
 * it is safe to re-run against a branch another process reads.
 */
import { Client } from "pg";
import {
  claimCoachInvite,
  createInstanceFromTemplate,
  inviteCoach,
  readFlowScreen,
  submitAnswers,
} from "@/lib/flow/store";

const failures = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "✔" : "✘"} ${name}${detail === "" ? "" : ` — ${detail}`}`);
  if (!ok) failures.push(name);
}

const TEMPLATE_ID = "assessment-relationship-basics";
const AVeryRelation = "relationship-assessment-instance-avery-rowan";

const db = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await db.connect();

  const accounts = (await db.query("SELECT email, user_id FROM demo_account ORDER BY email")).rows;
  const avery = accounts.find((a) => a.email === "initiator@demo.alignsynch.test");
  const admin = accounts.find((a) => a.email === "admin@demo.alignsynch.test");
  check("the demo has an Initiator and an Admin", avery !== undefined && admin !== undefined);

  /* 1. membership rows after seeding, then after a coach is added ----------------- */
  const before = await db.query(
    `SELECT relationship_id, role, user_id FROM relationship_member ORDER BY relationship_id, role`,
  );
  console.log("\n— relationship_member after seeding (Initiator + Counterparty):");
  for (const row of before.rows) console.log(`   ${row.relationship_id}  ${row.role}`);
  check(
    "seeding backfilled exactly the Initiator and the Counterparty",
    before.rows.length === 2 &&
      before.rows.some((r) => r.role === "initiator") &&
      before.rows.some((r) => r.role === "counterparty"),
    `${before.rows.length} member row(s)`,
  );

  const invite = await inviteCoach({
    relationshipId: AVeryRelation,
    email: admin.email,
    viewerUserId: avery.user_id,
  });
  check(
    "the Initiator invites a coach (real token)",
    invite.ok === true,
    invite.ok ? "minted" : invite.reason,
  );
  if (!invite.ok) throw new Error(`inviteCoach refused: ${invite.reason}`);

  const claim = await claimCoachInvite({ token: invite.inviteToken, viewerUserId: admin.user_id });
  check(
    "the coach claims the invitation",
    claim.ok === true,
    claim.ok ? "member written" : claim.reason,
  );
  if (!claim.ok) throw new Error(`claimCoachInvite refused: ${claim.reason}`);

  const after = await db.query(
    `SELECT relationship_id, role, user_id FROM relationship_member ORDER BY relationship_id, role`,
  );
  console.log("\n— relationship_member after a coach is invited and claims:");
  for (const row of after.rows) console.log(`   ${row.relationship_id}  ${row.role}`);
  check(
    "the same relationship now holds a coach member",
    after.rows.some((r) => r.relationship_id === AVeryRelation && r.role === "coach"),
    "coach row present",
  );
  check(
    "no coach row was auto-created for any other relationship",
    after.rows.filter((r) => r.role === "coach").length === 1,
  );

  /* 4 (do first, on the seeded complete instance) — a coach reads a completed report ----- */
  const complete = await readFlowScreen({
    instanceRecordId: "assessment-instance-avery-rowan",
    token: undefined,
    viewerUserId: admin.user_id,
  });
  check(
    "the coach resolves on the completed session",
    complete !== undefined && complete.viewer.role === "coach",
    complete?.viewer.role,
  );
  check(
    "the completed session's report is visible to the coach",
    complete?.report !== null,
    `report=${complete?.report === null ? "null" : "open"}`,
  );

  /* 2. a coach opens an unfinished session — blind ---------------------------------- */
  const created = await createInstanceFromTemplate({
    templateRecordId: TEMPLATE_ID,
    initiatorName: "Avery Coach",
    counterpartyName: "Rowan Coach",
    email: "rowan-coach@example.com",
    mode: "basic",
    viewerUserId: avery.user_id,
  });
  const freshRelation = (
    await db.query("SELECT relationship_id FROM session WHERE record_id = $1", [
      created.instanceRecordId,
    ])
  ).rows[0].relationship_id;

  const invite2 = await inviteCoach({
    relationshipId: freshRelation,
    email: admin.email,
    viewerUserId: avery.user_id,
  });
  check(
    "the fresh relationship's Initiator invites a coach",
    invite2.ok === true,
    invite2.ok ? "minted" : invite2.reason,
  );
  if (!invite2.ok) throw new Error(`second inviteCoach refused: ${invite2.reason}`);
  const claim2 = await claimCoachInvite({
    token: invite2.inviteToken,
    viewerUserId: admin.user_id,
  });
  check(
    "the coach claims the fresh invitation",
    claim2.ok === true,
    claim2.ok ? "member written" : claim2.reason,
  );
  if (!claim2.ok) throw new Error(`second claimCoachInvite refused: ${claim2.reason}`);

  const blind = await readFlowScreen({
    instanceRecordId: created.instanceRecordId,
    token: undefined,
    viewerUserId: admin.user_id,
  });
  check(
    "the coach resolves on the unfinished session",
    blind !== undefined && blind.viewer.role === "coach",
  );
  check("the unfinished session is blind — no report", blind?.report === null);
  // The blind rule outranks the coach: nothing of the parties' answers is in the view model —
  // no score, no Gap, no count — and the viewer is the read-only role, not a party.
  check(
    "no Aspect carries any party's score to the coach",
    blind?.aspects.every((aspect) => aspect.own === null) === true,
  );
  const serialized = JSON.stringify(blind);
  check("no Gap attribute in the coach's view model", !serialized.includes("data-feel-gap"));
  console.log(
    `\n— the coach's unfinished view model: status=${blind?.status}, viewer.role=${blind?.viewer.role}, report=${blind?.report === null ? "null" : "open"}, aspects=${blind?.aspects.length} (every own=null)`,
  );
  console.log(
    `  (the rendered HTML — no Gap, no answer control, Coach badge — is asserted in tests/flow-screen.test.ts)`,
  );

  /* 3. a coach POSTing an answer is refused ------------------------------------------ */
  const submit = await submitAnswers({
    instanceRecordId: created.instanceRecordId,
    token: undefined,
    answers: new Map(),
  });
  check(
    "the coach's submit is refused, not written",
    submit.ok === false && submit.code === "not-a-party",
    submit.ok ? "ACCEPTED (defect)" : `${submit.code}: ${submit.reason}`,
  );
  const opinionsWritten = await db.query(
    "SELECT count(*)::int AS n FROM opinion WHERE session_record_id = $1",
    [created.instanceRecordId],
  );
  check(
    "the refused submit wrote no opinion",
    opinionsWritten.rows[0].n === 0,
    `n=${opinionsWritten.rows[0].n}`,
  );

  /* cleanup --------------------------------------------------------------------------- */
  // The fresh instance's record cascades its session (and the session's parties, opinions and
  // invite); the relationship the session belonged to is a separate row, so it is deleted next —
  // its members and coach invite cascade with it.
  await db.query("DELETE FROM record WHERE id = $1", [created.instanceRecordId]);
  await db.query("DELETE FROM relationship WHERE id = $1", [freshRelation]);
  await db.query("DELETE FROM relationship_member WHERE relationship_id = $1 AND role = 'coach'", [
    AVeryRelation,
  ]);
  await db.query("DELETE FROM coach_invite WHERE relationship_id = $1", [AVeryRelation]);
}

try {
  await main();
} catch (error) {
  failures.push(`threw: ${error.message}`);
  console.error(error);
} finally {
  await db.end();
  console.log(`\n${failures.length === 0 ? "PASS" : "FAIL"} — ${failures.length} failure(s)`);
  for (const failure of failures) console.log(`  ✘ ${failure}`);
  process.exit(failures.length === 0 ? 0 : 1);
}
