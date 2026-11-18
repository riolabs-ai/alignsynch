/**
 * The projection Start needs: rows in, view models out (#1129).
 *
 * **Why this is not in the page module.** `/dashboard`'s module is the `page` of *two* copy
 * surfaces — the route's own fixture (`data/pages/start.ts`) and the first-run tour's
 * (`data/pages/tour.ts`, whose callout mounts here). `scripts/copy-refs.ts` validates every
 * `sectionOf`/`itemLabel` reference a page's closure makes against **each** of its surfaces, so a
 * reference written in the page module would be asked of the tour's fixture as well. Moving the
 * projection here keeps the page a composition and the copy references in a file attributed to
 * exactly one surface — the one that owns the words.
 *
 * The card itself is `components/dashboard/relationship-card-model.ts`, shared with My
 * Relationships; this file only resolves Start's own words for it.
 */
import type { PageCopy } from "@/content/pages";
import { createRelationshipPath, sessionPath, relationshipPath } from "@/lib/flow/paths";
import type { TemplateSummary } from "@/lib/flow/store";
import type { AlignmentSummary } from "@/lib/member/alignment-summary";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { activeCardsOf, startJobsOf } from "@/lib/member/start";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { cardViewOf, type RelationshipCardWords, titleOf } from "./relationship-card-model";
import type { RelationshipCardView } from "./relationship-card";
import type { StartJobView, StartTemplateView } from "./start-page";

/** How many template cards the landing shows — the bundle's four, and the reason it is capped. */
export const TEMPLATE_SHELF = 4;

/** The card's words, as Start's fixture declares them. */
export function cardWordsOf(copy: PageCopy): RelationshipCardWords {
  const cardCopy = sectionOf(copy, "card");
  return {
    live: itemLabel(cardCopy, "live"),
    waiting: itemLabel(cardCopy, "waiting"),
    draft: itemLabel(cardCopy, "draft"),
    paused: itemLabel(cardCopy, "paused"),
    with: itemLabel(cardCopy, "with"),
    aligned: itemLabel(cardCopy, "aligned"),
    readOnly: itemLabel(cardCopy, "read-only"),
    noResults: itemLabel(cardCopy, "no-results"),
    next: itemLabel(cardCopy, "next"),
    open: itemLabel(cardCopy, "open"),
    legend: {
      inSynch: itemLabel(cardCopy, "legend-synch"),
      smallGap: itemLabel(cardCopy, "legend-small"),
      gap: itemLabel(cardCopy, "legend-gap"),
    },
    waitingNext: itemLabel(cardCopy, "waiting-next"),
    draftNext: itemLabel(cardCopy, "draft-next"),
    pausedNext: itemLabel(cardCopy, "paused-next"),
    continueLabel: itemLabel(cardCopy, "continue"),
    addCardLabel: itemLabel(cardCopy, "add-card-action"),
  };
}

/** The whole projection the landing renders, in one call — the page stays a composition. */
export function startViewOf({
  copy,
  rows,
  templates,
  summaries,
}: {
  copy: PageCopy;
  rows: readonly MemberRelationshipRow[];
  templates: readonly TemplateSummary[];
  summaries: Readonly<Record<string, AlignmentSummary | null>>;
}): {
  cards: RelationshipCardView[];
  jobs: StartJobView[];
  templates: StartTemplateView[];
  subtitle: string;
} {
  const nextSteps = sectionOf(copy, "next-steps");
  const words = cardWordsOf(copy);

  const cards = activeCardsOf(rows, 2)
    .map((card) => cardViewOf(card.row, summaries[card.row.id] ?? null, words))
    .filter((card): card is RelationshipCardView => card !== null);

  const jobs: StartJobView[] = [];
  for (const job of startJobsOf(rows, summaries)) {
    const row = rows.find((candidate) => candidate.id === job.relationshipId);
    if (row === undefined) continue;
    const title = titleOf(row);

    if (job.kind === "next-step") {
      const summary = summaries[row.id] ?? null;
      if (summary?.nextStep == null || row.sessionRecordId === null) continue;
      jobs.push({
        kind: job.kind,
        title: fillLabel(itemLabel(nextSteps, "next-step-title"), {
          prompt: summary.nextStep.prompt,
        }),
        body: fillLabel(itemLabel(nextSteps, "next-step-body"), { title }),
        actionLabel: itemLabel(nextSteps, "open-align"),
        href: sessionPath(row.sessionRecordId),
      });
      continue;
    }

    if (job.kind === "add-card") {
      jobs.push({
        kind: job.kind,
        title: itemLabel(nextSteps, "add-card-title"),
        body: fillLabel(itemLabel(nextSteps, "add-card-body"), { title }),
        actionLabel: itemLabel(nextSteps, "add-card"),
        href: relationshipPath(row.id),
      });
      continue;
    }

    jobs.push({
      kind: job.kind,
      title: itemLabel(nextSteps, "draft-title"),
      body: fillLabel(itemLabel(nextSteps, "draft-body"), { title }),
      actionLabel: itemLabel(nextSteps, "continue-setup"),
      href: createRelationshipPath(row.templateSlug),
    });
  }

  const aspectCountLabel = itemLabel(sectionOf(copy, "card"), "aspects");
  const templateViews: StartTemplateView[] = templates.slice(0, TEMPLATE_SHELF).map((entry) => ({
    id: entry.id,
    href: createRelationshipPath(entry.slug),
    title: entry.title,
    summary: entry.summary,
    aspects: fillLabel(aspectCountLabel, { count: entry.aspectCount }),
  }));

  /*
   * The header's sentence: the bundle's line is drawn when it is true — one conversation and two
   * small jobs — and the quiet one otherwise, so the landing never counts jobs it does not have.
   */
  const subtitle =
    jobs.length === 3 && jobs[0]?.kind === "next-step"
      ? (copy.subtitle ?? "")
      : itemLabel(sectionOf(copy, "welcome"), "subtitle-quiet");

  return { cards, jobs, templates: templateViews, subtitle };
}
