/**
 * The admin allowlist (#t_48103d6e): a verified email on `ADMIN_EMAILS` promotes, nothing else
 * can, and nothing can demote.
 *
 * The pure half (parse, match, brand gate, the derived handle and display name) is driven with no
 * environment and no database. The grant half is driven against a stubbed template and pool, so the
 * branch that must never exist — a write of `member` — is as unrepresentable in the test as it is
 * in the SQL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAllowlistOf,
  adminProfileDisplayName,
  adminProfileHandle,
  allowlistApplies,
  grantAdminIfAllowlisted,
  isAdminAllowlisted,
} from "@/lib/auth/admin-allowlist";

const { query, currentTemplate } = vi.hoisted(() => ({
  query: vi.fn(),
  currentTemplate: vi.fn((): string => "alignsynch"),
}));

vi.mock("@/lib/db/client", () => ({ getPool: () => ({ query }) }));
vi.mock("@/lib/flags", () => ({ currentTemplate }));

let log: ReturnType<typeof vi.fn>;
let error: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  currentTemplate.mockReturnValue("alignsynch");
  query.mockResolvedValue({ rowCount: 0, rows: [] });
  log = vi.spyOn(console, "info").mockImplementation(() => {});
  error = vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.ADMIN_EMAILS;
});

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  vi.restoreAllMocks();
});

describe("adminAllowlistOf", () => {
  it("is empty when the variable is unset or blank", () => {
    expect(adminAllowlistOf(undefined)).toEqual(new Set());
    expect(adminAllowlistOf("")).toEqual(new Set());
    expect(adminAllowlistOf("  ,, ")).toEqual(new Set());
  });

  it("trims, lowercases and drops empty entries", () => {
    expect(adminAllowlistOf(" Ada@X.com , bob@x.com ,, ")).toEqual(
      new Set(["ada@x.com", "bob@x.com"]),
    );
  });
});

describe("isAdminAllowlisted", () => {
  const allowlist = adminAllowlistOf("ada@x.com");

  it("matches case-insensitively and against whitespace", () => {
    expect(isAdminAllowlisted("ADA@X.COM", allowlist)).toBe(true);
    expect(isAdminAllowlisted("  ada@x.com  ", allowlist)).toBe(true);
  });

  it("does not match an address that is not on the list, or an empty list", () => {
    expect(isAdminAllowlisted("bob@x.com", allowlist)).toBe(false);
    expect(isAdminAllowlisted("ada@x.com", adminAllowlistOf(undefined))).toBe(false);
  });
});

describe("allowlistApplies", () => {
  it("is the brand gate: alignsynch only", () => {
    expect(allowlistApplies("alignsynch")).toBe(true);
    expect(allowlistApplies("quizhub")).toBe(false);
    expect(allowlistApplies("")).toBe(false);
  });
});

describe("adminProfileHandle", () => {
  it("prefers the email's local part", () => {
    expect(adminProfileHandle("ada.lovelace@x.com", "usr_abc")).toBe("ada-lovelace");
    expect(adminProfileHandle("ada@x.com", "usr_abc")).toBe("ada");
  });

  it("falls back to a slug of the user id when the local part is unusable", () => {
    // "a" is below the 3-character floor.
    expect(adminProfileHandle("a@x.com", "usr-abc-123")).toBe("usr-abc-123");
    // No usable part at all ends on the reserved-safe `admin-` prefix.
    expect(adminProfileHandle("!", "!")).toBe("admin-user");
  });

  it("never returns a reserved profile-namespace word", () => {
    expect(adminProfileHandle("settings@x.com", "usr_abc")).toBe("usr-abc");
  });
});

describe("adminProfileDisplayName", () => {
  it("uses the provider name, then the local part, then a fixed fallback", () => {
    expect(adminProfileDisplayName("Ada Lovelace", "ada@x.com")).toBe("Ada Lovelace");
    expect(adminProfileDisplayName("  ", "ada@x.com")).toBe("ada");
    expect(adminProfileDisplayName("  ", "")).toBe("Admin");
  });
});

describe("grantAdminIfAllowlisted", () => {
  it("does nothing on a non-alignsynch build, before parsing the allowlist", async () => {
    currentTemplate.mockReturnValue("quizhub");
    process.env.ADMIN_EMAILS = "ada@x.com";

    await grantAdminIfAllowlisted({ userId: "auth-user-1", email: "ada@x.com", name: "Ada" });

    expect(query).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("does nothing when the allowlist is unset — no error, no grant", async () => {
    await grantAdminIfAllowlisted({ userId: "auth-user-1", email: "ada@x.com", name: "Ada" });

    expect(query).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("does nothing when the email is not on the list", async () => {
    process.env.ADMIN_EMAILS = "admin@x.com";

    await grantAdminIfAllowlisted({ userId: "auth-user-1", email: "ada@x.com", name: "Ada" });

    expect(query).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it("promotes and logs the exact grant line when the statement returns the row", async () => {
    process.env.ADMIN_EMAILS = "ada@x.com";
    query.mockResolvedValue({ rowCount: 1, rows: [] });

    await grantAdminIfAllowlisted({ userId: "auth-user-1", email: "ada@x.com", name: "Ada" });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("INSERT INTO user_profile");
    expect(query.mock.calls[0][0]).toContain("role = 'admin'");
    expect(query.mock.calls[0][0]).toContain("role <> 'admin'");
    expect(log).toHaveBeenCalledWith("admin granted to ada@x.com via allowlist");
  });

  it("leaves an existing admin alone: the statement answers nothing, so no log", async () => {
    process.env.ADMIN_EMAILS = "ada@x.com";
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    await grantAdminIfAllowlisted({ userId: "auth-user-1", email: "ada@x.com", name: "Ada" });

    expect(query).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it("creates the row for a brand-new admin, with a derived handle and display name", async () => {
    process.env.ADMIN_EMAILS = "ada.lovelace@x.com";
    query.mockResolvedValue({ rowCount: 1, rows: [] });

    await grantAdminIfAllowlisted({
      userId: "usr_abc",
      email: "ada.lovelace@x.com",
      name: "Ada Lovelace",
    });

    expect(query.mock.calls[0][1]).toEqual(["usr_abc", "ada-lovelace", "Ada Lovelace"]);
    expect(log).toHaveBeenCalledWith("admin granted to ada.lovelace@x.com via allowlist");
  });

  it("never writes `member`: every statement the grant issues names admin", async () => {
    process.env.ADMIN_EMAILS = "ada@x.com";
    query.mockResolvedValue({ rowCount: 1, rows: [] });

    await grantAdminIfAllowlisted({ userId: "usr_abc", email: "ada@x.com", name: "Ada" });

    for (const [sql] of query.mock.calls) {
      expect(sql).not.toMatch(/'member'/);
    }
  });

  it("retries once with a user-id handle when the email-derived one is taken", async () => {
    process.env.ADMIN_EMAILS = "ada.lovelace@x.com";
    query.mockRejectedValueOnce({ code: "23505" }).mockResolvedValue({ rowCount: 1, rows: [] });

    await grantAdminIfAllowlisted({
      userId: "usr_abc",
      email: "ada.lovelace@x.com",
      name: "Ada Lovelace",
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][1][1]).toBe("usr-abc");
    expect(log).toHaveBeenCalledWith("admin granted to ada.lovelace@x.com via allowlist");
  });

  it("fails closed: a database error is logged and the grant is simply not made", async () => {
    process.env.ADMIN_EMAILS = "ada@x.com";
    query.mockRejectedValue(new Error("connection refused"));

    await expect(
      grantAdminIfAllowlisted({ userId: "auth-user-1", email: "ada@x.com", name: "Ada" }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
