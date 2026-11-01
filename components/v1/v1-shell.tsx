// template-ancestor: components/layout/main-layout.tsx   (variation: the prototype's shell: same gutter and chrome, its own navigation)
"use client";

import { V1StoreProvider } from "@/lib/v1/store";
import { PersonaBar } from "@/components/v1/persona-bar";
import type { ReactNode } from "react";

/**
 * The /v1 shell — the store provider and the persona bar, mounted by both route-group layouts.
 * Every /v1 screen renders inside this, so the store (templates, relationships, accounts,
 * tickets) and the persona are available to every view, and the bar is present on every one.
 */
export function V1Shell({ children }: { children: ReactNode }) {
  return (
    <V1StoreProvider>
      <PersonaBar />
      {children}
    </V1StoreProvider>
  );
}
