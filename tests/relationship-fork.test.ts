/**
 * The Counterparty forks a relationship's template into one of their own (#785).
 *
 * #784 removed the wrong door: a relationship no longer puts a platform template into My Templates,
 * and `duplicateTemplate` copies a built-in or your own work and nothing else (`canUseTemplate` is
 * the public library's guard and has to keep refusing strangers). So the one case #785 is actually
 * about — **a party who does not own the words they were invited on** — was the one case that
 * failed, because a relationship's template is a private copy its initiator authored and no library
 * read lists it for anybody else.
 *
 * Three claims, and each is a way the fix could have been wrong:
 *
 *   the seat        two accounts: the initiator's relationship, the Counterparty's fork, and the
 *                   new `record`'s `author_user_id` is the **Counterparty's**. A fork that copied
 *                   the initiator's authorship would hand the copy back to the person who already
 *                   had it.
 *   the refusal     a stranger is still refused, with the family's own code
 *                   (`template-not-yours`) — the guard was narrowed to seat membership, not deleted.
 *                   The statements prove nothing was written.
 *   the pin         the fork reads `relationship.template_version_id`'s payload. A superseded
 *                   version forked after the author published a newer one yields the **superseded**
 *                   words, and the source `record`'s id appears in no statement at all — the live
 *                   template row is not a source this write can reach.
 *
 * **The client is a stub, on purpose**, and this one is a small model rather than a script of
 * answers: the gate is database-free (`docs/operations/gate.md`), and a fork's whole claim is that the rows it
 * wrote say what the fixture said — so the stub keeps `record`/`item`/`template_version` rows and
 * lets `writeFirstVersion()` read back what the transaction just wrote, exactly as production does.
 * The live proof is `pnpm db:verify` and a two-account probe on a branch, not this file.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Assessment } from "@/content/assessment";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { canUseTemplate } from "@/lib/flow/template-library";
import type { MemberRelationshipView } from "@/lib/member/relationships";

/* ------------------------------------------------------------------ *\
 * The two accounts, and the relationship between them
 * ------------------------------------------------------------------ */

const INITIATOR = "account-a-avery";
const COUNTERPARTY = "account-b-blake";
const STRANGER = "account-c-casey";
const RELATIONSHIP_ID = "relationship-fork-test";

/** The template the relationship's copy was configured from, cloned so the title is this file's. */
function templateFixture(title: string, prompts: readonly string[]): Assessment {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the fork test's template fixture is missing");
  return {
    ...found,
    title,
    summary: `${prompts.length} Aspects, as the pair were asked them.`,
    items: prompts.map((prompt, index) => {
      const base = found.items[index % found.items.length];
      if (base === undefined) throw new Error("the fork test's template has no Items");
      return { ...base, id: `aspect-${String(index + 1)}`, prompt };
    }),
  };
}

/** The words v1 of the relationship's template holds — what the pair was invited on. */
const V1 = templateFixture("Our Weekly Reset", [
  "How often do we check in?",
  "Who plans the weekend?",
  "How is money talked about?",
]);

/** The author's live template *after* the edit: two Aspects, and the first one reworded. */
const V2 = templateFixture("Our Weekly Reset, revised", [
  "How often do we really check in?",
  "Who plans the weekend?",
]);

/* ------------------------------------------------------------------ *\
 * The stub — a small model of the rows a fork touches
 * ------------------------------------------------------------------ */

interface StoredRecord {
  readonly id: string;
  readonly slug: string;
  readonly record_type: string;
  readonly status: string;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly author_user_id: string | null;
  readonly owner_user_id: string | null;
  readonly visibility: string;
}

interface StoredItem {
  readonly record_id: string;
  readonly item_id: string;
  readonly position: number;
  readonly prompt: string;
  readonly scale_kind: string;
  readonly left_value: string;
  readonly right_value: string;
}

interface StoredVersion {
  readonly id: string;
  readonly template_record_id: string;
  readonly version: number;
  readonly payload: Assessment;
  readonly superseded_at: string | null;
}

const stub = vi.hoisted(() => {
  interface Call {
    readonly text: string;
    readonly values: readonly unknown[];
  }

  const calls: Call[] = [];

  const state = {
    /** The seat rows: `null` until the two-account case binds them. */
    parties: [] as { relationship_id: string; user_id: string }[],
    /** `relationship.template_version_id` — the pin. */
    bound_version_id: "",
    versions: [] as StoredVersion[],
    records: [] as StoredRecord[],
    items: [] as StoredItem[],
    /** The version rows the transaction wrote, as the payload it bound. */
    version_writes: [] as { template_record_id: string; version: number; payload: unknown }[],
    /** The slug the next `INSERT INTO record` will collide with, for the retry loop. */
    taken_slugs: [] as string[],
  };

  function narrow(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  async function query(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: unknown[]; rowCount: number }> {
    calls.push({ text, values });
    const sql = narrow(text);

    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    // The seat and the pin, in one read: `WHERE rel.id = $1 AND (<party predicate>)`.
    if (sql.startsWith("SELECT tv.payload") && sql.includes("FROM relationship rel")) {
      const [relationshipId, viewer] = values as [string, string];
      const isParty =
        viewer === "account-a-avery" ||
        state.parties.some(
          (row) => row.relationship_id === relationshipId && row.user_id === viewer,
        );
      if (!isParty) return { rows: [], rowCount: 0 };
      const bound = state.versions.find((row) => row.id === state.bound_version_id);
      return { rows: [{ payload: bound?.payload ?? null }], rowCount: 1 };
    }

    // #785 criterion 5 — "do I already have a template with this title".
    if (sql.startsWith("SELECT r.id, r.slug") && sql.includes("r.author_user_id = $1")) {
      const [author, title] = values as [string, string];
      const found = state.records.find(
        (row) =>
          row.record_type === "assessment" && row.author_user_id === author && row.title === title,
      );
      if (found === undefined) return { rows: [], rowCount: 0 };
      const aspects = state.items.filter((item) => item.record_id === found.id).length;
      return { rows: [{ id: found.id, slug: found.slug, aspects }], rowCount: 1 };
    }

    if (sql.startsWith("INSERT INTO record")) {
      const [id, slug, date, title, summary, author] = values as [
        string,
        string,
        string,
        string,
        string,
        string,
      ];
      if (state.taken_slugs.includes(slug)) return { rows: [], rowCount: 0 };
      state.records.push({
        id,
        slug,
        record_type: "assessment",
        status: "published",
        date,
        title,
        summary,
        author_user_id: author,
        // The statement writes one actor into both columns: `VALUES (…, $6, $6, 'private')`.
        owner_user_id: author,
        visibility: "private",
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    if (sql.startsWith("INSERT INTO item")) {
      const [recordId, ids, positions, prompts, lefts, rights] = values as [
        string,
        readonly string[],
        readonly number[],
        readonly string[],
        readonly string[],
        readonly string[],
      ];
      ids.forEach((itemId, index) => {
        state.items.push({
          record_id: recordId,
          item_id: itemId,
          position: positions[index] ?? index + 1,
          prompt: prompts[index] ?? "",
          scale_kind: "score",
          left_value: lefts[index] ?? "",
          right_value: rights[index] ?? "",
        });
      });
      return { rows: [], rowCount: ids.length };
    }

    // `writeFirstVersion()` reads the rows the transaction just wrote, through the same statement
    // a reader uses — which is why this stub keeps rows rather than replaying answers.
    if (sql.startsWith("SELECT to_jsonb(r) AS record")) {
      const [recordId] = values as [string];
      const record = state.records.find((row) => row.id === recordId);
      if (record === undefined) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            record,
            items: state.items.filter((item) => item.record_id === recordId),
            options: [],
          },
        ],
        rowCount: 1,
      };
    }

    if (sql.startsWith("SELECT COALESCE(max(version), 0) + 1 AS next")) {
      const [templateRecordId] = values as [string];
      const existing = state.versions.filter((row) => row.template_record_id === templateRecordId);
      return { rows: [{ next: existing.length + 1 }], rowCount: 1 };
    }

    if (sql.startsWith("INSERT INTO template_version")) {
      const [id, templateRecordId, version, payload] = values as [
        string,
        string,
        number,
        string,
        string | null,
      ];
      const parsed = JSON.parse(payload) as Assessment;
      state.versions.push({
        id,
        template_record_id: templateRecordId,
        version,
        payload: parsed,
        superseded_at: null,
      });
      state.version_writes.push({ template_record_id: templateRecordId, version, payload: parsed });
      return { rows: [{ id }], rowCount: 1 };
    }

    if (sql.startsWith("UPDATE template_version SET superseded_at")) {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`the stub client has no answer for: ${sql.slice(0, 100)}`);
  }

  function reset(): void {
    calls.length = 0;
    state.parties = [{ relationship_id: RELATIONSHIP_ID, user_id: COUNTERPARTY }];
    state.versions = [
      // The version the relationship is bound to, and the live one the author published after it.
      // The bound row carries `superseded_at` on purpose: the pin is a fact about the row's id, not
      // about which row is newest.
      {
        id: "version-v1",
        template_record_id: "assessment-source",
        version: 1,
        payload: V1,
        superseded_at: "2026-10-02T09:00:00.000Z",
      },
      {
        id: "version-v2",
        template_record_id: "assessment-source",
        version: 2,
        payload: V2,
        superseded_at: null,
      },
    ];
    state.bound_version_id = "version-v1";
    state.records = [
      // The author's **live** working copy — two reworded Aspects, and the title v2 renamed. If the
      // fork read this row instead of the pin, every assertion below would fail.
      {
        id: "assessment-source",
        slug: "our-weekly-reset",
        record_type: "assessment",
        status: "published",
        date: "2026-10-01T09:00:00.000Z",
        title: V2.title,
        summary: V2.summary,
        author_user_id: INITIATOR,
        owner_user_id: INITIATOR,
        visibility: "private",
      },
    ];
    state.items = V2.items.map((item, index) => ({
      record_id: "assessment-source",
      item_id: item.id,
      position: index + 1,
      prompt: item.prompt,
      scale_kind: "score",
      left_value: item.leftValue,
      right_value: item.rightValue,
    }));
    state.version_writes = [];
    state.taken_slugs = [];
  }

  return { calls, state, query, reset, narrow };
});

const { currentUser } = vi.hoisted(() => ({
  currentUser: vi.fn(
    async (): Promise<{ userId: string; email: string; name: string } | null> => null,
  ),
}));

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({ query: stub.query, release: () => undefined }),
  }),
  queryRows: async () => {
    throw new Error("the fork path reads nothing on the pool");
  },
}));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { forkRelationshipTemplate } from "@/lib/flow/templates";
import { forkRelationshipTemplateAction } from "@/app/(mainlayout)/dashboard/relationships/actions";

beforeEach(() => {
  stub.reset();
  currentUser.mockReset();
  currentUser.mockResolvedValue(null);
});

/** The statements that write — the ones a refusal must have issued none of. */
function writes(): string[] {
  return stub.calls
    .map((call) => stub.narrow(call.text))
    .filter((sql) => /^(INSERT|UPDATE|DELETE)/.test(sql));
}

/* ------------------------------------------------------------------ *\
 * The seat: two accounts, one fork, the copy is the counterparty's
 * ------------------------------------------------------------------ */

describe("a party forks the relationship's template into their own (#785)", () => {
  it("writes a record authored and owned by the Counterparty", async () => {
    const result = await forkRelationshipTemplate(RELATIONSHIP_ID, COUNTERPARTY, {
      now: new Date("2026-11-12T10:00:00.000Z"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reused).toBe(false);
    expect(result.template.title).toBe("Our Weekly Reset (copy)");
    expect(result.template.aspectCount).toBe(3);

    const copy = stub.state.records.find((row) => row.id === result.template.id);
    expect(copy).toBeDefined();
    // The claim this card exists for: the copy is the **Counterparty's**, not the author's.
    expect(copy?.author_user_id).toBe(COUNTERPARTY);
    // …and it is theirs on both library reads: the library filters by author, `/dashboard/templates`
    // by owner, so a row missing either column would be invisible on one of the two screens.
    expect(copy?.owner_user_id).toBe(COUNTERPARTY);
    expect(copy?.visibility).toBe("private");
    expect(copy?.status).toBe("published");

    // A published template carries a v1, or no relationship could be started from it (#502b).
    const version = stub.state.version_writes.find(
      (row) => row.template_record_id === result.template.id,
    );
    expect(version?.version).toBe(1);
    expect(version?.payload).toMatchObject({ title: "Our Weekly Reset (copy)" });
    const bound = version?.payload as Assessment | undefined;
    expect(bound?.items).toHaveLength(3);

    // The relationship is untouched: no session, no party row, no version pin moves.
    expect(writes().some((sql) => /relationship|session|party/.test(sql))).toBe(false);
  });

  it("copies the Aspects, in the order they were asked", async () => {
    const result = await forkRelationshipTemplate(RELATIONSHIP_ID, COUNTERPARTY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const copied = stub.state.items
      .filter((item) => item.record_id === result.template.id)
      .sort((left, right) => left.position - right.position);
    expect(copied.map((item) => item.prompt)).toEqual(V1.items.map((item) => item.prompt));
    expect(copied.map((item) => item.item_id)).toEqual(V1.items.map((item) => item.id));
    expect(copied.map((item) => item.left_value)).toEqual(V1.items.map((item) => item.leftValue));
  });

  it("takes it twice without making a second row with the same title (#785 criterion 5)", async () => {
    const first = await forkRelationshipTemplate(RELATIONSHIP_ID, COUNTERPARTY);
    expect(first.ok).toBe(true);

    // The row the first click wrote is now in the table, so the second click finds it.
    stub.state.taken_slugs.push(
      stub.state.records.find((row) => row.id === (first.ok ? first.template.id : ""))?.slug ?? "",
    );
    const recordsBefore = stub.state.records.length;

    const second = await forkRelationshipTemplate(RELATIONSHIP_ID, COUNTERPARTY);
    expect(second.ok).toBe(true);
    if (!second.ok || !first.ok) return;
    expect(second.reused).toBe(true);
    expect(second.template.id).toBe(first.template.id);
    expect(stub.state.records).toHaveLength(recordsBefore);
  });
});

/* ------------------------------------------------------------------ *\
 * The refusal: the guard was narrowed, not deleted
 * ------------------------------------------------------------------ */

describe("a stranger is still refused", () => {
  it("answers template-not-yours and writes nothing", async () => {
    const result = await forkRelationshipTemplate(RELATIONSHIP_ID, STRANGER);

    expect(result).toEqual({ ok: false, code: "template-not-yours" });
    expect(writes()).toEqual([]);
    expect(stub.calls.map((call) => stub.narrow(call.text))).toContain("ROLLBACK");
  });

  it("refuses an id that names no relationship — without saying which", async () => {
    const result = await forkRelationshipTemplate("relationship-that-is-not-there", COUNTERPARTY);
    // The same code as the stranger's, on purpose: "that id is not a relationship" is a fact about
    // somebody else's row, and a 404-shaped answer is all this caller is owed.
    expect(result).toEqual({ ok: false, code: "template-not-yours" });
  });

  it("leaves the public library's guard exactly as it was", async () => {
    // The doomed-if of this card: `canUseTemplate` must still refuse another account's template.
    // It is not the function the fork asks, and it must not have learned about seats.
    expect(canUseTemplate(INITIATOR, COUNTERPARTY)).toBe(false);
    expect(canUseTemplate(INITIATOR, INITIATOR)).toBe(true);
    expect(canUseTemplate(null, STRANGER)).toBe(true);
  });
});

/* ------------------------------------------------------------------ *\
 * The pin: the version they agreed to, never the live template
 * ------------------------------------------------------------------ */

describe("the fork reads the version the pair were bound to", () => {
  it("yields the superseded payload, not the author's live template", async () => {
    const result = await forkRelationshipTemplate(RELATIONSHIP_ID, COUNTERPARTY, {
      now: new Date("2026-11-12T10:00:00.000Z"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The bound version is the *superseded* one; the live copy has two revisited Aspects and a new
    // title. The fork lands on the first pair of facts, because that is what the pair answered.
    expect(result.template.title).toBe("Our Weekly Reset (copy)");
    expect(result.template.aspectCount).toBe(3);

    const copied = stub.state.items.filter((item) => item.record_id === result.template.id);
    expect(copied.map((item) => item.prompt)).toEqual([
      "How often do we check in?",
      "Who plans the weekend?",
      "How is money talked about?",
    ]);

    // The strongest form of the same claim: the source record's id appears in **no statement**, so
    // the live template row (and its `item` rows) is not a source this write can reach at all.
    expect(stub.calls.some((call) => call.values.includes("assessment-source"))).toBe(false);
  });

  it("answers unknown-template when the relationship is bound to no version", async () => {
    stub.state.bound_version_id = "version-that-does-not-exist";

    const result = await forkRelationshipTemplate(RELATIONSHIP_ID, COUNTERPARTY);
    expect(result).toEqual({ ok: false, code: "unknown-template" });
    expect(writes()).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *\
 * The action: the actor is the session's, never the body's
 * ------------------------------------------------------------------ */

describe("the server action", () => {
  it("forks as the signed-in account", async () => {
    currentUser.mockResolvedValue({ userId: COUNTERPARTY, email: null, name: "Blake" } as never);

    const outcome = await forkRelationshipTemplateAction({
      relationshipId: RELATIONSHIP_ID,
      // A body that names somebody else is not a field this action reads.
      actorUserId: INITIATOR,
    } as never);

    expect(outcome).toMatchObject({ ok: true, title: "Our Weekly Reset (copy)", reused: false });
    // The guard's second parameter is the session's id — the one the seat predicate is asked about.
    const seat = stub.calls.find((call) => stub.narrow(call.text).startsWith("SELECT tv.payload"));
    expect(seat?.values[1]).toBe(COUNTERPARTY);
  });

  it("answers signed-out with no session", async () => {
    expect(await forkRelationshipTemplateAction({ relationshipId: RELATIONSHIP_ID })).toEqual({
      ok: false,
      code: "signed-out",
    });
    expect(stub.calls).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *\
 * The surface: one action, its words from the PageCopy
 * ------------------------------------------------------------------ */

/** A Counterparty's read of the relationship, in the shape `readMyRelationship()` builds. */
function relationshipView(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: RELATIONSHIP_ID,
    status: "active",
    viewerRole: "counterparty",
    isInitiator: false,
    templateId: "assessment-source",
    templateSlug: "assessment-source",
    title: V1.title,
    summary: V1.summary,
    createdAt: "2026-10-01T09:00:00.000Z",
    publishedAt: "2026-10-02T09:00:00.000Z",
    sessionRecordId: "session-fork-test",
    counterpartyName: "Blake",
    view: "invite-claimed",
    template: V1,
    aspectsEditable: false,
    publishable: false,
    hasMembership: false,
    completion: null,
    offersRepublish: false,
    canForkTemplate: true,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "none",
    trialEndsAt: null,
    membership: { state: "running", endedAt: null },
    lapseSentence: null,
    inviteLinkAvailable: false,
    ...overrides,
  } as MemberRelationshipView;
}

function forkHtml(view: MemberRelationshipView): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

const forkCopy = dashboardRelationshipDetailPageCopy.sections?.find(
  (section) => section.id === "fork",
);

describe("the relationship screen draws the action for the party who lacks the words", () => {
  it("renders one control, labelled by the fixture", () => {
    const html = forkHtml(relationshipView());
    expect(html).toContain('data-fork-template="true"');
    expect(html).toContain(forkCopy?.heading ?? "{{missing heading}}");
    expect(html).toContain(
      forkCopy?.items?.find((item) => item.id === "submit")?.label ?? "{{missing submit}}",
    );
    // The body says what the copy is not — the relationship is untouched — in the fixture's words.
    // (A fragment without an apostrophe: React escapes `'` in markup, and this asserts the fixture's
    // sentence reached the panel rather than pinning the escaping.)
    expect(html).toContain("the same words, the same answers, nothing re-sent");
  });

  it("draws nothing for the initiator, who already owns the template", () => {
    const html = forkHtml(
      relationshipView({ isInitiator: true, viewerRole: "initiator", canForkTemplate: false }),
    );
    expect(html).not.toContain('data-fork-template="true"');
  });

  it("offers no second door to the library when the flag is false", () => {
    // The flag is the only gate: a party who owns the copy sees no panel *and* no success link, so
    // the screen cannot promise a copy it did not offer.
    const html = forkHtml(relationshipView({ canForkTemplate: false }));
    expect(html).not.toContain("data-fork-template-open");
  });
});
