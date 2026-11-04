/**
 * Which deployment this process is — the claim a checkout stamps and the webhook filters on.
 *
 * Both hosts now run the provider's **test** keys, so they share one sandbox: the provider delivers
 * every test event to *both* deployments' billing webhook endpoints. Without a host claim on the
 * session, a purchase made on the demo would attempt a grant on the production database and a
 * production purchase on the demo's — one event stream, two databases, and no way to tell whose
 * event it is.
 *
 * So a session carries `metadata.host`, and the receiver acts only on an event that claims its own
 * value. `BILLING_HOST` is the deployment's answer, read here, once, and **with no default**: a
 * default is the failure it looks like a fix for, because every deployment would claim the same
 * host and the other one's deliveries would be silently accepted.
 *
 * The two values are deployment identities, not brand names — `alignsynch` is the production host
 * and `demo` the demonstration one. A third deployment adds a name here and its own `BILLING_HOST`,
 * the same way `BILLING_PROVIDER` carries its names: a value this build does not know is an
 * operator's typo, refused with a sentence, never coerced into something that matches everything.
 *
 * Nothing in this file names a payment provider: the claim is ours, and it is the adapter that
 * writes it into a session and reads it back out of an event.
 */
import { BillingRefusal } from "./port";

/** The hosts this build can be. */
export const BILLING_HOSTS = ["alignsynch", "demo"] as const;

export type BillingHost = (typeof BILLING_HOSTS)[number];

/** The variable a deployment answers with. Named here so a refusal and a doc cannot drift. */
export const BILLING_HOST_VARIABLE = "BILLING_HOST";

/**
 * This deployment's host, or a `not-configured` refusal naming the variable.
 *
 * Deliberately a refusal rather than a fallback. The route turns `not-configured` into a 503 that
 * says what to set, which is the honest answer to "this deployment cannot say which host it is":
 * the alternative — defaulting — is a deployment that quietly believes it is the other host and
 * accepts its events.
 *
 * The value is case-folded so `AlignSynch` in a config file is not an outage, and the *stamped*
 * value is always canonical because it comes from here.
 */
export function billingHostFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): BillingHost {
  const raw = env[BILLING_HOST_VARIABLE]?.trim().toLowerCase() ?? "";
  if (raw === "") {
    throw new BillingRefusal(
      "not-configured",
      `${BILLING_HOST_VARIABLE} is not set — this deployment cannot say which host a checkout ` +
        "belongs to, and a default would let it claim the other host's events",
    );
  }
  if (!(BILLING_HOSTS as readonly string[]).includes(raw)) {
    throw new BillingRefusal(
      "not-configured",
      `${BILLING_HOST_VARIABLE}="${raw}" is not a host this build knows ` +
        `(${BILLING_HOSTS.join(", ")}) — a misspelt host would refuse its own deliveries`,
    );
  }
  return raw as BillingHost;
}

/**
 * The host an event's subject claims: its `metadata.host`, trimmed, or `""` when it carries none.
 *
 * Both shapes a delivery can have as its subject — a checkout session and a subscription — carry
 * metadata, which is why the checkout stamps the claim on both. A value that is not a string is no
 * claim at all: metadata from outside this adapter is never trusted into a comparison as-is.
 */
export function hostClaimOf(
  metadata: Readonly<Record<string, unknown>> | null | undefined,
): string {
  const claim = metadata?.host;
  return typeof claim === "string" ? claim.trim() : "";
}

/**
 * Why an event is not this deployment's, or `null` when it is.
 *
 * The sentence carries the two host values and nothing else: the claim is a deployment name, not
 * data, so it is safe in a log line where the event body is not.
 */
export function foreignHostDetail(host: BillingHost, claim: string): string | null {
  if (claim === host) return null;
  if (claim === "") {
    return `the event carries no metadata.host and this deployment is "${host}"`;
  }
  return `the event claims host "${claim}" and this deployment is "${host}"`;
}
