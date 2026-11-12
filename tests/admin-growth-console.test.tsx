/**
 * `/admin/growth`'s two halves (#920): the reader that turns a file into a model, and the console
 * that draws it.
 *
 * The page is gated (`requireAdminProduct()` then `requireAdmin()`), so a test cannot reach it
 * through the route without a session — which is why the halves are asserted where they actually
 * live. `lib/admin/growth.ts` is the whole of "what happens when the artifact is missing, broken or
 * stale", and the three cases below are the three shapes of that: absent, not JSON, not the schema.
 * The render half pins the claim the screen makes in public — four bands, the solved ARR on the
 * first one, the invoice table on the last — against the committed artifact, not a fixture built
 * for the test.
 *
 * `renderToStaticMarkup` rather than a DOM mount: recharts' `ResponsiveContainer` measures the
 * browser at mount, and the server render is the half this repo can hold still (it is also the half
 * `next build` produces). The chart *marks* are therefore not asserted — a chart that draws nothing
 * without a measurement is expected — but the words, the numbers and the table cells are, which is
 * what an operator reads.
 */
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

import { GrowthConsole, GrowthConsoleUnreadable } from "@/components/admin/growth-console";
import { adminGrowthPageCopy } from "@/data/pages/admin-growth";
import { GROWTH_MODEL_PATH, GrowthModelUnreadable, readGrowthModel } from "@/lib/admin/growth";

const model = readGrowthModel(join(process.cwd(), GROWTH_MODEL_PATH));

/** A throwaway file, so each failure case writes exactly what it needs. */
function withTempModel(text: string): string {
  const dir = mkdtempSync(join(tmpdir(), "growth-model-"));
  const path = join(dir, "growth-model.json");
  writeFileSync(path, text, "utf8");
  return path;
}

test("the reader returns the committed model, validated", () => {
  assert.equal(model.cohorts.length, 36);
  assert.equal(model.months.length, 36);
  assert.ok(model.totals.finalArrCents > 0);
  // The artifact is the schema's own document: a hand-edit that adds a key would fail here.
  assert.equal(model.modelVersion, 1);
});

test("a missing artifact is a named failure, not an empty model", () => {
  assert.throws(
    () => readGrowthModel(join(tmpdir(), "growth-model-that-does-not-exist.json")),
    (error: unknown) => error instanceof GrowthModelUnreadable && /not readable/.test(error.reason),
  );
});

test("an artifact that is not JSON, or not the schema, says which", () => {
  assert.throws(
    () => readGrowthModel(withTempModel("{ not json")),
    (error: unknown) => error instanceof GrowthModelUnreadable && /not JSON/.test(error.reason),
  );
  assert.throws(
    () => readGrowthModel(withTempModel(JSON.stringify({ modelVersion: 1 }))),
    (error: unknown) =>
      error instanceof GrowthModelUnreadable &&
      /does not match the growth-model schema/.test(error.reason),
  );
});

test("the console renders four bands over the committed model", () => {
  const html = renderToStaticMarkup(<GrowthConsole copy={adminGrowthPageCopy} model={model} />);

  // The heading and the provenance sentence — the screen says where its numbers came from.
  assert.match(html, /Growth model/);
  assert.match(html, /pnpm growth --seed 42 --months 36 --target-arr 3000000/);
  for (const section of adminGrowthPageCopy.sections ?? []) {
    assert.ok(
      section.heading !== undefined && html.includes(section.heading),
      `the "${section.id}" band renders its heading`,
    );
  }

  // The solved ARR, formatted as money — the number the whole model exists to produce.
  assert.ok(html.includes("$2,999,895"), "the final ARR is drawn");

  // The invoice table: a row per plan and the total, with the final month named.
  const finalMonth = model.months.at(-1);
  assert.ok(finalMonth);
  assert.ok(html.includes(finalMonth.label), "the invoice band names its month");
  for (const plan of model.plans) {
    assert.ok(html.includes(plan.label), `the invoice table draws ${plan.label}`);
  }
  assert.ok(html.includes("<table"), "the invoice band is a table");
});

test("no class in the console can force a width below the column", () => {
  // The same structural proof `tests/stage-shell-mobile.test.tsx` makes for the modal shell: there
  // is no layout engine in `pnpm test`, so what is asserted is that no class string in the file can
  // make a band wider than the column at 390 px. A chart is `w-full` with a fixed *height*; a fixed
  // *width* — `w-[…px]`, `min-w-[…px]`, or an ungated `w-96`-class — is the sideways-scroll bug.
  const code = readFileSync(join(process.cwd(), "components/admin/growth-console.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  const classes = [
    ...code.matchAll(/(?:^|[\s"'`])((?:[a-z0-9-]+:)*[a-z0-9-]*(?:min-)?w-\[[^\]]+\])/g),
  ].map((match) => match[1] ?? "");
  assert.deepEqual(classes, [], "no arbitrary width utility in the growth console");

  // The one narrow-width class the shell already relies on: a table that scrolls inside its own
  // frame rather than pushing the page, which is what keeps six columns legible at 390.
  assert.ok(code.includes("overflow-x-auto"), "the invoice table scrolls inside its own frame");
});

test("an unreadable artifact draws the panel, never a page of zeroes", () => {
  const html = renderToStaticMarkup(
    <GrowthConsoleUnreadable
      copy={adminGrowthPageCopy}
      reason="data/demo/growth-model.json is not readable in this tree (ENOENT)"
    />,
  );
  assert.match(html, /The growth model could not be read/);
  assert.match(html, /ENOENT/);
  assert.match(html, /pnpm growth --seed 42/);
  assert.ok(!html.includes("$0"), "a failure is never rendered as zero revenue");
});
