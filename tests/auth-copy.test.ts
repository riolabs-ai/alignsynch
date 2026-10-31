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
 *      states, the wizard's three steps and its fields) are byte-identical on both brands, so
 *      "this demo is AlignSynch now" moved the words it was supposed to move and nothing else;
 *   4. the wizard is untouched in particular: it is a follow-up card's decision, not this one's,
 *      and the strings that remain on the alignment build are pinned by name so the gap is
 *      measured rather than assumed.
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
   * The measured gap, pinned so it cannot be mistaken for finished work.
   *
   * `/register`'s *wizard* is not copy a skin picks: its first step is a quiz-topic checklist, its
   * second asks for a quiz skill level, and the form asks for a date of birth and a phone number
   * that the alignment product has no use for. Replacing it is a product decision with its own
   * card — so this card brand-selected the page's words and left the fields alone, and the five
   * strings below are exactly what the alignment build still says. When that follow-up lands,
   * delete this case with the wizard.
   */
  it("still renders the quiz wizard on /register — a follow-up card owns replacing it", () => {
    const wizard = render(
      ["steps", "interests", "skill", "details", "account"].map((id) =>
        sectionOf(registerCopyFor(registerCopy(alignSynch), "alignsynch"), id),
      ),
    );
    expect(wizard).toContain("Quiz Interests");
    expect(wizard).toContain("What types of quizzes interest you? *");
    expect(wizard).toContain("What's your quiz skill level? *");
    expect(wizard).toContain("Expert - Quiz master level");
    expect(wizard).toContain("Subscribe to our newsletter for quiz updates and tips");
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
    const copy = loginCopyFor(loginCopy(alignSynch), "alignsynch");
    // Fourteen, not fifteen: issue #270 removed the `forgot` label together with the `href="#"`
    // anchor it labelled — this build has no password-reset flow, so the anchor promised a screen
    // that does not exist. The number is a pin: adding a field to the card is a deliberate edit
    // here as well as in the fixture.
    expect(sectionOf(copy, "sign-in").items).toHaveLength(14);
    expect(sectionOf(copy, "stats").items).toHaveLength(2);
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

  it("leaves the wizard's steps, interests, skill levels and details exactly as they were", () => {
    const wizard = (copy: ReturnType<typeof registerCopy>) =>
      ["steps", "interests", "skill", "details", "account", "navigation", "status"].map((id) =>
        render(sectionOf(copy, id)),
      );

    expect(wizard(registerCopyFor(registerCopy(alignSynch), "alignsynch"))).toEqual(
      wizard(registerCopyFor(registerCopy(quizHub), "quizhub")),
    );
  });
});
