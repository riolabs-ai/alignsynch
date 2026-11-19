# `tests/design-captures/` — the v2 fidelity evidence shelf

What `scripts/design-audit.mjs --capture` writes. **The manifest is committed and the pixels are
not**, the same discipline as [`tests/parity/`](../parity/README.md): evidence is large and
regenerable, the record of what was measured is small and is the thing a reader trusts.

```
tests/design-captures/
  manifest.json          committed — the sha, the URL, the two widths, the reference path
  <slug>/
    live-390.png         gitignored
    live-1280.png        gitignored
    reference-390.png    gitignored
    reference-1280.png   gitignored
    side-by-side.png     gitignored — live | reference at 1280
    live.txt             gitignored — the live DOM text the row was judged on
    reference.txt        gitignored — the reference's own DOM text, at both widths
    missing.json         gitignored — reference lines the live screen does not carry
```

## Where the reference comes from

Not from the bundle's PNG. Every bundle under `spec-design-v2-bundles/NN-*` ships **the HTML its
reference PNGs were photographed from** — `relationship-detail.html?state=live` is the page
`reference/rd-live-1280.png` is a picture of. So the reference's _text_ is exact and extractable
with no OCR and no vision model, and the comparison is text against text. The PNGs still land on
disk, because a person reads them, and the side-by-side is the pairing this shelf exists for.

The reference is rendered from its **read-only location outside this checkout**. Nothing under
`project-spec/` is copied in, and no bundle PNG is committed.

Two measured quirks the harness works around, both recorded in `docs/specs/v2-surface-routes.json`:

- `?step=N` on the wizard bundle is rewritten to stage 1 by that bundle's own script, so a stage
  reference is reached by **pressing the stage** in the prototype's rail.
- `/create/mode` and `/create/aspects` answer `307 → /create` until a draft exists, so a stage the
  URL will not open is either driven (fill stage 1, press the advance control) or left
  `unverifiable`. A route that redirects is recorded under `landed`, never silently photographed.

## Regenerating

```bash
# the three inputs default to the spec drop on this machine; a different machine must set them
SPEC_DOCS_DIR=… BUNDLES_DIR=… PROTOTYPE_DIR=… \
  ~/.hermes/profiles/alignsynch/bin/withenv.sh <repo> \
  node scripts/design-audit.mjs --capture
```

`withenv.sh` supplies `DEMO_AUTH`/`DEMO_PIN` from the checkout's `.env.local`; the harness signs in
the **demo** branch only, once per role it needs (`initiator`, `counterparty`, `admin`), and issues
nothing but GETs. Without those two variables it says so, captures what it can anonymously, and the
session rows come out `unverifiable` with that reason — it never silently writes a register full of
`matches`.

Then assert the register is still complete and honest:

```bash
node scripts/design-audit.mjs --check
```

That command is **not** a gate step: it reads three directories outside this checkout and a network,
so it cannot run in `verify.sh` or CI. `bash scripts/verify.sh` stays database-free and
network-free.
