import { MainLayout } from "@/components/layout/main-layout";
import { shellPageCopy } from "@/data/pages/shell";
import type React from "react";

/**
 * The shell's mount point. The copy is parsed here, on the server, and handed down as a
 * prop — the header, sidebar and drawers are client components, and a module that carries
 * zod must not reach them. `data:check` E23 attributes this module to the `shell` surface
 * and fails if `data/pages/shell.ts` stops being reachable from it.
 */
export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MainLayout copy={shellPageCopy}>{children}</MainLayout>;
}
