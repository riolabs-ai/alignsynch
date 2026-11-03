/**
 * template-ancestor: components/explore/explore-quiz-list.tsx   (variation: cards over Postgres template records grouped by the type each names, surface-owned action row)
 *
 * `/assessment`'s list: the published templates, each card carrying its own create form (#146,
 * #409).
 *
 * The **card** is not this file's: it is `TemplateCard` in `template-card.tsx`, shared with
 * `/assessment/templates`. This file owns what the picker adds — the create form per template, the
 * notice a save leaves, and the copy object the card draws with, resolved from
 * `data/pages/assessment.ts` (E23, budget 0) — so the two catalogue surfaces render one card and
 * two action rows rather than two cards that drift.
 *
 * One form per template rather than a template picker plus one form: the template is the thing
 * being copied, so it belongs in the form's own payload (`templateRecordId`) and a submit cannot be
 * posted against the wrong one. Plain HTML forms, `name`d fields, no `"use client"` — which is also
 * what makes the flow drivable with `curl` and two plain browser sessions.
 */
import type { PageCopy } from "@/content/pages";
import { ASSESSMENT_MODES } from "@/content/assessment";
import { formatCurrency } from "@/content/core";
import { CREATE_INSTANCE_PATH } from "@/lib/flow/paths";
import type { TemplateSummary } from "@/lib/flow/store";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import {
  TemplateCatalogueGrid,
  templateGroupsOf,
  type CatalogueCardCopy,
  type TemplateGroupId,
} from "./template-card";

const CARD = "rounded-lg border border-border bg-card p-5";
const MUTED = "text-sm text-muted-foreground";
const PRIMARY =
  "inline-flex h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover";

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
    <div className="container mx-auto max-w-5xl px-4 py-10">
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
            actionsOf={(template) => (
              <form action={CREATE_INSTANCE_PATH} method="post" className="grid gap-3">
                <input type="hidden" name="templateRecordId" value={template.id} />

                {/* The mode is chosen **here**, when the instance is created (#213): it belongs to
                    the play, and the answer sheet never offers a way to change it. Basic is ticked
                    because it is what the flow asked before modes existed. */}
                <fieldset className="grid gap-1 text-sm">
                  <legend className="font-medium text-foreground">
                    {itemLabel(create, "mode-label")}
                  </legend>
                  {ASSESSMENT_MODES.map((mode) => (
                    <label key={mode} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="mode"
                        value={mode}
                        defaultChecked={mode === "basic"}
                      />
                      <span>
                        {itemLabel(create, mode === "basic" ? "mode-basic" : "mode-advanced")}
                      </span>
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground">{itemLabel(create, "mode-help")}</p>
                </fieldset>

                <label className="grid gap-1 text-sm" htmlFor={`initiator-name-${template.id}`}>
                  <span className="font-medium text-foreground">
                    {itemLabel(create, "initiator-name")}
                  </span>
                  <input
                    id={`initiator-name-${template.id}`}
                    name="initiatorName"
                    required
                    placeholder={itemLabel(create, "initiator-placeholder")}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm" htmlFor={`counterparty-name-${template.id}`}>
                  <span className="font-medium text-foreground">
                    {itemLabel(create, "counterparty-name")}
                  </span>
                  <input
                    id={`counterparty-name-${template.id}`}
                    name="counterpartyName"
                    required
                    placeholder={itemLabel(create, "counterparty-placeholder")}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm" htmlFor={`email-${template.id}`}>
                  <span className="font-medium text-foreground">{itemLabel(create, "email")}</span>
                  <input
                    id={`email-${template.id}`}
                    name="email"
                    type="email"
                    required
                    placeholder={itemLabel(create, "email-placeholder")}
                    className="rounded-md border border-border bg-background px-3 py-2"
                  />
                </label>

                <button type="submit" className={`justify-self-start ${PRIMARY}`}>
                  {itemLabel(create, "submit")}
                </button>
              </form>
            )}
          />
        )}
      </section>
    </div>
  );
}
