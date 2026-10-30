import { MainLayout } from "@/components/layout/main-layout";
import { brand, brandIdOf } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndexFor } from "@/data/searchdata";
import { brandMark } from "@/lib/brand-mark";
import { shellAccount } from "@/lib/auth/shell-account";
import { hiddenNavHrefs } from "@/lib/flags";
import { navViewer } from "@/lib/nav";
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
 * flag, so the id — not the record — is what the client switch reads; `navViewer()` is the
 * capability stub documented in `lib/nav.ts`, and **this is the line a role model replaces**:
 * it becomes `navViewer(await currentUser())`, which is why it is resolved here, on the
 * server, and never in the sidebar.
 *
 * `account` is the header's third input and the one identity the shell renders (issue #212).
 * It is a plain `{ name, handle, email }` or `null`, resolved from **this request's** session
 * by `lib/auth/shell-account.ts` — the same server/client boundary the copy crosses, for the
 * same reason: a client component cannot call `currentUser()`, and an identity the browser
 * supplied is not one. `null` is a real state (signed out), and the header draws a neutral disc
 * for it; what it never does is fall back to a fixture person.
 */
export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const brandId = brandIdOf(brand);
  const viewer = navViewer();
  const account = await shellAccount();
  return (
    <MainLayout
      copy={shellPageCopy}
      mark={brandMark(brand.logo)}
      brandId={brandId}
      viewer={viewer}
      account={account}
      searchIndex={searchIndexFor(brandId, viewer)}
      hiddenNav={hiddenNavHrefs()}
    >
      {children}
    </MainLayout>
  );
}
