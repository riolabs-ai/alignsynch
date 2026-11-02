// @vitest-environment jsdom
/**
 * The admin console's two reversible writes, driven through the real store.
 *
 * The card's acceptance asks for an "archive → restore cycle with store state pasted", so this
 * mounts `V1StoreProvider` in jsdom, calls the store's own methods, and prints the row before,
 * during and after — the same evidence style `tests/v1-relationship-store.test.tsx` uses.
 *
 * What "reversible" has to mean to pass: archiving changes exactly one field, and **nothing else
 * in the row moves** — the parties, the Aspects, both parties' answers and the session counters
 * are compared before and after, so an archive that quietly dropped an answer would fail here
 * even though the row would still look archived. Restore then returns the row to its exact
 * pre-archive shape, and the persisted flow slice carries the field rather than losing it.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { V1Relationship } from "@/data/v1/fixtures";
import { V1StoreProvider, useV1Store, type V1Store } from "@/lib/v1/store";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let store: V1Store | null = null;

/** The mounted store, or a loud failure instead of a null dereference. */
function live(): V1Store {
  if (store === null) throw new Error("the store is not mounted");
  return store;
}

function relationship(id: string): V1Relationship {
  const found = live().relationships.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`no relationship "${id}" in the store`);
  return found;
}

/** The facts an archive must not touch, as one comparable string. */
function shapeOf(rel: V1Relationship): string {
  return JSON.stringify({
    id: rel.id,
    initiatorName: rel.initiatorName,
    counterpartyName: rel.counterpartyName,
    items: rel.items.map((item) => item.id),
    initiatorAnswers: rel.initiatorAnswers,
    counterpartyAnswers: rel.counterpartyAnswers,
    openedSessions: rel.openedSessions,
    completedSessions: rel.completedSessions,
    subscription: rel.subscription?.status ?? null,
  });
}

const FLOW_KEY = "alignsynch.v1.relationships.v1";
const ADMIN_KEY = "alignsynch.v1.admin.v1";

/** The provider's consumer — it exists to hand the live store to the test body. */
function Harness() {
  store = useV1Store();
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root.render(createElement(V1StoreProvider, null, createElement(Harness)));
  });
  expect(live().hydrated).toBe(true);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  store = null;
});

describe("archive → restore", () => {
  it("stamps one field, keeps every other fact, and restores the row exactly", () => {
    const before = relationship("rel-aligned");
    const beforeShape = shapeOf(before);
    expect(before.archivedAt).toBeNull();

    act(() => live().archiveRelationship("rel-aligned"));
    const archived = relationship("rel-aligned");
    expect(archived.archivedAt).not.toBeNull();
    // The archive is reversible only if it changed nothing else.
    expect(shapeOf(archived)).toBe(beforeShape);
    console.log("archived row:", archived.id, "archivedAt =", archived.archivedAt);

    // A second archive is a no-op: the instant does not move.
    const stampedAt = archived.archivedAt;
    act(() => live().archiveRelationship("rel-aligned"));
    expect(relationship("rel-aligned").archivedAt).toBe(stampedAt);

    act(() => live().restoreRelationship("rel-aligned"));
    const restored = relationship("rel-aligned");
    expect(restored.archivedAt).toBeNull();
    expect(shapeOf(restored)).toBe(beforeShape);
    console.log("restored row:", restored.id, "archivedAt =", restored.archivedAt);
  });

  it("persists the archive in the flow slice, so a reload reads the archived row", () => {
    act(() => live().archiveRelationship("rel-sharing-unmet"));
    const persisted = JSON.parse(window.localStorage.getItem(FLOW_KEY) ?? "{}") as {
      relationships?: readonly { id: string; archivedAt: string | null }[];
    };
    const row = persisted.relationships?.find((entry) => entry.id === "rel-sharing-unmet");
    expect(row?.archivedAt).not.toBeNull();
    console.log("persisted flow row:", JSON.stringify(row));
  });
});

describe("disable → enable a template", () => {
  it("writes one id to the admin slice and takes it back out", () => {
    expect(live().disabledTemplateIds).toEqual([]);
    act(() => live().disableTemplate("v1-template-basics"));
    expect(live().disabledTemplateIds).toEqual(["v1-template-basics"]);

    const persisted = JSON.parse(window.localStorage.getItem(ADMIN_KEY) ?? "{}") as {
      disabledTemplateIds?: readonly string[];
    };
    expect(persisted.disabledTemplateIds).toEqual(["v1-template-basics"]);
    console.log("admin slice:", JSON.stringify(persisted));

    act(() => live().enableTemplate("v1-template-basics"));
    expect(live().disabledTemplateIds).toEqual([]);
  });

  it("disable removes nothing from the library", () => {
    const before = live().templates.length;
    act(() => live().disableTemplate("v1-template-basics"));
    expect(live().templates.length).toBe(before);
    expect(live().templates.some((template) => template.id === "v1-template-basics")).toBe(true);
  });
});
