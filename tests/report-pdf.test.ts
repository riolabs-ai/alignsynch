/**
 * The PDF export (#504) — the file a customer is sent, read back as bytes.
 *
 * There is no PDF library in this tree (see the module comment in `lib/report/pdf.ts`), so the
 * properties that matter are the ones a viewer would silently repair and a reader would never
 * notice:
 *
 *   - it **is** a PDF: the header, a cross-reference table whose offsets are where the objects
 *     actually are, a trailer, and `%%EOF`;
 *   - it **names the template version and the generation instant**, both from the document (which
 *     takes its instant from the fixture clock) — the card's acceptance, asserted on the bytes;
 *   - it **states Doubt as not computable** rather than leaving a gap in the table;
 *   - it is **deterministic**: two renders of one document are the same bytes, and there is no
 *     `/CreationDate` or `/ID` for a viewer to disagree with.
 */
import { describe, expect, test } from "vitest";

import { assessments, assessmentInstances } from "@/data/assessments";
import { assessmentReport } from "@/lib/assessment-report";
import { reportDocument } from "@/lib/report/document";
import { renderReportPdf } from "@/lib/report/pdf";

const instance = assessmentInstances[0];
if (instance === undefined) throw new Error("data/assessments.ts carries no instance");
const template = assessments.find((candidate) => candidate.id === instance.templateId);
if (template === undefined) throw new Error(`no template "${instance.templateId}"`);

const VERSION = "9.9.9";
const document = reportDocument(instance, assessmentReport(instance, template), VERSION);

/** The bytes as the latin-1 string a PDF actually is — how a viewer reads it, and how we can. */
function textOf(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("latin1");
}

describe("the PDF is a PDF", () => {
  test("header, page tree, trailer and end-of-file", () => {
    const pdf = textOf(renderReportPdf(document));

    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("/Type /Pages");
    expect(pdf).toMatch(/\/Count \d+/);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  test("the cross-reference table points at the objects it claims", () => {
    const pdf = textOf(renderReportPdf(document));
    const startxref = /startxref\n(\d+)\n/.exec(pdf);
    expect(startxref).not.toBeNull();
    const offset = Number(startxref?.[1]);
    expect(pdf.slice(offset, offset + 4)).toBe("xref");

    // Every offset in the table must land on the object it belongs to.
    const table = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(pdf)?.[2] ?? "";
    const entries = table.split("\n").filter((entry) => / n $/.test(entry));
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((entry, index) => {
      const at = Number(entry.slice(0, 10));
      expect(pdf.slice(at).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
  });
});

describe("the PDF names what the card requires", () => {
  test("the template version and the generation instant are in the file", () => {
    const pdf = textOf(renderReportPdf(document));

    expect(pdf).toContain(`Template version ${VERSION}`);
    expect(pdf).toContain(`Generated at ${document.generated_at}`);
    // The instant is the fixture clock's, so the file names the day the fixtures were frozen.
    expect(document.generated_at.startsWith("2026-10-29")).toBe(true);
  });

  test("Doubt is printed as not computable, with its reason", () => {
    const pdf = textOf(renderReportPdf(document));

    expect(pdf).toContain("Doubt Gap - not computable");
    expect(pdf).toContain("no history");
  });

  test("the report's own numbers are printed, and no composite was invented", () => {
    const pdf = textOf(renderReportPdf(document));

    expect(pdf).toContain(`${document.report.aspects.length}`);
    expect(pdf).toContain(instance.parties[0]?.name ?? "");
  });
});

describe("the bytes are deterministic", () => {
  test("two renders of one document are identical", () => {
    expect(
      Buffer.from(renderReportPdf(document)).equals(Buffer.from(renderReportPdf(document))),
    ).toBe(true);
  });

  test("there is no creation date for a viewer to disagree with", () => {
    const pdf = textOf(renderReportPdf(document));

    expect(pdf).not.toContain("/CreationDate");
    expect(pdf).not.toContain("/ID");
  });
});
