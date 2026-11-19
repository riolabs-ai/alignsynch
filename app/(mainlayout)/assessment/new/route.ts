import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { templateSlugOf } from "@/lib/db/template-library";
import { CREATE_NOT_FROM_FLOW } from "@/lib/flow/create-copy";
import {
  counterpartyNameOf,
  initiatorNameOf,
  modeDraft,
  parseCreateDraft,
} from "@/lib/flow/create-draft";
import {
  createSessionFromTemplate,
  FlowError,
  type CreatedSession,
  type FlowErrorCode,
} from "@/lib/flow/store";
import {
  createCommitPath,
  createFailedPath,
  createInviteForPath,
  createModePath,
  createRelationshipPath,
  sessionPath,
  TEMPLATE_LIBRARY_PATH,
} from "@/lib/flow/paths";
import { loginPathFor } from "@/lib/auth/paths";
import {
  createDraftCookieName,
  FLOW_COOKIE_MAX_AGE,
  flowCookieOptions,
  inviteCookieName,
  partyCookieName,
} from "@/lib/flow/session";

/** The two reasons this route refuses: the store's own codes, and the one the endpoint raises. */
type CreateRefusalCode = FlowErrorCode | typeof CREATE_NOT_FROM_FLOW;

/**
 * Where a refusal sends the browser: back to the create screen for the template it refused.
 *
 * The code is the only thing in the URL — the page owns the sentence (`?problem=` and nothing
 * else), so a crafted post cannot put words of its own into a page another person opens. A post
 * that named no template has nowhere to go back to and lands on the library instead, which is
 * the screen that lists what can be copied.
 *
 * **Which step it returns to is the draft's own fact (#688, #689, #690).** A post that came through
 * the flow (the draft cookie exists) was sent from **stage 4, Create** — the conversion is the
 * last screen before the create since #690 — so the refusal belongs there, above the review card
 * the person just pressed. A post that never went through the draft is refused as
 * `create-not-from-flow` (#957's server half) and returned to the Who screen, which is the only
 * stage it ever saw — and is where the create it wanted actually starts.
 *
 * **The target is built from the slug (#794).** An empty slug — no template named, or a row this
 * build could not resolve — is the library.
 */
function refusalTarget(
  request: Request,
  templateSlug: string,
  code: CreateRefusalCode,
  fromDraft: boolean,
): URL {
  const slug = templateSlug.trim();
  const back =
    slug === ""
      ? TEMPLATE_LIBRARY_PATH
      : fromDraft
        ? createCommitPath(slug)
        : createRelationshipPath(slug);
  const target = new URL(back, request.url);
  target.searchParams.set("problem", code);
  return target;
}

/**
 * A stage-2 refusal that names one field (#688) — `?problem=<reason>&field=<field>`.
 *
 * The person is on the Mode screen, so the band is drawn there: `mode` or `setting` for a value
 * the form did not offer, never a store code. `lib/flow/create-copy.ts` turns the pair into the
 * sentence with the field's own label. The address is built from the slug (#794); an unresolvable
 * template falls back to the library rather than a path with an empty segment.
 */
function fieldTarget(request: Request, templateSlug: string, field: string, reason: string): URL {
  const slug = templateSlug.trim();
  const target = new URL(slug === "" ? TEMPLATE_LIBRARY_PATH : createModePath(slug), request.url);
  target.searchParams.set("problem", reason);
  target.searchParams.set("field", field);
  return target;
}

/**
 * A throw the route could not name as a refusal, in the shape the endpoint answers it (#1205).
 *
 * **What went wrong without this.** On 2026-11-18 `POST /assessment/new {draft:"1"}` answered an
 * **empty-body 500** twice on production. The create's one transaction inserts `session.state`
 * (`0041_session_state.sql`) and production's ledger stopped at `0039`, so the INSERT raised a
 * `pg` `DatabaseError` **42703** — which is not a `FlowError`, so this route rethrew it, Next
 * answered an opaque 500, and the person (and the QA walk) got a blank response with no line
 * anywhere naming the SQLSTATE, the column or the migration. Zero rows were written, and the only
 * symptom was "it broke".
 *
 * So every remaining throw is answered **by name**, with the same three facts the log gets:
 *
 *   `code`      always `create-failed` — the marker a log search and a support script key on.
 *   `sqlstate`  the driver's SQLSTATE when it gave one, else `null`. It is checked against the
 *               SQLSTATE alphabet (`^[0-9A-Z]{5}$`) because a Node `code` such as `ECONNREFUSED`
 *               is a different namespace, and reporting it here would send the reader looking for
 *               a Postgres error class that does not exist.
 *   `message`   the throw's own sentence, verbatim — `column "state" of relation "session" does
 *               not exist` is the answer, and paraphrasing it into "something went wrong" is
 *               exactly what the empty body already said.
 *
 * **It is deliberately not a `?problem=` redirect.** That vocabulary is the person's own errors —
 * a Mode they did not pick, a Setting the form never offered (#688, #794) — and a database missing
 * a column must never read as something they can fix by editing the form.
 *
 * **The answer depends on who asked, and that is #1226's split.** A browser form post is sent 303 to
 * `/assessment/new/failed`, a calm screen that says the draft could not be created and offers Try
 * Again and Back to Dashboard (`fromBrowserForm()` below names the one header that tells them
 * apart). A `curl`, a QA walk, a server-to-server caller keeps the named JSON 500 with the body
 * built here: they read a body, and they are how the 2026-11-18 wide-open 500 was diagnosed. Both
 * answers carry the same `console.error` line, and neither is a `?problem=`.
 */
function createFailureOf(error: unknown): {
  code: "create-failed";
  sqlstate: string | null;
  message: string;
} {
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  const sqlstate = typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null;
  const message = error instanceof Error ? error.message : String(error);
  return { code: "create-failed", sqlstate, message };
}

/**
 * Is this post a person pressing the create stage's own button (#1226)?
 *
 * `Accept: text/html` — the header a browser's form submission sends, and the only one that
 * distinguishes a person from the four other callers this endpoint has (`curl` in a runbook, the
 * flow's `scripts/flow-e2e.mjs`, a QA walk reading statuses, a support script). It is read as a
 * **substring** rather than an exact match because Chrome, Safari and Firefox each append their own
 * `q=` values to it, and a parser here would be a second opinion about a header no product code
 * cares about.
 *
 * A missing header reads as **not a browser**: an absent `Accept` is not a claim of anything, and
 * the JSON body is what every tool in this repo posts without one. That is the direction the
 * ambiguity has to resolve, because guessing "browser" for a `curl` would replace the body a
 * support script greps with a redirect it cannot read.
 */
function fromBrowserForm(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

/**
 * `POST /assessment/new` — create a session, then redirect to it (#146).
 *
 * A route handler and not a server action, for two reasons: the flow has to be drivable
 * with a plain HTML form (no client bundle, and `curl` can post it), and the acceptance is
 * proved by two browser sessions doing exactly what a person does.
 *
 * One transaction does the work — copy the Aspects, the Initiator's party row, the
 * invitation — and this route sends nothing: the relationship it writes is a `draft`, and stage 5 is
 * what either sends it or keeps it (#825). So there is no mail failure to report here. The three
 * outcomes `invite=sent|unset|failed` still exist and still mean what they meant (#146, #220) —
 * `unset` is no mailer configured, `failed` is one that refused — but they are now stage 5's fact,
 * reported by `POST /assessment/instances/[id]/send` onto the confirmation screen.
 *
 * **`POST /assessment/new` is stage 4's draft write, and nothing else (#825, #957).** The stages
 * before it collect the relationship; this is the write that saves it, and it saves it as a
 * `draft`. The invitation is **stage 5's** act (`POST /assessment/instances/[id]/send` →
 * `sendDraftInvitation()`), which is where the gate that keeps a send behind a plan and a card is
 * enforced (#911) and where the `invite=sent|unset|failed` outcome is reported.
 *
 * A post that carries no `draft=1` never came through the stages, so it is refused with a named
 * reason and redirected — `?problem=create-not-from-flow` — rather than created. Until #957's
 * server half this endpoint still kept the pre-#688 one-form create for such a post, and that path
 * wrote a relationship **published** and mailed it with no plan and no card on file. The catalogue
 * that could reach it is gone since #957; this is the half a `curl` could still reach.
 *
 * **The creator's account is read from the session, not from the post** (#213 follow-up). The
 * form carries two names, an address, a mode and a setting; it carries no identity, and none is
 * read from it — `currentUserIfConfigured()` resolves the account from the request's own cookies,
 * and that id is what the store writes on the Initiator's party row. It is what makes the session
 * appear in the creator's `/assessment/instances` list, which filters by exactly that column.
 * Signed out (or on a tree with no auth env) the id is `null` and the create behaves as it always
 * did. The Counterparty is deliberately left unbound: they are not the person creating it, and
 * their binding is written by the claim.
 *
 * **A refusal is a redirect, not a JSON body** (#427). The form is HTML, so a person who left the
 * Mode unpicked — or posted a Setting the model does not name — gets the create screen back with
 * the fixture's sentence above it, rather than `{"error":"invalid-input"}` in the browser window.
 * The code travels in `?problem=` and nothing else does: the sentence is resolved by the page from
 * its own fixture, so no text anybody typed can ride into a URL the next render prints.
 */
export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const value = (name: string) => String(form.get(name) ?? "");
  const templateRecordId = value("templateRecordId").trim();
  // #825 — stage 4's form carries `draft=1`, and that flag is now the **only** way through: this
  // endpoint writes a draft and sends nothing, so the fact that the post came from the flow's own
  // stage is what the create is. A post without it is refused below (#957's server half).
  const asDraft = value("draft") === "1";
  const viewer = await currentUserIfConfigured();

  // #688 — the draft stage 1 wrote, when this post came through the two-stage flow. A post that
  // carries a draft cookie but no `draft=1` is refused all the same: the draft is what stage 4
  // saves, and publishing is stage 5's decision, never a form field.
  const jar = await cookies();
  const draft =
    templateRecordId === ""
      ? null
      : parseCreateDraft(jar.get(createDraftCookieName(templateRecordId))?.value);

  // #794 — the screen a refusal names is addressed by the template's **slug**, while the post and
  // the draft cookie carry its **id**. Resolved once, before anything can refuse.
  const templateSlug = await templateSlugOf(templateRecordId);

  // #957's server half — **the bare create is gone.** A post that carries no `draft=1` did not come
  // through the stages, and the create it asked for no longer exists: the invitation goes out from
  // stage 5, behind the plan-and-card gate (#911), so a relationship must not be published here.
  // The refusal is the house shape (#427) — a 303 with a **named reason**, never a JSON body and
  // never a 500 — and it lands on stage 1 of this template, which is where the flow starts.
  if (!asDraft) {
    return NextResponse.redirect(
      refusalTarget(request, templateSlug, CREATE_NOT_FROM_FLOW, draft !== null),
      303,
    );
  }

  // #825 — a draft belongs to an account, so there is nothing to write without one. The stage's
  // page only draws the form for a signed-in reader, so this is the crafted post's answer: the
  // sign-in screen, with this stage as the place to come back to.
  if (viewer === null && templateSlug !== "") {
    return NextResponse.redirect(
      new URL(loginPathFor(createCommitPath(templateSlug)), request.url),
      303,
    );
  }

  // Stage 2's own validation, before the store is asked anything: the Mode and the Setting are
  // the only two fields that step owns, so a refusal names which one is wrong.
  //
  // #689 — since Aspects sits between Mode and the create, the post that arrives here comes from
  // the Aspects stage and carries no radios: the two choices are the **draft's**. The validation
  // did not move, only the place the values are read from, so a draft missing either is still
  // refused with the field named and the Mode screen is still where it is fixed.
  if (draft !== null) {
    const fromDraft = (name: string) =>
      name === "mode" ? draft.mode : name === "alignmentSetting" ? draft.alignmentSetting : "";
    const choice = modeDraft(fromDraft, draft);
    if (!choice.ok) {
      return NextResponse.redirect(
        fieldTarget(request, templateSlug, choice.problem.field, choice.problem.reason),
        303,
      );
    }
  }

  /**
   * Who this relationship is for: stage 1's draft when there is one, the form's own fields
   * otherwise. Read once and used twice — the store writes the seats and the invitation email
   * addresses them — so the two can never disagree about who was named.
   */
  const who =
    draft === null
      ? {
          initiatorName: value("initiatorName"),
          counterpartyName: value("counterpartyName"),
          email: value("email"),
        }
      : {
          initiatorName: initiatorNameOf(draft),
          counterpartyName: counterpartyNameOf(draft),
          email: draft.email,
        };

  let created: CreatedSession;
  try {
    created = await createSessionFromTemplate({
      templateRecordId,
      initiatorName: who.initiatorName,
      counterpartyName: who.counterpartyName,
      email: who.email,
      // #688 — stage 1's card title and description. Absent on a direct post, which keeps the
      // store's template-derived title and its generated summary.
      title: draft?.title ?? value("title"),
      description: draft?.description ?? value("description"),
      // The create form's radios (#213). A post without one is refused by the store —
      // "mode must be basic or advanced" — rather than defaulted to Basic, so a crafted
      // POST cannot choose a mode the form never offered. #689 — when the post came through the
      // flow, the choice is the draft's (validated above), because the Aspects stage carries no
      // radios; a direct post still names them itself.
      mode: draft?.mode ?? value("mode"),
      // #427 — the Setting the same form asks for. The store parses it and writes the choice on
      // the session row; a blank value falls to the schema's documented default (`soft`), so a
      // post that predates the radios still creates what it always created.
      alignmentSetting: draft?.alignmentSetting ?? value("alignmentSetting"),
      // #689 — stage 3's list. Read as the person left it: `createSessionFromTemplate` decides
      // whether it is still the version's copy (ids and order kept, `aspects_authored_at` NULL) or
      // the creator's own list (added, removed or reordered — written as given, with the instant
      // recorded), and V4 is asked the matching question (#699).
      aspects: draft?.aspects,
      // Not `value("userId")`: there is no such field, and the session cannot be posted.
      viewerUserId: viewer?.userId ?? null,
      // #258 — the address the unlock notice will reach this creator at when the Counterparty
      // submits last. Also the session's, never the form's: `email` above is the Counterparty's.
      viewerEmail: viewer?.email ?? null,
      // #825 — stage 4 writes a draft and sends nothing; stage 5 decides.
      draft: asDraft,
    });
  } catch (error) {
    if (error instanceof FlowError) {
      // 303 and a GET, for the same reason the success path is a 303: a reload of the refusal
      // must not re-post the create. The id comes from the post, so a refusal can point back at
      // the template it refused; a post that named no template at all has no screen to return to
      // and goes to the library, which lists what can be copied.
      return NextResponse.redirect(
        refusalTarget(request, templateSlug, error.code, draft !== null),
        303,
      );
    }
    // #1205 — anything else is a deployment that cannot do the write, and it says so. This used to
    // be `throw error`, which Next turned into an empty 500: the transaction rolled back (zero rows,
    // correct) and nobody could read why. The refusals above are the person's errors; this is ours,
    // so it is a named 500 with a body and the same facts in the server log — never a `?problem=`,
    // which would send them back to the form to fix a column that does not exist.
    //
    // #1226 — the person who pressed the button gets a screen instead of a body. The 303 is not a
    // refusal and carries no code: the address names the write that failed (`?template=` at most),
    // the log line keeps the cause, and a reload re-reads the screen rather than re-posting the
    // create. Every other caller keeps the JSON below, unchanged.
    const failure = createFailureOf(error);
    console.error("create-failed", failure.sqlstate, failure.message);
    if (fromBrowserForm(request)) {
      return NextResponse.redirect(new URL(createFailedPath(templateSlug), request.url), 303);
    }
    return NextResponse.json(failure, { status: 500 });
  }

  jar.set(
    partyCookieName(created.sessionRecordId),
    created.initiatorToken,
    flowCookieOptions(FLOW_COOKIE_MAX_AGE),
  );
  // The Initiator's own copy of the invitation, so the screen can show the link while the
  // invite is unclaimed — the whole degraded path when no email key is configured.
  jar.set(
    inviteCookieName(created.sessionRecordId),
    created.inviteToken,
    flowCookieOptions(FLOW_COOKIE_MAX_AGE),
  );

  // #688 — the draft has become a relationship; there is nothing left to resume. Deleted rather
  // than left to expire so a second create from the same template starts blank.
  if (templateRecordId !== "") jar.delete(createDraftCookieName(templateRecordId));

  // #825 — stage 4 stops here. Nothing is sent, the row is a draft, and stage 5 is the screen that
  // asks whether it goes out. That is also why no `?invite=` value is set: the send has not been
  // attempted yet, and the visit that attempts it is stage 5's, on the confirmation screen.
  //
  // 303 so the browser follows with a GET, and a reload of stage 5 cannot create a second
  // relationship.
  const slug = templateSlug.trim();
  return NextResponse.redirect(
    new URL(
      slug === ""
        ? sessionPath(created.sessionRecordId)
        : createInviteForPath(slug, created.sessionRecordId),
      request.url,
    ),
    303,
  );
}
