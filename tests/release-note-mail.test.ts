/**
 * The email band and the release note (#548).
 *
 * Four things are asserted here, and each one is a rule the card states rather than a snapshot:
 *
 *   1. **The HTML is built from the text.** `renderEmail()` returns `{ text, html }`, and the test
 *      proves the html is `htmlFromText(text)` — a function of the string, not of the blocks. That
 *      is the call-graph property the card asks for: it is impossible for the HTML to carry a
 *      sentence the text does not, and impossible for a block to reach the HTML without first
 *      reaching the text.
 *   2. **The unsubscribe line is class-bound in both directions.** A `marketing` render carries it
 *      and refuses to render without one; a `transactional` render carries none and refuses to
 *      render with one.
 *   3. **The Known limits block ships verbatim, and its absence is a refusal.** Every bullet of
 *      the entry's limits is present in the plain text word for word, after the highlights.
 *   4. **The band is the band.** 560 px column, graphite `#37474F` header drawing the brand lockup
 *      (never the square icon), `#363d49` body text, no gradient and no shadow.
 *
 * The fixture entry is deliberately a version that does not exist (`9.9.9`): this file must never
 * become a second copy of a real release note that then drifts from `CHANGELOG.md`.
 */
import { describe, expect, it } from "vitest";
import { brand } from "@/data/brand";
import { brandMark } from "@/lib/brand-mark";
import {
  composeText,
  htmlFromText,
  modeNote,
  plainInline,
  renderEmail,
  type EmailDocument,
} from "@/lib/email/band";
import {
  changelogSection,
  parseEntry,
  releaseNoteBlocks,
  releaseNoteDocument,
  versionOfTag,
} from "@/lib/email/release-note";

const ENTRY = `## 9.9.9 — 2026-10-01

One sentence on what this release is for.

### Console
- An audited **operations console**: every write passes one \`act()\` path.
- A second bullet, which the parser must not merge into the first.

### Commits
- \`feat(console)\` — a commit subject that must never reach the mail.
- \`fix(mail)\` — a second ledger line that must never reach the mail.

### Known limits
- **Stripe is test mode only** — checkout cannot charge a card.
- **Chat has no persistence** — /chat has no tables behind it.`;

const CHANGELOG = `# Changelog

Intro prose that belongs to no release.

## [9.9.9] - 2026-10-01

One sentence on what this release is for.

### Console
- A bullet.

### Known limits
- A limit, stated plainly.

## [9.9.8] - 2026-09-01

An older entry.
`;

function document(blocks: EmailDocument["blocks"], subject = "A subject"): EmailDocument {
  return { subject, preheader: "A preheader sentence.", blocks };
}

describe("the band composes text first", () => {
  it("returns an html that is htmlFromText of the text it returned", () => {
    const doc = document([
      { kind: "heading", text: "Console" },
      { kind: "list", items: ["One.", "Two."] },
    ]);
    const rendered = renderEmail(doc, { emailClass: "transactional" });
    expect(rendered.html).toBe(htmlFromText(rendered.text, { preheader: doc.preheader }));
  });

  it("carries every line of the text into the html, in the same order", () => {
    const doc = document([
      { kind: "heading", text: "Console" },
      { kind: "paragraph", text: "A paragraph with an & and a < in it." },
      { kind: "list", items: ["First bullet.", "Second bullet."] },
    ]);
    const { text, html } = renderEmail(doc, { emailClass: "transactional" });

    const lines = text
      .split("\n")
      .filter((line) => line.trim() !== "" && line !== "---")
      .map((line) => line.replace(/^## /, "").replace(/^- /, ""))
      // The site line is also the header lockup's `src` origin, so it legitimately appears near the
      // top of the document as well; order is asserted over prose, and the footer line is checked
      // for presence on its own below.
      .filter((line) => !line.startsWith("http"));

    let cursor = -1;
    for (const line of lines) {
      const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const at = html.indexOf(escaped);
      expect(at, `"${line}" is missing from the html`).toBeGreaterThan(-1);
      expect(at, `"${line}" is out of order in the html`).toBeGreaterThan(cursor);
      cursor = at;
    }
    expect(html).toContain(`https://${brand.domain}`);
  });

  it("does not read the html back into the text — the text carries no markup at all", () => {
    const { text } = renderEmail(document([{ kind: "paragraph", text: "Plain sentence." }]), {
      emailClass: "transactional",
    });
    expect(text).not.toMatch(/<[a-z/!]/i);
    expect(text).not.toContain("style=");
    expect(text).not.toContain("&lt;");
  });

  it("loses the html sentence when the text loses it — nothing reaches the html by another route", () => {
    const doc = document([{ kind: "paragraph", text: "Kept sentence." }]);
    const { text, html } = renderEmail(doc, { emailClass: "transactional" });
    expect(html).toContain("Kept sentence.");

    const withoutIt = htmlFromText(text.replace("Kept sentence.", ""), {
      preheader: doc.preheader,
    });
    expect(withoutIt).not.toContain("Kept sentence.");
  });

  it("keeps a verbatim block's wording, bullets and all", () => {
    const lines = ["- A limit with **emphasis** and `code`.", "- A second limit."];
    const text = composeText(document([{ kind: "verbatim", lines }]), {
      emailClass: "transactional",
    });
    expect(text).toContain("- A limit with emphasis and code.");
    expect(htmlFromText(text)).toContain("A limit with emphasis and code.");
  });

  it("flattens markdown that plain text cannot carry, and keeps a link's target when its label is opaque", () => {
    expect(plainInline("**bold** and `code`")).toBe("bold and code");
    expect(plainInline("see [#482](https://example.com/482)")).toBe("see #482");
    expect(plainInline("see [the runbook](https://example.com/rb)")).toBe(
      "see the runbook (https://example.com/rb)",
    );
  });
});

describe("the footer is class-bound in both directions", () => {
  const doc = document([{ kind: "paragraph", text: "Body." }]);

  it("carries an unsubscribe line on a marketing render", () => {
    const { text, html } = renderEmail(doc, {
      emailClass: "marketing",
      unsubscribeUrl: "https://alignsynch.com/unsubscribe?token=abc",
    });
    expect(text).toContain("Unsubscribe: https://alignsynch.com/unsubscribe?token=abc");
    expect(html).toContain("Unsubscribe: https://alignsynch.com/unsubscribe?token=abc");
  });

  it("carries none on a transactional render", () => {
    const { text, html } = renderEmail(doc, { emailClass: "transactional" });
    expect(text).not.toContain("Unsubscribe");
    expect(html).not.toContain("Unsubscribe");
  });

  it("refuses a marketing render with no unsubscribe URL", () => {
    expect(() => renderEmail(doc, { emailClass: "marketing" })).toThrow(/unsubscribe URL/);
  });

  it("refuses a transactional render that was handed one", () => {
    expect(() =>
      renderEmail(doc, { emailClass: "transactional", unsubscribeUrl: "https://x.test/u" }),
    ).toThrow(/must not carry an unsubscribe line/);
  });

  it("says a non-live key cannot reach a mailbox, and says nothing on a live one", () => {
    expect(modeNote("test")).toMatch(/test key/);
    expect(modeNote("captured")).toMatch(/capture endpoint/);
    expect(modeNote("live")).toBeUndefined();
    expect(modeNote("unset")).toBeUndefined();

    const testRender = renderEmail(doc, { emailClass: "transactional", mode: "test" });
    expect(testRender.text).toMatch(/not delivered to a real mailbox/);
    const liveRender = renderEmail(doc, { emailClass: "transactional", mode: "live" });
    expect(liveRender.text).not.toMatch(/real mailbox/);
  });
});

describe("the band's shell", () => {
  const doc = document([{ kind: "paragraph", text: "Body." }]);
  const { html } = renderEmail(doc, { emailClass: "transactional" });

  it("is a 560 px maximum column that does not overflow a phone", () => {
    expect(html).toContain("max-width:560px");
    // A hard `width="560"` would make a 390 px client scroll sideways; the column is capped, not fixed.
    expect(html).not.toContain('width="560"');
  });

  it("draws a graphite header band with the lockup, never the square icon", () => {
    expect(html).toContain("background:#37474F");
    const mark = brandMark(brand.logo);
    if (mark === undefined) {
      // A brand whose logo is a placeholder (the default build) is drawn by name, not by icon.
      expect(html).toContain(`>${brand.name}</span>`);
    } else {
      expect(html).toContain(`${brand.domain}${mark.src}`);
      // The lockup is dark ink, so it sits on a white plate rather than being recoloured.
      expect(html).toContain("background:#ffffff;border-radius:4px");
      expect(html).not.toMatch(/filter:\s*(invert|brightness)/);
    }
    expect(html).not.toContain(brand.icon);
  });

  it("paints body text #363d49, with no gradient and no shadow", () => {
    expect(html).toContain("color:#363d49");
    expect(html).not.toMatch(/linear-gradient|radial-gradient/);
    expect(html).not.toMatch(/box-shadow/);
    expect(html).not.toMatch(/<shadow/i);
  });
});

describe("the changelog parse accepts both heading spellings", () => {
  it("reads `## [9.9.9] - <date>`", () => {
    const section = changelogSection(CHANGELOG, "9.9.9");
    expect(section).toMatchObject({ version: "9.9.9", date: "2026-10-01" });
    expect(section?.body).toContain("A limit, stated plainly.");
    expect(section?.body).not.toContain("An older entry.");
  });

  it("reads `## 9.9.9 — <date>`, the em dash an owner-approved entry uses", () => {
    const section = changelogSection(ENTRY, "9.9.9");
    expect(section).toMatchObject({ version: "9.9.9", date: "2026-10-01" });
  });

  it("answers undefined for a version the file does not carry", () => {
    expect(changelogSection(CHANGELOG, "1.0.1")).toBeUndefined();
  });

  it("strips the tag's v, in both the section lookup and the version", () => {
    expect(versionOfTag("v1.4.0")).toBe("1.4.0");
    expect(changelogSection(CHANGELOG, "v9.9.9")?.version).toBe("9.9.9");
  });

  it("joins a wrapped bullet instead of breaking the sentence", () => {
    const parsed = parseEntry(`### Known limits\n- A limit that wraps\n  onto a second line.\n`);
    expect(parsed.subsections[0]?.items).toEqual(["A limit that wraps onto a second line."]);
  });
});

describe("the release note", () => {
  const section = changelogSection(ENTRY, "9.9.9");
  if (section === undefined) throw new Error("fixture entry did not parse");
  const doc = releaseNoteDocument(section);
  const { text } = renderEmail(doc, { emailClass: "transactional" });

  it("has the subject `{brand} {version} is live`", () => {
    expect(doc.subject).toBe(`${brand.name} 9.9.9 is live`);
  });

  it("says the version and the date", () => {
    expect(text).toContain("Version 9.9.9, released 2026-10-01.");
  });

  it("shows the entry's own intro once, as the lead", () => {
    const occurrences = text.split("One sentence on what this release is for.").length - 1;
    expect(occurrences).toBe(1); // the preheader line, drawn as the lead — never twice
    expect(doc.preheader).toBe("One sentence on what this release is for.");
  });

  it("includes every Known limits bullet word for word, after the highlights", () => {
    const limitsAt = text.indexOf("## Known limits");
    expect(limitsAt).toBeGreaterThan(text.indexOf("## Console"));
    expect(text.slice(limitsAt)).toContain(
      "- Stripe is test mode only — checkout cannot charge a card.",
    );
    expect(text.slice(limitsAt)).toContain(
      "- Chat has no persistence — /chat has no tables behind it.",
    );
  });

  it("keeps the bullets it was given and invents none", () => {
    const bullets = text.split("\n").filter((line) => line.startsWith("- "));
    expect(bullets).toHaveLength(4);
  });

  it("drops the `### Commits` ledger — provenance is not a highlight", () => {
    // The ledger is in the entry (release:check requires it) …
    expect(section?.body).toContain("### Commits");
    expect(section?.body).toContain("a commit subject that must never reach the mail");
    // … and it is not in the mail: no heading, no bullet, no mention of either ledger line.
    expect(text).not.toContain("## Commits");
    expect(text).not.toContain("a commit subject that must never reach the mail");
    expect(text).not.toContain("a second ledger line that must never reach the mail");
    // Known limits still ships, and still ships last and verbatim.
    expect(text).toContain("## Known limits");
    expect(text).toContain("- Stripe is test mode only — checkout cannot charge a card.");
    expect(text.indexOf("## Known limits")).toBeGreaterThan(text.indexOf("## Console"));
    expect(text).not.toContain("## Commits");
  });

  it("refuses an entry with no Known limits block rather than sending a highlight reel", () => {
    const noLimits = { version: "9.9.7", date: "2026-09-01", body: "### Added\n- A thing.\n" };
    expect(() => releaseNoteBlocks(noLimits)).toThrow(/Known limits/);
  });

  it("invents no lead where the entry has no intro at all", () => {
    const bare = { version: "9.9.6", date: "2026-09-01", body: "### Known limits\n- One limit.\n" };
    const bareDoc = releaseNoteDocument(bare);
    // The note opens on the version line: with no intro in the entry there is no lead paragraph,
    // rather than a sentence nobody wrote standing in for one.
    expect(bareDoc.blocks[0]).toEqual({
      kind: "paragraph",
      text: "Version 9.9.6, released 2026-09-01.",
    });
    expect(bareDoc.preheader).toContain("9.9.6");
    expect(JSON.stringify(bareDoc.blocks)).not.toContain("{{");
  });

  it("carries no unsubscribe line — a release note is transactional", () => {
    expect(text).not.toContain("Unsubscribe");
    const { html } = renderEmail(doc, { emailClass: "transactional" });
    expect(html).not.toContain("Unsubscribe");
  });
});
