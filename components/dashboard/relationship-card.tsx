// template-ancestor: components/dashboard/relationship-cards.tsx   (variation: the v2 card — one status chip instead of a stage badge and a price band, a five-mark mini summary bar in place of the row of counts, one action at the foot instead of the artefact's button pair, and no kebab: the card menus are #1134's, not this card's)

/**
 * One relationship, as Start and My Relationships draw it (#1129, bundle 05).
 *
 * **The anatomy is one file because two pages draw it.** Start shows two of these beside its next
 * steps and My Relationships shows every one; a second copy would be the second look the template
 * doctrine exists to prevent. The component holds no words and no paths: `labels` arrives resolved
 * from the route's copy fixture, and `href`/`actionHref` from `lib/flow/paths.ts`, so E23 counts
 * zero literals here and a rename is one fixture edit.
 *
 * **One chip, one action.** The chip is one of the owner's four words — `Stage 6 Live` ·
 * `Waiting on Invite` · `Draft` · `Paused` — decided in `lib/member/start.ts` from the lifecycle
 * value, never by a colour. Fixing status by colour alone is the one thing v2 forbids, so the chip
 * is always a word, and the mark beside it is decoration.
 *
 * **The summary bar appears only with results.** A relationship whose two sheets are not both in
 * has no Gap to draw, and a bar of grey marks would read as "nothing agrees". It draws the dashed
 * sentence instead. A **paused** relationship keeps its bar (nothing is lost when the trial lapses)
 * and relabels it `Aligned · Read-Only`, which is bundle 03's decision and the reason `readOnly` is
 * a separate flag from the state.
 *
 * **The marks are the Align screen's own colours.** `bg-synch-mark`, `bg-small-gap-mark` and
 * `bg-gap-mark` are the v2 tokens (`app/globals.css`), so the five marks under a card and the
 * numbered Aspect cards on the Align screen cannot drift into two palettes.
 */
import { Chip } from "@/components/ui/badge";
import { fillLabel } from "@/lib/page-copy";
import type { RelationshipCardState } from "@/lib/member/start";
import { Check, Equal, Flag } from "lucide-react";
import Link from "next/link";
import { CardMenu, type CardMenuData } from "./card-menu";

/** One Aspect's verdict under its own Setting — the three words the legend counts. */
export type AspectMark = "in-synch" | "small-gap" | "gap";

/** What the card prints, every string resolved by the route. */
export interface RelationshipCardLabels {
  readonly live: string;
  readonly waiting: string;
  readonly draft: string;
  readonly paused: string;
  readonly with: string;
  readonly aligned: string;
  readonly readOnly: string;
  readonly noResults: string;
  readonly next: string;
  readonly open: string;
  readonly legend: { readonly inSynch: string; readonly smallGap: string; readonly gap: string };
}

/** Everything the card draws, as data — no record is read inside the component. */
export interface RelationshipCardView {
  readonly relationshipId: string;
  /** The relationship's own screen. */
  readonly href: string;
  readonly title: string;
  /** The other person's name; `null` before they have joined. */
  readonly partyName: string | null;
  readonly templateTitle: string;
  readonly state: RelationshipCardState;
  readonly nextLine: string;
  /** The one action's words and destination. */
  readonly actionLabel: string;
  readonly actionHref: string;
  /** Its weight: solid for the states whose next move is the viewer's, outline otherwise. */
  readonly actionSolid: boolean;
  /** `null` when there are no results to draw — the dashed sentence takes its place. */
  readonly summary: {
    readonly aligned: number;
    readonly total: number;
    readonly marks: readonly AspectMark[];
  } | null;
  /** The trial lapsed: the bar stays and says so. */
  readonly readOnly: boolean;
}

/** The five cells, per mark — the token pair each one paints. */
const MARK_CELL: Record<AspectMark, string> = {
  "in-synch": "bg-synch-mark text-white",
  "small-gap": "bg-small-gap-mark text-foreground ring-1 ring-inset ring-small-gap",
  gap: "bg-gap-mark text-white",
};

/** The legend's dot — the same three tokens, no ring on the two that need none. */
const MARK_DOT: Record<AspectMark, string> = {
  "in-synch": "bg-synch-mark",
  "small-gap": "bg-small-gap-mark ring-1 ring-inset ring-small-gap",
  gap: "bg-gap-mark",
};

const MARK_ICON = { "in-synch": Check, "small-gap": Equal, gap: Flag } as const;

const OUTLINE_ACTION =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const SOLID_ACTION =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover";

/** Two initials from a display name — the avatar's own rule, with no bytes and no image. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

export function RelationshipCard({
  view,
  labels,
  menu,
}: {
  view: RelationshipCardView;
  labels: RelationshipCardLabels;
  /**
   * The kebab (#1134) — absent on Start, where the card is a preview of two rows and the surface is
   * a landing rather than a place to act. Every word and every writer arrives in this object, so the
   * card stays word-free and a page that mounts no menu draws no control.
   */
  menu?: CardMenuData;
}) {
  const chipWord: Record<RelationshipCardState, string> = {
    live: labels.live,
    waiting: labels.waiting,
    draft: labels.draft,
    paused: labels.paused,
  };

  const legendOf = (mark: AspectMark, count: number) => (
    <span className="inline-flex items-center gap-1">
      <span className={`size-2.5 rounded-full ${MARK_DOT[mark]}`} aria-hidden="true" />
      {fillLabel(
        labels.legend[mark === "in-synch" ? "inSynch" : mark === "small-gap" ? "smallGap" : "gap"],
        { count },
      )}
    </span>
  );

  const summary = view.summary;
  const counts = summary === null ? null : tallyMarks(summary.marks);

  return (
    <article
      className="flex flex-col rounded-lg border border-gray-200 bg-card dark:border-gray-700"
      data-relationship-card={view.relationshipId}
      data-relationship-state={view.state}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-counterparty-tint text-xs font-semibold text-counterparty-ink ring-1 ring-inset ring-counterparty-line"
          aria-hidden="true"
        >
          {initialsOf(view.partyName ?? view.title)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-primary">
            <Link
              href={view.href}
              className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {view.title}
            </Link>
          </h3>
          {view.partyName === null ? null : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {fillLabel(labels.with, { name: view.partyName })}
            </p>
          )}
        </div>
        <Chip variant="neutral" data-relationship-status={view.state}>
          {chipWord[view.state]}
        </Chip>
        {menu === undefined ? null : <CardMenu data={menu} />}
      </div>

      <div className="flex-1 px-4">
        {summary === null || counts === null ? (
          <p className="rounded-md border border-dashed border-gray-300 bg-background px-3 py-3 text-sm text-muted-foreground dark:border-gray-700">
            {labels.noResults}
          </p>
        ) : (
          <div data-relationship-summary={view.state}>
            <p className="text-lg font-bold text-primary">
              {labels.aligned
                .replace("{aligned}", String(summary.aligned))
                .replace("{total}", String(summary.total))}{" "}
              {view.readOnly ? (
                <span className="text-sm font-medium text-muted-foreground">{labels.readOnly}</span>
              ) : null}
            </p>
            <div
              className="mt-1.5 flex gap-1"
              role="img"
              aria-label={[
                labels.legend.inSynch.replace("{count}", String(counts["in-synch"])),
                labels.legend.smallGap.replace("{count}", String(counts["small-gap"])),
                labels.legend.gap.replace("{count}", String(counts.gap)),
              ].join(", ")}
            >
              {summary.marks.map((mark, index) => {
                const Icon = MARK_ICON[mark];
                return (
                  <span
                    // The marks are one cell per Aspect, in the authored order: the index is the
                    // Aspect's position and there is no second key a render could reorder by.
                    key={index}
                    className={`flex h-6 flex-1 items-center justify-center rounded-md ${MARK_CELL[mark]}`}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                  </span>
                );
              })}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {legendOf("in-synch", counts["in-synch"])}
              {legendOf("small-gap", counts["small-gap"])}
              {legendOf("gap", counts.gap)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex min-w-0 items-start gap-1.5 text-sm text-foreground">
          <span data-relationship-next="">{view.nextLine}</span>
        </p>
        <Link
          href={view.actionHref}
          className={view.actionSolid ? SOLID_ACTION : OUTLINE_ACTION}
          aria-label={`${view.actionLabel}: ${view.title}`}
        >
          {view.actionLabel}
        </Link>
      </div>
    </article>
  );
}

/** How many Aspects carry each mark — the legend's counts and the bar's own aria-label. */
export function tallyMarks(marks: readonly AspectMark[]): Record<AspectMark, number> {
  return {
    "in-synch": marks.filter((mark) => mark === "in-synch").length,
    "small-gap": marks.filter((mark) => mark === "small-gap").length,
    gap: marks.filter((mark) => mark === "gap").length,
  };
}
