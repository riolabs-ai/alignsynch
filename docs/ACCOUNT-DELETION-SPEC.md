# Account deletion — what happens to a shared record when one participant leaves

Scope: the **specification** for deleting a participant's account, not the build. Issue #278 stays
open; this document is the answer that must exist before the build starts. The record is shared:
one `assessment_instance` has two `party` rows (`initiator`, `counterparty`). Deleting one
participant's account must not destroy the other participant's completed report, and must not
leave that report — or anything else — readable by a third party. Nothing in the tree encodes
either guarantee today; this document encodes them.

Authority: `db/migrations/*.sql` is the real column list (this document reads it, it does not
infer from the issue body). The read path is `lib/flow/store.ts` / `lib/flow/screen.ts`; the auth
side is `lib/auth/server.ts` and the Neon SDK the app already depends on. Where a decision is a
policy decision the product has **not** made, this document says so instead of inventing one.

## 1. Inventory — every table and column that holds personal data

Two namespaces. The app owns `public` (`db/migrations/0001–0008`); Neon owns `neon_auth`
(Managed Better Auth), which the app never migrates (`0001_content_model.sql:25`,
`AGENTS.md` "The database").

### `public` (the app's schema)

| Table             | Column                             | Holds                                                                                                                                    | Source                       |
| ----------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `user_profile`    | `user_id`                          | the auth account id — the join key to `neon_auth`                                                                                        | `0003_user_profile.sql`      |
| `user_profile`    | `handle`                           | the URL identity `/profile/<handle>`, unique                                                                                             | `0003`                       |
| `user_profile`    | `display_name`                     | the name                                                                                                                                 | `0003`                       |
| `user_profile`    | `bio`                              | one paragraph, nullable                                                                                                                  | `0003`                       |
| `user_profile`    | `country`, `country_code`          | ISO-3166 label + alpha-2, both-or-neither                                                                                                | `0003`                       |
| `user_profile`    | `role`                             | `member` \| `admin`, `DEFAULT 'member'`                                                                                                  | `0004_user_profile_role.sql` |
| `user_profile`    | `joined_at`, `updated_at`          | instants                                                                                                                                 | `0003`                       |
| `party`           | `name`                             | one participant's name (both seats)                                                                                                      | `0001_content_model.sql`     |
| `party`           | `user_id`                          | which account is this seat, nullable                                                                                                     | `0005_demo_account.sql`      |
| `party`           | `access_token_hash`                | SHA-256 of the seat's bearer token — a credential                                                                                        | `0002_two_party_flow.sql`    |
| `party`           | `unlock_seen_at`                   | "this party opened a complete instance", nullable                                                                                        | `0007_party_unlock_seen.sql` |
| `opinion`         | (`feel`, `wish`, `think`, `guess`) | one party's scores on one Aspect — the author is the `role`→`party` link, not a column                                                   | `0001`                       |
| `instance_invite` | `email`                            | the Counterparty's address                                                                                                               | `0002`                       |
| `instance_invite` | `counterparty_name`                | the Counterparty's name (duplicated from `party.name` at claim)                                                                          | `0002`                       |
| `instance_invite` | `initiator_email`                  | the Initiator's address, nullable                                                                                                        | `0008_initiator_email.sql`   |
| `instance_invite` | `token_hash`                       | SHA-256 of the invitation token — a bearer credential                                                                                    | `0002`                       |
| `record`          | `summary`                          | an instance row's caption — **embeds both names** (`"<Template>, answered by <initiator> and <counterparty>."`, `lib/flow/store.ts:296`) | `0001`, `store.ts`           |
| `demo_account`    | `email`, `password`, `user_id`     | the three demo accounts; demo-only, deleted by `db:seed`                                                                                 | `0005`                       |

Notes that matter for the disposition:

- `opinion` carries **no author column** — the author is the `(instance_record_id, role)` key into
  `party` (`0001`). Retaining scores and anonymising the seat is therefore _possible_ without a
  schema change, and it is the load-bearing fact of §2.
- `instance_invite.counterparty_name` duplicates `party.name` — both hold the Counterparty's name
  (`store.ts:331` writes one, `store.ts:525` copies it into the other). Both must be scrubbed.
- `assessment_instance` (`record_id`, `template_record_id`, `mode`, `alignment_setting`) identifies
  **no person** — it identifies a record and its mode/setting. `record.title` and `record.slug`
  are the template's (`title`) and `<template-slug>-<random-8>` (`slug`, `store.ts:283`) — neither
  embeds a name. `record.summary` is the one `record` column that does.
- `demo_account` holds a plaintext password by decision (`0005`), but it is `@demo.alignsynch.test`-
  pinned, read only under `DEMO_AUTH=1`, and deleted by every `db:seed` run. It is not personal
  data of a real person and is out of scope for account deletion.

### `neon_auth` (Neon's managed schema — the app never migrates it)

The app reads the table names from the catalogue rather than assuming them
(`scripts/db-seed.mjs:163-175` reads `user`/`users` and `session`/`sessions`);
`docs/DEMO.md:83` names the deletable set `neon_auth.user`/`session`/`account`, and `0001`'s
header names the four Better Auth tables `users, sessions, accounts, verifications`. Personal-data
rows:

| Row                                           | Holds                                                                                              |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `neon_auth.user` (or `users`)                 | `id` (the join key), `name`, `email`, `emailVerified`, `image`, `createdAt`/`updatedAt`            |
| `neon_auth.account` (or `accounts`)           | one linked identity per provider — `providerId`, `accountId`, `userId`, the password hash / tokens |
| `neon_auth.session` (or `sessions`)           | the sessions (token, `userId`, …)                                                                  |
| `neon_auth.verification` (or `verifications`) | email-verification rows                                                                            |

`neon_auth.project_config` and `neon_auth.jwks` are app configuration, not personal data, and are
kept (`docs/DEMO.md:77-83`).

## 2. Per-column disposition on deletion

The rule that drives every row: **a seat's _identity_ is deleted, a seat's _answers_ are
retained**, because the answers are the other participant's report, and the identity is what a
third party must not be able to read. "Deleting party" means the party whose account initiated the
deletion; the _other_ seat's columns are untouched.

| Table.column                                                          | Disposition                                                            | Why                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_profile.*` (all 9 columns)                                      | **delete** (the row)                                                   | The profile is one person's self-description keyed by their auth id; nothing in it is shared. Deleting the row also frees `handle` (its `UNIQUE` constraint) for reuse.                                                                                                                             |
| `party.user_id`                                                       | **set NULL**                                                           | Unbind the seat from the deleted account. The seat itself stays — the other party's report is computed over it. `NULL` is already the schema's "nobody signed in as this party" value (`0005`).                                                                                                     |
| `party.name`                                                          | **anonymise** → a fixed non-identifying label (e.g. `Deleted account`) | The name is the identity. `NOT NULL` forbids deleting it; rewriting it removes the identity while keeping the seat.                                                                                                                                                                                 |
| `party.access_token_hash`                                             | **delete** (set NULL)                                                  | A bearer credential. A deleted account must have no way to sign in as this seat. NULL is the schema's "no way to sign in" value (`0002`).                                                                                                                                                           |
| `party.unlock_seen_at`                                                | **set NULL**                                                           | "This person looked" has no value once the person is gone; NULL is the honest value, matching `0007`'s own NULL rule.                                                                                                                                                                               |
| `party.instance_record_id`, `party.role`                              | **retain**                                                             | Structural key; not personal.                                                                                                                                                                                                                                                                       |
| `opinion.feel/wish/think/guess`                                       | **retain**                                                             | These are the _other_ party's report: `complete` requires both sides' rows (`instanceStatusOf`), and the Gap is `gapOf()` over both. Deleting them would destroy the surviving report. The author is the `role`→`party` link, already anonymised above, so retaining the numbers leaks no identity. |
| `opinion.instance_record_id/role/item_id`                             | **retain**                                                             | Structural key.                                                                                                                                                                                                                                                                                     |
| `instance_invite.email`                                               | **set NULL** (if the deleting party is the Counterparty)               | The Counterparty's address.                                                                                                                                                                                                                                                                         |
| `instance_invite.counterparty_name`                                   | **set NULL** (if the deleting party is the Counterparty)               | The Counterparty's name — the second copy, beside `party.name`.                                                                                                                                                                                                                                     |
| `instance_invite.initiator_email`                                     | **set NULL** (if the deleting party is the Initiator)                  | The Initiator's address.                                                                                                                                                                                                                                                                            |
| `instance_invite.token_hash`                                          | **delete** (set NULL)                                                  | A bearer credential; a claimed invite's link must stop working.                                                                                                                                                                                                                                     |
| `record.summary` (instance rows)                                      | **rewrite** — strip the deleted party's name                           | The one place a name is embedded in prose. `"<Template>, answered by <A> and <B>."` becomes `"<Template>, answered by <A> and Deleted account."` (or vice-versa). This is a data scrub, not a schema change.                                                                                        |
| `record.title`, `record.slug`, `record.record_type/status/date`       | **retain**                                                             | The template's title and a random-suffixed slug — no name.                                                                                                                                                                                                                                          |
| `assessment_instance.mode`, `alignment_setting`, `template_record_id` | **retain**                                                             | Not personal.                                                                                                                                                                                                                                                                                       |
| `neon_auth.user` (the row)                                            | **delete**                                                             | The credential/identity root. Done by the auth endpoint, §5.                                                                                                                                                                                                                                        |
| `neon_auth.account`, `session`, `verification` (rows for that user)   | **delete**                                                             | Cascaded by the auth-side deletion.                                                                                                                                                                                                                                                                 |

The deletion is one transaction over the `public` rows plus one auth-side call (§5); if the
auth-side call succeeds and a `public` write fails (or vice-versa), the whole operation is rolled
back and retried — a half-deleted person is the one state this spec forbids.

## 3. The other party's view afterwards

**The report stays complete. It does not close. It is not withdrawn. It degrades in exactly one
way: one seat's name is replaced by the anonymised label.**

Concretely, what the surviving participant sees at `/assessment/[slug]` after the other side
deletes their account:

- **The Gap and every score remain.** `complete` is derived from both sides having answered every
  Aspect (`instanceStatusOf`, `lib/flow/state.ts:57`), and the deleted party's `opinion` rows are
  retained (§2), so the instance still answers `complete` and the report still renders both columns
  (`visibleRoles`, `state.ts:82`).
- **One seat reads `Deleted account`.** `party.name` is the only column the screen draws a name
  from (`lib/flow/screen.ts:218-219` for `initiatorName`/`counterpartyName`, `:206` for
  `viewer.name`), and it has been rewritten. The report does not say who the deleted party was.
- **Nothing identifies the deleted party.** `party.user_id` is NULL, `access_token_hash` is NULL,
  the invitation's `email`/`counterparty_name`/`initiator_email`/`token_hash` are NULL, and the
  instance `record.summary` has been rewritten. There is no column left that a third party — a
  database reader, or anyone the survivor forwards a screenshot to — can turn into the deleted
  person's name, address, or account.

The one thing the survivor can still see is the deleted party's **scores**, which the survivor
has always been entitled to see: that is what a completed report is. Because the scores are no
longer joined to a name, an address, or an account, they leak no identity — the precise guarantee
the issue asks for.

**The deleted party's own access is gone with the account** — the session is deleted (§5), the
seat's bearer token hash is NULL, and `user_id` is NULL, so neither the old session nor the old
invitation link can open the instance again.

## 4. Timing

**Immediate and irreversible. No soft-delete window.**

The product has not decided a retention period, and this document does not invent one. The honest
timing is therefore the only one that does not promise something undecided: the deletion runs
when the person asks for it, and there is no grace period, no scheduled purge, and no "deactivate,
delete later" state. A soft-delete window (say 30 days) is a **policy** fact — it changes what the
privacy text must say — not an implementation detail, so it is out of scope for this card and, if
the product ever wants one, it must be decided first and stated in the policy text.

What the policy text must say under this spec (the interim copy on the settings card, §7, says the
same thing in one line):

> When you delete your account, your profile, your invitations and the details that identify you in
> any shared assessment are removed immediately and permanently. Assessments you participated in
> remain for the other participant, with your seat shown as "Deleted account"; your answers stay
> only as part of their completed report and are no longer linked to your name, email or account.
> Deletion cannot be undone and there is no grace period.

## 5. Auth-side deletion

**The endpoint exists, in the API this repo already calls.** Neon's Managed Auth is Better Auth,
and the app proxies it through `app/api/auth/[...path]/route.ts` via `createNeonAuth()` from
`@neon/auth/next/server` (`lib/auth/server.ts`).

The SDK's endpoint table carries the self-service deletion endpoint
(`@neon/auth@0.8.0`, `dist/server.js`, `API_ENDPOINTS`):

```ts
deleteUser: {
    path: "delete-user",
    method: "POST"
},
```

…mirrored in the server type (`dist/types.d.ts:219`):

```ts
readonly deleteUser: {
    readonly path: "delete-user";
    readonly method: "POST";
};
```

`createNeonAuth()` exposes it as a server method (`auth.deleteUser(...)`) — the server object is
built by `createApiProxy(API_ENDPOINTS, …)` (`dist/server.js:1072`) over every top-level endpoint,
and `deleteUser` is a top-level endpoint. The app already constructs this exact instance:
`neonAuth()` in `lib/auth/server.ts:38-46`. The catch-all route forwards any `[...path]` verbatim
(`authApiHandler` joins the segments and proxies — `dist/next/server/index.js`), so
`POST /api/auth/delete-user` is reachable through the proxy this repo already mounts. In full:

- Self-service: **`POST /api/auth/delete-user`** (upstream path `delete-user`), which deletes the
  _authenticated_ user — the deleting account itself.
- Admin fallback (operator-run, deletes any named user): **`POST /api/auth/admin/remove-user`**
  (upstream path `admin/remove-user`), also in the same endpoint table.

There is no separate Neon console call to hand-run. The deletion is one server call
(`auth.deleteUser(...)`) issued by the route that owns the account-deletion request, after the
`public`-schema scrub of §2 commits.

## 6. Retention exceptions

**None — with one deliberate, non-exception carve-out.**

- **Billing records: none.** There is no payments/billing surface and no billing table in
  `db/migrations/` (ENV-SPEC §1: "no payments"; the six content tables plus profile/flow are the
  whole of `public`). There is nothing to retain.
- **Abuse logs: none.** No security/abuse log table exists. There is nothing to retain.

The carve-out is not an exception, it is the shared-record rule restated: the deleted party's
**opinion rows and anonymised seat** remain, because they are the _other_ participant's report
(§2, §3). That is "the other person's data", not "the deleted person's data retained for the
deleted person".

One flag a lawyer would raise, and it belongs to the operator, not the app: Neon's managed auth
infrastructure may keep server-side logs on Neon's side; that is outside this repo's data and
outside this spec. It should be named in the privacy text when `/privacy` lands (issue #270), not
here.
