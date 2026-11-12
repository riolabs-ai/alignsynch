// template-ancestor: components/layout/nav-menus.tsx   (variation: the public chrome — the brand mark, PublicNav and the account slot, no sidebar, search palette or drawers)

import { PublicAccountSlot, PublicNav } from "@/components/layout/nav-menus";
import type { Brand } from "@/content/brand";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import type { ShellAccount } from "@/lib/auth/shell-account";
import type { BrandMark } from "@/lib/brand-mark";
import Image from "next/image";
import Link from "next/link";

/**
 * The marketing chrome's header: the mark, the public menu, and the account slot.
 *
 * Deliberately not `components/layout/header.tsx`. That header is the product shell's — search
 * palette, notification drawer, account menu, sidebar toggle, wallet chip — and a public page gets
 * none of it: no sidebar, no app navigation, no theme toggle (the build has one light default since
 * #157, and a control that flips a class nothing in this layout paints is a knob connected to
 * nothing). What a public page *does* get is navigation, because a site whose four other pages are
 * reachable only by guessing the URL is not a site.
 *
 * **What this file composes, and from where.**
 *
 *   - the mark is `lib/brand-mark.ts`'s answer for this brand: a real lockup is drawn (its wordmark
 *     is black on nothing, so the light ground is the one it was drawn for), and a placeholder
 *     resolves to `undefined`, in which case the brand's name is set in type instead. The name is
 *     never typed here — it is `brand.name` either way;
 *   - the menu is `PublicNav` from `components/layout/nav-menus.tsx` — the same file that owns the
 *     sidebar's menus, so this repo has one navigation definition and not two. Its rows are the
 *     brand's (five on `alignsynch`, four on `quizhub`), and its words are the shell fixture's;
 *   - the account slot is `PublicAccountSlot`, the signed-out pair of links or the signed-in
 *     person, resolved **on the server** by the layout and handed down as `account`.
 *
 * **`copy` is the shell fixture's public slice, not the marketing one.** These are chrome words —
 * "Pricing", "Sign in", "Sign up" — and they are the words the sidebar's own rows use, so the ids
 * resolve against `data/pages/shell.ts` exactly as `AppNav`'s do… but only the ids this header
 * draws: `app/(marketing)/layout.tsx` hands over `publicChromeCopy()`
 * (`lib/shell-copy.ts`), because `PublicNav` is a client component and everything it is given is
 * serialised into the browser's payload. The landing page's bands keep their own fixture
 * (`data/pages/marketing.ts`) and their own component (`marketing-landing.tsx`).
 *
 * **The old single CTA is gone.** The header used to print `copy.cta` — one action, repeated from
 * the page's closing band — and on a marketing page that action was "start the assessment", which a
 * signed-in reader has already done. It is replaced by the account slot: signed out, the two things
 * a visitor can do here (`/login`, `/register`); signed in, their own name and avatar. `/welcome`
 * keeps its hero and closing CTA bands: those are the page's, not the chrome's.
 *
 * **No active-row styling, on purpose.** Marking the current route needs `usePathname()`, which
 * would make this a client component — and the identity in it is resolved on the server precisely
 * so a visitor's session is never read in the browser (#212). The menu is therefore a server
 * render of five links and the active state is a later card's decision.
 *
 * **The lockup is a link home.** A chrome's brand signature is the one control a visitor presses
 * without reading, and until this anchor existed the marketing header's was a dead image — the only
 * way back to `/` from `/pricing` was the menu's own "Home" row. It is a plain `next/link` and not
 * `LeavingLink`: `/` is in the app, and `LeavingLink` exists for destinations that leave it. The
 * anchor carries **no `aria-label`**; the `alt` inside the image is its accessible name, and a
 * second name would compete with the one a screen reader already reads.
 *
 * `flex shrink-0` on the anchor is load-bearing, not decoration. Tailwind's preflight makes an
 * `<img>` `display: block`, so an inline anchor around one fragments into anonymous block boxes and
 * invents a line box; the lockup then sits a few pixels off centre at every width. A flex anchor is
 * exactly its content's height, and `shrink-0` keeps the item from being squeezed where the old
 * `shrink-0` on the image used to do that job as the span's direct flex child. No size class moved.
 *
 * **The footer's lockup stays unlinked, on purpose.** `components/layout/footer.tsx`'s brand block
 * is the signature *and* its blurb in one `h-24` row — an identity panel, not a nav affordance — and
 * the owner's note named the header. Wrapping it is a separate decision, not a follow-on edit.
 *
 * **Nothing in this file is a copy literal.** E23 attributes `components/marketing/**` to the
 * landing page's fixture at a budget of 0, so every word rendered here arrives as a resolved id
 * from `PublicNav` / `PublicAccountSlot`, or as `brand.name`.
 */
export function MarketingHeader({
  brand,
  brandId,
  copy,
  mark,
  account,
}: {
  brand: Brand;
  /** The build's brand, so the public menu picks its rows the way the sidebar does. */
  brandId: BrandId;
  /** The **shell fixture's public slice** (`publicChromeCopy`, `lib/shell-copy.ts`) — the chrome's words, not a route's. */
  copy: PageCopy;
  mark?: BrandMark;
  /**
   * The signed-in person, or `null` for a signed-out visitor. Resolved by
   * `app/(marketing)/layout.tsx` with `shellAccount()` — the same call the product shell's layout
   * makes — because a client component cannot read a session, and a fixture person is not one
   * (#212).
   */
  account: ShellAccount | null;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="marketing-container flex h-20 items-center justify-between gap-6">
        <span className="flex min-w-0 items-center gap-3">
          <Link className="flex shrink-0 items-center" href="/">
            {mark ? (
              /**
               * The brand's **lockup**, whole — mark *and* wordmark (#539 item 1, corrected).
               *
               * The polish cohort read "2–2.5× larger" as an instruction about the icon and swapped
               * this slot to the square mark at a 96px box with the name set in type beside it. The
               * owner's correction: *"resize existing full logo brand image — you replaced the logo
               * with an icon, off brand."* The lockup is the signature on the chrome that identifies
               * the product; the square mark belongs on the surfaces that need an icon (the tab,
               * the home-screen tile, the avatar). So this is the 818×127 export again, and the only
               * thing that changed is its size.
               *
               * **Sized by height, width follows.** `h-*` with `w-auto`, plus the intrinsic
               * `width`/`height` `next/image` is handed, so the 818:127 ratio is the browser's
               * arithmetic and not a class someone can get wrong. No square box, no `object-cover`,
               * no window: the whole file is placed, which is what #470 fixed the first time.
               *
               * **The expanded size is not set here** (t_f4e69dba). Every viewport where the header
               * is expanded draws the lockup at `2rem` / 206.1px from the one `img[data-brand-lockup]`
               * rule in `app/globals.css`, shared with the footer, which used to draw the same file
               * at 48px. The `h-6` / `sm:h-7` below are the sizes *below* that breakpoint, where the
               * header is collapsed and the criterion does not apply; measured 24px at 390 and 28px
               * at 768, both unchanged by this card.
               *
               * The header row is `h-20` (80px), so no size here can make it taller — 32px is well
               * inside it, and the brand slot keeps the room it had (376.8px at 1440, 193px at 768
               * where `PublicNav` reappears, 171.7px at 390 before the account pair).
               */
              <Image
                alt={brand.name}
                className="h-6 w-auto shrink-0 sm:h-7"
                data-brand-lockup
                height={mark.height}
                priority
                src={mark.src}
                width={mark.width}
              />
            ) : (
              <span className="text-lg font-semibold text-primary tracking-tight">
                {brand.name}
              </span>
            )}
          </Link>
        </span>
        <PublicNav brandId={brandId} copy={copy} />
        <PublicAccountSlot account={account} copy={copy} />
      </div>
    </header>
  );
}
