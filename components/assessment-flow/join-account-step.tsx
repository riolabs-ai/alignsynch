/**
 * template-ancestor: components/auth/register-view.tsx   (variation: two fields and no password — the name the invitation already carries, prefilled, and the address it was sent to — posting to the join's own carrier instead of creating an account on the spot)
 *
 * **Step 2 — `Join`: the account, in two fields** (#1125, #1115 US-2).
 *
 * The bundle draws `Create Your Account` with a tab strip over a three-field sign-up and a
 * three-field sign-in. The claim underneath does not have two paths to offer: since #1115 task 4 the
 * address **is** the credential — `resolveClaimAccount()` finds the account that address names or
 * creates one from it, and nobody is asked for a password. So this step is the one pane the tabs
 * would have switched between: two fields, one primary action, and the sentence that says why the
 * address matters ("Use the email {initiator} invited, so they know it's you").
 *
 * **What it does when submitted: nothing durable.** It posts to `/invite/[token]/join`, which parks
 * the pair in a 30-minute `httpOnly` cookie and answers `?step=3` (`lib/flow/join-details.ts` says why
 * a cookie and not a query string). No account is created and no seat is bound until the acceptance,
 * so abandoning the flow here leaves the invitation exactly as it was — which is what lets `Accept`
 * be a real step rather than a second click on the same write.
 *
 * **No shadow.** The card is `FormSurface` (border + background contrast), because a form is a page
 * body and not something raised over it — `scripts/brand-classes.mjs` fails a `shadow-*` here.
 *
 * **The name is prefilled and the address is not.** The name is the invitation's own
 * (`session_invite.counterparty_name`) and typing it again is friction; the address is the key the
 * seat binds to, and the page is reachable by whoever holds the link, so echoing the invited address
 * would hand a forwarded mail's reader the one fact the claim checks.
 */
import { FormSurface } from "@/components/ui/form-surface";
import type { PageCopy } from "@/content/pages";
import { isTokenStateRefusal, type ClaimRefusal } from "@/lib/flow/claim";
import { joinDetailsPath, inviteStepPath } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { joinDetailProblemOf } from "@/lib/flow/join-details";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** One field's own shape — the same on both, so the pair reads as one form. */
const FIELD =
  "mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10";
const LABEL = "block text-sm font-medium text-foreground";

export function JoinAccountStep({
  copy,
  preview,
  token,
  problem,
  refusal,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  token: string;
  /** The `?join=` code the carrier came back with, when it would not take the pair. */
  problem?: string | undefined;
  /**
   * The `?claim=` code a refused acceptance came back with — drawn here only when the carrier is
   * gone, because the acceptance is what was refused and step 2 is now the only screen the reader
   * can act on (`app/(mainlayout)/invite/[token]/page.tsx`).
   */
  refusal?: ClaimRefusal | undefined;
}) {
  const account = sectionOf(copy, "account");
  const steps = sectionOf(copy, "steps");
  const refusals = sectionOf(copy, "refusals");
  const values = { initiator: preview.initiatorName ?? "" };
  const problemCode = joinDetailProblemOf(problem);
  const problemLabel =
    problemCode === undefined ? undefined : itemLabel(account, `problem-${problemCode}`);
  const refusalLabel =
    refusal !== undefined && !isTokenStateRefusal(refusal)
      ? itemLabel(refusals, refusal)
      : undefined;

  return (
    <div className="space-y-4">
      <FormSurface data-join-account className="p-5 lg:p-6">
        <h1 className="text-xl font-bold tracking-tight text-primary">{account.heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{fillLabel(account.body ?? "", values)}</p>

        {problemLabel === undefined ? null : (
          <p
            role="alert"
            data-join-problem={problemCode}
            className="mt-4 rounded-md border border-status-line bg-status p-3 text-sm text-foreground"
          >
            {problemLabel}
          </p>
        )}

        {refusalLabel === undefined ? null : (
          <p
            role="alert"
            data-claim-refusal={refusal}
            className="mt-4 rounded-md border border-status-line bg-status p-3 text-sm text-foreground"
          >
            {fillLabel(refusalLabel, values)}
          </p>
        )}

        <form action={joinDetailsPath(token)} method="post" className="mt-4 space-y-4">
          <label className="block space-y-1.5">
            <span className={LABEL}>{itemLabel(account, "name")}</span>
            <input
              id="claim-name"
              name="name"
              type="text"
              required
              autoComplete="name"
              defaultValue={preview.counterpartyName ?? ""}
              className={FIELD}
            />
          </label>
          <label className="block space-y-1.5">
            <span className={LABEL}>{itemLabel(account, "email")}</span>
            <input
              id="claim-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-describedby="claim-email-hint"
              className={FIELD}
            />
            <span id="claim-email-hint" className="block text-xs text-muted-foreground">
              {fillLabel(itemLabel(account, "email-hint"), values)}
            </span>
          </label>
          <button
            type="submit"
            data-primary-action="join"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover lg:h-10"
          >
            {itemLabel(account, "create")}
          </button>
        </form>
      </FormSurface>

      <div className="text-center">
        <a
          href={inviteStepPath(token, 1)}
          className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-primary hover:bg-mist lg:h-9"
        >
          {itemLabel(steps, "back")}
        </a>
      </div>
    </div>
  );
}
