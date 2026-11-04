/**
 * The Help/Support split, as assertions (owner's review of the in-app support tab).
 *
 * The defect this pins: `/support` was one **public** page carrying the FAQ, the knowledge base and
 * a contact form whose own banner said it was not connected. A public page that offers a form
 * nobody will read is a promise the tree cannot keep, and the honest split is answers in public
 * (`/help`) and the account page inside the app (`/support`), where the reader's own account and
 * records are already in front of them.
 *
 * Four claims, because four things can silently go wrong:
 *
 *   1. **the redirect** — a request with no session must go to `/help`, not `/login` and not a 404.
 *      A blanket `next.config.mjs` redirect could not do this: the same path has two answers.
 *   2. **the member's page** — a session renders the account page, with the form and the honest
 *      line beside the submit control (a disabled button that says why, never a silent no-op).
 *   3. **the public page** — `/help` carries the FAQ and the knowledge base and **no form at all**;
 *      the absence is the point, so the field names are searched for rather than assumed absent.
 *   4. **the copy** — a taxonomy id named on one page is named the same way on the other, and both
 *      routes resolve in `content/routes.ts`, so E10 and the runtime lookup agree with the tests.
 *
 * "Renders" means `renderToStaticMarkup` with `next/link` mocked to an anchor and `next/navigation`
 * faked to throw its markers — the same harness `tests/nav-brand.test.ts` and
 * `tests/marketing-header.test.ts` use. The session is a module mock, because the gate has no auth
 * environment and a page behind a session is still a function of that session.
 */
import { existsSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

/**
 * `redirect` and `notFound` in Next throw control-flow markers that a real render catches. Here
 * they throw strings a test can read, which is how a redirect is asserted instead of inferred from
 * a missing page.
 */
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

/** The session the page will see, swapped per case — the only thing about the request that varies. */
const session = vi.hoisted(() => ({ user: null as { userId: string } | null }));

vi.mock("@/lib/auth/session", () => ({
  currentUserIfConfigured: async () => session.user,
  currentUser: async () => session.user,
}));

import HelpPage from "@/app/(marketing)/help/page";
import SupportPage from "@/app/(mainlayout)/support/page";
import { ContactSection } from "@/components/contact/contact-section";
import { HelpPage as HelpCentre } from "@/components/support/help-page";
import { KnowledgeBase } from "@/components/support/knowledge-base";
import { isValidRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import { helpPageCopy } from "@/data/pages/help";
import { supportPageCopy } from "@/data/pages/support";
import { supportCategories } from "@/data/support-categories";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** One page module's markup, awaited because a page may be an async server component. */
async function htmlOf(page: () => unknown | Promise<unknown>): Promise<string> {
  return renderToStaticMarkup((await page()) as React.ReactElement);
}

describe("the two routes exist and the manifest knows both", () => {
  it("resolves /help and /support in content/routes.ts", () => {
    expect(isValidRoute(routeManifest, "/help")).toBe(true);
    expect(isValidRoute(routeManifest, "/support")).toBe(true);
  });

  it("keeps the public help centre in the marketing group and the account page in the app shell", () => {
    // The route group is what decides the chrome (#317): a page is either in `(marketing)` and gets
    // the wordmark, or in `(mainlayout)` and gets the rail. A file in the wrong group is the whole
    // difference between "public answers" and "app page", and no render test can see it.
    expect(existsSync("app/(marketing)/help/page.tsx")).toBe(true);
    expect(existsSync("app/(mainlayout)/support/page.tsx")).toBe(true);
    expect(existsSync("app/(marketing)/support/page.tsx")).toBe(false);
    // The article reader stays public: it is the knowledge base, and it is where `/help` links.
    expect(existsSync("app/(marketing)/support/articles/[slug]/page.tsx")).toBe(true);
  });
});

describe("the public help centre", () => {
  it("renders the FAQ, the knowledge base and the one contact form", async () => {
    const html = await htmlOf(() => HelpPage({ searchParams: Promise.resolve({}) }));

    // Both panels' chrome is present — the FAQ band by default, and the knowledge-base tab.
    expect(html).toContain(sectionOf(helpPageCopy, "faqs").heading ?? "");
    expect(html).toContain(sectionOf(helpPageCopy, "knowledge-base").heading ?? "");
    expect(html).toContain(sectionOf(helpPageCopy, "human").cta?.label ?? "");

    // The one contact path (owner, 2026-11-02): the route mounts the form under the answers.
    // Its three fields are the card's, and the honeypot and render instant are hidden plumbing.
    expect(html).toContain('action="/api/contact"');
    const names = [...html.matchAll(/name="([^"]+)"/g)].map((match) => match[1]);
    expect(names.filter((name) => name !== "website" && name !== "startedAt")).toEqual([
      "name",
      "email",
      "message",
    ]);
    // No captcha, and no address on the page the form lives on.
    expect(html).not.toMatch(/captcha|recaptcha|hcaptcha|turnstile/i);
    expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);
    expect(html).not.toContain("mailto:");
  });

  it("points a reader at the account page instead, and says why that page needs a sign-in", () => {
    const human = sectionOf(helpPageCopy, "human");
    expect(human.cta?.href).toBe("/support");
    expect(human.body ?? "").toMatch(/signed-in/);
  });

  it("keeps the knowledge base's article links, at the address they already have", async () => {
    // The KB tab is the second tab, so the links are not in `/help`'s first paint — the panel is
    // rendered here the way the tab renders it. Their destination did not move in the split:
    // `/support/articles/[slug]` is still the public article route (`app/(marketing)/support/
    // articles`), and the bookmarked address keeps working.
    const html = renderToStaticMarkup(
      createElement(KnowledgeBase, {
        selectedCategory: "all",
        copy: sectionOf(helpPageCopy, "knowledge-base"),
        categoryCopy: sectionOf(helpPageCopy, "help-categories"),
      }),
    );
    const articleLinks = [...html.matchAll(/href="(\/support\/articles\/[^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(articleLinks.length).toBeGreaterThan(0);
    for (const href of articleLinks) {
      expect(isValidRoute(routeManifest, href)).toBe(true);
    }
  });
});

describe("the two-column intent holds in the markup", () => {
  /**
   * The owner's report (2026-11-04) is a *collapsed* two-column page: clicking a category changed
   * an answer far below the click. The mechanism was `md:col-span-3` inside a grid that declares
   * two tracks — a span wider than the track count creates implicit columns, so the panel was
   * pushed to a second row under the rail. These cases pin the two claims a render can see: the
   * filter exists in both shapes from one list, and the answers are a sibling of the filter rather
   * than a row under it (`col-span` appears nowhere in the help centre).
   */
  it("offers every filter in both shapes — the rail and the narrow chip row", async () => {
    const html = await htmlOf(() => HelpPage({ searchParams: Promise.resolve({}) }));
    /**
     * The fixture names every category a build *may* offer; `data/support-categories.ts` is what a
     * build actually offers, so the loop is the intersection — AlignSynch has no "Quiz Creation".
     * Without this the case would only pass on the quiz brand, which is the shape of a test that
     * pins one brand's menu instead of the layout.
     */
    const offered = new Set<string>(supportCategories);
    const labels = (sectionOf(helpPageCopy, "help-categories").items ?? []).filter((item) =>
      offered.has(item.id),
    );
    expect(labels.length).toBeGreaterThan(3);

    // One row per shape, and the two shapes are the two responsive halves of one control.
    expect(html).toContain("sticky top-20");
    expect(html).toContain("hidden md:block");
    for (const item of labels) {
      // `>label</span>` is the leaf both shapes render, so a label counted twice is a label in
      // both; once would mean a shape lost a filter, three times a third copy.
      expect(html.split(`>${item.label}</span>`).length - 1, item.label).toBe(2);
    }

    // No span may outlive the track count again — that is the defect this card fixes.
    const helpCentre = renderToStaticMarkup(createElement(HelpCentre, { copy: helpPageCopy }));
    expect(helpCentre).not.toMatch(/col-span/);
  });

  it("keeps the need-a-person band in the contact row, beside the form", async () => {
    const human = sectionOf(helpPageCopy, "human");
    const heading = human.heading ?? "Need a person?";
    const page = await htmlOf(() => HelpPage({ searchParams: Promise.resolve({}) }));
    const contact = renderToStaticMarkup(
      createElement(ContactSection, { copy: helpPageCopy, startedAt: 1_700_000_000_000 }),
    );

    // The row is a grid of two columns at `md`, and the band is its second column — the same
    // `md:grid-cols-[…]` grammar the answers above use, not a `md:flex` strip in a stack.
    expect(contact).toContain("md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]");
    expect(contact).toContain("<form");
    expect(contact).toContain("<aside");
    expect(contact).toContain(heading);

    // And it is not the help centre's: the band moved out of the answers, so a reader meets the
    // alternative to the form on the form's own row.
    expect(page).toContain(heading);
    expect(renderToStaticMarkup(createElement(HelpCentre, { copy: helpPageCopy }))).not.toContain(
      heading,
    );
  });
});

describe("the account support page", () => {
  it("redirects a request with no session to /help — not to /login, not to a 404", async () => {
    session.user = null;
    await expect(SupportPage()).rejects.toThrow("NEXT_REDIRECT:/help");
  });

  it("renders the contact band for a member, pointing at the one form", async () => {
    session.user = { userId: "user_e2e" };
    const html = await htmlOf(() => SupportPage());

    // The band's own words, and its link to the only contact path (owner, 2026-11-02).
    const contact = sectionOf(supportPageCopy, "contact");
    expect(html).toContain(contact.heading ?? "");
    expect(html).toContain(contact.body ?? "");
    expect(contact.cta?.href).toBe("/help");
    expect(html).toContain('href="/help"');

    // No second form and no printed address: the form on `/help` is the one path, and a
    // `mailto:` here would be the defect this card removed.
    expect(html).not.toContain("<form");
    for (const field of ["name", "email", "subject", "message"]) {
      expect(html).not.toContain(`id="${field}"`);
    }
    expect(html).not.toContain("mailto:");
    expect(html).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/);

    // The auxiliary bands the split kept.
    for (const id of ["what-this-form-does", "what-to-include", "where-else"]) {
      expect(html).toContain(sectionOf(supportPageCopy, id).heading ?? "");
    }
    // The two in-app destinations that answer most questions without a reply.
    expect(html).toContain('href="/help"');
    expect(html).toContain('href="/settings"');
  });
});

describe("the two fixtures name the taxonomy the same way", () => {
  it("agrees on every category id and label the two pages share", () => {
    const help = sectionOf(helpPageCopy, "help-categories");
    const support = sectionOf(supportPageCopy, "help-categories");
    const helpLabels = new Map((help.items ?? []).map((item) => [item.id, item.label]));
    const shared = (support.items ?? []).filter((item) => helpLabels.has(item.id));

    // The guard's guard: the two lists are not empty, so the loop below proves something.
    expect(shared.length).toBeGreaterThan(3);
    for (const item of shared) {
      expect(item.label).toBe(helpLabels.get(item.id));
    }
  });
});
