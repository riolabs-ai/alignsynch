/**
 * env-manifest — one table for every variable the application reads.
 *
 * The problem this file exists for is measured, not imagined. On the tree this card started from,
 * three hand-maintained files (`.env`, `.env.local`, `.env.demo`) held 36 distinct names between
 * them while the code read 70, and two production incidents came out of the gap:
 *
 *   1. The only working Venture I/O key was in `.env.local.bak-20261101-1937` — a backup nothing
 *      reads — while every live `.env*` held the *other* account's key. Billing pointed at the
 *      wrong account and no surface said so.
 *   2. `.env.local` outranks `.env` under this repo's loader (`scripts/load-env.mjs`), so a
 *      "production" credential write landed on the demo branch, and the provider refused it with
 *      `INVALID_ORIGIN` in a shape that printed as `undefined`.
 *
 * So: **one row per variable**, naming whether it is required before the first request, which of
 * the three environments carry it, and where its value comes from. `pnpm env:render` writes the
 * three files from this table; `pnpm env:sync` pushes the same resolution into a Vercel scope; and
 * `pnpm env:check` — a gate step in every lane — holds the table against the code, which is the
 * half nothing could see before.
 *
 * ## The three environments
 *
 * | id           | file          | what it is                                                |
 * | ------------ | ------------- | --------------------------------------------------------- |
 * | `local`      | `.env.local`  | a developer's `pnpm dev` — the **demo** branch's values    |
 * | `preview`    | `.env.demo`   | the `demo` branch on Vercel → `demo.alignsynch.com`        |
 * | `production` | `.env`        | `main` on Vercel → `alignsynch.com`                        |
 *
 * `local` is the demo on purpose: the shared branch is what a checkout is pointed at, and a
 * developer who needs production runs one command against production's own row rather than
 * editing a file. The trap this documents is the loader's order — `.env.local` wins over `.env` —
 * so a production value in `.env` is *shadowed* locally, which is correct here and was the whole
 * of incident 2 above when a file disagreed with the table.
 *
 * ## A requirement cell is a decision, not an adjective
 *
 * `required` — the environment cannot work without it; `env:render` refuses to write that file
 * while it does not resolve. `optional` — the code reports its absence honestly (an unset
 * `RESEND_API_KEY` means no mail is attempted, not a crash). `forbidden` — the value must not be
 * in that deployment, and `env:sync` drops it there even if a file carries it. `ADMIN_EMAILS` is
 * forbidden on the demo because that target is signed into by demo identities and shown to
 * whoever is being shown the product.
 *
 * ## The source kinds, and why there are four
 *
 * `vault` is a Bitwarden Secrets Manager key. The vault name is often **not** the env name
 * (`ALIGNSYNCH_STRIPE_TEST_WEBHOOK_SECRET` → `STRIPE_ALIGNSYNCH_TEST_WEBHOOK_SECRET`), which is
 * exactly the drift this table makes visible. `literal` is a value the repo owns and that is not
 * a secret (a brand, an origin). `derived` is computed at render time. `carried` is the value the
 * tree already holds for that environment — `neon env pull` writes the connection strings and
 * nothing in this repo can invent one, so the honest row says "carry what the deployment has",
 * and a name that is required and does not resolve refuses the write by name.
 *
 * A row with **no** source means the application carries its own default and render writes
 * nothing: `STRIPE_API_VERSION` is pinned in code, the legacy `STRIPE_TEST_*` trio is read only
 * when a deployment never set `BILLING_KEY_SET`, and a generated file must not bring it back.
 *
 * ## Two directions, because a table that only grows is a table nobody can trust
 *
 * `pnpm env:check` fails on both:
 *
 *   - **a name the code reads that no row declares** (`undeclared`) — a new variable that landed
 *     in the code and not in the table;
 *   - **a row nothing in the code reads** (`rotted`) — the row a rename left behind, which is the
 *     shape of incident 1: a key that looks configured and reaches nothing.
 *
 * It also fails when the code *refuses without* a variable (`"NAME is not set"`) and the row is
 * not marked `boot`, and when a row's environments disagree with themselves — a boot variable that
 * a deployment cannot have, or a live-mode credential, which this product does not run: every
 * environment is the provider's test sandbox and a `sk_live_` path is forbidden by name.
 *
 * `scripts/verify.sh` runs it in **every lane**, because the table is `scripts/`, the rows are
 * decisions and the values are read across `lib/`, `app/` and `data/` — three paths, three lanes,
 * one check. It reads names and source text only: **no BWS, no network, no credential**, because
 * CI holds no vault token and a gate that needs one is a gate that fails on someone else's laptop.
 *
 * ## What it deliberately does not prove
 *
 * A name read only through a list helper (`firstSet(["A", "B"])` in `lib/objstore.ts`) is found by
 * the **rotted** direction — a row must appear in the tree as a token — and not by the
 * **undeclared** one, which resolves `process.env.NAME`, `process.env["NAME"]` and
 * `process.env[CONSTANT]`. Adding one of those without a row is caught at render time instead, as
 * `MISSING`, because render writes only what the table declares.
 *
 * ## CLI
 *
 *   node scripts/env-manifest.ts --check     # the gate step; census line, then findings
 *   node scripts/env-manifest.ts --write-example   # regenerate `.env.example` from the table
 *   node scripts/env-manifest.ts --files     # local only: keys in `.env*` that no row declares
 *   node scripts/env-manifest.ts --json      # the table, for `env:sync`
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The repo root, from this module's own location (`.datacheck/scripts/` included). */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The three places this application runs. Order is the order every table prints in. */
export const ENVIRONMENTS = ["local", "preview", "production"] as const;

export type EnvironmentId = (typeof ENVIRONMENTS)[number];

/** The file each environment is written to. All three are gitignored (`.env*`). */
export const ENVIRONMENT_FILES: Readonly<Record<EnvironmentId, string>> = {
  local: ".env.local",
  preview: ".env.demo",
  production: ".env",
};

/** What an environment needs from a variable. */
export type Requirement = "required" | "optional" | "forbidden";

/** Where a value comes from. */
export type Source =
  | { readonly vault: string }
  | { readonly literal: string }
  | { readonly derived: "package.json:version" | "git:commit" }
  /**
   * The value this environment's own file already holds — `neon env pull` writes the connection
   * strings and nothing in this repo can invent one. It is resolved from **that environment's
   * file and no other** (`ENVIRONMENT_FILES`), which is the mechanical half of the incident where
   * `.env.local` outranked `.env` and a "production" credential landed on the demo branch.
   */
  | { readonly carried: true };

/** One declared variable. */
export interface EnvRow {
  readonly name: string;
  /** Must resolve before the first request is served. */
  readonly boot: boolean;
  readonly environments: Readonly<Record<EnvironmentId, Requirement>>;
  /** The default source, when one answer serves all three environments. */
  readonly source?: Source;
  /** A per-environment override, when one row's value differs by deployment. */
  readonly sources?: Partial<Record<EnvironmentId, Source>>;
  /** One line: what reads it, or why the row exists. */
  readonly why: string;
}

/**
 * A name the code reads that this table deliberately does not own.
 *
 * Each entry is an exact name with its own reason — never a wildcard. `carry` marks the one
 * local tool credential that must survive a render (the vault token the renderer itself needs);
 * everything else here is a knob, a CI variable or a platform value that no deployment owns.
 */
export interface OutOfScopeRow {
  readonly name: string;
  readonly why: string;
  readonly carry?: boolean;
}

const row = (
  name: string,
  environments: readonly [Requirement, Requirement, Requirement],
  source: Source | undefined,
  why: string,
  boot = false,
): EnvRow => ({
  name,
  boot,
  environments: { local: environments[0], preview: environments[1], production: environments[2] },
  source,
  why,
});

/**
 * A row whose value differs by environment — the case the operator's vault was written for.
 *
 * The webhook secret is the one that matters: production's endpoint and the demo's endpoint sign
 * with **different** secrets, and a single row here reproduces the "webhooks stopped working days
 * later" bug class. A `null` cell means that environment has no source (the application's own
 * default, or a value only an operator supplies).
 */
const split = (
  name: string,
  environments: readonly [Requirement, Requirement, Requirement],
  sources: readonly [Source | undefined, Source | undefined, Source | undefined],
  why: string,
  boot = false,
): EnvRow => ({
  name,
  boot,
  environments: { local: environments[0], preview: environments[1], production: environments[2] },
  sources: {
    local: sources[0],
    preview: sources[1],
    production: sources[2],
  },
  why,
});

/** The one way a row says "keep what this environment's own file holds". */
const carried: Source = { carried: true };

/**
 * Every variable the application reads, one row each.
 *
 * Grouped by the subsystem that reads it, in the order a reader needs them: the database and auth
 * block first, because a tree without those does not run at all.
 */
export const ENV_ROWS: readonly EnvRow[] = [
  // --- Database -------------------------------------------------------------------------------
  split(
    "DATABASE_URL",
    ["required", "required", "required"],
    [
      { vault: "ALIGNSYNCH_DEMO_DATABASE_URL" },
      { vault: "ALIGNSYNCH_DEMO_DATABASE_URL" },
      { vault: "ALIGNSYNCH_PROD_DATABASE_URL" },
    ],
    "The pooled connection string every runtime read opens (lib/db/client.ts). Production's own " +
      "string is a separate vault row, so a production render can never inherit the demo's.",
    true,
  ),
  split(
    "DATABASE_URL_UNPOOLED",
    ["required", "required", "required"],
    [
      { vault: "ALIGNSYNCH_DEMO_DATABASE_URL_UNPOOLED" },
      { vault: "ALIGNSYNCH_DEMO_DATABASE_URL_UNPOOLED" },
      { vault: "ALIGNSYNCH_PROD_DATABASE_URL_UNPOOLED" },
    ],
    "Direct URL for migrations and seeds — DDL transactions do not belong behind the pooler.",
  ),
  row(
    "NEON_BRANCH",
    ["optional", "optional", "optional"],
    carried,
    "Informational: the branch a URL points at, printed by the db:* scripts.",
  ),
  row(
    "NEON_PROJECT_ID",
    ["optional", "optional", "optional"],
    carried,
    "A project-scoped NEON_API_KEY cannot list projects, so the id is named (lib/account/purge.ts).",
  ),
  row(
    "NEON_API_KEY",
    ["optional", "optional", "optional"],
    { vault: "ALIGNSYNCH_NEON_API_KEY" },
    "Deletes a deleted account's managed-auth user (#278); absent means the scrub is skipped.",
  ),

  // --- Auth (Neon Managed Better Auth) --------------------------------------------------------
  split(
    "NEON_AUTH_BASE_URL",
    ["required", "required", "required"],
    [
      { vault: "ALIGNSYNCH_DEMO_NEON_AUTH_BASE_URL" },
      { vault: "ALIGNSYNCH_DEMO_NEON_AUTH_BASE_URL" },
      { vault: "ALIGNSYNCH_PROD_NEON_AUTH_BASE_URL" },
    ],
    "The auth service's base URL; without it /api/auth and every gated page answer 500 by name.",
    true,
  ),
  split(
    "NEON_AUTH_COOKIE_SECRET",
    ["required", "required", "required"],
    [
      { vault: "ALIGNSYNCH_DEMO_NEON_AUTH_COOKIE_SECRET" },
      { vault: "ALIGNSYNCH_DEMO_NEON_AUTH_COOKIE_SECRET" },
      { vault: "ALIGNSYNCH_PROD_NEON_AUTH_COOKIE_SECRET" },
    ],
    "Signs the session cookie and, domain-separated, the demo unlock and form-guard tokens.",
    true,
  ),

  // --- Admin ----------------------------------------------------------------------------------
  row(
    "ADMIN_EMAILS",
    ["optional", "forbidden", "required"],
    carried,
    "The operator allowlist. Forbidden on the demo: that target is signed into by demo identities.",
  ),
  row(
    "ADMIN_01_EMAIL",
    ["required", "optional", "forbidden"],
    carried,
    "A seeded platform admin's address, read by db:seed through its numbered loop.",
  ),
  row(
    "ADMIN_01_PASS",
    ["required", "optional", "forbidden"],
    carried,
    "That seat's password. Never synced to production — a production seat is provisioned, not seeded.",
  ),
  row(
    "ADMIN_02_EMAIL",
    ["required", "optional", "forbidden"],
    carried,
    "The second seeded platform admin's address.",
  ),
  row(
    "ADMIN_02_PASS",
    ["required", "optional", "forbidden"],
    carried,
    "The second seat's password.",
  ),

  // --- Demo mode ------------------------------------------------------------------------------
  row(
    "DEMO_AUTH",
    ["optional", "required", "forbidden"],
    { literal: "1" },
    "Mounts /demo. Forbidden in production: the PIN panel must not exist on the real product.",
  ),
  row(
    "DEMO_PIN",
    ["required", "required", "forbidden"],
    carried,
    "The PIN the demo panel accepts; DEMO_AUTH=1 without it is not demo mode.",
  ),
  row(
    "DEMO_ALLOW_PRODUCTION",
    ["optional", "optional", "forbidden"],
    undefined,
    "The escape hatch that would mount /demo in production. Never set on the real product.",
  ),

  // --- Email ----------------------------------------------------------------------------------
  row(
    "RESEND_API_KEY",
    ["optional", "optional", "optional"],
    { vault: "ALIGNSYNCH_RESEND_API_KEY" },
    "Mail is attempted only when this is set; its absence is reported, never a crash.",
  ),
  row(
    "RESEND_FROM",
    ["optional", "optional", "optional"],
    carried,
    "The From address; falls back to Resend's development sender when unset.",
  ),
  row(
    "RESEND_WEBHOOK_SECRET",
    ["optional", "optional", "optional"],
    carried,
    "Signs POST /api/resend/webhook. Unset means the endpoint refuses every delivery with a 503.",
  ),
  row(
    "RESEND_ENDPOINT",
    ["optional", "optional", "optional"],
    carried,
    "Points a send at a capture server instead of Resend (`mailEndpoint`); unset means Resend's own.",
  ),
  row(
    "RESEND_KEY_MODE",
    ["optional", "optional", "optional"],
    carried,
    "Forces the mail key's mode (lib/email/key-mode.ts) — `test` or `captured`, so a send is refused.",
  ),

  // --- Brand and build ------------------------------------------------------------------------
  row(
    "BRAND",
    ["required", "required", "required"],
    { literal: "alignsynch" },
    "One tree, two builds. Both deployments here are the AlignSynch record.",
  ),
  row(
    "APP_VERSION",
    ["optional", "optional", "optional"],
    { derived: "package.json:version" },
    "Rendered in the shell and reported by /api/version. next.config.mjs injects it from " +
      "package.json at build time, so no deployment sets it; a render still writes the same value.",
  ),
  row(
    "APP_COMMIT",
    ["optional", "optional", "optional"],
    { derived: "git:commit" },
    "The commit a build reports; falls back to VERCEL_GIT_COMMIT_SHA when unset.",
  ),
  split(
    "NEXT_PUBLIC_BASE_URL",
    ["optional", "optional", "optional"],
    [
      { literal: "http://localhost:3000" },
      { literal: "https://demo.alignsynch.com" },
      { literal: "https://alignsynch.com" },
    ],
    "The origin every flow link and email is built from. No trailing slash.",
  ),

  // --- Forms and docs -------------------------------------------------------------------------
  row(
    "CONTACT_IP_SALT",
    ["optional", "optional", "optional"],
    carried,
    "Salts the contact form's hashed client IP; the guard degrades honestly when unset.",
  ),
  row(
    "FORM_GUARD_SECRET",
    ["optional", "optional", "optional"],
    undefined,
    "Optional override: the fill-token MAC falls back to NEON_AUTH_COOKIE_SECRET, then CONTACT_IP_SALT.",
  ),
  row(
    "GH_FEEDBACK_TOKEN",
    ["optional", "optional", "optional"],
    { vault: "ALIGNSYNCH_GH_FEEDBACK_TOKEN" },
    "Files a docs-feedback issue. Unset means the feedback is stored and no issue is opened.",
  ),

  // --- Platform health ------------------------------------------------------------------------
  row(
    "PLATFORM_HEALTH_DRIFT_LIMIT",
    ["optional", "optional", "optional"],
    undefined,
    "Overrides the drift threshold /admin/health judges the platform record against.",
  ),
  row(
    "PLATFORM_HEALTH_FRESHNESS_HOURS",
    ["optional", "optional", "optional"],
    undefined,
    "Overrides the age after which the platform record reads stale.",
  ),

  // --- Billing --------------------------------------------------------------------------------
  row(
    "BILLING_PROVIDER",
    ["optional", "optional", "optional"],
    carried,
    "mock (default, keyless) or stripe. Unset is the demo adapter and still boots.",
  ),
  split(
    "BILLING_HOST",
    ["required", "required", "required"],
    [
      { vault: "ALIGNSYNCH_DEMO_BILLING_HOST" },
      { vault: "ALIGNSYNCH_DEMO_BILLING_HOST" },
      { vault: "ALIGNSYNCH_PROD_BILLING_HOST" },
    ],
    "alignsynch or demo — the host claim a checkout stamps and a webhook filters on. No default.",
  ),
  row(
    "BILLING_KEY_SET",
    ["required", "required", "required"],
    { vault: "ALIGNSYNCH_BILLING_KEY_SET" },
    "Names which key set the adapter reads, whole or not at all. One vault row: the value is " +
      "environment-invariant, so a render cannot switch accounts between deployments.",
  ),
  row(
    "STRIPE_API_VERSION",
    ["optional", "optional", "optional"],
    undefined,
    "Pins the Stripe-Version header. Unset uses the constant in lib/billing/adapters/stripe.ts.",
  ),
  row(
    "STRIPE_VENTURE_TEST_SECRET_KEY",
    ["required", "required", "required"],
    { vault: "ALIGNSYNCH_VENTURE_STRIPE_TEST_KEY" },
    "A key-set member (BILLING_KEY_SET=ventureio-test). Test mode only; the adapter refuses a live key.",
  ),
  row(
    "STRIPE_VENTURE_TEST_PUBLISHABLE_KEY",
    ["required", "required", "required"],
    { vault: "ALIGNSYNCH_VENTURE_STRIPE_TEST_PUBLISHABLE_KEY" },
    "The browser key for the embedded capture, same set as above.",
  ),
  split(
    "STRIPE_VENTURE_TEST_WEBHOOK_SECRET",
    ["required", "required", "required"],
    [
      carried,
      { vault: "ALIGNSYNCH_VENTURE_STRIPE_TEST_WEBHOOK_SECRET_DEMO" },
      { vault: "ALIGNSYNCH_VENTURE_STRIPE_TEST_WEBHOOK_SECRET_PROD" },
    ],
    "Signs POST /api/billing/webhook. Two vault rows, not one: the two endpoints sign with " +
      'different secrets, and a single row is the "webhooks stopped days later" bug. A ' +
      "developer's own file keeps whatever `stripe listen` printed, which no vault can supply.",
  ),
  row(
    "STRIPE_ALIGNSYNCH_TEST_SECRET_KEY",
    ["optional", "optional", "optional"],
    { vault: "ALIGNSYNCH_STRIPE_TEST_KEY" },
    "The other key set's secret (BILLING_KEY_SET=alignsynch-test). Optional: unused while not selected.",
  ),
  row(
    "STRIPE_ALIGNSYNCH_TEST_PUBLISHABLE_KEY",
    ["optional", "optional", "optional"],
    { vault: "ALIGNSYNCH_STRIPE_TEST_PUBLISHABLE_KEY" },
    "The other key set's browser key.",
  ),
  split(
    "STRIPE_ALIGNSYNCH_TEST_WEBHOOK_SECRET",
    ["optional", "optional", "optional"],
    [
      carried,
      { vault: "ALIGNSYNCH_STRIPE_TEST_WEBHOOK_SECRET_DEMO" },
      { vault: "ALIGNSYNCH_STRIPE_TEST_WEBHOOK_SECRET" },
    ],
    "The other key set's endpoint secret. Per environment, for the same reason as the venture set.",
  ),
  row(
    "STRIPE_TEST_SECRET_KEY",
    ["optional", "optional", "optional"],
    undefined,
    "The legacy trio, read only when BILLING_KEY_SET is unset. Not written: a render must not carry",
  ),
  row(
    "STRIPE_TEST_PUBLISHABLE_KEY",
    ["optional", "optional", "optional"],
    undefined,
    "the other account's legacy key forward. Unset BILLING_KEY_SET is refused by name, not guessed at.",
  ),
  row(
    "STRIPE_TEST_WEBHOOK_SECRET",
    ["optional", "optional", "optional"],
    undefined,
    "The legacy trio's endpoint secret. Same rule: declared so the read is accounted for, never written.",
  ),

  // --- Object storage -------------------------------------------------------------------------
  row(
    "NEON_OBJSTORE_ENDPOINT",
    ["optional", "optional", "optional"],
    carried,
    "The branch's S3 endpoint; only pnpm objstore:smoke and a media write read the block.",
  ),
  row(
    "NEON_OBJSTORE_ACCESS_KEY",
    ["optional", "optional", "optional"],
    carried,
    "Object-storage access key (falls back to AWS_ACCESS_KEY_ID when unset).",
  ),
  row(
    "NEON_OBJSTORE_SECRET_KEY",
    ["optional", "optional", "optional"],
    carried,
    "Object-storage secret key (falls back to AWS_SECRET_ACCESS_KEY).",
  ),
  row(
    "NEON_OBJSTORE_BUCKET",
    ["optional", "optional", "optional"],
    carried,
    "The bucket, which has no AWS-shaped equivalent: ours to name.",
  ),
  row(
    "NEON_OBJSTORE_REGION",
    ["optional", "optional", "optional"],
    undefined,
    "Defaults to us-east-2 in lib/objstore.ts.",
  ),
];

/**
 * Names the code reads that this table does not own, each with the reason it does not.
 *
 * Three families, no wildcards: a test or release knob (never deployed), a CI or platform variable
 * (supplied by the runtime), and the one local tool credential a render must carry forward.
 */
export const OUT_OF_SCOPE: readonly OutOfScopeRow[] = [
  // --- Local tool credentials -----------------------------------------------------------------
  {
    name: "BWS_ACCESS_TOKEN",
    why: "Bitwarden Secrets Manager token — a local tool credential, never synced to a deployment",
    carry: true,
  },

  // --- Held in the vault for something that is not the app --------------------------------
  {
    name: "RIO_GITHUB_KEY",
    why: "agent tooling, not app runtime — the vault row exists and no row claims it",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    why: "the Neon auth provider holds the Google client config; no app code path reads it",
  },

  // --- Platform-provided ----------------------------------------------------------------------
  { name: "NODE_ENV", why: "set by node/next, never by a deployment's config file" },
  { name: "NEXT_PHASE", why: "next's own build-phase marker (instrumentation.ts)" },
  { name: "NEXT_RUNTIME", why: "next's own runtime marker (instrumentation.ts)" },
  { name: "VERCEL_ENV", why: "set by Vercel in every deployment; decides demo refusal" },
  { name: "VERCEL_GIT_COMMIT_SHA", why: "set by Vercel; APP_COMMIT's fallback in next.config.mjs" },
  {
    name: "VERCEL_OIDC_TOKEN",
    why: "minted per deployment; a local copy is a captured credential",
  },
  { name: "PATH", why: "the shell's, read by the release tooling" },
  { name: "HOME", why: "the shell's, read by the release tooling" },
  { name: "TMPDIR", why: "the shell's, read by the QA-atlas capture" },

  // --- Test and QA knobs (never deployed) -----------------------------------------------------
  { name: "BASE_URL", why: "harness target for the live flow/e2e walk (scripts, not the app)" },
  { name: "CDP_PORT", why: "headless-Chrome debug port for a QA capture" },
  { name: "CDP_WIDTH", why: "QA capture viewport width" },
  { name: "CDP_HEIGHT", why: "QA capture viewport height" },
  { name: "CHROME_BIN", why: "the Chrome binary a QA capture drives" },
  { name: "CHECK_FAST_BASE", why: "the git ref `pnpm check:fast` diffs against" },
  { name: "COACH_HTML_OUT", why: "writes a rendered coach page to disk in a test" },
  { name: "DEMO_BRANCH", why: "which Neon branch demo:reset targets" },
  {
    name: "DEMO_BRANCH_LIMIT",
    why: "the plan's branch ceiling a demo prune counts against (scripts/demo-branch-prune.mjs)",
  },
  {
    name: "DEMO_KEEP_BRANCHES",
    why: "branches a demo prune never deletes (scripts/demo-branch-prune.mjs)",
  },
  {
    name: "DEMO_PRESERVED_MAX_AGE_DAYS",
    why: "age after which a kept demo branch becomes prunable (scripts/demo-branch-prune.mjs)",
  },
  { name: "DEMO_ORIGIN", why: "the origin a demo reset/deploy asserts is trusted" },
  { name: "DEMO_SOURCE_BRANCH", why: "the branch a demo reset restores from" },
  { name: "DEMO_FLOW_DEBUG_PORT", why: "debug port for the recorded demo walk" },
  { name: "DEMO_FLOW_DUMP", why: "dumps each judged page during the recorded demo walk" },
  { name: "DEMO_FLOW_ONLY", why: "runs one step of the recorded demo walk" },
  { name: "DEMO_FLOW_OUT", why: "where the recorded demo walk writes its transcript" },
  { name: "DEMO_FLOW_REQUIRE_SEED", why: "fails the demo walk instead of seeding" },
  { name: "DEMO_FLOW_SKIP_SEED", why: "skips the seed phase of the demo walk" },
  { name: "FLOW_E2E_DUMP", why: "dumps each page the live flow walk judges" },
  {
    name: "GATE_LANE",
    why: "the gate depth `scripts/verify.sh` runs — auto classifies the diff, full forces the code lane; forwarded by scripts/health-record.mjs",
  },
  {
    name: "HEALTH_RECORD_REFRESH",
    why: "re-measures instead of reading the recorded platform health",
  },
  { name: "PARITY_ARTIFACT_DIR", why: "where a parity mismatch writes its render" },
  { name: "PARITY_BRAND", why: "which brand the parity child renders" },
  { name: "PARITY_REASON", why: "the sentence a parity hash rewrite records" },
  { name: "PARITY_UPDATE", why: "rewrites the parity manifest instead of comparing it" },
  { name: "PAYMENT_E2E_STATE", why: "the handoff file `pnpm payment:e2e setup` writes" },
  { name: "PROTOTYPE_SAVE_PORT", why: "the loopback sink the review artifact's Save posts to" },
  { name: "QA_ATLAS_ARCHIVE_DIR", why: "archive directory for the release atlas capture" },
  { name: "QA_ATLAS_BASE", why: "the base URL the atlas capture drives" },
  { name: "QA_ATLAS_BRAND", why: "which brand the atlas capture renders" },
  { name: "QA_ATLAS_CAPTURE_TIMEOUT_MS", why: "per-shot timeout for the atlas capture" },
  { name: "QA_ATLAS_DEBUG_PORT", why: "Chrome debug port for the atlas capture" },
  { name: "QA_ATLAS_SHOTS", why: "where the atlas capture writes its PNGs" },
  { name: "QA_ATLAS_VERSION", why: "which release directory the atlas capture writes" },

  // --- Build cache, release tooling and CI ----------------------------------------------------
  { name: "QUIZHUB_BUILD_SLOT", why: "the gate slot a build holds (scripts/build-cache.mjs)" },
  { name: "QUIZHUB_CACHE", why: "enables or disables the shared build cache" },
  { name: "QUIZHUB_CACHE_DIR", why: "the shared build cache's directory" },
  { name: "QUIZHUB_CACHE_KEY", why: "an override for the build cache's derived key" },
  { name: "XDG_CACHE_HOME", why: "where the build cache and deploy tooling keep state" },
  { name: "XDG_DATA_HOME", why: "where the vercel CLI keeps its auth file" },
  {
    name: "NO_COLOR",
    why: "a terminal knob, never a deployment's: suppresses colour in release:preflight's transcript",
  },
  { name: "GH_TOKEN", why: "a GitHub token for release mail, supplied by the shell or CI" },
  { name: "GITHUB_TOKEN", why: "the same, under the name CI injects" },
  { name: "GITHUB_REPOSITORY", why: "set by GitHub Actions" },
  { name: "GITHUB_STEP_SUMMARY", why: "set by GitHub Actions" },
  { name: "HERMES_KANBAN_BOARD", why: "the board a worktree-prune run reads" },
  { name: "HERMES_KANBAN_DB", why: "the kanban database a worktree-prune run reads" },
  { name: "HERMES_KANBAN_TASK", why: "the card a release cut attributes itself to" },
  { name: "RELEASE_MAIL_LEDGER_TITLE", why: "the ledger issue release mail appends to" },
  { name: "RELEASE_MAIL_REPO", why: "the repo release mail files its ledger entry in" },
  { name: "RELEASE_TAG", why: "the tag a release-mail run announces" },
  { name: "STAKEHOLDERS", why: "who release mail goes to (never a deployment's config)" },
  { name: "VERCEL_PROJECT_DIR", why: "which tree a deploy check reads" },
  { name: "VERCEL_TOKEN", why: "the vercel CLI's credential for a deploy or prune" },
  { name: "NEON_API_BASE", why: "overrides the Neon API base for a demo reset" },
];

/** The source that applies to one environment: the override, else the default. */
export function sourceFor(row: EnvRow, environment: EnvironmentId): Source | undefined {
  return row.sources?.[environment] ?? row.source;
}

/** The rows an environment carries at all (everything but `forbidden`). */
export function rowsFor(environment: EnvironmentId): EnvRow[] {
  return ENV_ROWS.filter((entry) => entry.environments[environment] !== "forbidden");
}

/** The rows an environment cannot work without. */
export function requiredRows(environment: EnvironmentId): EnvRow[] {
  return ENV_ROWS.filter((entry) => entry.environments[environment] === "required");
}

/** Every declared name, in table order. */
export function declaredNames(): string[] {
  return ENV_ROWS.map((entry) => entry.name);
}

/** The names `env:sync` must drop from a preview target, with the reason it prints. */
export function forbiddenIn(environment: EnvironmentId): Map<string, string> {
  return new Map(
    ENV_ROWS.filter((entry) => entry.environments[environment] === "forbidden").map((entry) => [
      entry.name,
      entry.why,
    ]),
  );
}

/** A file as the check sees it: repo-relative POSIX path plus its source text. */
export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

/** One finding, naming the variable and the rule it broke. */
export interface Problem {
  readonly name: string;
  readonly rule:
    | "undeclared"
    | "rotted"
    | "boot"
    | "environments"
    | "live"
    | "duplicate"
    | "example";
  readonly message: string;
}

/** The line every run prints, green or red. */
export interface Census {
  readonly declared: number;
  readonly boot: number;
  readonly unresolved: number;
  readonly outOfScope: number;
  readonly reads: number;
  readonly scanned: number;
}

/** The directories and root files the extractor reads. */
export const SCAN_DIRECTORIES = [
  "app",
  "components",
  "lib",
  "hooks",
  "content",
  "data",
  "scripts",
  "tests",
];

/** Root-level modules that read env but live outside a scanned directory. */
export const SCAN_FILES = [
  "instrumentation.ts",
  "next.config.mjs",
  "vitest.config.mts",
  "vitest.parity.mts",
  "tailwind.config.ts",
  "postcss.config.mjs",
];

const SOURCE_EXTENSIONS = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx)$/;

/** Is this a file the scan reads? */
export function isScannedPath(path: string): boolean {
  return SOURCE_EXTENSIONS.test(path);
}

/**
 * The `NAME = "value"` constants in the tree, so `process.env[AUTH_ENV_BASE_URL]` resolves to the
 * variable it names. A constant table is how the repo avoids spelling an env name twice.
 */
export function resolveConstants(files: readonly SourceFile[]): Map<string, string> {
  const constants = new Map<string, string>();
  const declaration = /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*"([A-Za-z_][A-Za-z0-9_]*)"/g;
  for (const file of files) {
    for (const match of file.source.matchAll(declaration)) {
      constants.set(match[1], match[2]);
    }
  }
  return constants;
}

/**
 * Every env name the tree reads directly: `process.env.NAME`, `process.env["NAME"]` and
 * `process.env[CONSTANT]`. A lowercase index (`process.env[name]`) is a helper's parameter, so it
 * is resolved by the row that owns the caller, never guessed at here.
 */
export function extractReads(files: readonly SourceFile[]): Map<string, Set<string>> {
  const constants = resolveConstants(files);
  const reads = new Map<string, Set<string>>();
  const note = (name: string, path: string): void => {
    const seen = reads.get(name) ?? new Set<string>();
    seen.add(path);
    reads.set(name, seen);
  };

  for (const file of files) {
    for (const match of file.source.matchAll(/process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
      note(match[1], file.path);
    }
    for (const match of file.source.matchAll(
      /process\.env\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g,
    )) {
      note(match[1], file.path);
    }
    for (const match of file.source.matchAll(/process\.env\[\s*([A-Z][A-Z0-9_]*)\s*\]/g)) {
      const resolved = constants.get(match[1]);
      if (resolved !== undefined) note(resolved, file.path);
    }
    // A module may take the env record as a parameter that defaults to `process.env`
    // (`mailEndpoint(env: MailEnv = process.env)`, #507, so a test can ask the same question
    // without touching the ambient process). The read is then a property on that record, and
    // without this rule the name reaches the table only if something else happens to read it —
    // `RESEND_ENDPOINT` was read by `lib/flow/email.ts` and declared by no row until the store
    // census found it in `.env.example` and in nothing else.
    if (/=\s*process\.env\b/.test(file.source)) {
      for (const match of file.source.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)) {
        note(match[1], file.path);
      }
    }
  }
  return reads;
}

/**
 * The modules the app cannot serve a request without — the boot wall, named rather than inferred.
 *
 * `lib/db/client.ts` throws when `DATABASE_URL` is absent; `lib/auth/config.ts` and
 * `lib/auth/server.ts` read the two `NEON_AUTH_*` names through `required()`, which throws before
 * the first session can be read. Every variable these three read is `boot: true` in the table, and
 * every row that claims `boot: true` must be read here — so the flag is the code's claim, not the
 * table's opinion.
 *
 * A refusal sentence elsewhere (`RESEND_API_KEY is not set, so no mail was attempted`) is *not* a
 * boot requirement: it is the honest degradation the product promises, and treating every one as
 * boot would have made this rule demand a mail key from a keyless demo.
 */
export const BOOT_MODULES = [
  "lib/db/client.ts",
  "lib/auth/config.ts",
  "lib/auth/server.ts",
] as const;

/**
 * The names a boot module reads, including the ones it reaches through a constant.
 *
 * `required(AUTH_ENV_BASE_URL)` and `requireVariable(["DATABASE_URL_UNPOOLED", …])` are how the
 * boot modules avoid spelling an env name twice, so the constant table is resolved here exactly as
 * `extractReads` resolves `process.env[CONST]`.
 */
export function extractBootReads(files: readonly SourceFile[]): Map<string, Set<string>> {
  const constants = resolveConstants(files);
  const boot = new Map<string, Set<string>>();
  const note = (name: string, path: string): void => {
    const seen = boot.get(name) ?? new Set<string>();
    seen.add(path);
    boot.set(name, seen);
  };

  const modules = files.filter((file) => (BOOT_MODULES as readonly string[]).includes(file.path));
  for (const [name, where] of extractReads(modules)) {
    for (const path of where) note(name, path);
  }
  for (const file of modules) {
    for (const match of file.source.matchAll(/\brequired\(\s*([A-Z][A-Z0-9_]*)\s*\)/g)) {
      const resolved = constants.get(match[1]);
      if (resolved !== undefined) note(resolved, file.path);
    }
    for (const match of file.source.matchAll(/requireVariable\(\s*\[\s*"([A-Z][A-Z0-9_]*)"/g)) {
      note(match[1], file.path);
    }
  }
  return boot;
}

/**
 * The whole check, pure over the source files so a case can hold a six-line fixture.
 *
 * Five rules, each one a way this table has already been wrong or could become wrong:
 * `undeclared` (a new read with no row), `rotted` (a row no source names), `boot` (the code
 * refuses without it and the row does not say so), `environments` (a cell that contradicts itself)
 * and `live` (a live-mode credential, which this product does not run).
 */
export function checkManifest(input: {
  readonly files: readonly SourceFile[];
  readonly rows?: readonly EnvRow[];
  readonly outOfScope?: readonly OutOfScopeRow[];
}): { census: Census; problems: Problem[] } {
  const rows = input.rows ?? ENV_ROWS;
  const outOfScope = input.outOfScope ?? OUT_OF_SCOPE;
  const files = input.files;
  const problems: Problem[] = [];

  const declared = new Map<string, number>();
  for (const entry of rows) declared.set(entry.name, (declared.get(entry.name) ?? 0) + 1);
  for (const [name, count] of declared) {
    if (count > 1) {
      problems.push({
        name,
        rule: "duplicate",
        message: `${count} rows declare ${name} — one variable has one row`,
      });
    }
  }

  const exempt = new Set(outOfScope.map((entry) => entry.name));
  const reads = extractReads(files);

  for (const [name, where] of reads) {
    if (declared.has(name) || exempt.has(name)) continue;
    problems.push({
      name,
      rule: "undeclared",
      message: `read by ${[...where].sort().join(", ")} and named by no row — add it to ENV_ROWS or OUT_OF_SCOPE`,
    });
  }

  const haystack = files.map((file) => file.source).join("\n");
  const token = (name: string): boolean =>
    new RegExp(`(^|[^A-Za-z0-9_])${name}([^A-Za-z0-9_]|$)`).test(haystack);

  for (const entry of rows) {
    if (!token(entry.name)) {
      problems.push({
        name: entry.name,
        rule: "rotted",
        message: "declared here and named nowhere in the tree — the row a rename left behind",
      });
    }
    const cells = ENVIRONMENTS.map((environment) => entry.environments[environment]);
    if (entry.boot) {
      if (entry.environments.production !== "required") {
        problems.push({
          name: entry.name,
          rule: "environments",
          message: "required before the first request, so production must be required",
        });
      }
      if (entry.environments.preview === "forbidden") {
        problems.push({
          name: entry.name,
          rule: "environments",
          message: "required at boot, but forbidden on the demo — that deployment could not start",
        });
      }
    }
    if (cells.every((cell) => cell === "forbidden")) {
      problems.push({
        name: entry.name,
        rule: "environments",
        message:
          "forbidden in all three environments — a value nothing may hold is a row to delete",
      });
    }
    if (entry.environments.local === "forbidden" && entry.environments.preview === "required") {
      problems.push({
        name: entry.name,
        rule: "environments",
        message:
          "required on the demo and forbidden on a developer's own demo — the same branch twice",
      });
    }
    const liveNames = [
      ...new Set(
        ENVIRONMENTS.flatMap((environment) => {
          const source = sourceFor(entry, environment);
          if (source === undefined) return [];
          if ("vault" in source) return [source.vault];
          if ("literal" in source) return [source.literal];
          return [];
        }),
      ),
    ];
    for (const name of liveNames) {
      if (/(^sk_live_)|(_live(_|$))|(alignsynch-live)/i.test(name)) {
        problems.push({
          name: entry.name,
          rule: "live",
          message: `sources ${name} — every environment here is the provider's test sandbox`,
        });
      }
    }
  }

  const bootReads = extractBootReads(files);
  for (const [name, where] of bootReads) {
    const entry = rows.find((candidate) => candidate.name === name);
    if (entry === undefined) {
      problems.push({
        name,
        rule: "boot",
        message: `a boot module reads it (${[...where].sort().join(", ")}) and no row declares it`,
      });
    } else if (!entry.boot) {
      problems.push({
        name,
        rule: "boot",
        message: `a boot module reads it (${[...where].sort().join(", ")}) — mark the row boot: true`,
      });
    }
  }
  for (const entry of rows) {
    if (!entry.boot || bootReads.has(entry.name)) continue;
    problems.push({
      name: entry.name,
      rule: "boot",
      message: `declared boot: true and no boot module (${BOOT_MODULES.join(", ")}) reads it`,
    });
  }

  const unresolved = problems.filter(
    (problem) => problem.rule === "undeclared" || problem.rule === "rotted",
  ).length;

  return {
    census: {
      declared: rows.length,
      boot: rows.filter((entry) => entry.boot).length,
      unresolved,
      outOfScope: outOfScope.length,
      reads: reads.size,
      scanned: files.length,
    },
    problems,
  };
}

/** Every source module under `root`, as the check sees it. */
export function readTree(root: string): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (relative: string): void => {
    const absolute = join(root, relative);
    if (!existsSync(absolute)) return;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const child = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (isScannedPath(child)) {
        files.push({ path: child, source: readFileSync(join(root, child), "utf8") });
      }
    }
  };
  for (const directory of SCAN_DIRECTORIES) walk(directory);
  for (const file of SCAN_FILES) {
    const absolute = join(root, file);
    if (existsSync(absolute)) files.push({ path: file, source: readFileSync(absolute, "utf8") });
  }
  // The table and the renderer are the one pair of modules that *talk about* `process.env.NAME`
  // in prose and in code, so counting their own source as a read would make the check find itself.
  return files.filter((file) => !SCAN_SKIP.includes(file.path));
}

/** Modules that name env variables without reading them. */
export const SCAN_SKIP = ["scripts/env-manifest.ts", "scripts/env-render.ts"];

/** `NAME=value` pairs in one env file. Values are never printed by anything in this module. */
export function parseEnvFile(path: string): Map<string, string> {
  const entries = new Map<string, string>();
  if (!existsSync(path)) return entries;
  const key = /^[A-Za-z_][A-Za-z0-9_]*$/;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    const name = line.slice(0, separator).trim();
    if (!key.test(name)) continue;
    let value = line.slice(separator + 1).trim();
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    entries.set(name, value);
  }
  return entries;
}

/** The census line, in the one shape the gate prints it. */
export function censusLine(census: Census): string {
  return (
    `env-manifest: ${census.declared} variable(s) declared, ${census.boot} required at boot, ` +
    `${census.unresolved} unresolved, ${census.outOfScope} out of scope — ${census.reads} name(s) ` +
    `read across ${census.scanned} source file(s)`
  );
}

/**
 * `.env.example` — the checked-in template, **generated from the table**.
 *
 * It used to be hand-maintained, and a hand-maintained list of names is not documentation: it was
 * 30 names while the code read 45, and it could not say which scope a name was bound in, which is
 * the whole question a deployment failure asks. So it is now a projection of `ENV_ROWS` and
 * `pnpm env:check` fails when the two disagree in either direction.
 *
 * The file carries **names and decisions only** — the requirement in each of the three
 * environments, the source of truth for each, and the row's own one-line reason. Copy it to
 * `.env.local` and fill it in, or let `pnpm env:render` write the three files from the vault.
 */
export const EXAMPLE_FILE = ".env.example";

/** How a requirement cell is written in the template. */
const REQUIREMENT_LABEL: Readonly<Record<Requirement, string>> = {
  required: "required",
  optional: "optional",
  forbidden: "forbidden",
};

/** One line, wrapped at `width` with `indent` on the continuation lines. */
function wrapLine(text: string, width: number, indent: string): string[] {
  const words = text.split(/\s+/).filter((word) => word !== "");
  const lines: string[] = [];
  let current = indent;
  for (const word of words) {
    const candidate = current === indent ? `${current}${word}` : `${current} ${word}`;
    if (candidate.length > width && current !== indent) {
      lines.push(current);
      current = `${indent}${word}`;
    } else {
      current = candidate;
    }
  }
  if (current.trim() !== "") lines.push(current);
  return lines;
}

/** `vault ALIGNSYNCH_PROD_DATABASE_URL` / `literal` / `carried .env.local` / `app default`. */
function describeSource(source: Source | undefined, environment: EnvironmentId): string {
  if (source === undefined) return "app default";
  if ("vault" in source) return `vault ${source.vault}`;
  if ("literal" in source) return "literal, in the table";
  if ("derived" in source) return `derived ${source.derived}`;
  return `carried ${ENVIRONMENT_FILES[environment]}`;
}

/** The template, rendered from the rows. Deterministic: table order, no clock, no path. */
export function renderExample(rows: readonly EnvRow[] = ENV_ROWS): string {
  const lines: string[] = [
    "# GENERATED by `pnpm env:check --write-example` from scripts/env-manifest.ts — do not edit.",
    "#",
    "# Every name the application reads, one block each: what each of the three environments needs",
    "# it for, where its value comes from, and the one line saying who reads it. It carries no value",
    "# and no address — copy it to `.env.local` and fill it in, or let `pnpm env:render` write the",
    "# three real files from the vault.",
    "#",
    "#   local       `.env.local`  a developer's `pnpm dev` — the demo branch's values",
    "#   preview     `.env.demo`   the `demo` branch on Vercel → demo.alignsynch.com",
    "#   production  `.env`        `main` on Vercel → alignsynch.com",
    "#",
    "# `required` — that environment cannot work without it. `optional` — the code reports its",
    "# absence honestly. `forbidden` — that deployment must not hold it. `pnpm env:check` fails when",
    "# this file and the table disagree in either direction, so a variable is documented by the",
    "# change that adds it and never by memory.",
    "",
  ];

  for (const row of rows) {
    const cells = ENVIRONMENTS.map(
      (environment) => `${environment} ${REQUIREMENT_LABEL[row.environments[environment]]}`,
    ).join(" · ");
    lines.push(`# ${row.name}${row.boot ? " — read before the first request" : ""}`);
    lines.push(`#   ${cells}`);

    const sources = ENVIRONMENTS.map((environment) => ({
      environment,
      described: describeSource(sourceFor(row, environment), environment),
    }));
    const distinct = [...new Set(sources.map((entry) => entry.described))];
    if (distinct.length === 1) {
      lines.push(`#   source: ${distinct[0]} — local · preview · production`);
    } else {
      lines.push(`#   source —`);
      for (const entry of sources) {
        lines.push(`#     ${entry.environment.padEnd(11)}${entry.described}`);
      }
    }
    lines.push(...wrapLine(row.why, 100, "#   "));
    lines.push(`${row.name}=`);
    lines.push("");
  }

  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()}\n`;
}

/** The names a template declares, in file order, from its `NAME=` lines only. */
export function exampleNames(text: string): string[] {
  const names: string[] = [];
  const shape = /^([A-Z_][A-Z0-9_]*)=/;
  for (const raw of text.split(/\r?\n/)) {
    const match = shape.exec(raw.trim());
    if (match !== null) names.push(match[1]);
  }
  return names;
}

/**
 * The template against the table, both directions and in order.
 *
 * Order matters as much as membership: the template is a reading of the table, so a row that moved
 * and was not re-rendered shows as a diff here, which is the same signal `git diff` gives a human.
 */
export function exampleProblems(text: string, rows: readonly EnvRow[] = ENV_ROWS): Problem[] {
  const problems: Problem[] = [];
  const declared = rows.map((row) => row.name);
  const present = exampleNames(text);
  const presentSet = new Set(present);
  const declaredSet = new Set(declared);

  for (const name of declared) {
    if (!presentSet.has(name)) {
      problems.push({
        name,
        rule: "example",
        message: `${EXAMPLE_FILE} does not declare it — run \`pnpm env:check --write-example\``,
      });
    }
  }
  for (const name of present) {
    if (!declaredSet.has(name)) {
      problems.push({
        name,
        rule: "example",
        message: `${EXAMPLE_FILE} declares it and no row does — delete the line, or add the row`,
      });
    }
  }
  const inOrder = present.filter((name) => declaredSet.has(name));
  if (inOrder.join("\n") !== declared.filter((name) => presentSet.has(name)).join("\n")) {
    problems.push({
      name: EXAMPLE_FILE,
      rule: "example",
      message: "the names are out of table order — the template is a reading of the table",
    });
  }
  return problems;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    if (index === -1) return undefined;
    const value = argv[index + 1];
    return value !== undefined && !value.startsWith("--") ? resolve(value) : undefined;
  };
  /** `--dir <path>`: read another tree's source and env files (a worktree's own are gitignored). */
  const root = flag("dir") ?? repoRoot;

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ rows: ENV_ROWS, outOfScope: OUT_OF_SCOPE }, null, 2));
    return 0;
  }

  const files = readTree(root);

  // The template is generated, so writing it is part of the same command that checks it: one flag
  // keeps the file and the table in step without a second script to remember.
  if (argv.includes("--write-example")) {
    const path = join(root, EXAMPLE_FILE);
    writeFileSync(path, renderExample());
    console.log(
      `env-manifest: wrote ${EXAMPLE_FILE} from ${ENV_ROWS.length} row(s) — names and decisions ` +
        "only, no value.",
    );
    return 0;
  }

  if (argv.includes("--files")) {
    const declared = new Set(declaredNames());
    const exempt = new Set(OUT_OF_SCOPE.map((entry) => entry.name));
    let findings = 0;
    for (const environment of ENVIRONMENTS) {
      const path = join(root, ENVIRONMENT_FILES[environment]);
      const entries = parseEnvFile(path);
      if (entries.size === 0) {
        console.log(`  ${ENVIRONMENT_FILES[environment].padEnd(12)} absent — nothing to compare`);
        continue;
      }
      const extra = [...entries.keys()].filter((name) => !declared.has(name) && !exempt.has(name));
      console.log(
        `  ${ENVIRONMENT_FILES[environment].padEnd(12)} ${entries.size} key(s), ` +
          `${extra.length} named by no row`,
      );
      for (const name of extra.sort()) {
        const value = entries.get(name) ?? "";
        console.log(
          `      ${name.padEnd(38)} ${value.length} byte(s) — rendered files will not carry it`,
        );
        findings += 1;
      }
    }
    console.log(
      findings === 0
        ? "env-manifest: --files — every key in the tree is declared"
        : `env-manifest: --files — ${findings} key(s) in the tree that no row declares (local only; not a gate failure)`,
    );
    return 0;
  }

  const report = checkManifest({ files });
  // The template is the table's own projection, so `--check` holds it too: a row without a line
  // and a line without a row are the same failure in two directions.
  const examplePath = join(root, EXAMPLE_FILE);
  const exampleFindings = existsSync(examplePath)
    ? exampleProblems(readFileSync(examplePath, "utf8"))
    : [
        {
          name: EXAMPLE_FILE,
          rule: "example" as const,
          message: "absent — run `pnpm env:check --write-example` and commit it",
        },
      ];
  const problems = [...report.problems, ...exampleFindings];
  console.log(censusLine(report.census));
  for (const problem of problems) {
    console.error(`  ✗ ${problem.rule.padEnd(13)} ${problem.name}: ${problem.message}`);
  }
  if (problems.length > 0) {
    console.error(
      `\nenv-manifest: FAIL — ${problems.length} problem(s). The table is the contract: a row ` +
        "per variable, in both directions.",
    );
    return 1;
  }
  console.log(
    "env-manifest: PASS — every read is declared, every row is read, and boot refusals agree",
  );
  return 0;
}

/**
 * Invoked directly, or imported by a case? `process.argv[1]` rather than `import.meta.url`,
 * because `tsconfig.datacheck.json` compiles this module as CommonJS for the node:test suite.
 */
const invokedDirectly = /env-manifest\.(?:ts|js)$/.test(process.argv[1] ?? "");

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error("env-manifest: the check itself failed", error);
      process.exit(1);
    },
  );
}
