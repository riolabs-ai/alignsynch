// template-ancestor: components/explore/explore-quiz-list.tsx   (variation: relationship-type cards — the public catalogue's card, grouped Business · Personal with the initiator's own Custom templates, plus Start, View and Clone/Edit actions that only an initiator or admin can take)

"use client";

import { SectionIntro } from "@/components/v1/v1-ui";
import { RelationshipTypeCard } from "@/components/v1/relationship-type-card";
import { formatCurrency } from "@/content/core";
import {
  RELATIONSHIP_PRICE_CENTS,
  purchasableTypesByGroup,
  type RelationshipType,
} from "@/data/v1/relationship-types";
import { useV1Store } from "@/lib/v1/store";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** The blank template's id in the seed library — the `Custom` path's starting point. */
const BLANK_TEMPLATE_ID = "v1-template-basics";

/**
 * `/v1/[persona]/templates` — the template library inside the dashboard (#384).
 *
 * It draws **the same cards as the public `/v1/templates`** (one shared `RelationshipTypeCard`),
 * grouped in the product's own vocabulary — `Business · Personal`, with `realm` the field
 * underneath — plus `Custom`, which is the initiator's own templates: the blank one and anything
 * cloned into the library. What separates this surface from the marketing one is not the card,
 * it is the **capability check**:
 *
 *   - `canAct` (initiator, admin) — *Start a relationship* (primary), *View details* (outline),
 *     then *Clone into mine* / *Edit aspects*. Starting creates the relationship **unsubscribed**;
 *     the shop is the surface that gives it a plan, which is why the note under the grid says so
 *     rather than pretending the price was charged.
 *   - `canAct` false (counterparty, coach) — the cards, and **no action row at all**. #384's
 *     matrix marks the library `view` for the coach and `✓` for the counterparty: every persona
 *     browses, only two act, and a coach shown on a template nobody has started is the
 *     misleading advert the owner retired.
 */
export function V1TemplateLibrary({ canAct }: { canAct: boolean }) {
  const { startFromType, cloneType, templates } = useV1Store();
  const router = useRouter();

  /** The clone the initiator most recently folded into their own library, for the confirm line. */
  const [cloned, setCloned] = useState<string | null>(null);

  const groups = purchasableTypesByGroup();
  const own = templates.filter(
    (template) => template.id === BLANK_TEMPLATE_ID || template.id.startsWith("assessment-"),
  );

  const start = (type: RelationshipType) => {
    const rel = startFromType(type);
    router.push(`/v1/relationships/${rel.id}`);
  };

  const clone = (type: RelationshipType) => {
    const template = cloneType(type);
    setCloned(template.id);
  };

  const edit = (type: RelationshipType) => {
    const template = cloneType(type);
    router.push(`/v1/initiator/templates/new?template=${template.id}`);
  };

  const actionRow = (type: RelationshipType) => (
    <>
      <div className="flex gap-2">
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
    </>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <SectionIntro
        title="Template library"
        subtitle={
          canAct
            ? "Every relationship type, grouped the way the product groups them. Start one, or clone it into your own templates and edit the Aspects."
            : "Every relationship type, grouped the way the product groups them. This is a read-only view — the actions belong to the person who starts the relationship."
        }
      />

      {canAct && cloned !== null && (
        <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          Cloned into your templates —{" "}
          <Link
            href={`/v1/initiator/templates/new?template=${cloned}`}
            className="font-medium text-action hover:underline"
          >
            open it to edit the Aspects
          </Link>
          .
        </p>
      )}

      {groups.map((group) => (
        <section key={group.group} className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.group}
          </h2>
          {group.realms.map((realm) => (
            <div key={realm.realm} className="space-y-3">
              <h3 className="text-xs font-medium text-muted-foreground">{realm.realm}</h3>
              <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 min-[900px]:grid-cols-2 xxl:grid-cols-3">
                {realm.types.map((type) => (
                  <RelationshipTypeCard
                    key={type.id}
                    type={type}
                    actions={canAct ? actionRow(type) : null}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {canAct && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Custom
          </h2>
          <p className="text-xs text-muted-foreground">
            Your own templates — start from the blank one, or clone a type above and change what it
            asks.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 min-[900px]:grid-cols-2 xxl:grid-cols-3">
            {own.map((template) => (
              <article
                key={template.id}
                className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-action"
              >
                <h3 className="text-sm font-semibold text-foreground">{template.title}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Your template</p>
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>Aspects</dt>
                    <dd className="text-foreground">{template.items.length}</dd>
                  </div>
                </dl>
                <div className="mt-auto pt-4">
                  <Link
                    href={`/v1/initiator/templates/new?template=${template.id}`}
                    className="inline-flex h-11 w-full items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Edit aspects
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        One relationship costs {formatCurrency(RELATIONSHIP_PRICE_CENTS)}. The other person joins by
        link and pays nothing.
        {canAct
          ? " A new relationship starts unsubscribed — the shop is where you choose a plan."
          : ""}
      </p>
    </div>
  );
}
