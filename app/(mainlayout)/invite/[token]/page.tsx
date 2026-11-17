import { JoinAcceptStep } from "@/components/assessment-flow/join-accept-step";
import { JoinAccountStep } from "@/components/assessment-flow/join-account-step";
import { JoinInviteStep } from "@/components/assessment-flow/join-invite-step";
import { JoinStepper } from "@/components/assessment-flow/join-stepper";
import { InviteView } from "@/components/assessment-flow/invite-view";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { invitePageCopy } from "@/data/pages/invite";
import { currentUserIfConfigured } from "@/lib/auth/session";
import { claimRefusalOf } from "@/lib/flow/claim";
import { decodeJoinDetails, joinDetailsCookieName } from "@/lib/flow/join-details";
import { instancePath, inviteWizardStepOf, type InviteWizardStep } from "@/lib/flow/paths";
import { partyTokensFrom } from "@/lib/flow/session";
import { previewInvite } from "@/lib/flow/store";
import { hashToken } from "@/lib/flow/tokens";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

/**
 * `/invite/[token]` — the Counterparty's join: **Invite · Join · Accept**, three steps, one primary
 * action each (#146, #202, #1115 task 4, #1125).
 *
 * **The surface is the Counterparty's own, and it is not the Initiator's wizard.** It ports
 * `docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/counterparty-join.html`: a three-dot
 * stepper, and a column that narrows as the steps ask more of the reader. There is no stage rail:
 * `Stage 4 of 5` is the *other* person's map of the relationship, and printing it here told the
 * invitee they were at stage four of a flow they had never seen (bundle 02).
 *
 * | step | surface | the one write |
 * |---|---|---|
 * | 1 `Invite` | who invited them, the goal, both parties, the Aspects, How It Works, `Join {initiator}`, the quiet decline | none — the decline posts to `/decline` |
 * | 2 `Join` | `Create Your Account`: the name (prefilled) and the address, two fields | a 30-minute cookie (`/join`); no account, no seat |
 * | 3 `Accept` | both people, the sentence, `Accept Invitation`, the optional suggestion | `POST /claim` — the one transaction that binds the seat, opens the week and notifies the Initiator |
 *
 * **The GET is inert.** `previewInvite()` reads the invitation's state and this page renders it;
 * claiming is a POST, because a single-use token spent by a GET would be spent by the first mail
 * client that previewed the link.
 *
 * **The step is addressed, not inferred** — `?step=1|2|3`, with the token in the path, so a refresh,
 * a deep link and a refusal's redirect all land on the same screen. Two rules keep it honest:
 *
 *   step 3 without a carrier   sends the reader to step 2. The acceptance posts the two fields, and a
 *                              browser that never typed them (a bookmarked `?step=3`, a cleared cookie
 *                              jar) has nothing to post — a claim form that rendered here would be a
 *                              control the store is certain to refuse.
 *   a `?claim=` refusal        renders step 3 when the carrier is there, because that is where the
 *                              refusal came from, and step 2 (with the same band) when it is not.
 *
 * A browser that may not claim the invitation never reaches the steps at all; `InviteView` draws the
 * band that matches the fact:
 *
 *   a party already       `viewerRole` is the standing band (the Initiator following their own link is
 *                         the defect #202 fixed), and the token stays unspent
 *   a spent/dead token    `claimed` / `expired` / `revoked` / `declined` / `lapsed` / `unknown` each
 *                         draw their own band, and `?claim=` adds the store's own sentence when the
 *                         refusal was about the request rather than the token
 *
 * **The one redirect this page does.** A browser that already holds this seat — the Counterparty who
 * claimed it here — and follows the link again is sent to the session. Since #1115 the claim endpoint
 * *resumes* such a seat from a new browser (the address is the proof), so the redirect and the resume
 * are two answers to the same situation: a returning person is not shown "this was used already"
 * about a seat that is theirs.
 *
 * A token that is not even the right shape never reaches the database: `previewInvite()` returns
 * `unknown` for it, which is the same band a real-but-unknown token gets.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitation",
};

/** The column each step is laid out in — the bundle's three widths, and nothing else varies. */
const COLUMN: Record<InviteWizardStep, string> = {
  1: "mx-auto max-w-3xl space-y-6",
  2: "mx-auto max-w-md space-y-4",
  3: "mx-auto max-w-xl space-y-4",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ step?: string | string[]; claim?: string; join?: string }>;
}) {
  const { token } = await params;
  const { step: rawStep, claim, join: joinProblem } = await searchParams;
  const jar = await cookies();
  const viewer = await currentUserIfConfigured();

  const preview = await previewInvite(token, {
    viewerTokens: partyTokensFrom(jar),
    viewerUserId: viewer?.userId ?? null,
  });

  if (
    preview.state === "claimed" &&
    preview.viewerRole === "counterparty" &&
    preview.instanceRecordId !== null
  ) {
    redirect(instancePath(preview.instanceRecordId));
  }

  const refusal = claimRefusalOf(claim);

  // The join is the surface for the person the invitation is for: a live token and a browser that is
  // not already one of its parties. Everything else is a band on `InviteView`.
  if (preview.state === "claimable" && preview.viewerRole === null) {
    const details = decodeJoinDetails(jar.get(joinDetailsCookieName(hashToken(token)))?.value);
    const requested = refusal === undefined ? inviteWizardStepOf(rawStep) : 3;
    // No carrier and asked for the acceptance: step 2 is where the pair is typed. The stepper says
    // `2`, because that is where the reader is — not where the address bar pointed them.
    const step: InviteWizardStep = requested === 3 && details === null ? 2 : requested;
    return (
      <div className="mx-auto w-full max-w-content px-4 py-5 lg:px-6">
        <div className={COLUMN[step]}>
          <JoinStepper copy={invitePageCopy} step={step} />
          {step === 1 ? (
            <JoinInviteStep copy={invitePageCopy} preview={preview} token={token} />
          ) : step === 2 ? (
            <JoinAccountStep
              copy={invitePageCopy}
              preview={preview}
              token={token}
              problem={joinProblem}
              {...(refusal === undefined ? {} : { refusal })}
            />
          ) : details === null ? null : (
            <JoinAcceptStep
              copy={invitePageCopy}
              preview={preview}
              token={token}
              details={details}
              {...(refusal === undefined ? {} : { refusal })}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <StageColumn>
      <InviteView
        copy={invitePageCopy}
        preview={preview}
        {...(refusal === undefined ? {} : { refusal })}
      />
    </StageColumn>
  );
}
