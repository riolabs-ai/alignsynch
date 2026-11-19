// template-ancestor: components/admin/permissions/permissions-console.tsx   (variation: the matrix is four sections of register rows rather than one filterable table — every row carries its own Definition of Done, its release map and its citations, and the counts come from the rows in their own order instead of from a filterable header band)
/**
 * `/admin/spec/validation` — the Validation matrix (AS-07, #1252).
 *
 * **Four sections, in the agreement's order, 28 / 20 / 13 / 27 rows.** The sections and their
 * groups are `specSectionsOf(doc.rows)`'s output: a section's number is its index in
 * `SPEC_SECTIONS`, its groups are in first-appearance order, and no count on this screen is typed.
 * The twelve `Beyond the Agreement` rows are in section 2 and are counted separately everywhere
 * else — which is why this table is 88 rows and the gauge is out of 76.
 *
 * **A row is the register's row.** The check glyph, the ID, the agreement page, the status, the
 * requirement, the Definition of Done, what v2.0 does today, the next acceptance and the release
 * map are `data/spec/validation.json`'s fields, printed as they arrive. Nothing is inferred,
 * nothing is filled in, and the columns are drawn at every width — they stack below `sm` rather
 * than disappearing.
 *
 * **Review and Approval read Pending, in words.** They are display-only until R2 (AS-15): there is
 * no sign-off store, so a chip that said "Approved" would be a claim nobody made. The register's
 * own fields are printed when they carry a value and the fixture's pending words when they do not.
 *
 * **The agreement's wording is not here, and the row says so.** `quote` is `null` on every row of
 * the repo-safe register (AS-10), so each row prints the fixture's one sentence about where the
 * wording lives instead of a blank line — a reader is told why, once per row, rather than left to
 * wonder whether the field is broken.
 *
 * **Evidence links leave the app, so they are `LeavingLink`s.** A code citation opens the blob at
 * the register's recorded `main` in a new tab, with the accessible name saying so; a docs citation
 * is the console's own `/admin/docs` and keeps the tab. That is the whole of "read-only": a commit
 * nobody can edit, and no control on this page writes anything (AS-15).
 *
 * Server component: no state, no handler, no clock.
 */
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import {
  specSectionsOf,
  type SpecRow,
  type SpecSectionGroup,
  type SpecValidation,
} from "@/content/spec";
import { adminSpecSectionNotes } from "@/data/pages/admin-spec";
import { ADMIN_SPEC_VALIDATION_PATH } from "@/lib/admin/spec-paths";
import { specEvidenceLink } from "@/lib/spec/evidence";
import { specIssueFor, type SpecIssue, type SpecIssuesRead } from "@/lib/spec/issues";
import { pageItemOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { LeavingLink } from "@/components/layout/leaving-link";

import { SpecIssueFacts, SpecIssuesBar, SpecIssueUnfiled } from "./spec-issues";
import { SpecCheckBox, SpecParityChip, SpecStatusChip } from "./spec-status";
import { SpecStatusBox } from "./spec-status-box";

/** The release map's four columns, in the agreement's own order. */
function ReleaseMap({ copy, row }: { copy: PageCopy; row: SpecRow }) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const cells = [
    { id: "matrix-v200", value: row.release.v200, wide: true },
    { id: "matrix-rc2", value: row.release.rc2, wide: false },
    { id: "matrix-rc3", value: row.release.rc3, wide: false },
    { id: "matrix-beta", value: row.release.beta, wide: false },
  ];

  return (
    <div className="grid grid-cols-2 gap-1">
      {cells.map((cell) => (
        <div
          key={cell.id}
          className={cn(
            "min-w-0 rounded border bg-background px-1.5 py-0.5",
            cell.wide && "col-span-2",
          )}
        >
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            {words(cell.id)}
          </span>
          <span className="block truncate text-xs font-medium">{cell.value}</span>
        </div>
      ))}
    </div>
  );
}

/** One row: the requirement's own column, then the release evidence beside it. */
function RegisterRow({
  copy,
  row,
  main,
  issue,
  issues,
}: {
  copy: PageCopy;
  row: SpecRow;
  main: string;
  issue: SpecIssue | null;
  /** Whether the GitHub column is drawn at all — false when the read produced no set. */
  issues: boolean;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const review = `${row.review.pm}, ${row.review.design}`;
  const approval = `${row.approval.jaden}, ${row.approval.walt}`;
  const pending = words("meta-unsigned");

  return (
    <article
      data-spec-row={row.id}
      data-spec-row-status={row.status}
      className="mb-2 grid overflow-hidden rounded-lg border bg-card sm:grid-cols-[minmax(0,1fr)_236px]"
    >
      <div className="min-w-0 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <SpecCheckBox check={row.check} />
          <span className="font-mono text-xs font-semibold">{row.id}</span>
          {row.pdfPages === null ? null : (
            <span title={words("matrix-pages")} className="text-[11px] text-muted-foreground">
              {row.pdfPages}
            </span>
          )}
          <SpecStatusChip status={row.status} />
        </div>
        <p className="mt-1.5 text-sm">{row.requirement}</p>
        <p className="mt-1 text-xs italic text-muted-foreground">{words("matrix-quote")}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide">{words("matrix-dod")}</span>
          <span aria-hidden="true"> </span>
          <span className="text-foreground">{row.definitionOfDone}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide">{words("matrix-today")}</span>
          <span aria-hidden="true"> </span>
          <span>{row.today}</span>
        </p>
        {row.next === null ? null : (
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wide text-gap">
              {words("matrix-next")}
            </span>
            <span aria-hidden="true"> </span>
            <span>{row.next}</span>
          </p>
        )}
      </div>

      <div className="grid min-w-0 content-start gap-2 border-t bg-muted/40 px-3 py-2.5 sm:border-l sm:border-t-0">
        {issues ? (
          issue === null ? (
            <SpecIssueUnfiled copy={copy} />
          ) : (
            <SpecIssueFacts copy={copy} issue={issue} />
          )
        ) : null}

        <ReleaseMap copy={copy} row={row} />

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {words("matrix-evidence")}
          </span>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {row.evidence.map((evidence) => {
              const link = specEvidenceLink(evidence, main);
              return link.leaves ? (
                <LeavingLink
                  key={evidence.ref}
                  href={link.href}
                  label={link.label}
                  className="inline-flex items-center text-[11px] font-medium text-action underline-offset-4 hover:underline"
                  iconClassName="size-2.5"
                >
                  <code className="break-all font-mono">{link.label}</code>
                </LeavingLink>
              ) : (
                <Link
                  key={evidence.ref}
                  href={link.href}
                  className="inline-flex items-center text-[11px] font-medium text-action underline-offset-4 hover:underline"
                >
                  <code className="break-all font-mono">{link.label}</code>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {words("matrix-parity")}
          </span>
          <SpecParityChip parity={row.parity} basis={row.parityBasis} />
        </div>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {words("matrix-review")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            <span aria-hidden="true">◌ </span>
            {review}
            <span aria-hidden="true"> </span>
            {pending}
          </span>
        </div>

        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {words("matrix-approval")}
          </span>
          <span className="text-[11px] text-muted-foreground">
            <span aria-hidden="true">◌ </span>
            {approval}
            <span aria-hidden="true"> </span>
            {pending}
          </span>
        </div>
      </div>
    </article>
  );
}

/** One group's heading: the story number and name when it is a story, its own name when it is not. */
function GroupHeading({ group }: { group: SpecSectionGroup }) {
  return (
    <h3
      className="mt-4 mb-1.5 flex items-center gap-2 text-[13px] font-bold"
      data-spec-group={group.name}
    >
      <span>{group.story === null ? group.name : `${group.story.number} ${group.name}`}</span>
      <span className="rounded-full border bg-background px-1.5 text-[11px] font-medium text-muted-foreground">
        {group.rows.length}
      </span>
    </h3>
  );
}

export function ValidationMatrix({
  copy,
  doc,
  issues = null,
}: {
  copy: PageCopy;
  doc: SpecValidation;
  /**
   * The GitHub read, or `null` when there is none. `null` and `unavailable` both draw no issue
   * block — the register is `data/spec/validation.json` and it renders exactly as it does today,
   * with the bar saying why the column is missing.
   */
  issues?: SpecIssuesRead | null;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const sections = specSectionsOf(doc.rows);
  const column = issues !== null && issues.kind === "ready";

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {words("matrix-eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{words("matrix-heading")}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{words("matrix-subtitle")}</p>
      </header>

      <SpecIssuesBar copy={copy} read={issues} next={ADMIN_SPEC_VALIDATION_PATH} />

      <div className="grid items-start gap-4 xl:grid-cols-[212px_minmax(0,1fr)]">
        <SpecStatusBox copy={copy} doc={doc} sections meta className="xl:sticky xl:top-0" />

        <div className="min-w-0">
          {sections.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {words("matrix-empty")}
            </p>
          ) : null}
          {sections.map((section) => (
            <section
              key={section.number}
              id={`spec-section-${section.number}`}
              aria-labelledby={`spec-section-${section.number}-heading`}
              className="mb-7 scroll-mt-4"
              data-spec-section={section.number}
              data-spec-section-rows={section.rows}
            >
              <div className="grid grid-cols-[34px_minmax(0,1fr)_auto] items-start gap-2.5 border-b pb-2.5">
                <span
                  aria-hidden="true"
                  className="grid size-[34px] place-items-center rounded-lg bg-action text-sm font-bold text-action-foreground"
                >
                  {section.number}
                </span>
                <div className="min-w-0">
                  <h2
                    id={`spec-section-${section.number}-heading`}
                    className="text-base font-semibold"
                  >
                    {section.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {adminSpecSectionNotes[section.name] ?? null}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-muted-foreground">
                  {section.rows}
                </span>
              </div>

              <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_236px] gap-3 pt-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:grid">
                <span>{words("matrix-col-requirement")}</span>
                <span>{words("matrix-col-evidence")}</span>
              </div>

              {section.rows === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {words("matrix-empty")}
                </p>
              ) : null}

              {section.groups.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {words("matrix-empty")}
                </p>
              ) : null}

              {section.groups.map((group) => (
                <div key={`${section.number}-${group.name}`}>
                  <GroupHeading group={group} />
                  {group.rows.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      {words("matrix-empty")}
                    </p>
                  ) : null}
                  {group.rows.map((row) => (
                    <RegisterRow
                      key={row.id}
                      copy={copy}
                      row={row}
                      main={doc.main}
                      issue={specIssueFor(issues, row.id)}
                      issues={column}
                    />
                  ))}
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
