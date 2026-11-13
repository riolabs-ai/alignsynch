# Changelog

Every release of AlignSynch, newest first. The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the versions are [semantic versioning](https://semver.org/spec/v2.0.0.html). The entries are generated from the
conventional commits on `main` by [`scripts/release.sh`](scripts/release.sh) — fix the commit, not this file —
and each `## [x.y.z] - <date>` block is also the body of its GitHub Release, byte for byte. Every entry ends
with a **Known limits** block, because a release that does not say what it cannot do reads as a claim that it can.

## [1.17.0] - 2026-11-13

### Added

- `feat(admin)` — the sticky notice bar and /admin/brand (#906) ([#947](https://github.com/riolabs-ai/alignsynch/pull/947))
- `feat(catalogue)` — /relationship-templates, the V2 catalogue (#905) ([#933](https://github.com/riolabs-ai/alignsynch/pull/933))
- `feat(qa)` — one demo driver walks create/draft/unpaid in a browser — and the breaks it found (#898) ([#930](https://github.com/riolabs-ai/alignsynch/pull/930))
- `feat(review)` — the comments mockup on the review shelf — 3 subjects × 2 placements (#921) ([#928](https://github.com/riolabs-ai/alignsynch/pull/928))
- `feat(review)` — register lifecycle v8 + v9 on the review shelf, and sync it without a full seed (#914) ([#919](https://github.com/riolabs-ai/alignsynch/pull/919))
- `feat(home)` — clone the V2 home reference onto / (#904) ([#924](https://github.com/riolabs-ai/alignsynch/pull/924))
- `feat(flow)` — stage 5 is the three-step payment walk and the send it gates (#911) ([#918](https://github.com/riolabs-ai/alignsynch/pull/918))
- `feat(nav)` — /admin/docs gets a rail row (#901) ([#907](https://github.com/riolabs-ai/alignsynch/pull/907))
- `feat(data)` — the platform package — kind platform, deterministic zip, subsets (#899) ([#902](https://github.com/riolabs-ai/alignsynch/pull/902))
- `feat(ui)` — rebuild /relationship-types from the approved templates redesign (#889) ([#891](https://github.com/riolabs-ai/alignsynch/pull/891))
- `feat(admin)` — /admin/docs renders the docs tree (#892) ([#900](https://github.com/riolabs-ai/alignsynch/pull/900))

### Fixed

- `fix(flow)` — stage 5's Send reads the captured method from the payment row (#948) ([#949](https://github.com/riolabs-ai/alignsynch/pull/949))
- `fix(member)` — the relationship screen reads its own Aspects, not the template's (#936) ([#944](https://github.com/riolabs-ai/alignsynch/pull/944))
- `fix(ui)` — the relationship edit panel stops printing the Aspects a second time (#935) ([#942](https://github.com/riolabs-ai/alignsynch/pull/942))
- `fix(admin)` — /admin/audit reads a row with no reason instead of throwing (#938) ([#941](https://github.com/riolabs-ai/alignsynch/pull/941))
- `fix(nav)` — the owner's standard rail order, for every role (#929) ([#939](https://github.com/riolabs-ai/alignsynch/pull/939))
- `fix(ui)` — the relationship detail's edit form is a dialog/sheet, not a permanent column (#923) ([#932](https://github.com/riolabs-ai/alignsynch/pull/932))
- `fix(demo)` — prune preserved branches by policy before the reset (#909) ([#917](https://github.com/riolabs-ai/alignsynch/pull/917))
- `fix(pay)` — the modal is the only way to pay (#912) ([#925](https://github.com/riolabs-ai/alignsynch/pull/925))
- `fix(copy)` — a relationship's kind chip says Relationship, not Template (#874) ([#916](https://github.com/riolabs-ai/alignsynch/pull/916))
- `fix(flow)` — a visitor's chosen template survives the account gate (#867) ([#915](https://github.com/riolabs-ai/alignsynch/pull/915))

### Maintenance

- `test(ui)` — the Escape close waits for Radix's focus restore ([#950](https://github.com/riolabs-ai/alignsynch/pull/950))
- feat(demo) · #920 — a deterministic growth model to $3M ARR, and an operational demonstration set ([#934](https://github.com/riolabs-ai/alignsynch/pull/934))
- `docs(oss)` — LICENSE (MIT), SECURITY.md, CODE_OF_CONDUCT.md, SUPPORT.md (#922) ([#927](https://github.com/riolabs-ai/alignsynch/pull/927))
- `docs(oss)` — CONTRIBUTING.md for humans + audit issue/PR templates and CODEOWNERS (#922) ([#926](https://github.com/riolabs-ai/alignsynch/pull/926))
- `spec(design)` — banner + /admin/brand added to the V2 package (#903) ([#910](https://github.com/riolabs-ai/alignsynch/pull/910))
- `docs(workflow)` — codify request → release, and add the release-train card template ([#890](https://github.com/riolabs-ai/alignsynch/pull/890))

### Known limits

- **`demo.alignsynch.com` is still down.** The hostname answers `DEPLOYMENT_NOT_FOUND` (#833); the demo dataset is reachable through `pnpm demo:verify` and the review rig, not through that address. Deferred by owner decision, not by oversight.
- **Stripe runs in test mode, structurally.** `lib/billing/adapters/stripe.ts` refuses any credential that is not an `sk_test_…` key, and the webhook endpoints still belong to the test account (#846, #847). The payment walk is the real three-step UI; the capture it performs is a test capture.
- **Production has no admin seat yet.** `ADMIN_EMAILS` is unset on the production branch, so no operator reaches `/admin/**` there; the demo branch carries two (#423).
- **The modal rule has not been audited screen by screen.** #913 asks for every screen, page, menu and button to be validated against it. This version applies the rule where it touched a surface — the relationship edit form is a dialog and the pay step is a modal — and does not claim the audit.

## [1.16.0] - 2026-11-12

### Added

- `feat(ui)` — /assessments is the member's session listing (#877) ([#888](https://github.com/riolabs-ai/alignsynch/pull/888))
- `feat(flow)` — add and remove an Aspect at stage 3, and record the copy as authored (#699) ([#876](https://github.com/riolabs-ai/alignsynch/pull/876))
- `feat(infra)` — pnpm qa:links derives the clickable QA list for a change range (#863) ([#869](https://github.com/riolabs-ai/alignsynch/pull/869))
- `feat(flow)` — the counterparty forks the relationship's template into their own (#785) ([#872](https://github.com/riolabs-ai/alignsynch/pull/872))
- `feat(ux)` — one left-justified column for every dashboard page, and a registered exception list (#858) ([#871](https://github.com/riolabs-ai/alignsynch/pull/871))
- `feat(templates)` — delete an authored template, behind a confirm (#743) ([#866](https://github.com/riolabs-ai/alignsynch/pull/866))
- `feat(infra)` — the admin rail is a versioned document with a validator (#861) ([#864](https://github.com/riolabs-ai/alignsynch/pull/864))
- `feat(ui)` — measure rules 6 and 7 as E40, then fix all 18 (#719 C5) ([#860](https://github.com/riolabs-ai/alignsynch/pull/860))
- `feat(billing)` — the publish trial is the Advanced entitlement (#835) ([#859](https://github.com/riolabs-ai/alignsynch/pull/859))
- `feat(home)` — the AS2 front page at / with the surface-token layer it needs (#853) ([#857](https://github.com/riolabs-ai/alignsynch/pull/857))
- `feat(copy)` — stage 4 says each fact once, and the OAuth control has its mark (#777) ([#855](https://github.com/riolabs-ai/alignsynch/pull/855))
- `feat(ui)` — the relationships list is the My Quizzes record list (#841 part 2) ([#852](https://github.com/riolabs-ai/alignsynch/pull/852))
- `feat(admin)` — the eighteen admin pages render in one shared column (#717) ([#851](https://github.com/riolabs-ai/alignsynch/pull/851))
- `feat(billing)` — the Free card is the trial card, and a lapse closes the Gap not the pairing (#848) ([#849](https://github.com/riolabs-ai/alignsynch/pull/849))

### Fixed

- `fix(flow)` — the counterparty's read-only screen gets a door (#873) ([#887](https://github.com/riolabs-ai/alignsynch/pull/887))
- `fix(copy)` — the AlignSynch footer's link column is "Website Links" ([#886](https://github.com/riolabs-ai/alignsynch/pull/886))
- `fix(home)` — the marketing header's lockup is a link to the front page ([#884](https://github.com/riolabs-ai/alignsynch/pull/884))
- `fix(theme)` — render next-themes during SSR so its pre-paint script lands (#880) ([#885](https://github.com/riolabs-ai/alignsynch/pull/885))
- `fix(flow)` — stage 5 is not a dead end — payment walk, send/draft, and the template guard at stage 1 (#870) ([#878](https://github.com/riolabs-ai/alignsynch/pull/878))
- `fix(home)` — the footer Quick Links mirror the marketing header menu ([#883](https://github.com/riolabs-ai/alignsynch/pull/883))
- `fix(home)` — the hero's "See how it works" was 60px tall because its arrow sized itself ([#882](https://github.com/riolabs-ai/alignsynch/pull/882))
- `fix(ui)` — the rail's collapse control is a button on its border, not a form (#875) ([#881](https://github.com/riolabs-ai/alignsynch/pull/881))
- `fix(ui)` — the relationship detail is a destination, not a flow (#873) ([#879](https://github.com/riolabs-ai/alignsynch/pull/879))
- `fix(db)` — the demo seed converges a drifted branch instead of refusing it (#865) ([#868](https://github.com/riolabs-ai/alignsynch/pull/868))
- `fix(flow)` — the draft lands on the relationships list, and the list titles by the relationship (#841) ([#850](https://github.com/riolabs-ai/alignsynch/pull/850))
- `fix(billing)` — the hosted capture sends the currency the provider requires (#844) ([#845](https://github.com/riolabs-ai/alignsynch/pull/845))
- `fix(billing)` — publishing a relationship opens its trial, so the counterparty can claim (#840) ([#843](https://github.com/riolabs-ai/alignsynch/pull/843))
- `fix(deploy)` — demo.alignsynch.com serves again — one command creates it, one rule keeps it (#838) ([#839](https://github.com/riolabs-ai/alignsynch/pull/839))
- `fix(flow)` — a draft is not gated, and stage 5 says the plan without refusing it (#834) ([#837](https://github.com/riolabs-ai/alignsynch/pull/837))
- `fix(flow)` — stage 4 opens on Create account and toggles in place (#829) ([#831](https://github.com/riolabs-ai/alignsynch/pull/831))

### Maintenance

- `docs(legal)` — photography credits at /terms, and the AS2 handoff package committed (#853) ([#856](https://github.com/riolabs-ai/alignsynch/pull/856))
- `test(flow)` — the e2e walks the five stages, signed in, and proves draft vs send (#844) ([#842](https://github.com/riolabs-ai/alignsynch/pull/842))
- `chore(health)` — re-record the platform record at 1.15.0 ([#836](https://github.com/riolabs-ai/alignsynch/pull/836))
- `docs(changelog)` — v1.15.0 says what the tag's stage 4 actually does ([#832](https://github.com/riolabs-ai/alignsynch/pull/832))

### Known limits

- The public Templates catalogue at `/relationship-types` is **unchanged** in this release. The approved `spec-as2-style-templates-redesign` build is still in review, so the page visitors see today is the previous one.
- Selecting a template does not carry through sign-up. A card's use action opens registration without the chosen template, because the intent parameter is not implemented yet.
- The relationship card's kind chip still prints "Template" where the record is a relationship; templates are products and a relationship is a pairing.
- `/assessments` lists assessment sessions over data the app already holds. Comments, notes and gap analytics are not part of it.
- Payments run in test mode: no charge is processed, and the pricing page's disclosure stands unchanged.
- The demo environment serves the previous version until its next refresh; the verification recorded here applies to the tagged tree on production.
- Two records still share one wording: the relationship detail's read-only notice and the counterparty's way-forward door both point at the relationships list, which is the only destination that exists today.


## [1.15.0] - 2026-11-12

### Added

- `feat(flow)` — Account is stage 4 and Invite is stage 5 — the five-cell rail (#825) ([#828](https://github.com/riolabs-ai/alignsynch/pull/828))
- `feat(flow)` — the spec is five stages, and Stage 1 asks first and last names (#825, PR 1 of 2) ([#826](https://github.com/riolabs-ai/alignsynch/pull/826))

### Fixed

- `fix(flow)` — a Stage 1 control fills its cell, so the name pair stops overflowing (#825) ([#827](https://github.com/riolabs-ai/alignsynch/pull/827))

### Maintenance

- `chore(health)` — re-record the platform record at 1.14.0 ([#820](https://github.com/riolabs-ai/alignsynch/pull/820))

### Known limits

- **The flow takes no payment.** `Send and Continue` posts to
  `/assessment/instances/[instanceId]/send`, which reissues the token and moves the row
  `draft → published`; nothing in the five stages charges anything. The two plans on stage 5 are a
  soft prompt — `data/pages/assessment-create.ts` says so in the `payment-flow` section, "a soft
  prompt, not a checkout" — and buying a tier is `/pricing`
  (`components/pricing/plan-checkout-button.tsx`). A real checkout inside the flow is #823 with #690.
- **Stage 4 is only as good as the app's auth environment.** The stage mounts the real
  `components/auth/login-view.tsx`, so its form submits to the app's own auth proxy: on a tree with no
  `NEON_AUTH_*` the submit raises the configuration error rather than signing anybody in
  (`lib/auth/session.ts::currentUser`). The gate carries no auth env by design, so this stage is
  proven by a request, never by `pnpm build`.
- **Stage 3 still cannot add or remove an Aspect.** V4 keeps the template's list fixed until #699:
  the shared editor names `Add an Aspect` and `Remove {name}`, and stage 3 draws neither
  (`data/pages/assessment-create.ts`).
- **The Invite copy is not condensed.** #777 is open — stage 5 states the same promise several times,
  and the OAuth button carries no provider mark.
- **A kept draft sends nothing and has no surface of its own.** `Continue as Draft` leaves the
  relationship at `status = 'draft'` with `published_at` NULL, no mail sent and no token handed out;
  the confirmation that owns resend and copy-link is reached by sending, and a kept draft is picked up
  from the dashboard's relationship detail.
- **The retired account gate is a redirect, not a screen.** A bookmarked
  `/templates/relationship/<slug>/create/account` answers a permanent 308 to `/create/commit`, the
  stage that now asks for the account; the flow has five stages and nothing after the fifth
  (`next.config.mjs`, `docs/specs/flow-stages.md`).

## [1.14.0] - 2026-11-11

### Added

- `feat(ia)` — the worked example lives at /relationship-types/<slug>/demo (#794 follow-up) ([#809](https://github.com/riolabs-ai/alignsynch/pull/809))
- `feat(ia)` — a relationship template lives at /templates/relationship/<slug> (#794) ([#803](https://github.com/riolabs-ai/alignsynch/pull/803))

### Fixed

- `fix(db-verify)` — the summary stops calling a session an instance (#783) ([#813](https://github.com/riolabs-ai/alignsynch/pull/813))
- `fix(routes)` — the worked example's old address answers a permanent 308 ([#810](https://github.com/riolabs-ai/alignsynch/pull/810))
- `fix(copy)` — the demo report prices the plan, not the relationship (#805) ([#807](https://github.com/riolabs-ai/alignsynch/pull/807))
- `fix(copy)` — the marketing template surfaces price the plan, not the relationship (#798) ([#804](https://github.com/riolabs-ai/alignsynch/pull/804))
- `fix(copy)` — the template card prices the plan, not the relationship (#796) ([#799](https://github.com/riolabs-ai/alignsynch/pull/799))
- `fix(ui)` — drop the browse rail from the template detail page (#791) ([#793](https://github.com/riolabs-ai/alignsynch/pull/793))

### Maintenance

- `docs(agents)` — the lint baseline is 221/37, and the file says how to measure it (#815) ([#816](https://github.com/riolabs-ai/alignsynch/pull/816))
- `refactor(ui)` — the relationship card's tiles are the card's one meta line (#795 F4) ([#814](https://github.com/riolabs-ai/alignsynch/pull/814))
- `refactor(ui)` — one chip primitive, rounded-full, four tones (#795) ([#808](https://github.com/riolabs-ai/alignsynch/pull/808))
- `refactor(ui)` — one member card projection feeds both shelves (#795 F2) ([#811](https://github.com/riolabs-ai/alignsynch/pull/811))
- `test(routes)` — prove every #794 old address answers a permanent 308 ([#806](https://github.com/riolabs-ai/alignsynch/pull/806))
- `docs(mockup)` — #795 v2 — the provenance cells wrap, and three §0 claims get exact ([#802](https://github.com/riolabs-ai/alignsynch/pull/802))
- `docs(mockup)` — re-derive §0 provenance at 89beff68 — one-card-one-detail-v2 (#795) ([#800](https://github.com/riolabs-ai/alignsynch/pull/800))
- `docs(mockup)` — one card, one detail — the approval artifact for #795 ([#797](https://github.com/riolabs-ai/alignsynch/pull/797))
- `chore(health)` — re-record the platform record at 1.13.0 ([#790](https://github.com/riolabs-ai/alignsynch/pull/790))

### Known limits

- **The redirects map address families, not records.** `/assessment/demo/:type` is one segment wide,
  so `/assessment/demo/<type>/anything` is still a plain 404, and a type with no worked example
  answers 404 at `/relationship-types/<type>/demo` even though its _old_ address still 308s — the
  table cannot look a row up (`next.config.mjs`).
- **The rename stops at the public noun.** The member routes still live at `/assessment/instances/**`
  and the schema still spells `assessment_instance` / `instance_invite`. What changed is what
  `db:verify`'s summary line _says_: `${instances.length} session(s) checked`. Renaming the tables and
  the member routes is #783's remainder and needs a production snapshot and a restore plan
  (`scripts/db-verify.mjs`, `db/migrations/0002_two_party_flow.sql`).
- **IA v2 is not in this release.** The rail keeps the groups it has; the four-group rail is drawn
  and pushed on `feat/app-ia` and waits for its review before it ships.
- **A relationship's template cannot be saved as the member's own template** (#785). There is no
  clone path, and nothing here adds one.
- **The relationship's own amount still exists as data and is printed nowhere.**
  `data/relationship-types.ts::RELATIONSHIP_PRICE_CENTS` keeps $9.99 for a future per-relationship
  charge; the catalogue card, the member shelf and the template editor read the plan from
  `data/billing-plans.ts` instead, which is why they read `Basic · $8.95/mo` and cannot disagree,
  and the worked example's report names the plan and hands the reader `/pricing` rather than
  quoting any figure of its own.
- **One card type, two shelves, deliberate nulls.** `lib/member/card.ts::MemberCard` is a template
  card with `relationship: null` and a relationship card with `summary: null`; a third shelf
  adopting it is the moment to split it into a discriminated `kind` rather than widen it again.

## [1.13.0] - 2026-11-11

### Added

- `feat(templates)` — every template has a page, not just a card (#782) ([#782](https://github.com/riolabs-ai/alignsynch/pull/782))
- `feat(templates)` — the directory, not the pitch — /templates drops its three explainer bands (#781) ([#781](https://github.com/riolabs-ai/alignsynch/pull/781))
- `feat(ui)` — one Aspect editor for the modal and the dashboard (#774) ([#775](https://github.com/riolabs-ai/alignsynch/pull/775))

### Fixed

- `fix(copy)` — a relationship has sessions, a template has neither (#783) ([#787](https://github.com/riolabs-ai/alignsynch/pull/787))
- `fix(templates)` — a relationship does not make a template yours (#783) ([#784](https://github.com/riolabs-ai/alignsynch/pull/784))

### Maintenance

- `docs(review)` — v8 — the draft path is "Continue as Draft" (#780) ([#780](https://github.com/riolabs-ai/alignsynch/pull/780))
- `docs(review)` — v8 — membership heading, the two invitation states, and a plainer plan note (#779) ([#779](https://github.com/riolabs-ai/alignsynch/pull/779))
- `docs(review)` — prototype v8 — Stage 4 condensed, drawn as the release draws it (#777) ([#778](https://github.com/riolabs-ai/alignsynch/pull/778))
- `chore(health)` — re-record platform health for 1.12.0 ([#773](https://github.com/riolabs-ai/alignsynch/pull/773))

### Known limits

- **A relationship does not put its template in your library, and no action adds it yet.** My
  Templates lists the templates a member owns: `lib/member/library.ts::listMemberLibrary` reads
  `r.owner_user_id = $1`, and the party-join branch that pulled in every template one of their
  relationships had been copied from is deleted. The explicit door the owner asked for — take a
  template from a relationship I am in, and make it mine — is not in this release: #785 needs an
  approved mockup first, and with the old predicate gone there is no route that clones a template.
- **Twenty-five of the twenty-seven template pages show no worked example.** The page draws one only
  where the fixture holds a demo sheet — two types today, `staff-manager` and `co-founders`
  (`data/relationship-types.ts::demoAnswersFor`). A link that would 404 is worse than none, so the
  other twenty-five pages end at the Start action.
- **The template pages are built from the fixture, not from the database.** All twenty-seven are
  prerendered by `app/(marketing)/relationship-types/[slug]/page.tsx::generateStaticParams` over
  `data/relationship-types.ts`, so a template that exists only in the tenant store an imported
  bundle writes (`data/generated/`) has no public page until the next build. _(The page moved in
  #794, when the catalogue left the template noun: at this tag the file was
  ~~`app/(marketing)/templates/[slug]/page.tsx::generateStaticParams`~~, and its address is
  `/relationship-types/<slug>` now.)_
- **Three templates are deliberately absent.** The public pages are the purchasable types only; a
  slug that names a dating type the owner excluded, or nothing at all, answers 404.
- **The terminology rename is copy, not schema: the code handles still say `instance`.** The
  `{instances}` view token, the fixture module named `data/pages/assessment-instance.ts` and the
  `flow_invite_<id>` cookie names are handles rather than words a reader sees, and they are left
  alone. What changed is the copy, guarded by `tests/terminology.test.ts`, which fails on a
  reader-visible _instance_ in a `data/pages` fixture.
- **URLs are unchanged.** `/assessment/instances/<id>/…` still serves the relationship workspace;
  the route rename to `/relationships/<id>/sessions/…` needs redirects and its own pass, and it is
  not in a minor.
- **A template cannot be authored from the public site.** `/templates` and `/templates/<slug>` are
  read-only projections: starting a relationship from one copies it into a relationship, and
  creating a template of your own is still the dashboard's editor.

## [1.12.0] - 2026-11-09

### Added

- `feat(flow)` — stage 4 walks the payment in place, and the create is a draft that pays at publish ([#771](https://github.com/riolabs-ai/alignsynch/pull/771))
- `feat(review)` — the prototype's Save writes its copy into the repository (#767) ([#768](https://github.com/riolabs-ai/alignsynch/pull/768))

### Fixed

- `fix(review)` — Stage 4's payment runs in place, and the CTA becomes Complete and Connect ([#770](https://github.com/riolabs-ai/alignsynch/pull/770))
- `fix(review)` — the pre-stage loses its duplicate chip, and the change-request bar moves left ([#769](https://github.com/riolabs-ai/alignsynch/pull/769))
- `fix(flow)` — every in-card control reaches the 44px floor, and the floor is pinned (#745) ([#765](https://github.com/riolabs-ai/alignsynch/pull/765))

### Maintenance

- `chore(health)` — re-record platform health for 1.11.0 ([#766](https://github.com/riolabs-ai/alignsynch/pull/766))
### Known limits

- **The create screen takes no card.** Stage 4's walk defers the capture by design: the method is
  asked for once, when the relationship's opinions are published. The confirmation says "Asked for
  at publish" rather than drawing a field that would take nothing.
- **`/pricing` is no longer linked from stage 4.** Choosing a plan commits nothing and buys nothing;
  a tier is still sold on `/pricing` and from the account screens.
- **The account panel names the account, it does not collect it.** The shipped gate
  (`components/assessment-flow/account-gate.tsx`) still follows the commit, and the walk's panel
  only says what happens.
- **Publishing still needs a method on file** — the hard gate is unchanged
  (`components/dashboard/relationship-detail.tsx`, `lib/flow/payment.ts`). A draft created without
  one asks for it at publish; nothing about the charge moved.
- **Stripe is still test-mode on the demo deployment.** No real charge is possible from any screen
  in this release, and `BILLING_HOST` is unset in the local checkout, so a checkout attempt there
  answers `503 not-configured`.
- **The walk is a client component.** Stage 4 moved to `components/assessment-flow/stage-four.tsx`
  and the foot to `components/assessment-flow/stage-foot.tsx`; stages 1–3 are unchanged in
  `components/assessment-flow/create-relationship.tsx`.

## [1.11.0] - 2026-11-09

### Added

- `feat(flow)` — the build matches the v7 artifact — shell width, footers, Settings peers, Aspect rows (#760) ([#761](https://github.com/riolabs-ai/alignsynch/pull/761))

### Fixed

- `fix(answer-sheet)` — a refusal code with no sentence 500s, and `lapsed` answers 404 (#752) ([#755](https://github.com/riolabs-ai/alignsynch/pull/755))

### Maintenance

- `docs(review)` — fold the owner's prototype review pass into the v7 artifact ([#759](https://github.com/riolabs-ai/alignsynch/pull/759))
- `chore(health)` — re-record the platform record at 1.10.0 ([#758](https://github.com/riolabs-ai/alignsynch/pull/758))

### Known limits

- **The build matches the artifact on four screens; the artifact is still the reference.** The v7
  file (`docs/review/artifacts/prototype-relationship-lifecycle-v7.html`) is what the review approved,
  and it keeps being revised on its own. A revision to the artifact does not reach the product until a
  card lands, so the two can diverge between releases by design — this release closes the gap that was
  open, it does not close the mechanism.
- **Settings agrees on the question and still differs on the shape.** The build draws the two
  dimensions as two peer fieldsets side by side (`components/assessment-flow/create-relationship.tsx`);
  the artifact stacks two cards with a two-up option row inside each. Same two choices — **Basic** /
  **Advanced** and **Soft** / **Full** — different layout. Recorded in #761 rather than quietly
  reconciled.
- **The 44px tap floor is measured on stage 1 and inherited by the rest.** Measured in this release at
  1440 and 390: the Details foot's `Back`, `Cancel` and advance are 44, 44 and 44px tall. Stages 2–4 use
  the same `StageFoot` component, so they hold by construction; there is no per-stage measurement for
  them in this release.
- **The stage-3 exit now reads `Continue to Stage 4`, not the spec's older `Continue to invite`.** The
  approved artifact replaced that whole family of exits, and `docs/specs/flow-stages.md` was amended in
  the same change so the spec and the artifact do not contradict each other. A reader who learned the
  older wording will find a different label on the button.
- **Copy lives in the fixtures, and the artifact's `Edit copy` tool is not in the build.** Every string
  the flow renders comes from `data/pages/assessment-create.ts` (E23 forbids a literal in a component).
  The artifact's browser-side override tool is a review device and does not exist in the product.
- **`Align` is still drawn unavailable from the create flow.** The relationship this flow creates has no
  shared assessment until somebody claims the invitation and answers, which is unchanged by this
  release and is what the spec requires.
- **No database, auth or API change.** `db/migrations/`, `lib/auth/` and `lib/db/` are untouched; this
  release is the create flow's markup, its fixture copy, the spec table, and the tests that pin them.

## [1.10.0] - 2026-11-09

### Added

- `feat(payment)` — the capture is an embedded form in the dialog, not a hosted link (#748) ([#751](https://github.com/riolabs-ai/alignsynch/pull/751))

### Known limits

- **Paying happens in a frame inside our page, not a navigation.** `presentation: "embedded"` asks the
  provider for `ui_mode: embedded_page` with a `return_url` instead of a `success_url`, and the
  session answers a `client_secret` the dialog mounts (`lib/billing/adapters/stripe.ts`,
  `components/dashboard/payment-capture-dialog.tsx`). The **hosted** presentation is still the
  default, and `/pricing`'s membership checkout still uses it — the relationship fee and the
  membership are two different checkout shapes on purpose.
- **One case still leaves the page: an SCA challenge.** The embedded frame has no `success_url` to
  return to, so the single path that must navigate is the bank's own check, and it comes back
  through `return_url`. Every other capture completes without the flow being left.
- **Only Stripe test keys are configured.** The adapter reads `STRIPE_TEST_SECRET_KEY`, so a method
  is captured in test mode and this release cannot take a real charge.
- **The artifact's frame caption says `ui_mode: embedded`, and this build does not send that word.**
  Stripe refuses it — "The ui_mode value `embedded` is no longer supported. Use `embedded_page`" —
  so the code sends `embedded_page` and an embedded session also carries `currency`. The caption in
  the artifact is the artifact's copy and was left alone; the deviation is recorded on `#748`
  rather than silently rewritten.
- **A lapsed membership still answers 500 instead of the read-only screen.** A trial or subscription
  that ends is exactly the state this release's payment work makes reachable, and
  `POST /assessment/instances/<id>/answers` asks the `problems` section for an item named `lapsed`
  that the fixture does not carry (`data/pages/assessment-instance.ts`), so the request fails rather
  than rendering the sentence written for it in `data/pages/assessment-answer.ts`. Named in this
  block because shipping payment without saying so would be the dishonest half; `#752` fixes it,
  and that fix landed on `main` as `#755` after this tag was cut.
- **The hard gate sits at completion, and it is the only gate.** With no method on file a
  relationship reports `awaiting_payment` and opinions stay withheld (`lib/flow/state.ts`);
  answering, sharing and inviting are never gated, and there is still no login wall to reach them.
- **The conformance slices C3, C4 and C5 are not in this release.** The admin console's left edge
  (`#717`), the marketing content cards' shadows (`#718`) and the right-aligned numbers and explicit
  empty states (`#719`) sit in the `v1.11.0` milestone, not here.
- **One payment path still carries a known risk, unchanged.** Publishing can start a trial or
  checkout while completion also writes a `relationship_payment` obligation (ADR-1), so a
  double-created obligation is possible; reachable only with test keys today.

## [1.9.0] - 2026-11-09

### Added

- `feat(crud)` — templates publish revisions and are retired, never destroyed in use (#711) ([#742](https://github.com/riolabs-ai/alignsynch/pull/742))
- `feat(flow)` — the invite-response path runs in the same modal and ends on /dashboard (#710) ([#740](https://github.com/riolabs-ai/alignsynch/pull/740))

### Fixed

- `fix(payment)` — a member can pay — capture a method and complete a relationship (#739) ([#747](https://github.com/riolabs-ai/alignsynch/pull/747))
- `fix(flow)` — the modal shell clears the close at 390, and the walk is pinned (#713) ([#741](https://github.com/riolabs-ai/alignsynch/pull/741))

### Maintenance

- `chore(deploy)` — prune stale Vercel deployments, and make it a command ([#746](https://github.com/riolabs-ai/alignsynch/pull/746))

### Known limits

- **A payer can pay, but paying still leaves the modal.** This release wires the two acts that
  were built and unreachable (`#739`): `capturePaymentMethodAction` and `completeRelationshipAction`
  now run from `app/(mainlayout)/dashboard/relationships/[id]/page.tsx`, and the controls that
  shipped visibly disabled no longer are. What it does not do is pay **inside** the flow: the
  adapter creates hosted sessions only (`lib/billing/adapters/stripe.ts`), so `Add a payment method`
  opens Stripe's page rather than the artifact's in-frame `Secure payment` frame. That frame is
  `#749`, not this release.
- **Only Stripe test keys are configured.** The adapter reads `STRIPE_TEST_SECRET_KEY`, so a method
  is captured in test mode and this release cannot take a real charge. Nothing in the product
  depends on test mode to work — the path is the same one live keys would drive.
- **The hard gate sits at completion, and it is the only gate.** With no method on file the
  relationship reports `awaiting_payment` and opinions are withheld (`lib/flow/state.ts`); answering,
  sharing and inviting are never gated, and no screen asks for a login to get that far. The artifact
  draws the same lock at _publish_; the code enforces it at _complete_. One gate, not two.
- **The conformance slices C3, C4 and C5 are not in this release.** The admin console's left edge
  (`#717`), the marketing content cards' shadows (`#718`) and the right-aligned numbers and explicit
  empty states (`#719`) moved to the `v1.10.0` milestone rather than being claimed here.
- **Template revisions are published, never destroyed.** Retiring a template keeps every published
  revision readable (`#711`); there is no hard delete, by design, so a relationship that points at an
  older revision keeps a document to point at.
- **Invite-response runs in the same modal and ends on `/dashboard`** (`#710`), and the modal is
  measured at 390×844 and 390×500 (`#713`). The measurement is a walk that a test pins, not a
  continuous check — a later screen added outside the six stages is not covered by it.
- **Deployment retention is a command, not a policy.** `pnpm deploy:prune` (dry run by default) is
  what stops Vercel's Function Storage filling with old builds (`#746`); nothing prunes on a
  schedule, so the quota grows with merges until someone runs it.
- **One payment path still carries a known risk, unchanged.** Publishing can start a trial or
  checkout while completion also writes a `relationship_payment` obligation (ADR-1), so a
  double-created obligation is possible; it is reachable only with test keys today.
- **`pnpm db:seed` still refuses on the demo branch.** Demo carries assessment rows the demo dataset
  does not author, and the seed fails rather than clobber them; the documented recovery is
  `pnpm demo:reset`, destructive to demo only. The gate never opens a connection, so local and CI
  are unaffected.

## [1.8.0] - 2026-11-08

### Added

- `feat(flow)` — conform to the six-stage spec — Details · Settings · Aspects · Invite · Connect · Align (#735) ([#737](https://github.com/riolabs-ai/alignsynch/pull/737))
- `feat(admin)` — ADMIN_EMAILS is enforced at seed time, not only at sign-in ([#730](https://github.com/riolabs-ai/alignsynch/pull/730))
- `feat(admin)` — a reason is optional on every action form, and no screen asks for one (#732) ([#736](https://github.com/riolabs-ai/alignsynch/pull/736))
- `feat(ui)` — the answer flow shows one progress pattern — the cell rail (#716) ([#733](https://github.com/riolabs-ai/alignsynch/pull/733))
- `feat(flow)` — the create flow opens as one modal and closes onto the dashboard (#709) ([#728](https://github.com/riolabs-ai/alignsynch/pull/728))
- `feat(ui)` — the member console is left-justified on the shared StageColumn (C1) (#715) ([#722](https://github.com/riolabs-ai/alignsynch/pull/722))
- `feat(onboarding)` — stage 6 Ongoing — the Alignment, aspect by aspect (#692) ([#703](https://github.com/riolabs-ai/alignsynch/pull/703))
- `feat(onboarding)` — stage 5 Sent — the invitation's state, what happens next (#691) ([#702](https://github.com/riolabs-ai/alignsynch/pull/702))
- `feat(onboarding)` — stage 4 Create and the post-stage-4 account gate (#690) ([#701](https://github.com/riolabs-ai/alignsynch/pull/701))

### Fixed

- `fix(review)` — v6's capture is dated after v5's, so the console lists it first (#708) ([#727](https://github.com/riolabs-ai/alignsynch/pull/727))
- `fix(ui)` — a hover shade is painted as a color the parser accepts, not a bare triple ([#726](https://github.com/riolabs-ai/alignsynch/pull/726))
- `fix(member)` — a Counterparty sees their relationship, and writes stay initiator-only (#706) ([#720](https://github.com/riolabs-ai/alignsynch/pull/720))
- `fix(e2e)` — drive the four-stage create and register the instance before it throws (#704) ([#705](https://github.com/riolabs-ai/alignsynch/pull/705))

### Maintenance

- `docs(specs)` — the flow is six stages, and the spec is binding ([#734](https://github.com/riolabs-ai/alignsynch/pull/734))
- `docs(review)` — v6 — the flow as a modal, the dashboard it closes onto, and both viewports (#708) ([#725](https://github.com/riolabs-ai/alignsynch/pull/725))
- `docs(agents)` — Card carries no shadow — elevation is a border, not the primitive's default ([#724](https://github.com/riolabs-ai/alignsynch/pull/724))

### Known limits

- **`Align` is conditional, so a brand-new relationship shows five live stages.** The flow
  conformed to the spec in this release (#735): the rail prints `Stage {n} of 6`, the words are
  `Details · Settings · Aspects · Invite · Connect · Align`, `Ongoing` is gone, and completion
  lands on the relationship detail page in the dashboard. `Align` goes live only once one or more
  assessments are shared, so the sixth stage is visible but not enterable before then.
- **Prototype text and content revisions are not in this release.** The owner is preparing them for
  the next one; the `/admin/review/ia` rail proposal (#731) is parked and part of no release.
- **`pnpm db:seed` refuses on the demo branch.** Demo carries assessment rows the demo dataset does
  not author (eight at the time of writing), and the seed fails rather than clobber them. The
  documented recovery is `pnpm demo:reset`, which is destructive to demo only. Local and CI are
  unaffected: the gate never opens a connection.
- **`ADMIN_EMAILS` is enforced at seed time, not by the platform.** `pnpm admin:ensure` and
  `pnpm db:seed` create or promote the profile for any allowlisted address that already has an
  account; an address with no account on the branch is reported `pending sign-in` and is promoted
  the first time it signs in. Nothing creates an account.
- **A reason is now optional, but the column is kept.** No screen asks for one and `act()` writes
  NULL when none arrives; `admin_action.reason` stays nullable so an operator's stated reason is
  still recorded when they give one. The audit history before this release keeps its reasons.
- **The review artifacts are documents, not the product.** `/admin/review` serves the prototype
  HTML behind the admin gate; it draws the proposal and ships none of the behaviour it shows.
- **One payment path still carries a known risk.** Publishing can start a trial or checkout at
  creation while completion also writes a `relationship_payment` obligation (ADR-1). Unchanged by
  this release, and only reachable with test keys today.


## [1.7.0] - 2026-11-08

### Added

- `feat(onboarding)` — stage 3 Aspects — opinion labels, collapse on save, drag reorder (#689) ([#698](https://github.com/riolabs-ai/alignsynch/pull/698))
- `feat(onboarding)` — stage 1 Who and stage 2 Mode — two forms, one draft (#688) ([#697](https://github.com/riolabs-ai/alignsynch/pull/697))
- `feat(onboarding)` — the shared stage shell — one column, six-stage rail (#687) ([#694](https://github.com/riolabs-ai/alignsynch/pull/694))
- `feat(review)` — the approved six-stage prototype as the v5 review artifact ([#678](https://github.com/riolabs-ai/alignsynch/pull/678))
- `feat(admin)` — mount the review store's writes on /admin/review (#676) ([#677](https://github.com/riolabs-ai/alignsynch/pull/677))
- `feat(admin)` — a review shelf at /admin/review, artifacts grouped by release (#665) ([#673](https://github.com/riolabs-ai/alignsynch/pull/673))
- `feat(admin)` — the /admin/review store — artifacts, todos and GH-style issues (#667) ([#670](https://github.com/riolabs-ai/alignsynch/pull/670))
- `feat(P1)` — the payment door — capture a method, complete, open the Gap (#643) ([#644](https://github.com/riolabs-ai/alignsynch/pull/644))
- `feat(billing)` — deliver the payment reminders, and stamp only after a send (#638) ([#640](https://github.com/riolabs-ai/alignsynch/pull/640))
- `feat(billing)` — pay-to-complete — the fee moves from creation to completion (#619) ([#634](https://github.com/riolabs-ai/alignsynch/pull/634))
- `feat(ui)` — two-row member menu, two-tab Templates shelf, relationship cards (#620) ([#633](https://github.com/riolabs-ai/alignsynch/pull/633))
- `feat(flow)` — the create journey keeps its product across auth and stops dead-ending at the library (#618) ([#632](https://github.com/riolabs-ai/alignsynch/pull/632))
- `feat(privacy)` — account deletion — 0033 indexes, the Neon auth-user delete, one transactional scrub, an in-app control (#597) ([#597](https://github.com/riolabs-ai/alignsynch/pull/597))
- `feat(tour)` — step 4 fills the real answer sheet as an example (#457) ([#596](https://github.com/riolabs-ai/alignsynch/pull/596))
- `feat(email)` — templates 6-10 through the v0.9 band (#548) ([#568](https://github.com/riolabs-ai/alignsynch/pull/568))
- `feat(email)` — templates 2–5 through the band (#548) ([#558](https://github.com/riolabs-ai/alignsynch/pull/558))
- `feat(nav)` — the rail is a role-constrained menu, and the admin console leads its own group (#542) ([#552](https://github.com/riolabs-ai/alignsynch/pull/552))
- `feat(templates)` — a public Relationship Templates catalogue, and a home band that sells it ([#544](https://github.com/riolabs-ai/alignsynch/pull/544))
- `feat(flow)` — counterparty onboarding — a three-step wizard, and a next on every login hop ([#538](https://github.com/riolabs-ai/alignsynch/pull/538))
- `feat(relationship)` — #533 phase 3 — one trial, day-14 hard stop, read-only both sides, payment reactivates ([#537](https://github.com/riolabs-ai/alignsynch/pull/537))
- `feat(member)` — #533 phase 2 — initiator CRUD, publish, one-click re-publish ([#535](https://github.com/riolabs-ai/alignsynch/pull/535))
- `feat(relationship)` — template ownership, lifecycle, trial read and rounds (#533 phase 1) ([#534](https://github.com/riolabs-ai/alignsynch/pull/534))
- `feat(billing)` — claim the host on a checkout and refuse another host's events ([#532](https://github.com/riolabs-ai/alignsynch/pull/532))
- `feat(admin)` — broadcast to news signups (#507) ([#531](https://github.com/riolabs-ai/alignsynch/pull/531))
- `feat(admin)` — #506 support inbox — triage, Resend replies with visible failure, bounce state, throttle visibility ([#530](https://github.com/riolabs-ai/alignsynch/pull/530))
- `feat(email)` — #439b Resend inbound — signed webhook, idempotent email_event, bounce suppression ([#528](https://github.com/riolabs-ai/alignsynch/pull/528))
- `feat(admin)` — #502b template versioning — template_version, relationships bound to a version, immutable publish ([#524](https://github.com/riolabs-ai/alignsynch/pull/524))
- `feat(admin)` — #505 billing control — subscription state, test-mode banner, audited comps, server-side limits ([#525](https://github.com/riolabs-ai/alignsynch/pull/525))
- `feat(admin)` — #504 report operations — regenerate, PII-gated read, JSON + PDF export ([#523](https://github.com/riolabs-ai/alignsynch/pull/523))
- `feat(admin)` — #502a template authoring — a draft editor validated by zAssessment, saved through act() ([#522](https://github.com/riolabs-ai/alignsynch/pull/522))
- `feat(admin)` — /admin/health — the platform-health screen, every number naming its source (#508) ([#520](https://github.com/riolabs-ai/alignsynch/pull/520))
- `feat(admin)` — the five #503 actions, their floors, and a reason gate proven per operation ([#517](https://github.com/riolabs-ai/alignsynch/pull/517))
- `feat(admin)` — #503 relationship operations ([#516](https://github.com/riolabs-ai/alignsynch/pull/516))
- `feat(admin)` — /admin/audit — the filtered, read-only audit screen (#501b) ([#515](https://github.com/riolabs-ai/alignsynch/pull/515))
- `feat(admin)` — the role ladder, admin_invite, admin_action and act() (#501) ([#511](https://github.com/riolabs-ai/alignsynch/pull/511))
- `feat(admin)` — product.admin — the console's capability switch (#509) ([#512](https://github.com/riolabs-ai/alignsynch/pull/512))
- `feat(db-verify)` — V21 — a seeded instance reads `complete`, or the run names it ([#499](https://github.com/riolabs-ai/alignsynch/pull/499))
- `feat(onboarding)` — the first-run tour's shell — driver.js, six steps, skip a missing target (#455) ([#496](https://github.com/riolabs-ai/alignsynch/pull/496))
- `feat(onboarding)` — the tour's "seen" mark is one column and one guarded route (#456) ([#494](https://github.com/riolabs-ai/alignsynch/pull/494))
- `feat(assessment)` — the Steps render on the instance screen, and the v1 release rows retire (#478) ([#493](https://github.com/riolabs-ai/alignsynch/pull/493))
- `feat(demo)` — move the worked example to /assessment/demo/[type] and delete the prototype group (#478) ([#492](https://github.com/riolabs-ai/alignsynch/pull/492))
- `feat(release)` — --check-limits re-derives a Known limits block from the tree ([#489](https://github.com/riolabs-ai/alignsynch/pull/489))
- `feat(admin)` — move the console to /admin/console, behind the allowlist (#478) ([#486](https://github.com/riolabs-ai/alignsynch/pull/486))
- `feat(templates)` — the catalogue the page carries — 27 types, seven realms, priced from the fixture, filterable ([#464](https://github.com/riolabs-ai/alignsynch/pull/464))
- `feat(demo)` — pnpm demo:verify — a versioned dataset, a versioned expectation, one diff ([#460](https://github.com/riolabs-ai/alignsynch/pull/460))
- `feat(contact)` — no email on any public page, one no-captcha form on /help (supersedes #448) ([#452](https://github.com/riolabs-ai/alignsynch/pull/452))
- `feat(v1)` — the staff–manager template demo renders a real report ([#447](https://github.com/riolabs-ai/alignsynch/pull/447))
- `feat(pricing)` — three tiers, Basic recommended, relationship alignment copy, real billing rows ([#444](https://github.com/riolabs-ai/alignsynch/pull/444))
- `feat(support)` — split the help centre from account support ([#445](https://github.com/riolabs-ai/alignsynch/pull/445))
- `feat(marketing)` — the AlignSynch home leads with the practice, the Gap is the proof ([#431](https://github.com/riolabs-ai/alignsynch/pull/431))
- `feat(flow)` — acceptance is the completion hinge, and Steps are derived on the transition (#427) ([#430](https://github.com/riolabs-ai/alignsynch/pull/430))
- `feat(flow)` — the create form posts to /assessment/new, refusals come back as a band, and the chosen Setting is written (#427) ([#429](https://github.com/riolabs-ai/alignsynch/pull/429))
- `feat(flow)` — /answer is a gated sheet, blind by construction (#427) ([#428](https://github.com/riolabs-ai/alignsynch/pull/428))
- `feat(v1)` — gate the prototype group behind a session or the demo unlock ([#426](https://github.com/riolabs-ai/alignsynch/pull/426))
- `feat(shell)` — the console rail opens on Dashboard and lists My Relationships · Library ([#425](https://github.com/riolabs-ai/alignsynch/pull/425))
- `feat(v1)` — the demo seed carries two rows per catalogue type ([#421](https://github.com/riolabs-ai/alignsynch/pull/421))
- `feat(v1)` — the demo seed carries parties, chat, notices and every subscription state (#415) ([#418](https://github.com/riolabs-ai/alignsynch/pull/418))
- `feat(v1)` — template catalogue, template landing, and the relationship report (#409) ([#414](https://github.com/riolabs-ai/alignsynch/pull/414))
- `feat(assessment)` — relationship list and detail as server-rendered DB surfaces ([#412](https://github.com/riolabs-ai/alignsynch/pull/412))
- `feat(shell)` — the surface registry, PendingSurface and nav greying (#409) ([#410](https://github.com/riolabs-ai/alignsynch/pull/410))
- `feat(v1)` — the template page becomes a conversion landing (#404) ([#405](https://github.com/riolabs-ai/alignsynch/pull/405))
- `feat(v1)` — admin console — counts that open their lists, the registry, templates, seats and stated limits ([#402](https://github.com/riolabs-ai/alignsynch/pull/402))
- `feat(v1)` — print the two Opinions behind every Gap, per Aspect ([#398](https://github.com/riolabs-ai/alignsynch/pull/398))
- `feat(v1)` — acceptance first — both sides side by side, reviewable before accepting ([#400](https://github.com/riolabs-ai/alignsynch/pull/400))
- `feat(v1)` — profile and settings for all four personas (#384) ([#397](https://github.com/riolabs-ai/alignsynch/pull/397))
- `feat(v1)` — the relationships list becomes a My Quizzes variation — stage tabs, search, cards, honest metrics (#384) ([#396](https://github.com/riolabs-ai/alignsynch/pull/396))
- `feat(v1)` — template library and shop — role-gated actions, per-relationship subscription, initiator-only billing ([#393](https://github.com/riolabs-ai/alignsynch/pull/393))
- `feat(v1)` — chat and notifications — relationship threads, unread state, blind-safe before scoring ([#392](https://github.com/riolabs-ai/alignsynch/pull/392))
- `feat(v1)` — relationships list, detail, Aspects CRUD, clone, library and invite state (#384) ([#390](https://github.com/riolabs-ai/alignsynch/pull/390))
- `feat(v1)` — seed Basic and Advanced modes, Soft and Full settings, and derive flag counts (#384) ([#389](https://github.com/riolabs-ai/alignsynch/pull/389))
- `feat(v1)` — persona-scoped sidebar, dashboard overview and per-section stubs (#384) ([#388](https://github.com/riolabs-ai/alignsynch/pull/388))
- `feat(v1)` — relationship catalogue — 29 source rows + kept co-founders, grouped by realm, dating gated (#385) ([#387](https://github.com/riolabs-ai/alignsynch/pull/387))
- `feat(v1)` — review list states who each screen is for, per the #384 persona matrix ([#386](https://github.com/riolabs-ai/alignsynch/pull/386))
- `feat(db)` — seed durable platform admins from ADMIN_* env, idempotently ([#383](https://github.com/riolabs-ai/alignsynch/pull/383))
- `feat(v1)` — contain /v1 inside /v1 and add a persisted review list ([#374](https://github.com/riolabs-ai/alignsynch/pull/374))
- `feat(auth)` — grant admin at sign-in from the ADMIN_EMAILS allowlist ([#382](https://github.com/riolabs-ai/alignsynch/pull/382))
- `feat(shell)` — pin control collapses the expanded sidebar; sign-out lands on marketing ([#381](https://github.com/riolabs-ai/alignsynch/pull/381))
- `feat(v1)` — the onboarding panel becomes a stepped wizard (no assistant) ([#378](https://github.com/riolabs-ai/alignsynch/pull/378))
- `feat(v1)` — persona bar becomes a notice banner with environment context ([#377](https://github.com/riolabs-ai/alignsynch/pull/377))
- `feat(v1)` — answer sheet — inline errors, top summary, pinned submit on mobile ([#373](https://github.com/riolabs-ai/alignsynch/pull/373))
- `feat(v1)` — report verdict, relationship types + demo, and the session timeline (three sets, one branch) ([#370](https://github.com/riolabs-ai/alignsynch/pull/370))
- `feat(ui)` — a component template ancestor is a checked header, not a convention (#336) ([#345](https://github.com/riolabs-ai/alignsynch/pull/345))
- `feat(brand)` — the book is the mark, and the icon set is generated from it ([#363](https://github.com/riolabs-ai/alignsynch/pull/363))
- `feat(coach)` — a coach is a role on the relationship, with a hard read-only boundary ([#358](https://github.com/riolabs-ai/alignsynch/pull/358))
- `feat(db)` — a relationship holds sessions — the split, the backfill and the instance rename (#340) ([#352](https://github.com/riolabs-ai/alignsynch/pull/352))
- `feat(v1)` — the template editor — a variation of the quiz editor, store-backed ([#343](https://github.com/riolabs-ai/alignsynch/pull/343))
- `feat(marketing)` — the public top menu, the shell footer and header identity ([#335](https://github.com/riolabs-ai/alignsynch/pull/335))
- `feat(auth)` — name Google-only accounts on the password form (#281) ([#333](https://github.com/riolabs-ai/alignsynch/pull/333))
- `feat(auth)` — a Google button beside the password form (#281) ([#330](https://github.com/riolabs-ai/alignsynch/pull/330))
- `feat(deploy)` — codify the preview rule and add a freshness check that never guesses ([#329](https://github.com/riolabs-ai/alignsynch/pull/329))
- `feat(nav)` — the console's destinations reach the sidebar, the operator's stay behind the role ([#327](https://github.com/riolabs-ai/alignsynch/pull/327))
- `feat(console)` — /assessment/templates — built-in versus authored, per account ([#326](https://github.com/riolabs-ai/alignsynch/pull/326))
- `feat(console)` — /dashboard counts the viewer's own rows and links each number to its list ([#325](https://github.com/riolabs-ai/alignsynch/pull/325))
- `feat(console)` — the operator's relationship registry, behind the first requireAdmin surface ([#324](https://github.com/riolabs-ai/alignsynch/pull/324))
- `feat(console)` — the Gap across completed relationships, nameless and complete-only ([#323](https://github.com/riolabs-ai/alignsynch/pull/323))
- `feat(db)` — the three columns the console needs, all nullable and unfilled ([#322](https://github.com/riolabs-ai/alignsynch/pull/322))
- `feat(billing)` — the plan cards start a real checkout (#289) ([#315](https://github.com/riolabs-ai/alignsynch/pull/315))
- `feat(billing)` — the test-mode hosted adapter, its webhook, and .env.example (#289) ([#310](https://github.com/riolabs-ai/alignsynch/pull/310))
- `feat(invite)` — re-invite revokes and replaces the token, behind a 24h cooldown and a cap (#275) ([#303](https://github.com/riolabs-ai/alignsynch/pull/303))
- `feat(billing)` — a provider-free port, an offline adapter, and the plan gate ([#289](https://github.com/riolabs-ai/alignsynch/pull/289))
- `feat(legal)` — /terms and /privacy, version 1 draft, wired on both brands (#270) ([#296](https://github.com/riolabs-ai/alignsynch/pull/296))
- `feat(assessment)` — the report's three gap groups, a verdict band, and one stage sentence (#274) ([#301](https://github.com/riolabs-ai/alignsynch/pull/301))
- `feat(assessment)` — the answer input is a five-segment radio group (#273) ([#297](https://github.com/riolabs-ai/alignsynch/pull/297))
- `feat(invite)` — the initiator is told their invitation expired (#266) ([#283](https://github.com/riolabs-ai/alignsynch/pull/283))
- `feat(shell)` — show the app version, linked to its release tag (#269) ([#285](https://github.com/riolabs-ai/alignsynch/pull/285))
- `feat(assessment)` — four stages, derived — 4-6 documented as undefined (#261) ([#276](https://github.com/riolabs-ai/alignsynch/pull/276))
- `feat(assessment)` — the Soft/Full Setting is a lens over the Gaps (#259) ([#264](https://github.com/riolabs-ai/alignsynch/pull/264))
- `feat(assessment)` — the other party hears when the second answer lands (#258) ([#262](https://github.com/riolabs-ai/alignsynch/pull/262))
- `feat(invite)` — the invitation link has a copy control that never fails silently (#257) ([#260](https://github.com/riolabs-ai/alignsynch/pull/260))
- `feat(assessment)` — a person can author their own template (#255) ([#256](https://github.com/riolabs-ai/alignsynch/pull/256))
- `feat(assessment)` — the list marks an unlock you have not read (#252) ([#254](https://github.com/riolabs-ai/alignsynch/pull/254))
- `feat(brand)` — every route's share preview is the brand's own 1200x630 card (#187) ([#251](https://github.com/riolabs-ai/alignsynch/pull/251))
- `feat(assessment)` — creating or claiming an instance binds the caller's account (#213) ([#248](https://github.com/riolabs-ai/alignsynch/pull/248))
- `feat(brand)` — the palette has one home, enforced, and each brand has its own tab icon (#187) ([#246](https://github.com/riolabs-ai/alignsynch/pull/246))
- `feat(assessment)` — the report draws the glossary's eight Gap kinds (#219) ([#243](https://github.com/riolabs-ai/alignsynch/pull/243))
- `feat(assessment)` — a signed-in party can find the instances they are in (#213) ([#238](https://github.com/riolabs-ai/alignsynch/pull/238))
- `feat(brand)` — the affiliate and profile surfaces read the brand record (#187 stage 3) ([#236](https://github.com/riolabs-ai/alignsynch/pull/236))
- `feat(demo)` — /demo is a PIN gate, and /login draws the role buttons behind a signed unlock (#218) ([#235](https://github.com/riolabs-ai/alignsynch/pull/235))
- `feat(assessment)` — an instance records its mode, and asks the sheet it defines (#213) ([#234](https://github.com/riolabs-ai/alignsynch/pull/234))
- `feat(gate)` — a client component cannot reach the database, and the gate knows (#228) ([#233](https://github.com/riolabs-ai/alignsynch/pull/233))
- `feat(brand)` — the home, category and creator-tip bands read the brand record (#187 stage 2) ([#217](https://github.com/riolabs-ai/alignsynch/pull/217))
- `feat(search)` — the /search body is the brand's words, not the quiz product's (#156 follow-up) ([#201](https://github.com/riolabs-ai/alignsynch/pull/201))
- `feat(media)` — the profile cover is drawn from the handle, not one shared PNG (#130) ([#206](https://github.com/riolabs-ai/alignsynch/pull/206))
- `feat(demo-auth)` — a PIN-gated panel that signs in without sending a password (#183 part 2) ([#208](https://github.com/riolabs-ai/alignsynch/pull/208))
- `feat(shell)` — the footer speaks the brand's vocabulary, and "Quizes" is spelled right (#188) ([#195](https://github.com/riolabs-ai/alignsynch/pull/195))
- `feat(brand)` — the chrome, the assessment flow and the 404 read the brand record (#187 stage 1) ([#200](https://github.com/riolabs-ai/alignsynch/pull/200))
- `feat(demo)` — a reset that is one restore, a nightly reseed, and the docs (#185) ([#198](https://github.com/riolabs-ai/alignsynch/pull/198))
- `feat(flags)` — an admin reaches a surface the flag hides (#184) ([#199](https://github.com/riolabs-ai/alignsynch/pull/199))
- `feat(demo-auth)` — one role, a 404-not-403 gate, and three seeded demo accounts (#183 part 1) ([#189](https://github.com/riolabs-ai/alignsynch/pull/189))
- `feat(parity)` — a hash manifest and a summary instead of 1.4 MB of HTML (#171) ([#182](https://github.com/riolabs-ai/alignsynch/pull/182))
- `feat(shell)` — the rest of the chrome is the brand's, not the quiz product's (#156) ([#186](https://github.com/riolabs-ai/alignsynch/pull/186))
- `feat(media)` — one resolver, three tiers, and a fault-tolerant fallback (#155, phase 1) ([#180](https://github.com/riolabs-ai/alignsynch/pull/180))
- `feat(bundles)` — a template or a demo dataset as one versioned file, exported and imported (#147) ([#179](https://github.com/riolabs-ai/alignsynch/pull/179))
- `feat(flags)` — a surface on or off per template without a code change (#175) ([#181](https://github.com/riolabs-ai/alignsynch/pull/181))
- `feat(shell)` — navigation is brand- and capability-aware, not quiz-only (#156) ([#177](https://github.com/riolabs-ai/alignsynch/pull/177))
- `feat(registry)` — every mocked surface catalogued as a template resource (#173) ([#178](https://github.com/riolabs-ai/alignsynch/pull/178))
- `feat(assessment)` — the two-party flow — create, invite, answer blind, unlock the Gap (#146) ([#174](https://github.com/riolabs-ai/alignsynch/pull/174))
- `feat(tokens)` — tighter product surface in the Tailwind root (#160) ([#170](https://github.com/riolabs-ai/alignsynch/pull/170))
- `feat(identity)` — real sessions behind login, register, settings and profile (#164) ([#172](https://github.com/riolabs-ai/alignsynch/pull/172))
- `feat(marketing)` — a public landing page in its own chrome, no sidebar (#159) ([#169](https://github.com/riolabs-ai/alignsynch/pull/169))
- `feat(media)` — avatars are initials on a seed-derived gradient, nine duplicate files deleted (#152) ([#168](https://github.com/riolabs-ai/alignsynch/pull/168))
- `feat(db)` — six content tables, the DB-backed assessment screen, and the db scripts (#145) ([#166](https://github.com/riolabs-ai/alignsynch/pull/166))
- `feat(editorial)` — news, creator tips and support read article records (#165) ([#167](https://github.com/riolabs-ai/alignsynch/pull/167))
- `feat(theme)` — light default, AlignSynch tokens on white (#157) ([#162](https://github.com/riolabs-ai/alignsynch/pull/162))
- `feat(media)` — avatars are initials on a seed-derived gradient (#152, part 1) ([#161](https://github.com/riolabs-ai/alignsynch/pull/161))
- `feat(brand)` — the document description is a Brand field (#151) ([#153](https://github.com/riolabs-ai/alignsynch/pull/153))
- `feat(home)` — the AlignSynch build leads with the two questions (#143) ([#150](https://github.com/riolabs-ai/alignsynch/pull/150))
- `feat(brand)` — palette and mark sampled from the AlignSynch logo (#136) ([#142](https://github.com/riolabs-ai/alignsynch/pull/142))
- `feat(media)` — category tiles generated from the slug; delete the 23 duplicates (#130) ([#137](https://github.com/riolabs-ai/alignsynch/pull/137))
- `feat(assessment)` — render the answered Avery/Rowan instance at /assessment/[slug] ([#134](https://github.com/riolabs-ai/alignsynch/pull/134))
- `feat(data)` — assessment templates for three Relationship Types and four instances (#131) ([#133](https://github.com/riolabs-ai/alignsynch/pull/133))
- `feat(content)` — one record type, two templates — a quiz and an assessment (#128) ([#129](https://github.com/riolabs-ai/alignsynch/pull/129))
- `feat(brand)` — a second brand record, and one build flag that selects it ([#127](https://github.com/riolabs-ai/alignsynch/pull/127))
- `feat(brand)` — every QuizHub literal reads the brand record ([#126](https://github.com/riolabs-ai/alignsynch/pull/126))
- `feat(brand)` — data/brand.ts — the record the reskin reads ([#125](https://github.com/riolabs-ai/alignsynch/pull/125))
- `feat(tournaments)` — tournament copy comes from PageCopy, and the domain stays out (#58) ([#89](https://github.com/riolabs-ai/alignsynch/pull/89))
- `feat(pages)` — marketing copy out of JSX into PageCopy (#56) ([#94](https://github.com/riolabs-ai/alignsynch/pull/94))
- `feat(battle)` — modes and daily-challenge rewards are records, and the copy moves to PageCopy (#57) ([#92](https://github.com/riolabs-ai/alignsynch/pull/92))
- `feat(copy)` — shell, auth and 404 copy comes from PageCopy (#54) ([#96](https://github.com/riolabs-ai/alignsynch/pull/96))
- `feat(copy)` — categories and explore copy come from PageCopy fixtures (WU-8, #55) ([#88](https://github.com/riolabs-ai/alignsynch/pull/88))
- `feat(taxonomy)` — labels come from the schema, and data:check E20 enforces it (#50) ([#73](https://github.com/riolabs-ai/alignsynch/pull/73))
- `feat(leaderboard)` — one people fixture instead of six islands of their own records (#48) ([#77](https://github.com/riolabs-ai/alignsynch/pull/77))
- `feat(quiz)` — a record's detail page renders its own leaderboard and reviews (WU-2 follow-up, #75) ([#83](https://github.com/riolabs-ai/alignsynch/pull/83))
- `feat` — fixture generator (npm run gen) ([#71](https://github.com/riolabs-ai/alignsynch/pull/71))
- `feat(home)` — PageCopy fixture + E23 copy ratchet, home copy out of JSX (#53) ([#79](https://github.com/riolabs-ai/alignsynch/pull/79))
- `feat(quiz)` — the quiz surface reads the fixture, not a per-page mock (WU-2, #51) ([#76](https://github.com/riolabs-ai/alignsynch/pull/76))
- `feat` — typed media registry ([#65](https://github.com/riolabs-ai/alignsynch/pull/65))
- `feat(data)` — author the two Science overlays + E14/E15/E16/W6 promotion checks (B-01) ([#39](https://github.com/riolabs-ai/alignsynch/pull/39))
- `feat(data)` — port the 42-record migrated quiz collection into data/ (B-01 prerequisite) ([#26](https://github.com/riolabs-ai/alignsynch/pull/26))
- `feat(content)` — zQuizPromotion — per-slot campaign overlay merged in selectQuizCard (B-01) ([#21](https://github.com/riolabs-ai/alignsynch/pull/21))

### Fixed

- `fix(health)` — probes write evidence, never platform status; the recorder asserts its own postcondition (#680) ([#695](https://github.com/riolabs-ai/alignsynch/pull/695))
- `fix(ui)` — no typed Reason field on template saves — the audit sentence is generated (#625) ([#630](https://github.com/riolabs-ai/alignsynch/pull/630))
- `fix(health)` — a stale health record fails the gate instead of rendering as current (#599) ([#629](https://github.com/riolabs-ai/alignsynch/pull/629))
- `fix(flow)` — give the accept step an entry point, and a test that walks it (#617) ([#628](https://github.com/riolabs-ai/alignsynch/pull/628))
- `fix(health)` — re-record platform health from demo and move the #508 probe out of the record (#599) ([#627](https://github.com/riolabs-ai/alignsynch/pull/627))
- `fix(ui)` — no typed Reason field on template saves — the audit sentence is generated (#625) ([#626](https://github.com/riolabs-ai/alignsynch/pull/626))
- `fix(account)` — db:verify names an unfinished deletion (#278) ([#613](https://github.com/riolabs-ai/alignsynch/pull/613))
- `fix(settings)` — the delete card carries §5 verbatim, and the retention line stops denying the address (#278) ([#602](https://github.com/riolabs-ai/alignsynch/pull/602))
- `fix(deps)` — migrate recharts 2.15.3 -> 3.10.1 (13 typecheck errors -> 0; supersedes #571) ([#587](https://github.com/riolabs-ai/alignsynch/pull/587))
- `fix(account)` — a failed scrub resumes from a recorded intent (#278) ([#601](https://github.com/riolabs-ai/alignsynch/pull/601))
- `fix(deps)` — better-auth 1.7.18 (patches CVE-2026-114607) via @neon/auth 0.8.2 ([#576](https://github.com/riolabs-ai/alignsynch/pull/576))
- `fix(demo)` — a restore of a branch with children sends preserve_under_name ([#561](https://github.com/riolabs-ai/alignsynch/pull/561))
- `fix(email)` — the `### Commits` ledger is provenance, not a highlight ([#555](https://github.com/riolabs-ai/alignsynch/pull/555))
- `fix(brand)` — the lockup is 2rem in every expanded-header viewport (#549 follow-up) ([#553](https://github.com/riolabs-ai/alignsynch/pull/553))
- `fix(help)` — a sticky category rail beside the answers, and the person band beside the form ([#549](https://github.com/riolabs-ai/alignsynch/pull/549))
- `fix(brand)` — the chrome draws the full lockup again, and the auth mark is a seal (#539) ([#547](https://github.com/riolabs-ai/alignsynch/pull/547))
- `fix(db)` — serialise db:seed on the branch with an advisory lock ([#529](https://github.com/riolabs-ai/alignsynch/pull/529))
- `fix(demo)` — record the #464 dataset in the demo expectations — 33 records, 172 items ([#526](https://github.com/riolabs-ai/alignsynch/pull/526))
- `fix(demo)` — record the #464 template catalogue in demo:verify's counts ([#527](https://github.com/riolabs-ai/alignsynch/pull/527))
- `fix(admin)` — #503 a revoke is terminal — a resend refuses a withdrawn invitation ([#519](https://github.com/riolabs-ai/alignsynch/pull/519))
- `fix(assessment)` — the locked report's continue CTA opens the sheet, not the POST-only endpoint ([#488](https://github.com/riolabs-ai/alignsynch/pull/488))
- `fix(how-it-works)` — the login redirect answers with no auth environment ([#467](https://github.com/riolabs-ai/alignsynch/pull/467))
- `fix(brand)` — the chrome draws the official lockup whole, and never squashed ([#470](https://github.com/riolabs-ai/alignsynch/pull/470))
- `fix(shell)` — the rail is a drawer below 768, icons to 1023, labels from 1024 ([#465](https://github.com/riolabs-ai/alignsynch/pull/465))
- `fix(auth)` — a valid session survives a render that cannot write its cookie ([#453](https://github.com/riolabs-ai/alignsynch/pull/453))
- `fix(shell)` — the rail expands from lg, not xl — labels are back at laptop widths ([#449](https://github.com/riolabs-ai/alignsynch/pull/449))
- `fix(copy)` — the relationships list carries a label for every invite state ([#435](https://github.com/riolabs-ai/alignsynch/pull/435))
- `fix(auth)` — step 1 of sign-up collects the email only; the names move to step 2 ([#422](https://github.com/riolabs-ai/alignsynch/pull/422))
- `fix(auth)` — /login and the 404 draw the brand's marks, not the quiz product's ([#417](https://github.com/riolabs-ai/alignsynch/pull/417))
- `fix(auth)` — the sign-up screen draws the brand's marks, not the quiz product's ([#413](https://github.com/riolabs-ai/alignsynch/pull/413))
- `fix(v1)` — the acceptance status line says what the blind rule actually hides ([#403](https://github.com/riolabs-ai/alignsynch/pull/403))
- `fix(v1)` — one review control, in the footer, deep-linking to its own review row ([#399](https://github.com/riolabs-ai/alignsynch/pull/399))
- `fix(shell)` — remove the sidebar pin — the rail is always expanded ([#394](https://github.com/riolabs-ai/alignsynch/pull/394))
- `fix(auth)` — measure the flow cookie's age and the verifier's fingerprint at the finish (#351 follow-up) ([#362](https://github.com/riolabs-ai/alignsynch/pull/362))
- `fix(auth)` — capture the Google finish failure before fixing it (#351 follow-up) ([#359](https://github.com/riolabs-ai/alignsynch/pull/359))
- `fix(auth)` — exchange the Neon verifier at our own callback, so Google sign-in ends signed in (#351) ([#357](https://github.com/riolabs-ai/alignsynch/pull/357))
- `fix(404)` — render the brand's heading and drop the empty suggestion band (#351) ([#355](https://github.com/riolabs-ai/alignsynch/pull/355))
- `fix(auth)` — land the post-sign-in destination per brand (#351) ([#354](https://github.com/riolabs-ai/alignsynch/pull/354))
- `fix(auth)` — start the Google handshake on the Neon origin, not the proxy ([#350](https://github.com/riolabs-ai/alignsynch/pull/350))
- `fix(demo)` — the Admin button lands on the console, not the gate proof ([#334](https://github.com/riolabs-ai/alignsynch/pull/334))
- `fix(shell)` — the public pages stop carrying the app shell, and the sidebar is fixed (#317) ([#320](https://github.com/riolabs-ai/alignsynch/pull/320))
- `fix(release)` — cut and publish a pre-release, and order versions by semver ([#319](https://github.com/riolabs-ai/alignsynch/pull/319))
- `fix(support)` — the FAQ answers in each product's words, not the quiz product's ([#321](https://github.com/riolabs-ai/alignsynch/pull/321))
- `fix(support)` — one category taxonomy per product, and the select reads it (#309) ([#316](https://github.com/riolabs-ai/alignsynch/pull/316))
- `fix(shell)` — the four surfaces that advertise /affiliate follow the flag (#291 follow-up) ([#313](https://github.com/riolabs-ai/alignsynch/pull/313))
- `fix(news)` — the accessibility article stops selling a tab and three features, and the creator profile gets a subject that exists ([#314](https://github.com/riolabs-ai/alignsynch/pull/314))
- `fix(support)` — the help centre is per product and documents only what ships (#309) ([#312](https://github.com/riolabs-ai/alignsynch/pull/312))
- `fix(brand)` — gate the quiz product's routes off the alignsynch build (#300) ([#306](https://github.com/riolabs-ai/alignsynch/pull/306))
- `fix(news)` — the championship stops selling a tab and a plan, the monetization article drops invented creators ([#311](https://github.com/riolabs-ai/alignsynch/pull/311))
- `fix(news)` — the analytics article stops selling a plan tier and a tab that do not exist ([#308](https://github.com/riolabs-ai/alignsynch/pull/308))
- `fix(copy)` — sign-up asks nothing about quizzes, the 404 states a true fact, /affiliate is gated (#291) ([#307](https://github.com/riolabs-ai/alignsynch/pull/307))
- `fix(news)` — the AI quiz-creation article stops selling a suite we do not ship ([#304](https://github.com/riolabs-ai/alignsynch/pull/304))
- `fix(support)` — the contact form is disconnected, and says so (#290) ([#302](https://github.com/riolabs-ai/alignsynch/pull/302))
- `fix(support)` — the FAQ answers what the app does, not a business it never ran (#288) ([#295](https://github.com/riolabs-ai/alignsynch/pull/295))
- `fix(pricing)` — intended rates, real CTAs, and no trial the build cannot honour (#289) ([#299](https://github.com/riolabs-ai/alignsynch/pull/299))
- `fix(shell)` — the footer, the rail and the login card stop drawing links that go nowhere (#272) ([#298](https://github.com/riolabs-ai/alignsynch/pull/298))
- `fix(create)` — the generator builds a draft from templates, and stops claiming a model (#287) ([#294](https://github.com/riolabs-ai/alignsynch/pull/294))
- `fix(pricing)` — the FAQ answers only what the build can do (#286) ([#292](https://github.com/riolabs-ai/alignsynch/pull/292))
- `fix(assessment)` — Aligned is stage 4 — two ladders, not a missing row (#261) ([#284](https://github.com/riolabs-ai/alignsynch/pull/284))
- `fix(pricing)` — the security answer states what the app does, not what it never did (#271) ([#282](https://github.com/riolabs-ai/alignsynch/pull/282))
- `fix(copy)` — the marketing page stops denying the database (#265) ([#279](https://github.com/riolabs-ai/alignsynch/pull/279))
- `fix(invite)` — a refused email is not a missing key (#220) ([#253](https://github.com/riolabs-ai/alignsynch/pull/253))
- `fix(shell)` — the sidebar context has one specifier, not two (#242) ([#247](https://github.com/riolabs-ai/alignsynch/pull/247))
- `fix(copy)` — the footer and the meta description stop selling the Gap (#239) ([#241](https://github.com/riolabs-ai/alignsynch/pull/241))
- `fix(brand)` — the preview dialog's primary button reads the action token ([#240](https://github.com/riolabs-ai/alignsynch/pull/240))
- `fix(copy)` — the login hero ends at the Gap, not on its own slogan (#232) ([#237](https://github.com/riolabs-ai/alignsynch/pull/237))
- `fix(auth)` — the sign-in screen speaks its own brand, and the fake player count goes (#225) ([#231](https://github.com/riolabs-ai/alignsynch/pull/231))
- `fix(identity)` — "My Profile" opens the session's own handle, not a fixture (#226) ([#230](https://github.com/riolabs-ai/alignsynch/pull/230))
- `fix(demo)` — a refused sign-in says what happened, not "wrong PIN" (#216) ([#224](https://github.com/riolabs-ai/alignsynch/pull/224))
- `fix(shell)` — the signed-in avatar is the session's person, not a fixture (#212) ([#221](https://github.com/riolabs-ai/alignsynch/pull/221))
- `fix(demo)` — the reset names its source, and a source must be able to seed (#185) ([#223](https://github.com/riolabs-ai/alignsynch/pull/223))
- `fix(invite)` — a claim binds one party and never reassigns a session (#202) ([#211](https://github.com/riolabs-ai/alignsynch/pull/211))
- `fix(flags)` — the shell stops advertising a surface the flag hides (#175 follow-up) ([#209](https://github.com/riolabs-ai/alignsynch/pull/209))
- `fix(auth)` — an origin rejection says so, and a dev branch trusts 127.0.0.1 (#203) ([#207](https://github.com/riolabs-ai/alignsynch/pull/207))
- `fix(demo)` — the reset source is a schema-only base, never production (#185) ([#210](https://github.com/riolabs-ai/alignsynch/pull/210))
- `fix(demo)` — the demo holds the bundle and nothing else (#185, follow-up) ([#205](https://github.com/riolabs-ai/alignsynch/pull/205))
- `fix(release)` — the entry parser stops at the link footer, and the check stops racing SIGPIPE ([#144](https://github.com/riolabs-ai/alignsynch/pull/144))
- `fix(play)` — /quiz/<id>/play plays the quiz the URL names (#132) ([#135](https://github.com/riolabs-ai/alignsynch/pull/135))
- `fix(data)` — published quizzes carry questions, a date and a reward window ([#124](https://github.com/riolabs-ai/alignsynch/pull/124))
- `fix(profile)` — /profile/<username> resolves the handle from data/players.ts (#111) ([#123](https://github.com/riolabs-ai/alignsynch/pull/123))
- `fix(copy)` — QuizHub everywhere the copy renders, and no stray space after it ([#122](https://github.com/riolabs-ai/alignsynch/pull/122))
- `fix(routes)` — unknown ids 404 on /categories, /news and /tournaments (#112) ([#116](https://github.com/riolabs-ai/alignsynch/pull/116))
- `fix(promotions)` — anchor the campaign window to the fixture clock (#110) ([#121](https://github.com/riolabs-ai/alignsynch/pull/121))
- `fix(metadata)` — real document title on every route (#113) ([#115](https://github.com/riolabs-ai/alignsynch/pull/115))
- `fix(shell)` — mobile sidebar is CSS-closed below xl, drawer is its own state (#109) ([#119](https://github.com/riolabs-ai/alignsynch/pull/119))
- `fix(ci)` — fetch origin/main so the lane classifier actually runs in CI ([#114](https://github.com/riolabs-ai/alignsynch/pull/114))
- `fix(data-check)` — one code, one rule — E17 is the media registry, the slot guard is E28 (#103) ([#105](https://github.com/riolabs-ai/alignsynch/pull/105))
- `fix(images)` — the five next/image size bugs, and a gate for the rule ([#99](https://github.com/riolabs-ai/alignsynch/pull/99))
- `fix(p3)` — gen emits quizzes only, and data:check says why (E17/E26) ([#100](https://github.com/riolabs-ai/alignsynch/pull/100))
- `fix(chat)` — format fixture times against one clock, not the wall clock ([#23](https://github.com/riolabs-ai/alignsynch/pull/23))
- `fix(content)` — point the 11 baselined asset refs at files that exist ([#28](https://github.com/riolabs-ai/alignsynch/pull/28))
- `fix(qa)` — the pre-existing 404s and the Next 16 sync params (closes #20) ([#25](https://github.com/riolabs-ai/alignsynch/pull/25))
- `fix(seo)` — generate real metadata for /categories/[slug] (D14) ([#17](https://github.com/riolabs-ai/alignsynch/pull/17))

### Maintenance

- `docs(releasing)` — the eight-step run order, at the top of the page (#684) ([#693](https://github.com/riolabs-ai/alignsynch/pull/693))
- `docs(agents)` — prove the tree before the first edit — the detached-HEAD trap ([#686](https://github.com/riolabs-ai/alignsynch/pull/686))
- `chore(ci)` — one Node runtime — 24 in .nvmrc, engines and the Vercel project (#682) ([#685](https://github.com/riolabs-ai/alignsynch/pull/685))
- `docs(pay)` — a payer mockup with a source on every string (#659) ([#675](https://github.com/riolabs-ai/alignsynch/pull/675))
- `chore(deploy)` — a preview on demand, with the toolbar already on it ([#671](https://github.com/riolabs-ai/alignsynch/pull/671))
- `docs(pay)` — record that the payer-present state has no copy, and map what does (#659) ([#674](https://github.com/riolabs-ai/alignsynch/pull/674))
- `docs(pay)` — a verbatim payer copy inventory, with the gaps the mockup still asks for ([#672](https://github.com/riolabs-ai/alignsynch/pull/672))
- `docs(agents)` — point AGENTS.md at the docs hub and correct the gate's step order (#651) ([#668](https://github.com/riolabs-ai/alignsynch/pull/668))
- `docs(hub)` — one index, a generated nav on every page, and a docs:check gate step (#666) ([#666](https://github.com/riolabs-ai/alignsynch/pull/666))
- `docs(specs)` — the reference UX pattern spec, measured from the nine screens ([#663](https://github.com/riolabs-ai/alignsynch/pull/663))
- `docs(changelog)` — the release blog, a view of CHANGELOG.md (#652) ([#662](https://github.com/riolabs-ai/alignsynch/pull/662))
- `docs(readme)` — the root README as a feature showcase (#650) ([#661](https://github.com/riolabs-ai/alignsynch/pull/661))
- `docs(diagrams)` — one home for the flow charts — lifecycle, payment, brand boundary, data, gate (#654) ([#660](https://github.com/riolabs-ai/alignsynch/pull/660))
- `docs(assets)` — a current screenshot set, a registry that says which is current, and the new OG card (#649) ([#658](https://github.com/riolabs-ai/alignsynch/pull/658))
- `docs(wiki)` — the code wiki in docs/wiki (#653) ([#656](https://github.com/riolabs-ai/alignsynch/pull/656))
- `docs(changelog)` — v1.6.0's reminders do not send in that tag (#638) ([#648](https://github.com/riolabs-ai/alignsynch/pull/648))
- Revert "feat(P1): the payment door — capture a method, complete, open the Gap (#643) (#644)" ([#647](https://github.com/riolabs-ai/alignsynch/pull/647))
- `test(#623)` — render the edit panel — the surface itself was the one untested half ([#646](https://github.com/riolabs-ai/alignsynch/pull/646))
- v1.7.0 · #623 full CRUD for a relationship — every field editable, the invalidation stated before saving ([#642](https://github.com/riolabs-ai/alignsynch/pull/642))
- `docs(changelog)` — name #636 in the 1.6.0 entry ([#639](https://github.com/riolabs-ai/alignsynch/pull/639))
- `docs(pay-to-complete)` — the SPEC's row 0 requires the seal, and the job that does it has landed ([#636](https://github.com/riolabs-ai/alignsynch/pull/636))
- `docs(pay-to-complete)` — research, PRD, spec and ADR for v1.6.0 (#619, #623) ([#635](https://github.com/riolabs-ai/alignsynch/pull/635))
- `docs(qa)` — the assessment flow walked end to end on demo — first breakpoint is the accept step ([#622](https://github.com/riolabs-ai/alignsynch/pull/622))
- `chore(security)` — lift the form guard into lib/forms/ and guard the news signup + auth proxy (#615) ([#616](https://github.com/riolabs-ai/alignsynch/pull/616))
- `chore(deps)` — remove the unused DatePicker wrapper and react-day-picker ([#593](https://github.com/riolabs-ai/alignsynch/pull/593))
- `chore(deps)` — react 19.3.1 + radix slot 1.5.0, dialog/popover 1.3.1 — one cohort (#592) ([#592](https://github.com/riolabs-ai/alignsynch/pull/592))
- `chore(deps)` — bump mdast-util-to-hast from 13.2.0 to 13.2.1 ([#600](https://github.com/riolabs-ai/alignsynch/pull/600))
- `chore(ci)` — bump actions/upload-artifact from 4 to 7 ([#569](https://github.com/riolabs-ai/alignsynch/pull/569))
- `chore(deps)` — bump yaml from 2.7.1 to 2.9.1 ([#589](https://github.com/riolabs-ai/alignsynch/pull/589))
- `chore(deps)` — bump postcss from 8.5.3 to 8.5.23 ([#585](https://github.com/riolabs-ai/alignsynch/pull/585))
- `chore(deps)` — bump picomatch from 2.3.1 to 2.3.2 ([#588](https://github.com/riolabs-ai/alignsynch/pull/588))
- `chore(deps)` — bump lodash from 4.17.21 to 4.18.1 ([#590](https://github.com/riolabs-ai/alignsynch/pull/590))
- `chore(deps)` — bump browserslist from 4.24.5 to 4.29.5 ([#584](https://github.com/riolabs-ai/alignsynch/pull/584))
- `chore(deps)` — swiper 11.2.7 -> 12.2.0, clearing two critical advisories ([#595](https://github.com/riolabs-ai/alignsynch/pull/595))
- `chore(ci)` — dependabot — weekly, 3 at a time, majors only ([#591](https://github.com/riolabs-ai/alignsynch/pull/591))
- `chore(deps)` — clear 7 Dependabot alerts — combined nanoid/source-map-js/baseline-browser-mapping + sucrase 3.35.1 (drops glob and minimatch) ([#586](https://github.com/riolabs-ai/alignsynch/pull/586))
- `chore(deps)` — migrate content/ to zod 4 and bump zod to ^4.6.6 ([#578](https://github.com/riolabs-ai/alignsynch/pull/578))
- `chore(deps)` — bump @hookform/resolvers from 5.0.1 to 5.4.0 ([#574](https://github.com/riolabs-ai/alignsynch/pull/574))
- `chore(deps)` — bump glob 10.5.0, minimatch 9.0.9, postcss-selector-parser 6.1.5 ([#583](https://github.com/riolabs-ai/alignsynch/pull/583))
- `chore(deps)` — bump next from 16.1.6 to 16.4.1 ([#563](https://github.com/riolabs-ai/alignsynch/pull/563))
- `chore(ci)` — dependabot.yml and CODEOWNERS for the security surfaces (#441) ([#567](https://github.com/riolabs-ai/alignsynch/pull/567))
- `docs(ops)` — the twelve non-main branches, triaged by what proves each removal safe ([#560](https://github.com/riolabs-ai/alignsynch/pull/560))
- `docs(agents)` — ## Numbers points at docs/GATE.md instead of copying the figures ([#559](https://github.com/riolabs-ai/alignsynch/pull/559))
- `docs(gate)` — re-measure the baseline over 2026-11-04 — 156 s a run, 176 s to the last job ([#557](https://github.com/riolabs-ai/alignsynch/pull/557))
- feat(email) — the release note: one band, plain text first, sent once per tag (#548) ([#551](https://github.com/riolabs-ai/alignsynch/pull/551))
- feat(dashboard) — support, help and the library live in the console (#542) ([#546](https://github.com/riolabs-ai/alignsynch/pull/546))
- `polish(v1.x)` — the ten owner UI items — icon size, auth gap, Gap scale, tokens, footer band, one measure, rails (#539) ([#543](https://github.com/riolabs-ai/alignsynch/pull/543))
- `copy(home)` — the register pass — title, practice band and boundary body ([#545](https://github.com/riolabs-ai/alignsynch/pull/545))
- `copy(home)` — the hero pitches a leader's outcome, not a practitioner's practice ([#541](https://github.com/riolabs-ai/alignsynch/pull/541))
- `ux(rules)` — a link out of the dashboard opens a new tab; a form surface carries no shadow ([#540](https://github.com/riolabs-ai/alignsynch/pull/540))
- `chore(ops)` — version env-sync with the policy lists, --confirm-production and --diff ([#536](https://github.com/riolabs-ai/alignsynch/pull/536))
- `test(admin)` — #503 the five repairs, their rung and the rollback ([#521](https://github.com/riolabs-ai/alignsynch/pull/521))
- `docs(brand)` — the icon docs name the transparent ground, and parity only moves on a path ([#514](https://github.com/riolabs-ai/alignsynch/pull/514))
- `test(admin)` — #503 the void and force-close screens, read as markup ([#518](https://github.com/riolabs-ai/alignsynch/pull/518))
- `brand` — the icon set is the AS mark on transparency, and E38 fails when it is not ([#510](https://github.com/riolabs-ai/alignsynch/pull/510))
- `docs(release)` — a seeded instance reading `answering` is stamped, never reseeded ([#498](https://github.com/riolabs-ai/alignsynch/pull/498))
- `docs(db-verify)` — V11's comment says why a legitimate mark can still go stale ([#497](https://github.com/riolabs-ai/alignsynch/pull/497))
- `docs(release)` — a V11 is repaired by clearing the mark, and a rule change is what creates one ([#495](https://github.com/riolabs-ai/alignsynch/pull/495))
- `refactor(v1)` — delete the 95-row customer half of /v1, and prove /v1 404s (#478) ([#491](https://github.com/riolabs-ai/alignsynch/pull/491))
- `docs(registry)` — the answer sheet's inbound paths name the report's CTA too ([#490](https://github.com/riolabs-ai/alignsynch/pull/490))
- `docs(release)` — the v1.3.0 Known limit said the answer sheet had no link — it has one ([#487](https://github.com/riolabs-ai/alignsynch/pull/487))
- fix(shell) — the surface registry calls create and answer live, because they are ([#485](https://github.com/riolabs-ai/alignsynch/pull/485))
- `docs(v1)` — disposition all 118 /v1 items into docs/V1-RETIREMENT.md (#478) ([#484](https://github.com/riolabs-ai/alignsynch/pull/484))
- `docs(release)` — a merge deploys production, measured during the v1.3.0 cut ([#483](https://github.com/riolabs-ai/alignsynch/pull/483))
- `docs(gate)` — the 2026-10-29 → 2026-11-03 comparison states the per-step numbers, not a ratio ([#482](https://github.com/riolabs-ai/alignsynch/pull/482))
- `docs(gate)` — a measured baseline — 97.4 % yield / 144 s on 2026-11-02, and how to re-derive it ([#480](https://github.com/riolabs-ai/alignsynch/pull/480))
- `perf(db)` — pin TLS, timeouts and pool bounds; make a cold start visible (#440) ([#479](https://github.com/riolabs-ai/alignsynch/pull/479))
- `docs(readme)` — the share card leads, the pricing capture stays for the UI docs ([#477](https://github.com/riolabs-ai/alignsynch/pull/477))
- `docs(auth)` — the gated console routes say why no auth env is a 500, by design ([#475](https://github.com/riolabs-ai/alignsynch/pull/475))
- Home polish · the six defects the hero screenshot review found (copy and spacing) ([#471](https://github.com/riolabs-ai/alignsynch/pull/471))
- Share card · ship the owner's supplied PNG byte-identical, retire the drawn card ([#472](https://github.com/riolabs-ai/alignsynch/pull/472))
- `docs(templates)` — re-capture the catalogue on the rail v4 shell — and prove the v2 branch deletes no sibling ([#473](https://github.com/riolabs-ai/alignsynch/pull/473))
- `test(brand)` — E37 — the AlignSynch brand never names the template, with a guard that proves it can fail ([#466](https://github.com/riolabs-ai/alignsynch/pull/466))
- Share card · the brand's own lockup, one sentence, the Gap drawn ([#469](https://github.com/riolabs-ai/alignsynch/pull/469))
- `docs(readme)` — open on the pricing page, retire the stale captures, keep five flows ([#468](https://github.com/riolabs-ai/alignsynch/pull/468))
- Home v2 · the AlignSynch practice page, finished, gated and screenshotted ([#463](https://github.com/riolabs-ai/alignsynch/pull/463))
- `docs(readme)` — say what AlignSynch is, and show the six finished screens ([#462](https://github.com/riolabs-ai/alignsynch/pull/462))
- `chore(dx)` — pnpm check:fast — a fast inner loop, and the cohort rhythm written down ([#450](https://github.com/riolabs-ai/alignsynch/pull/450))
- Pricing · readable CTA, centred signup band, Title Case chrome ([#451](https://github.com/riolabs-ai/alignsynch/pull/451))
- Footer · the news signup on every marketing page (Neon stores, Resend sends) + the brand-immutability guard ([#446](https://github.com/riolabs-ai/alignsynch/pull/446))
- copy · relationships, not assessments — and the auth surfaces get the brand, a way home, and a password meter ([#436](https://github.com/riolabs-ai/alignsynch/pull/436))
- `chore(gitignore)` — never commit a .hermes/ directory that lands in a workspace ([#432](https://github.com/riolabs-ai/alignsynch/pull/432))
- R1-E: create, answer and accept as in-progress UI (#409) ([#416](https://github.com/riolabs-ai/alignsynch/pull/416))
- DRAFT — V1 create entry, metadata CRUD by Setting, and the Steps primitive (one per Aspect, rewordable, closed status) — for discussion, do not merge ([#406](https://github.com/riolabs-ai/alignsynch/pull/406))
- `test(v1)` — a deterministic demo seeder over every catalogue type, and the test factories that pin the shape ([#407](https://github.com/riolabs-ai/alignsynch/pull/407))
- `auth` — password reset, and a set-password path for Google-only accounts ([#395](https://github.com/riolabs-ai/alignsynch/pull/395))
- `docs` — the UI/UX audit — every surface scored against its template ancestor ([#364](https://github.com/riolabs-ai/alignsynch/pull/364))
- `docs(deploying)` — §1 quotes the widened ignoreCommand and names its one exception ([#361](https://github.com/riolabs-ai/alignsynch/pull/361))
- `chore(deploy)` — one branch builds besides production, and it is named in the file ([#360](https://github.com/riolabs-ai/alignsynch/pull/360))
- `docs(deploy)` — §1 states the production-only rule, not the [preview] opt-in ([#353](https://github.com/riolabs-ai/alignsynch/pull/353))
- `deploy(vercel)` — build production only — previews are local ([#348](https://github.com/riolabs-ai/alignsynch/pull/348))
- `refactor(css)` — one token layer — the second stylesheet's chart and sidebar sets fold into app/globals.css ([#347](https://github.com/riolabs-ai/alignsynch/pull/347))
- `refactor(marketing)` — the landing page's eleven boxes, two CTAs and three chips ([#346](https://github.com/riolabs-ai/alignsynch/pull/346))
- `refactor(console)` — the gap table, the failure panels and the title bands compose the primitives ([#344](https://github.com/riolabs-ai/alignsynch/pull/344))
- `docs(prototype)` — correct the one claim in the wiring plan the board does not support ([#342](https://github.com/riolabs-ai/alignsynch/pull/342))
- `docs(prototype)` — the wiring plan — one screen exists, four cohorts never did ([#341](https://github.com/riolabs-ai/alignsynch/pull/341))
- `docs(quiz)` — the capability map — every quiz surface, what it is made of, what full-stack costs ([#338](https://github.com/riolabs-ai/alignsynch/pull/338))
- `docs(ui)` — the quiz-surface map — every ancestor, its AlignSynch variation, and the mobile mechanics ([#337](https://github.com/riolabs-ai/alignsynch/pull/337))
- `docs(ui)` — the divergence table — every bespoke surface, one verdict per file ([#332](https://github.com/riolabs-ai/alignsynch/pull/332))
- `docs(deploy)` — record that preview creation, not just the build, is disabled upstream ([#331](https://github.com/riolabs-ai/alignsynch/pull/331))
- `docs` — codify the template doctrine — one core, many expressions ([#318](https://github.com/riolabs-ai/alignsynch/pull/318))
- `docs` — account-deletion spec — a shared record when one side leaves (#278) ([#293](https://github.com/riolabs-ai/alignsynch/pull/293))
- `docs` — seven research specs, and SPEC-DRIFT corrected on review ([#277](https://github.com/riolabs-ai/alignsynch/pull/277))
- `docs` — SPEC-DRIFT, the specification against the build, tiered ([#268](https://github.com/riolabs-ai/alignsynch/pull/268))
- `docs` — the specification's mockups, with an index that says what is worth borrowing ([#267](https://github.com/riolabs-ai/alignsynch/pull/267))
- `refactor(lexicon)` — components/ and app/ name the record, not the quiz (#188) ([#249](https://github.com/riolabs-ai/alignsynch/pull/249))
- `docs(readme)` — the README opens with the product itself (#197) ([#250](https://github.com/riolabs-ai/alignsynch/pull/250))
- `docs(readme)` — the opener states the idea without the kicker (#244) ([#245](https://github.com/riolabs-ai/alignsynch/pull/245))
- `copy(alignsynch)` — a template nobody answered stops promising a copy button ([#229](https://github.com/riolabs-ai/alignsynch/pull/229))
- `perf(assessment)` — one round trip per render, and an honest screen when the database does not answer (#204) ([#227](https://github.com/riolabs-ai/alignsynch/pull/227))
- `copy(alignsynch)` — the home page reads as prose, not a spec ([#222](https://github.com/riolabs-ai/alignsynch/pull/222))
- `docs(readme)` — a demo reset replaces the branch, trusted domains included (#214) ([#215](https://github.com/riolabs-ai/alignsynch/pull/215))
- `refactor(lexicon)` — the platform's own words, not the template's (#188) ([#194](https://github.com/riolabs-ai/alignsynch/pull/194))
- `docs(readme)` — describe the product, not the arrangement (#193) ([#196](https://github.com/riolabs-ai/alignsynch/pull/196))
- `docs(readme)` — rewrite as the AlignSynch whitelabel template (#190) ([#192](https://github.com/riolabs-ai/alignsynch/pull/192))
- `docs` — add the AlignSynch glossary v2 as a reference PDF ([#149](https://github.com/riolabs-ai/alignsynch/pull/149))
- `docs(glossary)` — the glossary page is generated from the schema comments (#138) ([#141](https://github.com/riolabs-ai/alignsynch/pull/141))
- `chore(issues)` — three issue templates — feature, bug, new template type (#139) ([#140](https://github.com/riolabs-ai/alignsynch/pull/140))
- `docs(lanes)` — CI's win is the check's wall time, not contention ([#120](https://github.com/riolabs-ai/alignsynch/pull/120))
- `docs(gate)` — CI classifies now — record the measured lanes ([#118](https://github.com/riolabs-ai/alignsynch/pull/118))
- `docs(qa)` — P4 dogfood pass — every route, defects 1-5 with evidence ([#108](https://github.com/riolabs-ai/alignsynch/pull/108))
- `docs(p3)` — exit record with reproducible evidence ([#107](https://github.com/riolabs-ai/alignsynch/pull/107))
- `docs(data-model)` — tournaments are PageCopy-only and out of scope (#58) ([#106](https://github.com/riolabs-ai/alignsynch/pull/106))
- `test(vitest)` — adopt Vitest and the first app-side units, wired into the one gate (#8) ([#98](https://github.com/riolabs-ai/alignsynch/pull/98))
- `docs(p1)` — refresh ENV-SPEC §5 evidence and record what B-01 actually landed (#43) ([#97](https://github.com/riolabs-ai/alignsynch/pull/97))
- `docs(p2)` — the inventory says WU-7, WU-8 and WU-9 landed (#54/#55/#56) ([#102](https://github.com/riolabs-ai/alignsynch/pull/102))
- `docs(p2)` — the inventory says WU-10 landed, not that it is next (#57) ([#101](https://github.com/riolabs-ai/alignsynch/pull/101))
- `chore(git)` — ignore .worktrees/ ([#93](https://github.com/riolabs-ai/alignsynch/pull/93))
- `docs(readme)` — setup, prerequisites, the gate, the four layers and current phase (#7) ([#95](https://github.com/riolabs-ai/alignsynch/pull/95))
- `docs(p1)` — keep images.unoptimized and record why (#6) ([#91](https://github.com/riolabs-ai/alignsynch/pull/91))
- `docs` — lib/quizhub is vendored and ignored, not generated ([#90](https://github.com/riolabs-ai/alignsynch/pull/90))
- `build(pnpm)` — pin the package manager to 12.16.1 in package.json (#4) ([#87](https://github.com/riolabs-ai/alignsynch/pull/87))
- `docs(orchestration)` — the orchestrator's behavioural contract ([#86](https://github.com/riolabs-ai/alignsynch/pull/86))
- `docs(p2)` — the ranked list records WU-1, WU-2 and WU-4 as landed ([#85](https://github.com/riolabs-ai/alignsynch/pull/85))
- `docs(p2)` — record WU-5 as landed and E20's DUP tier at 0 ([#84](https://github.com/riolabs-ai/alignsynch/pull/84))
- `ci(gate)` — lanes — depth follows the diff, next build capped at 2 slots ([#82](https://github.com/riolabs-ai/alignsynch/pull/82))
- P2 WU-4 · invented metrics → computed analytics (#49) ([#80](https://github.com/riolabs-ai/alignsynch/pull/80))
- `refactor(search)` — derive the search index, bind chat to its fixture (WU-3, #52) ([#72](https://github.com/riolabs-ai/alignsynch/pull/72))
- `docs(p2)` — record WU-12's deletion in the inventory, not its dead paths ([#74](https://github.com/riolabs-ai/alignsynch/pull/74))
- `docs(agents)` — rejoin the CI sentence the #33 resolution split ([#69](https://github.com/riolabs-ai/alignsynch/pull/69))
- P3: pass the slot campaign into the card projections (shelves + detail-page prize) ([#41](https://github.com/riolabs-ai/alignsynch/pull/41))
- `chore(components)` — delete 14 components no route imports (#47) ([#66](https://github.com/riolabs-ai/alignsynch/pull/66))
- `ci` — one gate script, one caller in CI, one pre-push hook (ORD 0) ([#33](https://github.com/riolabs-ai/alignsynch/pull/33))
- `docs` — P2 literal-string and media inventory ([#59](https://github.com/riolabs-ai/alignsynch/pull/59))
- `docs(mimo)` — MiMo harness guide + reproducible probe suite ([#38](https://github.com/riolabs-ai/alignsynch/pull/38))
- `ci` — trigger on merge_group so the merge queue can report the required check ([#44](https://github.com/riolabs-ai/alignsynch/pull/44))
- `docs` — data model design page (ORD 2) ([#45](https://github.com/riolabs-ai/alignsynch/pull/45))
- `chore(deps)` — pin the 13 "latest" specs to their locked versions ([#14](https://github.com/riolabs-ai/alignsynch/pull/14))
- `docs(ops)` — voice memo → issue → card loop, and where Xiaomi stops (#32) ([#34](https://github.com/riolabs-ai/alignsynch/pull/34))
- `docs(p1)` — record the promotion rules, the W4 code collision and the shelf gap (B-01) ([#40](https://github.com/riolabs-ai/alignsynch/pull/40))
- P1: render every card grid from the quiz model (D2 remainder) ([#24](https://github.com/riolabs-ai/alignsynch/pull/24))
- `docs` — verify the command table, record P1 gates, fix the dev-only image crash ([#18](https://github.com/riolabs-ai/alignsynch/pull/18))
- `ci` — enforce data:check in the gate ([#36](https://github.com/riolabs-ai/alignsynch/pull/36))
- P1: zod content model as the single source of truth (closes #10) ([#16](https://github.com/riolabs-ai/alignsynch/pull/16))
- `chore(format)` — gate formatting in lint and CI
- `style` — reformat the repo at lineWidth 100 with Biome
- Toolchain: Biome + typecheck + CI (closes #2, #3) ([#12](https://github.com/riolabs-ai/alignsynch/pull/12))
- Initial commit

### Known limits

- **No member can pay yet.** The payment door landed in this range (`feat(P1)`, #644) and was reverted (#647): nothing in `components/` calls `capturePaymentMethodAction` or `completeRelationshipAction`, and the relationship card's `Activate Relationship` and `Gap Analysis` still render disabled (`components/dashboard/relationship-cards.tsx`). The payment engine and reminder delivery from v1.6.0 are present, but no path requests a charge, so nothing charges.
- **The onboarding flow is a shell, not a walk.** #687 ships `StageRail` and `StageColumn` — the six stage names and the left column they sit in; #688 ships stages 1–2 (Who + Mode) and #689 ships stage 3 (Aspects). The remaining stages (Create+gate #690, Sent #691, Ongoing #692, and the Aspect add/remove follow-up #699) are still open. The "six-stage prototype" is a review artifact (v5) rendered on `/admin/review`, not a live member flow a visitor can walk end to end.
- **`/admin/review` is an admin console, not a member surface.** The shelf answers `requireAdmin()` and `requireAdminProduct()` before any read: a signed-out visitor is sent to `/login` and a member gets the same 404 an unknown URL gets. It renders for the admin seat only.
- **Two billing shapes are still alive.** Publishing a relationship still starts a 14-day trial or opens a checkout (`lib/member/publish-basis.ts`, unchanged), and completion also creates a `relationship_payment` obligation. ADR-1's rule — remove the creation-time trigger in the same change that adds the completion charge — has still not been carried out. Do not enable the payment door before it resolves.
- **A relationship can now be edited, except the two scored columns.** #623 ships the edit panel (`components/relationship/relationship-edit-panel.tsx`): title, summary, the Aspects, the template version and the unclaimed invite. `mode` and `alignment_setting` are session columns a scored row may not be rewritten (`db:verify` V18), so the panel prints them as locked and they move to publish. `completed_at`, `void_reason`, `expired_at` and `lapse_reason` are still written only by the jobs that end a relationship, never by the editor.
- **The billing provider is still the mock adapter.** `BILLING_PROVIDER` unset means `mock` (the keyless demo path), so this release claims no live charging and moves no money.

## [1.6.0] - 2026-11-07

### Added

- `feat(billing)` — pay-to-complete — the fee moves from creation to completion (#619) ([#634](https://github.com/riolabs-ai/alignsynch/pull/634))
- `feat(ui)` — two-row member menu, two-tab Templates shelf, relationship cards (#620) ([#633](https://github.com/riolabs-ai/alignsynch/pull/633))
- `feat(flow)` — the create journey keeps its product across auth and stops dead-ending at the library (#618) ([#632](https://github.com/riolabs-ai/alignsynch/pull/632))

### Maintenance

- `docs(pay-to-complete)` — research, PRD, spec and ADR for v1.6.0 (#619, #623) ([#635](https://github.com/riolabs-ai/alignsynch/pull/635))
- `docs(pay-to-complete)` — the SPEC's row 0 requires the seal, and the job that does it has landed ([#636](https://github.com/riolabs-ai/alignsynch/pull/636))
- `docs(changelog)` — name #636 in the 1.6.0 entry ([#639](https://github.com/riolabs-ai/alignsynch/pull/639))

### Known limits

- **No member can pay yet.** The payment engine is complete and covered by a live suite, but nothing in `components/` calls `capturePaymentMethodAction` or `completeRelationshipAction`, and the relationship card's `Activate Relationship` and `Gap Analysis` still render **disabled**. Nothing can request a charge, so nothing charges. The door is tracked as the next card.
- **Two billing shapes are alive at once.** Publishing a relationship _still_ starts a 14-day trial or opens a checkout (`lib/member/publish-basis.ts`, unchanged in this release), and completion now _also_ creates a `relationship_payment` obligation. ADR-1's rule — remove the creation-time trigger in the same change that adds the completion charge — has **not** been carried out. A relationship whose creation checkout completed can therefore be billed twice: once at creation, once at completion. Do not enable the payment door before this is resolved.
- **The provider is the mock adapter.** `BILLING_PROVIDER` unset means `mock`, the keyless demo path. The `stripe` adapter is carried but never resolved unless the variable names it, so this release claims no live charging and moves no money.
- **A relationship still cannot be edited.** #623 ships separately: there is no edit surface, and five `relationship` columns (`template_version_id`, `completed_at`, `void_reason`, `expired_at`, `lapse_reason`) have no writer at all.
- **The Free plan's consequence is unconfirmed.** Payment is required to complete a session, so a Free member with "one active relationship" cannot reach a Gap report unless the trial carries them. The rule is stated in #619; the product decision is not final.
- **A charge that needs the payer present has no path.** An unattended charge can be declined for reasons a retry cannot fix (expired card, and any payer-approved challenge). The ladder retries three times across a week and then expires with notice; there is no "come back and confirm" link.
- **The reminders in this tag do not send.** `v1.6.0` was cut at `034878a3`, and reminder delivery landed immediately after in #638 (#640): the tag's cron computes the day-3 and day-10 nags and the day-14 expiry, records `pending-delivery`, and sends nothing, because `notify` was still an optional seam with no caller. Production runs current `main`, which wires `paymentNotice()` and does send — a send that cannot happen leaves the nag owed rather than claiming it. The delivery belongs in the next release's notes, not this one's.
- **The counterparty is told nothing about billing.** Their card reads "waiting for &lt;name&gt; to publish". That is deliberate (ADR-8) and is worth knowing before reading a support thread about a stuck relationship.
- **`0036` is applied to production with no pre-migration snapshot.** The table is additive, has 0 rows, and its columns match the committed DDL exactly; `db:verify` is green. The snapshot condition attached to the approval was not honoured when it was applied — recorded here so the omission is visible rather than repaired by a later claim.

## [1.5.1] - 2026-11-07

### Fixed

- `fix(ui)` — no typed Reason field on template saves — the audit sentence is generated (#625) ([#630](https://github.com/riolabs-ai/alignsynch/pull/630))
- `fix(health)` — a stale health record fails the gate instead of rendering as current (#599) ([#629](https://github.com/riolabs-ai/alignsynch/pull/629))
- `fix(flow)` — give the accept step an entry point, and a test that walks it (#617) ([#628](https://github.com/riolabs-ai/alignsynch/pull/628))
- `fix(health)` — re-record platform health from demo and move the #508 probe out of the record (#599) ([#627](https://github.com/riolabs-ai/alignsynch/pull/627))
- `fix(ui)` — no typed Reason field on template saves — the audit sentence is generated (#625) ([#626](https://github.com/riolabs-ai/alignsynch/pull/626))

### Maintenance

- `docs(qa)` — the assessment flow walked end to end on demo — first breakpoint is the accept step ([#622](https://github.com/riolabs-ai/alignsynch/pull/622))
- `chore(security)` — lift the form guard into lib/forms/ and guard the news signup + auth proxy (#615) ([#616](https://github.com/riolabs-ai/alignsynch/pull/616))

### Known limits

- **A session still completes without payment.** The pay-to-complete model — optional payment method at invite, a 7-day trial, payment required to publish a sheet and open the Gap, per-relationship price, 14-day unpaid expiry — is decided and specified in #619, and nothing in it ships in this version. Completing a session remains free.
- **A relationship cannot be edited after it is created.** No edit surface exists, and five `relationship` columns have no writer at all (`template_version_id`, `completed_at`, `void_reason`, `expired_at`, `lapse_reason`). #623 carries both.
- **The accept entry point is a link, not a policy.** This version makes the accept step reachable, so a real session can now complete; it does not change what completion requires, and a session whose parties never accept still never completes.
- **Only template _saves_ generate their audit reason.** Console publish, withdraw and create-from-scratch still require a typed justification, because a server cannot reconstruct an operator's intent. If those are automated later, that is a deliberate change to `lib/admin/act.ts`'s contract, not a follow-up.
- **Platform health is a point-in-time snapshot.** The record is re-measured on demand, from the demo branch; a stale record now fails the gate rather than being rendered as current, but the record itself is not live telemetry and does not update by itself.
- **The news signup answers 200 to a refused submission.** A submission the guard refuses (honeypot filled, unverifiable token, address window) receives the same `subscribed` answer as a real subscriber and writes no `news_signup` row — deliberately, so a bot learns nothing. The cost is that a person caught by a false positive gets no error and no subscription either.

## [1.5.0] - 2026-11-07

### Added

- `feat(privacy)` — account deletion — 0033 indexes, the Neon auth-user delete, one transactional scrub, an in-app control (#597) ([#597](https://github.com/riolabs-ai/alignsynch/pull/597))
- `feat(tour)` — step 4 fills the real answer sheet as an example (#457) ([#596](https://github.com/riolabs-ai/alignsynch/pull/596))
- `feat(email)` — templates 6-10 through the v0.9 band (#548) ([#568](https://github.com/riolabs-ai/alignsynch/pull/568))
- `feat(email)` — templates 2–5 through the band (#548) ([#558](https://github.com/riolabs-ai/alignsynch/pull/558))

### Fixed

- `fix(account)` — db:verify names an unfinished deletion (#278) ([#613](https://github.com/riolabs-ai/alignsynch/pull/613))
- `fix(settings)` — the delete card carries §5 verbatim, and the retention line stops denying the address (#278) ([#602](https://github.com/riolabs-ai/alignsynch/pull/602))
- `fix(deps)` — migrate recharts 2.15.3 -> 3.10.1 (13 typecheck errors -> 0; supersedes #571) ([#587](https://github.com/riolabs-ai/alignsynch/pull/587))
- `fix(account)` — a failed scrub resumes from a recorded intent (#278) ([#601](https://github.com/riolabs-ai/alignsynch/pull/601))
- `fix(deps)` — better-auth 1.7.18 (patches CVE-2026-114607) via @neon/auth 0.8.2 ([#576](https://github.com/riolabs-ai/alignsynch/pull/576))
- `fix(demo)` — a restore of a branch with children sends preserve_under_name ([#561](https://github.com/riolabs-ai/alignsynch/pull/561))
- `fix(email)` — the `### Commits` ledger is provenance, not a highlight ([#555](https://github.com/riolabs-ai/alignsynch/pull/555))

### Maintenance

- `chore(deps)` — remove the unused DatePicker wrapper and react-day-picker ([#593](https://github.com/riolabs-ai/alignsynch/pull/593))
- `chore(deps)` — react 19.3.1 + radix slot 1.5.0, dialog/popover 1.3.1 — one cohort (#592) ([#592](https://github.com/riolabs-ai/alignsynch/pull/592))
- `chore(deps)` — bump mdast-util-to-hast from 13.2.0 to 13.2.1 ([#600](https://github.com/riolabs-ai/alignsynch/pull/600))
- `chore(ci)` — bump actions/upload-artifact from 4 to 7 ([#569](https://github.com/riolabs-ai/alignsynch/pull/569))
- `chore(deps)` — bump yaml from 2.7.1 to 2.9.1 ([#589](https://github.com/riolabs-ai/alignsynch/pull/589))
- `chore(deps)` — bump postcss from 8.5.3 to 8.5.23 ([#585](https://github.com/riolabs-ai/alignsynch/pull/585))
- `chore(deps)` — bump picomatch from 2.3.1 to 2.3.2 ([#588](https://github.com/riolabs-ai/alignsynch/pull/588))
- `chore(deps)` — bump lodash from 4.17.21 to 4.18.1 ([#590](https://github.com/riolabs-ai/alignsynch/pull/590))
- `chore(deps)` — bump browserslist from 4.24.5 to 4.29.5 ([#584](https://github.com/riolabs-ai/alignsynch/pull/584))
- `chore(deps)` — swiper 11.2.7 -> 12.2.0, clearing two critical advisories ([#595](https://github.com/riolabs-ai/alignsynch/pull/595))
- `chore(ci)` — dependabot — weekly, 3 at a time, majors only ([#591](https://github.com/riolabs-ai/alignsynch/pull/591))
- `chore(deps)` — clear 7 Dependabot alerts — combined nanoid/source-map-js/baseline-browser-mapping + sucrase 3.35.1 (drops glob and minimatch) ([#586](https://github.com/riolabs-ai/alignsynch/pull/586))
- `chore(deps)` — migrate content/ to zod 4 and bump zod to ^4.6.6 ([#578](https://github.com/riolabs-ai/alignsynch/pull/578))
- `chore(deps)` — bump @hookform/resolvers from 5.0.1 to 5.4.0 ([#574](https://github.com/riolabs-ai/alignsynch/pull/574))
- `chore(deps)` — bump glob 10.5.0, minimatch 9.0.9, postcss-selector-parser 6.1.5 ([#583](https://github.com/riolabs-ai/alignsynch/pull/583))
- `chore(deps)` — bump next from 16.1.6 to 16.4.1 ([#563](https://github.com/riolabs-ai/alignsynch/pull/563))
- `chore(ci)` — dependabot.yml and CODEOWNERS for the security surfaces (#441) ([#567](https://github.com/riolabs-ai/alignsynch/pull/567))
- `docs(ops)` — the twelve non-main branches, triaged by what proves each removal safe ([#560](https://github.com/riolabs-ai/alignsynch/pull/560))
- `docs(agents)` — ## Numbers points at docs/GATE.md instead of copying the figures ([#559](https://github.com/riolabs-ai/alignsynch/pull/559))
- `docs(gate)` — re-measure the baseline over 2026-11-04 — 156 s a run, 176 s to the last job ([#557](https://github.com/riolabs-ai/alignsynch/pull/557))

### Known limits

- **Account deletion needs a live session.** The control lives on `/settings` and acts on the signed-in person. Anyone whose managed-auth user is already gone cannot self-serve it, and there is no operator tool in the product for that case.
- **A failed scrub is resumable, not automatic.** When the auth deletion succeeds and the sweep then throws, the intent survives in `account_deletion_job`, an operator finishes it with the command in `docs/ACCOUNT-DELETION-SPEC.md`, and `scripts/db-verify.mjs` fails on a row still open after 24 hours. That is a check somebody runs, not a pager: nothing alerts on its own and nothing retries automatically, so an abandoned row is visible only to whoever runs the verify.
- **The marketing opt-out row keeps the email address on purpose.** It is the one retained identifier, it exists so the address is never mailed again, and the privacy policy says so rather than claiming no address is kept. Billing records (7 years) and security audit entries (24 months) carry no name or address.
- **A shared assessment survives the deletion of one participant.** The other person keeps their report; the deleted person's seat reads "Deleted account" and their answers remain inside that completed report with the identifying prose rewritten. That is the product decision, recorded in `docs/ACCOUNT-DELETION-SPEC.md`.
- **The dependency cohort moved major versions with no application change.** react 19.3.1, recharts 3.10.1 and swiper 12.2.0 all landed without source edits; the carousel screenshots in `docs/qa-swiper-12/` are the visual evidence, and the two pairs that differ are autoplay timing rather than regressions.

## [1.4.0] - 2026-11-04

The admin console, and relationship templates become products.

### Admin

- **An audited operations console** (epic #500): roles, an action log, template authoring,
  relationship repair, report regeneration, billing control, support inbox, broadcast and
  platform health. Every write passes one `act()` path that cannot mutate without a reason,
  and a PII read records itself.
- `product.admin` is a **template capability** — a derived product inherits the console or
  turns it off, and answers 404 when off.

### Relationship templates as products (#533)

- Templates carry an owner and a visibility; public listing stays admin-curated.
- Relationship lifecycle `draft → pending → published → active → complete`, with void/expired.
- **Per-relationship membership**: 14-day trial from publish, one active trial per user,
  invite expires in 7 days, unlimited assessment rounds while paid, read-only for both sides
  when membership lapses.
- Initiator CRUD: clone or start blank, edit Aspects, publish → trial or checkout,
  one-click re-publish.

### Onboarding

- First-run tour (driver.js, MIT) and a three-step counterparty wizard whose auth round-trip
  keeps the invite token and returns to the same step.

### Brand and system

- Icon set generated from the **real mark**, transparent ground (`E38` guards it).
- Palette: graphite `#37474F` action, cyan `#08ADD5` accent (surface-only — contrast measured).
- New checks: `E39` fails a dashboard→marketing link without a new tab; `E35` remains the
  ancestor rule.

### Commits

- `feat(nav)` — the rail is a role-constrained menu, and the admin console leads its own group (#542) ([#552](https://github.com/riolabs-ai/alignsynch/pull/552))
- `feat(templates)` — a public Relationship Templates catalogue, and a home band that sells it ([#544](https://github.com/riolabs-ai/alignsynch/pull/544))
- `feat(flow)` — counterparty onboarding — a three-step wizard, and a next on every login hop ([#538](https://github.com/riolabs-ai/alignsynch/pull/538))
- `feat(relationship)` — #533 phase 3 — one trial, day-14 hard stop, read-only both sides, payment reactivates ([#537](https://github.com/riolabs-ai/alignsynch/pull/537))
- `feat(member)` — #533 phase 2 — initiator CRUD, publish, one-click re-publish ([#535](https://github.com/riolabs-ai/alignsynch/pull/535))
- `feat(relationship)` — template ownership, lifecycle, trial read and rounds (#533 phase 1) ([#534](https://github.com/riolabs-ai/alignsynch/pull/534))
- `feat(billing)` — claim the host on a checkout and refuse another host's events ([#532](https://github.com/riolabs-ai/alignsynch/pull/532))
- `feat(admin)` — broadcast to news signups (#507) ([#531](https://github.com/riolabs-ai/alignsynch/pull/531))
- `feat(admin)` — #506 support inbox — triage, Resend replies with visible failure, bounce state, throttle visibility ([#530](https://github.com/riolabs-ai/alignsynch/pull/530))
- `feat(email)` — #439b Resend inbound — signed webhook, idempotent email_event, bounce suppression ([#528](https://github.com/riolabs-ai/alignsynch/pull/528))
- `feat(admin)` — #502b template versioning — template_version, relationships bound to a version, immutable publish ([#524](https://github.com/riolabs-ai/alignsynch/pull/524))
- `feat(admin)` — #505 billing control — subscription state, test-mode banner, audited comps, server-side limits ([#525](https://github.com/riolabs-ai/alignsynch/pull/525))
- `feat(admin)` — #504 report operations — regenerate, PII-gated read, JSON + PDF export ([#523](https://github.com/riolabs-ai/alignsynch/pull/523))
- `feat(admin)` — #502a template authoring — a draft editor validated by zAssessment, saved through act() ([#522](https://github.com/riolabs-ai/alignsynch/pull/522))
- `feat(admin)` — /admin/health — the platform-health screen, every number naming its source (#508) ([#520](https://github.com/riolabs-ai/alignsynch/pull/520))
- `feat(admin)` — the five #503 actions, their floors, and a reason gate proven per operation ([#517](https://github.com/riolabs-ai/alignsynch/pull/517))
- `feat(admin)` — #503 relationship operations ([#516](https://github.com/riolabs-ai/alignsynch/pull/516))
- `feat(admin)` — /admin/audit — the filtered, read-only audit screen (#501b) ([#515](https://github.com/riolabs-ai/alignsynch/pull/515))
- `feat(admin)` — the role ladder, admin_invite, admin_action and act() (#501) ([#511](https://github.com/riolabs-ai/alignsynch/pull/511))
- `feat(admin)` — product.admin — the console's capability switch (#509) ([#512](https://github.com/riolabs-ai/alignsynch/pull/512))
- `feat(db-verify)` — V21 — a seeded instance reads `complete`, or the run names it ([#499](https://github.com/riolabs-ai/alignsynch/pull/499))
- `feat(onboarding)` — the first-run tour's shell — driver.js, six steps, skip a missing target (#455) ([#496](https://github.com/riolabs-ai/alignsynch/pull/496))
- `feat(onboarding)` — the tour's "seen" mark is one column and one guarded route (#456) ([#494](https://github.com/riolabs-ai/alignsynch/pull/494))
- `feat(assessment)` — the Steps render on the instance screen, and the v1 release rows retire (#478) ([#493](https://github.com/riolabs-ai/alignsynch/pull/493))
- `feat(demo)` — move the worked example to /assessment/demo/[type] and delete the prototype group (#478) ([#492](https://github.com/riolabs-ai/alignsynch/pull/492))
- `feat(release)` — --check-limits re-derives a Known limits block from the tree ([#489](https://github.com/riolabs-ai/alignsynch/pull/489))
- `feat(admin)` — move the console to /admin/console, behind the allowlist (#478) ([#486](https://github.com/riolabs-ai/alignsynch/pull/486))
- `fix(brand)` — the lockup is 2rem in every expanded-header viewport (#549 follow-up) ([#553](https://github.com/riolabs-ai/alignsynch/pull/553))
- `fix(help)` — a sticky category rail beside the answers, and the person band beside the form ([#549](https://github.com/riolabs-ai/alignsynch/pull/549))
- `fix(brand)` — the chrome draws the full lockup again, and the auth mark is a seal (#539) ([#547](https://github.com/riolabs-ai/alignsynch/pull/547))
- `fix(db)` — serialise db:seed on the branch with an advisory lock ([#529](https://github.com/riolabs-ai/alignsynch/pull/529))
- `fix(demo)` — record the #464 dataset in the demo expectations — 33 records, 172 items ([#526](https://github.com/riolabs-ai/alignsynch/pull/526))
- `fix(demo)` — record the #464 template catalogue in demo:verify's counts ([#527](https://github.com/riolabs-ai/alignsynch/pull/527))
- `fix(admin)` — #503 a revoke is terminal — a resend refuses a withdrawn invitation ([#519](https://github.com/riolabs-ai/alignsynch/pull/519))
- `fix(assessment)` — the locked report's continue CTA opens the sheet, not the POST-only endpoint ([#488](https://github.com/riolabs-ai/alignsynch/pull/488))
- feat(email) — the release note: one band, plain text first, sent once per tag (#548) ([#551](https://github.com/riolabs-ai/alignsynch/pull/551))
- feat(dashboard) — support, help and the library live in the console (#542) ([#546](https://github.com/riolabs-ai/alignsynch/pull/546))
- `polish(v1.x)` — the ten owner UI items — icon size, auth gap, Gap scale, tokens, footer band, one measure, rails (#539) ([#543](https://github.com/riolabs-ai/alignsynch/pull/543))
- `copy(home)` — the register pass — title, practice band and boundary body ([#545](https://github.com/riolabs-ai/alignsynch/pull/545))
- `copy(home)` — the hero pitches a leader's outcome, not a practitioner's practice ([#541](https://github.com/riolabs-ai/alignsynch/pull/541))
- `ux(rules)` — a link out of the dashboard opens a new tab; a form surface carries no shadow ([#540](https://github.com/riolabs-ai/alignsynch/pull/540))
- `chore(ops)` — version env-sync with the policy lists, --confirm-production and --diff ([#536](https://github.com/riolabs-ai/alignsynch/pull/536))
- `test(admin)` — #503 the five repairs, their rung and the rollback ([#521](https://github.com/riolabs-ai/alignsynch/pull/521))
- `docs(brand)` — the icon docs name the transparent ground, and parity only moves on a path ([#514](https://github.com/riolabs-ai/alignsynch/pull/514))
- `test(admin)` — #503 the void and force-close screens, read as markup ([#518](https://github.com/riolabs-ai/alignsynch/pull/518))
- `brand` — the icon set is the AS mark on transparency, and E38 fails when it is not ([#510](https://github.com/riolabs-ai/alignsynch/pull/510))
- `docs(release)` — a seeded instance reading `answering` is stamped, never reseeded ([#498](https://github.com/riolabs-ai/alignsynch/pull/498))
- `docs(db-verify)` — V11's comment says why a legitimate mark can still go stale ([#497](https://github.com/riolabs-ai/alignsynch/pull/497))
- `docs(release)` — a V11 is repaired by clearing the mark, and a rule change is what creates one ([#495](https://github.com/riolabs-ai/alignsynch/pull/495))
- `refactor(v1)` — delete the 95-row customer half of /v1, and prove /v1 404s (#478) ([#491](https://github.com/riolabs-ai/alignsynch/pull/491))
- `docs(registry)` — the answer sheet's inbound paths name the report's CTA too ([#490](https://github.com/riolabs-ai/alignsynch/pull/490))
- `docs(release)` — the v1.3.0 Known limit said the answer sheet had no link — it has one ([#487](https://github.com/riolabs-ai/alignsynch/pull/487))
- fix(shell) — the surface registry calls create and answer live, because they are ([#485](https://github.com/riolabs-ai/alignsynch/pull/485))
- `docs(v1)` — disposition all 118 /v1 items into docs/V1-RETIREMENT.md (#478) ([#484](https://github.com/riolabs-ai/alignsynch/pull/484))
- `docs(release)` — a merge deploys production, measured during the v1.3.0 cut ([#483](https://github.com/riolabs-ai/alignsynch/pull/483))
- **Stripe is test mode only** — no `sk_live` path exists in the code; checkout cannot charge
- **Chat has no persistence** — `/chat` is a mocked surface with no tables behind it.
- **The Doubt gap kind is not computable** — `opinion` keeps one value per kind, so the report
- **Neon-hosted auth mail is unverified** — app mail sends through Resend and is proven;
- **Role-constrained menus and focused-flow chrome are not in this release** (#542 phase 2).
- **An invite token is shown once** (hashed at rest) — a lost link needs a re-publish.
- No merge queue (#442); merges stay serial because `main` requires an up-to-date branch.

### Known limits

- **Stripe is test mode only** — no `sk_live` path exists in the code; checkout cannot charge
  a card, and the test-mode banner stays visible on purpose.
- **Chat has no persistence** — `/chat` is a mocked surface with no tables behind it.
- **The Doubt gap kind is not computable** — `opinion` keeps one value per kind, so the report
  states it rather than printing a number.
- **Neon-hosted auth mail is unverified** — app mail sends through Resend and is proven;
  a Neon-side SMTP credential was rotated and its replacement is not yet confirmed by a reset.
- **Role-constrained menus and focused-flow chrome are not in this release** (#542 phase 2).
- **An invite token is shown once** (hashed at rest) — a lost link needs a re-publish.
- No merge queue (#442); merges stay serial because `main` requires an up-to-date branch.

## [1.3.0] - 2026-11-03

### Added

- `feat(templates)` — the catalogue the page carries — 27 types, seven realms, priced from the fixture, filterable ([#464](https://github.com/riolabs-ai/alignsynch/pull/464))
- `feat(demo)` — pnpm demo:verify — a versioned dataset, a versioned expectation, one diff ([#460](https://github.com/riolabs-ai/alignsynch/pull/460))
- `feat(contact)` — no email on any public page, one no-captcha form on /help (supersedes #448) ([#452](https://github.com/riolabs-ai/alignsynch/pull/452))
- `feat(v1)` — the staff–manager template demo renders a real report ([#447](https://github.com/riolabs-ai/alignsynch/pull/447))
- `feat(pricing)` — three tiers, Basic recommended, relationship alignment copy, real billing rows ([#444](https://github.com/riolabs-ai/alignsynch/pull/444))
- `feat(support)` — split the help centre from account support ([#445](https://github.com/riolabs-ai/alignsynch/pull/445))
- `feat(marketing)` — the AlignSynch home leads with the practice, the Gap is the proof ([#431](https://github.com/riolabs-ai/alignsynch/pull/431))
- `feat(flow)` — acceptance is the completion hinge, and Steps are derived on the transition (#427) ([#430](https://github.com/riolabs-ai/alignsynch/pull/430))
- `feat(flow)` — the create form posts to /assessment/new, refusals come back as a band, and the chosen Setting is written (#427) ([#429](https://github.com/riolabs-ai/alignsynch/pull/429))
- `feat(flow)` — /answer is a gated sheet, blind by construction (#427) ([#428](https://github.com/riolabs-ai/alignsynch/pull/428))
- `feat(v1)` — gate the prototype group behind a session or the demo unlock ([#426](https://github.com/riolabs-ai/alignsynch/pull/426))
- `feat(shell)` — the console rail opens on Dashboard and lists My Relationships · Library ([#425](https://github.com/riolabs-ai/alignsynch/pull/425))
- `feat(v1)` — the demo seed carries two rows per catalogue type ([#421](https://github.com/riolabs-ai/alignsynch/pull/421))

### Fixed

- `fix(how-it-works)` — the login redirect answers with no auth environment ([#467](https://github.com/riolabs-ai/alignsynch/pull/467))
- `fix(brand)` — the chrome draws the official lockup whole, and never squashed ([#470](https://github.com/riolabs-ai/alignsynch/pull/470))
- `fix(shell)` — the rail is a drawer below 768, icons to 1023, labels from 1024 ([#465](https://github.com/riolabs-ai/alignsynch/pull/465))
- `fix(auth)` — a valid session survives a render that cannot write its cookie ([#453](https://github.com/riolabs-ai/alignsynch/pull/453))
- `fix(shell)` — the rail expands from lg, not xl — labels are back at laptop widths ([#449](https://github.com/riolabs-ai/alignsynch/pull/449))
- `fix(copy)` — the relationships list carries a label for every invite state ([#435](https://github.com/riolabs-ai/alignsynch/pull/435))
- `fix(auth)` — step 1 of sign-up collects the email only; the names move to step 2 ([#422](https://github.com/riolabs-ai/alignsynch/pull/422))

### Maintenance

- `docs(gate)` — the 2026-10-29 → 2026-11-03 comparison states the per-step numbers, not a ratio ([#482](https://github.com/riolabs-ai/alignsynch/pull/482))
- `docs(gate)` — a measured baseline — 97.4 % yield / 144 s on 2026-11-02, and how to re-derive it ([#480](https://github.com/riolabs-ai/alignsynch/pull/480))
- `perf(db)` — pin TLS, timeouts and pool bounds; make a cold start visible (#440) ([#479](https://github.com/riolabs-ai/alignsynch/pull/479))
- `docs(readme)` — the share card leads, the pricing capture stays for the UI docs ([#477](https://github.com/riolabs-ai/alignsynch/pull/477))
- `docs(auth)` — the gated console routes say why no auth env is a 500, by design ([#475](https://github.com/riolabs-ai/alignsynch/pull/475))
- Home polish · the six defects the hero screenshot review found (copy and spacing) ([#471](https://github.com/riolabs-ai/alignsynch/pull/471))
- Share card · ship the owner's supplied PNG byte-identical, retire the drawn card ([#472](https://github.com/riolabs-ai/alignsynch/pull/472))
- `docs(templates)` — re-capture the catalogue on the rail v4 shell — and prove the v2 branch deletes no sibling ([#473](https://github.com/riolabs-ai/alignsynch/pull/473))
- `test(brand)` — E37 — the AlignSynch brand never names the template, with a guard that proves it can fail ([#466](https://github.com/riolabs-ai/alignsynch/pull/466))
- Share card · the brand's own lockup, one sentence, the Gap drawn ([#469](https://github.com/riolabs-ai/alignsynch/pull/469))
- `docs(readme)` — open on the pricing page, retire the stale captures, keep five flows ([#468](https://github.com/riolabs-ai/alignsynch/pull/468))
- Home v2 · the AlignSynch practice page, finished, gated and screenshotted ([#463](https://github.com/riolabs-ai/alignsynch/pull/463))
- `docs(readme)` — say what AlignSynch is, and show the six finished screens ([#462](https://github.com/riolabs-ai/alignsynch/pull/462))
- `chore(dx)` — pnpm check:fast — a fast inner loop, and the cohort rhythm written down ([#450](https://github.com/riolabs-ai/alignsynch/pull/450))
- Pricing · readable CTA, centred signup band, Title Case chrome ([#451](https://github.com/riolabs-ai/alignsynch/pull/451))
- Footer · the news signup on every marketing page (Neon stores, Resend sends) + the brand-immutability guard ([#446](https://github.com/riolabs-ai/alignsynch/pull/446))
- copy · relationships, not assessments — and the auth surfaces get the brand, a way home, and a password meter ([#436](https://github.com/riolabs-ai/alignsynch/pull/436))
- `chore(gitignore)` — never commit a .hermes/ directory that lands in a workspace ([#432](https://github.com/riolabs-ai/alignsynch/pull/432))

### Known limits

- **Production is not this tag, and the entry says which build it was written against.** On 2026-11-03, `alignsynch.com/api/version` answers `94070089318162818dac03db4a42e63c993f80da` (`perf(db)`, #479) with version `1.2.0` — the number baked into the bundle at build time, which is why the live badge still reads `1.2.0`. The `v1.3.0` tag sits on the release commit above that build: it carries this entry, the version in `package.json`, the release and deployment docs, and the parity hashes the version string moves — no application code — so deploying it rebuilds the same app with a new badge. Any later commit moves production again, and `node scripts/deploy-check.mjs --expect "$(git rev-parse v1.3.0^{commit}")"` is what answers that question; this paragraph can only date the answer.
- **The three write surfaces are wired, and this is the first tag that can say so.** Create (`POST /assessment/new`), answer (`POST /assessment/instances/[instanceId]/answers`) and acceptance (`POST /assessment/instances/[instanceId]/accepts`) each write to Postgres: create copies a template into a relationship, a session and the initiating seat in one transaction; an answer sheet records one party's whole sheet; the second acceptance completes the session, opens the report and derives the Steps. Refusals are proved too — 403 for a browser that is not a party, 409 once the submitting party has accepted, 409 for an opinion kind the session's mode does not ask — and so is the race (two concurrent accepts derive the Steps once). All of it against the **demo** database; no run in this repository has driven the flow against production's rows, because `pnpm demo:verify` refuses production by design.
- **The report stays locked until both parties accept.** Before the second acceptance it renders the locked page and nothing of the other party's answers: the blind rule is the query the page is given, not a check the render makes afterwards. After completion it prints both parties' opinions and the Gap between them, and it is read-only — no control changes a relationship, records an acceptance or edits an answer.
- **Neither write screen has a nav destination.** Create is reachable from a template's own CTA (`components/assessment-flow/template-card.tsx` renders `createRelationshipPath`), and the answer sheet from the accept screen's answer-first band — `lib/flow/paths.ts::answerSheetPath`, passed into `AcceptSession` as `answerHref` by `instances/[instanceId]/accept/page.tsx` and rendered as the `<Link>` in `components/assessment-flow/accept-session.tsx`, which the acceptance hinge shipped (#427, [#430](https://github.com/riolabs-ai/alignsynch/pull/430)) — so the sheet is reached from `/assessment/instances/<id>/accept` while the viewer's own sheet is still incomplete, and never from the navigation: `components/layout/nav-menus.tsx` draws rows for `/assessment/instances` and `/assessment/templates` only, so no row exists for either write route. This release's registry called both `preview` at the cut, a status that had no rendered effect for exactly that reason; #485 corrected it to `live` once both write paths had shipped (#428, #429). _(Corrected after publication — this bullet first said ~~`lib/flow/paths.ts::answerPath`~~, a symbol the tree does not carry, and that nothing links to the sheet. Both were false at this tag, and the fragment now names its parent segment: two routes under `app/**` end with that file.)_
- **Six surfaces are declared and not wired**: chat, notifications, the relationship product's profile and settings, the shop, and the admin console. Each answers with the product's own pending panel and gains no nav destination. The admin console's two reads exist, but the shell cannot grant the capability — `lib/nav.ts` reads no role — so the registry names the missing operator role rather than calling a working read shipped.
- **The public contact form keeps a message before it mails it.** `/help` posts to `/api/contact`, which inserts into `contact_message` (migrations `0020` and `0021`) and only then calls Resend; `mail_outcome` records `sent`, `unset` or `failed`, so a provider outage delays the notification instead of losing the message. There is no operator inbox in the app — the table is read in SQL. The throttle counts a salted SHA-256 of the client address and never the address itself.
- **`/v1` is gated, not retired.** Every prototype route answers `307 → /login?next=/v1` for a visitor carrying neither a session nor the demo PIN unlock. The demo path itself is refused on a production deployment unless `DEMO_ALLOW_PRODUCTION=1` is set explicitly (`lib/auth/demo-mode.ts`).
- **No preview URL exists for a branch under review.** Vercel creation stays deliberately production-only, so a branch is reviewed by reading its diff and running it locally, and production is the only deployed artefact of this repository.

## [1.2.0] - 2026-11-02

### Added

- `feat(v1)` — the demo seed carries parties, chat, notices and every subscription state (#415) ([#418](https://github.com/riolabs-ai/alignsynch/pull/418))
- `feat(v1)` — template catalogue, template landing, and the relationship report (#409) ([#414](https://github.com/riolabs-ai/alignsynch/pull/414))
- `feat(assessment)` — relationship list and detail as server-rendered DB surfaces ([#412](https://github.com/riolabs-ai/alignsynch/pull/412))
- `feat(shell)` — the surface registry, PendingSurface and nav greying (#409) ([#410](https://github.com/riolabs-ai/alignsynch/pull/410))
- `feat(v1)` — the template page becomes a conversion landing (#404) ([#405](https://github.com/riolabs-ai/alignsynch/pull/405))
- `feat(v1)` — admin console — counts that open their lists, the registry, templates, seats and stated limits ([#402](https://github.com/riolabs-ai/alignsynch/pull/402))
- `feat(v1)` — print the two Opinions behind every Gap, per Aspect ([#398](https://github.com/riolabs-ai/alignsynch/pull/398))
- `feat(v1)` — acceptance first — both sides side by side, reviewable before accepting ([#400](https://github.com/riolabs-ai/alignsynch/pull/400))
- `feat(v1)` — profile and settings for all four personas (#384) ([#397](https://github.com/riolabs-ai/alignsynch/pull/397))
- `feat(v1)` — the relationships list becomes a My Quizzes variation — stage tabs, search, cards, honest metrics (#384) ([#396](https://github.com/riolabs-ai/alignsynch/pull/396))
- `feat(v1)` — template library and shop — role-gated actions, per-relationship subscription, initiator-only billing ([#393](https://github.com/riolabs-ai/alignsynch/pull/393))
- `feat(v1)` — chat and notifications — relationship threads, unread state, blind-safe before scoring ([#392](https://github.com/riolabs-ai/alignsynch/pull/392))
- `feat(v1)` — relationships list, detail, Aspects CRUD, clone, library and invite state (#384) ([#390](https://github.com/riolabs-ai/alignsynch/pull/390))
- `feat(v1)` — seed Basic and Advanced modes, Soft and Full settings, and derive flag counts (#384) ([#389](https://github.com/riolabs-ai/alignsynch/pull/389))
- `feat(v1)` — persona-scoped sidebar, dashboard overview and per-section stubs (#384) ([#388](https://github.com/riolabs-ai/alignsynch/pull/388))
- `feat(v1)` — relationship catalogue — 29 source rows + kept co-founders, grouped by realm, dating gated (#385) ([#387](https://github.com/riolabs-ai/alignsynch/pull/387))
- `feat(v1)` — review list states who each screen is for, per the #384 persona matrix ([#386](https://github.com/riolabs-ai/alignsynch/pull/386))
- `feat(db)` — seed durable platform admins from ADMIN_* env, idempotently ([#383](https://github.com/riolabs-ai/alignsynch/pull/383))
- `feat(v1)` — contain /v1 inside /v1 and add a persisted review list ([#374](https://github.com/riolabs-ai/alignsynch/pull/374))
- `feat(auth)` — grant admin at sign-in from the ADMIN_EMAILS allowlist ([#382](https://github.com/riolabs-ai/alignsynch/pull/382))
- `feat(shell)` — pin control collapses the expanded sidebar; sign-out lands on marketing ([#381](https://github.com/riolabs-ai/alignsynch/pull/381))
- `feat(v1)` — the onboarding panel becomes a stepped wizard (no assistant) ([#378](https://github.com/riolabs-ai/alignsynch/pull/378))
- `feat(v1)` — persona bar becomes a notice banner with environment context ([#377](https://github.com/riolabs-ai/alignsynch/pull/377))
- `feat(v1)` — answer sheet — inline errors, top summary, pinned submit on mobile ([#373](https://github.com/riolabs-ai/alignsynch/pull/373))
- `feat(v1)` — report verdict, relationship types + demo, and the session timeline (three sets, one branch) ([#370](https://github.com/riolabs-ai/alignsynch/pull/370))
- `feat(ui)` — a component template ancestor is a checked header, not a convention (#336) ([#345](https://github.com/riolabs-ai/alignsynch/pull/345))
- `feat(brand)` — the book is the mark, and the icon set is generated from it ([#363](https://github.com/riolabs-ai/alignsynch/pull/363))
- `feat(coach)` — a coach is a role on the relationship, with a hard read-only boundary ([#358](https://github.com/riolabs-ai/alignsynch/pull/358))
- `feat(db)` — a relationship holds sessions — the split, the backfill and the instance rename (#340) ([#352](https://github.com/riolabs-ai/alignsynch/pull/352))
- `feat(v1)` — the template editor — a variation of the quiz editor, store-backed ([#343](https://github.com/riolabs-ai/alignsynch/pull/343))
- `feat(marketing)` — the public top menu, the shell footer and header identity ([#335](https://github.com/riolabs-ai/alignsynch/pull/335))
- `feat(auth)` — name Google-only accounts on the password form (#281) ([#333](https://github.com/riolabs-ai/alignsynch/pull/333))
- `feat(auth)` — a Google button beside the password form (#281) ([#330](https://github.com/riolabs-ai/alignsynch/pull/330))
- `feat(deploy)` — codify the preview rule and add a freshness check that never guesses ([#329](https://github.com/riolabs-ai/alignsynch/pull/329))

### Fixed

- `fix(auth)` — /login and the 404 draw the brand's marks, not the quiz product's ([#417](https://github.com/riolabs-ai/alignsynch/pull/417))
- `fix(auth)` — the sign-up screen draws the brand's marks, not the quiz product's ([#413](https://github.com/riolabs-ai/alignsynch/pull/413))
- `fix(v1)` — the acceptance status line says what the blind rule actually hides ([#403](https://github.com/riolabs-ai/alignsynch/pull/403))
- `fix(v1)` — one review control, in the footer, deep-linking to its own review row ([#399](https://github.com/riolabs-ai/alignsynch/pull/399))
- `fix(shell)` — remove the sidebar pin — the rail is always expanded ([#394](https://github.com/riolabs-ai/alignsynch/pull/394))
- `fix(auth)` — measure the flow cookie's age and the verifier's fingerprint at the finish (#351 follow-up) ([#362](https://github.com/riolabs-ai/alignsynch/pull/362))
- `fix(auth)` — capture the Google finish failure before fixing it (#351 follow-up) ([#359](https://github.com/riolabs-ai/alignsynch/pull/359))
- `fix(auth)` — exchange the Neon verifier at our own callback, so Google sign-in ends signed in (#351) ([#357](https://github.com/riolabs-ai/alignsynch/pull/357))
- `fix(404)` — render the brand's heading and drop the empty suggestion band (#351) ([#355](https://github.com/riolabs-ai/alignsynch/pull/355))
- `fix(auth)` — land the post-sign-in destination per brand (#351) ([#354](https://github.com/riolabs-ai/alignsynch/pull/354))
- `fix(auth)` — start the Google handshake on the Neon origin, not the proxy ([#350](https://github.com/riolabs-ai/alignsynch/pull/350))
- `fix(demo)` — the Admin button lands on the console, not the gate proof ([#334](https://github.com/riolabs-ai/alignsynch/pull/334))

### Maintenance

- R1-E: create, answer and accept as in-progress UI (#409) ([#416](https://github.com/riolabs-ai/alignsynch/pull/416))
- DRAFT — V1 create entry, metadata CRUD by Setting, and the Steps primitive (one per Aspect, rewordable, closed status) — for discussion, do not merge ([#406](https://github.com/riolabs-ai/alignsynch/pull/406))
- `test(v1)` — a deterministic demo seeder over every catalogue type, and the test factories that pin the shape ([#407](https://github.com/riolabs-ai/alignsynch/pull/407))
- `auth` — password reset, and a set-password path for Google-only accounts ([#395](https://github.com/riolabs-ai/alignsynch/pull/395))
- `docs` — the UI/UX audit — every surface scored against its template ancestor ([#364](https://github.com/riolabs-ai/alignsynch/pull/364))
- `docs(deploying)` — §1 quotes the widened ignoreCommand and names its one exception ([#361](https://github.com/riolabs-ai/alignsynch/pull/361))
- `chore(deploy)` — one branch builds besides production, and it is named in the file ([#360](https://github.com/riolabs-ai/alignsynch/pull/360))
- `docs(deploy)` — §1 states the production-only rule, not the [preview] opt-in ([#353](https://github.com/riolabs-ai/alignsynch/pull/353))
- `deploy(vercel)` — build production only — previews are local ([#348](https://github.com/riolabs-ai/alignsynch/pull/348))
- `refactor(css)` — one token layer — the second stylesheet's chart and sidebar sets fold into app/globals.css ([#347](https://github.com/riolabs-ai/alignsynch/pull/347))
- `refactor(marketing)` — the landing page's eleven boxes, two CTAs and three chips ([#346](https://github.com/riolabs-ai/alignsynch/pull/346))
- `refactor(console)` — the gap table, the failure panels and the title bands compose the primitives ([#344](https://github.com/riolabs-ai/alignsynch/pull/344))
- `docs(prototype)` — correct the one claim in the wiring plan the board does not support ([#342](https://github.com/riolabs-ai/alignsynch/pull/342))
- `docs(prototype)` — the wiring plan — one screen exists, four cohorts never did ([#341](https://github.com/riolabs-ai/alignsynch/pull/341))
- `docs(quiz)` — the capability map — every quiz surface, what it is made of, what full-stack costs ([#338](https://github.com/riolabs-ai/alignsynch/pull/338))
- `docs(ui)` — the quiz-surface map — every ancestor, its AlignSynch variation, and the mobile mechanics ([#337](https://github.com/riolabs-ai/alignsynch/pull/337))
- `docs(ui)` — the divergence table — every bespoke surface, one verdict per file ([#332](https://github.com/riolabs-ai/alignsynch/pull/332))
- `docs(deploy)` — record that preview creation, not just the build, is disabled upstream ([#331](https://github.com/riolabs-ai/alignsynch/pull/331))

### Known limits

- **Five read surfaces are live**: your relationships (`/assessment/instances`), a relationship (`/assessment/instances/[instanceId]`), the template catalogue (`/assessment/templates`), a template (`/assessment/templates/[templateId]`) and the relationship report (`/assessment/instances/[instanceId]/report`). They are server-rendered from Postgres and gated at the session: a signed-out request is redirected to `/login` (the report answers 404 for a relationship id that is not a row). **They have not yet been exercised with a signed-in session** — nobody has opened the list, the catalogue or a report with real rows on screen. They are wired and gated, and that is the whole of what has been verified.
- **Every write surface is not wired yet.** Creating a relationship, answering, accepting, chat, notifications and the admin console cannot record anything. They are not missing pages: create (`/assessment/templates/[templateId]/create`), answer (`/assessment/instances/[instanceId]/answer`) and accept (`/assessment/instances/[instanceId]/accept`) render their real layouts and every write control is visibly disabled, labelled "Not wired yet — … Nothing was saved." Chat, notifications, the admin console, profile, settings and the shop are declared in `data/surface-registry.ts` and are greyed in the navigation with the reason on the row. The registry declares 14 surfaces: 5 live, 3 shipped-but-unwired (`preview`), 6 declared and not built (`pending`).
- **The report is read-only.** It renders the two opinions and the gap between them; it has no control that changes the relationship, records an acceptance or edits an answer. It is also blind until both parties have submitted: with the other party unanswered it renders the locked page and nothing about their answers.
- **No deploy follows this tag.** The tag fixes the artefact; whether and when it is deployed is a separate decision, so a tag in this repository is not a claim that the site is serving it.

## [1.1.0-rc1] - 2026-10-31

### Added

- `feat(nav)` — the console's destinations reach the sidebar, the operator's stay behind the role ([#327](https://github.com/riolabs-ai/alignsynch/pull/327))
- `feat(console)` — /assessment/templates — built-in versus authored, per account ([#326](https://github.com/riolabs-ai/alignsynch/pull/326))
- `feat(console)` — /dashboard counts the viewer's own rows and links each number to its list ([#325](https://github.com/riolabs-ai/alignsynch/pull/325))
- `feat(console)` — the operator's relationship registry, behind the first requireAdmin surface ([#324](https://github.com/riolabs-ai/alignsynch/pull/324))
- `feat(console)` — the Gap across completed relationships, nameless and complete-only ([#323](https://github.com/riolabs-ai/alignsynch/pull/323))
- `feat(db)` — the three columns the console needs, all nullable and unfilled ([#322](https://github.com/riolabs-ai/alignsynch/pull/322))
- `feat(billing)` — the plan cards start a real checkout (#289) ([#315](https://github.com/riolabs-ai/alignsynch/pull/315))
- `feat(billing)` — the test-mode hosted adapter, its webhook, and .env.example (#289) ([#310](https://github.com/riolabs-ai/alignsynch/pull/310))
- `feat(invite)` — re-invite revokes and replaces the token, behind a 24h cooldown and a cap (#275) ([#303](https://github.com/riolabs-ai/alignsynch/pull/303))
- `feat(billing)` — a provider-free port, an offline adapter, and the plan gate ([#289](https://github.com/riolabs-ai/alignsynch/pull/289))
- `feat(legal)` — /terms and /privacy, version 1 draft, wired on both brands (#270) ([#296](https://github.com/riolabs-ai/alignsynch/pull/296))
- `feat(assessment)` — the report's three gap groups, a verdict band, and one stage sentence (#274) ([#301](https://github.com/riolabs-ai/alignsynch/pull/301))
- `feat(assessment)` — the answer input is a five-segment radio group (#273) ([#297](https://github.com/riolabs-ai/alignsynch/pull/297))
- `feat(invite)` — the initiator is told their invitation expired (#266) ([#283](https://github.com/riolabs-ai/alignsynch/pull/283))
- `feat(shell)` — show the app version, linked to its release tag (#269) ([#285](https://github.com/riolabs-ai/alignsynch/pull/285))
- `feat(assessment)` — four stages, derived — 4-6 documented as undefined (#261) ([#276](https://github.com/riolabs-ai/alignsynch/pull/276))
- `feat(assessment)` — the Soft/Full Setting is a lens over the Gaps (#259) ([#264](https://github.com/riolabs-ai/alignsynch/pull/264))
- `feat(assessment)` — the other party hears when the second answer lands (#258) ([#262](https://github.com/riolabs-ai/alignsynch/pull/262))
- `feat(invite)` — the invitation link has a copy control that never fails silently (#257) ([#260](https://github.com/riolabs-ai/alignsynch/pull/260))
- `feat(assessment)` — a person can author their own template (#255) ([#256](https://github.com/riolabs-ai/alignsynch/pull/256))
- `feat(assessment)` — the list marks an unlock you have not read (#252) ([#254](https://github.com/riolabs-ai/alignsynch/pull/254))
- `feat(brand)` — every route's share preview is the brand's own 1200x630 card (#187) ([#251](https://github.com/riolabs-ai/alignsynch/pull/251))
- `feat(assessment)` — creating or claiming an instance binds the caller's account (#213) ([#248](https://github.com/riolabs-ai/alignsynch/pull/248))
- `feat(brand)` — the palette has one home, enforced, and each brand has its own tab icon (#187) ([#246](https://github.com/riolabs-ai/alignsynch/pull/246))
- `feat(assessment)` — the report draws the glossary's eight Gap kinds (#219) ([#243](https://github.com/riolabs-ai/alignsynch/pull/243))
- `feat(assessment)` — a signed-in party can find the instances they are in (#213) ([#238](https://github.com/riolabs-ai/alignsynch/pull/238))
- `feat(brand)` — the affiliate and profile surfaces read the brand record (#187 stage 3) ([#236](https://github.com/riolabs-ai/alignsynch/pull/236))
- `feat(demo)` — /demo is a PIN gate, and /login draws the role buttons behind a signed unlock (#218) ([#235](https://github.com/riolabs-ai/alignsynch/pull/235))
- `feat(assessment)` — an instance records its mode, and asks the sheet it defines (#213) ([#234](https://github.com/riolabs-ai/alignsynch/pull/234))
- `feat(gate)` — a client component cannot reach the database, and the gate knows (#228) ([#233](https://github.com/riolabs-ai/alignsynch/pull/233))
- `feat(brand)` — the home, category and creator-tip bands read the brand record (#187 stage 2) ([#217](https://github.com/riolabs-ai/alignsynch/pull/217))
- `feat(search)` — the /search body is the brand's words, not the quiz product's (#156 follow-up) ([#201](https://github.com/riolabs-ai/alignsynch/pull/201))
- `feat(media)` — the profile cover is drawn from the handle, not one shared PNG (#130) ([#206](https://github.com/riolabs-ai/alignsynch/pull/206))
- `feat(demo-auth)` — a PIN-gated panel that signs in without sending a password (#183 part 2) ([#208](https://github.com/riolabs-ai/alignsynch/pull/208))
- `feat(shell)` — the footer speaks the brand's vocabulary, and "Quizes" is spelled right (#188) ([#195](https://github.com/riolabs-ai/alignsynch/pull/195))
- `feat(brand)` — the chrome, the assessment flow and the 404 read the brand record (#187 stage 1) ([#200](https://github.com/riolabs-ai/alignsynch/pull/200))
- `feat(demo)` — a reset that is one restore, a nightly reseed, and the docs (#185) ([#198](https://github.com/riolabs-ai/alignsynch/pull/198))
- `feat(flags)` — an admin reaches a surface the flag hides (#184) ([#199](https://github.com/riolabs-ai/alignsynch/pull/199))
- `feat(demo-auth)` — one role, a 404-not-403 gate, and three seeded demo accounts (#183 part 1) ([#189](https://github.com/riolabs-ai/alignsynch/pull/189))
- `feat(parity)` — a hash manifest and a summary instead of 1.4 MB of HTML (#171) ([#182](https://github.com/riolabs-ai/alignsynch/pull/182))
- `feat(shell)` — the rest of the chrome is the brand's, not the quiz product's (#156) ([#186](https://github.com/riolabs-ai/alignsynch/pull/186))
- `feat(media)` — one resolver, three tiers, and a fault-tolerant fallback (#155, phase 1) ([#180](https://github.com/riolabs-ai/alignsynch/pull/180))
- `feat(bundles)` — a template or a demo dataset as one versioned file, exported and imported (#147) ([#179](https://github.com/riolabs-ai/alignsynch/pull/179))
- `feat(flags)` — a surface on or off per template without a code change (#175) ([#181](https://github.com/riolabs-ai/alignsynch/pull/181))
- `feat(shell)` — navigation is brand- and capability-aware, not quiz-only (#156) ([#177](https://github.com/riolabs-ai/alignsynch/pull/177))
- `feat(registry)` — every mocked surface catalogued as a template resource (#173) ([#178](https://github.com/riolabs-ai/alignsynch/pull/178))
- `feat(assessment)` — the two-party flow — create, invite, answer blind, unlock the Gap (#146) ([#174](https://github.com/riolabs-ai/alignsynch/pull/174))
- `feat(tokens)` — tighter product surface in the Tailwind root (#160) ([#170](https://github.com/riolabs-ai/alignsynch/pull/170))
- `feat(identity)` — real sessions behind login, register, settings and profile (#164) ([#172](https://github.com/riolabs-ai/alignsynch/pull/172))
- `feat(marketing)` — a public landing page in its own chrome, no sidebar (#159) ([#169](https://github.com/riolabs-ai/alignsynch/pull/169))
- `feat(media)` — avatars are initials on a seed-derived gradient, nine duplicate files deleted (#152) ([#168](https://github.com/riolabs-ai/alignsynch/pull/168))
- `feat(db)` — six content tables, the DB-backed assessment screen, and the db scripts (#145) ([#166](https://github.com/riolabs-ai/alignsynch/pull/166))
- `feat(editorial)` — news, creator tips and support read article records (#165) ([#167](https://github.com/riolabs-ai/alignsynch/pull/167))
- `feat(theme)` — light default, AlignSynch tokens on white (#157) ([#162](https://github.com/riolabs-ai/alignsynch/pull/162))
- `feat(media)` — avatars are initials on a seed-derived gradient (#152, part 1) ([#161](https://github.com/riolabs-ai/alignsynch/pull/161))

### Fixed

- `fix(shell)` — the public pages stop carrying the app shell, and the sidebar is fixed (#317) ([#320](https://github.com/riolabs-ai/alignsynch/pull/320))
- `fix(release)` — cut and publish a pre-release, and order versions by semver ([#319](https://github.com/riolabs-ai/alignsynch/pull/319))
- `fix(support)` — the FAQ answers in each product's words, not the quiz product's ([#321](https://github.com/riolabs-ai/alignsynch/pull/321))
- `fix(support)` — one category taxonomy per product, and the select reads it (#309) ([#316](https://github.com/riolabs-ai/alignsynch/pull/316))
- `fix(shell)` — the four surfaces that advertise /affiliate follow the flag (#291 follow-up) ([#313](https://github.com/riolabs-ai/alignsynch/pull/313))
- `fix(news)` — the accessibility article stops selling a tab and three features, and the creator profile gets a subject that exists ([#314](https://github.com/riolabs-ai/alignsynch/pull/314))
- `fix(support)` — the help centre is per product and documents only what ships (#309) ([#312](https://github.com/riolabs-ai/alignsynch/pull/312))
- `fix(brand)` — gate the quiz product's routes off the alignsynch build (#300) ([#306](https://github.com/riolabs-ai/alignsynch/pull/306))
- `fix(news)` — the championship stops selling a tab and a plan, the monetization article drops invented creators ([#311](https://github.com/riolabs-ai/alignsynch/pull/311))
- `fix(news)` — the analytics article stops selling a plan tier and a tab that do not exist ([#308](https://github.com/riolabs-ai/alignsynch/pull/308))
- `fix(copy)` — sign-up asks nothing about quizzes, the 404 states a true fact, /affiliate is gated (#291) ([#307](https://github.com/riolabs-ai/alignsynch/pull/307))
- `fix(news)` — the AI quiz-creation article stops selling a suite we do not ship ([#304](https://github.com/riolabs-ai/alignsynch/pull/304))
- `fix(support)` — the contact form is disconnected, and says so (#290) ([#302](https://github.com/riolabs-ai/alignsynch/pull/302))
- `fix(support)` — the FAQ answers what the app does, not a business it never ran (#288) ([#295](https://github.com/riolabs-ai/alignsynch/pull/295))
- `fix(pricing)` — intended rates, real CTAs, and no trial the build cannot honour (#289) ([#299](https://github.com/riolabs-ai/alignsynch/pull/299))
- `fix(shell)` — the footer, the rail and the login card stop drawing links that go nowhere (#272) ([#298](https://github.com/riolabs-ai/alignsynch/pull/298))
- `fix(create)` — the generator builds a draft from templates, and stops claiming a model (#287) ([#294](https://github.com/riolabs-ai/alignsynch/pull/294))
- `fix(pricing)` — the FAQ answers only what the build can do (#286) ([#292](https://github.com/riolabs-ai/alignsynch/pull/292))
- `fix(assessment)` — Aligned is stage 4 — two ladders, not a missing row (#261) ([#284](https://github.com/riolabs-ai/alignsynch/pull/284))
- `fix(pricing)` — the security answer states what the app does, not what it never did (#271) ([#282](https://github.com/riolabs-ai/alignsynch/pull/282))
- `fix(copy)` — the marketing page stops denying the database (#265) ([#279](https://github.com/riolabs-ai/alignsynch/pull/279))
- `fix(invite)` — a refused email is not a missing key (#220) ([#253](https://github.com/riolabs-ai/alignsynch/pull/253))
- `fix(shell)` — the sidebar context has one specifier, not two (#242) ([#247](https://github.com/riolabs-ai/alignsynch/pull/247))
- `fix(copy)` — the footer and the meta description stop selling the Gap (#239) ([#241](https://github.com/riolabs-ai/alignsynch/pull/241))
- `fix(brand)` — the preview dialog's primary button reads the action token ([#240](https://github.com/riolabs-ai/alignsynch/pull/240))
- `fix(copy)` — the login hero ends at the Gap, not on its own slogan (#232) ([#237](https://github.com/riolabs-ai/alignsynch/pull/237))
- `fix(auth)` — the sign-in screen speaks its own brand, and the fake player count goes (#225) ([#231](https://github.com/riolabs-ai/alignsynch/pull/231))
- `fix(identity)` — "My Profile" opens the session's own handle, not a fixture (#226) ([#230](https://github.com/riolabs-ai/alignsynch/pull/230))
- `fix(demo)` — a refused sign-in says what happened, not "wrong PIN" (#216) ([#224](https://github.com/riolabs-ai/alignsynch/pull/224))
- `fix(shell)` — the signed-in avatar is the session's person, not a fixture (#212) ([#221](https://github.com/riolabs-ai/alignsynch/pull/221))
- `fix(demo)` — the reset names its source, and a source must be able to seed (#185) ([#223](https://github.com/riolabs-ai/alignsynch/pull/223))
- `fix(invite)` — a claim binds one party and never reassigns a session (#202) ([#211](https://github.com/riolabs-ai/alignsynch/pull/211))
- `fix(flags)` — the shell stops advertising a surface the flag hides (#175 follow-up) ([#209](https://github.com/riolabs-ai/alignsynch/pull/209))
- `fix(auth)` — an origin rejection says so, and a dev branch trusts 127.0.0.1 (#203) ([#207](https://github.com/riolabs-ai/alignsynch/pull/207))
- `fix(demo)` — the reset source is a schema-only base, never production (#185) ([#210](https://github.com/riolabs-ai/alignsynch/pull/210))
- `fix(demo)` — the demo holds the bundle and nothing else (#185, follow-up) ([#205](https://github.com/riolabs-ai/alignsynch/pull/205))
- `fix(release)` — the entry parser stops at the link footer, and the check stops racing SIGPIPE ([#144](https://github.com/riolabs-ai/alignsynch/pull/144))

### Maintenance

- `docs` — codify the template doctrine — one core, many expressions ([#318](https://github.com/riolabs-ai/alignsynch/pull/318))
- `docs` — account-deletion spec — a shared record when one side leaves (#278) ([#293](https://github.com/riolabs-ai/alignsynch/pull/293))
- `docs` — seven research specs, and SPEC-DRIFT corrected on review ([#277](https://github.com/riolabs-ai/alignsynch/pull/277))
- `docs` — SPEC-DRIFT, the specification against the build, tiered ([#268](https://github.com/riolabs-ai/alignsynch/pull/268))
- `docs` — the specification's mockups, with an index that says what is worth borrowing ([#267](https://github.com/riolabs-ai/alignsynch/pull/267))
- `refactor(lexicon)` — components/ and app/ name the record, not the quiz (#188) ([#249](https://github.com/riolabs-ai/alignsynch/pull/249))
- `docs(readme)` — the README opens with the product itself (#197) ([#250](https://github.com/riolabs-ai/alignsynch/pull/250))
- `docs(readme)` — the opener states the idea without the kicker (#244) ([#245](https://github.com/riolabs-ai/alignsynch/pull/245))
- `copy(alignsynch)` — a template nobody answered stops promising a copy button ([#229](https://github.com/riolabs-ai/alignsynch/pull/229))
- `perf(assessment)` — one round trip per render, and an honest screen when the database does not answer (#204) ([#227](https://github.com/riolabs-ai/alignsynch/pull/227))
- `copy(alignsynch)` — the home page reads as prose, not a spec ([#222](https://github.com/riolabs-ai/alignsynch/pull/222))
- `docs(readme)` — a demo reset replaces the branch, trusted domains included (#214) ([#215](https://github.com/riolabs-ai/alignsynch/pull/215))
- `refactor(lexicon)` — the platform's own words, not the template's (#188) ([#194](https://github.com/riolabs-ai/alignsynch/pull/194))
- `docs(readme)` — describe the product, not the arrangement (#193) ([#196](https://github.com/riolabs-ai/alignsynch/pull/196))
- `docs(readme)` — rewrite as the AlignSynch whitelabel template (#190) ([#192](https://github.com/riolabs-ai/alignsynch/pull/192))

### Known limits

- **No account deletion.** There is no self-service way to delete an account or its assessments. `/privacy` and `/terms` state this and route a request to the support address; the spec for building it is #278 and it is not in this candidate.
- **Billing was verified on the mock driver only.** The entitlement gate was proved against Postgres (`free` refused a second active assessment and Advanced Mode, `pro` allowed both) and a mock checkout wrote a real subscription row. The repo's `.env.local` carries a Stripe **test** key, but `STRIPE_TEST_WEBHOOK_SECRET` is empty, and the Stripe adapter refuses to start a checkout it cannot apply — so no hosted test-card payment was completed for this candidate. The pricing page says "Test mode" wherever the checkout is drawn.
- **No coaches.** The Coach is a word in the product's vocabulary and a feature in no file; `/welcome` says so on the page.
- **No desktop app.** The Tauri shell is deferred (#280); the candidate is the web build only. There is no iOS or Android build.
- **The demo PIN is public.** `/demo` is mounted because `DEMO_AUTH=1`, and its four-digit PIN is published in the repository. It signs into a seeded demo account on the demo branch, not into a customer's data: every account, assessment and invitation in that database is regenerated from fixtures.
- **The live domain was not verified for this candidate.** Vercel's Hobby deployment quota blocked new deploys while the candidate was cut, so `alignsynch.com` was serving an earlier commit. Every check in this entry was taken against a local production build of the tag (`BRAND=alignsynch` and `BRAND=quizhub`), not against the deployed domain. The version badge on `/login` links to this exact tag, and the tag exists before the deploy does.

## [1.0.0] - 2026-10-30

### Added

- `feat(brand)` — the document description is a Brand field (#151) ([#153](https://github.com/riolabs-ai/alignsynch/pull/153))
- `feat(home)` — the AlignSynch build leads with the two questions (#143) ([#150](https://github.com/riolabs-ai/alignsynch/pull/150))
- `feat(brand)` — palette and mark sampled from the AlignSynch logo (#136) ([#142](https://github.com/riolabs-ai/alignsynch/pull/142))
- `feat(media)` — category tiles generated from the slug; delete the 23 duplicates (#130) ([#137](https://github.com/riolabs-ai/alignsynch/pull/137))
- `feat(assessment)` — render the answered Avery/Rowan instance at /assessment/[slug] ([#134](https://github.com/riolabs-ai/alignsynch/pull/134))
- `feat(data)` — assessment templates for three Relationship Types and four instances (#131) ([#133](https://github.com/riolabs-ai/alignsynch/pull/133))
- `feat(content)` — one record type, two templates — a quiz and an assessment (#128) ([#129](https://github.com/riolabs-ai/alignsynch/pull/129))
- `feat(brand)` — a second brand record, and one build flag that selects it ([#127](https://github.com/riolabs-ai/alignsynch/pull/127))
- `feat(brand)` — every QuizHub literal reads the brand record ([#126](https://github.com/riolabs-ai/alignsynch/pull/126))
- `feat(brand)` — data/brand.ts — the record the reskin reads ([#125](https://github.com/riolabs-ai/alignsynch/pull/125))
- `feat(tournaments)` — tournament copy comes from PageCopy, and the domain stays out (#58) ([#89](https://github.com/riolabs-ai/alignsynch/pull/89))
- `feat(pages)` — marketing copy out of JSX into PageCopy (#56) ([#94](https://github.com/riolabs-ai/alignsynch/pull/94))
- `feat(battle)` — modes and daily-challenge rewards are records, and the copy moves to PageCopy (#57) ([#92](https://github.com/riolabs-ai/alignsynch/pull/92))
- `feat(copy)` — shell, auth and 404 copy comes from PageCopy (#54) ([#96](https://github.com/riolabs-ai/alignsynch/pull/96))
- `feat(copy)` — categories and explore copy come from PageCopy fixtures (WU-8, #55) ([#88](https://github.com/riolabs-ai/alignsynch/pull/88))
- `feat(taxonomy)` — labels come from the schema, and data:check E20 enforces it (#50) ([#73](https://github.com/riolabs-ai/alignsynch/pull/73))
- `feat(leaderboard)` — one people fixture instead of six islands of their own records (#48) ([#77](https://github.com/riolabs-ai/alignsynch/pull/77))
- `feat(quiz)` — a record's detail page renders its own leaderboard and reviews (WU-2 follow-up, #75) ([#83](https://github.com/riolabs-ai/alignsynch/pull/83))
- `feat` — fixture generator (npm run gen) ([#71](https://github.com/riolabs-ai/alignsynch/pull/71))
- `feat(home)` — PageCopy fixture + E23 copy ratchet, home copy out of JSX (#53) ([#79](https://github.com/riolabs-ai/alignsynch/pull/79))
- `feat(quiz)` — the quiz surface reads the fixture, not a per-page mock (WU-2, #51) ([#76](https://github.com/riolabs-ai/alignsynch/pull/76))
- `feat` — typed media registry ([#65](https://github.com/riolabs-ai/alignsynch/pull/65))
- `feat(data)` — author the two Science overlays + E14/E15/E16/W6 promotion checks (B-01) ([#39](https://github.com/riolabs-ai/alignsynch/pull/39))
- `feat(data)` — port the 42-record migrated quiz collection into data/ (B-01 prerequisite) ([#26](https://github.com/riolabs-ai/alignsynch/pull/26))
- `feat(content)` — zQuizPromotion — per-slot campaign overlay merged in selectQuizCard (B-01) ([#21](https://github.com/riolabs-ai/alignsynch/pull/21))

### Fixed

- `fix(play)` — /quiz/<id>/play plays the quiz the URL names (#132) ([#135](https://github.com/riolabs-ai/alignsynch/pull/135))
- `fix(data)` — published quizzes carry questions, a date and a reward window ([#124](https://github.com/riolabs-ai/alignsynch/pull/124))
- `fix(profile)` — /profile/<username> resolves the handle from data/players.ts (#111) ([#123](https://github.com/riolabs-ai/alignsynch/pull/123))
- `fix(copy)` — QuizHub everywhere the copy renders, and no stray space after it ([#122](https://github.com/riolabs-ai/alignsynch/pull/122))
- `fix(routes)` — unknown ids 404 on /categories, /news and /tournaments (#112) ([#116](https://github.com/riolabs-ai/alignsynch/pull/116))
- `fix(promotions)` — anchor the campaign window to the fixture clock (#110) ([#121](https://github.com/riolabs-ai/alignsynch/pull/121))
- `fix(metadata)` — real document title on every route (#113) ([#115](https://github.com/riolabs-ai/alignsynch/pull/115))
- `fix(shell)` — mobile sidebar is CSS-closed below xl, drawer is its own state (#109) ([#119](https://github.com/riolabs-ai/alignsynch/pull/119))
- `fix(ci)` — fetch origin/main so the lane classifier actually runs in CI ([#114](https://github.com/riolabs-ai/alignsynch/pull/114))
- `fix(data-check)` — one code, one rule — E17 is the media registry, the slot guard is E28 (#103) ([#105](https://github.com/riolabs-ai/alignsynch/pull/105))
- `fix(images)` — the five next/image size bugs, and a gate for the rule ([#99](https://github.com/riolabs-ai/alignsynch/pull/99))
- `fix(p3)` — gen emits quizzes only, and data:check says why (E17/E26) ([#100](https://github.com/riolabs-ai/alignsynch/pull/100))
- `fix(chat)` — format fixture times against one clock, not the wall clock ([#23](https://github.com/riolabs-ai/alignsynch/pull/23))
- `fix(content)` — point the 11 baselined asset refs at files that exist ([#28](https://github.com/riolabs-ai/alignsynch/pull/28))
- `fix(qa)` — the pre-existing 404s and the Next 16 sync params (closes #20) ([#25](https://github.com/riolabs-ai/alignsynch/pull/25))
- `fix(seo)` — generate real metadata for /categories/[slug] (D14) ([#17](https://github.com/riolabs-ai/alignsynch/pull/17))

### Maintenance

- `docs` — add the AlignSynch glossary v2 as a reference PDF ([#149](https://github.com/riolabs-ai/alignsynch/pull/149))
- `docs(glossary)` — the glossary page is generated from the schema comments (#138) ([#141](https://github.com/riolabs-ai/alignsynch/pull/141))
- `chore(issues)` — three issue templates — feature, bug, new template type (#139) ([#140](https://github.com/riolabs-ai/alignsynch/pull/140))
- `docs(lanes)` — CI's win is the check's wall time, not contention ([#120](https://github.com/riolabs-ai/alignsynch/pull/120))
- `docs(gate)` — CI classifies now — record the measured lanes ([#118](https://github.com/riolabs-ai/alignsynch/pull/118))
- `docs(qa)` — P4 dogfood pass — every route, defects 1-5 with evidence ([#108](https://github.com/riolabs-ai/alignsynch/pull/108))
- `docs(p3)` — exit record with reproducible evidence ([#107](https://github.com/riolabs-ai/alignsynch/pull/107))
- `docs(data-model)` — tournaments are PageCopy-only and out of scope (#58) ([#106](https://github.com/riolabs-ai/alignsynch/pull/106))
- `test(vitest)` — adopt Vitest and the first app-side units, wired into the one gate (#8) ([#98](https://github.com/riolabs-ai/alignsynch/pull/98))
- `docs(p1)` — refresh ENV-SPEC §5 evidence and record what B-01 actually landed (#43) ([#97](https://github.com/riolabs-ai/alignsynch/pull/97))
- `docs(p2)` — the inventory says WU-7, WU-8 and WU-9 landed (#54/#55/#56) ([#102](https://github.com/riolabs-ai/alignsynch/pull/102))
- `docs(p2)` — the inventory says WU-10 landed, not that it is next (#57) ([#101](https://github.com/riolabs-ai/alignsynch/pull/101))
- `chore(git)` — ignore .worktrees/ ([#93](https://github.com/riolabs-ai/alignsynch/pull/93))
- `docs(readme)` — setup, prerequisites, the gate, the four layers and current phase (#7) ([#95](https://github.com/riolabs-ai/alignsynch/pull/95))
- `docs(p1)` — keep images.unoptimized and record why (#6) ([#91](https://github.com/riolabs-ai/alignsynch/pull/91))
- `docs` — lib/quizhub is vendored and ignored, not generated ([#90](https://github.com/riolabs-ai/alignsynch/pull/90))
- `build(pnpm)` — pin the package manager to 12.16.1 in package.json (#4) ([#87](https://github.com/riolabs-ai/alignsynch/pull/87))
- `docs(orchestration)` — the orchestrator's behavioural contract ([#86](https://github.com/riolabs-ai/alignsynch/pull/86))
- `docs(p2)` — the ranked list records WU-1, WU-2 and WU-4 as landed ([#85](https://github.com/riolabs-ai/alignsynch/pull/85))
- `docs(p2)` — record WU-5 as landed and E20's DUP tier at 0 ([#84](https://github.com/riolabs-ai/alignsynch/pull/84))
- `ci(gate)` — lanes — depth follows the diff, next build capped at 2 slots ([#82](https://github.com/riolabs-ai/alignsynch/pull/82))
- P2 WU-4 · invented metrics → computed analytics (#49) ([#80](https://github.com/riolabs-ai/alignsynch/pull/80))
- `refactor(search)` — derive the search index, bind chat to its fixture (WU-3, #52) ([#72](https://github.com/riolabs-ai/alignsynch/pull/72))
- `docs(p2)` — record WU-12's deletion in the inventory, not its dead paths ([#74](https://github.com/riolabs-ai/alignsynch/pull/74))
- `docs(agents)` — rejoin the CI sentence the #33 resolution split ([#69](https://github.com/riolabs-ai/alignsynch/pull/69))
- P3: pass the slot campaign into the card projections (shelves + detail-page prize) ([#41](https://github.com/riolabs-ai/alignsynch/pull/41))
- `chore(components)` — delete 14 components no route imports (#47) ([#66](https://github.com/riolabs-ai/alignsynch/pull/66))
- `ci` — one gate script, one caller in CI, one pre-push hook (ORD 0) ([#33](https://github.com/riolabs-ai/alignsynch/pull/33))
- `docs` — P2 literal-string and media inventory ([#59](https://github.com/riolabs-ai/alignsynch/pull/59))
- `docs(mimo)` — MiMo harness guide + reproducible probe suite ([#38](https://github.com/riolabs-ai/alignsynch/pull/38))
- `ci` — trigger on merge_group so the merge queue can report the required check ([#44](https://github.com/riolabs-ai/alignsynch/pull/44))
- `docs` — data model design page (ORD 2) ([#45](https://github.com/riolabs-ai/alignsynch/pull/45))
- `chore(deps)` — pin the 13 "latest" specs to their locked versions ([#14](https://github.com/riolabs-ai/alignsynch/pull/14))
- `docs(ops)` — voice memo → issue → card loop, and where Xiaomi stops (#32) ([#34](https://github.com/riolabs-ai/alignsynch/pull/34))
- `docs(p1)` — record the promotion rules, the W4 code collision and the shelf gap (B-01) ([#40](https://github.com/riolabs-ai/alignsynch/pull/40))
- P1: render every card grid from the quiz model (D2 remainder) ([#24](https://github.com/riolabs-ai/alignsynch/pull/24))
- `docs` — verify the command table, record P1 gates, fix the dev-only image crash ([#18](https://github.com/riolabs-ai/alignsynch/pull/18))
- `ci` — enforce data:check in the gate ([#36](https://github.com/riolabs-ai/alignsynch/pull/36))
- P1: zod content model as the single source of truth (closes #10) ([#16](https://github.com/riolabs-ai/alignsynch/pull/16))
- `chore(format)` — gate formatting in lint and CI
- `style` — reformat the repo at lineWidth 100 with Biome
- Toolchain: Biome + typecheck + CI (closes #2, #3) ([#12](https://github.com/riolabs-ai/alignsynch/pull/12))
- Initial commit

### Known limits

- **No authentication and no database.** Every route reads the TypeScript fixtures in `data/` that are compiled into the build. `/login` and `/register` are screens, not a session: the sign-in button routes to `/`, and there is no `app/api`, no server action and no database dependency anywhere in the tree.
- **No create, invite or answer flow.** Nothing a visitor does is stored — the quiz editor's save is a toast. The alignment screen `/assessment/[slug]` is a read of a seeded fixture, prerendered at build time.
- **The four templates and four seeded instances exist in data; none of them can be started or answered.** All four instances have a read-only screen at `/assessment/[slug]` (`avery-rowan`, `ruth-sam`, `marco-priya`, `noor-iris`), and the AlignSynch front page links three of them. There is no invite, no second party, and no way to copy a template into a new Relationship.

[1.0.0]: https://github.com/riolabs-ai/alignsynch/releases/tag/v1.0.0
[1.1.0-rc1]: https://github.com/riolabs-ai/alignsynch/compare/v1.0.0...v1.1.0-rc1
[1.2.0]: https://github.com/riolabs-ai/alignsynch/compare/v1.1.0-rc1...v1.2.0
[1.3.0]: https://github.com/riolabs-ai/alignsynch/compare/v1.2.0...v1.3.0
[1.7.0]: https://github.com/riolabs-ai/alignsynch/compare/v1.6.0...v1.7.0
[1.8.0]: https://github.com/riolabs-ai/alignsynch/compare/v1.7.0...v1.8.0
[1.14.0]: https://github.com/riolabs-ai/alignsynch/compare/v1.13.0...v1.14.0
[1.16.0]: https://github.com/riolabs-ai/alignsynch/compare/v1.15.0...v1.16.0
