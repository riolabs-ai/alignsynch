/**
 * The demo generator is only useful if it is **provable**, so this file pins the claims the
 * cards make rather than describing them:
 *
 *   1. the same seed produces an identical set, so a report is reproducible;
 *   2. every generated row parses against the real schema (`zV1Relationship`), so the demo set
 *      cannot drift from the model the app reads;
 *   3. the set covers every purchasable catalogue type and all four Stages — the Stage **derived**
 *      from the accept/submit flags, never a stored label — with both Modes and both Settings
 *      somewhere in it;
 *   4. the Gap distribution is deliberate: In Synch is 10–20% of every comparison rather than
 *      most of them, one relationship is In Synch on **every** Gap, and the widest Gap (4) is in
 *      the set — plus some rows are deliberately unscored, so a surface must print `—`;
 *   5. a completed row stores the Steps its own answers derive, so the Steps panel renders on a
 *      fresh store instead of needing two sheets played by hand.
 *
 * The factories beside this file are pinned the same way: `makeRelationship` parses, and a
 * malformed override throws instead of producing a fixture that would fail somewhere else.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { zOpinions, type AssessmentMode } from "@/content/assessment";
import { DEMO_NOW_ISO } from "@/content/core";
import { RELATIONSHIP_STAGES, type RelationshipStage } from "@/content/stages";
import { deriveSteps } from "@/content/steps";
import {
  v1Templates,
  zV1Account,
  zV1Relationship,
  zV1Ticket,
  PERSONA_META,
  SEED_VERSION,
  seedAccounts,
  type V1Relationship,
} from "@/data/v1/fixtures";
import { zV1Notification } from "@/data/v1/notifications";
import {
  purchasableRelationshipTypes,
  RELATIONSHIP_PRICE_CENTS,
} from "@/data/v1/relationship-types";
import {
  allAspectGaps,
  bothSubmittedOf,
  cardMetricsOf,
  flagCountsOfRelationship,
  sessionCompleteOf,
  stageOfRelationship,
  verdictOf,
} from "@/lib/v1/derive";
import { inventedMessagesOf, threadsOf, totalUnreadOf, type ChatThread } from "@/lib/v1/chat";
import {
  DEMO_FLOW_STORAGE_KEY,
  DEMO_SEED,
  DEMO_SOCIAL_STORAGE_KEY,
  demoAccounts,
  demoNotifications,
  demoRng,
  demoRelationships,
  demoSeed,
  demoSeedJson,
  demoSocialJson,
  demoSocialSeed,
  demoThreadReadAt,
  installDemoSeed,
} from "@/lib/v1/demo-seed";
import {
  DASHBOARD_PERSONAS,
  personaFromHandle,
  personaHandle,
  relationshipsVisibleTo,
} from "@/lib/v1/persona";
import { profileActivityOf } from "@/lib/v1/profile";
import {
  makeAnswerSheet,
  makeCompletedRelationship,
  makeRelationship,
} from "./helpers/v1-factories";

/** Every Gap value one Aspect carries, as numbers. */
function gapValues(rel: V1Relationship, itemId: string) {
  const aspect = allAspectGaps(rel).find((entry) => entry.itemId === itemId);
  return (Object.values(aspect?.gaps ?? {}) as number[]).map(Number);
}

/** The Steps a row's own answers derive — the rule `storedStepsOf` stores, restated by hand. */
function deriveOf(rel: V1Relationship) {
  return deriveSteps({
    relationshipId: rel.id,
    items: rel.items,
    initiatorAnswers: rel.initiatorAnswers,
    counterpartyAnswers: rel.counterpartyAnswers,
    createdAt: rel.lastSessionAt ?? rel.createdAt,
  });
}

/** The scored rows only: an unscored row has no Gaps to spread. */
function scored(relationships: readonly V1Relationship[]): readonly V1Relationship[] {
  return relationships.filter((rel) => verdictOf(rel) !== null);
}

/** Every Gap magnitude one row carries, as numbers — all eight kinds, both Modes. */
function magnitudesOf(rel: V1Relationship): number[] {
  return allAspectGaps(rel).flatMap((aspect) => Object.values(aspect.gaps).map(Number));
}

/** Every Gap magnitude in the seeded set, in row order. */
function allMagnitudes(relationships: readonly V1Relationship[]): number[] {
  return relationships.flatMap(magnitudesOf);
}

describe("the demo seed is deterministic", () => {
  it("returns byte-identical JSON for the same seed, twice", () => {
    expect(demoSeedJson()).toBe(demoSeedJson());
    expect(demoSeedJson(7)).toBe(demoSeedJson(7));
    console.log("seeded rows:", demoSeed().relationships.length, "seed:", DEMO_SEED);
  });

  it("moves the Gaps when the seed changes", () => {
    const a = demoSeed(7).relationships.map((rel) => rel.initiatorAnswers);
    const b = demoSeed(8).relationships.map((rel) => rel.initiatorAnswers);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("draws the same PRNG stream from the same seed", () => {
    const first = Array.from({ length: 5 }, demoRng(42));
    const second = Array.from({ length: 5 }, demoRng(42));
    expect(second).toEqual(first);
    expect(first.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("stamps every instant from the demo clock, never from the run", () => {
    const first = demoSeed();
    const second = demoSeed();
    expect(first.relationships.map((rel) => rel.modifiedAt)).toEqual(
      second.relationships.map((rel) => rel.modifiedAt),
    );
  });
});

describe("the payload is the store's shape", () => {
  it("carries the store version, and the flow slice parses against the real schemas", () => {
    const payload = demoSeed();
    expect(payload.version).toBe(SEED_VERSION);
    expect(zV1Relationship.array().safeParse(payload.relationships).success).toBe(true);
    expect(zV1Account.array().safeParse(payload.accounts).success).toBe(true);
    expect(zV1Ticket.array().safeParse(payload.tickets).success).toBe(true);
  });

  it("writes under the key lib/v1/store.tsx reads", () => {
    // `FLOW_STORAGE_KEY` is module-private in the store, so the literal is repeated in the
    // generator. This reads the store's own source to prove the two strings are one.
    const storePath = fileURLToPath(new URL("../lib/v1/store.tsx", import.meta.url));
    const source = readFileSync(storePath, "utf8");
    expect(source).toContain(`const FLOW_STORAGE_KEY = "${DEMO_FLOW_STORAGE_KEY}"`);
  });

  it("installs into the storage it is handed and reports the count", () => {
    const written = new Map<string, string>();
    const count = installDemoSeed({ setItem: (key, value) => void written.set(key, value) });
    expect(count).toBe(purchasableRelationshipTypes.length);
    const raw = written.get(DEMO_FLOW_STORAGE_KEY);
    expect(raw).toBeDefined();
    expect(JSON.parse(raw ?? "{}").relationships).toHaveLength(count);
  });
});

describe("the set covers the catalogue and the ladder", () => {
  const relationships = demoRelationships();

  it("has one relationship for every purchasable type", () => {
    const templateIds = new Set(relationships.map((rel) => rel.templateId));
    for (const type of purchasableRelationshipTypes) {
      expect(templateIds.has(`assessment-${type.id}`)).toBe(true);
    }
    expect(relationships).toHaveLength(purchasableRelationshipTypes.length);
    console.log(
      "types covered:",
      purchasableRelationshipTypes.length,
      "—",
      purchasableRelationshipTypes.map((type) => type.id).join(", "),
    );
  });

  it("reaches all four Stages", () => {
    const stages = new Set(relationships.map((rel) => stageOfRelationship(rel)));
    expect([...stages].sort()).toEqual([...RELATIONSHIP_STAGES].sort());
    console.log("stages:", [...stages].join(", "));
  });

  it("plays both Modes and both Settings, scored and unscored", () => {
    const modes = new Set(relationships.map((rel) => rel.mode));
    const settings = new Set(relationships.map((rel) => rel.setting));
    expect([...modes].sort()).toEqual(["advanced", "basic"]);
    expect([...settings].sort()).toEqual(["full", "soft"]);
    expect(scored(relationships).length).toBeGreaterThan(0);
    expect(scored(relationships).length).toBeLessThan(relationships.length);
  });

  it("keeps a full but unaccepted sheet unscored, so the list prints — with answers present", () => {
    // The em-dash rule, stated as the list reads it: `cardMetricsOf().averageAlignment` is null
    // until the session is complete, and `components/v1/relationships-list.tsx` prints `—` for
    // null. One row here has every Aspect answered by both parties and still must show `—`.
    const unscored = relationships.filter((rel) => cardMetricsOf(rel).averageAlignment === null);
    expect(unscored.length).toBeGreaterThan(0);
    const answeredButNotAccepted = unscored.filter(
      (rel) => bothSubmittedOf(rel) && !sessionCompleteOf(rel),
    );
    expect(answeredButNotAccepted.length).toBeGreaterThan(0);
    for (const rel of unscored) {
      expect(flagCountsOfRelationship(rel)).toBeNull();
      expect(verdictOf(rel)).toBeNull();
    }
    console.log(
      "unscored rows:",
      unscored.length,
      "· full sheets awaiting acceptance:",
      answeredButNotAccepted.length,
    );
  });
});

describe("both ends of the Gap range are reachable per Mode", () => {
  const relationships = scored(demoRelationships());

  for (const mode of ["basic", "advanced"] as readonly AssessmentMode[]) {
    it(`${mode}: one Aspect at Gap 0 and one at the maximum`, () => {
      const rows = relationships.filter((rel) => rel.mode === mode);
      expect(rows.length).toBeGreaterThan(0);

      const aspects = rows.flatMap((rel) =>
        rel.items.map((item) => {
          const values = gapValues(rel, item.id);
          return { rel, item, values, max: Math.max(...values), measured: values.length };
        }),
      );

      const inSynch = aspects.filter(
        (aspect) => aspect.measured > 0 && aspect.values.every((value) => value === 0),
      );
      const widest = aspects.filter((aspect) => aspect.max === 4);

      expect(inSynch.length).toBeGreaterThan(0);
      expect(widest.length).toBeGreaterThan(0);
      console.log(
        mode,
        "— In Synch Aspects:",
        inSynch.length,
        "· widest-Gap Aspects:",
        widest.length,
        "· sample:",
        `${widest[0].rel.name}/${widest[0].item.id} max ${widest[0].max}`,
      );
    });
  }

  it("spreads magnitudes across the whole 0..4 range", () => {
    const magnitudes = new Set<number>();
    for (const rel of relationships) {
      for (const item of rel.items) {
        for (const value of gapValues(rel, item.id)) magnitudes.add(value);
      }
    }
    expect([...magnitudes].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  // The row shape gained two required fields (#404): `inviteeName`, which only the create entry
  // writes, and `steps`, which is derived at completion and then stored. A generated row has to
  // say the same thing the fixtures say — no seat named, and exactly the Steps its own answers
  // produce — or the demo set is a state the store itself cannot reach.
  it("stores the Steps each completed row derives, and names no seat", () => {
    let completed = 0;
    for (const rel of relationships) {
      expect(rel.inviteeName).toBeNull();
      const complete = rel.initiatorAccepted && rel.counterpartyAccepted;
      if (complete) completed += 1;
      expect(rel.steps).toEqual(complete ? deriveOf(rel) : []);
    }
    // A set where nothing completed would satisfy the loop above for the wrong reason.
    expect(completed).toBeGreaterThan(0);
    console.log("completed rows carrying Steps:", completed, "of", relationships.length);
  });
});

describe("the seeded distribution is deliberate", () => {
  const relationships = demoRelationships();
  const magnitudes = allMagnitudes(relationships);

  it("derives all four Stages from the accept/submit flags", () => {
    // The Stage is never a field on the row; this reads it exactly as the app does, so a plan
    // that claims `connected` while every row has accepted cannot pass.
    const counts = new Map<RelationshipStage, number>();
    for (const rel of relationships) {
      const stage = stageOfRelationship(rel);
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }
    for (const stage of RELATIONSHIP_STAGES) {
      expect(counts.get(stage) ?? 0, `no ${stage} relationship in the seed`).toBeGreaterThan(0);
    }

    // The state a first-time counterparty lands in: the invite is claimed and the answer sheet
    // is blank, so the row must render `—` rather than a score of 0.
    const blankConnected = relationships.filter(
      (rel) =>
        stageOfRelationship(rel) === "connected" &&
        !rel.initiatorSubmitted &&
        !rel.counterpartySubmitted,
    );
    expect(blankConnected.length).toBeGreaterThan(0);

    console.log(
      "stages:",
      RELATIONSHIP_STAGES.map((stage) => `${stage} ${counts.get(stage) ?? 0}`).join(" · "),
    );
  });

  it("keeps In Synch to 10–20% of every comparison", () => {
    expect(magnitudes.length).toBeGreaterThan(0);
    const zeros = magnitudes.filter((value) => value === 0).length;
    const zeroFraction = zeros / magnitudes.length;

    // A set where most comparisons are 0 cannot answer "does the report read well when there is
    // something to see"; a set with no zeros never renders the In Synch path at all.
    expect(zeroFraction).toBeGreaterThanOrEqual(0.1);
    expect(zeroFraction).toBeLessThanOrEqual(0.2);

    const histogram = [0, 1, 2, 3, 4].map(
      (value) => `${value}: ${magnitudes.filter((m) => m === value).length}`,
    );
    console.log(
      "gaps:",
      `${magnitudes.length} comparisons · zeros ${zeros} (${(zeroFraction * 100).toFixed(1)}%) ·`,
      histogram.join(" "),
    );
  });

  it("keeps both ends of the range: one relationship In Synch throughout, and 4s present", () => {
    const entirelyInSynch = relationships.filter((rel) => {
      const values = magnitudesOf(rel);
      return values.length > 0 && values.every((value) => value === 0);
    });
    expect(entirelyInSynch.length).toBeGreaterThan(0);
    expect(Math.max(...magnitudes)).toBe(4);
    console.log(
      "fully In Synch:",
      entirelyInSynch.map((rel) => `${rel.name} (${rel.mode}, ${rel.setting})`).join(", "),
    );
  });
});

describe("a completed relationship stores the Steps its answers derive", () => {
  const relationships = demoRelationships();
  const completed = relationships.filter(
    (rel) => rel.initiatorAccepted && rel.counterpartyAccepted,
  );

  it("gives a reviewer a completed relationship whose Steps panel is not empty", () => {
    // `components/v1/steps-panel.tsx` renders nothing when `rel.steps` is empty, so the demo set
    // is only reviewable if at least one *completed* row carries Steps. A row that is In Synch on
    // every Gap derives none by design — the panel needs a gapped one, and every sharing row is.
    const withSteps = completed.filter((rel) => rel.steps.length > 0);
    expect(withSteps.length).toBeGreaterThan(0);

    for (const rel of completed) {
      // One Step per Aspect is the rule (`content/steps.ts`), so the rows can never outnumber
      // them, and a Step always names an Aspect the relationship still holds.
      expect(rel.steps.length).toBeLessThanOrEqual(rel.items.length);
      const aspectIds = new Set(rel.items.map((item) => item.id));
      for (const step of rel.steps) {
        expect(aspectIds.has(step.aspectId)).toBe(true);
        expect(step.status).toBe("open");
        expect(step.derivedFrom.length).toBeGreaterThan(0);
        expect(step.suggestedText).toBeDefined();
      }
    }

    const headline = withSteps[0];
    // The row a reviewer is told to open holds the derivation over its own answers — not a list
    // this generator typed, and not a count that could drift from the rule.
    expect(headline.steps).toEqual(deriveOf(headline));
    console.log(
      "steps:",
      `${withSteps.length} of ${completed.length} completed rows carry Steps · open`,
      `${headline.id} (${headline.name}) — ${headline.steps.length} Steps:`,
      headline.steps.map((step) => `${step.aspectId} ← ${step.derivedFrom.join("+")}`).join(", "),
    );
  });
});

describe("the test factories produce schema-valid objects", () => {
  it("makeRelationship parses against zV1Relationship", () => {
    expect(zV1Relationship.safeParse(makeRelationship()).success).toBe(true);
    expect(zV1Relationship.safeParse(makeRelationship({ mode: "advanced" })).success).toBe(true);
    console.log("factory row:", JSON.stringify(makeRelationship({ id: "rel-printed" })));
  });

  // The two constructors this repo has for a relationship both have to carry the shape the model
  // requires: `steps` is a stored plan, so a completed row is built with the Steps its own answers
  // derive, and an unstarted one is built with none.
  it("a completed factory row carries the Steps its answers derive", () => {
    // Even two identical sheets carry a Gap — `wish` and `feel` differ inside one answer — so a
    // completed row always derives at least one Step, and the factory stores it.
    const completed = makeCompletedRelationship();
    expect(completed.steps.length).toBeGreaterThan(0);
    expect(completed.steps).toEqual(deriveOf(completed));

    // A wide Gap on one Aspect changes the plan, and the factory follows it.
    const aspectId = makeRelationship().items[0].id;
    const gapped = makeCompletedRelationship({
      mode: "advanced",
      initiatorAnswers: makeAnswerSheet({ [aspectId]: { feel: 1 } }, { mode: "advanced" }),
      counterpartyAnswers: makeAnswerSheet({ [aspectId]: { feel: 5 } }, { mode: "advanced" }),
    });
    expect(gapped.steps).toEqual(deriveOf(gapped));
    expect(zV1Relationship.safeParse(gapped).success).toBe(true);

    // An unstarted row has agreed nothing, so it holds no plan.
    expect(makeRelationship().steps).toEqual([]);
  });

  it("makeAnswerSheet answers every Aspect and parses against zOpinions", () => {
    const rel = makeRelationship();
    const sheet = makeAnswerSheet();
    expect(Object.keys(sheet).sort()).toEqual(rel.items.map((item) => item.id).sort());
    for (const opinions of Object.values(sheet)) {
      expect(zOpinions.safeParse(opinions).success).toBe(true);
    }
  });

  it("rejects a malformed override instead of producing a bad fixture", () => {
    expect(() => makeRelationship({ mode: "expert" as never })).toThrow();
    expect(() => makeRelationship({ items: [] })).toThrow();
    expect(() => makeAnswerSheet({ "aspect-priorities": { feel: 6 } })).toThrow();
  });
});

/* ------------------------------------------------------------------ *
 * The richer set (#415) — parties, chat, notifications, subscriptions
 * ------------------------------------------------------------------ */

/** The threads one seeded row contributes, read through the projection the chat page uses. */
function threadsOfRows(rel: V1Relationship): ChatThread[] {
  return threadsOf(rel, rel.name ?? rel.templateId);
}

/** Every named person in the set, and how many relationships they are party to. */
function partyCounts(relationships: readonly V1Relationship[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rel of relationships) {
    for (const name of [rel.initiatorName, rel.counterpartyName]) {
      if (name === null) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return counts;
}

describe("the parties are a directory, not one pair", () => {
  const relationships = demoRelationships();
  const counts = partyCounts(relationships);

  it("names more than two people, each in more than one relationship", () => {
    expect(counts.size).toBeGreaterThan(2);
    for (const [name, count] of counts) {
      // A person in exactly one row is a name, not a directory entry: the list and the profile
      // would each show a single relationship and read as an empty demo.
      expect(count, `${name} is party to only ${count} relationship`).toBeGreaterThan(1);
    }
    console.log(
      "parties:",
      counts.size,
      "—",
      [...counts].map(([name, count]) => `${name} ${count}`).join(" · "),
    );
  });

  it("keeps both demo seats populated, so each persona's list has substance", () => {
    // `relationshipsVisibleTo` scopes by name, so this is the rule the personas actually read.
    const initiatorRows = relationshipsVisibleTo("initiator", relationships);
    expect(initiatorRows.length).toBeGreaterThan(4);
    expect(new Set(initiatorRows.map((rel) => stageOfRelationship(rel)))).toEqual(
      new Set(RELATIONSHIP_STAGES),
    );

    const counterpartyRows = relationshipsVisibleTo("counterparty", relationships);
    expect(counterpartyRows.length).toBeGreaterThan(2);

    const coachRows = relationshipsVisibleTo("coach", relationships);
    expect(coachRows.length).toBeGreaterThan(2);
    expect(relationshipsVisibleTo("admin", relationships)).toHaveLength(relationships.length);

    console.log(
      "per-persona rows:",
      `initiator ${initiatorRows.length} · counterparty ${counterpartyRows.length}`,
      `· coach ${coachRows.length} · admin ${relationships.length}`,
    );
  });

  it("folds every named person to a distinct handle, and the two seats' handles resolve", () => {
    // The cover and the avatar are pure functions of the handle (`ProfileCover`,
    // `GeneratedAvatar`), so two distinct people folding to one handle would draw one person twice.
    const handles = [...counts.keys()].map((name) => name.toLowerCase().replace(/\s+/g, "-"));
    expect(new Set(handles).size).toBe(handles.length);

    // The profile route resolves only the four dashboard handles (`jordan-lee`, `sam-carter`, …),
    // while a relationship names a party by their first name — so the two demo seats have to be the
    // same people under both spellings. A seeded name belonging to nobody a profile route can open
    // would be a party with no profile.
    for (const persona of DASHBOARD_PERSONAS) {
      expect(personaFromHandle(personaHandle(persona))).toBe(persona);
    }
    expect(counts.has(PERSONA_META.initiator.name)).toBe(true);
    expect(counts.has(PERSONA_META.counterparty.name)).toBe(true);
  });

  it("gives every dashboard persona a profile with activity on it", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      const activity = profileActivityOf(persona, relationships, v1Templates);
      expect(activity.events.length, `${persona} has an empty profile`).toBeGreaterThan(0);
      expect(activity.summary.relationshipCount).toBeGreaterThan(0);
    }
  });

  it("gives the Service queue an account per named person, after the sign-in seats", () => {
    const accounts = demoSeed().accounts;
    const added = demoAccounts(relationships);
    expect(added.length).toBeGreaterThan(0);
    expect(accounts.length).toBe(seedAccounts.length + added.length);

    // The persona's own account has to stay the first match per persona: `settings-view.tsx`
    // resolves its address with `accounts.find((account) => account.persona === persona)`.
    for (const account of seedAccounts) {
      expect(accounts.find((candidate) => candidate.persona === account.persona)?.id).toBe(
        account.id,
      );
    }

    for (const name of counts.keys()) {
      const known = seedAccounts.some((account) => account.name === name);
      if (known) continue;
      expect(added.some((account) => account.name === name)).toBe(true);
    }
    expect(zV1Account.array().safeParse(accounts).success).toBe(true);
  });
});

describe("the chat the surfaces read has content", () => {
  const relationships = demoRelationships();
  const completed = relationships.filter((rel) => sessionCompleteOf(rel));

  it("gives the relationship threads several messages, as a conversation", () => {
    const withThread = completed.filter((rel) => rel.comments.length >= 3);
    expect(withThread.length).toBeGreaterThan(0);

    const headline = withThread[0];
    const thread = threadsOfRows(headline).find((candidate) => candidate.kind === "relationship");
    expect(thread?.messages.length ?? 0).toBeGreaterThanOrEqual(3);
    // Both parties speak: a thread written by one side is a notice, not a conversation.
    expect(new Set(thread?.messages.map((message) => message.author))).toEqual(
      new Set(["initiator", "counterparty"]),
    );
    console.log(
      "chat:",
      withThread.length,
      "relationship threads with 3+ messages ·",
      headline.id,
      "—",
      thread?.messages.map((message) => message.author).join(" → "),
    );
  });

  it("opens a relationship thread only where the session completed", () => {
    for (const rel of relationships) {
      if (rel.comments.length === 0) continue;
      expect(sessionCompleteOf(rel), `${rel.id} has a relationship thread before its session`).toBe(
        true,
      );
    }
    // A blind row may still discuss an Aspect — the chat module says so — so at least one
    // connected row carries an Aspect thread with no relationship thread.
    const blindWithAspect = relationships.filter(
      (rel) => !sessionCompleteOf(rel) && Object.keys(rel.aspectComments).length > 0,
    );
    expect(blindWithAspect.length).toBeGreaterThan(0);
    expect(blindWithAspect.every((rel) => rel.comments.length === 0)).toBe(true);

    // An unclaimed invite has one party, so there is nobody who could have written a message and
    // no thread to open — the riskiest row to seed chat onto, so it is asserted rather than assumed.
    const unclaimed = relationships.filter((rel) => rel.counterpartyName === null);
    expect(unclaimed.length).toBeGreaterThan(0);
    for (const rel of unclaimed) {
      expect(rel.comments).toEqual([]);
      expect(rel.aspectComments).toEqual({});
      expect(rel.coachComments).toEqual([]);
    }
  });

  it("writes only comment records, so no message is invented", () => {
    for (const rel of relationships) {
      expect(inventedMessagesOf(rel, rel.name ?? rel.templateId)).toEqual([]);
    }
    const messages = relationships.flatMap((rel) =>
      threadsOfRows(rel).flatMap((thread) => thread.messages),
    );
    expect(messages.length).toBeGreaterThan(relationships.length);
  });

  it("dates every message after the session that unlocked it, and before the demo clock", () => {
    const now = Date.parse(DEMO_NOW_ISO);
    for (const rel of completed) {
      const unlockedAt = Date.parse(rel.lastSessionAt ?? "");
      expect(Number.isNaN(unlockedAt)).toBe(false);
      for (const comment of rel.comments) {
        expect(Date.parse(comment.at)).toBeGreaterThan(unlockedAt);
        expect(Date.parse(comment.at)).toBeLessThanOrEqual(now);
      }
    }
  });

  it("puts the coach's note on a shared row's relationship thread, never on an Aspect", () => {
    const noted = relationships.filter((rel) => rel.coachComments.length > 0);
    expect(noted.length).toBeGreaterThan(0);
    for (const rel of noted) {
      expect(rel.sharedWithCoach).toBe(true);
      expect(sessionCompleteOf(rel)).toBe(true);
      const withCoach = threadsOfRows(rel).filter((thread) =>
        thread.messages.some((message) => message.author === "coach"),
      );
      expect(withCoach.map((thread) => thread.kind)).toEqual(["relationship"]);
    }
  });

  it("keeps every record inside its row's own life: after it was created, not after its last write", () => {
    for (const rel of relationships) {
      const childInstants = [
        ...(rel.lastSessionAt === null ? [] : [rel.lastSessionAt]),
        ...rel.comments.map((comment) => comment.at),
        ...Object.values(rel.aspectComments)
          .flat()
          .map((comment) => comment.at),
        ...rel.coachComments.map((comment) => comment.at),
      ];
      for (const instant of childInstants) {
        // `modifiedAt` is the "last modified" column: a message newer than it would make the row
        // describe a write that its own timestamp denies.
        const parsed = Date.parse(instant);
        expect(parsed).toBeGreaterThanOrEqual(Date.parse(rel.createdAt));
        expect(
          parsed,
          `${rel.id}: ${instant} is after modifiedAt ${rel.modifiedAt}`,
        ).toBeLessThanOrEqual(Date.parse(rel.modifiedAt));
      }
    }
  });

  it("leaves every reading persona a thread with something unread", () => {
    const social = demoSocialSeed();
    for (const persona of ["initiator", "counterparty", "coach"] as const) {
      const threads = relationshipsVisibleTo(persona, relationships).flatMap(threadsOfRows);
      const unread = totalUnreadOf(threads, persona, social.threadReadAt[persona]);
      expect(unread, `${persona} has nothing unread in the chat`).toBeGreaterThan(0);
      console.log("unread:", persona, unread, "across", threads.length, "threads");
    }
  });
});

describe("the social slice is a bell with content", () => {
  const relationships = demoRelationships();
  const notifications = demoNotifications(relationships);
  const ids = new Set(relationships.map((rel) => rel.id));

  it("parses against the real schema and covers the product's four event types", () => {
    expect(zV1Notification.array().safeParse(notifications).success).toBe(true);
    expect(notifications.length).toBeGreaterThan(0);
    expect(new Set(notifications.map((row) => row.type))).toEqual(
      new Set(["invite_accepted", "session_scored", "new_comment", "payment_failed"]),
    );
  });

  it("delivers to a persona that can open the link, and only to the four that own a bell", () => {
    for (const row of notifications) {
      const target = row.link.split("/").filter(Boolean).at(-1) ?? "";
      expect(ids.has(target), `${row.id} links to ${row.link}, which no seeded row holds`).toBe(
        true,
      );
      const visible = relationshipsVisibleTo(row.persona, relationships).map((rel) => rel.id);
      expect(visible, `${row.id} is delivered to ${row.persona}, who cannot open it`).toContain(
        target,
      );
    }
  });

  it("dates every notification from a stored instant, never after the demo clock", () => {
    const now = Date.parse(DEMO_NOW_ISO);
    for (const row of notifications) {
      expect(Date.parse(row.createdAt)).toBeLessThanOrEqual(now);
    }
  });

  it("opens with both read and unread rows for every persona that has a bell", () => {
    for (const persona of ["initiator", "counterparty", "coach", "admin"] as const) {
      const mine = notifications.filter((row) => row.persona === persona);
      expect(mine.length, `${persona} has no notifications`).toBeGreaterThan(0);
      expect(mine.some((row) => !row.read)).toBe(true);
      expect(mine.some((row) => row.read)).toBe(true);
      // Newest first, which is the order the bell and the page both render.
      const instants = mine.map((row) => row.createdAt);
      expect([...instants].sort().reverse()).toEqual(instants);
    }
  });

  it("writes the social key the store reads, and writes it deterministically", () => {
    const storePath = fileURLToPath(new URL("../lib/v1/store.tsx", import.meta.url));
    const source = readFileSync(storePath, "utf8");
    expect(source).toContain(`const SOCIAL_STORAGE_KEY = "${DEMO_SOCIAL_STORAGE_KEY}"`);

    expect(demoSocialJson()).toBe(demoSocialJson());
    expect(demoSocialJson(7)).toBe(demoSocialJson(7));
  });

  it("installs both slices into the storage it is handed", () => {
    const written = new Map<string, string>();
    const count = installDemoSeed({ setItem: (key, value) => void written.set(key, value) });
    expect(count).toBe(purchasableRelationshipTypes.length);
    expect(written.has(DEMO_FLOW_STORAGE_KEY)).toBe(true);

    const social = JSON.parse(written.get(DEMO_SOCIAL_STORAGE_KEY) ?? "{}");
    expect(social.version).toBe(SEED_VERSION);
    expect(social.notifications.length).toBe(notifications.length);
    expect(Object.keys(social.threadReadAt).sort()).toEqual(
      ["admin", "coach", "counterparty", "initiator", "service", "visitor"].sort(),
    );
    expect(demoThreadReadAt(relationships)).toEqual(social.threadReadAt);
  });
});

describe("the subscriptions show what was paid, in every state", () => {
  const relationships = demoRelationships();
  const subscribed = relationships.filter((rel) => rel.subscription !== null);

  it("covers active, past due and lapsed, and leaves some rows unsubscribed", () => {
    const states = new Set(
      subscribed.map((rel) => rel.subscription?.status).filter((status) => status !== undefined),
    );
    expect([...states].sort()).toEqual(["active", "lapsed", "past_due"]);
    expect(subscribed.length).toBeLessThan(relationships.length);
    console.log(
      "subscriptions:",
      ["active", "past_due", "lapsed"]
        .map(
          (status) =>
            `${status} ${subscribed.filter((rel) => rel.subscription?.status === status).length}`,
        )
        .join(" · "),
      `· unsubscribed ${relationships.length - subscribed.length}`,
    );
  });

  it("records the one payment that was made, at the plan's price, with no total anywhere", () => {
    for (const rel of subscribed) {
      const subscription = rel.subscription;
      if (subscription === null) continue;
      expect(subscription.payments.length).toBe(1);
      const [payment] = subscription.payments;
      expect(payment.plan).toBe(subscription.plan);
      expect(payment.amountCents).toBe(
        subscription.plan === "monthly" ? RELATIONSHIP_PRICE_CENTS : RELATIONSHIP_PRICE_CENTS * 3,
      );
      expect(payment.paidAt).toBe(subscription.startedAt);
    }
  });

  it("dates the period from the state, so the state is true of the dates", () => {
    const now = Date.parse(DEMO_NOW_ISO);
    for (const rel of subscribed) {
      const subscription = rel.subscription;
      if (subscription === null) continue;
      const started = Date.parse(subscription.startedAt);
      const ends = Date.parse(subscription.periodEnd);
      expect(started).toBeLessThan(ends);
      if (subscription.status === "active") expect(ends).toBeGreaterThan(now);
      else expect(ends).toBeLessThan(now);
    }
  });
});

describe("the seed measured", () => {
  it("counts what a reviewer would count", () => {
    const relationships = demoRelationships();
    const social = demoSocialSeed();
    const counts = partyCounts(relationships);
    const messages = relationships.flatMap((rel) =>
      threadsOfRows(rel).flatMap((thread) => thread.messages),
    );
    const states = new Map<string, number>();
    for (const rel of relationships) {
      const state = rel.subscription?.status ?? "unsubscribed";
      states.set(state, (states.get(state) ?? 0) + 1);
    }

    console.log(
      "census:",
      `${relationships.length} relationships · ${counts.size} distinct parties ·`,
      `${messages.length} chat messages · ${social.notifications.length} notifications ·`,
      [...states].map(([state, count]) => `${state} ${count}`).join(" · "),
    );

    expect(relationships.length).toBe(purchasableRelationshipTypes.length);
    expect(counts.size).toBeGreaterThan(2);
    expect(messages.length).toBeGreaterThan(0);
    expect(social.notifications.length).toBeGreaterThan(0);
    expect(states.get("active") ?? 0).toBeGreaterThan(0);
    expect(states.get("past_due") ?? 0).toBeGreaterThan(0);
    expect(states.get("lapsed") ?? 0).toBeGreaterThan(0);
  });
});
