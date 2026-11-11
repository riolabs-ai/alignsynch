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
 * `/assessment/instances` — the instances **this signed-in account** is a party to (#213).
 *
 * A static path beside the dynamic `/assessment/instances/[instanceId]`, not a child of it: the
 * list is its own surface, and a browser that types it gets the list rather than a 404 for an
 * instance id nobody holds.
 */
export const MY_INSTANCES_PATH = "/assessment/instances";

/** The create endpoint — a POST-only route handler. */
export const CREATE_INSTANCE_PATH = "/assessment/new";

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
 * `/templates/relationship` — the template library: the built-ins this account can use plus its
 * own (#console 5/5).
 *
 * A child of `TEMPLATES_PATH` because a template **is** a thing, and `assessment` is a record
 * *kind* a template is not (#794): the URL's parent now names what the child is. A page, not a
 * POST endpoint — the route handler that saves a template lives one segment deeper, at
 * `CREATE_TEMPLATE_PATH`, and Next refuses a `page.tsx` and a `route.ts` in one segment (they are
 * two parallel pages for the same URL, and the app loader throws).
 */
export const RELATIONSHIP_TEMPLATES_PATH = `${TEMPLATES_PATH}/relationship`;

/**
 * The library, under its long-standing name.
 *
 * Kept as an alias because the budget rows, the copy fixtures and the components have called it
 * this since #console 5/5, and "the template library" is still what the screen is. Nothing new
 * should be spelled with it; a new caller names `RELATIONSHIP_TEMPLATES_PATH`.
 */
export const TEMPLATE_LIBRARY_PATH = RELATIONSHIP_TEMPLATES_PATH;

/**
 * `/templates/relationship/new` — the form that authors a template (#255).
 *
 * Registered in `content/routes.ts` (E7 checks it in both directions) because it is a page. It is
 * not `…/[slug]/edit`: a template is never edited once saved — instances copy their Aspects at
 * creation, so a mutable source would rewrite the questions under answers somebody already gave.
 */
export const NEW_TEMPLATE_PATH = `${RELATIONSHIP_TEMPLATES_PATH}/new`;

/**
 * `/relationship-types` — the public catalogue (#794).
 *
 * The reachable half of `TEMPLATES_PATH`: the *taxonomy* of relationship types the shop sells,
 * one page per purchasable type, and no session needed. It is in `(marketing)` — wordmark, no
 * sidebar — because a stranger is who it is for.
 */
export const RELATIONSHIP_TYPES_PATH = "/relationship-types";

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

/** The duplicate endpoint — a POST, so a GET never writes a copy. */
export function templateDuplicatePath(slug: string): string {
  return `${relationshipTemplatePath(slug)}/duplicate`;
}

/**
 * The template-saving endpoint — a POST-only route handler, so it is not a page and the manifest
 * does not list it (the same split as `/assessment/new`).
 *
 * `/templates/relationship/save` and not `/templates/relationship`: that address is the library
 * page (`RELATIONSHIP_TEMPLATES_PATH`), and a segment cannot hold both. The form posts here and
 * the handler redirects: a save is a POST followed by a GET of either the form (refused, with the
 * reason) or `/assessment` (saved, where the new template is listed). That is what keeps a reload
 * from saving a second copy.
 */
export const CREATE_TEMPLATE_PATH = `${RELATIONSHIP_TEMPLATES_PATH}/save`;

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
 * `/templates/relationship/[slug]/create/commit` — stage 4 of the create flow (#690).
 *
 * The fourth sibling, exactly as the docstring above predicted. **Create** is the stage that
 * reviews the six facts, offers the two plans and holds the conversion, so it is the last screen
 * that can be reached without anything existing: pressing its control commits the relationship and
 * sends the invitation. It is a page for the same reason the three before it are — it can be
 * reloaded, linked and gone back to, and the draft is what it renders.
 */
export function createCommitPath(templateSlug: string): string {
  return `${createRelationshipPath(templateSlug)}/commit`;
}

/**
 * `/templates/relationship/[slug]/create/account` — the account gate **after** stage 4 (#690).
 *
 * The one surface in the flow that is not a stage: it follows the commit, it is never in front of
 * the create, and the spec says so explicitly ("Account is not a stage", #659). `instance` is the
 * relationship stage 4 just committed; the page proves the browser holds that relationship's own
 * initiator token before it draws a form, which is what makes the address unreachable before
 * stage 4 — a relationship id alone is not enough, because it is not a secret.
 */
export function createAccountPath(templateSlug: string): string {
  return `${createRelationshipPath(templateSlug)}/account`;
}

/**
 * The gate for one committed relationship: the template's gate, naming the relationship.
 *
 * Two handles on purpose (#794): the path segment is the template's **slug**, the `?instance=`
 * value is the relationship's **id**. Never pass one where the other belongs.
 */
export function createAccountForPath(templateSlug: string, instanceRecordId: string): string {
  return `${createAccountPath(templateSlug)}?instance=${encodeURIComponent(instanceRecordId)}`;
}

/**
 * `/assessment/instances/[instanceId]/sent` — the create flow's stage 5, **Sent** (#691).
 *
 * A child of the instance, beside `answer`, `accept` and `report`, because the screen is about one
 * committed relationship: the invitation's row is what it draws, and the id in its address is the
 * one the create just committed. It is deliberately **not** `…/create/sent`: the `create` tree is
 * the template's, and by the time this screen renders the template is a fact on the session rather
 * than the subject of the page.
 *
 * A page, not a query flag on the instance screen, because the two are different stages: Sent is
 * stage 5 and draws the six-stage rail; the instance screen is stage 6 and keeps its status
 * sentence (`docs/specs/ux-stages.md`). One route per stage is what lets a reload, a link and the
 * back button all land where the person was.
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
 * **Where the create sends the browser (#690, #691, #709).** The one decision `POST /assessment/new`
 * makes about the screen, kept here so it is a test rather than a claim about a route handler.
 *
 * - A **signed-out** creator lands on the gate. Their relationship exists — the endpoint has always
 *   accepted a post with no initiator (#146/#213) — and the gate is the screen that offers the
 *   account *after* the fact, which is the whole of #659: the account is not a stage, so nothing
 *   makes a person sign up before they have something to sign up for.
 * - A **signed-in** creator lands on **the dashboard** (#709). Until this card it was Sent, stage 5
 *   — a page the flow navigated to, which made the commit a fifth page load and left the finished
 *   relationship one screen away from the list it belongs in. The approved v6 artifact closes the
 *   modal onto `/dashboard`, where the new relationship is under My relationships from that
 *   redirect on. **Sent is no longer a destination**: it still answers on its own address (stage 5
 *   renders when asked for by URL), and nothing in the flow sends anybody there.
 * - A post naming **no template** never came through the flow (`scripts/flow-e2e.mjs`, a `curl`),
 *   so there is no gate and no flow stage to send it to: it goes to the relationship like any other
 *   committed create.
 */
export function afterCreateTarget(input: {
  viewerSignedIn: boolean;
  templateSlug: string;
  instanceRecordId: string;
}): string {
  if (input.templateSlug !== "") {
    return input.viewerSignedIn
      ? OVERVIEW_PATH
      : createAccountForPath(input.templateSlug, input.instanceRecordId);
  }
  return instancePath(input.instanceRecordId);
}

/**
 * `/pricing` — where a plan is chosen (#618).
 *
 * The create screen's two refusals (`relationship-limit`, `mode-not-entitled`) name a plan and, until
 * this constant, drew no door. They point *here* and not at a checkout URL: a checkout is started
 * from a plan card (`components/pricing/plan-checkout-button.tsx`) which posts the tier it sells, and
 * a refusal that built a checkout session would be a second copy of that decision — a link that can
 * only work for one tier, on a page that does not know which tier the person needs. The route is
 * already in `content/routes.ts`, so E7's both-directions check is satisfied without an edit there.
 */
export const PRICING_PATH = "/pricing";

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
