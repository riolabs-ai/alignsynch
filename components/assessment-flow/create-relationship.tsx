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
import { fieldSentence } from "@/lib/flow/create-copy";
import type { CreateDraft } from "@/lib/flow/create-draft";
import {
  RELATIONSHIPS_PATH,
  SAVE_MODE_PATH,
  SAVE_WHO_PATH,
  TEMPLATE_LIBRARY_PATH,
  createCommitPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { AspectList } from "./aspect-list";
import { ADVANCE_CLASSES, StageFoot } from "./stage-foot";
import type { CheckoutHandlers } from "./invite-walk";
import { RelationshipFlowShell, type FlowMount } from "./relationship-flow-shell";
import { StageAccount } from "./stage-account";
import { type ChoiceGroup, StageChoiceForm } from "./stage-choice-form";
import { StageInvite } from "./stage-invite";
import { StageOneFields } from "./stage-one-fields";

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

/**
 * The band a refusal is drawn in, shared by every stage and by the read-nothing one.
 *
 * **It always carries an action (#870).** The rule this component exists to enforce: *no stage
 * renders a band that has no action and no primary action below it.* Before the card every refusal
 * code returned `link: null`, and stage 5 — where an unpublished template was refused — drew a
 * yellow band, the right-hand summary and **nothing else**: no send, no draft, no way out. A refusal
 * is correct information; a refusal with no handle is a dead end.
 *
 * So `link` is what the page named, and when the page named nothing the fallback is the
 * relationships list — the one destination every refusal can honestly offer, because the person is
 * always somewhere in the middle of starting a relationship. When a specific door *is* named it is
 * drawn as the primary act and the list is kept beside it as the way back, so "fix it" and "leave
 * this" are never confused for one another.
 */
function ProblemBand({
  heading,
  sentence,
  link,
  back,
}: {
  heading: string | undefined;
  sentence: string | null;
  /**
   * The door the sentence names. `relationship-limit` and `mode-not-entitled` point at the plans
   * page (#618); the template codes point at the template or the library (#870).
   */
  link?: { readonly href: string; readonly label: string } | null;
  /** The fixture's "back to my relationships" — the fallback door, and the secondary one. */
  back: { readonly href: string; readonly label: string };
}) {
  if (sentence === null) return null;
  // One door, always: the named one when the page named one, the relationships list otherwise.
  const primary = link ?? back;
  const secondary = link === undefined || link === null ? null : back;
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
      <div className="mt-2 flex flex-wrap items-center gap-x-4">
        <Link
          href={primary.href}
          data-create-problem-link={primary.href}
          className="font-medium text-action underline"
        >
          {primary.label}
        </Link>
        {secondary === null ? null : (
          <Link
            href={secondary.href}
            data-create-problem-secondary={secondary.href}
            // 44px like every other in-card link (#745's floor). It sits on its own row, so it can
            // carry the box without breaking a sentence — and it is *not* the band's inline link,
            // so it is not the one target `tests/stage-shell-mobile.test.tsx` exempts.
            className="inline-flex h-11 items-center font-medium text-gray-700 underline dark:text-gray-200"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * A plan the stage is telling you about, **not refusing you** (#834).
 *
 * Same words as the refusal's (`problems.mode-not-entitled`), different job: after #834 a draft is
 * written whatever Mode it asks for, and the plan question is asked here, on the stage that carries
 * the send. So this is `role="status"`, drawn with `data-create-notice` rather than
 * `data-create-problem`, and the stage's own action stays enabled — the point is that the person can
 * still send, or keep the draft and read the plans, instead of meeting a wall one stage too early.
 */
function NoticeBand({
  sentence,
  link,
}: {
  sentence: string | null;
  link?: { readonly href: string; readonly label: string } | null;
}) {
  if (sentence === null) return null;
  return (
    <div
      data-create-notice="true"
      role="status"
      className="rounded-lg border border-gray-300 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      <p id="create-notice">{sentence}</p>
      {link === undefined || link === null ? null : (
        <p className="mt-2">
          <Link
            href={link.href}
            data-create-notice-link={link.href}
            // 44px like every other in-card link (#745's floor): this one sits in its own line,
            // so it can carry the box without breaking the sentence it is not inside.
            className="inline-flex h-11 items-center font-medium text-action underline"
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

/** One option of a single-select group: the value stored, the word, and what it does. */
interface ChoiceOption {
  readonly value: string;
  readonly label: string;
  readonly help: string;
}

export function CreateRelationship({
  copy,
  stage,
  mount = "page",
  template,
  draft,
  aspects,
  backHref,
  problem,
  problemLink,
  notice,
  noticeLink,
  account,
  accountAdvanceHref,
  instanceRecordId,
  relationshipId,
  publishAction,
  checkout,
  initialPaid,
  planIncluded,
  copyBlocked,
}: {
  copy: PageCopy;
  /** 1 = Details, 2 = Settings, 3 = Aspects, 4 = Account, 5 = Invite. Both read it. */
  stage: CreateStage;
  /**
   * **Where this stage is mounted (#979 B).** `page` is the stage's own route — the deep link, the
   * refresh, the invitation link — and is what a stage page passes by saying nothing. `dialog` is
   * the same render inside `RelationshipFlowShell`'s dialog, over the page the flow was started
   * from. The component does not branch on it: it hands it to the shell, which owns the difference.
   */
  mount?: FlowMount;
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
  /** The page the refusal's sentence points at, when it names one (#618, #870). */
  problemLink?: { readonly href: string; readonly label: string } | null;
  /**
   * A plan line the stage states without refusing anything (#834) — stage 5 tells a person their
   * Mode is not on their plan, and lets them send or keep the draft anyway.
   */
  notice?: string | null;
  /** The plans page the notice points at, when it names one. */
  noticeLink?: { readonly href: string; readonly label: string } | null;
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
  /**
   * The relationship's own row id, for the payment walk (#911).
   *
   * The stage's URL carries the **record** id (`?instance=`) and the send posts to it; the capture
   * names the **relationship**, and passing the record id there is refused with "no relationship
   * holds the id" — the card form's one failure mode. Optional, because a render-only test mounts
   * this stage without a database and presses nothing that captures.
   */
  relationshipId?: string;
  /**
   * Stage 1's one-click publish, for a refusal the author can fix (#870). The page builds it as a
   * form posting to the **existing** `status` endpoint, because the rule is that a publish is the
   * status transition called from one more place, never a second write path.
   *
   * Absent for a built-in (nobody may publish it), for a template that is already published, and
   * for a viewer who is not its author.
   */
  publishAction?: ReactNode;
  /**
   * Stage 5's gate (#911). The page passes the server's capture actions and the two facts the walk
   * reads — whether a card is already on file, and what the account's plan already covers — because
   * all three are the page's to know (a session, an entitlement, a row) and none of them can be read
   * inside a client component.
   */
  checkout?: CheckoutHandlers;
  /** A card is already on file for this relationship: the walk opens on the thank-you. */
  initialPaid?: boolean;
  /** What the account's plan already covers (#870), measured by the page. */
  planIncluded?: { readonly name: string; readonly entitled: boolean };
  /**
   * **This template cannot be copied, so stage 1 must not collect anything (#870).**
   *
   * The page sets it when `templateCopyRefusal()` answered — not published, no published version,
   * no Aspects, or somebody else's. The template band still draws (it says *which* template was
   * refused), the band above names the reason and its door, the publish action sits under it when
   * the author can fix it, and the **form is absent**: four stages of typing for a create the store
   * is guaranteed to refuse is the defect this flag removes. `store.ts` keeps its own refusal as
   * the last line of defence.
   */
  copyBlocked?: boolean;
}) {
  const band = sectionOf(copy, "template");
  const who = sectionOf(copy, "who");
  const mode = sectionOf(copy, "mode");
  const aspectsSection = sectionOf(copy, "aspects");
  const accountSection = sectionOf(copy, "account");
  const inviteSection = sectionOf(copy, "invite");
  const problems = sectionOf(copy, "problems");
  /**
   * Every refusal's second door (#870): the relationships list, where a draft already lives and
   * where a person who cannot copy this template can start from another. Read once here so the
   * band cannot be handed a door and a different fallback on two stages.
   */
  const backDoor = {
    href: RELATIONSHIPS_PATH,
    label: itemLabel(problems, "back-to-relationships"),
  };
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

  /**
   * **The two groups, and the one sentence each refuses with (#975 D7).**
   *
   * `requiredSentence` is the fixture's `{field} is required.` row with this group's own legend
   * filled in — `lib/flow/create-copy.ts::fieldSentence()` is the same composition the refusal band
   * uses when the server refuses the post, so a press in the browser and a refusal from the store
   * say the same words about the same field. It is resolved here, not inside the client component,
   * because every word on this screen comes from `data/pages/assessment-create.ts` (E23).
   */
  const choiceGroups: ChoiceGroup[] = [
    {
      name: "mode",
      legend: itemLabel(mode, "mode-label"),
      badge: itemLabel(mode, "mode-fixed"),
      options: modeOptions,
      requiredSentence: fieldSentence("mode", "required") ?? "",
    },
    {
      name: "alignmentSetting",
      legend: itemLabel(mode, "setting-label"),
      intro: itemLabel(mode, "setting-help"),
      note: itemLabel(mode, "setting-note"),
      options: settingOptions,
      requiredSentence: fieldSentence("setting", "required") ?? "",
    },
  ];

  // The refusal that leaves nothing to copy: still a page, never a 404 that loses the sentence.
  if (template === null) {
    const empty = sectionOf(copy, "refused");
    return (
      <RelationshipFlowShell
        mount={mount}
        copy={copy}
        title={empty.heading}
        closeLabel={shell.closeLabel}
        closeHref={shell.closeHref}
      >
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
          <ProblemBand
            heading={problems.heading}
            sentence={problem}
            link={problemLink}
            back={backDoor}
          />
          {/* The authored template's one-click publish (#870). Drawn under the band, because it
              is the fix for the sentence above it — and it is the *existing* status transition,
              mounted one more place, not a second way to publish anything. */}
          {publishAction === undefined ? null : <div className="mt-3">{publishAction}</div>}
        </div>
      </RelationshipFlowShell>
    );
  }

  return (
    <RelationshipFlowShell
      mount={mount}
      stage={stage}
      copy={copy}
      title={heading}
      closeLabel={shell.closeLabel}
      closeHref={shell.closeHref}
    >
      <div className="space-y-6">
        {/*
         * **One back affordance per screen, and it lives in the foot** (#760). Stages 2–4 used
         * to draw a bare `Back` link at the top of the column while stage 1 drew its own in the
         * form's action row — three shapes for one act, and none of them the pair the artifact
         * draws. The foot below is now the only place it appears, on all four stages.
         */}

        {/*
         * Where the person is in the five stages (#687, #825) is the shell's: Details, Settings,
         * Aspects, Account and Invite, drawn above this body by `RelationshipFlowShell` so the
         * dialog and the page cannot number the same screen differently (#979 B).
         */}

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

        <ProblemBand
          heading={problems.heading}
          sentence={problem}
          link={problemLink}
          back={backDoor}
        />
        {/* The fix for an authored template that is not published yet (#870). It sits on stage 1
              because a template that cannot be copied is a door problem, not a form problem — and
              the store's own refusal at commit stays as the last line of defence. */}
        {publishAction === undefined ? null : <div>{publishAction}</div>}

        <NoticeBand sentence={notice ?? null} link={noticeLink ?? null} />

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

            {/*
             * #870 — a template that cannot be copied draws no form. The refusal above names the
             * reason and its door, the publish action sits under it when the author can fix it,
             * and this foot is the way out. Collecting six facts here would be four stages of
             * typing for a create the store is guaranteed to refuse.
             */}
            {copyBlocked === true ? (
              <StageFoot
                backHref={backHref}
                backLabel={itemLabel(who, "back")}
                cancelHref={shell.closeHref}
                cancelLabel={cancelLabel}
              />
            ) : (
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
            )}
          </>
        ) : stage === 2 ? (
          /*
           * **Settings is a client component (#975 D7).** The two groups and the form live in
           * `StageChoiceForm`, because a press that cannot advance has to *answer* — with the
           * fixture's own `Opinions Mode is required.` at the field it is about — and a server
           * render cannot answer a click. This component still owns every word: the legends, the
           * option helps and the two required sentences are resolved here from
           * `data/pages/assessment-create.ts` and handed down, so the screen's voice stays in one
           * fixture and the refusal cannot drift from the label it names.
           */
          <StageChoiceForm
            action={SAVE_MODE_PATH}
            heading={mode.heading ?? ""}
            body={sectionBody(mode)}
            templateRecordId={template.recordId}
            groups={choiceGroups}
            selected={{ mode: draft.mode, alignmentSetting: draft.alignmentSetting }}
            foot={
              // The stage foot (#760): `[Back][Cancel]` left, the advance flush right.
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
            }
          />
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
              addRemove
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
            relationshipId={relationshipId ?? ""}
            {...(checkout === undefined ? {} : { checkout })}
            {...(initialPaid === undefined ? {} : { initialPaid })}
            {...(planIncluded === undefined ? {} : { planIncluded })}
            backHref={backHref}
            cancelHref={shell.closeHref}
            cancelLabel={cancelLabel}
          />
        )}
      </div>
    </RelationshipFlowShell>
  );
}

/** A value, or the fixture's dash when the person left it blank. */
function orNone(copy: ReturnType<typeof sectionOf>, value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? itemLabel(copy, "none") : trimmed;
}
