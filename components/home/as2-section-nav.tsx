// template-ancestor: components/layout/nav-menus.tsx   (variation: the in-page menu — a sticky single row of five jump links under the marketing header, horizontally scrollable instead of a wrapping nav)

import type { As2HomeModel } from "@/lib/home-alignsynch";
import type React from "react";

/**
 * The page's own menu: one row of five jump links, sticky directly under the shared header.
 *
 * **Two sticky bars, and this one loses on purpose.** The header is `sticky top-0 z-10`; this sits
 * at `top-[var(--site-header-height)]` (the same variable the header's row height is declared
 * from) and at `z-[5]`, so the header always paints over it. A scroll offset that both bars share
 * is `app/globals.css`'s `.home-anchors` — this component contributes its row height to that
 * variable's second term and nothing else.
 *
 * **One row, always.** The row is `overflow-x-auto` with the scrollbar hidden, and every link is
 * `shrink-0`, so at 360 the five labels scroll sideways instead of wrapping into a block that would
 * push the page's content down. That horizontal scroll is the only one the page allows; the
 * document itself must not overflow, which is what the QA stills measure.
 *
 * **Keyboard focus lands here first, and it is named.** The `<nav aria-label>` comes from the copy
 * fixture ("On this page"), so a screen-reader user hears the menu's job rather than "navigation,
 * navigation". No JavaScript is involved in any of it: these are anchors, the browser does the
 * jump, and `.home-anchors` gives the targets their `scroll-margin-top`.
 */
export function As2SectionNav({ nav }: { nav: As2HomeModel["nav"] }): React.ReactElement {
  return (
    <nav
      aria-label={nav.name}
      className="sticky top-[var(--site-header-height)] z-[5] border-b border-line bg-white/[0.98]"
    >
      <div className="home-container scrollbar-hide flex h-[3.25rem] items-center gap-[clamp(18px,3vw,32px)] overflow-x-auto max-[767px]:h-12 max-[740px]:gap-5">
        {nav.items.map((item) => (
          <a
            className="inline-flex h-full shrink-0 items-center border-b-2 border-transparent text-[13px] font-[600] leading-[1.55] text-[#64748b] hover:border-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 max-[767px]:text-xs"
            href={item.href}
            key={item.href}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
