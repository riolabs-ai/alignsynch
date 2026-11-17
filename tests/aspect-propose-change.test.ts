/**
 * #1133 — **no silent edits, once Stage 6 is live.**
 *
 * The issue's acceptance line is `pnpm vitest run tests/aspect-propose-change.test.ts`, and this
 * is that file: it pins the rule the proposal flow exists to honour, from the two ends that can be
 * proved without a database.
 *
 *   the lock     `aspectsEditable()` answers `draft` and `pending` only, so a live relationship has
 *                no status on which a direct write is allowed — and the screen agrees with it: on
 *                an `active` relationship the Aspects panel draws the lock band and **not one**
 *                editing control (no pencil, no Add, no remove). A person who cannot edit is told
 *                why instead of being left to wonder where the buttons went.
 *   the draft    while the Counterparty has not accepted, the same panel draws the editor — the
 *                issue's "draft and invited stay editable" — because the write layer allows it.
 *   the cost     a change that would strand answers names them **before** it is agreed: that is
 *                `invalidationsOf()`, the pure arithmetic #623 already owns. It is *read* here, not
 *                re-implemented: `lib/relationship/edit.ts` is the silent Initiator/staff write the
 *                issue forbids porting, and nothing in this card calls it.
 *
 * What is deliberately **not** asserted: the proposal record itself. A proposal that both parties
 * sign is a durable two-party fact and this schema has no row for it — see the card's handoff. The
 * rule this file proves is the one that holds today: nothing changes on a live sheet without the
 * write layer's permission, and the write layer does not give it.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { invalidationsOf, type EditSnapshot } from "@/lib/relationship/edit";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { aspectsEditable } from "@/lib/member/publish-basis";
import type { RelationshipStatus } from "@/lib/relationship/status";

const record = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("assessment-relationship-basics is not a fixture");
  return found;
})();

function view(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: "relationship-1133",
    status: "active",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: record.id,
    templateSlug: record.slug,
    title: record.title,
    relationshipTitle: "Marcus – Elena",
    summary: record.summary,
    createdAt: "2026-10-28T18:30:00.000Z",
    publishedAt: "2026-10-29T12:00:00.000Z",
    sessionRecordId: "assessment-instance-marcus-elena",
    aspectCount: record.items.length,
    invite: { claimed: true, revoked: false, expiresAt: new Date("2026-11-12T12:00:00.000Z") },
    counterpartyName: "Elena",
    counterpartySeatName: "Elena",
    initiatorName: "Marcus",
    view: "invite-claimed",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: record,
    aspectsEditable: false,
    publishable: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "active",
    trialEndsAt: "2026-11-05T12:00:00.000Z",
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: false,
    ...overrides,
  };
}

function html(overrides: Partial<MemberRelationshipView> = {}): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view(overrides),
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      onClaimExtension: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

describe("#1133 — the lock: no status beyond draft/pending may take a direct write", () => {
  it("allows the write only while the Counterparty has not accepted", () => {
    expect(aspectsEditable("draft")).toBe(true);
    expect(aspectsEditable("pending")).toBe(true);
  });

  it("refuses it for every state after the invitation has gone out", () => {
    const locked: RelationshipStatus[] = ["published", "active", "complete", "void", "expired"];
    for (const status of locked) {
      expect(aspectsEditable(status), status).toBe(false);
    }
  });
});

describe("#1133 — a live relationship draws the lock, not a control that would refuse", () => {
  it("says why the pencils are gone, in the owner's two sentences", () => {
    const markup = html({ status: "active" });
    expect(markup).toContain('data-relationship-aspects-live="true"');
    expect(markup).toContain("Aspects are locked while Stage 6 is live.");
    expect(markup).toContain("Changes are proposed and agreed by both of you.");
  });

  it("draws not one editing control on a live sheet", () => {
    const markup = html({ status: "active" });
    expect(markup).not.toContain("data-aspect-edit-icon");
    expect(markup).not.toContain("data-aspect-add");
    expect(markup).not.toContain("data-aspect-remove");
    expect(markup).not.toContain("data-aspect-drawer");
  });

  it("still reads the Aspects — a lock is not an empty state", () => {
    const markup = html({ status: "active" });
    expect(markup).toContain("data-relationship-aspect=");
    for (const item of record.items) {
      expect(markup).toContain(item.prompt);
    }
  });
});

describe("#1133 — until the Counterparty accepts, the same panel is the editor", () => {
  it("draws the pencils and the Add, and no lock band", () => {
    const markup = html({ status: "draft", aspectsEditable: true });
    expect(markup).toContain("data-aspect-edit-icon");
    expect(markup).toContain('data-aspect-add="true"');
    expect(markup).not.toContain('data-relationship-aspects-live="true"');
  });

  it("opens no drawer until a row asks for one", () => {
    const markup = html({ status: "draft", aspectsEditable: true });
    expect(markup).not.toContain('data-aspect-drawer="edit"');
    expect(markup).not.toContain('data-aspect-drawer="new"');
  });
});

describe("#1133 — a change that would discard answers names them before anyone agrees", () => {
  const before: EditSnapshot = {
    title: "Marcus – Elena",
    summary: "",
    mode: "basic",
    setting: "soft",
    aspects: [
      {
        id: "aspect-time",
        prompt: "How often do you want to be in touch?",
        leftValue: "Rarely",
        rightValue: "Daily",
      },
      {
        id: "aspect-roles",
        prompt: "How much do old roles still shape what you do?",
        leftValue: "Not at all",
        rightValue: "Enormously",
      },
    ],
  };

  it("counts the answers each seat would lose when an Aspect is dropped", () => {
    const kept = before.aspects.filter((aspect) => aspect.id === "aspect-time");
    const after: EditSnapshot = { ...before, aspects: kept };
    const [cost] = invalidationsOf({
      before,
      after,
      answers: [
        { aspectId: "aspect-roles", role: "initiator", name: "Marcus", answers: 2 },
        { aspectId: "aspect-roles", role: "counterparty", name: "Elena", answers: 2 },
      ],
      sessionExists: true,
    });
    expect(cost?.code).toBe("discards-answers");
    expect(cost?.total).toBe(4);
    expect(cost?.prompt).toContain("old roles");
    expect(cost?.seats.map((seat) => `${seat.name}:${seat.answers}`)).toEqual([
      "Marcus:2",
      "Elena:2",
    ]);
  });

  it("says nothing when nobody has answered the Aspect being dropped", () => {
    const kept = before.aspects.filter((aspect) => aspect.id === "aspect-time");
    const after: EditSnapshot = { ...before, aspects: kept };
    expect(invalidationsOf({ before, after, answers: [], sessionExists: true })).toEqual([]);
  });
});
