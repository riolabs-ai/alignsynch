/**
 * Turning a register row's citations into links, and its date into the label the page prints
 * (#1252).
 *
 * **Pure, and no clock.** Every function here is a function of its arguments: the evidence link is
 * built from the row's own `file:line` and the register's recorded `main`, and the date label is
 * formatted from `generatedAt` with an explicit `timeZone: "UTC"`. A render path that read a clock
 * would print one thing on the server and another at hydration (`AGENTS.md` § Pitfalls), and this
 * page carries three dates' worth of register metadata.
 *
 * **A citation is a path with an optional line**, exactly as the CSV writes it:
 * `data/relationship-types.ts:740` is a code path and a line, `guides/initiator/payment.md` is a
 * docs page. The split is on the *last* colon whose suffix is all digits, so a Windows-style path
 * cannot be mistaken for a line number and a path that carries no line stays a path.
 *
 * The link is read-only by construction: a blob URL at a fixed sha opens in a new tab and points at
 * a commit nobody can edit. That is the whole of "read-only" on this surface (AS-15) — there is no
 * action, no form and no route that writes.
 */

/** The repository the citations resolve in. Evidence links are `blob/<sha>/<path>#L<line>`. */
export const SPEC_REPO_URL = "https://github.com/riolabs-ai/alignsynch";

/** Where a docs citation is read: the console's own documentation tree. */
export const SPEC_DOCS_PATH = "/admin/docs";

/** A citation, resolved: the address to open and the text to print. */
export interface SpecEvidenceLink {
  readonly href: string;
  readonly label: string;
  /** `false` for a docs page — an in-app route that keeps the tab it was opened in. */
  readonly leaves: boolean;
}

const LINE_SUFFIX = /^(.*):(\d+)$/;

/** Where one citation points, at the register's recorded commit. */
export function specEvidenceLink(
  evidence: { readonly kind: "code" | "docs"; readonly ref: string },
  main: string,
): SpecEvidenceLink {
  if (evidence.kind === "docs") {
    return { href: SPEC_DOCS_PATH, label: evidence.ref, leaves: false };
  }
  const match = LINE_SUFFIX.exec(evidence.ref);
  const path = match?.[1] ?? evidence.ref;
  const line = match?.[2];
  const anchor = line === undefined ? "" : `#L${line}`;
  return {
    href: `${SPEC_REPO_URL}/blob/${main}/${path}${anchor}`,
    label: evidence.ref,
    leaves: true,
  };
}

/**
 * `2026-11-19` → `19 Nov 2026`, the label the status box prints beside the row count.
 *
 * A fixed locale and an explicit UTC zone: the string is a pure function of the register's own
 * date, so the server's render and the browser's hydration agree wherever the reader sits.
 */
export function specDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  if (year === undefined || month === undefined || day === undefined) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
