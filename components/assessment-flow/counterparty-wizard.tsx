/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: the numbered steps become the Counterparty's three onboarding screens — what this is, what happens next, and the account gate — with a step rail that says where they are and a back/next bar instead of the editor's tabs)
 *
 * The Counterparty's onboarding wizard (#t_0aa81144) — the three screens between the invitation
 * link and the session.
 *
 * Before this, `POST /invite/[token]/claim` answered with the instance screen: a stranger who
 * accepted an invitation was dropped into a questionnaire with no sentence saying who invited
 * them, what would happen, or whether anything was owed. The claim is still the one write that
 * binds the seat; what changed is that the *journey* starts here and the claim is the last hop,
 * taken from step 3 after an account exists.
 *
 * Three rules, and each is a thing this component must not do:
 *
 *   the token never leaves the path   every step href comes from `inviteStepPath(token, step)`,
 *                                     and the sign-in `next` is that same href encoded, so the
 *                                     invitation survives the auth round-trip exactly once
 *   the words are the fixture's       `data/pages/invite.ts` sections `steps` / `step-1` /
 *                                     `step-2` / `step-3`, read through `lib/page-copy.ts`; E23
 *                                     counts a literal written here as a red build
 *   no clock, no money for the reader `{initiator}` and `{template}` come from the record, and
 *                                     the one sentence about payment says who pays — never that
 *                                     the Counterparty does
 *
 * **It runs in the flow's one modal, on the flow's one rail** (#710). The invitation link is the
 * Counterparty's half of the same journey the Initiator started, so it gets the same presentation:
 * `StageShell` frames it (a fullscreen dialog at ≥1024, a full-height sheet at 390, close onto an
 * address) and `StageRail` draws the five stages above it. Nothing here is a second flow — the
 * three onboarding screens are this stage's body, and their action set is props.
 *
 * **`current` is Account — stage 4 — and that is where the spec says this path enters** (#825).
 * `docs/specs/flow-stages.md` → *The invitation is the response path, and it enters at Account*:
 * the counterparty is the person the account is for, so the stage that asks for one is the stage
 * they land on, and the stages above it are not available to them because the other person created
 * the relationship and filled them in.
 *
 * **The three onboarding screens stay addressed, and the five-stage rail replaces their own.** The
 * step is `?step=1|2|3` with the token in the path (`inviteStepPath`), so a refresh, a deep link
 * and the sign-in round trip all land on the same screen. Their numbered progress band is gone on
 * purpose: the flow has **one** progress pattern (the cell rail, #716), and a screen that drew a
 * second one above it would say `Stage 4 of 5` and `Step 2 of 3` at the same time.
 *
 * A server component: the only interaction is a link or a form post, so nothing here needs
 * `"use client"` and the wizard ships no JavaScript of its own.
 */
import type { PageCopy } from "@/content/pages";
import { claimConfirmationValue, isTokenStateRefusal, type ClaimRefusal } from "@/lib/flow/claim";
import {
  OVERVIEW_PATH,
  claimPath,
  inviteAuthPath,
  inviteStepPath,
  type InviteWizardStep,
} from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";
import { StageColumn } from "./stage-column";
import { StageRail } from "./stage-rail";
import { StageShell } from "./stage-shell";

/**
 * The stage this screen is — **Account**, the fourth of the five (`data/pages/lifecycle.ts`).
 *
 * The invitation has gone out and the Counterparty is the person being asked to join it: the one
 * thing this path needs from them is the account the seat binds to. Under v9 that is stage 4 —
 * numbered, inside the same sheet, with the same rail — so the band says `Stage 4 of 5` rather
 * than the unnumbered gate the old post-commit screen drew. A number, not a word: `StageRail`
 * compares `current` against the fixture's item ids.
 */
const RESPONSE_STAGE = 4;

export function CounterpartyWizard({
  copy,
  preview,
  token,
  step,
  /** The signed-in account's display name, or `null` when step 3 has to ask for one. */
  viewerName,
  /** The `?claim=` code a refused claim came back with, when it is not the token's own state. */
  refusal,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  token: string;
  step: InviteWizardStep;
  viewerName: string | null;
  refusal?: ClaimRefusal;
}) {
  const rail = sectionOf(copy, "steps");
  const stages = sectionOf(copy, "stages");
  const first = sectionOf(copy, "step-1");
  const second = sectionOf(copy, "step-2");
  const third = sectionOf(copy, "step-3");
  const refusals = sectionOf(copy, "refusals");

  const band = step === 1 ? first : step === 2 ? second : third;
  const values = {
    initiator: preview.initiatorName ?? "",
    counterparty: preview.counterpartyName ?? "",
    template: preview.templateTitle ?? "",
    name: viewerName ?? "",
    step,
  };

  const refusalLabel =
    refusal !== undefined && !isTokenStateRefusal(refusal)
      ? itemLabel(refusals, refusal)
      : undefined;

  return (
    <StageShell
      title={band.heading}
      closeLabel={itemLabel(stages, "close")}
      closeHref={OVERVIEW_PATH}
    >
      <StageColumn>
        <StageRail copy={copy} current={RESPONSE_STAGE} />
        <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">{band.heading}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{sectionBody(band)}</p>

        {refusalLabel === undefined ? null : (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {fillLabel(refusalLabel, values)}
          </p>
        )}

        <ul className="mt-6 space-y-3 text-sm text-gray-700 dark:text-gray-200">
          {step === 1 ? (
            <>
              <li className="font-medium text-gray-900 dark:text-gray-100">
                {fillLabel(itemLabel(first, "invited-by"), values)}
              </li>
              <li>{fillLabel(itemLabel(first, "they-see"), values)}</li>
              <li>{fillLabel(itemLabel(first, "you-see"), values)}</li>
            </>
          ) : null}
          {step === 2 ? (
            <>
              <li>{fillLabel(itemLabel(second, "you-answer"), values)}</li>
              <li>{fillLabel(itemLabel(second, "they-answer"), values)}</li>
              <li>{fillLabel(itemLabel(second, "report"), values)}</li>
              <li className="font-medium text-gray-900 dark:text-gray-100">
                {fillLabel(itemLabel(second, "editable"), values)}
              </li>
            </>
          ) : null}
          {step === 3 ? (
            <>
              {viewerName === null ? null : (
                <li className="font-medium text-gray-900 dark:text-gray-100">
                  {fillLabel(itemLabel(third, "signed-in"), values)}
                </li>
              )}
              <li>{fillLabel(itemLabel(third, "free"), values)}</li>
            </>
          ) : null}
        </ul>

        {step !== 3 || viewerName !== null ? null : (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={inviteAuthPath("login", token, 3, preview.initiatorName ?? "")}
              className="inline-flex items-center justify-center rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover"
            >
              {fillLabel(itemLabel(third, "sign-in"), values)}
            </Link>
            <Link
              href={inviteAuthPath("register", token, 3, preview.initiatorName ?? "")}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              {itemLabel(third, "register")}
            </Link>
          </div>
        )}

        {step === 3 && viewerName !== null ? (
          <form action={claimPath(token)} method="post" className="mt-8">
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                name="confirm"
                value={claimConfirmationValue(values.counterparty)}
                required
                className="mt-0.5"
              />
              <span>{fillLabel(itemLabel(third, "confirm"), values)}</span>
            </label>
            <button
              type="submit"
              className="mt-4 rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover"
            >
              {itemLabel(third, "accept")}
            </button>
          </form>
        ) : null}

        <div className="mt-10 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          {step === 1 ? (
            <span />
          ) : (
            <Link
              href={inviteStepPath(token, step === 3 ? 2 : 1)}
              className="text-sm font-medium text-gray-700 underline dark:text-gray-200"
            >
              {itemLabel(rail, "back")}
            </Link>
          )}
          {step === 3 ? (
            <span />
          ) : (
            <Link
              href={inviteStepPath(token, step === 1 ? 2 : 3)}
              className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover"
            >
              {itemLabel(rail, "next")}
            </Link>
          )}
        </div>
      </StageColumn>
    </StageShell>
  );
}
