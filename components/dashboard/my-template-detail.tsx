// template-ancestor: components/templates/template-detail.tsx   (variation: the same template read by the member who owns it — the Aspects drawn on the locked 1–5 band instead of an answer sheet, an Edit door into the console's editor, and the retire band #1109 wired where the public page sells; the aside answers "what happens next" for the owner rather than "what this costs" for a buyer)
/**
 * One of the member's own templates, as its own page (#1130) — the surface `?edit=1` is not.
 *
 * **The page answers "what is this, and what can I do with it".** The editor (`?edit=1`) answers "change
 * it": the two are one address with a mode, because the bundle addresses them that way
 * (`my-template-detail.html?id=<id>&edit=1`) and because a person arrives here from a card and should
 * not have to load six hundred lines of form to read five Aspects.
 *
 * **The Aspects are drawn, not offered.** Each row prints its prompt, its two named ends and the locked
 * 1–5 band — `bg-scale-1…5`, every cell numbered, which is the same band the answer sheet asks on. There
 * is no input on this page: a control here would be a second editor, and the one editor must stay the
 * one that writes (`components/admin/template-editor.tsx`).
 *
 * **The aside is the three facts that decide what happens next**: what this template is (About), whether
 * anything was built from it (Used In — which also decides whether it can be destroyed), and the one way
 * it can reach other people (Share It With Others → Propose to Library, a reviewed proposal that publishes
 * nothing by itself).
 *
 * Every word is `data/pages/dashboard-template-editor.ts`'s (this route's one fixture), so the component
 * holds no copy literal (E23).
 */
import Link from "next/link";

import { Chip } from "@/components/ui/badge";
import { FlowEntryLink } from "@/components/assessment-flow/flow-entry-link";
import type { Assessment } from "@/content/assessment";
import type { PublishStatus } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type {
  TemplateVersionFormPayload,
  TemplateVersionOutcome,
} from "@/lib/admin/template-draft";
import { MyTemplateRetire } from "@/components/dashboard/my-template-retire";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/**
 * The band's five cells. A map rather than `bg-scale-${n}`: Tailwind scans source text, not runtime
 * values, so a template literal here would compile no colour at all.
 */
const SCALE_CELL: Readonly<Record<number, string>> = {
  1: "bg-scale-1",
  2: "bg-scale-2",
  3: "bg-scale-3",
  4: "bg-scale-4",
  5: "bg-scale-5",
};

const SCALE_STEPS = [1, 2, 3, 4, 5] as const;

const PRIMARY =
  "inline-flex h-11 items-center justify-center rounded-md bg-action px-4 text-sm font-semibold text-action-foreground hover:bg-action-hover";
const OUTLINE =
  "inline-flex h-11 items-center justify-center rounded-md border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const CARD = "rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900";

/** The state word the About card prints, from the row's status. */
function statusWordOf(copy: PageCopy, status: PublishStatus): string {
  const section = sectionOf(copy, "detail-about");
  if (status === "archived") return itemLabel(section, "archived");
  if (status === "published") return itemLabel(section, "published");
  return itemLabel(section, "draft");
}

/** `Used in 2 relationships.` — the aside's fact, and the reason the destroy control may be absent. */
function usedLabelOf(copy: PageCopy, count: number): string {
  const section = sectionOf(copy, "used");
  if (count === 0) return itemLabel(section, "none");
  if (count === 1) return itemLabel(section, "one");
  return fillLabel(itemLabel(section, "many"), { count: String(count) });
}

export function MyTemplateDetail({
  copy,
  template,
  status,
  usedCount,
  createHref,
  editHref,
  proposeHref,
  deleteHref,
  onArchive,
  onRestore,
  onDelete,
}: {
  copy: PageCopy;
  template: Assessment;
  status: PublishStatus;
  usedCount: number;
  createHref: string;
  editHref: string;
  proposeHref: string;
  deleteHref: string;
  onArchive: (payload: TemplateVersionFormPayload) => Promise<TemplateVersionOutcome>;
  onRestore: (payload: TemplateVersionFormPayload) => Promise<TemplateVersionOutcome>;
  onDelete: (payload: TemplateVersionFormPayload) => Promise<TemplateVersionOutcome>;
}) {
  const detail = sectionOf(copy, "detail");
  const about = sectionOf(copy, "detail-about");
  const used = sectionOf(copy, "used");
  const share = sectionOf(copy, "share");
  const items = template.items ?? [];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm text-muted-foreground">{itemLabel(detail, "eyebrow")}</p>
        <h1 className="text-2xl font-semibold">{template.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{template.summary}</p>
        <div className="flex flex-wrap items-center gap-3">
          <FlowEntryLink href={createHref} className={PRIMARY}>
            {itemLabel(detail, "create")}
          </FlowEntryLink>
          <Link href={editHref} data-my-template-edit className={OUTLINE}>
            {itemLabel(detail, "edit")}
          </Link>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section data-my-template-aspects className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {itemLabel(detail, "aspects-heading")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {fillLabel(itemLabel(detail, "aspects-count"), { count: String(items.length) })}
            </p>
          </div>
          {items.length === 0 ? (
            /*
             * A template with no Aspects is not a state the model allows (`zAssessment` requires at least
             * one), so this block should never draw. It exists because "a list that can be empty gets an
             * explicit block and one action" is the repo's rule (E40, ux-reference-patterns rule 7): blank
             * space where a list should be reads as a page that failed to load, and the one action a person
             * needs there is the editor that adds the first Aspect.
             */
            <div
              data-my-template-no-aspects
              className="rounded-lg border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-600"
            >
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {itemLabel(detail, "no-aspects")}
              </p>
              <Link href={editHref} className={`mt-3 ${OUTLINE}`}>
                {itemLabel(detail, "edit")}
              </Link>
            </div>
          ) : (
            <ol className="space-y-3">
              {items.map((item, index) => (
                <li key={item.id} className={CARD} data-my-template-aspect={item.id}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {item.prompt}
                    </p>
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-end justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        {itemLabel(detail, "left-means")} · {item.leftValue}
                      </span>
                      <span>
                        {item.rightValue} · {itemLabel(detail, "right-means")}
                      </span>
                    </div>
                    {/* The locked band: five numbered cells, painted from the scale tokens. */}
                    <div className="flex gap-1" aria-hidden="true">
                      {SCALE_STEPS.map((step) => (
                        <span
                          key={step}
                          className={`h-6 flex-1 rounded-sm text-center text-xs font-semibold leading-6 text-gray-800 ${SCALE_CELL[step]}`}
                        >
                          {step}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {itemLabel(detail, "scale-locked")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          <section className={CARD} data-my-template-about>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {about.heading}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(about)}</p>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{itemLabel(about, "status")}</dt>
                <dd className="font-medium">{statusWordOf(copy, status)}</dd>
              </div>
            </dl>
          </section>

          <section className={CARD} data-my-template-used>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {used.heading}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {usedLabelOf(copy, usedCount)}
            </p>
          </section>

          <section className={CARD} data-my-template-share>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {share.heading}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(share)}</p>
            <Link href={proposeHref} data-my-template-propose className={`mt-3 ${OUTLINE}`}>
              {itemLabel(share, "cta")}
            </Link>
          </section>

          <section className={CARD}>
            <Chip variant="neutral">{itemLabel(detail, "eyebrow")}</Chip>
            <div className="mt-3">
              <MyTemplateRetire
                copy={copy}
                title={template.title}
                status={status}
                templateId={template.id}
                usedCount={usedCount}
                deleteHref={deleteHref}
                onArchive={onArchive}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
