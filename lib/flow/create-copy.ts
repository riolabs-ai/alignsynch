/**
 * The create flow's refusal copy (#688) — one place that turns a code into a sentence.
 *
 * Two kinds of refusal reach the two stage screens, and they must read the same way:
 *
 *   - a **field refusal** from `lib/flow/create-draft.ts` — `{field: "email", reason: "email"}`,
 *     rendered as "Their email address must be an address the invitation can reach". The field's
 *     *label* comes from the stage's own section, never from the query string, so the sentence
 *     names the control the person is looking at and a raw column name can never reach a screen;
 *   - a **store refusal** from `POST /assessment/new` — `?problem=<FlowErrorCode>`, rendered as
 *     the fixture's one sentence per code, exactly as before this card.
 *
 * Both stage pages ask this module, so stage 1 and stage 2 cannot drift into two vocabularies
 * for the same refusal. The fixture is E23's: every id resolved here is one the route's copy
 * declares, and a rename is a red build rather than a blank band.
 */
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { type CreateDraftField, isCreateDraftField, isCreateDraftReason } from "./create-draft";
import { PRICING_PATH } from "./paths";

/** Where each field's label lives. The section is per stage; the item id is the label. */
const FIELD_COPY: Readonly<Record<CreateDraftField, { section: string; item: string }>> = {
  initiator: { section: "who", item: "initiator-label" },
  counterparty: { section: "who", item: "counterparty-label" },
  email: { section: "who", item: "email-label" },
  title: { section: "who", item: "title-label" },
  mode: { section: "mode", item: "mode-label" },
  setting: { section: "mode", item: "setting-label" },
};

/**
 * The sentence for one refused field, or `null` when either code is not one this flow issues.
 *
 * The label is read from the fixture and filled into the reason's sentence, so the two never
 * disagree: rename "Their email address" and the refusal renames with it.
 */
export function fieldSentence(
  field: string | undefined,
  reason: string | undefined,
): string | null {
  if (!isCreateDraftField(field) || !isCreateDraftReason(reason)) return null;
  const entry = FIELD_COPY[field];
  const label = itemLabel(sectionOf(assessmentCreatePageCopy, entry.section), entry.item);
  return fillLabel(itemLabel(sectionOf(assessmentCreatePageCopy, "validation"), reason), {
    field: label,
  });
}

/** What a stage screen draws above its form: the sentence, and the door when one is named. */
export interface CreateRefusal {
  readonly sentence: string;
  readonly link: { readonly href: string; readonly label: string } | null;
}

/**
 * The refusal a `?problem=<code>&field=<field>` pair names, or `null`.
 *
 * A field refusal wins over a store code because it is the more specific answer, and a store
 * code the page does not know draws nothing rather than an invented sentence. The two links
 * are the same two `/pricing` doors #618 added: `relationship-limit` and `mode-not-entitled`
 * both tell a person to change their plan, and only those two point anywhere.
 */
export function createRefusal(
  code: string | undefined,
  field: string | undefined,
): CreateRefusal | null {
  if (code === undefined) return null;

  const validation = fieldSentence(field, code);
  if (validation !== null) return { sentence: validation, link: null };

  const problems = sectionOf(assessmentCreatePageCopy, "problems");
  const plans = { href: PRICING_PATH, label: itemLabel(problems, "plans") };

  // One branch per code rather than a computed `problem-${code}` id: E23 resolves every literal
  // id a component hands to the copy readers against the route's fixture, so a renamed item is
  // a red build. A constructed id would only resolve at runtime or throw, which is the blank
  // band this ratchet exists to prevent. The codes are the store's own `FlowErrorCode` values.
  if (code === "invalid-input") {
    return { sentence: itemLabel(problems, "invalid-input"), link: null };
  }
  if (code === "unknown-template") {
    return { sentence: itemLabel(problems, "unknown-template"), link: null };
  }
  if (code === "template-not-published") {
    return { sentence: itemLabel(problems, "template-not-published"), link: null };
  }
  if (code === "template-has-no-aspects") {
    return { sentence: itemLabel(problems, "template-has-no-aspects"), link: null };
  }
  if (code === "record-is-an-instance") {
    return { sentence: itemLabel(problems, "record-is-an-instance"), link: null };
  }
  if (code === "template-not-yours") {
    return { sentence: itemLabel(problems, "template-not-yours"), link: null };
  }
  if (code === "instance-limit") {
    return { sentence: itemLabel(problems, "instance-limit"), link: null };
  }
  // #505 — the plan's relationship limit. Beside `instance-limit` rather than folded into it:
  // the two codes name different counts, and an operator reading `?problem=` should be able to
  // tell which gate answered.
  if (code === "relationship-limit") {
    return { sentence: itemLabel(problems, "relationship-limit"), link: plans };
  }
  if (code === "mode-not-entitled") {
    return { sentence: itemLabel(problems, "mode-not-entitled"), link: plans };
  }
  return null;
}
