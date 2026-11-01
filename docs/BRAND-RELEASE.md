# BRAND-RELEASE — how a brand version ships without breaking parity

A brand in this repo is **tokens + name + mark**, and all three live in exactly one place each.
This page is the answer to the question that actually gets asked — _"how do I change the brand
without breaking the parity gate?"_ — in the order a change has to happen.

## What a brand is

| Thing                                | Home                                                                                  | Notes                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| name, legalName, description, domain | `content/brand.ts` (schema) → `data/brand.ts` / `data/brands/alignsynch.ts` (records) | the words the chrome and the document head print                               |
| tokens (`colors.*`)                  | `data/brand.ts`, `data/brands/alignsynch.ts`                                          | `action` / `actionForeground` / `primary` / … — the colours the theme paints   |
| mark                                 | `lib/brand-icon.ts` (`MARK_PATHS`)                                                    | the open book; **identical geometry for every brand** — only the token differs |

A brand record is the one `data/brand.ts` resolves `BRAND` against. QuizHub's record is the
default (`quizHubBrand`); AlignSynch's is `data/brands/alignsynch.ts`. The mark is _not_ in the
record on purpose: the shape rule is "identical geometry, different token", so the book's two
paths live once in `lib/brand-icon.ts` and every brand paints them with its own `action` /
`actionForeground`. A mark that changed size between brands would be drift, not a variation.

## The one rule that keeps the colour honest

**A hex value lives only in `data/brand.ts`** (and `data/brands/alignsynch.ts` for the skin's
own tokens). No component, no SVG in `public/`, no test carries a literal colour. Components
paint through the tokens (`bg-action`, `text-action-foreground`, …) resolved by
`lib/brand-theme.ts`; the icons are _drawn_ from the record, never hand-edited. `pnpm lint` runs
`scripts/lint-brand-classes.mjs` and fails on a palette step, and the icon generator re-draws
every file so a hand-edit is immediately stale.

## What must be regenerated

A brand-visible change — a re-pointed token, a renamed product, a new mark — means:

1. **`pnpm brand:icons`** — `scripts/gen-brand-icons.mjs` re-draws the whole icon set from the
   record and `lib/brand-icon.ts`:

   ```
   public/brand/<id>-icon.svg                  favicon (the recorded `brand.icon`)
   public/brand/<id>-apple-touch-icon.png       180×180, full bleed, opaque
   public/brand/<id>-icon-192.png               192×192, full bleed, maskable-safe
   public/brand/<id>-icon-512.png               512×512, full bleed, maskable-safe
   ```

   `pnpm data:check` re-runs it with `--check` in every non-docs lane, so a record edit that
   leaves the files stale is a red gate. Never hand-edit an icon file in `public/` — regenerate.

2. **`node scripts/gen-media.mjs`** — after adding or removing a file under `public/` (E18 keeps
   `data/media.ts` a bijection with the tree). `data:check` fails on a file with no registry key.

3. **The OG image needs no regeneration** — `lib/brand-og.tsx` embeds the mark as a data URI at
   render time from the record, so `app/opengraph-image.tsx` is already the new mark on the next
   build. There is no committed `public/brand/*-og.png`, for the byte-comparability reason
   `lib/brand-og.tsx` documents.

4. **`pnpm parity:update --reason "…"`** — see below. The icon set changes the document head
   (the apple-touch link, the manifest link), so the parity hashes move; rewriting the manifest
   is the last step, not the first.

## What parity asserts

`pnpm parity` renders **seven routes** (`tests/parity/routes.ts`) under **both brands** —
14 renders — reduces each to a SHA-256, and compares every line of
`tests/parity/manifest.txt` (`route | brand | sha256`) plus its committed structural summary in
`tests/parity/summaries/`. It is a step of `bash scripts/verify.sh`, and CI is a **matrix over
`brand`**, so both `quizhub` and `alignsynch` legs must be green. The full HTML is never
committed: a mismatch writes the render to `tests/parity/artifacts/` (gitignored) for CI to
upload.

Parity also holds the **brand boundary** (`tests/parity/boundary.ts`, #300): the twenty-two quiz
routes answer `200` on QuizHub and `404` on AlignSynch. A brand change must not move that line
either — a brand-visible change is colours, name and mark, not the route table.

## The steps to ship a brand-visible change

1. **Edit the record** — `data/brand.ts` (or the skin's `data/brands/*.ts`), and nothing else
   for the colour or the name.
2. **Regenerate** — `pnpm brand:icons`, then `node scripts/gen-media.mjs` if files appeared or
   disappeared.
3. **See what moved before rewriting anything** — `pnpm parity` (it will be red, and it names
   every route and brand that drifted).
4. **Rewrite the manifest with a reason** — `pnpm parity:update --reason "brand icon set: the
   open-book mark and its apple-touch/PWA maskable set changed the document head on all routes"`.
   The reason is the sentence the PR carries; the command prints the moved routes so the sentence
   can be specific.
5. **Run the gate, both brands** — `bash scripts/verify.sh` (and `BRAND=alignsynch bash
   scripts/verify.sh` if you want the second leg locally; CI runs the matrix). `pnpm lint` must
   be clean — no palette literal sneaks in with the change.
6. **Land** — the PR names which routes moved and why, from the `--reason` above.

The rule in one line: **edit the record → regenerate the icons → `parity:update` with a reason →
both-brand CI green.** A change that skips step 3 and 4 is how a parity rewrite ends up hiding a
real drift; a change that skips step 2 is how the favicon drifts from the page.

See also: `tests/parity/README.md`, `docs/TEMPLATE-DOCTRINE.md`, `lib/brand-icon.ts`.
