/**
 * template-ancestor: components/auth/register-view.tsx   (variation: two fields and no password — the name the invitation already carries, and the address it was sent to — with the name prefilled, the submit posting to the claim endpoint, and no step rail of its own)
 *
 * The Counterparty's claim — **one screen, two fields, no account to create** (#1115 task 4).
 *
 * What this replaces is worth stating, because the previous surface was three screens and an
 * account gate: `?step=1|2|3` orientation, then sign-in or sign-up, then a checkbox confirming the
 * party. The issue's rule for this side of the flow is *no friction* (US-2: "at most two fields
 * before the counterparty can begin answering"), and three screens plus a password is not that.
 * The invitation link is the credential; the two fields say who is accepting it.
 *
 * **The name is prefilled, so the person types one thing.** `session_invite.counterparty_name` is
 * the name the inviter typed, and `claimConfirmationValue()` hands it straight to the field's
 * value: the submit still says out loud which party is being joined (the anti-replay statement
 * `confirmationMatches()` checks server-side), without asking anybody to retype it.
 *
 * **The address is not prefilled, on purpose.** It is the key the seat binds to, and the page is
 * reachable by whoever holds the link — echoing the address the invitation was sent to would hand
 * a forwarded mail's reader the one fact the claim checks. They type it; the store compares it and
 * refuses `email-mismatch` when it is not the invitation's.
 *
 * **Nothing here is a plan, a price or a payment.** Not by convention: `tests/claim-two-fields.
 * test.ts` reads this module's import graph and the rendered markup, so a billing import or a
 * card field is a red suite rather than a review note. The counterparty never buys anything — the
 * initiator's week covers the pair.
 *
 * It renders inside the flow's one modal (`StageShell`) under the same rail every stage draws, at
 * **Account** — the stage the spec says this path enters (#825), which is unchanged by the two
 * fields: the account still comes before the seat, it is just not a form the counterparty fills.
 *
 * A server component: the only interactions are form posts, so nothing here ships JavaScript.
 */
import type { PageCopy } from "@/content/pages";
import { claimConfirmationValue, isTokenStateRefusal, type ClaimRefusal } from "@/lib/flow/claim";
import { claimPath, OVERVIEW_PATH } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { StageColumn } from "./stage-column";
import { StageRail } from "./stage-rail";
import { StageShell } from "./stage-shell";

/**
 * The stage this screen is — **Account**, the fourth of the five (`data/pages/lifecycle.ts`).
 *
 * The invitation is the response path and it enters here (#825): the seat binds to an account, and
 * this screen is where that account is settled — by the address, not by a password. A number, not
 * a word: `StageRail` compares `current` against the fixture's item ids.
 */
const RESPONSE_STAGE = 4;

/** The two controls' own shape, so the pair reads as one form rather than two stacked fields. */
const FIELD =
  "mt-1 block w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-action focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";
const LABEL = "mt-4 block text-sm font-medium text-gray-800 dark:text-gray-100";

export function ClaimForm({
  copy,
  preview,
  token,
  /** The `?claim=` code a refused claim came back with, when it is not the token's own state. */
  refusal,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  token: string;
  refusal?: ClaimRefusal;
}) {
  const claim = sectionOf(copy, "claim");
  const stages = sectionOf(copy, "stages");
  const refusals = sectionOf(copy, "refusals");

  const values = {
    initiator: preview.initiatorName ?? "",
    counterparty: preview.counterpartyName ?? "",
    template: preview.templateTitle ?? "",
  };

  const refusalLabel =
    refusal !== undefined && !isTokenStateRefusal(refusal)
      ? itemLabel(refusals, refusal)
      : undefined;

  return (
    <StageShell
      title={copy.heading}
      closeLabel={itemLabel(stages, "close")}
      closeHref={OVERVIEW_PATH}
    >
      <StageColumn>
        <StageRail copy={copy} current={RESPONSE_STAGE} />
        <h1 className="mt-6 text-2xl font-bold text-gray-900 dark:text-gray-100">{copy.heading}</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {copy.subtitle === undefined ? null : fillLabel(copy.subtitle, values)}
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{sectionBody(claim)}</p>

        {refusalLabel === undefined ? null : (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {fillLabel(refusalLabel, values)}
          </p>
        )}

        <ul className="mt-6 space-y-3 text-sm text-gray-700 dark:text-gray-200">
          <li className="font-medium text-gray-900 dark:text-gray-100">
            {fillLabel(itemLabel(claim, "join"), values)}
          </li>
          <li>{fillLabel(itemLabel(claim, "free"), values)}</li>
        </ul>

        <form action={claimPath(token)} method="post" className="mt-6 max-w-md">
          <label className={LABEL} htmlFor="claim-name">
            {itemLabel(claim, "name")}
          </label>
          <input
            id="claim-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            defaultValue={claimConfirmationValue(preview.counterpartyName ?? "")}
            className={FIELD}
          />

          <label className={LABEL} htmlFor="claim-email">
            {itemLabel(claim, "email")}
          </label>
          <input
            id="claim-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@example.com"
            className={FIELD}
          />

          <button
            type="submit"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground hover:bg-action-hover"
          >
            {itemLabel(claim, "claim")}
          </button>
        </form>
      </StageColumn>
    </StageShell>
  );
}
