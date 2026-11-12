// template-ancestor: components/dashboard/assessments-list.tsx   (variation: the same relationship card — a `bg-gray-50` header block carrying the template pill and the state pill, a `text-lg font-semibold` title, a body of chips, and an `h-9` action row — with the two assessment actions on every card, the paid block and the four-metric grid left out because this read does not carry a session count)
//
// #841 part 2 split the *page* from this file. The shell above the cards — the `text-3xl` heading
// with the create action, the toolbar, the six status tabs, the grid/list toggle and the
// per-filter empty state — is `components/dashboard/relationships-list.tsx`, whose ancestor is
// `components/my-quizzes/my-quizzes.tsx`. What lives here is only the record's card, which is why
// this header names `assessments-list.tsx`: that is the card's own ancestor (it was
// `components/assessment-flow/my-instances.tsx` until #877 moved the listing to `/assessments`),
// and rebuilding the *shell* out of its markup is what the card forbids — the shell is not this
// component.

/**
 * `/dashboard/relationships` — one relationship's card (#620, #706, #841).
 *
 * **The list is every relationship the viewer is a party to, and the card says which seat is
 * theirs.** The same component draws the initiator's card and the counterparty's: the title, the
 * status, the Aspects and the invitation state are one read (`MemberRelationshipRow`), and the two
 * differences are derived, never guessed — `viewerRole` prints the seat, `isInitiator` decides
 * whether the write controls exist at all. A Counterparty gets `Open Relationship`, because the
 * screen behind it is read-only for them; drawing `Publish Assessment` there would be an
 * affordance the server answers with `not-yours`.
 *
 * **The card is `assessments-list.tsx`'s card, and the axis of variation is the data.** That card is
 * a projection of `RelationshipCard` (`lib/db/assessments.ts`): sessions, completion, mean Gap,
 * what was paid. This screen reads `MemberRelationshipRow` (`lib/member/relationships.ts`), which
 * carries the stored lifecycle, the invitation's derived view, the membership, the Aspect count —
 * and carries no opinion rows at all. So the header block, the title, the chips and the `h-9`
 * action row are the ancestor's, and the metric grid is simply absent rather than drawn from
 * figures this read never returned.
 *
 * **One primary act on the row; the secondary ones live in the menu (#841 part 2, approved).**
 * The action row keeps the verb that is honest for this row's state — `Publish Assessment` while
 * there is no session, `Complete Relationship` once there is one, `Open Relationship` for the seat
 * that cannot write — plus the secondary `Open Assessment` link once a session exists, which is
 * the one state where it can point anywhere. Everything else moved into the per-row menu:
 * `Open Assessment` again (disabled with its reason when there is no session to open),
 * `View Relationship`, `Copy invitation link`, and `Archive`. Nothing was deleted, and no item
 * claims a capability the product lacks: `Archive` is drawn disabled because no archive or delete
 * path exists (#743), and `Copy invitation link` is drawn disabled with the row's own reason
 * because the link exists only at mint time (#220) — the read behind this card carries the
 * invitation's *state*, never its token.
 *
 * **No words here.** Every label resolves from `data/pages/dashboard-relationships.ts`, which is
 * what holds this file at zero copy literals (E23); the status and invitation words are the same
 * fixtures the table drew them from.
 */
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { formatDate } from "@/content/core";
import { createInviteForPath, instancePath, relationshipPath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { Archive, Copy, Eye, MoreHorizontal } from "lucide-react";
import Link from "next/link";

const CARD =
  "flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900";
const CARD_DRAFT = "border-dashed";
const ACTION =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const ACTION_PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover";
const ACTION_SMALL =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
/** A menu row's reason: the second line of the item, never a hover title. */
const MENU_WHY = "block text-xs text-gray-500 dark:text-gray-400";

/**
 * A chip's word for a **value** — the stored status, the invitation's derived view, the record's
 * own kind. All three are tables in `data/pages/dashboard-relationships.ts` keyed by the value
 * they spell, so the rule has one home: print the value's own word and never the name of the
 * field it came from (#874 — the kind chip asked for a copy item that named the concept, so
 * every relationship's first chip read "Template"). An unknown value reads as itself rather than
 * as a blank chip, which is what makes a new stored state visible instead of invisible.
 */
function wordFor(section: PageCopySection, value: string): string {
  const known = (section.items ?? []).find((item) => item.id === value);
  return known?.label ?? value;
}

/**
 * The kind this list's rows are. A relationship is the two-party pairing; a Template is the
 * product a person copies, and `/templates` is where that noun belongs. The chip reads this
 * through the fixture's `kind` table, never through a literal (#874).
 */
const RECORD_KIND = "relationship";

/** The other party's name, as the row knows it — a `null` falls back to the fixture's word. */
function otherPartyOf(row: MemberRelationshipRow, card: PageCopySection): string {
  return row.viewerRole === "initiator"
    ? (row.counterpartyName ?? itemLabel(card, "not-claimed"))
    : (row.initiatorName ?? itemLabel(card, "the-other"));
}

/**
 * One row's card.
 *
 * `assessmentHref` is the row's session and it is `null` exactly when the relationship has none —
 * the one fact the two `Open Assessment` placements turn on. The row draws it as a link when there
 * is one; the menu draws it disabled, with its reason, when there is not.
 */
function RelationshipCard({ copy, row }: { copy: PageCopy; row: MemberRelationshipRow }) {
  const statusCopy = sectionOf(copy, "status");
  const kindCopy = sectionOf(copy, "kind");
  const viewCopy = sectionOf(copy, "view");
  const card = sectionOf(copy, "card");

  const relationshipHref = relationshipPath(row.id);
  const assessmentHref = row.sessionRecordId === null ? null : instancePath(row.sessionRecordId);
  const assessmentWhy = itemLabel(card, "open-assessment-why");

  /*
   * #912 — **a draft's two CTAs, and the address the pay modal answers.**
   *
   * The modal is stage 5's pay walk, and its own address needs both handles (#794): the
   * relationship's copy in the path, the session in `?instance=`. A draft written by the create
   * flow has both — stage 4 writes the session and a staged invitation, and stage 5 is where they
   * go out. A draft written by this list's own create band has neither (no session, no seats), so
   * there is no invitation to shape and the control says that instead of linking somewhere it
   * would be refused.
   */
  const isDraft = row.status === "draft";
  const payHref =
    row.sessionRecordId === null
      ? null
      : createInviteForPath(row.templateSlug, row.sessionRecordId);
  const payWhy = itemLabel(card, "invite-members-why");

  return (
    <li
      data-relationship-card={row.id}
      data-relationship-status={row.status}
      data-relationship-view={row.view}
      data-relationship-role={row.viewerRole}
      className={row.status === "draft" ? `${CARD} ${CARD_DRAFT}` : CARD}
    >
      <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* #874 — the record's **kind**, printed as a value. This chip used to read the copy
              item that named the concept, so every relationship's first chip said "Template". */}
          <Chip variant="tint" data-relationship-kind={RECORD_KIND}>
            {wordFor(kindCopy, RECORD_KIND)}
          </Chip>
          <span className="flex flex-wrap items-center gap-2">
            <Chip variant="soft">{wordFor(statusCopy, row.status)}</Chip>
            {row.membership.state === "lapsed" ? (
              <Chip variant="soft" data-membership-state="lapsed">
                {wordFor(statusCopy, "read-only")}
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
          href={relationshipHref}
          className="line-clamp-2 text-lg font-semibold text-gray-900 hover:text-action hover:underline dark:text-gray-100"
        >
          {row.relationshipTitle ?? row.title}
        </Link>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {itemLabel(card, "with")} · {otherPartyOf(row, card)}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="neutral">
            {fillLabel(itemLabel(card, "aspects"), { count: String(row.aspectCount) })}
          </Chip>
          <Chip variant="soft" data-invite-view={row.view}>
            {wordFor(viewCopy, row.view)}
          </Chip>
        </div>
        <p className="mt-auto text-xs text-gray-500 dark:text-gray-400">
          {fillLabel(itemLabel(card, "last-session"), { when: formatDate(row.createdAt) })}
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
        <div className="flex flex-wrap gap-2">
          {/* The secondary the row keeps: a link once there is a session, and nothing before it —
              the disabled control is the menu's item, which can carry the reason in words. */}
          {assessmentHref === null ? null : (
            <Link href={assessmentHref} className={ACTION}>
              {itemLabel(card, "open-assessment")}
            </Link>
          )}
          {/*
            #912 — **a draft's two CTAs, front and centre.** Every other row keeps one verb and a
            menu; a draft is where both open decisions still are (the money, and the counterparty),
            so both are drawn as controls rather than hidden behind the More menu.

            `Invite Members` is the pay modal and nothing else: no card is taken here, and the
            relationship detail no longer opens a capture of its own (`payment-capture-dialog.tsx`
            is deleted). When the draft has no session there is no invitation to shape, so the
            control is drawn inert *with its reason* rather than as a link that would bounce the
            reader back to stage 1.
          */}
          {isDraft && row.isInitiator ? (
            payHref === null ? (
              <span
                className={`${ACTION} cursor-not-allowed text-gray-400 dark:text-gray-500`}
                aria-disabled="true"
                data-invite-blocked={payWhy}
                title={payWhy}
              >
                {itemLabel(card, "invite-members")}
              </span>
            ) : (
              <Link
                href={payHref}
                className={ACTION}
                data-invite-members="true"
                data-pay-modal="true"
              >
                {itemLabel(card, "invite-members")}
              </Link>
            )
          ) : null}
          <Link href={relationshipHref} className={ACTION_PRIMARY}>
            {isDraft && row.isInitiator
              ? itemLabel(card, "publish-to-counterparty")
              : row.isInitiator
                ? row.sessionRecordId === null
                  ? itemLabel(card, "publish-assessment")
                  : itemLabel(card, "complete-relationship")
                : itemLabel(card, "open-relationship")}
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-4">
        <Link href={relationshipHref} className={ACTION_SMALL}>
          <Eye className="h-3.5 w-3.5" />
          <span>{itemLabel(card, "view")}</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={assessmentHref === null ? assessmentWhy : undefined}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">{itemLabel(card, "actions")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {assessmentHref === null ? (
              <DropdownMenuItem disabled>
                <Eye className="mr-2 h-4 w-4" />
                <span className="flex flex-col">
                  <span>{itemLabel(card, "open-assessment")}</span>
                  <span className={MENU_WHY}>{assessmentWhy}</span>
                </span>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <Link href={assessmentHref}>
                  <Eye className="mr-2 h-4 w-4" />
                  <span>{itemLabel(card, "open-assessment")}</span>
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={relationshipHref}>
                <Eye className="mr-2 h-4 w-4" />
                <span>{itemLabel(card, "view-relationship")}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Copy className="mr-2 h-4 w-4" />
              <span className="flex flex-col">
                <span>{itemLabel(card, "copy-invite")}</span>
                {/* #220 — nothing to copy before a mint, and nothing stored after one. */}
                <span className={MENU_WHY}>
                  {row.invite === null
                    ? itemLabel(card, "copy-invite-why")
                    : itemLabel(card, "copy-invite-why-sent")}
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Archive className="mr-2 h-4 w-4" />
              <span className="flex flex-col">
                <span>{itemLabel(card, "archive")}</span>
                <span className={MENU_WHY}>{itemLabel(card, "archive-why")}</span>
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

/**
 * The cards — one `<ul>`, grid or a single column, and nothing else.
 *
 * `unreadable` is the page's failure state and it is drawn here rather than in the shell so its
 * sentence and its marker (`data-relationships-unreadable`) keep one home.
 */
export function RelationshipCards({
  copy,
  rows,
  unreadable,
  view = "grid",
}: {
  copy: PageCopy;
  rows: readonly MemberRelationshipRow[];
  unreadable: string | null;
  /** #841 part 2 — the toolbar's toggle. Grid is the default, as the artifact draws it. */
  view?: "grid" | "list";
}) {
  if (unreadable !== null) {
    const unreadableCopy = sectionOf(copy, "unreadable");
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
    <ul
      data-relationships-cards
      className={
        view === "grid" ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-4"
      }
    >
      {rows.map((row) => (
        <RelationshipCard key={row.id} copy={copy} row={row} />
      ))}
    </ul>
  );
}
