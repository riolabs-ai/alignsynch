/**
 * The record model — one record type, two templates (issue #128).
 *
 * The positive cases are the two fixtures: a quiz (`data/currentQuiz.ts`, projected
 * through `quizAsTemplate`) and an assessment (`data/assessments.ts`). Both must
 * validate against the shared record in `content/record.ts`, and neither template may
 * import the other to get there.
 *
 * The Gap case is the one the card asks for by name: two parties with different
 * Opinions, one Aspect, and the Gap asserted from `gapOf()` — no field stores it, and
 * the negative case proves a `gap` key is rejected rather than merely unwritten.
 *
 * Every other case is a violation of the shape, because a schema nobody can violate in
 * a test is a comment.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ADVANCED_OPINION_KINDS,
  BASIC_OPINION_KINDS,
  OPINION_KINDS,
  instanceTemplateProblems,
  opinionKindsOf,
  zAssessment,
  zAssessmentInstance,
  zOpinions,
  type Assessment,
  type AssessmentInstance,
  type Party,
} from "../../content/assessment";
import {
  MAX_GAP,
  SCORE_MAX,
  SCORE_MIN,
  gapOf,
  isResponseOn,
  templateProblems,
  zItem,
  zRecord,
  zResponse,
  type OptionScale,
  type ScoreScale,
} from "../../content/record";
import { quizAsTemplate, zQuiz } from "../../content/quiz";
import { assessmentInstances, assessments } from "../../data/assessments";
import { currentQuiz } from "../../data/currentQuiz";

const assessment = assessments[0] as Assessment;
const instance = assessmentInstances[0] as AssessmentInstance;

/** The party's opinions on one Aspect. */
const opinionsOn = (party: Party, itemId: string) => {
  const entry = party.opinions.find((row) => row.itemId === itemId);
  assert.ok(entry, `${party.name} answers ${itemId}`);
  return entry.opinions;
};

/* ================================================================== *
 * One record — both templates validate against it
 * ================================================================== */

describe("the record — a quiz and an assessment are both records", () => {
  it("validates the quiz fixture against the shared record", () => {
    const quiz = zQuiz.parse(currentQuiz);
    const template = quizAsTemplate(quiz);

    assert.equal(template.type, "quiz");
    assert.equal(template.items.length, quiz.questions.length);
    assert.deepEqual(templateProblems(template), [], "the quiz fixture is a record");

    // The record half validates on its own, and it is exactly the record's fields.
    const { id, slug, type, status, date, title, summary } = template;
    const record = { id, slug, type, status, date, title, summary };
    assert.equal(zRecord.safeParse(record).success, true);
    assert.equal(record.type, "quiz");
    assert.equal(record.date, quiz.publishedAt ?? quiz.createdAt);
  });

  it("validates the assessment fixture against the same record", () => {
    assert.deepEqual(zAssessment.safeParse(assessment).success, true);
    assert.deepEqual(templateProblems(assessment), [], "the assessment fixture is a record");

    // A template holds items and has NO parties — `strict()` is what enforces it.
    assert.equal("parties" in assessment, false);
    assert.equal(zAssessment.safeParse({ ...assessment, parties: [] }).success, false);
  });

  it("keeps each template's own fields out of the record", () => {
    // A question's answer key is a question's, not the record's (rule D4 stays put).
    const questionItem = quizAsTemplate(zQuiz.parse(currentQuiz)).items[0];
    assert.equal(questionItem && "correctOptionId" in questionItem, false);
    assert.equal(questionItem && "options" in questionItem, false);
    // An Aspect's two Values are the assessment's, and a question has neither.
    assert.equal("leftValue" in assessment.items[0], true);
    assert.equal("correctOptionId" in assessment.items[0], false);
  });

  it("rejects a record whose type is not one of the three short values", () => {
    const template = quizAsTemplate(zQuiz.parse(currentQuiz));
    const { id, slug, type, status, date, title, summary } = template;
    const record = { id, slug, type, status, date, title, summary };
    assert.equal(zRecord.safeParse({ ...record, type: "poll" }).success, false);
    assert.equal(zRecord.safeParse({ ...record, type: "quiz" }).success, true);
  });

  it("rejects a template with a duplicate item id", () => {
    const item = assessment.items[0];
    assert.ok(item);
    const doubled = { ...assessment, items: [item, { ...item, prompt: "Again" }] };
    const problems = templateProblems(doubled);
    assert.equal(problems.length, 1);
    assert.match(problems[0]?.message ?? "", /duplicate item id/);
  });
});

/* ================================================================== *
 * Items, scales and responses
 * ================================================================== */

describe("an item carries a scale, and a response is a value on it", () => {
  const optionScale: OptionScale = {
    kind: "options",
    options: [
      { id: "a", text: "Left" },
      { id: "b", text: "Right" },
    ],
  };
  const scoreScale: ScoreScale = { kind: "score", min: SCORE_MIN, max: SCORE_MAX };

  it("reads a response against the scale it answers", () => {
    assert.equal(isResponseOn(optionScale, "b"), true);
    assert.equal(isResponseOn(optionScale, "c"), false);
    assert.equal(isResponseOn(optionScale, 3), false);
    assert.equal(isResponseOn(scoreScale, 1), true);
    assert.equal(isResponseOn(scoreScale, 5), true);
    assert.equal(isResponseOn(scoreScale, 6), false);
    assert.equal(isResponseOn(scoreScale, 3.5), false, "a score is a whole number");
    assert.equal(isResponseOn(scoreScale, "a"), false);
  });

  it("keeps the assessment's scale fixed at 1..5", () => {
    const item = assessment.items[0];
    assert.ok(item);
    assert.deepEqual(item.scale, { kind: "score", min: 1, max: 5 });
    assert.equal(
      zAssessment.safeParse({
        ...assessment,
        items: [{ ...item, scale: { kind: "score", min: 1, max: 7 } }],
      }).success,
      false,
    );
    assert.equal(
      zAssessment.safeParse({
        ...assessment,
        items: [
          {
            ...item,
            scale: {
              kind: "options",
              options: [
                { id: "a", text: "x" },
                { id: "b", text: "y" },
              ],
            },
          },
        ],
      }).success,
      false,
    );
  });

  it("requires both named ends of an Aspect", () => {
    const item = assessment.items[0];
    assert.ok(item);
    const withoutLeft = {
      id: item.id,
      prompt: item.prompt,
      scale: item.scale,
      rightValue: item.rightValue,
    };
    assert.equal(zAssessment.safeParse({ ...assessment, items: [withoutLeft] }).success, false);
    const withoutRight = {
      id: item.id,
      prompt: item.prompt,
      scale: item.scale,
      leftValue: item.leftValue,
    };
    assert.equal(zAssessment.safeParse({ ...assessment, items: [withoutRight] }).success, false);
  });

  it("rejects a response that is neither an option id nor a score", () => {
    assert.equal(zResponse.safeParse("a").success, true);
    assert.equal(zResponse.safeParse(3).success, true);
    assert.equal(zResponse.safeParse(0).success, false);
    assert.equal(zResponse.safeParse("Not An Id").success, false);
    assert.equal(zItem.safeParse({ id: "item-1", prompt: "x", scale: scoreScale }).success, true);
  });
});

/* ================================================================== *
 * Opinions — two to four per Aspect per party
 * ================================================================== */

describe("opinions — Basic is Feel and Wish, Advanced adds Think and Guess", () => {
  it("answers every Aspect of the instance, two to four opinions each", () => {
    assert.equal(zAssessmentInstance.safeParse(instance).success, true);
    assert.equal(instance.parties.length, 2);

    const counts = instance.parties.flatMap((party) =>
      party.opinions.map((row) => opinionKindsOf(row.opinions).length),
    );
    assert.ok(counts.length > 0);
    assert.equal(
      counts.every((count) => count >= BASIC_OPINION_KINDS.length && count <= OPINION_KINDS.length),
      true,
      `every party answers 2..4 opinions per Aspect (got ${counts.join(", ")})`,
    );
    // Both modes are exercised: the fixture is not all-Basic or all-Advanced.
    assert.equal(counts.includes(BASIC_OPINION_KINDS.length), true);
    assert.equal(counts.includes(OPINION_KINDS.length), true);
  });

  it("names the Basic opinions in the glossary's order", () => {
    const basic = opinionsOn(instance.parties[0] as Party, "aspect-housework");
    assert.deepEqual(opinionKindsOf(basic), [...BASIC_OPINION_KINDS]);
    assert.equal(basic.think, undefined);
    assert.equal(basic.guess, undefined);
  });

  it("adds Think and Guess as a pair, never one alone", () => {
    const advanced = opinionsOn(instance.parties[0] as Party, "aspect-time-together");
    assert.deepEqual(opinionKindsOf(advanced), [...BASIC_OPINION_KINDS, ...ADVANCED_OPINION_KINDS]);

    assert.equal(zOpinions.safeParse({ feel: 3, wish: 4, think: 2 }).success, false);
    assert.equal(zOpinions.safeParse({ feel: 3, wish: 4, guess: 2 }).success, false);
    assert.equal(zOpinions.safeParse({ feel: 3, wish: 4, think: 2, guess: 5 }).success, true);
  });

  it("requires Feel and Wish — Basic is the floor", () => {
    assert.equal(zOpinions.safeParse({ feel: 3, wish: 4 }).success, true);
    assert.equal(zOpinions.safeParse({ feel: 3 }).success, false);
    assert.equal(zOpinions.safeParse({ wish: 4 }).success, false);
    assert.equal(
      zOpinions.safeParse({ feel: 3, wish: 4, think: 2, guess: 5, doubt: 1 }).success,
      false,
    );
  });

  it("rejects a score outside 1..5", () => {
    for (const bad of [0, 6, 2.5, -1]) {
      assert.equal(
        zOpinions.safeParse({ feel: bad, wish: 3 }).success,
        false,
        `feel ${bad} is not a score`,
      );
    }
  });

  it("rejects two parties of the same role, and a party with one answer", () => {
    const [initiator, counterparty] = instance.parties;
    assert.ok(initiator && counterparty);
    const twoInitiators = {
      ...instance,
      parties: [initiator, { ...counterparty, role: initiator.role }] as const,
    };
    assert.equal(zAssessmentInstance.safeParse(twoInitiators).success, false);

    const oneParty = { ...instance, parties: [initiator] };
    assert.equal(zAssessmentInstance.safeParse(oneParty).success, false);
  });

  it("rejects a party that answers an Aspect the instance does not hold", () => {
    const [initiator, counterparty] = instance.parties;
    assert.ok(initiator && counterparty);
    const unknown = {
      ...instance,
      parties: [
        {
          ...initiator,
          opinions: [
            ...initiator.opinions,
            { itemId: "aspect-not-here", opinions: { feel: 3, wish: 3 } },
          ],
        },
        counterparty,
      ],
    };
    assert.equal(zAssessmentInstance.safeParse(unknown).success, false);
  });

  it("rejects a party that leaves an Aspect unanswered", () => {
    const [initiator, counterparty] = instance.parties;
    assert.ok(initiator && counterparty);
    const short = {
      ...instance,
      parties: [{ ...initiator, opinions: initiator.opinions.slice(1) }, counterparty],
    };
    assert.equal(zAssessmentInstance.safeParse(short).success, false);
  });
});

/* ================================================================== *
 * The Gap — a function over two opinions
 * ================================================================== */

describe("the gap — a difference of Opinion, computed and never stored", () => {
  it("reads two parties' different opinions as a Gap of 3", () => {
    const initiator = instance.parties[0] as Party;
    const counterparty = instance.parties[1] as Party;
    const aspectId = "aspect-time-together";

    const mine = opinionsOn(initiator, aspectId).feel;
    const theirs = opinionsOn(counterparty, aspectId).feel;

    // The two parties disagree on the same Aspect: this is the case the card names.
    assert.notEqual(mine, theirs);
    assert.equal(mine, 2);
    assert.equal(theirs, 5);
    assert.equal(gapOf(mine, theirs), 3);
    assert.equal(gapOf(theirs, mine), 3, "a Gap has no direction");
  });

  it("is 0 when the two opinions agree — the glossary's In Synch", () => {
    const initiator = instance.parties[0] as Party;
    const counterparty = instance.parties[1] as Party;

    // Both parties Feel 4 about money: In Synch, the green check, no Gap.
    assert.equal(
      gapOf(
        opinionsOn(initiator, "aspect-money").feel,
        opinionsOn(counterparty, "aspect-money").feel,
      ),
      0,
    );
    // One point apart on affection: a Small Gap is still a Gap.
    assert.equal(
      gapOf(
        opinionsOn(initiator, "aspect-affection").feel,
        opinionsOn(counterparty, "aspect-affection").feel,
      ),
      1,
    );
  });

  it("spans the scale: 0 .. 4, and refuses a value that is not a score", () => {
    assert.equal(gapOf(SCORE_MIN, SCORE_MAX), MAX_GAP);
    assert.equal(MAX_GAP, 4);
    assert.equal(gapOf(SCORE_MIN, SCORE_MIN), 0);
    assert.equal(gapOf(SCORE_MAX, SCORE_MIN), 4);
    assert.throws(() => gapOf(0, 5), RangeError);
    assert.throws(() => gapOf(1, 9), RangeError);
    assert.throws(() => gapOf(2.5, 5), RangeError);
  });

  it("does not store the Gap: a `gap` key is rejected, not merely unwritten", () => {
    const initiator = instance.parties[0] as Party;
    const tampered = {
      ...instance,
      parties: instance.parties.map((party) => ({
        ...party,
        opinions: party.opinions.map((row) => ({
          ...row,
          opinions: { ...row.opinions, gap: 3 },
        })),
      })),
    };
    assert.equal(zAssessmentInstance.safeParse(tampered).success, false);

    // And the field the schema does own is the pair of scores the Gap is read from.
    const feel = opinionsOn(initiator, "aspect-time-together").feel;
    assert.equal(typeof feel, "number");
    assert.equal("gap" in opinionsOn(initiator, "aspect-time-together"), false);
  });
});

/* ================================================================== *
 * E31 — an instance is a copy of a template
 * ================================================================== */

describe("E31 — the instance's Aspects are its template's", () => {
  it("finds nothing wrong in the real tree", () => {
    assert.deepEqual(instanceTemplateProblems(assessments, assessmentInstances), []);
  });

  it("reports an instance whose template is not in the collection", () => {
    const orphan: AssessmentInstance = { ...instance, templateId: "assessment-not-there" };
    const problems = instanceTemplateProblems(assessments, [orphan]);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /names template "assessment-not-there"/);
  });

  it("reports a copy that drifted from its template", () => {
    const drifted: AssessmentInstance = {
      ...instance,
      items: instance.items.map((item, index) =>
        index === 0 ? { ...item, id: "aspect-time-apart" } : item,
      ),
    };
    const problems = instanceTemplateProblems(assessments, [drifted]);
    assert.equal(problems.length, 1);
    assert.match(problems[0] ?? "", /its Aspects are \[aspect-time-apart/);
    assert.match(problems[0] ?? "", /the template's are \[aspect-time-together/);
  });
});
