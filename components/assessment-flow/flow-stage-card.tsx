/**
 * template-ancestor: components/assessment-flow/stage-column.tsx   (variation: the stage frame reads eyebrow → focusable title → purpose → content well, and takes an optional icon instead of a numbered cell)
 *
 * The v2 stage card — the frame every stage of the create-and-complete flow is drawn in.
 *
 * **The title is the focus target.** `StageTitleFocus` moves focus to `id` when a stage mounts, and
 * an `<h2>` with `tabIndex={-1}` is what that targets: a heading, announced as a heading, that a
 * pointer never has to click. Giving it `focus:outline-none` is not a lost focus ring — a heading
 * is not an interactive control, and the visible change on arrival is the whole screen, not a box
 * around three words.
 *
 * **The icon is the caller's.** Nothing here reaches into an icon set: a stage that has no glyph
 * passes none, and the slot is not drawn at all rather than drawn empty. `aria-hidden` because the
 * title beside it already says what the stage is.
 *
 * A server component: a frame is structure and words, so it ships no JavaScript of its own.
 */
import type { ReactNode } from "react";

export function FlowStageCard({
  stage,
  eyebrow,
  title,
  purpose,
  titleId,
  titleLevel = 2,
  icon,
  children,
}: {
  stage: number;
  eyebrow: string;
  title: string;
  purpose: string;
  /** Default: `stage-${stage}-title`. */
  titleId?: string;
  /**
   * The heading's level. A stage that *is* the page's title draws the `h1`; the same card rendered
   * under a page that already has one draws the `h2`. The bundle draws `h2` because its prototype
   * page carries its own banner — the flow's document is titled by the stage, so the wizard passes
   * `1` and the screen keeps exactly one `h1`.
   */
  titleLevel?: 1 | 2;
  /** The caller supplies a lucide icon element; when absent, none is drawn. */
  icon?: ReactNode;
  children: ReactNode;
}) {
  const Title = titleLevel === 1 ? "h1" : "h2";
  return (
    <section data-stage-card={stage} className="rounded-lg border bg-card">
      <div className="flex items-start gap-3 p-4 lg:px-6 lg:pt-6">
        {icon === undefined ? null : (
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-status-chip text-deep"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-deep-calm">{eyebrow}</p>
          <Title
            id={titleId ?? `stage-${stage}-title`}
            tabIndex={-1}
            className="text-xl font-bold tracking-tight text-primary focus:outline-none"
          >
            {title}
          </Title>
          <p className="mt-0.5 text-sm text-muted-foreground">{purpose}</p>
        </div>
      </div>
      <div className="space-y-6 px-4 pb-6 lg:px-6">{children}</div>
    </section>
  );
}
