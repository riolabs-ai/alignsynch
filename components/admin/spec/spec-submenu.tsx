// template-ancestor: components/layout/nav-menus.tsx   (variation: a second nav column inside the page rather than a rail row — one pinned group that cannot be collapsed, a met/total count on every row, and aria-current decided by the route the page already knows instead of by a pathname hook)
/**
 * The project spec's submenu — the reader's second column (AS-06, #1252).
 *
 * **208px, left-aligned, and four groups in a fixed order.** Overview, then Validation (pinned),
 * then the six stories, then the five around the story. Every row carries its `met/total` count,
 * derived from the register — the same numbers the Validation table draws, so a count on the rail
 * cannot disagree with the count in the section it opens.
 *
 * **Validation is pinned and cannot be collapsed.** There is no `<button>` in this file, no
 * disclosure, no state: `aria-expanded="true"` on the row states the fact the layout draws, and a
 * control that could undo it would be the one thing the spec forbids. `data-pinned` marks the
 * group for the tests and for the tone that says which group is not optional.
 *
 * **`aria-current` comes from the route, not from `usePathname`.** The page knows which depth it
 * is — Overview, Validation, or one story — so the submenu takes that as a prop. A hook here would
 * make the drawer's copy of the submenu a client component for one boolean, and the shell's sheet
 * carries the same markup server-rendered.
 *
 * A server component: no handler, no state, no clock.
 */
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import {
  SPEC_STORY_GROUPS,
  SPEC_STORY_LAST_OF_STORY,
  specRowsOfStory,
  specStoryRows,
  specTotalsOf,
  type SpecValidation,
} from "@/content/spec";
import {
  ADMIN_SPEC_PATH,
  ADMIN_SPEC_VALIDATION_PATH,
  adminSpecGroupPath,
} from "@/lib/admin/spec-paths";
import { fillLabel, pageItemOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/** Which depth the page is at. `story` carries the group's route segment. */
export type SpecCurrent =
  | { readonly kind: "overview" }
  | { readonly kind: "validation" }
  | { readonly kind: "story"; readonly slug: string };

/**
 * One row's own class list, so the rail and the drawer cannot drift.
 *
 * **The label wraps, and the row is allowed to shrink.** `truncate` used to be on the label, and it
 * did two things: it cut a long story label to `08 Coaches and…`, and — because `truncate` is
 * `white-space: nowrap` — it gave the row a *min-content* width equal to its whole text. A grid
 * item's automatic minimum is its min-content size, so the rows refused to shrink below the longest
 * label: measured in Chromium at 768 and at 1280 the 208px column held **246px** rows, and inside
 * the drawer's 234px body the submenu block was **246px** wide, so its tint and its section rules
 * ran past the panel's own border and its counts sat 4px from the edge. `min-w-0` plus a wrapping
 * label is the fix, and it is also the artifact's shape — `css/admin-project-spec.css:54` draws
 * `.srow` with no `nowrap`, so a label too long for the column becomes two lines there. The count
 * keeps `shrink-0`: the number is never the thing that gives way.
 *
 * `leading-5` on both children, with `items-start`, keeps the label and its count on one baseline
 * for the two-line rows this change exists for, and leaves a one-line row exactly where it was.
 *
 * The ring is the shell's own (`components/layout/sidebar.tsx`), so a row is reachable and visible
 * by keyboard the same way a rail row is.
 */
const ROW =
  "flex items-start gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
/**
 * The row's vertical padding, per placement. `py-1.5` is the artifact's 6px (`css:54`, `.srow`);
 * the drawer gets `py-3`, which is 12 + a 20px line + 12 = **44px**, the touch target a panel a
 * thumb operates has to offer. The column is pointed at, so it keeps the artifact's rhythm.
 */
const ROW_PAD_COLUMN = "py-1.5";
const ROW_PAD_SHEET = "py-3";
const ROW_LABEL = "min-w-0 leading-5";
const ROW_COUNT = "ml-auto shrink-0 text-[11px] leading-5 tabular-nums text-muted-foreground";
const ROW_CURRENT = "bg-mist font-semibold shadow-[inset_3px_0_0_hsl(var(--nav-active))]";
const GROUP_LABEL =
  "flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function SpecSubmenu({
  copy,
  doc,
  current,
  surface = "column",
}: {
  copy: PageCopy;
  doc: SpecValidation;
  current: SpecCurrent;
  /**
   * `column` is the 208px sticky column beside the page; `sheet` is the same submenu inside the
   * shell's navigation drawer below `md`, where there is no second column to be sticky about.
   */
  surface?: "column" | "sheet";
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const gauge = specTotalsOf(specStoryRows(doc));
  const isOverview = current.kind === "overview";
  const isValidation = current.kind === "validation";
  /** The drawer's rows are touch targets; the column's keep the artifact's 6px rhythm. */
  const rowPad = surface === "sheet" ? ROW_PAD_SHEET : ROW_PAD_COLUMN;

  const story = (index: number): boolean =>
    current.kind === "story" && current.slug === SPEC_STORY_GROUPS[index].slug;

  const rows = SPEC_STORY_GROUPS.map((group, index) => {
    const totals = specTotalsOf(specRowsOfStory(doc, group.name));
    return (
      <Link
        key={group.slug}
        href={adminSpecGroupPath(group.slug)}
        aria-current={story(index) ? "page" : undefined}
        className={cn(ROW, rowPad, story(index) && ROW_CURRENT)}
        data-spec-story={group.slug}
      >
        <span className={ROW_LABEL}>
          {group.number} {group.name}
        </span>
        <span className={ROW_COUNT}>
          {fillLabel(words("rail-count"), { met: totals.met, total: totals.total })}
        </span>
      </Link>
    );
  });

  const storyRows = rows.slice(0, SPEC_STORY_LAST_OF_STORY);
  const aroundRows = rows.slice(SPEC_STORY_LAST_OF_STORY);

  return (
    <nav
      aria-label={words("rail-heading")}
      className={cn(
        "grid min-w-0 gap-3",
        surface === "column" &&
          "md:sticky md:top-0 md:w-52 md:shrink-0 md:self-start md:border-r md:pr-3",
        surface === "sheet" && "w-full border-b pb-3",
      )}
      data-spec-submenu={surface}
    >
      <div className="min-w-0 space-y-0.5 border-b px-2 pb-2">
        <p className="text-sm font-bold">{words("rail-heading")}</p>
        <p className="text-xs text-muted-foreground">
          {fillLabel(words("rail-subtitle"), { release: doc.release })}
        </p>
      </div>

      <div className="min-w-0">
        <Link
          href={ADMIN_SPEC_PATH}
          aria-current={isOverview ? "page" : undefined}
          className={cn(ROW, rowPad, isOverview && ROW_CURRENT)}
          data-spec-overview=""
        >
          <span className={ROW_LABEL}>{words("rail-overview")}</span>
        </Link>
      </div>

      {/**
       * The pinned group. `aria-expanded` sits on the row's own link — the `link` role supports it,
       * where the wrapping `div` would be an ARIA attribute axe reports as not allowed — and there
       * is no control anywhere in this group that could set it to false.
       */}
      <div
        className="min-w-0 rounded-md bg-synch-tint py-1.5 shadow-[inset_3px_0_0_hsl(var(--synch))]"
        data-pinned="true"
      >
        <p className={GROUP_LABEL}>
          {words("rail-validation")}
          <span className="ml-auto pr-1.5 text-[9.5px] font-bold normal-case text-synch">
            {words("rail-pinned")}
          </span>
        </p>
        <Link
          href={ADMIN_SPEC_VALIDATION_PATH}
          aria-current={isValidation ? "page" : undefined}
          aria-expanded="true"
          className={cn(ROW, rowPad, isValidation && ROW_CURRENT)}
          data-spec-validation=""
        >
          <span className={ROW_LABEL}>{words("rail-validation")}</span>
          <span className={ROW_COUNT}>
            {fillLabel(words("rail-count"), { met: gauge.met, total: gauge.total })}
          </span>
        </Link>
      </div>

      <div className="min-w-0">
        <p className={GROUP_LABEL}>{words("rail-story")}</p>
        {storyRows}
      </div>

      <div className="min-w-0">
        <p className={GROUP_LABEL}>{words("rail-around")}</p>
        {aroundRows}
      </div>
    </nav>
  );
}
