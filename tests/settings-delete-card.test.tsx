/**
 * The delete-account control, as `/settings` actually draws it (`t_31f95f36`, #278).
 *
 * The card's acceptance has a clause a source read cannot settle: **the control appears in the
 * settings screen.** Everything else about it is pinned elsewhere — `tests/account-deletion-copy
 * .test.ts` holds the words to §5 and the retention line to §6, `tests/delete-account-action.test.ts`
 * holds the session and phrase gates, `tests/account-purge.test.ts` and the live matrix hold the
 * deletion itself. What none of them shows is a person's screen carrying the control at all, and a
 * sentence describing a mechanism that no route renders was the exact bug §5 was written against.
 *
 * Static markup, the way `tests/admin-relationship-screen.test.tsx` reads its screens:
 * `SettingsView` is a client component but draws its initial state, so `renderToStaticMarkup` is the
 * screen. `next/link` becomes an anchor and `useRouter` a pair of spies — the only Next runtime the
 * markup needs, and the only thing this file is not testing.
 *
 * The phrases asserted are read from the fixture, not typed here: a copy edit moves the assertions
 * with it, and the one thing this file decides is that they reach the markup.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => "/settings",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

import { SettingsView } from "@/components/identity/settings-view";
import { settingsPageCopy } from "@/data/pages/settings";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

const deletion = sectionOf(settingsPageCopy, "deletion");
const phrase = itemLabel(deletion, "confirm-phrase");

function render(): string {
  return renderToStaticMarkup(
    createElement(SettingsView, {
      copy: settingsPageCopy,
      email: "person@example.test",
      signedInName: "Person",
      profile: null,
      hasPassword: false,
      savePassword: async () => ({ kind: "saved" }) as never,
      deleteAccount: async () => ({ kind: "deleted" }) as never,
    }),
  );
}

describe("/settings draws the delete control", () => {
  const html = render();

  it("carries the §5 sentence on the page, not just in the fixture", () => {
    const body = sectionOf(settingsPageCopy, "deletion").body ?? "";
    expect(html).toContain("immediate and irreversible");
    // The fixture's body arrives whole: a card that rendered a truncated sentence would still pass a
    // substring check, so the last clause is asserted too.
    expect(html).toContain("Deletion cannot be undone and there is no grace period.");
    expect(body.length).toBeGreaterThan(400);
  });

  it("renders the confirmation phrase a person has to type", () => {
    // The label interpolates the phrase the server compares against — one string, both sides.
    expect(html).toContain(fillLabel(itemLabel(deletion, "confirm-label"), { phrase }));
    expect(html).toContain(`name="confirmation"`);
    expect(html).toContain(`id="delete-confirmation"`);
    expect(html).toContain(`autoComplete="off"`);
  });

  it("renders the submit control and the retention line beside it", () => {
    expect(html).toContain(itemLabel(deletion, "submit"));
    expect(html).toContain(itemLabel(deletion, "retained"));
    expect(html).toContain('type="submit"');
  });

  it("starts idle — no outcome sentence, and nothing submitted", () => {
    for (const kind of ["deleted", "mismatch", "unauthorized", "not-found", "unavailable"]) {
      expect(html).not.toContain(itemLabel(deletion, `outcome-${kind}`));
    }
    expect(push).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
