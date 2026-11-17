/**
 * template-ancestor: components/assessment-flow/invite-view.tsx   (variation: the *live* invitation's own band set — a hero card with the goal, both parties and the Aspects, then How It Works, then exactly one primary action that moves the reader to step 2 instead of claiming anything)
 *
 * **Step 1 — `Invite`: what this is, from the person who sent it** (#1125).
 *
 * The whole step is one answer to "should I?" — who invited them (`{initiator} invited you to align
 * on {title}`), what the goal is, who the two people are, what they will be asked (`The {n} Aspects`,
 * read-only and marked `Preview`), and how it works in plain words (the Mode and the Alignment
 * Tolerance, each with the sentence that says what it means rather than its name alone).
 *
 * **Nothing here is a price.** The bundle draws two reassurance tiles under the modes and the second
 * of them is the one the whole funnel exists for: `You're never charged. {initiator} covers this
 * relationship.` — the Counterparty joins a pair that is already paid for and never buys anything
 * (spec US-2). No plan, no trial, no card, no extension is printed on any step of this path, and
 * `tests/counterparty-no-leak.test.ts` fails the build if one comes back.
 *
 * **One primary action, and it claims nothing.** `Join {initiator}` is a link to `?step=2` — the
 * account — because a step that claimed on a click would spend a single-use token before the reader
 * had seen the acceptance. The quiet control under it ("Not for you? Decline the invitation") is a
 * form POST to `/invite/[token]/decline` and not a link, so a mail client that prefetches it cannot
 * end somebody's invitation (#1125).
 *
 * A server component: two links and a form post, no state, no JavaScript of its own.
 */
import type { PageCopy } from "@/content/pages";
import { inviteStepPath } from "@/lib/flow/paths";
import { declinePath } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { JoinPartyCards } from "./join-party-cards";

/** The card's own look — one border, one radius, no shadow beyond the raised container's own. */
const CARD = "rounded-lg border bg-card";
/** A row's heading with its icon chip, as the bundle draws "The 5 Aspects" and "How It Works". */
const ROW = "flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between";
/**
 * A row's icon tile — the 36px square the bundle draws beside "The 5 Aspects" and "How It Works".
 *
 * **Not a chip, and deliberately not named like one** (#795): this wraps an icon and holds no text,
 * so it is neither the label primitive (`components/ui/badge.tsx::Chip`) nor a second copy of it. The
 * name keeps the tree-wide CHIP constant scan honest instead of teaching it an exception.
 */
const ICON_TILE =
  "flex size-9 shrink-0 items-center justify-center rounded-md bg-mist text-primary lg:size-8";

export function JoinInviteStep({
  copy,
  preview,
  token,
}: {
  copy: PageCopy;
  preview: InvitePreview;
  token: string;
}) {
  const invitation = sectionOf(copy, "invitation");
  const aspectCount = preview.aspects.length;
  const title = preview.relationshipTitle ?? preview.templateTitle ?? "";
  const values = {
    initiator: preview.initiatorName ?? "",
    template: preview.templateTitle ?? "",
    title,
    count: aspectCount,
  };
  const modeLabel =
    preview.mode === "advanced"
      ? itemLabel(invitation, "mode-advanced")
      : itemLabel(invitation, "mode-basic");
  const settingLabel =
    preview.setting === "full"
      ? itemLabel(invitation, "setting-full")
      : itemLabel(invitation, "setting-soft");

  return (
    <div className="space-y-4">
      <section data-invite-card className={`${CARD} overflow-hidden`}>
        <div className="flex h-1" aria-hidden="true">
          <span className="flex-1 bg-action" />
          <span className="w-1/4 bg-deep/60" />
          <span className="w-1/6 bg-accent/50" />
        </div>
        <div className="space-y-4 p-5 lg:p-6">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep">
            {itemLabel(invitation, "eyebrow")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            {fillLabel(invitation.heading ?? "", values)}
          </h1>
          <p className="text-base text-foreground">
            {fillLabel(itemLabel(invitation, "how"), values)}
          </p>
          {preview.templateSummary === null ? null : (
            <figure className="rounded-md border-l-4 border-initiator bg-initiator-tint px-3 py-2.5">
              <blockquote className="text-sm leading-6 text-foreground">
                {preview.templateSummary}
              </blockquote>
              <figcaption className="mt-1 text-xs font-semibold text-initiator-ink">
                {fillLabel(itemLabel(invitation, "goal-caption"), values)}
              </figcaption>
            </figure>
          )}
          <JoinPartyCards copy={copy} preview={preview} />
        </div>
      </section>

      <section data-invite-aspects className={CARD}>
        <div className={ROW}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={ICON_TILE} aria-hidden="true" />
            <h2 className="text-base font-semibold leading-tight tracking-tight text-primary">
              {fillLabel(itemLabel(invitation, "aspects-heading"), values)}
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-semibold text-foreground">
            {itemLabel(invitation, "aspects-badge")}
          </span>
        </div>
        <ol className="divide-y border-t px-4">
          {preview.aspects.map((aspect, index) => (
            <li key={aspect.id} className="flex gap-3 py-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-mist text-xs font-semibold text-primary">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{aspect.prompt}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section data-invite-how className={CARD}>
        <div className={ROW}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={ICON_TILE} aria-hidden="true" />
            <h2 className="text-base font-semibold leading-tight tracking-tight text-primary">
              {itemLabel(invitation, "how-heading")}
            </h2>
          </div>
        </div>
        <dl className="divide-y border-t px-4">
          <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-foreground">{itemLabel(invitation, "mode")}</dt>
            <dd className="text-sm text-foreground sm:col-span-2">{modeLabel}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-foreground">
              {itemLabel(invitation, "setting")}
            </dt>
            <dd className="text-sm text-foreground sm:col-span-2">{settingLabel}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-md border border-billing-line bg-billing p-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{itemLabel(invitation, "coverage-strong")}</span>{" "}
            {fillLabel(itemLabel(invitation, "coverage"), values)}
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-md border border-status-line bg-status p-3">
          <p className="text-sm text-foreground">
            <span className="font-semibold">{itemLabel(invitation, "privacy-strong")}</span>{" "}
            {itemLabel(invitation, "privacy")}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 pt-2">
        <a
          data-primary-action="join"
          href={inviteStepPath(token, 2)}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover sm:w-auto sm:px-10 lg:h-10"
        >
          {fillLabel(itemLabel(invitation, "join"), values)}
        </a>
        <form action={declinePath(token)} method="post">
          <button
            type="submit"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {itemLabel(invitation, "decline")}
          </button>
        </form>
      </div>
    </div>
  );
}
