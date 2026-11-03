/**
 * The report as a PDF — written here, byte by byte, because this tree will not carry a PDF
 * library for one screen (#504).
 *
 * **What was already in `package.json`, and why none of it is enough.** The only binary-format
 * dependency is `@resvg/resvg-js` (a devDependency, used by `scripts/gen-brand-icons.mjs` to turn
 * the brand SVG into PNGs) — it renders SVG raster images, not pages, and it is not a runtime
 * dependency. `canvas-confetti` is the browser's. So the honest choices were: add `pdfkit`
 * (~1 MB of transitive tree, a second font stack, and a runtime dependency on a screen that
 * exists to export a report), or write the 200 lines a text-only PDF is. This file is the second
 * choice, and the reason it is defensible is that the report is text: no images, no vector art,
 * no embedded fonts, one page width and one direction.
 *
 * **The format it writes.** PDF 1.4, the two standard Type1 fonts every viewer has
 * (`Helvetica` and `Helvetica-Bold`), one content stream per page, an uncompressed stream (a
 * `/FlateDecode` would need zlib — `node:zlib` is available, but a compressed stream cannot be
 * grepped when an operator asks what the PDF actually says), and a real cross-reference table
 * with byte offsets. It is deterministic: same document in, same bytes out, no clock, no
 * `/CreationDate`, no `/ID`. That is what lets the export be compared and what keeps the fixture
 * clock the only instant the file names.
 *
 * **Non-ASCII is replaced, not mangled.** The base fonts are rendered with the standard
 * encoding, so every character is folded to ASCII here (`—` to `-`, curly quotes to straight
 * ones) and anything left becomes `?`. A party's name in a script the standard encoding cannot
 * carry prints as `?` rather than as mojibake or as a broken page — an honest loss in a
 * text-only export, and the JSON export beside it has the name intact.
 *
 * Pure: no React, no Next, no `pg`, no clock. `tests/report-pdf.test.ts` reads the bytes back
 * and asserts the version, the instant, the page count and the cross-reference offsets.
 */
import { SETTING_DEFINITIONS, SETTING_LABELS, MODE_LABELS } from "@/content/assessment";
import { GAP_KIND_LABELS } from "@/content/gaps";
import type { ReportDocument } from "@/lib/report/document";

/* ------------------------------------------------------------------ *
 * The page, and the lines on it
 * ------------------------------------------------------------------ */

/** A4 in PostScript points, at 72 dpi. The report is a document first, so A4 not Letter. */
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_LEFT = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 56;

/** One line of the report, before pagination. */
interface Line {
  readonly text: string;
  readonly size: number;
  readonly bold: boolean;
  /** Space above the line, in points — how headings breathe on a printed page. */
  readonly spaceBefore: number;
}

function line(text: string, size = 10, bold = false, spaceBefore = 0): Line {
  return { text, size, bold, spaceBefore };
}

/**
 * Fold a string to what the standard encoding can print.
 *
 * The replacements are the ones a report actually meets: the em dash in a template title, the
 * curly quotes in a summary, a non-breaking space in a name. Everything else becomes `?`, which
 * is visible to a reader as a gap rather than as a wrong character.
 */
export function asciiOf(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014\u2015]/g, "-")
    .replace(/[\u2026]/g, "...")
    .replace(/[\u00a0]/g, " ")
    .replace(/[^\x20-\x7e]/g, "?");
}

/** Escape the three characters that end a PDF string early. */
function pdfString(text: string): string {
  return asciiOf(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * How many characters of `size`-point text fit between the margins.
 *
 * 0.5 is Helvetica's average advance in ems for mixed prose (the true figure is 0.48–0.55 by
 * character class). It is an estimate on purpose: the alternative is a metrics table for two
 * fonts, and a line that overflows by a character is a cosmetic defect in a text export, not a
 * layout engine's job.
 */
function wrapWidth(size: number): number {
  return Math.max(24, Math.floor((PAGE_WIDTH - MARGIN_LEFT * 2) / (size * 0.5)));
}

/** Wrap one line onto as many lines as the width needs, breaking on spaces where it can. */
function wrap(text: string, size: number): string[] {
  const width = wrapWidth(size);
  const words = asciiOf(text).split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current === "") {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current !== "") lines.push(current);
  return lines.length === 0 ? [""] : lines;
}

/** One party's four answers, in the model's order, as a sentence. */
function answersOf(party: { feel: number; wish: number; think?: number; guess?: number }): string {
  const parts = [`feel ${party.feel}`, `wish ${party.wish}`];
  if (party.think !== undefined) parts.push(`think ${party.think}`);
  if (party.guess !== undefined) parts.push(`guess ${party.guess}`);
  return parts.join(", ");
}

/**
 * The whole report as lines, before it is cut into pages.
 *
 * Every number printed here is read out of the document — the document is the projection of the
 * opinion rows, so this function cannot print a number the rows do not carry.
 */
export function reportLines(document: ReportDocument): Line[] {
  const { report } = document;
  const lines: Line[] = [];

  lines.push(line("Relationship report", 18, true));
  lines.push(line(report.title, 12, false, 4));
  lines.push(line(`Instance ${report.slug}`, 10, false, 2));
  lines.push(line(`Template version ${document.template_version}`, 10, false, 10));
  lines.push(line(`Generated at ${document.generated_at}`, 10, false, 2));
  lines.push(
    line(
      `${MODE_LABELS[report.mode]} - ${SETTING_LABELS[report.setting]} Setting (${SETTING_DEFINITIONS[report.setting]})`,
      10,
      false,
      2,
    ),
  );

  lines.push(line("Verdict", 13, true, 14));
  const verdict =
    report.widest === null
      ? `Aligned under the ${SETTING_LABELS[report.setting]} Setting: all ${report.gap_count} Gaps meet it.`
      : `Not aligned under the ${SETTING_LABELS[report.setting]} Setting: ${report.verdict.unmet.length} of ${report.gap_count} Gaps exceed its limit of ${report.setting_limit}. The widest is a Gap of ${report.widest.gap} - ${GAP_KIND_LABELS[report.widest.kind]} on "${report.widest.prompt}".`;
  for (const chunk of wrap(verdict, 10)) lines.push(line(chunk, 10));

  lines.push(line("Aspects", 13, true, 14));
  report.aspects.forEach((aspect, index) => {
    lines.push(line(`${index + 1}. ${aspect.prompt}`, 11, true, 8));
    lines.push(line(`Scale: 1 = ${aspect.left_value}, 5 = ${aspect.right_value}`, 9, false, 1));
    lines.push(line(`Initiator ${aspect.initiator.name}: ${answersOf(aspect.initiator)}`, 9));
    lines.push(
      line(`Counterparty ${aspect.counterparty.name}: ${answersOf(aspect.counterparty)}`, 9),
    );
    const gaps = aspect.gap_kinds
      .map((kind) => `${GAP_KIND_LABELS[kind]} ${aspect.gaps[kind]}`)
      .join(", ");
    for (const chunk of wrap(`Gaps: ${gaps}`, 9)) lines.push(line(chunk, 9));
  });

  lines.push(line("Not computable", 13, true, 14));
  for (const entry of document.not_computable) {
    lines.push(line(`${entry.label} - not computable`, 10, true, 4));
    for (const chunk of wrap(entry.reason, 9)) lines.push(line(chunk, 9));
  }

  const footer =
    "Every number in this report is a function of the opinion rows it carries: a Gap is the difference of two scores, and the verdict compares each Gap with the Setting's limit. Nothing here is a stored value.";
  for (const [index, chunk] of wrap(footer, 8).entries()) {
    lines.push(line(chunk, 8, false, index === 0 ? 14 : 0));
  }
  return lines;
}

/* ------------------------------------------------------------------ *
 * Pagination
 * ------------------------------------------------------------------ */

interface PlacedLine extends Line {
  readonly y: number;
}

/**
 * Cut the lines into pages.
 *
 * A heading that would land alone at the foot of a page takes its first line with it: a band
 * title over nothing is the one layout defect worth ten lines of code in a text export.
 */
function paginate(lines: readonly Line[]): PlacedLine[][] {
  const pages: PlacedLine[][] = [];
  let page: PlacedLine[] = [];
  let y = PAGE_HEIGHT - MARGIN_TOP;

  for (let index = 0; index < lines.length; index += 1) {
    const entry = lines[index];
    if (entry === undefined) continue;
    const step = entry.size * 1.35 + entry.spaceBefore;
    const next = lines[index + 1];
    const needsWithNext = entry.bold && next !== undefined ? next.size * 1.35 : 0;

    if (y - step - needsWithNext < MARGIN_BOTTOM && page.length > 0) {
      pages.push(page);
      page = [];
      y = PAGE_HEIGHT - MARGIN_TOP;
    }
    y -= step;
    page.push({ ...entry, y });
  }
  pages.push(page);
  return pages;
}

/* ------------------------------------------------------------------ *
 * The file
 * ------------------------------------------------------------------ */

/** One page's content stream: a `BT … ET` block per line, absolutely placed. */
function contentStream(page: readonly PlacedLine[]): string {
  const body = page
    .map(
      (entry) =>
        `BT /${entry.bold ? "F2" : "F1"} ${entry.size} Tf 1 0 0 1 ${MARGIN_LEFT} ${entry.y.toFixed(2)} Tm (${pdfString(entry.text)}) Tj ET`,
    )
    .join("\n");
  return `${body}\n`;
}

const FONT_OBJECTS = [
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
];

/**
 * The report as PDF bytes.
 *
 * Object numbering is fixed: 1 catalog, 2 page tree, 3 and 4 the two fonts, then a content
 * stream and a page object per page. The cross-reference table is built from the byte length of
 * everything written before it — which is why this function assembles strings and measures, rather
 * than trusting a viewer to repair a wrong offset.
 */
export function renderReportPdf(document: ReportDocument): Uint8Array {
  const pages = paginate(reportLines(document));
  const streams = pages.map(contentStream);

  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  // 1 — catalog, 2 — page tree, 3/4 — fonts. Ids are assigned in that order, then per page.
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const firstPageObject = 5 + streams.length * 0;
  // The page tree's kids are filled in after the page ids are known; keep its slot at index 1.
  objects.push("");
  objects.push(FONT_OBJECTS[0] ?? "");
  objects.push(FONT_OBJECTS[1] ?? "");

  for (let index = 0; index < streams.length; index += 1) {
    const stream = streams[index] ?? "";
    const contentId = firstPageObject + index * 2;
    const pageId = contentId + 1;
    pageObjectIds.push(pageId);
    objects.push(
      `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}endstream`,
    );
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const header = "%PDF-1.4\n";
  const chunks: string[] = [header];
  const offsets: number[] = [];
  let cursor = Buffer.byteLength(header, "latin1");
  objects.forEach((body, index) => {
    const text = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(cursor);
    chunks.push(text);
    cursor += Buffer.byteLength(text, "latin1");
  });

  const xrefStart = cursor;
  const xref: string[] = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n"];
  for (const offset of offsets) xref.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  chunks.push(xref.join(""));

  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`,
  );

  // `latin1` is PDF's byte range for a string written this way: every character above is ASCII,
  // so the encoding is the identity and the byte offsets measured above are the ones written.
  //
  // Copied into a fresh `ArrayBuffer` rather than returned as a `Buffer` view: a Response body
  // wants `Uint8Array<ArrayBuffer>`, and a Node `Buffer` is a view over a pooled `ArrayBufferLike`
  // — the copy is what keeps the type (and the bytes) exact.
  const written = Buffer.from(chunks.join(""), "latin1");
  const bytes = new Uint8Array(new ArrayBuffer(written.length));
  bytes.set(written);
  return bytes;
}
