// @vitest-environment jsdom
/**
 * What each step of `/register` actually renders (owner review, 2026-11-02).
 *
 * Step 1 collects the email address and nothing else; First Name and Last Name moved to step 2,
 * two columns beside the password fields; the phone number, date of birth and country left
 * sign-up altogether.
 *
 * `tests/register-view.test.tsx` proves step 1 with a static render, which is all a server render
 * can see — step 2 is client state, so no `renderToStaticMarkup` call ever reaches it. This file
 * mounts the view in a DOM, types an email, presses Next the way a person does and reads the
 * controls back. A source-level assertion ("the JSX for firstName sits in the step-2 block") would
 * pass while the field rendered on the wrong step or twice, which is the defect the owner's note
 * names.
 */
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

import type { Brand } from "@/content/brand";
import { RegisterView } from "@/components/auth/register-view";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { quizHubBrand } from "@/data/brand";
import { registerCopy } from "@/data/pages/register";
import { AUTH_MARKS_BY_BRAND } from "@/lib/auth/marks";
import { AFTER_SIGN_IN_BY_BRAND } from "@/lib/auth/paths";
import { registerCopyFor } from "@/lib/auth-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const BRANDS = [
  ["quizhub", quizHubBrand as Brand],
  ["alignsynch", alignSynchBrand as Brand],
] as const;

const viewProps = (id: (typeof BRANDS)[number][0], record: Brand) => ({
  copy: registerCopyFor(registerCopy(record), id),
  destination: AFTER_SIGN_IN_BY_BRAND[id],
  marks: AUTH_MARKS_BY_BRAND[id],
});

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

/**
 * Every `id` on a visible field, in document order. Hidden inputs are excluded: Radix's Checkbox
 * renders one, and it is not a field a person sees on the step.
 */
const fieldIds = () =>
  [...container.querySelectorAll<HTMLInputElement>("input, select, textarea")]
    .filter((el) => el.type !== "hidden")
    .map((el) => el.id);

/** The button whose visible label starts with `label` — Next, Back, Create Account. */
const button = (label: string) => {
  const found = [...container.querySelectorAll("button")].find((el) =>
    (el.textContent ?? "").trim().startsWith(label),
  );
  expect(found, `no button labelled "${label}"`).toBeDefined();
  return found as HTMLButtonElement;
};

const buttonLabels = () =>
  [...container.querySelectorAll("button")].map((el) => (el.textContent ?? "").trim());

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

const mount = (id: (typeof BRANDS)[number][0], record: Brand) => {
  // A fresh root per brand: React reconciles the same component type across renders of one root,
  // so re-rendering would carry the first brand's step and field values into the second's.
  act(() => root.unmount());
  root = createRoot(container);
  act(() => {
    root.render(createElement(RegisterView, viewProps(id, record)));
  });
};

/** Mount, fill step 1, and press Next — the path a person takes to step 2. */
const advance = (id: (typeof BRANDS)[number][0], record: Brand) => {
  mount(id, record);
  type("email", "avery@example.com");
  act(() => button("Next").click());
};

describe("the sign-up steps, read back from the DOM", () => {
  it("step 1 renders the email input and no name, phone, date or country control", () => {
    for (const [id, record] of BRANDS) {
      mount(id, record);

      expect(fieldIds(), id).toEqual(["email"]);
    }
  });

  it("step 2 renders First Name and Last Name in one two-column grid", () => {
    for (const [id, record] of BRANDS) {
      advance(id, record);

      // The names lead the step, in that order, then the credentials.
      expect(fieldIds(), id).toEqual(["firstName", "lastName", "password", "confirmPassword"]);

      const first = container.querySelector("#firstName");
      const last = container.querySelector("#lastName");
      const grid = first?.parentElement?.parentElement;
      expect(grid, `${id}: the two name fields are not wrapped in one grid`).toBe(
        last?.parentElement?.parentElement,
      );

      const className = grid?.className ?? "";
      expect(className, id).toContain("grid");
      expect(className, id).toContain("grid-cols-1");
      expect(className, id).toContain("sm:grid-cols-2");

      // Step 1's fields are not repeated here — the names moved, they were not copied.
      expect(fieldIds(), id).not.toContain("email");
    }
  });

  it("step 2 will not submit until the names it now owns are filled", () => {
    for (const [id, record] of BRANDS) {
      advance(id, record);

      expect(buttonLabels(), id).toContain("Create Account");
      expect(button("Create Account").disabled, `${id}: empty names enabled submit`).toBe(true);

      type("firstName", "Avery");
      type("lastName", "Rowan");
      type("password", "lozenge-123");
      type("confirmPassword", "lozenge-123");

      // Required fields filled, terms still unticked: the button stays off, so the names are
      // part of the same gate the password is and not a decoration.
      expect(button("Create Account").disabled, `${id}: unticked terms enabled submit`).toBe(true);
    }
  });
});
