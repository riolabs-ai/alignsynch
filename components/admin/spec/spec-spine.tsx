/**
 * template-ancestor: components/admin/permissions/permissions-console.tsx   (variation: three static depths of one fixture instead of a parsed matrix, and no filter band)
 *
 * The project spec's R0 spine, drawn (#1252) — one panel, three routes.
 *
 * **What this is not.** It is not the reader. The submenu, the pinned Validation column, the eleven
 * story pages and their met/total counts are the next card (t_f5458e3d), parented on this one, so
 * this component draws the surface's *architecture* — heading, the confidential notice, what the
 * spine is, and where the group page sits — and nothing the reader will redraw.
 *
 * **Every word is the fixture's** (`data/pages/admin-spec.ts`), which is why the E23 budget for all
 * three routes is 0: a literal typed here is a red build, and a surface that states who may read
 * confidential material does not get to paraphrase itself in a component. The words are *page*
 * items (`pageItemOf`), not a section's — this fixture declares no bands.
 *
 * A server component: no state, no handler, no clock. The gate ran in the page, so nothing here may
 * be mistaken for enforcement — hiding this markup would not hide the route.
 */
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import { fillLabel, pageItemOf } from "@/lib/page-copy";

export function SpecSpine({
  copy,
  group = null,
}: {
  copy: PageCopy;
  /** The `[group]` segment, for the one route that has one. `null` on Overview and Validation. */
  group?: string | null;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;
  const heading = group === null ? words("overview-heading") : words("group-heading");
  const body = group === null ? words("overview-body") : fillLabel(words("group-body"), { group });

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {words("confidential")}
        </p>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{copy.heading}</h1>
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {words("read-only")}
          </span>
        </div>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-prose text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      <section className="space-y-2 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">{heading}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
        {copy.cta === undefined ? null : (
          <Link
            className="inline-block text-sm font-medium text-action underline-offset-4 hover:underline"
            href={copy.cta.href}
          >
            {copy.cta.label}
          </Link>
        )}
      </section>

      <section className="space-y-2 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold">{words("spine-heading")}</h2>
        <p className="max-w-prose text-sm text-muted-foreground">{words("spine-body")}</p>
        <h3 className="pt-2 text-sm font-semibold">{words("validation-heading")}</h3>
        <p className="max-w-prose text-sm text-muted-foreground">{words("validation-body")}</p>
      </section>

      <p className="text-xs text-muted-foreground">{words("reader-next")}</p>
    </div>
  );
}
