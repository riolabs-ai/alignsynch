# UI registry

<!-- docs-nav:begin -->

[Docs hub](README.md) › **Reference** › UI registry · prev [Relationship types](reference/relationship-types-source.md)

<!-- docs-nav:end -->

Every surface this tree can render, as a resource a template can pick from rather than a set of screens somebody has to remember. This page is generated: do not edit it.

It has two halves, and each one is owned by a different place:

- **structural** — every component domain with its file count and files, and which routes import it. Derived from `components/` and `app/` by `scripts/gen-ui-registry.mjs` on every run; never typed.
- **judgement** — `status`, `templates`, `capability` and an optional `notes` per surface, in `data/ui-registry.ts`, zod-validated. One entry per surface, and a surface is a route or a component domain, never a file.

`bash scripts/verify.sh` regenerates the page and compares it byte for byte, then checks the two halves against each other: a surface in the tree with no entry fails, an entry for a surface that is gone fails, and a `status` the surface's own imports contradict fails. `pnpm ui:registry` is how you fix any of them.

**`templates` is a scope decision, not a render fact.** Both brands render this one route table — `data/brand.ts` swaps a record, not a page — so a surface is listed here under a template when that template's product story needs it: a quiz-specific implementation is QuizHub's, the alignment product's is AlignSynch's, and a surface both need unchanged is under both. A surface no template claims yet has an empty list and sits in _No template yet_, which is where a candidate for the next vertical starts its life.

How a template picks from this page — the order a new surface is decided in — is [`guides/template-doctrine.md`](guides/template-doctrine.md): one core, many expressions.

## Summary

- routes: **103** — 65 static, 38 dynamic, from `app/**/page.tsx`
- component domains: **44** — 402 files under `components/`, 393 of them `.tsx`
- route handlers: **31** — `app/**/route.ts`, listed below and not a UI surface
- status: **mock** 15 · **fixture** 78 · **db** 45 · **live** 8 · **prototype** 1
- templates: Both templates 53 · AlignSynch 50 · QuizHub 42 · No template yet 2
- capability written as `undocumented`: **0**

Status is the judgement half and the wiring is what checks it: `db` reaches `lib/db/`, `live` reaches an `/api` write, `fixture` reaches a module under `data/`, and `mock` reaches no `lib/db/` module and no record fixture — the media registry is an asset and page copy is copy, so a surface whose numbers are literals is still a stand-in.

Two things this page deliberately does not own. The app's own route table is `content/routes.ts` (E10 holds it to the filesystem); the route list here is derived from `app/` again rather than read out of that table, so the two can never be a copy of each other. And the media a surface draws is `data/media.ts`, generated from `public/` — a domain here says which files it has, never which images it addresses.

## Undocumented

None: every catalogued surface has a `capability` sentence. A surface nobody has described belongs here — write `undocumented` as its `capability` and the summary above counts it — rather than inventing one.

## Both templates

### Routes

- `/` — **fixture**
  - capability: The front page: QuizHub leads with category, latest and featured shelves, top players and live winners; AlignSynch leads with the practice a coach runs — a template of their own, a blind two-sided answer and the Gap as the session's agenda — and backs it with the four assessment templates, the counted relationship scope and the three seats on a relationship.
  - components: `components/categories`, `components/home`, `components/media`, `components/ui`
  - reads: an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`

- `/admin/audit` — **db**
  - capability: The audit log: every audited admin write, newest first — when, who and the rung they held at the moment they acted, the action, the row it touched, the reason and both sides of the change — filterable by actor, action, target table and date range, with the filter in the URL so a view is a link.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/admin-audit.ts`, `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Read-only, and structurally so: it reads `admin_action` through `lib/db/admin-audit.ts`, imports no write path, and `tests/admin-audit-page.test.ts` drives a `support` session at it to prove the 404 and that nothing was read or written. `admin` and `owner` reach it (the ladder is ranked, and the page names only `admin`). Both templates this tree ships claim the `product.admin` capability (#509), which is why the row says both; the console rows beside it say `alignsynch` because those screens carry that product's words. `before`/`after` are drawn as keys and a 48-character truncation with the full value behind a `<details>` click, because the JSONB may hold a party's name. Filters are SQL (`WHERE` clauses built in `lib/admin/audit-log.ts`), not client-side: the log only grows. Migration 0024 adds the `actor_role` column this screen's actor column prints, written by `act()` in the same transaction as the change.

- `/admin/broadcast` — **db**
  - capability: A one-off notice to the news list — compose a subject and a text body, read it as the recipient will, run a dry run that reports how many addresses it would reach, and send it to everyone who has consented or only to those who joined since a date, with the audience, the exclusions and the count all decided in the server.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/news-signups.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #507 — the epic's last child, and the first surface that writes to `news_signup`'s list. **Consent is applied in the query, not to a rendered list**: `lib/db/news-signups.ts::broadcastAudience()` excludes an address only when `unsubscribed_at`, `bounced_at` or `complained_at` is set (0027's marks, plus the unsubscribe mark 0028 adds), and the dry run and the send call that one function, so the reported count and the sent count cannot drift. **No address reaches a client component**: the screen receives six counts and the newest twenty sends, and the send action answers `sent`/`failed` numbers. The send is one `act()` transaction (`broadcast.send`, floor `admin` — a `support` session gets `role-too-low` inside the transaction, not a hidden button) that writes `broadcast_send` and one `broadcast_recipient` row per address, and the audit row carries `bodyHash` and `recipientCount` rather than the body or the list. The per-address cooldown is 24 h and the cap is 200; over the cap refuses rather than truncating. `lib/email/key-mode.ts` resolves the deployment's key mode and a test key is refused by the action while the same answer is drawn as the banner — a banner is not the enforcement, the action is. The 0028 migration's `unsubscribed_at` contradicts 0019's "unsubscribe is a delete" on purpose, and the migration says why: a deleted row cannot be seeded, cannot be told from a signup that never happened, and cannot be re-marked.

- `/admin/docs` — **fixture**
  - capability: The documentation home: all 117 pages under `docs/` in the nine sections `docs/docs.json` groups them by, each with the question it answers, and a filter over their titles and questions.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/admin-docs.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/docs/rows.ts`, `lib/docs/tree.ts`
  - notes: #892 — a renderer of the manifest, never a second copy of it: `docs/` is untouched (no page moved, copied or re-authored), `lib/docs/manifest.ts` parses `docs/docs.json` (which `scripts/docs-check.mjs` already holds to the tree in both directions), `lib/docs/rows.ts` derives the rows, addresses and the filter, and `lib/docs/tree.ts` is the only module that touches `fs`. `status: fixture` is the wiring, not prose: the route reads the manifest and its page copy out of the tree and nothing reaches `lib/db/**`, so it is a stand-in in the registry's sense until a docs store exists — and the registry's own rule (`fixture` requires something under `data/`) is satisfied by `data/pages/admin-docs.ts`. `force-dynamic`, because prerendering 117 documents at build time is exactly what this route must not do; the manifest cannot be parsed → `DocsManifestUnreadable` is drawn as the screen's own panel. Both templates claim `product.admin` (#509), so `requireAdminProduct()` runs before `requireAdmin()`. `data/pages/admin-docs.ts` holds every word (E23 budget 0).

- `/admin/docs/[...slug]` — **fixture**
  - capability: One documentation page: the document rendered from `docs/**.md` where it is written, under its manifest title and the question it answers, with its section's siblings and the previous/next step.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `components/admin/docs/doc-article.tsx`, `components/admin/docs/doc-feedback.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/docs/rows.ts`, `lib/docs/tree.ts`
  - notes: #892 — the body is the file, read per request (`lib/docs/tree.ts::readDocDocument`, contained to `docs/` before the syscall) and rendered by `react-markdown`, which was already a dependency (`components/content/content-blocks.tsx`); no MDX toolchain, no Fumadocs, no new dependency. A href inside a document is rewritten by `lib/docs/links.ts`: a sibling markdown link becomes its `/admin/docs/…` address, an image reference becomes an `/api/docs/asset/…` address, external and `#anchor` links are untouched, and a link to a file the reader cannot serve renders as plain text rather than a 404. The catch-all because the tree nests (`wiki/modules/app-api.md`); an address the manifest does not carry is `notFound()`, never a fallback to the hub. The images are served by `app/api/docs/asset/[...path]/route.ts`, which carries the same two gates and answers 404 for anything that leaves `docs/` or is not an image. `metadata` is a value rather than `generateMetadata` on purpose: Next resolves head and body in parallel, so a title derived from the document would be computed before the gates. `data/pages/admin-docs-document.ts` holds every word (E23 budget 0).

- `/admin/docs/features` — **fixture**
  - capability: What has been built, grouped by area: every `feat(<area>)` scope in `CHANGELOG.md` as one card, each with the releases it shipped in and the pages under `docs/` that explain it — a figure grid over the areas, then the grouped cards behind it.
  - components: `components/admin`, `components/assessment-flow`, `components/console`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/admin-docs.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/docs/rows.ts`, `lib/docs/tree.ts`
  - notes: #893 — derived, never maintained. The areas come from the conventional commits (`lib/docs/changelog.ts::scopedCommits`, the same parser `scripts/changelog-view.mjs` imports), the releases beside them from `docs/changelog/releases.json` (`lib/docs/releases.ts::releaseRows`), a join that throws on a release with no judgement row rather than drawing it blank, and ignores a row with no release — a row alone cannot invent one — and the pages from the docs manifest by a stated rule: a search result must name _every token_ of the area, and the `changelog/` rows are excluded because they are the release notes rather than the writing about an area. So a release adds a card without an edit here — the card's own success test — and an undocumented area prints "no page names this area" instead of borrowing a neighbour. `status: fixture` is the copy fixture the E23 budget measures (`data/pages/admin-docs.ts`) plus the three files the tree owns; nothing reaches `lib/db/**`. `force-dynamic` because `CHANGELOG.md` is read on the visit; a source that cannot be parsed draws the screen's panel with the reason rather than an empty page. Both templates claim `product.admin` (#509), so `requireAdminProduct()` runs before `requireAdmin()`, and no clock is read in the render.

- `/admin/docs/releases` — **fixture**
  - capability: The release record, one release at a time: every release `CHANGELOG.md` holds, newest first, with the two one-line judgements `docs/changelog/releases.json` keeps beside it, the page the generator wrote from the entry, and which build is answering the request.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `app/(mainlayout)/admin/docs/releases/page.tsx`, `components/admin/docs/releases-shelf.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/admin-docs.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/build-info.ts`, `lib/docs/rows.ts`, `lib/docs/tree.ts`
  - notes: #893 — the `/admin/review` arrangement (`components/admin/review-artifacts.tsx`'s list-and-panes), with selection carried by the URL (`?release=1.17.1`) so a link somebody shares is the release it named; a version the record does not carry is `notFound()`, never the newest row wearing its name. The facts are the entry's (`date`, the tag, the PR count, its sections, whether it carries its Known limits block), `theme`/`headline` are the record's, and the build pair is `next.config.mjs`'s — read in process from `lib/build-info.ts`, the same function `GET /api/version` answers with, because a render may not open a socket. `inManifest` marks a release page `docs/docs.json` does not list, so the row prints the path and the gate's name instead of an anchor that 404s. `force-dynamic`; no clock in the render; `data/pages/admin-docs.ts` holds every word (E23 budget 0).

- `/admin/email-templates` — **db**
  - capability: The register of transactional mail, and what production is sending: one row per member-facing template — its class (transactional or marketing), the seat that receives it, whether the send path is on the code default, a published override or a draft waiting behind one, and who last edited it — with the row opening the template's editor.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #1138 — the ancestor is `/admin/templates` (`components/admin/template-registry.tsx`): the same `StageColumn`, the same header, the same row-link-to-an-editor, and the axis that varies is the data source plus the missing create band. **The rows come from the register, never from the table**: `lib/email/templates/index.ts` is the single source of truth and `memberFacingTemplates()` filters it, so a template added in code appears here with no edit to this file, and a `email_template_version` row whose id is no longer in the register is invisible rather than dangling. The operator's own `stakeholder-release-note` is excluded (`memberFacingTemplate()`), which is the issue's own scope line. **Two badges, not one**: a published override and a pending draft coexist, so the state column is what the send path reads and a quieter second badge marks the draft beside it — one badge would print a draft badge while production sent the older published words. `status: db` because the live rows are one statement (`listEmailTemplateLive()`, `DISTINCT ON (template_id, status)`); a database that cannot be read draws a panel naming the reason, never a list of `default` badges, because \"nothing is overridden\" and \"the overrides could not be read\" are different claims. Gates in `/admin/docs` order (`requireAdminProduct()` then `requireAdmin()`, a member answered with the 404 an unknown URL gets, never a 403), `force-dynamic`, and `data/pages/admin-email-templates.ts` holds every word at E23 budget 0.

- `/admin/email-templates/[id]` — **db**
  - capability: One transactional mail: its three editable fields (subject, preheader, body) with the template's own `{{placeholders}}` one click away, a live preview rendered through the real send band, the refused state when the words break a rule, Send Test to the signed-in admin's own address, Save draft · Publish · Reset to Default, and the version history with restore.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #1138 — the ancestor is `components/admin/template-editor.tsx` (one field set, then the save/publish pair); what varies is that the preview runs **through the real band** rather than a sample renderer, so what an admin reads is what a mailbox receives, and the history restores by saving a new version rather than by rewriting an old one. **The register stays the source of truth for everything but the body paragraph**: `renderTemplate(..., { override })` hands the override only to `bodyBlocks()`, so the template's own sentences and its band frame are not the admin's to delete. Three rule families are checked before any write and again in the action (`lib/email/override.ts::overrideProblems`): an unknown `{{variable}}`, a blank field, and the Counterparty's silence about price, trial, card, plan, extension and `$` — checked on the **rendered** words too, because a `{{plan}}` would hide behind a clean source. A save is refused, never partially applied: the screen prints each problem by name. Writes go through `act()` with `email-template.save|publish|reset` and an `email_template_version` audit row, and the actor is read from `currentUser()`, never from the payload. Test send writes nothing — it renders the sample facts with `mode test` and mails the signed-in admin at their own address, so it is not an `AdminAction`. A body that lives in code (`relationship-expired`) renders read-only with the reason instead of an empty textarea. Gates, `force-dynamic` and the copy fixture are the list's.

- `/admin/growth` — **fixture**
  - capability: Thirty-six monthly cohorts of a customer base on the way to a $3M run-rate, for an operator: the MRR → ARR ramp with the solved target drawn on it, cohort retention curves, the plan mix as the base matures, the two churn rates, and the final month's invoice outcomes per plan — every number read from one committed artifact.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #920 — the console's first _business_ surface, and the first chart band whose data is a fixture rather than a read. `data/demo/growth-model.json` is generated by `pnpm growth` (a solved acquisition index, 36 cohorts, integer cents and basis points) and `pnpm growth:check` is a gate step, so the committed bytes and `content/growth-model.ts` cannot drift; the page only reads and validates the file through `lib/admin/growth.ts`, and a missing or unparseable artifact draws a panel with the reason instead of zeroes. The scale is modelled and a ~5k-relationship _sample_ is materialised into `data/generated/growth/` (gitignored) — the demo branch stays bounded (#909), and the sample is drawn from the same distribution rather than scaled down from it. Admin only: `requireAdminProduct()` then `requireAdmin()`, so a `support` session gets the 404 `/demo/admin` documents. Charts are recharts through `components/ui/chart.tsx` — no new dependency — and the words are `data/pages/admin-growth.ts` (E23 budget 0). No Gap column is involved: the model is an aggregate over relationships, and the Gap stays a function. **URL-only since #1095**: the owner kept the page and removed its rail row — a screen charting a _simulated_ business is not an operator menu row — so `/admin/growth` is reached by typing the address. No redirect was added, no hub gained a link, and the route, the console, the copy fixture, the model, the artifact and the `growth:check` step are unchanged.

- `/admin/health` — **fixture**
  - capability: The platform's own health, for an operator: what the last db:verify run said (its failing rule codes exactly as the script prints them), the last gate lane and its CI first-pass yield, whether the tag, package.json and production are one release, and how far production trails main — every number labelled with the command or the recorded instant it came from.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `content/platform-health.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/admin/platform-health.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Read-only and read-only structurally: it imports no write path, renders no form and reads `data/health/platform-health.json` (written by `pnpm health:record`), `package.json` and three `git` answers. Live where a checkout exists (the tag, `origin/main`, the commit distance) and recorded where a deployment has no `.git`, which is why every value carries its own source line — a number with no source is a defect, not a rounding. Both templates claim `product.admin` (#509); `support` gets the 404 through `requireAdmin()`. Nothing here executes `db:verify` or calls the CI API during a render: the record is the artifact, and the recorder is the only writer.

- `/admin/inbox` — **db**
  - capability: The support inbox: every contact message with its triage status and assigned seat, one message's thread under the queue, the mail provider's verdict on the address, the contact form's throttle for that address, and three audited operations — reply through the site's own sending identity, move the status, assign the seat.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/admin-inbox.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/admin/inbox.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #506 — **the first `support` surface of the console**, and the reason the rung exists: `requireAdminProduct()`, then `requireRole("support")`, so a `member` gets the 404 a URL that never existed returns and a signed-out visitor is sent to `/login?next=/admin/inbox`. Every write is `act()`'s (`message.reply`, `message.assign`, `message.status`, all floor `support`), and the reply is deliberately **two audited transactions with the send between them**: the reply row is stored and the message moved to `waiting` before the provider is called, and `sent_at` lands only in the second transaction, under `0028`'s `contact_reply_sent_has_instant` CHECK — a 4xx leaves the message `waiting` with the provider's refusal stored on the reply and rendered under it. A hard bounce or a spam complaint (`email_event`, joined by recipient, hardness read through `lib/email/inbound.ts::bounceIsHard`) refuses the send in the screen _and_ in the server, with the sentence saying which. The throttle is derived rather than recorded — the 429 path writes nothing on purpose — from the messages the form did keep inside its window. No address is rendered anywhere a visitor can reach: the inbox is gated at `support` and no public page links to it.

- `/admin/permissions` — **fixture**
  - capability: The CRUD & Permissions matrix: one read-only row per object × action × role cell, with the prototype's answer beside what upstream already has, narrowed by Object · Role · Status · Priority in the address, and the eleven P0 gaps and the six role × action rules above it.
  - components: `components/admin`, `components/assessment-flow`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #1126 — the ancestor is `/admin/docs`: the same two gates in the same order (`requireAdminProduct()` before `requireAdmin()`, a member answered with the 404 an unknown URL gets and never a 403), `force-dynamic`, and one honest panel when the source cannot be read. The source is `docs/specs/v2-prototype/crud-matrix.md` (committed by #1158, 169 rows), parsed per request into the issue's own columns (`object, action, role, prototype, selector, upstream, mvp, rationale`) by `lib/admin/crud-matrix.ts`, which is pure and touches no filesystem so the view can label a row without pulling `node:fs` into the browser graph; `lib/admin/crud-matrix-file.ts` is the one module that opens the file and is unreachable from a client. The rank is read from a `priority` column when the header names one and otherwise from `mvp` — the committed source's shape, where `mvp` is the priority — so the counts band is derivable from a file that carries no ninth column; the table draws the columns the header names, which is eight for this source. Nothing is invented: an absent source draws the failure panel naming the path, a source that does not parse throws a named error with the line, an unknown status is refused rather than defaulted, and no row is fabricated to make the table look finished. Every figure in the counts band is `countsOf()`'s over the whole matrix (filters narrow the table, never the header), which is what makes `169 cells · 124 applicable · 69 covered / 9 hinted / 46 missing · 34 P0 / 23 P1 / 29 P2 / 15 Won't · 4 conflicts` checkable rather than copied. Read-only structurally: no form, no input, no server action, no `use client` in the surface. `data/pages/admin-permissions.ts` holds every word (E23 budget 0).

- `/admin/review` — **db**
  - capability: The console's review shelf: every published prototype, diagram and report grouped by the release it belongs to, with the artifact itself in a sandboxed frame beside its to-do checklist and its GitHub-shaped feedback list (issue number, state, title, labels, author, age → thread).
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/review-artifacts.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #665 — the record is #667's store (`review_artifact` / `review_todo` / `review_issue`, read through `lib/db/review-artifacts.ts`: `listReviewArtifacts()` carries both counts per row, `readReviewArtifact()` the two lists, `readReviewIssue()` one thread); `docs/review/artifacts.json` is presentation only — the release each artifact ships with and the one line a reviewer reads first — and every catalogue row must carry a manifest row and vice versa, or the shelf refuses to build. The list is **grouped by release** and a group is archived or active as one: membership from the manifest, state from `docs/changelog/releases.json`, so only the newest release is active. `/review-artifacts/[id]` resolves an id or slug against the authored catalogue and answers 404 for anything it does not name (no disk scan, no path parameter; `path` is the guarded `docs/review/**.html` shape in `content/review.ts`), and serves the file with `Content-Security-Policy: sandbox allow-scripts` beside the iframe's own sandbox. It writes: the checklist (`toggleReviewTodoAction`), the reply composer (`commentOnReviewIssueAction`) and close/reopen (`setReviewIssueStateAction`) are mounted in `components/admin/review-todos.tsx` and `review-thread.tsx`, the page hands the actions down as props (the inbox's pattern, so no client module imports a `"use server"` one), each write revalidates `ADMIN_REVIEW_PATH`, and a refusal is drawn as the fixture's sentence rather than a silent no-op. The three floors are `admin` in `lib/admin/roles.ts` — the screen is `requireAdmin()`, so a lower write floor would be policy no session could reach. Both templates claim `product.admin` (#509), so `requireAdminProduct()` runs before `requireAdmin()`. `data/pages/admin-review.ts` holds every word (E23 budget 0).

- `/dashboard/help` — **fixture**
  - capability: The onboarding sequence (the same six moves `/how-it-works` draws, from `components/onboarding`) and the tour's replay control: one button that clears the seen mark and returns to the console, where the tour opens on arrival.
  - components: `components/assessment-flow`, `components/onboarding`, `components/tour`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `components/tour/replay-tour.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/tour/mark.ts`
  - notes: Reuses `data/pages/how-it-works.ts` and `data/pages/tour.ts` rather than authoring a third copy of either — the page's job is the route, not the words. `/how-it-works` still answers for a bookmarked link; the rail points here since #542 phase 1. The only write is `POST /api/tour { seen: false }` through `lib/tour/mark.ts`, and a refusal shows the fixture's failure sentence instead of navigating.

- `/dashboard/relationships` — **db**
  - capability: My Relationships (#1129): every relationship this member is a party to, drawn as the v2 card — one state word, the five-mark alignment bar and one action — behind five filter chips in the card's own vocabulary (All · Stage 6 Live · Waiting on Invite · Draft · Paused), with a search over the relationship's own title and the other party's name, a sort over the rows in hand, and the create band that copies a template into a new relationship's own record.
  - components: `components/assessment-flow`, `components/dashboard`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/member-alignments.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-library.ts`, `lib/db/template-versions.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Reads `listMyRelationships(user.userId)` (both seats: the rows this account started and the rows it was invited into) plus `readMemberAlignments(user.userId)` for the bar, so the card here and the card on `/dashboard` are one projection (`components/dashboard/relationship-card-model.ts`) over one verdict (`content/gaps.ts`). The five chips are `lib/member/start.ts::cardStateOf`'s four words plus All — a stored `pending` prints as Draft, `complete` as Stage 6 Live, and `void` is drawn on neither screen (#503). Create is the only write on the page; Aspects belong to the detail screen.

- `/dashboard/relationships/[id]` — **db**
  - capability: One relationship the member initiated: its status, its Aspects editor while `draft`/`pending`, save-as-pending, publish through a trial or a checkout, and the one-click re-publish that replaces an expired invite link.
  - components: `components/assessment-flow`, `components/dashboard`, `components/layout`, `components/relationship`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-versions.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Reuses `components/admin/template-editor.tsx` in its `band="private"` shape for Aspects (`template-ancestor:` on the header), so there is one editor and not two. Every write is a server action over `act()`; the ownership refusal (`not-yours`) is decided in the action, not by hiding the form — the counterparty reaching this URL gets the same refusal a crafted POST gets.

- `/dashboard/support` — **db**
  - capability: Support inside the shell: the knowledge-base list (`components/support/knowledge-base.tsx`, the same component `/help` renders, with its links rewritten to this route's article path), one article at `/dashboard/support/articles/[slug]`, and a contact form whose submit stores a `contact_message` row before mailing.
  - components: `components/assessment-flow`, `components/support`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `components/support/support-request-form.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/contact/submit.ts`
  - notes: The form is a server action, not the public `POST /api/contact` — that route answers a 303 to `/help`, which would throw a signed-in reader out of the workspace. It hands the same fields to `lib/contact/submit.ts`, so the ordering (spam, validation, throttle, store, mail) is one implementation. The confirmation is derived: the action returns the inserted id and the page re-reads that row by id _and_ by the session's address (`readOwnContactMessage`).

- `/dashboard/support/articles/[slug]` — **fixture**
  - capability: One knowledge-base article, drawn by the same `components/support/article-detail.tsx` the public page uses, with `backHref` and `articleHrefBase` pointed at the dashboard so the breadcrumbs and related entries stay in the shell.
  - components: `components/assessment-flow`, `components/content`, `components/support`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: A slug that is not a published `kb` article is a 404 before the component mounts, exactly as the public route decides it. The component takes both paths as props because it renders in two trees: a marketing `href` spelled inside it would be a dashboard departure E39 refuses.

- `/dashboard/templates` — **db**
  - capability: One Templates page, two tabs (#620, #1130): Library is the shelf a member can start a relationship from — a featured template, a category filter with counts (All / Family / Couples / Friends / Work / Home), a search, and cards carrying the shelf chip, the Aspect count and the plan's one price — and My Templates is the copies they own, each opening its own page plus the blank and clone bands.
  - components: `components/assessment-flow`, `components/dashboard`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-library.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The tab is the URL: `?tab=mine` is the second tab and the bare path is the Library, so both are linkable and a `curl` can ask for either (`lib/member/shelf.ts::templatesTabOf`, which lands an unknown value — and the pre-#1130 `catalogue` — on the Library). The filter and search are `?filter=` and `?q=` over the rows already read, never a second query: the category is the relationship type's (`data/template-categories.ts`), not the record's. Two reads, neither keyed on the request — `listLibraryTemplates(userId)` for the Library and `listMemberLibrary(userId)` for My Templates — with `requireRole` resolving the id from the session. `Create Relationship` opens `/dashboard/templates/<id>/create`, the shipped create step; nobody here says \"start an instance\", because a relationship is what a person starts. `/dashboard/library` was the third door and is now a 308 to `?tab=mine`.

- `/dashboard/templates/[id]` — **db**
  - capability: One of the member's own templates, in two modes at one address (#1130): the bare page draws the template — its Aspects on the locked 1–5 band, About, Used In, Share It With Others (Propose to Library) and the retire band (Archive, Restore, Delete Permanently only when unused) — and `?edit=1` is the catalogue editor's questions and Aspects shape, writing `owner_user_id` = the actor and `visibility` = `private`, with no publish or unpublish control.
  - components: `components/admin`, `components/assessment-flow`, `components/dashboard`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-versions.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The editor half is `band="private"` on the reused `components/admin/template-editor.tsx`; `onPublish`/`onUnpublish` are simply not passed, which is why the member cannot reach the catalogue writer through this screen. The ownership check is in the server action (`not-yours`) and in `readMyTemplate()`, so the editor's props are a convenience and not the gate. The delete control is a neutral ×, and a template any relationship was created from passes no `onDelete` at all — the store would refuse it, so the band says "archive only" instead of offering a control that cannot succeed.

- `/dashboard/templates/[id]/propose` — **db**
  - capability: Propose a Template: a member's own template offered to the admin-curated Library as a reviewed request — name, category, who it is for, an optional note and a required consent box.
  - components: `components/assessment-flow`, `components/dashboard`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: `#1130`. One route, one form (`components/dashboard/template-proposal-form.tsx`) and one aside that lists what is shared and what is never shared. The action (`proposeToLibrary`) validates with `lib/member/proposal.ts::validateProposal` and writes **nothing durable**: the review queue behind a proposal is undecided (crud-matrix "Conflicts: Propose to Library"), so the sent panel says the queue is not open rather than implying a reviewer. It cannot publish — there is no path from this action to a `record` or a `template_version` write, and consent must be the boolean `true`, never a field's presence.

- `/dashboard/user` — **db**
  - capability: The signed-in person's account home: their saved profile, wallet, recent activity and their quizzes, read from Postgres.
  - components: `components/assessment-flow`, `components/identity`, `components/media`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `components/identity/sign-out-button.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/client.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/auth/sign-out.ts`

- `/forgot-password` — **db**
  - capability: Ask for a password reset link. Always answers the same sentence for a known and an unknown address; rate-limited per address and per requester; shows the link instead of claiming a send when the deployment has no RESEND_* configured.
  - components: `components/auth`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/password-reset.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`
  - notes: The one surface that writes `public.password_reset` and, through the auth server's own /reset-password, the `credential` row a Google-only account has never had. Its message is the fourth sender in `lib/flow/email.ts` (#password-reset).

- `/help` — **fixture**
  - capability: The public help centre: the help categories, the FAQ and the knowledge base in the marketing chrome, and — under the answers — the one public contact form: a name, a reply address, a message and one submit, posted as plain HTML to `/api/contact` with no captcha and no third-party widget. The band that says where a person is is the second column of that row, beside the form.
  - components: `components/contact`, `components/support`, `components/ui`
  - reads: an `/api` path — `app/(marketing)/help/page.tsx`, `components/contact/contact-form.tsx`, `components/contact/contact-section.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/help.ts`
  - notes: The public half of the Help/Support split (owner's review). A variation of the old `/support` hub with its Contact tab removed rather than left empty: the answers are public, and the band beside the contact form says where a person is — it was a strip at the foot of the page until the owner reported the form and its alternative never sitting at one eye line. It renders the same panels the account page links back to (`components/support/**`), so the two surfaces cannot tell a reader different things about one product. **Two columns that stay two columns:** the category filter and the answer panel are a `200px + 1fr` grid (a span wider than the track count was what pushed the answers into a second row), the filter is sticky rail on `md`+ and one scrolling chip row below it, and the form row is the same grammar with the person band as its aside. **The category rail's selected row is the tree's tinted-panel treatment (#539 item 3):** `bg-action/10` with an inset `ring-action/20` and `text-action` — the soft ground QuizHub's own active rows use — instead of the solid `bg-action` fill the row drew before, and its labels wrap inside the rail (`whitespace-normal`, `min-w-0`) rather than painting past it at 768 (#539 item 9). Both are the same control, so the registry lists them here rather than as a second surface.

- `/login` — **live**
  - capability: Sign in with a real Neon Managed Auth session, with pending, invalid-credentials, Google-only and network states.
  - components: `components/auth`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/account-providers.ts`, `lib/db/client.ts`, `lib/db/demo-accounts.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/client.ts`, `lib/auth/google-flow-neon.ts`, `lib/auth/google-flow.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`

- `/privacy` — **fixture**
  - capability: The draft privacy policy: what the build actually collects, why, where it lives and what the reader can ask for, behind a draft notice that cannot be dismissed.
  - components: `components/legal`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`

- `/profile/[username]` — **db**
  - capability: A public profile read from Postgres: header, stats, achievements, followers, quiz history and created quizzes.
  - components: `components/assessment-flow`, `components/identity`, `components/media`, `components/profile`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `lib/auth/request-context.ts`, `lib/auth/server.ts`

- `/register` — **live**
  - capability: Create a real Neon Managed Auth account: personal details, then email, password and the terms agreement.
  - components: `components/auth`, `components/layout`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/client.ts`, `lib/auth/paths.ts`

- `/relationship-templates` — **fixture**
  - capability: The public catalogue of Relationship Templates — the #889 shop listing: a split hero over one framed photograph, a short explainer carrying a real Staff–Manager Aspect, one membership line, a sticky realm menu, and every purchasable Relationship Type grouped by realm with its two roles, its Aspect count and a realm outline icon — plus accessible search as progressive enhancement. Membership is stated once above the shelf, so no card prints a price. No clock and no app tables; one session read (`currentUserIfConfigured()`) resolves the **authored** membership action — a bare `/register` means an account to a visitor and an account home to a member — while every card's and the closing _create_ action's destination is the flow's stage 1 for both viewers (#1042), so the page renders per request rather than prerendering.
  - components: `components/marketing`
  - reads: an `/api` path — `data/billing-plans.ts`
  - notes: The endpoint the owner asked for, and the one door the header's `Templates` row, the footer's catalogue link and every ‘start with a template’ action point at (`lib/flow/paths.ts::TEMPLATE_CATALOGUE_PATH`). **This address rendered the V2 composition from #905 until #1040**; #1040 restored the v1 shop listing here, on both builds, so this page and `/relationship-types` now render the same composition from the same model (`lib/templates-page.ts` over `data/pages/templates.ts`) — measured as byte-identical markup on both brands, not merely similar. The V2 composition is **retained, not deleted** (`components/templates/templates-catalogue-v2.tsx` + `lib/templates-catalogue.ts`, and `tests/templates-catalogue.test.ts` still pins its claims), but no route mounts it: the template doctrine catalogues a surface rather than deleting it. Types and links are `purchasableTypesByGroup()` over `data/relationship-types.ts`; every card's action is the create flow's stage 1, carrying the template in the path, for a visitor and a member alike (#1042).

- `/relationship-templates/[slug]` — **fixture**
  - capability: One Relationship Template, in full: who it is for and who it is not for, every Aspect it asks — the question and its two named ends — the price, one action to start it, and a worked example where the fixture holds one. No clock and no app tables, and since #1042 no session read either: the one start action is the create flow's stage 1 for every viewer, carrying this template in the path, so the page is prerenderable per slug again (#979 removed the member-shaped action; #1042 removed the visitor's `/register` detour).
  - components: `components/marketing`, `components/templates`
  - reads: an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`
  - notes: The public way into a template, and the gap it closes is that there was none: the directory listed 27 templates carrying 144 Aspects between them, and a stranger's only doors were `/register` and a worked example on 2 of the 27. The page is `lib/template-detail.ts` over `data/relationship-types.ts` — the same record the catalogue card is projected from, so the questions printed here are the ones the product will ask rather than a second copy that can drift. `generateStaticParams()` still enumerates every purchasable type and `notFound()` answers any other slug; since #1042 the page reads no session at all, so those params are prerenderable again instead of rendering on demand. It moved under the catalogue's own path in #1127 (`/relationship-types/[slug]` is a 308): the list and one row of it are one noun, and there is no second catalogue address for a card to link at.

- `/relationship-templates/[slug]/demo` — **fixture**
  - capability: The worked example: one Relationship Type's finished report, answered by You and Them and labelled Example, rendered through the live report projection and component — the value shown before anyone pays, and launch criterion 5's one readable proof. No clock and no app tables, and no session read since #1042: its single start action is the create flow's stage 1 for every viewer, carrying this type's template.
  - components: `components/assessment`, `components/assessment-flow`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`
  - notes: Lands here as `docs/operations/history/V1-RETIREMENT.md`'s `release` demo row: it was `/v1/templates/[type]/demo`, the last customer route under `/v1`, and it moved out when that namespace was retired (#478) — first to `/assessment/demo/[type]`, then, once #794 retired the `assessment` noun from every surface that is not a record, to one segment below the type's own page. It is in `(marketing)` because a stranger reads it before an account exists, so it wears the public header and footer and renders the app shell nowhere. The projection and renderer are `lib/assessment-report.ts` + `components/assessment/assessment-report.tsx` — the v1 report component was deleted with the move, so the app has one report renderer, not two, which is also why this is a page and not a band on the type page: a band could only be a truncated second presentation of the same report. The example is built from the type's own Aspects and authored demo sheet, never from a stored template record (the staff-manager record predates the taxonomy and carries Aspects its sheet never answered).

- `/reset/[token]` — **db**
  - capability: Spend a reset link: a single-use, hour-long token in the path, refused with its own sentence when it is expired, already used or not one this app issued. Setting the password revokes every session.
  - components: `components/auth`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/password-reset.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/password-provider.ts`
  - notes: `Referrer-Policy: no-referrer` and `Cache-Control: no-store` come from `next.config.mjs` for `/reset/:path*`, and the page repeats the referrer rule as a meta tag. The token is stored only as a SHA-256 hash.

- `/reset/complete` — **fixture**
  - capability: The success screen after a reset, at a token-free address: the password is set and every other device was signed out.
  - components: `components/auth`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`
  - notes: Separate route on purpose — a spent token should leave the address bar and the history. Static, with no session and no database read.

- `/settings` — **live**
  - capability: The parts of your account you can change — display name, handle, bio and the country pair — saved through the guarded POST /api/profile.
  - components: `components/assessment-flow`, `components/identity`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/password-reset.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `components/identity/settings-view.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/account/purge.ts`, `lib/auth/client.ts`, `lib/auth/password-provider.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/auth/sign-out.ts`

- `/support` — **fixture**
  - capability: Account support inside the app: what to include in a message and what actually happens to it (stored in Postgres first, mailed second, read by a person), the links to the help centre and account settings, and a pointer to the one contact form rather than a second copy of it.
  - components: `components/assessment-flow`, `components/layout`, `components/support`, `components/ui`
  - reads: Postgres — `lib/db/client.ts` · an `/api` path — `app/(mainlayout)/support/page.tsx`, `components/support/contact-pointer.tsx`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The in-app half of the Help/Support split (owner's review). It draws no form: `ContactPointer` renders the fixture's sentence and a link to the form on `/help`, so exactly one contact form exists in the tree and it is the public one. The route resolves the session first: a member gets this page and a visitor with none is redirected to `/help` — not to `/login` and not to a 404 — because the same URL has two correct answers. The `lib/db` reach above is the admin-allowlist grant's (`lib/auth/session.ts` → `admin-allowlist.ts`), which returns before any query when `ADMIN_EMAILS` is unset: this page renders no row.

- `/support/articles/[slug]` — **fixture**
  - capability: One help article from the knowledge base, with related articles and a 'was this helpful?' prompt.
  - components: `components/content`, `components/support`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`

- `/terms` — **fixture**
  - capability: The draft terms of service: the rules for using the product, its liability and dispute clauses, and a draft notice that cannot be dismissed.
  - components: `components/legal`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`

### Component domains

- `components` — **mock**
  - capability: The files at the root of components/: the next-themes provider the root layout wraps the document in.
  - files (1): `theme-provider.tsx`
  - routes: every route — imported by `app/layout.tsx`, no page imports it directly

- `components/auth` — **live**
  - capability: The sign-in and sign-up forms, including pending, invalid-credentials and network states, plus the two demo surfaces `/login` draws only in demo mode: the anchor to the PIN gate and, under a valid unlock cookie, the three role buttons.
  - files (12): `auth-hero-tiles.tsx`, `auth-home-link.tsx`, `demo-entry.tsx`, `demo-gate.tsx`, `demo-roles.tsx`, `forgot-password-view.tsx`, `login-view.tsx`, `mark-icon.tsx`, `password-strength.tsx`, `register-view.tsx`, `reset-complete-view.tsx`, `reset-password-view.tsx`
  - routes (7): `/dashboard/templates/[id]/create/commit`, `/demo`, `/forgot-password`, `/login`, `/register`, `/reset/[token]`, `/reset/complete`
  - notes: The demo surfaces are decided on the server (`lib/auth/demo-surface.ts`) and render nothing outside demo mode; the PIN gate itself is `/demo` (`components/auth/demo-gate.tsx`), not this route.

- `components/contact` — **mock**
  - capability: The public contact surface: the three-field form, its hidden honeypot and render instant, the plain HTML POST to `/api/contact`, and the outcome band the query selects.
  - files (2): `contact-form.tsx`, `contact-section.tsx`
  - routes (1): `/help`
  - notes: Reads no data module: every word arrives as a `PageCopy` prop from `data/pages/help` (the `/help` route above claims it), and the write is the route handler's. `mock` for the same reason `components/legal` is: the closure reaches page copy and prop types, never a record fixture and never `lib/db/`.

- `components/content` — **mock**
  - capability: The block renderer every article record is drawn through: paragraphs, headings, lists, images and quotes.
  - files (1): `content-blocks.tsx`
  - routes (4): `/creator-tips/[slug]`, `/dashboard/support/articles/[slug]`, `/news/[slug]`, `/support/articles/[slug]`
  - notes: Holds no words of its own — the blocks arrive from `content/blocks.ts` through props.

- `components/home` — **fixture**
  - capability: Both front pages: the QuizHub shelves (hero, category slider, latest, featured, top players, winners, testimonials) and the AlignSynch practice page — a two-column hero over the worked-example card, then the cycle, the mechanism, the capped template shelf with its one View-all, the scope ledger and the seats.
  - files (22): `alignment-home.tsx`, `as2-benefits.tsx`, `as2-final-cta.tsx`, `as2-hero.tsx`, `as2-home.tsx`, `as2-how-it-works.tsx`, `as2-model.tsx`, `as2-parts.tsx`, `as2-section-nav.tsx`, `as2-stories.tsx`, `as2-templates.tsx`, `categories-slider.tsx`, `featured-quizzes.tsx`, `hero-section.tsx`, `latest-quizzes.tsx`, `live-winners.tsx`, `newsletter-section.tsx`, `player-testimonials.tsx`, `quizzes-by-difficulty.tsx`, `resources-and-referral.tsx`, `template-shelf.tsx`, `top-players-carousel.tsx`
  - routes (1): `/`

- `components/identity` — **live**
  - capability: The account surfaces: the signed-in home, the member profile, the settings form that POSTs /api/profile, sign-out and the demo-account notice.
  - files (8): `account-home.tsx`, `delete-account-card.tsx`, `demo-account-notice.tsx`, `member-profile.tsx`, `password-card.tsx`, `session-card.tsx`, `settings-view.tsx`, `sign-out-button.tsx`
  - routes (3): `/dashboard/user`, `/profile/[username]`, `/settings`

- `components/layout` — **fixture**
  - capability: The shell: header, the sticky sidebar, the layout that composes them, and the footer.
  - files (13): `admin-notice-bar.tsx`, `app-version.tsx`, `brand-glyph.tsx`, `footer.tsx`, `header.tsx`, `leaving-link.tsx`, `main-layout.tsx`, `nav-menus.tsx`, `news-signup.tsx`, `public-header-nav.tsx`, `public-header.tsx`, `rail-sheet-slot.tsx`, `sidebar.tsx`
  - routes (16): `/admin/permissions`, `/admin/spec`, `/admin/spec/[group]`, `/admin/spec/validation`, `/affiliate`, `/assessment`, `/categories`, `/creator-tips`, `/creator-tips/[slug]`, `/dashboard/relationships/[id]`, `/dashboard/templates/[id]/create/commit`, `/invite/[token]`, `/login`, `/register`, `/support`, `/tournaments`

- `components/legal` — **mock**
  - capability: The one view `/terms` and `/privacy` render: the draft banner first, then the section stack, with the fixture's paragraphs and `- ` lists as its only markup vocabulary.
  - files (1): `legal-page.tsx`
  - routes (2): `/privacy`, `/terms`
  - notes: The copy arrives as a prop from `data/pages/legal` (the two route entries claim it), so this domain reads no data module of its own.

- `components/media` — **mock**
  - capability: The one media resolver: a file, a remote URL or a generated default drawn from a seed, in that order, with a fallback on error and no image file behind the last tier.
  - files (2): `generated-avatar.tsx`, `media.tsx`
  - routes (24): `/`, `/affiliate`, `/battle`, `/categories`, `/categories/[slug]`, `/chat`, `/creator-tips`, `/creator-tips/[slug]`, `/daily-challenge`, `/dashboard/user`, `/explore`, `/explore/featured`, `/leaderboard`, `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`, `/news`, `/news/[slug]`, `/profile/[username]`, `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/tournaments`, `/tournaments/[id]`

- `components/not-found` — **mock**
  - capability: The 404 body: floating glyph decoration and a go-back button.
  - files (2): `floating-glyphs.tsx`, `go-back-button.tsx`
  - routes: none — no route imports this domain today

- `components/profile` — **fixture**
  - capability: The public profile in ten parts: cover, header, stats, achievements, activity, followers, following, quiz history, created quizzes and a message modal.
  - files (11): `message-modal.tsx`, `profile-achievements.tsx`, `profile-activity.tsx`, `profile-cover.tsx`, `profile-created-quizzes.tsx`, `profile-followers.tsx`, `profile-following.tsx`, `profile-header.tsx`, `profile-quiz-history.tsx`, `profile-stats.tsx`, `user-profile.tsx`
  - routes (1): `/profile/[username]`

- `components/shell` — **fixture**
  - capability: The shell's own panels: the declared-not-wired surface a pending route renders — its label, the reason it is not live and the capability it needs, read from the surface registry rather than typed into the page.
  - files (1): `pending-surface.tsx`
  - routes: none — no route imports this domain today
  - notes: `pending-surface.tsx` varies `components/ui/alert.tsx` — the alert's frame with `role="status"` instead of `role="alert"`, because a pending surface is a state a reader is told about, not a failure they must act on. It renders `data/surface-registry.ts` and nothing else: the labels, reasons and `needs` lines are that fixture's (issue #409), so the panel and the nav's greyed row cannot disagree about what a surface is. Server component, no client state.

- `components/support` — **fixture**
  - capability: The help panels shared by the two halves of the split — the two-tab help header, help categories, FAQ and knowledge base — plus the account page's contact form and its article reader.
  - files (11): `account-support-page.tsx`, `article-detail.tsx`, `category.ts`, `contact-pointer.tsx`, `dashboard-support-view.tsx`, `help-header.tsx`, `help-page.tsx`, `knowledge-base.tsx`, `support-categories.tsx`, `support-faq.tsx`, `support-request-form.tsx`
  - routes (5): `/dashboard/support`, `/dashboard/support/articles/[slug]`, `/help`, `/support`, `/support/articles/[slug]`

- `components/templates` — **fixture**
  - capability: The public catalogue's eleven files: a hero, the explainer with one real Aspect, the membership line, the sticky realm menu, the searchable catalogue and its journey band — plus the record card (realm outline icon on a flat tint, name, two roles, one facts line, `Details` / `Example` / `Create Relationship`) and the older signpost card the front page's shelf still draws.
  - files (12): `how-it-works-preview.tsx`, `membership-summary.tsx`, `template-art.tsx`, `template-card.tsx`, `template-catalogue-card.tsx`, `template-catalogue.tsx`, `template-detail.tsx`, `template-journey.tsx`, `template-realm-nav.tsx`, `templates-catalogue-v2.tsx`, `templates-hero.tsx`, `templates-page.tsx`
  - routes (1): `/relationship-templates/[slug]`
  - notes: `/relationship-types` is the surface (#889); `template-card.tsx` remains because `/` renders it in its capped six-card shelf and that rollout is a separate, route-sized review the issue defers. `template-art.tsx` is the shared `RecordArtwork` the design system names: one realm icon from `data/media.ts`, masked and painted in the realm's ink, so no card ever draws a monogram or a per-slug hue again. Holds no words: E23 attributes the domain to `data/pages/templates.ts` at budget 0, and everything the cards print is a record from `lib/template-catalogue.ts`.

- `components/ui` — **mock**
  - capability: The shadcn primitives every screen composes, plus this repo's own chart, drawer, motion and circular-progress additions, and the OAuth provider mark (`provider-mark.tsx`, #777).
  - files (52): `accordion.tsx`, `alert-dialog.tsx`, `alert.tsx`, `aspect-ratio.tsx`, `avatar.tsx`, `badge.tsx`, `button.tsx`, `card.tsx`, `carousel.tsx`, `chart.tsx`, `checkbox.tsx`, `circular-progress.tsx`, `collapsible.tsx`, `command.tsx`, `context-menu.tsx`, `dialog.tsx`, `drawer.tsx`, `dropdown-menu.tsx`, `form-surface.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `input.tsx`, `label.tsx`, `menubar.tsx`, `motion.tsx`, `navigation-menu.tsx`, `page-header.tsx`, `pagination.tsx`, `popover.tsx`, `progress.tsx`, `provider-mark.tsx`, `radio-group.tsx`, `resizable.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `slider.tsx`, `sonner.tsx`, `switch.tsx`, `table.tsx`, `tabs.tsx`, `textarea.tsx`, `toast.tsx`, `toaster.tsx`, `toggle-group.tsx`, `toggle.tsx`, `tooltip.tsx`, `use-mobile.tsx`, `use-toast.ts`
  - routes (91): `/`, `/admin/audit`, `/admin/billing`, `/admin/brand`, `/admin/broadcast`, `/admin/console`, `/admin/console/relationships`, `/admin/console/relationships/[id]`, `/admin/console/templates`, `/admin/console/templates/[id]`, `/admin/console/users`, `/admin/docs`, `/admin/docs/[...slug]`, `/admin/docs/features`, `/admin/docs/releases`, `/admin/email-templates`, `/admin/email-templates/[id]`, `/admin/gaps`, `/admin/growth`, `/admin/health`, `/admin/inbox`, `/admin/instances`, `/admin/instances/[id]`, `/admin/instances/[id]/report`, `/admin/permissions`, `/admin/review`, `/admin/spec`, `/admin/spec/[group]`, `/admin/spec/validation`, `/admin/templates`, `/admin/templates/[id]`, `/affiliate`, `/assessment`, `/assessment/instances/[instanceId]`, `/assessment/instances/[instanceId]/report`, `/assessment/instances/[instanceId]/sent`, `/assessment/new/failed`, `/assessments`, `/battle`, `/categories`, `/categories/[slug]`, `/chat`, `/create/editor`, `/create/generator`, `/creator-tips`, `/creator-tips/[slug]`, `/daily-challenge`, `/dashboard`, `/dashboard/help`, `/dashboard/relationships`, `/dashboard/relationships/[id]`, `/dashboard/support`, `/dashboard/support/articles/[slug]`, `/dashboard/templates`, `/dashboard/templates/[id]`, `/dashboard/templates/[id]/create`, `/dashboard/templates/[id]/create/aspects`, `/dashboard/templates/[id]/create/commit`, `/dashboard/templates/[id]/create/invite`, `/dashboard/templates/[id]/create/mode`, `/dashboard/templates/[id]/propose`, `/dashboard/user`, `/demo`, `/demo/admin`, `/explore`, `/explore/featured`, `/forgot-password`, `/help`, `/invite/[token]`, `/leaderboard`, `/login`, `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`, `/news`, `/news/[slug]`, `/pricing`, `/profile/[username]`, `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/quiz/[id]/play`, `/register`, `/reset/[token]`, `/search`, `/settings`, `/support`, `/support/articles/[slug]`, `/tournaments`, `/tournaments/[id]`, `/welcome` — and every other route through `app/layout.tsx`
  - notes: Renders only the props it is given; the tokens it paints with come from app/globals.css.

## AlignSynch

### Routes

- `/admin/billing` — **db**
  - capability: Subscription state per relationship — plan, the period it is covered for, the provider id and state, and whether the checkout ran on live or test keys, as a badge on every row and a banner over the list — plus the plan's relationship limit and one audited action: an owner comps or extends a tier for a period.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/admin-billing.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #505 — the first console screen that reads `billing_subscription`, and the first that writes `plan_grant`. **No card data, ever**: `lib/db/admin-billing.ts` names its columns and they are a provider id, a provider state, a period and a boolean; a payload that grew a `last4` could not reach a render without a column added in a diff. The mode is a banner and a per-row badge because both adapters this build carries are test-mode today (`0026` stores the provider's own `livemode`, defaulting to test). The comp goes through `act()` (`plan.comp`, floor `owner` in `lib/admin/roles.ts` — `admin` reads, `owner` gives), writes `plan_grant` rather than `billing_subscription` so a gift is never mistaken for a payment, and is idempotent by **period**: a second grant with the same `period_start` is refused by `plan_grant_period_key` inside the transaction, leaving neither a grant nor an audit row. The limit the tier sells is enforced in the server, on the create that mints an invitation (`lib/flow/store.ts` asks `relationshipGateRefusal()`), and a refusal names the plan and the number.

- `/admin/brand` — **fixture**
  - capability: The brand and audience profile, rendered as a reference page for an operator: positioning, who the product is for, how the flow works with its privacy gate, the three reusable descriptions (short, company, app) and the closing action — the same eleven headings, in the same order, with the same words as the approved profile document.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #906 — the second surface that reads the _alignment_ product flag (`requireAdminProduct()`, then `requireAlignmentProduct()`, then `requireAdmin()`), so a quiz-only build answers the 404 an unknown URL gets instead of serving another product's brand story. Read-only structurally: no form, no server action, no write import; the words are `data/pages/admin-brand.ts` at a copy budget of 0 and the place to change them is the canon, never the page. Its only entrance is the admin notice bar (`components/layout/admin-notice-bar.tsx`), which is drawn for a signed-in admin on the alignment build only and sits above both the marketing header and the app shell — a sidebar row would put a reference page above five working ones. Six declared divergences from the mockup (gradient hero, two-tone eyebrow, sub-12px type, graphite hue, box-shadow, preview chrome) are named in `docs/specs/spec-design-page-rel-templates-v2/admin-brand/README.md` §6 and land as tokens here, never as hex.

- `/admin/console` — **fixture**
  - capability: The admin console — records, relationships, templates and the two seats, read-only for answers.
  - components: `components/assessment-flow`, `components/console`, `components/ui`, `components/v1`
  - reads: 2 record fixtures — `data/relationship-types.ts`, `data/v1/fixtures.ts`
  - notes: Moved out of the `/v1` prototype tree (#478) so the prototype can be deleted without taking it: the six console pages now sit under the app shell at `/admin/console`, and their layout gates the subtree with `requireAdmin()`. The rows are still the in-browser store seeded from `data/v1/fixtures.ts` — the operator's Postgres registry is `/admin/instances`, a different screen — which is why this is `fixture` and not `db`.

- `/admin/console/relationships` — **fixture**
  - capability: The relationship registry — every relationship, live or archived, with its template, derived stage, both seat states and its subscription state, filtered by the same links the overview's counts produce; read-only for answers, with a one-click restore on an archived row.
  - components: `components/assessment-flow`, `components/ui`, `components/v1`
  - reads: 2 record fixtures — `data/relationship-types.ts`, `data/v1/fixtures.ts`

- `/admin/console/relationships/[id]` — **fixture**
  - capability: One relationship as an operator sees it — its seats, subscription and a session list that says scored or open and nothing a party answered — with Archive behind a confirmation and a Restore that is one click.
  - components: `components/assessment-flow`, `components/ui`, `components/v1`
  - reads: 2 record fixtures — `data/relationship-types.ts`, `data/v1/fixtures.ts`

- `/admin/console/templates` — **fixture**
  - capability: The template registry — every template with the number of relationships started from it, and an enable/disable action behind a confirmation that the store can undo.
  - components: `components/assessment-flow`, `components/ui`, `components/v1`
  - reads: 2 record fixtures — `data/relationship-types.ts`, `data/v1/fixtures.ts`

- `/admin/console/templates/[id]` — **fixture**
  - capability: One template as an operator sees it — the Aspects as authored, and every relationship started from it, live and archived, with the enable/disable pair.
  - components: `components/assessment-flow`, `components/ui`, `components/v1`
  - reads: 2 record fixtures — `data/relationship-types.ts`, `data/v1/fixtures.ts`

- `/admin/console/users` — **fixture**
  - capability: The two seats and the members, with role, account state and last sign-in from the store — no addresses, and no user-management form that would pretend to write to Neon.
  - components: `components/assessment-flow`, `components/ui`, `components/v1`
  - reads: 2 record fixtures — `data/relationship-types.ts`, `data/v1/fixtures.ts`

- `/admin/gaps` — **db**
  - capability: The Gap across a population: the eight kinds the model defines, counted over relationships both parties have finished, read under each relationship's own Setting. Nameless aggregates — no party, no score, no ranking — and a Setting with fewer complete relationships than the floor states that instead of charting.
  - components: `components/assessment-flow`, `components/console`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/gap-rows.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The console's one relationship-specific screen and the only caller of `lib/admin/gap-aggregates.ts`. Its generic form is response analytics (stat cards, one distribution per measure, a comparison axis); what varies is the measure (`gapOf` over eight kinds), the population (complete instances) and the comparison (Setting). Admin only: `requireAdmin()` first, so a member gets the 404 `/demo/admin` documents. No migration and no stored aggregate — every number is a function of the `opinion` rows.

- `/admin/instances` — **db**
  - capability: Every relationship in the database, for an operator: the template, both seats' identity state, mode, Setting, the derived stage, when it was created and when anything last happened to it — filterable by stage, mode, Setting and "stalled".
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/admin-sessions.ts`, `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Admin-only, and the first caller of `requireAdmin()` outside `/demo/admin`: a member gets the 404 a URL that never existed returns, a signed-out visitor is sent to `/login?next=` this path. The blind rule holds for an admin too — the read selects seats, mode, Setting and the stage, never an opinion, a score, a Gap or an answered count, so there is no column and no prop through which an answer could reach the page. Read-and-filter only: no delete, no force-complete. Every filter is client-side over the one read (`lib/db/admin-instances.ts`).

- `/admin/instances/[id]` — **db**
  - capability: One relationship, and the five audited repairs an operator may make on it: clear a party's unlock mark, reissue or withdraw the invitation, void the session, or record an acceptance on a seat's behalf.
  - components: `components/admin`, `components/assessment-flow`, `components/relationship`, `components/ui`
  - reads: Postgres — `lib/db/admin-relationship.ts`, `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #503 — the first caller of `lib/admin/act.ts`: every repair is one transaction that reads the actor's rung from `user_profile`, runs the mutation and inserts the `admin_action` row before it commits, so a change without its audit entry is not representable. Admin-only (`requireAdmin()`, after `requireAdminProduct()`), while two of the five floors are `support` — the floors are enforced by `act()`, and the support view is #506. The read is `lib/db/admin-relationship.ts`: seats, the invitation's address and answered **counts**, never an opinion or a score. The fresh token a resend mints is returned to the component once and is deliberately absent from the audit row.

- `/admin/instances/[id]/report` — **db**
  - capability: One relationship's Gap report, and the three operations an operator may take on it: export it as JSON or PDF, reissue it with a reason, or read one seat's raw submission behind the PII gate.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/admin-report.ts`, `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #504 — the deliverable a customer pays for, as an operations screen. The document is `lib/report/document.ts` (pure): the record plus a projection of the Gaps, so the exported JSON round-trips through `zAssessmentInstance` and every number is recomputable from the rows it carries. `read_submission` is the epic's own action name and the audit row for both exports and a seat read; a member's request answers 404 from the route's `roleAnswerFor()` gate and writes no row, which is `act()`'s floor doing the second half. Doubt is a third gap step the model cannot compute (one value per kind, no history, frozen at completion) and it is stated in the document, the page and the PDF rather than omitted. The PDF is written by hand in `lib/report/pdf.ts` — no PDF dependency was added, and the instant it names is the fixture clock.

- `/admin/spec` — **fixture**
  - capability: The project spec's front page and a stakeholder's landing: the confidential notice, a status box counting the register, a welcome band with the three ways in, and eleven story cards split Story / Around the Story — each with its met/total. A 208px pinned submenu beside it. Read-only — there is no form, no action and no write on any of the three routes.
  - components: `components/admin`, `components/assessment-flow`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #1252 — the reader (spine: t_7cd2b125, PR #1254; the pages: t_f5458e3d). **The gate is the spine's, unchanged.** `requireAdminProduct()` first (#509), then `requireSpecReader()` (`lib/auth/require-role.ts`), which is membership of `SPEC_READERS` — `stakeholder`, `admin`, `owner` — and _not_ a rung comparison: `support` outranks `stakeholder` and is refused, and a member or a support seat is answered with the byte-for-byte unknown-URL 404, never a 403 and never a redirect, because either would confirm the page exists. Signed out goes to `/login?next=<where they were going>`. **The content is a register, not copy**: `data/spec/validation.json` (88 rows, generated by `scripts/spec-validation-json.py` from the private `VALIDATION.csv`) is read at request time by `lib/spec/file.ts` under `force-dynamic`, so an edited register is live on the next request; a missing or schema-invalid file is a 200 with the honest panel naming the path and the reason (s04b), never a 404, because the gate's 404 must stay unambiguous. **AS-10**: `content/spec.ts` types `quote` as `z.literal(null)` and `quotesIncluded` as `z.literal(false)`, so the private `--with-quotes` file physically cannot load into the app, and `data:check` E42 refuses it by name. Every reader-visible word is `data/pages/admin-spec.ts` at E23 budget 0 for all three routes; `data/surface-columns.ts` records all three as `column`. The template is `/admin/permissions` (`components/admin/permissions/permissions-console.tsx`): the same `StageColumn`, the same two-gate order, the same honest panel; the axis that varies is the data source (one generated register, read per request, instead of a parsed CSV at build time) and the 208px second column. `Cache-Control: private, no-store` and `X-Robots-Tag: noindex` come from `next.config.mjs` for the whole route family, so a fourth spec page cannot forget them. The route answers on both brands today because the console capability does, but the content is the alignment product's own spec, which is why `templates` names `alignsynch`.

- `/admin/spec/[group]` — **fixture**
  - capability: One story page, eleven of them: the group's counts as chips, then Agreed → v2.0 Today → Status → Evidence, every evidence citation linking to main at the register's sha. A group with no mockup says so instead of drawing a blank.
  - components: `components/admin`, `components/assessment-flow`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #1252 (reader: t_f5458e3d) — the third route of the same family, the same two gates and the same per-request register. **The segment is a story slug** (`07-plans-and-billing`), resolved by `specStoryOf`; a segment no story claims renders the fixture's honest panel — 'no story page is called …' plus the way to the matrix — because a 404 here would be indistinguishable from the _gate's_ 404, and the gate's is the one answer that must stay unambiguous. `params` is awaited before the gate (Next 16), so the `next` handed to `/login` is the address the person actually asked for. The empty-group case is drawn, not skipped: 'No mockup in the agreement for this group.' `force-dynamic`, the same headers, the same fixture at E23 budget 0.

- `/admin/spec/validation` — **fixture**
  - capability: The Validation matrix: a sticky status box (the met gauge, a meter per scope, a count per status, the register's metadata and legend) beside four sections in the agreement's order — 28 / 20 / 13 / 27 rows — each row carrying its ID, page, status chip, requirement, Definition of Done, v2.0 note, next acceptance, release map and evidence links to main at the recorded sha.
  - components: `components/admin`, `components/assessment-flow`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #1252 (reader: t_f5458e3d) — the same two gates in the same order as `/admin/spec`, the same unknown-URL 404 for a member or a support seat, the same register read per request and the same 200-with-a-panel when it cannot be read. **Status is an icon plus a word** (`SPEC_STATUS_MARKS` + the register's own status name), never colour alone, and there is no red hue anywhere on the page — `tests/admin-spec.test.tsx` walks the rendered class list for `red`/`rose`. Review and approval read Pending. **The counts are derived, never typed**: section numbers are indexes into `SPEC_SECTIONS`, and the 28/20/13/27 and 44-of-76 figures are `specSectionsOf` / `specTotalsOf` over the rows, asserted in the test file rather than in the gate (they move when the agreement moves; `data:check` E42 pins only the properties that must not). A static segment beside `[group]`, so Next resolves it before the group page.

- `/admin/templates` — **db**
  - capability: The authored template catalogue, drafts first — every assessment template record with its slug, publication state, Aspect count and how many relationships already copy it, and the band that starts a new draft from a title, a summary and one Aspect.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-versions.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #502a — the first console screen that writes a template, and the first surface gated on the alignment product as well as the console: `requireAdminProduct()`, then `requireAlignmentProduct()` (the same `product.quiz-surfaces` flag read from the side that does not sell quizzes, so `BRAND=quizhub` answers 404 on both routes), then `requireAdmin()` — a `support` session gets the 404 and nothing is read. The write is `act()` (`template.create`, floor `admin`), and the draft is validated by `zAssessment` inside the transaction, so the console cannot accept a template a fixture could not. Drafts only: a published template is read-only here and the row says so, because editing it in place would drift every session's copied Aspects (E31) — versioning is #502b.

- `/admin/templates/[id]` — **db**
  - capability: One template being drafted: its title, summary and slug, its Aspects as an accordion of prompt/Left Value/Right Value rows with add, remove and reorder, a live preview of the party's answer sheet, and a save that carries a reason.
  - components: `components/admin`, `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-versions.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: #502a — varies `components/create/quiz-editor.tsx` (tabs, per-item accordion, add/remove) and reuses `components/assessment-flow/answer-form.tsx` for the preview, which is built from the in-progress draft and wrapped in a disabled fieldset so it can never post an answer. `lib/admin/template-draft.ts` assembles the record and hands it to `zAssessment`; the save is `act()`'s (`template.update`) and lands in `admin_action` in the same transaction. Realm and price are drawn read-only from `data/relationship-types.ts` by slug, because they are the type's fields and the record has none — a slug outside the catalogue says so rather than inventing a price.

- `/assessment` — **db**
  - capability: The published assessment templates, each with its create form: pick a template and open a two-party instance from the templates that read from Postgres.
  - components: `components/assessment-flow`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`

- `/assessment/[slug]` — **db**
  - capability: One assessment instance from Postgres: both parties' answers per Aspect, the Opinions and Values behind them, and the Gap between the two.
  - components: `components/assessment`, `components/assessment-flow`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`

- `/assessment/instances/[instanceId]` — **db**
  - capability: The screen both parties share: answer blind while the other has not, then — stage 6, Align — read the Alignment Aspect by Aspect once both have answered **and both have accepted**.
  - components: `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The viewer is resolved from the party cookie in Postgres, never from the URL — a browser with no token for the instance gets a 404. The id may name either the relationship or its latest session, so both URL shapes open the same screen. The two seats are named in their own band; the paid band is drawn from the plan and purchase instant and is handed to the Initiator alone (`paid: null` for every other viewer), and every answer value comes from `visibleRoles()` — the viewer's own until both seats have accepted, both afterwards. While the invitation is unclaimed the link is drawn as selectable text with a copy control beside it, and a refused clipboard selects that text and says so (#257). The completed state is the relationship's Alignment (`components/assessment-flow/alignment-view.tsx`, #692): one row per Aspect with both sheets, both Opinions behind every difference, and a per-Aspect verdict, linked to the per-Gap report at `…/report`. It draws no total and no composite score, and the status sentence above it stays a sentence — the stages here are not the viewer's to drive (`docs/specs/ux-stages.md`).

- `/assessment/instances/[instanceId]/accept` — **db**
  - capability: Review and accept a session: the decision first, both seats side by side with what each party has answered, then every Aspect beneath with both Opinion columns sealed.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Live since R2 (#427): `POST /assessment/instances/[instanceId]/accepts` records one seat's acceptance in `party.accepted_at` (0016) and the **second** acceptance is what completes the session, so the page draws a real decision rather than a disabled control. The endpoint answers 303 and never renders: a first acceptance returns to this page with that seat marked accepted, the completing acceptance redirects to `/report`, and a refusal comes back as `?accept=<code>` — `already-accepted`, `incomplete` (the seat's own sheet must answer every Aspect), `not-a-party` (a coach holds a membership row and no `party` row, so the same resolver refuses them as a stranger), `no-such-instance`. The blind rule holds through the review window: both sheets stay sealed, and only the second acceptance opens the Gap. The transition derives the relationship's Steps from the same `opinion` rows the report reads, closes the ones whose Gap fell to 0, and commits them in the acceptance's own transaction — 'accepted but no Steps' is unrepresentable — and the unlock notice (#258) fires from the completing acceptance, once.

- `/assessment/instances/[instanceId]/answer` — **db**
  - capability: Answer the Aspect sheet: every Aspect's prompt, both named Values, and one row per seat asking the Opinion kinds the instance's Mode defines.
  - components: `components/assessment-flow`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The gated sheet (#427, R2-2), and singular `answer` on purpose: `/answers` in the same segment is the POST-only endpoint the form submits to, and Next refuses a `page.tsx` beside a `route.ts`. The viewer is resolved by `readFlowScreen()` from the party cookie's token hash, then the signed-in account, then a relationship membership, and a request that is none of those gets a 404 — the sheet does not exist for it. `lib/flow/answer-gate.ts` picks one of three shapes: the live form for a seat that may answer (prefilled from that seat's own `opinion` rows), the viewer's own sheet drawn disabled once the answers are sealed, and a coach band with no form at all. The form posts no identity field; the submit is written by `submitAnswers()` under the role the cookie resolves inside its transaction. Pre-completion the other party's rows never leave Postgres — the only opinion query the read runs is filtered by `visibleRoles()` — so the blindness is the shape of the projection, not a conditional in this page. **Pattern conformance (C2, #716):** the page renders inside the shared `StageColumn` (left edge at 274, no `mx-auto` — it drew `mx-auto max-w-3xl` until this card) and mounts the shipped 39px cell rail at stage 6, `Align`, in every one of the four states, because answering is the counterparty's half of the same six-stage journey the create and sent screens draw. The rail is the surface's **only** progress pattern — no bar, no numbered list, no second stepper — and the words are `data/pages/lifecycle.ts`'s six names, referenced from the answer fixture rather than re-typed.

- `/assessment/instances/[instanceId]/report` — **db**
  - capability: The report both parties read once the sheet is scored: per Aspect the prompt, both named ends of the scale, the verdict under the instance's Setting, both parties' Opinions, and every Gap with the two Opinions it subtracts printed beside it.
  - components: `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The read surface the app did not have until #409, ported from the `/v1` prototype's `report-body.tsx` as a server component over `lib/assessment-report.ts` — never a rewiring of the client store (#228, E34). The blind rule is the `screen.report === null` branch, not a redaction: before both parties have submitted, `readFlowScreen` has not read the other party's opinion rows at all and the route draws the locked page, which carries no score, no Gap and no count of the other party's progress. Every number is `gapKindsOf()` over stored rows; an unanswered Opinion prints a dash, never a 0. The viewer is the party cookie's seat (or a coach's membership), so a browser with no role on the relationship gets a 404.

- `/assessment/instances/[instanceId]/sent` — **db**
  - capability: Stage 5, Sent: the invitation's state as three moments — sent, waiting or expired or withdrawn, accepted — with what happens next, the address it went to, the resend control and the way into the relationship.
  - components: `components/assessment-flow`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The screen the create lands on (#691): `POST /assessment/new` redirects a signed-in creator here and the account gate forwards a freshly signed-in one, so the stage between the commit and the relationship is a page rather than nothing. The template is `components/assessment-flow/accept-session.tsx` — a single-outcome screen with a status sentence and a next-step list — and the variation is `components/assessment-flow/sent-state.tsx`: a state screen whose centre is the invitation's own timeline. Every state word is `inviteStateOf()`'s answer over the row (`claimed_at` / `expires_at` / `revoked_at`) at the instant the read carried, so `unclaimed`, `expired`, `claimed` and `revoked` each get their own sentence and `screen.invite.link` is only drawn while the claim path would still accept it. The two dates the timeline adds (`created_at`, `claimed_at`) are read in `readInstanceBundle()` and carried as ISO instants — no clock is read in the render path. Resend is the shipped `ReinviteForm` posting to the same `POST …/invite` endpoint, with its cooldown and lifetime cap; the form carries `returnTo=sent` so the 303 comes back to this screen rather than dropping the person onto stage 6 mid-action, and that field is a closed literal, never a URL. Signed out is behind the person, not in front: nothing here redirects to sign-in, and the `go` band says where the relationship lives until an account claims it.

- `/assessment/new/failed` — **fixture**
  - capability: Read calmly that the relationship could not be created, and try again or go back to the dashboard.
  - components: `components/assessment-flow`, `components/ui`
  - reads: 1 fixture module of page copy, assets or decisions — no records
  - notes: The browser outcome of `POST /assessment/new` when the create's transaction throws and the throw is not one of the person's own refusals (#1226). The screen is `create-failed.html` from the v2 bundle: one status card — an icon chip, `Couldn't Create This Draft`, `Try Again Shortly.`, and two actions — so nothing on it explains the cause. The cause is `console.error("create-failed", sqlstate, message)` in the route handler, unchanged from #1205, and it is the only place the SQLSTATE and the driver's sentence exist; neither reaches the page nor the address. The split is by request shape, not by a form field: a browser form post sends `Accept: text/html` and is answered 303 here, while a `curl`, a QA walk or any other caller keeps the named JSON 500 it reads today — which is also why `tests/create-error-shape.test.ts` still passes untouched. `?template=<slug>` is the only value in the address and it is validated as a slug, so `Try Again` reopens that template's create stage (where the draft is still in the cookie) and a crafted value falls back to the library. `Back to Dashboard` is `/dashboard`. The column is `StageColumn`'s, not the artifact's `mx-auto`, per #858; the copy is `data/pages/assessment-create-failed.ts` at budget 0, and no red appears anywhere on the surface.

- `/assessments` — **db**
  - capability: The member's assessment sessions, one row each: the assessment it was copied from, the state it is in, the other party, the session counts and the alignment once a session is complete — with a link to the session, the assessment, the relationship, and (once both parties have accepted) its Gap.
  - components: `components/assessment-flow`, `components/dashboard`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The listing moved from `/assessment/instances` (#877), which is a 308 here — it is plural because it is the member's record list, a sibling of `/dashboard/relationships` and `/dashboard/templates`, not a page under the `/assessment` record kind. It is the shell `components/dashboard/relationships-list.tsx` ships (heading, toolbar, state tabs, two empty states, 1/2/3 grid) over the same read `/assessment/instances` used — `listRelationshipCards()`, scoped by `relationship_member.user_id` (or `party.user_id` for rows seeded before #340) against the session, never a name, a query parameter or a role, so an admin sees their own list and no one else's. Every row is one session and every destination already existed; the Gap link is drawn only on a `complete` row because the report answers the locked page before acceptance. The card's figures are `relationshipCard()`'s: `alignment` is the mean Gap of the latest session and is drawn `—`, never 0, until that session is complete, and the money block is the plan and its purchase instant on the Initiator's card alone — never a total.

- `/dashboard` — **db**
  - capability: Start — the v2 shell's signed-in landing (#1129): a greeting, the one conversation the numbers point at (the widest Gap across the viewer's live relationships), up to two small jobs (a paused relationship a card would resume, a draft whose invite has not gone out), the two relationships in play and four templates to start from.
  - components: `components/assessment-flow`, `components/dashboard`, `components/tour`, `components/ui`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/member-alignments.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/tour.ts` · an `/api` path — `components/tour/first-run-tour.tsx`, `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`, `lib/db/tour.ts`, `lib/tour/mark.ts`
  - notes: The page authors no figure. `lib/member/start.ts` maps the seven stored lifecycle values onto the card's four words and orders the jobs (conversation, then one job of each kind); `lib/member/alignment-summary.ts` derives each card's bar and its Next Step over `content/gaps.ts`, so the landing cannot disagree with the Align screen about the same numbers and no Gap is stored. The rows are read by `listMyRelationships` + `readMemberAlignments` — the second is scoped to `party.user_id = $1` and selects no party name, no `user_id` and no invitation row — and a failed read draws the failure panel instead of a zero (`DatabaseUnavailableError`), which is the same rule `/assessment/instances` follows (#213). The four counts the console Overview drew here until #1129 are gone from this route: the approved bundle draws a greeting and two shelves, and each count's list still answers at `/assessments?filter=<id>`.

- `/dashboard/chat` — **db**
  - capability: One thread per relationship (#1131): a conversation list carrying an unread count and each thread's state, and — for the thread that is open — party-tinted messages where a message may carry an Aspect chip and that Aspect's current Align status, a composer with the five Aspects as toggle tags, a waiting state that says when chat opens, and a paused state that is read-only with one action for the Initiator.
  - components: `components/assessment-flow`, `components/chat`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The v2 bundle (`docs/specs/v2-bundles/07-spec-design-page-chat-v2/`) ported over the member's own rows: `listMyRelationships()` lists the threads (the viewer's id comes from the session, never the URL) and `readRelationshipById()` reads only the open one, so the Aspects and the report behind a status chip are the same gated projection `/assessment/instances/[instanceId]` draws. The thread is `?relationship=<id>` and the search is `?q=`, both GETs; no `?state=` and no `?role=` — the state is derived (`chatThreadStateOf` over `connectionOf()` and `pauseOf()`), so a waiting thread and a paused one render for whichever seat is reading, and a closed relationship is left out rather than drawn as paused. A tag's status is `alignmentStatusOf()` over the Aspect's widest cross-party Gap and is absent until both parties have accepted, which is the blind rule; the chip links to that Aspect on Align. The composer appends to the session and writes nothing durable — the thread model is #921's and that issue ships no schema, so `data/chat-threads.ts` holds the demo bodies and the write is stated as a known limit. This is NOT `/chat`, which stays the quiz product's surface and answers 404 on this brand (#300).

- `/dashboard/payment` — **db**
  - capability: The member's Payment page: one panel per relationship they initiated — Status, the trial's end or the pause, the price after the trial, and the card — with Add a Card, Continue Setup or Get 7 More Days Free as its actions; the account's Payment Method, Billing History and How Trials Work beside it; and a Counterparty's view that is one sentence and no money.
  - components: `components/assessment-flow`, `components/billing`
  - reads: Postgres — `lib/db/assessments.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/profile-rows.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-versions.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Every state is derived (`lib/billing/payment-view.ts`): the week from `trialStateOf()` over the account's live subscription, the pause from `pauseOf()` (#1121), the invitation from the row, and the price from `data/billing-plans.ts` Basic's `monthlyCents` — the prototype's `$9.99` is fixture data and is not ported. Panels are drawn only for relationships the viewer **initiated**, so the Counterparty's render holds no price, trial, card or extension to leak; a relationship they were invited into contributes one coverage band. The free week is offered only while `pauseOf()` says it is available — the claim is a `plan_grant` row, so the button is absent, not disabled, once used. The extension's write is #1121's own server action (`claimExtensionAction`), not a second one.

- `/dashboard/templates/[id]/create` — **db**
  - capability: Create a relationship from one template, stage 1 (Who): the template and its two seats, the counterparty's address, and the card title both parties will read.
  - components: `components/assessment-flow`, `components/billing`, `components/flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/rows.ts`, `lib/db/template-library.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Split into two stages by #688. Stage 1 posts `templateRecordId`, both seats, the address, the title and an optional description to `POST /assessment/new/who`, which validates them server-side (`lib/flow/create-draft.ts`), writes one draft cookie (`flow_draft_<templateId>`, 24 h) and answers a 303 to `…/create/mode`. A refusal is a 303 back to this path carrying `?problem=<reason>&field=<field>`, so the band names the field by its own label from `data/pages/assessment-create.ts` — never a column name. Coming back to this stage renders the saved values into the inputs. A child of the template's own address, so the template being copied is the route's fact; the read is `readLibraryTemplate()` with the session's id, the same author rule the library and the detail page apply. A signed-out visitor still gets the account gate (#618). Since #1123 all five stages render inside the v2 wizard shell (`components/assessment-flow/relationship-flow-shell.tsx`): a 260px rail carrying the setup gauge, the five stage rows, the dashed `Align` preview and the live `Your Relationship` summary, beside one stage card (`flow-stage-card.tsx`). The rail is drawn once, by the shell, so no stage can number or name itself differently, and the reference is `docs/specs/v2-bundles/01-spec-design-page-wizard-v2/wizard.html`.

- `/dashboard/templates/[id]/create/aspects` — **db**
  - capability: Stage 3 of the create flow (Aspects): the template's Aspects with both opinion labels, each collapsed to one row, opened in place, reworded, added to, removed from and reordered by drag before the relationship is created.
  - components: `components/assessment-flow`, `components/billing`, `components/flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/rows.ts`, `lib/db/template-library.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The one interactive stage (#689). It reads the draft stages 1–2 wrote and the template through `readLibraryTemplate()`, and renders the working list: the draft's own when stage 3 has saved, the template's on a first visit (`lib/flow/aspects.ts::workingAspects` — absent means "untouched", an emptied array means "the person emptied it"). `components/assessment-flow/aspect-list.tsx` is the flow's only client component: a row opens in place, saves itself with `POST /assessment/new/aspects` (JSON, one small request per committed gesture) and collapses on success; the order is a pointer drag on the handle (pointer events, not HTML5 dnd, so a finger works) with Arrow Up/Down on the same handle as the keyboard path. Both write the list into the same draft cookie, which is what makes the order and the words survive a reload. **Add and remove are drawn here since #699**: the create asks `aspectsToWrite()` whether the list is still the version's copy (reworded only — ids and order stay the version's, and `db:verify` V4 compares it to the pin) or the creator's own (an added, removed or reordered Aspect — `aspects_authored_at` is stamped on the session and V4 validates the copy's structure instead). The last Aspect cannot be removed: a relationship asks at least one, and the create refuses an empty list (`aspects-none`) rather than writing an instance the model cannot parse.

- `/dashboard/templates/[id]/create/commit` — **db**
  - capability: Stage 4 of the create flow (Account): "Create your account" in the stage column with "Sign in" one in-place toggle away — the app's own two auth views, no second form — the six facts stages 1–3 decided read back beside it, and the one control that writes the relationship as a draft.
  - components: `components/assessment-flow`, `components/auth`, `components/billing`, `components/flow`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/account-providers.ts`, `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-library.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/client.ts`, `lib/auth/google-flow-neon.ts`, `lib/auth/google-flow.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The account, and the draft (#825, superseding the gate #690 put behind this screen; the default and the toggle are #829). The column is `components/assessment-flow/account-panel.tsx`, which owns which of the two app-owned auth views is showing: it opens on **Create your account**, because a first-time creator is the person this stage is for, and both directions of the toggle swap **in place** — `RegisterView` and `LoginView` each take an `onSwitch…` callback in place of their cross-link when they are mounted here, so no navigation leaves the stage column, the review beside it or the draft cookie. Absent those callbacks both views keep their page behaviour and `/login` and `/register` stay byte-identical (`pnpm parity`), which is what lets the flow reuse the one implementation of each instead of growing a second sign-up form with a password field in it. Stage 1’s first and last names arrive as the register form’s prefill, so the same person is not asked for their own name twice. `next` and `destination` are this same address, which is what makes the round trip work — the draft is a `sameSite: "lax"` cookie, so a Google round trip, a password sign-in or a sign-up returns to this stage with the answers intact; the copy says the answers are saved on this device and names the missing-draft case only when it is true (decision, 2026-11-12). The form posts `templateRecordId` **and `draft=1`** to `POST /assessment/new`, which reads who, mode, setting and the Aspect list from the same draft cookie the three earlier stages wrote and writes the relationship with `status = 'draft'`, `published_at` NULL — plus the session and invitation row stage 5 needs — and sends **nothing**. Re-entered with `?instance=<id>` (stage 5's `Back`), the advance is a link instead of a form, so one template cannot be written twice. The six facts are the template (with its own Aspect count), both seats, the title, the Mode and the Setting, drawn by `components/assessment-flow/relationship-review.tsx`.

- `/dashboard/templates/[id]/create/invite` — **db**
  - capability: Stage 5 of the create flow (Invite): the plans as a comparison beside the account's free week (no card at any step), the address the invitation goes to, and the two acts — send it, or keep the draft.
  - components: `components/assessment-flow`, `components/billing`, `components/flow`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts`, `lib/db/template-library.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The decision the flow exists to reach (#825). `Send and Continue` posts to `POST /assessment/instances/[id]/send`, which calls `sendDraftInvitation()`: the token is reissued first (`resendInvite` owns one-token-per-instance and the cooldown), then the status flips `draft → published` through `canTransition()` with `published_at` stamped, and the email goes out after that commit — the order is what stops a published relationship with a token nobody sent. `Continue as Draft` is a plain link to `/dashboard`, where the draft is listed; it sends nothing and charges nothing. The walk (#771: plan, account, method, confirmation, done) is `components/assessment-flow/invite-walk.tsx`, one client component so the server column stays server-rendered; choosing a plan writes nothing, the method step defers the capture to publish, and the stage's foot no longer depends on which panel is open — the send is the stage's act, not the walk's. The relationship is read through `readFlowScreen()` with this browser's `flow_party_*` cookie and then the signed-in account, so a crafted id, somebody else's relationship and a dead one all land back on Details.

- `/dashboard/templates/[id]/create/mode` — **db**
  - capability: Stage 2 of the create flow (Mode): the Mode (fixed at creation) and the Setting (the one choice a party may change later), over the draft stage 1 wrote.
  - components: `components/assessment-flow`, `components/billing`, `components/flow`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/rows.ts`, `lib/db/template-library.ts` · an `/api` path — `data/billing-plans.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: Saves, and hands over (#688, #689). It reads the draft cookie, refuses a missing draft or a signed-out viewer by sending them back to stage 1, and its form posts the Mode and the Setting to `POST /assessment/new/mode`, which merges the two choices into the same draft and answers a 303 to `…/create/aspects`. The create itself moved to stage 3's control when the approved flow put Aspects between Mode and the invite: this step no longer copies a template or writes any row. The page is a sibling of `/…/create` rather than a `?step=` switch because the flow is a sequence of stages. It renders the same `CreateRelationship` component and the same fixture as stages 1 and 3, so the steps cannot drift into three vocabularies.

- `/demo` — **mock**
  - capability: The demo PIN gate: one four-digit field and a submit. A correct PIN sets a signed, httpOnly unlock cookie and redirects to `/login`, where the three role buttons appear.
  - components: `components/auth`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`
  - notes: Exists only under DEMO_AUTH=1, and refused when VERCEL_ENV=production unless DEMO_ALLOW_PRODUCTION=1 is also set; outside demo mode the route answers the same 404 a URL that never existed does. `mock` rather than `db` since #218: the gate reads no Postgres — it compares the PIN and signs a cookie, and the credential read moved to the role action behind `/login`.

- `/demo/admin` — **db**
  - capability: The admin-only check the demo's role buttons prove: it prints the session and the role it read from Postgres, and a member account asking for it gets a 404 rather than a 403. Reachable by URL — the demo's Admin button lands on `/admin/instances` instead, and this page's own button opens it.
  - components: `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The first caller of requireAdmin(); a demo-only surface, so it answers 404 outside demo mode like every other /demo route. A proof, not a destination: nothing in the flow links here.

- `/how-it-works` — **fixture**
  - capability: The onboarding page, replayed: the three paths a browser really walked through the create flow — publish, keep as a draft, stop at payment — one band per recorded step with the values the persona typed beside the screenshot the product answered with, the findings the walk met on each path, and then the six moves of one relationship in words with the honest limits of this build.
  - components: `components/onboarding`
  - reads: Postgres — `lib/db/client.ts` · an `/api` path — `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The rail's How it works row used to leave the console for `/#questions` on the public front page; this route is its real destination (owner's review of the console). A variation of the alignment front page's `#questions` composition, not a new pattern — the heading/body band, numbered, with two halves beside each other (`components/onboarding/how-it-works.tsx`, ancestor in its `template-ancestor:` header); since #898 the bands are the _recording's_ steps rather than drawn ones, read from `docs/qa/demo-flow/transcript.json` (written by `pnpm demo:flow`, held to a fresh run by `pnpm demo:flow:check`) through `lib/demo-flow/transcript.ts`, with the committed PNGs served by `/qa-demo-flow/[...shot]` — nothing is captured at request time. `/dashboard/help` mounts the same component and fixture without the recording, so the moves and the tour replay stay one surface. It answers a signed-out visitor with the page (a walkthrough a reader can only see after signing up is a drawing again) and hides the one CTA that would land a stranger on a login wall; the session is still read through `currentUserIfConfigured()`. It refuses to render on a build that ships the quiz product instead (`quizProductShipped()`, the same flag resolver the quiz routes read) — the copy is the relationship product's, and #300 is the record of what happens when one product's words are served under the other's name. `fixture` and not `db`: it reads page copy, a committed transcript and a session, and no row.

- `/invite/[token]` — **db**
  - capability: What an invitation says, and the button that claims it — a single-use token spent by a POST once the invited party accepts.
  - components: `components/assessment-flow`, `components/layout`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts`, `lib/db/relationship-payment.ts`, `lib/db/rows.ts`, `lib/db/steps.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`

- `/welcome` — **fixture**
  - capability: The public AlignSynch landing page in its own chrome: what a Gap is, how it works, four opinions and two modes.
  - components: `components/marketing`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`

### Component domains

- `components/admin` — **db**
  - capability: The operator's five screens' chrome: the registry table with its stage tabs and filters, one relationship's five audited repair bands, that relationship's Gap report with its export/reissue/read bands, the audit log's filtered table whose before/after values open on a click, the support inbox — the contact queue with one message's thread, the provider's verdict and throttle on that address, and the reply, triage and assignment bands — and, in `docs/`, the documentation reader: the 117-page hub with its filter and one rendered markdown document.
  - files (33): `audit-log.tsx`, `billing-control.tsx`, `brand-profile.tsx`, `broadcast-composer.tsx`, `docs/doc-article.tsx`, `docs/doc-feedback.tsx`, `docs/docs-hub.tsx`, `docs/features-index.tsx`, `docs/releases-shelf.tsx`, `email-templates/email-template-editor.tsx`, `email-templates/email-template-registry.tsx`, `growth-console.tsx`, `permissions/permissions-console.tsx`, `platform-health.tsx`, `relationship-operations.tsx`, `report-operations.tsx`, `review-artifacts.tsx`, `review-refusal.ts`, `review-thread.tsx`, `review-todos.tsx`, `session-registry.tsx`, `spec/spec-frame.tsx`, `spec/spec-notice.tsx`, `spec/spec-overview.tsx`, `spec/spec-status-box.tsx`, `spec/spec-status.tsx`, `spec/spec-submenu.tsx`, `spec/story-page.tsx`, `spec/validation-matrix.tsx`, `support-inbox.tsx`, `support-thread.tsx`, `template-editor.tsx`, `template-registry.tsx`
  - routes (24): `/admin/audit`, `/admin/billing`, `/admin/brand`, `/admin/broadcast`, `/admin/docs`, `/admin/docs/[...slug]`, `/admin/docs/features`, `/admin/docs/releases`, `/admin/email-templates`, `/admin/email-templates/[id]`, `/admin/growth`, `/admin/health`, `/admin/inbox`, `/admin/instances`, `/admin/instances/[id]`, `/admin/instances/[id]/report`, `/admin/permissions`, `/admin/review`, `/admin/spec`, `/admin/spec/[group]`, `/admin/spec/validation`, `/admin/templates`, `/admin/templates/[id]`, `/dashboard/templates/[id]`
  - notes: `db`, and by a different route than it first claimed: every component here renders props the page read (a client component must not reach `pg`), and what pulls the domain into the database graph is the _type_ it renders — `relationship-operations.tsx` annotates its props with `AdminRelationshipDetail`, and `import type` from `lib/db/**` still walks to `lib/db/client.ts` in this generator's graph. E34 is the runtime claim and it stays green: no `"use client"` module here value-imports a server module, which is why the pages render rather than 500. The audit log's filters, row projections and 48-character truncation live in `lib/admin/audit-log.ts`, which is pure for exactly this reason — the ui-registry check caught that module reaching `pg` through `lib/admin/act.ts`'s vocabulary, and the list moved to `lib/admin/roles.ts` rather than the domain widening its claim.

- `components/assessment` — **mock**
  - capability: The assessment report: each Aspect's two Opinions, the Values behind them and the Gap between the parties.
  - files (2): `assessment-report.tsx`, `assessment-unreadable.tsx`
  - routes (2): `/assessment/[slug]`, `/relationship-templates/[slug]/demo`
  - notes: Reads nothing itself — the instance arrives as props from the route that read Postgres, which is why the surface is `mock` and the route above it is `db`. Since #204 it also draws the one failure state the route can describe: `assessment-unreadable.tsx` prints the database layer's own sentence when the read did not answer, instead of Next's 500 and a digest.

- `components/assessment-flow` — **db**
  - capability: The two-party flow: the published template list, the invite view, the blind answer form and the instance screen both parties share. It also owns the raised-surface container every dashboard page renders inside — `stage-column.tsx` (`StageColumn`), 1126px up to one left edge at 274 and no `mx-auto` — which is the shape #717 gave the eighteen admin pages and #858 gave the member console.
  - files (47): `accept-session.tsx`, `account-panel.tsx`, `alignment-view.tsx`, `answer-form.tsx`, `answer-review.tsx`, `answer-sheet.tsx`, `aspect-answer-card.tsx`, `aspect-drawer.tsx`, `aspect-list.tsx`, `create-failed.tsx`, `create-relationship.tsx`, `flow-entry-link.tsx`, `flow-stage-card.tsx`, `invite-link.tsx`, `invite-view.tsx`, `invite-walk.tsx`, `join-accept-step.tsx`, `join-account-step.tsx`, `join-invite-step.tsx`, `join-party-cards.tsx`, `join-stepper.tsx`, `plan-choices.tsx`, `record-detail-shell.tsx`, `reinvite-form.tsx`, `relationship-flow-shell.tsx`, `relationship-review.tsx`, `report-view.tsx`, `sent-state.tsx`, `session-view.tsx`, `stage-account.tsx`, `stage-choice-form.tsx`, `stage-column.tsx`, `stage-foot.tsx`, `stage-gauge.tsx`, `stage-invite.tsx`, `stage-one-fields.tsx`, `stage-one-form.tsx`, `stage-rail.tsx`, `stage-shell.tsx`, `stage-title-focus.tsx`, `steps-panel.tsx`, `submission-confirmation.tsx`, `template-card.tsx`, `template-list.tsx`, `wizard-progress.tsx`, `wizard-rail.tsx`, `wizard-steps.tsx`
  - routes (62): `/admin/audit`, `/admin/billing`, `/admin/brand`, `/admin/broadcast`, `/admin/console`, `/admin/console/relationships`, `/admin/console/relationships/[id]`, `/admin/console/templates`, `/admin/console/templates/[id]`, `/admin/console/users`, `/admin/docs`, `/admin/docs/[...slug]`, `/admin/docs/features`, `/admin/docs/releases`, `/admin/email-templates`, `/admin/email-templates/[id]`, `/admin/gaps`, `/admin/growth`, `/admin/health`, `/admin/inbox`, `/admin/instances`, `/admin/instances/[id]`, `/admin/instances/[id]/report`, `/admin/permissions`, `/admin/review`, `/admin/spec`, `/admin/spec/[group]`, `/admin/spec/validation`, `/admin/templates`, `/admin/templates/[id]`, `/assessment`, `/assessment/[slug]`, `/assessment/instances/[instanceId]`, `/assessment/instances/[instanceId]/accept`, `/assessment/instances/[instanceId]/answer`, `/assessment/instances/[instanceId]/report`, `/assessment/instances/[instanceId]/sent`, `/assessment/new/failed`, `/assessments`, `/dashboard`, `/dashboard/chat`, `/dashboard/help`, `/dashboard/payment`, `/dashboard/relationships`, `/dashboard/relationships/[id]`, `/dashboard/support`, `/dashboard/support/articles/[slug]`, `/dashboard/templates`, `/dashboard/templates/[id]`, `/dashboard/templates/[id]/create`, `/dashboard/templates/[id]/create/aspects`, `/dashboard/templates/[id]/create/commit`, `/dashboard/templates/[id]/create/invite`, `/dashboard/templates/[id]/create/mode`, `/dashboard/templates/[id]/propose`, `/dashboard/user`, `/invite/[token]`, `/my-quizzes`, `/profile/[username]`, `/relationship-templates/[slug]/demo`, `/settings`, `/support`
  - notes: Reads and writes Postgres through lib/flow/store.ts, so it is not a prop-only domain like components/assessment beside it. `StageColumn` is the one container: a page that centres itself, or spells a second `max-w`, is the regression `data/surface-columns.ts` and `scripts/column-refs.ts` measure in the gate (a `wide`/`bleed` page is a registered exception with a reason and, for `bleed`, a way back). The stage dialog in `stage-shell.tsx` is the one documented centred box — a sheet, not a page column.

- `components/billing` — **db**
  - capability: The money surfaces: `stripe-frame.tsx` mounts the provider's embedded checkout for a client secret a server minted, and `payment-view.tsx` draws the member's Payment page — one trial panel per relationship, the account's Payment Method, Billing History and How Trials Work, and the Counterparty's one coverage sentence.
  - files (2): `payment-view.tsx`, `stripe-frame.tsx`
  - routes (6): `/dashboard/payment`, `/dashboard/templates/[id]/create`, `/dashboard/templates/[id]/create/aspects`, `/dashboard/templates/[id]/create/commit`, `/dashboard/templates/[id]/create/invite`, `/dashboard/templates/[id]/create/mode`
  - notes: `stripe-frame.tsx` — `The provider's frame, and only the frame.` Lifted out of `components/dashboard/payment-capture-dialog.tsx` by #911, because two surfaces then took a card — that dialog and stage 5's pay walk — and the card's rule is one implementation of the capture, never two copies of `loadStripe()` that drift. **#912 retired the dialog**, so this is now the only surface in the app that mounts a card, and `tests/one-payment-surface.test.ts` holds that as an exact set. The submit is Stripe's own control inside the iframe; this module draws the mount point and nothing that submits. `payment-view.tsx` (#1132) is `db` for the domain's status since it landed: it reads no row itself — every panel is derived from rows the page passes in (`lib/billing/payment-view.ts`) — but the module it renders is reachable from `lib/member/relationships.ts`, so the domain is no longer the read-nothing `mock` it was when the frame was alone.

- `components/console` — **mock**
  - capability: The console's generic shapes: a stat-card grid of linked figures with the Overview built from it (a header naming the viewer, four counts and the honest empty state for an account with no relationships), and the response-analytics surface — a population's numbers as stat cards, one distribution per measure and a comparison axis, taking the aggregate as a prop so the measure is a plugin rather than a component.
  - files (4): `gap-analysis.tsx`, `gap-histogram.tsx`, `overview.tsx`, `stat-card-grid.tsx`
  - routes (3): `/admin/console`, `/admin/docs/features`, `/admin/gaps`
  - notes: Reads nothing itself: counts and aggregates arrive as props from the route that read Postgres, which is why the domain is `mock` and the `/dashboard` and `/admin/gaps` routes above it are `db` (the same split `components/assessment` records). `stat-card-grid.tsx` is the extracted shape of `components/dashboard/dashboard-overview.tsx` with its metrics removed — `value` is a `number` the caller computed — so the next expression can pass its own rows through the grid without inheriting a wallet balance. Its two callers are `/dashboard` (the viewer's own counts, `lib/flow/overview.ts`) and `/admin/gaps` with AlignSynch's measure (`gapOf` over the eight kinds, `lib/admin/gap-aggregates.ts`); the quiz expression of the analytics surface is the per-question correct rate `components/my-quizzes/quiz-statistics.tsx` mocks. `data/pages/overview.ts` holds every word (E23 budget 0).

- `components/flow` — **db**
  - capability: The create flow's five stage modules — Details, Settings, Aspects, Account, Invite — held where no address reaches them, because the same module is both a page and the dialog a slot mounts over the shelf. The address is `/dashboard/templates/[id]/create{,/mode,/aspects,/commit,/invite}` — a template **slug** in a segment Next names `id`, because Next refuses two dynamic segment names at one level and the editor next door is `/dashboard/templates/[id]`; the URL a person sees is `/dashboard/templates/<slug>/create…`. #1109 phase 2 moved these files out of `app/(mainlayout)/templates/relationship/[slug]/create/**/page.tsx` with `git mv`, and nothing about a stage changed in the move.
  - files (5): `template-create/aspects.tsx`, `template-create/commit.tsx`, `template-create/create.tsx`, `template-create/invite.tsx`, `template-create/mode.tsx`
  - routes (5): `/dashboard/templates/[id]/create`, `/dashboard/templates/[id]/create/aspects`, `/dashboard/templates/[id]/create/commit`, `/dashboard/templates/[id]/create/invite`, `/dashboard/templates/[id]/create/mode`
  - notes: The rule this directory exists to keep is **a stage is written once and mounted twice**: each module takes `mount?: FlowMount` (default `"page"`), the route file under `dashboard/templates/[id]/create` renders it bare, and the `@flow` interceptors in `dashboard/templates` (`(.)`), `dashboard/relationships` and `assessment` (`(...)`) render it with `mount={FLOW_MOUNT_DIALOG}` — held by `tests/flow-entry-convergence.test.ts` and `tests/flow-dialog-shell.test.tsx`. `db`, like `components/assessment-flow` beside it: the stages read and write through `lib/flow/store.ts` over `lib/db/**`, and no stage changed a query in the move. Keeping the stages out of `app/` is what let the address change without the components knowing, and the five kept their `[slug]` dynamic-param signature because they are still page components.

- `components/marketing` — **fixture**
  - capability: The public pages' own chrome: the marketing header (the brand mark, the shell's public menu and a server-resolved account slot) and the landing page's bands. The footer is the shell's (`components/layout/footer.tsx`), mounted by the group's layout; there is no sidebar.
  - files (4): `carried-plan-link.tsx`, `catalogue-browser.tsx`, `marketing-landing.tsx`, `relationship-catalogue.tsx`
  - routes (3): `/relationship-templates`, `/relationship-templates/[slug]`, `/welcome`

- `components/onboarding` — **mock**
  - capability: The console's onboarding page: the ordered moves of one relationship, each with what the member does beside what the product does, and the honest limits of this build.
  - files (1): `how-it-works.tsx`
  - routes (2): `/dashboard/help`, `/how-it-works`
  - notes: One file (`how-it-works.tsx`), and it is a variation rather than a new pattern: the ancestor is the alignment front page's `#questions` band (`components/home/alignment-home.tsx`), stated in its `template-ancestor:` header. The variation is the sequence — numbered bands instead of a two-up explainer, in the app shell instead of the marketing page. `mock` on the domain and `fixture` on its route for the reason `components/console` is: it renders no data of its own, it takes the route's parsed `PageCopy` as a prop, and the fixture is reached by the page module, not by this domain.

- `components/relationship` — **mock**
  - capability: The relationship edit surface (#623): one panel that edits every field a created relationship carries — title, summary, Aspects, the template-version pin, the counterparty's name and address, the invitation window — with the cost of the change priced from rows and printed before the save.
  - files (1): `relationship-edit-panel.tsx`
  - routes (2): `/admin/instances/[id]`, `/dashboard/relationships/[id]`
  - notes: Reads nothing itself: `readRelationshipEditState()` runs on the route (the panel is a client component and may not reach `lib/db/client`, E34), so the domain is `mock` while both mounts, `/dashboard/relationships/[id]` and `/admin/instances/[id]`, are `db`. One panel, two mounts, one action: staff pass `audience: "staff"` rather than a second screen or a second name. The authority is the ownership/rung check inside `lib/member/relationship-edit.ts`, never a prop. `data/pages/dashboard-relationship-detail.ts` and `data/pages/admin-relationship.ts` each hold the words under one `edit` section (E23 budget 0 on both routes).

- `components/tour` — **live**
  - capability: The first-run tour: up to six steps spotlighting real console elements, a callout naming what each one is for, and a polite live region that announces every step change to a screen reader.
  - files (3): `demo-fill.tsx`, `first-run-tour.tsx`, `replay-tour.tsx`
  - routes (2): `/dashboard`, `/dashboard/help`
  - notes: One file (`first-run-tour.tsx`), and a variation rather than a new pattern: the ancestor is `components/ui/popover.tsx`'s callout, stated in its `template-ancestor:` header — a panel anchored to an element, drawn by driver.js rather than Radix because the tour owns when it opens and needs the overlay, the step engine and the reduced-motion switch; no trigger, no portal, no Radix primitive. `live` because the domain has a real write path: dismissing or completing the tour `POST`s the viewer's own `tour_seen_at` mark to `/api/tour` (`lib/tour/mark.ts`), which is what makes it first-run rather than a nag — the read is the `/dashboard` route's job (`lib/db/tour.ts`), so no client module value-imports `lib/db/**` and E34 stays clean. The words are `data/pages/tour.ts`, parsed by the page and passed down, so this domain's own import closure reaches no `data/` module; driver.js is a dynamic import inside the effect, so nothing touches `window` during the server render. The six anchors live on the console's own elements and the shell's Support row; a step whose anchor is absent from the page is skipped rather than pointed at nothing, which is what the quiz build sees (its menu has no Support-row anchor for the sixth step) and what a returning account sees (no empty-state card for three of them).

- `components/v1` — **prototype**
  - capability: What is left of the /v1 prototype — the operator console's components and the shared primitives they paint with. No route in the app is a `/v1` one.
  - files (9): `admin-console-overview.tsx`, `admin-limits.tsx`, `admin-relationship-detail.tsx`, `admin-relationship-registry.tsx`, `admin-template-detail.tsx`, `admin-template-registry.tsx`, `admin-users-list.tsx`, `relationship-metadata.tsx`, `v1-ui.tsx`
  - routes (6): `/admin/console`, `/admin/console/relationships`, `/admin/console/relationships/[id]`, `/admin/console/templates`, `/admin/console/templates/[id]`, `/admin/console/users`
  - notes: The prototype is retired (#478): `docs/operations/history/V1-RETIREMENT.md` classified 118 `/v1` items, and this domain now holds nine files — the console's own components, all of them written below. The **nine admin components** — `admin-console-overview`, `admin-relationship-registry`, `admin-relationship-detail`, `admin-template-registry`, `admin-template-detail`, `admin-users-list`, `admin-limits`, `relationship-metadata`, `v1-ui` — are the operator console at `/admin/console`, behind `requireAdmin`, reading the in-browser store (`lib/v1/store.tsx`) seeded from `data/v1/fixtures.ts`; that is why they stay a fixture surface while the product's `/admin/instances` reads Postgres. `v1-ui.tsx` is the one shared atom set (`StageBadge`, `GapPill`, `StatTile`, `EmptyState`, `NotFoundState`, `SectionIntro`, the status tones) the console paints with, and `relationship-metadata.tsx` is the mode/setting editor the console's relationship detail draws. The two `release` rows this domain once kept are gone to their destinations: `steps-panel.tsx` became `components/assessment-flow/steps-panel.tsx`, drawn on the instance screen from the Steps acceptance already stores, and `template-demo.tsx` with `report-body.tsx` became the public worked example (`/relationship-types/[slug]/demo`) over the app's own `components/assessment/assessment-report.tsx` — so there is no second report renderer left anywhere. The `/v1` route group, its layout gate, `lib/v1/persona.ts` and the flag-count derivations went with them; `app/(prototype)` no longer exists. Everything else in the domain — the shell, the persona bar, the chat, the shop, the review checklist, the settings views, the answer sheet and the template authoring — was deleted by the cohort before this one.

## QuizHub

### Routes

- `/affiliate` — **fixture**
  - capability: The affiliate programme: how to start earning, the profit calculator, programme features, success stories, FAQ and a closing CTA. Not freely available: `commerce.affiliate` ships it off on every template, and the route answers 404 while it is off (#291).
  - components: `components/affiliate`, `components/layout`, `components/media`, `components/ui`
  - reads: an `/api` path — `components/layout/news-signup.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/shell.ts`

- `/battle` — **fixture**
  - capability: A head-to-head quiz battle: choose a mode, join a lobby, play the same question set live and land on a results screen.
  - components: `components/battle`, `components/media`, `components/ui`
  - reads: 1 record fixture — `data/battle-modes.ts`

- `/categories` — **fixture**
  - capability: Every quiz category as a tile generated from its slug, with a how-it-works block and a closing CTA.
  - components: `components/categories`, `components/layout`, `components/media`, `components/ui`
  - reads: Postgres — `lib/db/client.ts` · an `/api` path — `components/layout/news-signup.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/shell.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`

- `/categories/[slug]` — **fixture**
  - capability: One category's quizzes, under the tile generated for that category.
  - components: `components/categories`, `components/media`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/create/editor` — **mock**
  - capability: Hand-write a quiz in an editor: questions, answer options, media slots and a live draft pane.
  - components: `components/create`, `components/ui`
  - reads: 1 fixture module of page copy, assets or decisions — no records
  - notes: The editor state is literals inside components/create — nothing is saved anywhere.

- `/create/generator` — **fixture**
  - capability: Generate a quiz from a topic, a difficulty and a count, previewing the draft the generator would emit.
  - components: `components/create`, `components/ui`
  - reads: 2 record fixtures — `data/mock-quizzes.ts`, `data/reward-windows.ts`

- `/creator-tips` — **fixture**
  - capability: Editorial tips for quiz creators, browsable by category with featured and latest grids.
  - components: `components/creator-tips`, `components/layout`, `components/media`, `components/ui`
  - reads: an `/api` path — `components/layout/news-signup.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/shell.ts`

- `/creator-tips/[slug]` — **fixture**
  - capability: One creator-tip article, with its related tips.
  - components: `components/content`, `components/creator-tips`, `components/layout`, `components/media`, `components/ui`
  - reads: an `/api` path — `components/layout/news-signup.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/shell.ts`

- `/daily-challenge` — **fixture**
  - capability: One quiz a day: today's quiz, your challenge stats, a daily leaderboard, badge progress and your history.
  - components: `components/daily-challenge`, `components/media`, `components/ui`
  - reads: 3 record fixtures — `data/daily-challenge.ts`, `data/metrics.ts`, `data/players.ts`

- `/explore` — **fixture**
  - capability: Explore quizzes through one shelf per catalogue slot, with filters, featured cards and a category strip.
  - components: `components/explore`, `components/media`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/explore/featured` — **fixture**
  - capability: The featured tabs: one six-card shelf block per featured slot.
  - components: `components/explore`, `components/media`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/leaderboard` — **fixture**
  - capability: The player leaderboard: podium, summary stats and a filterable ranked table. Not freely available: `community.leaderboard` ships it off for every visitor, and only an admin session reaches it — through the flag's `adminBypass` (#184) — while its rows are still the `data/players.ts` mock.
  - components: `components/leaderboard`, `components/media`, `components/ui`
  - reads: Postgres — `lib/db/client.ts`, `lib/db/profile-rows.ts`, `lib/db/rows.ts`, `lib/db/user-profiles.ts` · an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/paths.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`
  - notes: The Postgres reach listed here is the flag's role gate (`lib/auth/require-role.ts` reading `user_profile.role`), not the boards: the rows the page renders are still `data/players.ts`, and the read happens before them.

- `/my-quizzes` — **fixture**
  - capability: Your own quizzes — drafts, published and their analytics — as a grid of quiz cards.
  - components: `components/assessment-flow`, `components/media`, `components/my-quizzes`, `components/ui`
  - reads: 11 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+8 more)

- `/my-quizzes/[id]` — **fixture**
  - capability: One of your quizzes in detail: its questions, results, analytics and reward window.
  - components: `components/media`, `components/my-quizzes`, `components/ui`
  - reads: 10 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+7 more)

- `/my-quizzes/[id]/statistics` — **mock**
  - capability: Per-quiz statistics: completion, question-level correct rates, time spent and a leaderboard of players.
  - components: `components/media`, `components/my-quizzes`, `components/ui`
  - reads: 2 fixture modules of page copy, assets or decisions — no records
  - notes: The numbers are literals inside components/my-quizzes/quiz-statistics.tsx, headed 'Mock data for the quiz' — no fixture backs them, and this entry records the mock rather than fixing it.

- `/news` — **fixture**
  - capability: Product news and updates, featured first, as article records.
  - components: `components/media`, `components/news`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`

- `/news/[slug]` — **fixture**
  - capability: One news article with share, its comment thread, the author and related articles.
  - components: `components/content`, `components/media`, `components/news`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`

- `/pricing` — **live**
  - capability: Plan comparison read from billing_plan: every sellable tier's action opens the template catalogue carrying that tier and interval, the viewer's own plan marked, an FAQ and a closing CTA. Nothing on this page starts a checkout (#1043) — the plan is chosen here and sold inside the create flow's last stage.
  - components: `components/pricing`, `components/ui`
  - reads: Postgres — `lib/db/billing.ts`, `lib/db/client.ts`, `lib/db/email-templates.ts` · an `/api` path — `data/billing-plans.ts`, `data/brand.ts`, `data/brands/alignsynch.ts`, `lib/auth/request-context.ts`, `lib/auth/server.ts`

- `/quiz-discussions` — **fixture**
  - capability: Every discussion thread across quizzes, with each quiz's comment count and result beside it.
  - components: `components/media`, `components/quiz`, `components/ui`
  - reads: 10 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+7 more)

- `/quiz/[id]` — **fixture**
  - capability: One quiz's overview: header, details, question preview, reviews and the play entry point.
  - components: `components/media`, `components/quiz`, `components/ui`
  - reads: 13 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+10 more)

- `/quiz/[id]/discussion` — **fixture**
  - capability: The comment thread under one quiz.
  - components: `components/media`, `components/quiz`, `components/ui`
  - reads: 10 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+7 more)

- `/quiz/[id]/play` — **fixture**
  - capability: Play one quiz question by question, with a timer, the results screen and a review modal.
  - components: `components/quiz`, `components/ui`
  - reads: 8 record fixtures — `data/authored-quizzes.ts`, `data/browse-quizzes.ts`, `data/created-quizzes.ts` (+5 more)

- `/search` — **fixture**
  - capability: Search the built index over quizzes and categories, rendering hits as quiz cards.
  - components: `components/search`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/shell.ts`

- `/tournaments` — **fixture**
  - capability: Quiz tournaments: the featured championship, the full list, categories, how it works and a CTA.
  - components: `components/layout`, `components/media`, `components/tournaments`, `components/ui`
  - reads: an `/api` path — `components/layout/news-signup.tsx`, `data/brand.ts`, `data/brands/alignsynch.ts`, `data/pages/shell.ts`

- `/tournaments/[id]` — **fixture**
  - capability: One tournament: overview, key dates, stats, categories, rules, prizes and its leaderboard.
  - components: `components/media`, `components/tournaments`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`

### Component domains

- `components/affiliate` — **fixture**
  - capability: The nine affiliate-programme sections the /affiliate route composes.
  - files (9): `about-quizhub.tsx`, `affiliate-cta.tsx`, `affiliate-faq.tsx`, `affiliate-hero.tsx`, `how-to-start.tsx`, `profit-calculator.tsx`, `program-features.tsx`, `success-stories.tsx`, `why-partner.tsx`
  - routes (1): `/affiliate`

- `components/battle` — **fixture**
  - capability: The battle screens: mode selection, the lobby, the live round and its results.
  - files (5): `active-battle.tsx`, `battle-lobby.tsx`, `battle-mode-selection.tsx`, `battle-page.tsx`, `battle-results.tsx`
  - routes (1): `/battle`

- `components/categories` — **fixture**
  - capability: The category grid, the tile generated from a slug, the category detail page and the how-it-works block.
  - files (6): `categories-cta.tsx`, `categories-data.tsx`, `categories-how-it-works.tsx`, `categories-page.tsx`, `category-detail-page.tsx`, `category-tile.tsx`
  - routes (3): `/`, `/categories`, `/categories/[slug]`

- `components/create` — **fixture**
  - capability: The quiz editor, the generator form and the draft shape they share.
  - files (4): `quiz-draft.ts`, `quiz-editor.tsx`, `quiz-generator-templates.ts`, `quiz-generator.tsx`
  - routes (2): `/create/editor`, `/create/generator`

- `components/creator-tips` — **fixture**
  - capability: The creator-tips index and detail: hero, category strip, featured tips, tip cards, related tips and the CTA.
  - files (9): `creator-tips-categories.tsx`, `creator-tips-cta.tsx`, `creator-tips-hero.tsx`, `creator-tips-page.tsx`, `featured-tips.tsx`, `related-tips.tsx`, `tip-card.tsx`, `tip-detail.tsx`, `tips-grid.tsx`
  - routes (2): `/creator-tips`, `/creator-tips/[slug]`

- `components/daily-challenge` — **fixture**
  - capability: The daily challenge: header, today's quiz, your stats, the daily leaderboard, rewards, history and the completed state.
  - files (8): `completed-challenge.tsx`, `daily-challenge-header.tsx`, `daily-challenge-page.tsx`, `daily-history.tsx`, `daily-leaderboard.tsx`, `daily-quiz.tsx`, `daily-rewards.tsx`, `daily-stats.tsx`
  - routes (1): `/daily-challenge`

- `components/dashboard` — **fixture**
  - capability: The prototype dashboard shell: overview, affiliate and wallet panes, an earnings chart, my-quizzes and settings panes.
  - files (28): `affiliate-dashboard.tsx`, `assessments-list.tsx`, `card-menu.tsx`, `dashboard-header.tsx`, `dashboard-overview.tsx`, `dashboard-page.tsx`, `earnings-chart.tsx`, `my-quizzes-dashboard.tsx`, `my-template-detail.tsx`, `my-template-retire.tsx`, `recent-quizzes.tsx`, `relationship-aspects-note.tsx`, `relationship-card-model.ts`, `relationship-card.tsx`, `relationship-cards.tsx`, `relationship-create.tsx`, `relationship-detail.tsx`, `relationship-edit-dialog.tsx`, `relationship-panels.tsx`, `relationship-tabs.tsx`, `relationships-list.tsx`, `settings-dashboard.tsx`, `start-page.tsx`, `start-view.ts`, `template-gallery.tsx`, `template-proposal-form.tsx`, `template-shelf.tsx`, `wallet-dashboard.tsx`
  - routes (7): `/assessments`, `/dashboard`, `/dashboard/relationships`, `/dashboard/relationships/[id]`, `/dashboard/templates`, `/dashboard/templates/[id]`, `/dashboard/templates/[id]/propose`
  - notes: No route renders this domain any more — /dashboard/user is the account home since #164, and only dashboard-page.tsx imports the panes. A candidate to delete or to relayout, not a surface to pick yet.

- `components/explore` — **fixture**
  - capability: The explore page and its featured twin: header, filters, quiz lists, the category strip and shelf blocks.
  - files (7): `explore-categories.tsx`, `explore-featured.tsx`, `explore-filters.tsx`, `explore-header.tsx`, `explore-quiz-list.tsx`, `explore-quizzes-page.tsx`, `featured-quizzes-page.tsx`
  - routes (2): `/explore`, `/explore/featured`

- `components/header` — **fixture**
  - capability: The chat drawer, the notification drawer and the notification icon the shell header used to mount.
  - files (3): `ChatDrawer.tsx`, `NotificationDrawer.tsx`, `notification-icon.tsx`
  - routes: none — no route imports this domain today
  - notes: No route imports this domain: the shell header is components/layout/header.tsx. Catalogued rather than deleted because the drawers read the notification and chat fixtures.

- `components/leaderboard` — **fixture**
  - capability: The leaderboard screens: podium, summary stats, filters and the ranked table.
  - files (5): `leaderboard-filters.tsx`, `leaderboard-page.tsx`, `leaderboard-podium.tsx`, `leaderboard-stats.tsx`, `leaderboard-table.tsx`
  - routes (1): `/leaderboard`

- `components/my-quizzes` — **fixture**
  - capability: Your quizzes, one quiz in detail, and the per-quiz statistics screen.
  - files (3): `my-quizzes.tsx`, `quiz-details.tsx`, `quiz-statistics.tsx`
  - routes (3): `/my-quizzes`, `/my-quizzes/[id]`, `/my-quizzes/[id]/statistics`

- `components/news` — **fixture**
  - capability: The news index and the article page.
  - files (2): `news-article.tsx`, `news-page.tsx`
  - routes (2): `/news`, `/news/[slug]`

- `components/pricing` — **live**
  - capability: The plan cards — prices and sellability from billing_plan, one action per sellable tier that carries that tier and interval into the template catalogue, and the general CTAs that carry nothing — the FAQ and the closing CTA.
  - files (3): `pricing-cta.tsx`, `pricing-faq.tsx`, `pricing-plans.tsx`
  - routes (1): `/pricing`

- `components/quiz` — **fixture**
  - capability: The quiz surfaces: header, details, question, timer, results, the play screen, comments, discussion and the review modal.
  - files (11): `comment.tsx`, `question-discussion.tsx`, `quiz-details.tsx`, `quiz-discussion-page.tsx`, `quiz-discustion.tsx`, `quiz-header.tsx`, `quiz-play.tsx`, `quiz-question.tsx`, `quiz-results.tsx`, `quiz-timer.tsx`, `review-modal.tsx`
  - routes (4): `/quiz-discussions`, `/quiz/[id]`, `/quiz/[id]/discussion`, `/quiz/[id]/play`

- `components/search` — **mock**
  - capability: The search result list, rendering indexed hits as quiz cards.
  - files (1): `search-results.tsx`
  - routes (1): `/search`
  - notes: Renders the rows the route hands it; the index itself is data/searchdata.ts.

- `components/settings` — **fixture**
  - capability: Ten account panes: account, appearance, connected accounts, notifications, privacy, profile, quiz preferences, security, subscription and the missing-icon set.
  - files (10): `account-settings.tsx`, `appearance-settings.tsx`, `connected-accounts.tsx`, `missing-icons.tsx`, `notification-settings.tsx`, `privacy-settings.tsx`, `profile-settings.tsx`, `quiz-preferences.tsx`, `security-settings.tsx`, `subscription-settings.tsx`
  - routes: none — no route imports this domain today
  - notes: No route renders this domain — /settings is components/identity/settings-view since #164. The panes are the prototype's, and they are catalogued so a template can pick one rather than rediscover it.

- `components/tournaments` — **fixture**
  - capability: The tournament screens: featured, list, filters, categories, detail, overview, key dates, rules, prizes, leaderboard, discussion, CTA and the id helper they share.
  - files (17): `featured-tournament.tsx`, `tournament-categories.tsx`, `tournament-cta.tsx`, `tournament-detail.tsx`, `tournament-discussion.tsx`, `tournament-filters.tsx`, `tournament-header.tsx`, `tournament-how-it-works.tsx`, `tournament-ids.ts`, `tournament-leaderboard.tsx`, `tournament-list.tsx`, `tournament-overview.tsx`, `tournament-page.tsx`, `tournament-prizes.tsx`, `tournament-rules.tsx`, `tournament-schedule.tsx`, `tournament-testimonials.tsx`
  - routes (2): `/tournaments`, `/tournaments/[id]`

## No template yet

Catalogued, claimed by no template yet.

### Routes

- `/chat` — **fixture**
  - capability: A message thread: conversation list, composer, per-message rendering and a conversation search, over the committed chat fixture.
  - components: `components/chat`, `components/media`, `components/ui`
  - reads: an `/api` path — `data/brand.ts`, `data/brands/alignsynch.ts`
  - notes: A messaging mock that neither product story includes yet — quiz play and assessment are the two stories this tree tells — so it is catalogued here for a future template to claim rather than deleted or implemented.

### Component domains

- `components/chat` — **fixture**
  - capability: The chat surfaces: conversation list, thread, composer, message bubble, search and a small dropdown.
  - files (9): `chat-conversation.tsx`, `chat-input.tsx`, `chat-message.tsx`, `chat-page.tsx`, `chat-sidebar.tsx`, `chat-utils.ts`, `conversation-list.tsx`, `simple-dropdown.tsx`, `thread.tsx`
  - routes (2): `/chat`, `/dashboard/chat`
  - notes: No template claims messaging yet — the same scope decision as /chat, recorded here so the domain is not orphaned in the catalogue.

## Route handlers

HTTP handlers, not screens: they have no `page.tsx` and render nothing, so they carry no template affinity and no status of their own. The surfaces they serve are catalogued above.

- `/admin/instances/[id]/report/export` — `app/(mainlayout)/admin/instances/[id]/report/export/route.ts`
- `/api/auth/[...path]` — `app/api/auth/[...path]/route.ts`
- `/api/auth/google/finish` — `app/api/auth/google/finish/route.ts`
- `/api/billing/checkout` — `app/api/billing/checkout/route.ts`
- `/api/billing/webhook` — `app/api/billing/webhook/route.ts`
- `/api/contact` — `app/api/contact/route.ts`
- `/api/docs/asset/[...path]` — `app/api/docs/asset/[...path]/route.ts`
- `/api/docs/feedback` — `app/api/docs/feedback/route.ts`
- `/api/news/subscribe` — `app/api/news/subscribe/route.ts`
- `/api/profile` — `app/api/profile/route.ts`
- `/api/resend/webhook` — `app/api/resend/webhook/route.ts`
- `/api/tour` — `app/api/tour/route.ts`
- `/api/version` — `app/api/version/route.ts`
- `/assessment/instances/[instanceId]/accepts` — `app/(mainlayout)/assessment/instances/[instanceId]/accepts/route.ts`
- `/assessment/instances/[instanceId]/answers` — `app/(mainlayout)/assessment/instances/[instanceId]/answers/route.ts`
- `/assessment/instances/[instanceId]/answers/draft` — `app/(mainlayout)/assessment/instances/[instanceId]/answers/draft/route.ts`
- `/assessment/instances/[instanceId]/invite` — `app/(mainlayout)/assessment/instances/[instanceId]/invite/route.ts`
- `/assessment/instances/[instanceId]/send` — `app/(mainlayout)/assessment/instances/[instanceId]/send/route.ts`
- `/assessment/instances/[instanceId]/steps` — `app/(mainlayout)/assessment/instances/[instanceId]/steps/route.ts`
- `/assessment/new` — `app/(mainlayout)/assessment/new/route.ts`
- `/assessment/new/aspects` — `app/(mainlayout)/assessment/new/aspects/route.ts`
- `/assessment/new/mode` — `app/(mainlayout)/assessment/new/mode/route.ts`
- `/assessment/new/who` — `app/(mainlayout)/assessment/new/who/route.ts`
- `/dashboard/templates/[id]/status` — `app/(mainlayout)/dashboard/templates/[id]/status/route.ts`
- `/favicon.ico` — `app/favicon.ico/route.ts`
- `/invite/[token]/claim` — `app/(mainlayout)/invite/[token]/claim/route.ts`
- `/invite/[token]/decline` — `app/(mainlayout)/invite/[token]/decline/route.ts`
- `/invite/[token]/join` — `app/(mainlayout)/invite/[token]/join/route.ts`
- `/pricing/start` — `app/(marketing)/pricing/start/route.ts`
- `/qa-demo-flow/[...shot]` — `app/qa-demo-flow/[...shot]/route.ts`
- `/review-artifacts/[id]` — `app/review-artifacts/[id]/route.ts`
