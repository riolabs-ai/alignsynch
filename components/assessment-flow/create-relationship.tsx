/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: a server component on the app's own route, posting to the route handler — the layout survives, the disabled submit and its "not wired" note do not)
 *
 * `CreateRelationship` — the create flow's five stages, **Details**, **Settings**, **Aspects**,
 * **Account** and **Invite** (#427, #688, #689, #690; five stages since #825).
 *
 * **One form split into four steps, one draft behind all of them.** Until #688 this was a single
 * form: the names, the address, the Mode and the Setting, submitted together or lost together. The
 * approved flow (`docs/review/artifacts/prototype-relationship-lifecycle-v9.html`) makes them
 * stages 1–5, so stage 1 posts to `POST /assessment/new/who` — which answers with a redirect to
 * stage 2 and a draft cookie — stage 2 posts to `POST /assessment/new/mode`, stage 3 saves its
 * list over `POST /assessment/new/aspects`, stage 4 posts the create to `POST /assessment/new`
 * **as a draft**, and stage 5 either sends the invitation or keeps it. The component is one
 * component with a `stage` prop rather than five files because the shell, the template band, the
 * refusal band and the "nothing to copy" screen are the same band on every step; only the body
 * differs, and a second component would have been a copy of one that is 60 % identical.
 *
 * **It renders inside the onboarding flow's shell (#687).** `StageColumn` is the one
 * left-justified column every stage sits in, and `StageRail` is the five-stage rail above it with
 * `current` the stage this screen is. Both are shared components: a flow screen that draws its own
 * column or its own stepper is the defect that card removed.
 *
 * **Stage 4 is the account, and it is where the row is written (#825).** `StageAccount` mounts the
 * app's one sign-in form — the page builds it, because only the page knows whether somebody is
 * signed in — beside the review of the six facts stages 1–3 decided, and its advance posts the
 * create as a `draft`. The account is a stage now, not a gate after the fact: the Initiator is
 * known when the row is written instead of being attached to it afterwards.
 *
 * **Stage 5 is the invite, and it is where the send is decided (#825).** `StageInvite` draws the
 * payment walk beside the two acts — `Send and Continue`, which publishes and mails the one
 * invitation, and `Continue as Draft`, which does neither.
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
  SAVE_MODE_PATH,
  SAVE_WHO_PATH,
  TEMPLATE_LIBRARY_PATH,
  createCommitPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { AspectList } from "./aspect-list";
import { ADVANCE_CLASSES, StageFoot } from "./stage-foot";
import { InviteWalk } from "./invite-walk";
import { StageAccount } from "./stage-account";
import { StageColumn } from "./stage-column";
import { StageInvite } from "./stage-invite";
import { StageOneFields } from "./stage-one-fields";
import { StageRail } from "./stage-rail";
import { StageShell } from "./stage-shell";

/** Which of the create flow's five steps this render is (#688, #689, #690, #825). */
export type CreateStage = 1 | 2 | 3 | 4 | 5;

/** The template being copied, as much of it as this screen prints. */
export interface CreateTemplate {
  /**
   * The record's own **slug** — the address of every stage after the first (#794).
   *
   * The stages used to advance with `recordId`, which built a `/create/commit` address out of an
   * id. The route resolves `[slug]` through the library read, which takes a slug, so the hand-over
   * landed on "no template" for any record whose id is not its slug. The two handles are named
   * apart here so a caller cannot pass one where the other belongs.
   */
  readonly slug: string;
  /** The record's own id — what the hidden field posts back, and the draft cookie's key. */
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

/**
 * The commit form's id (#760). The stage foot's primary sits outside the form — the artifact
 * draws the one advancing act in the foot, not in the card — so it submits by id. A constant
 * rather than a literal in two places: E23 counts a string attribute as copy, and a form id is
 * technical, not a word a reader sees.
 */
const COMMIT_FORM_ID = "create-commit-form";

/**
 * The send form's id (#825). Same reason as `COMMIT_FORM_ID`: the stage foot's one advancing
 * control sits outside the form it submits, so it names the form by id. Technical, not a word a
 * reader sees, so it is a constant here rather than a fixture row.
 */
const SEND_FORM_ID = "create-invite-form";

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
  account,
  accountAdvanceHref,
  instanceRecordId,
}: {
  copy: PageCopy;
  /** 1 = Details, 2 = Settings, 3 = Aspects, 4 = Account, 5 = Invite. Both read it. */
  stage: CreateStage;
  /** The template to copy, or `null` when the refusal means there is none to read. */
  template: CreateTemplate | null;
  /** Stages 1 and 2's saved answers — empty on a first visit, filled from the draft on a return. */
  draft: CreateDraft;
  /**
   * Stage 3's working list (#689): the draft's own when it has one, the template's on a first
   * visit. Absent on stages 1, 2, 4 and 5, which have no list to draw.
   */
  aspects?: readonly AspectDraft[];
  /** Where the back link goes: the template on stage 1, the stage before on 2, 3, 4 and 5. */
  backHref: string;
  /** The fixture's sentence for the refusal that brought the person back; `null` on a clean visit. */
  problem: string | null;
  /** The page the refusal's sentence points at, when it names one (#618). */
  problemLink?: { readonly href: string; readonly label: string } | null;
  /**
   * Stage 4's account column (#825). The page builds it: `LoginView` with `layout="embedded"` when
   * nobody is signed in, a confirmation when somebody is. Absent on every other stage.
   */
  account?: ReactNode;
  /**
   * Stage 4's advance as a link rather than the create form (#825) — the re-entered state, where
   * the relationship already exists and a second write would make a second one.
   */
  accountAdvanceHref?: string;
  /** Stage 5's relationship — the id its send form posts to (#825). Absent on every other stage. */
  instanceRecordId?: string;
}) {
  const band = sectionOf(copy, "template");
  const who = sectionOf(copy, "who");
  const mode = sectionOf(copy, "mode");
  const aspectsSection = sectionOf(copy, "aspects");
  const accountSection = sectionOf(copy, "account");
  const inviteSection = sectionOf(copy, "invite");
  const problems = sectionOf(copy, "problems");
  // The foot's one shared word (#760): `Cancel` is the same act on all five stages, so it has
  // one row in the fixture rather than five copies that could drift.
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
          : stage === 4
            ? accountSection.heading
            : inviteSection.heading;

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
           * Where the person is in the five stages (#687, #825): Details, Settings, Aspects,
           * Account and Invite. There is no conditional cell and nothing to mark unavailable —
           * `Align` left the band when it became the dashboard's surface, so the rail is a plain
           * five and the count says "of 5".
           */}
          <StageRail copy={copy} current={stage} />

          <div>
            <h1
              id="create-stage-heading"
              className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100"
            >
              {heading}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
              {stage === 1
                ? copy.subtitle
                : stage === 2
                  ? sectionBody(mode)
                  : stage === 3
                    ? sectionBody(aspectsSection)
                    : stage === 4
                      ? sectionBody(accountSection)
                      : sectionBody(inviteSection)}
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
                aria-labelledby="create-stage-heading"
                className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
              >
                {/* The template is the route's own fact; the form carries it so the POST names it. */}
                <input type="hidden" name="templateRecordId" value={template.recordId} />

                {/*
                The seven fields, and the one derivation in the flow (#825): the title follows the
                four name inputs until somebody types in it. That is a keystroke-level behaviour, so
                the controls live in a client component (`StageOneFields`) while the form, the
                template band and the foot stay here.

                The inventory is the spec's (`docs/specs/flow-stages.md` → *Stage 1, Details*), and
                `tests/create-fields.test.ts` pins the order, the two columns and the five required
                marks — a sixth field, a moved one or a bare required label is red rather than a
                reviewer's memory.
              */}
                <StageOneFields
                  copy={{
                    titleLabel: itemLabel(who, "title-label"),
                    titleHelp: itemLabel(who, "title-help"),
                    initiatorFirstLabel: itemLabel(who, "initiator-first-label"),
                    initiatorLastLabel: itemLabel(who, "initiator-last-label"),
                    initiatorLastPlaceholder: itemLabel(who, "initiator-last-placeholder"),
                    initiatorHelp: itemLabel(who, "initiator-help"),
                    counterpartyFirstLabel: itemLabel(who, "counterparty-first-label"),
                    counterpartyFirstPlaceholder: itemLabel(who, "counterparty-first-placeholder"),
                    counterpartyLastLabel: itemLabel(who, "counterparty-last-label"),
                    counterpartyLastPlaceholder: itemLabel(who, "counterparty-last-placeholder"),
                    counterpartyHelp: itemLabel(who, "counterparty-help"),
                    emailLabel: itemLabel(who, "email-label"),
                    emailPlaceholder: itemLabel(who, "email-placeholder"),
                    descriptionLabel: itemLabel(who, "description-label"),
                    descriptionPlaceholder: itemLabel(who, "description-placeholder"),
                    descriptionHelp: itemLabel(who, "description-help"),
                    requiredNote: itemLabel(who, "required-note"),
                  }}
                  values={{
                    initiatorFirst: draft.initiatorFirst,
                    initiatorLast: draft.initiatorLast,
                    counterpartyFirst: draft.counterpartyFirst,
                    counterpartyLast: draft.counterpartyLast,
                    title: draft.title,
                    email: draft.email,
                    description: draft.description,
                  }}
                  descriptionDefault={template.summary}
                />

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
                    href={createCommitPath(template.slug)}
                    data-create-next="account"
                    className={ADVANCE_CLASSES}
                  >
                    {itemLabel(aspectsSection, "submit")}
                  </Link>
                }
              />
            </div>
          ) : stage === 4 ? (
            <StageAccount
              copy={copy}
              draft={draft}
              template={{
                recordId: template.recordId,
                title: template.title,
                aspectCount: template.aspectCount,
              }}
              account={account ?? null}
              {...(accountAdvanceHref === undefined ? {} : { advanceHref: accountAdvanceHref })}
              backHref={backHref}
              cancelHref={shell.closeHref}
              cancelLabel={cancelLabel}
              advanceClasses={ADVANCE_CLASSES}
              commitFormId={COMMIT_FORM_ID}
            />
          ) : (
            <StageInvite
              copy={copy}
              draft={draft}
              instanceRecordId={instanceRecordId ?? ""}
              walk={
                <InviteWalk
                  copy={copy}
                  draft={draft}
                  account={
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {itemLabel(accountSection, "signed-in-body")}
                    </p>
                  }
                />
              }
              backHref={backHref}
              cancelHref={shell.closeHref}
              cancelLabel={cancelLabel}
              advanceClasses={ADVANCE_CLASSES}
              sendFormId={SEND_FORM_ID}
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
