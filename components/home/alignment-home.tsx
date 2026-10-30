import type { AlignmentHomeModel, AlignmentTemplate } from "@/lib/alignment-home";
import Image from "next/image";
import Link from "next/link";

/**
 * The AlignSynch front page, drawn — the other composition of `/` (issue #143).
 *
 * This file holds no words. Every string it prints arrives in the model
 * (`lib/alignment-home.ts`), which joins `data/pages/home-alignsynch.ts` with
 * `data/assessments.ts`, and every colour and the mark arrive on the same object, read from
 * `data/brand.ts` — so a skin is a record, and this component cannot pick a palette or spell a
 * product name. `data:check` E23 counts the leaf literals in `components/home/**` and holds
 * them at 0; a sentence or a label typed here is a red build, not a review comment.
 *
 * The three anchor ids on the bands below (`questions`, `templates`, `families`) are the one
 * thing it does name, because an anchor target is markup rather than copy (E23's
 * `TECHNICAL_ATTRIBUTES`): the shell's AlignSynch menu links to `/#templates` and
 * `/#questions` (issue #156), and `tests/nav-brand.test.ts` holds every `/#…` href to an `id`
 * this page emits, so a band cannot be renamed out from under a link.
 *
 * The page is the product's argument in three bands, in this order: the two questions both
 * parties answer, the four templates that ask them, and the two families those templates cover.
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
    </div>
  );
}

export default AlignmentHomeView;
