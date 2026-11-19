// template-ancestor: components/console/stat-card-grid.tsx   (variation: the figure grid becomes eleven story cards — each one a link, a count over each card, a status stack and its own chips, and the grid splits into the six stories and the five around them instead of one band)
/**
 * `/admin/spec` — the Overview (s01, #1252).
 *
 * **What the reader sees first: the numbers, then the eleven doors.** The status box is the
 * Validation page's own component, drawn without the section index and the metadata it does not
 * need; beside it is the welcome band and then the group cards, split into the six stories the
 * agreement reads in order and the five around them.
 *
 * **A card's figures are its group's rows.** `met`/`total` and the chips are `specTotalsOf` and
 * `specStatusCounts` over that group's rows — the same two functions the rail and the story pages
 * call, so a card that says `07 · 5/7 met` opens a page whose chips say five and seven, and a
 * reader can check the arithmetic without trusting the screen.
 *
 * **The stack bar is decoration and says so.** Six tones, no text, `aria-hidden`: the chips below
 * it carry every word and every count, so a reader who cannot see the bar loses nothing and hears
 * nothing twice. It is a series of flex-basis widths, not a chart library.
 *
 * **The image the agreement holds is not here.** No mockup, no quote, no fee: the cards carry the
 * group's sentence and its counts (AS-10).
 *
 * Server component: no state, no handler, no clock.
 */
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import {
  SPEC_STATUSES,
  SPEC_STORY_GROUPS,
  SPEC_STORY_LAST_OF_STORY,
  specRowsOfStory,
  specStatusCounts,
  specTotalsOf,
  specStoryRows,
  type SpecStoryGroup,
  type SpecValidation,
} from "@/content/spec";
import { adminSpecStoryDescriptions } from "@/data/pages/admin-spec";
import { adminSpecGroupPath, ADMIN_SPEC_VALIDATION_PATH } from "@/lib/admin/spec-paths";
import { fillLabel, pageItemOf } from "@/lib/page-copy";

import { SPEC_STATUS_FILL, SpecStatusChip } from "./spec-status";
import { SpecStatusBox } from "./spec-status-box";

/** One group's card: number, name, count, sentence, stack and chips. */
function GroupCard({
  copy,
  doc,
  story,
}: {
  copy: PageCopy;
  doc: SpecValidation;
  story: SpecStoryGroup;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const rows = specRowsOfStory(doc, story.name);
  const totals = specTotalsOf(rows);
  const counts = specStatusCounts(rows);
  const carried = SPEC_STATUSES.filter((status) => counts[status] > 0);

  return (
    <Link
      href={adminSpecGroupPath(story.slug)}
      className="grid gap-2 rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
      data-spec-card={story.slug}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold">{story.name}</h3>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          {fillLabel(words("overview-card-count"), {
            number: story.number,
            met: totals.met,
            total: totals.total,
          })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {adminSpecStoryDescriptions[story.slug] ?? null}
      </p>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        {carried.map((status) => (
          <span
            key={status}
            className={SPEC_STATUS_FILL[status]}
            style={{ width: `${(counts[status] / Math.max(totals.total, 1)) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {carried.map((status) => (
          <SpecStatusChip key={status} status={status} count={counts[status]} />
        ))}
      </div>
    </Link>
  );
}

export function SpecOverview({
  copy,
  doc,
  viewerName,
}: {
  copy: PageCopy;
  doc: SpecValidation;
  /** The signed-in reader's name, from the session — never a fixture person. */
  viewerName: string;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const stories = SPEC_STORY_GROUPS.slice(0, SPEC_STORY_LAST_OF_STORY);
  const around = SPEC_STORY_GROUPS.slice(SPEC_STORY_LAST_OF_STORY);
  const totals = specTotalsOf(specStoryRows(doc));
  /** Three literals at three `pageItemOf` calls, so E23 can see every id the band prints. */
  const steps = [
    { title: words("overview-step-1"), body: words("overview-step-1-body") },
    { title: words("overview-step-2"), body: words("overview-step-2-body") },
    { title: words("overview-step-3"), body: words("overview-step-3-body") },
  ];

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {words("overview-eyebrow")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{words("overview-heading")}</h1>
        <p className="max-w-prose text-sm text-muted-foreground">{words("overview-subtitle")}</p>
      </header>

      <div className="grid items-start gap-4 xl:grid-cols-[212px_minmax(0,1fr)]">
        <SpecStatusBox copy={copy} doc={doc} className="xl:sticky xl:top-0" />

        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border bg-card p-4" aria-labelledby="spec-welcome">
            <h2 id="spec-welcome" className="text-base font-semibold">
              {fillLabel(words("overview-welcome"), { name: viewerName })}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {words("overview-welcome-body")}
            </p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-3">
              {steps.map((step) => (
                <li key={step.title} className="rounded-md border p-3">
                  <p className="text-xs font-bold">{step.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={ADMIN_SPEC_VALIDATION_PATH}
                className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover"
              >
                {words("overview-open-validation")}
              </Link>
              <Link
                href={adminSpecGroupPath(stories[0]?.slug ?? SPEC_STORY_GROUPS[0].slug)}
                className="inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                {words("overview-read-story")}
              </Link>
            </div>
          </section>

          <section className="space-y-2" aria-labelledby="spec-story-band">
            <h2 id="spec-story-band" className="text-base font-semibold">
              {words("overview-story")}
            </h2>
            <div className="grid gap-2 md:grid-cols-2">
              {stories.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {words("story-empty")}
                </p>
              ) : null}
              {stories.map((story) => (
                <GroupCard key={story.slug} copy={copy} doc={doc} story={story} />
              ))}
            </div>
          </section>

          <section className="space-y-2" aria-labelledby="spec-around-band">
            <h2 id="spec-around-band" className="text-base font-semibold">
              {words("overview-around")}
            </h2>
            <div className="grid gap-2 md:grid-cols-2">
              {around.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  {words("story-empty")}
                </p>
              ) : null}
              {around.map((story) => (
                <GroupCard key={story.slug} copy={copy} doc={doc} story={story} />
              ))}
            </div>
          </section>

          <p className="text-xs text-muted-foreground" data-spec-overview-total={totals.total}>
            {fillLabel(words("status-gauge-caption"), { met: totals.met, total: totals.total })}
          </p>
        </div>
      </div>
    </div>
  );
}
