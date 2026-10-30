/**
 * `/profile/<username>` follows the username (issues #111 and #164).
 *
 * Two failures are pinned here, for the one URL that now has two kinds of person behind it:
 *
 *   - the #111 defect: the page carried a module-scope `const user` (Alex Johnson) and never read
 *     `params.username`, so `/profile/sarahwilliams` answered 200 with Alex's profile and
 *     `/profile/nonexistent-user` answered 200 with the same person. A page that renders
 *     *someone* for every URL cannot report its own miss, so the gate is the lookup:
 *     `profileByHandle` returns `undefined` and the page calls `notFound()`.
 *   - the #164 rule: a **member** row wins over the fixture, the member branch hands down the
 *     *public* projection (no auth user id), the demo branch is labelled as a demo account, and
 *     the owner's affordance is decided from the session — server-side — rather than from the URL.
 *
 * The page is exercised directly with the database and session mocked, so the assertions are
 * about resolution, not about a component tree: which person the page handed to which view, and
 * which branch a handle took. JSX is not rendered, so each view is a stub whose identity the
 * harness can match on.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, readUserProfileByHandle, currentUser, stubs } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  readUserProfileByHandle: vi.fn(async (_handle: string) => null as unknown),
  currentUser: vi.fn(async () => null as unknown),
  stubs: {
    fixture: (props: unknown) => ({ props }),
    member: (props: unknown) => ({ props }),
    demo: (props: unknown) => ({ props }),
  },
}));

vi.mock("next/navigation", () => ({ notFound }));

/** The database is a stub: `user_profile` rows arrive as the model's shape (or `null`). */
vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByHandle,
  readUserProfileByUserId: vi.fn(async () => null),
  writeUserProfile: vi.fn(async () => ({ ok: true })),
}));

/**
 * The session is a stub too, and that is deliberate: importing the real module pulls
 * `@neon/auth/next/server` (and `next/headers`) into a plain-node test run, which cannot resolve
 * it. The branch under test is "did the page ask who is looking", not how a cookie is parsed.
 */
vi.mock("@/lib/auth/session", () => ({ currentUser }));

/* The three views are identities the harness can match on — the page's props are the assertion. */
vi.mock("@/components/profile/user-profile", () => ({ UserProfile: stubs.fixture }));
vi.mock("@/components/identity/member-profile", () => ({ MemberProfile: stubs.member }));
vi.mock("@/components/identity/demo-account-notice", () => ({ DemoAccountNotice: stubs.demo }));

import ProfilePage, { generateMetadata } from "@/app/(mainlayout)/profile/[username]/page";
import type { PlayerProfile } from "@/lib/profile";

const paramsOf = (username: string) => ({ params: Promise.resolve({ username }) });

interface Element {
  type: unknown;
  props: Record<string, unknown>;
}

/** The elements the page returned: one view for a member, a fragment for a demo person. */
async function elementsOf(username: string): Promise<Element[]> {
  const element = (await ProfilePage(paramsOf(username))) as unknown as Element;
  if (element.type === stubs.fixture || element.type === stubs.member) return [element];
  const children = element.props.children;
  return Array.isArray(children) ? (children as Element[]) : [];
}

/** The profile the demo branch handed to `UserProfile`. */
async function resolved(username: string): Promise<PlayerProfile> {
  const element = (await elementsOf(username)).find(
    (candidate) => candidate.type === stubs.fixture,
  );
  if (element === undefined) throw new Error(`no fixture profile rendered for "${username}"`);
  return element.props.profile as PlayerProfile;
}

beforeEach(() => {
  readUserProfileByHandle.mockReset();
  readUserProfileByHandle.mockImplementation(async () => null);
  currentUser.mockReset();
  currentUser.mockImplementation(async () => null);
  notFound.mockClear();
});

describe("/profile/<username> — the person is the handle, not a literal", () => {
  it("/profile/sarahwilliams is Sarah, read from data/players.ts", async () => {
    const { person, detail } = await resolved("sarahwilliams");

    expect(person.handle).toBe("sarahwilliams");
    expect(person.name).toBe("Sarah Williams");
    expect(person.id).toBe("player-sarah-williams");
    expect(person.level).toBe(65);
    expect(person.avatar).toBe("/avatars/sarah.webp");
    expect(person.country).toBe("Canada");
    // Standing comes from her row on the global board, the board's own unit.
    expect(person.rank).toBe(2);
    expect(person.score).toBe(8_720);
    expect(person.quizzesTaken).toBe(38);

    // She has a `/profile` detail record, overlaid with the player's identity.
    expect(detail).not.toBeNull();
    expect(detail?.name).toBe("Sarah Williams");
    expect(detail?.username).toBe("sarahwilliams");
    expect(detail?.id).toBe("player-sarah-williams");
    expect(detail?.badge).toBe("Platinum");
  });

  it("takes the numbers from the fixture, not from the old hardcoded record", async () => {
    // #111's evidence: the literal said level 42 / 1 243 followers; `data/players.ts` says
    // 78 / 1 248 for the same man. One person cannot have two levels.
    const { person, detail } = await resolved("alexjohnson");

    expect(person.name).toBe("Alex Johnson");
    expect(person.level).toBe(78);
    expect(person.followers).toBe(1_248);
    expect(detail?.level).toBe(78);
    expect(detail?.followers).toBe(1_248);
    expect(detail?.quizzesCreated).toBe(detail?.createdQuizzes.length);
  });

  it("resolves another handle to another person, so one URL is not the default", async () => {
    const michael = await resolved("michaelbrown");
    expect(michael.person.name).toBe("Michael Brown");
    expect(michael.person.level).toBe(59);
    expect(michael.person.handle).toBe("michaelbrown");
  });

  it("renders a player with no detail record at all, instead of inventing sections", async () => {
    const daniel = await resolved("danielthomas");
    expect(daniel.person.name).toBe("Daniel Thomas");
    expect(daniel.detail).toBeNull();
    // Two of the ten players carry no profile stats; an absent count is not zero.
    expect(daniel.person.followers).toBeUndefined();
  });

  it("is case- and whitespace-insensitive, and nothing else", async () => {
    expect((await resolved("SarahWilliams")).person.handle).toBe("sarahwilliams");
    expect((await resolved(" sarahwilliams ")).person.handle).toBe("sarahwilliams");
    // The same normalisation is applied to the database lookup, so the two branches agree.
    expect(readUserProfileByHandle).toHaveBeenCalledWith("sarahwilliams");
  });

  it("404s an unknown handle — there is no default person to fall back to", async () => {
    await expect(ProfilePage(paramsOf("nonexistent-user"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("labels a demo person as a demo account (no fabricated member data)", async () => {
    const elements = await elementsOf("alexjohnson");
    expect(elements.some((element) => element.type === stubs.demo)).toBe(true);
    expect(elements.some((element) => element.type === stubs.fixture)).toBe(true);
  });
});

describe("/profile/<username> — a member row wins over the fixture", () => {
  const PROFILE = {
    userId: "auth-user-1",
    handle: "ada-lovelace",
    displayName: "Ada Lovelace",
    bio: "Analyst, engines.",
    country: "United Kingdom",
    countryCode: "gb",
    joinedAt: "2026-10-30T12:00:00.000Z",
    updatedAt: "2026-10-30T12:00:00.000Z",
  };

  it("renders the member branch, with the public projection and no auth user id", async () => {
    readUserProfileByHandle.mockImplementation(async () => PROFILE);
    const elements = await elementsOf("ada-lovelace");

    const member = elements.find((element) => element.type === stubs.member);
    expect(member).toBeDefined();
    expect(elements.some((element) => element.type === stubs.fixture)).toBe(false);

    const props = member?.props as { profile: Record<string, unknown>; isOwner: boolean };
    expect(props.profile.displayName).toBe("Ada Lovelace");
    expect(props.profile).not.toHaveProperty("userId");
    // A stranger, because no session was stubbed.
    expect(props.isOwner).toBe(false);
  });

  it("adds the owner's affordance only for the person whose session matches the row", async () => {
    readUserProfileByHandle.mockImplementation(async () => PROFILE);
    currentUser.mockImplementation(async () => ({
      userId: "auth-user-1",
      email: "ada@example.com",
      name: "Ada",
    }));

    const elements = await elementsOf("ada-lovelace");
    const props = elements.find((element) => element.type === stubs.member)?.props as {
      isOwner: boolean;
    };
    expect(props.isOwner).toBe(true);
  });

  it("does not resolve a session for a demo person's profile", async () => {
    await resolved("sarahwilliams");
    expect(currentUser).not.toHaveBeenCalled();
  });
});

describe("/profile/<username> — metadata", () => {
  it("gives an unknown handle its own brand-free title, and the player theirs", async () => {
    await expect(generateMetadata(paramsOf("sarahwilliams"))).resolves.toEqual({
      title: "Sarah Williams's Profile",
      description: "Check out Sarah Williams's quiz achievements, stats, and more.",
    });

    const missing = await generateMetadata(paramsOf("nonexistent-user"));
    expect(missing.title).toBe("Profile Not Found");
    // The root layout's template composes the brand: a page title that carries it too prints
    // "… · QuizHub · QuizHub".
    expect(JSON.stringify(missing)).not.toContain("QuizHub");
  });

  it("titles a member's page from their saved display name", async () => {
    readUserProfileByHandle.mockImplementation(async () => ({
      userId: "auth-user-1",
      handle: "ada-lovelace",
      displayName: "Ada Lovelace",
      joinedAt: "2026-10-30T12:00:00.000Z",
      updatedAt: "2026-10-30T12:00:00.000Z",
    }));

    const metadata = await generateMetadata(paramsOf("ada-lovelace"));
    expect(metadata.title).toBe("Ada Lovelace's Profile");
  });
});
