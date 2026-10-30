// @vitest-environment jsdom
/**
 * The resolver's fault tolerance (issue #155, phase 1) — the claim this file is accepted on:
 *
 *   a remote image that fails to load, and a file path that 404s, both swap to the generated
 *   default **through the component's own `onError`**, with no broken icon and no reflow.
 *
 * A real failure is a browser event, so this is the one test in the repo that needs a DOM:
 * `tests/media.test.ts` proves the markup of each tier and the pure transition; this file
 * mounts the component, dispatches `error` on the `<img>` React actually rendered, and reads
 * the DOM back. A test that called `fallbackOf()` directly would pass even if the component
 * never wired `onError` at all — which is exactly the defect this covers.
 *
 * The box is asserted too: the generated default replaces the image at the same size, so a
 * 404 cannot shift the layout around it.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Media } from "@/components/media/media";
import { generatedMedia, remoteMedia, type FileMediaEntry, type MediaEntry } from "@/content/media";
import { media } from "@/data/media";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const remoteEntry = remoteMedia("https://flagcdn.com/16x12/us.png", "flag-us", {
  alt: "United States",
  kind: "illustration",
  width: 16,
  height: 12,
});
const fileEntry = media["quiz.q1"] as FileMediaEntry;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Mount an entry and hand back the `<img>` the resolver rendered. */
const mount = (entry: MediaEntry, props: Record<string, unknown> = {}) => {
  act(() => {
    root.render(<Media entry={entry} {...props} />);
  });
  const image = container.querySelector("img");
  expect(image, "the resolver rendered no image to fail").not.toBeNull();
  return image as HTMLImageElement;
};

/** Fire the event a 404 actually fires, then read the DOM back. */
const fail = (image: HTMLImageElement) => {
  act(() => {
    image.dispatchEvent(new Event("error"));
  });
};

describe("Media — a remote image that fails", () => {
  it("swaps to the generated default its fallbackSeed names", () => {
    const image = mount(remoteEntry);
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain("flagcdn.com");

    fail(image);

    expect(container.querySelector("img")).toBeNull();
    const drawn = container.querySelector('[data-media="generated"]');
    expect(drawn).not.toBeNull();
    expect(drawn?.getAttribute("data-seed")).toBe("flag-us");
    expect(drawn?.getAttribute("aria-label")).toBe("United States");
  });

  it("keeps the box the image occupied, so nothing reflows", () => {
    const image = mount(remoteEntry);
    const before = image.getAttribute("height");

    fail(image);

    const drawn = container.querySelector<HTMLElement>('[data-media="generated"]');
    expect(before).toBe("12");
    expect(drawn?.style.width).toBe("16px");
    expect(drawn?.style.height).toBe("12px");
  });

  it("paints a gradient and an inline SVG, not a broken-image icon", () => {
    const image = mount(remoteEntry);

    fail(image);

    const drawn = container.querySelector('[data-media="generated"]');
    expect(drawn?.getAttribute("style")).toContain("linear-gradient");
    expect(drawn?.querySelector("svg")).not.toBeNull();
  });
});

describe("Media — a file that 404s", () => {
  it("swaps to a default seeded by the path it was standing in for", () => {
    const image = mount(fileEntry);
    expect(decodeURIComponent(image.getAttribute("src") ?? "")).toContain(fileEntry.src);

    fail(image);

    expect(container.querySelector("img")).toBeNull();
    const drawn = container.querySelector('[data-media="generated"]');
    expect(drawn?.getAttribute("data-seed")).toBe(fileEntry.src);
  });
});

describe("Media — the generated tier never fails", () => {
  it("renders no image element at all, so there is nothing to 404", () => {
    act(() => {
      root.render(<Media entry={generatedMedia("news-1", "news-art", "A headline")} />);
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector('[data-media="generated"]')).not.toBeNull();
  });
});
