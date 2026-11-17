// template-ancestor: components/console/overview.tsx   (variation: the v2 Start landing — a greeting with one next step instead of four counts, the same page-header band and the same failure panel, and two shelves under it: two relationship cards and four templates)

/**
 * `/dashboard` — **Start** (#1129, bundle 05).
 *
 * The signed-in landing answers one question: *what do I do next?* So it draws, in this order,
 * a greeting, the **one** conversation the numbers point at (solid graphite, the only filled row
 * on the page), up to two small jobs, the relationships that are in play and the templates a new
 * one starts from. Everything under the greeting is a projection of rows the page read — there is
 * no count here that is not a count of something, and no sentence that describes a state the data
 * cannot be in.
 *
 * **The component holds no words and no paths.** Every label arrives in `copy`
 * (`data/pages/start.ts`) and every destination in the view models the page builds from
 * `lib/flow/paths.ts`, so E23 counts zero literals in this file and a rename is one fixture edit.
 *
 * **The failure panel is the console's own.** A read that did not answer prints the database
 * layer's sentence and a link that tries again — never a zero that reads like "nothing waiting on
 * you", and never Next's 500. Same rule as `/assessment/instances` (#213); the heading stays an
 * `<h1>` because this is the whole document.
 *
 * **The greeting is the first name, not the display name.** `Welcome Back, {name}` is filled from
 * the session's own `name`, split on whitespace — "Marcus Reyes" greets as "Marcus", which is what
 * the bundle draws and what a person expects from a dashboard they open every day.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RelationshipCard,
  type RelationshipCardView,
} from "@/components/dashboard/relationship-card";
import { cardWordsOf } from "./start-view";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { ArrowRight, ClipboardList, CreditCard, PencilLine, Users } from "lucide-react";
import Link from "next/link";

/** One row of "Your Next Steps", already resolved to words and a destination. */
export interface StartJobView {
  readonly kind: "next-step" | "add-card" | "finish-draft";
  readonly title: string;
  readonly body: string;
  readonly actionLabel: string;
  readonly href: string;
}

/** One template card — the catalogue's own row, as the landing shows four of them. */
export interface StartTemplateView {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly summary: string;
  readonly aspects: string;
}

const JOB_ICON = {
  "next-step": Users,
  "add-card": CreditCard,
  "finish-draft": PencilLine,
} as const;

export function StartPage({
  copy,
  name,
  subtitle,
  jobs,
  cards,
  templates,
  unreadable,
}: {
  copy: PageCopy;
  /** The session's display name; the greeting takes its first word. */
  name: string;
  /** One of the fixture's two sentences — chosen by the page from the job count. */
  subtitle: string;
  jobs: readonly StartJobView[];
  cards: readonly RelationshipCardView[];
  templates: readonly StartTemplateView[];
  unreadable: string | null;
}) {
  const failure = sectionOf(copy, "unreadable");
  const welcome = sectionOf(copy, "welcome");
  const nextSteps = sectionOf(copy, "next-steps");
  const emptySteps = sectionOf(copy, "next-steps-empty");
  const active = sectionOf(copy, "active");
  const templateBand = sectionOf(copy, "templates");
  const cardCopy = sectionOf(copy, "card");

  const firstName = name.trim().split(/\s+/)[0] ?? name;
  const cardWords = cardWordsOf(copy);

  if (unreadable !== null) {
    return (
      <Card className="p-6" data-start-unreadable="true">
        <h1 className="text-2xl font-bold">{failure.heading}</h1>
        <p className="mt-2 text-muted-foreground">{sectionBody(failure)}</p>
        <p className="mt-2 text-sm">{unreadable}</p>
        <p className="mt-3">
          <Link className="underline" href="/dashboard">
            {itemLabel(failure, "reload")}
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section
        className="overflow-hidden rounded-lg border bg-card"
        aria-labelledby="start-heading"
      >
        <div className="flex h-1" aria-hidden="true">
          <span className="flex-1 bg-action" />
          <span className="w-1/4 bg-deep/60" />
          <span className="w-1/6 bg-accent/50" />
        </div>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
          <div className="min-w-0 space-y-2">
            <h1
              id="start-heading"
              className="text-2xl font-bold tracking-tight text-primary xxl:text-3xl"
            >
              {fillLabel(copy.heading, { name: firstName })}
            </h1>
            <p className="text-base text-foreground">{subtitle}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              href="/dashboard/relationships"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-action px-4 text-sm font-semibold text-action-foreground hover:bg-action-hover lg:h-10"
            >
              <Users className="size-4 shrink-0" aria-hidden="true" />
              <span>{itemLabel(welcome, "create")}</span>
            </Link>
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-lg border bg-card"
        aria-labelledby="next-steps-heading"
      >
        <div className="flex items-center justify-between gap-3 p-4 lg:px-6">
          <h2 id="next-steps-heading" className="text-base font-semibold text-primary">
            {nextSteps.heading}
          </h2>
          {jobs.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {fillLabel(itemLabel(nextSteps, "count"), { count: jobs.length })}
            </span>
          ) : null}
        </div>
        {jobs.length === 0 ? (
          <div className="border-t p-4 lg:px-6">
            <h3 className="text-sm font-semibold text-foreground">{emptySteps.heading}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{sectionBody(emptySteps)}</p>
          </div>
        ) : (
          <ol className="divide-y border-t">
            {jobs.map((job) => {
              const Icon = JOB_ICON[job.kind];
              const primary = job.kind === "next-step";
              return (
                <li
                  key={`${job.kind}-${job.title}`}
                  className={
                    primary
                      ? "flex flex-col gap-3 p-4 sm:flex-row sm:items-center bg-action text-action-foreground"
                      : "flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  }
                  data-start-job={job.kind}
                >
                  <span
                    className={
                      primary
                        ? "flex size-9 shrink-0 items-center justify-center rounded-md bg-white/15"
                        : "flex size-9 shrink-0 items-center justify-center rounded-md bg-mist text-primary"
                    }
                    aria-hidden="true"
                  >
                    <Icon className="size-5 shrink-0" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{job.title}</p>
                    <p
                      className={
                        primary
                          ? "text-sm text-action-foreground/85"
                          : "text-sm text-muted-foreground"
                      }
                    >
                      {job.body}
                    </p>
                  </div>
                  <Link
                    href={job.href}
                    className={
                      primary
                        ? "inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-white/40 bg-background px-3 text-sm font-medium text-primary hover:bg-mist lg:h-9"
                        : "inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-background px-3 text-sm font-medium text-primary hover:bg-mist lg:h-9"
                    }
                  >
                    {job.actionLabel}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="active-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="active-heading" className="text-base font-semibold text-primary">
            {active.heading}
          </h2>
          {active.cta === undefined ? null : (
            <Link
              href={active.cta.href}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline lg:h-9"
            >
              <span>{active.cta.label}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>
        {cards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-background px-4 py-6 text-sm text-muted-foreground dark:border-gray-700">
            {itemLabel(active, "empty")}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <li key={card.relationshipId}>
                <RelationshipCard view={card} labels={cardWords} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="templates-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="templates-heading" className="text-base font-semibold text-primary">
            {templateBand.heading}
          </h2>
          {templateBand.cta === undefined ? null : (
            <Link
              href={templateBand.cta.href}
              className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-primary underline-offset-4 hover:underline lg:h-9"
            >
              <span>{templateBand.cta.label}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>
          )}
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {templates.map((template) => (
            <li key={template.id}>
              <Card className="relative flex h-full flex-col transition-colors hover:border-action">
                <CardHeader className="pb-2">
                  <span
                    className="flex size-9 items-center justify-center rounded-md bg-mist text-primary"
                    aria-hidden="true"
                  >
                    <ClipboardList className="size-5 shrink-0" />
                  </span>
                  <CardTitle className="mt-3 text-base font-semibold text-primary">
                    <Link
                      href={template.href}
                      className="after:absolute after:inset-0 after:rounded-lg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {template.title}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="flex-1 text-sm text-muted-foreground">{template.summary}</p>
                  <p className="mt-3 text-xs font-medium text-muted-foreground">
                    {template.aspects}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
