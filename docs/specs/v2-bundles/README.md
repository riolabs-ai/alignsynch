# AlignSynch v2.0 UI · ingest bundles

**Prepared:** 16 November 2026 · **Source:** `v2-prototype` pass 10 plus the 16 November 2026 trial-start decision (DESIGN-NOTES v3.2 §45; QA-clean: check4, flow4/5/8/9/10, axe 0, brand lint 0) · **Repo path when committed:** `docs/specs/v2-bundles/` · **Release pool:** epic [#1119](https://github.com/riolabs-ai/alignsynch/issues/1119), milestone v1.22.0  
**Status:** Private design and implementation handoff. Refresh of the pass 10 bundles with the trial-start decision applied. Not pushed from this step.

These bundles repeat the format of the home-page redesign handoff (`as2-style-spec-home-redesign/`, `spec-design-page-rel-templates-v2/home/`): one self-contained folder per page family with browser-ready HTML, `css/`, `images/`, `reference/` renders, a short `README.md`, a detailed `IMPLEMENTATION-PROMPT.md` (React, Next.js App Router, Tailwind CSS 3.4.17, QuizHub components by `data-qh`), `ASSET-SOURCES.md`, and `AUDIENCE-AND-POSITIONING.md` where the page is public. Each folder also has `js/` (the Tailwind theme and the preview behaviour), because the v2 prototype is Tailwind-CDN based.

## Build order

**P0 first: wizard, then onboarding.** Land the tokens (09) as the shared dependency.

| # | Folder | Surface | Priority | Issue |
| --- | --- | --- | --- | --- |
| 01 | [01-spec-design-page-wizard-v2](01-spec-design-page-wizard-v2/README.md) | Create Relationship wizard, Stages 1–5 (Stage 4 account only; Stage 5 "Continue with 7 Days Free" sends the invite; the trial starts when the Counterparty accepts) | **P0** | [#1123](https://github.com/riolabs-ai/alignsynch/issues/1123) |
| 02 | [02-spec-design-page-onboarding-v2](02-spec-design-page-onboarding-v2/README.md) | Public Templates catalog `/relationship-templates`, public template page → Create Relationship, Pricing → template pick, Counterparty join | **P0** | [#1127](https://github.com/riolabs-ai/alignsynch/issues/1127), [#1125](https://github.com/riolabs-ai/alignsynch/issues/1125) |
| 03 | [03-spec-design-page-relationship-detail-v2](03-spec-design-page-relationship-detail-v2/README.md) | Relationship Detail, every state and role, trial pause, propose-a-change, invite hygiene, leave | P1 | [#1124](https://github.com/riolabs-ai/alignsynch/issues/1124), [#1121](https://github.com/riolabs-ai/alignsynch/issues/1121), [#1133](https://github.com/riolabs-ai/alignsynch/issues/1133), [#1135](https://github.com/riolabs-ai/alignsynch/issues/1135) |
| 04 | [04-spec-design-page-align-v2](04-spec-design-page-align-v2/README.md) | Align (Stage 6), Soft/Full re-score | P1 | [#1122](https://github.com/riolabs-ai/alignsynch/issues/1122) |
| 05 | [05-spec-design-page-start-my-relationships-v2](05-spec-design-page-start-my-relationships-v2/README.md) | Start, My Relationships, the v2 app shell and card kebabs | P1 | [#1129](https://github.com/riolabs-ai/alignsynch/issues/1129), [#1134](https://github.com/riolabs-ai/alignsynch/issues/1134) |
| 06 | [06-spec-design-page-templates-v2](06-spec-design-page-templates-v2/README.md) | Templates tabs (Library \| My Templates), template page, My Template detail, proposal, Aspect drawer, archive | P1 | [#1130](https://github.com/riolabs-ai/alignsynch/issues/1130), [#1133](https://github.com/riolabs-ai/alignsynch/issues/1133), [#1134](https://github.com/riolabs-ai/alignsynch/issues/1134) |
| 07 | [07-spec-design-page-chat-v2](07-spec-design-page-chat-v2/README.md) | Chat | P2 | [#1131](https://github.com/riolabs-ai/alignsynch/issues/1131) |
| 08 | [08-spec-design-page-payment-v2](08-spec-design-page-payment-v2/README.md) | Payment (standalone billing; no countdown until the Counterparty accepts) | P1 | [#1132](https://github.com/riolabs-ai/alignsynch/issues/1132), [#1121](https://github.com/riolabs-ai/alignsynch/issues/1121) |
| 09 | [09-spec-design-system-tokens-v2](09-spec-design-system-tokens-v2/README.md) | Tokens, component sheet, shared modal / toast / kebab, flow map | P0 dependency | [#1120](https://github.com/riolabs-ai/alignsynch/issues/1120) |
| 10 | [10-spec-design-page-assessment-v2](10-spec-design-page-assessment-v2/README.md) | Assessment (the answer screen) | P0 | [#1128](https://github.com/riolabs-ai/alignsynch/issues/1128) |
| 11 | [11-spec-design-page-account-settings-v2](11-spec-design-page-account-settings-v2/README.md) | Account menu and Account Settings | P1 | [#1136](https://github.com/riolabs-ai/alignsynch/issues/1136) |

Not bundled: the admin CRUD & Permissions matrix ([#1126](https://github.com/riolabs-ai/alignsynch/issues/1126)) has no prototype page; it is specified in the issue and the CRUD triage page.

## Locked rules (every bundle repeats them)

Calm palette (Initiator clay, Counterparty slate-teal, graphite actions, cyan as thin accent only) · vivid status as icon + word (✓ In Synch, ≈ Small Gap, flag Gap) · the locked, numbered 1–5 scale · no red except scale step 1 · the Counterparty never sees a price, trial, card or extension · live Aspect changes are proposed, never silent · archive over delete · Title Case labels with no ending period · `/relationship-templates` replaces `/relationship-types` with 308 redirects · card-free trial with Stage 4 account only, the trial on the Stage 5 button, and the clock starting when the Counterparty accepts.

## Open decisions for the owner

1. ~~**Trial anchor.**~~ **Resolved (16 November 2026).** The 7-day free trial starts when the Counterparty accepts the invite (both parties in). Drafts and sent-but-pending invites use no trial days. The Stage 5 primary button stays "Continue with 7 Days Free" and only sends the invite. This replaces both PR #1116's start at relationship creation and the earlier prototype start-at-send copy. **PR #1116 must move its trial grant to acceptance.** See DESIGN-NOTES §45 and bundles 01, 03 and 08.
2. **Catalog audience order.** The home direction is business-first; the v2 catalog leads with family (Brother–Sister). See bundle 02 `AUDIENCE-AND-POSITIONING.md`.
3. Placeholder Family / Annual prices and the three placeholder testimonials (bundle 02).
4. Light vs dark Relationship Detail band (bundle 03, DESIGN-NOTES §12 Q1); where a Counterparty suggestion lands (§12 Q4).

## Preview

Serve this folder (or any single bundle folder) with a static server, for example `python3 -m http.server`, and open a bundle's HTML. Every bundle opens standalone; links into sibling bundles use `../<bundle>/…` and work when the bundles sit side by side. `09-spec-design-system-tokens-v2/index.html` is the clickable flow map across all of them.

## Verification (16 November 2026)

Each folder was served on its own and loaded headless at 390 and 1280 px for every listed state: no 4xx/5xx or failed requests, no page errors, no horizontal overflow. See `VERIFY.txt`.
