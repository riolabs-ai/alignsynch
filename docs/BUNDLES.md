# Bundles — a template or a demo dataset, as one file (#147)

Four templates and four instances live in `data/assessments.ts`, compiled into the build. That
is a fine store for this repository and a useless one for anybody else: a tenant cannot produce
a template this repo can read, and this repo cannot hand a tenant a dataset it can install. A
**bundle** is the file in between — one versioned, self-describing JSON document — and
`pnpm bundles` is how it is written and read.

## The envelope

```json
{
  "format": "alignsynch-bundle",
  "bundleVersion": 1,
  "kind": "dataset",
  "appVersion": "1.0.0",
  "payload": {
    "templates": [ /* zAssessment, at least one */ ],
    "instances": [ /* zAssessmentInstance, any count */ ]
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
- **No timestamp.** `appVersion` is provenance and is never gated; an `exportedAt` field would
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

`--out <file>` overrides the destination for `export`, `--check` and `--fix`. `exports/` is
gitignored: the artifact worth shipping is the committed demo bundle, and a plain export must not
dirty the tree.

Exit status: `0` ok · `1` refused (the file or the store says no) · `2` how you called it.

## The store, and the active set

An import writes `data/generated/assessments.json` (gitignored) — the **dataset payload**, not an
envelope, holding `{ templates, instances }` in canonical form. When that file exists it is the
active set: it supersedes `data/assessments.ts` for export and for `data:check`'s E1/E2/E31.
Deleting it resets the tenant to the fixtures, which stay untouched as the demo bundle's source.

- **Dataset import replaces.** It is an install, not a merge, so re-running it is idempotent and
  there is no collision concept to fail on.
- **Template import appends.** If no store exists yet the fixtures are materialized into it first
  — that is the moment a tenant stops borrowing our fixtures and owns its data — and then the
  template is added.
- **Nothing is ever renamed** in bundle version 1. A template import that collides with the
  active set on an `id` or a `type/slug` is refused (`B5`), naming every collision. Renaming
  would rewrite the template's `templateId` and both copies of its item ids, which makes the
  byte-identical round trip unprovable; remapping is a later issue if tenants ever need two
  copies of one template.
- **Atomic.** Parse → validate → plan → serialize → `tmp-<pid>` + `rename`. A refused import
  leaves the store byte-identical or absent and unlinks its temporary file; a failed export
  leaves nothing behind.

## The refusals

| Code | Rule                                                                                         |
| ---- | -------------------------------------------------------------------------------------------- |
| B1   | envelope shape: not one JSON object, a bad `format` / `kind` / `appVersion`, an unknown key  |
| B2   | payload record: a `zAssessment` / `zAssessmentInstance` issue, or an unknown key on one      |
| B3   | dataset collection: an id or slug twice, a `templateId` outside the bundle, a drifted copy   |
| B4   | forbidden key: a key naming a credential, wherever it sits                                   |
| B5   | a template import colliding with the active store — the import refuses rather than rewriting |
| B6   | `bundleVersion`: this build reads exactly 1                                                  |

Every refusal is one line per problem, `[B<n>] <path>: <message>`, where the path is the key a
person has to change: `[B4] payload.templates.0.secret: forbidden key "secret" — …`. The codes
are declared once in [`scripts/rule-codes.ts`](scripts/rule-codes.ts) with one owner each, the
same way the `E` codes are.

## What the gate checks

- **E32** — `data/bundles/demo-dataset.alignsynch.json` is the canonical export of
  `data/assessments.ts`, byte for byte. A fixture edited without regenerating the bundle is drift
  in a file other people import, and no other check can see it: the records are valid, the bundle
  is valid, and they say different things. Regenerate with `pnpm bundles export --dataset --fix`.
- **E33** — when a tenant store exists, it parses as a dataset payload and the active set passes
  E0/E1/E2/E31 against itself.

`appVersion` in the committed bundle is provenance: E32 compares the committed file's **own**
version, so a release bump does not churn a fixture, and `--fix` re-stamps it.

## What this does not do

- No quiz or article bundles — `kind` is exactly `["template", "dataset"]`.
- No id/slug rewriting, suffixing or `--force` overwrite-by-id.
- No UI: no buttons, routes or uploads. `pnpm bundles` is the whole surface.
- **The app does not read the store yet.** `/assessment/[slug]` reads six Postgres tables
  ([`docs/TWO-PARTY-FLOW.md`](docs/TWO-PARTY-FLOW.md), #145/#146), so the flow and the bundle
  store are two sources today. Switching that route to the store would undo the two-party flow,
  and the store is not a database: it carries templates and instances, not invitations or
  submitted answers. `data/tenant-assessments.ts` in the original spec is therefore not part of
  this change; the store is what `data:check` and the CLI read, and the portability that makes a
  tenant possible is the bundle itself.
