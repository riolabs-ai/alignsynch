/**
 * The email band (v0.9) — one shell, and the plain text is the source (#548).
 *
 * **Text first, HTML derived from it.** `renderEmail()` composes the plain-text body from the
 * blocks and then calls `htmlFromText()` on *that string* to build the HTML. The HTML is a pure
 * function of the text plus the chrome inputs (preheader, brand mark, address), so no sentence can
 * exist in the HTML and be missing from the text, and a change to a block changes the text before
 * the HTML. That is the rule the card asks for, and it is a property of the call graph rather than
 * a convention: `htmlFromText` takes a `string`.
 *
 * **What that costs, deliberately: no emphasis in the HTML.** The text renderer strips `**` and
 * turns `[label](url)` into `label` (or `label (url)` when the label does not already name the
 * target), because plain text has no bold; the HTML then carries no `<strong>` it could not carry
 * in the text. A mail whose HTML is louder than its text is a mail that says two different things
 * depending on the client, and the plain-text half is the one people forward.
 *
 * **The shell.** A 560 px column, a graphite `#37474F` header band drawing the brand **lockup**
 * (never the square mark, which is an icon surface — #539), body text `#363d49`, and a footer that
 * carries the product line. No gradients and no shadows: both are brand-layer decisions
 * (`app/globals.css`), and neither survives a mail client intact anyway.
 *
 * **The footer depends on the class, in both directions.** A `marketing` render carries an
 * unsubscribe line and *refuses to render without one*; a `transactional` render carries none and
 * *refuses to render with one*. Both are throws rather than omissions, because "the caller forgot"
 * and "the class is wrong" are the two ways this rule fails, and a missing line is invisible.
 *
 * **A non-live key says so in the footer.** `lib/email/key-mode.ts` already derives the mode from
 * the environment; `test` and `captured` add one sentence to the footer, so a mail sent from a key
 * that cannot reach a real mailbox never claims to have reached one. `live` and `unset` add nothing
 * (`unset` never sends at all).
 *
 * The copy lives here rather than in a `data/pages` fixture for the reason `lib/contact/mail.ts`
 * gives for its own subject and body: these strings are not a page, no route renders them, and the
 * one thing that must stay true of them — that the text is the source — is a property of this file.
 */
import { brand } from "@/data/brand";
import { brandMark } from "@/lib/brand-mark";
import type { MailKeyMode } from "@/lib/email/key-mode";

/** The two classes a mail can be. `marketing` may carry an unsubscribe line; `transactional` may not. */
export type EmailClass = "transactional" | "marketing";

/**
 * The marker a body carries where its prose has not been written yet (#548).
 *
 * It lives in the band rather than in any one template because it is a property of the pass, not
 * of a message: a template that cannot say something yet writes this marker and a bare
 * instruction, and never a sentence nobody wrote. The release note re-exports it so its callers
 * keep one import.
 */
export const CONTENT_TO_REFINE = "{{content_to_refine}}";

/** A section heading — rendered as `## ` in the text, so the parser needs no second channel. */
export interface EmailHeading {
  readonly kind: "heading";
  readonly text: string;
}

/** A paragraph of prose. Wrapped text is re-flowed by the client, not by this module. */
export interface EmailParagraph {
  readonly kind: "paragraph";
  readonly text: string;
}

/** A list of bulleted items. Each item is one bullet, already a sentence. */
export interface EmailList {
  readonly kind: "list";
  readonly items: readonly string[];
}

/**
 * Lines taken as they are: `- ` is a bullet, a blank line is a paragraph break, anything else is a
 * paragraph. The release note's Known limits block goes through here so its wording is never
 * re-flowed or re-joined by a parser that thinks it knows better.
 */
export interface EmailVerbatim {
  readonly kind: "verbatim";
  readonly lines: readonly string[];
}

/** One block of the body. */
export type EmailBlock = EmailHeading | EmailParagraph | EmailList | EmailVerbatim;

/** The document a caller hands `renderEmail()`. */
export interface EmailDocument {
  /** The `Subject:` header. Also the first line of the text body, as the title. */
  readonly subject: string;
  /** The preview line a client shows next to the subject, and the lead paragraph of the body. */
  readonly preheader: string;
  readonly blocks: readonly EmailBlock[];
}

/** Everything the shell needs that is not the document. */
export interface EmailOptions {
  readonly emailClass: EmailClass;
  /** Required for `marketing`, forbidden for `transactional`. */
  readonly unsubscribeUrl?: string;
  /** From `mailKeyMode()`. `test` and `captured` add a footer sentence; nothing else does. */
  readonly mode?: MailKeyMode;
  /** The origin the lockup is served from. Defaults to the brand's own domain over https. */
  readonly origin?: string;
}

/** A rendered mail: the two bodies, and nothing else. */
export interface RenderedEmail {
  readonly text: string;
  readonly html: string;
}

/**
 * The footer's product line — the brand's own sentence, never a rewrite of it.
 *
 * The name is prefixed only when the description does not already open with it: AlignSynch's does
 * ("AlignSynch asks two people…"), QuizHub's does not ("Create quizzes, play games…"), and
 * "AlignSynch — AlignSynch asks" is the kind of doubling a footer remembers.
 */
function productLine(): string {
  const description = brand.description.trim();
  return description.startsWith(brand.name) ? description : `${brand.name} — ${description}`;
}

/** The site line, from the brand record, so a second brand gets its own address. */
function siteLine(origin: string): string {
  return origin;
}

/** The sentence a non-live key adds. `live` and `unset` are silent. */
export function modeNote(mode: MailKeyMode | undefined): string | undefined {
  if (mode === "test") {
    return "Sent with a test key: this message was not delivered to a real mailbox.";
  }
  if (mode === "captured") {
    return "Sent to a capture endpoint: this message was not delivered to a real mailbox.";
  }
  return undefined;
}

/** `-**bold**` -> `bold`, and `[text](url)` -> `text` (or `text (url)` when text says nothing). */
export function plainInline(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label: string, url: string) => {
      const named = label.startsWith("#") || label === url;
      return named ? label : `${label} (${url})`;
    })
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Collapse runs of blank lines and the trailing whitespace each line collects. */
function normalize(lines: readonly string[]): string {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/[ \t]+$/, "");
    if (line === "" && (out.length === 0 || out[out.length - 1] === "")) continue;
    out.push(line);
  }
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return `${out.join("\n")}\n`;
}

/** The text a `verbatim` block contributes: its lines, bullets intact, dedented. */
function verbatimLines(block: EmailVerbatim): string[] {
  return block.lines.map((line) => line.replace(/^ {0,3}/, "").replace(/[ \t]+$/, ""));
}

/**
 * The plain-text body — the master copy.
 *
 * Structure, in order: the subject as the title, the preheader as the lead, then one blank line per
 * block, then a `---` rule and the footer. The rule is what lets `htmlFromText` draw the footer as a
 * footer without a second channel, and it is what a person reading the text sees before the
 * unsubscribe line.
 */
export function composeText(document: EmailDocument, options: EmailOptions): string {
  if (options.emailClass === "marketing" && !options.unsubscribeUrl) {
    throw new Error("a marketing mail needs an unsubscribe URL — none was given");
  }
  if (options.emailClass === "transactional" && options.unsubscribeUrl) {
    throw new Error("a transactional mail must not carry an unsubscribe line");
  }

  const origin = options.origin ?? `https://${brand.domain}`;
  const lines: string[] = [document.subject.trim(), "", document.preheader.trim(), ""];

  for (const block of document.blocks) {
    switch (block.kind) {
      case "heading":
        lines.push(`## ${plainInline(block.text)}`, "");
        break;
      case "paragraph":
        lines.push(plainInline(block.text), "");
        break;
      case "list":
        lines.push(...block.items.map((item) => `- ${plainInline(item)}`), "");
        break;
      case "verbatim":
        // Taken as written: one line in, one line out, bullets and order untouched. The only thing
        // that happens is the markdown flattening every line gets — plain text has no bold.
        lines.push(...verbatimLines(block).map((line) => plainInline(line)), "");
        break;
    }
  }

  lines.push("---", "", productLine(), siteLine(origin));
  const note = modeNote(options.mode);
  if (note !== undefined) lines.push(note);
  if (options.unsubscribeUrl !== undefined) {
    lines.push(`Unsubscribe: ${options.unsubscribeUrl}`);
  }

  return normalize(lines);
}

/** HTML-escape every text node. The bodies are prose; nothing here is ever markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** The header band's lockup: the brand mark, sized from its own intrinsic ratio, or its name. */
function headerBand(origin: string): string {
  const mark = brandMark(brand.logo);
  if (mark === undefined) {
    return `<span style="display:block;font-size:20px;line-height:1.3;font-weight:600;color:#ffffff;letter-spacing:0.01em;">${escapeHtml(brand.name)}</span>`;
  }
  // The lockup is dark ink on transparency (measured: the wordmark is near-black), so on the
  // graphite band it is drawn on a **white plate** rather than recoloured. The brand rule is
  // "place the asset, never redraw, recolour or filter it" (`tests/brand-immutable.test.ts`), and a
  // CSS filter to invert a logo is exactly the recolour that rule forbids — so the band moves the
  // paper under the mark instead of the mark's own colours.
  const width = 216;
  const height = Math.round((mark.height / mark.width) * width);
  const src = mark.src.startsWith("http") ? mark.src : `${origin}${mark.src}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:4px;"><tr><td style="padding:10px 14px;"><img src="${escapeHtml(src)}" alt="${escapeHtml(brand.name)}" width="${width}" height="${height}" style="display:block;border:0;outline:none;text-decoration:none;width:${width}px;height:${height}px;"></td></tr></table>`;
}

/**
 * The HTML body, **from the plain text**.
 *
 * The parse is the text's own shape: `## ` is a heading, `- ` is a bullet, `---` is the footer rule,
 * a blank line ends a paragraph, and everything else is prose. The first paragraph is the title and
 * the second is the lead — the two lines `composeText` writes first — so the HTML cannot drift from
 * the text without the text changing first.
 */
export function htmlFromText(
  text: string,
  options: { preheader?: string; origin?: string } = {},
): string {
  const origin = options.origin ?? `https://${brand.domain}`;
  const lines = text.replace(/\n+$/, "").split("\n");

  const body: string[] = [];
  const footer: string[] = [];
  let inFooter = false;
  let paragraph: string[] = [];
  let list: string[] = [];
  let paragraphs = 0;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const content = paragraph.join(" ");
    const target = inFooter ? footer : body;
    if (!inFooter && paragraphs === 0) {
      target.push(
        `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;color:#1f2733;">${escapeHtml(content)}</h1>`,
      );
    } else if (!inFooter && paragraphs === 1) {
      target.push(
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.55;color:#5b6470;">${escapeHtml(content)}</p>`,
      );
    } else {
      target.push(
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#363d49;">${escapeHtml(content)}</p>`,
      );
    }
    if (!inFooter) paragraphs += 1;
    paragraph = [];
  };

  const flushList = (): void => {
    if (list.length === 0) return;
    const items = list
      .map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`)
      .join("");
    const target = inFooter ? footer : body;
    target.push(
      `<ul style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.6;color:#363d49;">${items}</ul>`,
    );
    list = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/[ \t]+$/, "");
    if (line === "---") {
      flushParagraph();
      flushList();
      inFooter = true;
      continue;
    }
    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      const target = inFooter ? footer : body;
      target.push(
        `<h2 style="margin:24px 0 12px;font-size:15px;line-height:1.4;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#37474F;">${escapeHtml(line.slice(3))}</h2>`,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();

  const preheader = options.preheader?.trim();
  const hidden = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(titleOf(text))}</title>
</head>
<body style="margin:0;padding:0;background:#eef0f2;">
${hidden}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<tr><td style="background:#37474F;padding:24px 28px;">${headerBand(origin)}</td></tr>
<tr><td style="padding:28px;">${body.join("\n")}</td></tr>
<tr><td style="background:#f4f5f6;padding:20px 28px;font-size:12px;line-height:1.6;color:#5b6470;">${footer.join("\n")}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

/** The first line of the text, used only for the `<title>` a client's preview pane reads. */
function titleOf(text: string): string {
  const first = text.split("\n").find((line) => line.trim() !== "");
  return first ?? "";
}

/** Compose the text, then derive the HTML from it. The whole contract of this module, in 5 lines. */
export function renderEmail(document: EmailDocument, options: EmailOptions): RenderedEmail {
  const text = composeText(document, options);
  const html = htmlFromText(text, { preheader: document.preheader, origin: options.origin });
  return { text, html };
}
