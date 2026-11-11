// template-ancestor: components/assessment-flow/my-instances.tsx   (variation: the same relationship card — a `bg-gray-50` header block carrying the template pill and the state pill, a `text-lg font-semibold` title, a body of chips, and an `h-9` action row — with the two assessment actions on every card, the paid block and the four-metric grid left out because this read does not carry a session count, and two controls that are deliberately disabled until payment and the Gap exist)

/**
 * `/dashboard/relationships` — the member's relationships as cards (#620, #706).
 *
 * **The list is every relationship the viewer is a party to, and the card says which seat is
 * theirs.** The same component draws the initiator's card and the counterparty's: the title, the
 * status, the Aspects and the invitation state are one read (`MemberRelationshipRow`), and the two
 * differences are derived, never guessed — `viewerRole` prints the seat, `isInitiator` decides
 * whether the two write controls and their note exist at all. A Counterparty gets `View
 * Relationship`, because the screen behind it is read-only for them; drawing `Publish Assessment`
 * there would be an affordance the server answers with `not-yours`.
 *
 * **The card is `my-instances.tsx`'s card, and the axis of variation is the data.** That card is
 * a projection of `RelationshipCard` (`lib/db/assessments.ts`): sessions, completion, mean Gap,
 * what was paid. This screen reads `MemberRelationshipRow` (`lib/member/relationships.ts`), which
 * carries the stored lifecycle, the invitation's derived view, the membership, the Aspect count —
 * and carries no opinion rows at all. So the header block, the title, the chips and the `h-9`
 * action row are the ancestor's, and the metric grid is simply absent rather than drawn from
 * figures this read never returned. `template-ancestor:` names the file for the same reason every
 * other card in `components/dashboard/` does.
 *
 * **Three actions, and the initiator's primary depends on whether the session exists (#739).** The
 * owner's decision on #620 shipped the menu with `Activate Relationship` and `Gap Analysis`
 * **visibly disabled** while payment was unreachable; `#739` built the payer's two acts and this
 * card stopped lying about them. A permanently disabled control is a claim about the product, and
 * the card cannot know from this read whether a method is on file or whether both sheets are
 * sealed — so it draws no payment control at all and hands the reader to the screen that can say.
 * What it does say is the true one: an initiator whose relationship has no session yet is
 * publishing, and one that has a session is going to complete and open the Gap — the same link,
 * with the verb that is honest at that state.
 *
 * **Two more refusals are drawn, not hidden.** `Publish Assessment` is a link to the relationship's
 * own screen, which is the only surface that publishes and the only one that can say why a
 * publication was refused; `Open Assessment` is a link to the session once the relationship has
 * one, and disabled — with the reason — on a draft, because there is no session for it to open.
 * A control that led to a 404 would be worse than a control that says what it is waiting for.
 *
 * **No words here.** Every label resolves from `data/pages/dashboard-relationships.ts`, which is
 * what holds this file at zero copy literals (E23); the status and invitation words are the same
 * fixtures the table drew them from.
 */
import type { PageCopy, PageCopySection } from "@/content/pages";
import { Chip } from "@/components/ui/badge";
import { formatDate } from "@/content/core";
import { instancePath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { memberRelationshipPath, type MemberRelationshipRow } from "@/lib/member/relationships";
import { MEMBER_TEMPLATES_PATH } from "@/lib/member/templates";
import Link from "next/link";

const CARD =
  "flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900";
const ACTION =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const ACTION_PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover";
const ACTION_DISABLED =
  "inline-flex h-9 cursor-not-allowed items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm font-medium text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500";

/** The badge's word for a stored status, from the fixture's `status` section. */
function statusLabel(status: PageCopySection, value: string): string {
  const known = (status.items ?? []).find((item) => item.id === value);
  return known?.label ?? value;
}

/** The badge's word for the invitation's derived state. */
function viewLabel(view: PageCopySection, value: string): string {
  const known = (view.items ?? []).find((item) => item.id === value);
  return known?.label ?? value;
}

export function RelationshipCards({
  copy,
  rows,
  unreadable,
}: {
  copy: PageCopy;
  rows: readonly MemberRelationshipRow[];
  unreadable: string | null;
}) {
  const list = sectionOf(copy, "list");
  const statusCopy = sectionOf(copy, "status");
  const viewCopy = sectionOf(copy, "view");
  const card = sectionOf(copy, "card");
  const empty = sectionOf(copy, "empty");
  const unreadableCopy = sectionOf(copy, "unreadable");

  if (unreadable !== null) {
    return (
      <div
        data-relationships-unreadable
        className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
      >
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {unreadableCopy.heading}
        </p>
        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{unreadable}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{list.heading}</h2>
        <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">{sectionBody(list)}</p>
      </div>

      {rows.length === 0 ? (
        <div
          data-relationships-empty
          className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{empty.heading}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(empty)}</p>
          <p className="mt-3 text-sm">
            <Link className="underline underline-offset-4" href={MEMBER_TEMPLATES_PATH}>
              {pageItemOf(copy, "new-template").label}
            </Link>
          </p>
        </div>
      ) : (
        <ul data-relationships-cards className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const assessmentHref =
              row.sessionRecordId === null ? null : instancePath(row.sessionRecordId);
            const publishHref = memberRelationshipPath(row.id);
            const other =
              row.viewerRole === "initiator"
                ? (row.counterpartyName ?? itemLabel(card, "not-claimed"))
                : (row.initiatorName ?? itemLabel(card, "the-other"));
            return (
              <li
                key={row.id}
                data-relationship-card={row.id}
                data-relationship-status={row.status}
                data-relationship-view={row.view}
                data-relationship-role={row.viewerRole}
                className={CARD}
              >
                <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Chip variant="tint">{itemLabel(card, "template")}</Chip>
                    <span className="flex flex-wrap items-center gap-2">
                      <Chip variant="neutral">{statusLabel(statusCopy, row.status)}</Chip>
                      {row.membership.state === "lapsed" ? (
                        <Chip variant="neutral" data-membership-state="lapsed">
                          {statusLabel(statusCopy, "read-only")}
                        </Chip>
                      ) : null}
                      {/* #706 — whose seat this is, from the viewer's own party row. */}
                      <Chip variant="neutral" data-viewer-role={row.viewerRole}>
                        {row.viewerRole === "initiator"
                          ? itemLabel(card, "role-initiator")
                          : itemLabel(card, "role-counterparty")}
                      </Chip>
                    </span>
                  </div>
                  <Link
                    href={publishHref}
                    className="line-clamp-2 text-lg font-semibold text-gray-900 hover:text-action hover:underline dark:text-gray-100"
                  >
                    {row.title}
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {itemLabel(card, "with")} · {other}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip variant="neutral">
                      {fillLabel(itemLabel(card, "aspects"), { count: String(row.aspectCount) })}
                    </Chip>
                    <Chip variant="neutral" data-invite-view={row.view}>
                      {viewLabel(viewCopy, row.view)}
                    </Chip>
                  </div>
                  <p className="mt-auto text-xs text-gray-500 dark:text-gray-400">
                    {fillLabel(itemLabel(card, "last-session"), {
                      when: formatDate(row.createdAt),
                    })}
                  </p>
                </div>

                <div className="mt-auto flex flex-col gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
                  <div className="flex flex-wrap gap-2">
                    {assessmentHref === null ? (
                      <button
                        type="button"
                        disabled
                        title={itemLabel(card, "open-assessment")}
                        className={ACTION_DISABLED}
                      >
                        {itemLabel(card, "open-assessment")}
                      </button>
                    ) : (
                      <Link href={assessmentHref} className={ACTION}>
                        {itemLabel(card, "open-assessment")}
                      </Link>
                    )}
                    <Link href={publishHref} className={ACTION_PRIMARY}>
                      {row.isInitiator
                        ? row.sessionRecordId === null
                          ? itemLabel(card, "publish-assessment")
                          : itemLabel(card, "complete-relationship")
                        : itemLabel(card, "open-relationship")}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
