import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type React from "react";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

/**
 * The document title.
 *
 * `QuizHub` is not invented here: it is the product name the repo already ships, and
 * the sidebar logo and the footer logo render the same word from `data/pages/shell.ts`
 * (`heading`, and the `footer-legal/copyright` line).
 *
 *  - `default` is what a route with no `metadata.title` of its own gets. The string it
 *    replaces ("Quiz Making Website - Play & Earn Money") was scaffold copy from before
 *    the brand, and it was the tab title on roughly twenty routes.
 *  - `template` composes a child route's own title in front of the brand
 *    ("Explore Quizzes · QuizHub") instead of replacing it. That is why every route
 *    title below is written brand-free: a title that still carried "| QuizHub" or
 *    "| QuizMaker" would print the brand twice and disagree with this one.
 */
export const metadata: Metadata = {
  title: {
    default: "QuizHub",
    template: "%s · QuizHub",
  },
  description: "Create quizzes, play games, and earn money with our multi-vendor quiz platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
