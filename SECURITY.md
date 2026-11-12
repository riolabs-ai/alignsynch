# Security

## Reporting a vulnerability

Do **not** open a public issue for a vulnerability. Report it privately through
GitHub Security Advisories on this repository: **Security → Report a
vulnerability** (https://github.com/riolabs-ai/alignsynch/security/advisories/new).

A private report keeps the details out of public view until a fix is ready.

## Scope

In scope:

- `lib/auth/**` — session and identity handling
- `app/api/**` — route handlers and webhooks
- `db/migrations/**` — schema changes
- `lib/db/**` — pool, row mapping, and database reads
- `lib/objstore.ts` — object storage credential signing
- anything that handles `NEON_*`, `ALIGNSYNCH_*`, or Stripe secrets

## What is not a vulnerability

These are documented behaviours, not defects:

- A gated console route answering `500 NEON_AUTH_BASE_URL is not set` on a tree
  with no auth environment is **by design** (`AGENTS.md`, decision A).
- Quiz routes answering `404` under the `ALIGNSYNCH` brand are the brand
  boundary (`requireQuizProduct()`), not missing pages.
- The demo dataset is synthetic; it contains no real customer data.

## Supported versions

Only the current release line is supported: the latest release and the one
before it. The current version is read from `package.json` (`1.16.0` at the
time of writing). Reports against older releases are welcome but will be
triaged against the current line.

## What to expect

Reports are acknowledged and triaged on a best-effort basis. There is no
service-level agreement and no committed response or fix window.
