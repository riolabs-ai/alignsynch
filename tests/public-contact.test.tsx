/**
 * The public contact rule (owner, 2026-11-02): **no email address on a public page, one form,
 * no captcha.**
 *
 * The rule has two halves and this file proves both, because either one alone can be satisfied
 * by a lie:
 *
 *   absence   every public surface's *words* — the fixtures that render `/`, `/pricing`,
 *             `/support`, `/welcome`, `/privacy`, `/terms`, `/help`, the chrome and the
 *             knowledge-base articles — carry no address-shaped string. A `mailto:`, a printed
 *             alias and an example placeholder all fail the same assertion, which is the point:
 *             the placeholder on the old support form was an address on a public page.
 *   presence  `/help` renders one form with a name, a reply address and a message, a hidden
 *             honeypot, a hidden timestamp, and the word "captcha" nowhere — and the page has a
 *             sentence for every state the route can answer.
 *
 * The rendered half is a `renderToStaticMarkup` of the real components, not a source grep: a
 * grep passes on a component that still mounts a captcha widget behind a flag.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// `next/link` needs a router context that a static render does not have; the anchor is all these
// cases read, exactly as `tests/register-view.test.tsx` does it.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

import { ContactForm } from "@/components/contact/contact-form";
import { ContactSection } from "@/components/contact/contact-section";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { alignSynchArticlesData } from "@/data/knowledge-base-alignsynch-data";
import { articlesData } from "@/data/knowledge-base-data";
import { helpPageCopy } from "@/data/pages/help";
import { homePageCopy } from "@/data/pages/home";
import { legalCopy } from "@/data/pages/legal";
import { marketingPageCopy } from "@/data/pages/marketing";
import { pricingPageCopy } from "@/data/pages/pricing";
import { shellPageCopy } from "@/data/pages/shell";
import { supportPageCopy } from "@/data/pages/support";
import { supportArticlePageCopy } from "@/data/pages/support-article";
import { CONTACT_STATES } from "@/lib/contact/validation";
import { sectionOf } from "@/lib/page-copy";

/** The card's own sweep, as a regex: `grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}'`. */
const ADDRESS = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/;

/** Every string a value carries, in declaration order — the same walk `brand-shell` uses. */
function words(value: unknown): string[] {
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
  return out;
}

const alignSynchLegal = legalCopy(alignSynchBrand);
const quizHubLegal = legalCopy(quizHubBrand);

/**
 * One entry per public route that has copy of its own, keyed the way the board's sweep keyed it.
 * `/support/articles/[slug]` is here because an article body is a public page too — it printed
 * "write to …" until this card.
 */
const PUBLIC_COPY: ReadonlyArray<readonly [string, unknown]> = [
  ["/", homePageCopy],
  ["/pricing", pricingPageCopy],
  ["/support", supportPageCopy],
  ["/support/articles/[slug]", supportArticlePageCopy],
  ["/welcome", marketingPageCopy],
  ["/help", helpPageCopy],
  ["/privacy (alignsynch)", alignSynchLegal.privacy],
  ["/terms (alignsynch)", alignSynchLegal.terms],
  ["/privacy (quizhub)", quizHubLegal.privacy],
  ["/terms (quizhub)", quizHubLegal.terms],
  ["chrome (shell fixture)", shellPageCopy],
  ["articles (alignsynch)", alignSynchArticlesData],
  ["articles (quizhub)", articlesData],
];

describe("no public page carries an email address", () => {
  it.each(PUBLIC_COPY)("%s sweeps clean", (_route, copy) => {
    const text = words(copy).join("\n");
    expect(text).not.toMatch(ADDRESS);
    expect(text).not.toContain("mailto:");
  });

  it("keeps the two internal mailboxes on the record, where only the server reads them", () => {
    // The addresses still exist; they are recipients. This is the positive control: a sweep that
    // passes because the record went empty would prove nothing about `support@alignsynch.com`.
    expect(alignSynchBrand.supportEmail).toBe("support@alignsynch.com");
    expect(alignSynchBrand.affiliateEmail).toBe("hello@alignsynch.com");
    expect(quizHubBrand.supportEmail).toBe("quizhub@riolabs.ai");
    // And the loop is not run over an empty model.
    for (const surface of [helpPageCopy, supportPageCopy, pricingPageCopy, shellPageCopy]) {
      expect(words(surface).length).toBeGreaterThan(3);
    }
  });
});

describe("the one contact form", () => {
  const form = sectionOf(helpPageCopy, "form");
  const html = renderToStaticMarkup(
    createElement(ContactForm, { copy: form, startedAt: 1_700_000_000_000 }),
  );

  it("posts to the contact endpoint as a plain HTML form", () => {
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/contact"');
    expect(html).toContain('type="submit"');
  });

  it("carries exactly the three fields the card names, plus hidden plumbing", () => {
    const names = [...html.matchAll(/name="([^"]+)"/g)].map((match) => match[1]);
    // The honeypot and the render instant are hidden inputs, not fields a person fills.
    expect(names.filter((name) => name !== "website" && name !== "startedAt")).toEqual([
      "name",
      "email",
      "message",
    ]);
    expect(html).toContain('id="name"');
    expect(html).toContain('id="email"');
    expect(html).toContain('id="message"');
    expect(html).toMatch(/<textarea[^>]*id="message"/);
  });

  it("has no captcha and no third-party widget", () => {
    expect(html).not.toMatch(/captcha|recaptcha|hcaptcha|turnstile/i);
    expect(html).not.toContain("<script");
    expect(html).not.toContain("gstatic");
    expect(html).not.toContain('type="file"');
  });

  it("keeps the honeypot out of the tab order and out of the accessibility tree", () => {
    const honeypot = /<div[^>]*class="hidden"[^>]*>([\s\S]*?)<\/div>/.exec(html);
    expect(honeypot, "the honeypot wrapper is gone").not.toBeNull();
    expect(honeypot?.[0]).toContain('aria-hidden="true"');
    expect(honeypot?.[1]).toContain('name="website"');
    expect(honeypot?.[1]).toContain('tabindex="-1"');
  });

  it("names no example address in a placeholder", () => {
    // The old form's `your.email@example.com` was the defect this rule is about, spelled as an
    // `example.com` string on a public page.
    expect(html).not.toMatch(ADDRESS);
  });

  it("carries the render instant the minimum-fill rule reads", () => {
    expect(html).toContain('name="startedAt"');
    expect(html).toContain('value="1700000000000"');
  });
});

describe("the contact section", () => {
  const render = (state?: (typeof CONTACT_STATES)[number]) =>
    renderToStaticMarkup(
      createElement(ContactSection, { copy: helpPageCopy, state, startedAt: 1_700_000_000_000 }),
    );

  /**
   * The card's "one `<form`, one `type="email"`" as a property of *this* band.
   *
   * The page carries a second form and that is not a defect: the footer's news signup mounts on
   * every marketing route (#446, `components/layout/news-signup.tsx`) and `/help` is a marketing
   * route. The contact rule is about the contact surface — one form, one reply field, no captcha —
   * and the footer band is a different surface with its own acceptance. Asserting the *page* total
   * would fail on a card this one does not own; asserting the band keeps the rule checkable, and
   * `tests/shell-empty-links.test.ts` holds the footer's form to its own one-email-field claim.
   */
  it("is one form with one reply field and no captcha", () => {
    const html = render();
    expect((html.match(/<form\b/g) ?? []).length).toBe(1);
    expect((html.match(/type="email"/g) ?? []).length).toBe(1);
    expect(html).not.toMatch(/captcha|recaptcha|hcaptcha|turnstile/i);
  });
  it("renders the form and no outcome band on a plain visit", () => {
    const html = render();
    expect(html).toContain('action="/api/contact"');
    expect(html).not.toContain('role="status"');
    expect(html).not.toMatch(ADDRESS);
    expect(html).not.toMatch(/captcha/i);
  });

  it("has a sentence for every state the route can answer", () => {
    const states = sectionOf(helpPageCopy, "states");
    const ids = new Set((states.items ?? []).map((item) => item.id));
    for (const state of CONTACT_STATES) expect(ids.has(state), `no copy for "${state}"`).toBe(true);
  });

  it("tells a stored-but-unsent message apart from a sent one", () => {
    // The card's honesty rule, as two sentences that must not be the same sentence.
    const sent = render("sent");
    const received = render("received");
    expect(sent).toContain("Message sent");
    expect(received).toContain("Message received");
    expect(received).not.toContain("Message sent");
    // "Received" may not claim a send; it says the message is saved.
    expect(received).toContain("saved");
  });

  it("says nothing reached us when the store failed, and never fakes a confirmation", () => {
    const failed = render("failed");
    expect(failed).toContain("Not saved");
    expect(failed).toContain("not saved");
    expect(failed).not.toContain("Thank you");
  });

  it("ignores a hand-typed state it does not know", () => {
    // `contactStateOf` narrows the query; the page is handed `undefined` for anything else.
    const html = render(undefined);
    expect(html).not.toContain('role="status"');
  });
});
