// template-ancestor: components/admin/audit-log.tsx   (variation: one record's story in four bands — what was agreed, what v2.0 does, its status and its evidence — read from the register rather than a filterable table, with a "no mockup" panel where the agreement has no picture)
/**
 * `/admin/spec/[group]` — one story page (AS-08, #1252).
 *
 * **Four bands, in the agreement's order: Agreed → v2.0 Today → Status → Evidence.** Every band is
 * the group's own rows, in the register's order, and the chips at the top are the group's counts —
 * so a story that says "Delivered 2 · Offset 3" is the same two and three the matrix draws for the
 * same group.
 *
 * **A group the register has no row for still renders.** `rows` is empty rather than a 404: the
 * gate's 404 is the one refusal this surface must keep unambiguous, so a mistyped segment gets an
 * honest page that says so and offers the matrix, never the shape a member is refused with.
 *
 * **No mockup is a sentence, never a blank.** The agreement's pictures are NDA material and stay
 * in private storage (AS-10), so the panel that would hold one says so in the fixture's words. A
 * missing picture that rendered as empty space would read as a layout bug.
 *
 * **Evidence is a link to the code on main, at the register's recorded sha** — new tab, spoken
 * name, and a commit nobody can edit. Review and approval are the register's cells; today they are
 * all `Pending`, because there is no sign-off store until R2 and a day's worth of green rows is not
 * an approval.
 *
 * Server component: no state, no handler, no clock.
 */
import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LeavingLink } from "@/components/layout/leaving-link";
import type { PageCopy } from "@/content/pages";
import {
  SPEC_STATUSES,
  specStatusCounts,
  type SpecRow,
  type SpecStoryGroup,
  type SpecValidation,
} from "@/content/spec";
import { ADMIN_SPEC_VALIDATION_PATH } from "@/lib/admin/spec-paths";
import { adminSpecStoryDescriptions } from "@/data/pages/admin-spec";
import { specEvidenceLink } from "@/lib/spec/evidence";
import { fillLabel, pageItemOf } from "@/lib/page-copy";

import { SpecParityChip, SpecStatusChip } from "./spec-status";

/** The group's chips: one per status it actually carries, the counts beside the words. */
function StoryChips({ rows }: { rows: readonly SpecRow[] }) {
  const counts = specStatusCounts(rows);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {SPEC_STATUSES.filter((status) => counts[status] > 0).map((status) => (
        <SpecStatusChip key={status} status={status} count={counts[status]} />
      ))}
    </div>
  );
}

/** One evidence cell: every citation the row carries, each its own link. */
function EvidenceCell({ row, main }: { row: SpecRow; main: string }) {
  return (
    <span className="flex flex-wrap gap-1.5">
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
    </span>
  );
}

/** The page for one story, or the honest panel when the segment names none. */
export function StoryPage({
  copy,
  doc,
  story,
}: {
  copy: PageCopy;
  doc: SpecValidation;
  story: SpecStoryGroup | null;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;

  if (story === null) {
    return (
      <div className="space-y-3 rounded-lg border border-dashed p-6">
        <h1 className="text-xl font-semibold">
          {fillLabel(words("story-unknown-heading"), { group: "" })}
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">{words("story-unknown-body")}</p>
        <Link
          href={ADMIN_SPEC_VALIDATION_PATH}
          className="inline-flex text-sm font-medium text-action underline-offset-4 hover:underline"
        >
          {words("story-unknown-link")}
        </Link>
      </div>
    );
  }

  const rows = doc.rows.filter((row) => row.group === story.name);
  const around = Number.parseInt(story.number, 10) > 6;
  const eyebrow = fillLabel(around ? words("story-eyebrow-around") : words("story-eyebrow-story"), {
    number: story.number,
  });

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{story.name}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          {adminSpecStoryDescriptions[story.slug] ?? null}
        </p>
        <StoryChips rows={rows} />
      </header>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {words("story-empty")}
        </p>
      ) : null}

      <section aria-labelledby="spec-story-agreed" className="space-y-2">
        <h2 id="spec-story-agreed" className="text-base font-semibold">
          {words("story-agreed")}
        </h2>
        <div className="rounded-lg border bg-card p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{words("story-col-id")}</TableHead>
                <TableHead>{words("story-col-page")}</TableHead>
                <TableHead>{words("story-col-requirement")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-spec-agreed={row.id}>
                  <TableCell className="align-top font-mono text-xs whitespace-nowrap">
                    {row.id}
                  </TableCell>
                  <TableCell className="align-top text-xs whitespace-nowrap text-muted-foreground">
                    {row.pdfPages ?? null}
                  </TableCell>
                  <TableCell className="align-top text-sm">
                    {row.requirement}
                    <span className="mt-1 block text-xs italic text-muted-foreground">
                      {words("matrix-quote")}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="spec-story-today" className="space-y-2">
        <h2 id="spec-story-today" className="text-base font-semibold">
          {words("story-today")}
        </h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-dashed p-4">
            <h3 className="text-sm font-semibold">{words("story-agreed-heading")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {words("story-no-mockup")}
              <br />
              {words("story-no-mockup-body")}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{words("story-col-id")}</TableHead>
                  <TableHead>{words("story-col-does")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="align-top font-mono text-xs whitespace-nowrap">
                      {row.id}
                    </TableCell>
                    <TableCell className="align-top text-sm">{row.today}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section aria-labelledby="spec-story-status" className="space-y-2">
        <h2 id="spec-story-status" className="text-base font-semibold">
          {words("story-status")}
        </h2>
        <div className="rounded-lg border bg-card p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{words("story-col-id")}</TableHead>
                <TableHead>{words("story-col-status")}</TableHead>
                <TableHead>{words("story-col-dod")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-spec-status-row={row.id}>
                  <TableCell className="align-top font-mono text-xs whitespace-nowrap">
                    {row.id}
                  </TableCell>
                  <TableCell className="align-top">
                    <SpecStatusChip status={row.status} />
                  </TableCell>
                  <TableCell className="align-top text-sm">{row.definitionOfDone}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section aria-labelledby="spec-story-evidence" className="space-y-2">
        <h2 id="spec-story-evidence" className="text-base font-semibold">
          {words("story-evidence")}
        </h2>
        <div className="rounded-lg border bg-card p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{words("story-col-id")}</TableHead>
                <TableHead>{words("story-col-evidence")}</TableHead>
                <TableHead>{words("story-col-parity")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-top font-mono text-xs whitespace-nowrap">
                    {row.id}
                  </TableCell>
                  <TableCell className="align-top">
                    <EvidenceCell row={row} main={doc.main} />
                  </TableCell>
                  <TableCell className="align-top">
                    <SpecParityChip parity={row.parity} basis={row.parityBasis} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
