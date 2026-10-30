/**
 * The assessment records — the second template on the shared record (issue #128).
 *
 * Four **templates** and four **instances**, one fixture per thing the model can say,
 * so a rule can be checked without authoring a record to check it with:
 *
 *   assessment-relationship-basics      the template #128 introduced (unchanged)
 *   assessment-business-staff-manager   Relationship Type: Business — Staff / Manager
 *   assessment-personal-parent-child    Relationship Type: Personal — Parent / Child
 *   assessment-blank-template           Relationship Type: blank — the user names it (draft)
 *
 *   assessment-instance-avery-rowan     the feature example: Basic Mode, Think & Guess on two
 *   assessment-instance-ruth-sam        two parties who agree on every Aspect — every Gap is 0
 *   assessment-instance-marco-priya     two parties who disagree on all five — Gaps 1 to 4
 *   assessment-instance-noor-iris       Advanced Mode on every Aspect — Think & Guess on all five
 *
 * **Relationship Type is not a field, and this fixture does not add one.** The glossary
 * says a Relationship Type is "the category of Relationships that AlignSynch provides
 * templates _________" and lists "Business, Personal, ______" — a category of the
 * template collection, not a property of a record. So the type is named in each
 * template's `title` and `summary`, where a reader and a screen both already look. The
 * third line is blank on purpose: that template is the user's to name, so it ships as a
 * **draft** whose five Aspects are prompts to overwrite, and no instance copies it —
 * nobody has played a template that has not been named yet.
 *
 * The copy is authored here rather than aliased to the template's `items`, because a
 * copy is what an instance holds: editing the template later is a deliberate act, not
 * something that silently rewrites an instance someone already answered. `data:check`
 * E31 fails when the copy stops matching the template it names, so "copied" is checked
 * and not merely intended.
 *
 * No record here carries a Gap. The Gap is a difference of two Opinions — arithmetic
 * on these scores, computed by `gapOf()` in `content/record.ts`. One party's Feel 2
 * against the other's Feel 5 is a Gap of 3, and there is nowhere to write that down;
 * so every instance states the arithmetic in a comment beside the pair it came from
 * (`gapOf(2, 5) === 3`), and a reader can check it without running anything.
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
  {
    /**
     * Relationship Type: **Business**, Descriptor: **Staff / Manager**, Realm: Office.
     * The Aspect is the work the two of them share, never the people in it.
     */
    id: "assessment-business-staff-manager",
    slug: "staff-manager",
    type: "assessment",
    status: "published",
    date: "2026-10-26T09:00:00.000Z",
    title: "Staff & Manager",
    summary:
      "Relationship Type: Business — the glossary's Staff / Manager descriptor, Realm: Office. Five Aspects of a working relationship — priorities, feedback, workload, decisions and development — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-work-priorities",
        prompt: "How are the week's priorities agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Set for me",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-feedback",
        prompt: "How is feedback on the work given?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never said",
        rightValue: "Said directly",
      },
      {
        id: "aspect-workload",
        prompt: "How is the workload split between the two of you?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "All on me",
        rightValue: "Evenly shared",
      },
      {
        id: "aspect-decisions",
        prompt: "How are the decisions about the work made?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Manager decides",
        rightValue: "Decided together",
      },
      {
        id: "aspect-development",
        prompt: "How much do you talk about growth and what comes next?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never",
        rightValue: "Every review",
      },
    ],
  },
  {
    /**
     * Relationship Type: **Personal**, Descriptor: **Parent / Child**, Realm: Home.
     * The Initiator is the Parent here, the Counterparty the Child — the roles are the
     * parties' (`role`), and neither is implied by the template.
     */
    id: "assessment-personal-parent-child",
    slug: "parent-child",
    type: "assessment",
    status: "published",
    date: "2026-10-27T09:00:00.000Z",
    title: "Parent & Child",
    summary:
      "Relationship Type: Personal — the glossary's Parent / Child descriptor, Realm: Home. Five Aspects of raising a child together — check-ins, house rules, trust, one-to-one time and privacy — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-check-ins",
        prompt: "How often do you check in about their day?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never",
        rightValue: "Every day",
      },
      {
        id: "aspect-house-rules",
        prompt: "How are the house rules agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Handed down",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-trust",
        prompt: "How much do you trust their judgement?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not yet",
        rightValue: "Completely",
      },
      {
        id: "aspect-one-to-one",
        prompt: "How much one-to-one time do you spend?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "Every day",
      },
      {
        id: "aspect-privacy",
        prompt: "How much privacy do they get?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "As much as they ask for",
      },
    ],
  },
  {
    /**
     * Relationship Type: **blank** — the glossary's third line, "________". This is the
     * user's template to name: the Aspects are prompts and the Values are the two ends
     * of the scale, all of them meant to be overwritten before the template is copied
     * into a Relationship. It is a `draft` for that reason, and no instance copies it.
     */
    id: "assessment-blank-template",
    slug: "blank-template",
    type: "assessment",
    status: "draft",
    date: "2026-10-27T10:00:00.000Z",
    title: "Untitled Relationship",
    summary:
      "Relationship Type: ________ — left blank, because this template is the user's to name; the glossary it fills lists Business, Personal and a third line. Five unnamed Aspects, each with a prompt and two Values to overwrite before this is copied into a Relationship.",
    items: [
      {
        id: "aspect-blank-one",
        prompt: "Aspect 1 — what should this ask?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not at all",
        rightValue: "Completely",
      },
      {
        id: "aspect-blank-two",
        prompt: "Aspect 2 — what should this ask?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not at all",
        rightValue: "Completely",
      },
      {
        id: "aspect-blank-three",
        prompt: "Aspect 3 — what should this ask?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not at all",
        rightValue: "Completely",
      },
      {
        id: "aspect-blank-four",
        prompt: "Aspect 4 — what should this ask?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not at all",
        rightValue: "Completely",
      },
      {
        id: "aspect-blank-five",
        prompt: "Aspect 5 — what should this ask?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not at all",
        rightValue: "Completely",
      },
    ],
  },
];

/**
 * The templates above, copied and given two parties.
 *
 * Feel and Wish are answered on all five Aspects (Basic Mode) in every instance but the
 * Advanced one, which adds Think and Guess on all five — Advanced Mode adds the pair,
 * and nothing in the model derives one opinion from another.
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
  {
    /**
     * The agreement case: every one of Ruth's opinions on an Aspect equals Sam's, so
     * every Gap is `gapOf(n, n) === 0` — the glossary's In Synch on all five.
     */
    id: "assessment-instance-ruth-sam",
    slug: "ruth-sam",
    type: "assessment",
    status: "published",
    date: "2026-10-28T19:00:00.000Z",
    templateId: "assessment-personal-parent-child",
    title: "Parent & Child",
    summary:
      "Parent & Child, answered by Ruth (Parent) and Sam (Child) — they agree on all five Aspects, so every Gap is 0.",
    items: [
      {
        id: "aspect-check-ins",
        prompt: "How often do you check in about their day?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never",
        rightValue: "Every day",
      },
      {
        id: "aspect-house-rules",
        prompt: "How are the house rules agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Handed down",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-trust",
        prompt: "How much do you trust their judgement?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not yet",
        rightValue: "Completely",
      },
      {
        id: "aspect-one-to-one",
        prompt: "How much one-to-one time do you spend?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "Every day",
      },
      {
        id: "aspect-privacy",
        prompt: "How much privacy do they get?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "As much as they ask for",
      },
    ],
    parties: [
      {
        role: "initiator",
        name: "Ruth",
        opinions: [
          /** Sam answers Feel 4, Wish 4 below: gapOf(4, 4) === 0, gapOf(4, 4) === 0. */
          { itemId: "aspect-check-ins", opinions: { feel: 4, wish: 4 } },
          /** Sam answers Feel 3, Wish 3: gapOf(3, 3) === 0, gapOf(3, 3) === 0. */
          { itemId: "aspect-house-rules", opinions: { feel: 3, wish: 3 } },
          /** Sam answers Feel 4, Wish 5: gapOf(4, 4) === 0, gapOf(5, 5) === 0. */
          { itemId: "aspect-trust", opinions: { feel: 4, wish: 5 } },
          /** Sam answers Feel 2, Wish 3: gapOf(2, 2) === 0, gapOf(3, 3) === 0. */
          { itemId: "aspect-one-to-one", opinions: { feel: 2, wish: 3 } },
          /** Sam answers Feel 3, Wish 4: gapOf(3, 3) === 0, gapOf(4, 4) === 0. */
          { itemId: "aspect-privacy", opinions: { feel: 3, wish: 4 } },
        ],
      },
      {
        role: "counterparty",
        name: "Sam",
        opinions: [
          { itemId: "aspect-check-ins", opinions: { feel: 4, wish: 4 } },
          { itemId: "aspect-house-rules", opinions: { feel: 3, wish: 3 } },
          { itemId: "aspect-trust", opinions: { feel: 4, wish: 5 } },
          { itemId: "aspect-one-to-one", opinions: { feel: 2, wish: 3 } },
          { itemId: "aspect-privacy", opinions: { feel: 3, wish: 4 } },
        ],
      },
    ],
  },
  {
    /**
     * The disagreement case: all five Feel Gaps are non-zero and together they cover
     * 1, 2, 3 and 4 — the whole 1..4 range a Gap can take.
     */
    id: "assessment-instance-marco-priya",
    slug: "marco-priya",
    type: "assessment",
    status: "published",
    date: "2026-10-29T08:30:00.000Z",
    templateId: "assessment-business-staff-manager",
    title: "Staff & Manager",
    summary:
      "Staff & Manager, answered by Marco (Staff) and Priya (Manager) — they disagree on all five Aspects, with Gaps from 1 to 4.",
    items: [
      {
        id: "aspect-work-priorities",
        prompt: "How are the week's priorities agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Set for me",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-feedback",
        prompt: "How is feedback on the work given?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never said",
        rightValue: "Said directly",
      },
      {
        id: "aspect-workload",
        prompt: "How is the workload split between the two of you?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "All on me",
        rightValue: "Evenly shared",
      },
      {
        id: "aspect-decisions",
        prompt: "How are the decisions about the work made?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Manager decides",
        rightValue: "Decided together",
      },
      {
        id: "aspect-development",
        prompt: "How much do you talk about growth and what comes next?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never",
        rightValue: "Every review",
      },
    ],
    parties: [
      {
        role: "initiator",
        name: "Marco",
        opinions: [
          /**
           * Priya answers Feel 5, Wish 2 below:
           * gapOf(2, 5) === 3 (Feel), gapOf(5, 2) === 3 (Wish).
           */
          { itemId: "aspect-work-priorities", opinions: { feel: 2, wish: 5 } },
          /**
           * Priya answers Feel 2, Wish 3 below:
           * gapOf(3, 2) === 1 (Feel), gapOf(4, 3) === 1 (Wish).
           */
          { itemId: "aspect-feedback", opinions: { feel: 3, wish: 4 } },
          /**
           * Priya answers Feel 1, Wish 2 below:
           * gapOf(5, 1) === 4 (Feel), gapOf(3, 2) === 1 (Wish).
           */
          { itemId: "aspect-workload", opinions: { feel: 5, wish: 3 } },
          /**
           * Priya answers Feel 3, Wish 4 below:
           * gapOf(1, 3) === 2 (Feel), gapOf(5, 4) === 1 (Wish).
           */
          { itemId: "aspect-decisions", opinions: { feel: 1, wish: 5 } },
          /**
           * Priya answers Feel 1, Wish 4 below:
           * gapOf(4, 1) === 3 (Feel), gapOf(2, 4) === 2 (Wish).
           */
          { itemId: "aspect-development", opinions: { feel: 4, wish: 2 } },
        ],
      },
      {
        role: "counterparty",
        name: "Priya",
        opinions: [
          { itemId: "aspect-work-priorities", opinions: { feel: 5, wish: 2 } },
          { itemId: "aspect-feedback", opinions: { feel: 2, wish: 3 } },
          { itemId: "aspect-workload", opinions: { feel: 1, wish: 2 } },
          { itemId: "aspect-decisions", opinions: { feel: 3, wish: 4 } },
          { itemId: "aspect-development", opinions: { feel: 1, wish: 4 } },
        ],
      },
    ],
  },
  {
    /**
     * The Advanced Mode case: Think and Guess are answered on all five Aspects, not on
     * two. Every pair below has its four Gaps written beside it.
     */
    id: "assessment-instance-noor-iris",
    slug: "noor-iris",
    type: "assessment",
    status: "published",
    date: "2026-10-29T09:45:00.000Z",
    templateId: "assessment-personal-parent-child",
    title: "Parent & Child",
    summary:
      "Parent & Child, answered by Noor (Parent) and Iris (Child) in Advanced Mode — Feel, Wish, Think and Guess on all five Aspects.",
    items: [
      {
        id: "aspect-check-ins",
        prompt: "How often do you check in about their day?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Never",
        rightValue: "Every day",
      },
      {
        id: "aspect-house-rules",
        prompt: "How are the house rules agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Handed down",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-trust",
        prompt: "How much do you trust their judgement?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Not yet",
        rightValue: "Completely",
      },
      {
        id: "aspect-one-to-one",
        prompt: "How much one-to-one time do you spend?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "Every day",
      },
      {
        id: "aspect-privacy",
        prompt: "How much privacy do they get?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "As much as they ask for",
      },
    ],
    parties: [
      {
        role: "initiator",
        name: "Noor",
        opinions: [
          /**
           * Iris answers Feel 4, Wish 3, Think 3, Guess 4 below:
           * gapOf(3, 4) === 1 (Feel), gapOf(5, 3) === 2 (Wish),
           * gapOf(4, 3) === 1 (Think), gapOf(2, 4) === 2 (Guess).
           */
          {
            itemId: "aspect-check-ins",
            opinions: { feel: 3, wish: 5, think: 4, guess: 2 },
          },
          /**
           * Iris answers Feel 5, Wish 2, Think 4, Guess 3 below:
           * gapOf(2, 5) === 3 (Feel), gapOf(4, 2) === 2 (Wish),
           * gapOf(3, 4) === 1 (Think), gapOf(1, 3) === 2 (Guess).
           */
          {
            itemId: "aspect-house-rules",
            opinions: { feel: 2, wish: 4, think: 3, guess: 1 },
          },
          /**
           * Iris answers Feel 4, Wish 3, Think 5, Guess 2 below:
           * gapOf(5, 4) === 1 (Feel), gapOf(5, 3) === 2 (Wish),
           * gapOf(4, 5) === 1 (Think), gapOf(5, 2) === 3 (Guess).
           */
          {
            itemId: "aspect-trust",
            opinions: { feel: 5, wish: 5, think: 4, guess: 5 },
          },
          /**
           * Iris answers Feel 3, Wish 1, Think 4, Guess 1 below:
           * gapOf(1, 3) === 2 (Feel), gapOf(4, 1) === 3 (Wish),
           * gapOf(2, 4) === 2 (Think), gapOf(3, 1) === 2 (Guess).
           */
          {
            itemId: "aspect-one-to-one",
            opinions: { feel: 1, wish: 4, think: 2, guess: 3 },
          },
          /**
           * Iris answers Feel 4, Wish 5, Think 3, Guess 5 below:
           * gapOf(3, 4) === 1 (Feel), gapOf(2, 5) === 3 (Wish),
           * gapOf(2, 3) === 1 (Think), gapOf(4, 5) === 1 (Guess).
           */
          {
            itemId: "aspect-privacy",
            opinions: { feel: 3, wish: 2, think: 2, guess: 4 },
          },
        ],
      },
      {
        role: "counterparty",
        name: "Iris",
        opinions: [
          { itemId: "aspect-check-ins", opinions: { feel: 4, wish: 3, think: 3, guess: 4 } },
          { itemId: "aspect-house-rules", opinions: { feel: 5, wish: 2, think: 4, guess: 3 } },
          { itemId: "aspect-trust", opinions: { feel: 4, wish: 3, think: 5, guess: 2 } },
          { itemId: "aspect-one-to-one", opinions: { feel: 3, wish: 1, think: 4, guess: 1 } },
          { itemId: "aspect-privacy", opinions: { feel: 4, wish: 5, think: 3, guess: 5 } },
        ],
      },
    ],
  },
];
