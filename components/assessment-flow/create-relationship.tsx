/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: a server component on the app's own route, posting to the route handler — the layout survives, the disabled submit and its "not wired" note do not)
 *
 * `CreateRelationship` — the create step, wired (#427).
 *
 * The v1 create form's shape, in the order a person decides: the template and its two seats at
 * the top, the counterparty, then the two choices that shape everything after creation. It is a
 * plain POST form — no `"use client"`, no state, no handler — so the browser, a `curl` and the
 * acceptance all drive the same endpoint (`POST /assessment/new`), and a refusal comes back as a
 * GET of this page with `?problem=<code>` rather than a JSON body in the window.
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
 * **A refused create is this same screen with a sentence above the form.** The URL carries the
 * code and nothing else; `data/pages/assessment-create.ts` owns every word here, so the band says
 * what the store refused without a second copy of the reason. When the refusal is one that means
 * the template cannot be read at all — somebody else's, an instance, an id that names nothing —
 * the screen still renders, with the sentence and a way back to the library, instead of a bare
 * 404 that would swallow the refusal the post just gave.
 *
 * Literal-free: every word is `data/pages/assessment-create.ts` (E23), except the two vocabulary
 * sets the model authors once — `MODE_LABELS` and `SETTING_LABELS`/`SETTING_DEFINITIONS`.
 */
import Link from "next/link";
import {
  ALIGNMENT_SETTINGS,
  ASSESSMENT_MODES,
  MODE_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
} from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { CREATE_INSTANCE_PATH, PRICING_PATH } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { WizardSteps } from "./wizard-steps";

/** The template being copied, as much of it as this screen prints. */
export interface CreateTemplate {
  /** The record's own id — what the hidden field posts back. */
  readonly recordId: string;
  readonly title: string;
  readonly summary: string;
  readonly aspectCount: number;
}

/** The rail's three steps, as fixture item ids (#618) — the shape `counterparty-wizard.tsx` uses. */
const RAIL: readonly { readonly step: number; readonly item: string }[] = [
  { step: 1, item: "1" },
  { step: 2, item: "2" },
  { step: 3, item: "3" },
];

/** The band a refusal is drawn in, shared by the form's own screen and the read-nothing one. */
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
   * this card, drew nothing to click. The label comes from the page fixture; the address is
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

export function CreateRelationship({
  copy,
  template,
  backHref,
  problem,
  problemLink,
  gate,
}: {
  copy: PageCopy;
  /** The template to copy, or `null` when the refusal means there is none to read. */
  template: CreateTemplate | null;
  /** Where the back link goes: the template, or the library when there is no template. */
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
  const form = sectionOf(copy, "form");
  const problems = sectionOf(copy, "problems");
  const rail = sectionOf(copy, "steps");
  const accountGate = sectionOf(copy, "gate");

  // The refusal that leaves nothing to copy: still a page, never a 404 that loses the sentence.
  if (template === null) {
    const empty = sectionOf(copy, "refused");
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
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
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <p>
        <Link href={backHref} className="text-sm font-medium text-action hover:underline">
          {itemLabel(band, "back")}
        </Link>
      </p>

      {/* Where the person is in the journey (#618): products → this product → the relationship. */}
      <WizardSteps
        label={itemLabel(rail, "label")}
        count={fillLabel(itemLabel(rail, "count"), { step: 3 })}
        current={3}
        steps={RAIL.map((entry) => ({ step: entry.step, label: itemLabel(rail, entry.item) }))}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {copy.heading}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{copy.subtitle}</p>
      </div>

      <ProblemBand heading={problems.heading} sentence={problem} link={problemLink} />

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
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{template.summary}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {fillLabel(itemLabel(band, "aspects"), { count: template.aspectCount })}
          </p>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{itemLabel(band, "seats")}</p>
      </section>

      {gate === null ? (
        <form
          action={CREATE_INSTANCE_PATH}
          method="post"
          aria-labelledby="create-form-heading"
          className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <h2
            id="create-form-heading"
            className="text-lg font-semibold text-gray-900 dark:text-gray-100"
          >
            {form.heading}
          </h2>

          {/* The template is the route's own fact; the form carries it so the POST names it. */}
          <input type="hidden" name="templateRecordId" value={template.recordId} />

          <label className="grid gap-1 text-sm" htmlFor="create-initiator-name">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(form, "initiator-label")}
            </span>
            <input
              id="create-initiator-name"
              name="initiatorName"
              className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {itemLabel(form, "initiator-help")}
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm" htmlFor="create-counterparty-name">
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {itemLabel(form, "counterparty-label")}
              </span>
              <input
                id="create-counterparty-name"
                name="counterpartyName"
                placeholder={itemLabel(form, "counterparty-placeholder")}
                className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(form, "counterparty-help")}
              </span>
            </label>

            <label className="grid gap-1 text-sm" htmlFor="create-email">
              <span className="font-medium text-gray-700 dark:text-gray-200">
                {itemLabel(form, "email-label")}
              </span>
              <input
                id="create-email"
                name="email"
                type="email"
                placeholder={itemLabel(form, "email-placeholder")}
                className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {itemLabel(form, "email-help")}
              </span>
            </label>
          </div>

          {/* Mode — fixed at creation, and said so on the form. */}
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(form, "mode-label")}
            </legend>
            {ASSESSMENT_MODES.map((mode) => (
              <label
                key={mode}
                className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <input type="radio" name="mode" value={mode} required className="mt-1" />
                <span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {MODE_LABELS[mode]}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {mode === "basic"
                      ? itemLabel(form, "mode-basic-help")
                      : itemLabel(form, "mode-advanced-help")}
                  </span>
                </span>
              </label>
            ))}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {itemLabel(form, "mode-fixed")}
            </p>
          </fieldset>

          {/* Setting — the bar the report is judged against, and the one choice a party may change. */}
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(form, "setting-label")}
            </legend>
            {ALIGNMENT_SETTINGS.map((setting) => (
              <label
                key={setting}
                className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
              >
                <input
                  type="radio"
                  name="alignmentSetting"
                  value={setting}
                  required
                  className="mt-1"
                />
                <span>
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    {SETTING_LABELS[setting]}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {SETTING_DEFINITIONS[setting]}
                  </span>
                </span>
              </label>
            ))}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {itemLabel(form, "setting-changeable")}
            </p>
          </fieldset>

          {/* The point of action: the control, enabled, with what it will do beside it. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground"
            >
              {itemLabel(form, "submit")}
            </button>
            <p className="text-xs text-gray-600 dark:text-gray-300">
              {itemLabel(form, "submit-note")}
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
          <p className="text-sm text-gray-600 dark:text-gray-300">{sectionBody(accountGate)}</p>
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
    </div>
  );
}
