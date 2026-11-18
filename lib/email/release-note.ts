/**
 * Template #1 — the stakeholder release note (#548).
 *
 * **Why this is a module and not a heredoc in the workflow.** The mail is generated from
 * `CHANGELOG.md`, and that file is generated from the conventional commits by `scripts/release.sh`.
 * Parsing it in YAML would put a second reader of the changelog's shape in a file no test can drive;
 * here the parse is a pure function over the file's text, so the reminder that a section is missing
 * its Known limits block is a unit test, not a failed tag.
 *
 * **The Known limits block ships verbatim, and its absence is an error.** A release note that lists
 * only what got better is a highlight reel; the limits are accurate and they are the part a reader
 * needs before deciding anything. So the block is taken as written — bullets in the same order, in
 * the same words — and a section whose limits are missing makes `releaseNoteDocument()` throw
 * rather than send a note that quietly omits them.
 *
 * **Nothing is invented.** The intro paragraph is the entry's own. An entry with no intro gets no
 * invented lead: the preheader already carries `…, released <date>.` and the note opens on the
 * version line, because a sentence nobody wrote is worse than an absent one. No metric, no
 * customer, no testimonial is computed, quoted or implied: every sentence below comes from the
 * changelog or from `data/brand.ts`.
 *
 * **The visuals are the ones that exist, and no others (#1169).** The note draws the hero banner
 * `public/og/email-banner.png`, then one figure per surface the entry names — each only when a
 * matching asset is really committed under `public/`. A surface with no asset gets no figure: no
 * stock picture, no placeholder, and above all no chart. A chart would be a number the mail
 * computed, and the whole point of this template is that a reader can trace every value in it to
 * the changelog entry that carried it. A table is the same rule seen from the other side — the
 * `table` block reproduces text the entry already writes, and it never aggregates anything.
 *
 * Two heading spellings are accepted, because the tree carries both: the generated
 * `## [1.3.0] - 2026-11-03` and the hand-written `## 1.4.0 — 2026-11-04` an owner-approved entry
 * uses. A parser that knew only one would fail the first release cut in the other style.
 */
import { brand } from "@/data/brand";
import { emailImageIfPresent } from "./blocks";
import { plainInline, type EmailBlock, type EmailDocument, type EmailImage } from "./band";

/** One release's section of the changelog, as the file carries it. */
export interface ChangelogSection {
  readonly version: string;
  /** The heading's date, `YYYY-MM-DD`, exactly as the file spells it. */
  readonly date: string;
  /** Everything under the heading, before the next `## ` — markdown, unparsed. */
  readonly body: string;
}

/** `## [1.3.0] - 2026-11-03`, `## 1.4.0 — 2026-11-04`, and the `## [1.1.0-rc1] - …` spelling. */
const SECTION_HEADING =
  /^##\s+\[?v?([0-9][0-9A-Za-z.+-]*)\]?(?:\s*[-–—]\s*|\s+)(\d{4}-\d{2}-\d{2})\s*$/;

/** `v1.4.0` -> `1.4.0`. The tag carries the `v`; the changelog heading does not. */
export function versionOfTag(tag: string): string {
  return tag.trim().replace(/^v/, "");
}

/**
 * The section of `CHANGELOG.md` for one version, or `undefined` when the file has no such entry.
 *
 * The scan stops at the next `## ` heading rather than at a blank line, because an entry contains
 * `###` subsections and blank lines throughout; and it keeps scanning past the first heading that
 * is not the version asked for, because a changelog is newest-first but nothing guarantees the
 * caller asks for the newest.
 */
export function changelogSection(changelog: string, version: string): ChangelogSection | undefined {
  const lines = changelog.split("\n");
  const wanted = versionOfTag(version);
  let inside = false;
  let date = "";
  const body: string[] = [];

  for (const line of lines) {
    const heading = SECTION_HEADING.exec(line);
    if (heading) {
      if (inside) break;
      if (heading[1] === wanted) {
        inside = true;
        date = heading[2] ?? "";
      }
      continue;
    }
    if (inside) body.push(line);
  }

  if (!inside) return undefined;
  return { version: wanted, date, body: body.join("\n").replace(/\n+$/, "") };
}

/** A `###` subsection of an entry: what the release note calls a highlight. */
export interface ChangelogSubsection {
  readonly title: string;
  /** Prose that is not a bullet, in the order it appears. */
  readonly prose: readonly string[];
  /** Bullets, one per item, continuation lines joined — the wording is unchanged. */
  readonly items: readonly string[];
}

/** An entry, split at its `###` headings. */
export interface ParsedEntry {
  /** Prose before the first `###`, one string per paragraph. */
  readonly intro: readonly string[];
  readonly subsections: readonly ChangelogSubsection[];
}

/** The title that marks the block which must never be dropped. */
const LIMITS_TITLE = "known limits";

/**
 * The title of the ledger `scripts/release.sh` appends to a curated entry.
 *
 * `release.sh --check` refuses the newest entry unless it names every commit in
 * `<previous tag>..<tag>`, so an owner-approved prose entry carries a generated `### Commits`
 * list. That list is provenance — the record that the entry accounts for the range — and it is
 * not a highlight: it is a mechanical roll-up of the sections above it, with no reader in the
 * mail. So it is skipped here exactly as `Known limits` is special-cased, and for the opposite
 * reason: the limits must never be dropped, the ledger must never be printed.
 */
const LEDGER_TITLE = "commits";

/**
 * Split an entry into its intro and its `###` subsections.
 *
 * Continuation lines (an indented wrap, or a line that is not a new bullet) join the item above
 * them with a space: markdown wraps at a column, a mail client re-wraps at the reader's, and
 * preserving the source's column breaks would put a hard newline mid-sentence in a paragraph of
 * plain text.
 */
export function parseEntry(body: string): ParsedEntry {
  const intro: string[] = [];
  const subsections: { title: string; prose: string[]; items: string[] }[] = [];
  let paragraph: string[] = [];
  let current: { title: string; prose: string[]; items: string[] } | undefined;

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return;
    const text = plainInline(paragraph.join(" "));
    if (text !== "") (current ? current.prose : intro).push(text);
    paragraph = [];
  };

  for (const raw of body.split("\n")) {
    const line = raw.replace(/[ \t]+$/, "");
    const subsection = /^###\s+(.+?)\s*$/.exec(line);
    if (subsection) {
      flushParagraph();
      current = { title: plainInline(subsection[1] ?? ""), prose: [], items: [] };
      subsections.push(current);
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      continue;
    }
    const bullet = /^\s*-\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      const item = plainInline(bullet[1] ?? "");
      if (current === undefined) intro.push(item);
      else current.items.push(item);
      continue;
    }
    // A continuation line: append to the item above, or start prose.
    if (current !== undefined && current.items.length > 0 && paragraph.length === 0) {
      const last = current.items[current.items.length - 1] ?? "";
      current.items[current.items.length - 1] = plainInline(`${last} ${line.trim()}`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();

  return { intro, subsections };
}

/**
 * The hero banner, committed by #1169 lane A and drawn by this template and nothing else.
 *
 * It is named here once, and its presence is *checked*, not assumed: on a tree where the file has
 * not landed (an older `main`, a fork) the note is sent without a hero rather than with a broken
 * image, because a figure is a courtesy and a mail is the message.
 */
export const RELEASE_HERO_SRC = "/og/email-banner.png";

/**
 * Where a surface's screenshot is expected: `public/og/surface-<slug>.png`.
 *
 * A convention rather than a table, so landing a screenshot for a new surface is a committed file
 * and nothing else — no template edit, no registry to keep in step. A surface with no file gets no
 * figure; that is the rule, and the alternative (a stock picture, a placeholder, a chart the mail
 * computed) is exactly what this template must not do.
 */
export function surfaceAssetPath(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `/og/surface-${slug}.png`;
}

/** What a caller may nudge about the note. Every field is a seam for a test or a rehearsal. */
export interface ReleaseNoteOptions {
  readonly skipIntro?: number;
  /** A surface's figure, by lowercased title, overriding `surfaceAssetPath()`. */
  readonly surfaceAssets?: Readonly<Record<string, string>>;
  /** The directory a figure's `src` resolves against. Defaults to `<cwd>/public`. */
  readonly publicDir?: string;
}

/**
 * The figures the note draws: the hero, then one per surface the entry names — each only when the
 * committed file is really there.
 *
 * Nothing is generated, sampled or computed for a surface with no asset. The alt text is authored
 * here from the surface's own title and the brand record, and the size comes from the file's bytes,
 * so the only two sentences a reader gets about a picture are "which surface" and "which release".
 */
function noteFigures(
  highlights: readonly ChangelogSubsection[],
  section: ChangelogSection,
  options: ReleaseNoteOptions,
): EmailImage[] {
  const figures: EmailImage[] = [];
  const figure = (src: string, alt: string): void => {
    const block = emailImageIfPresent({ src, alt }, { publicDir: options.publicDir });
    if (block !== undefined) figures.push(block);
  };

  figure(RELEASE_HERO_SRC, `The ${brand.name} ${section.version} release banner.`);
  for (const highlight of highlights) {
    const src =
      options.surfaceAssets?.[highlight.title.toLowerCase()] ?? surfaceAssetPath(highlight.title);
    figure(src, `${highlight.title} in ${brand.name} ${section.version}.`);
  }
  return figures;
}

/**
 * The blocks a release note is built from, given one parsed entry.
 *
 * `skipIntro` exists because the band draws the **preheader** as the visible lead paragraph: the
 * intro line that became the preheader would otherwise be printed twice, once above the version
 * line and once below it. Nothing is dropped from the mail — the preheader is rendered.
 *
 * Highlights are every `###` subsection except two: `Known limits`, which is rendered last and
 * verbatim, and the `Commits` ledger, which is provenance and is not rendered at all.
 *
 * Figures (#1169 lane B) go **after the entry's own prose and before the Known limits block**: the
 * hero, then one per named surface whose asset exists. The limits stay last and untouched — a note
 * that ends on a picture rather than on what does not work yet would be the highlight reel this
 * template exists to refuse.
 */
export function releaseNoteBlocks(
  section: ChangelogSection,
  options: ReleaseNoteOptions = {},
): EmailBlock[] {
  const parsed = parseEntry(section.body);
  const limits = parsed.subsections.find((sub) => sub.title.toLowerCase() === LIMITS_TITLE);
  if (limits === undefined) {
    throw new Error(
      `the ${section.version} entry has no Known limits block — a release note that omits the limits is the one thing this template must not send`,
    );
  }

  const highlights = parsed.subsections.filter((sub) => {
    const title = sub.title.toLowerCase();
    return title !== LIMITS_TITLE && title !== LEDGER_TITLE;
  });
  const intro = parsed.intro.slice(options.skipIntro ?? 0);
  // No intro in the entry, no lead in the mail: the preheader is the entry's own first line or the
  // version line, and a paragraph invented to fill the gap is the sentence nobody wrote.
  const lead: string[] = [...intro];

  return [
    { kind: "paragraph", text: `Version ${section.version}, released ${section.date}.` },
    ...lead.map((text): EmailBlock => ({ kind: "paragraph", text })),
    ...highlights.flatMap((sub): EmailBlock[] => [
      { kind: "heading", text: sub.title },
      ...sub.prose.map((text): EmailBlock => ({ kind: "paragraph", text })),
      { kind: "list", items: sub.items },
    ]),
    ...noteFigures(highlights, section, options),
    { kind: "heading", text: limits.title },
    ...limits.prose.map((text): EmailBlock => ({ kind: "paragraph", text })),
    // Verbatim: the limits are taken as the entry wrote them, bullets and all.
    { kind: "verbatim", lines: limits.items.map((item) => `- ${item}`) },
  ];
}

/**
 * The document, ready for `renderEmail()`.
 *
 * The subject is `AlignSynch {{version}} is live` and the brand name comes from the record, so the
 * second brand gets its own subject without a second template. The preheader is the entry's own
 * first line, because a preview that paraphrases the body is a second sentence nobody wrote.
 */
export function releaseNoteDocument(
  section: ChangelogSection,
  options: ReleaseNoteOptions = {},
): EmailDocument {
  const parsed = parseEntry(section.body);
  const first = parsed.intro[0];
  return {
    subject: `${brand.name} ${section.version} is live`,
    preheader: first ?? `${brand.name} ${section.version}, released ${section.date}.`,
    // The first intro line is the preheader and the band draws it as the lead, so the body starts
    // after it; every other paragraph of the entry is a block, in the entry's own order.
    blocks: releaseNoteBlocks(section, {
      ...options,
      skipIntro: first === undefined ? 0 : 1,
    }),
  };
}
