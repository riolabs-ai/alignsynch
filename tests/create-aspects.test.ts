/**
 * Stage 3 — **Aspects** (#689): the list, its reorder, and what the create writes.
 *
 * The card's acceptance is behavioural — a row collapses on save, the order survives a reload, the
 * drag works on a phone — and none of those can be asserted from a markup snapshot alone. So this
 * file checks the layers that *can* be, and names what is left to the CDP proof in the PR body:
 *
 *   1. **The rules** — `aspectProblem` refuses the first blank field in the order the form asks,
 *      `moveAspect` is the whole of the drag as a pure function, and `parseAspects` refuses anything
 *      that is not the posted shape (a hand-edited request must be a code, never a throw).
 *   2. **The seeding** — `workingAspects` distinguishes "the draft has no list" (seed from the
 *      template) from "the draft's list is empty" (the person emptied it), which is the one
 *      distinction that keeps a deleted Aspect deleted.
 *   3. **The reduction** — `aspectEditsFor` carries the person's words into the create while
 *      keeping the template's ids *and order*, because the copy is compared against the version it
 *      is bound to (db:verify V4). A list entry the template does not offer is ignored; a template
 *      Aspect the list lost is written from the template.
 *   4. **The screen** — stage 3 renders as stage 3 of the rail, every row collapsed, the count, and
 *      the create behind its own control.
 *
 * What this file cannot see, and the PR body has to: that a save collapses the row it came from,
 * that the toast fired, and that a pointer drag reorders. Those are read back from the live page
 * over CDP (`collapsed rows`, `open forms`, `order by label`, and the same order after a reload).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import {
  aspectEditsFor,
  aspectProblem,
  moveAspect,
  normalizeAspect,
  parseAspects,
  type AspectDraft,
  workingAspects,
} from "@/lib/flow/aspects";
import {
  EMPTY_CREATE_DRAFT,
  parseCreateDraft,
  serializeCreateDraft,
} from "@/lib/flow/create-draft";
import {
  CREATE_INSTANCE_PATH,
  SAVE_ASPECTS_PATH,
  SAVE_MODE_PATH,
  createAspectsPath,
  createCommitPath,
  createModePath,
  createRelationshipPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

const TEMPLATE_ID = "template-relationship-basics";

/** The template's list, in the order the catalogue read offers it. */
const TEMPLATE_ASPECTS: AspectDraft[] = [
  {
    id: "aspect-trust",
    prompt: "How much do you trust each other to raise a problem early?",
    leftValue: "Not enough",
    rightValue: "Too much",
  },
  {
    id: "aspect-money",
    prompt: "How openly do you talk about money?",
    leftValue: "Never",
    rightValue: "Constantly",
  },
  {
    id: "aspect-time",
    prompt: "How do we spend time that is not about the house?",
    leftValue: "None",
    rightValue: "All of it",
  },
];

const TEMPLATE = {
  recordId: TEMPLATE_ID,
  title: "Relationship Basics",
  summary: "Three Aspects about how a working relationship feels and where it should go.",
  aspectCount: 3,
};

function stageThreeHtml(aspects: readonly AspectDraft[] = TEMPLATE_ASPECTS): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 3,
      template: TEMPLATE,
      draft: { ...EMPTY_CREATE_DRAFT, mode: "advanced", alignmentSetting: "full" },
      aspects,
      backHref: createModePath(TEMPLATE_ID),
      problem: null,
      problemLink: null,
    }),
  );
}

describe("the list's rules", () => {
  it("names the first blank field in the order the form asks", () => {
    expect(aspectProblem({ prompt: "  ", leftValue: "a", rightValue: "b" })).toBe("prompt");
    expect(aspectProblem({ prompt: "q", leftValue: "", rightValue: "b" })).toBe("left");
    expect(aspectProblem({ prompt: "q", leftValue: "a", rightValue: "   " })).toBe("right");
    expect(aspectProblem({ prompt: "q", leftValue: "a", rightValue: "b" })).toBeNull();
  });

  it("trims what was typed, and keeps the id it was given", () => {
    expect(
      normalizeAspect({
        id: "aspect-trust",
        prompt: "  How much do we trust each other?  ",
        leftValue: "  Not enough ",
        rightValue: "Too much  ",
      }),
    ).toEqual({
      id: "aspect-trust",
      prompt: "How much do we trust each other?",
      leftValue: "Not enough",
      rightValue: "Too much",
    });
  });

  it("refuses a posted list that is not the shape this stage writes", () => {
    expect(parseAspects(undefined)).toBeNull();
    expect(parseAspects({})).toBeNull();
    expect(parseAspects([{ id: "aspect-trust" }])).toBeNull();
    expect(parseAspects([{ ...TEMPLATE_ASPECTS[0], extra: "no" }])).toBeNull();
    expect(parseAspects(TEMPLATE_ASPECTS)).toEqual(TEMPLATE_ASPECTS);
    // An emptied list is a legal shape; whether a create may use it is the store's rule, not this
    // parser's.
    expect(parseAspects([])).toEqual([]);
  });
});

describe("the drag, as a pure function", () => {
  it("moves a row down and up by index, keeping every row", () => {
    const down = moveAspect(TEMPLATE_ASPECTS, "aspect-trust", 2);
    expect(down.map((row) => row.id)).toEqual(["aspect-money", "aspect-time", "aspect-trust"]);

    const up = moveAspect(TEMPLATE_ASPECTS, "aspect-time", 0);
    expect(up.map((row) => row.id)).toEqual(["aspect-time", "aspect-trust", "aspect-money"]);
  });

  it("clamps an index past the end instead of dropping the row", () => {
    const clamped = moveAspect(TEMPLATE_ASPECTS, "aspect-trust", 99);
    expect(clamped.map((row) => row.id)).toEqual(["aspect-money", "aspect-time", "aspect-trust"]);
    expect(moveAspect(TEMPLATE_ASPECTS, "aspect-trust", -4).map((row) => row.id)).toEqual([
      "aspect-trust",
      "aspect-money",
      "aspect-time",
    ]);
  });

  it("is a no-op for an id the list does not hold, and for a move onto itself", () => {
    expect(moveAspect(TEMPLATE_ASPECTS, "aspect-nope", 0)).toEqual(TEMPLATE_ASPECTS);
    expect(moveAspect(TEMPLATE_ASPECTS, "aspect-money", 1)).toEqual(TEMPLATE_ASPECTS);
  });
});

describe("what the draft holds, and what the create writes", () => {
  it("seeds from the template when the draft has no list, and trusts an emptied one", () => {
    expect(workingAspects(undefined, TEMPLATE_ASPECTS)).toEqual(TEMPLATE_ASPECTS);
    expect(workingAspects([], TEMPLATE_ASPECTS)).toEqual([]);
    expect(workingAspects([TEMPLATE_ASPECTS[1]], TEMPLATE_ASPECTS)).toEqual([TEMPLATE_ASPECTS[1]]);
  });

  it("carries the person's words, and keeps the template's ids and order", () => {
    const reworded = moveAspect(TEMPLATE_ASPECTS, "aspect-time", 0).map((row) =>
      row.id === "aspect-trust"
        ? { ...row, prompt: "Do we say the hard thing early?", leftValue: "Rarely" }
        : row,
    );
    const written = aspectEditsFor(reworded, TEMPLATE_ASPECTS);

    // The order the person dragged is a draft fact; the copy keeps the version's order.
    expect(written.map((row) => row.id)).toEqual(TEMPLATE_ASPECTS.map((row) => row.id));
    // The words are theirs.
    expect(written[0]?.prompt).toBe("Do we say the hard thing early?");
    expect(written[0]?.leftValue).toBe("Rarely");
    expect(written[0]?.rightValue).toBe("Too much");
    // Untouched rows are the template's, character for character.
    expect(written[1]).toEqual(TEMPLATE_ASPECTS[1]);
  });

  it("never invents a row and never deletes one", () => {
    const withExtra = [...TEMPLATE_ASPECTS, { ...TEMPLATE_ASPECTS[0], id: "aspect-mine" }];
    expect(aspectEditsFor(withExtra, TEMPLATE_ASPECTS).map((row) => row.id)).toEqual(
      TEMPLATE_ASPECTS.map((row) => row.id),
    );

    const missingOne = TEMPLATE_ASPECTS.filter((row) => row.id !== "aspect-money");
    const written = aspectEditsFor(missingOne, TEMPLATE_ASPECTS);
    expect(written.map((row) => row.id)).toEqual(TEMPLATE_ASPECTS.map((row) => row.id));
    expect(written[1]).toEqual(TEMPLATE_ASPECTS[1]);
  });

  it("falls back to the template's words for a value the person blanked", () => {
    const blanked = TEMPLATE_ASPECTS.map((row) =>
      row.id === "aspect-money" ? { ...row, prompt: "   " } : row,
    );
    expect(aspectEditsFor(blanked, TEMPLATE_ASPECTS)[1]).toEqual(TEMPLATE_ASPECTS[1]);
  });
});

describe("the draft object carries the list", () => {
  it("round-trips a list through the cookie codec", () => {
    const draft = {
      ...EMPTY_CREATE_DRAFT,
      mode: "advanced",
      alignmentSetting: "full",
      aspects: TEMPLATE_ASPECTS,
    };
    expect(parseCreateDraft(serializeCreateDraft(draft))).toEqual(draft);
  });

  it("reads a draft written before stage 3 existed — the list is simply absent", () => {
    // The upgrade path: a cookie from #688 has no `aspects` key, and must still open stage 3 with
    // the template's list rather than being thrown away.
    const old = Buffer.from(
      JSON.stringify({
        initiatorName: "Avery",
        counterpartyName: "Rowan",
        email: "rowan@example.com",
        title: "Our house",
        description: "",
        mode: "basic",
        alignmentSetting: "soft",
      }),
      "utf8",
    ).toString("base64url");
    const parsed = parseCreateDraft(old);
    expect(parsed?.aspects).toBeUndefined();
    expect(parsed?.title).toBe("Our house");
  });
});

describe("the screen", () => {
  it("renders as stage 3 of the rail, with the mode screen behind it", () => {
    const html = stageThreeHtml();
    expect(html).toContain('data-wizard-rail="3"');
    expect(html).toContain("Stage 3 of 6");
    expect(html).toContain(`href="${createModePath(TEMPLATE_ID)}"`);
    expect(html).toContain(itemLabel(sectionOf(assessmentCreatePageCopy, "aspects"), "back"));
  });

  it("renders every saved Aspect collapsed, one row each", () => {
    const html = stageThreeHtml();
    const rows = html.match(/data-aspect-row="[^"]+"/g) ?? [];
    expect(rows).toHaveLength(TEMPLATE_ASPECTS.length);
    // Collapsed: not one open form on arrival, and one `data-aspect-open="false"` per row.
    expect(html).not.toContain("data-aspect-form=");
    expect((html.match(/data-aspect-open="false"/g) ?? []).length).toBeGreaterThanOrEqual(
      TEMPLATE_ASPECTS.length,
    );
    // Each row prints its own question and both opinion labels — the list's data, not copy.
    for (const aspect of TEMPLATE_ASPECTS) {
      expect(html).toContain(aspect.prompt);
      expect(html).toContain(aspect.leftValue);
      expect(html).toContain(aspect.rightValue);
    }
    expect(html).toContain(
      fillLabel(itemLabel(sectionOf(assessmentCreatePageCopy, "aspects"), "count"), {
        count: TEMPLATE_ASPECTS.length,
      }),
    );
  });

  it("hands the create to stage 4 instead of holding it (#690)", () => {
    const html = stageThreeHtml();
    expect(html).toContain(`href="${createCommitPath(TEMPLATE_ID)}"`);
    expect(html).toContain('data-create-next="commit"');
    expect(html).not.toContain(`action="${CREATE_INSTANCE_PATH}"`);
    // The two save endpoints are reachable from this screen and nowhere else in the flow.
    expect(SAVE_MODE_PATH).toBe(`${CREATE_INSTANCE_PATH}/mode`);
    expect(SAVE_ASPECTS_PATH).toBe(`${CREATE_INSTANCE_PATH}/aspects`);
  });

  it("draws the refusal band when the create refused, and keeps the list under it", () => {
    const sentence = itemLabel(
      sectionOf(assessmentCreatePageCopy, "problems"),
      "relationship-limit",
    );
    const html = renderToStaticMarkup(
      createElement(CreateRelationship, {
        copy: assessmentCreatePageCopy,
        stage: 3,
        template: TEMPLATE,
        draft: { ...EMPTY_CREATE_DRAFT, mode: "basic", alignmentSetting: "soft" },
        aspects: TEMPLATE_ASPECTS,
        backHref: createModePath(TEMPLATE_ID),
        problem: sentence,
        problemLink: null,
      }),
    );
    expect(html).toContain('data-create-problem="true"');
    expect(html).toContain(sentence);
    expect(html).toContain('data-aspect-list="true"');
  });
});

describe("the three stages are three addresses", () => {
  it("stage 3 is stage 1's path plus one segment, beside stage 2", () => {
    expect(createAspectsPath(TEMPLATE_ID)).toBe(`${createRelationshipPath(TEMPLATE_ID)}/aspects`);
    expect(createAspectsPath(TEMPLATE_ID)).not.toBe(createModePath(TEMPLATE_ID));
  });
});
