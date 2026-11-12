"use client";

// template-ancestor: components/assessment-flow/stage-shell.tsx   (variation: the dialog body reduced to one panel — the provider's mount point and the caption that stands in until the iframe lands, with no heading, no plan list and no submit of its own. The dialog that used to sit between the two is deleted by #912, so this is the lineage that survives: stage-shell → capture dialog → this)

/**
 * `StripeFrame` — **the one place this app mounts a card** (#748's frame, lifted by #911).
 *
 * **Why this is its own module, and why it is now the only one.** #911 lifted the frame out of the
 * dashboard's capture dialog because two surfaces took a card — the dialog and stage 5's walk — and
 * *do not create a second card-capture UI* means one implementation of the frame, not two copies of
 * `loadStripe()` that drift. #912 then retired the dialog: the modal is the only way to pay, so
 * stage 5's walk (`components/assessment-flow/invite-walk.tsx`) is the only caller, and
 * `tests/one-payment-surface.test.ts` asserts that as an exact set. A third caller is a red build,
 * not a design choice.
 *
 * **The submit is the frame's.** Embedded Checkout renders Stripe's own pay control inside the
 * iframe. This component draws the mount point, the caption the artifact draws while it lands, and
 * nothing that submits.
 *
 * **`loadStripe()` is cached per key, at module scope.** The loader injects a script tag; calling it
 * per render would inject one per render. The cache is a promise, not a record: a second key is a
 * different promise rather than a second copy of the same one.
 *
 * **The callbacks live in refs.** The frame is created once per client secret; recreating it because
 * a parent handed down a new closure would destroy and remount a live iframe — and an iframe left
 * behind keeps a listener on a dead component and can outlive the secret it was mounted with.
 *
 * Nothing here writes copy: the caption, the bar and the note are the caller's fixture rows (E23).
 */
import type { Stripe, StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useRef, useState } from "react";

/** One `loadStripe()` per key, ever. A second call would inject a second script tag. */
const stripeLoaders = new Map<string, Promise<Stripe | null>>();

function loaderFor(publishableKey: string): Promise<Stripe | null> {
  const cached = stripeLoaders.get(publishableKey);
  if (cached !== undefined) return cached;
  const created = loadStripe(publishableKey);
  stripeLoaders.set(publishableKey, created);
  return created;
}

export function StripeFrame({
  clientSecret,
  publishableKey,
  placeholder,
  onComplete,
  onError,
}: {
  /** The per-session token the server minted. Mounted once, then forgotten — never stored. */
  clientSecret: string | null;
  /** The publishable key: public by design, and the only thing the loader needs. */
  publishableKey: string | null;
  /** The caption drawn under the mount point until the provider's iframe replaces it. */
  placeholder: string;
  /**
   * The provider reported the card was saved. The session id is **not** passed here: the server
   * resolves the method from the session it minted, never from anything the browser claims.
   */
  onComplete: () => void;
  /** The loader refused, or the frame did not mount. The caller draws its own sentence. */
  onError: () => void;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  // The frame is created once per mount; the callbacks are read through refs so a new closure
  // cannot tear a live iframe down.
  const completeRef = useRef(onComplete);
  const errorRef = useRef(onError);
  useEffect(() => {
    completeRef.current = onComplete;
    errorRef.current = onError;
  }, [onComplete, onError]);

  useEffect(() => {
    const element = frameRef.current;
    if (clientSecret === null || publishableKey === null || element === null) return;

    let disposed = false;
    let instance: StripeEmbeddedCheckout | null = null;

    void (async () => {
      try {
        const stripe = await loaderFor(publishableKey);
        if (stripe === null) {
          if (!disposed) errorRef.current();
          return;
        }
        // **Before creating, not after.** A client secret admits exactly one Embedded Checkout
        // object, and Stripe refuses the second with "You cannot have multiple Embedded Checkout
        // objects". React runs an effect twice on mount in development (StrictMode), and the
        // cleanup for the first run has already fired by the time this `await` resolves — so
        // creating first and checking `disposed` afterwards is a second create for one secret, and
        // the frame never mounts. The check belongs here, where the stale run can still decline.
        if (disposed) return;
        const checkout = await stripe.createEmbeddedCheckoutPage({
          clientSecret,
          onComplete: () => completeRef.current(),
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
            "stripe frame: the provider's frame did not mount",
            error instanceof Error ? error.message : String(error),
          );
          errorRef.current();
        }
      }
    })();

    return () => {
      disposed = true;
      instance?.destroy();
      instance = null;
      setMounted(false);
    };
  }, [clientSecret, publishableKey]);

  return (
    <div className="relative min-h-[292px] px-3" data-stripe-mount="true">
      {/*
        The provider's iframe replaces the caption when it lands, and the caption is the artifact's
        own placeholder — never a spinner, which would say the frame is loading forever when the
        real failure is a refused key.
      */}
      {mounted ? null : (
        <p
          data-capture-frame-placeholder="true"
          className="absolute inset-x-3 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground"
        >
          {placeholder}
        </p>
      )}
      <div ref={frameRef} data-stripe-embedded-checkout="true" />
    </div>
  );
}
