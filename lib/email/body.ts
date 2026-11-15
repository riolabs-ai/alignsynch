/**
 * Where a body comes from (#548 follow-up) — `content/email-bodies.md`, via the generated module.
 *
 * **The prose lives in markdown, and this module is the only reader of it.** Every template in
 * `lib/email/templates/` that has a body to write points at a section of
 * `content/email-bodies.md`, keyed by its own id, holding one fenced `text` block. The owner edits
 * that file — a paragraph in a fence, no escaping, no backticks inside prose to think about — and
 * `pnpm email:bodies` turns it into the committed `lib/email/bodies.generated.ts`. The same
 * generated-module shape `docs/glossary.md` has: generated, committed, and `--check`-ed, because
 * the build and CI must work with no extra step.
 *
 * **Why markdown and not JSON or TS.** JSON breaks on an unescaped quote or a raw newline in a
 * paragraph of prose; a TS template literal breaks on a backtick. Markdown breaks on neither, and
 * the diff of a body reads as prose because it is prose.
 *
 * **The marker is gone, not renamed.** `lib/email/band.ts` used to carry a `{{…}}` marker that a
 * template printed where its prose had not been written, with the doctrine *"a sentence nobody
 * wrote is worse"*. That doctrine stands; the marker does not, because a body now has a pen. A
 * template that cannot say something writes the plainest true sentence it can and the file's own
 * `<!-- TODO(owner): … -->` carries the blank, where a human reads it. `scripts/gen-email-bodies.mjs`
 * fails on the marker in a body — so re-introducing it is a red gate, not a habit.
 *
 * **A missing fact throws; it does not print `undefined`.** `bodyBlocks()` fills `{{name}}` from the
 * values the template hands it and throws when a placeholder it did not receive survives the fill.
 * A mailbox is the one surface with no second render: a body saying `{{inviter}}` or `undefined` is
 * already delivered by the time anyone could fix it, so the failure belongs at the render, before
 * the transport.
 *
 * **Structure is the text's own shape**, the same rule `band.ts` follows for the shell: a blank
 * line separates blocks, `## ` is a heading, `- ` is a bullet, and everything else is prose that a
 * client re-wraps. A fence is a body, not a document — there is no front matter, no table and no
 * nested list, because none of the nine bodies needs one and a syntax nothing uses is a syntax
 * nothing checks.
 */
import { EMAIL_BODIES, type EmailBodyId } from "@/lib/email/bodies.generated";
import type { EmailBlock } from "@/lib/email/band";

/** One template's place in the markdown: the section's id and the placeholders it may use. */
export interface EmailBodySpec {
  /** The `## ` heading in `content/email-bodies.md`, and the registered template's own id. */
  readonly id: EmailBodyId;
  /**
   * The `{{…}}` names this body may carry. Declared, not inferred, so the generator can fail an
   * unknown placeholder at the file rather than at the render: `{{inviter}}` is a fact the template
   * holds, `{{anything_else}}` is a typo that would otherwise reach a mailbox.
   */
  readonly placeholders: readonly string[];
}

/** The body as written, for a caller that wants the string (a test, or a plain-text export). */
export function bodyText(spec: EmailBodySpec, values: Record<string, string>): string {
  const raw = EMAIL_BODIES[spec.id];
  if (raw === undefined) {
    throw new Error(
      `no body registered for "${spec.id}" — content/email-bodies.md has no section for it`,
    );
  }
  const filled = raw.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_match, name: string) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(
        `the "${spec.id}" body asks for {{${name}}}, which its template did not supply — the body and the facts disagree`,
      );
    }
    return value;
  });
  const leftover = /\{\{\s*([a-z0-9_]+)\s*\}\}/.exec(filled);
  if (leftover) {
    throw new Error(`the "${spec.id}" body still carries {{${leftover[1]}}} after the fill`);
  }
  return filled.trim();
}

/**
 * The body as blocks, ready for `EmailDocument.blocks`.
 *
 * The parse is deliberately the smallest one that carries the nine bodies: a blank line ends a
 * block, a chunk whose every line starts `- ` is a list, a chunk that starts `## ` is a heading,
 * and any other chunk is one paragraph with its lines joined by a space — markdown wraps at a
 * column, a mail client re-wraps at the reader's, and keeping the source's breaks would put a hard
 * newline mid-sentence into plain text.
 */
export function bodyBlocks(spec: EmailBodySpec, values: Record<string, string>): EmailBlock[] {
  return blocksFromText(bodyText(spec, values), spec.id);
}

/** The parse above, on its own, so a test can drive a shape no body in the file happens to use. */
export function blocksFromText(text: string, id = "body"): EmailBlock[] {
  const blocks: EmailBlock[] = [];

  for (const chunk of text.split(/\n[ \t]*\n/)) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    if (lines.length === 0) continue;

    const first = lines[0] ?? "";
    if (lines.every((line) => line.startsWith("- "))) {
      blocks.push({ kind: "list", items: lines.map((line) => line.slice(2).trim()) });
      continue;
    }
    if (first.startsWith("## ")) {
      if (!lines.every((line) => line.startsWith("## "))) {
        throw new Error(
          `the "${id}" body mixes a heading with prose in one block — a heading is its own block`,
        );
      }
      blocks.push(...lines.map((line): EmailBlock => ({ kind: "heading", text: line.slice(3) })));
      continue;
    }
    if (lines.some((line) => line.startsWith("- ") || line.startsWith("## "))) {
      throw new Error(
        `the "${id}" body has a bullet or a heading inside a paragraph — separate it with a blank line`,
      );
    }
    blocks.push({ kind: "paragraph", text: lines.join(" ") });
  }

  if (blocks.length === 0) {
    throw new Error(`the "${id}" body is empty — content/email-bodies.md has a blank fence`);
  }
  return blocks;
}
