/**
 * `/assessment/instances` — the relationship list, and it is the caller's own (#213, #409).
 *
 * Five claims, each one a line of a card:
 *
 *   * signed out, the page redirects to `/login?next=<this route>` and the intended path survives
 *     the round trip (`loginPathFor` is shell-free, so it runs here);
 *   * signed in, the read is called with the session's own user id — the account the auth server
 *     resolved, never a name, a `searchParams` value or a header;
 *   * an admin is not widened: there is no role in this path at all, which is asserted against
 *     the page's source with the comments stripped first, because the module explains at length
 *     that it reads none of those and an assertion matching its own prose would fail on the
 *     explanation rather than on a regression;
 *   * a card says only where the relationship stands — no per-Aspect answer, no other party's
 *     score — while the figures it does print are all derived from row counts;
 *   * an absent figure is `—`, never `0`, and no money total exists anywhere on the surface.
 *
 * The route is also held to the manifest here, because "E10 cannot match this path" is a red build
 * and the cheapest place to notice it is beside the path's own constant.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { matchRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import { myInstancesPageCopy } from "@/data/pages/assessment-instances";
import {
  relationshipCardFromRow,
  type RelationshipCard,
  type RelationshipCardRow,
} from "@/lib/db/assessments";
import { OVERVIEW_FILTERS, matchesOverviewFilter, overviewCountsOf } from "@/lib/flow/overview";
import { MY_INSTANCES_PATH, instancePath } from "@/lib/flow/paths";
import {
  MY_INSTANCE_STATES,
  UNLOCK_MARKS,
  myInstanceStateOf,
  unlockMarkOf,
  type MyInstanceProgress,
} from "@/lib/flow/state";

const { redirect, currentUser, listRelationshipCards } = vi.hoisted(() => ({
  redirect: vi.fn((to: string): never => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  currentUser: vi.fn(
    async (): Promise<{ userId: string; email: string; name: string } | null> => null,
  ),
  listRelationshipCards: vi.fn(async (_userId: string): Promise<RelationshipCard[]> => []),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/db/assessments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/assessments")>();
  // Only the read is stubbed: `relationshipCardFromRow` is the pure half and is driven directly,
  // which is the point of splitting them.
  return { ...actual, listRelationshipCards };
});

import MyInstancesPage from "@/app/(mainlayout)/assessment/instances/page";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(null);
  listRelationshipCards.mockResolvedValue([]);
});

/**
 * A card as the read produces it: every figure derived, none authored.
 *
 * `alignment` is the one field that can be `null` while the relationship is complete — a session
 * whose opinions do not parse measures nothing — so the default row carries a real mean Gap and
 * the unscored case is its own fixture below.
 */
function cardOf(overrides: Partial<RelationshipCard> = {}): RelationshipCard {
  return {
    relationshipId: "relationship-assessment-instance-avery-rowan",
    instanceRecordId: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    name: "Relationship Basics",
    templateTitle: "Relationship Basics",
    mode: "basic",
    viewerRole: "initiator",
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    stage: "sharing",
    state: "complete",
    unlock: "seen",
    inviteState: null,
    aspectCount: 5,
    sessionsOpened: 1,
    sessionsCompleted: 1,
    alignment: 1.4,
    paid: { plan: null, purchasedAt: null },
    lastSessionAt: "2026-10-28T18:30:00.000Z",
    ...overrides,
  };
}

const completeRow = cardOf();

/** The viewer has answered every Aspect, the instance is not complete, so the other has not. */
const awaitingRow = cardOf({
  relationshipId: "relationship-assessment-instance-marco-priya",
  instanceRecordId: "assessment-instance-marco-priya",
  slug: "marco-priya-1a2b3c4d",
  name: "Staff & Manager",
  templateTitle: "Staff & Manager",
  counterpartyName: "Priya",
  stage: "connected",
  state: "awaiting-other",
  sessionsCompleted: 0,
  alignment: null,
});

/**
 * Complete, and this party has not opened it since (#252) — the row the card exists for: the
 * Counterparty submitted while the Initiator was away.
 */
const completeUnseenRow = cardOf({ unlock: "unseen" });

/**
 * A relationship with no session opened and no score (#409's `—` rule): the tiles it has no
 * number for say `—`, and the ones it does have say what they are.
 */
const unscoredRow = cardOf({
  relationshipId: "relationship-5e7cf07d-348d-40ea-85c3-37dbd6e90670",
  instanceRecordId: "5e7cf07d-348d-40ea-85c3-37dbd6e90670",
  slug: "relationship-basics-5e7cf07d",
  name: "Relationship Basics",
  stage: "connected",
  state: "yours-to-answer",
  aspectCount: 5,
  sessionsOpened: 1,
  sessionsCompleted: 0,
  alignment: null,
});

async function render(params: Record<string, string> = {}): Promise<string> {
  return renderToStaticMarkup(await MyInstancesPage({ searchParams: Promise.resolve(params) }));
}

/** The rendered text: tags dropped, whitespace collapsed. Digits in a class name are not copy. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The list band. Scoped by its own marker, so a shell `<li>` can never be read as a row. */
function listSection(html: string): string {
  const match = html.match(/<section data-my-instances="true"[^>]*>[\s\S]*?<\/section>/);
  if (match === null) throw new Error("the list band did not render");
  return match[0];
}

/**
 * The list band, or the whole document when a narrowing kept no rows.
 *
 * A filtered list that keeps nothing is drawn as its own band (`data-my-instances-filter-empty`),
 * so the "how many rows did this render" question has an answer of 0 rather than an exception —
 * which is the honest reading of the page a zero-card opens.
 */
function listSectionOrEmpty(html: string): string {
  const match = html.match(/<section data-my-instances="true"[^>]*>[\s\S]*?<\/section>/);
  return match?.[0] ?? html;
}

/** The one card in the list band whose state is `state`, as text. */
function rowText(html: string, state: string): string {
  const rows = listSection(html).match(/<li[\s\S]*?<\/li>/g) ?? [];
  const found = rows.find((row) => row.includes(`data-instance-state="${state}"`));
  if (found === undefined) throw new Error(`no rendered card with state "${state}"`);
  return textOf(found);
}

describe("the route is one the manifest can match", () => {
  it("registers the static path, so E10 may emit it and E7 agrees with app/", () => {
    expect(matchRoute(routeManifest, MY_INSTANCES_PATH)?.kind).toBe("static");
    expect(MY_INSTANCES_PATH).toBe("/assessment/instances");
  });
});

describe("signed out", () => {
  it("redirects to the login page with this path preserved", async () => {
    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fassessment%2Finstances");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fassessment%2Finstances");
    expect(listRelationshipCards).not.toHaveBeenCalled();
  });
});

describe("signed in", () => {
  it("reads with the session's own user id and nothing else", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeRow]);

    await render();

    expect(listRelationshipCards).toHaveBeenCalledTimes(1);
    expect(listRelationshipCards).toHaveBeenCalledWith("52dfe892-be03-421b-ac34-1b35d74633dc");
  });

  it("renders one card per relationship, naming both parties and which one is you", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeRow]);

    const html = await render();
    const rows = listSection(html).match(/<li[\s\S]*?<\/li>/g) ?? [];

    expect(html).toContain('data-my-instances="true"');
    expect(rows).toHaveLength(1);
    expect(rowText(html, "complete")).toContain("Relationship Basics");
    expect(rowText(html, "complete")).toContain("Rowan");
    expect(rowText(html, "complete")).toContain("You have both answered");
    expect(html).toContain(`href="${instancePath(completeRow.instanceRecordId)}"`);
    expect(html).not.toContain("data-empty-state");
    // The title row carries the one primary action — the ancestor's header, translated.
    expect(html).toContain('href="/assessment"');
    expect(textOf(html)).toContain("Start an assessment");
  });

  it("shows the empty state, with a way to start one, when the account is in nothing", async () => {
    currentUser.mockResolvedValue({
      userId: "e21da3bd-6ee8-4af9-8fef-ba05e17bb1ec",
      email: "admin@demo.alignsynch.test",
      name: "Admin",
    });
    listRelationshipCards.mockResolvedValue([]);

    const html = await render();
    const text = textOf(html);

    expect(html).toContain('data-empty-state="true"');
    expect(text).toContain("You are not in an assessment yet");
    expect(text).toContain("An instance starts when you pick a template and invite someone");
    expect(html).toContain('href="/assessment"');
    // An empty list is not a blank page and not an error panel.
    expect(html).not.toContain("data-my-instances-unreadable");
  });

  it("says only that the other party is still to answer — no score, no answered count", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([awaitingRow]);

    const row = rowText(await render(), "awaiting-other");

    expect(row).toContain("Waiting for Priya to answer.");
    // The blind rule on the card: no Gap figure, no per-Aspect answer, no count of what the
    // other party has said. The session counts it *does* print are rows of a cycle, not answers.
    expect(row).not.toContain("Gap of");
    expect(row).not.toMatch(/answered\s*\d+/i);
    expect(row).toContain("—");
  });

  it("prints the database layer's own sentence when the read does not answer", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockRejectedValueOnce(
      new (await import("@/lib/db/client")).DatabaseUnavailableError(
        "The assessment database could not be reached, so this assessment could not be read.",
      ),
    );

    const html = await render();

    expect(html).toContain('data-my-instances-unreadable="true"');
    expect(textOf(html)).toContain(
      "The assessment database could not be reached, so this assessment could not be read.",
    );
    expect(html).toContain(`href="${MY_INSTANCES_PATH}"`);
  });

  it("still throws for a failure that is not the database being unavailable", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockRejectedValueOnce(
      new Error('instance "x" does not satisfy the model'),
    );

    await expect(render()).rejects.toThrow("does not satisfy the model");
  });
});

describe("the page reads no identity the browser supplied", () => {
  /** Comments explain at length that these are not read; strip them before asserting on code. */
  function codeOf(path: string): string {
    return readFileSync(path, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
  }

  const page = codeOf("app/(mainlayout)/assessment/instances/page.tsx");
  const read = codeOf("lib/db/assessments.ts");

  it("takes no header or cookie of its own, and no route param at all", () => {
    for (const forbidden of [/params:\s*Promise</, /\bheaders\(/, /\bcookies\(/]) {
      expect(page).not.toMatch(forbidden);
    }
  });

  it("reads exactly three query values, and each one only narrows", () => {
    // Since #409 the list has the ancestor's search box and stage tabs, so the page resolves
    // three values: the console's `?filter=`, a stage and a search. All three are predicates over
    // the rows the session already owns — asserted on the identifiers, because the module
    // explains this in prose.
    const read_ = [...page.matchAll(/\bparams\.(\w+)/g)].map((match) => match[1]);
    expect(new Set(read_)).toEqual(new Set(["filter", "stage", "q"]));
    expect(page).toMatch(/overviewFilterOf\(params\.filter\)/);
    expect(page).toMatch(/flowStageOf\(first\(params\.stage\)\)/);
    // No identity, no account id, no widening.
    expect(page).not.toMatch(/(searchParams|query)\.(userId|user|account|email|role|id)\b/);
    expect(page).toMatch(/listRelationshipCards\(user\.userId\)/);
  });

  it("never asks for a role, so an admin is an ordinary account here", () => {
    for (const forbidden of [
      /requireRole/,
      /requireAdmin/,
      /roleOfUser/,
      /currentRole/,
      /user_profile/,
    ]) {
      expect(page).not.toMatch(forbidden);
      expect(read).not.toMatch(forbidden);
    }
  });

  it("scopes the statement by the bound account and by nothing else", () => {
    // One parameter, used twice: the session's own account id. `$1` is the only placeholder the
    // list statement takes, so there is no second value that could widen it.
    const statement = read.match(/const RELATIONSHIP_CARDS_SQL = `[\s\S]*?`;/)?.[0] ?? "";
    expect(statement).toContain("rm.user_id = $1");
    expect(statement).toContain("p0.user_id = $1");
    expect([...statement.matchAll(/\$\d/g)].map((m) => m[0])).toEqual(["$1", "$1", "$1", "$1"]);
    expect(read).toContain(
      "queryRows<RelationshipCardRow>(RELATIONSHIP_CARDS_SQL, [viewerUserId])",
    );
  });
});

describe("a row's state is derived, never stored", () => {
  function progress(overrides: Partial<MyInstanceProgress> = {}): MyInstanceProgress {
    return {
      aspectCount: 5,
      hasCounterparty: true,
      initiatorAnswered: 5,
      counterpartyAnswered: 5,
      viewerRole: "initiator",
      ...overrides,
    };
  }

  it("is complete only when both parties answered every Aspect", () => {
    expect(myInstanceStateOf(progress())).toBe("complete");
    expect(myInstanceStateOf(progress({ counterpartyAnswered: 4 }))).toBe("awaiting-other");
  });

  it("is yours-to-answer while the viewer still owes an Aspect, whichever party they are", () => {
    expect(myInstanceStateOf(progress({ initiatorAnswered: 2, counterpartyAnswered: 5 }))).toBe(
      "yours-to-answer",
    );
    expect(
      myInstanceStateOf(
        progress({ viewerRole: "counterparty", initiatorAnswered: 5, counterpartyAnswered: 0 }),
      ),
    ).toBe("yours-to-answer");
  });

  it("is awaiting-other before the invitation is claimed, and for a copy with no Aspects", () => {
    expect(
      myInstanceStateOf(
        progress({ hasCounterparty: false, initiatorAnswered: 5, counterpartyAnswered: 0 }),
      ),
    ).toBe("awaiting-other");
    expect(
      myInstanceStateOf(
        progress({ aspectCount: 0, initiatorAnswered: 0, counterpartyAnswered: 0 }),
      ),
    ).toBe("awaiting-other");
  });

  it("names three states and every one of them has a copy item", () => {
    const states = myInstancesPageCopy.sections?.find((section) => section.id === "state");
    const ids = (states?.items ?? []).map((item) => item.id);
    expect([...MY_INSTANCE_STATES].sort()).toEqual([...ids].sort());
  });
});

describe("the unlock marker (#252)", () => {
  it("is unseen only for a complete row this party has not opened since", () => {
    const opened = new Date("2026-10-30T18:00:00.000Z");
    expect(unlockMarkOf("complete", null)).toBe("unseen");
    expect(unlockMarkOf("complete", opened)).toBe("seen");
    // Every other state is "nothing to announce", whatever the column says: a mark can only
    // ever be drawn on a row that already says `complete`.
    expect(unlockMarkOf("awaiting-other", null)).toBe("seen");
    expect(unlockMarkOf("yours-to-answer", null)).toBe("seen");
  });

  it("draws the fixture's one line on a complete card nobody has opened, and quotes it", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeUnseenRow]);

    const html = await render();
    const row = rowText(html, "complete");

    expect(html).toContain('data-instance-marker="unseen"');
    expect(row).toContain("Complete since you last looked — open it to read the Gap");
  });

  it("is absent on a complete card that party has already opened, which still says complete", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeRow]);

    const html = await render();
    const row = rowText(html, "complete");

    expect(row).toContain("You have both answered");
    expect(html).not.toContain("data-instance-marker");
    expect(html).not.toContain("Complete since you last looked");
    expect(listSection(html)).toContain('data-instance-unlock="seen"');
  });

  it("is drawn on the card, never as a toast, a modal or a count in the header", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeUnseenRow]);

    const html = await render();
    const marker = html.match(/<p data-instance-marker="unseen"[\s\S]*?<\/p>/)?.[0] ?? "";

    // It is a row-level `<p>`; the page's heading area carries no marker.
    expect(marker).not.toBe("");
    expect(marker).toContain("Complete since you last looked");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('role="alert"');
  });

  it("keeps the two parties' cards independent — one relationship, two different marks", async () => {
    const initiatorRow: RelationshipCard = {
      ...completeUnseenRow,
      viewerRole: "initiator",
      initiatorName: "Avery",
      counterpartyName: "Rowan",
    };
    const counterpartyRow: RelationshipCard = {
      ...completeRow,
      viewerRole: "counterparty",
      initiatorName: "Avery",
      counterpartyName: "Rowan",
    };

    // The read is per account: this render is the Initiator's list and the next is the
    // Counterparty's, from the same relationship and the same two opinions.
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([initiatorRow]);
    const initiatorHtml = await render();

    currentUser.mockResolvedValue({
      userId: "9c3f1a02-77c1-4f6e-9a8b-2f4b1c7d5e10",
      email: "counterparty@demo.alignsynch.test",
      name: "Rowan",
    });
    listRelationshipCards.mockResolvedValue([counterpartyRow]);
    const counterpartyHtml = await render();

    expect(initiatorHtml).toContain('data-instance-marker="unseen"');
    expect(initiatorHtml).toContain("Complete since you last looked");
    expect(counterpartyHtml).not.toContain("data-instance-marker");
    expect(counterpartyHtml).not.toContain("Complete since you last looked");
    expect(counterpartyHtml).toContain("You have both answered");
    // …and the "other party" line is the other one, from the seat the read resolved.
    expect(rowText(initiatorHtml, "complete")).toContain("Rowan");
    expect(rowText(counterpartyHtml, "complete")).toContain("Avery");
  });

  it("has its own copy band, so no marker string is a state sentence", () => {
    const marker = myInstancesPageCopy.sections?.find((section) => section.id === "marker");
    const states = myInstancesPageCopy.sections?.find((section) => section.id === "state");
    const ids = (marker?.items ?? []).map((item) => item.id);

    expect(ids).toEqual([...UNLOCK_MARKS.filter((mark) => mark === "unseen")]);
    expect((states?.items ?? []).map((item) => item.id)).not.toContain("unseen");
  });
});

describe("the console's filter (Console 2/5)", () => {
  const signedIn = {
    userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
    email: "initiator@demo.alignsynch.test",
    name: "Avery",
  };

  /** One row of each state, so a filter has something to keep and something to drop. */
  const threeStates: RelationshipCard[] = [
    awaitingRow,
    { ...completeRow, instanceRecordId: "assessment-instance-yours", state: "yours-to-answer" },
    completeUnseenRow,
  ];

  it("keeps only the rows `matchesOverviewFilter()` accepts, and says which list it is", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue(threeStates);

    for (const filter of OVERVIEW_FILTERS) {
      const html = await render({ filter });
      const kept = threeStates.filter((instance) => matchesOverviewFilter(instance, filter));
      const rendered = (listSectionOrEmpty(html).match(/data-instance="/g) ?? []).length;

      expect(html).toContain(`data-my-instances-filter="${filter}"`);
      // The number on the Overview card is `overviewCountsOf(...)[filter]`; this is the list
      // length those same rows produce, from the same predicate.
      expect(rendered).toBe(kept.length);
      expect(overviewCountsOf(threeStates)[filter]).toBe(kept.length);
    }
  });

  it("offers the way back to every relationship", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue([completeUnseenRow]);

    const html = await render({ filter: "reports-open" });
    expect(html).toContain(`href="${MY_INSTANCES_PATH}"`);
    expect(textOf(html)).toContain("Show every relationship");
  });

  it("draws the filter's own empty sentence, not the new-account band", async () => {
    currentUser.mockResolvedValue(signedIn);
    // The reader has relationships; none of them is complete and unread.
    listRelationshipCards.mockResolvedValue([awaitingRow]);

    const html = await render({ filter: "reports-open" });

    expect(html).toContain('data-my-instances-filter-empty="reports-open"');
    expect(textOf(html)).toContain("No relationship is in this list right now");
    expect(html).not.toContain("data-empty-state");
  });

  it("ignores a filter value nobody recognises rather than drawing an empty list", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue(threeStates);

    const html = await render({ filter: "every-relationship" });

    expect(html).not.toContain("data-my-instances-filter");
    expect((listSectionOrEmpty(html).match(/data-instance="/g) ?? []).length).toBe(
      threeStates.length,
    );
  });
});

describe("the metric row (#409)", () => {
  const signedIn = {
    userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
    email: "initiator@demo.alignsynch.test",
    name: "Avery",
  };

  it("prints `—` for a relationship with no scored session, and never `0`", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue([unscoredRow]);

    const row = rowText(await render(), "yours-to-answer");

    // Named row: `relationship-5e7cf07d-…` (slug `relationship-basics-5e7cf07d`) has one session
    // open and none complete, so its alignment has no figure at all.
    expect(row).toContain("Avg alignment");
    expect(row).toContain("—");
    expect(row).not.toContain("0.0");
    // Sessions does have a figure — 0 completed of 1 opened is a count of cycles, not a score.
    expect(row).toContain("0 of 1");
    expect(row).toContain("0%");
  });

  it("prints the completed mean Gap, to one decimal, when the session is scored", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue([completeRow]);

    const row = rowText(await render(), "complete");
    expect(row).toContain("1.4");
    expect(row).toContain("1 of 1");
    expect(row).toContain("100%");
    expect(row).toContain("5");
  });

  it("draws what was paid on the Initiator's card and nothing at all for anybody else", async () => {
    currentUser.mockResolvedValue(signedIn);

    listRelationshipCards.mockResolvedValue([
      { ...completeRow, paid: { plan: "household", purchasedAt: "2026-10-20T12:00:00.000Z" } },
    ]);
    const initiator = rowText(await render(), "complete");
    expect(initiator).toContain("Paid");
    expect(initiator).toContain("household");
    expect(initiator).toContain("Oct 20, 2026");
    // A sum of one purchase is not a fact: the surface has no total, and no amount but the one
    // plan that was bought.
    expect(initiator).not.toMatch(/total/i);

    // The read hands `paid: null` to every non-Initiator — the block is absent, not blanked.
    listRelationshipCards.mockResolvedValue([
      { ...completeRow, viewerRole: "counterparty", paid: null },
    ]);
    const counterparty = rowText(await render(), "complete");
    expect(counterparty).not.toContain("Paid");
  });

  it("says `—` in the paid block when nothing has been paid, and no total anywhere", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue([completeRow]);

    const html = await render();
    const paid = listSection(html).match(/data-paid-absent="true"[\s\S]*?<\/p>/)?.[0] ?? "";
    const row = rowText(html, "complete");

    // Named row: `relationship-assessment-instance-avery-rowan` has `plan = NULL` and
    // `purchased_at = NULL` in production, so what it paid is absent — drawn `—`, not `£0`.
    expect(paid).toContain("—");
    expect(row).toContain("Paid");
    expect(html).not.toMatch(/total/i);
    expect(html).not.toMatch(/£|\$|€/);
  });
});

describe("the row → card mapping (#409)", () => {
  /**
   * A row as the statement returns it, shaped from the production row captured for this card.
   *
   * `RelationshipCardRow` is the projection `RELATIONSHIP_CARDS_SQL` produces, so this is the one
   * place the mapping can be driven without a connection — which is what lets the blind rule and
   * the `—` rule be asserted on the derived card, not only on the markup.
   */
  function rowOf(overrides: Partial<RelationshipCardRow> = {}): RelationshipCardRow {
    return {
      relationship_id: "relationship-assessment-instance-avery-rowan",
      plan: null,
      purchased_at: null,
      template_title: "Relationship Basics",
      session_record_id: "assessment-instance-avery-rowan",
      slug: "avery-rowan",
      mode: "basic",
      session_name: null,
      session_date: new Date("2026-10-28T18:30:00.000Z"),
      viewer_role: "initiator",
      viewer_unlock_seen_at: null,
      initiator_name: "Avery",
      counterparty_name: "Rowan",
      aspect_count: 5,
      initiator_answered: 5,
      counterparty_answered: 5,
      has_counterparty: true,
      sessions_opened: 1,
      sessions: [
        { aspectCount: 5, initiatorAnswered: 5, counterpartyAnswered: 5, hasCounterparty: true },
      ],
      opinions: [
        { role: "initiator", itemId: "aspect-money", feel: 4, wish: 4, think: null, guess: null },
        {
          role: "counterparty",
          itemId: "aspect-money",
          feel: 2,
          wish: 2,
          think: null,
          guess: null,
        },
      ],
      items: [{ itemId: "aspect-money" }],
      invite: null,
      read_at: new Date("2026-10-29T12:00:00.000Z"),
      ...overrides,
    };
  }

  it("derives the stage, the counts and the Gap of a complete session", () => {
    const card = relationshipCardFromRow(rowOf());

    expect(card.stage).toBe("sharing");
    expect(card.state).toBe("complete");
    expect(card.sessionsOpened).toBe(1);
    expect(card.sessionsCompleted).toBe(1);
    expect(card.aspectCount).toBe(5);
    // Four Gaps on a Basic Aspect — feel 2, wish 2, and the two within-party Gaps of 0 (4 vs 4
    // and 2 vs 2) — so the mean is 1. The kinds a session cannot measure (no predictions here)
    // are absent from the count rather than averaged in as zeros.
    expect(card.alignment).toBe(1);
    // The session has no name of its own, so the card is named by its template.
    expect(card.name).toBe("Relationship Basics");
  });

  it("refuses to score a session that is not complete, even with both opinions present", () => {
    // A Counterparty answer is missing, so the row is mid-cycle — and the read must not turn the
    // opinions it does carry into a figure the viewer has not unlocked.
    const card = relationshipCardFromRow(
      rowOf({
        counterparty_answered: 4,
        sessions: [
          { aspectCount: 5, initiatorAnswered: 5, counterpartyAnswered: 4, hasCounterparty: true },
        ],
      }),
    );

    expect(card.state).toBe("awaiting-other");
    expect(card.stage).toBe("connected");
    expect(card.alignment).toBeNull();
    expect(card.sessionsCompleted).toBe(0);
  });

  it("hands the Initiator the plan and every other seat nothing", () => {
    const initiator = relationshipCardFromRow(
      rowOf({ plan: "household", purchased_at: new Date("2026-10-20T12:00:00.000Z") }),
    );
    expect(initiator.paid).toEqual({
      plan: "household",
      purchasedAt: "2026-10-20T12:00:00.000Z",
    });

    const counterparty = relationshipCardFromRow(rowOf({ viewer_role: "counterparty" }));
    expect(counterparty.paid).toBeNull();
    expect(counterparty.viewerRole).toBe("counterparty");
  });
});

describe("the stage tabs (#409)", () => {
  const signedIn = {
    userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
    email: "initiator@demo.alignsynch.test",
    name: "Avery",
  };

  const rows: RelationshipCard[] = [
    awaitingRow,
    { ...completeRow, instanceRecordId: "assessment-instance-invited", stage: "invited" },
    completeRow,
  ];

  it("counts each tab from the rows it was given, never from a literal", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue(rows);

    const html = await render();
    const tabs = html.match(/data-stage-tab="(\w+)"[\s\S]*?<\/a>/g) ?? [];

    expect(tabs).toHaveLength(4);
    expect(textOf(html)).toContain("All relationships (3)");
    expect(textOf(html)).toContain("Invited (1)");
    expect(textOf(html)).toContain("Connected (1)");
    expect(textOf(html)).toContain("Sharing (1)");
    // Aligned is a verdict over a finished Gap, not a rung a tab can count.
    expect(html).not.toContain('data-stage-tab="aligned"');
  });

  it("narrows to one stage, and ignores a stage nobody recognises", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue(rows);

    const narrowed = await render({ stage: "connected" });
    expect((listSectionOrEmpty(narrowed).match(/data-instance="/g) ?? []).length).toBe(1);
    expect(listSection(narrowed)).toContain('data-instance-stage="connected"');

    const unrecognised = await render({ stage: "aligned" });
    expect((listSectionOrEmpty(unrecognised).match(/data-instance="/g) ?? []).length).toBe(
      rows.length,
    );
  });

  it("searches the name, the template and either party, and says what it kept", async () => {
    currentUser.mockResolvedValue(signedIn);
    listRelationshipCards.mockResolvedValue(rows);

    const byPerson = await render({ q: "priya" });
    expect((listSectionOrEmpty(byPerson).match(/data-instance="/g) ?? []).length).toBe(1);
    expect(textOf(byPerson)).toContain("Showing 1 of 3");

    const nothing = await render({ q: "nobody" });
    expect(nothing).toContain('data-stage-empty="search"');
    expect(textOf(nothing)).toContain("No relationship matches this search.");
  });
});
