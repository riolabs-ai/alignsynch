# AlignSynch

AlignSynch is a relationship and learning platform: two people answer the same questions about how
they feel and how they wish it to be, and the distance between the two answers — the Gap — is the
conversation worth having.

This repository is the **template** that product is built from, not a single site. One codebase, one
route table, several templates and several brands, and a build picks the brand. It ships as
AlignSynch, and **QuizHub is the second shipped brand and template** — the quiz and tournament
product the platform grew out of, still buildable, still green, not the thing this repository is.

## What actually runs

| Layer         | What it is                                                                                                                      | Where         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Runtime       | Next.js 16.1.6, App Router, Turbopack                                                                                           | `app/`        |
| UI            | React 19, TypeScript 5 in `strict` mode, Tailwind CSS 3.4 and shadcn/ui over Radix                                              | `components/` |
| Content model | zod 3 schemas as the single source of truth; every type is `z.infer`red from them                                               | `content/`    |
| Fixtures      | the validated records pages render; `pnpm data:check` fails a build when one drifts from the schema                             | `data/`       |
| Data          | Neon Postgres over `pg`, eight tables, forward-only SQL in `db/migrations/`                                                     | `lib/db/`     |
| Auth          | Neon Managed Auth (hosted Better Auth), proxied at `app/api/auth/[...path]`; the app owns no users or sessions table of its own | `lib/auth/`   |
| Deploy        | Vercel — `main` deploys; the AlignSynch build is at <https://alignsynch-amber.vercel.app/>                                      | —             |

`content/` imports nothing from React or Next. That is what lets the same model be rendered by the
app, validated by a plain `node` script, and checked against the database with no browser in the
loop.

## Two brands from one build

`data/brand.ts` holds the records; `next.config.mjs` inlines one flag that selects between them.

```bash
BRAND=quizhub pnpm build      # the default: the QuizHub record
BRAND=alignsynch pnpm build   # the AlignSynch record
```

A brand record carries the name, legal name, description, domain, logo path, the palette, the
support and affiliate addresses and the referral origin. Every page and fixture reads `brand` from
`data/brand.ts` and prints its fields — no screen checks `process.env` and no module imports a brand
by name — so "this demo is AlignSynch now" is one build rather than a find-and-replace. The flag is
inlined by the bundler because client components read the record too: a `process.env` the bundler did
not replace would render one brand on the server and another at hydration.

`BRAND=<anything else>` throws at build time instead of rendering a half-swapped product:

```
BRAND=acme is not a brand — expected one of: quizhub, alignsynch
```

What the flag does **not** do: it swaps a record, not a page. The route table is identical, and the
copy in `data/` and `data/pages/` still speaks whichever product it was written for. See
[adopting the template](#adopting-the-template-for-a-new-brand).

## Quick start

```bash
nvm use                          # .nvmrc pins 24 — this is not a formality
node -v                          # must print v24.x
pnpm install --frozen-lockfile   # the install CI runs
pnpm dev                         # next dev --turbo, http://localhost:3000
pnpm build                       # next build; needs no connection string and no env file
pnpm start                       # serve the build on port 3000
```

`nvm use` reads `.nvmrc` and works in an interactive shell; in a script or an agent shell, put a Node
24 `bin` directory first on `PATH` instead (`$HOME/.nvm/versions/node/v24.22.0/bin`, for example).

**Node 18 is too old, and the pre-push hook rejects it.** `/usr/bin/node` is 18.19.1 on the machines
this tree was built on and shadows a newer runtime on `PATH`; Next 16 requires ≥ 20.9. The gate
checks runtime parity before it runs a single step, and exits:

```
✗ runtime parity: .nvmrc pins Node 24, this shell has Node v18.19.1.
  switch first (CI already reads .nvmrc):  nvm use
```

Because `scripts/verify.sh` is also the pre-push hook, a Node 18 shell cannot push either. That is
the cheapest possible failure, and it still costs an hour if you find it by watching CI — check
`node -v` first. The package manager is pinned to the same standard: pnpm 12.16.1, from
`packageManager` and the lockfile, and the gate refuses another major.

**`pnpm build` succeeds without a database.** Verified on a clean checkout with `DATABASE_URL` and
`NEON_AUTH_BASE_URL` unset and no `.env.local`: exit 0, and the route table it printed is the same 39
pages the registry counts. Only the database-backed
routes need a connection, and only at request time — the pool is created lazily on the first query,
and the auth server is constructed on first use rather than at import. That distinction is why CI
runs the full gate with no connection string attached: a build that needed a database would leave
every pull request unable to test itself.

### Before you push: the gate

```bash
bash scripts/verify.sh          # THE gate. green = shippable
bash scripts/install-hooks.sh   # once per clone: pre-push runs the same script
```

CI runs this script and nothing else; the job is named for it, `typecheck / lint / build`. A check
that lives only in the YAML is a guaranteed red push, and a check that lives only in the script is a
green local run that CI contradicts, so there is one definition and two callers. The depth follows
the diff — `lane=docs|content|config|code`, highest wins, printed on every run — and
`GATE_LANE=full bash scripts/verify.sh` forces all of it after a dependency bump. The lane table and
the build semaphore are in [docs/REPO-LAYERS.md](docs/REPO-LAYERS.md); the measured baseline and the
ruleset that makes the CI check required are in [docs/GATE.md](docs/GATE.md).

## Environment variables

There is no `.env.example` in this tree. The database and auth values are pulled from the Neon
branch into a gitignored `.env.local` by `neon env pull`; everything else is set by whoever runs the
build. Nothing below is needed by `pnpm build`.

| Variable                  | Read by                            | Needed for                                                                                            |
| ------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | `lib/db/client.ts`                 | every database-backed route, at request time                                                          |
| `DATABASE_URL_UNPOOLED`   | `scripts/load-env.mjs`             | `pnpm db:migrate`, `db:seed`, `db:verify`; falls back to `DATABASE_URL`                               |
| `NEON_AUTH_BASE_URL`      | `lib/auth/server.ts`               | signing in and out, sessions, `/api/auth/*`; written by `neon env pull`                               |
| `NEON_AUTH_COOKIE_SECRET` | `lib/auth/server.ts`               | the same; application config, supplied per environment rather than injected by Neon                   |
| `BRAND`                   | `data/brand.ts`, `next.config.mjs` | `quizhub` (default) or `alignsynch`                                                                   |
| `NEXT_PUBLIC_BASE_URL`    | `lib/flow/email.ts`                | the origin in an invitation link; defaults to `http://localhost:3000`                                 |
| `RESEND_API_KEY`          | `lib/flow/email.ts`                | sending the invitation mail; without it the link is shown in the UI instead and the flow carries on   |
| `RESEND_FROM`             | `lib/flow/email.ts`                | the sender address; defaults to Resend's `onboarding@resend.dev` development sender                   |
| `FLAG_<NAME>`             | `lib/flags.ts`                     | `1` on, `0` off, for one of the eight declared surfaces — read per request, so a flip needs a restart |

Flags are the lever for shipping or hiding one surface without a code change. `data/flags.ts`
declares eight, `lib/flags.ts` resolves them, and every default is `false`: a surface that is still a
mock must not be on by default. The resolver is server-only on purpose — a flag the browser decides
can neither 404 a route nor stop a query. Precedence, the three places a flagged-off surface has to
be off, and what a flip costs: [docs/ENV-SPEC.md](docs/ENV-SPEC.md) §9.

## The domain model in five lines

The model is WordPress-shaped, and the glossary is the schema speaking:

1. A **Record** is a post: `id`, `slug`, `type`, `status`, `date`.
2. `type` is `post_type` — `quiz` or `assessment`. Both are records, and neither template imports the
   other.
3. A **Template** is a record that holds items and has no parties. There is no `parties` key to omit:
   `strict()` rejects one.
4. An **Instance** is a template copied and given two parties.
5. The **Gap** is a difference of two opinions. It is a function, never a stored field:
   `gapOf(2, 5) === 3`, and `gapOf(4, 4) === 0` is In Synch.

[docs/glossary.md](docs/glossary.md) is generated from the schema comments — every term, defined
where its type is defined — and [docs/DATA-MODEL.md](docs/DATA-MODEL.md) is the field-level
inventory.

## What is actually built

The numbers below are measured, not remembered: `docs/ui-registry.md` is generated from the tree and
from the judgement entries in `data/ui-registry.ts`, and the gate fails when the committed page and
the tree disagree.

```bash
pnpm ui:registry:check   # what the gate runs: regenerate in memory, compare, exit 1 on drift
pnpm ui:registry         # rewrite docs/ui-registry.md after a legitimate change
```

- **39 routes** — 25 static, 14 dynamic, from `app/**/page.tsx`
- **32 component domains** — 224 files under `components/`, 220 of them `.tsx`
- **5 route handlers** — `app/**/route.ts`, listed in the registry and not counted as UI
- **71 catalogued surfaces** — 39 routes + 32 domains, each with a `status`
- **status split** — 5 live, 7 database-backed, 50 fixture-backed, 9 mock

The four statuses are wiring claims, not opinions: `db` reaches `lib/db/`, `live` reaches an `/api`
write, `fixture` reaches a record module under `data/`, and `mock` reaches neither — so a surface
whose numbers are literals is a stand-in however finished it looks.

Live today: `/login`, `/register`, `/settings`. Database-backed: `/dashboard/user`,
`/profile/[username]`, `/assessment`, `/assessment/[slug]`, `/assessment/instances/[instanceId]`,
`/invite/[token]`. Everything else renders from `data/`, and nine surfaces are still mocks.

A template that oversells its own completeness is worse than one that says which parts are mocked, so
the registry also records which template claims each surface: 19 by both, 8 by AlignSynch, 42 by
QuizHub, and 2 by neither yet.

## Adopting the template for a new brand

1. **Add the record.** Write `data/brands/<id>.ts` exporting a `Brand`, and register it in the
   `brands` table in `data/brand.ts`. Its `logo` is a path that must already be registered in
   `data/media.ts` — the registry is a bijection with `public/`, and `pnpm data:check` fails when it
   is not.
2. **Pick the front page.** `app/(mainlayout)/page.tsx` switches over `BrandId`, so a new brand is a
   compile error until its home composition is chosen deliberately: one copy module under
   `data/pages/` and one `case` arm. That is the only application code an adoption touches, and it is
   a compile error rather than a runtime surprise on purpose.
3. **Build and gate it.** `BRAND=<id> pnpm build`, then `bash scripts/verify.sh`. A record that fails
   `zBrand`, or a palette that reaches for an unregistered asset, fails here.
4. **Retarget the nouns.** The brand record swaps a name, a palette and a mailbox — not copy. The
   fixtures in `data/pages/` still speak the product they were written for, and 42 of the 71 surfaces
   are claimed by QuizHub alone. There is no vocabulary layer yet, so a third brand inherits QuizHub's
   words wherever its own copy has not been written.
5. **Retire, do not delete.** A surface a new brand does not want is a flag, not a fork:
   `data/flags.ts` declares it, the route answers 404 when it is off, and one build serves both
   templates.

## Docs

| File                                             | What it answers                                                       |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                           | command table with verified results, conventions, pitfalls            |
| [docs/glossary.md](docs/glossary.md)             | the domain's words, generated from the schema comments                |
| [docs/ui-registry.md](docs/ui-registry.md)       | every surface, its status, and which template claims it               |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md)         | the content model: entities, invariants, strictness                   |
| [docs/TWO-PARTY-FLOW.md](docs/TWO-PARTY-FLOW.md) | the assessment flow: create, invite, answer, unlock the Gap           |
| [docs/BUNDLES.md](docs/BUNDLES.md)               | importing and exporting a template or a demo dataset as one file      |
| [docs/GATE.md](docs/GATE.md)                     | gate baseline, first-pass yield, the required-check ruleset           |
| [docs/REPO-LAYERS.md](docs/REPO-LAYERS.md)       | lane table, classifier rules, build semaphore                         |
| [docs/ENV-SPEC.md](docs/ENV-SPEC.md)             | environment, team, integrations, feature flags, the P1–P4 stage gates |
| [docs/RELEASING.md](docs/RELEASING.md)           | cutting a version: changelog entry, tag, GitHub Release, the deploy   |

`AGENTS.md` is the agent-facing companion to this file. The two must agree on commands, the package
manager and the Node version; a command change belongs in both.

## Status and limits

**Beta.** `package.json` is `1.0.0`, the AlignSynch build is deployed at
<https://alignsynch-amber.vercel.app/>, and the gate is green on `main`.

What works end to end: registration, sign-in and sessions through Neon Managed Auth; account settings
and public profiles persisted in Postgres; and the two-party assessment flow — create an instance
from a template, invite the other party, both answer, and the Gap unlocks when both have submitted.

What does not:

- **Payments are absent.** `/pricing` and `/affiliate` are fixture-backed plans with no checkout, and
  both are off by default: a price a client can read is an offer.
- **Nine surfaces are mocks** — the quiz editor's save, the generator, the leaderboard, tournaments,
  battle and chat among them. Each is named in [docs/ui-registry.md](docs/ui-registry.md), and
  `data/flags.ts` carries a note per surface saying what would have to exist before it is on.
- **One template has a server behind it.** The QuizHub product's create, play and community surfaces
  are fixtures; only the assessment flow, accounts and profiles touch the database.
- **No multi-tenancy, no i18n, no course schema.** A brand is a build, not a tenant.
- **One brand is written, one is partly inherited.** AlignSynch has its own front page, palette and
  copy; the surfaces it does not claim still read QuizHub's fixtures.
- **Image optimization is off on purpose** (`images.unoptimized` in `next.config.mjs`, which carries
  the full reason), and 22 of the 57 `<Image>` tags still pass `fill` with no `sizes`.

No metric, testimonial, customer count or uptime figure appears on this page, and no count above was
copied from an issue: each one comes from the command that produces it.
