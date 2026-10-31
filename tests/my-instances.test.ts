/**
 * `/assessment/instances` — the list is the caller's own (#213).
 *
 * Four claims, each one a line of the card:
 *
 *   * signed out, the page redirects to `/login?next=<this route>` and the intended path survives
 *     the round trip (`loginPathFor` is shell-free, so it runs here);
 *   * signed in, the read is called with the session's own user id — the account the auth server
 *     resolved, never a name, a `searchParams` value or a header;
 *   * an admin is not widened: there is no role in this path at all, which is asserted against
 *     the page's source with the comments stripped first, because the module explains at length
 *     that it reads none of those and an assertion matching its own prose would fail on the
 *     explanation rather than on a regression;
 *   * a row says only where the instance stands. The rendered row for an instance where the other
 *     party has not answered is checked as *text*: no digit, no "Gap", no count.
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
import { MY_INSTANCES_PATH, instancePath } from "@/lib/flow/paths";
import {
  MY_INSTANCE_STATES,
  UNLOCK_MARKS,
  myInstanceStateOf,
  unlockMarkOf,
  type MyInstanceProgress,
} from "@/lib/flow/state";
import type { MyInstance } from "@/lib/db/my-instances";

const { redirect, currentUser, listMyInstances } = vi.hoisted(() => ({
  redirect: vi.fn((to: string): never => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  currentUser: vi.fn(
    async (): Promise<{ userId: string; email: string; name: string } | null> => null,
  ),
  listMyInstances: vi.fn(async (_userId: string): Promise<MyInstance[]> => []),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/db/my-instances", () => ({ listMyInstances }));

import MyInstancesPage from "@/app/(mainlayout)/assessment/instances/page";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(null);
  listMyInstances.mockResolvedValue([]);
});

/** A row as the read produces it: counts already folded into the three states. */
const completeRow: MyInstance = {
  instanceRecordId: "assessment-instance-avery-rowan",
  slug: "avery-rowan",
  templateTitle: "Relationship Basics",
  viewerRole: "initiator",
  viewerName: "Avery",
  otherName: "Rowan",
  state: "complete",
  unlock: "seen",
};

/** The viewer has answered every Aspect, the instance is not complete, so the other has not. */
const awaitingRow: MyInstance = {
  instanceRecordId: "assessment-instance-marco-priya",
  slug: "marco-priya-1a2b3c4d",
  templateTitle: "Staff & Manager",
  viewerRole: "initiator",
  viewerName: "Marco",
  otherName: "Priya",
  state: "awaiting-other",
  unlock: "seen",
};

/**
 * Complete, and this party has not opened it since (#252) — the row the card exists for: the
 * Counterparty submitted while the Initiator was away.
 */
const completeUnseenRow: MyInstance = {
  ...completeRow,
  unlock: "unseen",
};

async function render(): Promise<string> {
  return renderToStaticMarkup(await MyInstancesPage());
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
  const match = html.match(/<section data-my-instances="true">[\s\S]*?<\/section>/);
  if (match === null) throw new Error("the list band did not render");
  return match[0];
}

/** The one `<li>` in the list band whose state is `state`, as text. */
function rowText(html: string, state: string): string {
  const rows = listSection(html).match(/<li[\s\S]*?<\/li>/g) ?? [];
  const found = rows.find((row) => row.includes(`data-instance-state="${state}"`));
  if (found === undefined) throw new Error(`no rendered row with state "${state}"`);
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
    expect(listMyInstances).not.toHaveBeenCalled();
  });
});

describe("signed in", () => {
  it("reads with the session's own user id and nothing else", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockResolvedValue([completeRow]);

    await render();

    expect(listMyInstances).toHaveBeenCalledTimes(1);
    expect(listMyInstances).toHaveBeenCalledWith("52dfe892-be03-421b-ac34-1b35d74633dc");
  });

  it("renders one row per instance, naming both parties and which one is you", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockResolvedValue([completeRow]);

    const html = await render();
    const rows = listSection(html).match(/<li[\s\S]*?<\/li>/g) ?? [];

    expect(html).toContain('data-my-instances="true"');
    expect(rows).toHaveLength(1);
    expect(rowText(html, "complete")).toContain("Relationship Basics");
    expect(rowText(html, "complete")).toContain("Avery");
    expect(rowText(html, "complete")).toContain("Rowan");
    expect(rowText(html, "complete")).toContain("You have both answered");
    expect(html).toContain(`href="${instancePath(completeRow.instanceRecordId)}"`);
    expect(html).not.toContain("data-empty-state");
  });

  it("shows the empty state, with a way to start one, when the account is in nothing", async () => {
    currentUser.mockResolvedValue({
      userId: "e21da3bd-6ee8-4af9-8fef-ba05e17bb1ec",
      email: "admin@demo.alignsynch.test",
      name: "Admin",
    });
    listMyInstances.mockResolvedValue([]);

    const html = await render();
    const text = textOf(html);

    expect(html).toContain('data-empty-state="true"');
    expect(text).toContain("You are not in an assessment yet");
    expect(text).toContain("An instance starts when you pick a template and invite someone");
    expect(html).toContain('href="/assessment"');
    // An empty list is not a blank page and not an error panel.
    expect(html).not.toContain("data-my-instances-unreadable");
  });

  it("says only that the other party is still to answer — no score, no count, no Gap", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockResolvedValue([awaitingRow]);

    const row = rowText(await render(), "awaiting-other");

    expect(row).toContain("Waiting for Priya to answer.");
    expect(row).not.toMatch(/\d/);
    expect(row).not.toContain("Gap");
    expect(row).not.toContain("answered 5");
  });

  it("prints the database layer's own sentence when the read does not answer", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockRejectedValueOnce(
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
    listMyInstances.mockRejectedValueOnce(new Error('instance "x" does not satisfy the model'));

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
  const read = codeOf("lib/db/my-instances.ts");

  it("takes no search param, header or cookie of its own", () => {
    for (const forbidden of [/searchParams/, /params:/, /\bheaders\(/, /\bcookies\(/]) {
      expect(page).not.toMatch(forbidden);
    }
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

  it("filters the statement by the bound account and by nothing else", () => {
    const where = read.match(/WHERE[\s\S]*?ORDER BY/)?.[0] ?? "";
    expect(where).toContain("vp.user_id = $1");
    // One parameter: the session's user id. There is no second value that could widen the list.
    expect(read).toContain("queryRows<MyInstanceRow>(MY_INSTANCES_SQL, [userId])");
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

  it("draws the fixture's one line on a complete row nobody has opened, and quotes it", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockResolvedValue([completeUnseenRow]);

    const html = await render();
    const row = rowText(html, "complete");

    expect(html).toContain('data-instance-marker="unseen"');
    expect(row).toContain("Complete since you last looked — open it to read the Gap");
    // The marker adds no number, no score and no Gap value to the row.
    expect(row).not.toMatch(/\d/);
  });

  it("is absent on a complete row that party has already opened, which still says complete", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockResolvedValue([completeRow]);

    const html = await render();
    const row = rowText(html, "complete");

    expect(row).toContain("You have both answered");
    expect(html).not.toContain("data-instance-marker");
    expect(html).not.toContain("Complete since you last looked");
    expect(listSection(html)).toContain('data-instance-unlock="seen"');
  });

  it("is drawn on the row, never as a toast, a modal or a count in the header", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockResolvedValue([completeUnseenRow]);

    const html = await render();
    const marker = html.match(/<p data-instance-marker="unseen"[\s\S]*?<\/p>/)?.[0] ?? "";

    // It is a row-level `<p>`; the page's heading area carries no marker and no digit.
    expect(marker).not.toBe("");
    expect(marker).toContain("Complete since you last looked");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('role="alert"');
  });

  it("keeps the two parties' rows independent — one instance, two different marks", async () => {
    const initiatorRow: MyInstance = {
      ...completeUnseenRow,
      viewerRole: "initiator",
      viewerName: "Avery",
      otherName: "Rowan",
    };
    const counterpartyRow: MyInstance = {
      ...completeRow,
      instanceRecordId: "assessment-instance-avery-rowan",
      viewerRole: "counterparty",
      viewerName: "Rowan",
      otherName: "Avery",
    };

    // The read is per account: this render is the Initiator's list and the next is the
    // Counterparty's, from the same instance and the same two opinions.
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listMyInstances.mockResolvedValue([initiatorRow]);
    const initiatorHtml = await render();

    currentUser.mockResolvedValue({
      userId: "9c3f1a02-77c1-4f6e-9a8b-2f4b1c7d5e10",
      email: "counterparty@demo.alignsynch.test",
      name: "Rowan",
    });
    listMyInstances.mockResolvedValue([counterpartyRow]);
    const counterpartyHtml = await render();

    expect(initiatorHtml).toContain('data-instance-marker="unseen"');
    expect(initiatorHtml).toContain("Complete since you last looked");
    expect(counterpartyHtml).not.toContain("data-instance-marker");
    expect(counterpartyHtml).not.toContain("Complete since you last looked");
    expect(counterpartyHtml).toContain("You have both answered");
  });

  it("has its own copy band, so no marker string is a state sentence", () => {
    const marker = myInstancesPageCopy.sections?.find((section) => section.id === "marker");
    const states = myInstancesPageCopy.sections?.find((section) => section.id === "state");
    const ids = (marker?.items ?? []).map((item) => item.id);

    expect(ids).toEqual([...UNLOCK_MARKS.filter((mark) => mark === "unseen")]);
    expect((states?.items ?? []).map((item) => item.id)).not.toContain("unseen");
  });
});
