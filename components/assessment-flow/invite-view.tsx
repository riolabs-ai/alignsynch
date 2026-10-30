/**
 * `/invite/[token]` — the claim page, and the claim is a `POST` (#146).
 *
 * The GET renders this and changes nothing. That is deliberate: the token is single-use,
 * so a page that consumed it on `GET` would be consumed by whatever fetched the link first
 * — a mail client's preview, a scanner, a prefetch — and the person it was addressed to
 * would open a dead invitation. The button posts to `/invite/[token]/claim`, and that
 * handler is the only thing that writes `claimed_at`.
 *
 * `state` comes from `previewInvite()` and is one of four: `claimable`, `claimed`,
 * `expired`, `unknown`. Each has its own band in `data/pages/invite.ts`, so a refusal is a
 * sentence rather than a status code in a tab.
 *
 * Literal-free: the words are `data/pages/invite.ts` (E23).
 */
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { claimPath } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";

export function InviteView({
  copy,
  preview,
  token,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  token: string;
}) {
  const heading =
    preview.state === "claimable" ? copy.heading : sectionOf(copy, preview.state).heading;
  const values = {
    initiator: preview.initiatorName ?? "",
    counterparty: preview.counterpartyName ?? "",
    template: preview.templateTitle ?? "",
  };

  return (
    <div className="container mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{heading}</h1>

      {copy.subtitle === undefined || preview.state !== "claimable" ? null : (
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {fillLabel(copy.subtitle, values)}
        </p>
      )}

      {preview.state === "claimable" ? (
        <>
          <p className="mt-4 text-sm text-gray-700 dark:text-gray-200">
            {sectionBody(sectionOf(copy, "claim"))}
          </p>
          <form action={claimPath(token)} method="post" className="mt-6">
            <button
              type="submit"
              className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
            >
              {itemLabel(sectionOf(copy, "claim"), "claim")}
            </button>
          </form>
        </>
      ) : (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-200">
          {fillLabel(sectionBody(sectionOf(copy, preview.state)), values)}
        </p>
      )}
    </div>
  );
}
