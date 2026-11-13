/**
 * #623 — the edit panel **renders**, which is the one half of this card no other test touched.
 *
 * `tests/relationship-edit.test.ts` prices a change and `tests/relationship-edit-live.test.ts` writes
 * one against real Postgres; both call the domain. Neither mounts the component, so a `copy` section
 * that lost an item id, a `state` field renamed, or a hook that reads `window` would have shipped a
 * route that 500s for the initiator while `typecheck`, `build` and the suite stayed green — `tsc`
 * only proves a component compiles, never that it draws.
 *
 * `renderToStaticMarkup` and not jsdom, the same choice `tests/admin-relationship-operations.test.tsx`
 * makes: the initial render is the whole claim here (which controls exist, what is disabled, what the
 * form is seeded with), and the two buttons are server actions the first paint cannot click.
 *
 * The claims:
 *
 *   the seed        the form opens on the relationship's own title and summary — an edit surface
 *                   that starts blank would be a second creation form.
 *   no Aspects      **the panel draws no Aspect row, no aspect form and no add/remove control**
 *                   (#935), **and it posts no Aspect list either** (#943). The detail screen's
 *                   `AspectList` is the one writer: it has the drag, the in-place editor and its
 *                   own save, so a second stack of forms here printed the same questions twice.
 *                   `state.aspects` is not drawn and not sent back — an omitted list is the
 *                   server's "leave the stored rows alone", and a posted snapshot of the rows the
 *                   page read was what undid a drag made in the same session. That half is proven
 *                   at the writer in `tests/relationship-edit-reorder-race.test.ts`.
 *   the gate        **Save is disabled until a preview has run.** This is the owner's decision on
 *                   #623 stated as markup: no cost has been shown, so no write is on offer.
 *   the lock        `mode`/`setting` are printed, never offered, and say why — a control the server
 *                   would refuse (db:verify V18) is the disabled button #533's card exists to prevent.
 *   the claim       an unclaimed seat's name and address are editable; a claimed one's are not.
 *   the pin         the version select exists only when there is more than one version to move to.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RelationshipEditPanel } from "@/components/relationship/relationship-edit-panel";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import type { RelationshipEditState } from "@/lib/relationship/edit-view";

const RECORD = assessments[0];
if (RECORD === undefined) throw new Error("data/assessments is empty — this fixture needs one");

const editCopy = sectionOf(dashboardRelationshipDetailPageCopy, "edit");
const saveLabel = itemLabel(editCopy, "save");

function state(overrides: Partial<RelationshipEditState> = {}): RelationshipEditState {
  return {
    relationshipId: "rel-1",
    status: "published",
    closed: false,
    record: RECORD,
    title: "The edited title",
    summary: "The edited summary",
    mode: "basic",
    setting: "soft",
    aspects: [
      { id: "aspect-1", prompt: "Which is truer", leftValue: "This", rightValue: "That" },
      { id: "aspect-2", prompt: "Which is clearer", leftValue: "Here", rightValue: "There" },
    ],
    versions: [
      { id: "version-1", version: 1, publishedAt: "2026-10-01", current: true },
      { id: "version-2", version: 2, publishedAt: "2026-10-20", current: false },
    ],
    versionId: "version-1",
    invite: {
      name: "Avery Rowan",
      email: "avery@example.com",
      claimed: false,
      expiresAt: "2026-11-14",
      daysLeft: 7,
    },
    answers: [],
    sessionExists: true,
    ...overrides,
  };
}

/** The handlers are never called by a first paint; a never-resolving promise says so in the type. */
const never = () => new Promise<never>(() => {});

function render(editState: RelationshipEditState): string {
  return renderToStaticMarkup(
    createElement(RelationshipEditPanel, {
      copy: dashboardRelationshipDetailPageCopy,
      state: editState,
      onPreview: vi.fn(never),
      onEdit: vi.fn(never),
    }),
  );
}

/** The markup of the one `<button>` whose text is `label` — `null` when no button carries it. */
function buttonWith(markup: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<button[^>]*>(?:(?!</button>).)*${escaped}`).exec(markup)?.[0] ?? null;
}

/** The one `<input>` carrying this id. Matched on the attribute, never on `Button`'s class names. */
function inputWith(markup: string, id: string): string | null {
  return new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(markup)?.[0] ?? null;
}

/** `disabled` as an *attribute* — the kit's class list also contains `disabled:opacity-50`. */
function isDisabled(tag: string | null): boolean {
  return tag !== null && /\sdisabled(=|\s|>)/.test(tag);
}

describe("the relationship edit panel renders the state it is handed", () => {
  it("seeds the form from the relationship, not from blanks", () => {
    const markup = render(state());

    expect(markup).toContain('value="The edited title"');
    expect(markup).toContain("The edited summary");
  });

  it("draws no Aspect surface at all — the detail's drag list is the only one (#935)", () => {
    const markup = render(state());

    // The block #935 removed: the label, the `<ul data-edit-aspects>`, every per-row form and the
    // add/remove pair. Their absence is the claim — a second copy of the same five questions is
    // what the owner read off the running screen.
    expect(markup).not.toContain("data-edit-aspects");
    expect(markup.match(/id="edit-(prompt|left|right)-\d+"/g)).toBeNull();
    // "Aspects" legitimately appears in the pin and window help sentences; the *control* is the
    // claim, so the add button's own words are what must be gone.
    expect(markup).not.toContain(`>${itemLabel(editCopy, "add")}<`);

    // Neither do the Aspects' own words appear: the panel is handed `state.aspects` to post back
    // unchanged, never to draw.
    expect(markup).not.toContain("Which is truer");
    expect(markup).not.toContain("Which is clearer");
  });

  it("does not offer a save before a preview has priced the change", () => {
    const markup = render(state());

    const save = buttonWith(markup, saveLabel);
    expect(save).not.toBeNull();
    expect(save).toContain('disabled=""');
    // The preview itself is available — the step that unlocks the save is the one on offer.
    expect(isDisabled(buttonWith(markup, itemLabel(editCopy, "preview")))).toBe(false);
  });

  it("prints mode and Setting as fixed facts, with the reason they cannot be edited", () => {
    const markup = render(state({ mode: "advanced", setting: "full", sessionExists: true }));

    expect(markup).toContain('data-relationship-mode="advanced"');
    expect(markup).toContain('data-relationship-setting="full"');
    expect(markup).toContain("data-edit-locked");
    expect(markup).not.toContain('name="mode"');
  });

  it("keeps the reason off the sheet when no session exists yet", () => {
    const markup = render(state({ sessionExists: false }));

    // The scene is a draft: publishing is still where mode/setting get chosen, so the lock note
    // would be a claim about a row that does not exist.
    expect(markup).not.toContain("data-edit-locked");
  });

  it("lets an unclaimed seat's name, address and window move; a claimed one's do not", () => {
    const open = render(state());
    expect(inputWith(open, "edit-invitee")).toContain('value="Avery Rowan"');
    expect(inputWith(open, "edit-invitee-email")).toContain('value="avery@example.com"');
    expect(isDisabled(inputWith(open, "edit-invitee"))).toBe(false);
    expect(isDisabled(inputWith(open, "edit-window"))).toBe(false);

    const claimed = render(
      state({
        invite: {
          name: "Avery Rowan",
          email: "avery@example.com",
          claimed: true,
          expiresAt: "2026-11-14",
          daysLeft: 7,
        },
      }),
    );
    // The inputs keep their values — an operator still needs to read who they are — but refuse a write.
    expect(inputWith(claimed, "edit-invitee")).toContain('value="Avery Rowan"');
    expect(isDisabled(inputWith(claimed, "edit-invitee"))).toBe(true);
    expect(isDisabled(inputWith(claimed, "edit-invitee-email"))).toBe(true);
    expect(isDisabled(inputWith(claimed, "edit-window"))).toBe(true);
  });

  it("offers the version pin only when there is somewhere to move it", () => {
    expect(render(state())).toContain('id="edit-pin"');

    const oneVersion = render(
      state({
        versions: [{ id: "version-1", version: 1, publishedAt: "2026-10-01", current: true }],
      }),
    );
    expect(oneVersion).not.toContain('id="edit-pin"');
  });

  it("says which version the relationship was answered under, pin control or not (#711)", () => {
    // Two versions, bound to v1: the panel names v1 even though v2 is the live template — the whole
    // protection a revision flow offers is that publishing v2 does not move this number.
    const markup = render(state());
    expect(markup).toContain('data-relationship-version="1"');
    expect(markup).toContain(itemLabel(editCopy, "version").replace("{version}", "1"));

    // A single version draws no pin control, and the sentence is still there: it is a fact about the
    // row, not a control's caption.
    const oneVersion = render(
      state({
        versions: [{ id: "version-1", version: 1, publishedAt: "2026-10-01", current: true }],
        versionId: "version-1",
      }),
    );
    expect(oneVersion).not.toContain('id="edit-pin"');
    expect(oneVersion).toContain('data-relationship-version="1"');
  });

  it("says so plainly when no published version is bound (#711)", () => {
    const markup = render(state({ versions: [], versionId: null }));

    expect(markup).toContain('data-relationship-version="none"');
    expect(markup).toContain(itemLabel(editCopy, "version-none"));
  });

  it("renders no cost list and no confirm until the preview has answered", () => {
    const markup = render(state());

    // The invalidation is a step, not a toast: nothing is printed and nothing is confirmable before
    // the server has counted what the change would strand.
    expect(markup).not.toContain("data-edit-costs");
    expect(markup).not.toContain('type="checkbox"');
  });
});
