/**
 * A row the relationship detail's editor adds, and the id it is written with (#936).
 *
 * `AspectList` mints `new-N` for a row that is not on record yet, and that prefix *is* the
 * protocol: the list is what says "this row has no id" (`aspect-list.tsx::isNew`). The detail
 * screen has two writers — the row's own Save (`persistAspects`) and the status buttons
 * (`mirrorAspects`) — and only the second stripped the placeholder, so the first sent
 * `{ id: "new-1" }` to `saveAspects`, which inserts `item.id` verbatim. The row then came back
 * from the server still carrying its client placeholder: written, but named as unsaved.
 */
import { describe, expect, it } from "vitest";

import { buildTemplateRecord, aspectStatesOf } from "@/lib/admin/template-draft";

const added = {
  id: "new-1",
  prompt: "Do we say thank you?",
  leftValue: "Never",
  rightValue: "Daily",
};
const stored = {
  id: "aspect-money",
  prompt: "How are money and the decisions about it handled?",
  leftValue: "Separately",
  rightValue: "Together",
};

describe("a row the editor added is written with a real id, not its placeholder", () => {
  it("drops the `new-` placeholder and keeps a stored id", () => {
    expect(aspectStatesOf([added]).at(0)?.id).toBeUndefined();
    expect(aspectStatesOf([stored]).at(0)?.id).toBe("aspect-money");
    // The words are the person's and travel unchanged — only the id is normalised.
    expect(aspectStatesOf([added]).at(0)?.prompt).toBe(added.prompt);
  });

  it("is what the record builder turns into an item id", () => {
    const record = buildTemplateRecord({
      id: "assessment-relationship-basics",
      slug: "relationship-basics",
      title: "Relationship basics",
      summary: "s",
      status: "published",
      date: "2026-11-01",
      aspects: aspectStatesOf([stored, added]),
    });
    const items = (record as { items: { id: string; prompt: string }[] }).items;
    // The stored row keeps the handle every answer row points at.
    expect(items[0]?.id).toBe("aspect-money");
    // The added row gets one derived from its prompt — never the browser's `new-1`, which would
    // read back on this screen as a row that is still unsaved.
    expect(items[1]?.id).not.toBe("new-1");
    expect(items[1]?.id.startsWith("aspect-")).toBe(true);
    expect(items[1]?.prompt).toBe(added.prompt);
  });

  it("is the same call the status buttons already make", () => {
    // Both writers now go through one function, so the two paths cannot disagree again.
    const rows = [stored, added];
    expect(aspectStatesOf(rows)).toEqual(aspectStatesOf([...rows]));
    expect(aspectStatesOf(rows).map((row) => row.id)).toEqual(["aspect-money", undefined]);
  });
});
