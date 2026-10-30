/**
 * `/profile/<username>` follows the username (issue #111).
 *
 * The failure this pins down: the page carried a module-scope `const user` (Alex Johnson) and
 * never read `params.username`, so `/profile/sarahwilliams` answered 200 with Alex's profile,
 * his level (42, while `data/players.ts` says 78) and his follower count (1 243 vs 1 248), and
 * `/profile/nonexistent-user` answered 200 with the same person. A page that renders *someone*
 * for *every* URL cannot report its own miss, so the gate is the lookup: `profileByHandle`
 * returns `undefined` and the page calls `notFound()`.
 *
 * The page is exercised directly — mocked `notFound` and a stubbed `UserProfile` — so the
 * assertions are about resolution, not about the client component tree: which person the page
 * hands down, which fields come from the fixture (not from the legacy `lib/data/users.ts`
 * literal), and that an unknown handle is a 404 rather than a fallback.
 */
import { describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound }));

/** The client tree is not what this test is about: hand the props straight back. */
vi.mock("@/components/profile/user-profile", () => ({
  UserProfile: (props: { profile: unknown }) => props,
}));

import ProfilePage, { generateMetadata } from "@/app/(mainlayout)/profile/[username]/page";
import type { PlayerProfile } from "@/lib/profile";

const paramsOf = (username: string) => ({ params: Promise.resolve({ username }) });

/** The profile the page handed to `UserProfile`, read off the stubbed component's props. */
async function resolved(username: string): Promise<PlayerProfile> {
  const element = (await ProfilePage(paramsOf(username))) as unknown as {
    props: { profile: PlayerProfile };
  };
  return element.props.profile;
}

describe("/profile/<username> — the person is the handle, not a literal", () => {
  it("/profile/sarahwilliams is Sarah, read from data/players.ts", async () => {
    const { person, detail } = await resolved("sarahwilliams");

    expect(person.handle).toBe("sarahwilliams");
    expect(person.name).toBe("Sarah Williams");
    expect(person.id).toBe("player-sarah-williams");
    expect(person.level).toBe(65);
    // No avatar on the person: the header draws one from this id (#152), so a file path
    // here would be a second, drifting answer to "what does Sarah look like".
    expect(person).not.toHaveProperty("avatar");
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
  });

  it("404s an unknown handle — there is no default person to fall back to", async () => {
    notFound.mockClear();
    await expect(ProfilePage(paramsOf("nonexistent-user"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

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
});
