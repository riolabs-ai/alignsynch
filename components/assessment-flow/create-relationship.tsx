/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: a server component on the app's own route, posting to the route handler — the layout survives, the disabled submit and its "not wired" note do not)
 *
 * `CreateRelationship` — the create flow's four stages, **Details**, **Settings**, **Aspects** and
 * **Invite** (#427, #688, #689, #690; named by #735).
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
  SAVE_MODE_PATH,
  SAVE_WHO_PATH,
  TEMPLATE_LIBRARY_PATH,
  createCommitPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { AspectList } from "./aspect-list";
import { PlanChoices } from "./plan-choices";
import { ADVANCE_CLASSES, StageFoot } from "./stage-foot";
import { StageFour } from "./stage-four";
import { StageColumn } from "./stage-column";
import { StageRail } from "./stage-rail";
import { StageShell } from "./stage-shell";

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

/**
 * The commit form's id (#760). The stage foot's primary sits outside the form — the artifact
 * draws the one advancing act in the foot, not in the card — so it submits by id. A constant
 * rather than a literal in two places: E23 counts a string attribute as copy, and a form id is
 * technical, not a word a reader sees.
 */
const COMMIT_FORM_ID = "create-commit-form";

/** One option of a single-select group: the value stored, the word, and what it does. */
interface ChoiceOption {
  readonly value: string;
  readonly label: string;
  readonly help: string;
}

/**
 * **One single-select group**, drawn twice on Settings (#760).
 *
 * Opinions Mode and Alignment Setting are two dimensions of equal weight, so they are the same
 * control and not a control and a toolbar: a `fieldset` with the live legend, one bordered cell
 * per option, a native `required` radio (the browser's own single-choice contract — arrow keys
 * move within one `name`) and the option's one-line glossary help. The peers sit side by side
 * from `sm` up, one column below it.
 *
 * `badge` is the "Fixed at creation" chip beside the Opinions Mode legend; `intro` and `note` are
 * the Alignment Setting's sentence above the cells and its threshold line under them.
 */
function ChoiceFieldset({
  name,
  legend,
  options,
  selected,
  badge,
  intro,
  note,
}: {
  name: string;
  legend: string;
  options: readonly ChoiceOption[];
  selected: string | undefined;
  badge?: string;
  intro?: string;
  note?: string;
}) {
  return (
    <fieldset
      data-choice-group={name}
      className="grid content-start gap-2 rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-700"
    >
      <legend className="font-medium text-gray-800 dark:text-gray-100">
        {legend}
        {badge === undefined ? null : (
          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {badge}
          </span>
        )}
      </legend>
      {intro === undefined ? null : (
        <p className="text-xs text-gray-500 dark:text-gray-400">{intro}</p>
      )}
      <div className="grid gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              required
              defaultChecked={selected === option.value}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-gray-800 dark:text-gray-100">{option.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {option.help}
              </span>
            </span>
          </label>
        ))}
      </div>
      {note === undefined ? null : (
        <p className="text-xs text-gray-500 dark:text-gray-400">{note}</p>
      )}
    </fieldset>
  );
}

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
  /** 1 = Details, 2 = Settings, 3 = Aspects, 4 = Invite. The rail and the body both read it. */
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
  // The foot's one shared word (#760): `Cancel` is the same act on all four stages, so it has
  // one row in the fixture rather than four copies that could drift.
  const foot = sectionOf(copy, "foot");
  const cancelLabel = itemLabel(foot, "cancel");
  // The shell's one own control (#709). The six stage names are the section's other items; this
  // word is here because the rail and the modal are drawn by the same shell.
  const stages = sectionOf(copy, "stages");
  const shell = {
    closeLabel: itemLabel(stages, "close"),
    // Leaving the flow goes back to the library the flow was started from — the gallery the
    // approved artifact closes onto. Stages 2–4 pass through it too: a dismissal is not a
    // "previous step", and a close that walked backwards would leave four ways out of one modal.
    closeHref: TEMPLATE_LIBRARY_PATH,
  };

  // The stage's heading, computed once: it is both the screen's `<h1>` and the dialog's
  // accessible name (#709), so the two can never name the screen differently.
  const heading =
    stage === 1
      ? copy.heading
      : stage === 2
        ? mode.heading
        : stage === 3
          ? aspectsSection.heading
          : commit.heading;

  /**
   * Settings' two option lists (#760), built from the model's own vocabulary — `MODE_LABELS` and
   * `SETTING_DEFINITIONS` are authored once in `content/assessment.ts`, so this screen cannot
   * describe a Mode or a Setting differently from the answer sheet that asks it. Only the
   * *headings* and the two Mode helps are fixture copy.
   */
  const modeOptions: ChoiceOption[] = ASSESSMENT_MODES.map((option) => ({
    value: option,
    label: MODE_LABELS[option],
    help: itemLabel(mode, option === "basic" ? "mode-basic-help" : "mode-advanced-help"),
  }));
  const settingOptions: ChoiceOption[] = ALIGNMENT_SETTINGS.map((option) => ({
    value: option,
    label: SETTING_LABELS[option],
    help: SETTING_DEFINITIONS[option],
  }));

  // The refusal that leaves nothing to copy: still a page, never a 404 that loses the sentence.
  if (template === null) {
    const empty = sectionOf(copy, "refused");
    return (
      <StageShell title={empty.heading} {...shell}>
        <StageColumn>
          <div className="space-y-6">
            <p>
              <Link
                href={backHref}
                className="inline-flex h-11 items-center text-sm font-medium text-action hover:underline"
              >
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
      </StageShell>
    );
  }

  return (
    <StageShell title={heading} {...shell}>
      <StageColumn>
        <div className="space-y-6">
          {/*
           * **One back affordance per screen, and it lives in the foot** (#760). Stages 2–4 used
           * to draw a bare `Back` link at the top of the column while stage 1 drew its own in the
           * form's action row — three shapes for one act, and none of them the pair the artifact
           * draws. The foot below is now the only place it appears, on all four stages.
           */}

          {/*
           * Where the person is in the six stages (#687, renamed by #735): Details, Settings,
           * Aspects and Invite are the first four. `Align` is drawn unavailable here — the
           * relationship this flow creates has no shared assessment until somebody has claimed
           * the invitation and answered.
           */}
          <StageRail copy={copy} current={stage} alignHref={null} />

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {heading}
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

                {/*
                The inventory the spec fixes (`docs/specs/flow-stages.md` → *Stage 1, Details*):
                initiator and counterparty on row 1, email and title on row 2, the description
                across row 3 — four 6-span fields and one 12-span, in that order, and nothing else.
                `tests/create-fields.test.ts` asserts the order and the spans, so a sixth field or
                a moved one is red rather than a reviewer's memory.
              */}
                <div className="grid gap-3 sm:grid-cols-12">
                  <label
                    className="grid gap-1 text-sm sm:col-span-6"
                    htmlFor="create-initiator-name"
                  >
                    <FieldLabel>{itemLabel(who, "initiator-label")}</FieldLabel>
                    <input
                      id="create-initiator-name"
                      name="initiatorName"
                      defaultValue={draft.initiatorName}
                      className={INPUT_CLASSES}
                    />
                    <FieldHelp>{itemLabel(who, "initiator-help")}</FieldHelp>
                  </label>

                  <label
                    className="grid gap-1 text-sm sm:col-span-6"
                    htmlFor="create-counterparty-name"
                  >
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

                  {/* No help line: the artifact draws none under the address (`email-help` is gone). */}
                  <label className="grid gap-1 text-sm sm:col-span-6" htmlFor="create-email">
                    <FieldLabel>{itemLabel(who, "email-label")}</FieldLabel>
                    <input
                      id="create-email"
                      name="email"
                      type="email"
                      defaultValue={draft.email}
                      placeholder={itemLabel(who, "email-placeholder")}
                      className={INPUT_CLASSES}
                    />
                  </label>

                  <label className="grid gap-1 text-sm sm:col-span-6" htmlFor="create-title">
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

                  <label className="grid gap-1 text-sm sm:col-span-12" htmlFor="create-description">
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
                </div>

                {/* The stage foot (#760): `[Back][Cancel]` left, the advance flush right. */}
                <StageFoot
                  backHref={backHref}
                  backLabel={itemLabel(who, "back")}
                  cancelHref={shell.closeHref}
                  cancelLabel={cancelLabel}
                  advance={
                    <button type="submit" className={ADVANCE_CLASSES}>
                      {itemLabel(who, "submit")}
                    </button>
                  }
                />
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
              <p className="text-sm text-gray-600 dark:text-gray-300">{sectionBody(mode)}</p>

              {/* The template is the route's own fact; the form carries it so the POST names it. */}
              <input type="hidden" name="templateRecordId" value={template.recordId} />

              {/*
               * **Two peers, not two stacks** (#760). Opinions Mode and Alignment Setting are two
               * independent dimensions of equal weight — the Mode decides how many Opinion
               * questions an Aspect asks, the Setting decides how strictly the Gap is judged — so
               * they are drawn with one control, side by side from `sm` up and one column below
               * it. The badge is the one sentence Mode needs ("Fixed at creation"); the Setting
               * carries its own lens line above and its threshold line below.
               */}
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceFieldset
                  name="mode"
                  legend={itemLabel(mode, "mode-label")}
                  badge={itemLabel(mode, "mode-fixed")}
                  options={modeOptions}
                  selected={draft.mode}
                />
                <ChoiceFieldset
                  name="alignmentSetting"
                  legend={itemLabel(mode, "setting-label")}
                  intro={itemLabel(mode, "setting-help")}
                  note={itemLabel(mode, "setting-note")}
                  options={settingOptions}
                  selected={draft.alignmentSetting}
                />
              </div>

              {/* The stage foot (#760): `[Back][Cancel]` left, the advance flush right. */}
              <StageFoot
                backHref={backHref}
                backLabel={itemLabel(mode, "back")}
                cancelHref={shell.closeHref}
                cancelLabel={cancelLabel}
                advance={
                  <button type="submit" className={ADVANCE_CLASSES}>
                    {itemLabel(mode, "submit")}
                  </button>
                }
              />
            </form>
          ) : stage === 3 ? (
            <div className="space-y-5">
              {/*
              The list itself (#689). It is the one client component in this stage: a row opens in
              place, saves itself and collapses again, and the order is dragged — none of which a
              page navigation can do. It writes the list into the same draft cookie the two stages
              above wrote, so a reload renders what the person left behind.
            */}
              <AspectList
                copy={copy}
                templateRecordId={template.recordId}
                aspects={aspects ?? []}
              />

              {/*
              Stage 3 hands over; it does not create (#690). Until stage 4 existed the create sat
              on this control, which made the Aspects the last word on a relationship. The approved
              flow puts the review, the plans and the conversion after the list, so this is a plain
              link to the last stage — a GET, because going to a screen must never write.
            */}
              {/* The stage foot (#760): `[Back][Cancel]` left, the hand-over flush right. */}
              <StageFoot
                backHref={backHref}
                backLabel={itemLabel(aspectsSection, "back")}
                cancelHref={shell.closeHref}
                cancelLabel={cancelLabel}
                advance={
                  <Link
                    href={createCommitPath(template.recordId)}
                    data-create-next="commit"
                    className={ADVANCE_CLASSES}
                  >
                    {itemLabel(aspectsSection, "submit")}
                  </Link>
                }
              />
            </div>
          ) : (
            <StageFour
              copy={copy}
              draft={draft}
              template={{
                recordId: template.recordId,
                title: template.title,
                aspectCount: template.aspectCount,
              }}
              backHref={backHref}
              cancelHref={shell.closeHref}
              cancelLabel={cancelLabel}
              advanceClasses={ADVANCE_CLASSES}
              commitFormId={COMMIT_FORM_ID}
            />
          )}
        </div>
      </StageColumn>
    </StageShell>
  );
}

/** A value, or the fixture's dash when the person left it blank. */
function orNone(copy: ReturnType<typeof sectionOf>, value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? itemLabel(copy, "none") : trimmed;
}
