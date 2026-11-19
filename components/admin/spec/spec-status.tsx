// template-ancestor: components/admin/permissions/permissions-console.tsx   (variation: the chips are the agreement's six statuses rather than the prototype matrix's three, the mark and the word come from one record so a chip is never a colour alone, and the box beside a row is the register's own glyph rather than a derived icon)
/**
 * The register's status, drawn (#1252) — one chip and one box, shared by the Validation matrix, the
 * story pages and the overview cards.
 *
 * **An icon plus a word, never a colour alone (AS-07).** The mark is `SPEC_STATUS_MARKS`'s and the
 * word is the register's own `status`, so a reader who cannot see the tint reads the same fact the
 * tint encodes. `aria-hidden` is on the mark only: the word is the accessible name, which is why
 * the chip carries no `aria-label` of its own.
 *
 * **No red, anywhere.** The tones are the product's calm scale — `synch` for met, `small-gap` for
 * partial, `gap` for open work, `deep`/`pale` for over-delivered, `counterparty` for offset — all
 * read from `app/globals.css`'s tokens through `tailwind.config.ts`. A palette step in this file is
 * a lint error; a red one is the defect the spec forbids in words.
 *
 * **The row's box is the register's `check`, not a second opinion.** `☑ ◐ ☐ →` arrives per row from
 * the CSV and is drawn as given, so a row that says "partial" in the register cannot be drawn as
 * met by a status the view inferred.
 *
 * Server components: a span is a span, and nothing here holds state.
 */
import { cn } from "@/lib/utils";
import { SPEC_STATUS_MARKS, type SpecCheck, type SpecStatus } from "@/content/spec";

/**
 * One status's chip tone. Exported so the overview card's stack bar paints the same six colours as
 * the chips beside it — a second table is how a bar and its legend stop agreeing.
 */
export const SPEC_STATUS_TONE: Readonly<Record<SpecStatus, string>> = {
  Delivered: "border-synch-mark bg-synch-tint text-synch",
  "Over-Delivered": "border-deep/30 bg-pale text-deep",
  Partial: "border-small-gap-mark bg-small-gap-tint text-small-gap",
  Offset: "border-counterparty-line bg-counterparty-tint text-counterparty-ink",
  Tentative: "border-gap-mark bg-gap-tint text-gap",
  "Out of Scope": "border-input bg-background text-muted-foreground",
};

/** The bar segment's fill, without a border — the same six tones. */
export const SPEC_STATUS_FILL: Readonly<Record<SpecStatus, string>> = {
  Delivered: "bg-synch-mark",
  "Over-Delivered": "bg-deep",
  Partial: "bg-small-gap-mark",
  Offset: "bg-counterparty-solid",
  Tentative: "bg-gap-mark",
  "Out of Scope": "bg-input",
};

/** The box's tone, from the same six statuses, so a box and its chip cannot disagree. */
const CHECK_TONE: Readonly<Record<SpecCheck, string>> = {
  "☑": SPEC_STATUS_TONE.Delivered,
  "◐": SPEC_STATUS_TONE.Partial,
  "☐": SPEC_STATUS_TONE.Tentative,
  "→": SPEC_STATUS_TONE.Offset,
};

/** A status, as the register prints it: mark, word, and the count when the caller has one. */
export function SpecStatusChip({
  status,
  count,
  className,
}: {
  status: SpecStatus;
  /** The number of rows in this state, when the chip is a summary rather than a row. */
  count?: number;
  className?: string;
}) {
  return (
    <span
      data-spec-status={status}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold",
        SPEC_STATUS_TONE[status],
        className,
      )}
    >
      <span aria-hidden="true">{SPEC_STATUS_MARKS[status]}</span>
      <span>{count === undefined ? status : `${status} ${count}`}</span>
    </span>
  );
}

/**
 * The register's check glyph, beside a row's ID.
 *
 * `aria-hidden` on purpose: the chip in the same row already reads the status out, and a second
 * announcement of one fact is noise. `data-spec-check` is the test hook — the drawn mark, not a
 * label.
 */
export function SpecCheckBox({ check }: { check: SpecCheck }) {
  return (
    <span
      aria-hidden="true"
      data-spec-check={check}
      title={check}
      className={cn(
        "inline-grid size-5 shrink-0 place-items-center rounded border text-[13px] font-bold leading-none",
        CHECK_TONE[check],
      )}
    >
      {check}
    </span>
  );
}

/**
 * A parity cell: `Yes`, `No` or `n.a.`. Neutral on purpose — parity that is not asked for is not a
 * gap, and the one status this page must never paint is red.
 */
export function SpecParityChip({
  parity,
  basis,
}: {
  parity: "Yes" | "No" | "n.a.";
  basis: string;
}) {
  return (
    <span
      data-spec-parity={parity}
      title={basis}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-input bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground"
    >
      <span aria-hidden="true">·</span>
      <span>{parity}</span>
    </span>
  );
}
