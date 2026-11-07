# Account deletion — the personal-data inventory, the shared record, and the auth-side path

Scope: the **specification** for deleting a participant's account, not the build. Issue #278 stays
open; this document is the answer that must exist before the build starts, and §7 is the plan that
build follows.

The record is shared: one `session` has two `party` rows (`initiator`, `counterparty`). Deleting one
participant must not destroy the other participant's completed report, and must not leave that
report — or anything else — resolvable back to a person. Nothing in the tree encodes either
guarantee today.

Authority: `db/migrations/*.sql` (33 files) is the real column list, `lib/flow/**` and `lib/db/**`
are the read path, and §4 is a **live probe** of the auth servers, not a reading of the SDK's type
declarations. Where a decision is a policy decision the product has not made, this document says so
instead of inventing one.

## 0. What changed since the first revision

The spec landed once before (PR #293, 2026-10-31) and has since gone stale in ways that matter — two
of its claims are now wrong, not merely dated. This revision replaces it:

| First revision said                                                    | Today                                                                                                  |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `assessment_instance`, `instance_invite`, `party.instance_record_id`   | `session`, `session_invite`, `party.session_record_id` (`0013_relationship_sessions.sql` renamed them) |
| the inventory stops at `0008`                                          | 24 migrations later: billing, audit, support, broadcast, email, password reset, template versions      |
| "no billing table in `db/migrations/`; nothing to retain"              | `billing_subscription`, `billing_event`, `plan_grant` exist — a real retention exception (§6)          |
| `deleteUser` is a top-level SDK endpoint, `POST /api/auth/delete-user` | the **route is not mounted**: authenticated `POST /delete-user` answers `404` (§4)                     |
| `session_invite.email`/`counterparty_name`/`token_hash` are "set NULL" | all three are `NOT NULL`; the row is deleted instead (§2.6)                                            |
| auth-side delete runs _after_ the `public` scrub commits               | auth-first, so a failed scrub cannot leave a live account (§7, step 3)                                 |

## 1. Personal-data inventory

Every table in `public` with a column that identifies a person, plus the managed `neon_auth` schema.
Disposition is what happens to the row when **that** person deletes their account; the other
party's columns are untouched.

Method: read the migrations in filename order and the read path in `lib/flow/**` and `lib/db/**`. No
user table was `SELECT *`-ed, and no real personal data was read to write this.

### 1.1 Rows keyed by a person identifier

| Table.column                                                                         | Holds                                                   | Disposition                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `user_profile.user_id` (PK)                                                          | the auth account id — the join key to `neon_auth`       | **delete row**                                                                              |
| `user_profile.handle`, `display_name`, `bio`, `country`, `country_code`, `role`      | the profile a person writes                             | **delete row** (also frees `handle`, which is `UNIQUE`)                                     |
| `user_profile.joined_at`, `updated_at`, `tour_seen_at`                               | behavioural instants                                    | **delete row**                                                                              |
| `party.user_id`                                                                      | which account holds this seat                           | **set NULL** — see §3                                                                       |
| `party.name`                                                                         | the participant's name (`NOT NULL`)                     | **anonymise** → `Deleted account`                                                           |
| `party.access_token_hash`                                                            | SHA-256 of the seat's bearer token — a credential       | **set NULL**                                                                                |
| `party.unlock_seen_at`                                                               | "this person opened a complete session"                 | **set NULL**                                                                                |
| `party.impersonated_by`                                                              | which operator accepted on this seat's behalf           | **set NULL**                                                                                |
| `party.submitted_at`, `party.accepted_at`                                            | when this seat submitted, when it accepted              | **retain** — a `complete` session requires them (§2.3)                                      |
| `relationship.initiator_user_id`                                                     | which account created the relationship                  | **set NULL**                                                                                |
| `relationship.counterparty_user_id`                                                  | which account is the other side                         | **set NULL**                                                                                |
| `relationship_member.user_id`                                                        | the membership row for a joined party                   | **delete row**                                                                              |
| `coach_invite.email`, `invited_by_user_id`, `token_hash`                             | an unclaimed coach invitation                           | **delete row** where invited by them, or addressed to their email                           |
| `session_invite.email`                                                               | the Counterparty's address (`NOT NULL`)                 | **delete the whole row** when the Counterparty leaves (§2.6); otherwise **retain**          |
| `session_invite.counterparty_name`                                                   | the Counterparty's name (`NOT NULL`)                    | same as above                                                                               |
| `session_invite.initiator_email`                                                     | the Initiator's address (nullable)                      | **set NULL** when the Initiator leaves; otherwise **retain**                                |
| `session_invite.token_hash`                                                          | SHA-256 of the invitation link (`NOT NULL UNIQUE`)      | same row decision as `email`                                                                |
| `session_invite.revoked_by`                                                          | which operator revoked it                               | **set NULL**                                                                                |
| `session.voided_by`                                                                  | which operator voided the session                       | **set NULL**                                                                                |
| `record.author_user_id`                                                              | who authored the template                               | **set NULL**                                                                                |
| `record.owner_user_id`                                                               | who owns a `visibility = 'private'` template            | **set NULL** + archive the record (§1.3)                                                    |
| `template_version.published_by`                                                      | who published a version                                 | **retain** — the row is immutable by trigger; the id is pseudonymous (§6)                   |
| `billing_subscription.user_id`                                                       | which account bought the plan                           | **retain** — accounting record; the id is pseudonymous (§6)                                 |
| `plan_grant.granted_by`                                                              | which operator granted a tier                           | **retain** — operator audit                                                                 |
| `admin_action.actor_user_id`                                                         | which operator took an audited action                   | **retain**, with `before`/`after` redacted (§6)                                             |
| `admin_invite.email`, `invited_by`, `token_hash`                                     | an operator invitation                                  | **delete row** by email                                                                     |
| `broadcast_send.actor_user_id`                                                       | which operator sent a broadcast                         | **retain** — operator audit                                                                 |
| `broadcast_recipient.email`                                                          | who a broadcast went to                                 | **retain** with the send, then purge (§6)                                                   |
| `contact_message.name`, `email`, `message`, `assigned_user_id`                       | a support request and who handled it                    | **delete row** (default; §6 states the hold exception)                                      |
| `contact_message.ip_hash`, `user_agent`                                              | request evidence                                        | **delete row**                                                                              |
| `contact_reply.author_user_id`                                                       | which operator replied                                  | **retain** body; **set NULL** author only if the _operator_ deletes                         |
| `news_signup.email`, `source`, `bounced_at`, `complained_at`, `unsubscribed_at`      | a marketing signup                                      | **retain email + `unsubscribed_at` as a suppression row**, drop `source` (§6)               |
| `email_event.recipient`, `subject`, `payload`, `ip_hash`                             | delivery events                                         | **retain 90 days then purge** (§6)                                                          |
| `password_reset.email`, `user_id`, `token_hash`, `requester_hash`                    | a reset request                                         | **delete rows** by email and user id                                                        |
| `demo_account.email`, `user_id`, `password`                                          | the three seeded demo accounts                          | **out of scope** — `@demo.alignsynch.test`-pinned, recreated and deleted by every `db:seed` |
| `neon_auth.user`, `neon_auth.account`, `neon_auth.session`, `neon_auth.verification` | identity, linked providers, sessions, verification rows | **delete** — via the auth path, §4                                                          |

Tables in `public` with **no** person reference, listed so the coverage claim is checkable:
`item`, `response_option`, `assessment_instance`'s successor `session` except `name`/`voided_by`,
`opinion`, `step`, `billing_plan`, `billing_event`, `template_version.payload` except
`authorUserId`, `schema_migrations`.

### 1.2 Identity embedded in prose and in labels

Three columns hold a person's name as **free text**, so no `user_id` sweep reaches them:

| Table.column                            | Where it is written                                                    | Disposition                                                      |
| --------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `record.summary`                        | `lib/flow/store.ts:480` — `` `${title}, answered by ${a} and ${b}.` `` | rewrite: replace the deleted party's name with `Deleted account` |
| `session.name`                          | `0011_console_columns.sql`, an optional label on the session           | same rewrite                                                     |
| `coach_invite` / `session_invite` names | §1.1                                                                   | covered by the row decision above                                |

The rewrite is an exact-substring replacement of the party's own `party.name` value, applied inside
the same transaction that anonymises the seat — one mechanism, three columns. `party.name` must be
read **before** it is rewritten, or the search string is lost.

### 1.3 The private template an account owns

`record.owner_user_id` + `record.visibility` (`0029`) make a template reachable by one account. When
that account goes, the record is **archived and de-owned**, never deleted: `record` is referenced by
`template_version.template_record_id` and `session.record_id` without `ON DELETE CASCADE`, and a
delete would either fail or cascade — and a cascade would destroy the surviving party's session.
`status = 'archived'`, `owner_user_id = NULL`, `visibility` untouched, is unreachable because every
library read filters on `owner_user_id`.

### 1.4 What #278 named, and what it missed

#278 named: `user_profile`, the auth user, `party.user_id`, `opinion`, `instance_invite.email`,
`neon_auth.user`/`neon_auth.account`. Read against the schema, the ones it **missed** are:

- every identity column on the seat itself — `party.name`, `party.access_token_hash`,
  `party.unlock_seen_at`, `party.impersonated_by`;
- every name baked into prose and labels — `record.summary`, `session.name`;
- the whole invitation row — `session_invite.counterparty_name`, `initiator_email`, `token_hash`,
  `revoked_by` (all `NOT NULL` or credential-bearing, so "set NULL" was not implementable);
- the relationship model that landed after the issue was written — `relationship.*_user_id`,
  `relationship_member.user_id`, `coach_invite.*`;
- the operator and financial tables — `admin_action.actor_user_id`, `admin_invite.email`,
  `broadcast_send.actor_user_id`, `broadcast_recipient.email`, `plan_grant.granted_by`,
  `template_version.published_by`, `contact_message.assigned_user_id`, `contact_reply.author_user_id`;
- the email-keyed public tables that hold a person's address with no `user_id` at all —
  `news_signup.email`, `email_event.recipient`, `contact_message.email`, `password_reset.email`;
- `record.author_user_id` / `record.owner_user_id`.

That last group is the one with a sequencing consequence: **the account's email is the only key**
for those tables, and it exists only in `neon_auth.user`. It must be read before the auth user is
deleted (§7, step 2).

## 2. The shared-record rule

### 2.1 The rule

A seat's **identity** is deleted; a seat's **answers** are retained. The answers belong to the other
participant's report, and the identity is what must not survive. Retaining `opinion` rows without the
seat's identity is a property the schema already has: `opinion` carries **no author column**, so the
author is the `(session_record_id, role)` key into `party`, and that row is anonymised.

### 2.2 What the survivor sees, screen by screen

Assuming the session was `complete` before the deletion (the interesting case):

| Screen                                      | Before                              | After                                                                              |
| ------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `/assessment/instances`                     | the session, named, `complete`      | still listed, still `complete`, one seat reading `Deleted account`                 |
| `/assessment/instances/[instanceId]`        | both names, both progress columns   | one name, `Deleted account`; both columns still present (`lib/flow/screen.ts:331`) |
| `/assessment/instances/[instanceId]/report` | the Gap, per Aspect, both parties   | unchanged — the same Gap over the same two sets of answers                         |
| `/dashboard/relationships`                  | the relationship, both participants | unchanged except the seat label; `counterparty_user_id` is `NULL`                  |
| `/admin/console/relationships`              | `name`, `has_account: true`         | `name: "Deleted account"`, `has_account: false` (`lib/db/admin-instances.ts:130`)  |
| `/profile/<handle>` of the deleted person   | their profile                       | **404** — the `user_profile` row is gone                                           |

The survivor's session list is unaffected: it filters `WHERE vp.user_id = $1` on **their own** seat
(`lib/db/my-instances.ts:123`), which the deletion never touches.

### 2.3 The Gap report

The report stays complete, and this is a **hard constraint on the rule**, not a nice-to-have.
`instanceStatusOf` returns `complete` only when both parties exist, both have answered every Aspect,
and **both** have `party.accepted_at` set (`lib/flow/state.ts`). So:

- deleting the `opinion` rows would flip the status to `answering` and the survivor's report would
  render empty — a data-loss bug wearing a privacy feature's clothes;
- setting `party.accepted_at = NULL` would do the same thing with one column;
- `session.voided_at` **outranks every count**, so voiding a complete session would hide the report.

All three are therefore forbidden on a complete session. The deleted party's answers remain readable
by the survivor, which the survivor was always entitled to; what is gone is any way to attribute them
to a person.

### 2.4 The incomplete session

If the session was **not** complete when the account went, there is no report to protect. The honest
outcome is `voided`: `session.voided_at = now()`, `voided_by = NULL`, and the survivor sees the
session as `voided` rather than as perpetually waiting for someone who cannot answer. `voided` is
already terminal and already renders (`lib/flow/state.ts`, #503) — no new state is introduced.

### 2.5 Proof of no leak

The queries that would have shown the deleted person's answers beside their identity, and why they
no longer can:

| Query                                                                                                | What it would have exposed                     | Why it cannot now                                                                       |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `GAP_ROWS_SQL` (`lib/db/gap-rows.ts`) — both roles' answers side by side per Aspect                  | the answers, labelled by seat                  | still returns both roles; the label comes from `party.name`, which is `Deleted account` |
| `admin-instances.ts:130` — `json_build_object('name', p.name, 'has_account', p.user_id IS NOT NULL)` | a name plus "this seat has a live account"     | `name` is the label and `has_account` is `false`                                        |
| `screen.ts:331` — `initiatorName` / `counterpartyName` from `party.name`                             | the name on the report                         | the label                                                                               |
| `account-providers.ts:54` — `neon_auth."user" u JOIN neon_auth."account" a`                          | the linked providers for the account           | the auth rows are deleted, so the join has no row to return                             |
| `my-instances.ts:123` — `WHERE vp.user_id = $1`                                                      | the deleted person's own session list          | `party.user_id` is `NULL`, so the filter matches nothing                                |
| `record.summary` in any list or email                                                                | `"<Template>, answered by <name> and <name>."` | rewritten                                                                               |

The residual fact is the survivor's **scores**, retained by design. They are no longer joined to a
name, an address, or an account — which is the guarantee #278 asks for.

## 3. `party.user_id`, the FK, and the migration

### 3.1 Decision: nullable, and it already is

`party.user_id` is `TEXT` with no `NOT NULL` (`0005_demo_account.sql`), and the migration's own
header states what `NULL` means: _"not 'an unknown user' but 'nobody signed in as this party'"_.
Anonymising instead of nulling would need a sentinel value in a column whose schema already has an
honest empty value, and would collide with the partial unique index
`party_session_user_key (session_record_id, user_id) WHERE user_id IS NOT NULL` the moment two
deleted accounts sat in one session. **No schema change is required for nullability.**

### 3.2 There is no FK, and that is deliberate

No `user_id` column in `public` is a foreign key, to `neon_auth` or to `user_profile`:

- `0003_user_profile.sql` states the rule — _"The app never migrates or constrains Neon's managed
  schema… a profile whose user was deleted in the managed schema is an orphan row, not a broken
  constraint"_;
- `0005` adds `party.user_id` as a bare `TEXT`;
- `0009_billing.sql` repeats it for `billing_subscription.user_id`;
- `0013`/`0014` add `relationship.*_user_id` and `relationship_member.user_id` the same way.

Consequences the build must respect:

- **nothing cascades.** Postgres will not clean up a single row when the auth user goes; the sweep is
  application-sequenced, in one transaction, and its idempotence is the build's responsibility;
- **`ON DELETE` behaviour is "not applicable"**, and adding an FK is not the fix: it would constrain
  a schema the app does not own, and it would make the auth-side delete fail on a locked table;
- the orphan is detectable, which is what makes `db:verify` able to police it (§7, step 5).

### 3.3 The inner-join audit

The failure mode asked about is an inner join that drops the **surviving** party's row once a seat's
`user_id` is `NULL`. Every `JOIN`/`LEFT JOIN` that reaches a person table was read:

| Site                                                                                                             | Direction                              | Effect of a `NULL` user id                                                                          |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `lib/flow/membership.ts:98` — `WHERE s.relationship_id = $1 AND p.user_id = $2`                                  | filter, not a join                     | matches no seat — correct: the deleted person cannot enter                                          |
| `lib/db/my-instances.ts:123` — `WHERE vp.user_id = $1`                                                           | filter on the viewer's own seat        | empty list for the deleted person; the survivor's own filter is untouched                           |
| `lib/db/assessments.ts:595-604` — the `mine` CTE: `relationship_member.user_id = $1` **or** `party.user_id = $1` | membership test, two independent paths | the survivor matches on theirs; the deleted person matches on neither                               |
| `lib/db/assessments.ts:680` — `LEFT JOIN party vp ON … AND vp.user_id = $1`                                      | left join, extra predicate             | the viewer's seat resolves or is NULL; **no relationship or session disappears from anyone's list** |
| `lib/db/billing.ts:297-299` — `FROM party vp … WHERE vp.user_id = $1`                                            | filter                                 | matches nothing — the deleted account is not counted                                                |
| `lib/db/admin-billing.ts:149` — `LEFT JOIN user_profile p ON p.user_id = r.initiator_user_id`                    | left join                              | the relationship row survives, the profile columns are NULL                                         |
| `lib/db/admin-inbox.ts:179,192,244` — `LEFT JOIN user_profile …`                                                 | left joins                             | the message/reply survives, the assignee columns are NULL                                           |
| `lib/db/demo-accounts.ts:57` — `FROM demo_account da JOIN user_profile up`                                       | **inner** join                         | demo-only table, `db:seed`-managed; not reachable for a real account                                |
| `lib/admin/audit-log.ts:280` — `LEFT JOIN neon_auth."user"`                                                      | left join                              | the audit row survives; the actor's email is NULL                                                   |

**Result: no inner join from `party` to `user_profile` exists anywhere in the read path**, so no
current query silently loses the surviving party's row. The single inner join on `user_profile` is
demo-only.

### 3.4 The migration: `db/migrations/0033_account_deletion.sql`

The build needs exactly one migration, and it adds **no column and no constraint** — it is the index
set the erasure sweep needs, because the sweep filters by `user_id` on tables whose indexes do not
lead with it:

```sql
-- party: the partial UNIQUE (session_record_id, user_id) cannot serve WHERE user_id = $1
CREATE INDEX IF NOT EXISTS party_user_idx
  ON party (user_id) WHERE user_id IS NOT NULL;

-- relationship: the only existing index leads with initiator_user_id
CREATE INDEX IF NOT EXISTS relationship_counterparty_user_idx
  ON relationship (counterparty_user_id) WHERE counterparty_user_id IS NOT NULL;

-- relationship_member: UNIQUE (relationship_id, user_id) does not lead with user_id
CREATE INDEX IF NOT EXISTS relationship_member_user_idx
  ON relationship_member (user_id);

-- the support tables, reached by the operator id rather than by user id today
CREATE INDEX IF NOT EXISTS contact_message_assignee_idx
  ON contact_message (assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contact_reply_author_idx
  ON contact_reply (author_user_id);

-- a private template the deleted account owned
CREATE INDEX IF NOT EXISTS record_owner_user_idx
  ON record (owner_user_id) WHERE owner_user_id IS NOT NULL;
```

`0033` is the next free sequence (`0032` is the highest; `0026` and `0028` already ship as duplicate
pairs). It is index-only and `IF NOT EXISTS`-idempotent, so applying it to a database that has
already been swept is a no-op.

## 4. The auth-side deletion path — probed, not assumed

`neon_auth.user` / `account` / `session` are Neon's managed Better Auth schema and the app never
migrates them, so the deletion must go through an API. The previous revision asserted the endpoint
existed by reading `@neon/auth`'s endpoint table. **The SDK carrying a path is not the server
mounting it**, so this was probed against both live auth servers on 2026-11-07.

### 4.1 What was probed

- demo: `ep-crimson-truth-b4ppwxrp.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth` (`NEON_BRANCH=demo`)
- production: `ep-winter-block-b4bkk1xc.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth`

Unauthenticated requests first, then one authenticated session created on **demo only** (a throwaway
account, deleted immediately afterwards and verified gone — sign-in now answers
`401 INVALID_EMAIL_OR_PASSWORD`). No production account was created, modified or deleted.

### 4.2 Results

Both branches answered identically:

| Method   | Path                                                                              | Auth        | Status | Body                                                |
| -------- | --------------------------------------------------------------------------------- | ----------- | ------ | --------------------------------------------------- |
| `GET`    | `/ok`                                                                             | none        | `200`  | `{"ok":true}`                                       |
| `POST`   | `/sign-up/email`                                                                  | none        | `200`  | a session + user                                    |
| `POST`   | `/get-session`                                                                    | session     | `200`  | the session                                         |
| `POST`   | `/sign-out`                                                                       | session     | `200`  | `{"success":true}`                                  |
| `POST`   | `/update-user`                                                                    | session     | `400`  | `No fields to update` — route exists                |
| `POST`   | **`/delete-user`**                                                                | none        | `401`  | `Unauthorized` — the outer auth gate                |
| `POST`   | **`/delete-user`**                                                                | **session** | `404`  | **empty body — no such route**                      |
| `POST`   | `/delete-user` (`{"callbackURL":"/"}`)                                            | session     | `404`  | empty body                                          |
| `POST`   | `/user/delete-user`, `/account/delete`                                            | session     | `404`  | empty body                                          |
| `POST`   | `/admin/remove-user` (`{}`)                                                       | session     | `400`  | `[body.userId] Invalid input: expected nonoptional` |
| `POST`   | `/admin/remove-user` (`{"userId": …}`)                                            | session     | `403`  | `You are not allowed to delete users`               |
| `POST`   | `/definitely-not-a-real-route-xyz`                                                | session     | `404`  | control: same answer as `/delete-user`              |
| `DELETE` | `/api/v2/projects/{project}/branches/{branch}/auth/users/{id}` (Neon project API) | API key     | `204`  | empty body — **the account was deleted**            |

### 4.3 What this means — the finding

**There is no self-service user-deletion endpoint on these auth servers.** `POST /delete-user` is
`404` when authenticated, which is the same answer a path that does not exist gives. The
unauthenticated `401` is the server's outer gate answering every protected path, so it is **not**
evidence of a route — reading it as one is exactly the mistake this card exists to prevent.

The SDK's `deleteUser` entry is therefore inert on this deployment: `@neon/auth@^0.8.2` may carry the
path, but the server does not mount it. Better Auth only exposes it when the deployment enables
`user.deleteUser`, and Neon's Managed Auth does not.

Two deletion routes **do** exist:

1. **Neon project API — `DELETE /api/v2/projects/{project_id}/branches/{branch_id}/auth/users/{user_id}`**,
   authenticated with a Neon API key. Probed live: `204`, and the user could no longer sign in. `GET`
   on the same path answers `405` (only `DELETE` is exposed), which is why a list-then-delete design
   cannot be built on it — the id must be known, and it is, because it is the session's `user_id`.
2. **Managed Auth admin route — `POST {base}/admin/remove-user` with `{"userId": …}`**, gated on the
   caller's _auth-side_ role: a normal user gets `403 YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS`. The app
   does not hold an auth-side admin: `user_profile.role` (`member|support|admin|owner`) is a
   **second** role system, and a sign-up is minted with `"role":"user"` in `neon_auth.user`. So this
   route is available to an operator only if an auth-side admin account exists, which is a build-plan
   check, not an assumption.

## 5. Timing and what the policy may say

**Deletion is in the app, immediate, and irreversible the moment the confirmation phrase is
accepted.** The settings control calls §4.1's project-API route, which deletes the auth user first
and scrubs `public` in one transaction (§7). There is no soft-delete window, no scheduled purge, no
"deactivated" state and no grace period — a grace period is a policy decision the product has not
made, and the copy does not imply one, because the code has none.

The app says this (the settings control's body, `data/pages/settings.ts` → `deletion`); `/privacy`
(`data/pages/legal.ts` → `retention`/`deletion`) carries the same claims plus the §6 retention rows,
and neither promises anything the other does not:

> Deleting your account is immediate and irreversible, and you can do it yourself from Account
> settings while signed in: there is no grace period, and no way to restore what is deleted. Your
> profile, your invitations, and the details that identify you in any shared assessment are removed
> permanently. Assessments you took part in remain for the other participant, with your seat shown
> as "Deleted account"; your answers stay only as part of their completed report and are no longer
> linked to your name, email or account. Deletion cannot be undone and there is no grace period.

The app may **not** say any of the following:

- any deletion window — "within N days", "within N business days", "we will process it". A window
  reads as a grace period, and the reader has just been told there is none;
- "All your data is erased" — §2 and §6 retain the survivor's report, a suppression row and
  accounting records, and the sentence must name them.

**The operator path is a fallback, not the mechanism.** If the Neon auth call fails, §7's ordering
means nothing has been scrubbed and the account still works: the user sees an honest error and may
ask support to finish it by runbook. That is recovery from a failed request, never the product's
deletion route, and no copy may present it as one.

## 6. Retention exceptions

Each is a duration and a reason. "None apply" is stated where that is the honest answer.

| Data                                                                     | Retained                                 | Why                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `billing_subscription`, `billing_event`, `plan_grant`                    | **7 years**                              | Accounting/tax records of a paid plan. The rows carry a pseudonymous `user_id` and a provider id — no name, no email, no card. Today `BILLING_PROVIDER` defaults to `mock`, so this is a live obligation the moment a real provider charges anyone.              |
| `admin_action` (and its `before`/`after` JSONB)                          | **24 months**                            | Security/audit integrity. `before`/`after` may contain profile fields, so the sweep **redacts** those keys and keeps the action, actor and reason.                                                                                                               |
| `template_version.published_by`, `template_version.payload.authorUserId` | **indefinite**                           | The row is immutable by trigger (`0026_template_version.sql` raises on any update to `published_by`). A bare account id with no name or email is pseudonymous once the account is gone — no exception is being claimed, there is nothing personal left to erase. |
| `email_event`, `broadcast_recipient`, `broadcast_send`                   | **90 days**                              | Deliverability, bounce/complaint handling, and abuse investigation. `ip_hash` is a salted hash, not a reversible address.                                                                                                                                        |
| `news_signup` (email + `unsubscribed_at`)                                | **indefinite**                           | The suppression list. Without the address we cannot honour the opt-out and would email the person again — retaining it is the _less_ intrusive option. `source` is dropped.                                                                                      |
| `contact_message` / `contact_reply`                                      | **24 months**, then deleted              | Support correspondence. Deleted immediately on request unless a dispute is open.                                                                                                                                                                                 |
| Fraud / abuse logs beyond the above                                      | **none apply**                           | No dedicated abuse-log table exists. The only evidence is the hashed `ip_hash` on `contact_message` and `email_event`, covered by the rows above.                                                                                                                |
| Legal hold                                                               | **none apply — and no mechanism exists** | There is no hold flag. If litigation is anticipated an operator must suspend deletion for that account by hand, and the runbook must say so rather than imply a feature.                                                                                         |

The deliberate non-exception is §2: the deleted party's `opinion` rows and anonymised seat remain
because they are the **other** participant's report. That is the other person's data, not the deleted
person's data retained against their wishes.

One flag that belongs to the operator, not the app: Neon's managed auth infrastructure may keep
server-side logs on Neon's side. That is outside this repo's data and must be named in the privacy
text when `/privacy` lands (#270).

## 7. Build plan for the follow-up card

Ordered, and the order is load-bearing: the auth deletion comes **before** the `public` scrub, so a
failed scrub can never leave an account that can still sign in. Every step after 2 is idempotent, and
the whole sequence is safe to re-run.

1. **`db/migrations/0033_account_deletion.sql`** — the index set in §3.4. Apply with `pnpm db:migrate`,
   then `pnpm db:verify` must be unchanged (no new table, no new column, no `gap`).
2. **Read the identity before destroying it.** One read of `neon_auth.user` for `{ id, email }`, and
   of `party.name` for each seat the account holds. The email is the only key for `news_signup`,
   `email_event`, `contact_message`, `password_reset`, `admin_invite`; the name is the search string
   for §1.2. Both are consumed in step 4.
3. **Delete the auth user** — `DELETE /api/v2/projects/{project_id}/branches/{branch_id}/auth/users/{user_id}`
   with a server-only Neon API key (`NEON_API_KEY` is already project-scoped in `.env`; it must be
   read on the server and never reach a bundle). Expect `204`. On failure, stop: nothing has been
   scrubbed, the account still works, and the request can be retried.
4. **Scrub `public` in one transaction** (`lib/account/purge.ts`), in this order:
   session state (void incomplete sessions; never a complete one) → `session_invite` row decision →
   `record.summary` / `session.name` rewrite → `party` anonymise → `relationship` /
   `relationship_member` → `coach_invite` / `admin_invite` / `password_reset` deletes →
   `record` ownership archive → `user_profile` delete → `contact_message` delete → `news_signup`
   suppress. Return a count per table so a run is auditable.
5. **`db:verify` gains one rule** — no `user_profile` row whose `user_id` is absent from
   `neon_auth.user`, and no `party.user_id` that resolves to nothing while its seat's session is
   still `complete`. `0003`'s header already blesses `db:verify` as the orphan reporter.
6. **The server action and the UI.** `deleteAccountAction` (session required, confirmation phrase
   typed, no CSRF-free GET) in `app/(mainlayout)/settings/delete-account-actions.ts`, rendered by
   `components/identity/delete-account-card.tsx` on the surface `/settings` actually draws
   (`components/identity/settings-view.tsx`). The older `components/settings/security-settings.tsx`
   panel has no route since #164: its stale "not available in-app" sentence is corrected in place,
   and the control is not wired there. The action calls step 2 → 3 → 4 in that order.
7. **The policy text** — `/privacy` (#270) and the settings copy carry the §5 sentence, not a
   stronger one.

The tests that prove "deleted means gone, and the other party's report still works":

| Test                                                                                                | Proves                                                    |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| seed fixture → purge one party → every table in §1.1 has `0` rows or `NULL` for that person         | deleted means gone                                        |
| the survivor's session still answers `complete`, and `GAP_ROWS_SQL` returns both roles' answers     | the report survives                                       |
| `party.name` is the label, `admin-instances` `has_account` is `false`, `/profile/<handle>` is `404` | no identity is resolvable                                 |
| `record.summary` and `session.name` no longer contain the deleted party's name                      | the prose rewrite ran                                     |
| a session left incomplete is `voided`, not `answering`                                              | §2.4                                                      |
| the purge run twice changes nothing and returns the same counts                                     | idempotence, which is what makes step 4 retryable         |
| sign up a throwaway account on the **demo** branch, purge it, assert sign-in now answers `401`      | the auth-side call really deleted the account (§4)        |
| a purge whose auth call fails leaves every `public` row untouched                                   | the ordering in step 3, which is the one state §2 forbids |

Out of scope for this spec, each with its reason: **data export/portability** (GDPR Art. 20 — a
separate right, a separate mechanism, no reader exists today); **the build itself** (the card that
lands it needs its own gate and its own review); **regional variants** (CCPA/CPRA have their own
notice requirements that belong in `/privacy`, not in the schema); **an admin UI for operator-run
deletion** (the route in §4.3 is a runbook step, and a console surface is a product decision).
