/**
 * The worked example — one Relationship Type's finished report, answered by "You" and "Them".
 *
 * Launch criterion 5 is that the Gap report renders from both answers, and a criterion nobody
 * can look at is a claim. This module builds the one page that shows it before anyone pays: the
 * type's own Aspects, the authored demo sheet (`data/relationship-types.ts`) as the two
 * parties' Opinions, and `assessmentReport()` over both — the **same projection and the same
 * renderer** `/assessment/[slug]` and the instance report use. There is one report in the app,
 * not a marketing copy of one; that is what `docs/operations/history/V1-RETIREMENT.md`'s demo row means by "owns
 * the port of `components/v1/template-demo.tsx` to the v2 report".
 *
 * **The example is built from the type, not from a stored template record.** A type's demo
 * sheet is keyed by the type's own Aspect ids, and the catalogue's records are not always that
 * shape — `staff-manager`'s authored record predates the taxonomy and carries Aspects the sheet
 * never answered. Synthesising the template and the instance from the type keeps the model's
 * own rule honest (an instance is a copy of its template, and `data:check` E31 fails a copy that
 * drifted): the demo's items are the template's items, because both are the type's.
 *
 * **Nothing here reads a clock.** The instants below are authored, not `new Date()`: this page
 * is server-rendered and re-rendered, and two different stamps would be a hydration mismatch.
 *
 * Pure: no React, no Next. `app/(marketing)/relationship-types/[slug]/demo/page.tsx` draws it and
 * `tests/assessment-demo.test.ts` reads it in a node environment.
 */
import type {
  Assessment,
  AssessmentInstance,
  AspectOpinions,
  Opinions,
} from "@/content/assessment";
import { DEMO_NOW_ISO } from "@/content/core";
import {
  demoAnswersFor,
  purchasableRelationshipType,
  type RelationshipType,
} from "@/data/relationship-types";
import { assessmentReport, type AssessmentReport } from "@/lib/assessment-report";
import { startPathFor } from "@/lib/template-catalogue";

/** The two seats the demo names, in the order the report draws them. */
const DEMO_INITIATOR = "You";
const DEMO_COUNTERPARTY = "Them";

/**
 * A demo sheet answers all four Opinions, so the example is an Advanced-Mode session —
 * `content/assessment.ts` makes "Advanced ⇔ Think and Guess present" structural. Soft is the
 * Setting the old prototype demo used, and the one a first-time reader is walked through.
 */
const DEMO_MODE = "advanced" as const;
const DEMO_SETTING = "soft" as const;

/** The instants a finished, accepted session carries — authored, so a render can never drift. */
const DEMO_SUBMITTED_AT = "2026-10-30T11:58:00.000Z";
const DEMO_ACCEPTED_AT = "2026-10-30T12:00:00.000Z";

/** One party's answers, resolved for every Aspect the type carries. */
function opinionsFor(
  type: RelationshipType,
  answers: Readonly<Record<string, Opinions>>,
): AspectOpinions[] | undefined {
  const resolved: AspectOpinions[] = [];
  for (const item of type.aspects) {
    const opinions = answers[item.id];
    // The data module validates sheet ⇔ Aspect ids at import, so this is unreachable on valid
    // fixtures — the caller names the type and seat rather than drawing half a report.
    if (opinions === undefined) return undefined;
    resolved.push({ itemId: item.id, opinions: { ...opinions } });
  }
  return resolved;
}

/**
 * The template the demo is an instance of: the type's own name, its who-it-is-for line and its
 * own Aspects. Not a record from `data/assessments.ts` — see the module comment.
 */
function demoTemplate(type: RelationshipType): Assessment {
  return {
    id: `assessment-demo-${type.id}`,
    slug: `demo-${type.id}`,
    type: "assessment",
    status: "published",
    date: DEMO_NOW_ISO,
    title: type.name,
    summary: type.descriptor.whoItsFor,
    items: type.aspects.map((item) => ({ ...item, scale: { ...item.scale } })),
  };
}

/** The instance: the template copied, both seats answered and accepted. */
function demoInstance(type: RelationshipType, template: Assessment): AssessmentInstance {
  const demo = demoAnswersFor(type.id);
  if (demo === undefined) {
    throw new Error(`relationship-types: "${type.id}" has no demo answers`);
  }
  const initiator = opinionsFor(type, demo.you);
  const counterparty = opinionsFor(type, demo.them);
  if (initiator === undefined || counterparty === undefined) {
    throw new Error(`relationship-types: "${type.id}" has an incomplete demo sheet`);
  }
  return {
    id: `assessment-instance-demo-${type.id}`,
    slug: `demo-${type.id}`,
    type: "assessment",
    status: "published",
    date: DEMO_NOW_ISO,
    templateId: template.id,
    title: template.title,
    summary: `${type.name}, answered by ${DEMO_INITIATOR} and ${DEMO_COUNTERPARTY} — a worked example, not your own answers.`,
    mode: DEMO_MODE,
    setting: DEMO_SETTING,
    items: template.items.map((item) => ({ ...item, scale: { ...item.scale } })),
    parties: [
      {
        role: "initiator",
        name: DEMO_INITIATOR,
        submittedAt: DEMO_SUBMITTED_AT,
        acceptedAt: DEMO_ACCEPTED_AT,
        opinions: initiator,
      },
      {
        role: "counterparty",
        name: DEMO_COUNTERPARTY,
        submittedAt: DEMO_SUBMITTED_AT,
        acceptedAt: DEMO_ACCEPTED_AT,
        opinions: counterparty,
      },
    ],
  };
}

/** What the demo route draws: the type, the projection, and the one link a reader may follow. */
export interface AssessmentDemo {
  readonly type: RelationshipType;
  readonly report: AssessmentReport;
  /**
   * Where a reader starts this relationship: `/register?next=<this type's create path>` (#867).
   *
   * The **public** action still — the account is created first, then the visitor lands on stage 1
   * of the very template the example they just read belongs to. It used to be a bare `/register`,
   * which dropped that: the account was made and the person arrived on the brand's landing page
   * with the choice gone.
   *
   * It is still not the in-app create address on its own. A public page that links
   * `/templates/relationship/<id>/create` hands a signed-out visitor a screen he has no account
   * for yet; the create step is what `/register`'s `next` resolves **to**, after the account
   * exists, so the destination is the same one and the order is the product's.
   */
  readonly startPath: string;
}

/**
 * One type's worked example, or `undefined` when there is nothing to show: an unknown type, a
 * type that is not for sale, or a type whose sheet has not been authored yet. The route turns
 * that into a 404 rather than a fabricated report — absence is the honest answer there.
 */
export function assessmentDemo(typeId: string): AssessmentDemo | undefined {
  const type = purchasableRelationshipType(typeId);
  if (type === undefined) return undefined;
  if (demoAnswersFor(type.id) === undefined) return undefined;

  const template = demoTemplate(type);
  const instance = demoInstance(type, template);

  return {
    type,
    report: assessmentReport(instance, template),
    startPath: startPathFor(type.id),
  };
}
