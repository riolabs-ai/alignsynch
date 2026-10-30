# Demo auth — a role, a gate, and three seeded accounts

Part 1 of #183 (data and roles only). Part 2 builds the PIN-gated panel that uses them.

## The role

`user_profile.role` is `member | admin`, `NOT NULL DEFAULT 'member'`
(`db/migrations/0004_user_profile_role.sql`). One column, one named boolean: there is no
capability list, no rank order (a role is compared for equality, never `>=`), and no third
value. `content/identity.ts` owns the vocabulary (`USER_ROLES`, `zUserRole`, `DEFAULT_USER_ROLE`,
`roleAdmits`), and `zUserProfile` carries `role`, so every read of a profile answers "who is this
and what may they do" in one parse.

Three properties worth knowing before you write against it:

- **No public surface reads it.** `publicProfileOf()` drops `role` along with `userId` — a page
  that told the world which account is an admin would be pointing at the account to attack.
- **The settings write path cannot name it.** `zProfileFields` has no `role`, and
  `writeUserProfile`'s INSERT omits the column (default `member`) while its `ON CONFLICT` clause
  never touches it. A person cannot promote or demote themselves by saving their profile.
- **Absence means `member`.** A signed-in person with no `user_profile` row is normalised to
  `DEFAULT_USER_ROLE`, so "never saved settings" and "saved as a member" answer identically.

## The gate

`lib/auth/require-role.ts`, server-only (it resolves the session and reads `user_profile`):

```ts
const { user, role } = await requireAdmin(); // the one gate anything asks for today
const grant = await requireRole("member", { next }); // the general form
```

It returns a grant, or it answers — it never returns `null` for a caller to forget to check.
Both refusals are deliberate and both are `never` in effect (`redirect()` and `notFound()` throw
a control-flow signal in Next):

| Who is asking           | Answer                                               |
| ----------------------- | ---------------------------------------------------- |
| signed out              | `redirect("/login?next=<where they were going>")`    |
| signed in, wrong role   | `notFound()` — the same 404 a URL that never existed |
| signed in, right role   | `{ user, role }`                                     |
| the profile read throws | the error — an outage is not a permission answer     |

**Never a 403.** A 403 is an answer, and an answer confirms the surface exists. `roleAnswerFor()`
is the whole policy as a pure function, and `tests/require-role.test.ts` drives every branch of
it with no session and no database, including the assertion that the only answers it can produce
are `allow`, `redirect` and `not-found`.

## The seeded accounts

```bash
DEMO_AUTH=1 pnpm db:migrate && DEMO_AUTH=1 pnpm db:seed   # create, with the dataset
pnpm db:seed                                              # delete, create none
```

| Address                             | Role     | Party on `assessment-instance-avery-rowan`   |
| ----------------------------------- | -------- | -------------------------------------------- |
| `initiator@demo.alignsynch.test`    | `member` | `initiator` — Avery                          |
| `counterparty@demo.alignsynch.test` | `member` | `counterparty` — Rowan                       |
| `admin@demo.alignsynch.test`        | `admin`  | none — the admin does not answer an instance |
- **Only under `DEMO_AUTH=1`.** Unset means the three are removed, not merely not-created: a
  switch that only ever adds leaves a demo backdoor on every machine that ever ran a demo.
- **Real auth users.** Each is created through the branch's own `sign-up/email` endpoint, so
  part 2 signs in through the real login path and gets a real session — no parallel auth, no
  bypass of `/login`.
- **The dataset comes with them.** In demo mode the rows come from
  `data/bundles/demo-dataset.alignsynch.json` through `parseBundle` (the importer's own reader),
  after the seed refuses a file that has drifted from `data/assessments.ts`. The two party
  accounts are bound by `party.user_id` (`0005_demo_account.sql`) to the Avery and Rowan rows, so
  "sign in as Counterparty" shows that person's blind view rather than an empty dashboard.
- **Passwords.** `randomBytes(24)`, generated per run, stored only in `demo_account`, printed
  nowhere, committed nowhere, never in a fixture, never sent to a browser. `pnpm db:seed` prints
  the accounts and their roles and no credential. Re-seeding replaces the three, which is why the
  counts are identical on every run.

### Reading the credential server-side (part 2)

The panel must sign a browser in **without ever sending it a password**. The server action reads
the row and presents it to Neon Auth itself:

```sql
SELECT da.email, da.password, up.role
  FROM demo_account da JOIN user_profile up ON up.user_id = da.user_id
 WHERE da.email = $1
```

`demo_account.password` is plain text on purpose (a hash cannot be presented to a sign-in
endpoint, and an env var cannot be generated per seed run). It is a credential for a fake person
in a table that only exists to be read under `DEMO_AUTH=1`; the CHECK pins the address domain to
`@demo.alignsynch.test` so a real person's credential cannot land in it.
