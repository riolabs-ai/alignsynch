/**
 * `/relationship-types/[slug]` — one relationship type's public page (#794).
 *
 * The directory (`/relationship-types`) listed twenty-seven types and let a stranger inspect none of
 * them. This file proves the page that fixes that, and it proves it against the fixture rather
 * than against a copy of it:
 *
 *   1. the `staff-manager` page prints **every one of that type's Aspect questions and both of
 *      its named ends** — read from `data/relationship-types.ts`, never retyped here, so a
 *      question edited in the taxonomy cannot silently stop appearing;
 *   2. the price and the one start action (`/register`) are printed — and the price is the
 *      **plan's** month, named with its plan and its interval, never a per-relationship figure;
 *   3. a slug that is not a purchasable type resolves to no page, and `generateStaticParams()`
 *      covers **exactly** the purchasable set — the three excluded dating rows produce no URL;
 *   4. every catalogue card carries `detail === "/relationship-types/<id>"` and the directory
 *      renders it;
 *   5. the worked example appears where `demoAnswersFor()` holds a sheet and is absent where it
 *      does not, which is what keeps a link to a 404 off the page.
 *
 * "Renders" means `renderToStaticMarkup`: the view is a server component with no state, so the
 * markup is the screen.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "vitest";

import { generateStaticParams } from "@/app/(marketing)/relationship-types/[slug]/page";
import { TemplateDetail } from "@/components/templates/template-detail";
import { TemplatesPageView } from "@/components/templates/templates-page";
import { formatCurrency } from "@/content/core";
import { billingPlan } from "@/data/billing-plans";
import {
  EXCLUDED_TYPE_IDS,
  demoAnswersByType,
  demoAnswersFor,
  purchasableRelationshipTypes,
  relationshipType,
} from "@/data/relationship-types";
import { alignSynchHomeCopy } from "@/data/pages/home-alignsynch";
import { templatesDetailPageCopy } from "@/data/pages/templates-detail";
import { templatesPageCopy } from "@/data/pages/templates";
import { relationshipTypeDemoPath } from "@/lib/flow/paths";
import { leafLiterals } from "@/scripts/copy-refs";
import { CATALOGUE_PATH, START_PATH, templateCards } from "@/lib/template-catalogue";
import { templateDetail, templateSlugs } from "@/lib/template-detail";
import { templatesPage } from "@/lib/templates-page";
import { pageItemOf } from "@/lib/page-copy";

/** The one plan the marketing surfaces price: Basic, whose monthly figure each card prints. */
const basic = billingPlan("basic");
if (basic === undefined) throw new Error('data/billing-plans.ts has no "basic" plan');
const BASIC_MONTH = formatCurrency(basic.monthlyCents);
const PLAN_CHIP = `${basic.name} · ${BASIC_MONTH}/mo`;

/** The words a reader sees: tags dropped, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** One type from the fixture, or a failed test — a renamed id must not read as an empty page. */
function typeAt(id: string): NonNullable<ReturnType<typeof relationshipType>> {
  const found = relationshipType(id);
  assert.ok(found !== undefined, `data/relationship-types.ts has no type "${id}"`);
  return found;
}

/** One template's page, rendered — the model and the markup together. */
function renderTemplate(slug: string) {
  const model = templateDetail(templatesDetailPageCopy, slug);
  assert.ok(model !== undefined, `no page model for "${slug}"`);
  const html = renderToStaticMarkup(createElement(TemplateDetail, { model }));
  return { model, html, text: textOf(html) };
}

test("renders every staff-manager Aspect question, with both of its named ends", () => {
  const type = typeAt("staff-manager");
  const { model, html, text } = renderTemplate(type.id);

  // The page is about this relationship: its name, its two roles and its realm.
  assert.equal(model.name, type.name);
  assert.equal(model.realm, type.realm);
  assert.ok(text.includes(type.name), `the page does not print "${type.name}"`);
  assert.ok(text.includes(type.roles.initiator) && text.includes(type.roles.counterparty));

  // Every Aspect, in the fixture's order — the question and both ends, read from the record.
  assert.deepEqual(
    model.aspects.rows.map((row) => row.id),
    type.aspects.map((aspect) => aspect.id),
  );
  assert.ok(type.aspects.length >= 5, "a purchasable type asks at least five Aspects");
  for (const aspect of type.aspects) {
    assert.ok(text.includes(aspect.prompt), `the page does not ask "${aspect.prompt}"`);
    assert.ok(text.includes(aspect.leftValue), `the page does not name "${aspect.leftValue}"`);
    assert.ok(text.includes(aspect.rightValue), `the page does not name "${aspect.rightValue}"`);
    assert.ok(html.includes(`data-template-aspect="${aspect.id}"`));
  }

  // The descriptor pair is on the page at the same weight: for, and not for.
  assert.ok(text.includes(type.descriptor.whoItsFor));
  assert.ok(text.includes(type.descriptor.whoItsNotFor));
});

test("prints the plan's price and the one start action, both from the fixture", () => {
  const type = typeAt("staff-manager");
  const { model, html, text } = renderTemplate(type.id);

  // The page's one figure is the plan's month, named with its plan and its interval — the same
  // chip the member shelf and `/assessment/templates` print, from the one plan fixture (#798).
  assert.equal(model.priceNote, PLAN_CHIP);
  assert.ok(html.includes(model.priceNote), "the price line is not in the markup");
  assert.equal(model.start.href, START_PATH);
  assert.equal(START_PATH, "/register");
  assert.ok(html.includes(`href="${START_PATH}"`), "the start action does not link to /register");
  assert.ok(html.includes(`href="${CATALOGUE_PATH}"`), "there is no way back to the directory");
  assert.equal(model.back.href, CATALOGUE_PATH);

  // Neither the figure the pricing page does not sell nor the unit it was charged in is on the
  // page — asserted on what a reader gets, not only on the model.
  assert.equal(text.includes("999"), false, "the page prints 999");
  assert.equal(
    text.toLowerCase().includes("per relationship"),
    false,
    'the page says "per relationship"',
  );
  assert.equal(html.includes(formatCurrency(999)), false, "the page prints $9.99");
});

test("the plan's price does not vary with the template", () => {
  const chips = new Set(
    purchasableRelationshipTypes.map((type) => renderTemplate(type.id).model.priceNote),
  );
  assert.deepEqual([...chips], [PLAN_CHIP]);
});

/**
 * One label, three fixtures — not three spellings of the same rule.
 *
 * `template-price` is declared on each surface's own fixture (E23: a component reads the fixture
 * of the route that renders it), so the three rows are three copies by design. What they may not
 * be is three *wordings*: this pins them to one string, so the shop cannot end up describing the
 * same plan three ways (#798).
 */
test("all three marketing fixtures carry the same price label, with both placeholders", () => {
  const labels = [
    ["data/pages/templates.ts", pageItemOf(templatesPageCopy, "template-price").label],
    ["data/pages/templates-detail.ts", pageItemOf(templatesDetailPageCopy, "template-price").label],
    ["data/pages/home-alignsynch.ts", pageItemOf(alignSynchHomeCopy, "template-price").label],
  ] as const;

  const distinct = new Set(labels.map(([, label]) => label));
  assert.deepEqual([...distinct], ["{plan} · {price}/mo"]);
  for (const [path, label] of labels) {
    assert.ok(label.includes("{plan}"), `${path} does not name the plan`);
    assert.ok(label.includes("{price}"), `${path} does not carry a price`);
    assert.equal(
      label.includes("per relationship"),
      false,
      `${path} still charges per relationship`,
    );
  }
});

test("a slug that names no purchasable type produces no page", () => {
  // Unknown, and the three dating rows the owner excluded — the same absence either way.
  for (const slug of ["not-a-template", "", ...EXCLUDED_TYPE_IDS]) {
    assert.equal(
      templateDetail(templatesDetailPageCopy, slug),
      undefined,
      `"${slug}" produced a page model`,
    );
  }
  // A caller that hands in the full taxonomy is still refused a dating row.
  const dating = typeAt("dating");
  assert.equal(templateDetail(templatesDetailPageCopy, dating.id, [dating]), undefined);

  // The static params are exactly the purchasable set: no dating row, no type missed.
  assert.deepEqual(
    templateSlugs(),
    purchasableRelationshipTypes.map((type) => type.id),
  );
  assert.equal(templateSlugs().length, 27);
  for (const id of EXCLUDED_TYPE_IDS) assert.equal(templateSlugs().includes(id), false);
});

test("generateStaticParams covers exactly the purchasable set", async () => {
  const params = await generateStaticParams();
  assert.deepEqual(
    params.map((param) => param.slug),
    templateSlugs(),
  );
  assert.deepEqual(
    [...params.map((param) => param.slug)].sort(),
    purchasableRelationshipTypes.map((type) => type.id).sort(),
  );
});

test("every catalogue card carries its own detail href, and the directory renders it", () => {
  const cards = templateCards(templatesPageCopy, purchasableRelationshipTypes);
  const page = templatesPage(templatesPageCopy);
  const html = renderToStaticMarkup(createElement(TemplatesPageView, { model: page }));

  assert.equal(cards.length, purchasableRelationshipTypes.length);
  for (const card of cards) {
    assert.equal(card.slug, card.id);
    assert.equal(card.detail, `${CATALOGUE_PATH}/${card.id}`);
    // #794 — the public catalogue moved out of the template noun: `/templates` is the template
    // namespace now (and a 308 to `/relationship-types`), so a card's address is a *type*'s.
    assert.equal(card.detail, `/relationship-types/${card.id}`);
    assert.ok(html.includes(`href="${card.detail}"`), `the directory does not link ${card.detail}`);
  }
});

test("offers the worked example only where the fixture holds one", () => {
  const withDemo = purchasableRelationshipTypes.filter(
    (type) => demoAnswersFor(type.id) !== undefined,
  );
  assert.equal(withDemo.length, Object.keys(demoAnswersByType).length);
  assert.ok(withDemo.length >= 1, "no purchasable type has a worked example");

  for (const type of withDemo) {
    const { model, html } = renderTemplate(type.id);
    assert.ok(model.example !== undefined, `"${type.id}" has a demo but no example link`);
    assert.equal(model.example.href, relationshipTypeDemoPath(type.id));
    assert.ok(html.includes(`href="${model.example.href}"`));
  }

  const withoutDemo = purchasableRelationshipTypes.filter(
    (type) => demoAnswersFor(type.id) === undefined,
  );
  assert.ok(withoutDemo.length >= 1, "every type has a demo — the absence branch is unproven");
  for (const type of withoutDemo.slice(0, 3)) {
    const { model, html } = renderTemplate(type.id);
    assert.equal(model.example, undefined);
    assert.equal(html.includes(relationshipTypeDemoPath(type.id)), false);
  }
});

test("the view writes no words of its own", () => {
  const path = "components/templates/template-detail.tsx";
  const literals = leafLiterals({ path, source: readFileSync(path, "utf8") });
  assert.deepEqual(
    literals.map((literal) => `${literal.file}:${literal.line} ${literal.value}`),
    [],
  );
});
