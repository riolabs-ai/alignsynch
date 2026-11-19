# The migration inventory — what is applied, what it would cost, and the 2.0-official gate

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Migration inventory · prev [Migrations](migrations.md) · next [Orchestration rules](orchestration.md)

<!-- docs-nav:end -->

Issue: none — the requirement is kanban card **t_a2c57a7b**, authored by the lead. Card
**t_f703cbe1** landed the page on `main` and re-measured every figure on it; card **t_b2df17e2**
wrote and applied `0043_stakeholder_role.sql`, and card **t_634b17ae** publishes that file in
PR #1264. This is a **measurement**: it runs no migration, writes no row, and fixes nothing it
finds. Every defect it names is somebody else's card.

Measured **2026-11-19**, read only, through the **unpooled** connection, from the tree at
`66e18ce31` (that is `main` **plus** PR #1264's `0043_stakeholder_role.sql`, which is applied on
both branches but whose file has not merged yet — the one caveat on this page, spelled out under
§2).

| Branch     | `NEON_BRANCH` | Endpoint, unpooled                                      |
| ---------- | ------------- | ------------------------------------------------------- |
| Production | `production`  | `ep-winter-block-b4bkk1xc.c-6.us-east-2.aws.neon.tech`  |
| Demo       | `demo`        | `ep-crimson-truth-b4ppwxrp.c-6.us-east-2.aws.neon.tech` |

Every figure below names the branch it came from, and every `db:*` quote carries the `· target:`
line the script printed for itself. That is not ceremony: `withenv.sh` loads `.env` then
`.env.local` and **`.env.local` (demo) wins**, so the production reads re-source `.env` last. A
drift check that measures demo while claiming production measures nothing.

## The measurement, in one table

| Fact                         | Production                                | Demo                                |
| ---------------------------- | ----------------------------------------- | ----------------------------------- |
| Files in the tree            | **47**                                    | **47**                              |
| Rows in `schema_migrations`  | **47**                                    | **47**                              |
| On disk, not applied         | **0**                                     | **0**                               |
| Applied, not on disk         | **0**                                     | **0**                               |
| Duplicate numeric prefixes   | **4 pairs** — `0008` `0026` `0028` `0042` | the same four                       |
| `db:verify` violations       | **4**, all `V31` (exit 1)                 | **0** (exit 0)                      |
| Newest applied instant       | `2026-11-19T16:12:13.107Z` (`0043`)       | `2026-11-19T16:03:19.468Z` (`0043`) |
| Oldest applied instant       | `2026-10-30T17:58:23.621Z` (`0001`)       | `2026-10-30T17:58:23.621Z` (`0001`) |
| Applied instants that differ | **42 of 47**                              | **42 of 47**                        |

The ledger and the directory are **the same set**, name for name, on both branches — and the set is
identical between them. That is the whole good news of this page, and it is narrower than it sounds
in two ways that each get a section below:

1. **It says every file has been run once, not that the body on disk is the body that ran.** The
   ledger is keyed on the filename (§1b).
2. **The two branches share a set, not a history.** Only `0001`–`0005` carry the same `applied_at`
   on both; the other 42 rows were applied at different moments, and two of the four duplicate
   pairs were applied in the opposite order on each branch (§1a).

## 1. The disk census — 47 files, in filename order

`Idem.` is per file: **yes** means every statement in the file re-runs clean (guarded by
`IF NOT EXISTS` / `IF EXISTS`, or convergent by `ON CONFLICT … DO UPDATE`), **yes\*** means the DDL
is guarded but the file also writes rows, **yes†** means it carries no explicit `IF` guard at all
and is idempotent only by construction (an `ON CONFLICT` upsert, or a constraint dropped by
scanning the catalogue). `Rows` is what the file does to data: `—` (DDL only), `backfill`,
`upsert`, or `delete`. The two instant columns are the two ledgers, as read — they are printed side
by side because they disagree (`minute`, UTC).

| #    | Migration                     | What it changes                                                            | Idem. | Rows            | Production (UTC) | Demo (UTC)  |
| ---- | ----------------------------- | -------------------------------------------------------------------------- | ----- | --------------- | ---------------- | ----------- |
| 0001 | content_model                 | the six content tables that mirror `content/record.ts` + `assessment.ts`   | yes   | —               | 10-30 17:58      | 10-30 17:58 |
| 0002 | two_party_flow                | `party.access_token_hash`, `instance_invite`, the two key-read indexes     | yes   | —               | 10-30 18:39      | 10-30 18:39 |
| 0003 | user_profile                  | the profile a signed-in person owns, mirroring `content/identity.ts`       | yes   | —               | 10-30 18:50      | 10-30 18:50 |
| 0004 | user_profile_role             | `user_profile.role` as member or admin; widened to four rungs by 0023      | yes   | —               | 10-30 20:05      | 10-30 20:05 |
| 0005 | demo_account                  | `party.user_id` and the three seeded demo accounts                         | yes   | —               | 10-30 20:05      | 10-30 20:05 |
| 0006 | assessment_mode               | `assessment_instance.mode`, set from the fixture's own slugs               | yes\* | backfill        | 11-01 16:46      | 10-31 14:35 |
| 0007 | party_unlock_seen             | `party.unlock_seen_at` — the "I have read the unlock" mark                 | yes   | —               | 11-01 16:46      | 10-31 14:35 |
| 0008 | alignment_setting             | `assessment_instance.alignment_setting` (Soft/Full), backfilled            | yes\* | backfill        | 11-01 16:46      | 10-31 14:35 |
| 0008 | initiator_email               | `instance_invite.initiator_email` so the unlock notice can reach them      | yes   | —               | 11-01 16:46      | 10-31 14:35 |
| 0009 | billing                       | `billing_plan`, `billing_subscription`, `billing_event`, webhook dedupe    | yes   | —               | 11-01 16:46      | 10-31 14:35 |
| 0010 | invite_resend                 | `resent_at` / `resend_count` and the 24 h re-invite cooldown               | yes   | —               | 11-01 16:46      | 10-31 14:35 |
| 0011 | console_columns               | `record.author_user_id`, `assessment_instance.name`, `party.submitted_at`  | yes   | —               | 11-01 16:46      | 10-31 17:42 |
| 0012 | template_author_index         | the index `/assessment/templates` reads                                    | yes   | —               | 11-01 16:46      | 10-31 17:42 |
| 0013 | relationship_sessions         | splits `assessment_instance` into `relationship` + `session`               | yes\* | backfill        | 11-01 16:47      | 11-02 10:06 |
| 0014 | relationship_membership       | `relationship_member` — a coach is a role on the relationship              | yes\* | backfill        | 11-01 16:47      | 11-02 10:06 |
| 0015 | password_reset                | the app's own forgot-password tokens                                       | yes   | —               | 11-02 12:04      | 11-02 10:06 |
| 0016 | party_acceptance              | `party.accepted_at` — acceptance as an instant, never a status             | yes   | —               | 11-02 12:04      | 11-02 18:29 |
| 0017 | step                          | `step` — one row per derived Step for improving the relationship           | yes   | —               | 11-02 12:04      | 11-02 18:29 |
| 0018 | billing_plan_rows             | the three-tier catalogue as rows; retires `pro` and `enterprise`           | yes†  | upsert + delete | 11-02 13:35      | 11-02 18:29 |
| 0019 | news_signup                   | the footer's list, one row per address                                     | yes   | —               | 11-02 14:17      | 11-02 18:29 |
| 0020 | contact_message               | the `/help` form's inbox — a row is kept before it is mailed               | yes   | —               | 11-02 15:40      | 11-02 18:29 |
| 0021 | contact_message_address_index | the per-address throttle bucket beside the per-IP one                      | yes   | —               | 11-02 15:40      | 11-02 18:29 |
| 0022 | user_profile_tour_seen        | `user_profile.tour_seen_at` for the first-run tour                         | yes   | —               | 11-03 15:09      | 11-03 16:19 |
| 0023 | admin_role_audit              | four admin roles, the invitation, and `admin_action` (append-only log)     | yes\* | backfill        | 11-03 19:09      | 11-04 16:24 |
| 0024 | admin_action_actor_role       | `admin_action.actor_role` — the rung held **at the time**                  | yes   | —               | 11-03 19:09      | 11-04 16:24 |
| 0025 | relationship_operations       | `session.voided_at/voided_by`, `party.impersonated_by` for repairs         | yes   | —               | 11-03 19:09      | 11-04 16:24 |
| 0026 | billing_control               | `billing_subscription.livemode` and `plan_grant`                           | yes   | —               | 11-03 22:11      | 11-04 16:24 |
| 0026 | template_version              | `template_version` + `relationship.template_version_id`; immutable publish | yes\* | backfill        | 11-03 21:50      | 11-04 16:24 |
| 0027 | email_event                   | what the mail provider reports happened to a delivery                      | yes   | —               | 11-03 22:47      | 11-04 16:24 |
| 0028 | broadcast                     | `broadcast_send` and the bounce/complaint marks on `news_signup`           | yes   | —               | 11-04 00:41      | 11-04 16:24 |
| 0028 | support_inbox                 | `contact_message` triage status and one row per reply attempt              | yes   | —               | 11-04 00:06      | 11-04 16:24 |
| 0029 | record_ownership_visibility   | `record.owner_user_id` and `record.visibility`                             | yes   | —               | 11-04 09:32      | 11-04 16:24 |
| 0030 | relationship_lifecycle        | `relationship.status` + the three instants, backfilled from acceptance     | yes\* | backfill        | 11-04 09:32      | 11-04 16:24 |
| 0031 | session_round                 | `session.round` — a relationship is assessed in ordered rounds             | yes\* | backfill        | 11-04 09:32      | 11-04 16:24 |
| 0032 | relationship_lapse            | `relationship.expired_at` and `lapse_reason`                               | yes   | —               | 11-04 11:14      | 11-04 16:24 |
| 0033 | account_deletion              | six account-id indexes the erasure sweep filters on                        | yes   | —               | 11-07 14:38      | 11-07 14:56 |
| 0034 | account_deletion_job          | the identity a half-finished deletion must not lose                        | yes   | —               | 11-07 14:38      | 11-07 14:56 |
| 0035 | form_guard_attempt            | the window the two public forms count attempts over                        | yes   | —               | 11-07 15:20      | 11-07 18:45 |
| 0036 | relationship_payment          | `relationship_payment` — the charge moves to completion                    | yes   | —               | 11-07 19:59      | 11-07 20:42 |
| 0037 | review_artifacts              | four tables behind `/admin/review` (artifact, todo, issue, comment)        | yes   | —               | 11-08 00:08      | 11-08 05:43 |
| 0038 | admin_action_reason_optional  | `reason` nullable on both tables; the two `btrim` CHECKs dropped           | yes†  | —               | 11-11 17:58      | 11-09 00:23 |
| 0039 | session_aspects_authored_at   | `session.aspects_authored_at` — where a copy's Aspect list came from       | yes   | —               | 11-12 14:00      | 11-12 16:51 |
| 0040 | session_invite_relationship   | `session_invite.relationship_id`, backfilled, then `NOT NULL`              | yes\* | backfill        | 11-18 02:38      | 11-15 22:27 |
| 0041 | session_state                 | `session.state` (`draft` / `active`), backfilled                           | yes\* | backfill        | 11-18 02:38      | 11-16 13:45 |
| 0042 | billing_plan_prices           | the approved three-plan amounts as rows                                    | yes†  | upsert          | 11-18 02:38      | 11-17 21:21 |
| 0042 | email_template_version        | `email_template_version` — an admin's mail override as a version           | yes   | —               | 11-18 02:38      | 11-18 03:57 |
| 0043 | stakeholder_role              | `user_profile.role` CHECK widened to five rungs (`stakeholder`, #1252)     | yes   | —               | 11-19 16:12      | 11-19 16:03 |

**Nothing on this list is non-idempotent.** The three without an explicit `IF` guard are
idempotent by construction: `0018` and `0042_billing_plan_prices` upsert on the `(id, interval)`
primary key so a second run writes the same rows, and `0038` drops its CHECK constraints by
scanning `pg_constraint` for the definition rather than guessing a name. The backfills are all
narrowed by a predicate (`WHERE … IS NULL`, `WHERE status = 'draft'`, `WHERE round <> …`), so a
re-run matches nothing.

`0043_stakeholder_role.sql` is the newest file and the reason this page needed a second measurement:
it widens `user_profile`'s role CHECK from four rungs to five so `stakeholder` — a value
`content/role-ladder.ts` has admitted since #1254 — is no longer refused by Postgres. It drops and
re-adds `user_profile_role_vocabulary`, touches no row, and is idempotent for that reason.

### 1a. The duplicate prefixes — four pairs, and the order is not one order

`#1249` names the `0042` pair and calls it the last. It is not the last; the same shape appears
three more times. `db:migrate` sorts by filename and keys the ledger on the **full name**, so
nothing is skipped and no database is wrong today — which is exactly `#1249`'s argument. What the
applied instants add is that "sorts by filename" is not the whole story, and that **the two branches
disagree about it**:

| Prefix | Files (filename order)                           | Production                                     | Demo                                           |
| ------ | ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------- |
| `0008` | `alignment_setting` → `initiator_email`          | `16:46:25.14` → `16:46:25.76` (filename order) | `14:35:44.08` → `14:35:44.15` (filename order) |
| `0026` | `billing_control` → `template_version`           | `22:11:05.22` → `21:50:21.66` (**reversed**)   | `16:24:05.05` → `16:24:05.13` (filename order) |
| `0028` | `broadcast` → `support_inbox`                    | `00:41:05.14` → `00:06:39.60` (**reversed**)   | `16:24:05.30` → `16:24:05.37` (filename order) |
| `0042` | `billing_plan_prices` → `email_template_version` | `02:38:30.45` → `02:38:31.08` (filename order) | `21:21:25.26` → `03:57:52.12` (filename order) |

So the reversal is a property of **production's history**, not of the set: `0026` and `0028` were
applied there in the reverse of the order a fresh `db:migrate` would use, because each pair merged
in the other order. Demo replayed all four in filename order. A fresh branch today therefore replays
those pairs in a different order from production's history — harmless while the pairs are
independent, and not a property anything checks. The day one pair gains a dependency, the branch
that replays it differs from the branch that has it.

`#1249`'s first acceptance box — _fail on two files sharing a numeric prefix, naming both_ — must
grandfather **four** pairs or the rule turns four existing pairs red. Its second box ("either
grandfathered by an explicit allowlist, or documented as the last") currently reads as if there is
one. That is a comment on `#1249`, not a fix here. The checker that landed with `#1249`/`#1255`
agrees with this census at the 47-file count:

```text
  · prefixes: 47 file(s), every number one step — 4 grandfathered pair(s): 0008, 0026, 0028, 0042

✓ db:migrate --check-prefixes — db/migrations is a legal sequence
```

### 1b. What this table cannot check, and the file that says so

The ledger is keyed on the **filename**. A migration whose body is corrected after it has been
applied never runs again — the ledger only knows the name matched. `0018_billing_plan_rows.sql`
documents a database in exactly that state in its own closing comment: an archived branch applied a
body that inserted nothing, `schema_migrations` says `0018` ran, and the corrected content cannot
run until somebody deletes the row by hand.

Neither branch measured here is in that state — production's `V13` passes, so `billing_plan` matches
`data/billing-plans.ts`, which is `0042_billing_plan_prices`' amounts in force. But the class of
defect exists, it is invisible from the census, and no check compares a file's current body to the
body that ran. Naming it is the most this inventory can do; comparing bodies would need a content
hash in the ledger, which is a schema change and therefore a card.

## 2. The applied census — both branches, read-only

```sql
SELECT name, applied_at FROM schema_migrations ORDER BY name
```

`47` rows on each branch. Compared with `ls db/migrations/*.sql | xargs -n1 basename | sort` and
`comm`, both directions, against the 47-file tree:

```text
--- applied but NOT on disk ---
--- on disk but NOT applied ---
```

Both lists are empty on **both** branches: the set on disk is the set in the ledger, exactly, 47
names each. **No orphan ledger row exists** — the defect the card asked to look for (a row applied
but missing from disk) is not present, so it does not need its own card today.

**The one caveat, stated because the tree and the databases disagree until it closes.** The same
comparison against `origin/main`'s **46**-file tree returns one row in the first list and nothing in
the second, on both branches:

```text
  · 0043_stakeholder_role.sql is applied here but is not in this tree — the database is ahead of the checkout, not behind
✓ db:schema — 46 files · 46 applied · 0 pending
```

That is PR #1264, which carries the file. `db:schema` reads it correctly as "the database is ahead
of the checkout" rather than as drift, and it closes by merging #1264 — not by re-running anything.
Until it does, `47 rows / 47 files / 0 pending` is the ledger's fact on both branches and
`46 files / 47 rows` is `main`'s.

## 3. The drift check — `pnpm db:verify`, both branches, verbatim

### Production — 4 violations, all `V31`, exit 1

```text
  · target: ep-winter-block-b4bkk1xc.c-6.us-east-2.aws.neon.tech (NEON_BRANCH=production)
  · invite: 31 invitation(s), 9 with no relationship_id (0040 fills every one; want 0)
  · session state: 17 active, 18 draft of 35 session(s) — a draft is the "invited but not started" count, and every draft lacks a Counterparty seat while every active one has it (V33 fails, not reports)
  · session state: 14 active session(s) whose relationship mirror (counterparty_user_id) is NULL — the seat is the fact, this column is the seed's mirror
  · schema: 46 files · 46 applied · 0 pending — the ledger is level with db/migrations
✗ db:verify — 4 violation(s)
  V31  relationship "relationship-assessment-instance-avery-rowan" (avery-rowan): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
  V31  relationship "relationship-assessment-instance-marco-priya" (marco-priya): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
  V31  relationship "relationship-assessment-instance-noor-iris" (noor-iris): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
  V31  relationship "relationship-assessment-instance-ruth-sam" (ruth-sam): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
```

**Scope, because a total without one is not a measurement.** The run above counted exactly these
rules and no others: `V31` ×4 as violations. The same run also prints four `V18 permitted` lines —
those are the allow-listed `UPDATE session` sites (`lib/account/purge.ts` ×2,
`lib/admin/relationship-ops.ts`, `lib/flow/store.ts`), **not** violations, and they are printed on a
green run too. Every other rule — `V1`–`V30` and `V32`–`V33`, including the schema checks, the
version-binding rules (`V4`, `V23`) and the seat rules (`V5`, `V33`) — reported nothing.

**The four violations are not migration drift.** `V31` compares the seeded relationships' `status`
to the lifecycle `data/assessments.ts` authors, and every one of the four says the same thing: the
row is `active`, the fixture says `complete`. No migration is missing and none is mis-applied. What
has moved is the _data_: the fixture's lifecycle and the seeded rows disagree, and `db:verify`'s own
remedy is `pnpm db:seed`, which this page must not run (it writes rows, and it deletes and
re-creates the branch's auth accounts first).

Fixing them is a card. It is **not** this one, and the "remedy" in the violation text is only safe
on a branch nobody else is using.

### Demo — 0 violations, exit 0

```text
  · schema: 46 files · 46 applied · 0 pending — the ledger is level with db/migrations
✓ db:verify — 31 session(s) checked, 31 template(s) resolved, … , no drift
```

Demo is the clean branch: 31 sessions against production's 35, and none of the `V31` mismatch. The
distinction matters for anyone reading the release gate — "verified" is true on demo and false on
production today, and the two are not the same claim.

## 4. The classification — and why it is empty

The card asks for each **unapplied** migration to be marked `safe`, `backfill`, `destructive` or
`blocked`. There are **zero unapplied migrations on either branch**, so all four words have an empty
row set: no migration needs a window, none needs the owner's decision, and none is waiting on
another. That is the answer, and it is the strongest single fact on this page.

What the same four words say about the _other_ question — replaying all 47 against a fresh branch,
which is what a new environment or a restored project actually does — is `Rows` in the table
above, counted from that table rather than added up by hand:

| Replay class                | Migrations                                                                                               | What it needs                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `safe` (DDL only)           | 35                                                                                                       | nothing — one pass, no window |
| `backfill` (writes rows)    | `0006` `0008_alignment_setting` `0013` `0014` `0023` `0026_template_version` `0030` `0031` `0040` `0041` | one pass in filename order    |
| `destructive` (deletes)     | `0018`                                                                                                   | nothing on an empty branch    |
| `upsert` (writes catalogue) | `0042_billing_plan_prices`                                                                               | nothing — convergent          |
| `blocked` (ordering)        | none                                                                                                     | ordering is the filename      |

35 + 10 + 1 + 1 = the 47 files; no file is in two classes except `0018`, whose upsert and its narrow
`DELETE` are one statement pair. `0043` is DDL only and adds one to the `safe` row.

Two things need ordering, and both are already guaranteed by the filename sort:

1. **`0006` / `0008_alignment_setting` before `0013`.** They `UPDATE assessment_instance` and
   `opinion`; `0013` renames those rows into `relationship` + `session`. Run out of order and the
   backfills would target tables that no longer exist under those names.
2. **`0026_template_version` before `0039` / `0040`.** Both reference `relationship.template_version_id`
   and the version row a copy is validated against.

`0018` is the only file containing a `DELETE`, and it is narrow — two literal ids (`pro`,
`enterprise`), guarded by `billing_subscription_plan_fk`, which makes a re-run on a database that
still sells one of them **fail and roll back** rather than rewrite a paid subscription. On a fresh
branch it matches nothing.

One replay quirk worth knowing before anyone runs all 47 against an empty branch: `0006` and
`0008_alignment_setting` write values keyed to the **demo fixture's slugs**. On a branch with no
seeded rows they update zero rows and report success — nothing fails, and nothing is filled in.

## 5. What stands between here and 2.0 official

The owner's gate is that every migration is applied and verified before the repo moves accounts.
**Applied is done** — 47 files, 47 ledger rows, the same 47 names, no orphan in either direction, on
**both** branches. That half of the gate is not a feeling: it is a `comm` that printed nothing, run
twice.

**Verified is not done, on production.** Four `V31` rows say the seeded relationships carry a
lifecycle the fixture no longer authors; they are the only violations the run reports, and they are
data, not schema, so no migration will close them and no new file belongs in `db/migrations/`. The
repair is a seed on a branch that is not being read by anyone else, and it is the lead's call which
branch that is. Demo already reads 0.

Two things sit _beside_ the gate rather than in front of it, and neither blocks the transfer
mechanically: the four duplicate prefixes (`#1249` covers one of them — three need naming there) and
the ledger's inability to tell a corrected body from the one that ran. Both are defects of _process_,
not of the database, and both are one card each.

> **0 migrations unapplied on either branch, 4 verification violations on production and 0 on demo,
> and the transfer is blocked until production's four are zero.**

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Migration inventory · prev [Migrations](migrations.md) · next [Orchestration rules](orchestration.md)

<!-- docs-nav:end -->
