/**
 * The screenshot registry is a bijection with the promoted files — both directions, and the
 * dimensions too (#649).
 *
 * The failure this pins down: `docs/` held 330 images and nothing said which of them showed the
 * product as it is. A registry fixes that only if it cannot rot into a second, gentler lie — a row
 * pointing at a file somebody deleted, a file nobody registered, or a mobile capture filed under
 * `desktop/`. Each of those reads fine and is wrong, so each is asserted here rather than left to a
 * reader to notice.
 *
 * Three claims, in the order the story above names them:
 *
 *   listed → on disk   every path the registry names is a file
 *   on disk → listed   every promoted PNG is a row
 *   the row is true    the bytes' own IHDR matches what the row claims — `1440x900` in `desktop/`,
 *                      `390x844` in `mobile/`, `1200x630` for the share card
 *
 * The dimensions are the part a filename cannot carry. A `mobile/` directory full of desktop
 * screenshots type-checks, renders on GitHub and is a lie about the smallest viewport the product
 * supports, which is exactly the claim a screenshot makes.
 *
 * `scripts/image-bytes.ts::pngSize` is the reader: the same function `data:check` uses for the icon
 * set, so this test adds no dependency and decodes no pixels — an IHDR chunk is 24 bytes and the
 * two integers in it.
 *
 * Scope is `docs/assets/screens/{alignsynch,quizhub}/` and the share card. `brand-marks/` and every
 * per-ticket `qa-…/` folder are deliberately outside it: they are evidence for their own tickets,
 * and the registry says so.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { pngSize } from "@/scripts/image-bytes";

const SCREENS_DIR = fileURLToPath(new URL("../docs/assets/screens", import.meta.url));
const OG_CARD = fileURLToPath(new URL("../docs/assets/og-image.png", import.meta.url));

/** The promoted brands and their directories. */
const BRANDS = ["alignsynch", "quizhub"] as const;

/** The two capture sizes, which are what the row's `viewport` column means. */
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

/** The share card's box: 1.91:1, the ratio neither large-preview crawler crops. */
const OG_SIZE = { width: 1200, height: 630 } as const;

/** `brand/viewport/file.png`, as the registry's `file` column spells it. */
type PromotedPath = `${(typeof BRANDS)[number]}/${keyof typeof VIEWPORTS}/${string}.png`;

/** Every `.png` under `docs/assets/screens/<brand>/<viewport>/`. */
function promotedFiles(): PromotedPath[] {
  return BRANDS.flatMap((brand) =>
    (Object.keys(VIEWPORTS) as (keyof typeof VIEWPORTS)[]).flatMap((viewport) =>
      readdirSync(`${SCREENS_DIR}/${brand}/${viewport}`, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
        .map((entry) => `${brand}/${viewport}/${entry.name}` as PromotedPath),
    ),
  );
}

/**
 * The paths the registry names, in either spelling it uses: the table's `file` column is relative to
 * this directory, and the prose refers to `docs/assets/og-image.png` in full.
 */
function registeredPaths(): string[] {
  const readme = readFileSync(`${SCREENS_DIR}/README.md`, "utf8");
  const relative = /`((?:alignsynch|quizhub)\/(?:desktop|mobile)\/[a-z0-9-]+\.png)`/g;
  return [...readme.matchAll(relative)].map((match) => match[1]);
}

describe("the screenshot registry", () => {
  it("lists a file that exists, for every row", () => {
    const named = [...new Set(registeredPaths())];
    expect(named.length).toBeGreaterThan(0);

    const missing = named.filter((path) => {
      try {
        readFileSync(`${SCREENS_DIR}/${path}`).byteLength;
        return false;
      } catch {
        return true;
      }
    });
    expect(missing, "rows pointing at a file that is not on disk").toEqual([]);
  });

  it("has a row for every promoted file", () => {
    const named = new Set(registeredPaths());
    const unregistered = promotedFiles().filter((path) => !named.has(path));
    expect(unregistered, "promoted screenshots with no row in the registry").toEqual([]);
  });

  it("captures each viewport at the size its directory claims", () => {
    const wrong = promotedFiles().flatMap((path) => {
      const [, viewport] = path.split("/");
      const size = pngSize(new Uint8Array(readFileSync(`${SCREENS_DIR}/${path}`)));
      const expected = VIEWPORTS[viewport as keyof typeof VIEWPORTS];
      if (size === undefined) return [`${path}: not a PNG`];
      if (size.width !== expected.width || size.height !== expected.height) {
        return [
          `${path}: ${size.width}x${size.height}, the ${viewport} box is ${expected.width}x${expected.height}`,
        ];
      }
      return [];
    });
    expect(wrong).toEqual([]);
  });

  it("ships the share card at 1200x630", () => {
    const size = pngSize(new Uint8Array(readFileSync(OG_CARD)));
    expect(size).toEqual(OG_SIZE);
  });

  it("names the share card in the registry", () => {
    const readme = readFileSync(`${SCREENS_DIR}/README.md`, "utf8");
    expect(readme).toContain("docs/assets/og-image.png");
  });
});
