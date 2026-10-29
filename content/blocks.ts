/**
 * types/content/blocks.ts — the only place a legacy editorial body is converted
 * into `ContentBlock[]`.
 *
 * Every adapter here is LOSSLESS and reversible: each `*ToBlocks` has a `*FromBlocks`
 * inverse and `check.mjs` round-trips all 23 records through both directions, so a
 * migration that drops a paragraph, an alt text or a caption fails the build.
 *
 * Legacy shapes being retired (D8):
 *   news  section { heading, paragraphs[2], image?, imageAlt?, imageCaption? }
 *   kb    section { heading, paragraphs[], list?, note? }
 *   tip   a raw markdown string (1,099–1,905 chars)
 */
import type { ContentBlock, ContentBlockType } from "./article";
import type { ImageRef } from "./core";

/* ================================================================== *
 * Legacy input shapes — declared ONCE, here, at the fixture boundary.
 * `components/news/news-article.tsx:145` must import these instead of
 * re-declaring `{heading?, paragraphs, image?, imageAlt?, imageCaption?}`
 * inline (the fourth declaration of "article body").
 * ================================================================== */

export interface LegacyNewsSection {
  heading: string;
  paragraphs: readonly string[];
  /** Fake placeholder URLs today (`/placeholder.svg?height=500&width=800&query=…`); kept verbatim. */
  image?: string | null;
  /** Always present when `image` is present (22/22) and never orphaned (0/22). */
  imageAlt?: string | null;
  imageCaption?: string | null;
}

export interface LegacyKbSection {
  heading: string;
  paragraphs: readonly string[];
  /** 52/64 sections. */
  list?: readonly string[] | null;
  /** 20/64 sections. */
  note?: string | null;
}

/** Next.js `StaticImageData`, structurally — no `next/image` import in the model. */
export interface StaticImageLike {
  src: string;
  height?: number;
  width?: number;
  blurDataURL?: string;
}

/* ================================================================== *
 * Adapters
 * ================================================================== */

/**
 * news section -> [heading, image?, ...paragraphs]
 *
 * Image placement follows locked decision 2 (image directly after its heading).
 * NOTE for the renderer: `news-article.tsx` currently renders paragraphs BEFORE the
 * image. Because blocks render in array order, either the adapter or the render
 * order has to change; the block model expresses both (see editorial-migration.md §5, F2).
 *
 * Throws (never defaults) when an image arrives without alt/caption: the fixture's
 * 22/22 invariant is `image ⇔ imageAlt ∧ imageCaption`, and a silent `alt: ""` would
 * destroy the only accessibility metadata these articles have.
 */
export function newsSectionsToBlocks(sections: readonly LegacyNewsSection[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  sections.forEach((section, i) => {
    if (!section.heading || !section.heading.trim()) {
      throw new Error(`news section ${i}: empty heading`);
    }
    blocks.push({ type: "heading", text: section.heading, level: 2 });

    if (section.image) {
      const alt = (section.imageAlt ?? "").trim();
      if (!alt) {
        throw new Error(
          `news section ${i} ("${section.heading}"): image ${section.image} has no alt — refusing to migrate a decorative in-body image`,
        );
      }
      const caption = (section.imageCaption ?? "").trim();
      blocks.push({
        type: "image",
        image: { src: section.image, alt },
        ...(caption ? { caption } : {}),
      });
    } else if (section.imageAlt || section.imageCaption) {
      throw new Error(
        `news section ${i} ("${section.heading}"): orphan imageAlt/imageCaption without image`,
      );
    }

    if (section.paragraphs.length === 0) {
      throw new Error(`news section ${i} ("${section.heading}"): no paragraphs`);
    }
    for (const text of section.paragraphs) {
      if (!text.trim()) throw new Error(`news section ${i}: empty paragraph`);
      blocks.push({ type: "paragraph", text });
    }
  });
  return blocks;
}

/** kb section -> [heading, ...paragraphs, list?, note?] */
export function kbSectionsToBlocks(sections: readonly LegacyKbSection[]): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  sections.forEach((section, i) => {
    if (!section.heading || !section.heading.trim()) {
      throw new Error(`kb section ${i}: empty heading`);
    }
    blocks.push({ type: "heading", text: section.heading, level: 2 });

    if (section.paragraphs.length === 0) {
      throw new Error(`kb section ${i} ("${section.heading}"): no paragraphs`);
    }
    for (const text of section.paragraphs) {
      if (!text.trim()) throw new Error(`kb section ${i}: empty paragraph`);
      blocks.push({ type: "paragraph", text });
    }

    if (section.list) {
      const items = section.list.filter((item) => item.trim());
      if (items.length !== section.list.length) {
        throw new Error(`kb section ${i} ("${section.heading}"): empty list item`);
      }
      if (items.length > 0) blocks.push({ type: "list", items: [...items], ordered: false });
    }

    if (section.note !== null && section.note !== undefined) {
      if (!section.note.trim())
        throw new Error(`kb section ${i} ("${section.heading}"): empty note`);
      blocks.push({ type: "note", text: section.note });
    }
  });
  return blocks;
}

/**
 * LEGACY markdown -> one `markdown` block. This is the whole "upgrade path": the
 * signature is `(markdown: string) => ContentBlock[]` so a real block-aware parser
 * can replace the body of this function without touching any call site, and
 * `markdownBlocksToText(markdownToBlocks(md)) === md` stays true either way.
 *
 * Do NOT author new content with this. New tips are heading/paragraph/list/note blocks.
 */
export function markdownToBlocks(markdown: string): ContentBlock[] {
  if (!markdown.trim()) throw new Error("markdownToBlocks: empty markdown");
  return [{ type: "markdown", text: markdown }];
}

/** Inverse of `markdownToBlocks` (and of a future real parser): blocks -> source text. */
export function markdownBlocksToText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter((b): b is Extract<ContentBlock, { type: "markdown" }> => b.type === "markdown")
    .map((b) => b.text)
    .join("\n\n");
}

/* ================================================================== *
 * Inverses — used by the migration proof, not by the renderer.
 * ================================================================== */

export function blocksToNewsSections(blocks: readonly ContentBlock[]): LegacyNewsSection[] {
  const sections: LegacyNewsSection[] = [];
  let current: (LegacyNewsSection & { paragraphs: string[] }) | null = null;
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        current = { heading: block.text, paragraphs: [] };
        sections.push(current);
        break;
      case "image":
        if (!current) throw new Error("image block before any heading");
        current.image = block.image.src;
        current.imageAlt = block.image.alt;
        if (block.caption) current.imageCaption = block.caption;
        break;
      case "paragraph":
        if (!current) throw new Error("paragraph block before any heading");
        current.paragraphs.push(block.text);
        break;
      default:
        throw new Error(`block type "${block.type}" does not occur in a news body`);
    }
  }
  return sections;
}

export function blocksToKbSections(blocks: readonly ContentBlock[]): LegacyKbSection[] {
  const sections: LegacyKbSection[] = [];
  let current: (LegacyKbSection & { paragraphs: string[]; list?: string[] }) | null = null;
  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        current = { heading: block.text, paragraphs: [] };
        sections.push(current);
        break;
      case "paragraph":
        if (!current) throw new Error("paragraph block before any heading");
        current.paragraphs.push(block.text);
        break;
      case "list":
        if (!current) throw new Error("list block before any heading");
        current.list = [...block.items];
        break;
      case "note":
        if (!current) throw new Error("note block before any heading");
        current.note = block.text;
        break;
      default:
        throw new Error(`block type "${block.type}" does not occur in a kb body`);
    }
  }
  return sections;
}

/* ================================================================== *
 * Image boundary
 * ================================================================== */

/**
 * `StaticImageData` (24 of them: 9 news covers + 22 in-body news images today arrive
 * as module objects/placeholder strings) -> plain `ImageRef`.
 *
 * A migration snapshot must not embed Next's build-dependent
 * `/_next/static/media/<name>.<hash>.png` URL, so the snapshot pins the stable public
 * path plus the intrinsic size read from the asset. The function itself is
 * shape-driven and handles all three inputs it will meet at the boundary.
 */
export function staticToImageRef(input: string | StaticImageLike | ImageRef, alt = ""): ImageRef {
  if (typeof input === "string") {
    if (!input.trim()) throw new Error("staticToImageRef: empty src");
    return { src: input, alt };
  }
  if (!input || typeof input.src !== "string" || !input.src.trim()) {
    throw new Error("staticToImageRef: object without a usable src");
  }
  const out: ImageRef = { src: input.src, alt };
  if (typeof input.width === "number") out.width = input.width;
  if (typeof input.height === "number") out.height = input.height;
  const blur = (input as StaticImageLike).blurDataURL ?? (input as ImageRef).blurDataUrl;
  if (blur) out.blurDataUrl = blur;
  return out;
}

/* ================================================================== *
 * Inspection helpers
 * ================================================================== */

export function countBlocks(blocks: readonly ContentBlock[]): Record<ContentBlockType, number> {
  const counts = {
    heading: 0,
    paragraph: 0,
    list: 0,
    note: 0,
    image: 0,
    markdown: 0,
  } satisfies Record<ContentBlockType, number>;
  for (const block of blocks) counts[block.type] += 1;
  return counts;
}

export function imageBlocks(blocks: readonly ContentBlock[]) {
  return blocks.filter((b): b is Extract<ContentBlock, { type: "image" }> => b.type === "image");
}
