/**
 * The seed must be able to write an invitation for **every** relationship the dataset invites
 * into — proved without a database, over the bundle `pnpm demo:reset` actually seeds.
 *
 * This is the coverage hole `#1083` fell through. The seed's suite stayed green while `main`'s
 * seed threw `TypeError: Cannot read properties of undefined (reading 'session')` on the first
 * session that needed an invitation address, because nothing in the suite seeded an invited
 * relationship: every case exercised rows that never ask `inviteEmailFor()` a question. The crash
 * therefore reached the demo branch, which the seed had already emptied — a failed run that is
 * worse than a stale one.
 *
 * So the assertions are about the *whole seeded population* rather than one example:
 *
 *   1. the bundle carries invitations at all — a dataset that stops inviting has to fail here
 *      rather than quietly narrow this test to nothing;
 *   2. every session resolves to exactly one address, in the demo domain, without throwing —
 *      **a draft included** (#1196): the product writes the invitation in the relationship's own
 *      transaction, so every seeded relationship carries one and every one names somebody;
 *   3. a seat a demo identity owns names that identity — the persona signs in with it, so the
 *      invitation has to name the mailbox a person can actually take the seat from;
 *   4. a seat nobody on this machine owns names the counterparty's own fixture address, and
 *      `.test` is reserved by RFC 6761 so it cannot deliver mail to a stranger;
 *   5. a session with nobody to invite is a named refusal, never a `TypeError` about a
 *      property of `undefined` — the shape of the failure that broke the demo.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zAssessmentSession, seededLifecycleOf, seededRowTotals } from "@/content/assessment";
import { DEMO_ACCOUNTS, DEMO_DOMAIN, inviteEmailFor } from "../scripts/db-seed-invite.mjs";

const BUNDLE_PATH = new URL("../data/bundles/demo-dataset.alignsynch.json", import.meta.url);

interface DatasetBundle {
  readonly payload: { readonly sessions: unknown[] };
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8")) as DatasetBundle;

/** The bundle's sessions, through the model — a bundle that drifts fails here, not in a seed. */
const sessions = zAssessmentSession.array().parse(bundle.payload.sessions);

/** The sessions, each with the lifecycle the seed writes from — every one of them carries an
 * invitation since #1196, so this is the population `inviteEmailFor` runs over. */
const invited = sessions.map((session) => ({
  session,
  lifecycle: seededLifecycleOf(session),
}));

const personaByName = new Map(DEMO_ACCOUNTS.map((account) => [account.name, account]));

describe("the seeded bundle's invitations", () => {
  it("carries at least one invitation, so this suite cannot narrow back to nothing", () => {
    // The whole point of the file: an invited relationship exists and is exercised below.
    expect(invited.length).toBeGreaterThan(0);
    // And the dataset is a population, not one demo row — `#1079`'s claim, re-measured here
    // because a seed that invites once and thirty times are the same crash and very different
    // demos.
    expect(sessions.length).toBeGreaterThanOrEqual(30);
    expect(invited.length).toBeGreaterThanOrEqual(20);
  });

  it("resolves an address for every invited session and throws for none", () => {
    // The run that emptied the demo: one throw on any row here aborts the whole seed.
    const addresses = invited.map(({ session }) => inviteEmailFor(session));
    expect(addresses).toHaveLength(invited.length);
    for (const address of addresses) {
      expect(address).toMatch(/^[^@\s]+@[^@\s]+$/);
      expect(address.endsWith(`@${DEMO_DOMAIN}`)).toBe(true);
    }
  });

  it("names the seat's own identity when a demo account holds it", () => {
    const personaSeats = invited.filter(({ session }) =>
      personaByName.has(session.parties.find((party) => party.role === "counterparty")?.name ?? ""),
    );
    // Both PIN personas own at least one counterparty seat; without that the demo button lands
    // on nothing, so an empty set is a regression in the dataset rather than a thin test.
    expect(personaSeats.length).toBeGreaterThan(0);
    for (const { session } of personaSeats) {
      const account = personaByName.get(
        session.parties.find((party) => party.role === "counterparty")?.name ?? "",
      );
      expect(inviteEmailFor(session)).toBe(account?.email);
    }
  });

  it("names the counterparty's own fixture address when nobody on this machine owns the seat", () => {
    const stranger = invited.find(
      ({ session }) =>
        !personaByName.has(
          session.parties.find((party) => party.role === "counterparty")?.name ?? "",
        ),
    );
    expect(stranger).toBeDefined();
    const counterparty = stranger?.session.parties.find((party) => party.role === "counterparty");
    const stem = (counterparty?.name ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    // Derived, not authored: the fixture names a person, never a mailbox.
    expect(inviteEmailFor(stranger?.session as never)).toBe(`${stem}@${DEMO_DOMAIN}`);
  });

  it("refuses a session with nobody to invite by name, not by reading a property of undefined", () => {
    const orphan = { ...sessions[0], parties: [], id: "assessment-instance-nobody" };
    expect(() => inviteEmailFor(orphan as never)).toThrow(/has no counterparty party/);
    expect(() => inviteEmailFor(orphan as never)).not.toThrow(TypeError);
  });

  it("invites a draft too — the create writes the row, so a draft's address is not missing (#1196)", () => {
    // #1079 had the seed *delete* a draft's invitation ("nothing sent, so no link"), which put three
    // seeded drafts in a state the product never creates: `createSessionFromTemplate` writes the row
    // in the relationship's own transaction, so stage 5's Send has a token to reissue. A draft is
    // therefore in `invited` like every other lifecycle, and its address resolves — the filter this
    // replaced is the assertion that used to encode the opposite.
    const drafts = invited.filter(({ lifecycle }) => lifecycle.invite === "created");
    expect(drafts.length).toBeGreaterThan(0);
    for (const { session } of drafts) {
      expect(inviteEmailFor(session)).toMatch(/^[^@\s]+@[^@\s]+$/);
    }
    // And no lifecycle has gone back to "no invitation at all": every word in the table writes one,
    // so the retired `none` cannot reappear without failing here.
    const WORDS = ["created", "sent", "claimed"];
    expect(invited.every(({ lifecycle }) => WORDS.includes(lifecycle.invite))).toBe(true);
  });
  it("counts the rows a seed installs, not the rows the bundle authors", () => {
    // `#1079`'s census: 33 relationships over 60 party rows and 231 answers. The authored bundle
    // carries 66 and 336 — a lifecycle with one seat or one answered sheet writes less, and a
    // checker that compared the branch against the authored number reported a green seed as a
    // failed reset.
    const total = sessions.reduce(
      (sum, session) => {
        const rows = seededRowTotals(session);
        return { parties: sum.parties + rows.parties, opinions: sum.opinions + rows.opinions };
      },
      { parties: 0, opinions: 0 },
    );
    expect(total).toEqual({ parties: 60, opinions: 231 });
    const authored = sessions.reduce(
      (sum, session) => ({
        parties: sum.parties + session.parties.length,
        opinions:
          sum.opinions + session.parties.reduce((count, party) => count + party.opinions.length, 0),
      }),
      { parties: 0, opinions: 0 },
    );
    // The gap is the point: it is not drift, it is the lifecycle.
    expect(authored.parties).toBeGreaterThan(total.parties);
    expect(authored.opinions).toBeGreaterThan(total.opinions);
  });
});

/**
 * `bindDemoParties` throws when an account's display name matches no `party` row — the guard that
 * catches a rename in `data/assessment-population.ts`. The operator identity is the exception, and
 * on `main` it was not exempt: the skip was `if (account.party === null) continue;`, a field #1083
 * deleted, so every seed demanded a party row named "Demo Admin" and refused. The rule below is
 * that guard, stated against the data instead of against a field the data used to carry.
 */
describe("the demo identities the party binding has to resolve", () => {
  const partyNames = new Set(
    sessions.flatMap((session) => session.parties.map((party) => party.name)),
  );

  it("names a party row for every account that holds a seat", () => {
    const seated = DEMO_ACCOUNTS.filter((account) => account.holdsSeat !== false);
    // Both personas, or the demo buttons land on nothing and this case stops proving anything.
    expect(seated).toHaveLength(2);
    for (const account of seated) {
      expect(partyNames.has(account.name)).toBe(true);
    }
  });

  it("exempts the operator, which is the only account allowed to name no seat", () => {
    const unseated = DEMO_ACCOUNTS.filter((account) => account.holdsSeat === false);
    // Exactly one, and it is the admin: an exemption that grows is a dataset that stopped
    // carrying a persona, which `bindDemoParties` would otherwise report only at seed time.
    expect(unseated).toHaveLength(1);
    expect(unseated[0]?.role).toBe("admin");
    expect(partyNames.has(unseated[0]?.name ?? "")).toBe(false);
  });
});
