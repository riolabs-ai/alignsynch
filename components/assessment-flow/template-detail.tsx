/**
 * template-ancestor: components/marketing/marketing-landing.tsx   (variation: facts from one Postgres template record and the catalogue type its slug names, POST-form CTAs, no price drawn)
 *
 * `/assessment/templates/[templateId]` — one template, read-only, in the v1 landing's shape
 * (#console 5/5, reshaped by #409).
 *
 * "Open" has to open something, and the spec keeps template *editing* for a later card: the
 * editor will extend this route, not replace it. So this page reads, in the order a person
 * deciding asks:
 *
 *   1. a header band naming the **type** — the group, the realm, the Relationship Type and the two
 *      roles — then the single `h1`;
 *   2. the descriptor the catalogue authored for that type: **who it is for, and who it is not
 *      for**. Those two sentences are the type's own copy (`data/relationship-types.ts`); a
 *      template whose slug names no catalogue type says so instead, and no descriptor is written
 *      for it here;
 *   3. the Aspects, in authored order, each with **both named ends of the scale** — notch 1 and
 *      notch 5 are the words a party actually answers against;
 *   4. what a Mode and a Setting are, because the person reading this page will choose both when
 *      they start an instance;
 *   5. the two write actions the list already offers (duplicate, archive) plus the one link out
 *      to the picker where an instance is started.
 *
 * **What this page must not say.** No person's name: a template holds Aspects, and the seats are
 * the type's roles (`Staff / Manager`), never a participant — a name here would be invented social
 * proof. No money: a relationship's price is what an initiator paid for an *instance*, this read
 * holds no price and nothing has been paid, so a figure on this page could only be invented. No
 * testimonial, no rating, no "N teams use this": nothing in the tree measures any of them.
 *
 * The archived state is drawn as a band, not as a hidden control: an archived template still
 * opens, because its instances copied their Aspects at creation and nothing joins back to it.
 */
import type { PageCopy } from "@/content/pages";
import { formatDate } from "@/content/core";
import {
  ASSESSMENT_MODES,
  MODE_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  type AlignmentSetting,
} from "@/content/assessment";
import { REALM_GROUP, type RelationshipType } from "@/data/relationship-types";
import type { LibraryTemplateDetail } from "@/lib/db/template-library";
import {
  ASSESSMENTS_PATH,
  TEMPLATE_LIBRARY_PATH,
  templateDuplicatePath,
  templateStatusPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { relationshipTypeOf } from "./template-card";

const CARD = "rounded-lg border border-border bg-card p-4";
const MUTED = "text-sm text-muted-foreground";
const CHIP = "rounded-md border border-background/30 px-2 py-0.5 text-xs text-background/80";
const FACT_LABEL = "text-xs uppercase tracking-wide text-muted-foreground";
const PRIMARY =
  "inline-flex h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action-hover";

const SETTINGS: readonly AlignmentSetting[] = ["soft", "full"];

/**
 * The two seats, as **roles**: the type's own words for who sits in each one. A template holds
 * Aspects and no parties, so a name here would be a participant invented to fill a box.
 */
function SeatList({ type, copy }: { type: RelationshipType; copy: PageCopy }) {
  const identity = sectionOf(copy, "identity");
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border border-border bg-background p-3">
        <dt className={FACT_LABEL}>{itemLabel(identity, "initiator")}</dt>
        <dd className="text-sm font-medium text-foreground">{type.roles.initiator}</dd>
      </div>
      <div className="rounded-md border border-border bg-background p-3">
        <dt className={FACT_LABEL}>{itemLabel(identity, "counterparty")}</dt>
        <dd className="text-sm font-medium text-foreground">{type.roles.counterparty}</dd>
      </div>
    </dl>
  );
}

export function TemplateDetail({
  copy,
  detail,
}: {
  copy: PageCopy;
  detail: LibraryTemplateDetail;
}) {
  const { template, aspects } = detail;
  const back = sectionOf(copy, "back");
  const identity = sectionOf(copy, "identity");
  const groups = sectionOf(copy, "groups");
  const facts = sectionOf(copy, "facts");
  const aspectsSection = sectionOf(copy, "aspects");
  const shape = sectionOf(copy, "shape");
  const actions = sectionOf(copy, "actions");
  const archived = sectionOf(copy, "archive-note");

  const type = relationshipTypeOf(template.slug);
  const archivedTemplate = template.status === "archived";

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <nav aria-label={itemLabel(back, "all")} className="mb-3">
        <a className="text-sm font-medium text-action hover:underline" href={TEMPLATE_LIBRARY_PATH}>
          {itemLabel(back, "all")}
        </a>
      </nav>

      {/* The header band — the v1 landing's cover, text-only: a template has no photograph, and an
          invented one would be the first thing on the page a reader could not trust. */}
      <header
        data-template-detail-band="true"
        data-template-detail-type={type?.id ?? "none"}
        className="rounded-lg bg-foreground px-6 py-6 text-background"
      >
        {type === undefined ? null : (
          <p className="flex flex-wrap items-center gap-2">
            <span className={CHIP} data-template-detail-group={REALM_GROUP[type.realm]}>
              {itemLabel(groups, REALM_GROUP[type.realm].toLowerCase())}
            </span>
            <span className={CHIP} data-template-detail-realm={type.realm}>
              {type.realm}
            </span>
            <span className={CHIP} data-template-detail-short-name={type.id}>
              {type.shortName}
            </span>
          </p>
        )}
        <h1 className="mt-2 text-3xl font-bold">{template.title}</h1>
        <p className="mt-2 text-sm text-background/80">
          {type === undefined
            ? itemLabel(identity, "no-type")
            : fillLabel(itemLabel(identity, "roles"), {
                initiator: type.roles.initiator,
                counterparty: type.roles.counterparty,
              })}
        </p>
        <p className="mt-3 text-sm text-background/80">{template.summary}</p>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        {/* The rail: what this template is, what running it involves, and the one action a visitor
            came to take. Sticky on `lg` so the decision stays in view while the Aspect list
            scrolls — the v1 landing's own CSS variation (#404 §5). */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className={`space-y-3 ${CARD}`} data-template-detail-facts="true">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className={FACT_LABEL}>{itemLabel(facts, "aspects")}</dt>
                <dd className="text-lg font-semibold text-foreground">{template.aspectCount}</dd>
              </div>
              <div>
                <dt className={FACT_LABEL}>{itemLabel(facts, "instances")}</dt>
                <dd className="text-lg font-semibold text-foreground">{template.instanceCount}</dd>
              </div>
              <div>
                <dt className={FACT_LABEL}>{itemLabel(facts, "status")}</dt>
                <dd className={MUTED} data-template-detail-status={template.status}>
                  {itemLabel(facts, archivedTemplate ? "status-archived" : "status-published")}
                </dd>
              </div>
              <div>
                <dt className={FACT_LABEL}>{itemLabel(facts, "created")}</dt>
                <dd className={MUTED}>{formatDate(template.createdAt)}</dd>
              </div>
            </dl>
            <p
              className="text-xs text-muted-foreground"
              data-template-detail-authorship={template.authorship}
            >
              {itemLabel(
                facts,
                template.authorship === "mine" ? "authorship-mine" : "authorship-built-in",
              )}
            </p>
          </section>

          <section className={`space-y-2 ${CARD}`} data-template-detail-actions="true">
            <h2 className="text-base font-semibold text-foreground">{actions.heading}</h2>
            {archivedTemplate ? null : (
              <a className={PRIMARY} href={ASSESSMENTS_PATH}>
                {itemLabel(actions, "start")}
              </a>
            )}
            <form action={templateDuplicatePath(template.id)} method="post">
              <button type="submit" className="text-sm underline">
                {itemLabel(actions, "duplicate")}
              </button>
            </form>
            {template.authorship !== "mine" ? null : (
              <form action={templateStatusPath(template.id)} method="post">
                <input
                  type="hidden"
                  name="status"
                  value={archivedTemplate ? "published" : "archived"}
                />
                <button type="submit" className="text-sm underline">
                  {itemLabel(actions, archivedTemplate ? "unarchive" : "archive")}
                </button>
              </form>
            )}
          </section>
        </aside>

        <div className="min-w-0 space-y-6">
          {type === undefined ? null : (
            <section className="space-y-3" data-template-detail-descriptor="true">
              <h2 className="text-xl font-semibold text-foreground">{type.name}</h2>
              <SeatList type={type} copy={copy} />
              <div className={`space-y-2 ${CARD}`}>
                <div>
                  <p className={FACT_LABEL}>{itemLabel(identity, "who-its-for")}</p>
                  <p className="mt-1 text-sm text-foreground">{type.descriptor.whoItsFor}</p>
                </div>
                <div>
                  <p className={FACT_LABEL}>{itemLabel(identity, "who-its-not-for")}</p>
                  <p className="mt-1 text-sm text-foreground">{type.descriptor.whoItsNotFor}</p>
                </div>
              </div>
            </section>
          )}

          <section data-template-detail-aspects="true">
            <h2 className="text-xl font-semibold text-foreground">{aspectsSection.heading}</h2>
            <p className={`mt-2 ${MUTED}`}>{sectionBody(aspectsSection)}</p>

            {aspects.length === 0 ? (
              <p className={`mt-4 ${MUTED}`}>{itemLabel(aspectsSection, "empty")}</p>
            ) : (
              <ol className="mt-4 grid gap-3">
                {aspects.map((aspect) => (
                  <li key={aspect.id} data-template-aspect={aspect.id} className={CARD}>
                    <p className="text-sm font-semibold text-foreground">{aspect.prompt}</p>
                    <p className={`mt-2 ${MUTED}`}>
                      <span className="font-medium text-foreground">
                        {itemLabel(aspectsSection, "left")}
                      </span>
                      <span aria-hidden className="mx-1.5">
                        —
                      </span>
                      <span data-template-aspect-left={aspect.leftValue}>{aspect.leftValue}</span>
                    </p>
                    <p className={MUTED}>
                      <span className="font-medium text-foreground">
                        {itemLabel(aspectsSection, "right")}
                      </span>
                      <span aria-hidden className="mx-1.5">
                        —
                      </span>
                      <span data-template-aspect-right={aspect.rightValue}>
                        {aspect.rightValue}
                      </span>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={`space-y-2 ${CARD}`} data-template-detail-shape="true">
            <h2 className="text-xl font-semibold text-foreground">{shape.heading}</h2>
            <p className={MUTED}>{sectionBody(shape)}</p>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-semibold text-foreground">
                  {itemLabel(shape, "mode")}
                </dt>
                {ASSESSMENT_MODES.map((mode) => (
                  <dd key={mode} className={MUTED} data-template-mode={mode}>
                    <span className="font-medium text-foreground">{MODE_LABELS[mode]}</span>
                    <span aria-hidden className="mx-1.5" />
                    {itemLabel(shape, mode === "basic" ? "mode-basic" : "mode-advanced")}
                  </dd>
                ))}
              </div>
              <div>
                <dt className="text-sm font-semibold text-foreground">
                  {itemLabel(shape, "setting")}
                </dt>
                {SETTINGS.map((setting) => (
                  <dd key={setting} className={MUTED} data-template-setting={setting}>
                    <span className="font-medium text-foreground">{SETTING_LABELS[setting]}</span>
                    <span aria-hidden className="mx-1.5" />
                    {SETTING_DEFINITIONS[setting]}
                  </dd>
                ))}
                <dd className={`mt-2 ${MUTED}`}>{itemLabel(shape, "setting-note")}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground" data-template-detail-money="none">
              {itemLabel(shape, "no-money")}
            </p>
          </section>
        </div>
      </div>

      {archivedTemplate ? (
        <section
          data-template-detail-archived="true"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950"
        >
          <h2 className="text-base font-semibold text-foreground">{archived.heading}</h2>
          <p className="mt-2 text-sm text-foreground">{sectionBody(archived)}</p>
        </section>
      ) : null}
    </div>
  );
}
