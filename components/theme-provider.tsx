"use client";

// template-ancestor: components/ui/sonner.tsx   (variation: a one-line wrapper binding a library provider to the app's theme defaults — no markup of its own)

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
