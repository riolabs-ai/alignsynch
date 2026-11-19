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
 *   progress   `Round 1 · Aspect n of 5`, the segmented bar, and the save state — drawn on the live
 *              sheet, the review and the sealed sheet alike, because the reference draws the band
 *              in every state and a sealed reader had neither the round nor their place in it.
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
import { type ReactNode, useState } from "react";

/** One seat as the page resolved it: the party row's own name, or the coach's empty one. */
export interface SheetViewer {
  readonly role: PartyRole | "coach";
  readonly name: string;
}

type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * The chip's fifth state: the sheet is sealed and takes no answer.
 *
 * A state _code_, not copy — every word a reader sees is the fixture's (`progress.sealed-state`),
 * and `data:check` E23's leaf rule counts a string written into a JSX attribute in this file, where
 * this route's budget is zero. Naming it once, here, keeps the code out of the markup and keeps the
 * four chip states in one union.
 */
const SEALED_CHIP_STATE = "sealed";

/** What the chip draws: the request's four states, plus the sealed sheet's. */
type ChipState = SaveState | typeof SEALED_CHIP_STATE;

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

  const segments = segmentStates(position.index, position.total);
  const segmentsDone = segmentStates(position.total + 1, position.total);

  const savedLabel =
    saved === "saved"
      ? itemLabel(progress, "saved")
      : saved === "failed"
        ? itemLabel(progress, "save-failed")
        : saved === "saving"
          ? itemLabel(progress, "saving-now")
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
      {/*
        The band the sealed sheet used to drop. The doc promises a position line and a save state,
        and the reference draws both bands (`assessment.html`, `data-q-progress` + `data-qbar`);
        a reader arriving at a sheet that takes no more answers was reading neither, so they had
        no round and no place in it. The position is the sheet's own — every Aspect answered — and
        the chip says `Sealed` rather than promising a save this page cannot perform.
      */}
      <SheetBand
        label={fillLabel(itemLabel(progress, "position-sealed"), {
          aspect: answered,
          total: position.total,
        })}
        chip={<SaveChip state={SEALED_CHIP_STATE} label={itemLabel(progress, "sealed-state")} />}
        segments={segmentsDone}
      />
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
          <SheetBand
            label={fillLabel(itemLabel(progress, "position"), {
              aspect: position.review ? position.total : position.index,
              total: position.total,
            })}
            chip={
              <SaveChip
                state={position.review ? "saved" : saved}
                label={position.review ? itemLabel(progress, "saved") : savedLabel}
              />
            }
            segments={segments}
          />

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

/** One segment of the bundle's bar: behind the reader, at the reader, or still ahead. */
type SegmentState = "done" | "current" | "todo";

/** A segment's position (1-based) and state — the key is the position, never the array index. */
interface Segment {
  readonly at: number;
  readonly state: SegmentState;
}

/** The bar's states for a sheet standing at `index` (1-based) of `total`. */
function segmentStates(index: number, total: number): readonly Segment[] {
  return Array.from({ length: total }, (_, at) => ({
    at: at + 1,
    state: at + 1 < index ? "done" : at + 1 === index ? "current" : "todo",
  }));
}

/**
 * The bundle's progress band: the position sentence, the save state, one segment per Aspect.
 *
 * Three of the sheet's four shapes draw this band — the live sheet, the review (all done) and the
 * sealed sheet — because the reference draws the same band on every one of them
 * (`assessment.html`, `data-q-progress` + `data-qbar`). It was inline in the writable branch
 * alone, which is why a sealed sheet told a reader nothing about where they were (#v2 rectification,
 * `guides/shared/answer-the-assessment.md`).
 *
 * The band is not a rail (#716 → #825): no stage names, no `Stage n of 5`, no `<nav>` — the words
 * are the fixture's, the count is the session's own.
 */
function SheetBand({
  label,
  chip,
  segments,
}: {
  readonly label: string;
  readonly chip: ReactNode;
  readonly segments: readonly Segment[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs">
        <p className="font-semibold uppercase tracking-wider text-deep" aria-live="polite">
          {label}
        </p>
        {chip}
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {segments.map(({ at, state }) => (
          <span
            key={`segment-${at}`}
            data-qbar={at}
            data-state={state}
            className={`h-1.5 flex-1 rounded-full ${
              state === "done" ? "bg-action" : state === "current" ? "bg-deep" : "bg-line"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The save chip, drawn as the reference draws it: a badge, a mark and a word.
 *
 * The bundle's proto (`js/proto.js`, rc1.3 `01-answer-screen-paused-1223`) paints four states, and
 * each is an `<svg>` beside the label inside one `rounded-full border` pill — the open delta on
 * #1173 was that the live screen drew the word alone, so "no icon" was the whole finding. `sealed`
 * is the fifth, and this screen's own: a sheet that takes no answer says so in the same pill rather
 * than promising a save (`Saves as You Go`) it cannot perform.
 *
 * Tokens only: `synch` / `synch-tint` / `synch-mark` are the design system's "this is settled"
 * family (`components/chat/thread.tsx` draws the same pair), and `line` / `background` are the
 * neutral chip the reference uses for the three unsettled states.
 */
function SaveChip({ state, label }: { readonly state: ChipState; readonly label: string }) {
  const tone =
    state === "saved"
      ? "border-synch-mark bg-synch-tint text-synch"
      : state === "failed"
        ? "border-line bg-background text-foreground"
        : "border-line bg-background text-muted-foreground";

  return (
    <span
      data-saved-state={state}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}
    >
      <svg
        className={`size-3.5 shrink-0${state === "saving" ? " animate-spin" : ""}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <Glyph state={state} />
      </svg>
      <span>{label}</span>
    </span>
  );
}

/**
 * The mark inside the chip — the reference's four, plus the lock the sealed sheet already draws
 * beside its privacy note. Paths, not words: a chip's mark is decorative and `aria-hidden`.
 */
function Glyph({ state }: { readonly state: ChipState }) {
  if (state === "saved") return <path d="M20 6 9 17l-5-5" />;
  if (state === "saving") return <path d="M21 12a9 9 0 1 1-6.22-8.56" />;
  if (state === "failed") {
    return (
      <>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.36 2.36L3 9" />
        <path d="M3 3v6h6" />
      </>
    );
  }
  if (state === "sealed") {
    return (
      <>
        <rect width="18" height="11" x="3" y="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    );
  }
  return (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </>
  );
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
