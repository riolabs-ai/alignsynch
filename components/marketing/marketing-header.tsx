// template-ancestor: components/layout/nav-menus.tsx   (variation: the public chrome — the brand mark, PublicNav and the account slot, no sidebar, search palette or drawers)

import { PublicAccountSlot, PublicNav } from "@/components/layout/nav-menus";
import type { Brand } from "@/content/brand";
import type { PageCopy } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import type { ShellAccount } from "@/lib/auth/shell-account";
import type { BrandMark } from "@/lib/brand-mark";
import Image from "next/image";

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
 * **`copy` is the shell fixture, not the marketing one.** These are chrome words — "Pricing",
 * "Sign in", "Sign up" — and they are the words the sidebar's own rows use, so the ids resolve
 * against `data/pages/shell.ts` exactly as `AppNav`'s do. The landing page's bands keep their own
 * fixture (`data/pages/marketing.ts`) and their own component (`marketing-landing.tsx`).
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
  /** The **shell** fixture (`data/pages/shell.ts`) — the chrome's words, not a route's. */
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
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <span className="flex items-center gap-2">
          {mark ? (
            <Image
              alt={brand.name}
              className="h-8 w-auto"
              height={mark.height}
              priority
              src={mark.src}
              width={mark.width}
            />
          ) : (
            <span className="text-lg font-semibold text-primary tracking-tight">{brand.name}</span>
          )}
        </span>
        <PublicNav brandId={brandId} copy={copy} />
        <PublicAccountSlot account={account} copy={copy} />
      </div>
    </header>
  );
}
