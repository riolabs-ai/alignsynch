/**
 * The brand boundary's gate, as a pure decision (#300), and the console's capability beside it (#509).
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
 * The second half asks the same three questions of `product.admin` (#509), where the answer is the
 * opposite shape today: both templates this tree ships claim the console, and the brand that does
 * not is the fixture template — a template id the record deliberately does not carry. What that
 * proves is that the capability can be *off*, which is the whole reason it exists before the
 * console's screens do.
 *
 * What this file cannot prove is that each *page* calls the helper; that is the parity suite's
 * boundary blocks, which walk both route lists on both brands.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { FIXTURE_TEMPLATE_WITHOUT_ADMIN } from "./fixtures/fixture-brand";
import { flagDefinition } from "@/data/flags";
import {
  ADMIN_PRODUCT_FLAG,
  adminProductShipped,
  QUIZ_PRODUCT_FLAG,
  quizProductShipped,
  requireAdminProduct,
  requireQuizProduct,
} from "@/lib/brand-boundary";

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

/**
 * The console's capability (#509) — the same three questions, and a different answer shape today.
 *
 * `product.admin` is `default: false` with `templates: ["quizhub", "alignsynch"]`: every template
 * this tree can build claims the console, and a template the record does not name does not. So the
 * interesting case is the *closed* one, and it is a fixture rather than a shipped product — the card
 * was explicit that no existing brand may be flipped to `false` to prove the switch.
 */
describe("the admin capability", () => {
  it("names a flag the record carries, claimed by both templates this tree ships", () => {
    expect(() => flagDefinition(ADMIN_PRODUCT_FLAG)).not.toThrow();
    expect(flagDefinition(ADMIN_PRODUCT_FLAG).templates).toEqual(["quizhub", "alignsynch"]);
    // `default: false` is not a downgrade: a template that never opts in must not inherit an
    // operator console, which is the "derived product turns it off" half of the card.
    expect(flagDefinition(ADMIN_PRODUCT_FLAG).default).toBe(false);
    expect(flagDefinition(ADMIN_PRODUCT_FLAG).templates).not.toContain(
      FIXTURE_TEMPLATE_WITHOUT_ADMIN,
    );
  });

  it("ships the console on both shipped templates: the gate returns and nothing throws", () => {
    for (const template of ["quizhub", "alignsynch"]) {
      vi.stubEnv("BRAND", template);

      expect(adminProductShipped(), `${template} must ship the console today`).toBe(true);
      expect(digestOf(() => requireAdminProduct())).toBeUndefined();
    }
  });

  it("closes it on the fixture brand with Next's own not-found digest", () => {
    vi.stubEnv("BRAND", FIXTURE_TEMPLATE_WITHOUT_ADMIN);

    expect(adminProductShipped()).toBe(false);
    // The same digest the quiz gate throws: a template without the console is indistinguishable
    // from a URL that never existed, which is what keeps the refusal from confirming a surface.
    expect(digestOf(() => requireAdminProduct())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("lets the operator close it on a template that ships it", () => {
    vi.stubEnv("BRAND", "alignsynch");
    vi.stubEnv("FLAG_PRODUCT_ADMIN", "0");

    expect(adminProductShipped()).toBe(false);
    expect(digestOf(() => requireAdminProduct())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("lets the operator open it on the fixture brand — gated, never deleted", () => {
    vi.stubEnv("BRAND", FIXTURE_TEMPLATE_WITHOUT_ADMIN);
    vi.stubEnv("FLAG_PRODUCT_ADMIN", "1");

    expect(adminProductShipped()).toBe(true);
    expect(digestOf(() => requireAdminProduct())).toBeUndefined();
  });
});
