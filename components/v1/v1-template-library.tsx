"use client";

// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: relationship-type cards — the public catalogue's card, plus Start, View, Clone and Edit actions that only an initiator or admin can take)

import { SectionIntro } from "@/components/v1/v1-ui";
import { formatCurrency } from "@/content/core";
import { RELATIONSHIP_PRICE_CENTS, relationshipTypes } from "@/data/v1/relationship-types";
import { useV1Store } from "@/lib/v1/store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * `/v1/[persona]/templates` — the template library inside the dashboard (#384). It draws the same
 * cards as the public `/v1/templates` (name, who it is for, Aspect count, price), and adds the
 * actions an initiator or admin can take — the route already gates this surface to those two, so
 * the actions render unconditionally here:
 *
 *   - **Start a relationship** (primary) — create the relationship from this type (unsubscribed;
 *     the shop is where it gets a plan) and open it.
 *   - **View details** (outline) — the public decide-first page, `/v1/templates/[type]`.
 *   - **Clone into mine** / **Edit aspects** (ghost) — fold the type into the initiator's own
 *     template library, then open or link to the template editor.
 */
export function V1TemplateLibrary() {
  const { startFromType, cloneType } = useV1Store();
  const router = useRouter();
  const [clonedName, setClonedName] = useState<string | null>(null);

  const start = (type: (typeof relationshipTypes)[number]) => {
    const rel = startFromType(type);
    router.push(`/v1/relationships/${rel.id}`);
  };

  const clone = (type: (typeof relationshipTypes)[number]) => {
    cloneType(type);
    setClonedName(type.name);
  };

  const edit = (type: (typeof relationshipTypes)[number]) => {
    const template = cloneType(type);
    router.push(`/v1/initiator/templates/new?template=${template.id}`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Template library"
        subtitle="The relationship types, with the actions you can take on them — start one, or clone it into your own templates and edit the Aspects."
      />

      {clonedName !== null && (
        <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          &ldquo;{clonedName}&rdquo; cloned into your templates —{" "}
          <Link
            href={`/v1/initiator/templates/new?template=assessment-${relationshipTypes.find((t) => t.name === clonedName)?.id ?? ""}`}
            className="font-medium text-action hover:underline"
          >
            open it to edit the Aspects
          </Link>
          .
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 min-[900px]:grid-cols-2 xxl:grid-cols-3">
        {relationshipTypes.map((type) => (
          <article
            key={type.id}
            className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-action"
          >
            <p className="text-sm font-semibold text-foreground">{type.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{type.whoItsFor}</p>

            <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>Aspects</dt>
                <dd className="text-foreground">{type.aspects.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Price</dt>
                <dd className="text-foreground">{formatCurrency(RELATIONSHIP_PRICE_CENTS)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => start(type)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90"
              >
                Start a relationship
              </button>
              <Link
                href={`/v1/templates/${type.id}`}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
              >
                View details
              </Link>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => clone(type)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-md px-2 text-xs font-medium text-action hover:bg-muted"
              >
                Clone into mine
              </button>
              <button
                type="button"
                onClick={() => edit(type)}
                className="inline-flex h-9 flex-1 items-center justify-center rounded-md px-2 text-xs font-medium text-action hover:bg-muted"
              >
                Edit aspects
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        One relationship costs {formatCurrency(RELATIONSHIP_PRICE_CENTS)}. The other person joins by
        link and pays nothing.
      </p>
    </div>
  );
}
