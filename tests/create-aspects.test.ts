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
 *   3. **The write** — `aspectsToWrite` answers which of two things the create writes (#699): a
 *      list that only rewords the version's Aspects stays the version's copy (its ids and order,
 *      compared by V4), and a list that added, removed or reordered one is written as the creator
 *      left it, with an id minted for each added row and `aspects_authored_at` recorded. Neither
 *      branch drops a row silently, and an emptied list is refused rather than written.
 *   4. **The screen** — stage 3 renders as stage 3 of the rail, every row collapsed, the count, and
 *      the create behind its own control.
 *
 * What this file cannot see, and the PR body has to: that a save collapses the row it came from,
 * that the toast fired, and that a pointer drag reorders. Those are read back from the live page
 * over CDP (`collapsed rows`, `open forms`, `order by label`, and the same order after a reload).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import {
  aspectEditsFor,
  aspectProblem,
  aspectWriteProblem,
  aspectsAreAuthored,
  aspectsToWrite,
  canRemoveAspect,
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

/**
 * #709 — every stage renders inside `StageShell`, whose only Next dependency is `useRouter`.
 * No render in this file navigates: the stub keeps a render a render.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

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
  slug: "relationship-basics",
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

  it("the copy branch keeps the version's ids and order, and carries the person's words", () => {
    const reworded = moveAspect(TEMPLATE_ASPECTS, "aspect-time", 0).map((row) =>
      row.id === "aspect-trust"
        ? { ...row, prompt: "Do we say the hard thing early?", leftValue: "Rarely" }
        : row,
    );
    const written = aspectEditsFor(reworded, TEMPLATE_ASPECTS);

    // The reduction itself is the copy's rule: the version's ids, in the version's order.
    expect(written.map((row) => row.id)).toEqual(TEMPLATE_ASPECTS.map((row) => row.id));
    // The words are theirs.
    expect(written[0]?.prompt).toBe("Do we say the hard thing early?");
    expect(written[0]?.leftValue).toBe("Rarely");
    expect(written[0]?.rightValue).toBe("Too much");
    // Untouched rows are the template's, character for character.
    expect(written[1]).toEqual(TEMPLATE_ASPECTS[1]);
  });

  it("falls back to the template's words for a value the person blanked", () => {
    const blanked = TEMPLATE_ASPECTS.map((row) =>
      row.id === "aspect-money" ? { ...row, prompt: "   " } : row,
    );
    expect(aspectEditsFor(blanked, TEMPLATE_ASPECTS)[1]).toEqual(TEMPLATE_ASPECTS[1]);
  });
});

/** A minter a test can name: the create mints `aspect-<uuid>` in production, one per added row. */
function namedMinter(): () => string {
  let minted = 0;
  return () => `aspect-minted-${++minted}`;
}

/**
 * **Two answers, not one** (#699).
 *
 * The card's defect is that `aspectEditsFor` used to be *the* write: an added Aspect was dropped
 * and a removed one was restored, silently, while the stage's own copy promised "…and add one".
 * `aspectsToWrite` asks which list this is — a copy, or the creator's own — and writes that one.
 */
describe("which list the create writes (#699)", () => {
  it("a reworded list is still a copy: the version's ids and order", () => {
    const reworded = TEMPLATE_ASPECTS.map((row) =>
      row.id === "aspect-trust" ? { ...row, prompt: "Say the hard thing early?" } : row,
    );

    expect(aspectsAreAuthored(reworded, TEMPLATE_ASPECTS)).toBe(false);
    const write = aspectsToWrite(reworded, TEMPLATE_ASPECTS, namedMinter());
    expect(write.authored).toBe(false);
    expect(write.aspects.map((row) => row.id)).toEqual(TEMPLATE_ASPECTS.map((row) => row.id));
    expect(write.aspects[0]?.prompt).toBe("Say the hard thing early?");
  });

  it("an added Aspect is written, in the person's order, with an id of its own", () => {
    const added: AspectDraft = {
      id: "new-1",
      prompt: "How often do you say thank you?",
      leftValue: "Never",
      rightValue: "Daily",
    };
    const draft = [TEMPLATE_ASPECTS[0], added, TEMPLATE_ASPECTS[1], TEMPLATE_ASPECTS[2]];

    expect(aspectsAreAuthored(draft, TEMPLATE_ASPECTS)).toBe(true);
    const write = aspectsToWrite(draft, TEMPLATE_ASPECTS, namedMinter());
    expect(write.authored).toBe(true);
    expect(write.aspects.map((row) => row.id)).toEqual([
      "aspect-trust",
      "aspect-minted-1",
      "aspect-money",
      "aspect-time",
    ]);
    expect(write.aspects[1]?.prompt).toBe("How often do you say thank you?");
    expect(aspectWriteProblem(write.aspects)).toBeNull();
  });

  it("a removed Aspect stays removed, and the kept ids travel", () => {
    const draft = TEMPLATE_ASPECTS.filter((row) => row.id !== "aspect-money");

    const write = aspectsToWrite(draft, TEMPLATE_ASPECTS, namedMinter());
    expect(write.authored).toBe(true);
    expect(write.aspects.map((row) => row.id)).toEqual(["aspect-trust", "aspect-time"]);
    expect(aspectWriteProblem(write.aspects)).toBeNull();
  });

  it("a dragged list keeps the order it was dragged into", () => {
    const dragged = moveAspect(TEMPLATE_ASPECTS, "aspect-time", 0);

    const write = aspectsToWrite(dragged, TEMPLATE_ASPECTS, namedMinter());
    expect(write.authored).toBe(true);
    expect(write.aspects.map((row) => row.id)).toEqual([
      "aspect-time",
      "aspect-trust",
      "aspect-money",
    ]);
  });

  it("a blank field on a kept row falls back to the version's, so a reword never empties a row", () => {
    const draft = TEMPLATE_ASPECTS.map((row) =>
      row.id === "aspect-money" ? { ...row, rightValue: "  " } : row,
    );

    const write = aspectsToWrite(draft, TEMPLATE_ASPECTS, namedMinter());
    expect(write.aspects[1]).toEqual(TEMPLATE_ASPECTS[1]);
  });

  it("refuses a blank Aspect the person added instead of inventing its question", () => {
    const draft = [
      ...TEMPLATE_ASPECTS,
      { id: "new-1", prompt: "   ", leftValue: "Never", rightValue: "Daily" },
    ];
    expect(aspectWriteProblem(draft)).toBe("blank");
  });

  it("refuses a repeated id", () => {
    const draft = [...TEMPLATE_ASPECTS, { ...TEMPLATE_ASPECTS[0] }];
    expect(aspectWriteProblem(draft)).toBe("duplicate");
  });

  it("refuses removing the last Aspect — a relationship asks at least one", () => {
    // The flow's own state at the floor: one row, and the control that would empty it is refused.
    expect(canRemoveAspect(1)).toBe(false);
    expect(canRemoveAspect(2)).toBe(true);
    // And the create refuses an emptied list rather than writing an instance `zAssessmentInstance`
    // cannot parse (`items` is `.min(1)`).
    expect(aspectWriteProblem([])).toBe("none");
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
    // The upgrade path: a cookie written before the Aspects stage has no `aspects` key, and must
    // still open stage 3 with the template's list rather than being thrown away.
    const old = Buffer.from(
      JSON.stringify({
        initiatorFirst: "Avery",
        initiatorLast: "Quinn",
        counterpartyFirst: "Rowan",
        counterpartyLast: "",
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
    expect(html).toContain("Stage 3 of 5");
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
    expect(html).toContain(`href="${createCommitPath(TEMPLATE.slug)}"`);
    expect(html).toContain('data-create-next="account"');
    expect(html).not.toContain(`action="${CREATE_INSTANCE_PATH}"`);
    // The two save endpoints are reachable from this screen and nowhere else in the flow.
    expect(SAVE_MODE_PATH).toBe(`${CREATE_INSTANCE_PATH}/mode`);
    expect(SAVE_ASPECTS_PATH).toBe(`${CREATE_INSTANCE_PATH}/aspects`);
  });

  it("draws the add and remove controls at stage 3 (#699)", () => {
    const html = stageThreeHtml();
    // The stage's own copy has promised "…and add one" since #689; these are the controls that make
    // it true, on every row plus the list's own add.
    expect(html).toContain('data-aspect-add="true"');
    expect((html.match(/data-aspect-remove=/g) ?? []).length).toBe(TEMPLATE_ASPECTS.length);
    // Three rows is above the floor, so nothing refuses a removal and no floor sentence is drawn.
    expect(html).not.toContain("data-aspect-floor");
  });

  it("refuses removing the last Aspect, and says why (#699)", () => {
    const html = stageThreeHtml([
      TEMPLATE_ASPECTS[0] ?? { id: "x", prompt: "", leftValue: "", rightValue: "" },
    ]);

    expect(html).toContain('data-aspect-floor="true"');
    expect(html).toContain(itemLabel(sectionOf(assessmentCreatePageCopy, "aspects"), "last"));
    const removeTag = html.slice(html.indexOf("data-aspect-remove="));
    expect(removeTag.slice(0, removeTag.indexOf(">"))).toContain("disabled");
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
