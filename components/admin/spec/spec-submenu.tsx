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
 *
 * **The last row leaves the app** (`Docs`, #1252 follow-up). Everything above it is a route of
 * this surface; the docs preview is a *different origin* — the v2 draft pages, which live outside
 * this repository and are not copied into it. So the row is `LeavingLink`
 * (`components/layout/leaving-link.tsx`), the one control that owns `target="_blank"` +
 * `rel="noopener noreferrer"` + the external marker and the "opens in a new tab" name, and its
 * destination is `ADMIN_SPEC_DOCS_URL` from the surface's own fixture rather than a literal here.
 * It sits after the around-the-story group so the register's order is untouched, and its label
 * says the pages are drafts, because they are. It carries no `aria-current`: no path in this app
 * is that page.
 */
import Link from "next/link";

import { LeavingLink } from "@/components/layout/leaving-link";
import type { PageCopy } from "@/content/pages";
import {
  SPEC_STORY_GROUPS,
  SPEC_STORY_LAST_OF_STORY,
  specRowsOfStory,
  specStoryRows,
  specTotalsOf,
  type SpecValidation,
} from "@/content/spec";
import { ADMIN_SPEC_DOCS_URL } from "@/data/pages/admin-spec";
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

/** One row's own class list, so the rail and the drawer cannot drift. */
const ROW =
  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted";
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

  const story = (index: number): boolean =>
    current.kind === "story" && current.slug === SPEC_STORY_GROUPS[index].slug;

  const rows = SPEC_STORY_GROUPS.map((group, index) => {
    const totals = specTotalsOf(specRowsOfStory(doc, group.name));
    return (
      <Link
        key={group.slug}
        href={adminSpecGroupPath(group.slug)}
        aria-current={story(index) ? "page" : undefined}
        className={cn(ROW, story(index) && ROW_CURRENT)}
        data-spec-story={group.slug}
      >
        <span className="truncate">
          {group.number} {group.name}
        </span>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
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
        "grid gap-3",
        surface === "column" &&
          "md:sticky md:top-0 md:w-52 md:shrink-0 md:self-start md:border-r md:pr-3",
        surface === "sheet" && "w-full border-b pb-3",
      )}
      data-spec-submenu={surface}
    >
      <div className="space-y-0.5 border-b px-2 pb-2">
        <p className="text-sm font-bold">{words("rail-heading")}</p>
        <p className="text-xs text-muted-foreground">
          {fillLabel(words("rail-subtitle"), { release: doc.release })}
        </p>
      </div>

      <div>
        <Link
          href={ADMIN_SPEC_PATH}
          aria-current={isOverview ? "page" : undefined}
          className={cn(ROW, isOverview && ROW_CURRENT)}
          data-spec-overview=""
        >
          <span>{words("rail-overview")}</span>
        </Link>
      </div>

      {/**
       * The pinned group. `aria-expanded` sits on the row's own link — the `link` role supports it,
       * where the wrapping `div` would be an ARIA attribute axe reports as not allowed — and there
       * is no control anywhere in this group that could set it to false.
       */}
      <div
        className="rounded-md bg-synch-tint py-1.5 shadow-[inset_3px_0_0_hsl(var(--synch))]"
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
          className={cn(ROW, isValidation && ROW_CURRENT)}
          data-spec-validation=""
        >
          <span>{words("rail-validation")}</span>
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {fillLabel(words("rail-count"), { met: gauge.met, total: gauge.total })}
          </span>
        </Link>
      </div>

      <div>
        <p className={GROUP_LABEL}>{words("rail-story")}</p>
        {storyRows}
      </div>

      <div>
        <p className={GROUP_LABEL}>{words("rail-around")}</p>
        {aroundRows}
      </div>

      {/**
       * The departing row. It is not a route of this surface, so it sits outside every group —
       * separated by the rule above it — and it is the last thing in the navigation. `LeavingLink`
       * draws the new tab and the marker; `words("rail-docs")` is the fixture's label, which says
       * the pages it opens are drafts.
       */}
      <div className="border-t pt-3">
        <LeavingLink href={ADMIN_SPEC_DOCS_URL} label={words("rail-docs")} className={ROW} />
      </div>
    </nav>
  );
}
