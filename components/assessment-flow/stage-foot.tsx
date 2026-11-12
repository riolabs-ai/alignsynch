// template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the stage foot as its own module, because two components now draw it — the stages that live in the server component and stage 4's client walk)

/**
 * `StageFoot` — one shape on stages 1–4, as the artifact draws it (#760, lifted out of
 * `create-relationship.tsx` by #771 so stage 4's client walk can draw the same foot).
 *
 * Two acts leave the flow and they sit left as one pair; the act that advances it sits flush
 * right. The pairing is structural, so it survives every width: below 560px the row cannot hold
 * three controls, so the advancing act takes its own full-width row on top (thumb reach first)
 * and `[Back][Cancel]` split the row beneath it. Above 560 it is one row, `space-between`.
 *
 * `Cancel` leaves the flow — it goes to the same address the shell's close does, because a
 * dismissal is a page change and not a step backwards — while `Back` is the stage before. The
 * labels arrive from the fixture (E23): `back` from the stage's own section, `cancel` from the
 * one shared `foot` section.
 *
 * Every control in the foot reaches the 44px floor: `h-11` on both the pair and the advance (#745).
 */
import Link from "next/link";
import type { ReactNode } from "react";

/** The secondary action: `Back` in the foot's left group, and the shipped outline shape. */
export const SECONDARY_CLASSES =
  "inline-flex h-11 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800";

/**
 * The advancing act. Full width below 560 so it owns a row of its own under the thumb, and its
 * own label's width above it — the artifact never stretches the primary to fill the row
 * (`docs/review/artifacts/prototype-relationship-lifecycle-v7.html`, `.stage-foot .btn.primary`).
 */
export const ADVANCE_CLASSES =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground hover:bg-action-hover min-[560px]:w-auto";

export function StageFoot({
  backHref,
  backLabel,
  cancelHref,
  cancelLabel,
  advance,
}: {
  backHref: string;
  backLabel: string;
  cancelHref: string;
  cancelLabel: string;
  /** The control that moves the person forward: a submit on 1, 2 and 4, a link on 3. */
  advance?: ReactNode;
}) {
  return (
    <div
      data-stage-foot="true"
      className="flex flex-col gap-2 border-t border-gray-200 pt-4 min-[560px]:flex-row min-[560px]:items-center min-[560px]:justify-between dark:border-gray-700"
    >
      <div className="order-2 flex items-center gap-2 min-[560px]:order-none">
        <Link
          href={backHref}
          data-create-back="true"
          className={`${SECONDARY_CLASSES} flex-1 min-[560px]:flex-none min-[560px]:min-w-[132px]`}
        >
          {backLabel}
        </Link>
        <Link
          href={cancelHref}
          data-create-cancel="true"
          className={`${SECONDARY_CLASSES} flex-1 min-[560px]:flex-none min-[560px]:min-w-[132px]`}
        >
          {cancelLabel}
        </Link>
      </div>
      {/*
       * The advance is optional (#870): a stage whose template cannot be copied draws the refusal,
       * the fix and this `[Back][Cancel]` pair, and offering an advance there would be a control
       * that walks a person into a store refusal already written above it.
       */}
      {advance === undefined ? null : (
        <div className="order-1 flex min-[560px]:order-none min-[560px]:ml-auto">{advance}</div>
      )}
    </div>
  );
}
