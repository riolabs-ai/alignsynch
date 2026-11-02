// template-ancestor: components/ui/card.tsx   (variation: hand-rolled bands — heading, copy and a grid of cards — over the alignment brand's own record, no quiz shelves and no shadcn Card, because every band's words arrive pre-joined from one model)

import type { AlignmentCard, AlignmentHomeModel, AlignmentTemplate } from "@/lib/alignment-home";
import Image from "next/image";
import Link from "next/link";

/**
 * The AlignSynch front page, drawn — the other composition of `/` (issue #143).
 *
 * This file holds no words. Every string it prints arrives in the model
 * (`lib/alignment-home.ts`), which joins `data/pages/home-alignsynch.ts` with
 * `data/assessments.ts` and counts `data/v1/relationship-types.ts`, and every colour and the
 * mark arrive on the same object, read from `data/brand.ts` — so a skin is a record, and this
 * component cannot pick a palette or spell a product name. `data:check` E23 counts the leaf
 * literals in `components/home/**` and holds them at 0; a sentence or a label typed here is a
 * red build, not a review comment.
 *
 * The six anchor ids on the bands below (`practice`, `questions`, `templates`, `families`,
 * `seats`, `boundary`) are the one thing it does name, because an anchor target is markup
 * rather than copy (E23's `TECHNICAL_ATTRIBUTES`): the shell's AlignSynch menu links to
 * `/#templates` and `/#questions` (issue #156), and `tests/nav-brand.test.ts` holds every
 * `/#…` href to an `id` this page emits, so a band cannot be renamed out from under a link.
 *
 * The order is the argument. The page leads with the practice — the cycle of Create, Invite,
 * Run — because that is what a practitioner buys; the two questions, the templates and the
 * scope are the proof underneath it (the Gap is real, and the catalogue is finite); the seats
 * band says who the reader is on the relationship; and the last band states what the page
 * refuses to claim. Nothing here counts clients, money or praise, and the component has no
 * shape to render one: the model carries no such field.
 *
 * A template links to its relationship only when one answered it — the row that nobody answered
 * carries a note instead, because `/assessment/[slug]` renders an instance and a link to a
 * template with no instance is a 404 dressed as a door.
 *
 * A server component with no state: nothing here reads a clock, a store or an env var, so the
 * prerendered markup is the whole screen and a test can read it with `renderToStaticMarkup`.
 */
export function AlignmentHomeView({ model }: { model: AlignmentHomeModel }) {
  return (
    <div className="space-y-4 pb-8 xl:space-y-8">
      <section className="rounded-xl border border-gray-200 bg-white p-6 md:p-10 dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-4">
            {model.brand.mark && (
              /**
               * The mark, cropped out of the brand's lockup, with the name set in type
               * beside it — the same shape `components/layout/sidebar.tsx` draws, and for
               * the same reason: the lockup's wordmark is black on nothing, so drawing the
               * whole file on a dark panel leaves a ghost "Synch" and no "Align". The name
               * is `brand.name`, the crop is the mark's first 40 px, and neither is
               * spelled here.
               */
              <div className="flex items-center gap-3">
                <span className="block h-9 w-12 shrink-0 overflow-hidden">
                  <Image
                    alt=""
                    className="h-9 w-auto max-w-none"
                    height={model.brand.mark.height}
                    priority
                    src={model.brand.mark.src}
                    width={model.brand.mark.width}
                  />
                </span>
                <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {model.brand.name}
                </span>
              </div>
            )}
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl xl:text-5xl">
              {model.hero.heading}
            </h1>
            {model.hero.subtitle && (
              <p className="text-lg text-gray-600 dark:text-gray-300">{model.hero.subtitle}</p>
            )}
            {model.hero.cta && (
              <Link
                className="inline-flex items-center rounded-lg px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                href={model.hero.cta.href}
                style={{
                  backgroundColor: model.brand.primary,
                  color: model.brand.primaryForeground,
                }}
              >
                {model.hero.cta.label}
              </Link>
            )}
            {model.hero.fineprint && (
              <p className="max-w-xl text-sm text-gray-500 dark:text-gray-400">
                {model.hero.fineprint}
              </p>
            )}
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-3">
            <div
              className="rounded-lg px-4 py-3 text-center text-sm font-semibold"
              style={{
                backgroundColor: model.brand.primary,
                color: model.brand.primaryForeground,
              }}
            >
              {model.sides.you}
            </div>
            <div
              className="rounded-lg px-4 py-3 text-center text-sm font-semibold"
              style={{
                backgroundColor: model.brand.accent,
                color: model.brand.accentForeground,
              }}
            >
              {model.sides.them}
            </div>
          </div>
        </div>
      </section>

      {/* The cycle a practice runs: create once, invite both sides, run the session. */}
      <section
        id="practice"
        className="scroll-mt-24 space-y-4 rounded-xl border border-gray-200 p-6 dark:border-gray-800"
      >
        {model.practice.heading && (
          <h2 className="text-2xl font-bold tracking-tight">{model.practice.heading}</h2>
        )}
        {model.practice.body && (
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            {model.practice.body}
          </p>
        )}
        <ol className="grid gap-4 md:grid-cols-3">
          {model.practice.items.map((step, index) => (
            <li
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              key={step.id}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-full text-xs font-bold"
                style={{
                  backgroundColor: model.brand.accent,
                  color: model.brand.accentForeground,
                }}
              >
                {index + 1}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {step.label}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* The `#questions` band: "How it works" in the shell's nav points here. */}
      <section
        id="questions"
        className="scroll-mt-24 space-y-4 rounded-xl border border-gray-200 p-6 dark:border-gray-800"
      >
        {model.questions.heading && (
          <h2 className="text-2xl font-bold tracking-tight">{model.questions.heading}</h2>
        )}
        {model.questions.body && (
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            {model.questions.body}
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {model.questions.items.map((question) => (
            <article
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              key={question.you}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {model.sides.you}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {question.you}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {model.sides.them}
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {question.them}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{question.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* The `#templates` band: "Templates" in the shell's nav points here. */}
      <section
        id="templates"
        className="scroll-mt-24 space-y-4 rounded-xl border border-gray-200 p-6 dark:border-gray-800"
      >
        {model.templates.heading && (
          <h2 className="text-2xl font-bold tracking-tight">{model.templates.heading}</h2>
        )}
        {model.templates.body && (
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            {model.templates.body}
          </p>
        )}
        <ul className="grid gap-4 md:grid-cols-2">
          {model.templates.items.map((template) => (
            <li
              className="flex flex-col justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              data-template={template.slug}
              key={template.id}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {template.title}
                  </h3>
                  {template.type && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: model.brand.accent,
                        color: model.brand.accentForeground,
                      }}
                    >
                      {template.type}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {template.aspects}
                </p>
              </div>
              <div className="mt-4">
                {template.link ? (
                  <Link
                    className="text-sm font-semibold hover:underline"
                    href={template.link.href}
                    style={{ color: model.brand.primary }}
                  >
                    {template.link.label}
                  </Link>
                ) : (
                  template.note && (
                    <div>
                      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                        {template.note.label}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {template.note.body}
                      </p>
                    </div>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/*
        The scope band. The heading and the realm counts are the fixture's numbers, counted by
        `lib/alignment-home.ts` — nothing here could round one or add a "+": the component has no
        string to add and no arithmetic of its own.
      */}
      <section
        id="families"
        className="scroll-mt-24 space-y-4 rounded-xl border border-gray-200 p-6 dark:border-gray-800"
      >
        {model.families.heading && (
          <h2 className="text-2xl font-bold tracking-tight">{model.families.heading}</h2>
        )}
        {model.families.body && (
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            {model.families.body}
          </p>
        )}
        <ul className="flex flex-wrap gap-2">
          {model.families.scope.byRealm.map((realm) => (
            <li
              className="rounded-full border border-gray-200 px-3 py-1 text-sm dark:border-gray-800"
              key={realm.realm}
            >
              <span className="font-semibold text-gray-900 dark:text-gray-100">{realm.realm}</span>
              <span className="ml-2 font-semibold text-gray-500 dark:text-gray-400">
                {realm.count}
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 md:grid-cols-2">
          {model.families.items.map((family) => (
            <article
              className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
              data-family={family.name}
              key={family.name}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {family.name}
              </h3>
              <ul className="mt-3 space-y-3">
                {family.types.map((type: AlignmentTemplate) => (
                  <li key={type.id}>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {type.type}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{type.title}</p>
                    {type.link && (
                      <Link
                        className="mt-1 inline-block text-sm font-semibold hover:underline"
                        href={type.link.href}
                        style={{ color: model.brand.primary }}
                      >
                        {type.link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* The three seats on a relationship. The coach is the reader's, so it carries the accent. */}
      <section
        id="seats"
        className="scroll-mt-24 space-y-4 rounded-xl border border-gray-200 p-6 dark:border-gray-800"
      >
        {model.seats.heading && (
          <h2 className="text-2xl font-bold tracking-tight">{model.seats.heading}</h2>
        )}
        {model.seats.body && (
          <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">{model.seats.body}</p>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {model.seats.items.map((seat: AlignmentCard) => (
            <article
              className="rounded-lg border border-gray-200 border-l-4 p-4 dark:border-gray-800"
              data-seat={seat.id}
              key={seat.id}
              style={{
                borderLeftColor: seat.emphasis ? model.brand.accent : model.brand.primary,
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {seat.label}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{seat.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* What the page refuses to claim — the honesty the rest of the copy is held to. */}
      <section
        className="scroll-mt-24 rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900"
        id="boundary"
      >
        {model.boundary.heading && (
          <h2 className="text-lg font-semibold tracking-tight">{model.boundary.heading}</h2>
        )}
        {model.boundary.body && (
          <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
            {model.boundary.body}
          </p>
        )}
      </section>
    </div>
  );
}

export default AlignmentHomeView;
