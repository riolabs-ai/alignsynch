# Documentation

The hub for everything under `docs/` — every document, grouped by the question it answers. Each page
carries the same nav block above and below its body (hub › section › page, with the previous and next
page in that section), and both the rows below and those blocks are generated from
[`docs.json`](docs.json) by `scripts/docs-nav.mjs`. This page is the root of that nav, so it carries no
block of its own; every other document does.

Looking for the product story rather than the engineering record? Start at the
[root README](../README.md). The working rules for this checkout are in [AGENTS.md](../AGENTS.md), and
the release history is [CHANGELOG.md](../CHANGELOG.md).

**If you have ten minutes:** [reference/env-spec.md](reference/env-spec.md) for the environment and the
team, [operations/gate.md](operations/gate.md) for what a green run actually proves,
[specs/two-party-flow.md](specs/two-party-flow.md) for what the product does, then the
[code wiki](wiki/README.md) for how the tree is built.

**Where a page lives is the question it answers.** `getting-started/` (install, run, demo),
`guides/` (how to do one thing), `reference/` (the model, the environment, the generated tables),
`operations/` (the gate, releasing, deploying, and `operations/history/` for superseded records),
`specs/` (authored specs and design briefs), `qa/` (one directory per measurement,
`qa/<issue-or-release>/`), plus the `wiki/`, `diagrams/` and `changelog/` shelves. `review/` and
`assets/` hold artefacts rather than prose, and three files stay at the root because a script writes
or reads that exact path: `glossary.md`, `ui-registry.md` and `gate-baseline.py`.

**Adding a document.** Add a row to [`docs.json`](docs.json) — path, a short title, and the question
the page answers — write the page, then run `pnpm docs:nav`. One edit produces the row below and the
page's own nav block; `pnpm docs:check` fails by name if a page is missing from this hub, listed
twice, has no nav block, carries a relative link or image that does not resolve, or if any of it is
stale.

<!-- docs-hub:begin -->

**154 documents in 9 sections.** Every page carries the same nav block, generated
from `docs/docs.json` by `scripts/docs-nav.mjs`; `pnpm docs:check` fails by name when a page is
missing from this hub, a link does not resolve, or a nav block is stale.

## Contents

- [Start here](#start-here) — 3 documents
- [Guides](#guides) — 4 documents
- [Reference](#reference) — 10 documents
- [Operations](#operations) — 16 documents
- [Specs & design briefs](#specs-design-briefs) — 43 documents
- [Records & QA](#records-qa) — 37 documents
- [Code wiki](#code-wiki) — 15 documents
- [Diagrams](#diagrams) — 5 documents
- [Release notes](#release-notes) — 21 documents

## Start here

Read these before your first command.

- [`getting-started/demo-auth.md`](getting-started/demo-auth.md) — **Demo auth** — How do the demo roles and the PIN gate work?
- [`getting-started/demo.md`](getting-started/demo.md) — **The demo** — How is the demo branch built, reset and bundled?
- [`getting-started/workflow.md`](getting-started/workflow.md) — **Request → release** — How does an annotation become a versioned release, and how deep is this request?

## Guides

How to do one thing well: templates, bundles, brand, models.

- [`guides/bundles.md`](guides/bundles.md) — **Bundles** — How does a template or a demo dataset travel as one versioned JSON file?
- [`guides/growth-model.md`](guides/growth-model.md) — **The growth model** — Where does the $3M demonstration business come from, and how is it proven?
- [`guides/mimo-guide.md`](guides/mimo-guide.md) — **MiMo harness guide** — How is the MiMo model wired, and what are its measured quirks?
- [`guides/template-doctrine.md`](guides/template-doctrine.md) — **Template doctrine** — When I add a screen, what existing surface is it a variation of?

## Reference

The data model, the environment, the generated tables and the record of what the tree holds.

- [`assets/screens/README.md`](assets/screens/README.md) — **Screenshot registry** — Which screenshot shows which surface, on which brand and viewport?
- [`glossary.md`](glossary.md) — **Glossary** — What does this domain's vocabulary mean? Generated from the schema comments.
- [`reference/billing.md`](reference/billing.md) — **Billing** — How are the two billing drivers wired, and where is the pricing CTA?
- [`reference/data-model.md`](reference/data-model.md) — **Data model** — What is a record, an item, an answer — and where does the Gap live?
- [`reference/env-spec.md`](reference/env-spec.md) — **Environment & ops spec** — What is installed, what does the team own, and what did the P1–P4 gates demand?
- [`reference/mockup-index.md`](reference/mockup-index.md) — **Reference mockups** — What did the specification's own mockups look like?
- [`reference/provenance.md`](reference/provenance.md) — **Legal provenance** — Where did `/terms` and `/privacy` come from, and what was cut?
- [`reference/quizhub-capability-map.md`](reference/quizhub-capability-map.md) — **QuizHub capability map** — What can a reader reach under the quiz expression, and what is each surface made of?
- [`reference/relationship-types-source.md`](reference/relationship-types-source.md) — **Relationship types** — What did the owner actually supply as the catalogue, before anyone edited it?
- [`ui-registry.md`](ui-registry.md) — **UI registry** — Which surface is this, and may a template reuse it? Generated from the tree.

## Operations

The gate, releasing, deploying, iteration and the history behind them.

- [`operations/branch-triage.md`](operations/branch-triage.md) — **Branch triage** — Which of the non-main heads is safe, and on what evidence?
- [`operations/brand-release.md`](operations/brand-release.md) — **Two brands, one tree** — How does a brand version ship without moving parity?
- [`operations/deploying.md`](operations/deploying.md) — **Deploying** — How does this repository reach `alignsynch.com`?
- [`operations/gate.md`](operations/gate.md) — **The gate** — What does `scripts/verify.sh` run, in what order, and what are its current numbers?
- [`operations/history/p1-migration/MIGRATION.md`](operations/history/p1-migration/MIGRATION.md) — **P1 migration** — What did the P1 content model change, field by field?
- [`operations/history/P2-INVENTORY.md`](operations/history/P2-INVENTORY.md) — **P2 inventory** — Which hardcoded strings and media paths does templatisation have to cover?
- [`operations/history/P3-EXIT.md`](operations/history/P3-EXIT.md) — **P3 exit record** — Did bulk generation meet its gate, and with what numbers?
- [`operations/history/V1-PROTOTYPE.md`](operations/history/V1-PROTOTYPE.md) — **V1 prototype** — What is the clickable `/v1/**` prototype, and who is it for?
- [`operations/history/V1-RETIREMENT.md`](operations/history/V1-RETIREMENT.md) — **V1 retirement** — What happened to every `/v1` item?
- [`operations/iteration.md`](operations/iteration.md) — **Iteration rhythm** — Which loop do I run for this edit — `check:fast` or the full gate?
- [`operations/orchestration.md`](operations/orchestration.md) — **Orchestration rules** — How does the orchestrator behave — decisions, blocking, re-carding?
- [`operations/release-train.md`](operations/release-train.md) — **Release-train card template** — What does a release-train card carry — children, sequence, cutoff, proof?
- [`operations/releasing.md`](operations/releasing.md) — **Releasing** — Which four artefacts must agree for a release, and how is the tag cut?
- [`operations/repo-layers.md`](operations/repo-layers.md) — **Repo layers** — Why does the gate cost what my change costs, and which lane am I in?
- [`operations/resend-inbound.md`](operations/resend-inbound.md) — **Resend inbound** — How do bounces, complaints and suppression marks reach us?
- [`operations/spec-drift.md`](operations/spec-drift.md) — **Spec drift** — Where has the build moved away from the specification, and is that deliberate?

## Specs & design briefs

What the product promises, written down before it was built.

- [`specs/account-deletion-spec.md`](specs/account-deletion-spec.md) — **Account deletion** — What happens to a shared record when one person deletes their account?
- [`specs/catalogue.md`](specs/catalogue.md) — **Template catalogue** — How is the catalogue grouped, and what does each category mean?
- [`specs/flow-emails.md`](specs/flow-emails.md) — **Transactional email lifecycle** — Which emails send, when, and to whom?
- [`specs/flow-reinvite.md`](specs/flow-reinvite.md) — **Re-invite** — What happens when an invitation expires — and why not a void?
- [`specs/flow-stages.md`](specs/flow-stages.md) — **The five flow stages (binding spec)** — What are the stages, which fields does stage 1 carry, and where does the flow end?
- [`specs/maintenance-fields.md`](specs/maintenance-fields.md) — **Maintenance fields** — Which fields does the relationship-maintenance form carry?
- [`specs/pay-to-complete/ADR.md`](specs/pay-to-complete/ADR.md) — **ADR** — Which choice was made, what alternative did it beat, and what does it cost?
- [`specs/pay-to-complete/COPY-INVENTORY.md`](specs/pay-to-complete/COPY-INVENTORY.md) — **Payer copy inventory** — Which payer strings already exist, at which line, and which are still unwritten?
- [`specs/pay-to-complete/PAYER-PRESENT.md`](specs/pay-to-complete/PAYER-PRESENT.md) — **Payer-present state** — What does the spec actually say about a charge that needs the payer, and which of its strings may a mockup quote?
- [`specs/pay-to-complete/PRD.md`](specs/pay-to-complete/PRD.md) — **PRD** — Why is a relationship paid for once, at completion?
- [`specs/pay-to-complete/README.md`](specs/pay-to-complete/README.md) — **Pay-to-complete set** — What is in the v1.6.0 document set, and in what order do I read it?
- [`specs/pay-to-complete/RESEARCH.md`](specs/pay-to-complete/RESEARCH.md) — **Research** — What does the tree do today, and what does the industry do?
- [`specs/pay-to-complete/SPEC.md`](specs/pay-to-complete/SPEC.md) — **Technical spec** — What exactly is the payment obligation, in code terms?
- [`specs/prototype-save.md`](specs/prototype-save.md) — **Prototype copy saves** — Where a reviewer's in-page copy edits go when they press Save, and what the implementation reads from them?
- [`specs/prototype-wiring.md`](specs/prototype-wiring.md) — **Prototype wiring** — What of the one prototype screen moves into the build, and in what order?
- [`specs/README.md`](specs/README.md) — **Specifications index** — What are these research specs, and what do they have in common?
- [`specs/spec-as2-style-home-redesign/ASSET-SOURCES.md`](specs/spec-as2-style-home-redesign/ASSET-SOURCES.md) — **AS2 redesign — asset sources and credits** — Where did each photograph come from, who took it, and under which licence?
- [`specs/spec-as2-style-home-redesign/IMPLEMENTATION-PROMPT.md`](specs/spec-as2-style-home-redesign/IMPLEMENTATION-PROMPT.md) — **AS2 home redesign — implementation brief** — Which existing components does the redesign reuse, and what must not change?
- [`specs/spec-as2-style-home-redesign/README.md`](specs/spec-as2-style-home-redesign/README.md) — **AS2 home redesign (handoff)** — What is in the approved home-redesign package, and how do I preview it?
- [`specs/spec-as2-style-templates-redesign/CATALOG-UI-SYSTEM.md`](specs/spec-as2-style-templates-redesign/CATALOG-UI-SYSTEM.md) — **AS2 catalogue UI system** — What are the reusable realm tints, icon map, card anatomy and detail order?
- [`specs/spec-as2-style-templates-redesign/IMPLEMENTATION-PROMPT.md`](specs/spec-as2-style-templates-redesign/IMPLEMENTATION-PROMPT.md) — **AS2 templates redesign — implementation brief** — Which existing components does the catalogue rewrite reuse, and what must not change?
- [`specs/spec-as2-style-templates-redesign/README.md`](specs/spec-as2-style-templates-redesign/README.md) — **AS2 templates redesign (handoff)** — What is in the approved Templates-catalogue package, and how do I preview it?
- [`specs/spec-as2-style-templates-redesign/SOURCE-NOTES.md`](specs/spec-as2-style-templates-redesign/SOURCE-NOTES.md) — **AS2 templates redesign — source notes** — Which live routes, fixtures and assets did the approved catalogue read from?
- [`specs/spec-design-page-rel-templates-v2/admin-brand/README.md`](specs/spec-design-page-rel-templates-v2/admin-brand/README.md) — **/admin/brand (V2 package)** — Which eleven sections does the brand profile page clone, how is it gated, where does its copy live, and which mockup colours the token layer cannot express?
- [`specs/spec-design-page-rel-templates-v2/banner/README.md`](specs/spec-design-page-rel-templates-v2/banner/README.md) — **Admin notice banner (V2 package)** — Where does the admin notice bar sit, what offsets does it move, how tall is it at each viewport, and who may see it?
- [`specs/spec-design-page-rel-templates-v2/brand-profile/README.md`](specs/spec-design-page-rel-templates-v2/brand-profile/README.md) — **V2 brand and audience profile (handoff)** — How do I open the private brand profile, and which sections does it carry?
- [`specs/spec-design-page-rel-templates-v2/home/ASSET-SOURCES.md`](specs/spec-design-page-rel-templates-v2/home/ASSET-SOURCES.md) — **V2 home page — asset sources and credits** — Where did each V2 home-page photograph come from, and under which licence?
- [`specs/spec-design-page-rel-templates-v2/home/IMPLEMENTATION-PROMPT.md`](specs/spec-design-page-rel-templates-v2/home/IMPLEMENTATION-PROMPT.md) — **V2 home page — implementation brief** — Which components, tokens and fixtures does the V2 home page reuse, and what must not change?
- [`specs/spec-design-page-rel-templates-v2/home/README.md`](specs/spec-design-page-rel-templates-v2/home/README.md) — **V2 home page (handoff)** — How do I preview the V2 home page, and which files make it up?
- [`specs/spec-design-page-rel-templates-v2/README.md`](specs/spec-design-page-rel-templates-v2/README.md) — **V2 home and brand package (handoff)** — What is in the V2 package, which files ship with it, and what is it authoritative for?
- [`specs/spec-design-page-rel-templates/README.md`](specs/spec-design-page-rel-templates/README.md) — **Brand & audience profile page (handoff)** — How do I preview the brand and audience profile page, and in what order does it place the audiences?
- [`specs/spec-help-center/GLOSSARY-CONTENT-MAP.md`](specs/spec-help-center/GLOSSARY-CONTENT-MAP.md) — **Glossary source map** — Which 2024 glossary terms feed the public Help page, and how is each editorial decision recorded?
- [`specs/spec-help-center/IMPLEMENTATION-BRIEF.md`](specs/spec-help-center/IMPLEMENTATION-BRIEF.md) — **Help Center — implementation brief** — Which route does the Help Center redesign target, which files drive it, and what must not change?
- [`specs/spec-help-center/README.md`](specs/spec-help-center/README.md) — **Help Center design spec (handoff)** — How do I preview the Help Center, and which three files make up the page?
- [`specs/stages.md`](specs/stages.md) — **Stages** — What are Invited, Connected, Sharing and Aligned, and who decides each?
- [`specs/two-party-flow.md`](specs/two-party-flow.md) — **The two-party flow** — How do two people get from an invitation to a sealed Gap?
- [`specs/ui-divergence.md`](specs/ui-divergence.md) — **Divergence table** — Where does each surface deliberately differ from its ancestor?
- [`specs/ui-mapping.md`](specs/ui-mapping.md) — **Quiz-surface map** — Which quiz surface is this AlignSynch file a variation of?
- [`specs/ui-ux-audit.md`](specs/ui-ux-audit.md) — **UI/UX audit** — What does the build follow, vary, or quietly diverge from in the purchased template?
- [`specs/ux-input.md`](specs/ux-input.md) — **Answer input** — How does a person answer — scale, labels, semantics?
- [`specs/ux-reference-patterns.md`](specs/ux-reference-patterns.md) — **Reference UX patterns** — What does the product's own UX look like as a measured pattern set — tokens, shell, nine screens?
- [`specs/ux-report.md`](specs/ux-report.md) — **The Gap report** — How are the eight kinds per Aspect rendered?
- [`specs/ux-stages.md`](specs/ux-stages.md) — **Stage display** — How is each stage shown, and who acts next?

## Records & QA

What was measured, on which tree, and what it looked like.

- [`qa/542-phase2/README.md`](qa/542-phase2/README.md) — **#542 phase 2** — Is the rail role-constrained data, with focused-flow chrome?
- [`qa/957-assessment-one-click/README.md`](qa/957-assessment-one-click/README.md) — **One-click create on /assessment, #957** — Did the public catalogue publish a relationship in one submit, and does its door now land on stage 1?
- [`qa/958-no-initiator-member/README.md`](qa/958-no-initiator-member/README.md) — **A relationship with no initiator member, #958** — Does a draft whose initiator account column is NULL still reach the pay modal, or is it read-only?
- [`qa/971-tiles/README.md`](qa/971-tiles/README.md) — **The welcome tiles on /register too, #971** — Do both auth pages carry the two tiles while /login renders byte-identically and the in-flow stage stays compact?
- [`qa/975-detail-identity/README.md`](qa/975-detail-identity/README.md) — **The relationship detail's identity, #975** — Does the detail page say whose relationship it is and which one — its own title and both names, one role per screen?
- [`qa/976-sent-none/README.md`](qa/976-sent-none/README.md) — **The Sent screen with no invitation row, #976** — Does the Sent screen render for a relationship whose invitation was never written, or does the copy lookup throw?
- [`qa/979-flow-dialog/README.md`](qa/979-flow-dialog/README.md) — **The create flow as a dialog over the relationships page, #979** — Does pressing Create relationship on /dashboard/relationships draw a real stage in a dialog over that page, with the address still the stage's own?
- [`qa/979-flow-parity/README.md`](qa/979-flow-parity/README.md) — **The flow's dialog behaves like a route, #979** — Does Back walk a stage, does reloading a stage's address render that stage as a page, do the four keyboard behaviours hold, and is the panel full-bleed at 390?
- [`qa/as2-home/README.md`](qa/as2-home/README.md) — **AS2 home visual QA** — Does the built front page match the approved page, and where do its anchor targets land?
- [`qa/brand-lockup/README.md`](qa/brand-lockup/README.md) — **Brand lockup** — Is the lockup back in the chrome, at a seal's size?
- [`qa/comments-mockup/README.md`](qa/comments-mockup/README.md) — **Comments mockup, both placements** — Does the comment thread work under and beside an aspect opinion, a session and a relationship, in every state?
- [`qa/contact-land/README.md`](qa/contact-land/README.md) — **Contact landing** — What do the contact pages look like?
- [`qa/docs-pretty/README.md`](qa/docs-pretty/README.md) — **The docs before and after formatting, #937** — Does an /admin/docs article render the tables and alerts it is written in, at 1440 and at 390?
- [`qa/flow-stages/README.md`](qa/flow-stages/README.md) — **Six flow stages** — Does the flow say Details · Settings · Aspects · Invite · Completed · Align, and is Align conditional?
- [`qa/flow-validation/2026-11-07.md`](qa/flow-validation/2026-11-07.md) — **Flow validation, 2026-11-07** — Does the assessment flow work end to end with two real identities?
- [`qa/help-two-column/README.md`](qa/help-two-column/README.md) — **Help two-column** — Did `/help` get its two-column layout?
- [`qa/home-comments/README.md`](qa/home-comments/README.md) — **Home review comments — the logo** — Is the public header's brand lockup a link home, and what did the page look like before it was?
- [`qa/home-polish/README.md`](qa/home-polish/README.md) — **Home hero polish** — Were the six hero defects fixed, before and after?
- [`qa/lockup-2rem/README.md`](qa/lockup-2rem/README.md) — **Lockup 2rem** — Is the lockup 2rem in every expanded-header viewport?
- [`qa/noun-crud/README.md`](qa/noun-crud/README.md) — **Templates and relationships after creation** — Can a template be revised and retired, and does a bound relationship keep the version it was answered under?
- [`qa/payment/README.md`](qa/payment/README.md) — **Payment capture & completion** — Can a member capture a method, pay the fee, complete, and read the Gap?
- [`qa/qa-dogfood-p4.md`](qa/qa-dogfood-p4.md) — **P4 dogfood pass** — Did every route answer, on a production build?
- [`qa/qa-links.md`](qa/qa-links.md) — **QA links** — Which local routes do I click to QA this change range, and what will each one cost me?
- [`qa/rail-handle/README.md`](qa/rail-handle/README.md) — **Rail collapse handle** — Does the width control toggle from the rail's border, and is the icon rail coherent?
- [`qa/recharts-3/README.md`](qa/recharts-3/README.md) — **recharts 3** — Do the pie labels still render after the recharts 3 bump?
- [`qa/rel-detail-edit/README.md`](qa/rel-detail-edit/README.md) — **Relationship detail — the edit form is asked for** — Is the edit form a dialog/sheet the person opens, instead of a permanent column beside the detail?
- [`qa/stage5/README.md`](qa/stage5/README.md) — **Stage 5, both states** — Does stage 5 offer the payment walk and send/draft instead of a band with no action?
- [`qa/surface-sweep-913/README.md`](qa/surface-sweep-913/README.md) — **Surface sweep, #913** — Does every screen, menu and button obey the modal rule — new relationship, draft, no initiator member?
- [`qa/swiper-12/README.md`](qa/swiper-12/README.md) — **swiper 12** — Do the carousels survive swiper 11.2.7 → 12.2.0?
- [`qa/template-catalogue/README.md`](qa/template-catalogue/README.md) — **Template catalogue** — What do the catalogue pages look like from the AlignSynch build?
- [`qa/templates-redesign/README.md`](qa/templates-redesign/README.md) — **AS2 templates catalogue visual QA** — Does the rebuilt /relationship-types match the approved catalogue, and what did each width measure?
- [`qa/v1x-ui-cohort/README.md`](qa/v1x-ui-cohort/README.md) — **v1.x UI cohort** — Were all ten owner items measured in a real browser?
- [`qa-atlas/README.md`](qa-atlas/README.md) — **QA atlas** — How is every registered surface captured, asserted and checked, and what is committed?
- [`qa-atlas/v1.17.0/index.md`](qa-atlas/v1.17.0/index.md) — **QA atlas — v1.17.0** — What did every registered surface render in v1.17.0, and did it read the record it claims?
- [`qa-atlas/v1.17.1/index.md`](qa-atlas/v1.17.1/index.md) — **QA atlas — the 1.17.1 tree (never released)** — What did every registered surface render in the 1.17.1 tree, which was never released, and what changed since v1.17.0?
- [`qa-atlas/v1.18.0/index.md`](qa-atlas/v1.18.0/index.md) — **QA atlas — v1.18.0** — What did every registered surface render in v1.18.0, and what changed since the 1.17.1 capture?
- [`qa/welcome-copy/README.md`](qa/welcome-copy/README.md) — **The welcome panel's copy — the tagline and the Aspects/Opinions tiles** — Does /login carry the owner's tagline and both noun tiles verbatim, on /register too, with the in-modal stage still drawing none of it?

## Code wiki

A guided tour of the code, module by module.

- [`wiki/architecture.md`](wiki/architecture.md) — **Request lifecycle** — What happens to a request from the App Router down to Postgres?
- [`wiki/diagrams/class-diagram.md`](wiki/diagrams/class-diagram.md) — **Class diagram** — How do a quiz and an assessment share one record root?
- [`wiki/diagrams/sequences.md`](wiki/diagrams/sequences.md) — **Sequence walks** — What does a traced request look like, step by step?
- [`wiki/getting-started.md`](wiki/getting-started.md) — **Getting started** — What do I install and run to get a green tree?
- [`wiki/modules/app-api.md`](wiki/modules/app-api.md) — **app/api** — Which HTTP endpoints exist and what does each serve?
- [`wiki/modules/app-mainlayout.md`](wiki/modules/app-mainlayout.md) — **app/(mainlayout)** — What does the product route group own?
- [`wiki/modules/app-marketing.md`](wiki/modules/app-marketing.md) — **app/(marketing)** — Which pages are public, and why do they never get the shell?
- [`wiki/modules/components.md`](wiki/modules/components.md) — **components** — How is the UI organised, and what belongs in components/ui?
- [`wiki/modules/content.md`](wiki/modules/content.md) — **content** — Where is the content model defined, and what derives from it?
- [`wiki/modules/data.md`](wiki/modules/data.md) — **data** — Where do the fixtures live that every product route projects?
- [`wiki/modules/lib-admin.md`](wiki/modules/lib-admin.md) — **lib/admin** — How does an operator action pass the write gate?
- [`wiki/modules/lib-db.md`](wiki/modules/lib-db.md) — **lib/db** — Where is SQL written, and how do rows map back to the model?
- [`wiki/modules/lib-flow.md`](wiki/modules/lib-flow.md) — **lib/flow** — What drives the two-party session end to end?
- [`wiki/modules/lib-member.md`](wiki/modules/lib-member.md) — **lib/member** — What does the initiator's side own?
- [`wiki/README.md`](wiki/README.md) — **Code wiki index** — Where do I start reading the code?

## Diagrams

The five Mermaid charts, one home each.

- [`diagrams/brand-boundary.md`](diagrams/brand-boundary.md) — **Brand boundary** — Which routes does the quiz product own, and which does the console?
- [`diagrams/data.md`](diagrams/data.md) — **Schemas → fixtures → tables** — How does one model become fixtures and then Postgres tables?
- [`diagrams/gate.md`](diagrams/gate.md) — **Gate** — What path does a change take through the gate?
- [`diagrams/lifecycle.md`](diagrams/lifecycle.md) — **Lifecycle** — Which states can one relationship reach, and on what event?
- [`diagrams/payment.md`](diagrams/payment.md) — **Payment** — When is money owed, retried, or written off?

## Release notes

One page per release, a view of `CHANGELOG.md`.

- [`changelog/README.md`](changelog/README.md) — **Release blog** — What shipped in which release, and where does this page come from?
- [`changelog/v1-0-0.md`](changelog/v1-0-0.md) — **v1.0.0** — The release where the webapp stopped being a mock.
- [`changelog/v1-1-0-rc1.md`](changelog/v1-1-0-rc1.md) — **v1.1.0-rc1** — The release candidate that made the template a product.
- [`changelog/v1-10-0.md`](changelog/v1-10-0.md) — **v1.10.0** — The release where paying stopped leaving the page.
- [`changelog/v1-11-0.md`](changelog/v1-11-0.md) — **v1.11.0** — The release where the build drew what the review approved.
- [`changelog/v1-12-0.md`](changelog/v1-12-0.md) — **v1.12.0** — Which release moved the payment decision into the create flow, and what does it defer?
- [`changelog/v1-13-0.md`](changelog/v1-13-0.md) — **v1.13.0** — Which release turned the templates page into a directory, and gave every template a page?
- [`changelog/v1-14-0.md`](changelog/v1-14-0.md) — **v1.14.0** — Which release moved the catalogue onto the relationship noun, and put the plan's price on every card?
- [`changelog/v1-15-0.md`](changelog/v1-15-0.md) — **v1.15.0** — Which release made the create flow five stages, with the account at stage 4 and the invitation at stage 5?
- [`changelog/v1-16-0.md`](changelog/v1-16-0.md) — **v1.16.0** — Which release made the relationship detail a destination, listed the member's assessments, and gave the shell one column?
- [`changelog/v1-17-0.md`](changelog/v1-17-0.md) — **v1.17.0** — Which release made stage 5 a three-step payment walk, and what does it defer?
- [`changelog/v1-18-0.md`](changelog/v1-18-0.md) — **v1.18.0** — Which release paid v1.17.0's written promise, and why did the prepared patch become a minor?
- [`changelog/v1-2-0.md`](changelog/v1-2-0.md) — **v1.2.0** — The release where five surfaces read the database.
- [`changelog/v1-3-0.md`](changelog/v1-3-0.md) — **v1.3.0** — The release where the flow closed.
- [`changelog/v1-4-0.md`](changelog/v1-4-0.md) — **v1.4.0** — The release where the console arrived and templates became products.
- [`changelog/v1-5-0.md`](changelog/v1-5-0.md) — **v1.5.0** — The release where a person could delete their account.
- [`changelog/v1-5-1.md`](changelog/v1-5-1.md) — **v1.5.1** — The patch where the gate stopped believing a stale record.
- [`changelog/v1-6-0.md`](changelog/v1-6-0.md) — **v1.6.0** — The release where the fee moved to completion.
- [`changelog/v1-7-0.md`](changelog/v1-7-0.md) — **v1.7.0** — The release where the review shelf went live.
- [`changelog/v1-8-0.md`](changelog/v1-8-0.md) — **v1.8.0** — The release where the flow conformed to its six-stage spec.
- [`changelog/v1-9-0.md`](changelog/v1-9-0.md) — **v1.9.0** — The release where the payer could finally pay.

<!-- docs-hub:end -->

## Where the generated pages come from

Five families of page in this hub are not edited by hand, and each has one generator behind it:

- [`glossary.md`](glossary.md) — `pnpm glossary`, from the schema comments in `content/`;
- [`ui-registry.md`](ui-registry.md) — `pnpm ui:registry`, from `components/`, `app/` and
  `data/ui-registry.ts`;
- [`changelog/`](changelog/README.md) — `pnpm changelog`, a view of `CHANGELOG.md`;
- the nav blocks and this hub's contents — `pnpm docs:nav`, from [`docs.json`](docs.json);
- [`assets/screens/README.md`](assets/screens/README.md) — the screenshot registry the capture run
  writes, one row per promoted frame.

`bash scripts/verify.sh` compares every one of them against its source, so a page that has drifted is
a named gate failure rather than something a reader has to notice.
