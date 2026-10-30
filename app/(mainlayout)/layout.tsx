import { MainLayout } from "@/components/layout/main-layout";
import { brand } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { brandMark } from "@/lib/brand-mark";
import type React from "react";

/**
 * The shell's mount point. The copy is parsed here, on the server, and handed down as a
 * prop — the header, sidebar and drawers are client components, and a module that carries
 * zod must not reach them. `data:check` E23 attributes this module to the `shell` surface
 * and fails if `data/pages/shell.ts` stops being reachable from it.
 *
 * `mark` is resolved here for the same reason `copy` is: `brandMark` reads the media
 * registry (`data/media.ts`, 100 entries) and the sidebar is a client component, so the
 * lookup happens on the server and only the three fields `next/image` needs cross over. It
 * is `undefined` for a brand whose logo is a placeholder — see `lib/brand-mark.ts` — and
 * the sidebar then draws the icon it has always drawn.
 */
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MainLayout copy={shellPageCopy} mark={brandMark(brand.logo)}>
      {children}
    </MainLayout>
  );
}
