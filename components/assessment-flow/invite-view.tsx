/**
 * template-ancestor: none — approved #336
 *
 * `/invite/[token]` — the bands a visitor sees when the invitation is **not** theirs to claim
 * (#146, #202, #t_0aa81144).
 *
 * The live invitation — a claimable token and a browser that is not already a party — no longer
 * renders here: it renders the three-step onboarding wizard
 * (`components/assessment-flow/counterparty-wizard.tsx`), which owns the claim form on its last
 * step. What is left is the other side of that split, and it is all refusal and state:
 *
 *   `preview.state`   one band per `claimed` / `expired` / `revoked` / `lapsed` / `unknown`, each
 *                     its own sentence in `data/pages/invite.ts`, so a dead link reads as news
 *                     rather than a status code in a tab
 *   `viewerRole`      a browser that already answers as a party is named and told the invitation
 *                     is not its to take. The old page offered every visitor the button, so an
 *                     Initiator who followed their own link spent it and their session silently
 *                     began answering as the Counterparty. The token stays unspent.
 *   `?claim=`         the store's own refusal code, drawn when the refusal was about the request
 *                     (`already-a-party`, `already-bound`, `unconfirmed`) rather than the token —
 *                     a token-state code already has the band above it
 *
 * The GET renders this and changes nothing: the token is single-use, and a page that consumed it on
 * `GET` would be consumed by whatever fetched the link first — a mail client's preview, a scanner,
 * a prefetch — leaving the person it was addressed to holding a dead invitation.
 *
 * Literal-free: the words are `data/pages/invite.ts` (E23).
 */
import type { PageCopy } from "@/content/pages";
import { isTokenStateRefusal, type ClaimRefusal } from "@/lib/flow/claim";
import type { InvitePreview } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

export function InviteView({
  copy,
  preview,
  refusal,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  /** The `?claim=` code a refused claim redirected with, if this visit carries one. */
  refusal?: ClaimRefusal;
}) {
  const viewerBand = sectionOf(copy, "viewer");
  const refusals = sectionOf(copy, "refusals");
  const claimable = preview.state === "claimable";
  const viewerRole = preview.viewerRole;

  const heading = claimable
    ? (viewerBand.heading ?? copy.heading)
    : sectionOf(copy, preview.state).heading;

  const values = {
    initiator: preview.initiatorName ?? "",
    counterparty: preview.counterpartyName ?? "",
    template: preview.templateTitle ?? "",
    // #533 phase 3 — the stored instant, printed as-is. The sentence is a fixture line and the
    // date is the row's, so neither a render nor a locale decides when the membership ended.
    endedAt: preview.membership?.endedAt?.toISOString() ?? "",
  };
  const viewerName =
    viewerRole === "initiator" ? values.initiator : viewerRole === null ? "" : values.counterparty;

  // One refusal sentence, from whichever fact explains the refusal this visit is about:
  // the store's own code when a claim just bounced, or — on a plain visit by a browser that
  // is already bound — the same `already-a-party` band, because that is the same news.
  const refusalCode =
    refusal !== undefined && !isTokenStateRefusal(refusal)
      ? refusal
      : claimable && viewerRole !== null
        ? "already-a-party"
        : undefined;
  const refusalLabel = refusalCode === undefined ? undefined : itemLabel(refusals, refusalCode);

  return (
    <div className="py-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{heading}</h1>

      {copy.subtitle === undefined || !claimable ? null : (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {fillLabel(copy.subtitle, values)}
        </p>
      )}

      {viewerRole === null ? null : (
        <p
          data-answering-as={viewerRole}
          className="mt-4 rounded-lg border border-gray-200 bg-white p-3 text-sm font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          {fillLabel(itemLabel(viewerBand, viewerRole), { name: viewerName })}
        </p>
      )}

      {refusalLabel === undefined ? null : (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          {fillLabel(refusalLabel, values)}
        </p>
      )}

      {claimable ? null : (
        <>
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-200">
            {fillLabel(sectionBody(sectionOf(copy, preview.state)), values)}
          </p>
          {/* #533 phase 3 — the lapsed band names the instant, from the row. Only `lapsed` has an
              item here: the other terminal bands say everything in one sentence. */}
          {preview.state === "lapsed" && preview.membership?.endedAt != null ? (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">
              {fillLabel(itemLabel(sectionOf(copy, "lapsed"), "ended"), values)}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
