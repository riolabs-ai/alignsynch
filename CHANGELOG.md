# Changelog

Every release of AlignSynch, newest first. The format is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the versions are [semantic versioning](https://semver.org/spec/v2.0.0.html). The entries are generated from the
conventional commits on `main` by [`scripts/release.sh`](scripts/release.sh) — fix the commit, not this file —
and each `## [x.y.z] - <date>` block is also the body of its GitHub Release, byte for byte. Every entry ends
with a **Known limits** block, because a release that does not say what it cannot do reads as a claim that it can.

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
