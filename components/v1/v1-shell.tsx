// template-ancestor: components/layout/main-layout.tsx   (variation: the prototype's shell: same gutter and chrome, its own navigation)
"use client";

import { V1StoreProvider } from "@/lib/v1/store";
import { PersonaBar } from "@/components/v1/persona-bar";
import { ReviewChip } from "@/components/v1/review-chip";
import type { ReactNode } from "react";

/**
 * The /v1 shell — the store provider, the persona bar, the review-status chip, and the screen.
 *
 * Every /v1 screen renders inside this, so the store (templates, relationships, accounts,
 * tickets, reviews) and the persona are available to every view, and the bar is present on every
 * one. The chip floats bottom-right from `sm` up; below that the persona bar draws it inline, so
 * the mobile chip is reachable from the top and never covers the answer sheet's sticky action bar.
 * There is no other chrome: `/v1/**` renders nothing but this shell, which is what keeps the
 * prototype from leaking a link back into the real app.
 */
export function V1Shell({ children }: { children: ReactNode }) {
  return (
    <V1StoreProvider>
      <PersonaBar />
      {children}
      <ReviewChip className="fixed bottom-4 right-4 z-40 hidden sm:inline-flex" />
    </V1StoreProvider>
  );
}
