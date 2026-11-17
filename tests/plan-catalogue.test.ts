// @vitest-environment jsdom
/**
 * **The approved three-plan catalogue (#1127), and the ratchet that keeps one price in one home.**
 *
 * The owner approved one catalogue on 2026-11-17:
 *
 *   Single           $9.99 / month   1 relationship
 *   Family           $19.99 / month   up to 4 relationships
 *   Single Annual    $99 / year      1 relationship
 *
 * Four things are asserted here, in the order a regression would hit them:
 *
 *   1. **The numbers.** Three prices, in cents, written out. A test that read them from the same
 *      function it is testing proves nothing; these are the owner's figures, and changing one is a
 *      product decision that has to show up as a diff on this line.
 *   2. **The capacity rule.** Family covers four relationships and the two Single plans cover one.
 *      The panel prints the number off the row (`data-plan-capacity`), so a catalogue that says
 *      "Up to 4" in prose and 1 in the field is a defect with two answers.
 *   3. **The provider mapping.** Three plans, the four lookup keys that already exist, and the
 *      fourth key named as unclaimed rather than invented into a plan. This is the table a
 *      checkout depends on: a plan mapped to a key the account does not hold is a refused
 *      purchase, and a key resolved by two plans is one plan sold as another.
 *   4. **The ratchet.** No plan surface writes a dollar amount, no retired figure survives anywhere
 *      the build renders, and the rendered panel prints the catalogue's amounts — the assertion
 *      that stops a marketing page quoting the old price again.
 *
 * The panel is mounted in a DOM because the price only exists after a render, and the walk is
 * mounted card-free because that is the create path: **no payment input**, per #1115 D3.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

import { InviteWalk } from "@/components/assessment-flow/invite-walk";
import { BILLING_INTERVALS } from "@/data/billing-plans";
import { BILLING_PRICE_LOOKUP_KEYS, billingPriceLookupKeyFor } from "@/data/billing-prices";
import {
  FAMILY_CAPACITY,
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PLAN_IDS,
  membershipPlan,
  membershipPlanProblems,
} from "@/data/membership-plans";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { formatCurrency } from "@/content/core";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const PLANS = sectionOf(assessmentCreatePageCopy, "plans");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(element: ReactElement): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
  return container;
}

async function press(where: HTMLElement, selector: string): Promise<void> {
  const control = where.querySelector<HTMLElement>(selector);
  if (control === null) throw new Error(`no control matching ${selector}`);
  await act(async () => {
    control.click();
  });
}

/** The panel as stage 5 draws it: the walk, card-free, which is the create path. */
function cardFreeWalk() {
  return createElement(InviteWalk, {
    copy: assessmentCreatePageCopy,
    instanceRecordId: "assessment-instance-1",
    relationshipId: "relationship-1",
    paid: false,
    onPaid: () => undefined,
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  const mounted = root;
  root = null;
  if (mounted !== null) {
    await act(async () => {
      mounted.unmount();
    });
  }
  container?.remove();
  container = null;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("the catalogue is coherent", () => {
  it("has no problems of its own", () => {
    expect(membershipPlanProblems()).toEqual([]);
  });

  it("is exactly three plans, in the owner's order", () => {
    expect(MEMBERSHIP_PLANS.map((plan) => plan.id)).toEqual(["single", "family", "annual"]);
    expect(MEMBERSHIP_PLANS.map((plan) => plan.name)).toEqual([
      "Single",
      "Family",
      "Single Annual",
    ]);
    expect([...MEMBERSHIP_PLAN_IDS]).toEqual(["single", "family", "annual"]);
  });
});

describe("the numbers the owner approved (#1127)", () => {
  it("prices Single at $9.99 a month", () => {
    const single = membershipPlan("single");
    expect(single?.priceCents).toBe(999);
    expect(single?.interval).toBe("month");
    expect(formatCurrency(999)).toBe("$9.99");
  });

  it("prices Family at $19.99 a month", () => {
    const family = membershipPlan("family");
    expect(family?.priceCents).toBe(1_999);
    expect(family?.interval).toBe("month");
    expect(formatCurrency(1_999)).toBe("$19.99");
  });

  it("prices Single Annual at $99 a year — one charge, not a monthly figure", () => {
    const annual = membershipPlan("annual");
    expect(annual?.priceCents).toBe(9_900);
    expect(annual?.interval).toBe("year");
    expect(formatCurrency(9_900, { trimZeroCents: true })).toBe("$99");
  });

  it("derives every amount from the price fixture rather than typing one", () => {
    // The catalogue holds no amount of its own: each price is `billing-plans.ts`'s row for that
    // tier and interval. A second figure here would be a fifth surface quoting a sixth number.
    const source = readFileSync(join(process.cwd(), "data/membership-plans.ts"), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    // No cents literal in the code: the only numbers in it are the capacity rule's.
    const cents = code.match(/\b\d{3,}\b/g) ?? [];
    expect(cents).toEqual([]);
  });
});

describe("the capacity rule", () => {
  it("gives Family up to four relationships and the Single plans one each", () => {
    expect(membershipPlan("family")?.capacity).toBe(FAMILY_CAPACITY);
    expect(FAMILY_CAPACITY).toBe(4);
    expect(membershipPlan("single")?.capacity).toBe(1);
    expect(membershipPlan("annual")?.capacity).toBe(1);
  });

  it("says the capacity in words that match the number beside it", () => {
    expect(membershipPlan("family")?.summary).toBe("Up to 4 relationships");
    expect(membershipPlan("single")?.summary).toBe("1 relationship");
    expect(membershipPlan("annual")?.summary).toContain("1 relationship");
  });

  it("rejects a Family row that contradicts the approved price", () => {
    // The rule is checked, not assumed: `membershipPlanProblems()` is the single place that says a
    // Family row must carry four relationships and the Single rows one, and it is what
    // `data:check`-style validation runs. Here the real catalogue passes it, and the shape the
    // function polices is the one the panel prints.
    expect(membershipPlanProblems()).toEqual([]);
    expect(MEMBERSHIP_PLANS.filter((plan) => plan.capacity > 1)).toHaveLength(1);
    expect(MEMBERSHIP_PLANS.every((plan) => plan.capacity >= 1)).toBe(true);
  });
});

describe("the four lookup keys, and the three plans that map to them", () => {
  it("maps each plan to the exact key the account already holds", () => {
    // Spelled out, because this table *is* the contract with the provider: renaming a key in the
    // dashboard has to fail here rather than at a customer's click.
    expect(membershipPlan("single")?.lookupKey).toBe("alignsynch_basic_month");
    expect(membershipPlan("family")?.lookupKey).toBe("alignsynch_principal_month");
    expect(membershipPlan("annual")?.lookupKey).toBe("alignsynch_basic_year");
  });

  it("creates no key: every mapped key is one of the four that already exist", () => {
    const existing = new Set(
      Object.values(BILLING_PRICE_LOOKUP_KEYS).flatMap((row) => Object.values(row)),
    );
    expect(existing.size).toBe(4);
    expect([...existing].sort()).toEqual([
      "alignsynch_basic_month",
      "alignsynch_basic_year",
      "alignsynch_principal_month",
      "alignsynch_principal_year",
    ]);
    for (const plan of MEMBERSHIP_PLANS) {
      expect(existing.has(plan.lookupKey), plan.id).toBe(true);
    }
  });

  it("names the fourth key as unclaimed: no approved plan is a Family Annual", () => {
    // `alignsynch_principal_year` resolves on both accounts and no plan maps it. That is the
    // honest shape — the alternative is inventing a fourth plan, which the card forbids.
    expect(membershipPlan("family")?.interval).toBe("month");
    expect(billingPriceLookupKeyFor("principal", "year")).toBe("alignsynch_principal_year");
    const mapped = new Set(MEMBERSHIP_PLANS.map((plan) => plan.lookupKey));
    expect(mapped.has("alignsynch_principal_year")).toBe(false);
    expect(mapped.size).toBe(MEMBERSHIP_PLANS.length);
  });

  it("claims a distinct (tier, interval) pair per plan, so no key is sold twice", () => {
    const pairs = MEMBERSHIP_PLANS.map((plan) => `${plan.tier}/${plan.interval}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    for (const plan of MEMBERSHIP_PLANS) {
      expect(BILLING_INTERVALS).toContain(plan.interval);
      expect(billingPriceLookupKeyFor(plan.tier, plan.interval)).toBe(plan.lookupKey);
    }
  });
});

describe("the ratchet — no surface quotes a price the catalogue does not carry", () => {
  /** Every file under a directory, as source. */
  function sources(dir: string, filePattern = /\.(ts|tsx)$/): { file: string; text: string }[] {
    return readdirDeep(join(process.cwd(), dir))
      .filter((path) => filePattern.test(path))
      .map((path) => ({ file: path, text: readFileSync(path, "utf8") }));
  }

  function readdirDeep(dir: string): string[] {
    // A deliberately tiny walker: no `fs.Dirent` recursion helper hides what is being read, and a
    // directory that does not exist (a surface this brand has no folder for) is skipped rather
    // than crashing the suite.
    const out: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const entry of entries) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) out.push(...readdirDeep(path));
      else out.push(path);
    }
    return out;
  }

  /** The code a browser or a build receives: both comment forms removed. */
  function code(text: string): string {
    return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  }

  /** A figure as a price, not as a coordinate: `119.85` in an SVG path is not `$19.85`. */
  function mentions(text: string, figure: string): boolean {
    const pattern = new RegExp(`(?<![\\d.])${figure.replace(".", "\\.")}(?![\\d])`);
    return pattern.test(text);
  }

  it("writes no dollar amount in the components that draw a plan", () => {
    // `$5,000` in a tournament prize is copy; a price on a plan surface is a second home for one.
    // The pattern is a **price**, not an SQL placeholder: `WHERE id = $1` is not `$1.00`.
    const offenders = ["components/assessment-flow", "components/pricing", "lib/member"]
      .flatMap((dir) => sources(dir))
      .filter(({ text }) => /\$\d[\d,]*\.\d/.test(code(text)))
      .map(({ file }) => file.replace(`${process.cwd()}/`, ""));
    expect(offenders).toEqual([]);
  });

  it("leaves no retired figure in any code the build renders", () => {
    // The figures this card replaced, as code: the cents-era dollar forms. A comment may record
    // that they existed; a value may not still be one of them.
    const retired = ["8.95", "16.95", "85.92", "9.95", "19.85", "14.99"];
    const offenders: string[] = [];
    for (const dir of ["components", "app", "data", "content"]) {
      for (const { file, text } of sources(dir)) {
        const rendered = code(text);
        for (const figure of retired) {
          if (mentions(rendered, figure)) offenders.push(`${file} — ${figure}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("passes the card's own grep: no `8.95` and no `14.99` anywhere in the rendered tree", () => {
    // `git grep -n '8\.95\|14\.99' -- components app data content` must print nothing — comments
    // included, because a doc comment is still a number a reader can copy. This is that grep.
    const offenders: string[] = [];
    for (const dir of ["components", "app", "data", "content"]) {
      for (const { file, text } of sources(dir)) {
        for (const figure of ["8.95", "14.99"]) {
          if (text.includes(figure)) offenders.push(`${file} — ${figure}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("reads the taxonomy's per-relationship amount nowhere: it is not a price the shop charges", () => {
    // `RELATIONSHIP_PRICE_CENTS` ($9.99) is the taxonomy's own field, and since #1127 it happens to
    // equal Single's monthly amount — so a rendered string can no longer tell them apart. This is
    // the guard that survives that collision: no component and no `lib/` module reads it, so it
    // cannot reach a screen.
    const readers = ["components", "lib"]
      .flatMap((dir) => sources(dir))
      .filter(({ text }) => code(text).includes("RELATIONSHIP_PRICE_CENTS"))
      .map(({ file }) => file.replace(`${process.cwd()}/`, ""));
    expect(readers).toEqual([]);
  });

  it("prints the catalogue's three amounts on the panel, and nothing else", async () => {
    const where = await mount(cardFreeWalk());
    const printed = [...where.querySelectorAll("[data-plan-price]")].map(
      (node) => node.textContent ?? "",
    );
    const carried = MEMBERSHIP_PLANS.map((plan) =>
      formatCurrency(plan.priceCents, { trimZeroCents: true }),
    );
    expect(printed).toEqual(carried);
    // Every figure on the panel is one the catalogue carries — no `$0.00`, no placeholder, no
    // fourth number from a copy block.
    const figures = (where.textContent ?? "").match(/\$\d[\d,.]*/g) ?? [];
    for (const figure of figures) expect(carried).toContain(figure);
  });
});

describe("the panel a person actually sees", () => {
  it("draws the three plans with their amounts, capacities and intervals", async () => {
    const where = await mount(cardFreeWalk());

    const rows = [...where.querySelectorAll("[data-plan]")];
    expect(rows.map((row) => row.getAttribute("data-plan"))).toEqual([
      "single",
      "family",
      "annual",
    ]);

    for (const plan of MEMBERSHIP_PLANS) {
      const row = where.querySelector(`[data-plan="${plan.id}"]`);
      expect(row, plan.id).not.toBeNull();
      expect(row?.getAttribute("data-plan-capacity")).toBe(String(plan.capacity));
      expect(row?.getAttribute("data-plan-interval")).toBe(plan.interval);
      // The row's own figure, printed — `$9.99`, `$19.99`, `$99` — and the fixture's words beside
      // it, so the DOM cannot disagree with the catalogue it was built from.
      expect(where.querySelector(`[data-plan-price="${plan.id}"]`)?.textContent).toBe(
        formatCurrency(plan.priceCents, { trimZeroCents: true }),
      );
      expect(row?.textContent).toContain(itemLabel(PLANS, `${plan.id}-note`));
      expect(row?.textContent).toContain(itemLabel(PLANS, `${plan.id}-interval`));
    }
  });

  it("takes no payment input in the create path — the row writes the choice (#1115 D3)", async () => {
    const where = await mount(cardFreeWalk());

    // The panel's only controls are the three radios; there is no card field, no frame, and no
    // control that could start a checkout.
    const inputs = [...where.querySelectorAll("input")];
    expect(inputs.every((input) => input.getAttribute("type") === "radio")).toBe(true);
    expect(inputs).toHaveLength(MEMBERSHIP_PLANS.length);
    expect(where.querySelector("[data-checkout-frame]")).toBeNull();
    expect(where.querySelector('[data-pay-step="card"]')).toBeNull();

    // Choosing a row records it and opens nothing: the step stays on the plans, and the create
    // path's own action — the free week — is what takes the reader onward.
    await press(where, 'input[name="plan"][value="family"]');
    expect(where.querySelector('[data-pay-step="plan"]')).not.toBeNull();
    expect(where.querySelector("[data-checkout-frame]")).toBeNull();
    expect(where.querySelector('[data-pay-action="continue"]')).not.toBeNull();
    // …and the panel's recap names the plan the money would buy, at the plan's own amount.
    expect(where.textContent).toContain(
      `${itemLabel(PLANS, "family")} · ${itemLabel(PLANS, "family-price")}${itemLabel(PLANS, "family-interval")}`,
    );
  });
});
