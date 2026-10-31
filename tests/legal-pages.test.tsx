/**
 * The legal pages (#270) — the claims a reader is asked to rely on, as data and as markup.
 *
 * What this pins, and why each one is a test rather than a review note:
 *
 *   the banner      both pages open with the one draft sentence, on both brands, and it is
 *                   rendered above the document. A banner that drifts between `/terms` and
 *                   `/privacy`, or that a later edit moves below the fold, is the failure the
 *                   issue exists to prevent — an unreviewed policy that reads as final.
 *   no dismissal    the notice band carries no control and the view has no `"use client"`, no
 *                   handler and no state: non-dismissible is a property of the code, not a
 *                   promise in a comment.
 *   no placeholders every `[YOUR …]`, `[COMPANY…]`, `[DATE]`, `[PLACEHOLDER]`, `[DPO` token from
 *                   the templates is gone. A template placeholder rendered on a public page is
 *                   the tell that nobody read the document.
 *   removals stay   the eleven template sections taken out (`PROVENANCE.md`) have not crept back
 *                   in: no payments/billing heading, no arbitration clause, no security-measures
 *                   list, no retention table, no DPO or EU-representative block, and no
 *                   certification claimed anywhere.
 *   brand keying    the build's product name, domain and support address come from the `Brand`
 *                   record; the operator is RioLabs on both, and neither brand's facts leak into
 *                   the other's document.
 *   login row       `/login` resolves the legal section through `loginCopyFor`, the projection
 *                   that rebuilds the section list — a section missing from that list is a 500 at
 *                   request time and a green `next build`, which is the trap #269 hit one card ago.
 */
import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LegalPage } from "@/components/legal/legal-page";
import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { draftNotice, legalCopy, type LegalBrand } from "@/data/pages/legal";
import { loginCopy } from "@/data/pages/login";
import { loginCopyFor } from "@/lib/auth-copy";
import type { PageCopy } from "@/content/pages";
import { itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const quizHub = quizHubBrand as Brand;
const alignSynch = alignSynchBrand as Brand;

/** Every string a fixture carries, in declaration order — the copy as text, for scanning. */
function strings(value: unknown): string {
  const found: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (node && typeof node === "object") {
      for (const entry of Object.values(node)) walk(entry);
    }
  };
  walk(value);
  return found.join("\n");
}

/**
 * The HTML a reader actually sees: Next inlines the RSC flight payload in `<script>` tags, and
 * that payload carries the fixture's own strings, so an assertion over the raw document counts
 * text nobody renders. Strip the scripts before asking what is on the page.
 */
function visible(html: string): string {
  return html.replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

/** The two pages of one brand, as [route, copy] pairs. */
function pages(record: LegalBrand): [string, PageCopy][] {
  const copies = legalCopy(record);
  return [
    ["/terms", copies.terms],
    ["/privacy", copies.privacy],
  ];
}

describe("the draft banner", () => {
  it("is the sentence issue #270 specifies, word for word, on the AlignSynch build", () => {
    expect(draftNotice(alignSynch)).toBe(
      "Version 1 draft. Adapted from an MIT-licensed template and not reviewed by a lawyer. AlignSynch will have these terms reviewed by counsel before general availability.",
    );
  });

  it("names the product the reader is actually using", () => {
    expect(draftNotice(quizHub)).toContain("QuizHub will have these terms reviewed by counsel");
    expect(draftNotice(quizHub)).not.toContain("AlignSynch");
    expect(draftNotice(alignSynch)).toContain("AlignSynch will have these terms reviewed");
  });

  it("is the first section of both pages, on both brands, and opens its body", () => {
    for (const record of [quizHub, alignSynch]) {
      for (const [route, copy] of pages(record)) {
        expect(copy.sections?.[0]?.id, `${route} does not open with the draft notice`).toBe(
          "draft-notice",
        );
        const notice = sectionOf(copy, "draft-notice");
        expect(sectionBody(notice).startsWith(draftNotice(record))).toBe(true);
      }
    }
  });

  it("renders above the document, not after it, and states the sentence once", () => {
    for (const record of [quizHub, alignSynch]) {
      for (const [route, copy] of pages(record)) {
        const html = visible(renderToStaticMarkup(<LegalPage copy={copy} />));
        const banner = html.indexOf(draftNotice(record));
        const firstHeading = html.indexOf(copy.sections?.[1]?.heading ?? "");
        expect(banner, `${route} does not render the banner`).toBeGreaterThan(-1);
        expect(firstHeading, `${route} does not render its second section`).toBeGreaterThan(-1);
        expect(banner, `${route} renders the banner below the document`).toBeLessThan(firstHeading);
        /**
         * Once, not twice: the band's heading is the sentence's opening words, and a render that
         * draws both prints "Version 1 draft" twice in a row. The heading is dropped when the
         * body already says it, and this is the assertion that keeps that true.
         */
        expect(html.split(draftNotice(record)).length - 1, `${route} repeats the banner`).toBe(1);
      }
    }
  });

  it("offers no way to dismiss it — no control, no state, no client boundary", () => {
    const raw = readFileSync(
      new URL("../components/legal/legal-page.tsx", import.meta.url),
      "utf8",
    );
    /**
     * Comments stripped before the scan: this file's own explanation says why the component
     * carries no `"use client"`, and a source assertion that matches its documentation fails on
     * the sentence that documents the absence. The scan is over code, so remove the prose first.
     */
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(source).not.toContain("use client");
    expect(source).not.toMatch(/\bonClick\b|\bonDismiss\b|\bdismiss\b|\buseState\b/);

    for (const record of [quizHub, alignSynch]) {
      for (const [route, copy] of pages(record)) {
        const html = renderToStaticMarkup(<LegalPage copy={copy} />);
        const band = html.slice(html.indexOf('id="draft-notice"'), html.indexOf("</section>"));
        expect(band, `${route} renders a control inside the notice band`).not.toContain("<button");
        expect(band).not.toContain("aria-label");
      }
    }
  });
});

describe("the removed template sections stayed removed", () => {
  const all = [...pages(quizHub), ...pages(alignSynch)].map(([route, copy]) => ({
    route,
    copy,
    text: strings(copy),
  }));

  it("carries no un-substituted template placeholder", () => {
    for (const { route, text } of all) {
      const tokens = [
        "[YOUR ",
        "[YOUR]",
        "[COMPANY",
        "[DATE]",
        "[PLACEHOLDER]",
        "[PLACEHOLDER",
        "[DPO",
        "[ADDRESS",
      ].filter((token) => text.includes(token));
      expect(tokens, `${route} still carries ${tokens.join(", ")}`).toEqual([]);
    }
  });

  it("has no payments, billing, arbitration or usage-limit clause in the Terms", () => {
    for (const record of [quizHub, alignSynch]) {
      const terms = legalCopy(record).terms;
      const headings = (terms.sections ?? []).map((section) => section.heading ?? "").join(" | ");
      expect(headings).not.toMatch(/payments|billing|arbitration|usage limits/i);
      expect(strings(terms)).toContain("no arbitration provider");
    }
  });

  it("claims no certification, audit or encryption-at-rest that the build does not have", () => {
    for (const { text } of all) {
      expect(text).not.toMatch(/AES-?256/i);
      expect(text).not.toMatch(/penetration test/i);
      expect(text).not.toMatch(/has completed a formal security audit/i);
      expect(text).not.toMatch(/SOC ?2 (certified|compliant)/i);
      expect(text).not.toMatch(/ISO ?27001/i);
    }
    for (const record of [quizHub, alignSynch]) {
      expect(strings(legalCopy(record).privacy)).toMatch(/do not hold a SOC 2 report/);
    }
  });

  it("names no Data Protection Officer, EU representative, address or retention schedule", () => {
    for (const record of [quizHub, alignSynch]) {
      const privacy = legalCopy(record).privacy;
      const headings = (privacy.sections ?? []).map((section) => section.heading ?? "").join(" | ");
      expect(headings).not.toMatch(/data protection officer|eu representative|security measures/i);
      expect(strings(privacy)).toContain("has not appointed a Data Protection Officer");
      expect(strings(privacy)).toContain("designates no EU or UK representative");
      // A retention table would be a schedule nobody implemented; §7 keeps the verified facts.
      expect(strings(privacy)).toContain("There is no automated deletion in the current build.");
    }
  });

  it("keeps the MIT attribution on both pages, for both brands", () => {
    for (const record of [quizHub, alignSynch]) {
      const { terms, privacy } = legalCopy(record);
      for (const copy of [terms, privacy]) {
        expect(sectionBody(sectionOf(copy, "attribution"))).toContain(
          "Copyright (c) 2026 PolicyForge",
        );
        expect(sectionBody(sectionOf(copy, "attribution"))).toContain("MIT License");
      }
    }
  });
});

describe("the copy is keyed by brand, and the operator is not", () => {
  it("reads the product name, domain and support address from the brand record", () => {
    const align = strings(legalCopy(alignSynch));
    expect(align).toContain("alignsynch.com");
    expect(align).toContain("alignsynch@riolabs.ai");
    expect(align).not.toContain("quizhub.com");

    const quiz = strings(legalCopy(quizHub));
    expect(quiz).toContain("quizhub.com");
    expect(quiz).toContain("quizhub@riolabs.ai");
    expect(quiz).not.toMatch(/alignsynch\.(com|ai)/i);
  });

  it("says RioLabs is the operator on both builds, because it is one company", () => {
    for (const record of [quizHub, alignSynch]) {
      expect(strings(legalCopy(record))).toContain(`operated by RioLabs`);
    }
  });

  it("names the governing law as Texas on both builds, as a stated assumption", () => {
    for (const record of [quizHub, alignSynch]) {
      const terms = legalCopy(record).terms;
      const disputes = sectionOf(terms, "disputes");
      expect(strings(disputes)).toContain("laws of the State of Texas");
      expect(itemBody(disputes, "venue")).toContain("designates no arbitration provider");
    }
  });
});

describe("/login carries the same two links", () => {
  it("resolves the legal section through the projection that rebuilds the section list", () => {
    for (const [record, id] of [
      [quizHub, "quizhub"],
      [alignSynch, "alignsynch"],
    ] as const) {
      const copy = loginCopyFor(loginCopy(record), id);
      const legal = sectionOf(copy, "legal");
      expect(itemLabel(legal, "terms")).toBe("Terms of Service");
      expect(itemLabel(legal, "privacy")).toBe("Privacy Policy");
    }
  });
});
