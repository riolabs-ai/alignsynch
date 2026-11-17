// template-ancestor: components/templates/template-card.tsx   (variation: the same catalogue card, drawn inside the dashboard — a seeded cover wash and a monogram the public card has no use for, two buttons on every card because a member is signed in and *can* act, a category chip that files the card on one of the Library's five shelves, and a My Copy chip on the tab that lists what they hold; the public card's single "use" link and its `/register` destination belong to a shop, not to a workspace)

/**
 * The templates shelf — one card per template, two tabs over it, a featured band above it (#620, #1130).
 *
 * **The component holds no words and no paths.** Every chip, button label, count and placeholder is a
 * field the page resolved from `data/pages/dashboard-templates.ts` through `lib/member/shelf.ts`, so
 * this file stays at zero copy literals (E23) and a rename is one fixture edit. It is a server
 * component for the same reason `assessments-list.tsx` is: the cards are links, every state of the
 * screen is a URL, and there is nothing to hydrate.
 *
 * **The tab and the filter are the URL.** `?tab=library|mine` and `?filter=<shelf>` are read by the
 * page and drawn here as links with `aria-current`, so a click is a GET, the back button works and a
 * `curl` can ask for either — the same reading `/assessment/instances` gives `?stage=`. That is also
 * why this is not the client `components/ui/tabs`: a tab that only moved a client `value` would not
 * rewrite the query, and this screen's contract is that the address says what is drawn.
 *
 * **`MemberCard` is the relationship list's type too.** One projection feeds both shelves (#795 F2):
 * the fields this card prints are the shared half, and the `relationship` half is `null` on every card
 * here because a template has no stage, no second party and nothing paid.
 *
 * **The cover is the muted wash, not an image.** `mutedGradientFor(slug)` is the approved band
 * (`hsl(h 22% 86%) → hsl(h±12–23° 24% 74%)`): no white overlay, no white title band, and the monogram
 * is **ink at ~34%** because white type on an 86%-lightness tint is invisible.
 *
 * **The densities are the shipped ones.** `rounded-lg` is the 5px token, the card border is `gray-200`,
 * chips are `gray-300`, the action row is `h-9` and the page's own CTA is `h-11`; the outline button
 * hovers to `bg-gray-50` with its text unchanged and the primary to `bg-action-hover`, so no rule
 * paints light text without also painting a coloured fill.
 */
import { Chip } from "@/components/ui/badge";
import { CardMenu } from "@/components/dashboard/card-menu";
import { FlowEntryLink } from "@/components/assessment-flow/flow-entry-link";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { mutedGradientFor, monogramOf } from "@/lib/category-gradient";
import {
  CARD_ACTIONS,
  CARD_COVER,
  CARD_COVER_WORD,
  CARD_FRAME,
  CARD_META,
  CARD_TITLE,
  type TemplateShelfCard,
} from "@/lib/member/card";
import type { CardMenuWrite, CardMenuWriteId, TemplateMenuWords } from "@/lib/member/card-menu";
import { templateMenuOf } from "@/lib/member/card-menu";
import type { MenuRefusal } from "@/lib/member/menu-copy";
import {
  TEMPLATE_TABS,
  type LibraryFilter,
  type LibraryFilterRow,
  type TemplateTab,
  templatesTabPath,
} from "@/lib/member/shelf";
import { fillLabel, itemLabel, pageItemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

/**
 * The frame, the cover slot, the title and the facts line are **not** this file's (#795).
 *
 * They are the card's, declared once in `lib/member/card.ts`, because the relationship shelf draws the
 * same card: a copy of the frame here was a second look waiting to happen, and the artifact's "same
 * frame, same padding" claim had nothing enforcing it until both shelves imported one string. What
 * stays local is the axis — the gradient wash and the monogram this cover draws, where the relationship
 * draws its stage word — and this shelf's two buttons.
 */
const OUTLINE =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover";

/**
 * The two tabs, as links, each carrying a count pill.
 *
 * `aria-current` rather than a client component: the tab is `?tab=mine`, so a click is a GET and the
 * selected tab is a fact about the URL. The count is the number of rows the *other* read returned —
 * passed in, never counted here — so a tab cannot promise rows the server did not hand over.
 */
export function TemplateTabs({
  copy,
  current,
  counts,
}: {
  copy: PageCopy;
  current: TemplateTab;
  counts: Readonly<Record<TemplateTab, number>>;
}) {
  const countLabel = pageItemOf(copy, "count").label;
  return (
    <nav
      data-template-tabs="true"
      className="inline-flex gap-1 rounded-md bg-gray-100 p-0.5 dark:bg-gray-800"
    >
      {TEMPLATE_TABS.map((tab) => (
        <Link
          key={tab}
          href={templatesTabPath(tab)}
          data-template-tab={tab}
          aria-current={tab === current ? "page" : undefined}
          className={
            tab === current
              ? "inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
              : "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          }
        >
          {itemLabel(sectionOf(copy, "tabs"), tab)}
          <span
            data-template-count={tab}
            className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            {fillLabel(countLabel, { count: String(counts[tab]) })}
          </span>
        </Link>
      ))}
    </nav>
  );
}

/**
 * The Library's featured band: one template, its own words, and the pair of actions its card offers.
 *
 * The band is not a second card model — it is the featured card, drawn wider. `View Template` and
 * `Create Relationship` are the fixture's `featured` items, which is why the band and the grid can say
 * the outline action differently (an introduction versus one row of a grid) without either spelling it
 * in the component.
 */
export function TemplateFeaturedBand({
  section,
  card,
}: {
  section: PageCopySection;
  card: TemplateShelfCard;
}) {
  return (
    <section
      data-template-featured
      className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-start gap-6">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700"
          style={{ backgroundImage: mutedGradientFor(card.slug).css }}
        >
          <span className={CARD_COVER_WORD} aria-hidden="true">
            {monogramOf(card.title)}
          </span>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {itemLabel(section, "label")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {card.chips.map((chip) => (
              <Chip key={chip} variant="tint">
                {chip}
              </Chip>
            ))}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            <Link href={card.detail.href} className={CARD_TITLE}>
              {card.title}
            </Link>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{card.summary}</p>
          <div className={CARD_META}>
            {card.meta.map((fact, index) => (
              <span key={fact} className={index === 0 ? "" : "border-l border-gray-300 pl-2"}>
                {fact}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link href={card.detail.href} className={OUTLINE}>
              {card.detail.label}
            </Link>
            {card.create === null ? null : (
              <FlowEntryLink href={card.create.href} className={PRIMARY}>
                {card.create.label}
              </FlowEntryLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The category filter: `All` and the five shelves, each a link with the count it would show.
 *
 * A link rather than a toggle group, for the reason the tabs are links: the shelf is `?filter=`, the
 * selected one carries `aria-current`, and the counts are computed over the search's own result set by
 * `libraryFilters()` — so "Family 3" is what the click actually opens.
 */
export function TemplateCategoryFilter({
  section,
  rows,
  current,
}: {
  section: PageCopySection;
  rows: readonly LibraryFilterRow[];
  current: LibraryFilter;
}) {
  const countLabel = itemLabel(section, "count");
  return (
    <div data-template-filter className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {section.heading}
      </span>
      {rows.map((row) => (
        <Link
          key={row.filter}
          href={row.href}
          data-template-filter-value={row.filter}
          aria-current={row.filter === current ? "true" : undefined}
          className={
            row.filter === current
              ? "inline-flex h-8 items-center gap-2 rounded-md bg-action px-3 text-sm font-semibold text-action-foreground"
              : "inline-flex h-8 items-center gap-2 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          }
        >
          {row.label}
          <span className="text-xs font-semibold opacity-80">
            {fillLabel(countLabel, { count: String(row.count) })}
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The Library search — a GET form, so the query is the URL and nothing hydrates.
 *
 * `filter` rides in a hidden field: a search inside `Family` stays inside `Family`, and the filter
 * links carry `q` back the other way (`libraryFilterPath`), so the two controls compose instead of
 * resetting one another.
 */
export function TemplateSearch({
  section,
  filter,
  value,
}: {
  section: PageCopySection;
  filter: LibraryFilter;
  value: string;
}) {
  return (
    <form
      method="get"
      action={templatesTabPath("library")}
      data-template-search
      className="flex flex-wrap items-end gap-2"
    >
      {filter === "all" ? null : <input type="hidden" name="filter" value={filter} />}
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {itemLabel(section, "label")}
        </span>
        <input
          type="search"
          name="q"
          defaultValue={value}
          placeholder={itemLabel(section, "placeholder")}
          className="h-9 w-full min-w-0 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        />
      </label>
      <button type="submit" className={PRIMARY}>
        {itemLabel(section, "submit")}
      </button>
      {value === "" ? null : (
        <Link href={templatesTabPath("library")} className={OUTLINE}>
          {itemLabel(section, "clear")}
        </Link>
      )}
    </form>
  );
}

/** Everything the kebab on a template card needs, all resolved by the page that mounts the shelf. */
export interface TemplateShelfMenu {
  readonly words: TemplateMenuWords;
  readonly notices: Partial<Record<CardMenuWriteId, string>>;
  readonly refusals: readonly MenuRefusal[];
  readonly fallbackRefusal: string;
  /** The `"use server"` writers, keyed by the row that performs them (#1134). */
  readonly writes: Partial<Record<CardMenuWriteId, CardMenuWrite>>;
  /** Where `Save a Copy` lands: the base of `?tab=mine&new=`. */
  readonly landNewAt: string;
}

/** Every card of one tab, in one grid. `cards.length === 0` is the caller's panel, not a hole. */
export function TemplateShelf({
  cards,
  tab,
  menu,
}: {
  cards: readonly TemplateShelfCard[];
  /** Which tab the grid is — a Library card's kebab is not a My Template's (#1134). */
  tab?: TemplateTab;
  menu?: TemplateShelfMenu;
}) {
  return (
    <ul data-template-shelf className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.id} className={CARD_FRAME} data-template-id={card.id}>
          <div className={CARD_COVER} style={{ backgroundImage: mutedGradientFor(card.slug).css }}>
            <span className={CARD_COVER_WORD} aria-hidden="true">
              {monogramOf(card.title)}
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {card.chips.map((chip, index) => (
                  <Chip key={chip} variant={index === 0 ? "tint" : "neutral"}>
                    {chip}
                  </Chip>
                ))}
              </div>
              {menu === undefined || tab === undefined ? null : (
                <CardMenu
                  data={{
                    label: fillLabel(menu.words.more, { title: card.title }),
                    entries: templateMenuOf(menu.words, tab, {
                      id: card.id,
                      detailHref: card.detail.href,
                      createHref: card.create === null ? null : card.create.href,
                    }),
                    payload: { templateId: card.id },
                    title: card.title,
                    notices: menu.notices,
                    refusals: menu.refusals,
                    fallbackRefusal: menu.fallbackRefusal,
                    writes: menu.writes,
                    landNewAt: menu.landNewAt,
                  }}
                />
              )}
            </div>
            <Link href={card.detail.href} className={CARD_TITLE}>
              {card.title}
            </Link>
            <p className="line-clamp-2 text-sm text-gray-600 dark:text-gray-300">{card.summary}</p>
            <div className={CARD_META}>
              {card.meta.map((fact, index) => (
                <span key={fact} className={index === 0 ? "" : "border-l border-gray-300 pl-2"}>
                  {fact}
                </span>
              ))}
            </div>
          </div>
          <div className={CARD_ACTIONS}>
            <Link href={card.detail.href} className={OUTLINE}>
              {card.detail.label}
            </Link>
            {card.create === null ? null : (
              /*
               * The create door, opened **in place** (#979 B): `/dashboard/templates` declares the
               * intercepted route, so this is the flow's dialog over the shelf rather than a
               * navigation away from it. `FlowEntryLink` is the soft navigation and the remembered
               * origin in one anchor — see `components/assessment-flow/flow-entry-link.tsx`.
               */
              <FlowEntryLink href={card.create.href} className={PRIMARY}>
                {card.create.label}
              </FlowEntryLink>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A tab's own band: its heading and its sentence, then whatever the caller drew under it.
 *
 * One section, so the Library and "My Templates" cannot drift into two ways of introducing a shelf —
 * the difference is the fixture, not the markup.
 */
export function TemplateShelfHeading({ section }: { section: PageCopySection }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{section.heading}</h2>
      <p className="max-w-3xl text-sm text-gray-600 dark:text-gray-300">{sectionBody(section)}</p>
    </div>
  );
}

/**
 * A state with no card in it: the tab is empty, the filter matched nothing, or the read did not answer.
 *
 * `reason` is the database's own sentence and is printed only when there is one — an empty tab and a
 * failed read are different facts, and the fixture words say which is which. `action` is the door out
 * of an empty state (`Browse the Library`), and it is a link because the tab it opens is a URL.
 */
export function TemplateShelfNotice({
  section,
  reason = null,
  action = null,
}: {
  section: PageCopySection;
  reason?: string | null;
  action?: { readonly href: string; readonly label: string } | null;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{section.heading}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {reason === null ? sectionBody(section) : fillLabel(sectionBody(section), { reason })}
      </p>
      {action === null ? null : (
        <Link href={action.href} data-template-notice-action className={`mt-3 ${PRIMARY}`}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
