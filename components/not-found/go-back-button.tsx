"use client";

// template-ancestor: components/ui/button.tsx   (variation: a back button that pops history and falls back to a route)

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

/**
 * "Go Back" is the one control in the 404 that needs a handler, and a server component
 * cannot pass one to a client component. Extracting it keeps `app/not-found.tsx` on the
 * server so it can read `data/pages/not-found.ts` without shipping zod — the label still
 * comes from the fixture, this only owns the `window.history.back()`.
 */
export function GoBackButton({ label }: { label: string }) {
  return (
    <Button variant="outline" onClick={() => window.history.back()}>
      <ArrowLeft className="w-5 h-5 mr-2" />
      {label}
    </Button>
  );
}
