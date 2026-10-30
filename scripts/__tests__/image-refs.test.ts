/**
 * image-refs tests — the five shapes that were live on `main` before the follow-up to
 * issue #6, plus the shapes that must *not* be flagged.
 *
 * Every "must not" case is here for a reason: this scanner is wired into `data:check`, so a
 * false positive is a red build on correct code. The static-import case is the one that
 * matters — `import cover from "@/public/example-cover.png"` carries its own dimensions, and a
 * check that flags it would have to be deleted or suppressed within a week.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SourceFile } from "../ui-refs";
import { imageCensus, imageProblems, nextImageTags, staticImageImports } from "../image-refs";

const file = (source: string, path = "components/example.tsx"): SourceFile => ({
  path,
  source,
});

const problemsIn = (source: string, path?: string) =>
  imageProblems([file(source, path)]).map((problem) => problem.kind);

describe("staticImageImports", () => {
  it("collects default imports of image files, whatever the specifier", () => {
    const bindings = staticImageImports(
      [
        'import Image from "next/image";',
        'import cover from "@/public/example-cover.png";',
        'import avatar from "../../public/avatars/sarah.webp";',
        'import logo from "./logo.svg";',
        'import { media } from "@/data/media";',
        'import type { Quiz } from "@/content/quiz";',
        'import data from "./fixtures/rows.json";',
      ].join("\n"),
    );
    assert.deepEqual([...bindings].sort(), ["avatar", "cover", "logo"]);
  });

  it("ignores a named import of an image, which is not a StaticImageData", () => {
    const bindings = staticImageImports('import { cover } from "@/public/example-cover.png";');
    assert.equal(bindings.size, 0);
  });
});

describe("nextImageTags", () => {
  it("reads the size props and the src expression", () => {
    const [tag] = nextImageTags([
      file(
        [
          'import Image from "next/image";',
          "export const A = () => (",
          "  <Image",
          "    src={quiz.cover?.src ?? media.placeholder.src}",
          '    alt="cover"',
          "    width={600}",
          "    height={350}",
          "  />",
          ");",
        ].join("\n"),
      ),
    ]);
    assert.equal(tag.line, 3);
    assert.equal(tag.src, "quiz.cover?.src ?? media.placeholder.src");
    assert.equal(tag.width, true);
    assert.equal(tag.height, true);
    assert.equal(tag.fill, false);
    assert.equal(tag.sizes, false);
  });

  it("does not end the tag at a `>` inside a handler or a template URL", () => {
    const [tag] = nextImageTags([
      file(
        [
          "<Image",
          `  src={\`https://flagcdn.com/16x12/\${code}.png\`}`,
          '  alt="flag"',
          "  width={16}",
          "  height={12}",
          "  onError={(e) => { e.currentTarget.src = fallback; }}",
          "/>",
        ].join("\n"),
      ),
    ]);
    assert.equal(tag.width, true);
    assert.equal(tag.height, true);
    assert.equal(tag.line, 1);
  });

  it("does not read a `//` comment inside the tag as attributes", () => {
    // The real shape in components/tournaments/featured-tournament.tsx.
    const [tag] = nextImageTags([
      file(
        [
          "<Image",
          '  src={media["abstract-geometric-shapes"].src} // Using existing abstract image for featured tournament',
          '  alt="Featured Tournament"',
          "  width={1200}",
          "  height={400}",
          "/>",
        ].join("\n"),
      ),
    ]);
    assert.equal(tag.width, true);
    assert.equal(tag.height, true);
    assert.equal(tag.fill, false);
  });

  it("ignores a spread, which names no attribute this scan can read", () => {
    const [tag] = nextImageTags([
      file(['<Image {...props} src="/x.png" width={40} height={40} />'].join("\n")),
    ]);
    assert.equal(tag.width, true);
    assert.equal(tag.fill, false);
  });

  it("reads `fill={true}` the same as a bare `fill`", () => {
    const [tag] = nextImageTags([file('<Image src="/x.png" fill={true} />')]);
    assert.equal(tag.fill, true);
  });

  it("ignores a commented-out tag and a longer component name", () => {
    const tags = nextImageTags([
      file(
        [
          "// <Image src={legacy} />",
          "/*",
          "  <Image src={alsoLegacy} />",
          "*/",
          '<ImageTag src="/x.png" />',
          '<Image src="/x.png" width={40} height={40} />',
        ].join("\n"),
      ),
    ]);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].line, 6);
  });

  it("does not treat a `//` in a URL on the same line as a comment", () => {
    const tags = nextImageTags([
      file('<a href="https://example.com"><Image src="/x.png" width={4} height={4} /></a>'),
    ]);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].width, true);
  });
});

describe("imageProblems — missing dimension (E451)", () => {
  it("flags a tag with no size source at all", () => {
    assert.deepEqual(problemsIn('<Image src="/category/animal.webp" alt="" />'), [
      "missing-dimension",
    ]);
  });

  it("flags a registry `.src` passed without the registry's width/height", () => {
    // components/settings/security-settings.tsx:108 before the fix — the entry carries
    // 1024x1024, the tag passed only `.src`, and toggling 2FA in /settings was a 500.
    assert.deepEqual(
      problemsIn(
        '<Image src={media["qr-code-generic"].src} alt="QR Code" className="h-32 w-32" />',
      ),
      ["missing-dimension"],
    );
  });

  it("flags a string fallback beside a static import", () => {
    // components/home/player-testimonials.tsx:177 before the fix: the static-import branch
    // sized itself, the `media.placeholder.src` fallback did not.
    assert.deepEqual(
      problemsIn(
        "<Image src={testimonials[activeIndex].avatar || media.placeholder.src} alt={name} />",
      ),
      ["missing-dimension"],
    );
  });

  it("names the dimension that is actually missing", () => {
    const [problem] = imageProblems([file('<Image src="/x.png" width={40} />')]);
    assert.match(problem.message, /missing `height`/);
  });

  it("flags `imported.src`, which is the string and not the sized value", () => {
    const source = [
      'import cover from "@/public/example-cover.png";',
      "<Image src={cover.src} />",
    ].join("\n");
    assert.deepEqual(problemsIn(source), ["missing-dimension"]);
  });
});

describe("imageProblems — fill with width/height (E96)", () => {
  it("flags `fill` together with both dimensions", () => {
    // The shape in my-quizzes-dashboard.tsx and twice in profile-created-quizzes.tsx.
    assert.deepEqual(
      problemsIn(
        [
          "<Image",
          "  width={600}",
          "  height={350}",
          "  src={quiz.image || media.placeholder.src}",
          "  alt={quiz.title}",
          "  fill",
          '  className="object-cover"',
          "/>",
        ].join("\n"),
      ),
      ["fill-with-dimension"],
    );
  });

  it("flags `fill` together with one dimension", () => {
    assert.deepEqual(problemsIn('<Image src="/x.png" fill width={600} />'), [
      "fill-with-dimension",
    ]);
  });
});

describe("imageProblems — the shapes that are legal", () => {
  it("accepts width and height", () => {
    assert.deepEqual(problemsIn('<Image src="/x.png" width={600} height={350} />'), []);
  });

  it("accepts fill alone", () => {
    assert.deepEqual(
      problemsIn('<Image src={quiz.image} alt="" fill className="object-cover" />'),
      [],
    );
  });

  it("accepts a static import, whose dimensions travel with the value", () => {
    const source = [
      'import cardCover from "@/public/example-cover.png";',
      '<Image src={cardCover} className="w-full object-cover size-full" alt="cover img" />',
    ].join("\n");
    assert.deepEqual(problemsIn(source), []);
  });

  it("accepts a fallback between two static imports", () => {
    const source = [
      'import a from "@/public/a.png";',
      'import b from "@/public/b.png";',
      '<Image src={failed ? a : b} alt="" />',
    ].join("\n");
    assert.deepEqual(problemsIn(source), []);
  });

  it("accepts a dynamic src that carries explicit dimensions", () => {
    assert.deepEqual(
      problemsIn('<Image src={quiz.cover?.src ?? fallback} width={1000} height={500} alt="" />'),
      [],
    );
  });
});

describe("imageCensus", () => {
  it("counts one class per tag and reports the fill/sizes debt", () => {
    const files = [
      file(
        [
          '<Image src="/a.png" width={40} height={40} />',
          '<Image src="/b.png" fill className="object-cover" />',
          '<Image src="/c.png" fill sizes="100vw" className="object-cover" />',
          'import cover from "@/public/example-cover.png";',
          '<Image src={cover} alt="" />',
          '<Image src="/d.png" />',
          '<Image src="/e.png" fill width={4} height={4} />',
        ].join("\n"),
      ),
    ];
    const census = imageCensus(nextImageTags(files));
    assert.deepEqual(census, {
      tags: 6,
      dimensioned: 1,
      fill: 2,
      staticImport: 1,
      fillWithSizes: 1,
      missingDimension: 1,
      fillWithDimension: 1,
    });
  });

  it("is zeroed on an empty tree, so the summary cannot print a stale number", () => {
    assert.deepEqual(imageCensus([]), {
      tags: 0,
      dimensioned: 0,
      fill: 0,
      staticImport: 0,
      fillWithSizes: 0,
      missingDimension: 0,
      fillWithDimension: 0,
    });
  });
});
