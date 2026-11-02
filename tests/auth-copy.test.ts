/**
 * The two auth surfaces speak the brand the build selected (issue #225).
 *
 * The failure this pins is the one a stranger reads first: `/login` and `/register` rendered
 * "Welcome to QuizHub", "Challenge your mind with thousands of engaging quizzes…" and a
 * **"10K+ Active Players"** tile on the `BRAND=alignsynch` build — and the last of those is
 * fabricated social proof on the first screen of the demo, where the product has three demo
 * accounts and no player population to count.
 *
 * Four claims, each a pair:
 *
 *   1. the quiz build's copy is the copy that shipped (the deploy-safety half);
 *   2. the alignment build's *page* carries no quiz vocabulary, no product name from the other
 *      brand and no count — its two tiles are sentences, not a smaller number;
 *   3. the parts that belong to the *card*, not the skin (the fourteen field labels, the error
 *      states, the form's two steps and its fields) are byte-identical on both brands, so
 *      "this demo is AlignSynch now" moved the words it was supposed to move and nothing else;
 *   4. the form asks no quiz question on either brand (issue #291): the quiz-interests and
 *      quiz-skill step that both builds used to render is gone, and so is the newsletter
 *      opt-in for a newsletter that has never existed. This file used to *pin* those strings
 *      as a measured gap; the card that closed the gap inverted the assertion instead of
 *      deleting it, so a later fixture edit cannot quietly bring them back.
 *
 * The records are named explicitly rather than read from the ambient `brand`: CI builds and
 * tests under `BRAND=alignsynch` as well as `BRAND=quizhub`, and a "QuizHub" half that quietly
 * read the ambient record would assert the opposite of its own name in that lane.
 */
import { describe, expect, it } from "vitest";

import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { loginCopy } from "@/data/pages/login";
import { registerCopy } from "@/data/pages/register";
import { loginCopyFor, registerCopyFor } from "@/lib/auth-copy";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** Every string a projection carries, in the order it declares them. */
function render(value: unknown): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const entry of node) walk(entry);
      return;
    }
    if (node && typeof node === "object") {
      for (const entry of Object.values(node)) walk(entry);
    }
  };
  walk(value);
  return out.join("\n");
}

const quizHub = quizHubBrand as Brand;
const alignSynch = alignSynchBrand as Brand;

const quizHubLogin = render(loginCopyFor(loginCopy(quizHub), "quizhub"));
const alignSynchLogin = render(loginCopyFor(loginCopy(alignSynch), "alignsynch"));

const quizHubRegister = render(registerCopyFor(registerCopy(quizHub), "quizhub"));

describe("the quiz build keeps the copy that shipped", () => {
  it("still names itself, and still promises the quiz product", () => {
    expect(quizHubLogin).toContain("Welcome to QuizHub");
    expect(quizHubLogin).toContain(
      "Challenge your mind with thousands of engaging quizzes across multiple categories",
    );
    expect(quizHubLogin).toContain("Sign in to continue your quiz journey");
    expect(quizHubLogin).toContain("Active Players");
    expect(quizHubLogin).toContain("Quiz Categories");
  });

  it("keeps the count tile's placeholder for the view to fill from the metric fixture", () => {
    const stats = sectionOf(loginCopyFor(loginCopy(quizHub), "quizhub"), "stats");
    expect(itemLabel(stats, "players")).toBe("Active Players");
    expect(stats.items?.find((item) => item.id === "players")?.value).toBe("{count}+");
  });

  it("still opens with the quiz hero on /register", () => {
    expect(quizHubRegister).toContain("Join the Quiz Revolution");
    expect(quizHubRegister).toContain("Create your account and start your quiz adventure");
  });
});

describe("the alignment build speaks its own product", () => {
  it("has no quiz vocabulary and no QuizHub on /login", () => {
    expect(alignSynchLogin).not.toMatch(/quiz/i);
    expect(alignSynchLogin).not.toContain("QuizHub");
  });

  it("opens /register with the alignment's own hero", () => {
    const copy = registerCopyFor(registerCopy(alignSynch), "alignsynch");
    const brandOwned = render({
      heading: copy.heading,
      subtitle: copy.subtitle,
      mobile: sectionOf(copy, "mobile"),
    });
    expect(brandOwned).not.toMatch(/quiz/i);
    expect(brandOwned).not.toContain("QuizHub");
    expect(copy.heading).toContain("same questions");
  });

  /**
   * The quiz step is gone on both brands (issue #291).
   *
   * This file used to *pin* the gap — its first step was a quiz-topic checklist, its second
   * asked for a quiz skill level, and the last offered a newsletter that has never existed.
   * The card that owned replacing it removed the step outright, so the assertion inverts: no
   * brand's form asks a quiz question, and the newsletter opt-in is gone with it. The phone
   * number and date of birth are still asked and still unread — a separate defect, pinned by
   * nothing here.
   */
  it("asks no quiz question on either brand", () => {
    const forms = (["quizhub", "alignsynch"] as const).map((id) =>
      render(
        ["steps", "details", "account"].map((sectionId) =>
          sectionOf(
            registerCopyFor(registerCopy(id === "quizhub" ? quizHub : alignSynch), id),
            sectionId,
          ),
        ),
      ),
    );

    for (const form of forms) {
      expect(form).not.toMatch(/quiz skill|quiz interest|newsletter/i);
    }
    expect(forms[0]).toBe(forms[1]);
  });

  it("carries no fabricated social proof: no player count, no magnitude, no rating", () => {
    expect(alignSynchLogin).not.toContain("Active Players");
    expect(alignSynchLogin).not.toMatch(/\b\d+(\.\d+)?\s*[kKmM]\+?/);
    expect(alignSynchLogin).not.toMatch(/\b\d+\s*%/);
    // The `{count}` placeholder is the view's hook for a number: a brand that has none must
    // not leave the hook behind, or the view fills a count the fixture never claimed.
    expect(alignSynchLogin).not.toContain("{count}");
  });

  it("says what the product does: the same questions, and the Gap between the answers", () => {
    const register = registerCopyFor(registerCopy(alignSynch), "alignsynch");
    const registerHero = `${register.heading} ${register.subtitle ?? ""}`;
    expect(alignSynchLogin).toContain("Where your answers part is the Gap");
    expect(alignSynchLogin).toContain("The Gap");
    expect(registerHero).toContain("the distance between your answers is the Gap");
    expect(registerHero).toContain("invite the person you want to align with");
  });

  it("keeps the count tile's slot as a statement, not a smaller number", () => {
    const stats = sectionOf(loginCopyFor(loginCopy(alignSynch), "alignsynch"), "stats");
    expect(stats.items).toHaveLength(2);
    for (const item of stats.items ?? []) {
      expect(item.value).toBeDefined();
      expect(item.value).not.toMatch(/\d/);
      expect(item.value).not.toBe("—");
    }
  });

  it("resolves the same section ids the view asks for", () => {
    // The view asks for `sign-in` and `stats` on both brands; the projection is what makes
    // that one component, so the ids are the contract rather than an implementation detail.
    //
    // 17 since #password-reset: the credential refusals were 16 and the forgotten-password link is
    // the seventeenth. The count is a tripwire, not the rule — the ids themselves are resolved by
    // `sectionOf`/`itemLabel` in the view, and E23 fails when one is missing.
    const copy = loginCopyFor(loginCopy(alignSynch), "alignsynch");
    expect(sectionOf(copy, "sign-in").items).toHaveLength(17);
    expect(sectionOf(copy, "stats").items).toHaveLength(2);
  });
});

describe("the Google button's copy (issue #281)", () => {
  /**
   * The section has to survive `loginCopyFor`, which *rebuilds* the section list: a section it
   * does not name is dropped, and `LoginView` then throws `PageCopy: no section "google"` at
   * request time while `next build` stays green (it never renders `/login`). Same trap #269 and
   * #270 each hit once, and this file already pins it for `legal`.
   */
  it("survives the /login projection on both brands", () => {
    const quizGoogle = sectionOf(loginCopyFor(loginCopy(quizHub), "quizhub"), "google");
    const alignGoogle = sectionOf(loginCopyFor(loginCopy(alignSynch), "alignsynch"), "google");

    // The button is the card's, not a skin's: one shared pair of strings, like the form.
    expect(quizGoogle).toEqual(alignGoogle);
    expect(itemLabel(alignGoogle, "label")).toBe("Continue with Google");
    expect(itemLabel(alignGoogle, "divider")).toBe("or");
    expect(itemLabel(alignGoogle, "pending").length).toBeGreaterThan(0);
  });

  /**
   * The password form's rejections name one cause each (issue #281).
   *
   * Better Auth answers `INVALID_EMAIL_OR_PASSWORD` for an account that has no credential row
   * exactly as it does for a wrong password — there is no code to branch on — so the first
   * version of this card said both things in one sentence. The second half of the card asks the
   * account rows instead (`lib/auth/provider-link.ts`), which makes the causes separable: the
   * ordinary sentence claims only that the pair did not match, and the Google sentence is
   * rendered on evidence. `tests/provider-link.test.ts` owns that rule; this pins that both
   * ids survive the brand projection, because `/login`'s copy is what the view resolves.
   */
  it("carries the ordinary rejection and the Google-only one, as two items", () => {
    for (const [id, record] of [
      ["quizhub", quizHub],
      ["alignsynch", alignSynch],
    ] as const) {
      const card = sectionOf(loginCopyFor(loginCopy(record), id), "sign-in");
      expect(itemLabel(card, "error-invalid-credentials")).not.toMatch(/google/i);
      expect(itemLabel(card, "error-google-account")).toContain("Continue with Google");
    }
  });
});

describe("the card and the wizard are shared, not skinned", () => {
  it("renders the sign-in card's fields and errors identically on both brands", () => {
    const card = (id: "quizhub" | "alignsynch", record: Brand) =>
      sectionOf(loginCopyFor(loginCopy(record), id), "sign-in").items?.map(
        (item) => `${item.id}=${item.label}`,
      );

    expect(card("alignsynch", alignSynch)).toEqual(card("quizhub", quizHub));
  });

  it("leaves the form's steps, details and account fields exactly as they were", () => {
    const form = (copy: ReturnType<typeof registerCopy>) =>
      ["steps", "details", "account", "navigation", "status"].map((id) =>
        render(sectionOf(copy, id)),
      );

    expect(form(registerCopyFor(registerCopy(alignSynch), "alignsynch"))).toEqual(
      form(registerCopyFor(registerCopy(quizHub), "quizhub")),
    );
  });
});
