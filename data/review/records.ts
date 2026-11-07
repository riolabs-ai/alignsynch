/**
 * The review records `/admin/review` renders today (#665), and the sample-data line it draws.
 *
 * **These rows are a fixture, and the screen says so.** The real record is three tables —
 * `review_artifact`, `review_todo`, `review_issue` — which are carded separately because they
 * touch `db/migrations/` and need their own gate and demo-first migration. This file is the
 * `ReviewStore` fixture (`lib/review/store.ts`) that keeps the components honest in the meantime:
 * the shape is the store's, the ids are real artifact ids from `docs/review/artifacts.json`, and
 * checking a box or closing an issue is not possible until the store lands, because nothing here
 * can be written.
 *
 * The to-dos are the review pass the prototype actually needs — each one names something a reader
 * can check in the file — rather than a checklist invented to fill seven rows.
 */
import { zReviewFixture, type ReviewFixture } from "../../content/review";

export const reviewFixture: ReviewFixture = zReviewFixture.parse({
  "relationship-lifecycle-v4": {
    artifactId: "relationship-lifecycle-v4",
    todos: [
      {
        id: "todo-stage-actor",
        label: "All ten stages are named, and each one says who acts",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T19:58:00.000Z",
      },
      {
        id: "todo-gap-after-acceptance",
        label: "The Gap appears after the second acceptance, never before it",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:00:00.000Z",
      },
      {
        id: "todo-aspects-eight",
        label: "The Aspects step offers the eight kinds the model defines",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:02:00.000Z",
      },
      {
        id: "todo-payment-at-completion",
        label: "The payment step shows the fee moving from creation to completion",
        done: false,
      },
      {
        id: "todo-invitation-names",
        label: "The invitation names both parties and the setting the pair chose",
        done: false,
      },
      {
        id: "todo-rail-focus",
        label: "The stage rail is reachable by keyboard and the focus ring is visible",
        done: false,
      },
      {
        id: "todo-mobile-column",
        label: "At 390px the flow is one column with no horizontal scroll",
        done: false,
      },
    ],
    issues: [
      {
        number: 1,
        title: "Stage 7 says Aligned before either party has accepted",
        status: "open",
        labels: ["stage-rail", "copy"],
        author: "Jaden",
        at: "2026-11-07T19:47:00.000Z",
        body: "The rail's seventh stop reads Aligned while the flow is still waiting on the counterparty's acceptance. Alignment is the outcome of two acceptances, so this is the one word the rail must not print early.",
        comments: [],
      },
      {
        number: 2,
        title: "Aspects step lists four kinds; the model has eight",
        status: "open",
        labels: ["content"],
        author: "Jaden",
        at: "2026-11-07T19:49:00.000Z",
        body: "Four Basic kinds are drawn and the four prediction kinds are missing, so an Advanced relationship cannot be reviewed here at all.",
        comments: [
          {
            id: "comment-aspects-scope",
            author: "Jaden",
            at: "2026-11-07T19:55:00.000Z",
            body: "The four prediction kinds only exist where the template asked them, so the step probably needs a conditional band rather than eight fixed rows.",
          },
        ],
      },
      {
        number: 3,
        title: "Stage rail overflows its column at 390px",
        status: "closed",
        labels: ["layout"],
        author: "Jaden",
        at: "2026-11-07T19:50:00.000Z",
        body: "The rail is a fixed-width row and pushed the flow 40px wider than the viewport, so the page scrolled sideways on a phone.",
        comments: [
          {
            id: "comment-rail-fixed",
            author: "Jaden",
            at: "2026-11-07T19:57:00.000Z",
            body: "Fixed in v4: the rail collapses to the current stage and a menu on narrow widths.",
          },
        ],
      },
      {
        number: 4,
        title: "Payment step still charges at creation",
        status: "open",
        labels: ["billing"],
        author: "Jaden",
        at: "2026-11-07T19:51:00.000Z",
        body: "The step's own copy says the initiator pays when the relationship is created. The model moved the fee to completion, so the screen describes a flow the app no longer runs.",
        comments: [],
      },
      {
        number: 5,
        title: "In Synch is spelled In Sync in the report band",
        status: "closed",
        labels: ["copy", "glossary"],
        author: "Jaden",
        at: "2026-11-07T19:52:00.000Z",
        body: "The five Gap sizes have one spelling each and the glossary owns them; the band's own heading disagrees.",
        comments: [],
      },
      {
        number: 6,
        title: "Gap preview shows the counterparty's answer",
        status: "open",
        labels: ["privacy"],
        author: "Jaden",
        at: "2026-11-07T19:53:00.000Z",
        body: "Before both parties finish, the preview draws a difference and the difference is enough to infer an answer that was meant to stay sealed.",
        comments: [],
      },
      {
        number: 7,
        title: "Stage 10 has no empty state for a party who has not answered",
        status: "open",
        labels: ["empty-state"],
        author: "Jaden",
        at: "2026-11-07T19:54:00.000Z",
        body: "The last stage draws an Aligned band whether or not the second party has finished, so a relationship waiting on one person reads as complete.",
        comments: [],
      },
    ],
  },

  "relationship-lifecycle-v3": {
    artifactId: "relationship-lifecycle-v3",
    todos: [
      {
        id: "todo-v3-stages",
        label: "The stage rail counts ten, and the count matches the sections below it",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:00:00.000Z",
      },
      {
        id: "todo-v3-copy-pass",
        label: "Every stage heading is a sentence a reader can act on",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:03:00.000Z",
      },
      {
        id: "todo-v3-payment",
        label: "The payment step is drawn where the fee is charged",
        done: false,
      },
      {
        id: "todo-v3-invitation",
        label: "The invitation step names the setting the pair chose",
        done: false,
      },
      {
        id: "todo-v3-empty",
        label: "A stage with no answer yet has an empty state of its own",
        done: false,
      },
    ],
    issues: [
      {
        number: 1,
        title: "Two stages share the heading Who and how",
        status: "open",
        labels: ["copy"],
        author: "Jaden",
        at: "2026-11-07T20:04:00.000Z",
        body: "The rail's fourth stop and the account step below it carry the same words, so a reader counting stages cannot tell which one they are on.",
        comments: [],
      },
      {
        number: 2,
        title: "Aspects are drawn as a list; the model draws them as pairs",
        status: "closed",
        labels: ["content"],
        author: "Jaden",
        at: "2026-11-07T20:05:00.000Z",
        body: "Each Aspect is two answers compared, so a flat list loses the comparison the report depends on.",
        comments: [],
      },
      {
        number: 3,
        title: "The Gap appears a stage too early",
        status: "closed",
        labels: ["stage-rail"],
        author: "Jaden",
        at: "2026-11-07T20:06:00.000Z",
        body: "The rail opened the Gap band while the second acceptance was still pending.",
        comments: [],
      },
    ],
  },

  "relationship-lifecycle-v2": {
    artifactId: "relationship-lifecycle-v2",
    todos: [
      {
        id: "todo-v2-ten",
        label: "The flow is ten stages, from template to alignment",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:01:00.000Z",
      },
      {
        id: "todo-v2-account",
        label: "The account step sits before the invitation, not after it",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:02:00.000Z",
      },
      {
        id: "todo-v2-aspects",
        label: "The Aspects step comes before the invitation is sent",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:03:00.000Z",
      },
      {
        id: "todo-v2-payment-position",
        label: "The payment step is placed where the charge happens",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:04:00.000Z",
      },
    ],
    issues: [
      {
        number: 1,
        title: "The account step asks for a password before the flow explains why",
        status: "closed",
        labels: ["copy"],
        author: "Jaden",
        at: "2026-11-07T20:05:00.000Z",
        body: "The step opened on a password field with no sentence about what the account is for.",
        comments: [],
      },
      {
        number: 2,
        title: "Six stages became ten with no note on what the four new ones are",
        status: "closed",
        labels: ["content"],
        author: "Jaden",
        at: "2026-11-07T20:06:00.000Z",
        body: "The rail grew and the stage names did not explain the additions.",
        comments: [],
      },
    ],
  },

  "relationship-lifecycle-v1": {
    artifactId: "relationship-lifecycle-v1",
    todos: [
      {
        id: "todo-v1-six",
        label: "Six stages are named, and each one names who acts",
        done: true,
        actor: "Jaden",
        at: "2026-11-07T20:02:00.000Z",
      },
      {
        id: "todo-v1-account",
        label: "A party can reach the flow without an account yet",
        done: false,
      },
      {
        id: "todo-v1-aspects",
        label: "The Aspects step asks for both parties' answers",
        done: false,
      },
    ],
    issues: [
      {
        number: 1,
        title: "The flow starts at a template picker with no way back to it",
        status: "open",
        labels: ["flow"],
        author: "Jaden",
        at: "2026-11-07T20:03:00.000Z",
        body: "A reader who is unsure which template they want has no route out of the first stage, and the choice decides whether prediction kinds are asked at all.",
        comments: [],
      },
    ],
  },
});
