"use client";

// template-ancestor: components/assessment-flow/stage-shell.tsx   (variation: a dialog opened by a control on the page rather than by the route, so it is trigger-controlled, centred instead of full-height, and it carries a third-party frame in its body)

/**
 * The capture dialog — how the payer would pay, and the frame that takes the method (#748).
 *
 * **Why a dialog at all.** #739 gave the relationship screen two acts; the capture was a hosted
 * page, so pressing "Add a payment method" left the screen — a second tab, a different form, and a
 * return URL that had to find its way back. The approved artifact
 * (`prototype-relationship-lifecycle-v7.html`, `s8.*`) draws the other thing: the plan card, then
 * the provider's own card fields **in a frame inside this page**, with the sentence that says why
 * that is safe ("you never leave it and no card detail touches our code"). This component is that
 * drawing, and the words are the fixture's (`data/pages/dashboard-relationship-detail.ts`,
 * section `capture`), never this file's — E23.
 *
 * **Three answers, and all three are real.** `onCapture` asks the server to start a capture with
 * `presentation: "embedded"`:
 *
 *   embedded  `clientSecret` + `captureSessionId` — the frame is mounted here, and when the provider
 *             reports completion the same session id goes back through `onResolve`, which records
 *             the method. No navigation, which is the whole point of the card.
 *   inline    `captured: true` and no secret (the mock, and any offline adapter): nothing to mount,
 *             so the dialog reports the outcome to `onCaptured` and closes. That is what keeps
 *             `pnpm payment:e2e` and the keyless demo one click.
 *   hosted    a `url` — the adapter answered a page. The dialog does **not** hide that: it reports
 *             the outcome, and the band on the screen draws the link it already drew before #748.
 *
 * **The submit is the frame's, not ours.** Embedded Checkout renders its own pay control inside the
 * iframe; the artifact's "Save the payment method" is the prototype's stand-in for it, so this
 * dialog draws the frame and a cancel, never a second save control that would submit nothing. The
 * key travels to this component (it is a publishable key — it is public by design), and the client
 * secret is a per-session token that is mounted and then forgotten: nothing here writes either.
 *
 * **`loadStripe()` is cached per key.** The loader injects a script tag; calling it per render would
 * inject one per render. The cache is module scope on purpose — it is a promise, not a record, and
 * a second key is a different promise rather than a second copy of the same one.
 */
import type { Stripe, StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogOverlay } from "@/components/ui/dialog";
import { formatCurrencyAmount } from "@/content/metrics";
import type { PageCopySection } from "@/content/pages";
import { billingPlan, planPriceCents } from "@/data/billing-plans";
import type { CaptureOutcome } from "@/lib/member/outcomes";
import { itemLabel } from "@/lib/page-copy";

/**
 * The two tiers the artifact draws as "One relationship" / "Unlimited relationships", paired with
 * the fixture's plan ids.
 *
 * The **labels** are the artifact's words, which is why they are item ids rather than strings; the
 * **prices** are the fixture's (`billing-plans.ts`), which is why nothing here types a figure. The
 * prototype prints `$9.95` / `$19.85`; this product sells Basic at 895 and Principal at 1_695, and a
 * number a screen shows must be the number a checkout charges.
 */
const PLAN_ROWS = [
  { planId: "basic", nameItem: "plan-payg", noteItem: "plan-payg-note" },
  { planId: "principal", nameItem: "plan-unlimited", noteItem: "plan-unlimited-note" },
] as const;

/** One `loadStripe()` per key, ever. A second call would inject a second script tag. */
const stripeLoaders = new Map<string, Promise<Stripe | null>>();

function loaderFor(publishableKey: string): Promise<Stripe | null> {
  const cached = stripeLoaders.get(publishableKey);
  if (cached !== undefined) return cached;
  const created = loadStripe(publishableKey);
  stripeLoaders.set(publishableKey, created);
  return created;
}

/** Where the dialog is: showing the plans, or showing the frame that was started for it. */
type Stage = "plan" | "frame";

export function PaymentCaptureDialog({
  copy,
  refusalFallback,
  relationshipId,
  open,
  onOpenChange,
  onCapture,
  onResolve,
  onCaptured,
}: {
  /** The `capture` section of the relationship page's fixture. Every word on this surface. */
  copy: PageCopySection;
  /**
   * The sentence a start or a mount that failed draws when the server sent none. It comes from the
   * page's `refusals` section, so it is the same fixture every other failure on this screen reads —
   * never a string invented here.
   */
  refusalFallback: string;
  relationshipId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (payload: {
    relationshipId?: string;
    presentation?: string;
  }) => Promise<CaptureOutcome>;
  onResolve: (payload: {
    relationshipId?: string;
    captureSessionId?: string;
  }) => Promise<CaptureOutcome>;
  /** What the dialog did, for the band on the screen underneath: close it there. */
  onCaptured: (outcome: CaptureOutcome) => void;
}) {
  const [stage, setStage] = useState<Stage>("plan");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [captureSessionId, setCaptureSessionId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const frameRef = useRef<HTMLDivElement | null>(null);

  /** Back to the plans, and nothing half-started left behind. */
  const reset = useCallback(() => {
    setStage("plan");
    setClientSecret(null);
    setPublishableKey(null);
    setCaptureSessionId(null);
    setRefusal(null);
    setMounted(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [onOpenChange, reset]);

  // A dialog that is closed is a dialog with no session: reopening must not remount a secret the
  // provider has already consumed.
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  /**
   * Ask the server for an embedded session. One call, one answer, and every answer is drawn:
   * a sentence on failure, the frame on a secret, and the band (plus a close) on an inline capture.
   */
  async function startCapture(): Promise<void> {
    setRefusal(null);
    setStarting(true);
    try {
      const answer = await onCapture({ relationshipId, presentation: "embedded" });
      if (!answer.ok) {
        setRefusal(
          answer.message !== undefined && answer.message.trim() !== ""
            ? answer.message
            : refusalFallback,
        );
        return;
      }
      if (answer.clientSecret !== undefined && answer.clientSecret !== null) {
        setClientSecret(answer.clientSecret);
        setPublishableKey(answer.publishableKey ?? null);
        setCaptureSessionId(answer.captureSessionId ?? null);
        setStage("frame");
        return;
      }
      // Inline (the mock) or a hosted url: either way this dialog has nothing left to draw, and the
      // screen underneath is where the outcome belongs — it already knows how to print both.
      onCaptured(answer);
      close();
    } finally {
      setStarting(false);
    }
  }

  /**
   * The frame reported a save. The provider's session is the record, so the method is resolved by
   * its id — the same resolution the hosted return URL performs — and the screen is told.
   */
  const completeCapture = useCallback(
    async (sessionId: string) => {
      const answer = await onResolve({ relationshipId, captureSessionId: sessionId });
      onCaptured(answer);
      if (answer.ok) close();
      else setRefusal(answer.message ?? "");
    },
    [close, onCaptured, onResolve, relationshipId],
  );

  // The session id is read by the frame's own callback, which is created once per mount: a ref
  // keeps the callback current without re-creating (and re-destroying) the frame on every render.
  const sessionIdRef = useRef<string | null>(null);
  useEffect(() => {
    sessionIdRef.current = captureSessionId;
  }, [captureSessionId]);

  // Mount the provider's frame, and destroy it on the way out: an iframe left behind keeps a
  // listener on a dead component and can outlive the secret it was mounted with.
  useEffect(() => {
    const secret = clientSecret;
    const key = publishableKey;
    const element = frameRef.current;
    if (secret === null || key === null || element === null) return;

    let disposed = false;
    let instance: StripeEmbeddedCheckout | null = null;

    void (async () => {
      try {
        const stripe = await loaderFor(key);
        if (stripe === null) {
          if (!disposed) setRefusal(refusalFallback);
          return;
        }
        const checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret: secret,
          onComplete: () => {
            const sessionId = sessionIdRef.current;
            if (sessionId !== null) void completeCapture(sessionId);
          },
        });
        if (disposed) {
          checkout.destroy();
          return;
        }
        instance = checkout;
        checkout.mount(element);
        setMounted(true);
      } catch (error) {
        if (!disposed) {
          console.error(
            "payment capture: the provider's frame did not mount",
            error instanceof Error ? error.message : String(error),
          );
          setRefusal(refusalFallback);
        }
      }
    })();

    return () => {
      disposed = true;
      instance?.destroy();
      instance = null;
      setMounted(false);
    };
  }, [clientSecret, completeCapture, publishableKey, refusalFallback]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
    >
      <DialogOverlay />
      <DialogPrimitive.Content
        data-capture-dialog="true"
        data-capture-stage={stage}
        aria-describedby={undefined}
        className="fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100vh-32px)] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-auto rounded-lg border bg-background p-5 sm:p-6"
      >
        <DialogPrimitive.Title className="text-base font-semibold">
          {copy.heading}
        </DialogPrimitive.Title>
        <DialogPrimitive.Close
          aria-label={itemLabel(copy, "cancel")}
          className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </DialogPrimitive.Close>

        <p className="pr-10 text-sm text-muted-foreground">{copy.body}</p>

        <ul className="space-y-2" data-capture-plans="true">
          {PLAN_ROWS.map((row) => {
            const plan = billingPlan(row.planId);
            if (plan === undefined) return null;
            return (
              <li
                key={row.planId}
                data-capture-plan={row.planId}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 p-3"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{itemLabel(copy, row.nameItem)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {itemLabel(copy, row.noteItem)}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-1">
                  <span className="text-sm font-semibold">
                    {formatCurrencyAmount(planPriceCents(plan, "month"))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {itemLabel(copy, "price-per")}
                  </span>
                  {plan.popular ? (
                    <Badge variant="secondary" className="ml-1">
                      {itemLabel(copy, "best-value")}
                    </Badge>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted-foreground">{itemLabel(copy, "trial")}</p>

        {refusal === null ? null : (
          <p data-capture-refusal="true" className="text-sm text-red-600 dark:text-red-400">
            {refusal}
          </p>
        )}

        {stage === "plan" ? (
          <div className="space-y-2">
            <Button
              type="button"
              className="w-full"
              onClick={() => void startCapture()}
              disabled={starting}
              data-add-method="true"
            >
              {starting ? itemLabel(copy, "starting") : itemLabel(copy, "add-method")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full whitespace-normal py-2 text-center leading-snug"
              onClick={close}
              data-capture-skip="true"
            >
              {itemLabel(copy, "skip")}
            </Button>
          </div>
        ) : (
          <div
            className="space-y-3 rounded-lg border border-gray-200"
            data-capture-frame="embedded"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
              <span className="text-xs font-medium">{itemLabel(copy, "secure")}</span>
              <Badge variant="secondary">{itemLabel(copy, "test-mode")}</Badge>
            </div>
            <p className="px-3 text-xs text-muted-foreground">{itemLabel(copy, "frame-body")}</p>
            {/*
              The mount point. The provider's iframe replaces the caption when it lands, and the
              caption is the artifact's own placeholder — never a spinner, which would say the
              frame is loading forever when the real failure is a refused key.
            */}
            <div className="relative min-h-[292px] px-3">
              {mounted ? null : (
                <p
                  data-capture-frame-placeholder="true"
                  className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground"
                >
                  {itemLabel(copy, "frame")}
                </p>
              )}
              <div ref={frameRef} data-stripe-embedded-checkout="true" />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-3 py-2">
              <span className="text-xs text-muted-foreground">{itemLabel(copy, "frame-note")}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={close}
                data-closepay="true"
              >
                {itemLabel(copy, "cancel")}
              </Button>
            </div>
          </div>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Root>
  );
}
