/**
 * The prototype screens' gate (#console cohort 1) — who sees `/prototype`, and who gets a 404.
 *
 * Five cases, and they are the whole contract the later cohorts inherit:
 *
 *   admin                  sees it, through the flag's `adminBypass` — with no env set;
 *   member                 gets the 404, not a redirect and not a 403;
 *   signed out             gets the same 404 (the answer must not differ between the two callers);
 *   `FLAG_CONSOLE_PROTOTYPES=1` + a member
 *                          sees it — the operator's review lever;
 *   `FLAG_CONSOLE_PROTOTYPES=0` + an admin
 *                          still sees it — the bypass sits ahead of the env, so an operator who set
 *                          the variable to `0` for a demo does not lock the reviewer out.
 *
 * **No server.** The session is stubbed at `lib/auth/require-role.ts::currentRole`, which is the one
 * read `lib/auth/flag-gate.ts` makes, so `enabledForCaller` runs for real — the real resolver over the
 * real record — and `notFound()` is a spy that throws the way Next's control-flow signal does. No
 * Postgres, no request, no `NEON_AUTH_*`.
 *
 * The second describe is the record's own shape: the gate is only a review path while the flag
 * declares the bypass **and no `templates`**. A `templates: ["alignsynch"]` entry would resolve the
 * flag on for every visitor of that build, because the template step runs before the role — so the
 * absence of the field is asserted rather than described.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, currentRole } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  currentRole: vi.fn(async (): Promise<"admin" | "member" | null> => null),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/auth/require-role", () => ({ currentRole }));

import { flagDefinition } from "@/data/flags";
import { isEnabled, navSurfaces } from "@/lib/flags";
import {
  PROTOTYPE_FLAG,
  prototypeScreensEnabled,
  requirePrototypeScreens,
} from "@/lib/prototype-gate";

/** Who this request's session belongs to, as `currentRole()` would answer. */
function signedInAs(role: "admin" | "member" | null): void {
  currentRole.mockResolvedValue(role);
}

beforeEach(() => {
  notFound.mockClear();
  currentRole.mockReset();
  currentRole.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the gate", () => {
  it("lets an admin through with nothing set — the flag's adminBypass", async () => {
    signedInAs("admin");

    await expect(requirePrototypeScreens()).resolves.toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
    await expect(prototypeScreensEnabled()).resolves.toBe(true);
  });

  it("refuses a member with the 404 an unknown URL gets", async () => {
    signedInAs("member");

    await expect(requirePrototypeScreens()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
    await expect(prototypeScreensEnabled()).resolves.toBe(false);
  });

  it("refuses a signed-out visitor the same way, so the two are indistinguishable", async () => {
    signedInAs(null);

    await expect(requirePrototypeScreens()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("shows the screens to a member when FLAG_CONSOLE_PROTOTYPES=1 — the review lever", async () => {
    signedInAs("member");
    vi.stubEnv("FLAG_CONSOLE_PROTOTYPES", "1");

    await expect(requirePrototypeScreens()).resolves.toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
    // The env decides without a session read at all: `enabledForCaller` only asks the role when the
    // flag has not already resolved on (`lib/auth/flag-gate.ts`).
    expect(currentRole).not.toHaveBeenCalled();
  });

  it("keeps the bypass ahead of the env, so FLAG_CONSOLE_PROTOTYPES=0 cannot lock an admin out", async () => {
    signedInAs("admin");
    vi.stubEnv("FLAG_CONSOLE_PROTOTYPES", "0");

    await expect(requirePrototypeScreens()).resolves.toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("the flag the gate reads", () => {
  it("is declared by the name the gate imports", () => {
    expect(PROTOTYPE_FLAG).toBe("console.prototypes");
  });

  it("declares the bypass and no template list — the two halves of the mechanism", () => {
    const definition = flagDefinition(PROTOTYPE_FLAG);

    expect(definition.default).toBe(false);
    expect(definition.adminBypass).toBe(true);
    // The load-bearing assertion: a `templates` entry resolves *before* the role, so adding one
    // would hand every visitor of that build a prototype screen while the flag still read as gated.
    expect(definition.templates).toBeUndefined();
    // It is a real definition, not a placeholder: the note says what state the surface is in.
    expect(definition.note.length).toBeGreaterThan(20);
  });

  it("resolves off for a member and on for an admin on both brands", () => {
    for (const brand of ["alignsynch", "quizhub"]) {
      vi.stubEnv("BRAND", brand);

      expect(isEnabled(PROTOTYPE_FLAG)).toBe(false);
      expect(isEnabled(PROTOTYPE_FLAG, { role: "member" })).toBe(false);
      expect(isEnabled(PROTOTYPE_FLAG, { role: null })).toBe(false);
      expect(isEnabled(PROTOTYPE_FLAG, { role: "admin" })).toBe(true);
    }
  });

  it("is not advertised in the nav, on any brand", () => {
    // `hiddenNavHrefs()` takes no role on purpose (`lib/flags.ts`), so the bypass makes the surface
    // reachable and never advertised — which means no prototype route may appear in `navSurfaces`.
    expect(Object.keys(navSurfaces).filter((href) => href.startsWith("/prototype"))).toEqual([]);
  });
});
