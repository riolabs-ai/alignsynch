// template-ancestor: components/assessment-flow/template-detail.tsx   (variation: the public, signed-out detail page — the same descriptor pair and the same Aspect list with both named ends, read from `data/relationship-types.ts` instead of a database record, with no seat controls, no duplicate/archive actions and one `/register` call to action)

import type { TemplateDetailModel } from "@/lib/template-detail";
import Link from "next/link";

/**
 * `/relationship-types/[slug]` — one relationship type, drawn for a stranger (#794).
 *
 * The order is the order a reader deciding asks in: which relationship this is (name, realm,
 * the two roles), whether it is meant for them (the descriptor pair), what it actually asks
 * (every Aspect, with both ends named), what it costs, and where to start. The descriptor's two
 * sentences are printed at the same weight — the "not for" one is what keeps a dispute out of a
 * conversation aid, so it is not fine print.
 *
 * Holds no words: every string arrives in the model (`lib/template-detail.ts`), which joins
 * `data/pages/templates-detail.ts` with `data/relationship-types.ts`. E23 attributes this
 * directory to that fixture at a budget of 0, so a sentence typed here is a red build.
 *
 * No band reads a clock, a store or a session, and the page module prerenders every slug — this
 * view is a fixture render, which is why a test can call it with no router.
 */
export function TemplateDetail({ model }: { model: TemplateDetailModel }) {
  return (
    <div className="bg-background" data-template-detail={model.slug}>
      {/* The hero: which relationship this is, and the way back to the directory. */}
      <section className="border-b border-border bg-muted/40" data-template-hero="">
        <div className="mx-auto w-full max-w-4xl px-6 py-12 md:py-16">
          <Link
            className="text-[13px] font-semibold text-action hover:underline"
            href={model.back.href}
          >
            {model.back.label}
          </Link>
          <div className="mt-6 flex items-start justify-between gap-3">
            <h1 className="text-[2.25rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-foreground md:text-[42px]">
              {model.name}
            </h1>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              {model.realm}
            </span>
          </div>
          <p className="mt-1 text-[13px] font-medium text-muted-foreground">{model.roles}</p>
        </div>
      </section>

      <section className="bg-background py-14 md:py-16">
        <div className="mx-auto w-full max-w-4xl px-6">
          {/* Who it is for, and who it is not for — one card each, the same weight. */}
          <div className="grid gap-5 sm:grid-cols-2">
            <article
              className="rounded-xl border border-border bg-card p-5"
              data-template-descriptor="for"
            >
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {model.descriptor.forHeading}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground">
                {model.descriptor.forBody}
              </p>
            </article>
            <article
              className="rounded-xl border border-border bg-card p-5"
              data-template-descriptor="not-for"
            >
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {model.descriptor.notForHeading}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-foreground">
                {model.descriptor.notForBody}
              </p>
            </article>
          </div>

          {/* The product: every Aspect, each with both named ends. */}
          <div className="mt-12" data-template-aspects="">
            <h2 className="text-[24px] font-bold leading-[1.2] tracking-[-0.01em] text-foreground md:text-[28px]">
              {model.aspects.heading}
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              {model.aspects.body}
            </p>
            <ol className="mt-8 space-y-4">
              {model.aspects.rows.map((row) => (
                <li
                  className="rounded-xl border border-border bg-card p-5"
                  data-template-aspect={row.id}
                  key={row.id}
                >
                  <p className="text-[15px] font-semibold leading-snug text-foreground">
                    {row.prompt}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">
                      {row.left}
                    </span>
                    <span aria-hidden className="h-1 w-4 rounded-full bg-border" />
                    <span className="rounded-full bg-muted px-2.5 py-0.5 font-medium">
                      {row.right}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* The price, the one action, and the example when the fixture holds one. */}
          <div
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border bg-card p-5"
            data-template-action=""
          >
            <p className="text-[15px] font-semibold tabular-nums text-foreground">
              {model.priceNote}
            </p>
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-action px-6 py-3 text-[15px] font-bold text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-2"
              href={model.start.href}
            >
              {model.start.label}
            </Link>
            {model.example && (
              <Link
                className="text-[13px] font-semibold text-action hover:underline"
                href={model.example.href}
              >
                {model.example.label}
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default TemplateDetail;
