/**
 * `/relationship-templates` — the public catalogue, drawn as bundle 02 draws it.
 *
 * The register pair for this page is `docs/specs/v2-rectification.md` →
 * `guides/initiator/pick-a-template.md`, and the deltas it named had been carried in prose for
 * twenty-one commits without anything a test could hold. This file is that holding: each case is
 * one line the reference draws and the page must therefore draw **once, in the same place**.
 *
 *   1. **one `Choose a Template` heading.** The page printed the band heading twice — an
 *      `sr-only` copy for the section's `aria-labelledby` and the visible one inside the browser
 *      island — so the document carried two headings with the same words and a screen reader
 *      announced the band twice. The bundle draws one.
 *   2. **the `Popular` badge sits on the card the hero offers.** `relationship-templates.html`
 *      draws a `Popular` badge on the exemplar card, and the hero's second action says
 *      `Start With the Most Popular`; the badge and the action have to be the same template or
 *      the page points two ways at once. Read from the taxonomy, never retyped here.
 *   3. **every card prints how long its answers take**, derived from its Aspect count — the
 *      reference draws `About 3 Minutes` on a `5 Aspects` card, and `lib/member/shelf.ts` already
 *      derives the same figure for the in-app shelf, so the public catalogue cannot be the one
 *      surface that omits it.
 *   4. **the copy carries the reference's glyphs.** The bundle uses the typographic apostrophe
 *      (`you’re`, `there’s`); the fixture had the ASCII one, which the design-audit comparison
 *      reports as a real difference because it compares case- and glyph-sensitively on purpose.
 *
 * "Renders" means `renderToStaticMarkup`: the catalogue view is a server component whose one
 * client island only narrows markup that is already in the HTML, so the static markup is the
 * screen a reader without JavaScript gets.
 */
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { RelationshipCatalogue } from "@/components/marketing/relationship-catalogue";
import { isFileMedia } from "@/content/media";
import { FEATURED_ART } from "@/data/featured-art";
import { media, type MediaKey } from "@/data/media";
import { relationshipCatalogueCopy } from "@/data/pages/relationship-catalogue";
import { purchasableRelationshipTypes } from "@/data/relationship-types";
import {
  catalogueBand,
  catalogueBands,
  catalogueCards,
  catalogueExample,
  catalogueGroups,
  catalogueHero,
  catalogueQuestions,
  catalogueSteps,
} from "@/lib/relationship-catalogue";
import { relationshipTypePath } from "@/lib/flow/paths";

/**
 * The page's own composition, resolved the way `app/(marketing)/relationship-templates/page.tsx`
 * resolves it. The helpers are the same ones the route calls, so a change to the route's wiring
 * that this file does not follow fails here rather than in production.
 */
function models() {
  const types = purchasableRelationshipTypes;
  const popular = types.find((type) => type.id === "staff-manager") ?? types[0];
  const carry = "";
  const cards = catalogueCards(relationshipCatalogueCopy, types, carry, popular?.id);
  return {
    cards,
    popular,
    element: createElement(RelationshipCatalogue, {
      band: catalogueBand(relationshipCatalogueCopy),
      bands: catalogueBands(relationshipCatalogueCopy),
      banner: undefined,
      cards,
      example: catalogueExample(relationshipCatalogueCopy, types),
      groups: catalogueGroups(relationshipCatalogueCopy, cards),
      hero: catalogueHero(
        relationshipCatalogueCopy,
        cards,
        popular === undefined
          ? (cards[0]?.href ?? relationshipTypePath("staff-manager"))
          : relationshipTypePath(popular.id),
      ),
      questions: catalogueQuestions(relationshipCatalogueCopy),
      steps: catalogueSteps(relationshipCatalogueCopy),
    }),
  };
}

const html = (() => renderToStaticMarkup(models().element))();

test("the catalogue draws one Choose a Template heading, not two", () => {
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, "").trim())
    .filter((text) => text === "Choose a Template");
  assert.equal(headings.length, 1, `expected one heading, drew ${headings.length}`);
  // The section's accessible name still resolves: the surviving heading is the one it names.
  assert.match(html, /aria-labelledby="catalog-title"/);
  assert.match(html, /<h2[^>]*id="catalog-title"[^>]*>Choose a Template<\/h2>/);
});

test("the Popular badge sits on the card the hero's second action opens", () => {
  const { cards, popular } = models();
  assert.ok(popular, "the catalogue serves no template at all");
  const badged = cards.filter((card) => card.popular).map((card) => card.id);
  assert.deepEqual(badged, [popular.id]);
  // And the hero action names the same template, or the page points two ways at once.
  const hero = html.match(/Start With the Most Popular/);
  assert.ok(hero, "the hero does not draw its second action");
  assert.ok(html.includes(`href="${relationshipTypePath(popular.id)}"`));
  // One badge in the markup, carrying the reference's word.
  const badges = [...html.matchAll(/>Popular</g)];
  assert.equal(badges.length, 1);
});

test("every card prints the minutes its answers take, derived from its Aspect count", () => {
  const { cards } = models();
  assert.ok(cards.length > 0);
  for (const card of cards) {
    // `5 Aspects` → `About 3 Minutes`, `6` → `4`, `4` → `2`: the reference's own samples.
    assert.match(card.minutes, /^About \d+ Minutes?$/);
    assert.ok(html.includes(card.minutes), `${card.id} draws no "${card.minutes}" chip`);
  }
  const brotherSister = cards.find((card) => card.id === "brother-sister");
  assert.equal(brotherSister?.minutes, "About 3 Minutes");
});

test("the catalog copy carries the reference's typographic apostrophes", () => {
  assert.ok(html.includes("you’re In Synch and where there’s a Gap"));
  assert.ok(!html.includes("you're In Synch"), "an ASCII apostrophe survived in the subtitle");
  assert.ok(!html.includes("haven't added a card"), "an ASCII apostrophe survived in a question");
  assert.ok(!html.includes("each other's answers"), "an ASCII apostrophe survived in a question");
});

/**
 * The featured-image slot (#t_f96ad328), on the surface a reader actually reaches.
 *
 * The slot is a **chain**: a record the art tranche has reached draws its own picture, and a
 * record it has not draws the realm's band — on the same grid, with no component deciding which.
 * Asserting only the tranche would leave the fallback untested, and asserting only the fallback
 * would leave the tranche unproven; both arms are one band per card, so the counts must sum to
 * the catalogue.
 */
test("every card carries one art band, and only the tranche's cards carry a picture", () => {
  const { cards } = models();
  const withPicture = cards
    .filter((card) => card.featured !== undefined)
    .map((card) => card.id)
    .sort();
  assert.deepEqual(withPicture, FEATURED_ART.map((row) => row.record).sort());

  const featured = html.match(/data-featured-art/g)?.length ?? 0;
  const realm = html.match(/data-realm-art/g)?.length ?? 0;
  assert.equal(featured, FEATURED_ART.length, "a covered card is missing its picture");
  assert.equal(
    realm,
    cards.length - FEATURED_ART.length,
    "a card with no art has no fallback band",
  );
  assert.equal(featured + realm, cards.length, "a card drew two bands, or none");
});

test("a record with no art yet draws the realm band — the fallback, on its own card", () => {
  const { cards } = models();
  const noArt = cards.find((card) => card.id === "co-founders");
  assert.ok(noArt, "co-founders is not in the catalogue");
  assert.equal(noArt.featured, undefined);

  const at = html.indexOf('data-template-card="co-founders"');
  assert.ok(at > 0, "the co-founders card is not in the markup");
  const card = html.slice(at, html.indexOf("</li>", at));
  assert.match(card, /data-realm-art/, "the fallback band is not drawn");
  assert.doesNotMatch(card, /data-featured-art/, "a card with no art drew a featured band");
  assert.doesNotMatch(card, /relationship-types\/featured/, "a neighbour's picture leaked on");
});

test("the tranche is a bijection with the media registry, and every picture has a size", () => {
  const fileKeys = Object.keys(media)
    .filter((key) => key.startsWith("relationship-types.featured."))
    .sort();
  assert.deepEqual(
    FEATURED_ART.flatMap((row) => row.keys).sort(),
    fileKeys,
    "a featured file has no row, or a row names no file",
  );
  for (const key of fileKeys) {
    const entry = media[key as MediaKey];
    assert.ok(isFileMedia(entry), `${key} is not a file entry`);
    // `next/image` needs an intrinsic size, and the band's generated default is sized from it.
    assert.ok(entry.width > 0 && entry.height > 0, `${key} has no intrinsic size`);
    assert.ok(html.includes(entry.src), `${entry.src} is not in the served markup`);
  }
});
