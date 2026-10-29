"use client";

/**
 * The ONE body renderer. `ContentBlock[]` replaced three section shapes (D8) and
 * the fourth inline re-declaration of the news section type that used to live in
 * `news-article.tsx`. News, tips and knowledge-base articles all render through
 * this component, so a new block type is added in one place.
 *
 * Class strings are passed in (with defaults) because the three surfaces had
 * different heading scales; the *structure* is shared, the styling stays local.
 */
import type { ContentBlock } from "@/content/article";
import Image from "next/image";
import Markdown from "react-markdown";

export interface ContentBlocksProps {
  blocks: readonly ContentBlock[];
  /** News uses text-2xl; the support article uses text-xl. */
  headingClass?: string;
  imageWrapperClass?: string;
}

const DEFAULT_HEADING = "text-2xl font-bold mb-4";
const DEFAULT_IMAGE_WRAPPER = "relative h-[250px] w-full my-6 rounded-lg overflow-hidden";

/** Markdown overrides lifted verbatim from the tip page so tips render identically. */
const MARKDOWN_COMPONENTS = {
  h1: ({ node, ...props }: { node?: unknown }) => (
    <h1 className="text-4xl font-bold mb-6" {...props} />
  ),
  h2: ({ node, ...props }: { node?: unknown }) => (
    <h2 className="text-3xl font-bold mb-5" {...props} />
  ),
  h3: ({ node, ...props }: { node?: unknown }) => (
    <h3 className="text-2xl font-bold mb-4" {...props} />
  ),
  h4: ({ node, ...props }: { node?: unknown }) => (
    <h4 className="text-xl font-bold mb-3" {...props} />
  ),
  h5: ({ node, ...props }: { node?: unknown }) => (
    <h5 className="text-lg font-bold mb-2" {...props} />
  ),
  h6: ({ node, ...props }: { node?: unknown }) => (
    <h6 className="text-base font-bold mb-2" {...props} />
  ),
  p: ({ node, ...props }: { node?: unknown }) => (
    <p className="text-base mb-4 leading-relaxed" {...props} />
  ),
  a: ({ node, ...props }: { node?: unknown }) => (
    <a className="text-purple-600 hover:text-purple-700 mb-3 block" {...props} />
  ),
};

export function ContentBlocks({
  blocks,
  headingClass = DEFAULT_HEADING,
  imageWrapperClass = DEFAULT_IMAGE_WRAPPER,
}: ContentBlocksProps) {
  return (
    <>
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return block.level === 3 ? (
              <h3 key={index} className="text-xl font-semibold mb-3">
                {block.text}
              </h3>
            ) : (
              <h2 key={index} className={headingClass}>
                {block.text}
              </h2>
            );
          case "paragraph":
            return (
              <p key={index} className="mb-4">
                {block.text}
              </p>
            );
          case "list": {
            const items = block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="ml-6 list-disc">
                {item}
              </li>
            ));
            return (
              <ul key={index} className="my-4 space-y-2">
                {items}
              </ul>
            );
          }
          case "note":
            return (
              <div key={index} className="bg-muted p-4 rounded-md my-4 text-sm">
                <strong>Note:</strong> {block.text}
              </div>
            );
          case "image":
            return (
              <div key={index} className={imageWrapperClass}>
                <Image src={block.image.src} alt={block.image.alt} fill className="object-cover" />
                {block.caption && (
                  <p className="text-sm text-muted-foreground mt-2">{block.caption}</p>
                )}
              </div>
            );
          case "markdown":
            return (
              <Markdown key={index} components={MARKDOWN_COMPONENTS}>
                {block.text}
              </Markdown>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
