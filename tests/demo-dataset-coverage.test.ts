/**
 * The demo dataset's two self-enforcing rules (#1079).
 *
 * The issue's acceptance is written as two tests, and they are here because a dataset is the one
 * artifact in this tree that can regress without failing anything: a fixture that parses is a
 * fixture that parses. A relationship added tomorrow with no care for the demo's coverage would be
 * green everywhere — the model is happy, the gate is happy, `data:check` is happy — and the demo
 * would silently lose a state again, which is exactly how four `complete` rows came to stand for
 * "the product".
 *
 * **The status enum comes from the model, not from this file.** `RELATIONSHIP_LIFECYCLE_STATUSES`
 * is the content model's copy of the seven words, and `RELATIONSHIP_STATUSES` in
 * `lib/relationship/status.ts` is the app's; the first case asserts they are the same seven in the
 * same order, and the second iterates the model's list. A status added to the model therefore fails
 * here until the dataset carries it — and an eighth word added to one copy but not the other fails
 * before that.
 *
 * The second rule is the three PIN identities. Their buttons exist to show a person's screen, so a
 * demo account with no seat behind one of them is a dead button, not a small dataset.
 */
import { describe, expect, it } from "vitest";
import {
  RELATIONSHIP_LAPSE_REASONS,
  RELATIONSHIP_LIFECYCLE_STATUSES,
  seededLifecycleOf,
} from "@/content/assessment";
import { assessmentSessions } from "@/data/assessments";
import { platformIdentities } from "@/data/platform-identities";
import { LAPSE_REASONS } from "@/lib/relationship/membership";
import { RELATIONSHIP_STATUSES } from "@/lib/relationship/status";

/** The lifecycle each session carries — the dataset seen through the model's one derivation. */
const lifecycles = assessmentSessions.map((session) => ({
  session,
  lifecycle: seededLifecycleOf(session),
}));

/** Every seat the dataset puts a person in, by name and role. */
const seats = assessmentSessions.flatMap((session) =>
  session.parties.map((party) => ({
    name: party.name,
    role: party.role,
    slug: session.slug,
  })),
);

describe("the demo dataset covers every lifecycle word the model allows", () => {
  it("mirrors the model's vocabulary and the app's, word for word", () => {
    // Two copies on purpose (`content/` is the bottom layer and must not import the app), so this is
    // the test that keeps them from drifting — the same mirror `LAPSE_REASONS` has against its CHECK.
    expect([...RELATIONSHIP_LIFECYCLE_STATUSES]).toEqual([...RELATIONSHIP_STATUSES]);
    expect([...RELATIONSHIP_LAPSE_REASONS]).toEqual([...LAPSE_REASONS]);
  });

  it("carries at least one relationship for every status, iterated from the model", () => {
    const missing = RELATIONSHIP_LIFECYCLE_STATUSES.filter(
      (status) => !lifecycles.some(({ lifecycle }) => lifecycle.status === status),
    );

    // The failure names the words with no relationship, so the repair is "author one more row"
    // rather than "read thirty fixtures".
    expect(missing).toEqual([]);
  });

  it("carries both lapse reasons and both reasons a relationship can end", () => {
    const lapsed = lifecycles
      .map(({ lifecycle }) => lifecycle.lapseReason)
      .filter((reason) => reason !== null);
    expect(new Set(lapsed).size).toBeGreaterThan(1);
    const reasons = new Set<string>(RELATIONSHIP_LAPSE_REASONS);
    expect(lapsed.every((reason) => reason !== null && reasons.has(reason))).toBe(true);

    const voided = lifecycles
      .map(({ lifecycle }) => lifecycle.voidReason)
      .filter((reason) => reason !== null);
    expect(voided.length).toBeGreaterThan(0);
    // A void carries the sentence a person wrote, not an empty string.
    expect(voided.every((reason) => reason.trim().length > 10)).toBe(true);
  });

  it("carries both plans, and a plan only where somebody was charged", () => {
    const plans = new Set(
      lifecycles.map(({ lifecycle }) => lifecycle.plan).filter((plan) => plan !== null),
    );
    expect([...plans].sort()).toEqual(["basic", "principal"]);

    // A draft or a pending invitation has no plan: nothing has been sold yet.
    for (const { lifecycle } of lifecycles) {
      if (lifecycle.status === "draft" || lifecycle.status === "pending") {
        expect(lifecycle.plan).toBeNull();
      }
    }
  });

  it("carries a published relationship with both sides answered and one with one side only", () => {
    const published = lifecycles.filter(({ lifecycle }) => lifecycle.status === "published");
    expect(published.some(({ lifecycle }) => lifecycle.answers === "both")).toBe(true);
    expect(published.some(({ lifecycle }) => lifecycle.answers === "initiator")).toBe(true);
  });

  it("covers the five flow stages, which is what the rows are for", () => {
    // Stages 1–3 are a cookie (`lib/flow/create-draft.ts`) and leave no row, so what a seed can
    // cover is the three states the flow ends in: a draft saved at Account (stage 4), an invitation
    // sent-but-unclaimed and one claimed at Invite (stage 5), and the live product after it. The
    // mapping is authored in `data/assessment-population.ts`; this asserts the dataset actually
    // reaches each of the row-states behind it.
    const states = new Set(
      lifecycles.map(({ lifecycle }) =>
        lifecycle.status === "draft"
          ? "stage-4 draft"
          : lifecycle.invite === "sent"
            ? "stage-5 sent"
            : lifecycle.invite === "claimed"
              ? "stage-5 claimed"
              : "nothing sent",
      ),
    );
    expect([...states].sort()).toEqual(["stage-4 draft", "stage-5 claimed", "stage-5 sent"]);
  });

  it("keeps the lifecycle facts SQL will check: no completion before a publish, no lapse before creation", () => {
    for (const { session, lifecycle } of lifecycles) {
      const created = Date.parse(session.date);
      if (lifecycle.publishedAt !== null) {
        expect(Date.parse(lifecycle.publishedAt)).toBeGreaterThanOrEqual(created);
      }
      if (lifecycle.completedAt !== null) {
        // `relationship_completed_after_published`: a completion implies a publish.
        expect(lifecycle.publishedAt).not.toBeNull();
        expect(Date.parse(lifecycle.completedAt)).toBeGreaterThanOrEqual(
          Date.parse(lifecycle.publishedAt as string),
        );
      }
      if (lifecycle.expiredAt !== null) {
        // `relationship_lapsed_pair`: an instant, a reason, and neither before creation.
        expect(lifecycle.lapseReason).not.toBeNull();
        expect(Date.parse(lifecycle.expiredAt)).toBeGreaterThanOrEqual(created);
      }
      // A lapse reason never travels without its instant.
      if (lifecycle.lapseReason !== null) expect(lifecycle.expiredAt).not.toBeNull();
    }
  });

  it("is a population, not a demo of four: thirty relationships and thirty distinct people", () => {
    const people = new Set(seats.map((seat) => seat.name));
    expect(assessmentSessions.length).toBeGreaterThanOrEqual(30);
    expect(people.size).toBeGreaterThanOrEqual(30);
    // Initiators and counterparties both, or half the screens have nothing to show.
    expect(seats.some((seat) => seat.role === "initiator")).toBe(true);
    expect(seats.some((seat) => seat.role === "counterparty")).toBe(true);
  });
});

describe("the three PIN identities each resolve to a credential and to the role their button promises", () => {
  const byEmail = new Map(platformIdentities.map((identity) => [identity.email, identity]));

  it("declares exactly the three, on the demo domain", () => {
    expect([...byEmail.keys()].sort()).toEqual([
      "admin@demo.alignsynch.test",
      "counterparty@demo.alignsynch.test",
      "initiator@demo.alignsynch.test",
    ]);
  });

  it("Admin — the identity is an admin, and a demo admin profile is what db:seed writes for it", () => {
    const admin = byEmail.get("admin@demo.alignsynch.test");
    expect(admin).toBeDefined();
    expect(admin?.role).toBe("admin");
    // The seat the seed creates carries this name, which is the name the admin console greets.
    expect(admin?.displayName.length).toBeGreaterThan(0);
  });

  it("Initiator — holds at least one relationship as the initiator", () => {
    const identity = byEmail.get("initiator@demo.alignsynch.test");
    expect(identity).toBeDefined();
    const held = seats.filter(
      (seat) => seat.name === identity?.displayName && seat.role === "initiator",
    );
    expect(held.length).toBeGreaterThan(0);
  });

  it("Counterparty — holds at least one relationship as the counterparty", () => {
    const identity = byEmail.get("counterparty@demo.alignsynch.test");
    expect(identity).toBeDefined();
    const held = seats.filter(
      (seat) => seat.name === identity?.displayName && seat.role === "counterparty",
    );
    expect(held.length).toBeGreaterThan(0);
  });

  it("binds both demo people by a name the dataset actually uses — the seed's binding key", () => {
    const names = new Set(seats.map((seat) => seat.name));
    for (const email of ["initiator@demo.alignsynch.test", "counterparty@demo.alignsynch.test"]) {
      expect(names.has(byEmail.get(email)?.displayName as string)).toBe(true);
    }
  });
});
