/**
 * The brand boundary's gate, as a pure decision (#300).
 *
 * Three claims, in the order the helper makes them:
 *
 *   1. **the template decides** — the quiz product ships on `quizhub` and not on `alignsynch`,
 *      through the flag store's `templates` field rather than a second brand check;
 *   2. **a closed gate is a 404** — `requireQuizProduct()` throws Next's not-found digest, which is
 *      the same answer an unknown URL gets, so a visitor cannot tell a surface this product does
 *      not sell from one that never existed;
 *   3. **the operator can look** — `FLAG_PRODUCT_QUIZ_SURFACES=1` opens every gate on an alignment
 *      build, because the surfaces are gated and not deleted.
 *
 * What this file cannot prove is that each *page* calls the helper; that is the parity suite's
 * boundary block, which walks the route list on both brands.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { flagDefinition } from "@/data/flags";
import { QUIZ_PRODUCT_FLAG, quizProductShipped, requireQuizProduct } from "@/lib/brand-boundary";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The digest a throw carries, or `undefined` when nothing was thrown. */
function digestOf(run: () => void): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
}

describe("the brand boundary", () => {
  it("names a flag the record actually carries", () => {
    expect(() => flagDefinition(QUIZ_PRODUCT_FLAG)).not.toThrow();
    expect(flagDefinition(QUIZ_PRODUCT_FLAG).templates).toEqual(["quizhub"]);
    expect(flagDefinition(QUIZ_PRODUCT_FLAG).default).toBe(false);
  });

  it("ships the quiz product on the quiz template: the gate returns and nothing throws", () => {
    vi.stubEnv("BRAND", "quizhub");

    expect(quizProductShipped()).toBe(true);
    expect(digestOf(() => requireQuizProduct())).toBeUndefined();
  });

  it("closes it on the alignment template with Next's own not-found digest", () => {
    vi.stubEnv("BRAND", "alignsynch");

    expect(quizProductShipped()).toBe(false);
    // The digest, not the message: it is what `app/not-found.tsx` and the parity harness both key
    // on, and it is the value that makes the refusal indistinguishable from an unknown URL.
    expect(digestOf(() => requireQuizProduct())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("lets the operator open every gate on an alignment build", () => {
    vi.stubEnv("BRAND", "alignsynch");
    vi.stubEnv("FLAG_PRODUCT_QUIZ_SURFACES", "1");

    expect(quizProductShipped()).toBe(true);
    expect(digestOf(() => requireQuizProduct())).toBeUndefined();
  });

  it("lets the operator close it on the quiz build too — the env wins over the template", () => {
    vi.stubEnv("BRAND", "quizhub");
    vi.stubEnv("FLAG_PRODUCT_QUIZ_SURFACES", "0");

    expect(quizProductShipped()).toBe(false);
    expect(digestOf(() => requireQuizProduct())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
