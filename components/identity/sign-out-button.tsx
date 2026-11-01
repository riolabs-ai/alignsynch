"use client";

// template-ancestor: components/ui/button.tsx   (variation: a ghost button that posts to the sign-out route and re-renders)

import { Button } from "@/components/ui/button";
import { endSession } from "@/lib/auth/sign-out";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Sign out — the one action that must actually end a session (issue #164).
 *
 * It calls the Managed Auth client's `signOut`, which reaches `/api/auth/sign-out` through the
 * same-origin proxy, so the session row is revoked **server-side** and the response clears the
 * cookie. A client-side "forget who we are" would leave the cookie valid and the next request
 * would be signed in again — which is the failure this button exists to avoid.
 *
 * Only after the SDK reports success does the router move: on an error the button comes back and
 * says so. `router.refresh()` is part of the same step because a protected page is cached as a
 * server payload; without it, going "back" can repaint the signed-in page from the router cache.
 *
 * Words arrive as props (`data/pages/settings.ts`, `data/pages/dashboard.ts`): a copy literal in
 * a `.tsx` is what E23 counts, and this file is inside the `/settings` and `/dashboard/user`
 * surfaces.
 */
export function SignOutButton({
  label,
  pendingLabel,
  errorLabel,
  className,
}: {
  label: string;
  pendingLabel: string;
  errorLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    setPending(true);
    setFailed(false);
    if (!(await endSession())) {
      setPending(false);
      setFailed(true);
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={signOut}
        disabled={pending}
        className={className}
      >
        <LogOut className="mr-2 h-4 w-4" />
        {pending ? pendingLabel : label}
      </Button>
      {failed && <p className="text-sm text-red-600">{errorLabel}</p>}
    </div>
  );
}
