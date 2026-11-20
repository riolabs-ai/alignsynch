# Bundles — a template or a demo dataset, as one file (#147)

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Guides** › Bundles · next [The growth model](growth-model.md)

<!-- docs-nav:end -->

Four templates and four sessions live in `data/assessments.ts`, compiled into the build. That
is a fine store for this repository and a useless one for anybody else: a tenant cannot produce
a template this repo can read, and this repo cannot hand a tenant a dataset it can install. A
**bundle** is the file in between — one versioned, self-describing JSON document — and
`pnpm bundles` is how it is written and read.

There are three versions now, and only the last is written:

| bundleVersion | kind                   | what it carries                                                                      | command                              |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------ | ------------------------------------ |
| 1             | `template` / `dataset` | records — one template, or templates and the sessions that copy them (**read only**) | `pnpm bundles`                       |
| 2             | `platform`             | records **and** config, declared identities, media and the build it belongs to       | `pnpm bundle:pack` / `bundle:unpack` |
| 3             | `template` / `dataset` | the same records, under `payload.sessions` — what `export` writes                    | `pnpm bundles`                       |

A v1 document is **read** for one release (one deprecation line, then normalized) and never
written; see **Version 3 — the sessions key** below. A v2 document must be `kind: "platform"`;
the platform package is described under **The platform package**.

## The envelope

```json
{
  "format": "alignsynch-bundle",
  "bundleVersion": 3,
  "kind": "dataset",
  "appVersion": "1.0.0",
  "payload": {
    "templates": [ /* zAssessment, at least one */ ],
    "sessions": [ /* zAssessmentSession, any count */ ]
  }
}
```

`kind: "template"` carries `payload` = one `zAssessment` instead. Everything is `strict()`, and
the payload is the schemas the model already owns (`content/assessment.ts`) rather than a copy of
them — there is no second shape to drift.

Four properties are the whole design:

- **Canonical.** `serializeBundle()` is `JSON.stringify(value, null, 2) + "\n"` over the
  **zod-parsed** value, and every assessment schema is plain (no `.default()`, no
  `.transform()`), so a canonical bundle is a fixed point:
  `serialize(parse(serialize(x))) === serialize(x)`. Export → import → export is therefore
  byte-identical, by construction rather than by careful comparison.
- **No timestamp.** `appVersion` is provenance — the build the records came from — and E32 holds
  the committed file's stamp equal to `package.json` (`pnpm bundles export --dataset --fix`
  re-stamps it, a release bump carries it); an `exportedAt` field would
  make two exports of the same records differ, which is exactly what the round trip forbids.
  `bundleVersion` is the one format gate: a reader that does not know the number refuses the
  file instead of half-reading it.
- **No credential, structurally.** Every object is `strict()`, so an unknown key is an error —
  and a forbidden-key walk (`B4`) refuses `token`, `secret`, `password`, `apiKey`, `key` (and
  `credential` / `private-key`) by name, wherever it sits. The second rule is redundant with the
  first today, on purpose: it is the policy, and it outlives the current shape of the schemas.
  `data/brands/**` is imported by no bundle module, and no record has a field a brand token
  could live in.
- **The Gap is still a function.** There is no `gap` field in a bundle or in the store:
  `gapOf()` computes it from two Opinions on every render.

## The commands

```bash
pnpm bundles export --dataset                     # → exports/dataset.alignsynch.json
pnpm bundles export --template <id>              # → exports/<id>.alignsynch.json
pnpm bundles export --dataset --check            # is the committed bundle the canonical export? 0/1
pnpm bundles export --dataset --fix              # write data/bundles/demo-dataset.alignsynch.json
pnpm bundles import <file>                       # validate, then write the tenant store
```

`--out <file>` overrides the destination for `export`, `--check` and `--fix`. `--store <file>`
points the command at another store than `data/generated/assessments.json` — that is how a round
trip is proved without touching the tree's active set. `exports/` is gitignored: the artifact
worth shipping is the committed demo bundle, and a plain export must not dirty the tree.

Exit status: `0` ok · `1` refused (the file or the store says no) · `2` how you called it.

## The store, and the active set

An import writes `data/generated/assessments.json` (gitignored) — the **dataset payload**, not an
envelope, holding `{ templates, sessions }` in canonical form. When that file exists it is the
active set: it supersedes `data/assessments.ts` for export and for `data:check`'s E1/E2/E31.
Deleting it resets the tenant to the fixtures, which stay untouched as the demo bundle's source.
A store written by a build before version 3 is read too — normalized exactly as a v1 bundle is,
so an upgrade does not report a format change as a data error — and the next import or export
writes the current shape. Reading never rewrites the file.

- **Dataset import replaces.** It is an install, not a merge, so re-running it is idempotent and
  there is no collision concept to fail on.
- **Template import appends.** If no store exists yet the fixtures are materialized into it first
  — that is the moment a tenant stops borrowing our fixtures and owns its data — and then the
  template is added.
- **Nothing is ever renamed** in a bundle this build writes. A template import that collides with
  the active set on an `id` or a `type/slug` is refused (`B5`), naming every collision. Renaming
  would rewrite the template's `templateId` and both copies of its item ids, which makes the
  byte-identical round trip unprovable; remapping is a later issue if tenants ever need two
  copies of one template.
- **Atomic.** Parse → validate → plan → serialize → `tmp-<pid>` + `rename`. A refused import
  leaves the store byte-identical or absent and unlinks its temporary file; a failed export
  leaves nothing behind.

## The refusals

| Code | Rule                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| B1   | envelope shape: not one JSON object, a bad `format` / `kind` / `appVersion`, an unknown key                         |
| B2   | payload record: a `zAssessment` / `zAssessmentInstance` issue, or an unknown key on one                             |
| B3   | dataset collection: an id or slug twice, a `templateId` outside the bundle, a drifted copy                          |
| B4   | forbidden key: a key naming a credential, wherever it sits                                                          |
| B5   | a template import colliding with the active store — the import refuses rather than rewriting                        |
| B6   | `bundleVersion`: this build reads 1, 2 and 3                                                                        |
| B7   | build identity: the package's `schemaVersion` / `lockfileSha256` is not this tree's                                 |
| B8   | a package that drops a record something it keeps still references                                                   |
| B9   | the record-array key disagrees with the version — the old key at v3, the new one at v1, or both keys in one payload |

Every refusal is one line per problem, `[B<n>] <path>: <message>`, where the path is the key a
person has to change: `[B4] payload.templates.0.secret: forbidden key "secret" — …`. The codes
are declared once in [`scripts/rule-codes.ts`](../../scripts/rule-codes.ts) with one owner each, the
same way the `E` codes are.

## Version 3 — the sessions key

`instance` was this product's word for **session** and it is retired (#1103). The code moved
first; the file format is the last place it lived, and that is the one breaking step:

- **`payload.sessions`** replaces `payload.instances` in a dataset, under `bundleVersion: 3`.
  Everything else about the document is unchanged, and so is every row id — `assessment-instance-*`
  is a handle referenced by relationships, party rows and the atlas fixtures, and a vocabulary card
  does not rewrite primary keys.
- **A version-1 document still imports.** The reader parses it with the v1 schema, normalizes the
  payload to the current shape and prints exactly one line:

  ```text
  bundle: legacy instances key accepted (deprecated)
  ```

  `parseBundle()` marks the result `legacy`, `importBundleFile()` reports it as `deprecated`, and
  nothing writes the old shape back: the store an import writes, and every export after it, is
  version 3. Deleting that tolerance is a later card.
- **The committed bundle is generated, never edited.** `pnpm bundles export --dataset --fix`
  rewrites `data/bundles/demo-dataset.alignsynch.json` from the fixtures, and `data:check` **E32**
  compares the two byte for byte — so a hand edit, or a fixture change without a regeneration, is
  a red build rather than a mystery. The version bump moved exactly two lines of that file.
- **A half-migrated file is refused, not guessed at.** A version-3 document still carrying the old
  key, a version-1 document already carrying the new one, and a payload carrying **both** are all
  `B9`, with the path at the offending key.
- **One consumer still emits the old shape:** the platform package's `content` group
  (`payload.content.instances`, `bundleVersion: 2`) — a different document with its own version
  gate, deliberately not moved here. Nothing else in this repo writes a v1 dataset.

## The platform package (`bundleVersion: 2`)

A tenant needs more than records: the configuration around them, the people a demo flow signs
in as, the media those records render, and a statement of which build the file belongs to.
That is a platform package — one `.zip`, and two JSON documents inside it.

```text
a.alignsynch.zip
  bundle.json      the canonical platform bundle (bundleVersion 2, kind "platform")
  manifest.json    what the container holds, and what it deliberately does not
  media/<path>     the bytes bundle.json's media index names (only when a record references one)
```

```json
{
  "format": "alignsynch-bundle",
  "bundleVersion": 2,
  "kind": "platform",
  "appVersion": "1.16.0",
  "payload": {
    "content": { "templates": [ /* zAssessment */ ], "instances": [ /* zAssessmentInstance */ ] },
    "config": {
      "plans":   [ { "id": "basic", "name": "…", "monthlyCents": 895, "yearlyCents": 8592, "features": [], "limitations": [] } ],
      "prices":  [ { "planId": "basic", "interval": "month", "amountCents": 895 } ],
      "flags":   [ { "name": "product.admin", "default": true, "templates": [], "note": "…" } ],
      "options": [ { "option": "assessment.mode", "values": ["basic", "advanced"] } ]
    },
    "identities": [ { "email": "initiator@demo.alignsynch.test", "displayName": "Avery", "role": "member" } ],
    "media": [
      { "path": "media/x.png", "sha256": "…64 hex…", "bytes": 1536 }
    ],
    "build": { "appVersion": "1.16.0", "schemaVersion": 39, "lockfileSha256": "…64 hex…" }
  }
}
```

Five things about that payload, each one a decision:

- **The content group is the schemas, not a copy.** Aspects, parties and opinions travel inside
  an instance, exactly as `content/assessment.ts` defines them; there is no second shape.
- **Config is projected, never re-authored.** `data/billing-plans.ts` and `data/flags.ts` own
  the values and `scripts/bundle-platform.ts` projects them; a plan's card details (its CTA and
  its ribbon) stay behind, because those are the brand's decision, not a tenant's data.
- **Identities are declared, never copied.** Three facts — `email`, `displayName`, `role` — and
  no fourth. There is no password, hash or session field, and `B4` refuses a document that names
  one. `displayName` is the name the seeded relationship's party rows carry, which is how
  `pnpm db:seed` binds Avery and Rowan to their seats.
- **Media is an index, not a blob.** The JSON says path, sha256 and size; the bytes are in the
  archive under `media/`. `unpack` checks every hash before writing anything.
- **`build` is what a target is compared against.** `schemaVersion` is the highest migration the
  source tree carried, `lockfileSha256` is its dependency set. See the preflight below.

### The zip is deterministic, and that is a promise with a test

`scripts/zip.mjs` is ~200 lines of `node:zlib` and no dependency — there is no archive library
in this repo and none is coming. Entry order is sorted by name (UTF-8 byte order), every entry
carries one fixed timestamp (2020-01-01 00:00), a body is deflated only when that is **smaller**
and stored when it is not, and there are no directory entries, extra fields, comments or data
descriptors. So:

```bash
pnpm bundle:pack --dataset --out /tmp/a.zip
pnpm bundle:pack --dataset --out /tmp/b.zip
sha256sum /tmp/a.zip /tmp/b.zip     # the same hash, or a finding to investigate
```

A zip whose hash moves between two identical runs is a **finding, not flakiness**:
`scripts/__tests__/zip.test.ts` pins order-independence, the fixed timestamp, STORE-vs-DEFLATE
both ways, an entry past 64 KB, the CRC32 check value, and a corrupted byte failing its CRC.

### Subsets — derived, and accounted for

`manifest.json` carries `dropped: [{ kind, id, reason }]`, so "what is not in this package" is a
fact rather than an absence, and every rule below is checked rather than trusted.

- **`--subset prod`** strips every identity on `demo.alignsynch.test` (`data/platform-identities.ts`
  is the one classifier) and every relationship whose **every** seat is one of those personas.
  Templates, plans, prices, flags, options and media survive: a production tenant needs the
  product.
- **`--subset preview`** keeps the first `N` templates (`--limit`, default 3), exactly **one**
  persona, and the relationships that survive both — their template is in the slice and every
  seat belongs to the persona it declares. Everything else is on the drop list.
- **A partial demo relationship is `B8`.** Dropping a persona from a relationship that also has
  a real seat would either orphan that seat or delete a tenant's data, and neither is the
  packer's call: the refusal names both sides and asks a person to choose.

### The commands

```bash
pnpm bundle:pack --dataset --out /tmp/a.zip              # the active set as a platform package
pnpm bundle:pack --dataset --subset prod --out /tmp/prod.zip
pnpm bundle:pack --dataset --subset preview --limit 2 --out /tmp/preview.zip
pnpm bundle:pack --from /tmp/unpacked --out /tmp/c.zip   # re-pack an unpacked package (round trip)
pnpm bundle:unpack /tmp/a.zip [--out <dir>] [--install]  # validate, then write (and optionally install)
pnpm bundle:identities /tmp/a.zip                        # dry run: what the package declares
pnpm bundle:identities /tmp/a.zip --apply                # create them through this branch's sign-up
pnpm bundle:identities /tmp/a.zip --cleanup              # remove exactly the accounts that run created
```

`unpack` writes `bundle.json`, `manifest.json` and `media/**` to `exports/unpacked/` (gitignored);
`--install` additionally writes the content to the tenant store. A `--from` pack of one of those
directories reproduces the original sha256, which is the round-trip proof:

```bash
pnpm bundle:pack --dataset --out /tmp/a.zip
pnpm bundle:unpack /tmp/a.zip --out /tmp/unpacked
pnpm bundle:pack --from /tmp/unpacked --out /tmp/c.zip
sha256sum /tmp/a.zip /tmp/c.zip                          # identical
```

### The preflight — `B7`, a refusal and never a migration

`build` is compared with the tree the package is opened on, **before** the first byte is written:

- `schemaVersion` higher than this tree's → `B7`, naming the migration to apply and the fact that
  `pnpm db:migrate` is the operator's step. A package never applies SQL; a data format that
  migrated a database would be a migration tool in disguise.
- `schemaVersion` lower → `B7` too: a package is not a downgrade path.
- `lockfileSha256` different → `B7`: the same migrations on a different dependency set is a
  different build.
- `appVersion` different is **reported**, not refused: it moves on every release while a package
  stays installable.

### Identities go through the target's own sign-up endpoint

`--apply` POSTs to `{NEON_AUTH_BASE_URL}/sign-up/email` — the same call `pnpm db:seed` makes, so
the account is a real Neon Auth user with a Better Auth hash and no SQL INSERT into `neon_auth`.
The password is 24 random bytes, generated on the target, printed nowhere and stored nowhere.
Each created id is written to the ledger (`exports/package-identities.json`), and `--cleanup`
deletes **exactly** those ids and unbinds any `party.user_id` seat they held (#865: the demo
branch is shared, so a run that created accounts must be able to take them away).

Both halves need credentials — `NEON_AUTH_BASE_URL` for the sign-up and `DATABASE_URL` for the
cleanup — so they run through `bin/withenv.sh`, and **no gate step ever calls them**: `pack` and
`unpack` open no connection, and `pnpm data:check` / `bash scripts/verify.sh` stay database-free.

## What the gate checks

- **E32** — `data/bundles/demo-dataset.alignsynch.json` is the canonical export of
  `data/assessments.ts`, byte for byte, **and its `appVersion` is `package.json`'s version**. A
  fixture edited without regenerating the bundle is drift in a file other people import, and no
  other check can see it: the records are valid, the bundle is valid, and they say different
  things. So is a stamp naming another build — the file would tell an importer a false answer.
  Regenerate both with `pnpm bundles export --dataset --fix`.
- **E33** — when a tenant store exists, it parses as a dataset payload and the active set passes
  E0/E1/E2/E31 against itself.
- **`scripts/__tests__/zip.test.ts`** — round trip, determinism (twice, and in a shuffled order),
  STORE for an incompressible body and DEFLATE for a compressible one, an entry past 64 KB, the
  CRC32 check value, and a flipped byte failing its CRC.
- **`scripts/__tests__/bundle-platform.test.ts`** — the same tree packs to the same sha256, a
  round trip re-packs byte-identically, `--subset prod` carries zero demo identities and
  `--subset preview` exactly one, every drop is on the manifest, `B7` refuses a tree with a
  different `schemaVersion`/lockfile, `B4` refuses an identity row with a `password`, and a
  version-1 document still parses unchanged.

None of these opens a connection: `pack`, `unpack` and every test are file work, and the only
code that touches Postgres is `bundle:identities --cleanup`, which no gate step calls.

`appVersion` in the committed bundle is provenance a reader trusts, so E32 **gates** it: the
committed stamp must equal `package.json`'s version, and a release bump carries
`pnpm bundles export --dataset --fix` in the same commit (#1320). The stamp is never hand-edited —
for four releases it drifted from `1.20.1` while the comparison re-stamped with the committed
file's own version, so the gate could not see it.

## What this does not do

- No quiz or article bundles — a v1 or v3 `kind` is `["template", "dataset"]`, and a v2 one is
  `"platform"`, which is the records, the config, the declarations, the media index and the build.
- No id/slug rewriting, suffixing or `--force` overwrite-by-id.
- No UI: no buttons, routes or uploads. `pnpm bundles` and `pnpm bundle:pack` are the whole
  surface.
- **No filter language, no one-click installer, no prod→prod moves** (#899's next cut). The
  format is not widened for them here: `--subset` is two derived slices and a `--limit`, not a
  `--where` predicate.
- **A package never applies SQL.** `schemaVersion` is a refusal (`B7`); `pnpm db:migrate` stays a
  deliberate human step on the target.
- **The app does not read the store yet.** `/assessment/[slug]` reads six Postgres tables
  ([`docs/specs/two-party-flow.md`](../specs/two-party-flow.md), #145/#146), so the flow and the bundle
  store are two sources today. Switching that route to the store would undo the two-party flow,
  and the store is not a database: it carries templates and sessions, not invitations or
  submitted answers. `data/tenant-assessments.ts` in the original spec is therefore not part of
  this change; the store is what `data:check` and the CLI read, and the portability that makes a
  tenant possible is the bundle itself.

<!-- docs-nav:begin -->

[Docs hub](../README.md) › **Guides** › Bundles · next [The growth model](growth-model.md)

<!-- docs-nav:end -->
