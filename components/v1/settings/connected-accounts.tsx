"use client";
// template-ancestor: components/settings/connected-accounts.tsx   (variation: three provider rows that name the persona's own email — the fixture account, not a stranger — with connect and disconnect mocked)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "google", label: "Google", glyph: "G" },
  { id: "facebook", label: "Facebook", glyph: "f" },
  { id: "twitter", label: "X", glyph: "𝕏" },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

/**
 * The connected accounts section — three providers, each either connected to the persona's own
 * fixture email or not. The email is a required prop from the settings shell, so no row can name a
 * stranger; the connect/disconnect buttons mutate local state only, like the rest of the
 * prototype.
 */
export function ConnectedAccounts({
  email,
  handle,
  name,
}: {
  email: string;
  handle: string;
  name: string;
}) {
  const [connected, setConnected] = useState<Record<ProviderId, boolean>>({
    google: true,
    facebook: false,
    twitter: false,
  });
  const [busy, setBusy] = useState<ProviderId | null>(null);

  const toggle = (provider: ProviderId) => {
    setBusy(provider);
    const willConnect = !connected[provider];
    setTimeout(() => {
      setConnected((previous) => ({ ...previous, [provider]: !previous[provider] }));
      setBusy(null);
      toast.success(willConnect ? "Account connected." : "Account disconnected.");
    }, 600);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected accounts</CardTitle>
        <CardDescription>Sign in and share with the accounts you use.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PROVIDERS.map((provider) => {
          const isConnected = connected[provider.id];
          return (
            <div key={provider.id}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {provider.glyph}
                  </span>
                  <div>
                    <p className="font-medium">{provider.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {isConnected
                        ? provider.id === "twitter"
                          ? `Connected as @${handle}`
                          : `Connected as ${provider.id === "google" ? email : name}`
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggle(provider.id)}
                  disabled={busy !== null}
                >
                  {busy === provider.id && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  )}
                  {isConnected ? "Disconnect" : "Connect"}
                </Button>
              </div>
              <Separator className="mt-3" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
