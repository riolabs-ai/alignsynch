// template-ancestor: components/templates/template-card.tsx   (variation: the same catalogue card, drawn inside the dashboard — a seeded cover wash and a monogram the public card has no use for, two buttons on every card because a member is signed in and *can* act, and a "who owns this" chip on the tab that lists what they have got; the public card's single "use" link and its `/register` destination belong to a shop, not to a workspace)

/**
 * The templates shelf — one card per template, two tabs over it (#620).
 *
 * **The component holds no words and no paths.** Every chip, button label and count is a
 * `MemberCard` field the page resolved from `data/pages/dashboard-templates.ts` through
 * `lib/member/shelf.ts`, so this file stays at zero copy literals (E23) and a rename is one
 * fixture edit. It is a server component for the same reason `my-instances.tsx` is: the cards are
 * links, every state of the screen is a URL, and there is nothing to hydrate.
 *
 * **`MemberCard` is the relationship list's type too.** One projection feeds both shelves (#795
 * F2): the fields this card prints are the shared half, and the `relationship` half is `null` on
 * every card here because a template has no stage, no second party and nothing paid.
 *
 * **The cover is the muted wash, not an image.** `mutedGradientFor(slug)` is the approved band
 * (`hsl(h 22% 86%) → hsl(h±12–23° 24% 74%)`): no white overlay, no white title band, and the
 * monogram is **ink at ~34%** because white type on an 86%-lightness tint is invisible. `/categories`
 * keeps the full-strength gradient — this is a second derivation, not a change to the first.
 *
 * **The densities are the shipped ones.** `rounded-lg` is the 5px token, the card border is
 * `gray-200`, chips are `gray-300`, the action row is `h-9` and the page's own CTA is `h-11`; the
 * outline button hovers to `bg-gray-50` with its text unchanged and the primary to
 * `bg-action-hover`, so no rule paints light text without also painting a coloured fill.
 */
import { Chip } from "@/components/ui/badge";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { mutedGradientFor, monogramOf } from "@/lib/category-gradient";
import { TEMPLATE_TABS, type TemplateTab, templatesTabPath } from "@/lib/member/shelf";
import {
  CARD_ACTIONS,
  CARD_COVER,
  CARD_COVER_WORD,
  CARD_FRAME,
  CARD_META,
  CARD_TITLE,
  type TemplateShelfCard,
} from "@/lib/member/card";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";

/**
 * The frame, the cover slot, the title and the facts line are **not** this file's (#795).
 *
 * They are the card's, declared once in `lib/member/card.ts`, because the relationship shelf draws
 * the same card: a copy of the frame here was a second look waiting to happen, and the artifact's
 * "same frame, same padding" claim had nothing enforcing it until both shelves imported one string.
 * What stays local is the axis — the gradient wash and the monogram this cover draws, where the
 * relationship draws its stage word — and this shelf's two buttons.
 */
const OUTLINE =
  "inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800";
const PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-md bg-action px-3 text-sm font-semibold text-action-foreground hover:bg-action-hover";

/**
 * The two tabs, as links.
 *
 * `aria-current` rather than a client component: the tab is `?tab=mine`, so a click is a GET and
 * the selected tab is a fact about the URL — the same reason `/assessment/instances` draws its
 * stage tabs this way.
 */
export function TemplateTabs({ copy, current }: { copy: PageCopy; current: TemplateTab }) {
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
              ? "rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
              : "rounded-md px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
          }
        >
          {itemLabel(sectionOf(copy, "tabs"), tab)}
        </Link>
      ))}
    </nav>
  );
}

/** Every card of one tab, in one grid. `cards.length === 0` is the caller's panel, not a hole. */
export function TemplateShelf({ cards }: { cards: readonly TemplateShelfCard[] }) {
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
            <div className="flex flex-wrap items-center gap-2">
              {card.chips.map((chip, index) => (
                <Chip key={chip} variant={index === 0 ? "tint" : "neutral"}>
                  {chip}
                </Chip>
              ))}
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
              <Link href={card.create.href} className={PRIMARY}>
                {card.create.label}
              </Link>
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
 * One section, so the catalogue and "My Templates" cannot drift into two ways of introducing a
 * shelf — the difference is the fixture, not the markup.
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
 * A state with no card in it: the tab is empty, or the read did not answer.
 *
 * `reason` is the database's own sentence and is printed only when there is one — an empty tab and
 * a failed read are different facts, and the fixture words say which is which.
 */
export function TemplateShelfNotice({
  section,
  reason = null,
}: {
  section: PageCopySection;
  reason?: string | null;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{section.heading}</p>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
        {reason === null ? sectionBody(section) : fillLabel(sectionBody(section), { reason })}
      </p>
    </div>
  );
}
