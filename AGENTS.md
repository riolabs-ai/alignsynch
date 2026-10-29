# AGENTS.md — quizhub (alignsynch)

Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui quiz platform. **Frontend-only**: no
`app/api`, no database, no auth backend. `content/` holds the zod content model, `data/` holds the
fixtures that must satisfy it, and `pnpm data:check` fails the build when a fixture drifts. Remote:
`github.com/riolabs-ai/alignsynch`.

## Start every card with a fresh `main`

A stale tree is a gate failure, not a style issue: a branch tested against a tree nobody
ships produces green checks that mean nothing, and "green locally" becomes a lie.

```bash
git fetch origin --prune
git switch main
git pull --ff-only           # main must be a fast-forward of origin/main
git switch -c <type>/<slug>  # branch from the tip you just fetched
```

If `pull --ff-only` refuses, local `main` has diverged: do not merge it back into shape.
`git switch -c backup/main-<date>` to keep the work, then `git switch main` +
`git reset --keep origin/main`. Never open a card against a `main` that is behind.

## Commands (repo root, `pnpm` only — the lockfile is `pnpm-lock.yaml` v9)

| Command                          | Verified             | Notes                                                                   |
| -------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | exit 0, ~0.1 s warm  | pnpm `12.16.1`; CI installs the same way                                |
| `pnpm typecheck`                 | exit 0, 4–5 s        | `next typegen && tsc --noEmit`, `strict: true`                          |
| `pnpm data:check`                | exit 0, 5–6 s        | tsc → 34 `node:test` cases → validator; prints record counts            |
| `pnpm lint`                      | exit 0, ~0.8 s       | `biome check`; **0 errors**, 235 warnings, 13 infos on the current tree |
| `pnpm format:check`              | exit 0, ~0.4 s       | `biome format`, 299 files; CI gate                                      |
| `pnpm build`                     | exit 0, 56–76 s      | `next build`; 34 routes, 32 static pages                                |
| `pnpm dev`                       | 200 on all 34 routes | `next dev --turbo`, port 3000                                           |
| `pnpm start`                     | 200 after `build`    | production server, port 3000 by default                                 |
| `pnpm format` / `pnpm lint:fix`  | write modes          | must leave `format:check` at exit 0                                     |

Node must be **≥ 20.9** and the PATH is the only thing that decides which node you get:

```bash
export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"   # node 24.22.0 + pnpm 12.16.1
# or, in an interactive shell: nvm use   (.nvmrc = 24)
```

CI (`.github/workflows/ci.yml`) runs `bash scripts/verify.sh` on every push, PR and

merge-queue group; the job name is `typecheck / lint / build`.

## The gate: one script, two callers

```bash
bash scripts/verify.sh       # THE gate. ~45 s locally, green = shippable
```

It runs, in order, and stops at the first failure (printing the failing step and its exit
code): `deps (pnpm install --frozen-lockfile)` → `typecheck` (`next typegen && tsc
--noEmit`) → `lint` (`biome check`) → `format:check` (`biome format`) → `data:check` →
`test` → `build` (`next build`). `data:check` and `test` run only when `package.json`
defines that script; otherwise they are skipped with a visible `○ … skipped` line, so the
same script is correct on `main` (no `data:check` yet) and on branches that carry it.

CI (`.github/workflows/ci.yml`) runs **only** `bash scripts/verify.sh`. Never add a check
step to the YAML — a check that lives only in CI is a guaranteed red push, and a check
that lives only in the script is a green CI nobody can reproduce.

Runtime parity is enforced by the script, not by convention: it refuses to run when the
shell's Node major disagrees with `.nvmrc` (`24`) or when `pnpm` is not `12.x`.

```bash
nvm use                       # or: export PATH="$HOME/.nvm/versions/node/v24.22.0/bin:$PATH"
bash scripts/install-hooks.sh  # once per clone: installs the pre-push hook
```

## Pre-push hook (install path, not an assumption)

```bash
bash scripts/install-hooks.sh   # sets core.hooksPath=scripts/git-hooks
git config --get core.hooksPath # verify
git config --unset core.hooksPath   # undo
```

`scripts/git-hooks/pre-push` just execs `scripts/verify.sh`, so the hook can never drift
from CI. Because `core.hooksPath` makes git ignore `.git/hooks/` entirely, any hook you
already had must move into `scripts/git-hooks/` to keep running.

Two consequences, both deliberate:

- the hook checks the **working tree**, so uncommitted work is gated too — `git stash` WIP
  you do not intend to ship before pushing a review branch;
- `git push --no-verify` exists for real emergencies only. A `--no-verify` push followed by
  a red CI run is the exact 35-minute loop this repo is trying to delete.

Three red CI runs on the same head means **stop pushing**: reproduce with
`bash scripts/verify.sh`, read the whole log, fix the step. A fourth blind retry is a
process bug.


## Layout

- `content/` — schemas (`quiz`, `article`, `blocks`, `category`, `categories`, `social`, `search`,
  `routes`) and the derivations over them. **Never import React or Next here**: `data:check`
  compiles it with `tsconfig.datacheck.json` into `.datacheck/` and runs it under plain node.
- `data/` — the fixture modules (quizzes, promotions, news, tips, kb, social, notifications, search,
  current quiz, categories). Card shapes are projections (`selectQuizCard`), never authored arrays;
  a per-slot campaign is an engagement-only overlay (`data/promotions.ts`), never a second record.
- `scripts/data-check.ts` — the validator: per-record schema pass, then collection invariants
  E0–E16 plus W1–W6 warnings. `scripts/__tests__/data-model.test.ts` is the negative-case suite and
  `scripts/__tests__/promotion-invariants.test.ts` is the negative-case suite for E14–E16/W6.
  E10 is the one that reads the UI tree: it extracts every literal `href`,
  `router.push`/`replace`/`redirect` in `components/` + `app/` and every `public/` asset literal,
  and fails on a route the manifest cannot match or a file `public/` does not have.
  `scripts/ui-refs.ts` holds the pure extraction (no `fs`), so the cases test it directly.
- `app/(mainlayout)/**` — every product page behind the header/sidebar shell; `app/(auth)/**` —
  login/register, no shell. Dynamic segments: `quiz/[id]/{play,discussion}`,
  `my-quizzes/[id]/{statistics}`, `categories/[slug]`, `news/[slug]`, `creator-tips/[slug]`,
  `profile/[username]`, `support/articles/[id]`, `tournaments/[id]`.
- `components/<feature>/` — one directory per feature; `components/ui/` is shadcn primitives.
- `docs/p1-migration/{MIGRATION.md,ledger.json}` — what the P1 model changed, field by field.
- Generated, not part of the build: `.next/`, `.datacheck/`, `node_modules/`, `.migration/`. An
  untracked `lib/quizhub/` is a static HTML template drop — nothing imports it.

## Conventions (measured, not aspirational)

- Server Components by default: 178 of 259 TS/TSX files under `app/`, `components/`, `hooks/` and
  `lib/` carry `"use client"`. Add it only for hooks, state or event handlers.
- Import through `@/` (`tsconfig.json` paths); class merging through `cn()` from `@/lib/utils`;
  extend `components/ui/*` instead of hand-rolling primitives.
- Biome owns formatting and linting (`biome.jsonc`): 2-space, `lineWidth: 100`,
  `organizeImports` off, `pnpm-lock.yaml` excluded. `.prettierrc` is gone — never reintroduce it.
- Fixture types come from `content/` (`z.infer`, every object `.strict()`). A new field means:
  edit the schema, edit the fixture, run `pnpm data:check`. An unknown key is a hard error, not a
  silent extra.
- Lint rules that still have violations on `main` are pinned to `warn` in `biome.jsonc`; flip each
  one to `error` as its violations are fixed instead of adding suppressions.

## Pitfalls

- **`/usr/bin/node` is 18.19.1** and shadows newer runtimes, so every Next command dies with
  `You are using Node.js 18.19.1. For Next.js, Node.js version ">=20.9.0" is required.` Fix the
  PATH (above) before touching code.
- **`next/image` needs an intrinsic size.** Without `width`/`height` or `fill`, dev renders a 500:
  `Image with src "/category/animal.webp" is missing required "width" property.` `next build`
  still passes, so CI cannot see it. Use `fill` inside a `position: relative` parent.
- **Never read a clock in a render path.** A label from `new Date()` or `toLocale*` is rendered
  once by the server and re-rendered at hydration; the two disagree and every page logs React
  `#418` (hydration mismatch). `content/core.ts` owns the fixture clock (`DEMO_NOW_ISO`) and every
  label there is a pure function of the ISO instant — `data/` carries instants only, the UI calls
  `formatRelative` / `formatClockTime` / `formatDayHeading`, and `data:check` E10 fails when a
  social fixture is dated after the clock.
- **`params` is a Promise in Next 16.** Every dynamic route must take
  `params: Promise<{ id: string }>` and unwrap it (`await params` in an `async` page, or
  `use(params)`); a synchronous `params.id` logs `params is a Promise and must be unwrapped with
  await or React.use()` and renders with `undefined`. The two `my-quizzes/[id]` pages that still
  did this were fixed in issue #20 — `/my-quizzes/1/statistics` used to render
  `href="/my-quizzes/undefined"`.
- **A hardcoded `href` or asset path is checked, not trusted.** `data:check` E10 fails on an
  `href` no route in `content/routes.ts` matches and on an asset literal with no file under
  `public/` — that is how `/dashboard`, `/signup` and `/testimonials/jessica.png` 404ed for so
  long. Legacy paths from the pre-P1 shell now 308 to the real route in `next.config.mjs`; never
  add a second page to satisfy a link. There is no asset allowlist: E10 fails on any literal with
  no file under `public/`, so a new missing image is a red build, exactly like a dead link.
- **`public/category/*.webp` are placeholders:** all 23 files are the same 1536×1024 PNG stamped
  with its own dimensions. Category art is a content task, not a styling bug.
- `pnpm data:check` prints exactly one warning, `[W2] published quiz
  "quiz-ultimate-world-history-trivia" has no publishedAt`. Add a `publishedAt` or set `draft`;
  do not invent a date to silence it.
- 235 lint warnings are the current baseline. Compare counts, not vibes: a new warning is a
  regression even though `pnpm lint` exits 0.
- Stop `pnpm dev` before `pnpm build` — both write `.next/` and a concurrent run corrupts it.

## Voice capture: memo → issue → card (ops loop)

A voice note is an issue intake channel, not a chat toy. Four steps, all reproducible on one
machine; STT never leaves it (issue [#32](https://github.com/riolabs-ai/alignsynch/issues/32)).

1. **Capture.** Drop the clip on disk and keep it with the ticket — a bare transcript loses the
   tone, the numbers read aloud, and any "this part is broken" inflection. 20 s is the practical
   ceiling for one memo = one issue.
2. **Transcribe locally.** `stt.enabled: true`, `stt.provider: local` (faster-whisper `base`, Silero
   VAD on, `stt.language: en`). The `stt` toolset must be enabled (`hermes tools enable stt`); it is
   a **config-only** toolset (`_CONFIG_ONLY_TOOLSETS` in `hermes_cli/tools_config.py`) — it gates the
   transcription of inbound voice messages and voice mode, and registers no agent-callable tool, so
   "enabled" is verified by transcribing a clip, never by looking for a tool in the list.
   The Python extra is not installed by default: `hermes pm install --extra stt-whisper`. Without it
   the resolver reports `STT provider 'local' configured but unavailable` and falls to `none` — do
   **not** "fix" that by pointing `stt` at a cloud provider.
3. **File the issue.** The PM role turns the transcript into a ticket: verbatim transcript in the
   body above the summary, labels from the labels that already exist (`enhancement`, `ci`,
   `tech-debt`, `documentation`, `needs-validation`, `bug` — there is no `ops` label; adding one is a
   deliberate repo decision, not a reflex), milestone `#1 Hardening & validation` (the only one) when
   the work is in scope for it, and the acceptance line written as something a command can prove.
   The transcription command and the provider it used go in the body, so the ticket is auditable.
4. **Mirror the card.** The kanban card cites the issue number and carries the same acceptance
   criteria; when the card is worked, its handoff carries the commands that were run, not a summary
   of them. One memo → one issue → one card; a memo that wants three changes is three issues.

Measured on this machine (keep the numbers honest when re-checking):

| Check                                                                                | Result                               |
| ------------------------------------------------------------------------------------ | ------------------------------------ |
| 13.06 s clip, `unshare -rn` (no network, `huggingface.co` unreachable), model `base` | transcript in 2.9 s, near-verbatim   |
| Same clip, cold model cache (first run on this machine)                              | 9.8 s, including the model fetch     |
| 6.65 s Xiaomi-generated WAV → same local STT, offline                                | transcript in 3.4 s, near-verbatim   |
| `faster-whisper 1.2.1` present / absent                                              | `provider: local` / `provider: none` |

The `base` model mis-hears proper nouns ("Neuphonic" → "pneumonic"). That is a model-size limit, not
a config bug: raise `stt.local.model` (`small` / `medium`) for memos dense in product names, and
never "correct" a transcript into something the speaker did not say.

### Xiaomi: TTS yes (as a command provider), ASR not through `stt` today

`tts.providers.xiaomi` is wired in `~/.hermes/config.yaml` against `XIAOMI_BASE_URL`
(`https://token-plan-sgp.xiaomimimo.com/v1`) and backed by `~/.hermes/scripts/xiaomi_tts.py`; select
it with `hermes config set tts.provider xiaomi` (default stays `nous`). It is a **command** provider,
not a Python plugin provider — the config layer docs call that the supported path.

- **Endpoint:** Xiaomi synthesises through `POST {base}/chat/completions` with `model:
  mimo-v2.5-tts`, the text in an **`assistant`** message, and `audio: {format: wav, voice:
  mimo_default}`; the audio arrives base64 in `choices[0].message.audio.data`. `POST
  /v1/audio/speech` is documented as OpenAI-client compatible but returns **404** from this gateway
  (openresty), so a spike that only tries `/audio/speech` concludes "no TTS" — it is there, on the
  chat route.
- **Output:** `wav`, 24 kHz mono PCM16, ~47 KB/s (6.65 s ≈ 319 KB). Round-trip through the local STT
  is intelligible, so this is usable for voice-memo playback, not just for the spike.
- **Secrets:** command providers run with Hermes secrets scrubbed, so the provider needs
  `env_passthrough: [XIAOMI_API_KEY, XIAOMI_BASE_URL]`. Without it the script exits 2 with
  `XIAOMI_API_KEY is empty` — the error names the real cause.
- **Quota:** the text models on this gateway are `mimo-v2.6-flash` / `mimo-v2.6-pro`; TTS/ASR are the
  `mimo-v2.5-*` family (`-tts`, `-tts-voiceclone`, `-tts-voicedesign`, `-asr`). There is no v2.7.
  Spikes stay at a handful of short calls; that is the whole budget.
- **ASR has no route through `stt` today — and the reason is not "no base URL":** `mimo-v2.5-asr`
  is on `/v1/models`, but `xiaomi` is not a registered STT provider name. Unknown names pass
  through the explicit resolver untouched, so `stt.provider: xiaomi` fails as
  _provider-not-registered_. The OpenAI-compatible providers **do** accept a base URL —
  `stt.openai.base_url` is read and honoured (`_direct_openai_credentials`), and
  `stt.deepinfra.base_url`, `stt.xai.base_url` / `XAI_STT_BASE_URL`,
  `stt.elevenlabs.base_url` / `ELEVENLABS_STT_BASE_URL` exist too. So the untested route is
  `stt.provider: openai` + `stt.openai.base_url: https://token-plan-sgp.xiaomimimo.com/v1` +
  `stt.openai.model: mimo-v2.5-asr`. **Untested, not impossible:** it was left alone because it
  spends ASR quota outside this spike's budget, and for a non-OpenAI-shaped API the zero-Python
  alternative is `stt.providers.<name>: {type: command}` (same registry as TTS) or
  `HERMES_LOCAL_STT_COMMAND`; a plugin `TranscriptionProvider` is the heavier option. Neither is
  planned: local faster-whisper is the offline answer and the ops constraint is that audio does
  not leave the machine.

## Deliberate stacking

Cards that depend on another card's output branch from that branch and open the PR against
it, so the stack stays linear. Do not rebase or reorder someone else's open PR to get your
own branch moving; land the parent first. `main` requires the `typecheck / lint / build`
check through a repository **ruleset** (strict: branch must be up to date), so a red or stale
head cannot merge — see `docs/GATE.md` for the evidence and for why the classic
`/branches/main/protection` endpoint returns 404 and must not be trusted.

## Numbers

Baseline and how to re-measure: `docs/GATE.md`. As of 2026-10-29: gate p50 **45 s** locally,
CI job p50 **55 s**, first-pass yield **81.8 %** (18/22 pushes green on the first run).

## Docs

`docs/ENV-SPEC.md` is the environment, team, integration and P1–P4 gate spec, and carries the P1
completion record and QA evidence. Read it before adding tooling or a dependency.
