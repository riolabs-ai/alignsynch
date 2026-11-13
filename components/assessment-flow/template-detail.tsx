/**
 * template-ancestor: components/assessment-flow/record-detail-shell.tsx   (variation: facts from one Postgres template record and the catalogue type its slug names, POST-form CTAs, no price drawn — the band, the facts card and the section order are the shell's)
 *
 * `/templates/relationship/[slug]` — one template, read-only, in the v1 landing's shape (#794)
 * (#console 5/5, reshaped by #409, re-cast onto the shared detail shell by #795).
 *
 * **This page is the shell's precedent, not a second layout.** The approved artifact
 * (`docs/reference/mockups/one-card-one-detail-v2.html` §4) draws it as "the shell, as it ships", and since
 * #795 that shell is `components/assessment-flow/record-detail-shell.tsx`: identity band → facts →
 * content → actions, with the 320 px aside / content grid. What stays local is only what a
 * *template* says:
 *
 *   1. the descriptor the catalogue authored for the type — **who it is for, and who it is not
 *      for**. Those two sentences are the type's own copy (`data/relationship-types.ts`); a
 *      template whose slug names no catalogue type says so in the band instead. No descriptor is
 *      invented for it here;
 *   2. the Aspects, in authored order, each with **both named ends of the scale** — notch 1 and
 *      notch 5 are the words a party actually answers against;
 *   3. what a Mode and a Setting are, because the person reading this page will choose both when
 *      they start an instance;
 *   4. the actions card — the two write actions the list already offers (duplicate, archive) plus
 *      the product's one primary action, **"Create Relationship"**, which opens this template's own
 *      create step (#618). It used to read "Start an instance" and point back at the library, which
 *      was instance language on a product page and a link to where the reader came from. This is
 *      also the slot the relationship page draws its Edit/Publish/Complete panels in — the
 *      artifact's second declared axis, and the only difference between the two pages' asides.
 *
 * **What this page must not say.** No person's name: a template holds Aspects, and the seats are
 * the type's roles (`Staff / Manager`), never a participant — a name here would be invented social
 * proof. No figure for this product: a relationship's cost depends on the plan chosen when it is
 * ready to complete (#619), so the page names that fact and links the plans page where the prices
 * actually are, instead of printing a number it did not read. No testimonial, no rating, no "N
 * teams use this": nothing in the tree measures any of them.
 *
 * The archived state is drawn as a band, not as a hidden control: an archived template still
 * opens, because its instances copied their Aspects at creation and nothing joins back to it.
 */
import {
  DetailBand,
  DetailFacts,
  DetailPanel,
  DetailSection,
  DETAIL_CARD,
  DETAIL_FACT_LABEL,
  DETAIL_MUTED,
  RecordDetailShell,
  type DetailFact,
} from "@/components/assessment-flow/record-detail-shell";
import { StageColumn } from "@/components/assessment-flow/stage-column";
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
  PRICING_PATH,
  TEMPLATE_LIBRARY_PATH,
  createRelationshipPath,
  templateDuplicatePath,
  templateStatusPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { relationshipTypeOf } from "./template-card";

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
        <dt className={DETAIL_FACT_LABEL}>{itemLabel(identity, "initiator")}</dt>
        <dd className="text-sm font-medium text-foreground">{type.roles.initiator}</dd>
      </div>
      <div className="rounded-md border border-border bg-background p-3">
        <dt className={DETAIL_FACT_LABEL}>{itemLabel(identity, "counterparty")}</dt>
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

  /** The band's two copy-resolved strings; a type-less template says so in words instead. */
  const groupLabel =
    type === undefined ? "" : itemLabel(groups, REALM_GROUP[type.realm].toLowerCase());
  const rolesLine =
    type === undefined
      ? itemLabel(identity, "no-type")
      : fillLabel(itemLabel(identity, "roles"), {
          initiator: type.roles.initiator,
          counterparty: type.roles.counterparty,
        });

  const factRows: readonly DetailFact[] = [
    {
      id: "aspects",
      label: itemLabel(facts, "aspects"),
      value: template.aspectCount,
      figure: true,
    },
    {
      id: "instances",
      label: itemLabel(facts, "instances"),
      value: template.instanceCount,
      figure: true,
    },
    {
      id: "status",
      label: itemLabel(facts, "status"),
      value: itemLabel(facts, archivedTemplate ? "status-archived" : "status-published"),
      hooks: { "data-template-detail-status": template.status },
    },
    {
      id: "created",
      label: itemLabel(facts, "created"),
      value: formatDate(template.createdAt),
    },
  ];

  return (
    <StageColumn>
      {/* No journey rail here (#791). It numbered this page `Step 2 of 3` of a browse journey, but
          the create flow downstream prints `Stage 1 of 6` and this screen is a pre-stage view of
          that flow, not a stage of it — two numberings for one journey, the wrong one on the
          wrong screen. The six-stage rail lives where the stages are. */}
      <RecordDetailShell
        scope="template"
        back={{ href: TEMPLATE_LIBRARY_PATH, label: itemLabel(back, "all") }}
        band={
          /* The header band — the v1 landing's cover, text-only: a template has no photograph, and
             an invented one would be the first thing on the page a reader could not trust. */
          <DetailBand
            scope="template"
            type={type}
            title={template.title}
            summary={template.summary}
            groupLabel={groupLabel}
            rolesLine={rolesLine}
          />
        }
        facts={
          <DetailFacts
            facts={factRows}
            hooks={{ "data-template-detail-facts": "true" }}
            footnote={
              <p
                className="text-xs text-muted-foreground"
                data-template-detail-authorship={template.authorship}
              >
                {itemLabel(
                  facts,
                  template.authorship === "mine" ? "authorship-mine" : "authorship-built-in",
                )}
              </p>
            }
          />
        }
        /* The rail's second card: what a visitor came to take. The relationship page draws its
           three working panels in this same slot — the artifact's second declared axis. */
        actions={
          <DetailPanel title={actions.heading} hooks={{ "data-template-detail-actions": "true" }}>
            {archivedTemplate ? null : (
              <div className="space-y-2">
                {/* The product's one primary action (#618): the create step for THIS template, not
                    a link back to the library it was found in. */}
                <a
                  className={PRIMARY}
                  data-template-detail-cta="create"
                  href={createRelationshipPath(template.id)}
                >
                  {itemLabel(actions, "create")}
                </a>
                <p className={DETAIL_MUTED}>{itemLabel(actions, "plans-note")}</p>
                <a
                  className="text-sm font-medium text-action hover:underline"
                  data-template-detail-cta="plans"
                  href={PRICING_PATH}
                >
                  {itemLabel(actions, "plans")}
                </a>
              </div>
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
          </DetailPanel>
        }
      >
        {type === undefined ? null : (
          <section className="space-y-3" data-template-detail-descriptor="true">
            <h2 className="text-xl font-semibold text-foreground">{type.name}</h2>
            <SeatList type={type} copy={copy} />
            <div className={`space-y-2 ${DETAIL_CARD}`}>
              <div>
                <p className={DETAIL_FACT_LABEL}>{itemLabel(identity, "who-its-for")}</p>
                <p className="mt-1 text-sm text-foreground">{type.descriptor.whoItsFor}</p>
              </div>
              <div>
                <p className={DETAIL_FACT_LABEL}>{itemLabel(identity, "who-its-not-for")}</p>
                <p className="mt-1 text-sm text-foreground">{type.descriptor.whoItsNotFor}</p>
              </div>
            </div>
          </section>
        )}

        <DetailSection
          title={aspectsSection.heading}
          body={sectionBody(aspectsSection)}
          hooks={{ "data-template-detail-aspects": "true" }}
        >
          {aspects.length === 0 ? (
            <p className={`mt-4 ${DETAIL_MUTED}`}>{itemLabel(aspectsSection, "empty")}</p>
          ) : (
            <ol className="mt-4 grid gap-3">
              {aspects.map((aspect) => (
                <li key={aspect.id} data-template-aspect={aspect.id} className={DETAIL_CARD}>
                  <p className="text-sm font-semibold text-foreground">{aspect.prompt}</p>
                  <p className={`mt-2 ${DETAIL_MUTED}`}>
                    <span className="font-medium text-foreground">
                      {itemLabel(aspectsSection, "left")}
                    </span>
                    <span aria-hidden className="mx-1.5">
                      —
                    </span>
                    <span data-template-aspect-left={aspect.leftValue}>{aspect.leftValue}</span>
                  </p>
                  <p className={DETAIL_MUTED}>
                    <span className="font-medium text-foreground">
                      {itemLabel(aspectsSection, "right")}
                    </span>
                    <span aria-hidden className="mx-1.5">
                      —
                    </span>
                    <span data-template-aspect-right={aspect.rightValue}>{aspect.rightValue}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </DetailSection>

        <DetailSection
          title={shape.heading}
          body={sectionBody(shape)}
          framed
          hooks={{ "data-template-detail-shape": "true" }}
        >
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-semibold text-foreground">{itemLabel(shape, "mode")}</dt>
              {ASSESSMENT_MODES.map((mode) => (
                <dd key={mode} className={DETAIL_MUTED} data-template-mode={mode}>
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
                <dd key={setting} className={DETAIL_MUTED} data-template-setting={setting}>
                  <span className="font-medium text-foreground">{SETTING_LABELS[setting]}</span>
                  <span aria-hidden className="mx-1.5" />
                  {SETTING_DEFINITIONS[setting]}
                </dd>
              ))}
              <dd className={`mt-2 ${DETAIL_MUTED}`}>{itemLabel(shape, "setting-note")}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground" data-template-detail-money="none">
            {itemLabel(shape, "no-money")}
          </p>
        </DetailSection>
      </RecordDetailShell>

      {archivedTemplate ? (
        <section
          data-template-detail-archived="true"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950"
        >
          <h2 className="text-base font-semibold text-foreground">{archived.heading}</h2>
          <p className="mt-2 text-sm text-foreground">{sectionBody(archived)}</p>
        </section>
      ) : null}
    </StageColumn>
  );
}
