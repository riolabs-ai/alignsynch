/**
 * template-ancestor: components/assessment-flow/invite-view.tsx   (variation: the acceptance itself — both parties, one sentence, one primary action, and an optional suggestion that rides with the claim instead of editing anything)
 *
 * **Step 3 — `Accept`: the one write on this path** (#1125).
 *
 * The step draws both people (`JoinPartyCards`), the sentence that says what accepting *does*
 * (`You join {title} as the Counterparty. When you accept, Stage 6 goes live for both of you and your
 * first Assessment opens.`), and exactly one primary action: `Accept Invitation`. Under it, the
 * bundle's optional `Suggest a Change to the Aspects` — a collapsed `<details>`, an Aspect select, a
 * textarea, and the sentence that keeps it honest: *"Sent to {initiator} with your acceptance. The
 * Aspects stay as they are unless they change them."*
 *
 * **The suggestion is a message, never an edit.** It posts inside the claim's own form, and the claim
 * route hands it to the acceptance notice (`sendJoinNotice`) — the one channel that reaches the
 * Initiator, and the one the bundle's sentence describes ("with your acceptance"). Nothing on this
 * path writes an `item` row: `claimInvite()` has no Aspect write, so a suggestion cannot change what
 * either party will answer.
 *
 * **The two fields come from the carrier, not from this step.** Step 2 posted them to
 * `/invite/[token]/join`, which parked them in a cookie; they arrive here as hidden inputs on the
 * claim's own form, so the acceptance is one POST that carries everything the store's transaction
 * needs (name, address, suggestion). The page sends a reader with no carrier back to step 2 rather
 * than rendering a form the store is certain to refuse.
 *
 * A server component. `<details>` is a browser disclosure — no JavaScript, no client state.
 */
import type { PageCopy } from "@/content/pages";
import { isTokenStateRefusal, type ClaimRefusal } from "@/lib/flow/claim";
import type { JoinDetails } from "@/lib/flow/join-details";
import { claimPath, inviteStepPath } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { JoinPartyCards } from "./join-party-cards";

const FIELD =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10";

export function JoinAcceptStep({
  copy,
  preview,
  token,
  details,
  refusal,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  token: string;
  /** The pair step 2 carried; the claim needs both values in its own posting request. */
  details: JoinDetails;
  /** The `?claim=` code a refused acceptance came back with, when it is not the token's own state. */
  refusal?: ClaimRefusal | undefined;
}) {
  const accept = sectionOf(copy, "accept");
  const steps = sectionOf(copy, "steps");
  const refusals = sectionOf(copy, "refusals");
  const values = {
    initiator: preview.initiatorName ?? "",
    counterparty: preview.counterpartyName ?? "",
    template: preview.templateTitle ?? "",
    title: preview.relationshipTitle ?? preview.templateTitle ?? "",
  };
  const refusalLabel =
    refusal !== undefined && !isTokenStateRefusal(refusal)
      ? itemLabel(refusals, refusal)
      : undefined;

  return (
    <div className="space-y-4">
      <section data-accept-card className="rounded-lg border bg-card">
        <div className="space-y-4 p-5 lg:p-6">
          <h1 className="text-xl font-bold tracking-tight text-primary">{accept.heading}</h1>

          {refusalLabel === undefined ? null : (
            <p
              role="alert"
              data-claim-refusal={refusal}
              className="rounded-md border border-status-line bg-status p-3 text-sm text-foreground"
            >
              {fillLabel(refusalLabel, values)}
            </p>
          )}

          <JoinPartyCards copy={copy} preview={preview} />
          <p className="text-sm text-foreground">{fillLabel(accept.body ?? "", values)}</p>

          <form action={claimPath(token)} method="post" className="space-y-4">
            <input type="hidden" name="name" value={details.name} />
            <input type="hidden" name="email" value={details.email} />
            <button
              type="submit"
              data-primary-action="accept"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover lg:h-10"
            >
              {itemLabel(accept, "accept")}
            </button>

            <details data-suggest className="group rounded-md border bg-background">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-primary">
                <span>{itemLabel(accept, "suggest")}</span>
                <span className="sr-only">{itemLabel(accept, "optional")}</span>
              </summary>
              <div className="space-y-3 border-t p-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {itemLabel(accept, "aspect")}
                  </span>
                  <select name="suggestion-aspect" className={FIELD}>
                    <option value="all">{itemLabel(accept, "aspect-all")}</option>
                    {preview.aspects.map((aspect) => (
                      <option key={aspect.id} value={aspect.id}>
                        {aspect.prompt}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {itemLabel(accept, "suggestion")}
                  </span>
                  <textarea
                    name="suggestion"
                    rows={3}
                    placeholder={itemLabel(accept, "suggestion-placeholder")}
                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  {fillLabel(itemLabel(accept, "suggest-note"), values)}
                </p>
              </div>
            </details>
          </form>
        </div>
      </section>

      <div className="text-center">
        <a
          href={inviteStepPath(token, 2)}
          className="inline-flex h-10 items-center justify-center rounded-md px-3 text-sm font-medium text-primary hover:bg-mist lg:h-9"
        >
          {itemLabel(steps, "back")}
        </a>
      </div>
    </div>
  );
}
