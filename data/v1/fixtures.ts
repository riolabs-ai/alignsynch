/**
 * The v1 prototype's mock universe — the templates the store seeds from.
 *
 * `/v1/**` is the owner's clickable prototype of the whole product, built against an
 * in-browser store (`lib/v1/store.tsx`) rather than Postgres. This file is that store's
 * seed, typed with the **real** model (`content/assessment.ts::Assessment`, via
 * `z.infer`), so the day the prototype is wired the shapes already match — the same
 * rule `data/assessments.ts` follows for the live fixture.
 *
 * Three templates, deliberately spanning what the front page reads out of a summary:
 * two name a Relationship Type (so a family resolves), one names none (so it does not).
 * The store may later add relationships, parties and opinions here; the template slice
 * is all the editor (`components/v1/template-editor.tsx`) reads.
 */
import type { Assessment } from "../../content/assessment";

export const v1Templates: readonly Assessment[] = [
  {
    id: "v1-template-business",
    slug: "staff-manager",
    type: "assessment",
    status: "published",
    date: "2026-10-26T09:00:00.000Z",
    title: "Staff & Manager",
    summary:
      "Relationship Type: Business — the glossary's Staff / Manager descriptor, Realm: Office. Four Aspects of a working relationship — priorities, feedback, workload and decisions — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-priorities",
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
    ],
  },
  {
    id: "v1-template-personal",
    slug: "parent-child",
    type: "assessment",
    status: "published",
    date: "2026-10-27T09:00:00.000Z",
    title: "Parent & Child",
    summary:
      "Relationship Type: Personal — the glossary's Parent / Child descriptor, Realm: Home. Four Aspects of growing together — trust, house rules, one-to-one time and privacy — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-trust",
        prompt: "How much do we trust each other with the hard things?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Kept hidden",
        rightValue: "Shared openly",
      },
      {
        id: "aspect-house-rules",
        prompt: "How are the rules of the house agreed?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Set for me",
        rightValue: "Agreed together",
      },
      {
        id: "aspect-one-to-one",
        prompt: "How often do we make time for just the two of us?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rarely",
        rightValue: "Often",
      },
      {
        id: "aspect-privacy",
        prompt: "How is each of us allowed our own space?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "None",
        rightValue: "Fully respected",
      },
    ],
  },
  {
    id: "v1-template-basics",
    slug: "relationship-basics",
    type: "assessment",
    status: "published",
    date: "2026-10-24T09:00:00.000Z",
    title: "Relationship Basics",
    summary:
      "Three Aspects of a relationship — time, money and conflict — each answered from how it feels now to how you wish it to change.",
    items: [
      {
        id: "aspect-time",
        prompt: "How much time do you spend together in a normal week?",
        scale: { kind: "score", min: 1, max: 5 },
        leftValue: "Rare",
        rightValue: "Constant",
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
    ],
  },
];
