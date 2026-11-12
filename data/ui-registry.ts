/**
 * The UI registry — the *judgement* half of `docs/ui-registry.md`, and the only place a
 * surface's purpose is written down.
 *
 * `scripts/gen-ui-registry.mjs` derives the other half: every component domain, its files and
 * the routes that import it, straight out of `components/` and `app/`. None of that is typed
 * here, because a hand-kept file list is a second source of truth for a tree that already knows
 * its own shape. What the tree cannot say is _why_ a surface exists and _what is behind it_ — so
 * that is what lives in this file, one entry per surface, and the generator refuses to write the
 * page until every surface in the tree has one, and fails when an entry's surface is gone.
 *
 * A surface is a **route** (`/explore`, `/assessment/[slug]`) or a **component domain**
 * (`components/explore`, `components/ui`) — never a file. `components/ui` is one surface with
 * fifty-one files, not fifty-one entries: a template picks a domain, and per-file prose would
 * describe an implementation detail nobody picks.
 *
 * ## `status` — what is behind the surface
 *
 *   mock      renders literals, props or a stand-in; no data behind it
 *   fixture   reads a committed fixture under `data/`
 *   db        reads Postgres through `lib/db/`
 *   live      has a real write path — a mutating `/api` handler it calls
 *   prototype a variation rendered before it is wired: in-browser state, no `lib/db/` and no
 *             `/api`, off behind a flag until a later pass wires it. The wiring check does not
 *             assert it (a prototype may reach nothing real yet); `ancestor`/`version` name the
 *             variation it copies.
 *
 * These are claims, and the gate checks them against the import graph: `db` must reach a
 * `lib/db/` module, `live` must reach an `/api` path, `fixture` must reach something under
 * `data/`, and `mock` must reach neither a `lib/db/` module nor a record fixture. Page copy
 * (`data/pages/`) and the media and brand records are committed fixtures, so a surface reading
 * only those may call itself `fixture`; but where the words are literals and a fixture only
 * supplies an asset — the statistics screen is the one case here — the honest value is `mock`,
 * and the note says why. That is the acceptance "every fixture-rendering surface is `fixture` or
 * `mock`, never `live`" turned into a step rather than a promise.
 *
 * ## `templates` — the scope decision, not the build
 *
 * Both brands render this one route table: `data/brand.ts` swaps a record, not a page. So
 * "which template includes this surface today" can only mean the choice a _new_ template makes
 * when it picks from this catalogue:
 *
 *   ["quizhub"]              the implementation is quiz-specific — a quiz player, a tournament
 *                            bracket, a leaderboard of quiz players
 *   ["alignsynch"]           the alignment product's own — the two-question front page, the
 *                            assessment report, the marketing landing
 *   ["quizhub","alignsynch"] both need it unchanged — the shell, the primitives, identity,
 *                            settings, the media registry
 *   []                       catalogued before any template owns it; the page groups these
 *                            under _No template yet_
 *
 * ## `capability` — the field that preserves intent
 *
 * One sentence on what the surface would do if it were implemented, in the product's own words
 * where the copy already says them (`data/pages/*`). When nobody has described a surface the
 * value is exactly `undocumented` (`UI_UNDOCUMENTED` below) and the page lists those separately
 * — an honest gap beats a confident lie, and a sentence invented here would be the registry
 * lying about the thing it exists to remember. Today every surface has a sentence because the
 * components and the copy name their own purpose; nothing was inferred from a filename alone.
 *
 * `notes` is optional and carries the remarks that belong to a future template, or the fact that
 * a domain is no longer rendered — "no route imports this domain since #164" is exactly the kind
 * of thing a catalogue is for and a file listing cannot say.
 *
 * ## Adding, removing, renaming
 *
 * Add a component domain or a route and the gate goes red until an entry appears here: the
 * generator names the surface, its file count and the routes that import it. Delete one and the
 * entry left behind is red too. Neither half may move alone.
 *
 * Every field except `notes` is required, `kind` and `surface` identify the row, and `.strict()`
 * makes a misspelled key an error rather than a silently ignored field.
 */
import { z } from "zod";

/** What is behind a surface. See the header — the gate checks every value against the imports. */
export const zUiStatus = z.enum(["mock", "fixture", "db", "live", "prototype"]);

/** The templates a surface can be picked for. An empty list means no template claims it yet. */
export const zUiTemplate = z.enum(["quizhub", "alignsynch"]);

/** A surface is a route or a component domain; the two id spaces never collide. */
export const zUiSurfaceKind = z.enum(["route", "domain"]);

/**
 * `undocumented` is a value, not an absence: it is what this file says when nobody has described
 * the surface, and the page lists those separately so the gap is visible instead of plausible.
 */
export const UI_UNDOCUMENTED = "undocumented";

/** One row of the catalogue. */
export const zUiEntry = z
  .object({
    kind: zUiSurfaceKind,
    /** The route path (`/explore`) or the component domain (`components/explore`). */
    surface: z.string().min(1),
    status: zUiStatus,
    /** `[]` is a judgement too: catalogued, claimed by no template yet. */
    templates: z.array(zUiTemplate),
    capability: z.string().min(1),
    notes: z.string().min(1).optional(),
  })
  .strict();

export const zUiRegistry = z.array(zUiEntry);

export type UiSurfaceKind = z.infer<typeof zUiSurfaceKind>;
export type UiStatus = z.infer<typeof zUiStatus>;
export type UiTemplate = z.infer<typeof zUiTemplate>;
export type UiEntry = z.infer<typeof zUiEntry>;

/**
 * The catalogue. Validated on import, so a malformed row fails at generation time with the row's
 * own error rather than rendering half a page.
 *
 * Ordered the way the page renders it: routes first, by path, then component domains, by id.
 * The order is the author's, not the generator's — the page groups by template, so this list is
 * only ever read through `surface`, and a reordering here is not a drift.
 */
export const uiRegistry: readonly UiEntry[] = zUiRegistry.parse([
  /* ------------------------------------------------------------------ *
   * Routes — `app/**\/page.tsx`
   * ------------------------------------------------------------------ */
  {
    kind: "route",
    surface: "/",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The front page: QuizHub leads with category, latest and featured shelves, top players and live winners; AlignSynch leads with the practice a coach runs — a template of their own, a blind two-sided answer and the Gap as the session's agenda — and backs it with the four assessment templates, the counted relationship scope and the three seats on a relationship.",
  },
  {
    kind: "route",
    surface: "/admin/audit",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The audit log: every audited admin write, newest first — when, who and the rung they held at the moment they acted, the action, the row it touched, the reason and both sides of the change — filterable by actor, action, target table and date range, with the filter in the URL so a view is a link.",
    notes:
      "Read-only, and structurally so: it reads `admin_action` through `lib/db/admin-audit.ts`, imports no write path, and `tests/admin-audit-page.test.ts` drives a `support` session at it to prove the 404 and that nothing was read or written. `admin` and `owner` reach it (the ladder is ranked, and the page names only `admin`). Both templates this tree ships claim the `product.admin` capability (#509), which is why the row says both; the console rows beside it say `alignsynch` because those screens carry that product's words. `before`/`after` are drawn as keys and a 48-character truncation with the full value behind a `<details>` click, because the JSONB may hold a party's name. Filters are SQL (`WHERE` clauses built in `lib/admin/audit-log.ts`), not client-side: the log only grows. Migration 0024 adds the `actor_role` column this screen's actor column prints, written by `act()` in the same transaction as the change.",
  },
  {
    kind: "route",
    surface: "/admin/broadcast",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "A one-off notice to the news list — compose a subject and a text body, read it as the recipient will, run a dry run that reports how many addresses it would reach, and send it to everyone who has consented or only to those who joined since a date, with the audience, the exclusions and the count all decided in the server.",
    notes:
      "#507 — the epic's last child, and the first surface that writes to `news_signup`'s list. **Consent is applied in the query, not to a rendered list**: `lib/db/news-signups.ts::broadcastAudience()` excludes an address only when `unsubscribed_at`, `bounced_at` or `complained_at` is set (0027's marks, plus the unsubscribe mark 0028 adds), and the dry run and the send call that one function, so the reported count and the sent count cannot drift. **No address reaches a client component**: the screen receives six counts and the newest twenty sends, and the send action answers `sent`/`failed` numbers. The send is one `act()` transaction (`broadcast.send`, floor `admin` — a `support` session gets `role-too-low` inside the transaction, not a hidden button) that writes `broadcast_send` and one `broadcast_recipient` row per address, and the audit row carries `bodyHash` and `recipientCount` rather than the body or the list. The per-address cooldown is 24 h and the cap is 200; over the cap refuses rather than truncating. `lib/email/key-mode.ts` resolves the deployment's key mode and a test key is refused by the action while the same answer is drawn as the banner — a banner is not the enforcement, the action is. The 0028 migration's `unsubscribed_at` contradicts 0019's \"unsubscribe is a delete\" on purpose, and the migration says why: a deleted row cannot be seeded, cannot be told from a signup that never happened, and cannot be re-marked.",
  },
  {
    kind: "route",
    surface: "/admin/billing",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Subscription state per relationship — plan, the period it is covered for, the provider id and state, and whether the checkout ran on live or test keys, as a badge on every row and a banner over the list — plus the plan's relationship limit and one audited action: an owner comps or extends a tier for a period.",
    notes:
      "#505 — the first console screen that reads `billing_subscription`, and the first that writes `plan_grant`. **No card data, ever**: `lib/db/admin-billing.ts` names its columns and they are a provider id, a provider state, a period and a boolean; a payload that grew a `last4` could not reach a render without a column added in a diff. The mode is a banner and a per-row badge because both adapters this build carries are test-mode today (`0026` stores the provider's own `livemode`, defaulting to test). The comp goes through `act()` (`plan.comp`, floor `owner` in `lib/admin/roles.ts` — `admin` reads, `owner` gives), writes `plan_grant` rather than `billing_subscription` so a gift is never mistaken for a payment, and is idempotent by **period**: a second grant with the same `period_start` is refused by `plan_grant_period_key` inside the transaction, leaving neither a grant nor an audit row. The limit the tier sells is enforced in the server, on the create that mints an invitation (`lib/flow/store.ts` asks `relationshipGateRefusal()`), and a refusal names the plan and the number.",
  },
  {
    kind: "route",
    surface: "/admin/console",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "The admin console — records, relationships, templates and the two seats, read-only for answers.",
    notes:
      "Moved out of the `/v1` prototype tree (#478) so the prototype can be deleted without taking it: the six console pages now sit under the app shell at `/admin/console`, and their layout gates the subtree with `requireAdmin()`. The rows are still the in-browser store seeded from `data/v1/fixtures.ts` — the operator's Postgres registry is `/admin/instances`, a different screen — which is why this is `fixture` and not `db`.",
  },
  {
    kind: "route",
    surface: "/admin/console/relationships",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "The relationship registry — every relationship, live or archived, with its template, derived stage, both seat states and its subscription state, filtered by the same links the overview's counts produce; read-only for answers, with a one-click restore on an archived row.",
  },
  {
    kind: "route",
    surface: "/admin/console/relationships/[id]",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "One relationship as an operator sees it — its seats, subscription and a session list that says scored or open and nothing a party answered — with Archive behind a confirmation and a Restore that is one click.",
  },
  {
    kind: "route",
    surface: "/admin/console/templates",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "The template registry — every template with the number of relationships started from it, and an enable/disable action behind a confirmation that the store can undo.",
  },
  {
    kind: "route",
    surface: "/admin/console/templates/[id]",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "One template as an operator sees it — the Aspects as authored, and every relationship started from it, live and archived, with the enable/disable pair.",
  },
  {
    kind: "route",
    surface: "/admin/console/users",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "The two seats and the members, with role, account state and last sign-in from the store — no addresses, and no user-management form that would pretend to write to Neon.",
  },
  {
    kind: "route",
    surface: "/admin/gaps",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The Gap across a population: the eight kinds the model defines, counted over relationships both parties have finished, read under each relationship's own Setting. Nameless aggregates — no party, no score, no ranking — and a Setting with fewer complete relationships than the floor states that instead of charting.",
    notes:
      "The console's one relationship-specific screen and the only caller of `lib/admin/gap-aggregates.ts`. Its generic form is response analytics (stat cards, one distribution per measure, a comparison axis); what varies is the measure (`gapOf` over eight kinds), the population (complete instances) and the comparison (Setting). Admin only: `requireAdmin()` first, so a member gets the 404 `/demo/admin` documents. No migration and no stored aggregate — every number is a function of the `opinion` rows.",
  },
  {
    kind: "route",
    surface: "/admin/health",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The platform's own health, for an operator: what the last db:verify run said (its failing rule codes exactly as the script prints them), the last gate lane and its CI first-pass yield, whether the tag, package.json and production are one release, and how far production trails main — every number labelled with the command or the recorded instant it came from.",
    notes:
      "Read-only and read-only structurally: it imports no write path, renders no form and reads `data/health/platform-health.json` (written by `pnpm health:record`), `package.json` and three `git` answers. Live where a checkout exists (the tag, `origin/main`, the commit distance) and recorded where a deployment has no `.git`, which is why every value carries its own source line — a number with no source is a defect, not a rounding. Both templates claim `product.admin` (#509); `support` gets the 404 through `requireAdmin()`. Nothing here executes `db:verify` or calls the CI API during a render: the record is the artifact, and the recorder is the only writer.",
  },
  {
    kind: "route",
    surface: "/admin/inbox",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The support inbox: every contact message with its triage status and assigned seat, one message's thread under the queue, the mail provider's verdict on the address, the contact form's throttle for that address, and three audited operations — reply through the site's own sending identity, move the status, assign the seat.",
    notes:
      "#506 — **the first `support` surface of the console**, and the reason the rung exists: `requireAdminProduct()`, then `requireRole(\"support\")`, so a `member` gets the 404 a URL that never existed returns and a signed-out visitor is sent to `/login?next=/admin/inbox`. Every write is `act()`'s (`message.reply`, `message.assign`, `message.status`, all floor `support`), and the reply is deliberately **two audited transactions with the send between them**: the reply row is stored and the message moved to `waiting` before the provider is called, and `sent_at` lands only in the second transaction, under `0028`'s `contact_reply_sent_has_instant` CHECK — a 4xx leaves the message `waiting` with the provider's refusal stored on the reply and rendered under it. A hard bounce or a spam complaint (`email_event`, joined by recipient, hardness read through `lib/email/inbound.ts::bounceIsHard`) refuses the send in the screen *and* in the server, with the sentence saying which. The throttle is derived rather than recorded — the 429 path writes nothing on purpose — from the messages the form did keep inside its window. No address is rendered anywhere a visitor can reach: the inbox is gated at `support` and no public page links to it.",
  },
  {
    kind: "route",
    surface: "/admin/instances",
    status: "db",
    templates: ["alignsynch"],
    capability:
      'Every relationship in the database, for an operator: the template, both seats\' identity state, mode, Setting, the derived stage, when it was created and when anything last happened to it — filterable by stage, mode, Setting and "stalled".',
    notes:
      "Admin-only, and the first caller of `requireAdmin()` outside `/demo/admin`: a member gets the 404 a URL that never existed returns, a signed-out visitor is sent to `/login?next=` this path. The blind rule holds for an admin too — the read selects seats, mode, Setting and the stage, never an opinion, a score, a Gap or an answered count, so there is no column and no prop through which an answer could reach the page. Read-and-filter only: no delete, no force-complete. Every filter is client-side over the one read (`lib/db/admin-instances.ts`).",
  },
  {
    kind: "route",
    surface: "/admin/instances/[id]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "One relationship, and the five audited repairs an operator may make on it: clear a party's unlock mark, reissue or withdraw the invitation, void the session, or record an acceptance on a seat's behalf.",
    notes:
      "#503 — the first caller of `lib/admin/act.ts`: every repair is one transaction that reads the actor's rung from `user_profile`, runs the mutation and inserts the `admin_action` row before it commits, so a change without its audit entry is not representable. Admin-only (`requireAdmin()`, after `requireAdminProduct()`), while two of the five floors are `support` — the floors are enforced by `act()`, and the support view is #506. The read is `lib/db/admin-relationship.ts`: seats, the invitation's address and answered **counts**, never an opinion or a score. The fresh token a resend mints is returned to the component once and is deliberately absent from the audit row.",
  },
  {
    kind: "route",
    surface: "/admin/review",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The console's review shelf: every published prototype, diagram and report grouped by the release it belongs to, with the artifact itself in a sandboxed frame beside its to-do checklist and its GitHub-shaped feedback list (issue number, state, title, labels, author, age → thread).",
    notes:
      "#665 — the record is #667's store (`review_artifact` / `review_todo` / `review_issue`, read through `lib/db/review-artifacts.ts`: `listReviewArtifacts()` carries both counts per row, `readReviewArtifact()` the two lists, `readReviewIssue()` one thread); `docs/review/artifacts.json` is presentation only — the release each artifact ships with and the one line a reviewer reads first — and every catalogue row must carry a manifest row and vice versa, or the shelf refuses to build. The list is **grouped by release** and a group is archived or active as one: membership from the manifest, state from `docs/changelog/releases.json`, so only the newest release is active. `/review-artifacts/[id]` resolves an id or slug against the authored catalogue and answers 404 for anything it does not name (no disk scan, no path parameter; `path` is the guarded `docs/review/**.html` shape in `content/review.ts`), and serves the file with `Content-Security-Policy: sandbox allow-scripts` beside the iframe's own sandbox. It writes: the checklist (`toggleReviewTodoAction`), the reply composer (`commentOnReviewIssueAction`) and close/reopen (`setReviewIssueStateAction`) are mounted in `components/admin/review-todos.tsx` and `review-thread.tsx`, the page hands the actions down as props (the inbox's pattern, so no client module imports a `\"use server\"` one), each write revalidates `ADMIN_REVIEW_PATH`, and a refusal is drawn as the fixture's sentence rather than a silent no-op. The three floors are `admin` in `lib/admin/roles.ts` — the screen is `requireAdmin()`, so a lower write floor would be policy no session could reach. Both templates claim `product.admin` (#509), so `requireAdminProduct()` runs before `requireAdmin()`. `data/pages/admin-review.ts` holds every word (E23 budget 0).",
  },
  {
    kind: "route",
    surface: "/admin/templates",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The authored template catalogue, drafts first — every assessment template record with its slug, publication state, Aspect count and how many relationships already copy it, and the band that starts a new draft from a title, a summary and one Aspect.",
    notes:
      "#502a — the first console screen that writes a template, and the first surface gated on the alignment product as well as the console: `requireAdminProduct()`, then `requireAlignmentProduct()` (the same `product.quiz-surfaces` flag read from the side that does not sell quizzes, so `BRAND=quizhub` answers 404 on both routes), then `requireAdmin()` — a `support` session gets the 404 and nothing is read. The write is `act()` (`template.create`, floor `admin`), and the draft is validated by `zAssessment` inside the transaction, so the console cannot accept a template a fixture could not. Drafts only: a published template is read-only here and the row says so, because editing it in place would drift every session's copied Aspects (E31) — versioning is #502b.",
  },
  {
    kind: "route",
    surface: "/admin/templates/[id]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "One template being drafted: its title, summary and slug, its Aspects as an accordion of prompt/Left Value/Right Value rows with add, remove and reorder, a live preview of the party's answer sheet, and a save that carries a reason.",
    notes:
      "#502a — varies `components/create/quiz-editor.tsx` (tabs, per-item accordion, add/remove) and reuses `components/assessment-flow/answer-form.tsx` for the preview, which is built from the in-progress draft and wrapped in a disabled fieldset so it can never post an answer. `lib/admin/template-draft.ts` assembles the record and hands it to `zAssessment`; the save is `act()`'s (`template.update`) and lands in `admin_action` in the same transaction. Realm and price are drawn read-only from `data/relationship-types.ts` by slug, because they are the type's fields and the record has none — a slug outside the catalogue says so rather than inventing a price.",
  },
  {
    kind: "route",
    surface: "/admin/instances/[id]/report",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "One relationship's Gap report, and the three operations an operator may take on it: export it as JSON or PDF, reissue it with a reason, or read one seat's raw submission behind the PII gate.",
    notes:
      "#504 — the deliverable a customer pays for, as an operations screen. The document is `lib/report/document.ts` (pure): the record plus a projection of the Gaps, so the exported JSON round-trips through `zAssessmentInstance` and every number is recomputable from the rows it carries. `read_submission` is the epic's own action name and the audit row for both exports and a seat read; a member's request answers 404 from the route's `roleAnswerFor()` gate and writes no row, which is `act()`'s floor doing the second half. Doubt is a third gap step the model cannot compute (one value per kind, no history, frozen at completion) and it is stated in the document, the page and the PDF rather than omitted. The PDF is written by hand in `lib/report/pdf.ts` — no PDF dependency was added, and the instant it names is the fixture clock.",
  },
  {
    kind: "domain",
    surface: "components/admin",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The operator's five screens' chrome: the registry table with its stage tabs and filters, one relationship's five audited repair bands, that relationship's Gap report with its export/reissue/read bands, the audit log's filtered table whose before/after values open on a click, and the support inbox — the contact queue with one message's thread, the provider's verdict and throttle on that address, and the reply, triage and assignment bands.",
    notes:
      "`db`, and by a different route than it first claimed: every component here renders props the page read (a client component must not reach `pg`), and what pulls the domain into the database graph is the *type* it renders — `relationship-operations.tsx` annotates its props with `AdminRelationshipDetail`, and `import type` from `lib/db/**` still walks to `lib/db/client.ts` in this generator's graph. E34 is the runtime claim and it stays green: no `\"use client\"` module here value-imports a server module, which is why the pages render rather than 500. The audit log's filters, row projections and 48-character truncation live in `lib/admin/audit-log.ts`, which is pure for exactly this reason — the ui-registry check caught that module reaching `pg` through `lib/admin/act.ts`'s vocabulary, and the list moved to `lib/admin/roles.ts` rather than the domain widening its claim.",
  },
  {
    kind: "route",
    surface: "/affiliate",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The affiliate programme: how to start earning, the profit calculator, programme features, success stories, FAQ and a closing CTA. Not freely available: `commerce.affiliate` ships it off on every template, and the route answers 404 while it is off (#291).",
  },
  {
    kind: "route",
    surface: "/assessment",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The published assessment templates, each with its create form: pick a template and open a two-party instance from the templates that read from Postgres.",
  },
  {
    kind: "route",
    surface: "/assessment/[slug]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "One assessment instance from Postgres: both parties' answers per Aspect, the Opinions and Values behind them, and the Gap between the two.",
  },
  {
    kind: "route",
    surface: "/assessment/instances",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Every relationship the signed-in account is a member of, as the My Quizzes card grid — the template, the stage, both parties, the session counts and the alignment once a session is complete.",
    notes:
      "Scoped by relationship_member.user_id (or party.user_id for rows seeded before #340) against the session — never a name, a query parameter or a role, so an admin sees their own list and no one else's. The stage, the counts and the search are derived per render; `alignment` is the mean Gap of the latest session and is drawn `—`, never 0, until that session is complete, and the money block is the plan and its purchase instant on the Initiator's card alone — never a total.",
  },
  {
    kind: "route",
    surface: "/assessment/instances/[instanceId]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The screen both parties share: answer blind while the other has not, then — stage 6, Align — read the Alignment Aspect by Aspect once both have answered **and both have accepted**.",
    notes:
      "The viewer is resolved from the party cookie in Postgres, never from the URL — a browser with no token for the instance gets a 404. The id may name either the relationship or its latest session, so both URL shapes open the same screen. The two seats are named in their own band; the paid band is drawn from the plan and purchase instant and is handed to the Initiator alone (`paid: null` for every other viewer), and every answer value comes from `visibleRoles()` — the viewer's own until both seats have accepted, both afterwards. While the invitation is unclaimed the link is drawn as selectable text with a copy control beside it, and a refused clipboard selects that text and says so (#257). The completed state is the relationship's Alignment (`components/assessment-flow/alignment-view.tsx`, #692): one row per Aspect with both sheets, both Opinions behind every difference, and a per-Aspect verdict, linked to the per-Gap report at `…/report`. It draws no total and no composite score, and the status sentence above it stays a sentence — the stages here are not the viewer's to drive (`docs/specs/ux-stages.md`).",
  },
  {
    kind: "route",
    surface: "/assessment/instances/[instanceId]/report",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The report both parties read once the sheet is scored: per Aspect the prompt, both named ends of the scale, the verdict under the instance's Setting, both parties' Opinions, and every Gap with the two Opinions it subtracts printed beside it.",
    notes:
      "The read surface the app did not have until #409, ported from the `/v1` prototype's `report-body.tsx` as a server component over `lib/assessment-report.ts` — never a rewiring of the client store (#228, E34). The blind rule is the `screen.report === null` branch, not a redaction: before both parties have submitted, `readFlowScreen` has not read the other party's opinion rows at all and the route draws the locked page, which carries no score, no Gap and no count of the other party's progress. Every number is `gapKindsOf()` over stored rows; an unanswered Opinion prints a dash, never a 0. The viewer is the party cookie's seat (or a coach's membership), so a browser with no role on the relationship gets a 404.",
  },
  {
    kind: "route",
    surface: "/assessment/instances/[instanceId]/accept",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Review and accept a session: the decision first, both seats side by side with what each party has answered, then every Aspect beneath with both Opinion columns sealed.",
    notes:
      "Live since R2 (#427): `POST /assessment/instances/[instanceId]/accepts` records one seat's acceptance in `party.accepted_at` (0016) and the **second** acceptance is what completes the session, so the page draws a real decision rather than a disabled control. The endpoint answers 303 and never renders: a first acceptance returns to this page with that seat marked accepted, the completing acceptance redirects to `/report`, and a refusal comes back as `?accept=<code>` — `already-accepted`, `incomplete` (the seat's own sheet must answer every Aspect), `not-a-party` (a coach holds a membership row and no `party` row, so the same resolver refuses them as a stranger), `no-such-instance`. The blind rule holds through the review window: both sheets stay sealed, and only the second acceptance opens the Gap. The transition derives the relationship's Steps from the same `opinion` rows the report reads, closes the ones whose Gap fell to 0, and commits them in the acceptance's own transaction — 'accepted but no Steps' is unrepresentable — and the unlock notice (#258) fires from the completing acceptance, once.",
  },
  {
    kind: "route",
    surface: "/assessment/instances/[instanceId]/answer",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Answer the Aspect sheet: every Aspect's prompt, both named Values, and one row per seat asking the Opinion kinds the instance's Mode defines.",
    notes:
      "The gated sheet (#427, R2-2), and singular `answer` on purpose: `/answers` in the same segment is the POST-only endpoint the form submits to, and Next refuses a `page.tsx` beside a `route.ts`. The viewer is resolved by `readFlowScreen()` from the party cookie's token hash, then the signed-in account, then a relationship membership, and a request that is none of those gets a 404 — the sheet does not exist for it. `lib/flow/answer-gate.ts` picks one of three shapes: the live form for a seat that may answer (prefilled from that seat's own `opinion` rows), the viewer's own sheet drawn disabled once the answers are sealed, and a coach band with no form at all. The form posts no identity field; the submit is written by `submitAnswers()` under the role the cookie resolves inside its transaction. Pre-completion the other party's rows never leave Postgres — the only opinion query the read runs is filtered by `visibleRoles()` — so the blindness is the shape of the projection, not a conditional in this page. **Pattern conformance (C2, #716):** the page renders inside the shared `StageColumn` (left edge at 274, no `mx-auto` — it drew `mx-auto max-w-3xl` until this card) and mounts the shipped 39px cell rail at stage 6, `Align`, in every one of the four states, because answering is the counterparty's half of the same six-stage journey the create and sent screens draw. The rail is the surface's **only** progress pattern — no bar, no numbered list, no second stepper — and the words are `data/pages/lifecycle.ts`'s six names, referenced from the answer fixture rather than re-typed.",
  },
  {
    kind: "route",
    surface: "/assessment/instances/[instanceId]/sent",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Stage 5, Sent: the invitation's state as three moments — sent, waiting or expired or withdrawn, accepted — with what happens next, the address it went to, the resend control and the way into the relationship.",
    notes:
      "The screen the create lands on (#691): `POST /assessment/new` redirects a signed-in creator here and the account gate forwards a freshly signed-in one, so the stage between the commit and the relationship is a page rather than nothing. The template is `components/assessment-flow/accept-session.tsx` — a single-outcome screen with a status sentence and a next-step list — and the variation is `components/assessment-flow/sent-state.tsx`: a state screen whose centre is the invitation's own timeline. Every state word is `inviteStateOf()`'s answer over the row (`claimed_at` / `expires_at` / `revoked_at`) at the instant the read carried, so `unclaimed`, `expired`, `claimed` and `revoked` each get their own sentence and `screen.invite.link` is only drawn while the claim path would still accept it. The two dates the timeline adds (`created_at`, `claimed_at`) are read in `readInstanceBundle()` and carried as ISO instants — no clock is read in the render path. Resend is the shipped `ReinviteForm` posting to the same `POST …/invite` endpoint, with its cooldown and lifetime cap; the form carries `returnTo=sent` so the 303 comes back to this screen rather than dropping the person onto stage 6 mid-action, and that field is a closed literal, never a URL. Signed out is behind the person, not in front: nothing here redirects to sign-in, and the `go` band says where the relationship lives until an account claims it.",
  },
  {
    kind: "route",
    surface: "/templates/relationship",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The template catalogue, grouped by the relationship type each template names (Business · Personal, then the ones that name none): one card per template with its type, realm, roles and Aspect count, a View details link, and duplicate/archive on the rows this account owns.",
    notes:
      "`record.author_user_id` is the whole rule — `NULL` is a built-in, the author's id is a template a person wrote, and the read returns `author_user_id IS NULL OR author_user_id = $1`, so another account's template is never in the payload. A template written before `0011_console_columns.sql` has no author and therefore reads as built-in; the page says so in its own band rather than leaving it to be discovered. Archiving flips `record.status` to `archived` (author only): the catalogue stops listing it and `createInstanceFromTemplate` refuses it, while every instance already made from it keeps its own copy of the Aspects and still opens. Duplicating copies the record and its items into a new template authored by the caller, whatever state the source is in.",
  },
  {
    kind: "route",
    surface: "/templates/relationship/[slug]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "One template as a landing page: a header band naming its group, realm, Relationship Type and the two role seats, who it is for and who it is not for, every Aspect with both named ends of the scale, and what a Mode and a Setting are. No person's name, no price, no testimonial.",
    notes:
      "The 'open' action. Read-only on purpose — editing is a separate decision, and the spec puts the editor on this same route when it exists. The read applies the same author rule as the library, so another account's template is a 404 here and nothing distinguishes it from an id that does not exist.",
  },
  {
    kind: "route",
    surface: "/templates/relationship/[slug]/create",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Create a relationship from one template, stage 1 (Who): the template and its two seats, the counterparty's address, and the card title both parties will read.",
    notes:
      "Split into two stages by #688. Stage 1 posts `templateRecordId`, both seats, the address, the title and an optional description to `POST /assessment/new/who`, which validates them server-side (`lib/flow/create-draft.ts`), writes one draft cookie (`flow_draft_<templateId>`, 24 h) and answers a 303 to `…/create/mode`. A refusal is a 303 back to this path carrying `?problem=<reason>&field=<field>`, so the band names the field by its own label from `data/pages/assessment-create.ts` — never a column name. Coming back to this stage renders the saved values into the inputs. A child of the template's own address, so the template being copied is the route's fact; the read is `readLibraryTemplate()` with the session's id, the same author rule the library and the detail page apply. A signed-out visitor still gets the account gate (#618).",
  },
  {
    kind: "route",
    surface: "/templates/relationship/[slug]/create/mode",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Stage 2 of the create flow (Mode): the Mode (fixed at creation) and the Setting (the one choice a party may change later), over the draft stage 1 wrote.",
    notes:
      "Saves, and hands over (#688, #689). It reads the draft cookie, refuses a missing draft or a signed-out viewer by sending them back to stage 1, and its form posts the Mode and the Setting to `POST /assessment/new/mode`, which merges the two choices into the same draft and answers a 303 to `…/create/aspects`. The create itself moved to stage 3's control when the approved flow put Aspects between Mode and the invite: this step no longer copies a template or writes any row. The page is a sibling of `/…/create` rather than a `?step=` switch because the flow is a sequence of stages. It renders the same `CreateRelationship` component and the same fixture as stages 1 and 3, so the steps cannot drift into three vocabularies.",
  },
  {
    kind: "route",
    surface: "/templates/relationship/[slug]/create/aspects",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Stage 3 of the create flow (Aspects): the template's Aspects with both opinion labels, each collapsed to one row, opened in place, reworded, and reordered by drag before the relationship is created.",
    notes:
      "The one interactive stage (#689). It reads the draft stages 1–2 wrote and the template through `readLibraryTemplate()`, and renders the working list: the draft's own when stage 3 has saved, the template's on a first visit (`lib/flow/aspects.ts::workingAspects` — absent means \"untouched\", an emptied array means \"the person emptied it\"). `components/assessment-flow/aspect-list.tsx` is the flow's only client component: a row opens in place, saves itself with `POST /assessment/new/aspects` (JSON, one small request per committed gesture) and collapses on success; the order is a pointer drag on the handle (pointer events, not HTML5 dnd, so a finger works) with Arrow Up/Down on the same handle as the keyboard path. Both write the list into the same draft cookie, which is what makes the order and the words survive a reload. The create stays behind this stage's own control and posts to `POST /assessment/new`, which now takes who, mode, setting and the list from the draft; the copy keeps the template's ids and order (`aspectEditsFor`) because `db:verify` V4 compares a relationship's copy with the version it is bound to. Adding and removing an Aspect is deliberately not on this screen — it would need that V4 rule to tell an edit from drift, and it is filed as its own decision.",
  },
  {
    kind: "route",
    surface: "/templates/relationship/[slug]/create/commit",
    status: "db",
    templates: ["alignsynch"],
    capability:
      'Stage 4 of the create flow (Account): "Create your account" in the stage column with "Sign in" one in-place toggle away — the app\'s own two auth views, no second form — the six facts stages 1–3 decided read back beside it, and the one control that writes the relationship as a draft.',
    notes:
      "The account, and the draft (#825, superseding the gate #690 put behind this screen; the default and the toggle are #829). The column is `components/assessment-flow/account-panel.tsx`, which owns which of the two app-owned auth views is showing: it opens on **Create your account**, because a first-time creator is the person this stage is for, and both directions of the toggle swap **in place** — `RegisterView` and `LoginView` each take an `onSwitch…` callback in place of their cross-link when they are mounted here, so no navigation leaves the stage column, the review beside it or the draft cookie. Absent those callbacks both views keep their page behaviour and `/login` and `/register` stay byte-identical (`pnpm parity`), which is what lets the flow reuse the one implementation of each instead of growing a second sign-up form with a password field in it. Stage 1’s first and last names arrive as the register form’s prefill, so the same person is not asked for their own name twice. `next` and `destination` are this same address, which is what makes the round trip work — the draft is a `sameSite: \"lax\"` cookie, so a Google round trip, a password sign-in or a sign-up returns to this stage with the answers intact; the copy says the answers are saved on this device and names the missing-draft case only when it is true (decision, 2026-11-12). The form posts `templateRecordId` **and `draft=1`** to `POST /assessment/new`, which reads who, mode, setting and the Aspect list from the same draft cookie the three earlier stages wrote and writes the relationship with `status = 'draft'`, `published_at` NULL — plus the session and invitation row stage 5 needs — and sends **nothing**. Re-entered with `?instance=<id>` (stage 5's `Back`), the advance is a link instead of a form, so one template cannot be written twice. The six facts are the template (with its own Aspect count), both seats, the title, the Mode and the Setting, drawn by `components/assessment-flow/relationship-review.tsx`.",
  },
  {
    kind: "route",
    surface: "/templates/relationship/[slug]/create/invite",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "Stage 5 of the create flow (Invite): the payment walk as a soft prompt, the address the invitation goes to, and the two acts — send it, or keep the draft.",
    notes:
      "The decision the flow exists to reach (#825). `Send and Continue` posts to `POST /assessment/instances/[id]/send`, which calls `sendDraftInvitation()`: the token is reissued first (`resendInvite` owns one-token-per-instance and the cooldown), then the status flips `draft → published` through `canTransition()` with `published_at` stamped, and the email goes out after that commit — the order is what stops a published relationship with a token nobody sent. `Continue as Draft` is a plain link to `/dashboard`, where the draft is listed; it sends nothing and charges nothing. The walk (#771: plan, account, method, confirmation, done) is `components/assessment-flow/invite-walk.tsx`, one client component so the server column stays server-rendered; choosing a plan writes nothing, the method step defers the capture to publish, and the stage's foot no longer depends on which panel is open — the send is the stage's act, not the walk's. The relationship is read through `readFlowScreen()` with this browser's `flow_party_*` cookie and then the signed-in account, so a crafted id, somebody else's relationship and a dead one all land back on Details.",
  },
  {
    kind: "route",
    surface: "/templates/relationship/new",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "Write a template: a title and one to eight Aspects, each a question with a Left Value and a Right Value, saved as a published record with no parties.",
    notes:
      '`fixture` and not `db` on purpose: the page renders page copy and resolves the session, and the one thing that reaches Postgres is the endpoint it posts to — `app/(mainlayout)/templates/relationship/save/route.ts` (moved one segment deeper when `/templates/relationship` became the library page, because Next refuses a page and a route handler in one segment), which writes the record and item rows through `lib/flow/templates.ts`. The save writes `record.author_user_id` from the session, so a template written here appears under "Mine" on `/templates/relationship`; a save from a request with no session would write NULL and read as a built-in, which cannot happen because the route gates on `currentUser()`. Since #255 this is the app\'s only writer of a template; the four seeded ones come from `data/assessments.ts` and carry no author.',
  },
  {
    kind: "route",
    surface: "/battle",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "A head-to-head quiz battle: choose a mode, join a lobby, play the same question set live and land on a results screen.",
  },
  {
    kind: "route",
    surface: "/categories",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Every quiz category as a tile generated from its slug, with a how-it-works block and a closing CTA.",
  },
  {
    kind: "route",
    surface: "/categories/[slug]",
    status: "fixture",
    templates: ["quizhub"],
    capability: "One category's quizzes, under the tile generated for that category.",
  },
  {
    kind: "route",
    surface: "/chat",
    status: "fixture",
    templates: [],
    capability:
      "A message thread: conversation list, composer, per-message rendering and a conversation search, over the committed chat fixture.",
    notes:
      "A messaging mock that neither product story includes yet — quiz play and assessment are the two stories this tree tells — so it is catalogued here for a future template to claim rather than deleted or implemented.",
  },
  {
    kind: "route",
    surface: "/create/editor",
    status: "mock",
    templates: ["quizhub"],
    capability:
      "Hand-write a quiz in an editor: questions, answer options, media slots and a live draft pane.",
    notes: "The editor state is literals inside components/create — nothing is saved anywhere.",
  },
  {
    kind: "route",
    surface: "/create/generator",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Generate a quiz from a topic, a difficulty and a count, previewing the draft the generator would emit.",
  },
  {
    kind: "route",
    surface: "/creator-tips",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Editorial tips for quiz creators, browsable by category with featured and latest grids.",
  },
  {
    kind: "route",
    surface: "/creator-tips/[slug]",
    status: "fixture",
    templates: ["quizhub"],
    capability: "One creator-tip article, with its related tips.",
  },
  {
    kind: "route",
    surface: "/daily-challenge",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "One quiz a day: today's quiz, your challenge stats, a daily leaderboard, badge progress and your history.",
  },
  {
    kind: "route",
    surface: "/dashboard",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The signed-in console's Overview: four counts of the viewer's own relationships — awaiting the other party, needing the viewer's answers, complete and unread — plus the templates available, each figure linking to the list it counts.",
    notes:
      "Every figure is arithmetic over `listMyInstances(user.userId)` plus the length of the published-template read, and each card links to `/assessment/instances?filter=<id>` (or `/assessment` for the templates) where the same predicate filters the same array (`lib/flow/overview.ts`), so a count cannot disagree with its list. No percentage, no total, and no authored metric: the numbers `data/pages/dashboard.ts` rejected for `/dashboard/user` (#164) have no equivalent here and were not re-created. The blind rule holds by construction — the three relationship counts are the three `MyInstanceState` values, derived from the viewer's own answered count and their own `unlock_seen_at`.",
  },
  {
    kind: "route",
    surface: "/dashboard/relationships",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The relationships this member started: a table of their own initiator rows with the stored status on each, and the create band that copies one of their templates into a new relationship's own record.",
    notes:
      "Reads `relationship.initiator_user_id = $1` and nothing else, so the list cannot show a counterparty's row. The status column is the stored `relationship.status` (0029/0030) — never derived from the parties — because phase 3's expiry sweep needs one column to move. Create is the only write on the page; Aspects belong to the detail screen.",
  },
  {
    kind: "route",
    surface: "/dashboard/relationships/[id]",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "One relationship the member initiated: its status, its Aspects editor while `draft`/`pending`, save-as-pending, publish through a trial or a checkout, and the one-click re-publish that replaces an expired invite link.",
    notes:
      'Reuses `components/admin/template-editor.tsx` in its `band="private"` shape for Aspects (`template-ancestor:` on the header), so there is one editor and not two. Every write is a server action over `act()`; the ownership refusal (`not-yours`) is decided in the action, not by hiding the form — the counterparty reaching this URL gets the same refusal a crafted POST gets.',
  },
  {
    kind: "route",
    surface: "/dashboard/help",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The onboarding sequence (the same six moves `/how-it-works` draws, from `components/onboarding`) and the tour's replay control: one button that clears the seen mark and returns to the console, where the tour opens on arrival.",
    notes:
      "Reuses `data/pages/how-it-works.ts` and `data/pages/tour.ts` rather than authoring a third copy of either — the page's job is the route, not the words. `/how-it-works` still answers for a bookmarked link; the rail points here since #542 phase 1. The only write is `POST /api/tour { seen: false }` through `lib/tour/mark.ts`, and a refusal shows the fixture's failure sentence instead of navigating.",
  },
  {
    kind: "route",
    surface: "/dashboard/support",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "Support inside the shell: the knowledge-base list (`components/support/knowledge-base.tsx`, the same component `/help` renders, with its links rewritten to this route's article path), one article at `/dashboard/support/articles/[slug]`, and a contact form whose submit stores a `contact_message` row before mailing.",
    notes:
      "The form is a server action, not the public `POST /api/contact` — that route answers a 303 to `/help`, which would throw a signed-in reader out of the workspace. It hands the same fields to `lib/contact/submit.ts`, so the ordering (spam, validation, throttle, store, mail) is one implementation. The confirmation is derived: the action returns the inserted id and the page re-reads that row by id *and* by the session's address (`readOwnContactMessage`).",
  },
  {
    kind: "route",
    surface: "/dashboard/support/articles/[slug]",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "One knowledge-base article, drawn by the same `components/support/article-detail.tsx` the public page uses, with `backHref` and `articleHrefBase` pointed at the dashboard so the breadcrumbs and related entries stay in the shell.",
    notes:
      "A slug that is not a published `kb` article is a 404 before the component mounts, exactly as the public route decides it. The component takes both paths as props because it renders in two trees: a marketing `href` spelled inside it would be a dashboard departure E39 refuses.",
  },
  {
    kind: "route",
    surface: "/dashboard/templates",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "One destination with two tabs (#620): Relationship Templates is the product shelf a member can start a relationship from, each card carrying the price of the relationship and the two owner-named actions (View Details, Create Relationship); My Templates is what they own or adopted, plus the blank and clone bands that create a new one.",
    notes:
      "The tab is the URL: `?tab=mine` is the second tab and the bare path is the catalogue, so both are linkable and a `curl` can ask for either (`lib/member/shelf.ts::templatesTabOf`, which lands an unknown value on the catalogue). Two reads, neither keyed on the request — `listLibraryTemplates(userId)` for the catalogue (the platform's templates plus this account's) and `listMemberLibrary(userId)` for the second tab — with `requireRole` resolving the id from the session. `Create Relationship` opens `/templates/relationship/<id>/create`, the shipped create step; nobody here says \"start an instance\", because a relationship is what a person starts. `/dashboard/library` was the third door and is now a 308 to `?tab=mine`.",
  },
  {
    kind: "route",
    surface: "/dashboard/templates/[id]",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "One private template's editor: the catalogue editor's questions and Aspects shape, writing `owner_user_id` = the actor and `visibility` = `private`, with no publish or unpublish control.",
    notes:
      '`band="private"` on the reused `components/admin/template-editor.tsx`; `onPublish`/`onUnpublish` are simply not passed, which is why the member cannot reach the catalogue writer through this screen. The ownership check is in the server action (`not-yours`), so the editor\'s props are a convenience and not the gate.',
  },
  {
    kind: "route",
    surface: "/dashboard/user",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The signed-in person's account home: their saved profile, wallet, recent activity and their quizzes, read from Postgres.",
  },
  {
    kind: "route",
    surface: "/demo",
    status: "mock",
    templates: ["alignsynch"],
    capability:
      "The demo PIN gate: one four-digit field and a submit. A correct PIN sets a signed, httpOnly unlock cookie and redirects to `/login`, where the three role buttons appear.",
    notes:
      "Exists only under DEMO_AUTH=1, and refused when VERCEL_ENV=production unless DEMO_ALLOW_PRODUCTION=1 is also set; outside demo mode the route answers the same 404 a URL that never existed does. `mock` rather than `db` since #218: the gate reads no Postgres — it compares the PIN and signs a cookie, and the credential read moved to the role action behind `/login`.",
  },
  {
    kind: "route",
    surface: "/demo/admin",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The admin-only check the demo's role buttons prove: it prints the session and the role it read from Postgres, and a member account asking for it gets a 404 rather than a 403. Reachable by URL — the demo's Admin button lands on `/admin/instances` instead, and this page's own button opens it.",
    notes:
      "The first caller of requireAdmin(); a demo-only surface, so it answers 404 outside demo mode like every other /demo route. A proof, not a destination: nothing in the flow links here.",
  },
  {
    kind: "route",
    surface: "/explore",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Explore quizzes through one shelf per catalogue slot, with filters, featured cards and a category strip.",
  },
  {
    kind: "route",
    surface: "/explore/featured",
    status: "fixture",
    templates: ["quizhub"],
    capability: "The featured tabs: one six-card shelf block per featured slot.",
  },
  {
    kind: "route",
    surface: "/help",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The public help centre: the help categories, the FAQ and the knowledge base in the marketing chrome, and — under the answers — the one public contact form: a name, a reply address, a message and one submit, posted as plain HTML to `/api/contact` with no captcha and no third-party widget. The band that says where a person is is the second column of that row, beside the form.",
    notes:
      "The public half of the Help/Support split (owner's review). A variation of the old `/support` hub with its Contact tab removed rather than left empty: the answers are public, and the band beside the contact form says where a person is — it was a strip at the foot of the page until the owner reported the form and its alternative never sitting at one eye line. It renders the same panels the account page links back to (`components/support/**`), so the two surfaces cannot tell a reader different things about one product. **Two columns that stay two columns:** the category filter and the answer panel are a `200px + 1fr` grid (a span wider than the track count was what pushed the answers into a second row), the filter is sticky rail on `md`+ and one scrolling chip row below it, and the form row is the same grammar with the person band as its aside. **The category rail's selected row is the tree's tinted-panel treatment (#539 item 3):** `bg-action/10` with an inset `ring-action/20` and `text-action` — the soft ground QuizHub's own active rows use — instead of the solid `bg-action` fill the row drew before, and its labels wrap inside the rail (`whitespace-normal`, `min-w-0`) rather than painting past it at 768 (#539 item 9). Both are the same control, so the registry lists them here rather than as a second surface.",
  },
  {
    kind: "route",
    surface: "/how-it-works",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "The console's onboarding page: the six moves of one relationship in order — pick a type and a template, invite the Member, both answer blind, both accept, read the report and its Steps, start the next session — with what the member does beside what the product does, and the honest limits of this build.",
    notes:
      "The rail's How it works row used to leave the console for `/#questions` on the public front page; this route is its real destination (owner's review of the console). A variation of the alignment front page's `#questions` composition, not a new pattern — the heading/body band, numbered, with the member's half against the product's half (`components/onboarding/how-it-works.tsx`, ancestor in its `template-ancestor:` header). It resolves the session first and answers a signed-out request with `redirect(/login?next=/how-it-works)`, and it refuses to render on a build that ships the quiz product instead (`quizProductShipped()`, the same flag resolver the quiz routes read) — the copy is the relationship product's, and #300 is the record of what happens when one product's words are served under the other's name. `fixture` and not `db`: it reads page copy and a session, and no row.",
  },
  {
    kind: "route",
    surface: "/invite/[token]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "What an invitation says, and the button that claims it — a single-use token spent by a POST once the invited party accepts.",
  },
  {
    kind: "route",
    surface: "/leaderboard",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The player leaderboard: podium, summary stats and a filterable ranked table. Not freely available: `community.leaderboard` ships it off for every visitor, and only an admin session reaches it — through the flag's `adminBypass` (#184) — while its rows are still the `data/players.ts` mock.",
    notes:
      "The Postgres reach listed here is the flag's role gate (`lib/auth/require-role.ts` reading `user_profile.role`), not the boards: the rows the page renders are still `data/players.ts`, and the read happens before them.",
  },
  {
    kind: "route",
    surface: "/forgot-password",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "Ask for a password reset link. Always answers the same sentence for a known and an unknown address; rate-limited per address and per requester; shows the link instead of claiming a send when the deployment has no RESEND_* configured.",
    notes:
      "The one surface that writes `public.password_reset` and, through the auth server's own /reset-password, the `credential` row a Google-only account has never had. Its message is the fourth sender in `lib/flow/email.ts` (#password-reset).",
  },
  {
    kind: "route",
    surface: "/login",
    status: "live",
    templates: ["quizhub", "alignsynch"],
    capability:
      "Sign in with a real Neon Managed Auth session, with pending, invalid-credentials, Google-only and network states.",
  },
  {
    kind: "route",
    surface: "/my-quizzes",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Your own quizzes — drafts, published and their analytics — as a grid of quiz cards.",
  },
  {
    kind: "route",
    surface: "/my-quizzes/[id]",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "One of your quizzes in detail: its questions, results, analytics and reward window.",
  },
  {
    kind: "route",
    surface: "/my-quizzes/[id]/statistics",
    status: "mock",
    templates: ["quizhub"],
    capability:
      "Per-quiz statistics: completion, question-level correct rates, time spent and a leaderboard of players.",
    notes:
      "The numbers are literals inside components/my-quizzes/quiz-statistics.tsx, headed 'Mock data for the quiz' — no fixture backs them, and this entry records the mock rather than fixing it.",
  },
  {
    kind: "route",
    surface: "/news",
    status: "fixture",
    templates: ["quizhub"],
    capability: "Product news and updates, featured first, as article records.",
  },
  {
    kind: "route",
    surface: "/news/[slug]",
    status: "fixture",
    templates: ["quizhub"],
    capability: "One news article with share, its comment thread, the author and related articles.",
  },
  {
    kind: "route",
    surface: "/pricing",
    status: "live",
    templates: ["quizhub"],
    capability:
      "Plan comparison read from billing_plan with a checkout per sellable tier, the viewer's own plan marked, an FAQ and a closing CTA.",
  },
  {
    kind: "route",
    surface: "/privacy",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The draft privacy policy: what the build actually collects, why, where it lives and what the reader can ask for, behind a draft notice that cannot be dismissed.",
  },
  {
    kind: "route",
    surface: "/profile/[username]",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "A public profile read from Postgres: header, stats, achievements, followers, quiz history and created quizzes.",
  },
  {
    kind: "route",
    surface: "/quiz-discussions",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Every discussion thread across quizzes, with each quiz's comment count and result beside it.",
  },
  {
    kind: "route",
    surface: "/quiz/[id]",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "One quiz's overview: header, details, question preview, reviews and the play entry point.",
  },
  {
    kind: "route",
    surface: "/quiz/[id]/discussion",
    status: "fixture",
    templates: ["quizhub"],
    capability: "The comment thread under one quiz.",
  },
  {
    kind: "route",
    surface: "/quiz/[id]/play",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Play one quiz question by question, with a timer, the results screen and a review modal.",
  },
  {
    kind: "route",
    surface: "/register",
    status: "live",
    templates: ["quizhub", "alignsynch"],
    capability:
      "Create a real Neon Managed Auth account: personal details, then email, password and the terms agreement.",
  },
  {
    kind: "route",
    surface: "/reset/[token]",
    status: "db",
    templates: ["quizhub", "alignsynch"],
    capability:
      "Spend a reset link: a single-use, hour-long token in the path, refused with its own sentence when it is expired, already used or not one this app issued. Setting the password revokes every session.",
    notes:
      "`Referrer-Policy: no-referrer` and `Cache-Control: no-store` come from `next.config.mjs` for `/reset/:path*`, and the page repeats the referrer rule as a meta tag. The token is stored only as a SHA-256 hash.",
  },
  {
    kind: "route",
    surface: "/reset/complete",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The success screen after a reset, at a token-free address: the password is set and every other device was signed out.",
    notes:
      "Separate route on purpose — a spent token should leave the address bar and the history. Static, with no session and no database read.",
  },
  {
    kind: "route",
    surface: "/search",
    status: "fixture",
    templates: ["quizhub"],
    capability: "Search the built index over quizzes and categories, rendering hits as quiz cards.",
  },
  {
    kind: "route",
    surface: "/settings",
    status: "live",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The parts of your account you can change — display name, handle, bio and the country pair — saved through the guarded POST /api/profile.",
  },
  {
    kind: "route",
    surface: "/support",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "Account support inside the app: what to include in a message and what actually happens to it (stored in Postgres first, mailed second, read by a person), the links to the help centre and account settings, and a pointer to the one contact form rather than a second copy of it.",
    notes:
      "The in-app half of the Help/Support split (owner's review). It draws no form: `ContactPointer` renders the fixture's sentence and a link to the form on `/help`, so exactly one contact form exists in the tree and it is the public one. The route resolves the session first: a member gets this page and a visitor with none is redirected to `/help` — not to `/login` and not to a 404 — because the same URL has two correct answers. The `lib/db` reach above is the admin-allowlist grant's (`lib/auth/session.ts` → `admin-allowlist.ts`), which returns before any query when `ADMIN_EMAILS` is unset: this page renders no row.",
  },
  {
    kind: "route",
    surface: "/support/articles/[slug]",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "One help article from the knowledge base, with related articles and a 'was this helpful?' prompt.",
  },
  {
    kind: "route",
    surface: "/relationship-types",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The public Relationship Templates catalogue: what a template is, what buying one gets you (both sides answering blind, the Gap by Aspect, the session agenda), and every purchasable Relationship Type grouped by realm with its two roles, its Aspect count, its price and — where a demo sheet exists — a worked example. Both card actions are public: `/register`, and `/relationship-types/<type>/demo`. No session, no clock and no database, so the page prerenders.",
    notes:
      "The destination the header's `Templates` row names and the front page band's one call to action; before this page the row was `/#templates`, an anchor into the front page. The catalogue is derived (`lib/template-catalogue.ts` over `data/relationship-types.ts`), so the count sentence above the shelf and the cards under it cannot disagree, and a type the shop will not sell throws instead of rendering a card nobody can buy. The front page shows six of these cards, curated in `data/template-shelf.ts`, with no per-card actions — one CTA there, the full shelf here.",
  },
  {
    kind: "route",
    surface: "/relationship-types/[slug]",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "One Relationship Template, in full: who it is for and who it is not for, every Aspect it asks — the question and its two named ends — the price, one action to start it, and a worked example where the fixture holds one. No session, no clock and no database.",
    notes:
      "The public way into a template, and the gap it closes is that there was none: the directory listed 27 templates carrying 144 Aspects between them, and a stranger's only doors were `/register` and a worked example on 2 of the 27. The page is `lib/template-detail.ts` over `data/relationship-types.ts` — the same record the catalogue card is projected from, so the questions printed here are the ones the product will ask rather than a second copy that can drift. `generateStaticParams()` emits one prerendered page per purchasable type and `notFound()` answers any other slug.",
  },
  {
    kind: "route",
    surface: "/relationship-types/[slug]/demo",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The worked example: one Relationship Type's finished report, answered by You and Them and labelled Example, rendered through the live report projection and component — the value shown before anyone pays, and launch criterion 5's one readable proof. No session, no clock and no database.",
    notes:
      "Lands here as `docs/V1-RETIREMENT.md`'s `release` demo row: it was `/v1/templates/[type]/demo`, the last customer route under `/v1`, and it moved out when that namespace was retired (#478) — first to `/assessment/demo/[type]`, then, once #794 retired the `assessment` noun from every surface that is not a record, to one segment below the type's own page. It is in `(marketing)` because a stranger reads it before an account exists, so it wears the public header and footer and renders the app shell nowhere. The projection and renderer are `lib/assessment-report.ts` + `components/assessment/assessment-report.tsx` — the v1 report component was deleted with the move, so the app has one report renderer, not two, which is also why this is a page and not a band on the type page: a band could only be a truncated second presentation of the same report. The example is built from the type's own Aspects and authored demo sheet, never from a stored template record (the staff-manager record predates the taxonomy and carries Aspects its sheet never answered).",
  },
  {
    kind: "route",
    surface: "/terms",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The draft terms of service: the rules for using the product, its liability and dispute clauses, and a draft notice that cannot be dismissed.",
  },
  {
    kind: "route",
    surface: "/tournaments",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Quiz tournaments: the featured championship, the full list, categories, how it works and a CTA.",
  },
  {
    kind: "route",
    surface: "/tournaments/[id]",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "One tournament: overview, key dates, stats, categories, rules, prizes and its leaderboard.",
  },
  {
    kind: "route",
    surface: "/welcome",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "The public AlignSynch landing page in its own chrome: what a Gap is, how it works, four opinions and two modes.",
  },
  {
    kind: "domain",
    surface: "components",
    status: "mock",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The files at the root of components/: the next-themes provider the root layout wraps the document in.",
  },
  {
    kind: "domain",
    surface: "components/affiliate",
    status: "fixture",
    templates: ["quizhub"],
    capability: "The nine affiliate-programme sections the /affiliate route composes.",
  },
  {
    kind: "domain",
    surface: "components/assessment",
    status: "mock",
    templates: ["alignsynch"],
    capability:
      "The assessment report: each Aspect's two Opinions, the Values behind them and the Gap between the parties.",
    notes:
      "Reads nothing itself — the instance arrives as props from the route that read Postgres, which is why the surface is `mock` and the route above it is `db`. Since #204 it also draws the one failure state the route can describe: `assessment-unreadable.tsx` prints the database layer's own sentence when the read did not answer, instead of Next's 500 and a digest.",
  },
  {
    kind: "domain",
    surface: "components/assessment-flow",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The two-party flow: the published template list, the invite view, the blind answer form and the instance screen both parties share. It also owns the raised-surface container every dashboard page renders inside — `stage-column.tsx` (`StageColumn`), 1126px up to one left edge at 274 and no `mx-auto` — which is the shape #717 gave the eighteen admin pages and #858 gave the member console.",
    notes:
      "Reads and writes Postgres through lib/flow/store.ts, so it is not a prop-only domain like components/assessment beside it. `StageColumn` is the one container: a page that centres itself, or spells a second `max-w`, is the regression `data/surface-columns.ts` and `scripts/column-refs.ts` measure in the gate (a `wide`/`bleed` page is a registered exception with a reason and, for `bleed`, a way back). The stage dialog in `stage-shell.tsx` is the one documented centred box — a sheet, not a page column.",
  },
  {
    kind: "domain",
    surface: "components/auth",
    status: "live",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The sign-in and sign-up forms, including pending, invalid-credentials and network states, plus the two demo surfaces `/login` draws only in demo mode: the anchor to the PIN gate and, under a valid unlock cookie, the three role buttons.",
    notes:
      "The demo surfaces are decided on the server (`lib/auth/demo-surface.ts`) and render nothing outside demo mode; the PIN gate itself is `/demo` (`components/auth/demo-gate.tsx`), not this route.",
  },
  {
    kind: "domain",
    surface: "components/battle",
    status: "fixture",
    templates: ["quizhub"],
    capability: "The battle screens: mode selection, the lobby, the live round and its results.",
  },
  {
    kind: "domain",
    surface: "components/categories",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The category grid, the tile generated from a slug, the category detail page and the how-it-works block.",
  },
  {
    kind: "domain",
    surface: "components/console",
    status: "mock",
    templates: ["alignsynch"],
    capability:
      "The console's generic shapes: a stat-card grid of linked figures with the Overview built from it (a header naming the viewer, four counts and the honest empty state for an account with no relationships), and the response-analytics surface — a population's numbers as stat cards, one distribution per measure and a comparison axis, taking the aggregate as a prop so the measure is a plugin rather than a component.",
    notes:
      "Reads nothing itself: counts and aggregates arrive as props from the route that read Postgres, which is why the domain is `mock` and the `/dashboard` and `/admin/gaps` routes above it are `db` (the same split `components/assessment` records). `stat-card-grid.tsx` is the extracted shape of `components/dashboard/dashboard-overview.tsx` with its metrics removed — `value` is a `number` the caller computed — so the next expression can pass its own rows through the grid without inheriting a wallet balance. Its two callers are `/dashboard` (the viewer's own counts, `lib/flow/overview.ts`) and `/admin/gaps` with AlignSynch's measure (`gapOf` over the eight kinds, `lib/admin/gap-aggregates.ts`); the quiz expression of the analytics surface is the per-question correct rate `components/my-quizzes/quiz-statistics.tsx` mocks. `data/pages/overview.ts` holds every word (E23 budget 0).",
  },
  {
    kind: "domain",
    surface: "components/relationship",
    status: "mock",
    templates: ["alignsynch"],
    capability:
      "The relationship edit surface (#623): one panel that edits every field a created relationship carries — title, summary, Aspects, the template-version pin, the counterparty's name and address, the invitation window — with the cost of the change priced from rows and printed before the save.",
    notes:
      'Reads nothing itself: `readRelationshipEditState()` runs on the route (the panel is a client component and may not reach `lib/db/client`, E34), so the domain is `mock` while both mounts, `/dashboard/relationships/[id]` and `/admin/instances/[id]`, are `db`. One panel, two mounts, one action: staff pass `audience: "staff"` rather than a second screen or a second name. The authority is the ownership/rung check inside `lib/member/relationship-edit.ts`, never a prop. `data/pages/dashboard-relationship-detail.ts` and `data/pages/admin-relationship.ts` each hold the words under one `edit` section (E23 budget 0 on both routes).',
  },
  {
    kind: "domain",
    surface: "components/chat",
    status: "fixture",
    templates: [],
    capability:
      "The chat surfaces: conversation list, thread, composer, message bubble, search and a small dropdown.",
    notes:
      "No template claims messaging yet — the same scope decision as /chat, recorded here so the domain is not orphaned in the catalogue.",
  },
  {
    kind: "domain",
    surface: "components/contact",
    status: "mock",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The public contact surface: the three-field form, its hidden honeypot and render instant, the plain HTML POST to `/api/contact`, and the outcome band the query selects.",
    notes:
      "Reads no data module: every word arrives as a `PageCopy` prop from `data/pages/help` (the `/help` route above claims it), and the write is the route handler's. `mock` for the same reason `components/legal` is: the closure reaches page copy and prop types, never a record fixture and never `lib/db/`.",
  },
  {
    kind: "domain",
    surface: "components/content",
    status: "mock",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The block renderer every article record is drawn through: paragraphs, headings, lists, images and quotes.",
    notes: "Holds no words of its own — the blocks arrive from `content/blocks.ts` through props.",
  },
  {
    kind: "domain",
    surface: "components/create",
    status: "fixture",
    templates: ["quizhub"],
    capability: "The quiz editor, the generator form and the draft shape they share.",
  },
  {
    kind: "domain",
    surface: "components/creator-tips",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The creator-tips index and detail: hero, category strip, featured tips, tip cards, related tips and the CTA.",
  },
  {
    kind: "domain",
    surface: "components/daily-challenge",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The daily challenge: header, today's quiz, your stats, the daily leaderboard, rewards, history and the completed state.",
  },
  {
    kind: "domain",
    surface: "components/dashboard",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The prototype dashboard shell: overview, affiliate and wallet panes, an earnings chart, my-quizzes and settings panes.",
    notes:
      "No route renders this domain any more — /dashboard/user is the account home since #164, and only dashboard-page.tsx imports the panes. A candidate to delete or to relayout, not a surface to pick yet.",
  },
  {
    kind: "domain",
    surface: "components/explore",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The explore page and its featured twin: header, filters, quiz lists, the category strip and shelf blocks.",
  },
  {
    kind: "domain",
    surface: "components/header",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The chat drawer, the notification drawer and the notification icon the shell header used to mount.",
    notes:
      "No route imports this domain: the shell header is components/layout/header.tsx. Catalogued rather than deleted because the drawers read the notification and chat fixtures.",
  },
  {
    kind: "domain",
    surface: "components/home",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "Both front pages: the QuizHub shelves (hero, category slider, latest, featured, top players, winners, testimonials) and the AlignSynch practice page — a two-column hero over the worked-example card, then the cycle, the mechanism, the capped template shelf with its one View-all, the scope ledger and the seats.",
  },
  {
    kind: "domain",
    surface: "components/identity",
    status: "live",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The account surfaces: the signed-in home, the member profile, the settings form that POSTs /api/profile, sign-out and the demo-account notice.",
  },
  {
    kind: "domain",
    surface: "components/legal",
    /**
     * `mock` is the generator's own vocabulary for "renders props, reaches no data module", and
     * that is literally this domain: `legal-page.tsx` takes one `PageCopy` prop and imports only
     * the `PageCopy` type and the fixture readers. The words are `data/pages/legal` — a committed
     * fixture — but the *page* imports it and passes it down, so the domain's own closure reaches
     * nothing under `data/`, which is what the rule measures. Calling it `fixture` here would be
     * the prose the gate refuses.
     */
    status: "mock",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The one view `/terms` and `/privacy` render: the draft banner first, then the section stack, with the fixture's paragraphs and `- ` lists as its only markup vocabulary.",
    notes:
      "The copy arrives as a prop from `data/pages/legal` (the two route entries claim it), so this domain reads no data module of its own.",
  },
  {
    kind: "domain",
    surface: "components/layout",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The shell: header, the sticky sidebar, the layout that composes them, and the footer.",
  },
  {
    kind: "domain",
    surface: "components/leaderboard",
    status: "fixture",
    templates: ["quizhub"],
    capability: "The leaderboard screens: podium, summary stats, filters and the ranked table.",
  },
  {
    kind: "domain",
    surface: "components/marketing",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "The public pages' own chrome: the marketing header (the brand mark, the shell's public menu and a server-resolved account slot) and the landing page's bands. The footer is the shell's (`components/layout/footer.tsx`), mounted by the group's layout; there is no sidebar.",
  },
  {
    kind: "domain",
    surface: "components/media",
    status: "mock",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The one media resolver: a file, a remote URL or a generated default drawn from a seed, in that order, with a fallback on error and no image file behind the last tier.",
  },
  {
    kind: "domain",
    surface: "components/my-quizzes",
    status: "fixture",
    templates: ["quizhub"],
    capability: "Your quizzes, one quiz in detail, and the per-quiz statistics screen.",
  },
  {
    kind: "domain",
    surface: "components/onboarding",
    status: "mock",
    templates: ["alignsynch"],
    capability:
      "The console's onboarding page: the ordered moves of one relationship, each with what the member does beside what the product does, and the honest limits of this build.",
    notes:
      "One file (`how-it-works.tsx`), and it is a variation rather than a new pattern: the ancestor is the alignment front page's `#questions` band (`components/home/alignment-home.tsx`), stated in its `template-ancestor:` header. The variation is the sequence — numbered bands instead of a two-up explainer, in the app shell instead of the marketing page. `mock` on the domain and `fixture` on its route for the reason `components/console` is: it renders no data of its own, it takes the route's parsed `PageCopy` as a prop, and the fixture is reached by the page module, not by this domain.",
  },
  {
    kind: "domain",
    surface: "components/news",
    status: "fixture",
    templates: ["quizhub"],
    capability: "The news index and the article page.",
  },
  {
    kind: "domain",
    surface: "components/not-found",
    status: "mock",
    templates: ["quizhub", "alignsynch"],
    capability: "The 404 body: floating glyph decoration and a go-back button.",
  },
  {
    kind: "domain",
    surface: "components/pricing",
    status: "live",
    templates: ["quizhub"],
    capability:
      "The plan cards — prices and sellability from billing_plan, a checkout button per sellable tier — the FAQ and the closing CTA.",
  },
  {
    kind: "domain",
    surface: "components/profile",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The public profile in ten parts: cover, header, stats, achievements, activity, followers, following, quiz history, created quizzes and a message modal.",
  },
  {
    kind: "domain",
    surface: "components/quiz",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The quiz surfaces: header, details, question, timer, results, the play screen, comments, discussion and the review modal.",
  },
  {
    kind: "domain",
    surface: "components/search",
    status: "mock",
    templates: ["quizhub"],
    capability: "The search result list, rendering indexed hits as quiz cards.",
    notes: "Renders the rows the route hands it; the index itself is data/searchdata.ts.",
  },
  {
    kind: "domain",
    surface: "components/settings",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "Ten account panes: account, appearance, connected accounts, notifications, privacy, profile, quiz preferences, security, subscription and the missing-icon set.",
    notes:
      "No route renders this domain — /settings is components/identity/settings-view since #164. The panes are the prototype's, and they are catalogued so a template can pick one rather than rediscover it.",
  },
  {
    kind: "domain",
    surface: "components/shell",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The shell's own panels: the declared-not-wired surface a pending route renders — its label, the reason it is not live and the capability it needs, read from the surface registry rather than typed into the page.",
    notes:
      '`pending-surface.tsx` varies `components/ui/alert.tsx` — the alert\'s frame with `role="status"` instead of `role="alert"`, because a pending surface is a state a reader is told about, not a failure they must act on. It renders `data/surface-registry.ts` and nothing else: the labels, reasons and `needs` lines are that fixture\'s (issue #409), so the panel and the nav\'s greyed row cannot disagree about what a surface is. Server component, no client state.',
  },
  {
    kind: "domain",
    surface: "components/support",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The help panels shared by the two halves of the split — the two-tab help header, help categories, FAQ and knowledge base — plus the account page's contact form and its article reader.",
  },
  {
    kind: "domain",
    surface: "components/templates",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The public catalogue's two files: one template card (name, realm, the two roles, the Aspect count and the price, with the two actions optional) and the page that draws four bands over it — hero, what a template is, what buying one gets you, the catalogue grouped by realm, and the closing action.",
    notes:
      "Imported by `/` (the front page's capped shelf, six cards with no per-card actions and one View-all) and by `/templates` (every purchasable type, each card linked to `/register` and to its worked example where one exists). A variation of `components/explore/explore-quiz-list.tsx` for the page and `components/home/featured-quizzes.tsx` for the shelf, both stated in the files' own `template-ancestor:` headers. Holds no words: E23 attributes the domain to `data/pages/templates.ts` at budget 0, and the cards are records from `lib/template-catalogue.ts`.",
  },
  {
    kind: "domain",
    surface: "components/tour",
    status: "live",
    templates: ["alignsynch"],
    capability:
      "The first-run tour: up to six steps spotlighting real console elements, a callout naming what each one is for, and a polite live region that announces every step change to a screen reader.",
    notes:
      "One file (`first-run-tour.tsx`), and a variation rather than a new pattern: the ancestor is `components/ui/popover.tsx`'s callout, stated in its `template-ancestor:` header — a panel anchored to an element, drawn by driver.js rather than Radix because the tour owns when it opens and needs the overlay, the step engine and the reduced-motion switch; no trigger, no portal, no Radix primitive. `live` because the domain has a real write path: dismissing or completing the tour `POST`s the viewer's own `tour_seen_at` mark to `/api/tour` (`lib/tour/mark.ts`), which is what makes it first-run rather than a nag — the read is the `/dashboard` route's job (`lib/db/tour.ts`), so no client module value-imports `lib/db/**` and E34 stays clean. The words are `data/pages/tour.ts`, parsed by the page and passed down, so this domain's own import closure reaches no `data/` module; driver.js is a dynamic import inside the effect, so nothing touches `window` during the server render. The six anchors live on the console's own elements and the shell's Support row; a step whose anchor is absent from the page is skipped rather than pointed at nothing, which is what the quiz build sees (its menu has no Support-row anchor for the sixth step) and what a returning account sees (no empty-state card for three of them).",
  },
  {
    kind: "domain",
    surface: "components/tournaments",
    status: "fixture",
    templates: ["quizhub"],
    capability:
      "The tournament screens: featured, list, filters, categories, detail, overview, key dates, rules, prizes, leaderboard, discussion, CTA and the id helper they share.",
  },
  {
    kind: "domain",
    surface: "components/ui",
    status: "mock",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The shadcn primitives every screen composes, plus this repo's own chart, drawer, motion and circular-progress additions, and the OAuth provider mark (`provider-mark.tsx`, #777).",
    notes:
      "Renders only the props it is given; the tokens it paints with come from app/globals.css.",
  },
  {
    kind: "domain",
    surface: "components/v1",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "What is left of the /v1 prototype — the operator console's components and the shared primitives they paint with. No route in the app is a `/v1` one.",
    notes:
      "The prototype is retired (#478): `docs/V1-RETIREMENT.md` classified 118 `/v1` items, and this domain now holds nine files — the console's own components, all of them written below. The **nine admin components** — `admin-console-overview`, `admin-relationship-registry`, `admin-relationship-detail`, `admin-template-registry`, `admin-template-detail`, `admin-users-list`, `admin-limits`, `relationship-metadata`, `v1-ui` — are the operator console at `/admin/console`, behind `requireAdmin`, reading the in-browser store (`lib/v1/store.tsx`) seeded from `data/v1/fixtures.ts`; that is why they stay a fixture surface while the product's `/admin/instances` reads Postgres. `v1-ui.tsx` is the one shared atom set (`StageBadge`, `GapPill`, `StatTile`, `EmptyState`, `NotFoundState`, `SectionIntro`, the status tones) the console paints with, and `relationship-metadata.tsx` is the mode/setting editor the console's relationship detail draws. The two `release` rows this domain once kept are gone to their destinations: `steps-panel.tsx` became `components/assessment-flow/steps-panel.tsx`, drawn on the instance screen from the Steps acceptance already stores, and `template-demo.tsx` with `report-body.tsx` became the public worked example (`/relationship-types/[slug]/demo`) over the app's own `components/assessment/assessment-report.tsx` — so there is no second report renderer left anywhere. The `/v1` route group, its layout gate, `lib/v1/persona.ts` and the flag-count derivations went with them; `app/(prototype)` no longer exists. Everything else in the domain — the shell, the persona bar, the chat, the shop, the review checklist, the settings views, the answer sheet and the template authoring — was deleted by the cohort before this one.",
  },
]);
