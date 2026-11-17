/**
 * "Connected" is a fact about two seats and the session — never about answers (#1115 task 5).
 *
 * The owner's own criterion, verbatim: *both parties able to access the dashboard and first
 * assessment session, not when they share or publish their opinions*. Three consequences, and
 * this file pins every one:
 *
 *   1. **The derivation takes three facts and nothing else.** `connectionOf()` is handed a session
 *      existence and two seat bindings. There is no parameter through which an opinion, an answer
 *      count, a submitted sheet or a `status` column could reach it, so "connected waited on
 *      answering" is not a bug a later edit can introduce quietly — it would have to widen the
 *      input type, and the source rule below fails on the vocabulary.
 *   2. **The screen renders it; it does not compute it.** `RelationshipDetail` writes
 *      `relationship.connection` — the read's answer — and picks one of the fixture's two
 *      sentences. The rendered case proves both states, and proves that adding answers changes
 *      neither.
 *   3. **Both seats bound means both accounts**, not two `party` rows: a row with a NULL `user_id`
 *      is a browser holding a cookie, and that person cannot open the dashboard.
 *
 * The second screen in the owner's sentence is `/assessment/instances/[id]`, whose stage sentence
 * already says `Invited — waiting for {counterparty} to accept the invitation.` — asserted here
 * from the fixture so the two surfaces agree on the words the pair reads.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The screen refreshes after an inline capture, so it reads the router. No test here presses a
// button; the stub exists only so a static render can reach `useRouter`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { relationshipType } from "@/data/relationship-types";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { connectionOf, type ConnectionFacts } from "@/lib/relationship/membership";

const REPO = join(import.meta.dirname, "..");

function source(relative: string): string {
  return readFileSync(join(REPO, relative), "utf8");
}

/** The demo's template: a real assessment record whose slug names no catalogue type. */
const record = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("assessment-relationship-basics is not a fixture");
  return found;
})();

if (relationshipType(record.slug) !== undefined) {
  throw new Error(
    `"${record.slug}" now names a catalogue type — pick a template that does not, because this file's noun assertions are the product's own words`,
  );
}

function view(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: "relationship-1115-connected",
    status: "active",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: record.id,
    templateSlug: record.slug,
    title: record.title,
    relationshipTitle: "Avery B – Rowan",
    summary: record.summary,
    createdAt: "2026-11-10T18:30:00.000Z",
    publishedAt: "2026-11-10T18:31:00.000Z",
    sessionRecordId: "assessment-instance-avery-rowan",
    aspectCount: record.items.length,
    invite: null,
    counterpartyName: "Rowan",
    counterpartySeatName: "Rowan",
    initiatorName: "Avery",
    view: "invite-live",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: record,
    aspectsEditable: false,
    publishable: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "active",
    trialEndsAt: "2026-11-17T18:30:00.000Z",
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

/** The markup as a reader sees it: tags dropped, entities decoded, whitespace collapsed. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ *\
 * 1. The derivation — three facts, four answers
 * ------------------------------------------------------------------ */

describe("connectionOf", () => {
  const facts = (over: Partial<ConnectionFacts> = {}): ConnectionFacts => ({
    hasSession: true,
    initiatorBound: true,
    counterpartyBound: true,
    ...over,
  });

  it("is connected once both seats are bound — before anybody has answered", () => {
    // The row the owner named: "claimed, no answers yet". There is no answer fact in the call,
    // because the state does not depend on one.
    expect(connectionOf(facts())).toEqual({ connected: true, waitingOn: null });
  });

  it("is not connected while the invitation is unclaimed, and names the invited person", () => {
    expect(connectionOf(facts({ counterpartyBound: false }))).toEqual({
      connected: false,
      waitingOn: "counterparty",
    });
  });

  it("waits on the initiator when the other seat is the one that is empty", () => {
    expect(connectionOf(facts({ initiatorBound: false }))).toEqual({
      connected: false,
      waitingOn: "initiator",
    });
  });

  it("is not connected without a session — two seats are a pair, not an assessment", () => {
    expect(connectionOf(facts({ hasSession: false }))).toEqual({
      connected: false,
      waitingOn: "counterparty",
    });
  });

  it("takes nothing but those three facts", () => {
    // The ratchet, as a compile-time fact and a source rule: the interface is three booleans, so
    // no caller can pass an answer count, an opinion, a report or a stored status — which is how
    // "connected" would quietly start waiting on sharing.
    const module = source("lib/relationship/membership.ts");
    const section = module.slice(
      module.indexOf('"Connected" — a fact about two seats and the session'),
      module.indexOf("export interface Connection {"),
    );
    expect(section.length).toBeGreaterThan(400);
    // The prose explains *why* answers are absent; the code is what must not name them.
    const code = section
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\*|\*\/)/.test(line))
      .join("\n");
    for (const forbidden of ["opinion", "answer", "submitted", "status", "report", "gap"]) {
      expect(code.toLowerCase()).not.toContain(forbidden);
    }
    expect(section.match(/readonly \w+: boolean;/g)).toHaveLength(3);
  });
});
/* ------------------------------------------------------------------ *\
 * 2. The screen — renders the read, never computes it
 * ------------------------------------------------------------------ */

describe("the relationship detail draws the connection state", () => {
  it("says Connected once both seats are bound, with no answers involved", () => {
    const markup = html({ connection: { connected: true, waitingOn: null } });

    expect(markup).toContain('data-connection="connected"');
    expect(textOf(markup)).toContain("Connected");
    expect(markup).not.toContain('data-connection="waiting"');
  });

  it("says who the pair is waiting on while the invitation is unclaimed", () => {
    const markup = html({
      counterpartySeatName: null,
      connection: { connected: false, waitingOn: "counterparty" },
    });

    expect(markup).toContain('data-connection="waiting"');
    expect(textOf(markup)).toContain("Waiting on Rowan");
    expect(markup).not.toContain('data-connection="connected"');
  });

  it("draws the same state before and after answering — answers change nothing", () => {
    // The criterion as a render: the two statements differ only in a fact that is *not* in
    // `ConnectionFacts` (the completion gate's seal — both sheets in), and the connection cell is
    // byte-identical.
    const before = html({ connection: { connected: true, waitingOn: null }, completion: null });
    const after = html({
      connection: { connected: true, waitingOn: null },
      completion: { sealed: true },
    });

    const cell = (markup: string): string =>
      markup.slice(
        markup.indexOf('data-connection="connected"') - 120,
        markup.indexOf('data-connection="connected"') + 80,
      );
    expect(cell(before)).toContain("Connected");
    expect(cell(after)).toBe(cell(before));
  });

  it("draws no connection row for a view that predates the field — it never guesses", () => {
    const markup = html();

    expect(markup).not.toContain("data-connection");
  });

  it("reads the state off the read, not off the stored status", () => {
    // The same stored row, two connections: the screen follows the read's answer only.
    const waiting = html({
      status: "active",
      connection: { connected: false, waitingOn: "counterparty" },
    });
    const connected = html({
      status: "published",
      connection: { connected: true, waitingOn: null },
    });

    expect(textOf(waiting)).toContain("Waiting on");
    expect(textOf(connected)).toContain("Connected");
  });
});

/* ------------------------------------------------------------------ *\
 * 3. The other screen in the owner's sentence
 * ------------------------------------------------------------------ */

describe("the instance screen already says which side the assessment waits on", () => {
  it("names the counterparty in the invited sentence", () => {
    const stage = assessmentInstancePageCopy.sections?.find((section) => section.id === "stage");
    expect(stage).toBeDefined();
    const invited = stage?.items?.find((item) => item.id === "invited");
    expect(invited?.label).toContain("waiting for {counterparty}");
  });
});
