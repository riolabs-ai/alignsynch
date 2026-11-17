/**
 * `/settings` in the v2 visual system (#1136, bundle 11).
 *
 * The issue's second acceptance line is "Settings saves the name and email, and changes the
 * password", and the interesting half of that sentence is the part a screenshot hides:
 *
 *   - **the name saves** — the Profile form is still one `POST /api/profile` and its button is the
 *     bundle's "Save Profile";
 *   - **the email does not** — it belongs to Neon's managed auth, so the field is a value, not an
 *     input. A test that only looked for the word "Email" would pass with an editable input that
 *     can only fail; this one asserts there is no email *control*;
 *   - **the password changes** — through the same session-authorised grant, under the bundle's
 *     "Update Password".
 *
 * It also pins the one section this card does **not** draw. Bundle 11 measures a Notifications card
 * with three switches; the app stores no notification preference, and #1136 forbids adding settings
 * fields upstream does not support, so the section is absent — and asserted absent, so the card
 * that adds the storage has to change this file rather than discover the gap later.
 *
 * Static markup, like `tests/settings-delete-card.test.tsx`: the view draws its initial state.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/settings",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

import { SettingsView } from "@/components/identity/settings-view";
import { settingsPageCopy } from "@/data/pages/settings";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/** The page as `/settings` mounts it for a signed-in person with a password. */
function render(): string {
  return renderToStaticMarkup(
    createElement(SettingsView, {
      copy: settingsPageCopy,
      email: "person@example.test",
      signedInName: "Marcus Reyes",
      profile: null,
      hasPassword: true,
      savePassword: async () => ({ kind: "set" }) as never,
      deleteAccount: async () => ({ kind: "deleted" }) as never,
      brandId: "alignsynch",
    }),
  );
}

/** The <h1> and <h2> the page draws, in document order. */
function headings(html: string): string[] {
  return [...html.matchAll(/<h([12])[^>]*>(.*?)<\/h\1>/g)].map((match) =>
    match[2].replace(/<[^>]*>/g, "").trim(),
  );
}

describe("/settings draws bundle 11's page", () => {
  const html = render();

  it("opens on the bundle's H1 and purpose line, with the person named above them", () => {
    expect(headings(html)[0]).toBe("Account Settings");
    expect(html).toContain(settingsPageCopy.heading);
    expect(html).toContain(settingsPageCopy.subtitle ?? "");
    // The eyebrow is the session's own name, not a fixture person.
    expect(html).toContain(
      fillLabel(itemLabel(sectionOf(settingsPageCopy, "eyebrow"), "name"), {
        name: "Marcus Reyes",
      }),
    );
    // One h1, as the accessibility checklist asks: every other band is an h2.
    expect(html.match(/<h1[^>]*>/g)?.length).toBe(1);
  });

  it("draws the sections in the bundle's order", () => {
    const sectionHeading = (id: string) => sectionOf(settingsPageCopy, id).heading;
    // Read the order directly, so a reorder is a failure with the real sequence in the diff.
    expect(headings(html).slice(1)).toEqual([
      sectionHeading("identity"),
      sectionHeading("password"),
      sectionHeading("session"),
      sectionHeading("deletion"),
    ]);
  });

  it("saves the name with the bundle's own button", () => {
    expect(html).toContain(itemLabel(sectionOf(settingsPageCopy, "identity"), "save"));
    expect(html).toContain('id="display-name"');
    expect(html).toContain('id="handle"');
    // A form that posts itself, not a dead button: the same form `/api/profile` already had.
    expect(html).toContain("<form");
  });

  it("draws the email as a value, never as a control the app cannot write", () => {
    expect(html).toContain("person@example.test");
    expect(html).toContain(itemLabel(sectionOf(settingsPageCopy, "account"), "email-hint"));
    // No input carries the address: an editable field would promise a write Managed Auth owns.
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('name="email"');
  });

  it("changes the password under the bundle's label, with no current-password field", () => {
    expect(html).toContain(itemLabel(sectionOf(settingsPageCopy, "password"), "submit-set"));
    expect(html).toContain('autoComplete="new-password"');
    // The session is the proof; asking for the old secret would be a field read and discarded.
    expect(html).not.toContain('autoComplete="current-password"');
  });

  it("names the session and offers Sign Out as an outline button", () => {
    const session = sectionOf(settingsPageCopy, "session");
    expect(html).toContain(fillLabel(session.body ?? "", { name: "Marcus Reyes" }));
    expect(html).toContain(itemLabel(session, "sign-out"));
    // No red anywhere on the surface (locked rule 4) — the sign-out control is not destructive.
    expect(html).not.toMatch(/text-red|bg-red|text-rose|bg-rose|text-destructive|bg-destructive/);
  });

  it("does not draw a Notifications section while the app stores no preference", () => {
    // Bundle 11 measures one; #1136 forbids the field until upstream supports it. The card that
    // adds the storage deletes this assertion on purpose.
    expect(html).not.toMatch(/Notifications/);
    expect(html).not.toContain('role="switch"');
  });
});
