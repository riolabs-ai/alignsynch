/**
 * `/admin/audit` — the log's filter, its statement, its redaction and its row parser (#501b).
 *
 * Three claims, and none of them needs a database:
 *
 *   1. **The filters filter.** Three rows are written through the *real* `act()` (a fake
 *      connection stands in for Postgres, the way `tests/admin-act.test.ts` does), and then the
 *      view is read through the *real* statement — `readAuditLog` is handed a `query` that decodes
 *      the `WHERE` clauses the module emitted. A clause the decoder does not recognise throws, so
 *      this cannot pass by the fake quietly ignoring a filter. Each axis is asserted by the row ids
 *      it keeps, not only by a count, because a filter that matches nothing renders fine.
 *   2. **A value is not rendered raw.** `auditChangeOf()` returns keys and a truncation; a party
 *      name in a `before` object reaches the table as 48 characters and a click.
 *   3. **The statement binds its values.** The filter comes from a URL, so the text of the
 *      statement is asserted to carry no address, no action and no table — only `$n`.
 *
 * The page's own gate (`support` gets a 404 and touches nothing) is the next file,
 * `tests/admin-audit-page.test.ts`: it replaces this module's `readAuditLog`, and a module mock
 * would have stolen the real one out from under these cases.
 */
import { describe, expect, it } from "vitest";

import type { ActSql } from "@/lib/admin/act";
import { act, transactionRunner } from "@/lib/admin/act";
import {
  activeAuditAxes,
  auditActorIdentity,
  auditActorRole,
  auditChangeOf,
  auditFilterHref,
  auditFilterIsEmpty,
  auditFilterWithout,
  type AuditFilter,
  auditSelect,
  auditTargetHref,
  auditTargetLabel,
  NO_AUDIT_FILTER,
  parseAuditFilter,
} from "@/lib/admin/audit-log";
import { auditRowOf, type AuditReadDeps, readAuditLog } from "@/lib/db/admin-audit";

/* ------------------------------------------------------------------ *
 * A ledger: the one table `act()` writes, with the test's own clock
 * ------------------------------------------------------------------ */

interface LedgerRow {
  readonly id: string;
  readonly actorUserId: string;
  readonly actorRole: string | null;
  readonly action: string;
  readonly targetTable: string;
  readonly targetId: string;
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly at: string;
}

/**
 * A connection that is one `admin_action` table and the role lookup in front of it.
 *
 * `now` is set by the test before each `act()` call because the real column defaults to `now()`,
 * and a seeded row's instant is the only thing an audit test can be wrong about silently.
 */
class Ledger implements ActSql {
  readonly rows: LedgerRow[] = [];
  readonly roles = new Map<string, string>();
  readonly statements: string[] = [];
  now = "2026-10-29T00:00:00.000Z";

  async query<R>(text: string, values: readonly unknown[] = []): Promise<{ rows: readonly R[] }> {
    this.statements.push(text);
    const head = text.trimStart().toUpperCase();

    if (head === "BEGIN" || head === "COMMIT" || head === "ROLLBACK") return { rows: [] };

    if (head.startsWith("SELECT ROLE")) {
      const role = this.roles.get(String(values[0]));
      return { rows: (role === undefined ? [] : [{ role }]) as unknown as readonly R[] };
    }

    if (head.startsWith("INSERT INTO ADMIN_ACTION")) {
      const id = `action-${this.rows.length + 1}`;
      this.rows.push({
        id,
        actorUserId: String(values[0]),
        actorRole: values[1] === null ? null : String(values[1]),
        action: String(values[2]),
        targetTable: String(values[3]),
        targetId: String(values[4]),
        reason: String(values[5]),
        before: values[6] === null ? null : JSON.parse(String(values[6])),
        after: values[7] === null ? null : JSON.parse(String(values[7])),
        at: this.now,
      });
      return { rows: [{ id }] as unknown as readonly R[] };
    }

    return { rows: [] };
  }

  release(): void {}
}

/* ------------------------------------------------------------------ *
 * A reader: the real statement, decoded
 * ------------------------------------------------------------------ */

type Clause = (
  row: LedgerRow & { actorEmail: string | null },
  params: readonly unknown[],
) => boolean;

/**
 * Decode the `WHERE` of the statement `auditSelect()` emitted.
 *
 * Every clause is one shape, and an unrecognised one throws: a filter that reached the SQL as text
 * this decoder cannot read is exactly the failure this test exists to catch, so failing loudly is
 * the point rather than a limitation.
 */
function decodeWhere(text: string, values: readonly unknown[]): readonly Clause[] {
  const where = /^\s*WHERE (.+)$/m.exec(text)?.[1];
  if (where === undefined) return [];

  const param = (index: string) => values[Number(index) - 1];

  return where.split(" AND ").map((clause) => {
    const trimmed = clause.trim();

    const actorAndEmail =
      /^\(a\.actor_user_id = \$(\d+) OR lower\(u\.email\) = lower\(\$(\d+)\)\)$/.exec(trimmed);
    if (actorAndEmail !== null) {
      const id = param(actorAndEmail[1] ?? "");
      const email = param(actorAndEmail[2] ?? "");
      return (row) =>
        row.actorUserId === id || row.actorEmail?.toLowerCase() === String(email).toLowerCase();
    }

    const scalar = /^a\.(actor_user_id|action|target_table) = \$(\d+)$/.exec(trimmed);
    if (scalar !== null) {
      const column = scalar[1];
      const wanted = param(scalar[2] ?? "");
      return (row: LedgerRow) =>
        (column === "actor_user_id"
          ? row.actorUserId
          : column === "action"
            ? row.action
            : row.targetTable) === wanted;
    }

    const bound = /^a\.created_at (>=|<) \$(\d+)$/.exec(trimmed);
    if (bound !== null) {
      const at = Date.parse(String(param(bound[2] ?? "")));
      return (row: LedgerRow) =>
        bound[1] === ">=" ? Date.parse(row.at) >= at : Date.parse(row.at) < at;
    }

    throw new Error(`the fake cannot read the clause "${trimmed}" — the statement changed shape`);
  });
}

/** A database that answers the auth-schema probe, then the page's own statement. */
function reader(rows: readonly LedgerRow[], present: boolean) {
  const statements: { text: string; values: readonly unknown[] }[] = [];
  const deps: AuditReadDeps = {
    async query(text, values) {
      statements.push({ text, values });
      if (/to_regclass/.test(text)) return [{ present }];
      const clauses = decodeWhere(text, values);
      // The statement's own shape and order — snake_case columns, a `Date` for the instant, newest
      // first — because that is what `pg` hands `auditRowOf()`. A fake that answered this module's
      // own camelCase rows would let a column rename pass this test and break the page.
      return rows
        .filter((row) => clauses.every((clause) => clause(withEmail(row), values)))
        .map((row) => ({
          id: row.id,
          actor_user_id: row.actorUserId,
          actor_email: present ? (ADDRESSES[row.actorUserId] ?? null) : null,
          actor_role: row.actorRole,
          action: row.action,
          target_table: row.targetTable,
          target_id: row.targetId,
          reason: row.reason,
          before: row.before,
          after: row.after,
          created_at: new Date(row.at),
        }))
        .sort(
          (left, right) =>
            right.created_at.getTime() - left.created_at.getTime() ||
            right.id.localeCompare(left.id),
        );
    },
  };
  return { deps, statements };
}

/** The row as the statement selects it, with the address the join would have supplied. */
function withEmail(row: LedgerRow): LedgerRow & { actorEmail: string | null } {
  const address = ADDRESSES[row.actorUserId as keyof typeof ADDRESSES] ?? null;
  return { ...row, actorEmail: address };
}

const SUPPORT = "auth-support";
const ADMIN = "auth-admin";
const OWNER = "auth-owner";

const ADDRESSES: Record<string, string> = {
  [SUPPORT]: "support@example.com",
  [ADMIN]: "admin@example.com",
  [OWNER]: "owner@example.com",
};

/**
 * Three audited writes, one per actor, through `act()` — the real write path, so the rows this
 * test reads are the rows the app writes, down to the column order of the INSERT.
 */
async function seededLedger(): Promise<Ledger> {
  const ledger = new Ledger();
  ledger.roles.set(SUPPORT, "support");
  ledger.roles.set(ADMIN, "admin");
  ledger.roles.set(OWNER, "owner");

  const write = async (request: Parameters<typeof act>[0], at: string) => {
    ledger.now = at;
    await act(
      request,
      transactionRunner(async () => ledger),
    );
  };

  await write(
    {
      actorUserId: SUPPORT,
      action: "member.note",
      target: { table: "user_profile", id: "auth-member-1" },
      reason: "annotated at the member's request",
      mutate: async () => ({ before: { note: null }, after: { note: "called back" } }),
    },
    "2026-10-27T09:15:00.000Z",
  );

  await write(
    {
      actorUserId: ADMIN,
      action: "role.change",
      target: { table: "user_profile", id: "auth-member-2" },
      reason: "promoted after a reviewer asked",
      mutate: async () => ({ before: { role: "member" }, after: { role: "support" } }),
    },
    "2026-10-28T10:30:00.000Z",
  );

  await write(
    {
      actorUserId: OWNER,
      action: "instance.delete",
      target: { table: "session", id: "instance-1" },
      reason: "removed at the owner's request",
      mutate: async () => ({
        // A party's name in `before` is the case the screen must not print unopened.
        before: { name: "Avery Chen", status: "answering", seats: 2 },
        after: undefined,
      }),
    },
    "2026-10-29T11:45:00.000Z",
  );

  return ledger;
}

/* ------------------------------------------------------------------ *
 * The filter, as a URL
 * ------------------------------------------------------------------ */

describe("the audit filter", () => {
  it("reads the five axes a URL carries, and drops what the vocabulary does not know", () => {
    expect(
      parseAuditFilter({
        actor: `  ${ADMIN}  `,
        action: "role.change",
        table: "user_profile",
        from: "2026-10-28",
        to: "2026-10-29",
      }),
    ).toEqual({
      actor: ADMIN,
      action: "role.change",
      table: "user_profile",
      from: "2026-10-28",
      to: "2026-10-29",
    });

    // Unknown action, unknown table, impossible date, over-long actor: each axis is dropped, and
    // the others survive — a mistyped link renders the view it can rather than an error page.
    expect(
      parseAuditFilter({
        actor: "x".repeat(129),
        action: "role.rename",
        table: "gap",
        from: "2026-02-31",
        to: "yesterday",
      }),
    ).toEqual(NO_AUDIT_FILTER);

    // A repeated key takes the first value: the URL is a view, not a set.
    expect(parseAuditFilter({ action: ["invite.create", "role.change"] }).action).toBe(
      "invite.create",
    );
  });

  it("round-trips through an address, in a stable order, with no parameter it does not apply", () => {
    const href = auditFilterHref({
      actor: ADMIN,
      action: "role.change",
      table: "user_profile",
      from: "2026-10-28",
      to: "",
    });
    expect(href).toBe(
      "/admin/audit?actor=auth-admin&action=role.change&table=user_profile&from=2026-10-28",
    );

    // A chip drops its own axis and keeps every other one: narrowing a log one axis at a time
    // must not lose the earlier filters.
    expect(auditFilterWithout(parseAuditFilter({}), "actor")).toBe("/admin/audit");
    expect(
      auditFilterWithout(
        { actor: ADMIN, action: "role.change", table: "", from: "", to: "" },
        "action",
      ),
    ).toBe("/admin/audit?actor=auth-admin");

    expect(auditFilterIsEmpty(NO_AUDIT_FILTER)).toBe(true);
    expect(activeAuditAxes({ ...NO_AUDIT_FILTER, table: "session" })).toEqual(["table"]);
  });
});

/* ------------------------------------------------------------------ *
 * The statement
 * ------------------------------------------------------------------ */

describe("the audit statement", () => {
  it("binds every filter value, and interleaves no caller value into the text", () => {
    const statement = auditSelect(
      {
        actor: "avery@example.com",
        action: "role.change",
        table: "user_profile",
        from: "2026-10-28",
        to: "2026-10-29",
      },
      { withEmail: true },
    );

    expect(statement.text).not.toContain("avery@example.com");
    expect(statement.text).not.toContain("role.change");
    expect(statement.text).not.toContain("user_profile");
    expect(statement.text).toContain(
      'LEFT JOIN neon_auth."user" u ON u.id::text = a.actor_user_id',
    );
    expect(statement.text).toContain("lower(u.email) = lower($1)");

    // The `to` end is the midnight *after* the last day, so the day itself is inside the view.
    expect(statement.values).toEqual([
      "avery@example.com",
      "role.change",
      "user_profile",
      "2026-10-28T00:00:00.000Z",
      "2026-10-30T00:00:00.000Z",
      200,
    ]);
  });

  it("asks for no auth schema when the database has none", () => {
    const statement = auditSelect({ ...NO_AUDIT_FILTER, actor: ADMIN }, { withEmail: false });

    expect(statement.text).not.toContain("neon_auth");
    expect(statement.text).toContain("NULL::text AS actor_email");
    expect(statement.text).toContain("a.actor_user_id = $1");
    // The email arm is gone with the join: with no address anywhere, matching one would be a
    // clause that can only ever be false.
    expect(statement.text).not.toContain("lower(u.email)");

    const unfiltered = auditSelect(NO_AUDIT_FILTER, { withEmail: false });
    expect(unfiltered.text).not.toContain("WHERE");
    expect(unfiltered.text).toContain("ORDER BY a.created_at DESC");
    expect(unfiltered.values).toEqual([200]);
  });
});

/* ------------------------------------------------------------------ *
 * Three rows, one per actor — the acceptance's counts
 * ------------------------------------------------------------------ */

describe("each filter returns exactly its rows", () => {
  /** Read one view, newest first, as ids. */
  async function idsOf(filter: AuditFilter, options: { present?: boolean } = {}) {
    const ledger = await seededLedger();
    const { deps } = reader(ledger.rows, options.present ?? true);
    const rows = await readAuditLog(filter, deps);
    return rows.map((row) => row.id);
  }

  it("seeds one row per actor, each carrying the rung that actor held", async () => {
    const ledger = await seededLedger();
    expect(ledger.rows).toHaveLength(3);
    expect(ledger.rows.map((row) => [row.actorUserId, row.actorRole])).toEqual([
      [SUPPORT, "support"],
      [ADMIN, "admin"],
      [OWNER, "owner"],
    ]);

    const { deps } = reader(ledger.rows, true);
    const rows = await readAuditLog(NO_AUDIT_FILTER, deps);
    const [newest] = rows;
    if (newest === undefined) throw new Error("the unfiltered view answered no rows");
    expect(auditActorIdentity(newest)).toBe("owner@example.com");
    expect(auditActorRole(newest)).toBe("owner");
    // Newest first, which is the log's own order and the index's shape.
    expect(rows.map((row) => row.createdAt)).toEqual([
      "2026-10-29T11:45:00.000Z",
      "2026-10-28T10:30:00.000Z",
      "2026-10-27T09:15:00.000Z",
    ]);
  });

  it("counts every axis, and the counts are the rows the seeds put there", async () => {
    const cases: { readonly name: string; readonly filter: AuditFilter; readonly ids: string[] }[] =
      [
        { name: "no filter", filter: NO_AUDIT_FILTER, ids: ["action-3", "action-2", "action-1"] },
        {
          name: "actor = the support account's id",
          filter: { ...NO_AUDIT_FILTER, actor: SUPPORT },
          ids: ["action-1"],
        },
        {
          name: "actor = an address (the join's arm)",
          filter: { ...NO_AUDIT_FILTER, actor: "ADMIN@example.com" },
          ids: ["action-2"],
        },
        {
          name: "action = role.change",
          filter: { ...NO_AUDIT_FILTER, action: "role.change" },
          ids: ["action-2"],
        },
        {
          name: "table = user_profile",
          filter: { ...NO_AUDIT_FILTER, table: "user_profile" },
          ids: ["action-2", "action-1"],
        },
        {
          name: "from = 2026-10-28 (the day itself included)",
          filter: { ...NO_AUDIT_FILTER, from: "2026-10-28" },
          ids: ["action-3", "action-2"],
        },
        {
          name: "to = 2026-10-27 (the day itself included)",
          filter: { ...NO_AUDIT_FILTER, to: "2026-10-27" },
          ids: ["action-1"],
        },
        {
          name: "from = to = 2026-10-28",
          filter: { ...NO_AUDIT_FILTER, from: "2026-10-28", to: "2026-10-28" },
          ids: ["action-2"],
        },
        {
          name: "actor = admin, table = user_profile",
          filter: { ...NO_AUDIT_FILTER, actor: ADMIN, table: "user_profile" },
          ids: ["action-2"],
        },
        {
          name: "actor = an address this log never saw",
          filter: { ...NO_AUDIT_FILTER, actor: "nobody@example.com" },
          ids: [],
        },
      ];

    const measured: string[] = [];
    for (const query of cases) {
      const ids = await idsOf(query.filter);
      measured.push(`${query.name} → ${ids.length} (${ids.join(", ") || "none"})`);
      expect(ids, query.name).toEqual(query.ids);
    }
    // Printed so the card's handoff can paste the counts rather than restate them.
    for (const line of measured) console.log(`  ${line}`);
  });

  it("filters by user id alone on a database with no auth schema", async () => {
    expect(await idsOf({ ...NO_AUDIT_FILTER, actor: OWNER }, { present: false })).toEqual([
      "action-3",
    ]);
    // There is no address on such a database, so the actor column prints the id and says so.
    const ledger = await seededLedger();
    const { deps } = reader(ledger.rows, false);
    const rows = await readAuditLog({ ...NO_AUDIT_FILTER, actor: OWNER }, deps);
    expect(rows[0]?.actorEmail).toBeNull();
    const [only] = rows;
    if (only === undefined) throw new Error("the actor view answered no row");
    expect(auditActorIdentity(only)).toBe(OWNER);
  });
});

/* ------------------------------------------------------------------ *
 * before / after
 * ------------------------------------------------------------------ */

describe("a change is fields, never a blob", () => {
  it("splits a value into keys and truncates each one", () => {
    const fields = auditChangeOf({
      name: "Avery Chen",
      paragraph: "x".repeat(200),
      seats: 2,
    });

    expect(fields.map((field) => field.key)).toEqual(["name", "paragraph", "seats"]);
    expect(fields[0]).toEqual({
      key: "name",
      preview: "Avery Chen",
      full: "Avery Chen",
      truncated: false,
    });
    // A long value is 48 characters and an ellipsis; the full text is what a click opens.
    expect(fields[1]?.preview).toHaveLength(49);
    expect(fields[1]?.preview.endsWith("…")).toBe(true);
    expect(fields[1]?.truncated).toBe(true);
    expect(fields[1]?.full).toHaveLength(200);
  });

  it("says nothing, rather than the word null, when there was nothing there", () => {
    expect(auditChangeOf(null)).toEqual([]);
    expect(auditChangeOf(undefined)).toEqual([]);
    // An array is keyed by index and a scalar under `value`, so every row has the same shape.
    expect(auditChangeOf(["a", "b"]).map((field) => field.key)).toEqual(["0", "1"]);
    expect(auditChangeOf(true)).toEqual([
      { key: "value", preview: "true", full: "true", truncated: false },
    ]);
  });

  it("flattens a value so the preview is one line", () => {
    expect(auditChangeOf({ note: "line one\nline two" })[0]?.preview).toBe("line one line two");
  });
});

/* ------------------------------------------------------------------ *
 * A row, as the read parses it
 * ------------------------------------------------------------------ */

describe("a row the read cannot parse is a defect, not a blank cell", () => {
  const base = {
    id: "action-1",
    actor_user_id: "auth-1",
    actor_email: "avery@example.com",
    actor_role: "admin",
    action: "role.change",
    target_table: "user_profile",
    target_id: "auth-2",
    reason: "promoted after a reviewer asked",
    before: { role: "member" },
    after: { role: "admin" },
    created_at: new Date("2026-10-28T10:30:00.000Z"),
  };

  it("keeps the rung, the instant and both sides", () => {
    const row = auditRowOf(base);
    expect(row.actorRole).toBe("admin");
    expect(row.createdAt).toBe("2026-10-28T10:30:00.000Z");
    expect(row.before).toEqual({ role: "member" });
  });

  it("answers a rung this build does not know as 'not recorded'", () => {
    expect(auditRowOf({ ...base, actor_role: "root" }).actorRole).toBeNull();
    expect(auditRowOf({ ...base, actor_role: null }).actorRole).toBeNull();
  });

  it("answers a null reason as 'nobody stated one', and still refuses an empty string", () => {
    // `0038` dropped `NOT NULL` on purpose (#732): the Reason field was removed from twelve
    // screens, so a new row carries no reason and the read must not throw on it. `null` is that
    // absence; `""` is not — an empty string is neither a reason nor the absence of one, so a row
    // carrying one is still a defect rather than a blank the screen has to guess at.
    expect(auditRowOf({ ...base, reason: null }).reason).toBeNull();
    expect(auditRowOf({ ...base, reason: "promoted after a reviewer asked" }).reason).toBe(
      "promoted after a reviewer asked",
    );
    expect(() => auditRowOf({ ...base, reason: "" })).toThrow();
    expect(auditRowOf({ ...base, actor_email: null }).actorEmail).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Where a target lives
 * ------------------------------------------------------------------ */

describe("a target links only where an operator's click answers", () => {
  it("points a session at the registry and nothing else anywhere", () => {
    expect(auditTargetHref("session", "instance-1")).toBe("/admin/instances");
    // A `record` id is a quiz or a template, and the two live at different routes: a link that is
    // right half the time is worse than a cell that does not link.
    expect(auditTargetHref("record", "quiz-1")).toBeNull();
    expect(auditTargetHref("party", "party-1")).toBeNull();
    expect(auditTargetHref("gap", "x")).toBeNull();
    expect(auditTargetLabel("session", "instance-1")).toBe("session#instance-1");
  });
});
