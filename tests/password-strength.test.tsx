// @vitest-environment jsdom
/**
 * The sign-up password meter, typed through the real view (owner review, 2026-11-02).
 *
 * The card asks for three things and this file measures all three, because a meter is the kind of
 * control that renders beautifully and lies:
 *
 *   * it **moves with the value** — `abc`, `abcdefgh` and `Abcdef1!` are three different states,
 *     read back from the DOM after real keystrokes, not from a table in a test;
 *   * it **guides**, with the two rules the server's floor implies (enough characters, more than
 *     one character class), each turning on as the value satisfies it;
 *   * it **never blocks**. A weak password plus a matching confirmation and the terms ticked
 *     enables Create Account exactly as a strong one does: the meter is advice, and the password
 *     policy is the server's (`lib/auth/reset-token.ts::PASSWORD_MIN_LENGTH`).
 *
 * `renderToStaticMarkup` cannot see any of this — step 2 is client state — so the view is mounted
 * in a DOM and typed into, the same way `tests/register-steps.test.tsx` proves the steps.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

import { RegisterView } from "@/components/auth/register-view";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { registerCopy } from "@/data/pages/register";
import { registerCopyFor } from "@/lib/auth-copy";
import { AUTH_MARK_SRC_BY_BRAND, AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { AFTER_SIGN_IN_BY_BRAND } from "@/lib/auth/paths";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Type into a controlled React input the way the browser does. */
const type = (id: string, value: string) => {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  expect(input, `no #${id} input to type into`).not.toBeNull();
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setValue?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

/** Mount the alignment build's sign-up and walk to the step that owns the password field. */
const advance = () => {
  act(() => {
    root.render(
      createElement(RegisterView, {
        copy: registerCopyFor(registerCopy(alignSynchBrand), "alignsynch"),
        destination: AFTER_SIGN_IN_BY_BRAND.alignsynch,
        marks: AUTH_MARKS_BY_BRAND.alignsynch,
        markSrc: AUTH_MARK_SRC_BY_BRAND.alignsynch,
      }),
    );
  });
  type("email", "avery@example.com");
  const next = [...container.querySelectorAll("button")].find((el) =>
    (el.textContent ?? "").trim().startsWith("Next"),
  );
  act(() => next?.click());
};

/**
 * The meter as a reader sees it: the level, how long the value is, the word beside the bar, and
 * the two guidance lines with the state each is in.
 */
const meter = () => {
  const node = container.querySelector<HTMLElement>("[data-password-strength]");
  if (node === null) return null;
  return {
    strength: node.getAttribute("data-password-strength"),
    length: Number(node.getAttribute("data-password-length")),
    word: (node.querySelector("[aria-live]")?.textContent ?? "").trim(),
    rules: Object.fromEntries(
      [...node.querySelectorAll<HTMLElement>("[data-rule]")].map((rule) => [
        rule.getAttribute("data-rule"),
        rule.getAttribute("data-met"),
      ]),
    ) as Record<string, string>,
    guidance: (node.querySelector("ul")?.textContent ?? "").trim(),
  };
};

/** The Create Account button — the control that would block a password if the meter could. */
const createAccount = () =>
  [...container.querySelectorAll("button")].find((el) =>
    (el.textContent ?? "").trim().startsWith("Create Account"),
  ) as HTMLButtonElement | undefined;

describe("the sign-up password meter", () => {
  it("is absent until something is typed — an empty field is not 'weak'", () => {
    advance();
    expect(meter()).toBeNull();
  });

  it("reads three measured states off three typed values", () => {
    advance();

    type("password", "abc");
    expect(meter()).toMatchObject({ strength: "weak", length: 3, word: "Weak password" });
    expect(meter()?.rules).toEqual({ "rule-length": "false", "rule-classes": "false" });

    type("password", "abcdefgh");
    expect(meter()).toMatchObject({ strength: "fair", length: 8, word: "Fair password" });
    // Long enough, one character class: the length rule is satisfied, the variety rule is not.
    expect(meter()?.rules).toEqual({ "rule-length": "true", "rule-classes": "false" });

    type("password", "Abcdef1!");
    expect(meter()).toMatchObject({ strength: "strong", length: 8, word: "Strong password" });
    expect(meter()?.rules).toEqual({ "rule-length": "true", "rule-classes": "true" });
  });

  it("states the two rules, with the server's own floor as the number", () => {
    advance();
    type("password", "abc");

    const guidance = meter()?.guidance ?? "";
    expect(guidance).toContain("At least 8 characters");
    expect(guidance).toContain("Mix capitals, numbers or symbols");
  });

  it("does not block a weak password the server would accept", () => {
    advance();
    type("firstName", "Avery");
    type("lastName", "Rowan");
    type("password", "abc");
    type("confirmPassword", "abc");

    // Only the password is short; the meter says so and refuses nothing.
    expect(meter()?.strength).toBe("weak");

    const terms = container.querySelector<HTMLElement>("#terms, [role='checkbox']");
    expect(terms, "no terms checkbox in the DOM").not.toBeNull();
    act(() => terms?.click());

    const button = createAccount();
    expect(button, "no Create Account button").toBeDefined();
    // Short, weak, one class — and still submittable, because the meter is advice and the
    // password policy belongs to the server. A meter that gated this would be a second policy.
    expect(button?.disabled, "the meter blocked a password").toBe(false);
  });
});
