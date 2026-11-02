"use server";

/**
 * The server action `/forgot-password` posts to.
 *
 * A server action is a public endpoint: the argument is whatever a client posted, so it is checked
 * here (`typeof`) rather than trusted from the form's `type="email"` input, and the *shape* of the
 * address is the flow's own business (`lib/auth/reset-request.ts`).
 *
 * The client address comes from the request headers the platform supplies, and it is only ever
 * handed to the limiter — as a peppered hash, never stored as an address. A request with no
 * forwarding header (a local dev server, a direct connection) buckets under `unknown`, which means
 * that deployment's local traffic shares one counter. That is the honest behaviour: inventing an
 * identifier would be a worse key than admitting there is none.
 */
import { headers } from "next/headers";
import { requestPasswordReset } from "@/lib/auth/reset-request";
import type { ResetRequestOutcome } from "@/lib/auth/reset-token";

/** The first hop's address, or `unknown`. `x-forwarded-for` is a list when proxies are chained. */
function clientAddressOf(headersList: Headers): string {
  const forwarded = headersList.get("x-forwarded-for");
  if (forwarded !== null) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first !== "") return first;
  }
  const realIp = headersList.get("x-real-ip")?.trim() ?? "";
  return realIp === "" ? "unknown" : realIp;
}

export async function requestReset(email: string): Promise<ResetRequestOutcome> {
  const address = typeof email === "string" ? email : "";
  const headersList = await headers();
  return requestPasswordReset({ email: address, requester: clientAddressOf(headersList) });
}
