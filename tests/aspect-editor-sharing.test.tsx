/**
 * #774 — **one Aspect editor, two screens.**
 *
 * The modal's list (`components/assessment-flow/aspect-list.tsx`) is the standard: the ordinal at the
 * far left, the grip, the question, the scale, and the pencil that opens the row in place. The
 * dashboard used to draw a second editor — three always-open inputs, no ordinal, no grip, one bulk
 * save — so the same relationship looked like two different products depending on where you stood.
 *
 * Two things are asserted here, and they are deliberately opposite:
 *
 *   1. the same component now draws both screens, with the same row anatomy; and
 *   2. the one place the screens still differ — add and remove — stays a prop, because stage 3
 *      forbids it (V4, #699) and the dashboard has always allowed it. A test that let `addRemove`
 *      default to on would silently repeal the rule.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AspectList } from "@/components/assessment-flow/aspect-list";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import {
  ASPECT_EDITOR_SECTION,
  dashboardRelationshipDetailPageCopy,
} from "@/data/pages/dashboard-relationship-detail";

const ROW = {
  id: "9d2f0c76-0000-4000-8000-000000000001",
  prompt: "Time together",
  leftValue: "Never enough",
  rightValue: "Plenty",
};

/** The markup the modal draws at stage 3: the row anatomy, and no list controls. */
test("the create flow draws the shared editor without add or remove (V4)", () => {
  const html = renderToStaticMarkup(
    <AspectList copy={assessmentCreatePageCopy} templateRecordId="template-1" aspects={[ROW]} />,
  );

  assert.match(html, /data-aspect-list="true"/);
  assert.match(html, /data-aspect-ordinal="1"/);
  assert.match(html, /data-aspect-grip=/);
  assert.match(html, /data-aspect-edit-icon=/);
  assert.match(html, /Time together/);

  assert.doesNotMatch(html, /data-aspect-add/);
  assert.doesNotMatch(html, /data-aspect-remove/);
});

/** The markup the dashboard draws: the same anatomy, plus the two controls it has always had. */
test("the dashboard draws the same row anatomy, with add and remove", () => {
  const html = renderToStaticMarkup(
    <AspectList
      copy={dashboardRelationshipDetailPageCopy}
      wordsSection={ASPECT_EDITOR_SECTION}
      validationSection={null}
      aspects={[ROW]}
      addRemove
      save={async () => ({ ok: true })}
    />,
  );

  assert.match(html, /data-aspect-ordinal="1"/);
  assert.match(html, /data-aspect-grip=/);
  assert.match(html, /data-aspect-edit-icon=/);
  assert.match(html, /data-aspect-add="true"/);
  assert.match(html, /data-aspect-remove=/);

  // The words are the dashboard's own — each page owns its copy (E23), so a rename on one screen
  // must not move the other.
  assert.match(html, /Drag to reorder/);
  assert.doesNotMatch(html, /Drag to Reorder Aspects/);
});

/** The section the page names is the section the fixture declares, or the row renders blank. */
test("the dashboard's editor section exists in its own fixture", () => {
  const section = (dashboardRelationshipDetailPageCopy.sections ?? []).find(
    (entry) => entry.id === ASPECT_EDITOR_SECTION,
  );
  assert.ok(section, `the fixture declares no "${ASPECT_EDITOR_SECTION}" section`);

  const ids = new Set((section.items ?? []).map((item) => item.id));
  for (const id of [
    "count",
    "tap-to-edit",
    "drag-hint",
    "prompt-label",
    "left-label",
    "left-help",
    "right-label",
    "right-help",
    "edit",
    "save",
    "cancel",
    "unsaved",
    "grip",
    "saved",
    "reordered",
    "refused",
    "add",
    "remove",
  ]) {
    assert.ok(ids.has(id), `the editor asks for "${id}", which the section does not declare`);
  }
});

/**
 * The dashboard wires all three: the shared rows, the two controls, and both directions of the
 * write — `save` for a row, `onChange` so "Save and mark ready" writes the rows on screen.
 */
test("the dashboard mounts the shared editor wired for its own save", () => {
  const source = readFileSync(
    join(process.cwd(), "components/dashboard/relationship-detail.tsx"),
    "utf8",
  );
  const mount = source.slice(
    source.indexOf("<AspectList"),
    source.indexOf("/>", source.indexOf("<AspectList")),
  );
  assert.ok(mount.length > 0, "the dashboard does not mount AspectList");
  for (const wiring of [
    "addRemove",
    "onChange={mirrorAspects}",
    "save={persistAspects}",
    "wordsSection={ASPECT_EDITOR_SECTION}",
  ]) {
    assert.ok(mount.includes(wiring), `the mount is missing ${wiring}`);
  }
  // The old second editor is gone, not shadowed: three always-open inputs on one list is the defect.
  assert.ok(!source.includes("data-aspect-editor"), "the hand-built editor is still in the page");
});
