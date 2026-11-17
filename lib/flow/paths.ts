/**
 * The flow's URLs, in one place (#146).
 *
 * A form's `action` and a redirect's target are written here rather than in JSX, for two
 * reasons: a component that spells a path is a second copy of the route manifest, and the
 * page-copy ratchet (E23) counts a string attribute in a counted component — so a path in
 * JSX would also have to live in an editor's copy fixture, which is the wrong place for it.
 *
 * `/assessment`, `/assessment/instances/[instanceId]` and `/invite/[token]` are registered
 * in `content/routes.ts` (E7 checks both directions); the two POST-only endpoints are route
 * handlers and therefore not pages, so the manifest does not list them.
 */
export const ASSESSMENTS_PATH = "/assessment";

/**
 * `/dashboard` — the signed-in console's Overview.
 *
 * A top-level path, not a child of `/dashboard/user`: `/dashboard/user` is the **quiz** product's
 * account home (#164), gated by `requireQuizProduct()`, and a console that sat underneath it would
 * be unreachable on the alignment build the console exists for. The two are siblings with two
 * products' words, and only one of them is a 404 on either brand.
 */
export const OVERVIEW_PATH = "/dashboard";

/**
 * Where a member's relationships are **listed** (#841).
 *
 * `OVERVIEW_PATH` is the dashboard home, which is still fixture-driven; this is the page that
 * renders rows — `listMyRelationships()`, drafts included, because its query filters only on
 * `VIEWER_IS_PARTY`. The two were conflated, so stage 5's keep-as-draft control sent a creator to a
 * home page that cannot show the draft it had just saved. A destination that promises "saved under
 * your relationships" has to be the list.
 */
export const RELATIONSHIPS_PATH = `${OVERVIEW_PATH}/relationships`;

/**
 * One relationship's own screen (#620).
 *
 * `RELATIONSHIPS_PATH` is the **base**, not the destination — a child of it is spelled by building
 * on it, or the two halves drift into `/dashboard/relationships/relationships/<id>`. It lives in
 * this module rather than beside the read because the card that draws it is a client component
 * (#841 part 2): a value import from `lib/member/relationships.ts` would drag `pg` into the
 * browser graph, and `data:check` E34 fails exactly that crossing.
 */
export function relationshipPath(relationshipId: string): string {
  return `${RELATIONSHIPS_PATH}/${relationshipId}`;
}

/**
 * `/assessments` — the **assessment sessions** this signed-in account is a party to (#877).
 *
 * Plural, and a sibling of `/dashboard/relationships` and `/dashboard/templates`: the three are
 * the member's own record lists, and the owner's correction was that this one is a *listing*
 * (`assessments/`), not a page under the `/assessment` record-kind (`assessment/`). It replaced
 * `/assessment/instances`, which is now a 308 here (`next.config.mjs`) — one listing, one address.
 *
 * It is not `instancePath()`'s base: a session is still addressed at
 * `/assessment/instances/<record id>`, because that is the flow's own route and it did not move.
 */
export const MY_ASSESSMENTS_PATH = "/assessments";

/** The create endpoint — a POST-only route handler. */
export const CREATE_INSTANCE_PATH = "/assessment/new";

/**
 * The id the stage card's heading carries, so the card can be the labelled region and
 * `StageTitleFocus` can move focus to it (#1123).
 *
 * It lives here rather than in a component because E23 counts the leaf literals under
 * `components/`: an `id` is a handle, not copy, and the check cannot tell the difference — so the
 * one home for the string is a module that exists to hold flow handles.
 */
export const CREATE_STAGE_HEADING_ID = "create-stage-heading";

/**
 * `POST /assessment/new/who` — stage 1's save (#688).
 *
 * A route handler below the create endpoint rather than a second verb on it: the endpoint
 * commits a relationship, and this writes a draft cookie — two different effects that should
 * never be reachable by getting one form field wrong. The stage-2 form still posts to
 * `CREATE_INSTANCE_PATH`, which reads the draft stage 1 wrote.
 */
export const SAVE_WHO_PATH = "/assessment/new/who";

/**
 * `POST /assessment/new/mode` — stage 2's save (#689).
 *
 * Before stage 3 existed, the Mode screen's own form posted straight to `CREATE_INSTANCE_PATH`
 * and the relationship was created there. The approved flow puts Aspects between the two, so the
 * Mode form now saves its two choices into the same draft and hands over to
 * `createAspectsPath()`; the create stays behind the last stage's own control.
 */
export const SAVE_MODE_PATH = "/assessment/new/mode";

/**
 * `POST /assessment/new/aspects` — stage 3's list save (#689), answered as JSON.
 *
 * A route handler of its own rather than a field on the create endpoint: the list is saved on
 * each gesture (an Aspect's Save, a drag's drop), so it is a small request that must not create
 * anything. It answers `{ok: true}` or `{ok: false, problem: <field>}` and never redirects —
 * the screen that posted it is already where it should be.
 */
export const SAVE_ASPECTS_PATH = "/assessment/new/aspects";

/**
 * `/dashboard/support` — the member's support surface (#542 phase 1).
 *
 * The rail's Support row used to open `/support`, whose one action was a link out to the public
 * help centre; this is the work itself, inside the shell: the knowledge base, one article and the
 * request form. Three constants and one builder, because the page, its server action, the article
 * route and the rail's `href` are four callers of the same address.
 */
export const DASHBOARD_SUPPORT_PATH = "/dashboard/support";

/** The knowledge-base list inside the dashboard — where one article's links resolve. */
export const DASHBOARD_ARTICLE_BASE = `${DASHBOARD_SUPPORT_PATH}/articles`;

/** One article, inside the dashboard. */
export function dashboardArticlePath(slug: string): string {
  return `${DASHBOARD_ARTICLE_BASE}/${slug}`;
}

/**
 * `/dashboard/help` — the onboarding sequence plus the tour's replay control (#542 phase 1).
 *
 * The rail's "How it works" row points here; `/how-it-works` still answers for a bookmarked link.
 */
export const DASHBOARD_HELP_PATH = "/dashboard/help";

/**
 * `/help` — the public help centre (FAQ, knowledge base, the one public contact form).
 *
 * A constant because two trees read it: the marketing article page passes it to `ArticleDetail` as
 * the breadcrumb's destination, and `/support` (the account page) redirects a signed-out visitor
 * there instead of to `/login`. A path spelled in JSX is a copy literal to E23 and a second copy of
 * the manifest to a reader, so both callers name it here.
 */
export const PUBLIC_HELP_PATH = "/help";

/**
 * `/templates` — the template **namespace**, not a page.
 *
 * It answers a permanent 308 to `/relationship-types` (`next.config.mjs`): the public catalogue
 * that used to own this address is a *taxonomy* and has moved to its own noun (#794), and the
 * library that does belong under this one sits a level in at `RELATIONSHIP_TEMPLATES_PATH`.
 * `tests/route-redirects.test.ts` fails any `permanent: true` row whose static `source` is also a
 * route pattern, so this constant is never the address of a `page.tsx`. Do not give it one back.
 */
export const TEMPLATES_PATH = "/templates";

/**
 * `/templates/relationship` — **the create flow's namespace** since #1109, not a page.
 *
 * A child of `TEMPLATES_PATH` because a template **is** a thing, and `assessment` is a record
 * *kind* a template is not (#794): the URL's parent names what the child is. What lives under it
 * now is the flow that starts a relationship from a template — `…/[slug]/create` and its four
 * stages — plus the one POST endpoint that flow posts to (`…/[slug]/status`).
 *
 * **The library itself moved to the dashboard.** `/templates/relationship`, `…/new` and
 * `…/[slug]` were retired in #1109: a member's templates are `/dashboard/templates[?tab=mine]` and
 * one of them is `/dashboard/templates/<id>`, and the three old addresses answer a 308 from
 * `next.config.mjs`. So this constant is no longer aliased to the library (`TEMPLATE_LIBRARY_PATH`
 * below names that), and only the flow's own paths are built from it.
 */
export const RELATIONSHIP_TEMPLATES_PATH = `${TEMPLATES_PATH}/relationship`;

/**
 * `/dashboard/templates` — **the member's template library**, where it lives since #1109.
 *
 * It was an alias for `RELATIONSHIP_TEMPLATES_PATH` while `/templates/relationship` was a page;
 * that page is retired, and every "go back to your templates" destination in the product means this
 * one. Kept as a name because the budget rows, the copy fixtures and the flow's own components have
 * called it "the template library" since #console 5/5, and it still is.
 *
 * The value is a literal rather than an import of `MEMBER_TEMPLATES_PATH` (`lib/member/templates.ts`)
 * on purpose: that module reaches `pg`, and this one is imported by `"use client"` components.
 */
export const TEMPLATE_LIBRARY_PATH = `${OVERVIEW_PATH}/templates`;

/**
 * `/relationship-types` — one relationship *type*'s public page (#794).
 *
 * The reachable half of `TEMPLATES_PATH`: the *taxonomy* of relationship types the shop sells,
 * one page per purchasable type, and no session needed. It is in `(marketing)` — wordmark, no
 * sidebar — because a stranger is who it is for.
 *
 * **Since #905 this is not the catalogue.** The public catalogue answers at
 * `TEMPLATE_CATALOGUE_PATH`; this constant is the namespace the type pages and their worked
 * examples live in, and the address the #889 catalogue composition is retained at as a variation
 * (`app/(marketing)/relationship-types/page.tsx`).
 */
export const RELATIONSHIP_TYPES_PATH = "/relationship-types";

/**
 * `/relationship-templates` — the public catalogue of templates (#905).
 *
 * The door the shared header's `Templates` row, the footer's catalogue link and every "start with
 * a template" action point at: the V2 catalogue, which lists the taxonomy by group and links each
 * type to its page under `RELATIONSHIP_TYPES_PATH`. It is a separate constant from
 * `RELATIONSHIP_TEMPLATES_PATH` (`/templates/relationship`, the member's library) on purpose —
 * two surfaces, two nouns, and a reader should not have to guess which one a link means.
 */
export const TEMPLATE_CATALOGUE_PATH = "/relationship-templates";

/**
 * One relationship type's public page — `/relationship-types/<id>`.
 *
 * Addressed by the taxonomy's own `id` (`data/relationship-types.ts`), never by a record handle:
 * a type is a row in a fixture, not a record in the database.
 */
export function relationshipTypePath(typeId: string): string {
  return `${RELATIONSHIP_TYPES_PATH}/${typeId}`;
}

/**
 * One relationship type's worked example — `/relationship-types/<id>/demo`.
 *
 * A **child of the type's public page**, not a segment of its own: the example is the taxonomy
 * row's own finished report, so a reader who lands on the example is one address below the type
 * they were reading, and the breadcrumb back is the page it belongs to (#794's catalogue noun,
 * and the IA decision on the demo's own card).
 *
 * The parent has been `/assessment/demo/<type>` and `assessmentDemoPath` is **deleted rather than
 * aliased** (the #794 doctrine): the segment named a record *kind* the example is not, and an
 * alias would let a new caller keep spelling the retired noun. `record.id` never appears in this
 * address either — the taxonomy id is already its slug, so there is no id↔slug mapping here.
 */
export function relationshipTypeDemoPath(typeId: string): string {
  return `${relationshipTypePath(typeId)}/demo`;
}

/**
 * One template, read-only: its Aspects, its instances and whether it is archived.
 *
 * **Takes `record.slug`.** `record.id` is the storage handle and leaves the URL (#794): every
 * caller holds a `LibraryTemplate`, which carries both, and the id-shaped predecessor of this
 * function is **deleted rather than aliased** so nothing can pass an id by mistake.
 *
 * > `[slug]` is a **URL** fact; `record.id` is a **storage** fact. This function writes the
 * > address; `createDraftCookieName(record.id)` names the jar; `POST /assessment/new` carries
 * > `record.id` in `templateRecordId`. Never pass one where the other belongs.
 */
export function relationshipTemplatePath(slug: string): string {
  return `${RELATIONSHIP_TEMPLATES_PATH}/${slug}`;
}

/** The archive/unarchive endpoint — a POST, so a GET never changes a template's state. */
export function templateStatusPath(slug: string): string {
  return `${relationshipTemplatePath(slug)}/status`;
}

/**
 * One template's **own** editor — the surface that can change its Aspects (#870).
 *
 * Not the read-only detail page above: `/templates/relationship/<slug>` draws what the catalogue
 * offers and writes nothing but archive/duplicate, so a refusal that says "this template has no
 * Aspects" pointing there would send a person to a page that cannot fix it. This address is the
 * member's editor, which is the console's editor mounted with `band="private"`
 * (`app/(mainlayout)/dashboard/templates/[id]/page.tsx`).
 *
 * **Takes `record.id`, and that is the one place the id belongs in a URL here** — the editor route
 * is keyed on the record, not on a slug, and it is the only such address this flow links to.
 *
 * It carries no "come back here" parameter: the editor does not read one, so a `?return=` would be
 * a promise the page never keeps. A person who fixes an Aspect there returns to the flow from the
 * editor's own navigation, which is the honest shape until the editor grows that parameter.
 */
export function dashboardTemplateEditorPath(recordId: string): string {
  return `${OVERVIEW_PATH}/templates/${recordId}`;
}

/**
 * **The duplicate, delete and save endpoints are gone (#1109).** `/templates/relationship/<slug>`
 * was their parent, and the row menu that posted to them was that page's: duplicating, archiving
 * and deleting a member's own template are now the dashboard's (`/dashboard/templates?tab=mine` for
 * the copy, `/dashboard/templates/<id>` for the retire band, both server actions over
 * `lib/member/templates.ts`). `templateDuplicatePath`, `templateDeletePath` and
 * `CREATE_TEMPLATE_PATH` were deleted rather than aliased, so no caller can rebuild a dead address.
 * `templateStatusPath` above **stays**: the create flow's stage 1 still posts to it (#870).
 */

/**
 * `/dashboard/relationships/[id]` — one relationship's own screen (#619).
 *
 * The address a payment notice links to, and the page the payer returns to after a capture. It is
 * written here rather than in the mail module because `lib/member/payment.ts` also needs it and a
 * second literal would be a second copy of the manifest — the same reason every other path in this
 * file exists.
 */
export function relationshipScreenPath(relationshipId: string): string {
  return `${OVERVIEW_PATH}/relationships/${encodeURIComponent(relationshipId)}`;
}

export function instancePath(instanceRecordId: string): string {
  return `/assessment/instances/${instanceRecordId}`;
}

/**
 * `/assessment/instances/[instanceId]/answer` — the answer sheet **page** (#409, R1-E).
 *
 * Singular, and deliberately not `answersPath()` above: `/answers` is the POST-only endpoint the
 * live form submits to, and Next refuses a `page.tsx` in the same segment as a `route.ts`. The
 * two names sit beside each other so the difference is read, not remembered.
 */
export function answerSheetPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/answer`;
}

/** `/assessment/instances/[instanceId]/accept` — the acceptance step (#409, R1-E). A page. */
export function acceptPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/accept`;
}

/**
 * The accept endpoint — a form post, so a refused acceptance is a status code and not a banner.
 *
 * **Plural, and for the same mechanical reason `/answers` is.** Next refuses a `page.tsx` and a
 * `route.ts` in one segment (it loads both as parallel pages for one URL and throws), so the
 * POST cannot live at `acceptPath()`. The pair reads as the flow's other pair — `/answer` renders
 * the sheet, `/answers` writes it — and the two function names sit side by side so the difference
 * is read rather than remembered (#R2).
 */
export function acceptsPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/accepts`;
}

/** `/assessment/instances/[instanceId]/report` — the report the second acceptance opens. */
export function reportPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/report`;
}

/**
 * `/templates/relationship/[slug]/create` — the create step (#409, R1-E).
 *
 * A child of the template's own address rather than a sibling, so the template being copied is
 * the route's own fact and the form's payload cannot name a different one. The segment is the
 * record's **slug** (#794); the form still posts the record's **id** in `templateRecordId`,
 * because that is what the writer keys on.
 */
export function createRelationshipPath(templateSlug: string): string {
  return `${relationshipTemplatePath(templateSlug)}/create`;
}

/**
 * The platform's **blank** template — the record a generic create action starts from (#1042).
 *
 * One slug, named once, because two different facts address it: the fixture that authors the
 * generic CTA's destination (`data/pages/templates.ts::final-cta`) and the test that pins that
 * destination to a route this build actually renders. The record itself is `data/assessments.ts`'s
 * `assessment-blank-template` — the glossary's third line, "the user's to name", `published`
 * since #1042 so it can be copied like any other start.
 *
 * It is deliberately **not** a `TemplateRecordId`: this is the URL's fact, and the form still posts
 * the record's id (see `relationshipTemplatePath()`'s note on the two handles).
 */
export const BLANK_TEMPLATE_SLUG = "blank-template";

/**
 * The **blank start**: stage 1 of the create flow for a relationship nobody chose a template for.
 *
 * "Create a relationship" on a catalogue, a template list or an offer band has no template behind
 * it — that is what makes it generic — so it starts on this record: the person names the
 * relationship at Details and rewords the placeholder Aspects at stage 3. Before #1042 the generic
 * action was a bare `/register`, which put a sign-up form where the wizard belongs.
 */
export function blankRelationshipPath(): string {
  return createRelationshipPath(BLANK_TEMPLATE_SLUG);
}

/**
 * `/templates/relationship/[slug]/create/mode` — stage 2 of the create flow (#688).
 *
 * A child of the create path rather than a query parameter (`?step=mode`) because the flow is
 * a sequence of stages, not one screen with a switch: slice 3 adds `…/create/aspects` and
 * slice 4 `…/create/commit` the same way, and a stage that can be deep-linked, reloaded and
 * cached by its own address is what makes each of them a page rather than a state.
 */
export function createModePath(templateSlug: string): string {
  return `${createRelationshipPath(templateSlug)}/mode`;
}

/**
 * `/templates/relationship/[slug]/create/aspects` — stage 3 of the create flow (#689).
 *
 * The third sibling, exactly as the docstring above predicted: a stage that can be deep-linked,
 * reloaded and cached by its own address. It reads the draft stages 1 and 2 wrote, so opening it
 * cold sends the person back to Who rather than showing a list with no relationship behind it.
 */
export function createAspectsPath(templateSlug: string): string {
  return `${createRelationshipPath(templateSlug)}/aspects`;
}

/**
 * `/templates/relationship/[slug]/create/commit` — stage 4 of the create flow, **Account** (#825).
 *
 * The address kept its name and changed its job, because the job was always this one: it is the
 * screen where the relationship is **committed** — written to the database as a `draft` — and it is
 * the last screen before anything exists. What moved is what it asks for on the way: since v9 the
 * Initiator must be a signed-in account, so this stage mounts the app's own sign-in form instead of
 * a note saying an account would be asked for later. That is the whole of #825's account-placement
 * decision: `draft` is written at the end of stage 4, not after stage 5's Invite.
 *
 * **The retired `…/create/account` address does not come back.** That path was the *gate* that
 * followed this stage (#690, #794): a second screen demanding an account for a relationship that
 * already existed. `createAccountPath()` and `createAccountForPath()` are deleted rather than
 * aliased, so no caller can spell an address no page answers — E10 fails on a dead `href`, which is
 * exactly the guard that keeps a retired address retired.
 */
export function createCommitPath(templateSlug: string): string {
  return `${createRelationshipPath(templateSlug)}/commit`;
}

/**
 * `/templates/relationship/[slug]/create/invite` — stage 5 of the create flow, **Invite** (#825).
 *
 * Stage 4 wrote the relationship as a draft; this is where it either goes out or does not. The
 * address names the stage, not the act: `commit` above is where the commit happens, `invite` is
 * where the invitation is decided, and a reader walking the five cells can guess both.
 *
 * The relationship it is about travels as `?instance=`, because the draft cookie is consumed by
 * the create that wrote the row — the id is what the page reads through `readFlowScreen()`, with
 * this browser's party cookie as the proof that it is the creator's own.
 */
export function createInvitePath(templateSlug: string): string {
  return `${createRelationshipPath(templateSlug)}/invite`;
}

/**
 * The gate for one created relationship, as stage 5's own address: the template's slug in the
 * path, the relationship's id in `?instance=` (#794's two handles, unchanged).
 */
export function createInviteForPath(templateSlug: string, instanceRecordId: string): string {
  return `${createInvitePath(templateSlug)}?instance=${encodeURIComponent(instanceRecordId)}`;
}

/**
 * `POST /assessment/instances/[instanceId]/send` — stage 5's only write (#825).
 *
 * A route handler and not a server action, for the same reason every other write in this flow is
 * one: the stage has to be drivable with a plain HTML form, and a send must be a POST so a mail
 * client's link preview cannot fire an invitation. It is deliberately **not**
 * `…/invite`: that address is the re-invite endpoint (#275), which reissues a token for an
 * invitation that already went out, and a first send that reused it would leave the relationship's
 * status behind at `draft`.
 */
export function sendInvitationPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/send`;
}

/**
 * `/assessment/instances/[instanceId]/sent` — the invitation's confirmation screen (#691).
 *
 * A child of the instance, beside `answer`, `accept` and `report`, because the screen is about one
 * committed relationship: the invitation's row is what it draws, and the id in its address is the
 * one the create just committed. It is deliberately **not** `…/create/sent`: the `create` tree is
 * the template's, and by the time this screen renders the template is a fact on the session rather
 * than the subject of the page.
 *
 * **It is not a stage (#825).** Since v9 the flow's last numbered stage is Invite, and this screen
 * is that stage's outcome: it is reached by pressing Send, it carries no `Stage {n}` of its own in
 * the spec's count, and it is where the invitation's state, its resend control and its copy link
 * live. It still draws the shared band (inside the sheet, at Invite) because that is what the
 * artifact does around it, but nothing in the flow *advances* here as a sixth step.
 */
export function sentPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/sent`;
}

/**
 * The `returnTo` value the Sent screen's resend form posts (#691).
 *
 * A value, not a sentence — the same rule `INVITE_INTENT_VALUE` follows. The re-invite endpoint
 * reads it as a closed literal and maps it to `sentPath()`, so it never becomes a URL a post could
 * choose; it lives here so the form and the handler cannot disagree about the spelling.
 */
export const SENT_RETURN_VALUE = "sent";

/**
 * `/pricing` — the page a plan is chosen on (#618).
 *
 * The create screen's two refusals (`relationship-limit`, `mode-not-entitled`) name a plan and drew
 * no door until this constant. They point *here* and not at a checkout URL: a checkout is started
 * **inside stage 5**, from a plan row, and a refusal that built a checkout session would be a second
 * copy of that decision — a link that can only work for one tier, on a page that does not know which
 * tier the person needs. The route is already in `content/routes.ts`, so E7's both-directions check
 * is satisfied without an edit there.
 *
 * Since #1043 the page sells nothing itself: every action on it opens the template catalogue, and a
 * plan-specific one carries the tier and interval through {@link pricingStartPath}.
 */
export const PRICING_PATH = "/pricing";

/**
 * `/pricing/start` — the one action every `/pricing` CTA takes (#1043).
 *
 * It is a **route handler, not a page**: it writes (or clears) the carried plan on the browser and
 * answers `303` to the public Templates listing (`app/(marketing)/pricing/start/route.ts`). Two
 * policies, one address, so a door cannot carry a plan by accident:
 *
 *   `pricingStartPath({ planId, interval })`   a plan card — carry this choice
 *   `pricingStartPath()`                       the general CTA — carry **nothing**, and clear
 *                                              whatever an earlier visit left behind
 *
 * The choice travels in the query rather than in the page's own state because the card that draws it
 * is a client component and the catalogue it opens is prerendered; the handler is what turns one
 * into the other. Nothing here is a payment: stage 5's own checkout is still the only charge, and a
 * crafted pair resolves to the general policy (see `lib/flow/plan-intent.ts`).
 */
export function pricingStartPath(choice?: {
  readonly planId: string;
  readonly interval: string;
}): string {
  const route = `${PRICING_PATH}/start`;
  if (choice === undefined) return route;
  const query = new URLSearchParams({ plan: choice.planId, interval: choice.interval });
  return `${route}?${query.toString()}`;
}

/** The submit endpoint: a form post, so a frozen answer is a status code and not a banner. */
export function answersPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/answers`;
}

/**
 * The Steps endpoint — a form post, so a refused tick is a status code and not a banner (#478).
 *
 * Plural, like `/answers` and `/accepts`, and for the same mechanical reason: this is a route handler,
 * not a page, and the panel's two controls (the tick and the reword) both post here with the Step's id
 * and nothing that identifies a person. A GET of it is a 405, exactly as a GET of `/answers` is.
 */
export function stepsPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/steps`;
}

/**
 * The re-invite endpoint — a POST, so a GET never reissues a token (#275).
 *
 * A child of the instance's own address rather than a sibling: the invitation belongs to that
 * instance, and the form that posts here is drawn on that instance's screen. Like the other two
 * POST-only endpoints it is a route handler, not a page, so the manifest does not list it.
 */
export function reinvitePath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}/invite`;
}

export function invitePath(token: string): string {
  return `/invite/${token}`;
}

/**
 * One step of the counterparty's onboarding wizard: `/invite/<token>?step=2`.
 *
 * The token stays **in the path** on every step, so every step's URL is the exact URL a sign-in
 * round-trip has to return to: the token is the invitation, and a wizard that carried it in a
 * query or a cookie would have a second copy that can drift from the link the person was sent.
 * Step 1 carries no query, so the address a fresh invite lands on is the one in the email.
 */
export function inviteStepPath(token: string, step: InviteWizardStep): string {
  return step === 1 ? invitePath(token) : `${invitePath(token)}?step=${step}`;
}

/** The wizard's three steps, in order, as **numbers**: the copy labels them, not this module. */
export const INVITE_WIZARD_STEPS = [1, 2, 3] as const;

export type InviteWizardStep = (typeof INVITE_WIZARD_STEPS)[number];

/**
 * A `?step=` value → the step it names, or step 1. Unknown, empty and repeated values land on the
 * first step rather than 404ing: the step is a reader's position, not an address that can be wrong.
 */
export function inviteWizardStepOf(
  value: string | readonly string[] | undefined,
): InviteWizardStep {
  const raw = typeof value === "string" ? value : value?.[0];
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  return INVITE_WIZARD_STEPS.find((step) => step === parsed) ?? 1;
}

/**
 * Where a step-3 visitor goes to sign in or to create the account the claim will bind.
 *
 * `next` is the **same step URL**, so the round trip returns to step 3 with the token intact —
 * `safeNextPath` keeps it (a same-site path) and `signInDestination` keeps it (this build ships
 * `/invite/[token]`). The two extra parameters are what let the auth screen say *why* someone is
 * there: `intent=invite` and the inviter's name, which `lib/auth/invite-prompt.ts` turns into one
 * sentence from the login fixture.
 */
export function inviteAuthPath(
  kind: "login" | "register",
  token: string,
  step: InviteWizardStep,
  initiatorName: string,
): string {
  const next = encodeURIComponent(inviteStepPath(token, step));
  const inviter = encodeURIComponent(initiatorName.trim().slice(0, 80));
  return `/${kind}?next=${next}&intent=${INVITE_INTENT_VALUE}&inviter=${inviter}`;
}

/** The `intent` value the auth screens read; a word, not a sentence — the sentence is copy. */
export const INVITE_INTENT_VALUE = "invite";

/**
 * The confirmation a submit lands on: the instance screen in its `submitted` state.
 *
 * A query rather than a route of its own: this is the same read (the viewer's own instance) with
 * one band added, and a second page module would be a second `readFlowScreen()` for the same rows.
 */
export function submittedPath(instanceRecordId: string): string {
  return `${instancePath(instanceRecordId)}?submitted=1`;
}

/** The `submitted` value `submittedPath()` writes, and the only one the screen reads. */
export const SUBMITTED_QUERY_VALUE = "1";

/** The claim endpoint — a POST, so a GET never spends the single-use token. */
export function claimPath(token: string): string {
  return `${invitePath(token)}/claim`;
}

/**
 * `POST /invite/[token]/join` — step 2 of the join (`Join`), which carries the two fields to step 3
 * (#1125).
 *
 * Its own address rather than a field on the claim's: the claim **is** the acceptance, and step 2 is
 * the step before it. One endpoint that did both would make the `Join` button a claim, and the
 * `Accept` button a second claim of a spent token — which the bundle does not draw and the store
 * would refuse.
 */
export function joinDetailsPath(token: string): string {
  return `${invitePath(token)}/join`;
}

/**
 * `POST /invite/[token]/decline` — step 1's quiet "Not for you? Decline the invitation" (#1125).
 *
 * A POST and not a link, for the reason the claim is: following a URL must never end an invitation,
 * and a mail client that prefetches the decline would kill the seat before anybody read the page.
 */
export function declinePath(token: string): string {
  return `${invitePath(token)}/decline`;
}

/**
 * **Where a completed response sends the browser (#710).** The response path's counterparty has
 * just joined the relationship, so the same rule the create's own completion follows applies: the
 * modal closes onto the screen the joined relationship is listed on.
 *
 * - A **signed-in** claimer lands on **`/dashboard`**, where the relationship is now under My
 *   relationships. That is the only shape the screens offer: step 3's claim form renders for a
 *   signed-in viewer, and a signed-out one is offered sign-in and sign-up instead, both carrying
 *   `?step=3` as `next` so the round trip returns to the claim.
 * - A **signed-out** claim — reachable by posting the endpoint directly, which is what
 *   `scripts/flow-e2e.mjs` does — lands on the **relationship**. It is not a lesser answer: the
 *   claim set this browser's party cookie, so the relationship screen is readable, and
 *   `/dashboard` would only bounce the browser to `/login` and lose the seat it just bound.
 *
 * Both targets are a *screen*, never a state: the relationship has no `Ongoing` surface
 * (`docs/specs/flow-stages.md`), and completion is the relationship's own page.
 */
export function afterClaimTarget(input: {
  viewerSignedIn: boolean;
  instanceRecordId: string;
}): string {
  return input.viewerSignedIn ? OVERVIEW_PATH : instancePath(input.instanceRecordId);
}
