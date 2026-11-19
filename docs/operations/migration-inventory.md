# The migration inventory — what is applied, what it would cost, and the 2.0-official gate

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Migration inventory · prev [Iteration rhythm](iteration.md) · next [Orchestration rules](orchestration.md)

<!-- docs-nav:end -->

Issue: none — the requirement is kanban card **t_a2c57a7b**, authored by the lead. This is a
**measurement**: it runs no migration, writes no row, and fixes nothing it finds. Every defect it
names is somebody else's card.

Measured **2026-11-19** against the production branch of the Neon project
(`NEON_BRANCH=production`, endpoint `ep-winter-block-b4bkk1xc.c-6.us-east-2.aws.neon.tech`), read
only, through the **unpooled** connection. `withenv.sh` loads `.env` then `.env.local` and
`.env.local` (demo) wins, so both reads here pin `.env` explicitly rather than trusting whichever
file set is on disk — a drift check that measures the demo branch is a drift check that measures
nothing.

## The measurement, in one table

| Fact                          | Value                                                      |
| ----------------------------- | ---------------------------------------------------------- |
| `db/migrations/*.sql` on disk | **46**                                                     |
| Rows in `schema_migrations`   | **46**                                                     |
| On disk, not applied          | **0**                                                      |
| Applied, not on disk          | **0**                                                      |
| Duplicate numeric prefixes    | **4 pairs** — `0008`, `0026`, `0028`, `0042`               |
| `db:verify` violations        | **4** — all `V31`, all four seeded relationships           |
| Newest applied instant        | `2026-11-18T02:38:31Z` (`0042_email_template_version.sql`) |
| Oldest applied instant        | `2026-10-30T17:58:23Z` (`0001_content_model.sql`)          |

The ledger and the directory are **the same set**, name for name. That is the whole good news of
this page, and it is narrower than it sounds: it says every file has been run once, not that the
body on disk is the body that ran.

## 1. The disk census — 46 files, in filename order

`Idem.` is per file: **yes** means every statement in the file re-runs clean (guarded by
`IF NOT EXISTS` / `IF EXISTS`, or convergent by `ON CONFLICT … DO UPDATE`), **yes\*** means the DDL
is guarded but the file also writes rows, **yes†** means it carries no explicit `IF` guard at all
and is idempotent only by construction (an `ON CONFLICT` upsert, or a constraint dropped by
scanning the catalogue). `Rows` is what the file does to data: `—` (DDL only), `backfill`,
`upsert`, or `delete`.

| #    | Migration                     | What it changes                                                            | Idem. | Rows            | Applied (UTC) |
| ---- | ----------------------------- | -------------------------------------------------------------------------- | ----- | --------------- | ------------- |
| 0001 | content_model                 | the six content tables that mirror `content/record.ts` + `assessment.ts`   | yes   | —               | 10-30 17:58   |
| 0002 | two_party_flow                | `party.access_token_hash`, `instance_invite`, the two key-read indexes     | yes   | —               | 10-30 18:39   |
| 0003 | user_profile                  | the profile a signed-in person owns, mirroring `content/identity.ts`       | yes   | —               | 10-30 18:50   |
| 0004 | user_profile_role             | `user_profile.role` as member or admin; widened to four rungs by 0023      | yes   | —               | 10-30 20:05   |
| 0005 | demo_account                  | `party.user_id` and the three seeded demo accounts                         | yes   | —               | 10-30 20:05   |
| 0006 | assessment_mode               | `assessment_instance.mode`, set from the fixture's own slugs               | yes\* | backfill        | 11-01 16:46   |
| 0007 | party_unlock_seen             | `party.unlock_seen_at` — the "I have read the unlock" mark                 | yes   | —               | 11-01 16:46   |
| 0008 | alignment_setting             | `assessment_instance.alignment_setting` (Soft/Full), backfilled            | yes\* | backfill        | 11-01 16:46   |
| 0008 | initiator_email               | `instance_invite.initiator_email` so the unlock notice can reach them      | yes   | —               | 11-01 16:46   |
| 0009 | billing                       | `billing_plan`, `billing_subscription`, `billing_event`, webhook dedupe    | yes   | —               | 11-01 16:46   |
| 0010 | invite_resend                 | `resent_at` / `resend_count` and the 24 h re-invite cooldown               | yes   | —               | 11-01 16:46   |
| 0011 | console_columns               | `record.author_user_id`, `assessment_instance.name`, `party.submitted_at`  | yes   | —               | 11-01 16:46   |
| 0012 | template_author_index         | the index `/assessment/templates` reads                                    | yes   | —               | 11-01 16:46   |
| 0013 | relationship_sessions         | splits `assessment_instance` into `relationship` + `session`               | yes\* | backfill        | 11-01 16:47   |
| 0014 | relationship_membership       | `relationship_member` — a coach is a role on the relationship              | yes\* | backfill        | 11-01 16:47   |
| 0015 | password_reset                | the app's own forgot-password tokens                                       | yes   | —               | 11-02 12:04   |
| 0016 | party_acceptance              | `party.accepted_at` — acceptance as an instant, never a status             | yes   | —               | 11-02 12:04   |
| 0017 | step                          | `step` — one row per derived Step for improving the relationship           | yes   | —               | 11-02 12:04   |
| 0018 | billing_plan_rows             | the three-tier catalogue as rows; retires `pro` and `enterprise`           | yes†  | upsert + delete | 11-02 13:35   |
| 0019 | news_signup                   | the footer's list, one row per address                                     | yes   | —               | 11-02 14:17   |
| 0020 | contact_message               | the `/help` form's inbox — a row is kept before it is mailed               | yes   | —               | 11-02 15:40   |
| 0021 | contact_message_address_index | the per-address throttle bucket beside the per-IP one                      | yes   | —               | 11-02 15:40   |
| 0022 | user_profile_tour_seen        | `user_profile.tour_seen_at` for the first-run tour                         | yes   | —               | 11-03 15:09   |
| 0023 | admin_role_audit              | four admin roles, the invitation, and `admin_action` (append-only log)     | yes\* | backfill        | 11-03 19:09   |
| 0024 | admin_action_actor_role       | `admin_action.actor_role` — the rung held **at the time**                  | yes   | —               | 11-03 19:09   |
| 0025 | relationship_operations       | `session.voided_at/voided_by`, `party.impersonated_by` for repairs         | yes   | —               | 11-03 19:09   |
| 0026 | billing_control               | `billing_subscription.livemode` and `plan_grant`                           | yes   | —               | 11-03 22:11   |
| 0026 | template_version              | `template_version` + `relationship.template_version_id`; immutable publish | yes\* | backfill        | 11-03 21:50   |
| 0027 | email_event                   | what the mail provider reports happened to a delivery                      | yes   | —               | 11-03 22:47   |
| 0028 | broadcast                     | `broadcast_send` and the bounce/complaint marks on `news_signup`           | yes   | —               | 11-04 00:41   |
| 0028 | support_inbox                 | `contact_message` triage status and one row per reply attempt              | yes   | —               | 11-04 00:06   |
| 0029 | record_ownership_visibility   | `record.owner_user_id` and `record.visibility`                             | yes   | —               | 11-04 09:32   |
| 0030 | relationship_lifecycle        | `relationship.status` + the three instants, backfilled from acceptance     | yes\* | backfill        | 11-04 09:32   |
| 0031 | session_round                 | `session.round` — a relationship is assessed in ordered rounds             | yes\* | backfill        | 11-04 09:32   |
| 0032 | relationship_lapse            | `relationship.expired_at` and `lapse_reason`                               | yes   | —               | 11-04 11:14   |
| 0033 | account_deletion              | six account-id indexes the erasure sweep filters on                        | yes   | —               | 11-07 14:38   |
| 0034 | account_deletion_job          | the identity a half-finished deletion must not lose                        | yes   | —               | 11-07 14:38   |
| 0035 | form_guard_attempt            | the window the two public forms count attempts over                        | yes   | —               | 11-07 15:20   |
| 0036 | relationship_payment          | `relationship_payment` — the charge moves to completion                    | yes   | —               | 11-07 19:59   |
| 0037 | review_artifacts              | four tables behind `/admin/review` (artifact, todo, issue, comment)        | yes   | —               | 11-08 00:08   |
| 0038 | admin_action_reason_optional  | `reason` nullable on both tables; the two `btrim` CHECKs dropped           | yes†  | —               | 11-11 17:58   |
| 0039 | session_aspects_authored_at   | `session.aspects_authored_at` — where a copy's Aspect list came from       | yes   | —               | 11-12 14:00   |
| 0040 | session_invite_relationship   | `session_invite.relationship_id`, backfilled, then `NOT NULL`              | yes\* | backfill        | 11-18 02:38   |
| 0041 | session_state                 | `session.state` (`draft` / `active`), backfilled                           | yes\* | backfill        | 11-18 02:38   |
| 0042 | billing_plan_prices           | the approved three-plan amounts as rows                                    | yes†  | upsert          | 11-18 02:38   |
| 0042 | email_template_version        | `email_template_version` — an admin's mail override as a version           | yes   | —               | 11-18 02:38   |

**Nothing on this list is non-idempotent.** The three without an explicit `IF` guard are
idempotent by construction: `0018` and `0042_billing_plan_prices` upsert on the `(id, interval)`
primary key so a second run writes the same rows, and `0038` drops its CHECK constraints by
scanning `pg_constraint` for the definition rather than guessing a name. The backfills are all
narrowed by a predicate (`WHERE … IS NULL`, `WHERE status = 'draft'`, `WHERE round <> …`), so a
re-run matches nothing.

### The duplicate prefixes — four pairs, not one

`#1249` names the `0042` pair and calls it the last. It is not the last; the same shape appears
three more times, and the ledger proves the pairs are already inconsistent about order:

| Prefix | Files (filename order)                           | Applied order                          |
| ------ | ------------------------------------------------ | -------------------------------------- |
| `0008` | `alignment_setting` → `initiator_email`          | same as filename (16:46:25.148 → .768) |
| `0026` | `billing_control` → `template_version`           | **reversed** (21:50 → 22:11)           |
| `0028` | `broadcast` → `support_inbox`                    | **reversed** (00:06 → 00:41)           |
| `0042` | `billing_plan_prices` → `email_template_version` | same as filename (02:38:30.450 → .088) |

`db:migrate` sorts by filename and keys the ledger on the **full name**, so nothing is skipped
and no database is wrong today — which is exactly `#1249`'s argument. What the applied instants add
is that "sorts by filename" is not what happened: the `0026` and `0028` pairs were applied in the
reverse of the order a fresh `db:migrate` would use, because each pair merged in the other order.
A fresh branch today replays those four pairs in a different order from production's history. That
is harmless while the pairs are independent, and it is not a property anything checks: the day one
pair gains a dependency, the branch that replays it differs from the branch that has it.

So `#1249`'s first acceptance box — _fail on two files sharing a numeric prefix, naming both_ —
must grandfather **four** pairs or the rule turns four existing pairs red. Its second box
("either grandfathered by an explicit allowlist, or documented as the last") currently reads as if
there is one. That is a comment on `#1249`, not a fix here.

### What this table cannot check, and the file that says so

The ledger is keyed on the **filename**. A migration whose body is corrected after it has been
applied never runs again — the ledger only knows the name matched. `0018_billing_plan_rows.sql`
documents a database in exactly that state in its own closing comment: an archived branch applied a
body that inserted nothing, `schema_migrations` says `0018` ran, and the corrected content cannot
run until somebody deletes the row by hand.

Production is **not** in that state — `V13` passes with zero violations, so `billing_plan` matches
`data/billing-plans.ts`, which is `0042_billing_plan_prices`' amounts in force. But the class of
defect exists, it is invisible from the census, and no check compares a file's current body to the
body that ran. Naming it is the most this inventory can do; comparing bodies would need a content
hash in the ledger, which is a schema change and therefore a card.

## 2. The applied census — read-only, against production

```sql
SELECT name, applied_at FROM schema_migrations ORDER BY name
```

`46` rows. Compared to `ls db/migrations/*.sql | xargs -n1 basename | sort` with `comm`, both
directions:

```text
applied=46 disk=46
--- applied but NOT on disk ---
--- on disk but NOT applied ---
```

Both lists are empty: the set on disk is the set in the ledger, exactly. **No orphan ledger row
exists** — the defect the card asked to look for (a row applied but missing from disk) is not
present, so it does not need its own card today. `db:verify` prints the same conclusion in its own
words: `schema: 46 files · 46 applied · 0 pending — the ledger is level with db/migrations`.

## 3. The drift check — `pnpm db:verify` against production, verbatim

The first line is the target proof, printed by the run itself; the four violation rows are
quoted unchanged.

```text
  · target: ep-winter-block-b4bkk1xc.c-6.us-east-2.aws.neon.tech (NEON_BRANCH=production)
  · schema: 46 files · 46 applied · 0 pending — the ledger is level with db/migrations
✗ db:verify — 4 violation(s)
  V31  relationship "relationship-assessment-instance-avery-rowan" (avery-rowan): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
  V31  relationship "relationship-assessment-instance-marco-priya" (marco-priya): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
  V31  relationship "relationship-assessment-instance-noor-iris" (noor-iris): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
  V31  relationship "relationship-assessment-instance-ruth-sam" (ruth-sam): status is "active", but data/assessments.ts authors "complete" — run `pnpm db:seed` (it writes the lifecycle its own dataset declares)
```

**The four violations are not migration drift.** `V31` compares the seeded relationships'
`status` to the lifecycle `data/assessments.ts` authors, and every one of the four says the same
thing: the row is `active`, the fixture says `complete`. No migration is missing and none is
mis-applied — `V1`–`V30` and `V32`–`V33` are all clean, including the schema checks. What has
moved is the _data_: the fixture's lifecycle and the seeded rows disagree, and `db:verify`'s own
remedy is `pnpm db:seed`, which this card must not run (it writes, and it deletes and re-creates
the branch's auth accounts first).

Fixing them is a card. It is **not** this one, and the "remedy" in the violation text is only safe
on a branch nobody else is using.

## 4. The classification — and why it is empty

The card asks for each **unapplied** migration to be marked `safe`, `backfill`, `destructive` or
`blocked`. There are **zero unapplied migrations**, so all four words have an empty row set: no
migration needs a window, none needs the owner's decision, and none is waiting on another. That is
the answer, and it is the strongest single fact on this page.

What the same four words say about the _other_ question — replaying all 46 against a fresh branch,
which is what a new environment or a restored project actually does — is `Rows` in the table
above:

| Replay class                | Migrations                                                                                               | What it needs                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `safe` (DDL only)           | 34                                                                                                       | nothing — one pass, no window |
| `backfill` (writes rows)    | `0006` `0008_alignment_setting` `0013` `0014` `0023` `0026_template_version` `0030` `0031` `0040` `0041` | one pass in filename order    |
| `destructive` (deletes)     | `0018`                                                                                                   | nothing on an empty branch    |
| `upsert` (writes catalogue) | `0042_billing_plan_prices`                                                                               | nothing — convergent          |
| `blocked` (ordering)        | none                                                                                                     | ordering is the filename      |

34 + 10 + 1 + 1 = the 46 files; no file is in two classes except `0018`, whose upsert and its
narrow `DELETE` are one statement pair.

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

One replay quirk worth knowing before anyone runs all 46 against an empty branch: `0006` and
`0008_alignment_setting` write values keyed to the **demo fixture's slugs**. On a branch with no
seeded rows they update zero rows and report success — nothing fails, and nothing is filled in.

## 5. What stands between here and 2.0 official

The owner's gate is that every migration is applied and verified before the repo moves accounts.
**Applied is done** — 46 files, 46 ledger rows, the same 46 names, no orphan in either direction.
That half of the gate is not a feeling: it is a `comm` that printed nothing.

**Verified is not done.** Four `V31` rows say the seeded relationships carry a lifecycle the
fixture no longer authors. They are data, not schema, so no migration will close them and no new
file belongs in `db/migrations/`; the repair is a seed on a branch that is not being read by
anyone else, and it is the lead's call which branch that is.

Two things sit _beside_ the gate rather than in front of it, and neither blocks the transfer
mechanically: the four duplicate prefixes (`#1249` covers one of them — three need naming there),
and the ledger's inability to tell a corrected body from the one that ran. Both are defects of
_process_, not of the database, and both are one card each.

> **0 migrations unapplied, 4 verification violations, and the transfer is blocked until both are zero.**

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Migration inventory · prev [Iteration rhythm](iteration.md) · next [Orchestration rules](orchestration.md)

<!-- docs-nav:end -->
