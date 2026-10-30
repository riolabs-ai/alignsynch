# Demo auth — a role, a gate, a panel, and three seeded accounts

Parts 1 and 2 of #183. Part 1 is the data and the roles (`user_profile.role`,
`lib/auth/require-role.ts`, the three seeded accounts); part 2 is `/demo`, the PIN-gated panel
that signs a browser in as one of them.

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

### Reading the credential server-side

The panel must sign a browser in **without ever sending it a password**. The server action
(`app/(auth)/demo/actions.ts`) reads the row through `lib/db/demo-accounts.ts` and presents it to
Neon Auth itself:

```sql
SELECT da.email, da.password, up.role
  FROM demo_account da JOIN user_profile up ON up.user_id = da.user_id
 WHERE da.email = $1
```

`demo_account.password` is plain text on purpose (a hash cannot be presented to a sign-in
endpoint, and an env var cannot be generated per seed run). It is a credential for a fake person
in a table that only exists to be read under `DEMO_AUTH=1`; the CHECK pins the address domain to
`@demo.alignsynch.test` so a real person's credential cannot land in it.

**Why the plaintext stayed, and what was considered instead.** The alternative is a password
derived on demand from a server-side secret (`DEMO_PIN` or a dedicated `DEMO_ACCOUNT_SECRET`)
and the address, through a slow KDF, so `demo_account` holds no password column at all. It is
strictly better against a dump of that table, and it was rejected for two costs that are real in
this tree:

- **It adds a third credential to get a demo running.** The seed and the server must hold the
  _same_ secret, so `pnpm demo:reset` on a branch and a serve of that branch now both depend on a
  variable that `.env.local` does not have. Rotating or losing it strands all three accounts
  until the next reseed — a failure mode with a confusing message ("the PIN is right and the
  sign-in still fails") on a surface whose whole job is to be reliable during a client demo.
- **The threat it removes is not the one this surface has.** The table is read only under
  `DEMO_AUTH=1` (enforced in the reader, not at the call site), the addresses cannot leave
  `@demo.alignsynch.test`, and the accounts own nothing: they are created and deleted by
  `db:seed`, and the password is regenerated on every run. A dump that reaches `demo_account`
  has reached the six content tables and the `neon_auth` schema in the same database.

What is _not_ accepted is any of that being assumed. The password never reaches a browser, a log
line, a fixture or a commit, and the built output is grepped for each one in the gate's own
acceptance (`grep -r` over `.next` for every `demo_account.password`: zero matches).

## The panel (`/demo`, part 2)

```bash
DEMO_AUTH=1 DEMO_PIN=… pnpm dev          # http://localhost:3000/demo
```

| Variable                  | What it does                                                                  |
| ------------------------- | ----------------------------------------------------------------------------- |
| `DEMO_AUTH=1`             | mounts `/demo` and `/demo/admin`; anything else (unset, `true`, `yes`) is off |
| `DEMO_PIN`                | the PIN every sign-in must carry; empty or unset **refuses** demo mode        |
| `DEMO_ALLOW_PRODUCTION=1` | the second variable a production deployment needs (`VERCEL_ENV=production`)   |

**The guard.** `DEMO_AUTH=1` with `VERCEL_ENV=production` and no `DEMO_ALLOW_PRODUCTION=1` is
`refused`, not off: the page and the action both answer the 404 a URL that never existed returns,
and startup logs `[demo-auth] mode=refused — …`. Two variables to enable a demo login in
production is the point — nobody sets both by accident. `DEMO_ALLOW_PRODUCTION=1` **without**
`DEMO_AUTH=1` enables nothing, so a stray second variable is not a second chance.

**The route is the gate.** Unless the mode is `demo`, `/demo` and `/demo/admin` call
`notFound()` before anything else — no banner, no disabled form, no "demo auth is off"
placeholder. Both routes are `force-dynamic`: the mode is read per request, so setting the
variable and restarting is the whole operation in both directions, and a build made under one
setting can never ship the other.

**The action is a second gate.** A server action is a public POST endpoint; the page being a 404
does not close it. `signInAsDemo` asks the mode again and answers `notFound()` too.

**The PIN.** Compared with `pinMatches()` (`lib/auth/demo-pin.ts`), which hashes both sides with
SHA-256 and compares the digests with `timingSafeEqual` — digesting first is what makes the
comparison length-independent, so neither the PIN's value nor its length is observable in the
time taken. The credential is not read until the PIN matches.

**A refusal names its cause.** Four outcomes, and the sentence is chosen by the one the reader
can act on (`lib/auth/demo-failure.ts`, #216) — the sign-in refusal splitting only where the app
already has words for the cause:

| Outcome                                        | Sentence                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A wrong PIN, or a button value that is not one | "That PIN is not correct." — **one** sentence for both, so a reply cannot say whether an account exists |
| `demo_account` has no row for that role        | "No demo account is seeded for that role. Run the demo reset, then try again."                          |
| The auth server refused the sign-in            | "The PIN was accepted, but the auth server refused the sign-in. …"                                      |
| …and the cause is the browser's origin         | the login page's own `error-origin` line, read through `authFailureItemId()` rather than re-worded      |
| …and the cause is the transport                | the login page's own `error-network` line, read the same way                                            |

The reply never carries a password, a token or the provider's message — `authFailureOf()`
(`lib/auth/errors.ts`) classifies the error and only a string chosen by that classification is
rendered. Each case logs its own line (`PIN rejected for …`, `no seeded demo account for …`,
`sign-in refused for … (origin)`), so the diagnosis is in the server log while the panel stays
short. Every row after the first is only reachable after the PIN matched, which is what keeps them
from answering "does this address exist?".

**The limit.** Five attempts a minute per caller (`x-forwarded-for`, else one shared bucket),
fixed window with pruning; a refused attempt is not recorded, so knocking does not extend the
ban. A successful sign-in resets the caller. One further message — "Too many attempts" —
describes the caller's history, not the secret, and carries the retry in seconds.

**Where each button lands.**

| Button       | Signs in as                         | Lands on                                                |
| ------------ | ----------------------------------- | ------------------------------------------------------- |
| Initiator    | `initiator@demo.alignsynch.test`    | `/assessment/instances/assessment-instance-avery-rowan` |
| Counterparty | `counterparty@demo.alignsynch.test` | the same screen, as Rowan                               |
| Admin        | `admin@demo.alignsynch.test`        | `/demo/admin`                                           |

The instance screen resolves its viewer from the party cookie **first** and from the signed-in
account second (`lib/flow/store.ts::roleForUser`): the demo binds Avery and Rowan by
`party.user_id`, so a demo sign-in shows that party's blind view without handing out an
invitation token, and a browser that already holds a party cookie keeps the identity its link
gave it.

**`/demo/admin` is the admin check.** It is the first caller of `requireAdmin()`: an `admin`
session sees it, a member gets the same 404 a missing page gets (never a 403), and a signed-out
visitor is redirected to `/login`. The role it prints was read from Postgres for that request;
no header, cookie or query value is consulted.

**Startup logs one line.** `instrumentation.ts` prints `[demo-auth] mode=…` once per server
process — `demo`, `off`, or `refused` with the reason. It names variables and the mode, never a
value. `mode=off` says the panel is not mounted; there is no line claiming a demo login exists
when there is none.
