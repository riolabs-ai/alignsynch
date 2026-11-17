/**
 * Deleting an authored template (#743) — the one action archive cannot do.
 *
 * #743 was filed as "archive or delete" and the recheck found half of it already shipped:
 * `archiveTargetOf()` and the `status-archived` action have existed since #794. What was missing
 * is **delete**, and the three facts that make it safe are what these cases pin:
 *
 *   the permission   the author column, and nothing else. `authorshipOf()` is the module's one
 *                    rule, so a built-in (`NULL` author) and another account's row are refused
 *                    by the same comparison — and a built-in is not "mine" even though
 *                    `canUseTemplate` lets everybody *use* it, because using is not owning.
 *   the two refusals a draft a member never published is deletable; a template that was
 *                    published has a `template_version` row and one that was used has a
 *                    `session` row pointing at it, and both are foreign keys with no
 *                    `ON DELETE`. Refusing with a named code is the difference between
 *                    "archive it instead" and a 23503 the member reads as a 500.
 *   the blast radius **one** `DELETE FROM record`. `item` and `response_option` cascade from it
 *                    (`0001_content_model.sql`), and a relationship's own copy is a different
 *                    record reached through `relationship.template_id` — never this row.
 *
 * **The client is a stub, on purpose.** The gate is database-free (`docs/operations/gate.md`), so the SQL is
 * driven through a recording `PoolClient` and the claims are asserted on the statements it issued.
 * The live proof — the rows really gone, a started relationship still resolving its title and its
 * Aspects — is `tests/template-delete-live.test.ts`, which runs against a branch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LibraryTemplate } from "@/lib/flow/template-library";

/* ------------------------------------------------------------------ *\
 * The stub client
 * ------------------------------------------------------------------ */

const stub = vi.hoisted(() => {
  interface Call {
    readonly text: string;
    readonly values: readonly unknown[];
  }

  const calls: Call[] = [];

  /** The row the delete starts from; `null` is "no such template". */
  const state: {
    template: {
      readonly id: string;
      readonly slug: string;
      readonly title: string;
      readonly summary: string;
      readonly status: string;
      readonly author_user_id: string | null;
    } | null;
    /** Rows that point at the template: a session started from it, or a legacy `template_id`. */
    started: number;
    /** The highest `template_version.version` for it, or `null` for a never-published row. */
    version: number | null;
  } = {
    template: {
      id: "assessment-draft-mine",
      slug: "draft-mine",
      title: "Our Weekly Reset",
      summary: "Written in the app: 2 Aspects.",
      status: "draft",
      author_user_id: "account-a-avery",
    },
    started: 0,
    version: null,
  };

  /** `text` with runs of whitespace collapsed, so a match does not depend on the indentation. */
  function narrow(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  async function query(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    const sql = narrow(text);
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }
    if (sql.startsWith("SELECT r.id, r.slug, r.title")) {
      return { rows: state.template === null ? [] : [state.template], rowCount: 1 };
    }
    if (sql.includes("FROM session") && sql.includes("template_record_id = $1")) {
      return { rows: [{ started: state.started }], rowCount: 1 };
    }
    if (sql.startsWith("SELECT max(version)")) {
      return { rows: [{ version: state.version }], rowCount: 1 };
    }
    if (sql.startsWith("DELETE FROM record")) {
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`the stub client has no answer for: ${sql.slice(0, 90)}`);
  }

  function reset(): void {
    calls.length = 0;
    state.template = {
      id: "assessment-draft-mine",
      slug: "draft-mine",
      title: "Our Weekly Reset",
      summary: "Written in the app: 2 Aspects.",
      status: "draft",
      author_user_id: "account-a-avery",
    };
    state.started = 0;
    state.version = null;
  }

  return { calls, state, query, reset, narrow };
});

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({
      query: stub.query,
      release: () => undefined,
    }),
  }),
  queryRows: async () => {
    throw new Error("the delete path reads nothing on the pool");
  },
}));

/**
 * **The endpoint and the library page those mocks served are gone** (#1109): the delete route and
 * the row menu that posted to it retired with `/templates/relationship`. What is left is the writer
 * this file exists for — `deleteTemplate()`'s referential rule — which the member's own
 * `deleteMyTemplate()` mirrors in `lib/member/templates.ts`.
 */
import { deleteTemplate } from "@/lib/flow/templates";

const ACCOUNT_A = "account-a-avery";
const ACCOUNT_B = "account-b-rowan";
const TEMPLATE = "assessment-draft-mine";

/** The statements the transaction issued, narrowed once so a match reads as SQL. */
function statements(pattern: RegExp) {
  return stub.calls.filter((call) => pattern.test(stub.narrow(call.text)));
}

beforeEach(() => {
  vi.clearAllMocks();
  stub.reset();
});

describe("deleting a template you wrote", () => {
  it("deletes the record in one statement, and item rows with it through the cascade", async () => {
    const result = await deleteTemplate(TEMPLATE, ACCOUNT_A);

    expect(result).toEqual({
      ok: true,
      template: { id: TEMPLATE, title: "Our Weekly Reset" },
    });

    const deletes = statements(/^DELETE /);
    expect(deletes).toHaveLength(1);
    // One statement, keyed on this one record — not a second one that reaches an item row or
    // another record. `item` and `response_option` cascade from `record` (0001), and a
    // relationship's copy is a different record entirely.
    expect(stub.narrow(deletes[0].text)).toBe("DELETE FROM record WHERE id = $1");
    expect(deletes[0].values).toEqual([TEMPLATE]);
    expect(statements(/^DELETE FROM (item|response_option|relationship|session)/)).toHaveLength(0);
  });

  it("commits the transaction and never rolls it back on the happy path", async () => {
    await deleteTemplate(TEMPLATE, ACCOUNT_A);
    expect(statements(/^BEGIN$/)).toHaveLength(1);
    expect(statements(/^COMMIT$/)).toHaveLength(1);
    expect(statements(/^ROLLBACK$/)).toHaveLength(0);
  });

  it("refuses another account's template and writes nothing", async () => {
    const result = await deleteTemplate(TEMPLATE, ACCOUNT_B);

    expect(result).toEqual({ ok: false, code: "template-not-yours" });
    expect(statements(/^DELETE /)).toHaveLength(0);
    expect(statements(/^COMMIT$/)).toHaveLength(0);
  });

  it("refuses a built-in, because using a template is not owning it", async () => {
    stub.state.template = {
      id: "assessment-relationship-basics",
      slug: "relationship-basics",
      title: "Relationship Basics",
      summary: "The platform's.",
      status: "published",
      author_user_id: null,
    };

    const result = await deleteTemplate("assessment-relationship-basics", ACCOUNT_A);

    expect(result).toEqual({ ok: false, code: "template-not-yours" });
    expect(statements(/^DELETE /)).toHaveLength(0);
  });

  it("answers `unknown-template` for an id that names no template, and writes nothing", async () => {
    stub.state.template = null;

    const result = await deleteTemplate("assessment-nope", ACCOUNT_A);

    expect(result).toEqual({ ok: false, code: "unknown-template" });
    expect(statements(/^DELETE /)).toHaveLength(0);
  });

  it("refuses a template a relationship was started from, and names the refusal", async () => {
    stub.state.started = 2;

    const result = await deleteTemplate(TEMPLATE, ACCOUNT_A);

    expect(result).toEqual({ ok: false, code: "template-has-relationships" });
    expect(statements(/^DELETE /)).toHaveLength(0);
  });

  it("refuses a published template on its version row, and writes nothing", async () => {
    stub.state.version = 3;

    const result = await deleteTemplate(TEMPLATE, ACCOUNT_A);

    expect(result).toEqual({ ok: false, code: "template-has-versions" });
    expect(statements(/^DELETE /)).toHaveLength(0);
  });

  it("asks about relationships before versions, so the more specific refusal is the one a member reads", async () => {
    // A legacy row answers both: a relationship points at it *and* 0026 backfilled a version for
    // it. "Archive it, relationships keep working" is the better sentence, so it is asked first.
    stub.state.started = 1;
    stub.state.version = 1;

    const result = await deleteTemplate(TEMPLATE, ACCOUNT_A);

    expect(result).toEqual({ ok: false, code: "template-has-relationships" });
  });
});
