/**
 * **Stage 5 draws the invitee's side of the send** — the reference's *What {name} Sees* panel.
 *
 * `docs/specs/v2-rectification.md` records this delta twice: stage 5's row says the live page drew
 * **What you can do later** and no invitee-facing preview, and `guides/initiator/send-the-invite.md`
 * tells the reader to check that preview before pressing send. A sender is deciding what a second
 * person will read, so the panel is not decoration — it is the decision the stage exists for.
 *
 * Three things are pinned, each one a way the panel rots:
 *
 *   the heading  it names the Counterparty from the draft, and falls back to the unnamed form when
 *                Stage 1 has not filled a name in — the same pairing the wizard rail's Align
 *                sentences use (`wizard.align-note` / `align-note-unnamed`).
 *   the facts    the three the invitation actually carries — from whom, about what, to which
 *                address — read off the draft and never off a fixture.
 *   the copy     every word comes from `data/pages/assessment-create.ts`, and the panel does not
 *                restate the email's own subject or body: those live in `lib/email/templates/`,
 *                and a preview that spelled them again is the copy that drifts first.
 *
 * Rendered with `renderToStaticMarkup`, like the rest of the flow's tests: no database, no server,
 * no session, no clock.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT, type CreateDraft } from "@/lib/flow/create-draft";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const INVITE = sectionOf(assessmentCreatePageCopy, "invite");

const TEMPLATE = {
  slug: "brother-a-brother-b",
  recordId: "assessment-brother",
  title: "Brother A-Brother B",
  summary: "Five Aspects about how the two of them work.",
  aspectCount: 5,
};

const FILLED: CreateDraft = {
  ...EMPTY_CREATE_DRAFT,
  initiatorFirst: "Daniel",
  initiatorLast: "Mercer",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Hale",
  email: "rowan@example.com",
  title: "Staying Close Through Busy Seasons",
};

function stage5(draft: CreateDraft): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 5,
      template: TEMPLATE,
      draft,
      aspects: [{ id: "aspect-1", prompt: "Aspect One", leftValue: "Low", rightValue: "High" }],
      backHref: "/back",
      problem: null,
      sessionRecordId: "assessment-instance-brother",
      relationshipId: "relationship-brother",
      trialEndsAt: "2026-11-23T12:00:00.000Z",
    }),
  );
}

describe("stage 5 draws what the Counterparty opens", () => {
  it("heads the panel with the Counterparty's own name", () => {
    const html = stage5(FILLED);
    expect(html).toContain(fillLabel(itemLabel(INVITE, "preview-heading"), { name: "Rowan" }));
    expect(html).not.toContain(itemLabel(INVITE, "preview-heading-unnamed"));
  });

  it("states the three facts the invitation carries, read off the draft", () => {
    const html = stage5(FILLED);
    expect(html).toContain(fillLabel(itemLabel(INVITE, "preview-from"), { name: "Daniel" }));
    expect(html).toContain(
      fillLabel(itemLabel(INVITE, "preview-title"), { title: FILLED.title.trim() }),
    );
    expect(html).toContain(fillLabel(itemLabel(INVITE, "preview-to"), { email: FILLED.email }));
  });

  it("falls back to the unnamed heading and a dash on an empty draft", () => {
    const html = stage5(EMPTY_CREATE_DRAFT);
    expect(html).toContain(itemLabel(INVITE, "preview-heading-unnamed"));
    /* The review section's own dash — a blank row is worse than a dash (the copy file's rule). */
    expect(html).toContain(itemLabel(sectionOf(assessmentCreatePageCopy, "review"), "none"));
  });

  it("does not restate the email's subject or body", () => {
    const html = stage5(FILLED);
    /* The panel carries the facts, never a second copy of the message. */
    expect(html).not.toContain("invited you to align on");
    expect(html).toContain(itemLabel(INVITE, "preview-body"));
  });
});
