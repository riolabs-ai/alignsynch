"use client";
// template-ancestor: components/settings/privacy-settings.tsx   (variation: the blind rule stated in plain language — neither party sees the other's answers until the session is scored — instead of visibility controls)

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

/**
 * The privacy section (#384) — the blind rule, in plain language, as its one statement: neither
 * party sees the other's answers until the session is scored. There are no follower-visibility
 * selects or tagging switches, because those describe a public feed the two-party product does
 * not have.
 */
export function PrivacySettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy</CardTitle>
        <CardDescription>The one rule that protects both of you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4 rounded-lg border bg-muted/40 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-action" aria-hidden="true" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">
              Neither party sees the other&apos;s answers until the session is scored.
            </p>
            <p className="text-sm text-muted-foreground">
              While you answer, your side stays hidden from the other person — and theirs from you.
              Only once you have both submitted and both accepted does the report unlock, and only
              then do the two sets of answers become visible to each of you.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
