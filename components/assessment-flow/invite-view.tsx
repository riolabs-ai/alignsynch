/**
 * `/invite/[token]` — the claim page, and the claim is a `POST` (#146, #202).
 *
 * The GET renders this and changes nothing. That is deliberate: the token is single-use,
 * so a page that consumed it on `GET` would be consumed by whatever fetched the link first
 * — a mail client's preview, a scanner, a prefetch — and the person it was addressed to
 * would open a dead invitation. The button posts to `/invite/[token]/claim`, and that
 * handler is the only thing that writes `claimed_at`.
 *
 * `preview.state` is one of four — `claimable`, `claimed`, `expired`, `unknown` — and each
 * has its own band in `data/pages/invite.ts`, so a refusal is a sentence rather than a
 * status code in a tab.
 *
 * Two rules come from #202 and both are drawn, not toasted:
 *
 *   a browser that is **already a party** to this instance is named, told the invitation is
 *   not its to take, and never shown the claim control — the token stays unspent. The old
 *   page offered every visitor the button, so an Initiator who followed their own link
 *   spent it and their session silently began answering as the Counterparty.
 *
 *   a visitor who is **not** a party must confirm, on a checkbox whose value is the
 *   counterparty's name, after a sentence that names them: "You are joining as Rowan, the
 *   Counterparty". The store compares that value, so a post that skips the confirmation is
 *   refused with the token still live — the browser's `required` is a courtesy, not the rule.
 *
 * Literal-free: the words are `data/pages/invite.ts` (E23).
 */
import type { PageCopy } from "@/content/pages";
import { claimConfirmationValue, isTokenStateRefusal, type ClaimRefusal } from "@/lib/flow/claim";
import { claimPath } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

export function InviteView({
  copy,
  preview,
  token,
  refusal,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  token: string;
  /** The `?claim=` code a refused claim redirected with, if this visit carries one. */
  refusal?: ClaimRefusal;
}) {
  const viewerBand = sectionOf(copy, "viewer");
  const claimBand = sectionOf(copy, "claim");
  const refusals = sectionOf(copy, "refusals");
  const claimable = preview.state === "claimable";
  const viewerRole = preview.viewerRole;

  const heading = claimable
    ? viewerRole === null
      ? copy.heading
      : (viewerBand.heading ?? copy.heading)
    : sectionOf(copy, preview.state).heading;

  const values = {
    initiator: preview.initiatorName ?? "",
    counterparty: preview.counterpartyName ?? "",
    template: preview.templateTitle ?? "",
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
    <div className="container mx-auto max-w-xl px-4 py-12">
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

      {claimable && viewerRole === null ? (
        <>
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-200">{sectionBody(claimBand)}</p>
          <form action={claimPath(token)} method="post" className="mt-6">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {fillLabel(itemLabel(claimBand, "join"), values)}
            </p>
            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
              <input
                type="checkbox"
                name="confirm"
                value={claimConfirmationValue(values.counterparty)}
                required
                className="mt-0.5"
              />
              <span>{fillLabel(itemLabel(claimBand, "confirm"), values)}</span>
            </label>
            <button
              type="submit"
              className="mt-4 rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
            >
              {itemLabel(claimBand, "claim")}
            </button>
          </form>
        </>
      ) : claimable ? null : (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-200">
          {fillLabel(sectionBody(sectionOf(copy, preview.state)), values)}
        </p>
      )}
    </div>
  );
}
