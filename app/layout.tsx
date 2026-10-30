import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { brand } from "@/data/brand";
import { brandThemeVars } from "@/lib/brand-theme";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type React from "react";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

/**
 * The document title.
 *
 * Both halves read `brand.name` from `data/brand.ts`: the sidebar logo, the footer logo
 * and the copyright line render the same word out of `data/pages/shell.ts`, so a title
 * spelled here would be a second source of truth for the product's name — and a second
 * brand would change the chrome and leave the tab title behind.
 *
 *  - `default` is what a route with no `metadata.title` of its own gets. The string it
 *    replaces ("Quiz Making Website - Play & Earn Money") was scaffold copy from before
 *    the brand, and it was the tab title on roughly twenty routes.
 *  - `template` composes a child route's own title in front of the brand
 *    ("Explore Quizzes · <brand>") instead of replacing it. That is why every route
 *    title below is written brand-free: a title that still carried "| <brand>" or
 *    "| QuizMaker" would print the brand twice and disagree with this one.
 */
export const metadata: Metadata = {
  title: {
    default: brand.name,
    template: `%s · ${brand.name}`,
  },
  description: "Create quizzes, play games, and earn money with our multi-vendor quiz platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /**
   * The brand's accent tokens, as custom properties on `<html>`.
   *
   * An inline style, not a class and not a `<style>` block, for two reasons: it outranks
   * both `:root` and `.dark` without `!important`, so the skin's `primary` is painted in
   * both modes; and it is empty for the template brand — `{}` becomes `undefined` here, so
   * the default build ships no `style` attribute at all and its markup is unchanged. What
   * does and does not travel is `lib/brand-theme.ts`'s decision, including why the ground
   * and the ink stay the theme's.
   */
  const brandVars = brandThemeVars(brand);
  return (
    <html
      lang="en"
      style={Object.keys(brandVars).length > 0 ? (brandVars as React.CSSProperties) : undefined}
    >
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <TooltipProvider delayDuration={0}>
            <SidebarProvider>
              <Toaster richColors />
              {children}
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
