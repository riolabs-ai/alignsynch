/**
 * The words a person reads before deleting their account (#278).
 *
 * `docs/ACCOUNT-DELETION-SPEC.md` §5 fixes one sentence and forbids a class of stronger ones, and
 * §6 fixes what is retained — including the one row that keeps an **address**: the marketing
 * opt-out list, which `lib/account/purge.ts` writes as `UPDATE news_signup … WHERE email = $1`.
 * Copy that says nothing personal is kept, beside code that keeps the address, is the exact
 * misstatement §5's "the sentence must name them" rule exists to prevent. So this file pins three
 * things against each other rather than trusting review:
 *
 *   the sentence   `/settings`' delete card carries §5 **verbatim** and nothing of §5's forbidden
 *                  list (a window, "we will process it", "all your data is erased"). Verbatim is
 *                  the point: the card and `/privacy` are two renderings of one claim, and a
 *                  paraphrase is how they drift apart.
 *   the retention  wherever either surface mentions the opt-out, it says the address is kept, and
 *                  the purge really keeps it (an `UPDATE` keyed on the address, never a `DELETE`).
 *   the outcomes   every `kind` the server action can answer has a label in the fixture. A missing
 *                  one is a runtime throw in `itemLabel`, on the one screen where an unexplained
 *                  failure is least acceptable.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { legalCopy } from "@/data/pages/legal";
import { settingsPageCopy } from "@/data/pages/settings";
import { itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const brand = quizHubBrand as Brand;

const SPEC = readFileSync(new URL("../docs/ACCOUNT-DELETION-SPEC.md", import.meta.url), "utf8");
const PURGE = readFileSync(new URL("../lib/account/purge.ts", import.meta.url), "utf8");
const ACTION = readFileSync(
  new URL("../app/(mainlayout)/settings/delete-account-actions.ts", import.meta.url),
  "utf8",
);

/** Whitespace and quote glyphs are a formatting choice; the claim is what is compared. */
function normalise(text: string): string {
  return text
    .replace(/[\u201c\u201d"]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * §5's sentence, read out of the spec's block quote rather than copied here: a copy edit to the
 * spec that this card does not follow is a failing test, not a paragraph nobody re-read.
 */
function specSentence(): string {
  const from = SPEC.indexOf("## 5. Timing");
  expect(from).toBeGreaterThan(-1);
  const body = SPEC.slice(from);
  const quoted = body
    .split("\n")
    .filter((line) => line.startsWith(">"))
    .map((line) => line.replace(/^>\s?/, ""))
    .join(" ");
  expect(quoted.length).toBeGreaterThan(200);
  return normalise(quoted);
}

const settingsDeletion = sectionOf(settingsPageCopy, "deletion");
const settingsBody = sectionBody(settingsDeletion);

describe("the delete-account card's copy (§5)", () => {
  it("carries the spec's sentence verbatim", () => {
    expect(normalise(settingsBody)).toBe(specSentence());
  });

  it("says nothing §5 forbids", () => {
    /**
     * The forbidden list is §5's own ("The app may **not** say any of the following"), plus the
     * "deactivated" state §5 rules out. A window reads as a grace period to a reader who has just
     * been told there is none, and "all your data is erased" is false of §2 and §6 — so each is a
     * failure wherever it appears, not a style preference.
     */
    const forbidden: readonly (readonly [string, RegExp])[] = [
      ["a deletion window", /\bwithin \d+ (?:business )?(?:day|hour|week)s?\b/i],
      ["a promise to process it", /we will process it/i],
      ["a deactivated state", /deactivat/i],
      ["an all-erased claim", /all your data/i],
    ];
    for (const [what, pattern] of forbidden) {
      expect(settingsBody, `${what} in the settings card`).not.toMatch(pattern);
    }
  });

  it("gives every outcome the action can answer a label", () => {
    /**
     * The union is read from the action rather than restated, so a new `kind` cannot land without a
     * sentence. `DeleteAccountCard` resolves `outcome-${kind}`, and `itemLabel` throws when the id
     * is absent.
     */
    const union = ACTION.slice(
      ACTION.indexOf("export type DeleteAccountOutcome"),
      ACTION.indexOf("export type DeleteAccountOutcome") + 1200,
    );
    const kinds = [...union.matchAll(/kind: "([a-z-]+)"/g)].map((match) => match[1]);
    expect(kinds.length).toBeGreaterThanOrEqual(5);
    for (const kind of kinds) {
      expect(() => itemLabel(settingsDeletion, `outcome-${kind}`), `outcome-${kind}`).not.toThrow();
    }
    // Every id the card resolves, so a rename is a red test instead of a blank control.
    for (const id of [
      "confirm-phrase",
      "confirm-label",
      "confirm-placeholder",
      "submit",
      "pending",
      "retained",
    ]) {
      expect(() => itemLabel(settingsDeletion, id), id).not.toThrow();
    }
  });
});

describe("what the copy says is retained (§6)", () => {
  const surfaces = (): readonly (readonly [string, string])[] => [
    ["/settings delete card", itemLabel(settingsDeletion, "retained")],
    ...(["quizhub", "alignsynch"] as const).map((name): readonly [string, string] => [
      `/privacy (${name})`,
      // The sentence lives as the `deletion` item of the `retention` section (#278).
      itemBody(
        sectionOf(
          legalCopy(name === "quizhub" ? brand : (alignSynchBrand as Brand)).privacy,
          "retention",
        ),
        "deletion",
      ),
    ]),
  ];

  it("names the address the opt-out list keeps, and claims nothing else is kept", () => {
    /**
     * §6: "`news_signup` (email + `unsubscribed_at`) — indefinite. The suppression list. Without the
     * address we cannot honour the opt-out". The purge implements exactly that, so a sentence that
     * groups the suppression row with the rows that carry no address is false. Every sentence that
     * mentions the opt-out has to carry the address with it.
     */
    for (const [where, text] of surfaces()) {
      const sentences = text.split(/(?<=\.)\s+/);
      const aboutOptOut = sentences.filter((sentence) => /opt-out|suppress/i.test(sentence));
      expect(aboutOptOut.length, `${where} mentions no opt-out at all`).toBeGreaterThan(0);
      for (const sentence of aboutOptOut) {
        expect(normalise(sentence), `${where}: opt-out without the address`).toMatch(
          /email address/i,
        );
      }
      expect(text, `${where}`).not.toMatch(/none of the three carries/i);
      expect(text, `${where}`).not.toMatch(/without your name or address attached/i);
    }
  });

  it("is true of lib/account/purge.ts: the opt-out row is updated on the address, never deleted", () => {
    const start = PURGE.indexOf('key: "newsSignupsSuppressed"');
    expect(start, "the news_signup step is gone or renamed").toBeGreaterThan(-1);
    const step = PURGE.slice(start, start + 900);
    expect(step).toContain("UPDATE news_signup");
    expect(step).toContain("email");
    expect(step).not.toContain("DELETE FROM news_signup");
  });
});
