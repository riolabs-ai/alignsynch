/**
 * template-ancestor: components/marketing/marketing-header.tsx   (variation: a one-row band above every shell — one item, a door to `/admin/brand`, drawn only for an admin)
 *
 * The admin notice bar (#906) — the top edge of the viewport, for exactly one reader.
 *
 * **It is one row, not a notice system.** One item, four possible renders, no count, no badge, no
 * "what's new", no close button and no dismiss state. The row's anatomy, its type, its token
 * mapping and the offsets it moves are fixed by
 * `docs/specs/spec-design-page-rel-templates-v2/banner/README.md`; this component is the build of
 * that spec, not a second opinion about it. A second item is one more row in `data/pages/shell.ts`'s
 * `items`, not a prop here.
 *
 * **It renders nothing at all for everyone else.** No box, no reserved gap, no `hidden`. A
 * signed-out visitor, a member and the QuizHub build get exactly the document they got before this
 * file existed — which is what keeps `pnpm parity`'s hashes still (a hash that moves is the bar
 * leaking, not a hash to update). The three reads behind that answer live in
 * `lib/shell/admin-notice.ts` and are unit-tested against the real ladder.
 *
 * **The role arrives as a prop, and the flags are read here.** `app/(mainlayout)/layout.tsx` and
 * `app/(marketing)/layout.tsx` each read the session once for the whole chrome (`shellSession()`),
 * and the same role decides the bar and the account menu — so handing it down costs no second read
 * of the profile row, while the two capability flags stay where they belong, in a server module.
 *
 * **It is a server component, mounted by the two group layouts.** Not by the app shell component
 * (`main-layout.tsx`), which is `"use client"`: importing this file from there would make it a
 * client component and drag `lib/brand-boundary.ts` / the session reader into the browser bundle —
 * the E34 failure `AGENTS.md` records. A client component can still *render* it, because the layout
 * passes it down as an already-created element.
 *
 * **Fixed at `z-40`, out of flow.** The row covers the top 40px of the viewport and does not
 * participate in layout, so the two things below it are moved down by `padding-top` on the wrapper
 * that carries `.admin-notice-shell` — and the sticky pieces (both headers, the rail, the two
 * in-page menus) read `--admin-notice-h` for their own `top`. Every one of those resolves to `0px`
 * when the bar is absent, so the offsets cannot disagree with the row above them. It is mounted
 * **last** in the marketing layout for a second reason: an element placed before the page's own
 * children shifts the ids React's `useId` hands to them (`radix-_R_ii_` becomes `radix-_R_153_`),
 * which is a byte `pnpm parity` sees and a reader does not. Out of flow and last, it changes no
 * id and no sibling.
 *
 * **The link is internal, so it is a `Link`.** `/admin/brand` is a page of this app; a
 * `LeavingLink` (new tab, external marker) would be wrong in both senses.
 */
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import type { UserRole } from "@/content/role-ladder";
import { adminProductShipped, quizProductShipped } from "@/lib/brand-boundary";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { adminNoticeVisible } from "@/lib/shell/admin-notice";

/**
 * The bar. `viewerRole` is this request's `user_profile.role`, or `null` when nobody is signed in.
 *
 * It returns `null` — not an empty element, not a `hidden` box — when any of the three reads says
 * this reader does not get one. The layouts check the same predicate before they render it at all,
 * because they need the answer to publish the height; this guard is the one that makes the
 * component safe to mount anywhere.
 */
export function AdminNoticeBar({
  copy,
  viewerRole,
}: {
  copy: PageCopy;
  viewerRole: UserRole | null;
}) {
  const visible = adminNoticeVisible({
    adminProduct: adminProductShipped(),
    quizProduct: quizProductShipped(),
    role: viewerRole,
  });
  if (!visible) return null;

  const section = sectionOf(copy, "admin-notice");
  const item = section.cta;

  return (
    <div
      data-admin-notice
      className="fixed inset-x-0 top-0 z-40 border-b border-border bg-foreground text-background"
    >
      {/*
        `min-h` is the published height and `py-2` is the padding under it: at a wide viewport the
        one line (20px) plus 16px of padding is 36px, so the min-height draws the 40px the spec
        publishes; at 390 the row's published height is 56px and a label that wraps to two lines
        fills that box exactly instead of being clipped. `items-center` centres both cases.
      */}
      <div className="marketing-container flex min-h-[var(--admin-notice-h)] items-center gap-2 py-2">
        <span aria-hidden="true" className="h-[7px] w-[7px] shrink-0 rounded-full bg-action" />
        <span className="text-[11px] font-semibold uppercase leading-5 tracking-[0.045em]">
          {itemLabel(section, "label")}
        </span>
        {item === undefined ? null : (
          <Link
            href={item.href}
            className="text-[11px] font-semibold uppercase leading-5 tracking-[0.045em] underline decoration-background/40 underline-offset-2 hover:decoration-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background"
          >
            {item.label}
          </Link>
        )}
      </div>
    </div>
  );
}
