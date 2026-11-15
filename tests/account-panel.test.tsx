/** @vitest-environment jsdom */

/**
 * The account panel **opens on creating the account, and both ways swap in place** (#829).
 *
 * Two defects on stage 4, and this file is the guard for both:
 *
 *   1. the stage mounted `LoginView` alone, so it opened on **Sign in** — the wrong default for
 *      the person the flow is for, who has no account yet;
 *   2. its "Sign up" control was a `<Link href="/register">`, so wanting an account navigated to
 *      the global page and dropped the stage column and the review beside it.
 *
 * A rendered-string test cannot see either: it only shows the first state, and a link and a button
 * look the same in markup. So this mounts the real `AccountPanel` in jsdom and drives it the way
 * a person does — and the claim it makes is about what *did not* happen (`router.push` never
 * fires) as much as what did. The failure mode that would pass a screenshot test is this one
 * being re-implemented as a link that happens to point back at the stage; the router spy is what
 * refuses that ("option A wearing option B's clothes").
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createNode("a", { href, ...(rest as Record<string, unknown>) }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import { createElement } from "react";
/** A minimal `next/link` stand-in, kept out of the mock factory so it can be a plain function. */
function createNode(
  tag: string,
  props: Record<string, unknown>,
  children?: unknown,
): ReturnType<typeof createElement> {
  return createElement(tag, props, children as never);
}

import { AccountPanel } from "@/components/assessment-flow/account-panel";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import type { Brand } from "@/content/brand";
import { loginCopy } from "@/data/pages/login";
import { registerCopy } from "@/data/pages/register";
import { heroTilesFor, loginCopyFor, registerCopyFor } from "@/lib/auth-copy";
import { AUTH_MARK_SRC_BY_BRAND, AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked and a
  // click returns before the re-render the next assertion reads.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const brand = alignSynchBrand as Brand;
const STAGE = "/templates/relationship/brothers/create/commit";

/**
 * The two labels the toggle is read by, out of the fixtures rather than typed here — the same
 * rule the views follow: a word in a test is a second home for copy.
 */
const BACK_TO_LOGIN = itemLabel(
  sectionOf(registerCopyFor(registerCopy(brand), "alignsynch"), "navigation"),
  "back-to-login",
);
const SIGN_UP_HERE = itemLabel(
  sectionOf(loginCopyFor(loginCopy(brand), "alignsynch"), "sign-in"),
  "signup-action",
);

/**
 * The two prop bags the stage page hands over. `startGoogle` and `providerHint` are server actions
 * on the real page; here they are inert functions with the same shapes, because nothing in this
 * file exercises Google or the provider hint — the panel only forwards them.
 *
 * `leaving` is not in either bag: the panel decides it, because it is a property of the mount
 * (stage 4 is inside `(mainlayout)`, so a public destination opens a new tab) and not of the data.
 */
const panelProps = (names?: { first?: string; last?: string }) => ({
  login: {
    copy: loginCopyFor(loginCopy(brand), "alignsynch"),
    marks: AUTH_MARKS_BY_BRAND.alignsynch,
    markSrc: AUTH_MARK_SRC_BY_BRAND.alignsynch,
    next: STAGE,
    googleFailure: false,
    demo: { kind: "off" as const },
    providerHint: async () => false,
    startGoogle: async () => ({ ok: false as const }),
  },
  register: {
    copy: registerCopyFor(registerCopy(brand), "alignsynch"),
    destination: STAGE,
    marks: AUTH_MARKS_BY_BRAND.alignsynch,
    markSrc: AUTH_MARK_SRC_BY_BRAND.alignsynch,
    // The page hands the hero's band over with the copy; this mount is embedded, so it is never
    // drawn — the panel's own case for that is `tests/auth-hero.test.tsx`.
    stats: heroTilesFor(loginCopy(brand), "alignsynch"),
    initialFirst: names?.first,
    initialLast: names?.last,
  },
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  /**
   * Radix's checkbox measures itself with a `ResizeObserver`, which jsdom does not implement —
   * without a stub, mounting the sign-in card throws before a single assertion runs. The stub
   * observes nothing, which is all a static-size test needs.
   */
  globalThis.ResizeObserver ??= class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
  push.mockClear();
  refresh.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const mount = (names?: { first?: string; last?: string }) => {
  const props = panelProps(names);
  act(() => {
    root.render(
      createElement(AccountPanel, props as unknown as Parameters<typeof AccountPanel>[0]),
    );
  });
};

const buttonByText = (text: string): HTMLButtonElement => {
  const match = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(text),
  );
  if (match === undefined) throw new Error(`no button matching "${text}"`);
  return match;
};

describe("stage 4's account panel", () => {
  it("opens on creating the account, not on signing in", () => {
    mount();

    // Both views open on an email field; the password is the one only sign-in draws, so its
    // absence is what says this is step 1 of sign-up.
    expect(container.querySelector("#email")).not.toBeNull();
    expect(container.querySelector("#password")).toBeNull();
  });

  it("swaps to sign in without navigating, and back again without navigating", () => {
    mount();
    expect(container.querySelector("#password")).toBeNull();

    act(() => buttonByText(BACK_TO_LOGIN).click());
    // Sign-in is on screen now — the password field is the one register's step 1 does not draw.
    expect(container.querySelector("#password")).not.toBeNull();

    // The sign-up control inside the sign-in form is now a button, not a link to /register.
    const signUp = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(SIGN_UP_HERE),
    );
    expect(signUp, "the sign-in form should offer sign-up as a button").toBeDefined();
    expect(
      container.querySelector(`a[href="/register"]`),
      "the sign-up control navigated instead of swapping in place",
    ).toBeNull();
    act(() => signUp?.click());
    expect(container.querySelector("#password")).toBeNull();

    // The whole point: neither direction left the stage.
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("prefills the names Stage 1 already collected", () => {
    mount({ first: "Bro1", last: "Bro" });

    // Step 1 is the email; the names live on step 2, so fill the email and advance.
    const email = container.querySelector<HTMLInputElement>("#email");
    expect(email).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(email, "bro1@example.com");
      email?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    act(() => buttonByText("Next").click());

    const first = container.querySelector<HTMLInputElement>("#firstName");
    const last = container.querySelector<HTMLInputElement>("#lastName");
    expect(first?.value).toBe("Bro1");
    expect(last?.value).toBe("Bro");
  });
});
