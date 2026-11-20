// template-ancestor: components/templates/template-detail.tsx   (variation: the member's own template page — inside the shell, so no marketing footer, no catalogue breadcrumb; a category · aspects · minutes · people chip row instead of realm · count · roles, and a Save to My Templates action beside Create Relationship)

import Link from "next/link";
import type { ReactNode } from "react";

import type { TemplatePageModel } from "@/lib/member/template-page";

/**
 * `/templates/relationship/[slug]` — one template, in the member's app (#1259).
 *
 * The sibling of the public `TemplateDetail`, and deliberately not the same component: bundle 06's
 * in-app page is read by somebody who is already signed in and is deciding whether to start a
 * relationship with it, so it carries the Library's chip row (shelf · Aspects · minutes · people),
 * **two** actions (Create Relationship, and Save to My Templates), and no door back to a public
 * catalogue. The public page sells a relationship type to a stranger; this page is the shelf's
 * `View Details`, inside the shell.
 *
 * The bands, in bundle 06's order: a page header card under the brand's rule strip, then a
 * two-column body — Who It's For and the Aspects on the locked 1–5 scale — beside a sticky aside
 * (start panel, the trial panel, How It Works), and a closing band that repeats the one action.
 *
 * **Holds no words.** Every string is the model's (`lib/member/template-page.ts`), and a sentence
 * typed here is a red build: `data/pages/template-page.ts` is this surface's fixture at budget 0.
 *
 * A server component: the page has no client state, and the one write it carries (Save to My
 * Templates) is a form posting the shipped `clonePublic` writer.
 */
export function TemplatePage({
  model,
  save,
}: {
  model: TemplatePageModel;
  /** The `Save to My Templates` writer, as a form action — the page supplies it. */
  save: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-4" data-template-page={model.slug}>
      <section className="overflow-hidden rounded-lg border bg-card" data-template-hero>
        <div className="flex h-1" aria-hidden="true">
          <span className="flex-1 bg-action" />
          <span className="w-1/4 bg-deep/60" />
          <span className="w-1/6 bg-accent/50" />
        </div>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep">
              <TemplateGlyph />
              {model.kicker}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-primary">{model.name}</h1>
            <p className="text-base text-foreground">{model.summary}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {model.chips.map((chip) => (
                <Badge key={chip}>{chip}</Badge>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <CreateAction model={model} />
            <form action={save}>
              <input name="templateId" type="hidden" value={model.save.templateId} />
              <input name="slug" type="hidden" value={model.slug} />
              <button
                className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10"
                data-template-save
                type="submit"
              >
                {model.save.label}
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-4">
          <section className="rounded-lg border bg-card p-4 lg:p-5" data-template-for>
            <h2 className="text-base font-semibold tracking-tight text-primary">
              {model.descriptor.forHeading}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {model.descriptor.forBody}
            </p>
            {model.descriptor.notForBody === undefined ? null : (
              <div className="mt-3 rounded-md border border-status-line bg-status p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-deep">
                  {model.descriptor.notForHeading}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {model.descriptor.notForBody}
                </p>
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-card p-4 lg:p-5" data-template-aspects>
            <h2 className="text-base font-semibold tracking-tight text-primary">
              {model.aspects.heading}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{model.aspects.body}</p>

            {model.aspects.empty === null ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-status-line bg-status px-3 py-2 text-sm">
                  <span className="font-medium text-foreground">{model.aspects.legend.lead}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge>{model.aspects.legend.feel}</Badge>
                    <Badge>{model.aspects.legend.wish}</Badge>
                  </span>
                  <span className="text-xs text-muted-foreground">{model.aspects.advanced}</span>
                </div>

                <ol className="mt-3 divide-y rounded-lg border">
                  {model.aspects.rows.map((row) => (
                    <li
                      className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-6"
                      data-template-aspect={row.id}
                      key={row.id}
                    >
                      <div className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-mist text-xs font-semibold text-primary">
                          {row.ordinal}
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground">{row.prompt}</h3>
                        </div>
                      </div>
                      <div>
                        {/* The locked 1–5 scale, drawn as the answer sheet draws it: five
                            numbered cells, so a reader sees the shape of the question before
                            they answer it. */}
                        <div className="grid h-5 grid-cols-5 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10">
                          {SCALE_FILLS.map((fill, index) => (
                            <span
                              className={`flex items-center justify-center ${fill} text-xs font-medium leading-none text-foreground`}
                              key={fill}
                            >
                              {index + 1}
                            </span>
                          ))}
                        </div>
                        <div className="mt-1 flex justify-between gap-2 text-xs text-muted-foreground">
                          <span>{row.left}</span>
                          <span className="text-right">{row.right}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <div
                className="mt-3 rounded-md border border-status-line bg-status p-4"
                data-template-aspects-empty
              >
                <p className="text-sm font-semibold text-foreground">
                  {model.aspects.empty.heading}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{model.aspects.empty.body}</p>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section className="rounded-lg border bg-card p-4" data-template-start-panel>
            <h2 className="text-base font-semibold text-primary">{model.startPanel.heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{model.startPanel.body}</p>
            <div className="mt-3">
              <CreateAction block model={model} />
            </div>
          </section>

          <section
            className="rounded-lg border border-billing-line bg-billing p-4"
            data-template-trial
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CardGlyph />
              {model.trial.heading}
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {model.trial.items.map((item) => (
                <li className="flex items-start gap-2" key={item}>
                  <CheckGlyph />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-status-line bg-status p-4" data-template-how>
            <h2 className="text-sm font-semibold text-primary">{model.how.heading}</h2>
            <ol className="mt-3 space-y-3">
              {model.how.steps.map((step) => (
                <li className="flex gap-3" key={step.id}>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mist px-1.5 text-xs font-semibold text-primary">
                    {step.ordinal}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>

      <section
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between lg:px-6"
        data-template-closing
      >
        <p className="text-base font-semibold text-primary">{model.closing.heading}</p>
        <CreateAction model={model} />
      </section>

      <p className="pb-2">
        <Link
          className="inline-flex h-11 items-center text-sm font-medium text-action hover:underline"
          href={model.back.href}
        >
          {model.back.label}
        </Link>
      </p>
    </div>
  );
}

/**
 * The five scale fills, spelled out rather than composed: Tailwind's extractor reads literal class
 * names, so `bg-scale-${n}` would ship no CSS for four of the five cells.
 */
const SCALE_FILLS = ["bg-scale-1", "bg-scale-2", "bg-scale-3", "bg-scale-4", "bg-scale-5"] as const;

/** The page's one action, drawn three times — header, aside, closing band — and never two doors. */
function CreateAction({ model, block = false }: { model: TemplatePageModel; block?: boolean }) {
  return (
    <Link
      className={`inline-flex h-11 items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10${block ? " w-full" : ""}`}
      data-template-create={model.slug}
      href={model.create.href}
    >
      {model.create.label}
    </Link>
  );
}

/** A pill: the header's four chips and the Aspects legend's two. */
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">
      {children}
    </span>
  );
}

/** The kicker's mark. */
function TemplateGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="m16 6 4 14" />
      <path d="M12 6v14" />
      <path d="M8 8v12" />
      <path d="M4 4v16" />
    </svg>
  );
}

/** The trial panel's mark — a card, because that is what the panel is about. */
function CardGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-billing-ink"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="14" rx="2" width="20" x="2" y="5" />
      <path d="M2 10h20" />
    </svg>
  );
}

/** The tick the trial panel's lines share. */
function CheckGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-billing-ink"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
