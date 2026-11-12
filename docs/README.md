# Documentation

The hub for everything under `docs/` — every document, grouped by the question it answers. Each page
carries the same nav block above and below its body (hub › section › page, with the previous and next
page in that section), and both the rows below and those blocks are generated from
[`docs.json`](docs.json) by `scripts/docs-nav.mjs`. This page is the root of that nav, so it carries no
block of its own; every other document does.

Looking for the product story rather than the engineering record? Start at the
[root README](../README.md). The working rules for this checkout are in [AGENTS.md](../AGENTS.md), and
the release history is [CHANGELOG.md](../CHANGELOG.md).

**If you have ten minutes:** [ENV-SPEC.md](ENV-SPEC.md) for the environment and the team,
[GATE.md](GATE.md) for what a green run actually proves, [TWO-PARTY-FLOW.md](TWO-PARTY-FLOW.md) for
what the product does, then the [code wiki](wiki/README.md) for how the tree is built.

**Adding a document.** Add a row to [`docs.json`](docs.json) — path, a short title, and the question
the page answers — write the page, then run `pnpm docs:nav`. One edit produces the row below and the
page's own nav block; `pnpm docs:check` fails by name if a page is missing from this hub, listed
twice, has no nav block, carries a relative link or image that does not resolve, or if any of it is
stale.

<!-- docs-hub:begin -->

**114 documents in 9 sections.** Every page carries the same nav block, generated
from `docs/docs.json` by `scripts/docs-nav.mjs`; `pnpm docs:check` fails by name when a page is
missing from this hub, a link does not resolve, or a nav block is stale.

## Contents

- [Start here](#start-here) — 4 documents
- [Architecture](#architecture) — 11 documents
- [Code wiki](#code-wiki) — 15 documents
- [Product](#product) — 23 documents
- [Operations](#operations) — 9 documents
- [Reference](#reference) — 10 documents
- [Diagrams](#diagrams) — 5 documents
- [Release notes](#release-notes) — 18 documents
- [Records & QA](#records-qa) — 19 documents

## Start here

Read these before your first command.

- [`ENV-SPEC.md`](ENV-SPEC.md) — **Environment & ops spec** — What is installed, what does the team own, and what did the P1–P4 gates demand?
- [`ITERATION.md`](ITERATION.md) — **Iteration rhythm** — Which loop do I run for this edit — `check:fast` or the full gate?
- [`REPO-LAYERS.md`](REPO-LAYERS.md) — **Repo layers** — Why does the gate cost what my change costs, and which lane am I in?
- [`GATE.md`](GATE.md) — **The gate** — What does `scripts/verify.sh` run, in what order, and what are its current numbers?

## Architecture

How the tree is put together, and why it is shaped that way.

- [`DATA-MODEL.md`](DATA-MODEL.md) — **Data model** — What is a record, an item, an answer — and where does the Gap live?
- [`TWO-PARTY-FLOW.md`](TWO-PARTY-FLOW.md) — **The two-party flow** — How do two people get from an invitation to a sealed Gap?
- [`STAGES.md`](STAGES.md) — **Stages** — What are Invited, Connected, Sharing and Aligned, and who decides each?
- [`TEMPLATE-DOCTRINE.md`](TEMPLATE-DOCTRINE.md) — **Template doctrine** — When I add a screen, what existing surface is it a variation of?
- [`BRAND-RELEASE.md`](BRAND-RELEASE.md) — **Two brands, one tree** — How does a brand version ship without moving parity?
- [`QUIZHUB-CAPABILITY-MAP.md`](QUIZHUB-CAPABILITY-MAP.md) — **QuizHub capability map** — What can a reader reach under the quiz expression, and what is each surface made of?
- [`UI-MAPPING.md`](UI-MAPPING.md) — **Quiz-surface map** — Which quiz surface is this AlignSynch file a variation of?
- [`UI-DIVERGENCE.md`](UI-DIVERGENCE.md) — **Divergence table** — Where does each surface deliberately differ from its ancestor?
- [`UI-UX-AUDIT.md`](UI-UX-AUDIT.md) — **UI/UX audit** — What does the build follow, vary, or quietly diverge from in the purchased template?
- [`SPEC-DRIFT.md`](SPEC-DRIFT.md) — **Spec drift** — Where has the build moved away from the specification, and is that deliberate?
- [`BUNDLES.md`](BUNDLES.md) — **Bundles** — How does a template or a demo dataset travel as one versioned JSON file?

## Code wiki

A guided tour of the code, module by module.

- [`wiki/README.md`](wiki/README.md) — **Code wiki index** — Where do I start reading the code?
- [`wiki/getting-started.md`](wiki/getting-started.md) — **Getting started** — What do I install and run to get a green tree?
- [`wiki/architecture.md`](wiki/architecture.md) — **Request lifecycle** — What happens to a request from the App Router down to Postgres?
- [`wiki/modules/app-mainlayout.md`](wiki/modules/app-mainlayout.md) — **app/(mainlayout)** — What does the product route group own?
- [`wiki/modules/app-marketing.md`](wiki/modules/app-marketing.md) — **app/(marketing)** — Which pages are public, and why do they never get the shell?
- [`wiki/modules/app-api.md`](wiki/modules/app-api.md) — **app/api** — Which HTTP endpoints exist and what does each serve?
- [`wiki/modules/components.md`](wiki/modules/components.md) — **components** — How is the UI organised, and what belongs in components/ui?
- [`wiki/modules/content.md`](wiki/modules/content.md) — **content** — Where is the content model defined, and what derives from it?
- [`wiki/modules/data.md`](wiki/modules/data.md) — **data** — Where do the fixtures live that every product route projects?
- [`wiki/modules/lib-db.md`](wiki/modules/lib-db.md) — **lib/db** — Where is SQL written, and how do rows map back to the model?
- [`wiki/modules/lib-flow.md`](wiki/modules/lib-flow.md) — **lib/flow** — What drives the two-party session end to end?
- [`wiki/modules/lib-member.md`](wiki/modules/lib-member.md) — **lib/member** — What does the initiator's side own?
- [`wiki/modules/lib-admin.md`](wiki/modules/lib-admin.md) — **lib/admin** — How does an operator action pass the write gate?
- [`wiki/diagrams/class-diagram.md`](wiki/diagrams/class-diagram.md) — **Class diagram** — How do a quiz and an assessment share one record root?
- [`wiki/diagrams/sequences.md`](wiki/diagrams/sequences.md) — **Sequence walks** — What does a traced request look like, step by step?

## Product

What the product promises, and the specifications behind it.

- [`pay-to-complete/README.md`](pay-to-complete/README.md) — **Pay-to-complete set** — What is in the v1.6.0 document set, and in what order do I read it?
- [`pay-to-complete/PRD.md`](pay-to-complete/PRD.md) — **PRD** — Why is a relationship paid for once, at completion?
- [`pay-to-complete/SPEC.md`](pay-to-complete/SPEC.md) — **Technical spec** — What exactly is the payment obligation, in code terms?
- [`pay-to-complete/ADR.md`](pay-to-complete/ADR.md) — **ADR** — Which choice was made, what alternative did it beat, and what does it cost?
- [`pay-to-complete/RESEARCH.md`](pay-to-complete/RESEARCH.md) — **Research** — What does the tree do today, and what does the industry do?
- [`pay-to-complete/COPY-INVENTORY.md`](pay-to-complete/COPY-INVENTORY.md) — **Payer copy inventory** — Which payer strings already exist, at which line, and which are still unwritten?
- [`pay-to-complete/PAYER-PRESENT.md`](pay-to-complete/PAYER-PRESENT.md) — **Payer-present state** — What does the spec actually say about a charge that needs the payer, and which of its strings may a mockup quote?
- [`billing.md`](billing.md) — **Billing** — How are the two billing drivers wired, and where is the pricing CTA?
- [`ACCOUNT-DELETION-SPEC.md`](ACCOUNT-DELETION-SPEC.md) — **Account deletion** — What happens to a shared record when one person deletes their account?
- [`specs/README.md`](specs/README.md) — **Specifications index** — What are these research specs, and what do they have in common?
- [`specs/catalogue.md`](specs/catalogue.md) — **Template catalogue** — How is the catalogue grouped, and what does each category mean?
- [`specs/flow-emails.md`](specs/flow-emails.md) — **Transactional email lifecycle** — Which emails send, when, and to whom?
- [`specs/flow-reinvite.md`](specs/flow-reinvite.md) — **Re-invite** — What happens when an invitation expires — and why not a void?
- [`specs/flow-stages.md`](specs/flow-stages.md) — **The five flow stages (binding spec)** — What are the stages, which fields does stage 1 carry, and where does the flow end?
- [`specs/maintenance-fields.md`](specs/maintenance-fields.md) — **Maintenance fields** — Which fields does the relationship-maintenance form carry?
- [`specs/ux-input.md`](specs/ux-input.md) — **Answer input** — How does a person answer — scale, labels, semantics?
- [`specs/ux-report.md`](specs/ux-report.md) — **The Gap report** — How are the eight kinds per Aspect rendered?
- [`specs/ux-stages.md`](specs/ux-stages.md) — **Stage display** — How is each stage shown, and who acts next?
- [`specs/ux-reference-patterns.md`](specs/ux-reference-patterns.md) — **Reference UX patterns** — What does the product's own UX look like as a measured pattern set — tokens, shell, nine screens?
- [`specs/spec-as2-style-home-redesign/README.md`](specs/spec-as2-style-home-redesign/README.md) — **AS2 home redesign (handoff)** — What is in the approved home-redesign package, and how do I preview it?
- [`specs/spec-as2-style-home-redesign/IMPLEMENTATION-PROMPT.md`](specs/spec-as2-style-home-redesign/IMPLEMENTATION-PROMPT.md) — **AS2 home redesign — implementation brief** — Which existing components does the redesign reuse, and what must not change?
- [`specs/spec-as2-style-home-redesign/ASSET-SOURCES.md`](specs/spec-as2-style-home-redesign/ASSET-SOURCES.md) — **AS2 redesign — asset sources and credits** — Where did each photograph come from, who took it, and under which licence?
- [`qa-as2-home/README.md`](qa-as2-home/README.md) — **AS2 home visual QA** — Does the built front page match the approved page, and where do its anchor targets land?

## Operations

Deploying, releasing, demoing and running the fleet.

- [`DEPLOYING.md`](DEPLOYING.md) — **Deploying** — How does this repository reach `alignsynch.com`?
- [`RELEASING.md`](RELEASING.md) — **Releasing** — Which four artefacts must agree for a release, and how is the tag cut?
- [`ORCHESTRATION.md`](ORCHESTRATION.md) — **Orchestration rules** — How does the orchestrator behave — decisions, blocking, re-carding?
- [`QA-LINKS.md`](QA-LINKS.md) — **QA links** — Which local routes do I click to QA this change range, and what will each one cost me?
- [`BRANCH-TRIAGE.md`](BRANCH-TRIAGE.md) — **Branch triage** — Which of the non-main heads is safe, and on what evidence?
- [`DEMO.md`](DEMO.md) — **The demo** — How is the demo branch built, reset and bundled?
- [`DEMO-AUTH.md`](DEMO-AUTH.md) — **Demo auth** — How do the demo roles and the PIN gate work?
- [`RESEND-INBOUND.md`](RESEND-INBOUND.md) — **Resend inbound** — How do bounces, complaints and suppression marks reach us?
- [`P3-EXIT.md`](P3-EXIT.md) — **P3 exit record** — Did bulk generation meet its gate, and with what numbers?

## Reference

The generated tables, the owner's own material, and the records nothing else owns.

- [`glossary.md`](glossary.md) — **Glossary** — What does this domain's vocabulary mean? Generated from the schema comments.
- [`ui-registry.md`](ui-registry.md) — **UI registry** — Which surface is this, and may a template reuse it? Generated from the tree.
- [`RELATIONSHIP-TYPES-SOURCE.md`](RELATIONSHIP-TYPES-SOURCE.md) — **Relationship types** — What did the owner actually supply as the catalogue, before anyone edited it?
- [`REFERENCE-MOCKUPS.md`](REFERENCE-MOCKUPS.md) — **Reference mockups** — What did the specification's own mockups look like?
- [`MIMO-GUIDE.md`](MIMO-GUIDE.md) — **MiMo harness guide** — How is the MiMo model wired, and what are its measured quirks?
- [`legal/PROVENANCE.md`](legal/PROVENANCE.md) — **Legal provenance** — Where did `/terms` and `/privacy` come from, and what was cut?
- [`PROTOTYPE-WIRING.md`](PROTOTYPE-WIRING.md) — **Prototype wiring** — What of the one prototype screen moves into the build, and in what order?
- [`P2-INVENTORY.md`](P2-INVENTORY.md) — **P2 inventory** — Which hardcoded strings and media paths does templatisation have to cover?
- [`V1-PROTOTYPE.md`](V1-PROTOTYPE.md) — **V1 prototype** — What is the clickable `/v1/**` prototype, and who is it for?
- [`PROTOTYPE-SAVE.md`](PROTOTYPE-SAVE.md) — **Prototype copy saves** — Where a reviewer's in-page copy edits go when they press Save, and what the implementation reads from them?

## Diagrams

The five Mermaid charts, one home each.

- [`diagrams/lifecycle.md`](diagrams/lifecycle.md) — **Lifecycle** — Which states can one relationship reach, and on what event?
- [`diagrams/payment.md`](diagrams/payment.md) — **Payment** — When is money owed, retried, or written off?
- [`diagrams/brand-boundary.md`](diagrams/brand-boundary.md) — **Brand boundary** — Which routes does the quiz product own, and which does the console?
- [`diagrams/data.md`](diagrams/data.md) — **Schemas → fixtures → tables** — How does one model become fixtures and then Postgres tables?
- [`diagrams/gate.md`](diagrams/gate.md) — **Gate** — What path does a change take through the gate?

## Release notes

One page per release, a view of `CHANGELOG.md`.

- [`changelog/README.md`](changelog/README.md) — **Release blog** — What shipped in which release, and where does this page come from?
- [`changelog/v1-0-0.md`](changelog/v1-0-0.md) — **v1.0.0** — The release where the webapp stopped being a mock.
- [`changelog/v1-1-0-rc1.md`](changelog/v1-1-0-rc1.md) — **v1.1.0-rc1** — The release candidate that made the template a product.
- [`changelog/v1-2-0.md`](changelog/v1-2-0.md) — **v1.2.0** — The release where five surfaces read the database.
- [`changelog/v1-3-0.md`](changelog/v1-3-0.md) — **v1.3.0** — The release where the flow closed.
- [`changelog/v1-4-0.md`](changelog/v1-4-0.md) — **v1.4.0** — The release where the console arrived and templates became products.
- [`changelog/v1-5-0.md`](changelog/v1-5-0.md) — **v1.5.0** — The release where a person could delete their account.
- [`changelog/v1-5-1.md`](changelog/v1-5-1.md) — **v1.5.1** — The patch where the gate stopped believing a stale record.
- [`changelog/v1-6-0.md`](changelog/v1-6-0.md) — **v1.6.0** — The release where the fee moved to completion.
- [`changelog/v1-7-0.md`](changelog/v1-7-0.md) — **v1.7.0** — The release where the review shelf went live.
- [`changelog/v1-8-0.md`](changelog/v1-8-0.md) — **v1.8.0** — The release where the flow conformed to its six-stage spec.
- [`changelog/v1-9-0.md`](changelog/v1-9-0.md) — **v1.9.0** — The release where the payer could finally pay.
- [`changelog/v1-10-0.md`](changelog/v1-10-0.md) — **v1.10.0** — The release where paying stopped leaving the page.
- [`changelog/v1-11-0.md`](changelog/v1-11-0.md) — **v1.11.0** — The release where the build drew what the review approved.
- [`changelog/v1-12-0.md`](changelog/v1-12-0.md) — **v1.12.0** — Which release moved the payment decision into the create flow, and what does it defer?
- [`changelog/v1-13-0.md`](changelog/v1-13-0.md) — **v1.13.0** — Which release turned the templates page into a directory, and gave every template a page?
- [`changelog/v1-14-0.md`](changelog/v1-14-0.md) — **v1.14.0** — Which release moved the catalogue onto the relationship noun, and put the plan's price on every card?
- [`changelog/v1-15-0.md`](changelog/v1-15-0.md) — **v1.15.0** — Which release made the create flow five stages, with the account at stage 4 and the invitation at stage 5?

## Records & QA

What was measured, on which tree, and what the migration changed.

- [`assets/screens/README.md`](assets/screens/README.md) — **Screenshot registry** — Which screenshot shows which surface, on which brand and viewport?
- [`p1-migration/MIGRATION.md`](p1-migration/MIGRATION.md) — **P1 migration** — What did the P1 content model change, field by field?
- [`V1-RETIREMENT.md`](V1-RETIREMENT.md) — **V1 retirement** — What happened to every `/v1` item?
- [`QA-DOGFOOD-P4.md`](QA-DOGFOOD-P4.md) — **P4 dogfood pass** — Did every route answer, on a production build?
- [`qa-flow-stages/README.md`](qa-flow-stages/README.md) — **Six flow stages** — Does the flow say Details · Settings · Aspects · Invite · Completed · Align, and is Align conditional?
- [`qa-flow-validation/2026-11-07.md`](qa-flow-validation/2026-11-07.md) — **Flow validation, 2026-11-07** — Does the assessment flow work end to end with two real identities?
- [`qa-payment/README.md`](qa-payment/README.md) — **Payment capture & completion** — Can a member capture a method, pay the fee, complete, and read the Gap?
- [`qa-542-phase2/README.md`](qa-542-phase2/README.md) — **#542 phase 2** — Is the rail role-constrained data, with focused-flow chrome?
- [`qa-rail-handle/README.md`](qa-rail-handle/README.md) — **Rail collapse handle** — Does the width control toggle from the rail's border, and is the icon rail coherent?
- [`qa-brand-lockup/README.md`](qa-brand-lockup/README.md) — **Brand lockup** — Is the lockup back in the chrome, at a seal's size?
- [`qa-contact-land/README.md`](qa-contact-land/README.md) — **Contact landing** — What do the contact pages look like?
- [`qa-help-two-column/README.md`](qa-help-two-column/README.md) — **Help two-column** — Did `/help` get its two-column layout?
- [`qa-home-polish/README.md`](qa-home-polish/README.md) — **Home hero polish** — Were the six hero defects fixed, before and after?
- [`qa-lockup-2rem/README.md`](qa-lockup-2rem/README.md) — **Lockup 2rem** — Is the lockup 2rem in every expanded-header viewport?
- [`qa-noun-crud/README.md`](qa-noun-crud/README.md) — **Templates and relationships after creation** — Can a template be revised and retired, and does a bound relationship keep the version it was answered under?
- [`qa-recharts-3/README.md`](qa-recharts-3/README.md) — **recharts 3** — Do the pie labels still render after the recharts 3 bump?
- [`qa-stage5/README.md`](qa-stage5/README.md) — **Stage 5, both states** — Does stage 5 offer the payment walk and send/draft instead of a band with no action?
- [`qa-swiper-12/README.md`](qa-swiper-12/README.md) — **swiper 12** — Do the carousels survive swiper 11.2.7 → 12.2.0?
- [`qa-template-catalogue/README.md`](qa-template-catalogue/README.md) — **Template catalogue** — What do the catalogue pages look like from the AlignSynch build?
- [`qa-v1x-ui-cohort/README.md`](qa-v1x-ui-cohort/README.md) — **v1.x UI cohort** — Were all ten owner items measured in a real browser?

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
