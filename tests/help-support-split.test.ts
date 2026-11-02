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
import { KnowledgeBase } from "@/components/support/knowledge-base";
import { isValidRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import { helpPageCopy } from "@/data/pages/help";
import { supportPageCopy } from "@/data/pages/support";
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
  it("renders the FAQ and the knowledge base, and no contact form", async () => {
    const html = await htmlOf(() => HelpPage());

    // Both panels' chrome is present — the FAQ band by default, and the knowledge-base tab.
    expect(html).toContain(sectionOf(helpPageCopy, "faqs").heading ?? "");
    expect(html).toContain(sectionOf(helpPageCopy, "knowledge-base").heading ?? "");
    expect(html).toContain(sectionOf(helpPageCopy, "human").cta?.label ?? "");

    // The absence is the claim: no form element, and none of the contact form's field names.
    expect(html).not.toContain("<form");
    for (const field of ["name", "email", "subject", "message"]) {
      expect(html).not.toContain(`id="${field}"`);
    }
    expect(html).not.toContain(sectionOf(supportPageCopy, "contact").heading ?? "");
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

describe("the account support page", () => {
  it("redirects a request with no session to /help — not to /login, not to a 404", async () => {
    session.user = null;
    await expect(SupportPage()).rejects.toThrow("NEXT_REDIRECT:/help");
  });

  it("renders the form for a member, with the honest state line beside the submit control", async () => {
    session.user = { userId: "user_e2e" };
    const html = await htmlOf(() => SupportPage());

    // The five fields the page has always rendered, by the ids the labels point at.
    for (const field of ["name", "email", "subject", "message"]) {
      expect(html).toContain(`id="${field}"`);
    }
    expect(html).toContain(itemLabel(sectionOf(supportPageCopy, "contact"), "submit"));

    // The honest line, printed next to the control it describes, and named by that control so the
    // reason is announced rather than merely painted.
    const note = itemLabel(sectionOf(supportPageCopy, "contact"), "submit-note");
    expect(html).toContain(note);
    expect(html).toMatch(/<button[^>]*disabled[^>]*aria-describedby="support-submit-note"/);
    expect(html).toContain('id="support-submit-note"');

    // And the banner that says where to write instead, with the brand's own address in it.
    expect(html).toContain("mailto:");

    // The auxiliary bands the card asked for.
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
