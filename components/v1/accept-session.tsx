// template-ancestor: components/assessment-flow/instance-view.tsx   (variation: both parties accept before the blind rule lifts)
"use client";

import {
  MODE_LABELS,
  OPINION_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  type Opinions,
  type OpinionKind,
  opinionKindsFor,
} from "@/content/assessment";
import { formatDate } from "@/content/core";
import { gapSummary, progressOf, relationshipNameOf, sessionCompleteOf } from "@/lib/v1/derive";
import { useV1Store } from "@/lib/v1/store";
import {
  BackLink,
  ContextLine,
  LoadingState,
  NotFoundState,
  SectionIntro,
  StageBadge,
} from "@/components/v1/v1-ui";
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
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

/**
 * The acceptance step — the closing beat of a session, and the one that lifts the blind rule.
 *
 * **The page is read in the order a decision is made.** Acceptance comes first, as a comparison:
 * two columns, Initiator left and Counterparty right, each naming who has answered how much of
 * their side and whether they have accepted. It used to sit last, under a value-free Aspect list,
 * which made the reader hunt for the one control the screen exists for.
 *
 * **What is shown before acceptance is honest to the blind rule.** A party sees their *own*
 * submission — the answers they are about to accept — with a way to change them
 * (`?edit=1` re-opens the answer sheet until they accept) or to leave and come back (`Finish
 * later`). The other party's column stays sealed until both accept: acceptance, not submission,
 * is what lifts the blind rule, so there is no reading of this page from which one side learns
 * the other's answers early.
 *
 * `Card`, `Badge` and `Button` carry the layout: the step-view header is a subpanel (`dl` of
 * markers), the acceptance block is a status card rather than a form, and every target is 44px
 * (`size="lg"`) and stacks below `sm`.
 */

/** The session's third beat — the same three-step flow `/v1/templates/[type]` names. */
const STEP_LABEL = "Step 3 of 3 · Acceptance";

/** One marker of the step-view header: the term, the value at display size, and what it means. */
function StepMarker({ term, value, detail }: { term: string; value: string; detail: string }) {
  return (
    <div className="bg-card px-4 py-3 sm:px-6">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {term}
      </dt>
      <dd className="mt-0.5 text-lg font-semibold leading-tight text-foreground sm:text-xl">
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}

/**
 * One party's status line. Compact on purpose: a name, the state of their submission, and the
 * moment they accepted. The counterparty column right-aligns above `sm` so the two read as the
 * two sides of one comparison; below `sm` the cards stack and everything is left-aligned.
 */
function PartyPanel({
  seat,
  name,
  isYou,
  submitted,
  accepted,
  acceptedAt,
  answered,
  aspectCount,
  align,
}: {
  seat: string;
  name: string;
  isYou: boolean;
  submitted: boolean;
  accepted: boolean;
  acceptedAt: string | null;
  answered: number;
  aspectCount: number;
  align: "start" | "end";
}) {
  const state = accepted ? "Accepted" : submitted ? "Awaiting acceptance" : "Not answered";
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {seat}
        </span>
        <Badge variant={accepted ? "success" : submitted ? "muted" : "outline"}>{state}</Badge>
      </div>
      <p
        className={cn(
          "mt-1 flex items-baseline gap-1.5 truncate text-base font-semibold text-foreground",
          align === "end" && "sm:justify-end",
        )}
      >
        {name}
        {isYou && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
      </p>
      <p className={cn("text-xs text-muted-foreground", align === "end" && "sm:text-right")}>
        {accepted
          ? `accepted ${formatDate(acceptedAt ?? "")}`
          : `${answered}/${aspectCount} Aspect${aspectCount === 1 ? "" : "s"} answered`}
      </p>
    </div>
  );
}

/** One party's opinions for one Aspect, as a badge per kind — the report's matrix, compacted. */
function OpinionSet({
  answers,
  kinds,
  align,
}: {
  answers: Opinions | undefined;
  kinds: readonly OpinionKind[];
  align: "start" | "end";
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", align === "end" && "sm:justify-end")}>
      {kinds.map((kind) => (
        <Badge key={kind} variant="muted" className="gap-1 font-normal">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {OPINION_LABELS[kind]}
          </span>
          <span className="text-sm font-semibold text-foreground">{answers?.[kind] ?? "—"}</span>
        </Badge>
      ))}
    </div>
  );
}

export function AcceptSession({ relationshipId }: { relationshipId: string }) {
  const { hydrated, persona, relationships, templates, acceptSession } = useV1Store();
  const [problem, setProblem] = useState<string | null>(null);

  const rel = relationships.find((candidate) => candidate.id === relationshipId);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  if (rel === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <NotFoundState
          message={`No relationship with id "${relationshipId}" exists.`}
          back="/v1/initiator"
        />
      </div>
    );
  }

  const template = templates.find((t) => t.id === rel.templateId);
  const summary = gapSummary(rel);
  const progress = progressOf(rel);
  const name = relationshipNameOf(rel, template?.title ?? "");
  const viewer =
    persona === "initiator" ? "initiator" : persona === "counterparty" ? "counterparty" : null;

  if (viewer === null) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-8">
        <SectionIntro title="Review and accept this session" subtitle="Only a party can accept." />
        <p className="text-sm text-muted-foreground">
          Switch to the Initiator or Counterparty persona to accept{" "}
          {template?.title ?? "this relationship"}.
        </p>
      </div>
    );
  }

  const alreadyAccepted = viewer === "initiator" ? rel.initiatorAccepted : rel.counterpartyAccepted;
  const otherAccepted = viewer === "initiator" ? rel.counterpartyAccepted : rel.initiatorAccepted;
  const viewerSubmitted =
    viewer === "initiator" ? rel.initiatorSubmitted : rel.counterpartySubmitted;
  const otherSubmitted =
    viewer === "initiator" ? rel.counterpartySubmitted : rel.initiatorSubmitted;
  const bothAccepted = rel.initiatorAccepted && rel.counterpartyAccepted;

  const viewerName = viewer === "initiator" ? rel.initiatorName : (rel.counterpartyName ?? "You");
  const otherName =
    viewer === "initiator" ? (rel.counterpartyName ?? "the counterparty") : rel.initiatorName;

  const kinds = opinionKindsFor(rel.mode);
  const myAnswers = viewer === "initiator" ? rel.initiatorAnswers : rel.counterpartyAnswers;
  const theirAnswers = viewer === "initiator" ? rel.counterpartyAnswers : rel.initiatorAnswers;
  const otherAnswered =
    viewer === "initiator" ? progress.counterpartyAnswered : progress.initiatorAnswered;
  const answeredByViewer =
    viewer === "initiator" ? progress.initiatorAnswered : progress.counterpartyAnswered;

  const statusLine = bothAccepted
    ? "Both of you accepted — the report is unlocked and both columns below are open."
    : alreadyAccepted
      ? `You accepted. ${otherName} has not accepted yet, so your side is locked and nothing is visible to either of you until they do.`
      : !viewerSubmitted
        ? `Answer your side before you accept. ${otherName} ${otherSubmitted ? "has answered" : "has not answered yet"}.`
        : otherAccepted
          ? `${otherName} has already accepted — accepting now completes the session and unlocks the report.`
          : `You accept first — ${otherName} has not accepted. Nothing of either side's answers is visible until you both do.`;

  const onAccept = () => {
    if (sessionCompleteOf(rel)) {
      setProblem("This session is already complete — both of you accepted.");
      return;
    }
    if (!viewerSubmitted) {
      setProblem("Answer your side before you accept — there is nothing of yours to accept yet.");
      return;
    }
    acceptSession(rel.id, viewer);
    window.location.assign(`/v1/relationships/${rel.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      {/* Where this screen sits — the back link and breadcrumb the answer sheet and the report
          carry, so the three beats of a session read as one flow. */}
      <div className="space-y-2">
        <BackLink href={`/v1/relationships/${rel.id}`} label="Back to the relationship" />
        <ContextLine
          crumbs={[
            { label: "Relationships", href: "/v1/initiator/relationships" },
            { label: name, href: `/v1/relationships/${rel.id}` },
            { label: "Review & accept" },
          ]}
        />
      </div>

      {/* The step-view header — the identity of the thing being accepted, marked rather than
          captioned: Type, Mode and Setting at display size, congruent with the answer sheet's
          Setting line and the report's subtitle. */}
      <section
        className="overflow-hidden rounded-xl border border-border bg-card"
        aria-labelledby="accept-heading"
      >
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-action">
              {STEP_LABEL}
            </p>
            <h1
              id="accept-heading"
              className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              Review and accept this session
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              You are accepting the {template?.title ?? name} sheet you both answered. The values
              stay blind until both of you accept — accepting is what lifts the blind rule.
            </p>
          </div>
          <div className="self-start sm:self-auto">
            <StageBadge stage={summary.stage} />
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-px border-t border-border bg-border sm:grid-cols-3">
          <StepMarker
            term="Type"
            value={template?.title ?? name}
            detail={`${rel.items.length} Aspect${rel.items.length === 1 ? "" : "s"}`}
          />
          <StepMarker
            term="Mode"
            value={MODE_LABELS[rel.mode]}
            detail={`${kinds.map((kind) => OPINION_LABELS[kind]).join(" · ")} on every Aspect`}
          />
          <StepMarker
            term="Setting"
            value={`${SETTING_LABELS[rel.setting]} setting`}
            detail={SETTING_DEFINITIONS[rel.setting]}
          />
        </dl>
      </section>

      {/* Acceptance first: the decision, as the Initiator and the Counterparty side by side. */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Acceptance</CardTitle>
            <Badge variant={bothAccepted ? "success" : "muted"}>
              {bothAccepted ? "Both accepted" : "Both must accept"}
            </Badge>
          </div>
          <CardDescription>
            Two acceptances, recorded separately. Your own submission is shown below so you can
            check what you are accepting; {otherName}&apos;s stays sealed until both of you accept.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <PartyPanel
              seat="Initiator"
              name={rel.initiatorName}
              isYou={viewer === "initiator"}
              submitted={rel.initiatorSubmitted}
              accepted={rel.initiatorAccepted}
              acceptedAt={rel.initiatorAcceptedAt}
              answered={progress.initiatorAnswered}
              aspectCount={progress.aspectCount}
              align="start"
            />
            <PartyPanel
              seat="Counterparty"
              name={rel.counterpartyName ?? "Counterparty"}
              isYou={viewer === "counterparty"}
              submitted={rel.counterpartySubmitted}
              accepted={rel.counterpartyAccepted}
              acceptedAt={rel.counterpartyAcceptedAt}
              answered={progress.counterpartyAnswered}
              aspectCount={progress.aspectCount}
              align="end"
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{statusLine}</p>
          {problem !== null && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {problem}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
            <Link href={`/v1/relationships/${rel.id}`}>Finish later</Link>
          </Button>
          {viewerSubmitted && !alreadyAccepted && (
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href={`/v1/relationships/${rel.id}/answer?edit=1`}>Edit your answers</Link>
            </Button>
          )}
          {viewerSubmitted ? (
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              onClick={onAccept}
              disabled={alreadyAccepted}
            >
              {alreadyAccepted ? `Accepted — awaiting ${otherName}` : "Accept this session"}
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/v1/relationships/${rel.id}/answer`}>Answer your side</Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* The Aspect detail the decision is about — after the decision, never before it. */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Aspect opinions</CardTitle>
            <span className="text-xs text-muted-foreground">
              {rel.items.length} Aspect{rel.items.length === 1 ? "" : "s"} ·{" "}
              {kinds.map((kind) => OPINION_LABELS[kind]).join(" · ")}
            </span>
          </div>
          <CardDescription>
            {bothAccepted
              ? "Both of you accepted, so both columns are open — the same matrix the report draws."
              : `Your own answers on every Aspect, so you can check them before accepting. ${otherName}'s column stays sealed until both of you accept.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="hidden gap-3 px-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Aspect
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {viewerName} · you
            </span>
            <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {otherName}
            </span>
          </div>
          {rel.items.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 rounded-md border border-border bg-card px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{item.prompt}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {item.leftValue} (1) → {item.rightValue} (5)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground sm:hidden">
                  You
                </span>
                <OpinionSet answers={myAnswers[item.id]} kinds={kinds} align="start" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground sm:hidden">
                  {otherName}
                </span>
                {bothAccepted ? (
                  <OpinionSet answers={theirAnswers[item.id]} kinds={kinds} align="end" />
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    Sealed
                  </Badge>
                )}
              </div>
            </div>
          ))}
          <p className="px-1 pt-1 text-xs text-muted-foreground">
            {answeredByViewer}/{progress.aspectCount} of your Aspects are answered and{" "}
            {otherAnswered}/{progress.aspectCount} of {otherName}&apos;s.
            {bothAccepted ? "" : " Only acceptance reveals a column."}
          </p>
        </CardContent>
      </Card>

      {viewer === "counterparty" && (
        <Card>
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Membership</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Your membership is free — the initiator holds the subscription. You join by link and
              pay nothing.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
