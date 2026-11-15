/**
 * D6 (#975) — a never-sent draft is not an invited assessment.
 *
 * The defect, measured on `/assessments` at `45488329`: the draft a creator made in the walk was
 * listed with the stage word **`Invited`** and the state **"Yours to answer"**, while its own
 * detail page said "Not sent yet — nothing has been invited or charged". Nothing was invited, so
 * nothing can be waiting to be claimed.
 *
 * **Where the lie was.** `instanceStatusOf()` answered `awaiting_counterparty` for *any* session
 * with no Counterparty seat (`lib/flow/state.ts`), and it never asked whether the relationship had
 * been sent at all. The discriminating fact is on the **record**, not the session:
 * `relationship.published_at IS NULL` is "the invitation never went out". `relationshipStage()`
 * then mapped that status onto the ladder's first rung, and `myInstanceStateOf()` mapped it onto
 * "you owe answers", which is how one absent invitation became two false sentences.
 *
 * **Both cases are asserted, and that is the point of the file.** An exemption with no negative
 * case is indistinguishable from a deleted label: a published relationship whose Counterparty has
 * not claimed yet *is* Invited and *is* yours to answer, and it stays that way. Six pure cases
 * drive the derivation and the list mapping; two rendered cases drive the row a reader actually
 * sees, because the words are what the defect reported.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AssessmentsList } from "@/components/dashboard/assessments-list";
import { assessmentsPageCopy } from "@/data/pages/assessments";
import { relationshipCardFromRow, type RelationshipCardRow } from "@/lib/db/assessments";
import { matchesOverviewFilter, overviewCountsOf, OVERVIEW_FILTERS } from "@/lib/flow/overview";
import { relationshipStage } from "@/lib/flow/stage";
import { instanceStatusOf, myInstanceStateOf, type InstanceProgress } from "@/lib/flow/state";

/** A session with no Counterparty seat — the shape a draft and an unclaimed invitation share. */
function progress(overrides: Partial<InstanceProgress> = {}): InstanceProgress {
  return {
    aspectCount: 5,
    hasCounterparty: false,
    initiatorAnswered: 0,
    counterpartyAnswered: 0,
    initiatorAccepted: 0,
    counterpartyAccepted: 0,
    ...overrides,
  };
}

/**
 * A row as `RELATIONSHIP_CARDS_SQL` returns it, seen by the creator.
 *
 * The default is the D6 draft exactly: five Aspects, nothing answered, no Counterparty seat, no
 * `published_at` — and an invitation row the create wrote, because a draft's create still writes
 * one. `invite` is therefore present on the draft on purpose: the suppress-the-chip half of the
 * defect is only provable with a row that would otherwise draw it.
 */
function rowOf(overrides: Partial<RelationshipCardRow> = {}): RelationshipCardRow {
  return {
    relationship_id: "relationship-draft",
    plan: null,
    purchased_at: null,
    template_title: "Relationship Basics",
    template_slug: "spouses",
    session_record_id: "assessment-instance-draft",
    slug: "spouses-1a2b3c4d",
    mode: "basic",
    session_name: "Our first pass",
    session_date: new Date("2026-11-06T12:00:00.000Z"),
    viewer_role: "initiator",
    viewer_unlock_seen_at: null,
    initiator_name: "Avery",
    counterparty_name: "Rowan",
    aspect_count: 5,
    initiator_answered: 0,
    counterparty_answered: 0,
    has_counterparty: false,
    initiator_accepted: false,
    counterparty_accepted: false,
    sessions_opened: 1,
    sessions: [
      {
        aspectCount: 5,
        initiatorAnswered: 0,
        counterpartyAnswered: 0,
        hasCounterparty: false,
        initiatorAccepted: false,
        counterpartyAccepted: false,
        voided: false,
      },
    ],
    opinions: null,
    items: null,
    invite: { claimed: false, expiresAt: "2026-11-20T12:00:00.000Z" },
    voided: false,
    published: false,
    read_at: new Date("2026-11-06T12:00:00.000Z"),
    ...overrides,
  };
}

/** The rendered text: tags dropped, whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function listOf(rows: readonly RelationshipCardRow[]): string {
  return renderToStaticMarkup(
    createElement(AssessmentsList, {
      copy: assessmentsPageCopy,
      rows: rows.map(relationshipCardFromRow),
      filter: null,
      unreadable: null,
    }),
  );
}

describe("the derivation knows whether the invitation ever went out", () => {
  it("calls a never-published relationship `draft`, not `awaiting_counterparty`", () => {
    expect(instanceStatusOf(progress({ published: false }))).toBe("draft");
  });

  it("keeps a published relationship with an unclaimed seat `awaiting_counterparty`", () => {
    // The negative case. Without this, "draft" could be a deleted label rather than an exemption.
    expect(instanceStatusOf(progress({ published: true }))).toBe("awaiting_counterparty");
  });

  it("leaves a read that did not measure the fact alone — absent is not `false`", () => {
    // Every other read path (the flow screen, the flow store, the older fixtures) omits it, and
    // none of them may change status because this field was added.
    expect(instanceStatusOf(progress())).toBe("awaiting_counterparty");
  });

  it("gives a draft no ladder rung, and keeps the first rung for a sent invitation", () => {
    expect(relationshipStage("draft")).toBeNull();
    expect(relationshipStage("awaiting_counterparty")).toBe("invited");
  });

  it("answers `draft` for the viewer's own row state, and `yours-to-answer` once sent", () => {
    const viewerRole = "initiator" as const;
    expect(myInstanceStateOf({ ...progress({ published: false }), viewerRole })).toBe("draft");
    expect(myInstanceStateOf({ ...progress({ published: true }), viewerRole })).toBe(
      "yours-to-answer",
    );
  });
});

describe("the list mapping carries the record's own fact", () => {
  it("maps a draft to the draft card — no stage, no invitation to report", () => {
    const card = relationshipCardFromRow(rowOf());

    expect(card.state).toBe("draft");
    expect(card.stage).toBeNull();
    // The create writes an `session_invite` row even for a draft; reporting its state would claim
    // an invitation was sent. Nothing was, so there is nothing to report.
    expect(card.inviteState).toBeNull();
  });

  it("maps a published relationship with an unclaimed seat onto Invited / yours to answer", () => {
    const card = relationshipCardFromRow(rowOf({ published: true }));

    expect(card.state).toBe("yours-to-answer");
    expect(card.stage).toBe("invited");
    expect(card.inviteState).toBe("unclaimed");
  });
});

describe("the rendered /assessments row", () => {
  it("draws neither `Invited` nor `Yours to answer` for a draft", () => {
    const html = listOf([rowOf()]);
    const text = textOf(html);

    // The two words the defect reported, nowhere in the output — not the cover word, not the
    // chip, not the row's sentence.
    expect(text).not.toContain("Invited");
    expect(text).not.toContain("Yours to answer");

    // And it does say what it is, in the detail page's own words, so the two surfaces agree.
    expect(text).toContain("Not sent yet — nothing has been invited or charged");
    expect(html).toContain('data-assessment-state="draft"');
    expect(text).toContain("Draft");
  });

  it("still draws `Invited` and `Yours to answer` once the invitation has gone out", () => {
    const html = listOf([rowOf({ published: true })]);
    const text = textOf(html);

    expect(text).toContain("Invited");
    expect(text).toContain("Yours to answer");
    expect(html).toContain('data-assessment-state="yours-to-answer"');
    expect(text).not.toContain("Not sent yet — nothing has been invited or charged");
  });

  it("reaches the draft through its own tab, so the row is not hidden by the fix", () => {
    const text = textOf(listOf([rowOf()]));

    // A label that only stops saying "Yours to answer" would leave the draft behind a tab that
    // never matches it. It is counted under `all` and reachable under its own state.
    expect(text).toContain("All assessments 1");
    expect(text).toContain("Drafts 1");
    expect(text).toContain("Needs your answers 0");
  });
});

describe("a count is a predicate over the rows the linked list renders", () => {
  it("keeps a draft out of every Overview list, and leaves the same row in once sent", () => {
    // The console's cards count the rows `/assessments` filters with the same predicate
    // (`lib/flow/overview.ts`). If the row changed state on one surface and not the other, a card
    // would say 1 and its own list would show none — the drift that module exists to prevent.
    const draft = relationshipCardFromRow(rowOf());
    const sent = relationshipCardFromRow(rowOf({ published: true }));

    for (const filter of OVERVIEW_FILTERS) {
      expect(matchesOverviewFilter(draft, filter), `a draft in ${filter}`).toBe(false);
    }
    expect(overviewCountsOf([draft])).toEqual({
      "awaiting-other": 0,
      "yours-to-answer": 0,
      "reports-open": 0,
    });

    // The negative case: the identical relationship, sent, is the one the card counts.
    expect(matchesOverviewFilter(sent, "yours-to-answer")).toBe(true);
    expect(overviewCountsOf([sent])["yours-to-answer"]).toBe(1);
  });
});
