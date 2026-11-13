/**
 * template-ancestor: components/explore/explore-quiz-list.tsx   (variation: cards over Postgres template records grouped by the type each names, surface-supplied notice above a grid the shared card owns)
 *
 * `/assessment`'s list: the published templates, each card drawing the **same** action row the
 * library at `/templates/relationship` draws (#146, #409).
 *
 * The **card** is not this file's: it is `TemplateCard` in `template-card.tsx`, shared with
 * `/templates/relationship`. This file owns what the catalogue adds — the notice a save leaves and
 * the copy object the card draws with, resolved from `data/pages/assessment.ts` (E23, budget 0) —
 * so the two catalogue surfaces render one card rather than two cards that drift.
 *
 * **This page once carried a second create path, and #957 deleted it.** Each card shipped its own
 * six-field form posting to `POST /assessment/new` with no `draft` flag, so one press on a public
 * page wrote a **published** relationship, minted its invitation and mailed it — skipping Settings,
 * Aspects, Account and Invite, and never meeting stage 5's send gate (no plan, no card). The price
 * is the gate (#911) and the flow's store is the one writer of a relationship row (#913); a form
 * here was a third answer to both.
 *
 * **The door is the card's own, not this file's.** `TemplateCard` already renders
 * `Create Relationship` as a link to `createRelationshipPath(template.slug)` — stage 1 of the one
 * flow — because the library needed it too. So `/assessment` and `/templates/relationship` now have
 * one create path *by construction*: the same component, the same href. Nothing here may add a
 * `<form>`, and `tests/one-create-path.test.ts` fails the page if one comes back.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { PageCopy } from "@/content/pages";
import { formatCurrency } from "@/content/core";
import type { TemplateSummary } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import {
  TemplateCatalogueGrid,
  templateGroupsOf,
  type CatalogueCardCopy,
  type TemplateGroupId,
} from "./template-card";

const CARD = "rounded-lg border border-border bg-card p-6";
const MUTED = "text-sm text-muted-foreground";

/** The card's words, out of this surface's fixture — see `CatalogueCardCopy`. */
function catalogueCardCopyOf(copy: PageCopy): CatalogueCardCopy {
  const card = sectionOf(copy, "card");
  return {
    viewDetails: itemLabel(card, "view-details"),
    unnamedType: itemLabel(card, "unnamed-type"),
    rolesOf: (type) =>
      fillLabel(itemLabel(card, "roles"), {
        initiator: type.roles.initiator,
        counterparty: type.roles.counterparty,
      }),
    aspectsOf: (count) => fillLabel(itemLabel(card, "aspects"), { count }),
    priceLabel: itemLabel(card, "price-label"),
    priceOf: (plan, cents) =>
      fillLabel(itemLabel(card, "price"), { plan, price: formatCurrency(cents) }),
    useTemplate: itemLabel(card, "use"),
    seeExample: itemLabel(card, "see-example"),
  };
}

/**
 * The group headings, out of this surface's fixture — with one exception.
 *
 * A realm's heading is the realm itself: `realm` is a field of the taxonomy (`REALMS`), and a
 * second authored spelling of "Office" in a copy fixture is the drift this tree keeps deleting.
 * Only `other` — templates whose own words name no type — has words of its own.
 */
function templateGroupLabelOf(copy: PageCopy): (id: TemplateGroupId) => string {
  const groups = sectionOf(copy, "groups");
  return (id) => (id === "other" ? itemLabel(groups, "other") : id);
}

export function TemplateList({
  copy,
  templates,
  createdTitle = null,
}: {
  copy: PageCopy;
  templates: readonly TemplateSummary[];
  /**
   * The title of the template a save just created, or `null` on a plain visit (#255).
   *
   * A title and not an id: the page resolved `?created=` against the list it already read, so a
   * query parameter that names nothing draws no notice — and the words somebody typed travel no
   * further than the record that holds them.
   */
  createdTitle?: string | null;
}) {
  const create = sectionOf(copy, "create");
  const list = sectionOf(copy, "templates");
  const created = sectionOf(copy, "created");

  return (
    <StageColumn>
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : <p className={`mt-3 ${MUTED}`}>{copy.subtitle}</p>}
      </header>

      {createdTitle === null ? null : (
        <div
          data-template-created="true"
          role="status"
          className={`mb-6 p-4 text-sm text-foreground ${CARD}`}
        >
          <p className="font-semibold">{created.heading}</p>
          <p className="mt-1">{fillLabel(sectionBody(created), { title: createdTitle })}</p>
        </div>
      )}

      <p className={`mb-3 p-4 text-sm ${MUTED} ${CARD}`}>{sectionBody(create)}</p>

      {create.cta === undefined ? null : (
        <p className="mb-6 text-sm">
          <a className="font-medium text-action underline" href={create.cta.href}>
            {create.cta.label}
          </a>
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">{list.heading}</h2>
        <p className={MUTED}>{sectionBody(list)}</p>

        {templates.length === 0 ? (
          <p className={MUTED}>{sectionBody(sectionOf(copy, "empty"))}</p>
        ) : (
          <TemplateCatalogueGrid
            copy={catalogueCardCopyOf(copy)}
            groups={templateGroupsOf(templates)}
            groupLabelOf={templateGroupLabelOf(copy)}
          />
        )}
      </section>
    </StageColumn>
  );
}
