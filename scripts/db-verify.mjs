#!/usr/bin/env node
/**
 * `pnpm db:verify` — the DB port of `instanceTemplateProblems()` (E31) plus the party rules (#145).
 *
 * It reads the rows through the **same** data layer the page reads through
 * (`lib/db/assessments.ts` → `lib/db/rows.ts` → the zod schemas in `content/`), so a green run
 * is evidence about the shipped read path and not about a second query written for the check.
 * What it adds over the parse is *naming*: one line per violation, with the instance, the party
 * and the Aspect that broke the rule.
 *
 *   V1  the six content tables exist
 *   V2  no column anywhere in `public` is named like a Gap
 *   V3  every instance's `template_record_id` resolves to a template record
 *   V4  an instance's copy holds the Aspects of the **version its relationship is bound to**, in
 *       that version's order (E31, #502b) — not the template's working copy, which an edit may have
 *       moved and which no relationship reads
 *   V5  exactly one initiator and one counterparty per instance — a **flow** instance may
 *       have no counterparty until its invitation is claimed (#146), and must have one after
 *   V6  every party answers every Aspect exactly once, and think comes with guess — checked
 *       for a fixture instance and for a **complete** flow instance; an unfinished one is the
 *       flow working, not drift
 *   V7  each template and instance parses through `zAssessment` / `zAssessmentInstance`
 *   V8  the flow's bearer credentials are stored as SHA-256 digests, never as tokens (#146)
 *   V9  the instance's mode matches its opinion rows (#213): `basic` means no Think/Guess
 *       anywhere, `advanced` means the pair on every answered row, and the column is one of
 *       the two modes
 *   V10 a party's `user_id` is the binding `/assessment/instances` reads (#213 follow-up):
 *       it names an account that exists, and the two seeded demo parties still carry the
 *       binding `db:seed` gave them
 *   V11 the unlock mark (#252) exists, and a `party.unlock_seen_at` is set only on an instance
 *       that is already `complete` — a mark written too early would silently swallow the event
 *       the marker exists to announce
 *   V12 the Setting (#259): `session.alignment_setting` exists, every row carries
 *       one of the two values, and each seeded instance carries the setting its fixture
 *       authors — one line per seeded instance, so which they are never has to be guessed
 *       from a DEFAULT. It is a lens over the Gaps and not a Gap, so this check adds no
 *       `%gap%` name (V2 keeps that rule) and no stored verdict.
 *   V13 the plans (#289): `billing_plan` holds exactly the rows `data/billing-plans.ts` authors —
 *       same tiers, same intervals, same cents, same names, same `active` flag — and the table
 *       holds no row the fixture stopped authoring. This is what makes "the page and the database
 *       are one list" a check rather than a claim: the rows are seeded from the fixture, a
 *       surface renders the rows, and a hand-edited price fails here by name instead of becoming
 *       a charge nobody authored.
 *   V14 the re-invite's history (#275): `resent_at` and `resent_count` agree about whether the
 *       invitation was ever re-sent, and a reissue never predates the invitation it reissues —
 *       the two columns are one fact, and a row where they disagree cannot be measured against
 *       the cooldown or the cap. (Numbered after #289's V13, which landed first.)
 *   V15 the console's three columns (#289 follow-up, `0011_console_columns.sql`):
 *       `record.author_user_id`, `session.name` and `party.submitted_at` exist, are
 *       nullable and carry no DEFAULT — each is an absence until somebody writes it — and a seat
 *       carrying `submitted_at` has answered every Aspect of its instance, because "submitted"
 *       on a sheet with a blank line is the one state a support read would draw as done.
 *   V16 no table and no column in `public` is named like the old noun `instance` (#340): the
 *       split renamed the three objects that carried it (see `0013_relationship_sessions.sql`),
 *       and this is the standing guard, the same shape as V2's Gap guard, so a later migration
 *       that resurrects the noun fails here.
 *   V17 every session has a relationship (#340): `session.relationship_id` is the model's
 *       `NOT NULL` FK, and this re-states it on the rows — no session reads as its own
 *       relationship, no session points at a relationship that does not exist.
 *   V18 a scored session is immutable (#340): there is no `UPDATE` path against `session` or
 *       `opinion` anywhere in `lib/`, `scripts/` or `app/` — the rows a score is read from can
 *       be written once (the gated `INSERT` in `submitAnswers`) and never rewritten. **Two column
 *       sets are carved out.** An `UPDATE session` whose SET list is exactly `voided_at` and/or
 *       `voided_by` is legal (#503), because an operator's void adds an operator-state column that
 *       no score and no derivation over a score reads — `instanceStatusOf()` answers `voided`
 *       before it counts anything. An `UPDATE session` whose SET list is exactly `name` is legal
 *       (#278), because the deletion sweep must rewrite the free-text label so a survivor's session
 *       stops naming a person who deleted their account — `name` is the console's optional label
 *       and no derivation over answers reads it. The carve-outs are column lists, not table ones:
 *       an `UPDATE session SET mode = …`, `SET alignment_setting = …`, `SET template_record_id = …`
 *       or a SET list mixing an admitted column with anything else still fails here.
 *   V19 the membership's initiator (coach card): a relationship that has any member has exactly
 *       one `initiator` member — the backfill (0014) writes one for the bound Initiator, and a
 *       coach invited into a relationship with no initiator member is drift, not a relationship.
 *       A relationship with no members is the signed-out state (its parties never signed in),
 *       which is the only case this check deliberately does not require an initiator for.
 *   V20 the membership's coach (coach card): a relationship has at most one `coach` member. The
 *       unique key already forbids two identical accounts; this pins "one coach per relationship"
 *       on the rows so a second coach invited by hand is named, not assumed.
 *   V21 a **seeded** instance reads `complete` (#427/R2 follow-up): for every instance
 *       `data/assessments.ts` authors — the ids read from the fixture, never a list kept in this
 *       script — `instanceStatusOf()` over one SQL statement's counts (aspect count, both answered
 *       counts, both accepted counts, and whether a counterparty party row exists at all) answers
 *       `complete`. `db:seed` writes a seeded instance as a **finished** demo session, stamping
 *       `party.accepted_at` from the instance's own fixture date, so a seeded instance that reads
 *       `answering` is either a seed older than #427/R2 or a rule change that moved `complete` —
 *       the state production sat in for a day on 2026-11-03 while this file stayed green
 *       (`docs/RELEASING.md` 2a). V11 names the *mark* on a non-complete instance; this names the
 *       absence of completion itself. Instances the seed does not author are not checked: their
 *       status is their own.
 *   V22 `template_version` exists and carries its immutability trigger (#502b): a published version
 *       is a snapshot, so the guard is what makes "editing a template never mutates N" a property of
 *       the database rather than of the one write path that happens to be careful.
 *   V23 every relationship is bound to a version of **its own** template, and every version payload
 *       parses as `zAssessment` (#502b). The binding is what a party-facing read goes through, so an
 *       unbound row is a relationship whose template nobody can draw — the read answers 404 for it,
 *       which is correct and would otherwise be silent.
 *   V24 the inbound mail record (#439b): `email_event` exists with the `UNIQUE (provider_event_id)`
 *       constraint that makes a provider redelivery idempotent, its `payload` is `jsonb`, and
 *       `news_signup` carries the two marks (`bounced_at`, `complained_at`) a hard bounce and a
 *       complaint write. The marks are the column #507 reads before it sends, so a database
 *       migrated without `0027` is a request-time 500 on the first bounce; this names it instead.
 *
 *   V25 the support inbox (#506): `contact_message.status` exists, is `NOT NULL` and defaults to
 *       `new`, its four-word vocabulary CHECK is on the table, and `contact_reply` exists with the
 *       constraint that refuses a `sent` reply with no instant. A database migrated without `0028`
 *       is a request-time 500 on the first visit to `/admin/inbox`; a reply marked sent without a
 *       `sent_at` is the one thing the card forbids, so it is also checked row by row.
 *   V26 the broadcast's record (#507): `news_signup.unsubscribed_at` exists (the third consent
 *       mark), `broadcast_send` and `broadcast_recipient` exist, the recipient table carries the
 *       `PRIMARY KEY (broadcast_id, email)` that makes one address one row per send, and its
 *       `(email, created_at DESC)` index exists because the cooldown read is an existence test per
 *       candidate address. Numbered after #506's V25, which landed on `main` first.
 *   V27 no orphan profile (#278): every `user_profile.user_id` names a user `neon_auth` still has.
 *       `public` holds no foreign key to the managed schema on purpose (`0003`'s header), so a
 *       deletion that stopped half way — the auth user gone, the profile row left — is a row no
 *       constraint can refuse and no read notices: `/profile/<handle>` keeps resolving to a person
 *       who cannot sign in, and the handle stays taken. The sweep's own order makes this the one
 *       half-state it can leave, so it is the one this check names.
 *
 *       The seat half of the spec's §7 step-5 rule is **V10's**, not a second code here: V10 fails
 *       on any `party.user_id` the auth table does not have, which strictly contains "on a
 *       `complete` session". Two codes for one fact make a failure line ambiguous, the same reason
 *       V26 is not V25.
 *   V28 an unfinished deletion has an owner (#278 follow-up): no `account_deletion_job` row with
 *       `finished_at IS NULL` started more than `STUCK_DELETION_JOB_HOURS` (24 h) ago. #601 made a
 *       failed scrub resumable by writing `{user_id, email, names, roles}` down before the
 *       irreversible auth delete; V27 names the `user_profile` such an attempt can leave, but
 *       nothing named the row itself, so a scrub that failed and was never resumed kept an address
 *       `/privacy` calls "removed permanently" with no clock and no owner. The failure line names
 *       the `user_id` and the age, **never the address**: `db:verify` output is pasted into cards,
 *       logs and CI, and the row exists so an operator can find the id, not so the check can print
 *       the person.
 *   V29 the review store (#667): `review_artifact`, `review_todo`, `review_issue` and
 *       `review_issue_comment` exist, `review_issue` carries the `UNIQUE (artifact_id, number)`
 *       that makes an issue number trustworthy under two concurrent raisers, and **no issue is in
 *       the impossible state** — `state = 'closed'` with no `closed_at`, or `'open'` with one.
 *       `0037`'s CHECK refuses that pair at the insert and `zReviewIssue`'s refinement refuses it
 *       on the read, so this rule is the third guard and the only one that *names* the row: a
 *       database whose constraint was dropped by hand, or one migrated halfway, still has a reader
 *       who will believe the list. The duplicate-number half is here for the same reason — the
 *       constraint makes it impossible, and a rule that only checks what is already impossible is
 *       how the constraint's absence goes unnoticed.
 *
 * Exit 1 with a named failure per violation, like the `data:check` E-codes; exit 0 with a count.
 */
import { Client } from "pg";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, repoRoot, writeDatabaseUrl } from "./load-env.mjs";

const CONTENT_TABLES = [
  "record",
  "item",
  "response_option",
  "session",
  "party",
  "opinion",
  "relationship",
];

const problems = [];
const fail = (code, message) => problems.push({ code, message });

/**
 * The only columns an `UPDATE session` may set (#503): an operator's void, and nothing else.
 *
 * The V18 carve-out below is a **column** allowlist, so the rule keeps its teeth on the columns a
 * score is read from (`mode`, `alignment_setting`, `template_record_id`). `voided_at` and
 * `voided_by` are operator state: `instanceStatusOf()` answers `voided` before it counts an answer,
 * and no derivation over scores reads either column.
 */
const VOID_COLUMNS = new Set(["voided_at", "voided_by"]);

/**
 * The deletion sweep's one write to `session` (#278): its optional **label**.
 *
 * `docs/ACCOUNT-DELETION-SPEC.md` §1.2 requires the label to be rewritten, because it is free text
 * a person wrote (`"Run for Avery Rowan"`) and no `user_id` sweep reaches it — leaving it is leaving
 * the deleted person's name on the survivor's session. It is not a score column: `name` is the
 * console's optional label (`0011`), read by `/assessment/instances` and by no derivation over
 * answers. So it gets a carve-out of its own rather than a place in `VOID_COLUMNS`, and the
 * permitted line below says which of the two admitted this statement.
 */
const LABEL_COLUMNS = new Set(["name"]);

/**
 * V18's scan: find every `UPDATE` statement that targets the `session` or `opinion` table in the
 * shipped source (`lib/`, `scripts/`, `app/`). A scored session is immutable, so neither table may
 * be UPDATEd — a score is written once by the gated INSERT in `submitAnswers` and never rewritten.
 *
 * Comments are stripped before matching, so a doc comment that explains *why* there is no such
 * statement (including this one) cannot trip its own check. The return value carries the census
 * (`files` scanned), every `{ file, line, table }` violation, and every `{ file, line, columns }`
 * statement the #503 carve-out admitted, so the caller can name both.
 */
function scanForUpdatePaths() {
  const roots = ["lib", "scripts", "app"].map((dir) => join(repoRoot, dir));
  const exts = new Set([".ts", ".tsx", ".mjs", ".mts"]);
  const skip = new Set([".next", ".datacheck", "node_modules"]);
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walk(join(dir, entry.name));
      } else if (exts.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
        files.push(join(dir, entry.name));
      }
    }
  };
  for (const root of roots) walk(root);

  // `UPDATE session` (or `ONLY`, or `public.`-qualified) and the same for `opinion`. `\b` after
  // the table name means `session_invite` is not caught — the invitation's own UPDATEs are legal.
  const pattern = /\bUPDATE\s+(?:ONLY\s+)?(?:public\.)?(session|opinion)\b/gi;
  const violations = [];
  const allowed = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const match of stripped.matchAll(pattern)) {
      const line = stripped.slice(0, match.index).split("\n").length;
      // The statement as written, from the keyword to the end of the literal that holds it — a
      // template literal or a quoted string closes on its own quote, so the tail cannot run into
      // the next statement and read a second UPDATE's columns as this one's.
      const tail = stripped.slice(match.index);
      const close = tail.slice(1).search(/[`"]/);
      const statement = (close === -1 ? tail : tail.slice(0, close + 1)).split(/\bWHERE\b/i)[0];
      const setColumns = [...statement.matchAll(/\b([a-z_][a-z0-9_]*)\s*=/gi)].map((assign) =>
        assign[1].toLowerCase(),
      );
      // #503 / #278 — the two legal `UPDATE session` statements: an operator's void (a SET list
      // wholly of the void pair) and the deletion sweep's label rewrite (exactly `name`). Anything
      // else — `mode`, `alignment_setting`, `template_record_id`, a mixed list — stays a violation.
      const isSession = match[1].toLowerCase() === "session";
      const isVoid =
        setColumns.length > 0 && setColumns.every((column) => VOID_COLUMNS.has(column));
      const isLabel =
        setColumns.length === 1 && setColumns.every((column) => LABEL_COLUMNS.has(column));
      if (isSession && (isVoid || isLabel)) {
        allowed.push({
          file,
          line,
          columns: setColumns,
          why: isVoid ? "an operator's void (#503)" : "the deletion sweep's label rewrite (#278)",
        });
        continue;
      }
      violations.push({ file, line, table: match[1] });
    }
  }
  return { files: files.length, violations, allowed };
}

/* ------------------------------------------------------------------ *\
 * V21 — a seeded instance reads `complete`
 * ------------------------------------------------------------------ */

/**
 * The one statement V21 reads — one row per authored instance, carrying exactly the counts
 * `instanceStatusOf()` asks for.
 *
 * `db:seed` writes a seeded instance as a **finished** demo session: every Aspect answered on both
 * seats, and `party.accepted_at` stamped from the instance's own fixture date (`scripts/db-seed.mjs`,
 * the `INSERT INTO party (… accepted_at)` in `seedInstance`). Acceptance is half of the `complete`
 * derivation since #427/R2, so every fixture instance must derive `complete` in a database the seed
 * has built.
 *
 * The `LEFT JOIN party` is what keeps a missing seat from both crashing the check and vanishing
 * from it: an instance with no party row still comes back (every count 0), so the caller can name
 * it as drift instead of reading "no row" as "not an instance".
 */
const SEEDED_STATUS_SQL = `
  SELECT ai.record_id,
         r.slug,
         (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id)::int AS aspect_count,
         count(*) FILTER (WHERE p.role = 'initiator')::int AS initiators,
         count(*) FILTER (WHERE p.role = 'counterparty')::int AS counterparties,
         count(*) FILTER (WHERE p.role = 'initiator' AND p.accepted_at IS NOT NULL)::int
           AS initiator_accepted,
         count(*) FILTER (WHERE p.role = 'counterparty' AND p.accepted_at IS NOT NULL)::int
           AS counterparty_accepted,
         (SELECT count(*) FROM opinion o
           WHERE o.session_record_id = ai.record_id AND o.role = 'initiator')::int
           AS initiator_answered,
         (SELECT count(*) FROM opinion o
           WHERE o.session_record_id = ai.record_id AND o.role = 'counterparty')::int
           AS counterparty_answered
    FROM session ai
    JOIN record r ON r.id = ai.record_id
    LEFT JOIN party p ON p.session_record_id = ai.record_id
   WHERE ai.record_id = ANY($1::text[])
   GROUP BY ai.record_id, r.slug
   ORDER BY r.slug`;

/**
 * What is missing from an instance that is not `complete`, in the words of the row it is missing.
 *
 * `instanceStatusOf()` answers one word; the reader needs the fact under it, because the repair
 * differs — a NULL `accepted_at` is `docs/RELEASING.md` 2a's stamp, an unanswered Aspect is a
 * missing `opinion` row, and an absent party row is a seed that never wrote the seat. Named per
 * seat so a half-written instance does not read as "the seed did not run".
 */
function seededStatusDetail(row) {
  const details = [];
  if (row.initiators === 0) details.push("it has no initiator party row");
  if (row.counterparties === 0) details.push("it has no counterparty party row");
  if (row.aspect_count === 0) {
    details.push("its copy holds no Aspect");
  } else {
    if (row.initiator_answered < row.aspect_count) {
      details.push(
        `the initiator answered ${row.initiator_answered} of ${row.aspect_count} Aspect(s)`,
      );
    }
    if (row.counterparty_answered < row.aspect_count) {
      details.push(
        `the counterparty answered ${row.counterparty_answered} of ${row.aspect_count} Aspect(s)`,
      );
    }
  }
  if (row.initiator_accepted === 0) details.push("the initiator's party.accepted_at is NULL");
  if (row.counterparty_accepted === 0) details.push("the counterparty's party.accepted_at is NULL");
  return details.join("; ");
}

/**
 * V27 over two id lists — the whole rule, so a test can drive it with no database.
 *
 * `profileIds` is every `public.user_profile.user_id`; `authIds` is every id in
 * `neon_auth."user"`. A profile whose account is gone is the half-deleted state
 * `docs/ACCOUNT-DELETION-SPEC.md` §7 step 5 names: the sweep deletes the auth user first, so a
 * scrub that then failed leaves exactly this row, and the public profile URL keeps resolving.
 */
export function orphanProfileProblems(profileIds, authIds) {
  const known = new Set(authIds);
  const problems = [];
  for (const userId of profileIds) {
    if (known.has(userId)) continue;
    problems.push({
      code: "V27",
      message: `public.user_profile carries "${userId}", which neon_auth has no user for — a deleted account's profile survived the sweep, so /profile/<handle> still resolves to a person who cannot sign in`,
    });
  }
  return problems;
}

/**
 * The age at which an unfinished deletion stops reading as "in flight" (#278 follow-up).
 *
 * A scrub is one transaction over the rows one account owns: seconds, not hours. The failure V28
 * watches for is therefore not a **slow** scrub but an **abandoned** one — the person's session
 * dies with their auth user, so nothing in the product retries it and only an operator can (§7,
 * "When the scrub does not land"). 24 h is picked for both ends of that gap:
 *
 *   - **not a false alarm.** No measured scrub, retry, deploy restart or overnight gap reaches it;
 *     the window is orders of magnitude longer than the operation, so a line here always means
 *     "nobody is coming", not "busy right now". A detector that fires on a normal window is a
 *     detector whose output gets scrolled past.
 *   - **not a permanent silence.** The row holds an address `/privacy` says is "removed
 *     permanently". Within one day of the deletion that address either has an operator resuming it
 *     or a named failure — long enough to be honest, short enough that the promise and the check
 *     still point at the same week.
 *
 * It is a detector's number, not a retention rule: nothing deletes a row because of it (§6 keeps
 * the row until it is resumed, and deleting it would destroy the only copy of the address the
 * sweep keys on).
 */
export const STUCK_DELETION_JOB_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/**
 * V28 over the table's open rows — the whole rule, so a test can drive it with no database.
 *
 * `jobs` is every `account_deletion_job` row with `finished_at IS NULL` as `pg` returns it
 * (`user_id`, `started_at`, `finished_at`). The message names the **id** and the age and never
 * `email`: this output is pasted into cards, issue threads and CI logs, and the row exists so an
 * operator can act on an id. A check that prints the address would leak the very fact it reports.
 */
export function stuckDeletionJobProblems(jobs, now = Date.now()) {
  const cutoff = now - STUCK_DELETION_JOB_HOURS * HOUR_MS;
  const problems = [];
  for (const job of jobs) {
    if (job.finished_at !== null && job.finished_at !== undefined) continue;
    const startedAt = new Date(job.started_at).getTime();
    // A `started_at` the driver could not parse is not evidence of age; `started_at` is NOT NULL
    // with a DEFAULT and `TIMESTAMPTZ`, so this is unreachable on a migrated database.
    if (!Number.isFinite(startedAt) || startedAt > cutoff) continue;
    const hours = Math.floor((now - startedAt) / HOUR_MS);
    problems.push({
      code: "V28",
      message: `account_deletion_job has an unfinished deletion for "${job.user_id}" started ${hours} h ago — the auth user is gone and the sweep never landed, so the address recorded with it is still retained with no owner: resume it (docs/ACCOUNT-DELETION-SPEC.md §7)`,
    });
  }
  return problems;
}

/**
 * V29 over `review_issue`'s rows — the whole rule, so a test can drive it with no database.
 *
 * Three facts, and each one is a different way the list stops being trustworthy:
 *
 *   the pair          `closed` with no `closed_at` cannot be aged; `open` with one was reopened
 *                     and forgot. `0037`'s CHECK refuses both at the insert and `zReviewIssue`
 *                     refuses them on the read, so a row here means the constraint is gone —
 *                     which is exactly the state a reader would still believe.
 *   the vocabulary    a `state` outside `open`/`closed` is drift the CHECK also refuses.
 *   the number        two issues sharing a number inside one artifact makes `#12 open` ambiguous,
 *                     and the `UNIQUE (artifact_id, number)` is what prevents it. Repeated here
 *                     because the constraint's absence is otherwise invisible until somebody
 *                     quotes a number and lands on the wrong conversation.
 *
 * The failure line names the artifact and the number, never the body: this output is pasted into
 * cards and CI, and a review issue can carry a client's words.
 */
export function reviewIssueProblems(issues) {
  const problems = [];
  const seen = new Map();
  for (const issue of issues) {
    const closed = issue.closed_at !== null && issue.closed_at !== undefined;
    const ref = `${issue.artifact_id} #${issue.number}`;
    if (issue.state !== "open" && issue.state !== "closed") {
      problems.push({
        code: "V29",
        message: `review_issue "${issue.id}" (${ref}) carries state "${issue.state}" — the store's vocabulary is open|closed, so the list cannot say what it is`,
      });
    } else if (issue.state === "closed" && !closed) {
      problems.push({
        code: "V29",
        message: `review_issue "${issue.id}" (${ref}) reads closed with no closed_at — the instant is what makes a closed issue ageable, and 0037's review_issue_state_pair refuses this pair (run \`pnpm db:migrate\` if the constraint is missing)`,
      });
    } else if (issue.state === "open" && closed) {
      problems.push({
        code: "V29",
        message: `review_issue "${issue.id}" (${ref}) reads open and carries closed_at ${issue.closed_at} — reopening clears the instant in the same statement; a row with both says two things at once`,
      });
    }
    const numbers = seen.get(issue.artifact_id) ?? new Set();
    if (numbers.has(issue.number)) {
      problems.push({
        code: "V29",
        message: `review_issue (${ref}) has two rows with the same number — every quote of "#${issue.number}" is ambiguous, which is what UNIQUE (artifact_id, number) exists to prevent`,
      });
    }
    numbers.add(issue.number);
    seen.set(issue.artifact_id, numbers);
  }
  return problems;
}

/**
 * V21 over the fixture's own ids — the whole check, and the only part of this script that does not
 * iterate `listAssessmentInstances()`.
 *
 * **Only the instances `data/assessments.ts` authors are checked**, and the ids are read from the
 * fixture on every run: production also holds instances people created in the app
 * (`staff-manager-61cca238`, `relationship-basics-copy-94c15cc5` were measured `answering`), and
 * their status is theirs to be in. The status comes from the product's own `instanceStatusOf()`,
 * so a rule change that moved `complete` shows up here as a violation rather than as four demo
 * sessions nobody can open.
 *
 * An authored instance this database does not hold **at all** is not a seeded instance reading
 * wrongly — it is a branch the seed has not built yet, which `docs/DEMO.md` records as a green
 * state an emptied demo branch is allowed to be in. It is counted as absent and not failed.
 *
 * Takes any client-shaped object with `query(text, values)`, so the test can drive every branch
 * with no database (`tests/db-verify-seeded-complete.test.ts`).
 */
export async function seededInstanceStatusProblems(client, authoredInstances) {
  const problems = [];
  const authored = authoredInstances.map((instance) => ({ id: instance.id, slug: instance.slug }));
  if (authored.length === 0) return { problems, complete: 0, authored: 0 };

  const { instanceStatusOf } = await import("@/lib/flow/state.ts");
  const { rows } = await client.query(SEEDED_STATUS_SQL, [authored.map((instance) => instance.id)]);
  const rowById = new Map(rows.map((row) => [row.record_id, row]));
  let complete = 0;

  for (const instance of authored) {
    const row = rowById.get(instance.id);
    if (row === undefined) continue;
    const status = instanceStatusOf({
      aspectCount: row.aspect_count,
      hasCounterparty: row.counterparties >= 1,
      initiatorAnswered: row.initiator_answered,
      counterpartyAnswered: row.counterparty_answered,
      initiatorAccepted: row.initiator_accepted,
      counterpartyAccepted: row.counterparty_accepted,
    });
    if (status === "complete") {
      complete += 1;
      continue;
    }
    problems.push({
      code: "V21",
      message: `seeded instance "${row.slug ?? instance.slug}" reads "${status}" — db:seed writes a finished session, and ${seededStatusDetail(row)}`,
    });
  }

  return { problems, complete, authored: authored.length };
}

async function main() {
  loadEnv();
  const {
    listAssessmentInstances,
    readAssessmentInstanceRowsBySlug,
    readAssessmentTemplateRowsById,
  } = await import("@/lib/db/assessments.ts");
  const {
    assessmentInstanceFromRows,
    assessmentTemplateFromPayload,
    assessmentTemplateFromRows,
    copyDriftProblems,
    itemIdsOf,
  } = await import("@/lib/db/rows.ts");
  const { instanceStatusOf } = await import("@/lib/flow/state.ts");

  // The SQL checks run on the unpooled URL, like the writes; the data-layer reads use the
  // runtime pool, which is the path the page takes.
  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "db:verify",
  });
  await client.connect();
  try {
    const { rows: tables } = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
    );
    const present = tables.map((row) => row.tablename);
    const missing = CONTENT_TABLES.filter((table) => !present.includes(table));
    for (const table of missing)
      fail("V1", `public.${table} does not exist — run \`pnpm db:migrate\``);

    const { rows: gapColumns } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%gap%' ORDER BY table_name, column_name`,
    );
    for (const column of gapColumns) {
      fail(
        "V2",
        `public.${column.table_name}.${column.column_name} names a Gap — it is gapOf(), never a column`,
      );
    }

    // V16 — the old noun, the same standing guard as V2 (#340). No table and no column in
    // `public` may be named like `instance` after the split; a later migration that resurrects
    // the noun fails here, by name, rather than shipping a second schema.
    const { rows: instanceTables } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name ILIKE '%instance%' ORDER BY table_name`,
    );
    const { rows: instanceColumns } = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name ILIKE '%instance%' ORDER BY table_name, column_name`,
    );
    for (const table of instanceTables) {
      fail(
        "V16",
        `public.${table.table_name} names the old noun — the model is a relationship holding sessions`,
      );
    }
    for (const column of instanceColumns) {
      fail(
        "V16",
        `public.${column.table_name}.${column.column_name} names the old noun — it is session_record_id now`,
      );
    }

    // V18 — a scored session is immutable (#340): no UPDATE path against the two tables a score
    // is read from. Scanned over the source the gate ships, not the live database, because
    // "there is no UPDATE statement" is a fact about the code, not the rows. An UPDATE against
    // the `session` or `opinion` tables would rewrite a scored row; the gated INSERT in
    // `submitAnswers`, the unlock-mark write on `party` and the reissue on the invitation table
    // are all on other tables and pass. The census line proves the scan looked.
    const updatePaths = scanForUpdatePaths();
    for (const violation of updatePaths.violations) {
      fail(
        "V18",
        `${violation.file}:${violation.line} UPDATEs \`${violation.table}\` — a scored session is immutable`,
      );
    }
    // The carve-out is named on every run, so "no UPDATE path" is never claimed while one exists:
    // the line and the columns are printed beside the census, exactly as V18's zero would be.
    for (const permitted of updatePaths.allowed) {
      console.log(
        `  V18 permitted: ${permitted.file}:${permitted.line} UPDATEs session (${permitted.columns.join(", ")}) — ${permitted.why}`,
      );
    }

    // V17 — every session has a relationship (#340). The column is `NOT NULL` with an FK, so the
    // structural guarantee is in the schema; this re-states it on the rows so a drift is named
    // rather than assumed. Checked beside V11/V12 for the same reason: on a database migrated
    // before 0013 the read would fail with a missing column instead of this check naming the fix.
    const { rows: relationshipColumn } = await client.query(
      `SELECT 1 AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'session'
          AND column_name = 'relationship_id'`,
    );
    const hasRelationshipColumn = relationshipColumn.length > 0;
    if (!hasRelationshipColumn) {
      fail(
        "V17",
        "public.session.relationship_id does not exist — a session has no relationship (run `pnpm db:migrate`)",
      );
    }
    let relationshipOrphans = 0;
    if (hasRelationshipColumn && present.includes("relationship")) {
      const { rows: orphans } = await client.query(
        `SELECT s.record_id FROM session s
          LEFT JOIN relationship r ON r.id = s.relationship_id
         WHERE r.id IS NULL ORDER BY s.record_id`,
      );
      for (const row of orphans) {
        relationshipOrphans += 1;
        fail("V17", `session "${row.record_id}" points at a relationship that does not exist`);
      }
    }

    // V19 + V20 — the membership's two invariants (coach card). The rows are grouped per
    // relationship and each is named rather than assumed: a relationship with members must have
    // exactly one initiator member (the backfill's one), and no relationship may hold two coaches.
    // Guarded on the table's existence so a database migrated before 0014 fails with the fix named
    // rather than with a missing-table read.
    let memberRelationshipsChecked = 0;
    if (present.includes("relationship_member")) {
      const { rows: memberCounts } = await client.query(
        `SELECT relationship_id,
                count(*)::int AS members,
                count(*) FILTER (WHERE role = 'initiator')::int AS initiators,
                count(*) FILTER (WHERE role = 'coach')::int AS coaches
           FROM relationship_member
          GROUP BY relationship_id
          ORDER BY relationship_id`,
      );
      for (const row of memberCounts) {
        memberRelationshipsChecked += 1;
        if (row.members > 0 && row.initiators !== 1) {
          fail(
            "V19",
            `relationship "${row.relationship_id}" has ${row.initiators} initiator member(s) across ${row.members} member(s) — exactly one initiator`,
          );
        }
        if (row.coaches > 1) {
          fail(
            "V20",
            `relationship "${row.relationship_id}" has ${row.coaches} coach members — at most one`,
          );
        }
      }
    } else {
      fail("V19", "public.relationship_member does not exist — run `pnpm db:migrate`");
    }

    // V11 — the column the unlock marker writes (#252). Checked before the per-instance loop
    // because a database migrated before #252 has no place to put the mark, and the list would
    // then read a missing column on every request instead of this check naming the fix.
    const { rows: unlockColumn } = await client.query(
      `SELECT 1 AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'party'
          AND column_name = 'unlock_seen_at'`,
    );
    if (unlockColumn.length === 0) {
      fail(
        "V11",
        "public.party.unlock_seen_at does not exist — the unlock marker cannot be written (run `pnpm db:migrate`)",
      );
    }
    const hasUnlockColumn = unlockColumn.length > 0;

    // V12 — the Setting's column (#259). Checked beside V11 and for the same reason: the read
    // path selects `ai.alignment_setting`, so on a database migrated before 0008 every instance
    // read would fail with a missing column instead of this check naming the fix.
    const { rows: settingColumn } = await client.query(
      `SELECT 1 AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'session'
          AND column_name = 'alignment_setting'`,
    );
    if (settingColumn.length === 0) {
      fail(
        "V12",
        "public.session.alignment_setting does not exist — the Setting cannot be read (run `pnpm db:migrate`)",
      );
    }
    const hasSettingColumn = settingColumn.length > 0;

    // V15 — the console's three columns (#289 follow-up). Checked beside V11/V12 and for the same
    // reason: the instance read selects `ai.name` and the party read carries `submitted_at`, so a
    // database migrated before 0011 fails the read instead of this check naming the fix.
    //
    // Nullability and the *absence* of a DEFAULT are part of the claim, not decoration: every one
    // of these three is an absence until a person writes it (no author = the platform's template,
    // no name = the template's title, no instant = nobody recorded when), so a NOT NULL or a
    // defaulted column would be a backfilled value a reader could not tell from an authored one.
    const CONSOLE_COLUMNS = [
      { table: "record", column: "author_user_id", type: "text" },
      { table: "session", column: "name", type: "text" },
      { table: "party", column: "submitted_at", type: "timestamp with time zone" },
    ];
    const { rows: consoleColumns } = await client.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN
              (('record', 'author_user_id'),
               ('session', 'name'),
               ('party', 'submitted_at'))`,
    );
    const consoleColumnOf = new Map(
      consoleColumns.map((column) => [`${column.table_name}.${column.column_name}`, column]),
    );
    let consoleColumnsChecked = 0;
    /** Parties carrying an instant; counted so the verdict line proves the check looked. */
    let submittedSeats = 0;
    for (const expected of CONSOLE_COLUMNS) {
      const name = `${expected.table}.${expected.column}`;
      const actual = consoleColumnOf.get(name);
      if (actual === undefined) {
        fail(
          "V15",
          `public.${name} does not exist — the console cannot read it (run \`pnpm db:migrate\`)`,
        );
        continue;
      }
      if (actual.is_nullable !== "YES") {
        fail("V15", `public.${name} is NOT NULL — it is an absence until somebody writes it`);
      }
      if (actual.column_default !== null) {
        fail(
          "V15",
          `public.${name} carries DEFAULT ${actual.column_default} — a default is a backfilled value no reader can tell from an authored one`,
        );
      }
      if (actual.data_type !== expected.type) {
        fail("V15", `public.${name} is ${actual.data_type}, not ${expected.type}`);
      }
      consoleColumnsChecked += 1;
    }
    const hasSubmittedAt = consoleColumnOf.has("party.submitted_at");

    if (missing.length > 0 || !hasSettingColumn) return;

    const instances = await listAssessmentInstances();
    let templatesChecked = 0;

    // V12 — the Setting's vocabulary and the fixture parity (#259). The fixture map is
    // `data/assessments.ts` itself, not a list copied into this script: a setting written by
    // `db:seed` and a setting authored in the fixture are the same value or they are drift.
    const { assessmentInstances: authoredInstances } = await import("@/data/assessments.ts");
    const authoredSettingOf = new Map(
      authoredInstances.map((instance) => [instance.id, instance.setting]),
    );
    const { rows: badSettings } = await client.query(
      `SELECT r.slug, ai.alignment_setting
         FROM session ai
         JOIN record r ON r.id = ai.record_id
        WHERE ai.alignment_setting NOT IN ('soft', 'full')
        ORDER BY r.slug`,
    );
    for (const row of badSettings) {
      fail(
        "V12",
        `instance "${row.slug}" carries Setting "${row.alignment_setting}" — one of soft, full`,
      );
    }
    const settingsChecked = [];

    for (const listed of instances) {
      const rows = await readAssessmentInstanceRowsBySlug(listed.slug);
      if (rows === undefined) {
        fail("V3", `instance "${listed.slug}" is listed but has no readable record row`);
        continue;
      }

      const templateRows = await readAssessmentTemplateRowsById(listed.templateRecordId);
      if (templateRows === undefined) {
        fail(
          "V3",
          `instance "${listed.slug}" names template "${listed.templateRecordId}", which is not a template record`,
        );
      } else {
        templatesChecked += 1;
        // The working copy must still be a template the model accepts — an edit that broke it is
        // drift whether or not it was ever published.
        try {
          assessmentTemplateFromRows(templateRows);
        } catch (error) {
          fail("V7", error.message);
        }
      }

      /* V4 — the copy equals the version the relationship is bound to (#502b).
       *
       * Not the template's `item` rows: an edit to a published template writes the working copy and
       * touches no version, so comparing a copy to the working copy would report every such edit as
       * drift — which is exactly the false alarm that made #502a refuse to edit at all. The version
       * is what the page reads (`lib/db/assessments.ts::SCREEN_BY_SLUG_SQL`), so it is what the
       * copy must equal.
       */
      const { rows: binding } = await client.query(
        `SELECT rel.template_version_id, tv.template_record_id, tv.payload
           FROM session ai
           JOIN relationship rel ON rel.id = ai.relationship_id
           LEFT JOIN template_version tv ON tv.id = rel.template_version_id
          WHERE ai.record_id = $1`,
        [listed.recordId],
      );
      const bound = binding[0];
      if (bound === undefined || bound.template_version_id === null) {
        fail(
          "V23",
          `instance "${listed.slug}" belongs to a relationship with no template_version_id — there is no version to compare its copy with`,
        );
      } else if (bound.template_record_id !== listed.templateRecordId) {
        fail(
          "V23",
          `instance "${listed.slug}" is bound to a version of "${bound.template_record_id}", not of the template it names ("${listed.templateRecordId}")`,
        );
      } else {
        try {
          const offered = assessmentTemplateFromPayload(
            bound.payload,
            `template version "${bound.template_version_id}"`,
          );
          for (const problem of copyDriftProblems({
            instanceId: listed.recordId,
            templateId: bound.template_version_id,
            copyIds: itemIdsOf(rows.items),
            templateIds: offered.items.map((item) => item.id),
          })) {
            fail("V4", problem);
          }
        } catch (error) {
          fail("V23", error.message);
        }
      }

      const { rows: partyCounts } = await client.query(
        `SELECT role, count(*)::int AS n FROM party WHERE session_record_id = $1 GROUP BY role ORDER BY role`,
        [listed.recordId],
      );
      const byRole = new Map(partyCounts.map((row) => [row.role, row.n]));
      const initiators = byRole.get("initiator") ?? 0;
      const counterparties = byRole.get("counterparty") ?? 0;

      // #146: an instance can now be mid-flow. A **flow** instance (one with an invite row)
      // has no Counterparty until the invitation is claimed, and needs one the moment it is;
      // a **fixture** instance (seeded from `data/assessments.ts`, no invite row) must have
      // both parties as it always did. The status comes from the rows, not a column —
      // `instanceStatusOf()` is the same function the screen uses.
      const { rows: inviteRows } = await client.query(
        `SELECT claimed_at, expires_at > created_at AS sane_window,
                token_hash ~ '^[0-9a-f]{64}$' AS hashed,
                resent_at IS NULL AS never_resent,
                resent_count,
                (resent_at IS NULL) = (resent_count = 0) AS resent_consistent,
                resent_at IS NULL OR resent_at >= created_at AS resent_after_creation
           FROM session_invite WHERE session_record_id = $1`,
        [listed.recordId],
      );
      const invite = inviteRows[0];

      if (initiators !== 1) {
        fail("V5", `instance "${listed.slug}" has ${initiators} initiator(s) — exactly one`);
      }
      if (counterparties > 1) {
        fail(
          "V5",
          `instance "${listed.slug}" has ${counterparties} counterparty(ies) — at most one`,
        );
      }
      if (invite === undefined && counterparties !== 1) {
        fail(
          "V5",
          `instance "${listed.slug}" has ${initiators} initiator(s) and ${counterparties} counterparty(ies) — exactly one of each`,
        );
      }
      if (invite !== undefined && invite.claimed_at !== null && counterparties !== 1) {
        fail(
          "V5",
          `instance "${listed.slug}": the invitation is claimed but ${counterparties} counterparty party row(s) exist — a claim binds exactly one`,
        );
      }
      if (invite !== undefined && !invite.hashed) {
        fail(
          "V8",
          `instance "${listed.slug}": session_invite.token_hash is not a SHA-256 hex digest — the raw token must never be stored`,
        );
      }
      if (invite !== undefined && !invite.sane_window) {
        fail("V8", `instance "${listed.slug}": the invitation expires before it was created`);
      }
      // V14 — the re-invite's two columns (#275). They are one fact recorded twice — "a re-invite
      // happened" — so a row where they disagree is drift no screen can draw honestly: a count
      // with no instant cannot be measured against the cooldown, and an instant with a zero count
      // says the token was reissued without ever counting it against the cap. V13 is #289's plan
      // check, which landed while this card was open.
      if (invite !== undefined && !invite.resent_consistent) {
        fail(
          "V14",
          `instance "${listed.slug}": session_invite.resent_at and resent_count disagree about whether the invitation was re-sent (resent_at null=${invite.never_resent}, count=${invite.resent_count})`,
        );
      }
      if (invite !== undefined && !invite.resent_after_creation) {
        fail("V14", `instance "${listed.slug}": the invitation was re-sent before it was created`);
      }

      const { rows: answerCounts } = await client.query(
        `SELECT p.role,
                (SELECT count(*) FROM opinion o
                  WHERE o.session_record_id = p.session_record_id
                    AND o.role = p.role)::int AS answered,
                (p.accepted_at IS NOT NULL) AS accepted
           FROM party p WHERE p.session_record_id = $1`,
        [listed.recordId],
      );
      const answeredBy = (role) => answerCounts.find((row) => row.role === role)?.answered ?? 0;
      // #R2 — acceptance is the completion hinge, so the status this check reads is the same
      // derivation the screen reads, acceptances included. Omitting them here would call every
      // seeded instance `answering` and fail V11 on a marker that is perfectly legitimate.
      const acceptedBy = (role) =>
        answerCounts.find((row) => row.role === role)?.accepted === true ? 1 : 0;
      const status = instanceStatusOf({
        aspectCount: rows.items.length,
        hasCounterparty: counterparties === 1,
        initiatorAnswered: answeredBy("initiator"),
        counterpartyAnswered: answeredBy("counterparty"),
        initiatorAccepted: acceptedBy("initiator"),
        counterpartyAccepted: acceptedBy("counterparty"),
      });

      // V11 — the mark (#252). `party.unlock_seen_at` is written when a party opens a COMPLETE
      // instance, so a value on an unfinished one was written too early: the row would read
      // "already seen" the moment it became complete, and the unlocking event would pass in
      // silence.
      //
      // `complete` is terminal per *writer* and per *product row set* — `markUnlockSeen` only ever
      // runs against a complete screen, and no product path deletes an `opinion` row (V18 keeps
      // scored rows immutable; a seed or a manual DELETE is the other way a mark gets stranded) —
      // but it is **not** terminal per *rule*. #427/R2 made acceptance the hinge, and an instance
      // that was complete when its mark was written read `answering` afterwards: avery-rowan on
      // production carried a mark from 2026-11-02T08:42Z, three hours before that merge. So this
      // check names a real defect either way, and the repair is the mark (docs/RELEASING.md
      // §"main → production", 2a), never the instance — a rule change is a data event, and this is
      // the check that finds it.
      if (hasUnlockColumn && status !== "complete") {
        const { rows: premature } = await client.query(
          `SELECT role FROM party
            WHERE session_record_id = $1 AND unlock_seen_at IS NOT NULL
            ORDER BY role`,
          [listed.recordId],
        );
        for (const row of premature) {
          fail(
            "V11",
            `instance "${listed.slug}" (${status}): the ${row.role}'s unlock_seen_at is set, but the instance is not complete — the marker would never show`,
          );
        }
      }

      // V15 — a seat carrying `p.submitted_at` has answered every Aspect of its instance
      // (`0011_console_columns.sql`). One-directional on purpose: the seeded parties answered
      // before the column existed and carry NULL, which is "we do not know when", never "not
      // answered". The reverse (answered ⇏ submitted) is history, not drift.
      if (hasSubmittedAt && rows.items.length > 0) {
        const { rows: submitted } = await client.query(
          `SELECT p.role, p.submitted_at,
                  EXISTS (
                    SELECT 1 FROM item i
                     WHERE i.record_id = p.session_record_id
                       AND NOT EXISTS (
                         SELECT 1 FROM opinion o
                          WHERE o.session_record_id = p.session_record_id
                            AND o.role = p.role
                            AND o.item_id = i.item_id)) AS has_open_lines
             FROM party p
            WHERE p.session_record_id = $1 AND p.submitted_at IS NOT NULL
            ORDER BY p.role`,
          [listed.recordId],
        );
        for (const row of submitted) {
          submittedSeats += 1;
          if (row.has_open_lines) {
            fail(
              "V15",
              `instance "${listed.slug}": the ${row.role} is marked submitted at ${new Date(row.submitted_at).toISOString()} but has not answered every Aspect`,
            );
          }
        }
      }

      // V12 — a seeded row still says what its fixture authors (#259). The DEFAULT on the
      // column makes a migrated database *look* right; only comparing against
      // `data/assessments.ts` proves which setting a seeded instance actually plays under.
      const authored = authoredSettingOf.get(listed.recordId);
      if (authored !== undefined) {
        if (rows.instance.setting !== authored) {
          fail(
            "V12",
            `instance "${listed.slug}" carries Setting "${rows.instance.setting}", but data/assessments.ts authors "${authored}" (run \`pnpm db:seed\`)`,
          );
        }
        settingsChecked.push({ slug: listed.slug, setting: rows.instance.setting });
      }

      // A fixture instance is answered in full by construction, and a **complete** flow
      // instance has to be; an unfinished one is the flow working, not drift.
      const mustBeComplete = invite === undefined || status === "complete";

      if (mustBeComplete) {
        const { rows: unanswered } = await client.query(
          `SELECT p.role, i.item_id
             FROM party p
             JOIN item i ON i.record_id = p.session_record_id
             LEFT JOIN opinion o
               ON o.session_record_id = p.session_record_id
              AND o.role = p.role
              AND o.item_id = i.item_id
            WHERE p.session_record_id = $1 AND o.item_id IS NULL
            ORDER BY p.role, i.position`,
          [listed.recordId],
        );
        for (const row of unanswered) {
          fail(
            "V6",
            `instance "${listed.slug}" (${status}): ${row.role} does not answer Aspect "${row.item_id}"`,
          );
        }

        try {
          assessmentInstanceFromRows(rows);
        } catch (error) {
          fail("V7", error.message);
        }
      }
    }

    // V21 — the fixture's own instances read `complete` (#427/R2 follow-up). The one check here
    // that does not iterate `listAssessmentInstances()`: production also holds instances people
    // created in the app, and an `answering` one of those is a person mid-flow, not drift. The ids
    // come from `data/assessments.ts` (imported above for V12), so the check follows the fixture
    // rather than a copy of it. A seeded instance that is not `complete` is either a seed older
    // than #427/R2's acceptance stamp or a rule change that moved `complete` — on 2026-11-03 all
    // four sat in `answering` for a day while every other check in this file was green.
    const seeded = await seededInstanceStatusProblems(client, authoredInstances);
    problems.push(...seeded.problems);

    const { rows: halfPair } = await client.query(
      `SELECT session_record_id, role, item_id FROM opinion
        WHERE (think IS NULL) <> (guess IS NULL) ORDER BY session_record_id, role, item_id`,
    );
    for (const row of halfPair) {
      fail(
        "V6",
        `instance "${row.session_record_id}": ${row.role} answers Aspect "${row.item_id}" with half of Think/Guess — they come together`,
      );
    }

    // V9 — the instance's mode matches its opinion rows (#213). A Basic instance answers
    // Feel and Wish and nothing else; an Advanced one answers all four on every row. `V6`
    // already fails a half pair, so `think` alone decides. The model enforces the same rule on
    // the way out (`zAssessmentInstance`), and this pins it on the live rows: a drift that
    // slipped past the app is named here, before a report draws it as a Gap.
    const { rows: instancedModes } = await client.query(
      `SELECT ai.record_id, r.slug, ai.mode
         FROM session ai
         JOIN record r ON r.id = ai.record_id
        ORDER BY r.slug`,
    );
    for (const row of instancedModes) {
      if (row.mode !== "basic" && row.mode !== "advanced") {
        fail("V9", `instance "${row.slug}" carries mode "${row.mode}" — one of basic, advanced`);
        continue;
      }
      const advanced = row.mode === "advanced";
      const { rows: offenders } = await client.query(
        `SELECT role, item_id, (think IS NOT NULL) AS has_think
           FROM opinion
          WHERE session_record_id = $1
            AND (think IS NOT NULL) <> $2::boolean
          ORDER BY role, item_id`,
        [row.record_id, advanced],
      );
      for (const opinion of offenders) {
        fail(
          "V9",
          advanced
            ? `instance "${row.slug}" is Advanced Mode but ${opinion.role} answers Aspect "${opinion.item_id}" without Think/Guess`
            : `instance "${row.slug}" is Basic Mode but ${opinion.role} answers Aspect "${opinion.item_id}" with Think/Guess`,
        );
      }
    }

    // V8 — the flow's own columns (#146). A party's session token and an invitation's token
    // are bearer credentials, so the row may carry a SHA-256 digest and nothing else; a
    // plain-text token here would be readable by anyone with database access.
    const { rows: badPartyHashes } = await client.query(
      `SELECT session_record_id, role, access_token_hash FROM party
        WHERE access_token_hash IS NOT NULL
          AND access_token_hash !~ '^[0-9a-f]{64}$'
        ORDER BY session_record_id, role`,
    );
    for (const row of badPartyHashes) {
      fail(
        "V8",
        `instance "${row.session_record_id}": the ${row.role}'s access_token_hash is not a SHA-256 hex digest`,
      );
    }

    // V10 — the binding (#213 follow-up). `party.user_id` is the column
    // `/assessment/instances` filters and `roleForUser()` answers from, and since this card the
    // flow writes it on the party row it creates when the request carries a session. Two ways
    // it goes wrong, and each is named:
    //
    //   (a) it names an account nobody has. A binding to a deleted or renamed Neon Auth user
    //       reads as "this person is a party" to every list while the person cannot sign in at
    //       all, so each binding is checked against the auth table this branch actually has —
    //       the names are read from the catalogue, not assumed (`db:seed`'s `authTables()`).
    //   (b) the seeded demo parties lost their seats. `db:seed` is the column's other writer
    //       (`bindDemoParties`), and a re-seed whose dataset moved, or a reset that unbound
    //       without re-binding, leaves the demo sign-in landing on "you are not in an
    //       assessment yet". Skipped — with a line in the summary — when `demo_account` is
    //       empty, because that is the flag being off, not drift.
    //
    // The two members' party map is `DEMO_INSTANCE_ID` + the button's own role name; the admin
    // answers no instance (`db:seed` gives it `party: null`, and `destinationFor()` sends it to the
    // operator registry, which no party row can make true or false). Kept as two lines here rather
    // than a shared constant the seed does not import, which would be a third copy of the mapping
    // instead of the only one.
    const { rows: boundParties } = await client.query(
      `SELECT session_record_id, role, user_id FROM party
        WHERE user_id IS NOT NULL
        ORDER BY session_record_id, role`,
    );
    if (boundParties.length > 0) {
      const { rows: authTables } = await client.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'neon_auth' AND table_name IN ('user', 'users')
          ORDER BY table_name`,
      );
      const usersTable = authTables[0]?.table_name;
      let known = null;
      if (usersTable !== undefined) {
        const { rows: accounts } = await client.query(
          `SELECT id::text AS id FROM neon_auth."${usersTable}"`,
        );
        known = new Set(accounts.map((row) => row.id));
      }
      for (const party of boundParties) {
        if (known === null) {
          fail(
            "V10",
            `instance "${party.session_record_id}": the ${party.role} is bound to account "${party.user_id}", but this branch has no neon_auth users table to own it`,
          );
        } else if (!known.has(party.user_id)) {
          fail(
            "V10",
            `instance "${party.session_record_id}": the ${party.role} is bound to account "${party.user_id}", which neon_auth."${usersTable}" does not have`,
          );
        }
      }
    }

    const { DEMO_ACCOUNT_EMAILS, DEMO_INSTANCE_ID } = await import("@/lib/auth/demo-accounts.ts");
    const { rows: demoTable } = await client.query(
      "SELECT to_regclass('public.demo_account') IS NOT NULL AS present",
    );
    let seededBindings = 0;
    let demoSeeded = false;
    if (demoTable[0]?.present === true) {
      const { rows: demoAccounts } = await client.query(
        "SELECT email, user_id FROM demo_account WHERE email = ANY($1::text[])",
        [Object.values(DEMO_ACCOUNT_EMAILS)],
      );
      demoSeeded = demoAccounts.length > 0;
      const accountOf = new Map(demoAccounts.map((row) => [row.email, row.user_id]));
      for (const role of ["initiator", "counterparty"]) {
        const email = DEMO_ACCOUNT_EMAILS[role];
        const accountId = accountOf.get(email);
        if (accountId === undefined) continue;
        const { rows: seat } = await client.query(
          "SELECT user_id, name FROM party WHERE session_record_id = $1 AND role = $2",
          [DEMO_INSTANCE_ID, role],
        );
        const bound = seat[0];
        seededBindings += 1;
        if (bound === undefined) {
          fail(
            "V10",
            `instance "${DEMO_INSTANCE_ID}": ${email} owns no ${role} party row — the seed's binding has nothing to be on (run \`pnpm db:seed\`)`,
          );
        } else if (bound.user_id !== accountId) {
          fail(
            "V10",
            `instance "${DEMO_INSTANCE_ID}": the ${role} ("${bound.name}") is bound to ${bound.user_id === null ? "no account" : `account "${bound.user_id}"`}, not to ${email}'s ("${accountId}") — the seeded binding moved (run \`pnpm db:seed\`)`,
          );
        }
      }
    }

    const { rows: orphanInstances } = await client.query(
      `SELECT ai.record_id FROM session ai
         JOIN record r ON r.id = ai.record_id
        WHERE r.record_type <> 'assessment' ORDER BY ai.record_id`,
    );
    for (const row of orphanInstances) {
      fail("V3", `session "${row.record_id}" is attached to a record that is not an assessment`);
    }

    /* V22 — the published-version table and its guard (#502b).
     *
     * Two facts, checked together because either alone is a false green: a `template_version` table
     * without the trigger lets a publish rewrite a version a relationship is reading, and a trigger
     * without the table names nothing. The trigger is looked up by name on the right table, in
     * `pg_trigger`, not by "some trigger exists".
     */
    const { rows: versionTable } = await client.query(
      "SELECT to_regclass('public.template_version') IS NOT NULL AS present",
    );
    if (versionTable[0]?.present !== true) {
      fail("V22", "public.template_version does not exist — run `pnpm db:migrate`");
    } else {
      const { rows: guard } = await client.query(
        `SELECT t.tgname FROM pg_trigger t
          WHERE t.tgrelid = 'public.template_version'::regclass
            AND t.tgname = 'template_version_immutable_guard'
            AND NOT t.tgisinternal`,
      );
      if (guard.length === 0) {
        fail(
          "V22",
          "public.template_version has no template_version_immutable_guard trigger — a published version could be rewritten",
        );
      }
    }

    /* V23 — every relationship is bound to a version of its own template (#502b).
     *
     * The binding is what a party-facing read goes through, so an unbound row is not a nicety
     * missing: it is a relationship whose template nobody can draw (`/assessment/[slug]` answers
     * 404 for it). The version must belong to the template the relationship names, and every
     * payload must parse as `zAssessment` — a version that does not parse is a template no report
     * can draw.
     */
    const { rows: unboundRelationships } = await client.query(
      "SELECT id FROM relationship WHERE template_version_id IS NULL ORDER BY id",
    );
    for (const row of unboundRelationships) {
      fail(
        "V23",
        `relationship "${row.id}" has no template_version_id — it cannot read its template`,
      );
    }
    const { rows: mismatchedVersions } = await client.query(
      `SELECT rel.id, rel.template_id, tv.template_record_id
         FROM relationship rel
         JOIN template_version tv ON tv.id = rel.template_version_id
        WHERE tv.template_record_id <> rel.template_id
        ORDER BY rel.id`,
    );
    for (const row of mismatchedVersions) {
      fail(
        "V23",
        `relationship "${row.id}" names template "${row.template_id}" but is bound to a version of "${row.template_record_id}"`,
      );
    }
    const { rows: versionPayloads } = await client.query(
      "SELECT id, payload FROM template_version ORDER BY template_record_id, version",
    );
    let versionsParsed = 0;
    for (const row of versionPayloads) {
      try {
        assessmentTemplateFromPayload(row.payload, `template version "${row.id}"`);
        versionsParsed += 1;
      } catch (error) {
        fail("V23", error.message);
      }
    }

    const { rows: unlockMarks } = hasUnlockColumn
      ? await client.query("SELECT count(*)::int AS n FROM party WHERE unlock_seen_at IS NOT NULL")
      : [{ n: 0 }];

    /* V13 — the plans (#289).
     *
     * Equality in both directions: every fixture row is present with the fixture's cents, name
     * and `active` flag, and the table holds no row the fixture stopped authoring (an old price
     * sitting there is exactly the drift a second list would have caused, caught one layer down).
     */
    const { billingPlanRows, billingPlanProblems } = await import("@/data/billing-plans.ts");
    for (const problem of billingPlanProblems()) fail("V13", problem);

    let billingPlansChecked = 0;
    let liveSubscriptions = 0;
    const { rows: billingTable } = await client.query(
      "SELECT to_regclass('public.billing_plan') IS NOT NULL AS present",
    );
    if (billingTable[0]?.present !== true) {
      fail("V13", "public.billing_plan does not exist — run `pnpm db:migrate`");
    } else {
      const { rows: planRows } = await client.query(
        "SELECT id, interval, name, price_cents, active FROM billing_plan ORDER BY id, interval",
      );
      const byKey = new Map(planRows.map((row) => [`${row.id}/${row.interval}`, row]));
      for (const fixture of billingPlanRows()) {
        const key = `${fixture.id}/${fixture.interval}`;
        const row = byKey.get(key);
        billingPlansChecked += 1;
        if (row === undefined) {
          fail(
            "V13",
            `billing_plan has no row for ${key} — the fixture offers it and a surface may render it (run \`pnpm db:seed\`)`,
          );
          continue;
        }
        if (row.price_cents !== fixture.priceCents) {
          fail(
            "V13",
            `billing_plan ${key}: ${row.price_cents} cents in the database, ${fixture.priceCents} cents in data/billing-plans.ts — the page and a checkout would disagree`,
          );
        }
        if (row.name !== fixture.name) {
          fail(
            "V13",
            `billing_plan ${key}: named "${row.name}" in the database and "${fixture.name}" in the fixture`,
          );
        }
        if (row.active !== fixture.active) {
          fail(
            "V13",
            `billing_plan ${key}: active=${row.active} in the database, ${fixture.active} in the fixture`,
          );
        }
      }
      const fixtureKeys = new Set(billingPlanRows().map((row) => `${row.id}/${row.interval}`));
      for (const row of planRows) {
        if (!fixtureKeys.has(`${row.id}/${row.interval}`)) {
          fail(
            "V13",
            `billing_plan holds ${row.id}/${row.interval}, which data/billing-plans.ts no longer authors — a second price list`,
          );
        }
      }

      const { rows: live } = await client.query(
        `SELECT count(*)::int AS n FROM billing_subscription
          WHERE status IN ('active', 'trialing', 'past_due')`,
      );
      liveSubscriptions = live[0]?.n ?? 0;
    }

    /* V24 — the inbound mail record (#439b).
     *
     * Three facts, checked together because any one of them alone is a false green: the table, the
     * constraint that makes a redelivery idempotent, and the two columns the suppression write
     * targets. A `UNIQUE` index is looked up by its definition, not by "an index exists" — a plain
     * index on `provider_event_id` would be a table that accepts a second row for one delivery, and
     * that is precisely the bug the card's replay acceptance is about.
     */
    const { rows: emailTable } = await client.query(
      "SELECT to_regclass('public.email_event') IS NOT NULL AS present",
    );
    let emailEvents = 0;
    let suppressedAddresses = 0;
    if (emailTable[0]?.present !== true) {
      fail("V24", "public.email_event does not exist — run `pnpm db:migrate`");
    } else {
      const { rows: uniqueDelivery } = await client.query(
        `SELECT c.conname FROM pg_constraint c
          WHERE c.conrelid = 'public.email_event'::regclass
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) = 'UNIQUE (provider_event_id)'`,
      );
      if (uniqueDelivery.length === 0) {
        fail(
          "V24",
          "public.email_event has no UNIQUE (provider_event_id) — a provider redelivery would write a second row",
        );
      }
      const { rows: payloadColumn } = await client.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'email_event'
            AND column_name = 'payload'`,
      );
      if (payloadColumn[0]?.data_type !== "jsonb") {
        fail(
          "V24",
          "public.email_event.payload is not jsonb — the provider's own envelope is stored as parsed JSON",
        );
      }
      const { rows: counts } = await client.query(
        `SELECT (SELECT count(*)::int FROM email_event) AS events,
                (SELECT count(*)::int FROM news_signup
                  WHERE bounced_at IS NOT NULL OR complained_at IS NOT NULL) AS suppressed`,
      );
      emailEvents = counts[0]?.events ?? 0;
      suppressedAddresses = counts[0]?.suppressed ?? 0;
    }
    const { rows: signupMarks } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'news_signup'
          AND column_name IN ('bounced_at', 'complained_at')`,
    );
    for (const column of ["bounced_at", "complained_at"]) {
      if (!signupMarks.some((row) => row.column_name === column)) {
        fail(
          "V24",
          `public.news_signup.${column} does not exist — a bounce has nowhere to be recorded (run \`pnpm db:migrate\`)`,
        );
      }
    }

    /* V25 — the support inbox (#506).
     *
     * Three facts, checked together because a database missing any one of them is a request-time
     * 500 on `/admin/inbox` rather than a caught bug: `contact_message.status` exists with the
     * column's own `new` default (so a row the public route writes lands in the queue without the
     * route knowing the screen exists), the four-word vocabulary constraint is on the table, and
     * `contact_reply` exists with the CHECK that makes "sent only after the provider accepted" a
     * property of the row. A CHECK is looked up by name and its definition read, because an index
     * that merely exists is the false green `0027`'s V24 warns about.
     */
    let inboxMessages = 0;
    let inboxReplies = 0;
    const { rows: statusColumn } = await client.query(
      `SELECT is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'contact_message' AND column_name = 'status'`,
    );
    if (statusColumn.length === 0) {
      fail("V25", "public.contact_message.status does not exist — run `pnpm db:migrate`");
    } else {
      if (statusColumn[0]?.is_nullable !== "NO") {
        fail(
          "V25",
          "public.contact_message.status is nullable — a message with no triage state is not a queue row",
        );
      }
      if (!String(statusColumn[0]?.column_default ?? "").includes("'new'")) {
        fail(
          "V25",
          "public.contact_message.status does not default to 'new' — a stored message would arrive with no status",
        );
      }
      const { rows: vocabulary } = await client.query(
        `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
          WHERE c.conrelid = 'public.contact_message'::regclass
            AND c.conname = 'contact_message_status_vocabulary'`,
      );
      const definition = String(vocabulary[0]?.def ?? "");
      for (const status of ["new", "open", "waiting", "closed"]) {
        if (!definition.includes(`'${status}'`)) {
          fail(
            "V25",
            `public.contact_message.status has no '${status}' in its CHECK — the four-word vocabulary the screen renders is the column's own`,
          );
        }
      }
    }

    const { rows: replyTable } = await client.query(
      "SELECT to_regclass('public.contact_reply') IS NOT NULL AS present",
    );
    if (replyTable[0]?.present !== true) {
      fail(
        "V25",
        "public.contact_reply does not exist — a reply has nowhere to be stored (run `pnpm db:migrate`)",
      );
    } else {
      const { rows: replyChecks } = await client.query(
        `SELECT c.conname, pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
          WHERE c.conrelid = 'public.contact_reply'::regclass`,
      );
      const named = new Map(replyChecks.map((row) => [row.conname, String(row.def ?? "")]));
      for (const name of [
        "contact_reply_state_vocabulary",
        "contact_reply_sent_has_instant",
        "contact_reply_failed_has_error",
      ]) {
        if (!named.has(name)) {
          fail(
            "V25",
            `public.contact_reply has no ${name} constraint — the reply's state would be a convention, not a rule`,
          );
        }
      }
      const { rows: counts } = await client.query(
        `SELECT (SELECT count(*)::int FROM contact_message) AS messages,
                (SELECT count(*)::int FROM contact_reply) AS replies,
                (SELECT count(*)::int FROM contact_reply WHERE state = 'sent' AND sent_at IS NULL) AS sent_without_instant`,
      );
      inboxMessages = counts[0]?.messages ?? 0;
      inboxReplies = counts[0]?.replies ?? 0;
      if ((counts[0]?.sent_without_instant ?? 0) > 0) {
        fail(
          "V25",
          `${counts[0].sent_without_instant} reply row(s) are 'sent' with no sent_at — a send that the provider never accepted`,
        );
      }
    }

    /* V26 — the broadcast's record (#507).
     *
     * Four facts, checked together because the console's send depends on all of them and each one
     * failing alone is a request-time 500 on the screen rather than a caught bug:
     *
     *   the consent mark    `news_signup.unsubscribed_at` exists, so the audience predicate has a
     *                       column to read;
     *   the send row        `broadcast_send` exists, so a send is auditable without the body;
     *   the cooldown row    `broadcast_recipient` exists **with the primary key that makes one
     *                       address one row per send** — a plain table would accept a duplicate and
     *                       a second send inside the window would look like the first;
     *   the cooldown's read `(email, created_at DESC)` is indexed, because the audience query is an
     *                       existence test per candidate address.
     *
     * The counts are printed with the rest of the census: how many sends exist and how many
     * addresses they have recorded is the answer to "has anything been broadcast from this database".
     *
     * Numbered V26, not V25: #506's inbox rule landed on `main` first and holds V25, and two rules
     * sharing a code would make a failure line ambiguous. The invariant is unchanged, only its
     * number.
     */
    let broadcasts = 0;
    let broadcastRecipients = 0;
    const { rows: consentColumn } = await client.query(
      `SELECT 1 AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'news_signup'
          AND column_name = 'unsubscribed_at'`,
    );
    if (consentColumn.length === 0) {
      fail(
        "V26",
        "public.news_signup.unsubscribed_at does not exist — a broadcast cannot exclude an unsubscribed address (run `pnpm db:migrate`)",
      );
    }
    const { rows: broadcastTables } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('broadcast_send', 'broadcast_recipient')`,
    );
    for (const table of ["broadcast_send", "broadcast_recipient"]) {
      if (!broadcastTables.some((row) => row.table_name === table)) {
        fail("V26", `public.${table} does not exist — a send would have nowhere to be recorded`);
      }
    }
    if (broadcastTables.length === 2) {
      const { rows: recipientKey } = await client.query(
        `SELECT c.conname FROM pg_constraint c
          WHERE c.conrelid = 'public.broadcast_recipient'::regclass
            AND c.contype = 'p'
            AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (broadcast_id, email)'`,
      );
      if (recipientKey.length === 0) {
        fail(
          "V26",
          "public.broadcast_recipient has no PRIMARY KEY (broadcast_id, email) — one address could be recorded twice in one send",
        );
      }
      const { rows: cooldownIndex } = await client.query(
        `SELECT indexname FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'broadcast_recipient'
            AND indexdef LIKE '%(email, created_at DESC)%'`,
      );
      if (cooldownIndex.length === 0) {
        fail(
          "V26",
          "public.broadcast_recipient has no (email, created_at DESC) index — the cooldown read is a scan",
        );
      }
      const { rows: broadcastCounts } = await client.query(
        `SELECT (SELECT count(*)::int FROM broadcast_send) AS sends,
                (SELECT count(*)::int FROM broadcast_recipient) AS recipients`,
      );
      broadcasts = broadcastCounts[0]?.sends ?? 0;
      broadcastRecipients = broadcastCounts[0]?.recipients ?? 0;
    }

    /* V27 — no orphan profile (#278).
     *
     * `public` holds no foreign key to `neon_auth` (`0003`'s header: "a profile whose user was
     * deleted in the managed schema is an orphan row, not a broken constraint"), so this is the
     * one half-deleted state no constraint refuses: the auth user gone and the profile row left.
     * The sweep deletes the auth user **first** on purpose (`docs/ACCOUNT-DELETION-SPEC.md` §7
     * step 3), so a scrub that failed after it leaves exactly this, and the person's public
     * profile URL keeps resolving to an account nobody can sign in to.
     *
     * The users table is read from the catalogue rather than assumed (`user` on Neon, `users`
     * elsewhere) — V10 does the same for `party.user_id`, and the two must agree about which
     * table owns an account.
     */
    let profileRows = 0;
    const { rows: profileOwners } = await client.query(
      "SELECT user_id FROM user_profile ORDER BY user_id",
    );
    profileRows = profileOwners.length;
    if (profileRows > 0) {
      const { rows: authUserTables } = await client.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'neon_auth' AND table_name IN ('user', 'users')
          ORDER BY table_name`,
      );
      const usersTable = authUserTables[0]?.table_name;
      if (usersTable === undefined) {
        fail(
          "V27",
          `${profileRows} user_profile row(s) and no neon_auth users table to own them — run \`neon env pull\` against a branch that has auth before trusting a green profile check`,
        );
      } else {
        const { rows: accounts } = await client.query(
          `SELECT id::text AS id FROM neon_auth."${usersTable}"`,
        );
        for (const problem of orphanProfileProblems(
          profileOwners.map((row) => row.user_id),
          accounts.map((row) => row.id),
        )) {
          fail(problem.code, problem.message);
        }
      }
    }

    /* V28 — an unfinished deletion has an owner (#278 follow-up).
     *
     * #601 made a failed scrub resumable: `recordIntent()` writes `{user_id, email, names, roles}`
     * to `account_deletion_job` **before** the irreversible auth delete, and `runAccountDeletion()`
     * falls back to that row when `neon_auth` has no user left to read. What that mechanism cannot
     * do is notice anything: the person's session died with their auth user, so nothing in the
     * product retries the sweep, and an abandoned row keeps an address `/privacy` calls "removed
     * permanently" for as long as nobody looks. V27 names the `user_profile` an interrupted attempt
     * leaves; this names the interruption itself.
     *
     * The table is checked for existence first, the way V19 treats `relationship_member`: a
     * database migrated without `0034` has nowhere to record an intent, so it also has nothing
     * that could tell an operator a deletion is stuck — a green run there would be the claim this
     * check exists to refuse. The rows are only the **open** ones (`finished_at IS NULL`); a
     * finished row is an opaque id and two instants (§6), so it is not this check's business.
     */
    let openDeletionJobs = 0;
    const { rows: deletionJobTable } = await client.query(
      "SELECT to_regclass('public.account_deletion_job') AS table",
    );
    if (deletionJobTable[0]?.table === null) {
      fail(
        "V28",
        "public.account_deletion_job does not exist — run `pnpm db:migrate` (0034): an interrupted deletion would have nowhere to record the identity it must be resumed with",
      );
    } else {
      const { rows: openJobs } = await client.query(
        `SELECT user_id, started_at, finished_at FROM account_deletion_job
          WHERE finished_at IS NULL
          ORDER BY started_at`,
      );
      openDeletionJobs = openJobs.length;
      for (const problem of stuckDeletionJobProblems(openJobs)) {
        fail(problem.code, problem.message);
      }
    }

    /* V29 — the review store (#667).
     *
     * The store behind `/admin/review`: four tables, one constraint that makes an issue number
     * trustworthy, and one pair of columns that must agree. The tables are checked by name from
     * `information_schema`, the way V28 checks `account_deletion_job` — a database migrated without
     * `0037` has nowhere to record a tick, so it also has nothing this rule could find, and a green
     * run there would be the false evidence the rule exists to refuse.
     *
     * The rows are read in full (`review_issue` is a review screen's list, not an event log) and
     * handed to `reviewIssueProblems()`, which is the rule in one place and the half a test can
     * drive with no connection.
     */
    let reviewArtifacts = 0;
    let reviewTodos = 0;
    let reviewIssues = 0;
    const { rows: reviewTables } = await client.query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('review_artifact', 'review_todo', 'review_issue', 'review_issue_comment')
        ORDER BY table_name`,
    );
    const reviewTableNames = reviewTables.map((row) => row.table_name);
    for (const table of [
      "review_artifact",
      "review_todo",
      "review_issue",
      "review_issue_comment",
    ]) {
      if (!reviewTableNames.includes(table)) {
        fail(
          "V29",
          `public.${table} does not exist — run \`pnpm db:migrate\` (0037): a review TODO or issue would have nowhere to be written`,
        );
      }
    }
    if (reviewTableNames.includes("review_artifact")) {
      const { rows: numberKey } = await client.query(
        `SELECT c.conname FROM pg_constraint c
          WHERE c.conrelid = 'public.review_issue'::regclass
            AND c.contype = 'u'
            AND pg_get_constraintdef(c.oid) = 'UNIQUE (artifact_id, number)'`,
      );
      if (numberKey.length === 0) {
        fail(
          "V29",
          "public.review_issue has no UNIQUE (artifact_id, number) — two people raising an issue at the same moment could share a number, and every quote of it becomes ambiguous",
        );
      }
      const { rows: reviewCounts } = await client.query(
        `SELECT (SELECT count(*)::int FROM review_artifact) AS artifacts,
                (SELECT count(*)::int FROM review_todo) AS todos,
                (SELECT count(*)::int FROM review_issue) AS issues`,
      );
      reviewArtifacts = reviewCounts[0]?.artifacts ?? 0;
      reviewTodos = reviewCounts[0]?.todos ?? 0;
      reviewIssues = reviewCounts[0]?.issues ?? 0;
      const { rows: issueRows } = await client.query(
        `SELECT id, artifact_id, number, state, closed_at FROM review_issue ORDER BY artifact_id, number`,
      );
      for (const problem of reviewIssueProblems(issueRows)) {
        fail(problem.code, problem.message);
      }
    }

    if (problems.length > 0) {
      console.error(`✗ db:verify — ${problems.length} violation(s)`);
      for (const problem of problems) console.error(`  ${problem.code}  ${problem.message}`);
      process.exitCode = 1;
      return;
    }

    const bindings =
      boundParties.length === 0
        ? "no party is bound to an account yet"
        : demoSeeded
          ? `${boundParties.length} party binding(s) resolve to an account, ${seededBindings} seeded binding(s) intact`
          : `${boundParties.length} party binding(s) resolve to an account, seeded bindings unchecked (no demo_account rows)`;

    console.log(
      `✓ db:verify — ${instances.length} instance(s) checked, ${templatesChecked} template(s) resolved, ${versionsParsed} template version(s) parsed with every relationship bound to one, no Gap column, no \`instance\` table or column, ${relationshipOrphans} orphan session(s) (every session has a relationship), ${updatePaths.violations.length} UPDATE path(s) against session/opinion across ${updatePaths.files} source file(s) (a scored session is immutable), ${memberRelationshipsChecked} relationship(s) with one initiator member and no double coach, every mode matches its answers, every Setting one of soft/full with ${settingsChecked.length} seeded setting(s) matching the fixture, ${seeded.complete} of ${seeded.authored} seeded instance(s) complete, ${bindings}, ${unlockMarks[0].n} unlock mark(s) on complete instances only, ${billingPlansChecked} billing plan row(s) matching data/billing-plans.ts (${liveSubscriptions} live subscription(s)), ${consoleColumnsChecked} console column(s) nullable with no default, ${submittedSeats} submitted seat(s) with every Aspect answered, ${emailEvents} mail event(s) recorded (${suppressedAddresses} address(es) suppressed), ${inboxMessages} contact message(s) in the inbox with ${inboxReplies} reply attempt(s), ${broadcasts} broadcast send(s) recorded (${broadcastRecipients} address(es) mailed), ${profileRows} profile row(s) with a live account behind them (no orphan after a deletion), ${openDeletionJobs} open deletion job(s) none older than ${STUCK_DELETION_JOB_HOURS} h, ${reviewArtifacts} review artifact(s) with ${reviewTodos} TODO item(s) and ${reviewIssues} feedback issue(s) none in a closed/open mismatch, no drift`,
    );

    // One line per seeded instance, in slug order: which Setting it plays under, and what that
    // word means in the glossary's own sentence. A bare `soft` in a column is an enum member;
    // "Soft — Small Gap (1) OK" is the fact a reader can act on (#259).
    const { SETTING_LABELS, SETTING_DEFINITIONS } = await import("@/content/assessment.ts");
    for (const checked of settingsChecked) {
      console.log(
        `  setting  ${checked.slug.padEnd(12)} ${SETTING_LABELS[checked.setting]} — ${SETTING_DEFINITIONS[checked.setting]}`,
      );
    }
  } finally {
    await client.end();
  }
}

// Only when this file is the entry point: `tests/db-verify-seeded-complete.test.ts` imports
// `seededInstanceStatusProblems()` to drive V21 with no database, and an import must not run the
// checks (there is no connection, and `loadEnv()` would reach into the checkout's `.env.local`).
// `release-limits.mjs` guards its own `main` the same way.
if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\n✗ db:verify failed: ${error.message}`);
    process.exitCode = 1;
  });
}
