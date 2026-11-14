// template-ancestor: components/home/alignment-home.tsx   (variation: the `#questions` composition as an ordered wizard — the same heading/body pair per band, numbered, with two halves beside each other; since #898 the bands are the recorded walk's own steps rather than drawn ones, and the two halves are what the persona entered beside what the product answered)

"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

import type { PageCopy, PageCopySection } from "@/content/pages";
import type { DemoFlow, DemoFlowAction, DemoFlowPathName } from "@/lib/demo-flow/types";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * `/how-it-works` — the onboarding page, replayed (#898) — and the six moves it is framed by.
 *
 * The ancestor is the alignment front page's `#questions` band (`components/home/
 * alignment-home.tsx`): a heading, a paragraph, and a two-up pair. This is that composition turned
 * into a sequence — one band per step, numbered, two halves side by side — and since #898 the
 * recorded bands are not written here at all: they are the steps of a walk a browser really made
 * (`docs/qa-demo-flow/transcript.json`), so the left half is the values the persona typed and the
 * right half is the screenshot the product answered with. The page cannot describe a flow the
 * product no longer performs, because the steps come from the recording that
 * `pnpm demo:flow:check` holds to a fresh run.
 *
 * **Two mounts, one fixture.** `/how-it-works` passes the recording; `/dashboard/help` renders the
 * same copy without it, because a signed-in reader who opens Help wants the moves and the tour
 * replay and the walk is a second errand. Both are this component over
 * `data/pages/how-it-works.ts`; a second mount that skips the recording is an omitted optional
 * `flow`, not a copy of the surface. That is why `RecordedWalk` is a band inside the page rather
 * than the page itself.
 *
 * A client component because the three paths are switchable — one tab per path, and the step list is
 * the selected path's. It holds no words: every string arrives from the fixture (E23 holds this file
 * at 0 literals) or from the transcript, and the vocabularies it joins on (paths, actions, form
 * fields, column headings, verdicts) are fixture bands resolved by literal id — which is what keeps
 * a rename a red build rather than a blank label.
 *
 * **Why the switch is written out.** `pathLabel(paths, "create-draft")` reaches an `itemLabel` call
 * E23 can read and resolve; `itemLabel(paths, path)` would take every path out of that gate, and a
 * path the fixture does not name would render an empty tab instead of failing. The same holds for an
 * action and a form-field key — a key the run invents falls back to the transcript's own spelling,
 * because a value the product stored must still be shown.
 */
export function HowItWorks({
  copy,
  flow,
  signedIn,
}: {
  copy: PageCopy;
  /** The recording, on the mount that replays it. Omitted by `/dashboard/help`. */
  flow?: DemoFlow;
  /** `false` only when the mount knows the reader is a stranger; Help sits behind `requireRole`. */
  signedIn?: boolean;
}) {
  const labels = sectionOf(copy, "labels");
  const moves = sectionOf(copy, "moves");
  const movesSections = [
    sectionOf(copy, "step-template"),
    sectionOf(copy, "step-invite"),
    sectionOf(copy, "step-answer"),
    sectionOf(copy, "step-accept"),
    sectionOf(copy, "step-report"),
    sectionOf(copy, "step-next"),
  ];
  const limits = sectionOf(copy, "limits");

  const youLabel = itemLabel(labels, "you");
  const productLabel = itemLabel(labels, "product");
  const stepLabel = itemLabel(labels, "step");

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-foreground">{copy.heading}</h1>
        {copy.subtitle && (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
        <div className="flex flex-wrap gap-3">
          {copy.cta && (
            <Link
              href={copy.cta.href}
              className="inline-flex items-center rounded-lg bg-action px-4 py-2 text-sm font-semibold text-action-foreground transition-opacity hover:opacity-90"
            >
              {copy.cta.label}
            </Link>
          )}
          {/* A signed-out reader has no relationships to go back to, and a door to a login wall is
              the defect #794 fixed on this page's own CTA. The fixture keeps the row; the mount
              decides — the same split `withoutHiddenCta` makes for the shell's nav. */}
          {signedIn !== false && copy.secondaryCta && (
            <Link
              href={copy.secondaryCta.href}
              className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-accent"
            >
              {copy.secondaryCta.label}
            </Link>
          )}
        </div>
      </header>

      {flow && <RecordedWalk copy={copy} flow={flow} />}

      {/* The six moves: the part of the relationship the recording does not walk. */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{moves.heading}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sectionBody(moves)}</p>
        </div>
        <ol className="space-y-4">
          {movesSections.map((step, index) => (
            <li
              key={step.id}
              className="rounded-xl border border-border bg-card p-5 md:p-6"
              data-step={step.id}
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-nav-active text-sm font-semibold text-action-foreground"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {fillLabel(stepLabel, { number: index + 1 })}
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">{step.heading}</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {youLabel}
                      </p>
                      <p className="mt-1 text-sm text-foreground">{sectionBody(step)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {productLabel}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {itemLabel(step, "product")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/*
        The honest half: what this build does not do. Drawn as a headed band rather than a step,
        because a limit is not a move a reader takes, and it is the last thing on the page on
        purpose — a reader who stops after the sequence still sees it.
      */}
      <section className="rounded-xl border border-dashed border-border p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">{limits.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{sectionBody(limits)}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {(limits.items ?? []).map((limit) => (
            <li key={limit.id}>{limit.label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * The recording, played back: what the run is, the three paths it took, one band per step of the
 * selected path, and what it found on that path.
 *
 * Separate from the page because the page has a second mount that has no recording — and because the
 * state (which path is open) belongs to the part that can change, not to the six moves that cannot.
 */
function RecordedWalk({ copy, flow }: { copy: PageCopy; flow: DemoFlow }) {
  const labels = sectionOf(copy, "labels");
  const demo = sectionOf(copy, "demo");
  const pathsCopy = sectionOf(copy, "paths");
  const actions = sectionOf(copy, "actions");
  const columns = sectionOf(copy, "columns");
  const fields = sectionOf(copy, "fields");
  const findingsCopy = sectionOf(copy, "findings");

  const [activePath, setActivePath] = useState<DemoFlowPathName>(flow.paths[0].path);
  const active = flow.paths.find((candidate) => candidate.path === activePath) ?? flow.paths[0];
  const pathFindings = flow.findings.filter((finding) => finding.path === active.path);
  const held = active.steps.filter((step) => step.ok).length;

  return (
    <div className="space-y-6">
      {/*
        What the recording is, and the run's own counts. The numbers are the transcript's `summary`
        and `cleanup` blocks — a figure typed here would be the first thing to go stale.
      */}
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">{demo.heading}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sectionBody(demo)}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          <li className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            {fillLabel(itemLabel(demo, "paths"), { count: flow.run.paths })}
          </li>
          <li className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            {fillLabel(itemLabel(demo, "steps"), { count: flow.run.steps })}
          </li>
          <li className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            {fillLabel(itemLabel(demo, "findings"), { count: flow.run.findings })}
          </li>
          <li className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
            {fillLabel(itemLabel(demo, "left-behind"), { count: flow.run.leftBehind })}
          </li>
        </ul>
      </section>

      {/* The three paths, switchable. A path is a state the same flow can end in, not a happy path. */}
      <section className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">{pathsCopy.heading}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{sectionBody(pathsCopy)}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {flow.paths.map((path) => {
            const isActive = path.path === active.path;
            return (
              <button
                key={path.path}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActivePath(path.path)}
                className={
                  isActive
                    ? "inline-flex flex-wrap items-baseline gap-2 rounded-lg bg-action px-3 py-2 text-sm font-semibold text-action-foreground"
                    : "inline-flex flex-wrap items-baseline gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                }
              >
                <span>{pathLabel(pathsCopy, path.path)}</span>
                <span className="text-xs font-medium opacity-80">
                  {fillLabel(itemLabel(pathsCopy, "step-count"), { count: path.steps.length })}
                </span>
              </button>
            );
          })}
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {itemLabel(pathsCopy, "terminal")}
            </dt>
            <dd className="mt-1 break-words text-foreground">{active.terminal}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {itemLabel(labels, "step")}
            </dt>
            <dd className="mt-1 text-foreground">
              {active.reached ? itemLabel(pathsCopy, "reached") : itemLabel(pathsCopy, "stopped")}
            </dd>
          </div>
        </dl>

        <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{itemLabel(columns, "held")}</dt>
            <dd className="font-semibold text-foreground">{held}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{itemLabel(columns, "missed")}</dt>
            <dd className="font-semibold text-foreground">{active.steps.length - held}</dd>
          </div>
        </dl>
      </section>

      {/*
        The recording. `<ol>` because the order is the content — a wizard read out of order is a
        different product — and each band's number is the transcript's own step, so a quotation in a
        review can be traced back to one line of the JSON. A path with no steps is a recording that
        stopped before it walked one (rule 7): the space gets the bordered block, never blank.
      */}
      {active.steps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          {itemLabel(pathsCopy, "no-steps")}
        </p>
      ) : (
        <ol className="space-y-4">
          {active.steps.map((step) => (
            <li
              key={step.step}
              className="rounded-xl border border-border bg-card p-5 md:p-6"
              data-step={step.step}
              data-path={step.path}
            >
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-nav-active text-sm font-semibold text-action-foreground"
                >
                  {step.step}
                </span>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-semibold text-foreground">
                      {actionLabel(actions, step.action)}
                    </span>
                    <span
                      className={
                        step.ok
                          ? "rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                          : "rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive"
                      }
                    >
                      {step.ok ? itemLabel(columns, "held") : itemLabel(columns, "missed")}
                    </span>
                    <code className="min-w-0 break-all rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {step.route}
                    </code>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.45fr)]">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {itemLabel(columns, "entered")}
                      </p>
                      {step.values.length > 0 ? (
                        <dl className="mt-2 space-y-1.5">
                          {step.values.map((value) => (
                            <div
                              key={value.key}
                              className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-x-3 text-sm"
                            >
                              <dt className="text-muted-foreground">
                                {fieldLabel(fields, value.key)}
                              </dt>
                              <dd className="break-words text-foreground">{value.value}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {itemLabel(columns, "nothing-entered")}
                        </p>
                      )}
                    </div>

                    {/*
                    The screen. A static file: the route serves the PNG the run committed, and the
                    transcript's own `w`/`h` are the intrinsic size `next/image` needs — without them
                    dev answers 500 while `next build` stays green. The frame scrolls because a
                    capture of a long page is a long image, and cropping it would hide the point.
                  */}
                    <figure className="min-w-0">
                      <figcaption className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {itemLabel(columns, "appeared")}
                      </figcaption>
                      <div className="mt-2 max-h-80 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-muted">
                        <Image
                          src={step.shot.src}
                          alt={step.expect}
                          width={step.shot.width}
                          height={step.shot.height}
                          sizes="(max-width: 1024px) 100vw, 55vw"
                          className="h-auto w-full"
                        />
                      </div>
                    </figure>
                  </div>

                  <p className="border-l-2 border-border pl-3 text-sm text-muted-foreground">
                    {step.expect}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/*
        What the run found on this path. Kept in the transcript as it happened, so the page reports
        it rather than smoothing it over; the quoted screen text sits behind a disclosure because the
        run records the whole page, chrome and all.
      */}
      {pathFindings.length > 0 && (
        <section className="rounded-xl border border-dashed border-border p-5 md:p-6">
          <h2 className="text-lg font-semibold text-foreground">{findingsCopy.heading}</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {sectionBody(findingsCopy)}
          </p>
          <ol className="mt-4 space-y-4">
            {pathFindings.map((finding) => (
              <li key={finding.n} className="grid gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {itemLabel(findingsCopy, "expected")}
                    </p>
                    <p className="mt-1 break-words text-sm text-foreground">{finding.expected}</p>
                  </div>
                  {finding.note && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {itemLabel(findingsCopy, "note")}
                      </p>
                      <p className="mt-1 break-words text-sm text-muted-foreground">
                        {finding.note}
                      </p>
                    </div>
                  )}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      {itemLabel(findingsCopy, "quoted")}
                    </summary>
                    <p className="mt-2 break-words text-xs text-muted-foreground">
                      {finding.actual}
                    </p>
                  </details>
                </div>
                {finding.shot ? (
                  <div className="min-w-0">
                    <div className="max-h-64 overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-muted">
                      <Image
                        src={finding.shot.src}
                        alt={finding.title}
                        width={finding.shot.width}
                        height={finding.shot.height}
                        sizes="(max-width: 768px) 100vw, 45vw"
                        className="h-auto w-full"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="min-w-0 text-xs text-muted-foreground">
                    {itemLabel(findingsCopy, "no-shot")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * The fixture's word for a path. A switch, not a lookup by value: E23 resolves the ids written here,
 * and a path the recording invents cannot render as a nameless tab.
 */
function pathLabel(section: PageCopySection, path: DemoFlowPathName): string {
  switch (path) {
    case "create-published":
      return itemLabel(section, "create-published");
    case "create-draft":
      return itemLabel(section, "create-draft");
    case "unpaid":
      return itemLabel(section, "unpaid");
  }
}

/** The fixture's word for what the run did at a step. */
function actionLabel(section: PageCopySection, action: DemoFlowAction): string {
  switch (action) {
    case "fill":
      return itemLabel(section, "fill");
    case "click":
      return itemLabel(section, "click");
    case "assert":
      return itemLabel(section, "assert");
  }
}

/**
 * The fixture's name for a form field, from the transcript's own key. An unknown key comes back as
 * itself: a field the run filled must show its value even when nobody has written a label for it yet,
 * and the transcript's key is the honest name for it.
 */
function fieldLabel(section: PageCopySection, key: string): string {
  switch (key) {
    case "title":
      return itemLabel(section, "title");
    case "initiatorFirst":
      return itemLabel(section, "initiator-first");
    case "initiatorLast":
      return itemLabel(section, "initiator-last");
    case "counterpartyFirst":
      return itemLabel(section, "counterparty-first");
    case "counterpartyLast":
      return itemLabel(section, "counterparty-last");
    case "email":
      return itemLabel(section, "email");
    case "description":
      return itemLabel(section, "description");
    case "mode":
      return itemLabel(section, "mode");
    case "alignmentSetting":
      return itemLabel(section, "alignment-setting");
    case "pin":
      return itemLabel(section, "pin");
    case "role":
      return itemLabel(section, "role");
    case "plan":
      return itemLabel(section, "plan");
    default:
      return key;
  }
}
