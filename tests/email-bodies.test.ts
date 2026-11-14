/**
 * The bodies file and the module it generates (`content/email-bodies.md` → `lib/email/body.ts`).
 *
 * The markdown is the pen and the generated module is what the build imports, so the properties
 * this file asserts are the ones a hand edit could break without any type noticing: every template
 * that reads its body from the file has a section, every section belongs to a template that reads
 * it, and every `{{…}}` a body carries is a fact its template declares.
 *
 * The one property it deliberately does **not** spell is the retired marker's own name: the
 * generator is the only place allowed to name it (it is the rule that refuses it), and a test that
 * repeated the string would put it back in the tree the card asks to be clean of it.
 */
import { describe, expect, it } from "vitest";
import { EMAIL_BODIES } from "@/lib/email/bodies.generated";
import { blocksFromText, bodyBlocks, bodyText, type EmailBodySpec } from "@/lib/email/body";
import { EMAIL_TEMPLATES } from "@/lib/email/templates";
import { INVITATION_BODY } from "@/lib/email/templates/invitation";

const WIRED = EMAIL_TEMPLATES.filter((template) => template.body !== undefined);

describe("the file and the register agree", () => {
  it("generates a body for every template that reads one, and nothing else", () => {
    expect(Object.keys(EMAIL_BODIES).sort()).toEqual(WIRED.map((template) => template.id).sort());
    expect(WIRED).toHaveLength(9);
  });

  it("names, by id, the two templates that carry their body in code", () => {
    // A listed decision, not a gap: adding a template without a body must fail here, and moving
    // one of these into the file must fail this list.
    const inline = EMAIL_TEMPLATES.filter((template) => template.body === undefined).map(
      (template) => template.id,
    );
    expect(inline.sort()).toEqual(["relationship-expired", "stakeholder-release-note"]);
  });

  it("points every body spec at the template's own id", () => {
    for (const template of WIRED) {
      expect(template.body?.id).toBe(template.id);
      expect(template.body?.placeholders.length).toBeGreaterThan(0);
    }
  });

  it("writes a non-empty body for every section, and no undeclared placeholder in one", () => {
    for (const template of WIRED) {
      const spec = template.body as EmailBodySpec;
      const body = EMAIL_BODIES[spec.id];
      expect(body.trim()).not.toBe("");
      // Every `{{name}}` is one the template declares — which is also what makes the retired
      // marker impossible to reintroduce: no template declares it.
      for (const [, name] of body.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)) {
        expect(spec.placeholders).toContain(name);
      }
    }
  });

  it("fills every placeholder the body actually uses", () => {
    // Not a copy of the templates' facts — just every name filled, which is what a render does. A
    // declared name the prose does not use is a permission, not an obligation.
    for (const template of WIRED) {
      const spec = template.body as EmailBodySpec;
      const values = Object.fromEntries(spec.placeholders.map((name) => [name, `[${name}]`]));
      const raw = EMAIL_BODIES[spec.id];
      const text = bodyText(spec, values);
      expect(text).not.toContain("{{");
      for (const [, name] of raw.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)) {
        expect(text).toContain(`[${name}]`);
      }
    }
  });
});

describe("a body that disagrees with its template fails loudly, never silently", () => {
  it("throws when the template did not supply a fact the body asks for", () => {
    // The rendered sentence would otherwise carry a literal `{{inviter}}` into a mailbox.
    expect(() => bodyText(INVITATION_BODY, { template: "Relationship Basics" })).toThrow(
      /asks for \{\{inviter\}\}/,
    );
  });

  it("throws rather than shipping an empty body", () => {
    expect(() => blocksFromText("", "a-template")).toThrow(/body is empty/);
    expect(() => blocksFromText("\n\n  \n", "a-template")).toThrow(/body is empty/);
  });

  it("refuses a bullet or a heading glued to a paragraph", () => {
    expect(() => blocksFromText("A sentence.\n- a bullet", "a-template")).toThrow(/separate it/);
    expect(() => blocksFromText("## A heading\nand prose", "a-template")).toThrow(
      /mixes a heading with prose/,
    );
  });
});

describe("the text-to-blocks parse is the source's own shape", () => {
  it("joins a wrapped paragraph and splits it at a blank line", () => {
    expect(blocksFromText("One line,\nand its wrap.\n\nA second paragraph.")).toEqual([
      { kind: "paragraph", text: "One line, and its wrap." },
      { kind: "paragraph", text: "A second paragraph." },
    ]);
  });

  it("reads `## ` as a heading and `- ` as one bullet per line", () => {
    expect(blocksFromText("## What changed\n\n- One.\n- Two.")).toEqual([
      { kind: "heading", text: "What changed" },
      { kind: "list", items: ["One.", "Two."] },
    ]);
  });

  it("carries a real body's facts through, not the placeholders", () => {
    const blocks = bodyBlocks(INVITATION_BODY, {
      inviter: "Avery",
      counterparty: "Rowan",
      template: "Relationship Basics",
      link: "https://alignsynch.com/invite/abc",
    });
    const text = blocks.map((block) => ("text" in block ? block.text : "")).join(" ");
    expect(text).toContain("Avery");
    expect(text).toContain("Relationship Basics");
    expect(text).not.toContain("{{");
  });
});
