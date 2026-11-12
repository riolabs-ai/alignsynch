/**
 * The create flow's refusal copy (#688, #870) — one place that turns a code into a sentence **and
 * into the door out of the refusal**.
 *
 * Two kinds of refusal reach the two stage screens, and they must read the same way:
 *
 *   - a **field refusal** from `lib/flow/create-draft.ts` — `{field: "email", reason: "email"}`,
 *     rendered as "Their email address must be an address the invitation can reach". The field's
 *     *label* comes from the stage's own section, never from the query string, so the sentence
 *     names the control the person is looking at and a raw column name can never reach a screen;
 *   - a **store refusal** from `POST /assessment/new` — `?problem=<FlowErrorCode>`, rendered as
 *     the fixture's one sentence per code.
 *
 * Both stage pages ask this module, so stage 1 and stage 2 cannot drift into two vocabularies
 * for the same refusal. The fixture is E23's: every id resolved here is one the route's copy
 * declares, and a rename is a red build rather than a blank band.
 *
 * **A refusal a person can fix carries the way to fix it (#870).** Before that card every branch
 * below returned `link: null`, so the band was a wall with the answer written on it and no handle
 * — and stage 5, where an unpublished template was refused, offered no send, no draft and no way
 * out at all. The rule now: **every code that a screen can reach names a destination**, and the
 * one exception is `invalid-input`, which is allowed to name none because the form it is drawn
 * above is the place it is fixed and it names the field. `tests/flow-refusal-actions.test.tsx`
 * walks every code the create path can raise and fails a new one that names nothing.
 *
 * The link is *not* a second implementation of any fix: `template-*` points at the template's own
 * page (whose publish affordance is the existing status transition), `template-has-no-aspects`
 * points at the member's editor for that template, and the three "you cannot copy this" codes point
 * at the library. Nothing here writes.
 */
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { type CreateDraftField, isCreateDraftField, isCreateDraftReason } from "./create-draft";
import {
  PRICING_PATH,
  RELATIONSHIP_TEMPLATES_PATH,
  dashboardTemplateEditorPath,
  relationshipTemplatePath,
} from "./paths";

/** Where each field's label lives. The section is per stage; the item id is the label. */
const FIELD_COPY: Readonly<Record<CreateDraftField, { section: string; item: string }>> = {
  "initiator-first": { section: "who", item: "initiator-first-label" },
  "initiator-last": { section: "who", item: "initiator-last-label" },
  "counterparty-first": { section: "who", item: "counterparty-first-label" },
  "counterparty-last": { section: "who", item: "counterparty-last-label" },
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
 * The template a refusal is about, when the page knows it.
 *
 * Both handles are carried because the two destinations need different ones: the template's own
 * page is addressed by **slug** (the URL's fact since #794) and the member's editor is keyed on
 * **record.id** (the storage fact). A page that knows only one can still name the destination it
 * can address; the other falls back to the library rather than to a path with an empty segment.
 */
export interface CreateRefusalContext {
  readonly slug?: string;
  readonly recordId?: string;
}

/**
 * The refusal a `?problem=<code>&field=<field>` pair names, or `null`.
 *
 * A field refusal wins over a store code because it is the more specific answer, and a store
 * code the page does not know draws nothing rather than an invented sentence.
 *
 * **One branch per code rather than a computed `problem-${code}` id:** E23 resolves every literal
 * id a component hands to the copy readers against the route's fixture, so a renamed item is a red
 * build. A constructed id would only resolve at runtime or throw, which is the blank band this
 * ratchet exists to prevent. The codes are the store's own `FlowErrorCode` values, plus the
 * `template-archived` split #870 added.
 */
export function createRefusal(
  code: string | undefined,
  field: string | undefined,
  context: CreateRefusalContext = {},
): CreateRefusal | null {
  if (code === undefined) return null;

  const validation = fieldSentence(field, code);
  if (validation !== null) return { sentence: validation, link: null };

  const problems = sectionOf(assessmentCreatePageCopy, "problems");
  const plans = { href: PRICING_PATH, label: itemLabel(problems, "plans") };
  const library = {
    href: RELATIONSHIP_TEMPLATES_PATH,
    label: itemLabel(problems, "back-to-templates"),
  };
  const slug = context.slug?.trim() ?? "";
  const recordId = context.recordId?.trim() ?? "";
  /** The template's own page — where its publish affordance already lives. */
  const templatePage =
    slug === ""
      ? library
      : { href: relationshipTemplatePath(slug), label: itemLabel(problems, "open-template") };

  // The form is on screen and the field is named by the sentence. This is the one code that names
  // no destination **on purpose**: the fix is the control the band is drawn above.
  if (code === "invalid-input") {
    return { sentence: itemLabel(problems, "invalid-input"), link: null };
  }
  // Nothing to copy and no screen that could make it copyable: the library is the honest exit.
  if (code === "unknown-template") {
    return { sentence: itemLabel(problems, "unknown-template"), link: library };
  }
  if (code === "record-is-an-instance") {
    return { sentence: itemLabel(problems, "record-is-an-instance"), link: library };
  }
  if (code === "template-not-yours") {
    return { sentence: itemLabel(problems, "template-not-yours"), link: library };
  }
  // #870 — the two not-copyable states, split so the sentence states one fact each. Both are
  // fixed on the template's own page, where "Publish it again" is the existing status transition.
  if (code === "template-archived") {
    return { sentence: itemLabel(problems, "template-archived"), link: templatePage };
  }
  if (code === "template-not-published") {
    return { sentence: itemLabel(problems, "template-not-published"), link: templatePage };
  }
  // An empty template has exactly one fix, and it is not on the read-only page.
  if (code === "template-has-no-aspects") {
    return {
      sentence: itemLabel(problems, "template-has-no-aspects"),
      link:
        recordId === ""
          ? templatePage
          : {
              href: dashboardTemplateEditorPath(recordId),
              label: itemLabel(problems, "fix-aspects"),
            },
    };
  }
  // #505 — the plan's relationship limit, and the only plan refusal the create path still raises
  // (#835 removed the mode and session-count legs, so their fixture items went with them).
  if (code === "relationship-limit") {
    return { sentence: itemLabel(problems, "relationship-limit"), link: plans };
  }
  // #835 — not a refusal any more: stage 5 draws this as the trial notice, so it keeps its
  // `/pricing` door and its sentence is about the day after the trial.
  if (code === "mode-not-entitled") {
    return { sentence: itemLabel(problems, "mode-not-entitled"), link: plans };
  }
  return null;
}

/**
 * What the read says about one template's **copyability**, independent of who is asking.
 *
 * The shape is a subset of `LibraryTemplateDetail` on purpose: this module stays free of the
 * database types so a suite can drive the guard with hand-built facts, and the page does the one
 * mapping from the row it read.
 */
export interface CopyReadiness {
  /** `record.status` — `published`, `archived`, or the author-only `draft`. */
  readonly status: string;
  /** How many Aspects the offered version (or the working copy) carries. */
  readonly aspectCount: number;
  /** Who wrote it, from `authorshipOf()` — `mine` is the only copyable authored case. */
  readonly authorship: "built-in" | "mine" | "other";
  /**
   * Does a `template_version` row exist? `undefined` is **not measured**, which never refuses:
   * a fact nobody read must not become a refusal a person cannot act on.
   */
  readonly hasVersion?: boolean;
}

/** The four codes a template's own state can raise. A subset of the store's `FlowErrorCode`. */
export type TemplateCopyCode =
  | "template-not-yours"
  | "template-archived"
  | "template-not-published"
  | "template-has-no-aspects";

/**
 * **The door guard (#870).** Why this template cannot be copied — or `null` when it can.
 *
 * The store answers the same question at commit (`lib/flow/store.ts`, `createInstanceFromTemplate`)
 * and that check stays as the last line of defence. This one runs at **stage 1**, before a single
 * field is collected: an unpublished template used to be refused at the end of stage 4, after the
 * person had typed six facts, chosen a Mode and reworded five Aspects, and the refusal landed on a
 * screen whose only control was a band.
 *
 * The order is the store's order, so the same template yields the same code at both ends and there
 * is one sentence per fact rather than two. The codes are this module's own union (not the store's)
 * because importing `FlowErrorCode` would pull a `pg` module into a screen's graph for a type.
 */
export function templateCopyRefusal(ready: CopyReadiness): TemplateCopyCode | null {
  if (ready.authorship === "other") return "template-not-yours";
  if (ready.status !== "published") return "template-archived";
  if (ready.aspectCount === 0) return "template-has-no-aspects";
  if (ready.hasVersion === false) return "template-not-published";
  return null;
}

/**
 * The copy a stage's own notice/refusal band needs, as one call — the page's only entry point.
 *
 * `problem` in the URL wins over the guard when the URL names a **field** refusal, because that is
 * the more specific answer about the form the person just posted; otherwise the guard wins, because
 * it is the reason nothing can proceed at all.
 */
export function stageRefusal(
  code: string | undefined,
  field: string | undefined,
  ready: CopyReadiness | null,
  context: CreateRefusalContext = {},
): CreateRefusal | null {
  const fromUrl = createRefusal(code, field, context);
  if (fromUrl !== null && field !== undefined) return fromUrl;
  if (ready !== null) {
    const guard = templateCopyRefusal(ready);
    if (guard !== null) return createRefusal(guard, undefined, context);
  }
  return fromUrl;
}
