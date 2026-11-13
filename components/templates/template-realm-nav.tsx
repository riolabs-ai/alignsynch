// template-ancestor: components/home/as2-section-nav.tsx   (variation: the catalogue's realm menu — seven counted anchors onto one long shelf, scrolling horizontally *inside itself* on a phone rather than wrapping onto a second row and pushing the first group down)

import type { TemplatesPageModel } from "@/lib/templates-page";

/**
 * The sticky realm menu: `All`, then one anchor per realm with its derived count.
 *
 * **It sticks directly under the shared header, and the offset is the header's own.** The row is
 * `top-[var(--site-header-height)]` — the same custom property `components/marketing/marketing-header.tsx`
 * draws `h-20` from — so the bar cannot drift under the chrome when the header's height changes.
 * The seven targets' `scroll-margin-top` is derived from the same two heights in
 * `app/globals.css` (`.templates-anchors`), which is the mechanism the AS2 home page already
 * uses for its own two-bar page (`#853`).
 *
 * **Scrolling is confined to this row.** `overflow-x-auto` on the inner flex row means a phone
 * gets a swipeable menu and the *page* never gains a horizontal scrollbar: the row is
 * `w-full` inside `.marketing-container`, and its overflow is clipped by its own box. That is the
 * acceptance criterion "realm scrolling confined to the realm menu", and the only way to fail it
 * is to let a child size the page.
 *
 * **Counts are derived per group.** A realm whose group is empty is not in the model at all
 * (`realmGroups()` drops it), so the menu can never point at a heading that does not exist, and
 * the number beside a realm is the number of cards under it rather than a typed one.
 *
 * Holds no words: realm names come from the taxonomy, the counts from the groups, and `All` from
 * the fixture (E23, budget 0).
 */
export function TemplateRealmNav({ catalogue }: { catalogue: TemplatesPageModel["catalogue"] }) {
  return (
    <nav
      aria-label={catalogue.eyebrow ?? catalogue.search.allLabel}
      className="sticky top-[calc(var(--admin-notice-h)_+_var(--site-header-height))] z-[9] border-b border-border bg-background/98 backdrop-blur-sm"
      data-templates-realm-nav=""
    >
      <div className="marketing-container">
        <div className="flex min-h-12 items-stretch gap-x-[clamp(0.875rem,2.3vw,1.6875rem)] overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <a
            className="inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 border-transparent text-[12px] font-semibold whitespace-nowrap text-action hover:border-accent focus-visible:border-accent focus-visible:outline-none"
            href={catalogue.search.allAnchor}
          >
            {catalogue.search.allLabel}
            <span className="inline-grid h-[19px] min-w-[19px] place-items-center rounded-full bg-accent/15 px-1 text-[10px] font-bold text-action">
              {String(catalogue.total)}
            </span>
          </a>
          {catalogue.realms.map((group) => (
            <a
              className="inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 border-transparent text-[12px] font-semibold whitespace-nowrap text-muted-foreground hover:border-accent hover:text-foreground focus-visible:border-accent focus-visible:outline-none"
              href={group.anchor}
              key={group.realm}
            >
              {group.realm}
              <span className="inline-grid h-[19px] min-w-[19px] place-items-center rounded-full bg-accent/15 px-1 text-[10px] font-bold text-action">
                {group.count}
              </span>
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}

export default TemplateRealmNav;
