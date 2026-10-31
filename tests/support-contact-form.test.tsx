// @vitest-environment jsdom
/**
 * The support contact form says nothing it cannot do (#290) — the claims, as DOM.
 *
 * The form used to answer a submit with a 1.5 s timer, a "Message Sent!" screen and a random
 * reference number, while the message was discarded: the one fabricated claim a reader
 * participates in. It is now deliberately disconnected, so the proof is behavioural, not a
 * source grep — a grep would pass on a component that still mounted the success branch behind a
 * flag. This file mounts the component and reads the DOM back:
 *
 *   disconnected  the one honest sentence renders, with the address from the brand record;
 *   shaped        the fields and the submit control still exist, so the form is kept for later;
 *   inert         the submit is disabled and clicking it changes nothing — no success text, no
 *                 reference number, no state that could be mistaken for a send;
 *   no claims     no file-type/size promise, no attachment control, no response-time promise;
 *   brand-driven  the address is a prop, so the fixture carries no literal mailbox;
 *   no timer      the component's code (comments stripped) holds no timer and no randomness.
 *
 * The last check strips comments first on purpose: the module's docblock *explains* that the
 * timer is gone, and a naive grep would match its own documentation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ContactForm } from "@/components/support/contact-form";
import { brand } from "@/data/brand";
import { supportPageCopy } from "@/data/pages/support";
import { sectionOf } from "@/lib/page-copy";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const contactCopy = sectionOf(supportPageCopy, "contact");
const categories = sectionOf(supportPageCopy, "help-categories");

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

const mount = (supportEmail = brand.supportEmail): HTMLElement => {
  act(() => {
    root.render(
      <ContactForm
        selectedCategory="all"
        copy={contactCopy}
        categoryCopy={categories}
        supportEmail={supportEmail}
      />,
    );
  });
  return container;
};

const textOf = (element: HTMLElement): string => (element.textContent ?? "").replace(/\s+/g, " ");

describe("the support contact form is disconnected, not simulated", () => {
  it("says it is not connected and names the brand's address", () => {
    const form = mount();
    const sentence = textOf(form);

    expect(sentence).toContain("This form isn't connected yet");
    expect(sentence).toContain(brand.supportEmail);
    expect(sentence).toContain("instead.");

    const mailto = form.querySelector(`a[href="mailto:${brand.supportEmail}"]`);
    expect(mailto, "no mailto link for the brand's support address").not.toBeNull();
    expect(textOf(mailto as HTMLElement)).toBe(brand.supportEmail);
  });

  it("keeps the form's shape: four fields, the category select and a submit control", () => {
    const form = mount();
    expect(form.querySelector("#name")).not.toBeNull();
    expect(form.querySelector("#email")).not.toBeNull();
    expect(form.querySelector("#subject")).not.toBeNull();
    expect(form.querySelector("#message")).not.toBeNull();
    expect(form.querySelector("form")).not.toBeNull();
    const submit = form.querySelector('button[type="submit"]');
    expect(submit, "the submit control was removed instead of disabled").not.toBeNull();
  });

  it("cannot be submitted: the control is disabled, clicking it sends nothing, nothing claims a send", () => {
    const form = mount();
    const submit = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const before = textOf(form);
    act(() => submit.click());
    act(() => {
      form.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true }));
    });

    const after = textOf(form);
    expect(after).toBe(before);
    for (const claim of ["Message Sent", "reference number", "as soon as possible", "Sending"]) {
      expect(after, `the form still claims "${claim}"`).not.toContain(claim);
    }
    // The fabricated reference number was eight base-36 characters after a "#".
    expect(after).not.toMatch(/#[0-9A-Z]{8}\b/);
  });

  it("drops the attachment control and the file-type/size promise with it", () => {
    const form = mount();
    expect(form.querySelector('input[type="file"]')).toBeNull();
    const sentence = textOf(form);
    for (const claim of ["Accepted file types", "Max 5MB", "Upload File", "Change File"]) {
      expect(sentence, `the form still claims "${claim}"`).not.toContain(claim);
    }
  });

  it("takes the address from the brand record, not from the fixture", () => {
    // The fixture names no mailbox: the sentence keeps `{email}` and the view fills it from its
    // prop. (`your.email@example.com` is a field placeholder, not a destination.)
    expect(contactCopy.items?.some((item) => item.label.includes(brand.supportEmail))).toBe(false);
    expect(contactCopy.items?.find((item) => item.id === "not-connected")?.label).toContain(
      "{email}",
    );

    const swapped = mount("someone-else@example.test");
    expect(textOf(swapped)).toContain("someone-else@example.test");
    expect(swapped.querySelector(`a[href="mailto:${brand.supportEmail}"]`)).toBeNull();
  });

  it("holds no timer and no randomness in its code", () => {
    const source = readFileSync(
      join(process.cwd(), "components", "support", "contact-form.tsx"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("Math.random");
    expect(source).not.toContain("isSubmitted");
  });
});
