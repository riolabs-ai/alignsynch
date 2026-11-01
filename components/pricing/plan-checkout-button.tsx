"use client";

// template-ancestor: components/ui/button.tsx   (variation: a submit button with a pending state, one per plan)

import { Button } from "@/components/ui/button";
import { type BillingInterval } from "@/data/billing-plans";
import { useCallback, useState } from "react";

/**
 * One plan card's button: it asks the server for a checkout and goes where the answer says.
 *
 * Three states, and the third one is the reason this is a component rather than a `Link`:
 *
 *   idle     the fixture's own label ("Choose Pro")
 *   pending  the same button, disabled, saying that something is happening
 *   error    the button says so and stays clickable — a failed checkout is not a dead end
 *
 * **It knows no provider and no price.** It POSTs `{ planId, interval }` and navigates to
 * `url`; whether that is the mock's `/pricing` (a subscription already written, the page reloads
 * and reads the entitlement) or a hosted checkout page is the server's answer, which is what
 * "both brands use the same port" means here. The account is the session cookie's — this
 * component never names a user.
 *
 * A 401 carries `signInUrl`, and the browser goes there: buying needs an account, and a button
 * that quietly does nothing for a signed-out visitor is the dead end the card forbids. The
 * server's sentence for any other refusal rides along as the button's `title`, so the tooltip
 * explains a plan that is no longer for sale without putting a provider's error text on the card.
 */
export interface PlanCheckoutButtonProps {
  readonly planId: string;
  readonly interval: BillingInterval;
  /** The fixture's CTA label for the tier. */
  readonly label: string;
  /** The label while the request is in flight. */
  readonly busyLabel: string;
  /** The label after a refusal. */
  readonly errorLabel: string;
  readonly className?: string;
  readonly variant?: "default" | "outline";
}

type ButtonState = "idle" | "pending" | "error";

/** What the route answers — read defensively, because a 502 from a proxy is not JSON. */
interface CheckoutAnswer {
  readonly url?: unknown;
  readonly signInUrl?: unknown;
  readonly message?: unknown;
}

export function PlanCheckoutButton({
  planId,
  interval,
  label,
  busyLabel,
  errorLabel,
  className,
  variant = "default",
}: PlanCheckoutButtonProps) {
  const [state, setState] = useState<ButtonState>("idle");
  const [detail, setDetail] = useState<string | null>(null);

  const choose = useCallback(async () => {
    setState("pending");
    setDetail(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, interval }),
      });
      const answer = (await response.json().catch(() => null)) as CheckoutAnswer | null;

      if (response.status === 401 && typeof answer?.signInUrl === "string") {
        window.location.assign(answer.signInUrl);
        return;
      }
      if (typeof answer?.message === "string") setDetail(answer.message);
      if (!response.ok || typeof answer?.url !== "string") {
        setState("error");
        return;
      }
      // A hosted checkout leaves the site; the mock answers with this page, which reloads and
      // reads the entitlement it just wrote.
      window.location.assign(answer.url);
    } catch {
      setState("error");
    }
  }, [planId, interval]);

  return (
    <Button
      type="button"
      onClick={choose}
      disabled={state === "pending"}
      aria-busy={state === "pending"}
      title={state === "error" && detail !== null ? detail : undefined}
      className={className}
      variant={variant}
    >
      {state === "pending" ? busyLabel : state === "error" ? errorLabel : label}
    </Button>
  );
}
