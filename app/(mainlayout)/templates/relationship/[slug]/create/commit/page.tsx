/**
 * `/templates/relationship/[slug]/create/commit` — the create flow's stage 4, **Account**
 * (#690, #794; re-cut by #825).
 *
 * The stage that asks for an account and then **writes the relationship as a draft**. It reads the
 * draft stages 1–3 wrote — who, the address, the title, the Mode, the Setting and the list — and
 * hands it to `CreateRelationship` as `stage={4}`. The form posts `templateRecordId` and nothing
 * else, because everything else the endpoint needs is already in the cookie, and it carries
 * `draft=1` so `POST /assessment/new` publishes nothing and sends nothing: stage 5 decides that.
 *
 * **The account panel opens on creating the account** (#829). `AccountPanel` mounts both of the
 * app's own auth views embedded and owns which one is showing: a first-time creator, who this
 * stage is for, is signing up, so "Create your account" is the initial state and "Sign in" is one
 * in-place toggle away. Both directions swap without navigating — a link to `/register` used to
 * drop the stage column and the review beside it. The names Stage 1 already collected arrive as
 * the register form's prefill.
 *
 * **The account form is the app's own sign-in** (#824, #825). `LoginView` is the one implementation
 * of sign-in this build has, so the stage mounts it with `layout="embedded"` — no hero panel, no
 * page-level frame, sized for the stage column — instead of drawing a second form with a password
 * field in it. `next` is this same address, which is what makes the round trip work: the draft is a
 * `sameSite: "lax"` cookie (`lib/flow/session.ts`), so it survives a Google or password sign-in and
 * the person lands back on this stage, now signed in, with their answers intact. That is the
 * behaviour the 2026-11-12 decision chose: no "you will lose your changes" warning, because the
 * normal case does not lose them, and the missing-draft case is named when it actually happens.
 *
 * **A signed-in visitor gets the confirmation, not the form.** The page passes the sentence
 * (`account.signed-in-*`) and the review card; the stage draws the foot's advance, which is the
 * button that writes the draft.
 *
 * **`?instance=` is the way back.** Stage 5's `Back` arrives with the relationship id it is about;
 * when this browser's own party cookie proves the id, the stage draws the same review and a
 * confirmation with the advance as a **link** to stage 5 — so going back cannot write a second
 * relationship for one template.
 *
 * **No draft, no stage 4.** A person who deep-links this address without passing through the three
 * stages before it has nothing to review and nothing to commit, so the page sends them back to
 * Details — the same redirect stages 2 and 3 make.
 *
 * `force-dynamic`: the template read is a database read and the draft is a request cookie.
 */
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AccountPanel } from "@/components/assessment-flow/account-panel";
import { registerPageCopy } from "@/data/pages/register";
import { registerCopyFor } from "@/lib/auth-copy";
import { isGoogleOnlySignIn } from "@/app/(auth)/login/provider-hint-actions";
import { startGoogleSignIn } from "@/app/(auth)/login/google-actions";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import type { FlowMount } from "@/components/assessment-flow/relationship-flow-shell";
import { brand, brandIdOf } from "@/data/brand";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { loginPageCopy } from "@/data/pages/login";
import { AUTH_MARK_SRC_BY_BRAND, AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { loginCopyFor } from "@/lib/auth-copy";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { createRefusal } from "@/lib/flow/create-copy";
import { parseCreateDraft } from "@/lib/flow/create-draft";
import {
  createAspectsPath,
  createCommitPath,
  createInviteForPath,
  createRelationshipPath,
  OVERVIEW_PATH,
} from "@/lib/flow/paths";
import { readFlowScreen } from "@/lib/flow/store";
import { createDraftCookieName, partyCookieName } from "@/lib/flow/session";
import { itemLabel, sectionOf } from "@/lib/page-copy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create your account",
};

/* The embedded mode token moved with the mount: `AccountPanel` applies it to whichever view is
 * showing (#829), and it keeps it as a named constant for the same E23 reason. */

type CommitParams = {
  readonly problem?: string | string[];
  readonly field?: string | string[];
  /** The relationship stage 4 already wrote, when stage 5's `Back` is what brought the reader. */
  readonly instance?: string | string[];
  /** `account` draws the sign-in panel for a signed-in viewer too — a review affordance. */
  readonly preview?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function TemplateCreateCommitPage({
  params,
  searchParams,
  mount = "page",
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<CommitParams>;
  /**
   * **Where the shell mounts this stage (#979 B).** A stage's own route says nothing and gets the
   * `page` mounting — the deep link, the refresh, the invitation link. The intercepted route under
   * `dashboard/relationships/@flow/**` passes `dialog`, and the same render is drawn over the page
   * the flow was started from. Nothing else in this file depends on it.
   */
  mount?: FlowMount;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const whoPath = createRelationshipPath(slug);
  const aspectsPath = createAspectsPath(slug);

  const jar = await cookies();
  const viewer = await currentUserIfConfigured();
  // #870 — the read comes first so the refusal can name its door: the template's page is addressed
  // by slug, its editor by `record.id`, and a band without either is the wall this card removes.
  const detail = await readLibraryTemplate(slug, viewer?.userId ?? null);
  const refusal = createRefusal(firstValue(query.problem), firstValue(query.field), {
    slug,
    ...(detail === undefined ? {} : { recordId: detail.template.id }),
  });
  if (detail === undefined && refusal === null) notFound();

  // #794 — the cookie is the record's, the address is the row's slug.
  const draft =
    detail === undefined
      ? null
      : parseCreateDraft(jar.get(createDraftCookieName(detail.template.id))?.value);

  /**
   * The re-entered state: stage 5 sent the reader back with the relationship it is about. The party
   * cookie is the proof — an id alone is not a secret — and a read that finds no seat is treated as
   * no relationship at all, which falls through to the ordinary account stage.
   */
  const createdId = (firstValue(query.instance) ?? "").trim();
  const created =
    createdId === "" || detail === undefined
      ? undefined
      : await readFlowScreen({
          instanceRecordId: createdId,
          token: jar.get(partyCookieName(createdId))?.value,
          viewerUserId: viewer?.userId ?? null,
        });

  // A draft that is gone and no relationship to come back to is a stage with nothing in front of
  // it; Details is where the flow starts and where the answers would have to be given again.
  if (draft === null && created === undefined) redirect(whoPath);

  const section = sectionOf(assessmentCreatePageCopy, "account");
  const brandId = brandIdOf(brand);
  /**
   * `?preview=account` draws the form for a signed-in viewer too. It exists so the stage can be
   * reviewed without logging out; it changes nothing for a guest, and the embed is still the
   * guest's path, which is the rule the flow needs.
   */
  const previewAccount = firstValue(query.preview) === "account";

  /**
   * The account column. Three states, one node:
   *
   *   - a created relationship: the confirmation, because the account was taken one stage ago;
   *   - signed out (or previewing): the account panel, which opens on **Create your account** and
   *     toggles to Sign in in place (#829), both returning to this address;
   *   - signed in: the confirmation, with the sentence naming what happens next.
   */
  const account =
    created !== undefined ? (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {itemLabel(section, "created-body")}
      </p>
    ) : viewer === null || previewAccount ? (
      <AccountPanel
        login={{
          copy: loginCopyFor(loginPageCopy, brandId),
          marks: AUTH_MARKS_BY_BRAND[brandId],
          markSrc: AUTH_MARK_SRC_BY_BRAND[brandId],
          next: createCommitPath(slug),
          googleFailure: false,
          demo: { kind: "off" },
          providerHint: isGoogleOnlySignIn,
          startGoogle: startGoogleSignIn,
        }}
        register={{
          copy: registerCopyFor(registerPageCopy, brandId),
          destination: createCommitPath(slug),
          marks: AUTH_MARKS_BY_BRAND[brandId],
          markSrc: AUTH_MARK_SRC_BY_BRAND[brandId],
          initialFirst: draft?.initiatorFirst ?? "",
          initialLast: draft?.initiatorLast ?? "",
        }}
      />
    ) : (
      <div className="space-y-2">
        <p className="text-sm text-gray-900 dark:text-gray-100">
          {itemLabel(section, "signed-in-heading")}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {itemLabel(section, "signed-in-body")}
        </p>
      </div>
    );

  /**
   * The facts the stage draws. A created relationship has no draft cookie left — the create
   * consumed it — so its review is built from the row the read returned, which is the same six
   * facts as they were written.
   */
  const facts =
    draft ??
    (created === undefined
      ? null
      : {
          initiatorFirst: created.initiatorName,
          initiatorLast: "",
          counterpartyFirst: created.counterpartyName ?? "",
          counterpartyLast: "",
          email: created.invite?.email ?? "",
          title: created.title,
          description: "",
          mode: created.mode,
          alignmentSetting: created.setting,
        });

  if (facts === null) redirect(whoPath);

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      stage={4}
      mount={mount}
      template={
        detail === undefined
          ? null
          : {
              slug: detail.template.slug,
              recordId: detail.template.id,
              title: detail.template.title,
              summary: detail.template.summary,
              aspectCount: detail.aspects.length,
            }
      }
      draft={facts}
      backHref={created === undefined ? aspectsPath : OVERVIEW_PATH}
      problem={refusal?.sentence ?? null}
      problemLink={refusal?.link ?? null}
      account={account}
      // No second write: a browser that comes back here already has the relationship, so the foot
      // offers the way forward and renders no create form at all.
      {...(created === undefined
        ? {}
        : { accountAdvanceHref: createInviteForPath(slug, created.instanceRecordId) })}
    />
  );
}
