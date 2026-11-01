// template-ancestor: components/auth/login-view.tsx (variation: the CTA is a persona switch, not a form submit)
"use client";

import { useV1Store } from "@/lib/v1/store";
import { useRouter } from "next/navigation";

/**
 * The one primary action on every public template surface: "Start this relationship".
 *
 * There is no auth, so "starting" is two honest moves in the prototype's own terms — become the
 * Initiator (the persona bar is the session), and land in the Initiator's create flow, where a
 * relationship is copied from a template and the counterparty is invited by link. The
 * relationship-type taxonomy is not yet wired into that flow, so the button hands the visitor to
 * the existing create surface rather than a dead end; that wiring is the follow-up card.
 */
export function StartRelationshipButton({ label = "Start this relationship" }: { label?: string }) {
  const { setPersona } = useV1Store();
  const router = useRouter();

  const start = () => {
    setPersona("initiator");
    router.push("/v1/initiator/templates");
  };

  return (
    <button
      type="button"
      onClick={start}
      className="inline-flex h-12 items-center justify-center rounded-md bg-action px-6 text-sm font-medium text-action-foreground hover:bg-action/90"
    >
      {label}
    </button>
  );
}
