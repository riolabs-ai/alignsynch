/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: a server component on the app's own route, posting to the route handler — the layout survives, the disabled submit and its "not wired" note do not)
 *
 * `CreateRelationship` — the create flow's four stages, **Who**, **Mode**, **Aspects** and
 * **Create** (#427, #688, #689, #690).
 *
 * **One form split into four steps, one draft behind all of them.** Until #688 this was a single
 * form: the names, the address, the Mode and the Setting, submitted together or lost together. The
 * approved flow (`docs/review/artifacts/prototype-relationship-lifecycle-v5.html`) makes them
 * stages 1–4, so stage 1 posts to `POST /assessment/new/who` — which answers with a redirect to
 * stage 2 and a draft cookie — stage 2 posts to `POST /assessment/new/mode`, stage 3 saves its
 * list over `POST /assessment/new/aspects`, and stage 4 posts the create to
 * `POST /assessment/new`, which reads the draft and commits. The component is one component with
 * a `stage` prop rather than four files because the shell, the template band, the refusal band and
 * the "nothing to copy" screen are the same band on every step; only the body differs, and a
 * second component would have been a copy of one that is 60 % identical.
 *
 * **It renders inside the onboarding flow's shell (#687).** `StageColumn` is the one
 * left-justified column every stage sits in, and `StageRail` is the six-stage rail above it with
 * `current` the stage this screen is. Both are shared components: a flow screen that draws its own
 * column or its own stepper is the defect that card removed.
 *
 * **Stage 4 is the conversion, not a receipt (#690).** It prints the six facts stages 1–3 decided,
 * offers the two plans as a soft prompt (`PlanChoices` — nothing is charged and nothing is gated on
 * the choice), and holds the one control in the flow that writes. **Nothing asks for an account
 * here**: the account gate follows the commit, and a signed-out visitor creates a relationship and
 * sends its invitation exactly as a signed-in one does (`POST /assessment/new` has always accepted
 * a null initiator — #146/#213 — and this card stops the screen from refusing what the endpoint
 * allows).
 *
 * **Two decisions, stated differently, because they behave differently.**
 *
 *   Mode     fixed at creation. Both parties answer one shape; a sheet that could switch would
 *            let one party answer Basic and the other Advanced on one relationship.
 *   Setting  the one thing a party may change later. It moves the bar the report is judged
 *            against (`SETTING_DEFINITIONS`) and changes no question.
 *
 * Neither is pre-selected: a default would be this form choosing a bar for two people who never
 * saw the question, and the Mode is too consequential to inherit from a designer's taste. Both
 * groups are `required`, so a browser cannot send the form without a choice; the store still
 * refuses a crafted post that omits the Mode, and a Setting it is not given falls to the schema's
 * documented default (see `CreateInstanceInput`).
 *
 * **A refused create is this same screen with a sentence above the form.** The refusal that a
 * server-side validation produces names one field by its own label — "Their email address is
 * required" — and arrives here as the sentence the page composed from the fixture
 * (`lib/flow/create-copy.ts`), so the component renders words it never authored. The store's
 * own refusals (`?problem=<code>`) arrive the same way; when the code means the template cannot
 * be read at all, the screen still renders, with the sentence and a way back, instead of a bare
 * 404 that would swallow the refusal the post just gave.
 *
 * Literal-free: every word is `data/pages/assessment-create.ts` (E23), except the two vocabulary
 * sets the model authors once — `MODE_LABELS` and `SETTING_LABELS`/`SETTING_DEFINITIONS`.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ALIGNMENT_SETTINGS,
  ASSESSMENT_MODES,
  MODE_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
} from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import type { AspectDraft } from "@/lib/flow/aspects";
import type { CreateDraft } from "@/lib/flow/create-draft";
import {
  CREATE_INSTANCE_PATH,
  PRICING_PATH,
  SAVE_MODE_PATH,
  SAVE_WHO_PATH,
  createCommitPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { AspectList } from "./aspect-list";
import { PlanChoices } from "./plan-choices";
import { StageColumn } from "./stage-column";
import { StageRail } from "./stage-rail";

/** Which of the create flow's four steps this render is (#688, #689, #690). */
export type CreateStage = 1 | 2 | 3 | 4;

/** The template being copied, as much of it as this screen prints. */
export interface CreateTemplate {
  /** The record's own id — what the hidden field posts back. */
  readonly recordId: string;
  readonly title: string;
  readonly summary: string;
  readonly aspectCount: number;
}

/** The band a refusal is drawn in, shared by both stages and by the read-nothing one. */
function ProblemBand({
  heading,
  sentence,
  link,
}: {
  heading: string | undefined;
  sentence: string | null;
  /**
   * The door the sentence names, when it names one (#618).
   *
   * `relationship-limit` and `mode-not-entitled` both tell a person to change their plan and, until
   * that card, drew nothing to click. The label comes from the page fixture; the address is
   * `/pricing` rather than a checkout session, because a checkout is started from the plan card
   * that sells a specific tier (`components/pricing/plan-checkout-button.tsx`).
   */
  link?: { readonly href: string; readonly label: string } | null;
}) {
  if (sentence === null) return null;
  return (
    <div
      data-create-problem="true"
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-gray-800 dark:border-amber-700 dark:bg-amber-950 dark:text-gray-200"
    >
      {heading === undefined ? null : <p className="font-semibold">{heading}</p>}
      <p id="create-problem" className="mt-1">
        {sentence}
      </p>
      {link === undefined || link === null ? null : (
        <p className="mt-2">
          <Link
            href={link.href}
            data-create-problem-link={link.href}
            className="font-medium text-action underline"
          >
            {link.label}
          </Link>
        </p>
      )}
    </div>
  );
}

/** The field's label above a control: one shape for every input on both stages. */
function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="font-medium text-gray-700 dark:text-gray-200">{children}</span>;
}

/** The sentence under a control — helper text, or what the field is for. */
function FieldHelp({ children }: { children: ReactNode }) {
  return <span className="text-xs text-gray-500 dark:text-gray-400">{children}</span>;
}

/** The shared input shape — the shipped create form's own classes, not a second style. */
const INPUT_CLASSES =
  "rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950";

export function CreateRelationship({
  copy,
  stage,
  template,
  draft,
  aspects,
  backHref,
  problem,
  problemLink,
}: {
  copy: PageCopy;
  /** 1 = Who, 2 = Mode, 3 = Aspects, 4 = Create. The rail and the body both read it. */
  stage: CreateStage;
  /** The template to copy, or `null` when the refusal means there is none to read. */
  template: CreateTemplate | null;
  /** Stages 1 and 2's saved answers — empty on a first visit, filled from the draft on a return. */
  draft: CreateDraft;
  /**
   * Stage 3's working list (#689): the draft's own when it has one, the template's on a first
   * visit. Absent on stages 1, 2 and 4, which have no list to draw.
   */
  aspects?: readonly AspectDraft[];
  /** Where the back link goes: the template on stage 1, the stage before on 2, 3 and 4. */
  backHref: string;
  /** The fixture's sentence for the refusal that brought the person back; `null` on a clean visit. */
  problem: string | null;
  /** The page the refusal's sentence points at, when it names one (#618). */
  problemLink?: { readonly href: string; readonly label: string } | null;
}) {
  const band = sectionOf(copy, "template");
  const who = sectionOf(copy, "who");
  const mode = sectionOf(copy, "mode");
  const aspectsSection = sectionOf(copy, "aspects");
  const commit = sectionOf(copy, "commit");
  const review = sectionOf(copy, "review");
  const plans = sectionOf(copy, "plans");
  const problems = sectionOf(copy, "problems");

  // The refusal that leaves nothing to copy: still a page, never a 404 that loses the sentence.
  if (template === null) {
    const empty = sectionOf(copy, "refused");
    return (
      <StageColumn>
        <div className="space-y-6">
          <p>
            <Link href={backHref} className="text-sm font-medium text-action hover:underline">
              {itemLabel(empty, "back")}
            </Link>
          </p>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {empty.heading}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
              {sectionBody(empty)}
            </p>
          </div>
          <ProblemBand heading={problems.heading} sentence={problem} link={problemLink} />
        </div>
      </StageColumn>
    );
  }

  return (
    <StageColumn>
      <div className="space-y-6">
        <p>
          <Link href={backHref} className="text-sm font-medium text-action hover:underline">
            {stage === 1
              ? itemLabel(band, "back")
              : stage === 2
                ? itemLabel(mode, "back")
                : stage === 3
                  ? itemLabel(aspectsSection, "back")
                  : itemLabel(commit, "back")}
          </Link>
        </p>

        {/* Where the person is in the six stages (#687): Who, Mode, Aspects and Create are the first four. */}
        <StageRail copy={copy} current={stage} />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {stage === 1
              ? copy.heading
              : stage === 2
                ? mode.heading
                : stage === 3
                  ? aspectsSection.heading
                  : commit.heading}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            {stage === 1
              ? copy.subtitle
              : stage === 2
                ? sectionBody(mode)
                : stage === 3
                  ? sectionBody(aspectsSection)
                  : sectionBody(commit)}
          </p>
        </div>

        <ProblemBand heading={problems.heading} sentence={problem} link={problemLink} />

        {stage === 1 ? (
          <>
            {/* What is being copied — its name, its words and its size, all from the record. */}
            <section
              aria-labelledby="create-template-heading"
              className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <h2
                id="create-template-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {band.heading}
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(band)}</p>
              <div className="mt-3 rounded-md border border-gray-200 px-3 py-2.5 dark:border-gray-700">
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {template.title}
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">
                  {template.summary}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {fillLabel(itemLabel(band, "aspects"), { count: template.aspectCount })}
                </p>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
                {itemLabel(band, "seats")}
              </p>
            </section>

            <form
              action={SAVE_WHO_PATH}
              method="post"
              aria-labelledby="create-who-heading"
              className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <h2
                id="create-who-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {who.heading}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{sectionBody(who)}</p>

              {/* The template is the route's own fact; the form carries it so the POST names it. */}
              <input type="hidden" name="templateRecordId" value={template.recordId} />

              <label className="grid gap-1 text-sm" htmlFor="create-initiator-name">
                <FieldLabel>{itemLabel(who, "initiator-label")}</FieldLabel>
                <input
                  id="create-initiator-name"
                  name="initiatorName"
                  defaultValue={draft.initiatorName}
                  className={INPUT_CLASSES}
                />
                <FieldHelp>{itemLabel(who, "initiator-help")}</FieldHelp>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm" htmlFor="create-counterparty-name">
                  <FieldLabel>{itemLabel(who, "counterparty-label")}</FieldLabel>
                  <input
                    id="create-counterparty-name"
                    name="counterpartyName"
                    defaultValue={draft.counterpartyName}
                    placeholder={itemLabel(who, "counterparty-placeholder")}
                    className={INPUT_CLASSES}
                  />
                  <FieldHelp>{itemLabel(who, "counterparty-help")}</FieldHelp>
                </label>

                <label className="grid gap-1 text-sm" htmlFor="create-email">
                  <FieldLabel>{itemLabel(who, "email-label")}</FieldLabel>
                  <input
                    id="create-email"
                    name="email"
                    type="email"
                    defaultValue={draft.email}
                    placeholder={itemLabel(who, "email-placeholder")}
                    className={INPUT_CLASSES}
                  />
                  <FieldHelp>{itemLabel(who, "email-help")}</FieldHelp>
                </label>
              </div>

              <label className="grid gap-1 text-sm" htmlFor="create-title">
                <FieldLabel>{itemLabel(who, "title-label")}</FieldLabel>
                <input
                  id="create-title"
                  name="title"
                  defaultValue={draft.title}
                  placeholder={itemLabel(who, "title-placeholder")}
                  className={INPUT_CLASSES}
                />
                <FieldHelp>{itemLabel(who, "title-help")}</FieldHelp>
              </label>

              <label className="grid gap-1 text-sm" htmlFor="create-description">
                <FieldLabel>{itemLabel(who, "description-label")}</FieldLabel>
                <textarea
                  id="create-description"
                  name="description"
                  rows={3}
                  defaultValue={draft.description}
                  placeholder={itemLabel(who, "description-placeholder")}
                  className={INPUT_CLASSES}
                />
                <FieldHelp>{itemLabel(who, "description-help")}</FieldHelp>
              </label>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground"
                >
                  {itemLabel(who, "submit")}
                </button>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {itemLabel(who, "submit-note")}
                </p>
              </div>
            </form>
          </>
        ) : stage === 2 ? (
          <form
            action={SAVE_MODE_PATH}
            method="post"
            aria-labelledby="create-mode-heading"
            className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          >
            <h2
              id="create-mode-heading"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {mode.heading}
            </h2>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
              {itemLabel(mode, "mode-fixed")}
            </p>

            {/* The template is the route's own fact; the form carries it so the POST names it. */}
            <input type="hidden" name="templateRecordId" value={template.recordId} />

            {/* Mode — fixed at creation, and said so on the form. */}
            <fieldset className="grid gap-2 text-sm">
              <legend className="font-medium text-gray-700 dark:text-gray-200">
                {itemLabel(mode, "mode-label")}
              </legend>
              {ASSESSMENT_MODES.map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <input
                    type="radio"
                    name="mode"
                    value={option}
                    required
                    defaultChecked={draft.mode === option}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {MODE_LABELS[option]}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {option === "basic"
                        ? itemLabel(mode, "mode-basic-help")
                        : itemLabel(mode, "mode-advanced-help")}
                    </span>
                  </span>
                </label>
              ))}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(mode, "mode-fixed-note")}
              </p>
            </fieldset>

            {/* Setting — the bar the report is judged against, and the one choice a party may change. */}
            <fieldset className="grid gap-2 text-sm">
              <legend className="font-medium text-gray-700 dark:text-gray-200">
                {itemLabel(mode, "setting-label")}
              </legend>
              {ALIGNMENT_SETTINGS.map((option) => (
                <label
                  key={option}
                  className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <input
                    type="radio"
                    name="alignmentSetting"
                    value={option}
                    required
                    defaultChecked={draft.alignmentSetting === option}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {SETTING_LABELS[option]}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                      {SETTING_DEFINITIONS[option]}
                    </span>
                  </span>
                </label>
              ))}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(mode, "setting-changeable")}
              </p>
            </fieldset>

            {/* The point of action: the control, enabled, with what it will do beside it. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="submit"
                className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground"
              >
                {itemLabel(mode, "submit")}
              </button>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {itemLabel(mode, "submit-note")}
              </p>
            </div>
          </form>
        ) : stage === 3 ? (
          <div className="space-y-5">
            {/*
              The list itself (#689). It is the one client component in this stage: a row opens in
              place, saves itself and collapses again, and the order is dragged — none of which a
              page navigation can do. It writes the list into the same draft cookie the two stages
              above wrote, so a reload renders what the person left behind.
            */}
            <AspectList copy={copy} templateRecordId={template.recordId} aspects={aspects ?? []} />

            {/*
              Stage 3 hands over; it does not create (#690). Until stage 4 existed the create sat
              on this control, which made the Aspects the last word on a relationship. The approved
              flow puts the review, the plans and the conversion after the list, so this is a plain
              link to the last stage — a GET, because going to a screen must never write.
            */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Link
                href={createCommitPath(template.recordId)}
                data-create-next="commit"
                className="inline-flex h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover"
              >
                {itemLabel(aspectsSection, "submit")}
              </Link>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {itemLabel(aspectsSection, "submit-note")}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            {/*
              LEFT — the two plans, as the soft half of the payment decision (#690). Nothing here
              is charged and nothing here blocks: the create posts without a plan, and the hard
              gate is at publish (`components/dashboard/relationship-detail.tsx`).
            */}
            <section
              aria-labelledby="create-plans-heading"
              data-create-plans="true"
              className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                  id="create-plans-heading"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {plans.heading}
                </h2>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
                  {itemLabel(plans, "trial-short")}
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">{sectionBody(plans)}</p>
              <PlanChoices copy={copy} />
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {itemLabel(plans, "trial")}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                {itemLabel(plans, "add-method-note")}
              </p>
              <p>
                <Link
                  href={PRICING_PATH}
                  data-create-plans-link="pricing"
                  className="text-sm font-medium text-action hover:underline"
                >
                  {itemLabel(plans, "add-method")}
                </Link>
              </p>
            </section>

            <aside className="space-y-5">
              {/*
                The conversion. A plain form posting to the create endpoint: the draft already
                carries who, mode, setting and the list, so the post names the template and nothing
                else, and a reload of the refusal cannot create a second relationship.
              */}
              <form
                action={CREATE_INSTANCE_PATH}
                method="post"
                aria-labelledby="create-commit-heading"
                data-create-commit="true"
                className="space-y-3 rounded-lg border border-action bg-white p-4 dark:bg-gray-900"
              >
                <h2
                  id="create-commit-heading"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {itemLabel(commit, "cta-heading")}
                </h2>
                <input type="hidden" name="templateRecordId" value={template.recordId} />
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover"
                >
                  {itemLabel(commit, "submit")}
                </button>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {itemLabel(commit, "cta-body")}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {itemLabel(commit, "reassure")}
                </p>
              </form>

              {/*
                The six facts stages 1–3 decided, printed back for one last read — the template
                (with its own Aspect count), both seats, the title, the Mode and the Setting. The
                Aspect *count* rather than the list: the list is stage 3, one link back.
              */}
              <section
                aria-labelledby="create-review-heading"
                data-create-review="true"
                className="space-y-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <h2
                  id="create-review-heading"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {review.heading}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">{sectionBody(review)}</p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3" data-create-fact="true">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {itemLabel(review, "template")}
                    </dt>
                    <dd className="text-right text-gray-900 dark:text-gray-100">
                      {template.title}
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {fillLabel(itemLabel(band, "aspects"), { count: template.aspectCount })}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3" data-create-fact="true">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {itemLabel(review, "initiator")}
                    </dt>
                    <dd className="text-right text-gray-900 dark:text-gray-100">
                      {orNone(review, draft.initiatorName)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3" data-create-fact="true">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {itemLabel(review, "counterparty")}
                    </dt>
                    <dd className="text-right text-gray-900 dark:text-gray-100">
                      {orNone(review, draft.counterpartyName)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3" data-create-fact="true">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {itemLabel(review, "title")}
                    </dt>
                    <dd className="text-right text-gray-900 dark:text-gray-100">
                      {orNone(review, draft.title)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3" data-create-fact="true">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {itemLabel(review, "mode")}
                    </dt>
                    <dd className="text-right text-gray-900 dark:text-gray-100">
                      {MODE_LABELS[draft.mode as keyof typeof MODE_LABELS] ??
                        itemLabel(review, "none")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3" data-create-fact="true">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {itemLabel(review, "setting")}
                    </dt>
                    <dd className="text-right text-gray-900 dark:text-gray-100">
                      {SETTING_LABELS[draft.alignmentSetting as keyof typeof SETTING_LABELS] ??
                        itemLabel(review, "none")}
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        )}
      </div>
    </StageColumn>
  );
}

/** A value, or the fixture's dash when the person left it blank. */
function orNone(copy: ReturnType<typeof sectionOf>, value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? itemLabel(copy, "none") : trimmed;
}
