/**
 * The admin invitation as a value (#501): minting, expiry, the token comparison, and the two
 * invitations one address may hold.
 *
 * The schema half is asserted here too, by reading the migration's own text — the same technique
 * `tests/billing-plan-migration.test.ts` uses for the price rows, and for the same reason: the
 * property that makes "two invites for one email both stay valid" true is the *absence* of a
 * unique constraint, and an absence is invisible to every test that only exercises the functions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { hashToken, INVITE_TTL_MS } from "@/lib/flow/tokens";
import {
  ADMIN_INVITE_ROLES,
  type AdminInvite,
  inviteIsLive,
  inviteMatchesToken,
  liveInvitesFor,
  mintAdminInvite,
  zAdminInvite,
} from "@/lib/admin/invites";

const NOW = new Date("2026-11-03T12:00:00.000Z");
const YESTERDAY = new Date("2026-11-02T12:00:00.000Z");
const TOMORROW = new Date("2026-11-04T12:00:00.000Z");
const NEXT_WEEK = new Date("2026-11-10T12:00:00.000Z");

/** One row as the write path would store it, defaulted to the admin role and a live window. */
function invite(overrides: Partial<AdminInvite> = {}): AdminInvite {
  return {
    id: "invite-1",
    email: "person@example.test",
    role: "admin",
    tokenHash: hashToken("a-minted-token"),
    invitedBy: "auth-owner",
    expiresAt: TOMORROW,
    acceptedAt: null,
    ...overrides,
  };
}

describe("mintAdminInvite()", () => {
  it("mints a 43-character URL-safe token and stores only its hash", () => {
    const draft = mintAdminInvite({ email: "person@example.test", role: "admin" }, { now: NOW });

    expect(draft.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(draft.tokenHash).toBe(hashToken(draft.token));
    expect(draft.tokenHash).not.toBe(draft.token);
    // The round trip the accept path performs: the link's token hashes back to the stored value.
    expect(hashToken(draft.token)).toBe(draft.tokenHash);
  });

  it("hashes two mints of the same address to two different rows — the token is the identity", () => {
    const first = mintAdminInvite({ email: "person@example.test", role: "admin" }, { now: NOW });
    const second = mintAdminInvite({ email: "person@example.test", role: "admin" }, { now: NOW });

    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it("expires seven days after the instant it was minted, not after the clock it runs on", () => {
    const draft = mintAdminInvite({ email: "person@example.test", role: "support" }, { now: NOW });
    expect(draft.expiresAt.getTime() - NOW.getTime()).toBe(INVITE_TTL_MS);
    expect(draft.expiresAt.toISOString()).toBe("2026-11-10T12:00:00.000Z");
  });

  it("lowercases and trims the address, so the accept lookup is one equality", () => {
    const draft = mintAdminInvite(
      { email: "  Person@Example.TEST ", role: "member" },
      { now: NOW },
    );
    expect(draft.email).toBe("person@example.test");
  });
});

describe("zAdminInvite", () => {
  it("accepts the three rungs below owner", () => {
    for (const role of ADMIN_INVITE_ROLES) {
      expect(zAdminInvite.safeParse({ email: "a@b.test", role }).success).toBe(true);
    }
    expect(ADMIN_INVITE_ROLES).toEqual(["member", "support", "admin"]);
  });

  it("refuses an invitation that would grant ownership", () => {
    const parsed = zAdminInvite.safeParse({ email: "a@b.test", role: "owner" });
    expect(parsed.success).toBe(false);
  });

  it("refuses an address with no deliverable shape, and a carried unknown field", () => {
    expect(zAdminInvite.safeParse({ email: "not-an-address", role: "admin" }).success).toBe(false);
    expect(
      zAdminInvite.safeParse({ email: "a@b.test", role: "admin", reason: "because" }).success,
    ).toBe(false);
  });
});

describe("inviteMatchesToken()", () => {
  it("matches the token it was minted with and refuses every other", () => {
    const draft = mintAdminInvite({ email: "person@example.test", role: "admin" }, { now: NOW });
    const row = invite({ tokenHash: draft.tokenHash });

    expect(inviteMatchesToken(row, draft.token)).toBe(true);
    expect(inviteMatchesToken(row, "a-minted-token")).toBe(false);
    expect(inviteMatchesToken(row, "")).toBe(false);
    expect(inviteMatchesToken(row, `${draft.token}x`)).toBe(false);
  });
});

describe("inviteIsLive()", () => {
  it("is live before its expiry, and dead at the instant it names", () => {
    expect(inviteIsLive(invite(), NOW)).toBe(true);
    expect(inviteIsLive(invite(), TOMORROW)).toBe(false);
    expect(inviteIsLive(invite(), NEXT_WEEK)).toBe(false);
  });

  it("is spent once accepted, whatever its window says", () => {
    expect(inviteIsLive(invite({ acceptedAt: NOW }), NOW)).toBe(false);
  });
});

describe("liveInvitesFor()", () => {
  it("returns BOTH invitations for one address — one acceptance does not retire the other", () => {
    const older = invite({ id: "invite-older", expiresAt: TOMORROW });
    const newer = invite({ id: "invite-newer", expiresAt: NEXT_WEEK });
    const live = liveInvitesFor([older, newer], "person@example.test", NOW);

    expect(live.map((row) => row.id)).toEqual(["invite-newer", "invite-older"]);
    // Two rows, two tokens: neither invitation was superseded by the other arriving.
    expect(live).toHaveLength(2);
    expect(new Set(live.map((row) => row.tokenHash)).size).toBe(1);
  });

  it("drops an accepted one and an expired one, and filters by address", () => {
    const list = [
      invite({ id: "live", expiresAt: NEXT_WEEK }),
      invite({ id: "accepted", acceptedAt: NOW }),
      invite({ id: "expired", expiresAt: YESTERDAY }),
      invite({ id: "somebody-else", email: "other@example.test", expiresAt: NEXT_WEEK }),
    ];

    expect(liveInvitesFor(list, "  PERSON@example.test ", NOW).map((row) => row.id)).toEqual([
      "live",
    ]);
    expect(liveInvitesFor(list, "other@example.test", NOW).map((row) => row.id)).toEqual([
      "somebody-else",
    ]);
  });
});

describe("migration 0023 — the schema half", () => {
  const sql = readFileSync(join(process.cwd(), "db/migrations/0023_admin_role_audit.sql"), "utf8");
  const between = (start: string, end: string): string => {
    const from = sql.indexOf(start);
    expect(from, `the migration has ${start}`).toBeGreaterThan(-1);
    const to = sql.indexOf(end, from);
    expect(to, `the migration has ${end}`).toBeGreaterThan(from);
    return sql.slice(from, to);
  };
  const inviteTable = between(
    "CREATE TABLE IF NOT EXISTS admin_invite",
    "CREATE INDEX IF NOT EXISTS admin_invite_email_open_idx",
  );
  const actionTable = between("CREATE TABLE IF NOT EXISTS admin_action", "CREATE INDEX");

  it("lets two invitations for one address coexist: no unique constraint on email", () => {
    expect(inviteTable).toMatch(/token_hash\s+TEXT\s+NOT NULL\s+UNIQUE/);
    expect(inviteTable).not.toMatch(/UNIQUE[^\n]*email/i);
    expect(inviteTable).not.toMatch(/email[^\n]*UNIQUE/i);
    expect(inviteTable).not.toMatch(/PRIMARY KEY[^\n]*email/i);
  });

  it("refuses a role of `owner` in the invitation's own vocabulary", () => {
    expect(inviteTable).toMatch(/CHECK \(role IN \('member', 'support', 'admin'\)\)/);
    expect(inviteTable).not.toContain("'owner'");
  });

  it("declares admin_action's nine columns, in the order act() writes them", () => {
    const columns = [...actionTable.matchAll(/^ {2}([a-z_]+) +[A-Z]/gm)].map((m) => m[1]);
    expect(columns).toEqual([
      "id",
      "actor_user_id",
      "action",
      "target_table",
      "target_id",
      "reason",
      "before",
      "after",
      "created_at",
    ]);
  });

  it("widens user_profile's vocabulary to the four rungs and allows at most one owner", () => {
    expect(sql).toMatch(/CHECK \(role IN \('member', 'support', 'admin', 'owner'\)\)/);
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS user_profile_one_owner[\s\S]*WHERE role = 'owner'/,
    );
  });

  it("refuses a seven-character reason in SQL as well as in act()", () => {
    expect(actionTable).toMatch(/CHECK \(length\(btrim\(reason\)\) >= 8\)/);
  });
});
