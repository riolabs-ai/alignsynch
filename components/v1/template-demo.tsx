// template-ancestor: components/assessment/assessment-report.tsx (variation: a fixture report, not a store-backed one)
import {
  RELATIONSHIP_PRICE_CENTS,
  demoAnswersFor,
  type RelationshipType,
} from "@/data/v1/relationship-types";
import { formatCurrency } from "@/content/core";
import type { V1Relationship } from "@/data/v1/fixtures";
import { ReportBody } from "@/components/v1/report-body";
import { StartRelationshipButton } from "@/components/v1/start-relationship-button";
import { NotFoundState } from "@/components/v1/v1-ui";
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
    sharedWithCoach: false,
    coachComments: [],
    comments: [],
    aspectComments: {},
    openedSessions: 1,
    completedSessions: 1,
    subscription: {
      plan: "monthly",
      status: "active",
      periodEnd: "2026-11-30T09:00:00.000Z",
      startedAt: "2026-10-30T09:00:00.000Z",
    },
    history: [],
    lastSessionAt: "2026-10-30T12:00:00.000Z",
    createdAt: "2026-10-28T18:30:00.000Z",
    modifiedAt: "2026-10-30T12:00:00.000Z",
  };
}

/**
 * `/v1/templates/[type]/demo` — a real report, labelled `Example`, so a person can judge the
 * value before paying.
 *
 * It renders the completed-session report from fixture answers for the type, with the two
 * parties' names replaced by "You" and "Them". The `Example` label sits above it so no one
 * mistakes a sample for their own; below it are the two exits the owner asked for — back to the
 * template page, and `Start this relationship` (the invite step). No video, no carousel, never a
 * dead end.
 */
export function TemplateDemo({ type }: { type: RelationshipType }) {
  if (demoAnswersFor(type.id) === undefined) {
    return (
      <div className="mx-auto max-w-4xl p-4 sm:p-8">
        <NotFoundState
          message={`No example report exists for "${type.name}" yet.`}
          back="/v1/templates"
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
          <Link href="/v1/templates" className="font-medium text-action hover:underline">
            ← Relationship types
          </Link>
          <Link
            href={`/v1/templates/${type.id}`}
            className="font-medium text-action hover:underline"
          >
            ← {type.name} template
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
            <StartRelationshipButton />
          </div>
        </div>
      </div>
    </div>
  );
}
