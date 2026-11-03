// template-ancestor: components/assessment/assessment-report.tsx (variation: a fixture report, not a store-backed one)
import {
  RELATIONSHIP_PRICE_CENTS,
  demoAnswersFor,
  type RelationshipType,
} from "@/data/v1/relationship-types";
import { formatCurrency } from "@/content/core";
import { deriveSteps } from "@/content/steps";
import type { V1Relationship } from "@/data/v1/fixtures";
import { ReportBody } from "@/components/v1/report-body";
import { NotFoundState } from "@/components/v1/v1-ui";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import Link from "next/link";

/**
 * Build the one `V1Relationship` the demo renders: the type's own Aspects, answered in Advanced
 * Mode by "You" and "Them", both submitted — the same shape a finished live session has. The
 * report is drawn by `ReportBody`, the identical component `ReportView` uses, so what a person
 * sees here is byte-for-byte the report they would get — not a marketing mock.
 */
function demoRelationship(type: RelationshipType): V1Relationship {
  const demo = demoAnswersFor(type.id);
  if (demo === undefined) {
    throw new Error(`relationship-types: "${type.id}" has no demo answers`);
  }
  return {
    id: `demo-${type.id}`,
    templateId: `type-${type.id}`,
    name: undefined,
    items: type.aspects.map((item) => ({ ...item, scale: { ...item.scale } })),
    deletedAspects: [],
    mode: "advanced",
    setting: "soft",
    initiatorName: "You",
    counterpartyName: "Them",
    // The demo names its two seats by role, not by a typed invitee — nobody was invited to it.
    inviteeName: null,
    initiatorAnswers: { ...demo.you },
    counterpartyAnswers: { ...demo.them },
    initiatorSubmitted: true,
    counterpartySubmitted: true,
    initiatorAccepted: true,
    counterpartyAccepted: true,
    initiatorAcceptedAt: "2026-10-30T11:58:00.000Z",
    counterpartyAcceptedAt: "2026-10-30T12:00:00.000Z",
    inviteToken: null,
    inviteExpiresAt: null,
    // A demo report is a live example, never an archived one.
    archivedAt: null,
    sharedWithCoach: false,
    coachComments: [],
    comments: [],
    aspectComments: {},
    // The demo relationship is complete, so it stores the Steps its own answers derive — the same
    // rule every completion follows (`content/steps.ts`), not an empty field behind a finished report.
    steps: deriveSteps({
      relationshipId: `demo-${type.id}`,
      items: type.aspects,
      initiatorAnswers: demo.you,
      counterpartyAnswers: demo.them,
      createdAt: "2026-10-30T12:00:00.000Z",
    }),
    openedSessions: 1,
    completedSessions: 1,
    subscription: {
      plan: "monthly",
      status: "active",
      periodEnd: "2026-11-30T09:00:00.000Z",
      startedAt: "2026-10-30T09:00:00.000Z",
      payments: [],
    },
    history: [],
    lastSessionAt: "2026-10-30T12:00:00.000Z",
    createdAt: "2026-10-28T18:30:00.000Z",
    modifiedAt: "2026-10-30T12:00:00.000Z",
  };
}

/**
 * The last `/v1` route: a real report, labelled `Example`, so a person can judge the value
 * before paying. `docs/V1-RETIREMENT.md` marks this surface `release` — it is the only worked
 * example in the tree, and two live modules link to it (`components/assessment-flow/template-card.tsx`
 * and `lib/alignment-home.ts`) — so it is the one page the deletion cohort leaves in the
 * prototype group, behind that group's gate, until the release cohort moves it to
 * `/assessment/demo/[type]` and ports `ReportBody` to the v2 report projection.
 *
 * It renders the completed-session report from fixture answers for the type, with the two
 * parties' names replaced by "You" and "Them". The `Example` label sits above it so no one
 * mistakes a sample for their own; below it are the two exits the owner asked for — back to the
 * template library, and `Start this relationship` (the invite step). No video, no carousel, never
 * a dead end: both destinations are live app routes, not `/v1` ones, because the `/v1` create
 * entry and type landing this page used to link to are deleted (#478).
 */
export function TemplateDemo({ type }: { type: RelationshipType }) {
  if (demoAnswersFor(type.id) === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <NotFoundState
          message={`No example report exists for "${type.name}" yet.`}
          back={TEMPLATE_LIBRARY_PATH}
        />
      </div>
    );
  }

  const rel = demoRelationship(type);

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-4xl space-y-3 p-4 pt-6 sm:p-8 sm:pb-0">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700 border border-amber-200">
            Example
          </span>
          <p className="text-xs text-muted-foreground">
            A finished session&apos;s report, from two sample people — you&apos;ll see your own
            answers here, under your own names.
          </p>
        </div>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-3 text-xs">
          <Link href={TEMPLATE_LIBRARY_PATH} className="font-medium text-action hover:underline">
            ← {type.name} in the template library
          </Link>
        </nav>
      </div>

      <ReportBody rel={rel} templateTitle={type.name} />

      <div className="mx-auto max-w-4xl space-y-3 p-4 pt-0 sm:p-8 sm:pt-0">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground">Like what you see?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            One relationship costs {formatCurrency(RELATIONSHIP_PRICE_CENTS)}. You pay; the other
            person joins by link and pays nothing.
          </p>
          <div className="mt-3">
            <Link
              href={TEMPLATE_LIBRARY_PATH}
              className="inline-flex h-12 items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground hover:bg-action/90"
            >
              Start this relationship
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
