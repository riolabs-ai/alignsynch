// @vitest-environment node
/**
 * **The send waits for money** (#911) — stage 5's gate, drawn in both states.
 *
 * The card's "doomed if" is one sentence: *the walk is drawn but the send can fire without payment*.
 * There are two places that could be true, and this file pins both halves of the UI:
 *
 *   unpaid   the right column is inactive (`data-send-gate="locked"`), the send is `disabled`, and
 *            the sentence beside it says what unlocks it — a greyed control with no reason is the
 *            thing the owner's bar names.
 *   paid     the column activates, the control enables, and its label is the owner's sentence:
 *            `send email to counterparty now`.
 *
 * The server half lives in `lib/flow/store.ts::sendDraftInvitation()` — a relationship with no
 * `method_captured_at` is refused `no-payment-method` there, so the gate is not only a disabled
 * attribute. That half needs a database to exercise, so it is asserted by `pnpm flow:e2e` against a
 * live branch; this file is what `pnpm test` can prove with no connection.
 *
 * `StageInvite` is a client component that owns the gate's state, so it is rendered through
 * `CreateRelationship` — the same tree the route renders — rather than in isolation.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT, type CreateDraft } from "@/lib/flow/create-draft";
import { itemLabel, sectionOf } from "@/lib/page-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE = {
  slug: "brother-a-brother-b",
  recordId: "assessment-brother",
  title: "Brother A-Brother B",
  summary: "Five Aspects about how the two of them work.",
  aspectCount: 5,
};

const DRAFT: CreateDraft = {
  ...EMPTY_CREATE_DRAFT,
  initiatorFirst: "Daniel",
  initiatorLast: "Vance",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Mercer",
  email: "rowan@example.com",
  title: "Quarterly check-in",
  mode: "basic",
  alignmentSetting: "soft",
};

const INVITE = sectionOf(assessmentCreatePageCopy, "invite");

/** The stage, at one gate state. `paid` is the returning state — a card is already on file. */
function stage(paid?: boolean): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 5,
      template: TEMPLATE,
      draft: DRAFT,
      backHref: "/back",
      instanceRecordId: "assessment-instance-brother",
      problem: null,
      ...(paid === undefined ? {} : { initialPaid: paid }),
    }),
  );
}

describe("stage 5 — the send is gated by the walk", () => {
  it("is locked and disabled while the walk is unfinished", () => {
    const html = stage(false);
    expect(html).toContain('data-send-gate="locked"');
    expect(html).toContain('data-send-explain="locked"');
    // The control is present — disabled, not absent — and carries the owner's sentence.
    expect(html).toContain(itemLabel(INVITE, "submit"));
    expect(html).toMatch(/data-send-confirm="disabled"/);
    expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>send email to counterparty now</);
  });

  it("activates, and enables the send, once the card is on file", () => {
    const html = stage(true);
    expect(html).toContain('data-send-gate="open"');
    expect(html).toContain('data-send-explain="open"');
    expect(html).toContain(itemLabel(INVITE, "active"));
    expect(html).toMatch(/data-send-confirm="enabled"/);
    expect(html).not.toMatch(/<button[^>]*\sdisabled=""[^>]*>send email to counterparty now</);
  });

  it("explains the disabled control, and points the control at the explanation", () => {
    const html = stage(false);
    // The sentence is in the same card as the control's form, in the same words the stage ships.
    expect(html).toContain(itemLabel(INVITE, "locked"));
    // …and the button names it, so the reason is announced with the control (owner's bar, item 3).
    expect(html).toMatch(/aria-describedby="[^"]+"/);
  });

  it("always offers the draft, in both states, and never disables it", () => {
    for (const html of [stage(false), stage(true)]) {
      expect(html).toContain('data-create-keep-draft="true"');
      expect(html).toContain(itemLabel(INVITE, "draft"));
      expect(html).not.toMatch(/data-create-keep-draft="true"[^>]*\baria-disabled\b/);
    }
  });

  it("keeps the send behind the server's own refusal, not only a disabled attribute", () => {
    // The UI half is a courtesy; the rule is in the write. Read the source the gate ships.
    const store = readFileSync(join(process.cwd(), "lib/flow/store.ts"), "utf8");
    expect(store).toContain('code: "no-payment-method"');
    expect(store).toMatch(/methodCaptured === null/);
  });
});
