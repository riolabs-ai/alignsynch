/**
 * The generated category tile (issue #130) — the claim this slice is accepted on:
 *
 *   a category with no artwork renders a gradient seeded by its slug, and two categories
 *   never produce the same gradient.
 *
 * Rendered, not just computed: the assertion reads the `background-image` the component
 * actually put in its markup, so a component that ignored `gradientFor(slug)` (hardcoded
 * colour, wrong seed, no style at all) fails here even though the pure function is fine.
 *
 * No DOM and no router: `renderToStaticMarkup` is enough because `CategoryTile` renders
 * artwork only — the anchor, the count badge and the name pill belong to `/categories`.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryTile } from "@/components/categories/category-tile";
import { quizCategories } from "@/content/categories";
import { gradientFor, monogramOf, slugSeed } from "@/lib/category-gradient";

type TileProps = { name: string; slug: string; src?: string };

const render = (props: TileProps) => renderToStaticMarkup(createElement(CategoryTile, props));

/** The `linear-gradient(…)` the tile painted, or `undefined` when it painted none. */
const gradientIn = (html: string): string | undefined =>
  /background-image:\s*([^";]+)/.exec(html)?.[1];

describe("CategoryTile", () => {
  it("renders two category tiles whose gradients differ", () => {
    const animal = render({ name: "Animal", slug: "animal" });
    const business = render({ name: "Business", slug: "business" });

    const animalGradient = gradientIn(animal);
    const businessGradient = gradientIn(business);

    expect(animalGradient, `no gradient in ${animal}`).toBeTypeOf("string");
    expect(businessGradient, `no gradient in ${business}`).toBeTypeOf("string");
    expect(animalGradient).not.toEqual(businessGradient);
  });

  it("never gives two quiz subjects the same gradient", () => {
    const painted = quizCategories
      .filter((category) => category.scope === "quiz")
      .map((category) => {
        const html = render({ name: category.name, slug: category.slug });
        return { slug: category.slug, gradient: gradientIn(html) };
      });

    expect(painted.length).toBe(quizCategories.length);
    for (const { slug, gradient } of painted) {
      expect(gradient, `tile "${slug}" painted no gradient`).toBeTypeOf("string");
    }

    const gradients = new Map<string, string>();
    for (const { slug, gradient } of painted) {
      const owner = gradients.get(String(gradient));
      expect(owner, `"${slug}" and "${owner}" share the gradient ${gradient}`).toBeUndefined();
      gradients.set(String(gradient), slug);
    }
    expect(gradients.size).toBe(painted.length);
  });

  it("seeds the gradient from the slug, not from render order or a clock", () => {
    const first = gradientIn(render({ name: "Animal", slug: "animal" }));
    const again = gradientIn(render({ name: "Animal", slug: "animal" }));

    expect(again).toEqual(first);
    expect(gradientFor("animal")).toEqual(gradientFor("animal"));
    expect(slugSeed("animal")).not.toEqual(slugSeed("business"));
  });

  it("draws a monogram from the name", () => {
    expect(monogramOf("General Knowledge")).toBe("GK");
    expect(monogramOf("Video Game")).toBe("VG");
    expect(monogramOf("Animal")).toBe("A");
    expect(render({ name: "General Knowledge", slug: "general-knowledge" })).toContain(">GK<");
  });

  it("keeps a real image when the subject has one, and paints no gradient over it", () => {
    const html = render({ name: "Animal", slug: "animal", src: "/animal.webp" });

    expect(html).toContain("<img");
    expect(html).toContain("animal.webp");
    expect(gradientIn(html)).toBeUndefined();
  });
});
