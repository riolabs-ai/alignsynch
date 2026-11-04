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

/** `/dashboard/library` — the templates this member owns or has adopted (#542 phase 1). */
export const DASHBOARD_LIBRARY_PATH = "/dashboard/library";

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
 * `/assessment/templates/new` — the form that authors a template (#255).
 *
 * Registered in `content/routes.ts` (E7 checks it in both directions) because it is a page. It is
 * a child of `/assessment` rather than a sibling (`/assessment/new` is already taken by the
 * instance-creating POST), and it is not `/assessment/templates/[slug]/edit`: a template is never
 * edited once saved — instances copy their Aspects at creation, so a mutable source would rewrite
 * the questions under answers somebody already gave.
 */
export const NEW_TEMPLATE_PATH = "/assessment/templates/new";

/**
 * `/assessment/templates` — the template library: the built-ins this account can use plus the
 * templates it wrote (#console 5/5).
 *
 * A page now, not a POST endpoint: the route handler that saves a template used to live at this
 * exact path, and Next refuses a `page.tsx` and a `route.ts` in one segment (they are two
 * parallel pages for the same URL, and the app loader throws E28). The save moved to
 * `CREATE_TEMPLATE_PATH` below — one segment deeper, same handler, same redirect — so the
 * screen the console asked for could exist at the address it asked for.
 */
export const TEMPLATE_LIBRARY_PATH = "/assessment/templates";

/**
 * `/assessment/demo/[type]` — the worked example's own segment (#478, the `release` demo row).
 *
 * Not `/assessment/templates/demo/<type>`: `[templateId]` already owns
 * `/assessment/templates/<id>`, and Next refuses two dynamic segment names at one level. A
 * sibling segment keeps the address stable and the manifest's dynamic rows unambiguous.
 */
export const ASSESSMENT_DEMO_PATH = "/assessment/demo";

/** One type's finished example report — the only page a stranger may read a report on. */
export function assessmentDemoPath(typeId: string): string {
  return `${ASSESSMENT_DEMO_PATH}/${typeId}`;
}

/** One template, read-only: its Aspects, its instances and whether it is archived. */
export function templateDetailPath(recordId: string): string {
  return `${TEMPLATE_LIBRARY_PATH}/${recordId}`;
}

/** The archive/unarchive endpoint — a POST, so a GET never changes a template's state. */
export function templateStatusPath(recordId: string): string {
  return `${templateDetailPath(recordId)}/status`;
}

/** The duplicate endpoint — a POST, so a GET never writes a copy. */
export function templateDuplicatePath(recordId: string): string {
  return `${templateDetailPath(recordId)}/duplicate`;
}

/**
 * The template-saving endpoint — a POST-only route handler, so it is not a page and the manifest
 * does not list it (the same split as `/assessment/new`).
 *
 * `/assessment/templates/save` and not `/assessment/templates`: that address is the library page
 * now (`TEMPLATE_LIBRARY_PATH`), and a segment cannot hold both. The form posts here and the
 * handler redirects: a save is a POST followed by a GET of either the form (refused, with the
 * reason) or `/assessment` (saved, where the new template is listed). That is what keeps a reload
 * from saving a second copy.
 */
export const CREATE_TEMPLATE_PATH = `${TEMPLATE_LIBRARY_PATH}/save`;

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
 * `/assessment/templates/[templateId]/create` — the create step (#409, R1-E).
 *
 * A child of the template's own address rather than a sibling, so the template being copied is
 * the route's own fact and the form's payload cannot name a different one.
 */
export function createRelationshipPath(templateRecordId: string): string {
  return `${templateDetailPath(templateRecordId)}/create`;
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
