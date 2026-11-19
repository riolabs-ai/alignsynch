"use client";

// template-ancestor: components/assessment-flow/answer-form.tsx   (variation: the v2.0 answer surface — one Aspect per screen on the painted 1–5 band with save-as-you-go, a resume banner and a review, in place of one long form and one submit)

/**
 * `AnswerSheet` — `/assessment/instances/[instanceId]/answer`, the v2 answer screen (#1128).
 *
 * The screen this replaces drew every Aspect on one page with one `Submit answers` at the foot.
 * The approved surface (`docs/specs/v2-bundles/10-spec-design-page-assessment-v2/assessment.html`)
 * asks **one Aspect at a time**, saves each pick, resumes where the reader left off, and ends with
 * a review. The bands, in the bundle's order:
 *
 *   header     the flow's own title (`Round 1 Assessment`) and `Save and Exit`.
 *   privacy    the sentence that never moves: answers stay private until both parties finish. It is
 *              drawn from the **other party's** name, which comes from the rows rather than from a
 *              guess — and the blind rule behind it is the input, not this markup: `aspects[].own`
 *              is the viewer's own score and the read that filled it was filtered by
 *              `visibleRoles()`, so there is no field here that could carry anyone else's.
 *   resume     the returning reader's banner, with `Start Over`. Shown only when there is something
 *              to resume, which is a fact about their own rows.
 *   progress   `Round 1 · Aspect n of 5`, the segmented bar, and the save state.
 *   the card   `AspectAnswerCard` (one Aspect) or `AnswerReview` (the last position).
 *
 * **Four shapes, one route** (`lib/flow/answer-gate.ts`): the live sheet for the seat that may
 * answer, the viewer's own reviewed sheet drawn sealed once they have accepted, a coach band
 * with no sheet at all, and a lapsed relationship, which draws the paused pane above whichever of
 * the first two the viewer would otherwise get. A lapsed membership keeps the sheet writable
 * (#848: the lapse closes the Gap, not the pairing) — the pane names the pause, it never takes
 * the form away.
 *
 * Client, and only for the reason the card needs it: the `Saved` line is a fact about a request
 * that has just returned. Nothing here reads a server module — the words come from the fixture, the
 * scores from the read, and both are props.
 *
 * Literal-free: `data/pages/assessment-answer.ts` (E23).
 */
import { AnswerReview } from "@/components/assessment-flow/answer-review";
import { AspectAnswerCard } from "@/components/assessment-flow/aspect-answer-card";
import type { AssessmentMode, PartyRole } from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { answeredCount, type SheetPosition } from "@/lib/flow/answer-position";
import type { AnswerGate } from "@/lib/flow/answer-gate";
import type { FlowAspect } from "@/lib/flow/screen";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { useState } from "react";

/** One seat as the page resolved it: the party row's own name, or the coach's empty one. */
export interface SheetViewer {
  readonly role: PartyRole | "coach";
  readonly name: string;
}

type SaveState = "idle" | "saving" | "saved" | "failed";

export function AnswerSheet({
  copy,
  aspects,
  gate,
  viewer,
  mode,
  backHref,
  sheetPath,
  draftAction,
  answersAction,
  otherName,
  position,
  refused,
  incomplete,
  resultsReady,
}: {
  copy: PageCopy;
  aspects: readonly FlowAspect[];
  gate: AnswerGate;
  viewer: SheetViewer;
  mode: AssessmentMode;
  /** The session screen — `sessionPath()`. Where `Save and Exit` goes. */
  backHref: string;
  /** This route, without a query — `?aspect=` positions are built from it. */
  sheetPath: string;
  /** `/answers/draft` — the partial write. */
  draftAction: string;
  /** `/answers` — the seal. */
  answersAction: string;
  /** The other party's name, from the rows, for the privacy note. */
  otherName: string;
  position: SheetPosition;
  /** A code the route bounced this render with, or `undefined`. */
  refused?: string;
  /** The draft route answered `Next` against an incomplete Aspect. */
  incomplete?: boolean;
  /** Both parties have finished, so the sealed sheet's status line says the results are open. */
  resultsReady?: boolean;
}) {
  const privacy = sectionOf(copy, "privacy");
  const resume = sectionOf(copy, "resume");
  const progress = sectionOf(copy, "progress");
  const frozen = sectionOf(copy, "frozen");
  const lapsed = sectionOf(copy, "lapsed");
  const coach = sectionOf(copy, "coach");
  const backLabel = pageLabel(copy);
  const [saved, setSaved] = useState<SaveState>("idle");

  const answered = answeredCount(aspects);
  const aspectHrefFor = (aspect: number | "review"): string => `${sheetPath}?aspect=${aspect}`;

  const heading = (
    <header className="flex items-start justify-between gap-3" data-answering-as={viewer.role}>
      <div>
        <h1 className="text-xl font-bold tracking-tight text-primary sm:text-2xl">
          {copy.heading}
        </h1>
      </div>
      <a
        href={backHref}
        data-exit=""
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-mist h-10 lg:h-9"
      >
        <svg
          className="size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
        <span>{pageItemOf(copy, "exit").label}</span>
      </a>
    </header>
  );

  /** The note that never moves: private until both finish. */
  const privacyNote = (
    <div
      data-privacy=""
      className="flex items-start gap-3 rounded-md border border-status-line bg-status p-3 text-sm text-foreground"
    >
      <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-deep">
        <svg
          aria-hidden="true"
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </span>
      <p>
        <span className="font-semibold">{privacy.heading}</span>{" "}
        {fillLabel(sectionBody(privacy), { other: otherName })}
      </p>
    </div>
  );

  /** A coach reads the relationship and has no answers to give: no card, no form, no progress. */
  if (gate.state === "coach") {
    return (
      <div className="space-y-4">
        {heading}
        <section
          aria-labelledby="answer-sheet-coach-heading"
          data-coach-badge="true"
          className="rounded-lg border bg-card p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {itemLabel(coach, "coach-badge")}
          </p>
          <h2 id="answer-sheet-coach-heading" className="mt-1 text-xl font-semibold text-primary">
            {coach.heading}
          </h2>
          <p className="mt-1 text-sm text-foreground">{sectionBody(coach)}</p>
          <p className="mt-3 text-sm font-medium text-foreground">
            {itemLabel(coach, "coach-note")}
          </p>
        </section>
        <p>
          <a href={backHref} className="text-sm font-medium text-action hover:underline">
            {backLabel}
          </a>
        </p>
      </div>
    );
  }

  const segments = Array.from({ length: position.total }, (_, index) => {
    const state =
      index + 1 < position.index ? "done" : index + 1 === position.index ? "current" : "todo";
    return (
      <span
        key={`segment-${index + 1}`}
        data-qbar={index + 1}
        data-state={state}
        className={`h-1.5 flex-1 rounded-full ${
          state === "done" ? "bg-action" : state === "current" ? "bg-deep" : "bg-line"
        }`}
      />
    );
  });

  const savedLabel =
    saved === "saved"
      ? itemLabel(progress, "saved")
      : saved === "failed"
        ? itemLabel(progress, "save-failed")
        : itemLabel(progress, "saving");

  /**
   * Whether this viewer has a form at all. `lapsed` answers this from `maySubmit()` rather than
   * from its name (#848): the lapse is a fact about the relationship, and a lapsed trial closes
   * the Gap, not the pairing.
   */
  const writable = gate.action !== null;

  /** The Counterparty's copy, which never carries a billing word (the locked rule for this page). */
  const counterpartySeat = viewer.role === "counterparty";

  /**
   * #1223 — the paused pane, drawn **above** the sheet rather than in place of it.
   *
   * The approved surface (`assessment.html?state=lapsed&role=initiator|counterparty`) replaces the
   * whole screen with this pane, because the prototype has no writable lapsed state. This build
   * does: #848's decision is that a lapse closes the Gap, not the pairing, so taking the form away
   * here is the exact regression that card fixed. What carries over from the bundle is the pane
   * itself — the status icon, the word, and the fact that the answers are saved — and the copy
   * splits by seat, because the Counterparty never reads a membership, trial, payment or plan word.
   */
  const paused =
    gate.state === "lapsed" ? (
      <section
        data-paused=""
        role="status"
        aria-labelledby="answer-sheet-paused-heading"
        className="flex flex-col gap-4 rounded-lg border border-status-line bg-status p-5 text-card-foreground sm:flex-row sm:items-start"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-status-chip text-deep"
        >
          <svg
            className="size-5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        </span>
        <div className="min-w-0 space-y-2">
          <h2
            id="answer-sheet-paused-heading"
            className="text-xl font-bold tracking-tight text-primary"
          >
            {counterpartySeat ? itemLabel(lapsed, "heading-counterparty") : lapsed.heading}
          </h2>
          <p className="text-base text-foreground">
            {counterpartySeat ? itemLabel(lapsed, "body-counterparty") : sectionBody(lapsed)}
          </p>
          {counterpartySeat ? null : (
            <p className="text-sm text-muted-foreground">{itemLabel(lapsed, "lapsed-note")}</p>
          )}
        </div>
      </section>
    ) : null;

  /** The sealed copy of the sheet: what the viewer said, and what happens next. */
  const sealed = (
    <div className="space-y-4">
      <section
        data-frozen-status={resultsReady === true ? "ready" : "waiting"}
        className="rounded-lg border bg-card p-4"
      >
        <h2 className="text-xl font-semibold text-primary">{frozen.heading}</h2>
        <p className="mt-1 text-sm text-foreground">{sectionBody(frozen)}</p>
        <p className="mt-3 text-sm font-semibold text-primary">
          {resultsReady === true
            ? itemLabel(frozen, "ready")
            : fillLabel(itemLabel(frozen, "waiting"), { other: otherName })}
        </p>
        <p className="mt-1 text-sm text-foreground">
          {resultsReady === true
            ? itemLabel(frozen, "ready-body")
            : fillLabel(itemLabel(frozen, "waiting-body"), { other: otherName })}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">{itemLabel(frozen, "frozen-note")}</p>
      </section>

      <AnswerReview
        copy={copy}
        aspects={aspects}
        mode={mode}
        answersHref={answersAction}
        changeHrefFor={aspectHrefFor}
        exitHref={backHref}
        sealed
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {heading}
      {paused}
      {privacyNote}

      {!writable || answered === 0 || position.review ? null : (
        <div
          data-resume=""
          role="status"
          className="flex items-start justify-between gap-3 rounded-md border border-billing-line bg-billing p-3 text-sm text-foreground"
        >
          <p>
            <span className="font-semibold">{resume.heading}</span>{" "}
            {fillLabel(sectionBody(resume), { aspect: position.index })}
          </p>
          <form action={draftAction} method="post" className="shrink-0">
            <input type="hidden" name="item" value={aspects[position.index - 1]?.itemId ?? ""} />
            <input type="hidden" name="aspect" value={position.index} />
            <button
              type="submit"
              name="go"
              value="reset"
              title={itemLabel(resume, "start-over-note")}
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              {itemLabel(resume, "start-over")}
            </button>
          </form>
        </div>
      )}

      {refused === undefined ? null : (
        <p
          data-refused={refused}
          role="alert"
          className="rounded-md border border-billing-line bg-billing p-3 text-sm text-foreground"
        >
          {refusalSentence(copy, refused, counterpartySeat)}
        </p>
      )}

      {writable ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <p className="font-semibold uppercase tracking-wider text-deep" aria-live="polite">
                {position.review
                  ? fillLabel(itemLabel(progress, "position"), {
                      aspect: position.total,
                      total: position.total,
                    })
                  : fillLabel(itemLabel(progress, "position"), {
                      aspect: position.index,
                      total: position.total,
                    })}
              </p>
              <p className="text-muted-foreground" data-saved-state={saved}>
                {position.review ? itemLabel(progress, "saved") : savedLabel}
              </p>
            </div>
            <div className="flex gap-1" aria-hidden="true">
              {segments}
            </div>
          </div>

          {position.review ? (
            <AnswerReview
              copy={copy}
              aspects={aspects}
              mode={mode}
              answersHref={answersAction}
              changeHrefFor={aspectHrefFor}
              exitHref={backHref}
              sealed={false}
            />
          ) : (
            <AspectAnswerCard
              copy={copy}
              aspect={aspects[position.index - 1] ?? aspects[0]}
              index={position.index}
              total={position.total}
              mode={mode}
              draftAction={draftAction}
              incomplete={incomplete === true}
              onSaved={setSaved}
            />
          )}
        </>
      ) : (
        sealed
      )}

      <p>
        <a href={backHref} className="text-sm font-medium text-action hover:underline">
          {backLabel}
        </a>
      </p>
    </div>
  );
}

/** The page-level `back` item — every band ends with the same link. */
function pageLabel(copy: PageCopy): string {
  return pageItemOf(copy, "back").label;
}

/**
 * The sentence for a refusal code the draft route bounced this render with.
 *
 * A `find` rather than `itemLabel`: `itemLabel` throws on an id the fixture does not carry, and a
 * refusal path that 500s because a code arrived that this fixture has no sentence for would be a
 * worse failure than the refusal itself. `unknown` is the fallback, and every code the store can
 * return has its own row in `refusals`.
 *
 * `counterparty` asks for the `<code>-counterparty` row first (#1223): `lapsed` and
 * `payment-method-required` are the two codes that reach that seat with a billing cause behind
 * them, and the locked rule for this page is that the Counterparty never reads a membership,
 * trial, payment or plan word — not even in the sentence that refuses them.
 */
function refusalSentence(copy: PageCopy, code: string, counterparty: boolean): string {
  const section = sectionOf(copy, "refusals");
  const lookup = (id: string) => section.items?.find((item) => item.id === id);
  return (
    (counterparty ? lookup(`${code}-counterparty`) : undefined)?.label ??
    lookup(code)?.label ??
    lookup("unknown")?.label ??
    ""
  );
}
