/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: a server component on the app's own route, posting to the route handler — the layout survives, the disabled submit and its "not wired" note do not)
 *
 * `CreateRelationship` — the create flow's first three stages, **Who**, **Mode** and **Aspects**
 * (#427, #688, #689).
 *
 * **One form split into two steps, one draft behind both.** Until #688 this was a single form:
 * the names, the address, the Mode and the Setting, submitted together or lost together. The
 * approved flow (`docs/review/artifacts/prototype-relationship-lifecycle-v5.html`) makes them
 * stage 1 and stage 2, so stage 1 posts to `POST /assessment/new/who` — which answers with a
 * redirect to stage 2 and a draft cookie — and stage 2 posts to `POST /assessment/new`, which
 * reads that draft and commits. The component is one component with a `stage` prop rather than
 * two files because the shell, the template band, the refusal band and the "nothing to copy"
 * screen are the same band on both steps; only the form differs, and a second component would
 * have been a copy of one that is 60 % identical.
 *
 * **It renders inside the onboarding flow's shell (#687).** `StageColumn` is the one
 * left-justified column every stage sits in, and `StageRail` is the six-stage rail above it
 * with `current` the stage this screen is. Both are shared components: a flow screen that draws
 * its own column or its own stepper is the defect that card removed.
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
import { CREATE_INSTANCE_PATH, SAVE_MODE_PATH, SAVE_WHO_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { AspectList } from "./aspect-list";
import { StageColumn } from "./stage-column";
import { StageRail } from "./stage-rail";

/** Which of the create flow's three steps this render is (#688, #689). */
export type CreateStage = 1 | 2 | 3;

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
  gate,
}: {
  copy: PageCopy;
  /** 1 = Who, 2 = Mode, 3 = Aspects. The rail and the form both read it. */
  stage: CreateStage;
  /** The template to copy, or `null` when the refusal means there is none to read. */
  template: CreateTemplate | null;
  /** Stage 1's saved answers — empty on a first visit, filled from the draft on a return. */
  draft: CreateDraft;
  /**
   * Stage 3's working list (#689): the draft's own when it has one, the template's on a first
   * visit. Absent on stages 1 and 2, which have no list to draw.
   */
  aspects?: readonly AspectDraft[];
  /** Where the back link goes: the template on stage 1, the stage before on 2 and 3. */
  backHref: string;
  /** The fixture's sentence for the refusal that brought the person back; `null` on a clean visit. */
  problem: string | null;
  /** The page the refusal's sentence points at, when it names one (#618). */
  problemLink?: { readonly href: string; readonly label: string } | null;
  /**
   * The two auth links when **nobody is signed in**, and `null` when somebody is (#618).
   *
   * A signed-out visitor gets the account gate instead of the form. Both links carry `next` = this
   * template's create path, so the chosen product survives the round trip in the URL. The signed-out
   * form is deliberately not drawn: `POST /assessment/new` writes a null initiator, and a
   * relationship with no account is in nobody's list — the creator could not find it again to
   * invite, finish or pay for it.
   */
  gate: { readonly signInHref: string; readonly signUpHref: string } | null;
}) {
  const band = sectionOf(copy, "template");
  const who = sectionOf(copy, "who");
  const mode = sectionOf(copy, "mode");
  const aspectsSection = sectionOf(copy, "aspects");
  const problems = sectionOf(copy, "problems");
  const accountGate = sectionOf(copy, "gate");

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
                : itemLabel(aspectsSection, "back")}
          </Link>
        </p>

        {/* Where the person is in the six stages (#687): Who, Mode and Aspects are the first three. */}
        <StageRail copy={copy} current={stage} />

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {stage === 1 ? copy.heading : stage === 2 ? mode.heading : aspectsSection.heading}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
            {stage === 1
              ? copy.subtitle
              : stage === 2
                ? sectionBody(mode)
                : sectionBody(aspectsSection)}
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

            {gate === null ? (
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
            ) : (
              <section
                data-create-gate="true"
                className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {accountGate.heading}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {sectionBody(accountGate)}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href={gate.signUpHref}
                    data-create-gate-link="sign-up"
                    className="inline-flex h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover"
                  >
                    {itemLabel(accountGate, "sign-up")}
                  </a>
                  <a
                    href={gate.signInHref}
                    data-create-gate-link="sign-in"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    {itemLabel(accountGate, "sign-in")}
                  </a>
                </div>
              </section>
            )}
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
        ) : (
          <div className="space-y-5">
            {/*
              The list itself (#689). It is the one client component in the flow: a row opens in
              place, saves itself and collapses again, and the order is dragged — none of which a
              page navigation can do. It writes the list into the same draft cookie the two stages
              above wrote, so a reload renders what the person left behind.
            */}
            <AspectList copy={copy} templateRecordId={template.recordId} aspects={aspects ?? []} />

            {/*
              The create stays behind the last stage's control, and it is still a plain form: the
              draft now carries everything the endpoint needs (who, mode, setting, this list), so
              the post names the template and nothing else.
            */}
            <form
              action={CREATE_INSTANCE_PATH}
              method="post"
              aria-labelledby="create-aspects-create-heading"
              className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <h2
                id="create-aspects-create-heading"
                className="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                {itemLabel(aspectsSection, "submit")}
              </h2>
              <input type="hidden" name="templateRecordId" value={template.recordId} />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground"
                >
                  {itemLabel(aspectsSection, "submit")}
                </button>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {itemLabel(aspectsSection, "submit-note")}
                </p>
              </div>
            </form>
          </div>
        )}
      </div>
    </StageColumn>
  );
}
