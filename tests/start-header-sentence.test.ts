/**
 * Start's header sentence — the one string the landing says about itself (#1129, bundle 05).
 *
 * This file exists because of a rectification delta that turned out to be about *data*, not code:
 * `docs/specs/v2-rectification.md` recorded that the reference's Start band reads
 *
 *   **One thing to talk about, and two small jobs.** · 3 to do
 *
 * while the live capture reads **"Your relationships, and what is next for each."** with **2 to
 * do**. The screen was not missing a branch — `components/dashboard/start-view.ts` already draws
 * the bundle's line the moment the jobs *are* one conversation and two small jobs, and the demo
 * initiator has no draft, so `startJobsOf` can only find two. Nothing in the repo asserted that,
 * which is how a data gap came to read as a copy defect and get re-diagnosed by hand.
 *
 * So the assertion is the branch, both ways round:
 *
 *   1. **one next step + a paused job + a draft job** → three jobs, and the bundle's sentence is
 *      drawn verbatim. This is the state the reference is a picture of, and it is reachable here
 *      on any account that owns a draft.
 *   2. **the same account without the draft** → two jobs, and the quiet sentence, because a landing
 *      that counted a job it does not have is the copy nobody can check. This is the demo seed's
 *      state and therefore the live capture's.
 *   3. **three jobs with no conversation among them** → still the quiet sentence: "one thing to
 *      talk about" is a claim about the first row, so the count alone must not unlock the line.
 *
 * Driven with no database, no DOM and no clock — `startViewOf` is a pure projection and the copy is
 * the route's own fixture, so a rename of either sentence fails here rather than in a screenshot.
 */
import { describe, expect, it } from "vitest";

import { startViewOf } from "@/components/dashboard/start-view";
import { startPageCopy } from "@/data/pages/start";
import type { AlignmentSummary } from "@/lib/member/alignment-summary";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import type { RelationshipStatus } from "@/lib/relationship/status";

/** One row, in the shape `listMyRelationships()` hands the page. */
function row(id: string, status: RelationshipStatus): MemberRelationshipRow {
  return {
    id,
    status,
    viewerRole: "initiator",
    isInitiator: true,
    templateId: `template-${id}`,
    templateSlug: `template-${id}`,
    title: `Template ${id}`,
    relationshipTitle: `Relationship ${id}`,
    summary: "",
    createdAt: "2026-11-10T12:00:00.000Z",
    publishedAt: null,
    sessionRecordId: `s-${id}`,
    aspectCount: 5,
    invite: null,
    counterpartyName: "Elena",
    initiatorName: "Marcus",
    view: "not-published",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
  } as unknown as MemberRelationshipRow;
}

/** A summary with one Gap above zero: the conversation to have first. */
function conversation(): AlignmentSummary {
  return {
    aspects: [],
    tally: { inSynch: 0, smallGap: 0, gap: 1 },
    aligned: 3,
    total: 5,
    nextStep: { itemId: "item-parent-decisions", prompt: "Parent Decisions", kind: "wish", gap: 4 },
  } as unknown as AlignmentSummary;
}

const templates: never[] = [];

/** The three states the bundle's own demo data is in: live, paused, and a draft not yet sent. */
const live = row("busy", "active");
const paused = row("cofound", "expired");
const draft = row("weekend", "draft");

const summaries = { [live.id]: conversation(), [paused.id]: null, [draft.id]: null };

describe("Start's header sentence (#1129, bundle 05)", () => {
  it("draws the bundle's line verbatim when there is one conversation and two small jobs", () => {
    const view = startViewOf({
      copy: startPageCopy,
      rows: [live, paused, draft],
      templates,
      summaries,
    });

    expect(view.jobs.map((job) => job.kind)).toEqual(["next-step", "add-card", "finish-draft"]);
    // The reference's own words, and its own count: `start.html` reads "One thing to talk about,
    // and two small jobs." with "3 to do".
    expect(view.subtitle).toBe("One thing to talk about, and two small jobs.");
    expect(view.subtitle).toBe(startPageCopy.subtitle);
  });

  it("draws the quiet sentence when the draft is missing, and says two jobs rather than three", () => {
    const view = startViewOf({ copy: startPageCopy, rows: [live, paused], templates, summaries });

    expect(view.jobs.map((job) => job.kind)).toEqual(["next-step", "add-card"]);
    expect(view.subtitle).toBe("Your relationships, and what is next for each.");
    expect(view.subtitle).not.toBe(startPageCopy.subtitle);
  });

  it("keeps the quiet sentence when the pause belongs to the Counterparty's seat", () => {
    // Locked rule 5: the Counterparty has no card to add, so a paused relationship they are only a
    // party to is not a job. One conversation and one job is not "two small jobs", and the count
    // alone must not unlock the bundle's line.
    const counterpartyPaused = {
      ...paused,
      viewerRole: "counterparty",
      isInitiator: false,
      counterpartyName: null,
      initiatorName: "Marcus",
    } as unknown as MemberRelationshipRow;

    const view = startViewOf({
      copy: startPageCopy,
      rows: [live, counterpartyPaused, draft],
      templates,
      summaries,
    });

    expect(view.jobs.map((job) => job.kind)).toEqual(["next-step", "finish-draft"]);
    expect(view.subtitle).toBe("Your relationships, and what is next for each.");
  });
});
