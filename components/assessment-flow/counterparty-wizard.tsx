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
 * A server component: the only interaction is a link or a form post, so nothing here needs
 * `"use client"` and the wizard ships no JavaScript of its own.
 */
import type { PageCopy } from "@/content/pages";
import { claimConfirmationValue, isTokenStateRefusal, type ClaimRefusal } from "@/lib/flow/claim";
import { claimPath, inviteAuthPath, inviteStepPath, type InviteWizardStep } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

const RAIL: readonly { readonly step: InviteWizardStep; readonly item: string }[] = [
  { step: 1, item: "1" },
  { step: 2, item: "2" },
  { step: 3, item: "3" },
];

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
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <nav aria-label="Onboarding steps">
        <ol className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          {RAIL.map((entry) => {
            const current = entry.step === step;
            const done = entry.step < step;
            return (
              <li
                key={entry.step}
                aria-current={current ? "step" : undefined}
                data-step-state={current ? "current" : done ? "done" : "upcoming"}
                className={
                  current
                    ? "flex items-center gap-2 font-semibold text-action"
                    : done
                      ? "flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200"
                      : "flex items-center gap-2 text-gray-500 dark:text-gray-400"
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    current
                      ? "flex h-6 w-6 items-center justify-center rounded-full bg-action text-xs font-bold text-action-foreground"
                      : done
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-white dark:bg-gray-200 dark:text-gray-900"
                        : "flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-xs font-bold dark:border-gray-600"
                  }
                >
                  {entry.step}
                </span>
                {itemLabel(rail, entry.item)}
              </li>
            );
          })}
        </ol>
      </nav>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {fillLabel(itemLabel(rail, "count"), values)}
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{band.heading}</h1>
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
    </div>
  );
}
