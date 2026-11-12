"use client";

/**
 * template-ancestor: components/quiz/quiz-results.tsx   (variation: the report a party reads, in the console's frame — the same verdict band, per-Aspect numbers and footer of buttons, with an audited reissue, a recorded submission read and two export links in place of the quiz's replay/share actions)
 *
 * `/admin/instances/[id]/report` — one relationship's Gap report, and its operations (#504).
 *
 * The screen is the report the party already reads (`components/assessment/assessment-report.tsx`
 * draws the same projection), wrapped in the console's frame: the row's facts, the verdict band,
 * one row per Aspect with both parties' answers beside the Gaps they make, and then the three
 * operator actions — export, reissue, and read a seat's raw answers.
 *
 * **The export control is this card's own footer, not a toolbar.** #504 says the export reuses the
 * existing button group, so the two downloads sit in a `CardFooter` beside the reissue button — the
 * shape `quiz-results.tsx` already uses for its four actions. A second floating bar over the page
 * would be a new pattern with no ancestor.
 *
 * **Nothing here decides a permission.** The floors live in `lib/admin/roles.ts` and are enforced
 * by `act()` inside the transaction; the one thing this component knows is whether the *screen's*
 * grant can reissue (`canRegenerate`, handed down from the page), and a band it cannot use is
 * disabled **with a sentence** rather than hidden — an operator looking for the button needs to
 * know it exists and why it is unavailable.
 *
 * **Nothing here computes a number.** Every figure is read out of `source.document.report`, which
 * is `lib/assessment-report.ts`'s projection of the opinion rows: the Gaps, the verdict, the
 * widest unmet Gap and the count. The component formats; it does not measure. That is what keeps
 * the screen, the JSON and the PDF from disagreeing — they are three renderings of one value.
 *
 * **The Doubt line's words come from the document**, not from this file: the fixture carries the
 * heading and the "not computable" handle, and the reason a reader is owed is the exported
 * document's own sentence (`lib/report/document.ts::NOT_COMPUTABLE`), so the screen cannot drift
 * from the file.
 *
 * Literal-free (E23): every word is `data/pages/admin-report.ts`; the model's own labels
 * (`MODE_LABELS`, `SETTING_LABELS`, `GAP_KIND_LABELS`) and the instants (`formatDate`) are the
 * exceptions the repo already makes.
 */
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import { GAP_KIND_LABELS } from "@/content/gaps";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { ADMIN_AUDIT_PATH } from "@/lib/admin/paths";
import type {
  ReportOperationInput,
  ReportOperationOutcome,
  SubmissionAnswerView,
} from "@/lib/admin/report-inputs";
import type { ReportSource } from "@/lib/db/admin-report";
import type { InstanceStatus } from "@/lib/flow/state";
import type { DocumentedAspect, ReportDocument } from "@/lib/report/document";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The status the derivation answers, mapped onto the copy id that names it. */
const STATUS_COPY_ID: Record<InstanceStatus, string> = {
  awaiting_counterparty: "awaiting-counterparty",
  answering: "answering",
  /* #619 — sealed and unpaid: the report reads it as its own locked state. */
  awaiting_payment: "awaiting-payment",
  complete: "complete",
  voided: "voided",
};

/** What the screen is doing right now: nothing, or the last operation's outcome. */
type Phase =
  | { readonly kind: "idle" }
  | { readonly kind: "done"; readonly outcome: ReportOperationOutcome };

/** A heading, or the empty string — `sectionHeading` is not a reader the repo has. */
function headingOf(section: PageCopySection): string {
  return section.heading ?? "";
}

/** Fill `{name}` in a sentence without inventing a second string. */
function say(
  section: PageCopySection,
  id: string,
  values: Record<string, string | number>,
): string {
  return fillLabel(itemLabel(section, id), values);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/** One Aspect: what was asked, both answers, and the Gaps between them. */
function AspectRow({
  index,
  aspect,
  copy,
}: {
  index: number;
  aspect: DocumentedAspect;
  copy: PageCopySection;
}) {
  const advanced = aspect.initiator.think !== undefined && aspect.counterparty.think !== undefined;
  const answers = (party: DocumentedAspect["initiator"]): string =>
    advanced
      ? say(copy, "answers-advanced", {
          feel: party.feel,
          wish: party.wish,
          think: party.think ?? "",
          guess: party.guess ?? "",
        })
      : say(copy, "answers", { feel: party.feel, wish: party.wish });

  return (
    <div data-aspect={aspect.item_id} className="rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {say(copy, "aspect", { index })}
        </p>
        <p className="text-xs text-muted-foreground">
          {say(copy, "scale", { left: aspect.left_value, right: aspect.right_value })}
        </p>
      </div>
      <p className="mt-1 text-base font-medium">{aspect.prompt}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="text-sm">
          <p className="text-muted-foreground">{itemLabel(copy, "initiator")}</p>
          <p className="font-medium">{aspect.initiator.name}</p>
          <p className="text-muted-foreground">{answers(aspect.initiator)}</p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">{itemLabel(copy, "counterparty")}</p>
          <p className="font-medium">{aspect.counterparty.name}</p>
          <p className="text-muted-foreground">{answers(aspect.counterparty)}</p>
        </div>
      </div>
      <p data-gaps={aspect.gap_kinds.length} className="mt-3 text-sm">
        <span className="text-muted-foreground">{itemLabel(copy, "gaps")} </span>
        {aspect.gap_kinds
          .map((kind) => `${GAP_KIND_LABELS[kind]} ${aspect.gaps[kind]}`)
          .join(" · ")}
      </p>
    </div>
  );
}

/** One seat's answers, as the audited read handed them back. */
function SubmissionTable({
  answers,
  copy,
}: {
  answers: readonly SubmissionAnswerView[];
  copy: PageCopySection;
}) {
  if (answers.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        {itemLabel(copy, "no-answers")}
      </p>
    );
  }
  return (
    <ul data-submission-answers={answers.length} className="space-y-2">
      {answers.map((answer) => (
        <li key={answer.item_id} className="rounded-md border p-3 text-sm">
          <p className="font-medium">{answer.prompt}</p>
          <p className="text-muted-foreground">
            {answer.feel} / {answer.wish}
            {answer.think === null ? "" : ` / ${answer.think} / ${answer.guess ?? ""}`}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ReportOperations({
  copy,
  source,
  action,
  canRegenerate,
  exportPaths,
  relationshipPath,
  document,
}: {
  copy: PageCopy;
  source: ReportSource;
  action: (input: ReportOperationInput) => Promise<ReportOperationOutcome>;
  canRegenerate: boolean;
  exportPaths: { readonly json: string; readonly pdf: string };
  relationshipPath: string;
  /** The exported document — the same value the JSON and the PDF carry (#504). */
  document: ReportDocument | null;
}) {
  const facts = sectionOf(copy, "facts");
  const statusCopy = sectionOf(copy, "status");
  const verdictCopy = sectionOf(copy, "verdict");
  const aspectsCopy = sectionOf(copy, "aspects");
  const notComputableCopy = sectionOf(copy, "not-computable");
  const exportCopy = sectionOf(copy, "export");
  const regenerateCopy = sectionOf(copy, "regenerate");
  const submissionCopy = sectionOf(copy, "submission");
  const refusals = sectionOf(copy, "refusals");

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [busy, setBusy] = useState<"regenerate" | "read" | null>(null);

  // The exported document *is* the screen's source: one value rendered three ways (this screen,
  // the JSON, the PDF), so the numbers cannot differ between them. `null` means there is no
  // report yet — an incomplete or voided session.
  const ready = document;

  const refusalOf = (code: string): string => {
    const item = refusals.items?.find((candidate) => candidate.id === code);
    return item === undefined ? itemLabel(refusals, "failed") : item.label;
  };

  const submitRegenerate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy !== null) return;
    setBusy("regenerate");
    void action({ operation: "regenerate", instanceRecordId: source.instanceRecordId })
      .then((outcome) => setPhase({ kind: "done", outcome }))
      .finally(() => setBusy(null));
  };

  const readSeat = (role: "initiator" | "counterparty") => {
    if (busy !== null) return;
    setBusy("read");
    void action({
      operation: "read-submission",
      instanceRecordId: source.instanceRecordId,
      role,
    })
      .then((outcome) => setPhase({ kind: "done", outcome }))
      .finally(() => setBusy(null));
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{headingOf(facts)}</CardTitle>
          <CardDescription>{sectionBody(facts)}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Fact label={itemLabel(facts, "instance")} value={source.instanceRecordId} />
            <Fact label={itemLabel(facts, "template")} value={ready?.report.title ?? "—"} />
            <Fact
              label={itemLabel(facts, "mode")}
              value={ready === null ? "—" : MODE_LABELS[ready.report.mode]}
            />
            <Fact
              label={itemLabel(facts, "setting")}
              value={ready === null ? "—" : SETTING_LABELS[ready.report.setting]}
            />
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                {itemLabel(facts, "status")}
              </dt>
              <dd>
                <Badge variant={source.status === "complete" ? "success" : "outline"}>
                  {itemLabel(statusCopy, STATUS_COPY_ID[source.status])}
                </Badge>
              </dd>
            </div>
            <Fact label={itemLabel(facts, "aspects")} value={String(source.aspects)} />
            {ready === null ? null : (
              <Fact label={itemLabel(facts, "gaps")} value={String(ready.report.gap_count)} />
            )}
          </dl>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <a href={exportPaths.json}>{itemLabel(exportCopy, "json")}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={exportPaths.pdf}>{itemLabel(exportCopy, "pdf")}</a>
          </Button>
          <p className="w-full text-xs text-muted-foreground">{itemLabel(exportCopy, "note")}</p>
          {ready === null ? (
            <p data-not-ready="true" className="w-full text-sm text-muted-foreground">
              {itemLabel(exportCopy, "not-ready")} {refusalOf(source.unavailable ?? "not-complete")}
            </p>
          ) : null}
        </CardFooter>
      </Card>

      {ready === null ? null : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{headingOf(verdictCopy)}</CardTitle>
              <CardDescription>{sectionBody(verdictCopy)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p
                data-verdict={ready.report.verdict.aligned ? "aligned" : "unmet"}
                className="text-base"
              >
                {ready.report.verdict.aligned
                  ? say(verdictCopy, "aligned", {
                      setting: SETTING_LABELS[ready.report.setting],
                      gaps: ready.report.gap_count,
                    })
                  : say(verdictCopy, "unmet", {
                      setting: SETTING_LABELS[ready.report.setting],
                      unmet: ready.report.verdict.unmet.length,
                      gaps: ready.report.gap_count,
                      limit: ready.report.setting_limit,
                    })}
              </p>
              {ready.report.widest === null ? null : (
                <p data-widest={ready.report.widest.kind} className="text-sm text-muted-foreground">
                  {say(verdictCopy, "widest", {
                    gap: ready.report.widest.gap,
                    kind: GAP_KIND_LABELS[ready.report.widest.kind],
                    prompt: ready.report.widest.prompt,
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{headingOf(aspectsCopy)}</CardTitle>
              <CardDescription>{sectionBody(aspectsCopy)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ready.report.aspects.map((aspect, index) => (
                <AspectRow
                  key={aspect.item_id}
                  index={index + 1}
                  aspect={aspect}
                  copy={aspectsCopy}
                />
              ))}
            </CardContent>
          </Card>

          {ready.not_computable.length === 0 ? null : (
            <Card data-not-computable="true">
              <CardHeader>
                <CardTitle>{headingOf(notComputableCopy)}</CardTitle>
                <CardDescription>{sectionBody(notComputableCopy)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {ready.not_computable.map((entry) => (
                  <div key={entry.id} data-gap-step={entry.id} className="rounded-md border p-3">
                    <p className="text-sm font-medium">{itemLabel(notComputableCopy, "doubt")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{entry.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{headingOf(submissionCopy)}</CardTitle>
          <CardDescription>{sectionBody(submissionCopy)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy !== null || ready === null}
              onClick={() => readSeat("initiator")}
            >
              {itemLabel(submissionCopy, "initiator")}
            </Button>
            <Button
              variant="outline"
              disabled={busy !== null || ready === null}
              onClick={() => readSeat("counterparty")}
            >
              {itemLabel(submissionCopy, "counterparty")}
            </Button>
            {busy === "read" ? (
              <span className="self-center text-sm text-muted-foreground">
                {itemLabel(submissionCopy, "reading")}
              </span>
            ) : null}
          </div>

          {phase.kind === "done" &&
          phase.outcome.ok &&
          phase.outcome.operation === "read-submission" ? (
            <div
              data-read-recorded="true"
              className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4"
            >
              <p className="text-sm font-medium text-amber-900">
                {say(submissionCopy, "banner", {
                  at: formatDate(phase.outcome.recordedAt),
                  action: phase.outcome.actionId.slice(0, 8),
                })}
              </p>
              <div className="text-sm">
                <p className="font-medium">
                  {say(submissionCopy, "seat", {
                    role: itemLabel(aspectsCopy, phase.outcome.role),
                    name: phase.outcome.name,
                  })}
                </p>
                <p className="text-muted-foreground">
                  {phase.outcome.submittedAt === null
                    ? itemLabel(submissionCopy, "not-submitted")
                    : say(submissionCopy, "submitted", {
                        at: formatDate(phase.outcome.submittedAt),
                      })}
                </p>
                {phase.outcome.acceptedAt === null
                  ? null
                  : say(submissionCopy, "accepted", {
                      at: formatDate(phase.outcome.acceptedAt),
                    })}
              </div>
              <SubmissionTable answers={phase.outcome.answers} copy={submissionCopy} />
              <Button asChild variant="link" className="px-0">
                <Link href={ADMIN_AUDIT_PATH}>{itemLabel(submissionCopy, "audit-link")}</Link>
              </Button>
            </div>
          ) : null}

          {phase.kind === "done" && !phase.outcome.ok ? (
            <p data-refusal={phase.outcome.code} className="text-sm font-medium text-amber-700">
              {refusalOf(phase.outcome.code)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{headingOf(regenerateCopy)}</CardTitle>
          <CardDescription>{sectionBody(regenerateCopy)}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitRegenerate} className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy !== null || ready === null || !canRegenerate}>
                {busy === "regenerate"
                  ? itemLabel(regenerateCopy, "submitting")
                  : itemLabel(regenerateCopy, "button")}
              </Button>
              {!canRegenerate ? (
                <span className="text-sm text-muted-foreground">{refusalOf("role-too-low")}</span>
              ) : null}
            </div>
          </form>

          {phase.kind === "done" && phase.outcome.ok && phase.outcome.operation === "regenerate" ? (
            <div data-regenerated="true" className="mt-4 space-y-1">
              <p className="text-sm font-medium">
                {say(regenerateCopy, "done", { sha: phase.outcome.sha256.slice(0, 16) })}
              </p>
              {phase.outcome.unchanged ? (
                <p className="text-sm text-muted-foreground">
                  {itemLabel(regenerateCopy, "unchanged")}
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href={relationshipPath}>{itemLabel(facts, "back")}</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
