/**
 * The tour's write half (#456) — one request, and the three answers that are not a crash.
 *
 * `app/api/tour/route.ts` is the guarded side: it resolves the session itself and takes the
 * `userId` from that session, never from the body. This module is the caller, so the two things
 * worth pinning are that it sends exactly the body the route's `strict()` schema accepts (a stray
 * key would be a 400, and a `userId` would be the cross-account write the route refuses), and that
 * a tour the reader just dismissed cannot fail in their face because the request did.
 *
 * `fetch` is the injected argument, so no server, no jsdom and no network are involved.
 */
import { describe, expect, it, vi } from "vitest";

import { sendTourMark, TOUR_MARK_PATH } from "@/lib/tour/mark";

/** A `fetch` that answered with a status, recording what it was called with. */
function responder(status: number) {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("sendTourMark", () => {
  it("POSTs the mark to the tour route as JSON, uncached", async () => {
    const { fetchImpl, calls } = responder(200);

    expect(await sendTourMark(true, fetchImpl)).toBe(true);

    expect(calls).toHaveLength(1);
    const [call] = calls;
    const init = call.init ?? {};
    expect(call.url).toBe(TOUR_MARK_PATH);
    expect(TOUR_MARK_PATH).toBe("/api/tour");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    // Exactly one key: the route is `strict()`, and a `userId` is the write it must never accept.
    expect(JSON.parse(String(init.body))).toEqual({ seen: true });
  });

  it("sends seen:false for the replay path, with no other field", async () => {
    const { fetchImpl, calls } = responder(200);

    expect(await sendTourMark(false, fetchImpl)).toBe(true);

    expect(JSON.parse(String(calls[0].init?.body ?? ""))).toEqual({ seen: false });
  });

  it("reports a refusal as 'not marked' rather than throwing", async () => {
    const { fetchImpl } = responder(503);

    expect(await sendTourMark(true, fetchImpl)).toBe(false);
  });

  it("swallows a network failure — a dismissed tour is not a failed request", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;

    await expect(sendTourMark(true, fetchImpl)).resolves.toBe(false);
  });
});
