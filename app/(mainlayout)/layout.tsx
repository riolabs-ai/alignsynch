import { AdminNoticeBar } from "@/components/layout/admin-notice-bar";
import { MainLayout } from "@/components/layout/main-layout";
import { brand, brandIdOf } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndexFor } from "@/data/searchdata";
import { adminProductShipped, quizProductShipped } from "@/lib/brand-boundary";
import { brandMark } from "@/lib/brand-mark";
import { shellSession } from "@/lib/auth/shell-account";
import { hiddenNavHrefs } from "@/lib/flags";
import { navViewer } from "@/lib/nav";
import { ADMIN_NOTICE_SHELL_CLASS, adminNoticeVisible } from "@/lib/shell/admin-notice";
import { RAIL_COOKIE, railIsCollapsed } from "@/lib/shell/rail-preference";
import { cookies } from "next/headers";
import type React from "react";

/**
 * The shell's mount point. The copy is parsed here, on the server, and handed down as a
 * prop — the header, sidebar and drawers are client components, and a module that carries
 * zod must not reach them. `data:check` E23 attributes this module to the `shell` surface
 * and fails if `data/pages/shell.ts` stops being reachable from it.
 *
 * `mark` is resolved here for the same reason `copy` is: `brandMark` reads the media
 * registry (`data/media.ts`) and the sidebar is a client component, so the lookup happens on
 * the server and only the three fields `next/image` needs cross over. It is `undefined` for a
 * brand whose logo is a placeholder — see `lib/brand-mark.ts` — and the sidebar then draws the
 * icon it has always drawn.
 *
 * `brandId` and `viewer` are the navigation's two inputs (issue #156). The brand is a build
 * flag, so the id — not the record — is what the client switch reads; `navViewer(role)` maps this
 * request's `user_profile.role` onto capabilities (`lib/nav.ts`). **The role never crosses to the
 * client**: the sidebar receives the capability set, and it is resolved here, on the server,
 * because a client component cannot read a session.
 *
 * `account` and `role` both come from `shellSession()` — one session read and one profile read for
 * the two things the chrome needs, rather than the same two reads twice (the header wants a name,
 * the menu wants the role). `account` is a plain `{ name, handle, email }` or `null`, resolved
 * from **this request's** session — the same server/client boundary the copy crosses, for the
 * same reason: a client component cannot call `currentUser()`, and an identity the browser
 * supplied is not one. `null` is a real state (signed out), and the header draws a neutral disc
 * for it; what it never does is fall back to a fixture person.
 *
 * **The admin notice bar (#906) is mounted here, above the shell, and only when it renders.** Its
 * predicate is `role` — already read for the menu — plus the two capability flags, judged once by
 * `adminNoticeVisible`, and the answer decides two things at the same time: whether the bar is in
 * the document, and whether the wrapper carries `.admin-notice-shell`, the class that publishes
 * `--admin-notice-h` to the three offsets the bar moves (both headers' `top`, the rail's `top` and
 * height). When the answer is no this module returns `<MainLayout>` exactly as it did before the
 * bar existed — no wrapper element, no class, no markup difference — which is what keeps a
 * member's, a visitor's and QuizHub's render out of `pnpm parity`'s diff.
 */
export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brandId = brandIdOf(brand);
  const { account, role } = await shellSession();
  const viewer = navViewer(role);
  /**
   * The rail's width for **this request** (#542 phase 2).
   *
   * Read here, on the server, from the cookie the rail's own toggle writes
   * (`app/(mainlayout)/rail-actions.ts`). The shell is a client component, so a preference the
   * browser kept would only be honoured after hydration — the flash the removed `localStorage`
   * toggle produced. One cookie read, one prop, no second source.
   */
  const railCookie = (await cookies()).get(RAIL_COOKIE)?.value;
  /** The bar's three-read predicate (`banner/README.md` §7), answered once for the whole chrome. */
  const notice = adminNoticeVisible({
    adminProduct: adminProductShipped(),
    quizProduct: quizProductShipped(),
    role,
  });
  const shell = (
    <MainLayout
      copy={shellPageCopy}
      mark={brandMark(brand.logo)}
      brandId={brandId}
      viewer={viewer}
      account={account}
      railCollapsed={railIsCollapsed(railCookie)}
      searchIndex={searchIndexFor(brandId, viewer)}
      hiddenNav={hiddenNavHrefs()}
      notice={notice}
    >
      {children}
    </MainLayout>
  );

  if (!notice) return shell;

  return (
    <div className={ADMIN_NOTICE_SHELL_CLASS}>
      <AdminNoticeBar copy={shellPageCopy} viewerRole={role} />
      {shell}
    </div>
  );
}
