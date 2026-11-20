// template-ancestor: components/admin/spec/spec-status.tsx   (variation: the chips are the issue's own facts — its number as a link that leaves the app, its state, its tier and the two reviewer labels — rather than the agreement's six statuses, and a row with no issue draws an em dash instead of a chip)
/**
 * The register's GitHub half, drawn (#1296) — one block for the Validation matrix, one cell for the
 * story pages, and the bar both surfaces share.
 *
 * **Five facts per row, and the sixth is the honest one.** The issue number (a link that leaves the
 * app, with `target="_blank"` and a spoken "opens in a new tab" — `LeavingLink` owns that pair), the
 * state, the milestone, the tier label, and the two pills whose truth is a label a reviewer set in
 * GitHub. A register row nobody filed draws **`—`**, not "no": "never filed" and "filed, not yet
 * reviewed" are different facts and a screen that prints the same thing for both is the defect this
 * column exists to prevent.
 *
 * **Read-only, structurally.** There is no toggle, no form, no action and no `use client` here: the
 * pills are text, and the reviewer's control is a label in GitHub. The one control on the surface is
 * `Refresh from GitHub`, which re-reads the *cache* through a route handler and writes nothing
 * anywhere (AS-15).
 *
 * **An icon plus a word, never a colour alone**, and no red. The chip is `components/ui/badge`'s
 * `Chip` — the one primitive (#795) — so a pill wears the same geometry as every other label in the
 * tree, and the tone is a second encoding of the word beside it rather than the only one.
 *
 * **The count is what the API returned**, never a figure in this file: `count` and `skipped` come
 * from the read, so a 29th issue filed tomorrow appears without a change here.
 *
 * Server components: no state, no handler, no clock.
 */
import { RefreshCw } from "lucide-react";

import { LeavingLink } from "@/components/layout/leaving-link";
import { Chip } from "@/components/ui/badge";
import type { PageCopy } from "@/content/pages";
import { specIssuesRefreshHref } from "@/lib/spec/issues-paths";
import { fillLabel, pageItemOf } from "@/lib/page-copy";
import { SPEC_ISSUES_REPO, type SpecIssue, type SpecIssuesRead } from "@/lib/spec/issues";

/**
 * The two pills, as values. A JSX attribute holding a string literal is a *leaf literal* to
 * `data:check` E23 and this surface's budget is 0, so the kind is a constant at the call site —
 * the same reason `SpecFrame` passes `surface={COLUMN_SURFACE}`.
 */
const REVIEWED = "reviewed";
const APPROVED = "approved";

/**
 * One reviewer pill. `on` is the label's presence, and the word says which — "Reviewed" or "Not
 * reviewed" — so the pill is legible with no colour at all.
 *
 * The four ids are spelled out rather than built from `kind`, so a typo is visible here instead of
 * becoming a `pageItemOf` throw at request time on a surface nobody opened in review.
 */
export function SpecIssuePill({
  copy,
  kind,
  on,
}: {
  copy: PageCopy;
  kind: "reviewed" | "approved";
  on: boolean;
}) {
  return (
    <Chip
      variant={on ? "tint" : "neutral"}
      data-spec-pill={kind}
      data-spec-pill-on={on ? "yes" : "no"}
      className="gap-1"
    >
      <span aria-hidden="true">{on ? "✓" : "·"}</span>
      <span>{pillWord(copy, kind, on)}</span>
    </Chip>
  );
}

/** The pill's word, from the four ids the fixture declares — never composed from the arguments. */
function pillWord(copy: PageCopy, kind: "reviewed" | "approved", on: boolean): string {
  if (kind === "reviewed") {
    return pageItemOf(copy, on ? "issues-reviewed-on" : "issues-reviewed-off").label;
  }
  return pageItemOf(copy, on ? "issues-approved-on" : "issues-approved-off").label;
}

/** The issue's state as a chip: `Open` or `Closed`, in words. */
export function SpecIssueState({ copy, issue }: { copy: PageCopy; issue: SpecIssue }) {
  const word = pageItemOf(copy, issue.state === "open" ? "issues-open" : "issues-closed").label;
  return (
    <Chip
      variant={issue.state === "open" ? "soft" : "tint"}
      data-spec-issue-state={issue.state}
      className="gap-1"
    >
      <span aria-hidden="true">{issue.state === "open" ? "◌" : "✓"}</span>
      <span>{word}</span>
    </Chip>
  );
}

/** The issue number, as a departure: a new tab, an external marker, and a name that says so. */
function IssueLink({ issue }: { issue: SpecIssue }) {
  return (
    <LeavingLink
      href={issue.url}
      label={`#${issue.number}`}
      title={`${SPEC_ISSUES_REPO}#${issue.number}`}
      className="inline-flex items-center font-mono text-xs font-semibold text-action underline-offset-4 hover:underline"
      iconClassName="size-2.5"
    >
      <span className="font-mono text-xs font-semibold">#{issue.number}</span>
    </LeavingLink>
  );
}

/** The tier label as worn on the issue (`tier/R1`), or the em dash when it carries none. */
function TierChip({ copy, issue }: { copy: PageCopy; issue: SpecIssue }) {
  return (
    <Chip variant="neutral" data-spec-issue-tier={issue.tier ?? "none"} className="font-mono">
      {issue.tier ?? pageItemOf(copy, "issues-none").label}
    </Chip>
  );
}

/** The milestone line: its own caption, then the title GitHub carries (or the em dash). */
function MilestoneLine({ copy, issue }: { copy: PageCopy; issue: SpecIssue }) {
  return (
    <p className="mt-1 min-w-0 text-[11px] leading-snug text-muted-foreground">
      <span className="font-semibold uppercase tracking-wide">
        {pageItemOf(copy, "issues-milestone").label}
      </span>
      <span aria-hidden="true"> </span>
      <span className="text-foreground">
        {issue.milestone ?? pageItemOf(copy, "issues-none").label}
      </span>
    </p>
  );
}

/**
 * The five facts and the two pills, as a block — the Validation matrix's evidence column.
 *
 * Mounted below Release Evidence for every row that has an issue; a row without one renders the
 * `SpecIssueUnfiled` line instead, so the column's height does not silently disappear and a reader
 * cannot tell "no issue" from "the block failed to draw".
 */
export function SpecIssueFacts({ copy, issue }: { copy: PageCopy; issue: SpecIssue }) {
  return (
    <div data-spec-issue={issue.rowId} className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {pageItemOf(copy, "issues-heading").label}
      </span>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <IssueLink issue={issue} />
        <SpecIssueState copy={copy} issue={issue} />
        <TierChip copy={copy} issue={issue} />
      </div>
      <MilestoneLine copy={copy} issue={issue} />
      <div className="mt-1 flex flex-wrap gap-1.5">
        <SpecIssuePill copy={copy} kind={REVIEWED} on={issue.reviewed} />
        <SpecIssuePill copy={copy} kind={APPROVED} on={issue.approved} />
      </div>
    </div>
  );
}

/**
 * A row nobody filed — the em dash under its own caption, in the same column as the filed rows.
 *
 * Drawn rather than omitted so the evidence column keeps its shape down the whole matrix, and so a
 * reader can tell "no issue" from "this block did not render": the caption is there, the fact is a
 * dash, and the dash is the fixture's own word.
 */
export function SpecIssueUnfiled({ copy }: { copy: PageCopy }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {pageItemOf(copy, "issues-heading").label}
      </span>
      <span data-spec-issue="none" className="mt-0.5 block text-[11px] text-muted-foreground">
        {pageItemOf(copy, "issues-none").label}
      </span>
    </div>
  );
}

/**
 * The same facts as one table cell — the story pages' Status band.
 *
 * A story page draws four tables over one set of rows, so the issue is a **column on the band that
 * carries a row's own state**, not a fifth band: the table keeps its shape and the reader gets the
 * same five facts without four copies of them.
 */
export function SpecIssueCell({ copy, issue }: { copy: PageCopy; issue: SpecIssue | null }) {
  if (issue === null) {
    return (
      <span data-spec-issue="none" className="text-xs text-muted-foreground">
        {pageItemOf(copy, "issues-none").label}
      </span>
    );
  }

  return (
    <span data-spec-issue={issue.rowId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <IssueLink issue={issue} />
      <SpecIssueState copy={copy} issue={issue} />
      <TierChip copy={copy} issue={issue} />
      <span className="w-full text-[11px] leading-snug text-muted-foreground">
        {issue.milestone ?? pageItemOf(copy, "issues-none").label}
      </span>
      <SpecIssuePill copy={copy} kind={REVIEWED} on={issue.reviewed} />
      <SpecIssuePill copy={copy} kind={APPROVED} on={issue.approved} />
    </span>
  );
}

/**
 * The bar both surfaces draw above their rows: what GitHub answered, and the one control.
 *
 * `read === null` is "this deployment never asked" — a bare test render or a page that could not
 * reach the read — and it draws the column header alone with no count, because a count of zero
 * would be a claim about GitHub nobody made. `unavailable` and `stale` are the two honest
 * degradations, and both keep the register rendered: the column is hidden, or it is a copy.
 */
export function SpecIssuesBar({
  copy,
  read,
  next,
}: {
  copy: PageCopy;
  read: SpecIssuesRead | null;
  /** The page to come back to after the cache is cleared. */
  next: string;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const ready = read !== null && read.kind === "ready" ? read : null;
  const degraded = read !== null && read.kind === "unavailable";

  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 text-[11px] text-muted-foreground">
        <span className="font-bold uppercase tracking-wide">{words("issues-heading")}</span>
        <span aria-hidden="true"> </span>
        {ready === null ? null : (
          <>
            <span data-spec-issues-count={ready.count}>
              {fillLabel(words("issues-count"), { count: ready.count })}
            </span>
            {ready.skipped === 0 ? null : (
              <>
                <span aria-hidden="true"> · </span>
                <span data-spec-issues-skipped={ready.skipped}>
                  {fillLabel(words("issues-skipped"), { skipped: ready.skipped })}
                </span>
              </>
            )}
            {ready.stale === true ? (
              <>
                <span aria-hidden="true"> · </span>
                <span data-spec-issues-notice="stale">{words("issues-stale")}</span>
              </>
            ) : null}
          </>
        )}
        {degraded ? (
          <span data-spec-issues-notice="degraded" role="status" className="block">
            {words("issues-degraded")}
          </span>
        ) : null}
      </div>

      <a
        href={specIssuesRefreshHref(next)}
        title={words("issues-refresh-title")}
        data-spec-issues-refresh=""
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-300 bg-background px-3 text-sm font-medium hover:bg-gray-50"
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        {words("issues-refresh")}
      </a>
    </div>
  );
}
