/**
 * The assessment records — the second template on the shared record (issue #128).
 *
 * Two records, and the second one is why the first one exists:
 *
 *   `assessments`            one **template**: five Aspects with their Values, no parties.
 *   `assessmentInstances`    that template **copied and given parties** — Avery (the
 *                            Initiator) and Rowan (the Counterparty), each answering
 *                            every Aspect with Feel & Wish, plus Think & Guess on two.
 *
 * The copy is authored here rather than aliased to `assessments[0].items`, because a
 * copy is what an instance holds: editing the template later is a deliberate act, not
 * something that silently rewrites an instance someone already answered. `data:check`
 * E31 fails when the copy stops matching the template it names, so "copied" is checked
 * and not merely intended.
 *
 * No record here carries a Gap. The Gap is a difference of two Opinions — arithmetic
 * on these scores, computed by `gapOf()` in `content/record.ts`. One party's Feel 2
 * against the other's Feel 5 is a Gap of 3, and there is nowhere to write that down.
 */
import type { Assessment, AssessmentInstance } from "../content/assessment";

/** One assessment template: five Aspects, each with a Left Value and a Right Value. */
export const assessments: readonly Assessment[] = [
  {
    id: "assessment-relationship-basics",
    slug: "relationship-basics",
    type: "assessment",
    status: "published",
    date: "2026-10-24T09:00:00.000Z",
    title: "Relationship Basics",
    summary:
      "Five Aspects of a relationship — time, housework, money, conflict and affection — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-time-together",
        prompt: "How much time do you spend together in a normal week?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rare",
        rightValue: "Constant",
      },
      {
        id: "aspect-housework",
        prompt: "How is the work of the household divided?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "All mine",
        rightValue: "Evenly split",
      },
      {
        id: "aspect-money",
        prompt: "How are money and the decisions about it handled?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Kept separate",
        rightValue: "Fully shared",
      },
      {
        id: "aspect-conflict",
        prompt: "When there is a disagreement, how is it raised?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Left unsaid",
        rightValue: "Said plainly",
      },
      {
        id: "aspect-affection",
        prompt: "How often do you show affection?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rarely",
        rightValue: "Often",
      },
    ],
  },
];

/**
 * The template above, copied and given two parties.
 *
 * Feel and Wish are answered on all five Aspects (Basic Mode); Think and Guess are
 * answered on two of them, because Advanced Mode adds the pair and nothing in the
 * model derives one opinion from another.
 */
export const assessmentInstances: readonly AssessmentInstance[] = [
  {
    id: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    type: "assessment",
    status: "published",
    date: "2026-10-28T18:30:00.000Z",
    templateId: "assessment-relationship-basics",
    title: "Relationship Basics",
    summary: "Relationship Basics, answered by Avery and Rowan.",
    items: [
      {
        id: "aspect-time-together",
        prompt: "How much time do you spend together in a normal week?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rare",
        rightValue: "Constant",
      },
      {
        id: "aspect-housework",
        prompt: "How is the work of the household divided?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "All mine",
        rightValue: "Evenly split",
      },
      {
        id: "aspect-money",
        prompt: "How are money and the decisions about it handled?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Kept separate",
        rightValue: "Fully shared",
      },
      {
        id: "aspect-conflict",
        prompt: "When there is a disagreement, how is it raised?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Left unsaid",
        rightValue: "Said plainly",
      },
      {
        id: "aspect-affection",
        prompt: "How often do you show affection?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rarely",
        rightValue: "Often",
      },
    ],
    parties: [
      {
        role: "initiator",
        name: "Avery",
        opinions: [
          /** Feel 2 against Rowan's Feel 5: a Gap of 3 on the very first Aspect. */
          { itemId: "aspect-time-together", opinions: { feel: 2, wish: 5, think: 3, guess: 4 } },
          { itemId: "aspect-housework", opinions: { feel: 3, wish: 4 } },
          { itemId: "aspect-money", opinions: { feel: 4, wish: 4 } },
          { itemId: "aspect-conflict", opinions: { feel: 3, wish: 5, think: 4, guess: 4 } },
          { itemId: "aspect-affection", opinions: { feel: 4, wish: 4 } },
        ],
      },
      {
        role: "counterparty",
        name: "Rowan",
        opinions: [
          { itemId: "aspect-time-together", opinions: { feel: 5, wish: 3, think: 4, guess: 3 } },
          { itemId: "aspect-housework", opinions: { feel: 2, wish: 3 } },
          { itemId: "aspect-money", opinions: { feel: 4, wish: 4 } },
          { itemId: "aspect-conflict", opinions: { feel: 2, wish: 3, think: 3, guess: 3 } },
          { itemId: "aspect-affection", opinions: { feel: 3, wish: 4 } },
        ],
      },
    ],
  },
];
