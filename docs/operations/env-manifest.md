# The environment table: one row per variable, generated files, and a check

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Env manifest · prev [Deploying](deploying.md) · next [The gate](gate.md)

<!-- docs-nav:end -->

Issue: [#1088](https://github.com/riolabs-ai/alignsynch/issues/1088). Two production incidents are
the reason this page exists, and both came from a file nothing checked:

1. **The only working Venture I/O key was in `.env.local.bak-20261101-1937`** — a backup no code
   reads — while every live `.env*` held the _other_ account's key. Billing pointed at the wrong
   account, every screen read configured, and nothing in the repo could tell you.
2. **`.env.local` silently outranks `.env`** under `scripts/load-env.mjs`, so a "production"
   credential write landed on the demo branch, and the provider refused it with `INVALID_ORIGIN`
   in a shape that printed as `undefined`.

So the surface is one table, three commands, and a gate step. `scripts/env-manifest.ts` is the
table. Nothing else in the repo decides what a deployment is given.

## The three environments

| id           | file         | what it is                                              |
| ------------ | ------------ | ------------------------------------------------------- |
| `local`      | `.env.local` | a developer's `pnpm dev` — the **demo** branch's values |
| `preview`    | `.env.demo`  | the `demo` branch on Vercel → `demo.alignsynch.com`     |
| `production` | `.env`       | `main` on Vercel → `alignsynch.com`                     |

All three files are gitignored (`.env*`). `local` is the demo on purpose: the shared branch is what
a checkout is pointed at.

## What a row says

```text
name · boot? · local / preview / production · source · why
```

- **`boot`** — must resolve before the first request is served. The check derives the boot set from
  the modules the app cannot serve without (`lib/db/client.ts`, `lib/auth/config.ts`,
  `lib/auth/server.ts`) and requires the flag to agree in **both** directions: a variable those
  modules read must be `boot: true`, and a row that claims it must be read by one of them. A
  refusal sentence elsewhere (`RESEND_API_KEY is not set, so no mail was attempted`) is honest
  degradation, not a boot requirement.
- **A requirement cell** is `required` (render refuses that file while it does not resolve),
  `optional` (the code reports its absence), or `forbidden` (that deployment must not hold it, and
  `env:sync` drops it there). `ADMIN_EMAILS` is forbidden on the demo: that target is signed into
  by demo identities and shown to whoever is being shown the product.
- **`source`** is one of four, and there is no fifth:
  - `vault` — a Bitwarden Secrets Manager key from project **alignsynch-web**. The vault name is
    often not the env name (`ALIGNSYNCH_VENTURE_STRIPE_TEST_KEY` →
    `STRIPE_VENTURE_TEST_SECRET_KEY`), which is exactly the drift the column makes visible.
  - `literal` — a value the repo owns and that is not a secret (`BRAND`, the three origins).
  - `derived` — `package.json:version` for `APP_VERSION`, `git:commit` for `APP_COMMIT`.
  - `carried` — the value this environment's own file already holds. Resolved from that file and
    **no other**, which is the mechanical half of incident 2.
  - a row with **no** source leaves the application's own default in place and writes nothing.

A row may split its source by environment, and one row must: **the webhook secret is two vault
rows**, because production's endpoint and the demo's endpoint sign with different secrets and a
single row reproduces the "webhooks stopped working days later" bug class.

## The three commands

```bash
pnpm env:check                 # the gate step: names and source text only, no vault, no network
pnpm env:render --dry-run      # print the plan — every variable and its source, never a value
pnpm env:render                # write .env.local, .env.demo and .env from the table
pnpm env:sync --target production --check
pnpm env:sync --target preview --branch demo --check
```

`env:check` prints a census every run and fails by name:

```text
env-manifest: 45 variable(s) declared, 3 required at boot, 0 unresolved, 63 out of scope —
82 name(s) read across 1374 source file(s)
```

It fails when the code reads a name no row declares, when a row names a variable nothing in the
tree reads, when a boot variable's cells contradict a deployment, and when a row sources a
live-mode credential — every environment here is the provider's test sandbox, and there is no
`sk_live_` path to reintroduce.

`env:render` **refuses to write a file whose required variables do not all resolve**, names them,
and writes nothing partial for that file: a half-written env file is worse than none, because the
next command reads it. The output is deterministic (table order, no clock, no path), so rendering
twice is byte-identical and a diff of a rendered file is a diff of the table.

`env:sync` **defaults to `--check`** — names and scope coverage only, because Vercel masks a value
and an encrypted value cannot be compared. `--write` is the only path that changes a target, and
`--write --target production` additionally needs `--confirm-production`. Values come from the
rendered file for that target, so the deployed value and the local file come from one row. Never
source a value from `vercel env pull`: those variables are `sensitive` and pull back unreadable,
which surfaces later as a misleading `401 Invalid API Key`.

## Out of scope, by name

Test and QA knobs (`CDP_*`, `DEMO_FLOW_*`, `CHECK_FAST_BASE`, `CHROME_BIN`, `QA_ATLAS_*`), the
release tooling (`RELEASE_*`, `HERMES_KANBAN_*`), CI and platform variables (`GITHUB_*`,
`VERCEL_*`, `NODE_ENV`, `PATH`), and two vault rows that are not app runtime
(`RIO_GITHUB_KEY`, `GOOGLE_CLIENT_SECRET`) are listed in `OUT_OF_SCOPE` — **one exact name and one
reason each, never a wildcard**. An exempt row is what a future variable is compared against, so it
cannot be widened in place.

## Local-only: what the files carry that no row declares

```bash
node scripts/env-manifest.ts --files --dir <a tree with .env files>
```

This is not a gate step — CI has no env files — and it prints names and byte counts only. It is how
a key that no row owns (`NEON_AUTH_JWKS_URL`, `STRIPE_TEST_WEBHOOK_URL`) becomes visible instead of
surviving three migrations.

## Known limits

- A name reached only through a list helper (`firstSet(["A", "B"])` in `lib/objstore.ts`) is caught
  by the **rotted** direction and not by the **undeclared** one, which resolves `process.env.NAME`,
  `process.env["NAME"]` and `process.env[CONSTANT]`. Adding one without a row shows up at render
  time as `MISSING`, not at gate time.
- The renderer reads the vault with the profile's machine account; another credential sees a
  different project and reports rows as missing rather than as a permissions error.
- `.env.example` is still hand-maintained. A generated names-only template is a follow-up: this
  card does not commit a `.env*` file, and `.env.example` is one.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Operations** › Env manifest · prev [Deploying](deploying.md) · next [The gate](gate.md)

<!-- docs-nav:end -->
