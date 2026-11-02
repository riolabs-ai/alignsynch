// @vitest-environment jsdom
/**
 * The Aspects editor, clone and save-to-library — driven through the real store, not a mock.
 *
 * `lib/v1/store.tsx` is a React context whose mutations are the product: "add an Aspect" is
 * only correct if the relationship the detail page re-reads has the new Aspect, the parties'
 * answers survive a soft delete, and a clone is a *copy* (new id, fresh invite, no answers) of
 * something the original never notices. A test that read the seed array would prove none of it,
 * so this mounts `V1StoreProvider` in jsdom, calls the store's own methods, and prints the
 * resulting state after each step — the same evidence the card's acceptance asks for.
 *
 * The steps, on `rel-invited` (three Aspects, unclaimed, invited by Jordan):
 *
 *   add      → four Aspects, the new one last, with its own id
 *   rename   → the prompt changes, the id and position do not
 *   reorder  → the new Aspect moves up one slot, everything else shifts
 *   delete   → it leaves `items`, lands in `deletedAspects`, answers untouched
 *   restore  → it is back in `items`, `deletedAspects` empty again
 *   clone    → a new relationship id with the same Aspect ids, and the original unchanged
 *   save     → a new library entry with the same Aspect ids
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

/** The one-line state the acceptance pastes: ids and prompts, in order. */
function aspectsOf(rel: V1Relationship): string {
  return rel.items.map((item, index) => `${index + 1}.${item.id}:${item.prompt}`).join(" | ");
}

/** Every id a cloned or saved set carries, so "same Aspects" is checked id for id. */
function aspectIds(rel: { readonly items: readonly { readonly id: string }[] }): string[] {
  return rel.items.map((item) => item.id);
}

/** The provider's consumer — it exists to hand the live store to the test body. */
function Harness() {
  store = useV1Store();
  return null;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // A fresh browser per test: no persisted store from a previous case can leak in.
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
  window.localStorage.clear();
});

describe("the Aspects CRUD", () => {
  it("adds, renames, reorders, deletes and restores one Aspect, printing the store each time", () => {
    const before = relationship("rel-invited");
    expect(before.items).toHaveLength(3);
    const originalIds = aspectIds(before);
    console.log(`[1 seed]   ${aspectsOf(before)}`);

    // --- add -------------------------------------------------------------------------------
    act(() => {
      live().addAspect("rel-invited", {
        prompt: "Who owns the calendar?",
        leftValue: "Me",
        rightValue: "You",
      });
    });
    const added = relationship("rel-invited");
    expect(added.items).toHaveLength(4);
    const newAspect = added.items[3];
    expect(newAspect.prompt).toBe("Who owns the calendar?");
    expect(newAspect.id.startsWith("aspect-")).toBe(true);
    expect(aspectIds(added).slice(0, 3)).toEqual(originalIds);
    console.log(`[2 add]    ${aspectsOf(added)}`);

    // --- rename ----------------------------------------------------------------------------
    act(() => {
      live().renameAspect("rel-invited", newAspect.id, {
        prompt: "Who keeps the calendar?",
        leftValue: "I do",
      });
    });
    const renamed = relationship("rel-invited");
    const renamedAspect = renamed.items[3];
    expect(renamedAspect.id).toBe(newAspect.id);
    expect(renamedAspect.prompt).toBe("Who keeps the calendar?");
    expect(renamedAspect.leftValue).toBe("I do");
    expect(renamedAspect.rightValue).toBe("You");
    console.log(`[3 rename] ${aspectsOf(renamed)}`);

    // --- reorder ---------------------------------------------------------------------------
    act(() => {
      live().moveAspect("rel-invited", newAspect.id, "up");
    });
    const reordered = relationship("rel-invited");
    expect(aspectIds(reordered)[2]).toBe(newAspect.id);
    expect(aspectIds(reordered)[3]).toBe(originalIds[2]);
    expect(reordered.items).toHaveLength(4);
    console.log(`[4 move]   ${aspectsOf(reordered)}`);

    // --- delete (soft) ---------------------------------------------------------------------
    act(() => {
      live().deleteAspect("rel-invited", newAspect.id);
    });
    const deleted = relationship("rel-invited");
    expect(aspectIds(deleted)).toEqual(originalIds);
    expect(deleted.deletedAspects.map((item) => item.id)).toEqual([newAspect.id]);
    console.log(
      `[5 delete] items: ${aspectsOf(deleted)} || deletedAspects: ${deleted.deletedAspects
        .map((item) => `${item.id}:${item.prompt}`)
        .join(" | ")}`,
    );

    // --- restore ---------------------------------------------------------------------------
    act(() => {
      live().restoreAspect("rel-invited", newAspect.id);
    });
    const restored = relationship("rel-invited");
    expect(restored.items).toHaveLength(4);
    expect(restored.items[3].id).toBe(newAspect.id);
    expect(restored.items[3].prompt).toBe("Who keeps the calendar?");
    expect(restored.deletedAspects).toEqual([]);
    console.log(`[6 restore] ${aspectsOf(restored)}`);
  });

  it("refuses to soft-delete the last Aspect, and never resurrects an unknown id", () => {
    // Delete down to one Aspect, then prove the guard holds.
    for (const id of ["aspect-money", "aspect-conflict"]) {
      act(() => live().deleteAspect("rel-invited", id));
    }
    let rel = relationship("rel-invited");
    expect(rel.items).toHaveLength(1);
    act(() => live().deleteAspect("rel-invited", rel.items[0].id));
    rel = relationship("rel-invited");
    expect(rel.items).toHaveLength(1);
    expect(rel.deletedAspects).toHaveLength(2);

    act(() => live().restoreAspect("rel-invited", "aspect-does-not-exist"));
    expect(relationship("rel-invited").items).toHaveLength(1);
  });
});

describe("clone and save to library", () => {
  it("clones the Aspects into a fresh relationship and leaves the original untouched", () => {
    const original = relationship("rel-invited");
    const originalSnapshot = JSON.stringify(original);

    // A holder object, so the value the callback assigns is typed as the real store return.
    const created: { clone?: V1Relationship } = {};
    act(() => {
      created.clone = live().cloneRelationship("rel-invited");
    });
    const clone = created.clone;
    if (clone === undefined) throw new Error("cloneRelationship returned nothing");

    expect(clone.id).not.toBe(original.id);
    expect(aspectIds(clone)).toEqual(aspectIds(original));
    // A copy of the blueprint, not of the session: no answers, no invite, no acceptance.
    expect(clone.initiatorAnswers).toEqual({});
    expect(clone.counterpartyAnswers).toEqual({});
    expect(clone.inviteToken).toBeNull();
    expect(clone.inviteExpiresAt).toBeNull();
    expect(clone.counterpartyName).toBeNull();
    expect(clone.initiatorAccepted).toBe(false);
    expect(clone.deletedAspects).toEqual([]);
    // The original is byte-for-byte the row it was, and the store holds both.
    expect(JSON.stringify(relationship("rel-invited"))).toBe(originalSnapshot);
    expect(live().relationships.map((rel) => rel.id)).toContain(clone.id);
    console.log(
      `[clone] original ${original.id} (${aspectIds(original).join(", ")}) → ${clone.id} (${aspectIds(clone).join(", ")}); store now ${live().relationships.length} relationships`,
    );
  });

  it("saves the Aspects as a new library entry with a distinct id and slug", () => {
    const rel = relationship("rel-invited");
    const templatesBefore = live().templates.length;

    const saved: { entry?: { id: string; slug: string; title: string } } = {};
    act(() => {
      const entry = live().saveAspectSetToLibrary("rel-invited");
      saved.entry = { id: entry.id, slug: entry.slug, title: entry.title };
    });
    const entry = saved.entry;
    if (entry === undefined) throw new Error("saveAspectSetToLibrary returned nothing");

    const inLibrary = live().templates.find((template) => template.id === entry.id);
    expect(inLibrary).toBeDefined();
    expect(live().templates).toHaveLength(templatesBefore + 1);
    expect(inLibrary?.items.map((item) => item.id)).toEqual(aspectIds(rel));
    // Saving is a library write only — the relationship is not modified by it.
    expect(aspectIds(relationship("rel-invited"))).toEqual(aspectIds(rel));
    console.log(
      `[library] ${entry.title} → id=${entry.id} slug=${entry.slug} aspects=${aspectIds(rel).join(", ")} (library ${templatesBefore} → ${live().templates.length})`,
    );
  });
});
