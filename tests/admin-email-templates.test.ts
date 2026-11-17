/**
 * `/admin/email-templates` (#1138) — the rail row, the gates, and what the two screens draw.
 *
 * Eight claims, each mapping to a line the issue states:
 *
 *   1. **The row is in `group-admin`, directly after the two reference rows**, labelled "Email
 *      Templates", gated on `admin` — so a `support` seat does not see it (#1138 "Admin rail and
 *      page").
 *   2. **Both routes are in the manifest**, so a literal `href` to either resolves under E10 and a
 *      visitor who types the address gets the page rather than a 404.
 *   3. **The gates run in `/admin/docs` order and the pages are request-time** — the capability
 *      before the role, and `force-dynamic`, because the session and the version table are
 *      per-request and `pnpm build` must pass with no database.
 *   4. **The register is the list**: every member-facing template is a row, and the operator's own
 *      release note is not.
 *   5. **The list draws what it was given** — a state per row, a second badge when a draft is
 *      waiting behind a published override, and the failure panel instead of the table when the read
 *      did not answer.
 *   6. **The editor draws the issue's controls and no others**: three fields, the template's own
 *      placeholder chips, the four buttons, and the version history.
 *   7. **Every word comes from the fixture** — the two routes are at budget 0 in
 *      `data/pages/budget.ts`, and `data:check` E23 is what enforces it; this file asserts the row
 *      exists so the number is not quietly dropped.
 *   8. **The rail's label is the owner's**, and the row is not the placeholder that `shell.ts` would
 *      have to invent.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { adminEmailTemplatesPageCopy } from "@/data/pages/admin-email-templates";
import {
  EmailTemplateEditor,
  type EmailTemplateEditorViewProps,
} from "@/components/admin/email-templates/email-template-editor";
import { EmailTemplateRegistry } from "@/components/admin/email-templates/email-template-registry";
import { memberFacingTemplates } from "@/lib/admin/email-templates";
import type { EmailTemplateListRow } from "@/lib/admin/email-templates";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path: string): string => readFileSync(`${ROOT}${path}`, "utf8");

interface NavRow {
  readonly id: string;
  readonly href: string;
  readonly icon: string;
  readonly needs: string;
  readonly note?: string;
}

const navMenu = JSON.parse(read("data/nav-menu.json")) as {
  readonly groups: readonly { readonly id: string; readonly items: readonly NavRow[] }[];
};

const adminGroup = navMenu.groups.find((group) => group.id === "group-admin");
const adminRows = adminGroup?.items ?? [];

describe("the rail row", () => {
  it("sits in the Admin group, directly after the two reference rows", () => {
    const ids = adminRows.map((row) => row.id);
    const position = ids.indexOf("admin-email-templates");
    expect(position).toBeGreaterThan(0);
    // #1138: "immediately after `admin-docs` (after `admin-permissions` if #1126 has already
    // landed)". It has — the row is on `main` — so the order is docs, permissions, email templates.
    expect(ids[position - 1]).toBe("admin-permissions");
    expect(ids[position - 2]).toBe("admin-docs");
  });

  it("is admin-only, and points at the register", () => {
    const row = adminRows.find((candidate) => candidate.id === "admin-email-templates");
    expect(row).toBeDefined();
    expect(row?.href).toBe("/admin/email-templates");
    expect(row?.needs).toBe("admin");
    // A `support` seat does not see `needs: admin` rows (`lib/nav-menu.ts::menuFor`).
    expect(row?.icon).toBe("inbox");
  });

  it("carries the owner's label", () => {
    expect(read("data/pages/shell.ts")).toContain(
      '{ id: "admin-email-templates", label: "Email Templates" }',
    );
  });
});

describe("the routes", () => {
  it("both addresses are in the manifest", () => {
    const routes = read("content/routes.ts");
    expect(routes).toContain('"/admin/email-templates"');
    expect(routes).toContain('"/admin/email-templates/[id]"');
  });

  it("gates in /admin/docs order and is request-time", () => {
    for (const path of [
      "app/(mainlayout)/admin/email-templates/page.tsx",
      "app/(mainlayout)/admin/email-templates/[id]/page.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toContain('export const dynamic = "force-dynamic"');
      const capability = source.indexOf("requireAdminProduct()");
      const role = source.indexOf("await requireAdmin(");
      expect(capability, path).toBeGreaterThan(-1);
      expect(role, path).toBeGreaterThan(-1);
      // The capability closes first: a template that does not claim the console answers the 404 an
      // unknown URL gets, with no session read behind it (#509).
      expect(capability, path).toBeLessThan(role);
    }
  });

  it("is at budget 0 for both routes, so a literal in the components is a red build", () => {
    const budget = read("data/pages/budget.ts");
    expect(budget).toContain('"/admin/email-templates": {');
    expect(budget).toContain('"/admin/email-templates/[id]": {');
    expect(budget.match(/fixture: "data\/pages\/admin-email-templates"/g)).toHaveLength(2);
    const columns = read("data/surface-columns.ts");
    expect(columns).toContain('{ path: "/admin/email-templates", mode: "column" }');
    expect(columns).toContain('{ path: "/admin/email-templates/[id]", mode: "column" }');
  });
});

describe("the register", () => {
  it("is every member-facing template, and not the operator's release note", () => {
    const ids = memberFacingTemplates().map((template) => template.id);
    // The members' mails, in the register's own order — the issue's inventory minus the rows it
    // keeps off this page (`stakeholder-release-note`) and minus the ones it defers to a later
    // answer (the propose-change trio, the reminders, the extra week). The pause pair was deferred
    // here when #1138 was written; #1139 landed it (#12 and #13), so the two rows are in it now.
    expect(ids).toEqual([
      "counterparty-invitation",
      "invitation-reminder",
      "counterparty-joined",
      "gap-report-ready",
      "trial-ending",
      "membership-lapsed",
      "support-reply",
      "signup-confirmation",
      "purchase-confirmation",
      "relationship-expired",
      "trial-ended-paused",
      "relationship-paused",
    ]);
  });

  it("marks a body-less template as not editable rather than as an empty body", () => {
    const expired = memberFacingTemplates().find(
      (template) => template.id === "relationship-expired",
    );
    expect(expired?.body).toBeUndefined();
  });
});

describe("the list screen", () => {
  const rows: EmailTemplateListRow[] = [
    {
      id: "counterparty-invitation",
      numeral: 2,
      emailClass: "transactional",
      recipient: "counterparty",
      state: "published",
      pendingDraft: true,
      editable: true,
      lastEditedAt: "2026-11-10T12:00:00.000Z",
      lastEditedBy: "user-1",
    },
    {
      id: "trial-ending",
      numeral: 6,
      emailClass: "transactional",
      recipient: "initiator",
      state: "default",
      pendingDraft: false,
      editable: true,
      lastEditedAt: null,
      lastEditedBy: null,
    },
  ];

  it("draws a row per template, with both badges when a draft waits behind a publication", () => {
    const html = renderToStaticMarkup(
      createElement(EmailTemplateRegistry, {
        copy: adminEmailTemplatesPageCopy,
        rows,
        unreadable: null,
      }),
    );
    expect(html).toContain('data-email-template-row="counterparty-invitation"');
    expect(html).toContain('data-email-template-row="trial-ending"');
    expect(html).toContain('href="/admin/email-templates/counterparty-invitation"');
    // Published *and* draft on the same row: the send path is on the published words while an edit
    // waits, and a single badge would say "draft" and be wrong.
    expect(html).toContain("Published");
    expect(html).toContain("Draft");
  });

  it("draws the failure panel, never an empty list, when the read did not answer", () => {
    const html = renderToStaticMarkup(
      createElement(EmailTemplateRegistry, {
        copy: adminEmailTemplatesPageCopy,
        rows: [],
        unreadable: "connection refused",
      }),
    );
    expect(html).toContain('data-email-templates-unreadable="connection refused"');
    expect(html).not.toContain("<table");
  });
});

describe("the editor", () => {
  const view: EmailTemplateEditorViewProps = {
    id: "counterparty-invitation",
    numeral: 2,
    emailClass: "transactional",
    recipient: "counterparty",
    editable: true,
    placeholders: ["inviter", "counterparty", "template", "link"],
    defaultSubject: "Robin Vale invited you to a How We Make Decisions assessment",
    defaultPreheader: "Robin Vale invited Elena Marsh to answer How We Make Decisions.",
    defaultBody: "This is {{inviter}}'s invitation to answer {{template}}.",
    initialText: "This is Robin Vale's invitation.",
    initialHtml: "<p>This is Robin Vale's invitation.</p>",
    versions: [
      {
        id: "counterparty-invitation-v1",
        version: 1,
        status: "draft",
        subject: "A draft subject",
        preheader: "A draft preheader",
        body: "A draft body.",
        editorUserId: "user-1",
        createdAt: "2026-11-10T12:00:00.000Z",
      },
    ],
    draft: { subject: "A draft subject", preheader: "A draft preheader", body: "A draft body." },
  };

  const noopOutcome = vi.fn(async () => ({
    ok: true as const,
    templateId: view.id,
    versionId: "counterparty-invitation-v2",
  }));

  function renderEditor(overrides: Partial<EmailTemplateEditorViewProps> = {}): string {
    return renderToStaticMarkup(
      createElement(EmailTemplateEditor, {
        copy: adminEmailTemplatesPageCopy,
        view: { ...view, ...overrides },
        onSave: noopOutcome,
        onPublish: noopOutcome,
        onReset: noopOutcome,
        onTest: vi.fn(async () => ({ ok: true as const, outcome: "sent" as const })),
        onPreview: vi.fn(async () => ({
          ok: true as const,
          subject: "s",
          text: "t",
          html: "h",
          overridden: true,
        })),
      }),
    );
  }

  it("opens on the draft and says so", () => {
    const html = renderEditor();
    expect(html).toContain("data-email-template-source");
    expect(html).toContain("Draft — not in production");
    expect(html).toContain("A draft body.");
  });

  it("draws the three fields, the chips, the four actions and the history", () => {
    const html = renderEditor();
    expect(html).toContain('id="email-subject"');
    expect(html).toContain('id="email-preheader"');
    expect(html).toContain('id="email-body"');
    expect(html).toContain("data-email-template-chips");
    expect(html).toContain("{{inviter}}");
    for (const label of ["Save draft", "Publish", "Reset to Default", "Send Test"]) {
      expect(html, label).toContain(label);
    }
    expect(html).toContain('data-email-template-version="counterparty-invitation-v1"');
    expect(html).toContain("Restore to draft");
  });

  it("shows the default copy when nothing is stored, and no Publish is offered", () => {
    const html = renderEditor({ draft: undefined, versions: [] });
    expect(html).toContain("Default — nothing is published for this template");
    expect(html).toContain("No version yet");
    // Publish is disabled with no draft to publish: the write refuses `no-draft`, and the button
    // says so before the round trip.
    expect(html).toMatch(/disabled=""[^>]*>Publish/);
  });

  it("replaces the fields with the read-only panel for a body that lives in code", () => {
    const html = renderEditor({
      editable: false,
      defaultBody: null,
      placeholders: [],
      versions: [],
      draft: undefined,
    });
    expect(html).toContain("This body is not editable here");
    expect(html).not.toContain('id="email-body"');
    // The default is still shown: "opening one shows default copy" holds even where it cannot be
    // overridden.
    expect(html).toContain("This is Robin Vale&#x27;s invitation.");
  });
});
