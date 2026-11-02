/**
 * The account support page's contact band: a link to the one form, no form of its own, no address.
 *
 * This file replaces `support-contact-form.test.tsx`, which proved the old in-app form was
 * *deliberately disconnected* (#290): the fields rendered, the submit was disabled, and a banner
 * apologised that nothing typed there would leave the page. The owner's rule (2026-11-02) retires
 * that shape: there is one contact path, the form on `/help`, which stores the message in
 * Postgres before it mails it. This page points at it.
 *
 * The proof is still behavioural rather than a source grep — a grep passes on a component that
 * mounts a form behind a flag — so the component is rendered and the DOM read back:
 *
 *   points      the heading, the sentence and a link whose destination is `/help`;
 *   no form     no `<form>`, no field, no submit control: a second copy cannot quietly return;
 *   no address  no `mailto:` and no address-shaped string, in the copy or the markup.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// `next/link` needs a router context that a static render does not have; the anchor is all this
// file reads, exactly as `tests/public-contact.test.tsx` does it.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

import { ContactPointer } from "@/components/support/contact-pointer";
import { supportPageCopy } from "@/data/pages/support";
import { sectionOf } from "@/lib/page-copy";

/** The card's own sweep: `grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}'`. */
const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/;

const contact = sectionOf(supportPageCopy, "contact");
const html = renderToStaticMarkup(createElement(ContactPointer, { copy: contact }));

describe("the account page's contact band points at the one form", () => {
  it("renders the fixture's heading and sentence, and a link to /help", () => {
    expect(html).toContain(contact.heading ?? "");
    expect(html).toContain(contact.body ?? "");
    expect(contact.cta?.href).toBe("/help");
    expect(html).toContain('href="/help"');
    expect(html).toContain(contact.cta?.label ?? "");
  });

  it("mounts no form: no form element, no field, no submit control", () => {
    expect(html).not.toContain("<form");
    for (const id of ["name", "email", "subject", "message"]) {
      expect(html).not.toContain(`id="${id}"`);
    }
    expect(html).not.toContain('type="submit"');
  });

  it("prints no address and no mailto — the mailbox is the form's recipient, not the page's words", () => {
    expect(html).not.toContain("mailto:");
    expect(html).not.toMatch(ADDRESS);
    // And the fixture, not only the render: the copy cannot carry one either.
    expect(JSON.stringify(contact)).not.toMatch(ADDRESS);
  });

  it("is reachable at a registered route", () => {
    // `cta.href` is checked against `content/routes.ts` by `data:check` E23 too; the assertion
    // here keeps the link honest in a unit run.
    expect(contact.cta?.href).toBe("/help");
  });
});
