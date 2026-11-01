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
      "The front page: QuizHub leads with category, latest and featured shelves, top players and live winners; AlignSynch leads with the two questions each party answers and the four assessment templates.",
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
    surface: "/admin/instances",
    status: "db",
    templates: ["alignsynch"],
    capability:
      'Every relationship in the database, for an operator: the template, both seats\' identity state, mode, Setting, the derived stage, when it was created and when anything last happened to it — filterable by stage, mode, Setting and "stalled".',
    notes:
      "Admin-only, and the first caller of `requireAdmin()` outside `/demo/admin`: a member gets the 404 a URL that never existed returns, a signed-out visitor is sent to `/login?next=` this path. The blind rule holds for an admin too — the read selects seats, mode, Setting and the stage, never an opinion, a score, a Gap or an answered count, so there is no column and no prop through which an answer could reach the page. Read-and-filter only: no delete, no force-complete. Every filter is client-side over the one read (`lib/db/admin-instances.ts`).",
  },
  {
    kind: "domain",
    surface: "components/admin",
    status: "mock",
    templates: ["alignsynch"],
    capability:
      "The operator's registry table: a stage tab row, mode and Setting selects and a stalled toggle over one filterable table of relationships.",
    notes:
      "`mock` in this file's vocabulary — it renders the props it is handed. The rows are read by the page (`lib/db/admin-instances.ts`) and passed down, because a client component must not reach `pg`; that boundary is why this domain imports no data module and why the route entry above is the one that claims `db`.",
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
      "Every instance the signed-in account is a party to, with both parties and where each one stands: yours to answer, awaiting the other party, or complete with the Gap open.",
    notes:
      "Filtered by party.user_id against the session — never a name, a query parameter or a role, so an admin sees their own list and no one else's. A row says only where the instance stands: the blind rule holds in the list too, and nothing here draws a score, a count or a Gap.",
  },
  {
    kind: "route",
    surface: "/assessment/instances/[instanceId]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The screen both parties share: answer blind while the other has not, then read the report and the Gap once both have answered.",
    notes:
      "The viewer is resolved from the party cookie in Postgres, never from the URL — a browser with no token for the instance gets a 404. While the invitation is unclaimed the link is drawn as selectable text with a copy control beside it, and a refused clipboard selects that text and says so (#257).",
  },
  {
    kind: "route",
    surface: "/assessment/templates",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "The template library: the platform's own templates plus the ones this account wrote, with a tab for each, a status filter, a title search, and open/duplicate/archive on every row.",
    notes:
      "`record.author_user_id` is the whole rule — `NULL` is a built-in, the author's id is a template a person wrote, and the read returns `author_user_id IS NULL OR author_user_id = $1`, so another account's template is never in the payload. A template written before `0011_console_columns.sql` has no author and therefore reads as built-in; the page says so in its own band rather than leaving it to be discovered. Archiving flips `record.status` to `archived` (author only): the catalogue stops listing it and `createInstanceFromTemplate` refuses it, while every instance already made from it keeps its own copy of the Aspects and still opens. Duplicating copies the record and its items into a new template authored by the caller, whatever state the source is in.",
  },
  {
    kind: "route",
    surface: "/assessment/templates/[templateId]",
    status: "db",
    templates: ["alignsynch"],
    capability:
      "One template, read-only: its Aspects in authored order with their Left and Right Values, how many instances were made from it, who wrote it and whether it is archived. The place the editor will land later.",
    notes:
      "The 'open' action. Read-only on purpose — editing is a separate decision, and the spec puts the editor on this same route when it exists. The read applies the same author rule as the library, so another account's template is a 404 here and nothing distinguishes it from an id that does not exist.",
  },
  {
    kind: "route",
    surface: "/assessment/templates/new",
    status: "fixture",
    templates: ["alignsynch"],
    capability:
      "Write a template: a title and one to eight Aspects, each a question with a Left Value and a Right Value, saved as a published record with no parties.",
    notes:
      '`fixture` and not `db` on purpose: the page renders page copy and resolves the session, and the one thing that reaches Postgres is the endpoint it posts to — `app/(mainlayout)/assessment/templates/save/route.ts` (moved one segment deeper when `/assessment/templates` became the library page, because Next refuses a page and a route handler in one segment), which writes the record and item rows through `lib/flow/templates.ts`. The save writes `record.author_user_id` from the session, so a template written here appears under "Mine" on `/assessment/templates`; a save from a request with no session would write NULL and read as a built-in, which cannot happen because the route gates on `currentUser()`. Since #255 this is the app\'s only writer of a template; the four seeded ones come from `data/assessments.ts` and carry no author.',
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
    capability: "The help centre: FAQ, help categories and a contact form.",
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
    kind: "route",
    surface: "/v1",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The prototype's persona picker — a stand-in for /login that offers the six personas instead of an email/password form, and lands the chosen persona on their own screen.",
  },
  {
    kind: "route",
    surface: "/v1/admin",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The Admin persona's landing: every relationship and template in the store, with the gap aggregates counted across the population.",
  },
  {
    kind: "route",
    surface: "/v1/coach",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The Coach persona's landing — read-only observation of relationships shared with the coach, with an advice thread and no scoring or answering.",
  },
  {
    kind: "route",
    surface: "/v1/counterparty",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The Counterparty persona's landing: claimable invitations and the relationships they have joined, each pointing at the shared answer sheet.",
  },
  {
    kind: "route",
    surface: "/v1/initiator",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The Initiator persona's landing: their templates, their relationships, and the counts that link to each list.",
  },
  {
    kind: "route",
    surface: "/v1/initiator/relationships",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The Initiator's relationships and invitations, with the invite and re-invite action inline on each row.",
  },
  {
    kind: "route",
    surface: "/v1/initiator/templates",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The Initiator's template library, with an inline form that copies a template into a relationship.",
  },
  {
    kind: "route",
    surface: "/v1/initiator/templates/new",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The template author — a variation of the quiz editor that writes a template to the in-browser store.",
  },
  {
    kind: "route",
    surface: "/v1/pricing",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The four plan tiers re-painted from the live fixture, with every paid CTA disabled so nothing is charged in the prototype.",
  },
  {
    kind: "route",
    surface: "/v1/privacy",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The same draft Privacy Policy the live page renders, shown inside the prototype's chrome.",
  },
  {
    kind: "route",
    surface: "/v1/relationships/[id]",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The one screen every role opens a relationship from — invitation, claim, progress, the blind answers table and the advice thread.",
  },
  {
    kind: "route",
    surface: "/v1/relationships/[id]/answer",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The answer sheet — one party answers every Aspect, Feel and Wish (or all four in Advanced Mode), then submits.",
  },
  {
    kind: "route",
    surface: "/v1/relationships/[id]/report",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The report — the eight gap kinds grouped under the glossary's headings, with the Setting's verdict on top, unlocked only when both parties have submitted.",
  },
  {
    kind: "route",
    surface: "/v1/service",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The Service user's landing: the support queue of invitations, accounts and stuck relationships, with a resolve action per ticket.",
  },
  {
    kind: "route",
    surface: "/v1/support",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The help centre stated without the taxonomy the alignment build does not offer, reading the brand record's mailbox for the contact line.",
  },
  {
    kind: "route",
    surface: "/v1/terms",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The same draft Terms of Service the live page renders, shown inside the prototype's chrome.",
  },

  /* ------------------------------------------------------------------ *
   * Component domains — `components/<domain>/`
   * ------------------------------------------------------------------ */
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
      "The two-party flow: the published template list, the invite view, the blind answer form and the instance screen both parties share.",
    notes:
      "Reads and writes Postgres through lib/flow/store.ts, so it is not a prop-only domain like components/assessment beside it.",
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
      "Both front pages: the QuizHub shelves (hero, category slider, latest, featured, top players, winners, testimonials) and the AlignSynch two-question block.",
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
      "The shell: header, sidebar, the layout that composes them, the sidebar context they share and the footer.",
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
    surface: "components/support",
    status: "fixture",
    templates: ["quizhub", "alignsynch"],
    capability:
      "The support centre: header, help categories, knowledge base, FAQ, contact form and the article detail.",
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
      "The shadcn primitives every screen composes, plus this repo's own chart, drawer, motion and circular-progress additions.",
    notes:
      "Renders only the props it is given; the tokens it paints with come from app/globals.css.",
  },
  {
    kind: "domain",
    surface: "components/v1",
    status: "prototype",
    templates: ["alignsynch"],
    capability:
      "The /v1 prototype — the whole AlignSynch product, UI-only, against an in-browser store rather than Postgres.",
    notes:
      "Guardrail #336, version 1. The whole /v1 prototype: six personas with the persona bar as the auth stand-in, an in-browser store (templates, relationships, accounts, tickets) seeded from `data/v1/fixtures.ts`, and the real gap/stage arithmetic wrapped by `lib/v1/derive.ts`. The template editor (`template-editor.tsx`) varies `components/create/quiz-editor.tsx` (tabbed authoring, per-Aspect accordions, store-backed Save/Publish/Archive/Delete, no preview); the answer sheet, report, lists and the persona picker vary their `components/assessment-flow` / `components/auth` ancestors the same way. `prototype` until the owner approves it.",
  },
]);
