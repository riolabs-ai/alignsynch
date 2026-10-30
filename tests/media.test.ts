/**
 * The media resolver (issue #155, phase 1) — the claims this slice is accepted on:
 *
 *   1. one entry of each tier renders its own thing: a file draws a path, a remote draws
 *      somebody else's URL, a generated default draws a gradient and an inline SVG and
 *      requests nothing;
 *   2. the tier order is the component's, not the call site's: file wins over remote, remote
 *      wins over generated, whichever order the candidates arrive in;
 *   3. a drawn default is a pure function of its seed — the same seed twice is byte-identical
 *      markup, two seeds are not — so a screenshot diff cannot drift between renders;
 *   4. `fallbackOf` names the default a failure swaps to, and `zMediaEntry` is a three-way
 *      union that refuses an http URL, a remote entry with no fallback seed, and a half-given
 *      size.
 *
 * Rendered, not just computed: the assertions read the markup the component actually emits,
 * so a component that resolved the right entry and then painted something else fails here.
 * No DOM — `renderToStaticMarkup` is enough for everything except the `onError` swap, which
 * has its own jsdom test (`tests/media-fallback.test.tsx`).
 */
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Media } from "@/components/media/media";
import {
  fallbackOf,
  generatedMedia,
  pickMedia,
  remoteMedia,
  zMediaEntry,
  zRemoteMediaEntry,
  type FileMediaEntry,
  type MediaEntry,
} from "@/content/media";
import { media } from "@/data/media";
import { entryOf } from "@/lib/media-entry";

/** A real file-backed entry from the generated registry. */
const fileEntry = media["quiz.q1"] as FileMediaEntry;
/** Somebody else's server, with the neutral plate that replaces it. */
const remoteEntry = remoteMedia("https://flagcdn.com/16x12/us.png", "flag-us", {
  alt: "United States",
  kind: "illustration",
  width: 16,
  height: 12,
});
/** No bytes, no request: a gradient plus an inline SVG, seeded. */
const drawnEntry = generatedMedia("quiz-world-geography", "quiz-art", "World Geography");

const render = (entry: MediaEntry | undefined, extra: Record<string, unknown> = {}) =>
  renderToStaticMarkup(createElement(Media, { entry, ...extra }));

const gradientIn = (html: string): string | undefined =>
  /background-image:\s*([^";]+)/.exec(html)?.[1];

/**
 * The markup with its `src`/`srcSet` un-escaped and un-percent-encoded.
 *
 * `next/image` rewrites a plain path to `/_next/image?url=%2Fquiz%2Fq1.jpg&w=…` whenever the
 * optimizer is on, and in this runner it is: `next.config.mjs`'s global `unoptimized` is a
 * build-time setting vitest never reads. Production renders the plain path. Decoding here
 * keeps the assertion about *which file the slot asked for* instead of which URL shape the
 * runner happened to use.
 */
const askedFor = (html: string) => decodeURIComponent(html.replace(/&amp;/g, "&"));

describe("Media — one entry per tier", () => {
  it("renders a file entry as its own public path", () => {
    const html = render(fileEntry);

    expect(askedFor(html)).toContain(fileEntry.src);
    expect(html).not.toContain('data-media="generated"');
  });

  it("renders a remote entry as the URL it names", () => {
    const html = render(remoteEntry);

    expect(askedFor(html)).toContain(remoteEntry.url);
    expect(html).not.toContain('data-media="generated"');
  });

  it("renders a generated default as a gradient and an inline SVG, with no src", () => {
    const html = render(drawnEntry);

    expect(html).toContain('data-media="generated"');
    expect(html).toContain(`data-seed="${drawnEntry.seed}"`);
    expect(gradientIn(html)).toBeTypeOf("string");
    expect(html).toContain("<svg");
    // Nothing to request: no `src` attribute and no `<img>` at all.
    expect(html).not.toContain("<img");
  });

  it("draws initials for an avatar and an abstract mark for everything else", () => {
    const avatar = render(generatedMedia("player-1", "avatar", "Ada Lovelace"), {
      width: 40,
      height: 40,
    });
    const artwork = render(generatedMedia("player-1", "quiz-art", "Ada Lovelace"), {
      width: 40,
      height: 40,
    });

    expect(avatar).toContain(">AL<");
    expect(artwork).toContain("<circle");
    expect(artwork).not.toContain(">AL<");
  });
});

describe("Media — the tier order is the resolver's", () => {
  it("picks file over remote over generated, whatever order they arrive in", () => {
    expect(pickMedia(drawnEntry, remoteEntry, fileEntry)).toBe(fileEntry);
    expect(pickMedia(fileEntry, remoteEntry, drawnEntry)).toBe(fileEntry);
    expect(pickMedia(drawnEntry, remoteEntry)).toBe(remoteEntry);
    expect(pickMedia(drawnEntry)).toBe(drawnEntry);
    expect(pickMedia(undefined, undefined)).toBe(undefined);
  });

  it("renders the file when the slot is offered a generated fallback too", () => {
    const html = render(drawnEntry, { fallback: fileEntry });

    expect(askedFor(html)).toContain(fileEntry.src);
    expect(html).not.toContain('data-media="generated"');
  });

  it("renders the remote when the slot is offered a generated fallback", () => {
    const html = render(drawnEntry, { fallback: remoteEntry });

    expect(askedFor(html)).toContain(remoteEntry.url);
  });

  it("draws a generated default when the record carries no image at all", () => {
    const html = render(undefined, { seed: "article-1", kind: "news-art", alt: "A headline" });

    expect(html).toContain('data-media="generated"');
    expect(html).toContain('data-seed="article-1"');
    expect(html).toContain('aria-label="A headline"');
  });

  it("renders nothing when there is neither an entry nor a seed", () => {
    expect(render(undefined)).toBe("");
  });
});

describe("Media — deterministic from the seed", () => {
  it("renders the same seed twice as identical markup", () => {
    const first = render(generatedMedia("quiz-history-basics", "quiz-art"));
    const second = render(generatedMedia("quiz-history-basics", "quiz-art"));

    expect(first).toBe(second);
    expect(gradientIn(first)).toBeTypeOf("string");
  });

  it("renders two seeds differently", () => {
    const history = render(generatedMedia("quiz-history-basics", "quiz-art"));
    const science = render(generatedMedia("quiz-science-basics", "quiz-art"));

    expect(history).not.toBe(science);
    expect(gradientIn(history)).not.toEqual(gradientIn(science));
  });

  it("has no randomness and no clock in the drawn path", () => {
    // The component and the primitives it draws from must not reach for either, or the
    // server and the browser would paint different pictures (and every visual test would
    // flake). Comments are stripped first: the docblock *names* both on purpose.
    const source = ["components/media/media.tsx", "components/media/generated-avatar.tsx"]
      .map((path) => readFileSync(path, "utf8"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");

    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("Date.now");
    expect(source).not.toContain("new Date(");
  });
});

describe("fallbackOf — what a failure swaps to", () => {
  it("seeds a file's default from its own path", () => {
    const fallback = fallbackOf(fileEntry);

    expect(fallback.generated).toBe(true);
    expect(fallback.seed).toBe(fileEntry.src);
    expect(fallback.kind).toBe(fileEntry.kind);
  });

  it("seeds a remote's default from the fallback seed its author chose", () => {
    const fallback = fallbackOf(remoteEntry);

    expect(fallback.generated).toBe(true);
    expect(fallback.seed).toBe("flag-us");
  });

  it("leaves a generated default alone — it is already the fallback", () => {
    expect(fallbackOf(drawnEntry)).toBe(drawnEntry);
  });
});

describe("the registry hands a fixture's path back as an entry", () => {
  it("resolves a path the registry addresses", () => {
    expect(entryOf({ src: fileEntry.src })).toBe(fileEntry);
    expect(entryOf(fileEntry.src)).toBe(fileEntry);
    // A query string addresses the same file, as it does for `next/image`.
    expect(entryOf({ src: `${fileEntry.src}?height=40` })).toBe(fileEntry);
  });

  it("answers undefined for a path the registry does not address", () => {
    expect(entryOf(undefined)).toBe(undefined);
    // One of the two shared blobs deleted by this issue.
    expect(entryOf({ src: "/news/news1.png" })).toBe(undefined);
  });
});

describe("zMediaEntry — three ways to address media, and no fourth", () => {
  it("accepts one entry of each kind", () => {
    for (const entry of [fileEntry, remoteEntry, drawnEntry]) {
      expect(zMediaEntry.safeParse(entry).success).toBe(true);
    }
  });

  it("rejects an http remote entry", () => {
    expect(zRemoteMediaEntry.safeParse(remoteEntry).success).toBe(true);
    expect(
      zRemoteMediaEntry.safeParse({ ...remoteEntry, url: "http://flagcdn.com/16x12/us.png" })
        .success,
    ).toBe(false);
  });

  it("requires a fallback seed on a remote entry", () => {
    const { fallbackSeed, ...withoutSeed } = remoteEntry;

    expect(fallbackSeed).toBe("flag-us");
    expect(zRemoteMediaEntry.safeParse(withoutSeed).success).toBe(false);
  });

  it("refuses half an intrinsic size", () => {
    expect(zRemoteMediaEntry.safeParse({ ...remoteEntry, height: undefined }).success).toBe(false);
    expect(
      zRemoteMediaEntry.safeParse({
        url: remoteEntry.url,
        alt: "",
        fallbackSeed: "x",
        kind: "illustration",
      }).success,
    ).toBe(true);
  });

  it("requires a seed on a generated default", () => {
    const { seed, ...withoutSeed } = drawnEntry;

    expect(seed).toBe("quiz-world-geography");
    expect(zMediaEntry.safeParse(withoutSeed).success).toBe(false);
  });

  it("rejects an unknown key, an unknown kind and a cross-tier field", () => {
    expect(zMediaEntry.safeParse({ ...drawnEntry, extra: 1 }).success).toBe(false);
    expect(zMediaEntry.safeParse({ ...drawnEntry, kind: "banner" }).success).toBe(false);
    expect(zMediaEntry.safeParse({ ...drawnEntry, src: "/quiz/q1.jpg" }).success).toBe(false);
  });
});
