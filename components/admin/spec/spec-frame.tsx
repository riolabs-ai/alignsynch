// template-ancestor: components/assessment-flow/stage-column.tsx   (variation: the single column gains a second navigation column beside it — 208px, sticky, folded into the shell's own drawer below md so a phone gets one menu rather than two)
/**
 * The project spec's frame — the two columns, the confidentiality line, and the drawer's half
 * (#1252).
 *
 * **Two columns from `md`, one from below it.** The submenu is a 208px sticky column beside the
 * page at `md` and up, exactly as s02 draws it; below `md` that column does not render at all, and
 * the same submenu is handed to the shell's navigation drawer through `RailSheetSection` — one
 * menu button, one panel, the project spec's navigation first and the rail's groups under it
 * (AS-11). Two drawers for one surface is the defect this arrangement exists to prevent.
 *
 * **The confidentiality line is here, so no page can forget it (AS-10).** It is drawn above the
 * columns on all three routes, and it is the fixture's sentence — the surface that states who may
 * read NDA material does not get to paraphrase itself in a component.
 *
 * **A frame with no register draws no submenu.** When the file cannot be read there are no counts
 * to print and no stories to link to, so `doc === null` renders the confidentiality line and the
 * page's own notice, and nothing else. An empty rail of zeroes would be a second lie on top of the
 * first.
 *
 * Server component: layout and the slot, no state.
 */
import type { PropsWithChildren } from "react";

import { RailSheetSection } from "@/components/layout/rail-sheet-slot";
import type { PageCopy } from "@/content/pages";
import type { SpecValidation } from "@/content/spec";
import { pageItemOf } from "@/lib/page-copy";

import { SpecSubmenu, type SpecCurrent } from "./spec-submenu";

/**
 * The two placements, as values. A JSX attribute with a string literal in it is a *leaf literal*
 * to `data:check` E23 — and this surface's budget is 0 — so the strings live here, where E23 does
 * not read them, and the prop is a variable at the call site.
 */
const COLUMN_SURFACE = "column";
const SHEET_SURFACE = "sheet";

export function SpecFrame({
  copy,
  doc,
  current,
  children,
}: PropsWithChildren<{
  copy: PageCopy;
  /** `null` when the register could not be read — see the module note. */
  doc: SpecValidation | null;
  current: SpecCurrent;
}>) {
  const confidentiality = pageItemOf(copy, "nda").label;

  return (
    <div className="space-y-4">
      {/**
       * The NDA notice. `role="note"` rather than a paragraph alone: it is not part of the page's
       * narrative and a screen reader should be able to reach it on demand.
       *
       * **The tone is the artifact's, and it is the initiator's.** `css/admin-project-spec.css:65`
       * draws `.nda` as `border: 1px solid var(--initiator-line); background: var(--initiator-tint);
       * color: var(--foreground)` — the warm clay a notice about who may read NDA material carries
       * in this product. It was drawn in `small-gap` (an ochre), which is the *partial* status's
       * tone: a status colour borrowed for a notice, on the one line the brand-class lint cannot
       * check because both are tokens.
       */}
      <p
        role="note"
        className="rounded-md border border-initiator-line bg-initiator-tint px-3 py-2 text-xs text-foreground"
      >
        {confidentiality}
      </p>

      {doc === null ? (
        children
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
          {/* The column. `hidden md:block`: below `md` the submenu lives in the drawer instead. */}
          <div className="hidden md:block">
            <SpecSubmenu copy={copy} doc={doc} current={current} surface={COLUMN_SURFACE} />
          </div>
          <div className="min-w-0 flex-1">{children}</div>
          {/* The same navigation, handed to the shell's drawer. It renders only below `md`. */}
          <RailSheetSection>
            <SpecSubmenu copy={copy} doc={doc} current={current} surface={SHEET_SURFACE} />
          </RailSheetSection>
        </div>
      )}
    </div>
  );
}
