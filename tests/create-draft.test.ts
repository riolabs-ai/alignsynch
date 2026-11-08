/**
 * The create flow's two stages and their one draft (#688).
 *
 * The card's acceptance is behavioural, not cosmetic: both stages validate **server-side**, a
 * refusal names the failing field by its **label**, and the draft survives a reload. So this
 * file checks the three layers separately and then together:
 *
 *   1. **The rules** — `whoDraft` / `modeDraft` are pure, so "required", "not an email" and "not
 *      an option this form offered" are asserted without a server or a database.
 *   2. **The draft object** — one JSON object round-trips through the cookie codec, and a cookie
 *      that is garbage parses to `null` instead of throwing during a render.
 *   3. **The screens** — stage 1 renders stage 1's form (posting to the save handler) with the
 *      saved values in the inputs; stage 2 renders the Mode form (posting to the create
 *      endpoint) with the saved choices selected, and its rail says Stage 2 of 6.
 *
 * The refusal sentence is composed by `lib/flow/create-copy.ts` from the field's own label, so a
 * rename in `data/pages/assessment-create.ts` moves the sentence — the test asserts the label is
 * *in* it rather than pinning a second copy of the words here.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import {
  EMPTY_CREATE_DRAFT,
  modeDraft,
  parseCreateDraft,
  serializeCreateDraft,
  whoDraft,
} from "@/lib/flow/create-draft";
import { createRefusal, fieldSentence } from "@/lib/flow/create-copy";
import {
  CREATE_INSTANCE_PATH,
  PRICING_PATH,
  SAVE_WHO_PATH,
  createModePath,
  createRelationshipPath,
} from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const TEMPLATE_ID = "template-relationship-basics";

/** A form as the browser posts it: every field is a string, missing fields read as empty. */
function form(values: Record<string, string>): (name: string) => string {
  return (name) => values[name] ?? "";
}

const WHO = {
  initiatorName: "Avery",
  counterpartyName: "Rowan",
  email: "rowan@example.com",
  title: "Our house, not the dishes",
  description: "Because we keep having the same argument.",
};

/** The draft stage 1 produces, as an authenticated stage 2 would read it back. */
function savedDraft() {
  const step = whoDraft(form(WHO));
  if (!step.ok) throw new Error("fixture refused");
  return step.draft;
}

const TEMPLATE = {
  recordId: TEMPLATE_ID,
  title: "Relationship Basics",
  summary: "Ten Aspects about how a working relationship feels and where it should go.",
  aspectCount: 2,
};

function stageHtml(stage: 1 | 2, draft = savedDraft()): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage,
      template: TEMPLATE,
      draft,
      backHref: createRelationshipPath(TEMPLATE_ID),
      problem: null,
      problemLink: null,
      gate: null,
    }),
  );
}

describe("stage 1 — Who", () => {
  it("refuses each blank field by name, in the order the form asks", () => {
    expect(whoDraft(form({}))).toEqual({
      ok: false,
      problem: { field: "initiator", reason: "required" },
    });
    expect(whoDraft(form({ initiatorName: "Avery" }))).toEqual({
      ok: false,
      problem: { field: "counterparty", reason: "required" },
    });
    expect(whoDraft(form({ ...WHO, email: "   " }))).toEqual({
      ok: false,
      problem: { field: "email", reason: "required" },
    });
    expect(whoDraft(form({ ...WHO, email: "not-an-address" }))).toEqual({
      ok: false,
      problem: { field: "email", reason: "email" },
    });
    expect(whoDraft(form({ ...WHO, title: "  " }))).toEqual({
      ok: false,
      problem: { field: "title", reason: "required" },
    });
  });

  it("keeps what was typed, trimmed, with the Mode still unset", () => {
    const step = whoDraft(form({ ...WHO, initiatorName: "  Avery  " }));
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(step.draft).toEqual({
      initiatorName: "Avery",
      counterpartyName: "Rowan",
      email: "rowan@example.com",
      title: "Our house, not the dishes",
      description: "Because we keep having the same argument.",
      mode: "",
      alignmentSetting: "",
    });
  });

  it("lets the description be blank", () => {
    const step = whoDraft(form({ ...WHO, description: "" }));
    expect(step.ok && step.draft.description).toBe("");
  });

  it("renders the saved values back into the inputs — the draft survives a reload", () => {
    const html = stageHtml(1);
    expect(html).toContain(`action="${SAVE_WHO_PATH}"`);
    expect(html).toContain(`name="templateRecordId" value="${TEMPLATE_ID}"`);
    // Server-rendered `defaultValue` reaches the browser as `value="…"`, so a reload on stage 1
    // shows what was typed rather than an empty form.
    expect(html).toContain('value="Avery"');
    expect(html).toContain('value="Rowan"');
    expect(html).toContain('value="rowan@example.com"');
    expect(html).toContain('value="Our house, not the dishes"');
    expect(html).toContain("Because we keep having the same argument.");
  });

  it("is the flow's first stage in the rail", () => {
    const html = stageHtml(1);
    expect(html).toContain('data-wizard-rail="1"');
    expect(html).toContain("Stage 1 of 6");
    // Stage 2's form is not on this screen.
    expect(html).not.toContain(`action="${CREATE_INSTANCE_PATH}"`);
  });
});

describe("stage 2 — Mode", () => {
  it("refuses an unchosen Mode, an invented one, and an unchosen Setting", () => {
    const draft = savedDraft();
    expect(modeDraft(form({}), draft)).toEqual({
      ok: false,
      problem: { field: "mode", reason: "required" },
    });
    expect(modeDraft(form({ mode: "impossible" }), draft)).toEqual({
      ok: false,
      problem: { field: "mode", reason: "choice" },
    });
    expect(modeDraft(form({ mode: "advanced" }), draft)).toEqual({
      ok: false,
      problem: { field: "setting", reason: "required" },
    });
    expect(modeDraft(form({ mode: "advanced", alignmentSetting: "loud" }), draft)).toEqual({
      ok: false,
      problem: { field: "setting", reason: "choice" },
    });
  });

  it("keeps stage 1's answers and adds the two choices", () => {
    const step = modeDraft(form({ mode: "advanced", alignmentSetting: "full" }), savedDraft());
    expect(step.ok).toBe(true);
    if (!step.ok) return;
    expect(step.draft).toEqual({
      ...savedDraft(),
      mode: "advanced",
      alignmentSetting: "full",
    });
  });

  it("renders as stage 2 of the rail, posting to the create endpoint", () => {
    const html = stageHtml(2, { ...savedDraft(), mode: "advanced", alignmentSetting: "full" });
    expect(html).toContain('data-wizard-rail="2"');
    expect(html).toContain("Stage 2 of 6");
    expect(html).toContain(`action="${CREATE_INSTANCE_PATH}"`);
    expect(html).toContain(`name="templateRecordId" value="${TEMPLATE_ID}"`);
    // The saved choices come back selected after a reload.
    expect(html).toMatch(/name="mode"[^>]*checked=""[^>]*value="advanced"/);
    expect(html).toMatch(/name="alignmentSetting"[^>]*checked=""[^>]*value="full"/);
    // The way back is stage 1, not the template.
    expect(html).toContain(`href="${createRelationshipPath(TEMPLATE_ID)}"`);
  });

  it("pre-selects nothing when nothing has been chosen yet", () => {
    const html = stageHtml(2, { ...savedDraft(), mode: "", alignmentSetting: "" });
    expect(html).not.toMatch(/name="mode"[^>]*checked/);
    expect(html).not.toMatch(/name="alignmentSetting"[^>]*checked/);
  });
});

describe("the draft object", () => {
  it("round-trips through the cookie codec", () => {
    const draft = { ...savedDraft(), mode: "advanced", alignmentSetting: "full" };
    expect(parseCreateDraft(serializeCreateDraft(draft))).toEqual(draft);
  });

  it("writes a value a cookie can carry without being re-encoded", () => {
    // Measured: Next's cookie serialiser percent-encodes an `encodeURIComponent` value a second
    // time, and the read hands back the single-encoded string — so the codec is base64url, whose
    // alphabet is cookie-octet-safe and never re-encoded.
    expect(serializeCreateDraft(savedDraft())).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("treats an absent, garbage or incomplete cookie as no draft", () => {
    const b64 = (value: unknown) =>
      Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
    expect(parseCreateDraft(undefined)).toBeNull();
    expect(parseCreateDraft("")).toBeNull();
    expect(parseCreateDraft("%7Bnot-json")).toBeNull();
    expect(parseCreateDraft("not base64 at all!!")).toBeNull();
    expect(parseCreateDraft(b64({}))).toBeNull();
    expect(parseCreateDraft(b64({ initiatorName: "Avery" }))).toBeNull();
    expect(EMPTY_CREATE_DRAFT.initiatorName).toBe("");
  });
});

describe("a refusal names the field by its label", () => {
  it("uses the fixture's label for the field, not a column name", () => {
    const who = sectionOf(assessmentCreatePageCopy, "who");
    const mode = sectionOf(assessmentCreatePageCopy, "mode");

    expect(fieldSentence("email", "email")).toBe(
      itemLabel(sectionOf(assessmentCreatePageCopy, "validation"), "email").replace(
        "{field}",
        itemLabel(who, "email-label"),
      ),
    );
    expect(fieldSentence("initiator", "required")).toContain(itemLabel(who, "initiator-label"));
    expect(fieldSentence("mode", "required")).toContain(itemLabel(mode, "mode-label"));
    expect(fieldSentence("setting", "required")).toContain(itemLabel(mode, "setting-label"));
    // No raw column/form name reaches the sentence.
    expect(fieldSentence("email", "required")).not.toMatch(
      /initiatorName|counterpartyName|alignmentSetting/,
    );

    expect(fieldSentence("nonsense", "required")).toBeNull();
    expect(fieldSentence("email", "nonsense")).toBeNull();
  });

  it("still resolves the store's own codes, and only two of them carry a link", () => {
    const problems = sectionOf(assessmentCreatePageCopy, "problems");
    expect(createRefusal("invalid-input", undefined)).toEqual({
      sentence: itemLabel(problems, "invalid-input"),
      link: null,
    });
    expect(createRefusal("relationship-limit", undefined)?.link).toEqual({
      href: PRICING_PATH,
      label: itemLabel(problems, "plans"),
    });
    expect(createRefusal("unknown-code", undefined)).toBeNull();
    expect(createRefusal(undefined, "email")).toBeNull();
  });

  it("draws the sentence above the form the refusal came from", () => {
    const sentence = fieldSentence("email", "email") as string;
    const html = renderToStaticMarkup(
      createElement(CreateRelationship, {
        copy: assessmentCreatePageCopy,
        stage: 1,
        template: TEMPLATE,
        draft: { ...EMPTY_CREATE_DRAFT, initiatorName: "Avery" },
        backHref: createRelationshipPath(TEMPLATE_ID),
        problem: sentence,
        problemLink: null,
        gate: null,
      }),
    );
    expect(html).toContain('data-create-problem="true"');
    expect(html).toContain(sentence);
    expect(html).toContain('value="Avery"');
  });
});

describe("the two stages are two addresses", () => {
  it("stage 2's path is stage 1's path plus one segment", () => {
    expect(createModePath(TEMPLATE_ID)).toBe(`${createRelationshipPath(TEMPLATE_ID)}/mode`);
    expect(SAVE_WHO_PATH).toBe(`${CREATE_INSTANCE_PATH}/who`);
  });
});
