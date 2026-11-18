/**
 * The two block kinds a release note gains (#1169 lane B): `EmailImage` and `EmailTable`.
 *
 * Five rules, and the refusals are the point:
 *
 *   1. **An asset path is checked, not trusted.** `src` must be root-relative, and it must resolve to
 *      a file that exists under `public/`. The tree is read, never the network: a mail that names a
 *      file nobody committed is a broken picture in a stakeholder's inbox, and `data:check` E10
 *      already treats a missing asset as a red gate rather than a shrug. A `data:` URL and a remote
 *      `https://` src are refused by name, not folded into the generic shape refusal, because they
 *      are the two ways a mail starts carrying a picture the repository does not hold.
 *   2. **No intrinsic size, no render.** `width`/`height` are positive integers, and they must be a
 *      real shape of the committed file — the `next/image` lesson (`AGENTS.md`, pitfalls) applied to
 *      a medium that has no build step to catch it.
 *   3. **No decorative image.** `alt` is required and non-empty: a stakeholder reading the text half
 *      of the mail must be told what the picture showed.
 *   4. **Inline styles only.** No `<style>`, no `class=`, no `data:` URL — mail clients strip a
 *      stylesheet. Every `<img>` is drawn inside a table cell with explicit `width`/`height`
 *      attributes and `display:block;border:0`, so Outlook does not add a baseline gap.
 *   5. **The text is still the source.** The HTML stays a pure function of the composed text: an
 *      image contributes one markdown line to the text, a table contributes its own caption and
 *      rows, and `htmlFromText()` reads both back. Deleting the line from the text deletes the
 *      picture from the HTML, exactly as it deletes a sentence.
 */
import { describe, expect, it } from "vitest";
import { brand } from "@/data/brand";
import { composeText, htmlFromText, renderEmail, type EmailDocument } from "@/lib/email/band";
import { emailImage, emailImageIfPresent, emailTable } from "@/lib/email/blocks";

/** The hero lane A committed. If this file moves, this suite is the first thing that says so. */
const REAL = "/og/email-banner.png";

function document(blocks: EmailDocument["blocks"]): EmailDocument {
  return { subject: "A subject", preheader: "A preheader sentence.", blocks };
}

describe("EmailImage refuses what a mail must not carry", () => {
  it("refuses a src that is not under public/ — a data: URL by name", () => {
    expect(() =>
      emailImage({ src: "data:image/png;base64,iVBORw0KGgo=", alt: "A picture." }),
    ).toThrow(/data: URL is not an asset/);
  });

  it("refuses a remote https:// src by name", () => {
    expect(() => emailImage({ src: "https://example.com/shot.png", alt: "A screenshot." })).toThrow(
      /remote src is not an asset/,
    );
  });

  it("refuses a src that does not start with /", () => {
    expect(() => emailImage({ src: "og/email-banner.png", alt: "A banner." })).toThrow(
      /src must be root-relative/,
    );
  });

  it("refuses a root-relative src with no file behind it", () => {
    expect(() => emailImage({ src: "/og/not-committed.png", alt: "A picture." })).toThrow(
      /no file at public\/og\/not-committed\.png/,
    );
  });

  it("refuses a src carrying whitespace — it would end the text's own image line early", () => {
    expect(() => emailImage({ src: "/og/email banner.png", alt: "A banner." })).toThrow(
      /src must not contain whitespace/,
    );
  });

  it("refuses a missing, zero or fractional width/height", () => {
    for (const dims of [
      { width: 0, height: 10 },
      { width: 40 },
      { width: 40.5, height: 10 },
      { height: 10 },
    ]) {
      expect(() => emailImage({ src: REAL, alt: "A banner.", ...dims })).toThrow(
        /width and height must be positive integers/,
      );
    }
  });

  it("refuses an empty alt — a release note carries no decorative image", () => {
    expect(() => emailImage({ src: REAL, alt: "   " })).toThrow(/alt must be non-empty/);
  });

  it("refuses a width/height that is not the shape of the committed file", () => {
    expect(() => emailImage({ src: REAL, alt: "A banner.", width: 300, height: 300 })).toThrow(
      /is 1120×280 in the tree/,
    );
  });
});

describe("EmailImage draws the asset it was given", () => {
  const block = emailImage({ src: REAL, alt: "The release banner." });

  it("takes its drawn size from the file, capped to the 560 px column", () => {
    expect(block).toMatchObject({ kind: "image", src: REAL, alt: "The release banner." });
    expect(Number.isInteger(block.width)).toBe(true);
    expect(Number.isInteger(block.height)).toBe(true);
    // 1120×280 scaled into the 504 px of content width (560 minus the 28 px gutters).
    expect(block.width).toBe(504);
    expect(block.height).toBe(126);
  });

  it("accepts a declared size that keeps the file's shape", () => {
    expect(emailImage({ src: REAL, alt: "A banner.", width: 336, height: 84 })).toMatchObject({
      width: 336,
      height: 84,
    });
  });

  it("renders inline, inside a cell, with explicit width/height and no stylesheet", () => {
    const { html } = renderEmail(document([block]), { emailClass: "transactional" });
    expect(html).not.toContain("<style");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).toContain(`src="https://${brand.domain}${REAL}"`);
    expect(html).toContain(`width="504" height="126"`);
    expect(html).toContain("display:block;border:0");
    // The only images in the mail are the lockup and this figure, and both are served by the
    // brand's own origin from a path under `public/`.
    const sources = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((match) => match[1] ?? "");
    expect(sources).toContain(`https://${brand.domain}${REAL}`);
    for (const src of sources) expect(src.startsWith(`https://${brand.domain}/`)).toBe(true);
  });

  it("carries a caption as text, not as a second source of truth", () => {
    const captioned = emailImage({
      src: REAL,
      alt: "A banner.",
      caption: "Where the release lands.",
    });
    const { text, html } = renderEmail(document([captioned]), { emailClass: "transactional" });
    expect(text).toContain("Where the release lands.");
    expect(html).toContain("Where the release lands.");
  });

  it("is the text's line that draws the picture — delete the line, lose the picture", () => {
    const { text, html } = renderEmail(document([block]), { emailClass: "transactional" });
    expect(html).toContain(`<img src="https://${brand.domain}${REAL}"`);
    const withoutIt = htmlFromText(
      text
        .split("\n")
        .filter((line) => !line.startsWith("!["))
        .join("\n"),
      { figures: [block] },
    );
    expect(withoutIt).not.toContain(REAL);
  });

  it("refuses to draw an image line it has no intrinsic size for", () => {
    expect(() => htmlFromText(`A title\n\n![A banner.](${REAL})\n`)).toThrow(
      /no intrinsic size for \/og\/email-banner\.png/,
    );
  });

  it("answers undefined for a conditional figure whose asset is absent", () => {
    expect(
      emailImageIfPresent({ src: "/og/surface-nothing.png", alt: "A surface." }),
    ).toBeUndefined();
    expect(emailImageIfPresent({ src: REAL, alt: "A banner." })?.kind).toBe("image");
    // Still refuses a src a mail must not carry — optional is about the file, not the shape.
    expect(() => emailImageIfPresent({ src: "https://example.com/x.png", alt: "A." })).toThrow(
      /remote src is not an asset/,
    );
  });
});

describe("EmailTable refuses what a mail must not carry", () => {
  it("refuses a table with no caption", () => {
    expect(() => emailTable({ caption: "  ", columns: ["A"], rows: [["1"]] })).toThrow(
      /table needs a caption/,
    );
  });

  it("refuses a table with no columns", () => {
    expect(() => emailTable({ caption: "Totals", columns: [], rows: [] })).toThrow(
      /table needs at least one column/,
    );
  });

  it("refuses a row whose length disagrees with the columns", () => {
    expect(() =>
      emailTable({ caption: "Totals", columns: ["Surface", "State"], rows: [["Console"]] }),
    ).toThrow(/row 1 has 1 cell; the table has 2 columns/);
  });

  it("refuses a ragged row at render time too — `composeText` is public", () => {
    const ragged = {
      kind: "table" as const,
      caption: "Totals",
      columns: ["Surface", "State"],
      rows: [["Console"]],
    };
    expect(() => composeText(document([ragged]), { emailClass: "transactional" })).toThrow(
      /row 1 has 1 cell\(s\); the table has 2 columns/,
    );
  });
});

describe("EmailTable draws the text the entry carries", () => {
  const table = emailTable({
    caption: "What shipped",
    columns: ["Surface", "State"],
    rows: [
      ["Console", "live"],
      ["Inbox", "live"],
    ],
  });

  it("renders a header row and every cell inline, with no stylesheet", () => {
    const { html } = renderEmail(document([table]), { emailClass: "transactional" });
    expect(html).not.toContain("<style");
    expect(html).not.toMatch(/\sclass=/);
    expect(html).toContain("What shipped");
    expect(html).toContain(">Surface</th>");
    expect(html).toContain(">Console</td>");
    expect(html).toContain(">Inbox</td>");
    expect(html).toContain("border-collapse:collapse");
  });

  it("puts the table in the text as the entry's own rows", () => {
    const { text } = renderEmail(document([table]), { emailClass: "transactional" });
    expect(text).toContain("Table: What shipped");
    expect(text).toContain("| Surface | State |");
    expect(text).toContain("| Console | live |");
  });

  it("keeps a cell that contains a pipe, and does not invent one", () => {
    const piped = emailTable({ caption: "Pipes", columns: ["A"], rows: [["one | two"]] });
    const { text, html } = renderEmail(document([piped]), { emailClass: "transactional" });
    expect(html).toContain(">one | two</td>");
    expect(htmlFromText(text)).toContain(">one | two</td>");
  });
});
