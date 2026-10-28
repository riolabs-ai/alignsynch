import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type React from "react";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Quiz Making Website - Play & Earn Money",
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
