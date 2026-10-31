/**
 * The Initiator learns their invitation expired (#266).
 *
 * The defect: an invitation dies after seven days, the **Recipient** is told so on
 * `/invite/[token]`, and the **Initiator** was not — `readInstanceBundle` read `email,
 * counterparty_name, claimed_at` and left `expires_at` behind, so the panel that hands the
 * Initiator their link kept drawing it forever, for a URL the claim path refuses.
 *
 * Three claims, and each one is checked at the cheapest place it can be read:
 *
 *   the column   the instance bundle's invite query selects `expires_at` — asserted on the
 *                statement the store issued, not on the view model, because "the screen shows a
 *                date" is also true of a date the store invented;
 *   the clock    the state is `inviteStateOf()` over that column and the read's own `now`, so the
 *                **same row** reads `unclaimed` a day before `expires_at` and `expired` a day
 *                after it. Nothing is written between the two reads: no UPDATE, no INSERT, no
 *                `expired` value anywhere (`expires_at` is in `0002_two_party_flow.sql` and no
 *                later migration touches it);
 *   the screen   all three states are quoted out of the markup `AssessmentInstanceView` renders
 *                for that screen, with the date the row carries.
 *
 * **The client is a stub, on purpose** — the gate is database-free (`docs/GATE.md`), exactly as
 * `tests/flow-store-identity.test.ts` does it. The rows the stub answers with are the shape the
 * real columns have, including a `TIMESTAMPTZ` for `expires_at`, so `inviteStateOf()` is given a
 * `Date` and compares instants rather than strings. The live port for the same claim is
 * `scripts/flow-e2e.mjs` plus `pnpm db:verify`.
 *
 * The blind rule is asserted here too, because this card touches the read path that enforces it:
 * the opinion query must ask for the viewer's own role and nothing else, and the Counterparty's
 * answers — which the stub's "database" does hold — must not reach the view model or the markup.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { invitePageCopy } from "@/data/pages/invite";
import { assessments } from "@/data/assessments";
import type { ResendRefusal } from "@/lib/flow/resend";
import { reinvitePath } from "@/lib/flow/paths";
import { RESEND_LIFETIME_CAP } from "@/lib/flow/tokens";
import type { Assessment } from "@/content/assessment";
import type { ItemRow, OpinionRow, OptionRow, PartyRow, RecordRow } from "@/lib/db/rows";
import { INVITE_STATES, inviteStateOf } from "@/lib/flow/invite-state";
import type { FlowScreen } from "@/lib/flow/screen";
import { readFlowScreen } from "@/lib/flow/store";
import { mintToken } from "@/lib/flow/tokens";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

/* ------------------------------------------------------------------ *\
 * The rows
 * ------------------------------------------------------------------ */

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-expiry-test";
const TEMPLATE_RECORD_ID = "assessment-relationship-basics";

/** The invitation's deadline, and the two instants read against it. */
const EXPIRES_AT = new Date("2026-11-06T12:00:00.000Z");
const BEFORE_EXPIRY = new Date("2026-11-04T12:00:00.000Z");
const AFTER_EXPIRY = new Date("2026-11-07T12:00:00.000Z");

/** `2026-11-06` as the screen draws it — `content/core.ts`'s UTC formatter. */
const EXPIRY_DATE = "Nov 6, 2026";

const instanceRecord: RecordRow = {
  id: INSTANCE_ID,
  slug: "relationship-basics-expiry-test",
  record_type: "assessment",
  status: "draft",
  date: new Date("2026-10-30T12:00:00.000Z"),
  title: template.title,
  summary: `Answered by Avery and Rowan.`,
};

function instanceItems(): ItemRow[] {
  return template.items.map((item, position) => ({
    record_id: INSTANCE_ID,
    item_id: item.id,
    position,
    prompt: item.prompt,
    scale_kind: "score",
    left_value: item.leftValue,
    right_value: item.rightValue,
  }));
}

/** The template's own rows, as `readTemplate` asks for them. */
const templateItems: ItemRow[] = template.items.map((item, position) => ({
  record_id: TEMPLATE_RECORD_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const templateOptions: OptionRow[] = [];

/** The instance's copy of those rows — the Aspects the Initiator's answer sheet asks. */
const copiedItems: ItemRow[] = instanceItems();

/** A Counterparty who has answered everything — the answers the Initiator must never see. */
function counterpartyOpinions(): OpinionRow[] {
  return template.items.map((item) => ({
    instance_record_id: INSTANCE_ID,
    role: "counterparty",
    item_id: item.id,
    feel: 5,
    wish: 1,
    think: null,
    guess: null,
  }));
}

/* ------------------------------------------------------------------ *\
 * The stub client
 * ------------------------------------------------------------------ */

const stub = vi.hoisted(() => {
  interface Call {
    readonly text: string;
    readonly values: readonly unknown[];
  }

  interface InviteRow {
    readonly email: string;
    readonly counterparty_name: string;
    readonly claimed_at: Date | null;
    readonly expires_at: Date;
    readonly resent_at: Date | null;
    readonly resent_count: number;
  }

  const calls: Call[] = [];
  const state: {
    invite: InviteRow | undefined;
    parties: readonly PartyRow[];
    opinions: readonly OpinionRow[];
  } = { invite: undefined, parties: [], opinions: [] };

  /** One SQL statement, whitespace collapsed so a stub case reads as one line. */
  const narrow = (text: string) => text.replace(/\s+/g, " ").trim();

  function reset(): void {
    calls.length = 0;
    state.invite = undefined;
    state.parties = [];
    state.opinions = [];
  }

  async function query(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    const sql = narrow(text);

    if (sql.startsWith("SELECT role FROM party")) {
      return { rows: [{ role: "initiator" }], rowCount: 1 };
    }
    // The instance bundle. Matched before the template read below: both open with
    // `SELECT to_jsonb(r) AS record,`, and only this one joins `assessment_instance`.
    if (sql.includes("JOIN assessment_instance ai ON ai.record_id = r.id")) {
      return {
        rows: [
          {
            record: { ...instanceRecord, date: "2026-10-30T12:00:00.000Z" },
            template_record_id: TEMPLATE_RECORD_ID,
            mode: "basic",
            alignment_setting: "soft",
            items: copiedItems,
            options: templateOptions,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.startsWith("SELECT instance_record_id, role, name FROM party")) {
      return { rows: state.parties, rowCount: state.parties.length };
    }
    if (sql.startsWith("SELECT email, counterparty_name, claimed_at")) {
      return { rows: state.invite === undefined ? [] : [state.invite], rowCount: 1 };
    }
    if (sql.startsWith("SELECT p.role, (SELECT count(*) FROM opinion o")) {
      return {
        rows: state.parties.map((party) => ({ role: party.role, answered: 0 })),
        rowCount: state.parties.length,
      };
    }
    if (sql.startsWith("SELECT to_jsonb(r) AS record,")) {
      // `readTemplate` — the template the instance was copied from, which supplies the title
      // and summary the screen draws. Not an instance: the query's own `NOT EXISTS` guard.
      return {
        rows: [
          {
            record: {
              id: TEMPLATE_RECORD_ID,
              slug: "relationship-basics",
              record_type: "assessment",
              status: "published",
              date: "2026-10-01T00:00:00.000Z",
              title: template.title,
              summary: template.summary,
            },
            items: templateItems,
            options: templateOptions,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.startsWith("SELECT instance_record_id, role, item_id, feel, wish, think, guess")) {
      // What a correct store asks for: `role = ANY($2)`, and $2 is the visible roles only.
      const roles = values[1] as readonly string[];
      return {
        rows: state.opinions.filter((row) => roles.includes(row.role)),
        rowCount: state.opinions.length,
      };
    }
    throw new Error(`the stub client has no answer for: ${sql.slice(0, 90)}`);
  }

  return { calls, state, reset, query, narrow };
});

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({ query: stub.query }),
  DatabaseUnavailableError: class DatabaseUnavailableError extends Error {},
}));

/* ------------------------------------------------------------------ *\
 * Reading one screen
 * ------------------------------------------------------------------ */

const INVITE_TOKEN = mintToken();

function callsMatching(pattern: RegExp) {
  return stub.calls.filter((call) => pattern.test(stub.narrow(call.text)));
}

/** The screen the Initiator's browser would be handed at `now`, from these rows. */
async function initiatorScreen(now: Date): Promise<FlowScreen> {
  const screen = await readFlowScreen({
    instanceRecordId: INSTANCE_ID,
    token: INVITE_TOKEN,
    inviteToken: INVITE_TOKEN,
    now,
  });
  if (screen === undefined) throw new Error("the Initiator's screen did not resolve");
  return screen;
}

function render(screen: FlowScreen): string {
  return renderToStaticMarkup(
    createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
  );
}

/** The invitation panel's own sentence, as a reader sees it — tags out, entities in. */
function inviteSentence(markup: string): string {
  const panel = /<section data-invite-state="([a-z]+)"[\s\S]*?<\/section>/.exec(markup);
  if (panel === null) throw new Error("the marketing-free markup has no invite panel");
  const text = [...panel[0].matchAll(/<p class="font-medium">([\s\S]*?)<\/p>/g)]
    .map((match) => match[1] ?? "")
    .join(" ");
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function invitePanel(markup: string): { state: string; sentence: string } {
  const match = /<section data-invite-state="([a-z]+)"/.exec(markup);
  if (match === null) throw new Error("the markup has no invite panel");
  return { state: match[1] ?? "", sentence: inviteSentence(markup) };
}

/** An unclaimed, still-live invitation on an instance only the Initiator has a seat on. */
function unclaimedInvitation(over: Partial<NonNullable<(typeof stub.state)["invite"]>> = {}) {
  stub.reset();
  stub.state.invite = {
    email: "rowan@example.com",
    counterparty_name: "Rowan",
    claimed_at: null,
    expires_at: EXPIRES_AT,
    resent_at: null,
    resent_count: 0,
    ...over,
  };
  stub.state.parties = [{ instance_record_id: INSTANCE_ID, role: "initiator", name: "Avery" }];
}

/* ------------------------------------------------------------------ *\
 * The column
 * ------------------------------------------------------------------ */

describe("the instance bundle reads the invitation's deadline", () => {
  it("selects expires_at, so the screen can name the date instead of guessing it", async () => {
    unclaimedInvitation();
    await initiatorScreen(BEFORE_EXPIRY);

    const [bundleQuery] = callsMatching(
      /^SELECT email, counterparty_name, claimed_at, expires_at, resent_at, resent_count FROM instance_invite/,
    );
    expect(bundleQuery).toBeDefined();
    expect(bundleQuery.values).toEqual([INSTANCE_ID]);
  });

  it("is the only surface that needs it: no UPDATE, INSERT or new column on the read", async () => {
    unclaimedInvitation();
    await initiatorScreen(AFTER_EXPIRY);

    // Reading a screen writes nothing. An expiry kept by a job would appear here as an UPDATE.
    expect(callsMatching(/^(UPDATE|INSERT|DELETE) /)).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *\
 * The clock
 * ------------------------------------------------------------------ */

describe("expiry is derived at read time, from the row", () => {
  it("reads unclaimed a day before expires_at and expired a day after — same row", async () => {
    unclaimedInvitation();
    const before = await initiatorScreen(BEFORE_EXPIRY);
    const after = await initiatorScreen(AFTER_EXPIRY);

    expect(before.invite?.state).toBe("unclaimed");
    expect(after.invite?.state).toBe("expired");
    // Same row, same invitation: the only thing that changed is the instant it was read at.
    expect(before.invite?.expiresAt).toBe(EXPIRES_AT.toISOString());
    expect(after.invite?.expiresAt).toBe(EXPIRES_AT.toISOString());
  });

  it("is dead at expires_at exactly, the instant the claim refuses", () => {
    const facts = { claimed: false, expiresAt: EXPIRES_AT };
    expect(inviteStateOf(facts, new Date(EXPIRES_AT.getTime() - 1))).toBe("unclaimed");
    expect(inviteStateOf(facts, EXPIRES_AT)).toBe("expired");
  });

  it("keeps claimed ahead of expired — an invitation claimed in its window stays claimed", () => {
    const facts = { claimed: true, expiresAt: EXPIRES_AT };
    expect(inviteStateOf(facts, AFTER_EXPIRY)).toBe("claimed");
    expect(INVITE_STATES).toEqual(["unclaimed", "expired", "claimed"]);
  });

  it("withholds the link once expired, so the panel cannot offer a dead URL", async () => {
    unclaimedInvitation();
    const before = await initiatorScreen(BEFORE_EXPIRY);
    const after = await initiatorScreen(AFTER_EXPIRY);

    expect(before.invite?.link).toBe(`http://localhost:3000/invite/${INVITE_TOKEN}`);
    expect(after.invite?.link).toBeNull();
    expect(render(before)).toContain(`/invite/${INVITE_TOKEN}`);
    expect(render(after)).not.toContain(`/invite/${INVITE_TOKEN}`);
  });
});

/* ------------------------------------------------------------------ *\
 * The screen — the three states, quoted
 * ------------------------------------------------------------------ */

describe("the Initiator's screen draws three states", () => {
  it("quotes not-claimed-yet, with the deadline", async () => {
    unclaimedInvitation();
    const panel = invitePanel(render(await initiatorScreen(BEFORE_EXPIRY)));

    expect(panel.state).toBe("unclaimed");
    expect(panel.sentence).toBe(
      `Rowan has not claimed the invitation yet (it expires ${EXPIRY_DATE})`,
    );
  });

  it("quotes expired, naming the date", async () => {
    unclaimedInvitation();
    const panel = invitePanel(render(await initiatorScreen(AFTER_EXPIRY)));

    expect(panel.state).toBe("expired");
    expect(panel.sentence).toBe(
      `This invitation expired on ${EXPIRY_DATE}. The link no longer works — send Rowan a new one below.`,
    );
    // Red panel, not the neutral one: the state is meant to be readable before the sentence is.
    expect(render(await initiatorScreen(AFTER_EXPIRY))).toContain("bg-red-50");
  });

  it("quotes claimed, unchanged", async () => {
    unclaimedInvitation({ claimed_at: new Date("2026-11-01T12:00:00.000Z") });
    stub.state.parties = [
      { instance_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
      { instance_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
    ];

    const markup = render(await initiatorScreen(AFTER_EXPIRY));
    const panel = invitePanel(markup);

    expect(panel.state).toBe("claimed");
    expect(panel.sentence).toBe("Rowan has claimed the invitation");
    expect(markup).toContain("bg-emerald-50");
  });

  it("distinguishes all three in the markup, not only in the view model", async () => {
    unclaimedInvitation();
    const live = render(await initiatorScreen(BEFORE_EXPIRY));
    const dead = render(await initiatorScreen(AFTER_EXPIRY));

    unclaimedInvitation({ claimed_at: new Date("2026-11-01T12:00:00.000Z") });
    stub.state.parties = [
      { instance_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
      { instance_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
    ];
    const taken = render(await initiatorScreen(AFTER_EXPIRY));

    expect(invitePanel(live).state).toBe("unclaimed");
    expect(invitePanel(dead).state).toBe("expired");
    expect(invitePanel(taken).state).toBe("claimed");
    expect(new Set([live, dead, taken]).size).toBe(3);
  });
});

/* ------------------------------------------------------------------ *\
 * The blind rule
 * ------------------------------------------------------------------ */

describe("the blind rule survives the new read", () => {
  it("asks for the viewer's own opinions only, while the Counterparty has answered", async () => {
    unclaimedInvitation({ claimed_at: new Date("2026-11-01T12:00:00.000Z") });
    stub.state.parties = [
      { instance_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
      { instance_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
    ];
    // Their answers exist in the "database" — 5/1 on every Aspect. The Initiator has none.
    stub.state.opinions = counterpartyOpinions();

    const screen = await initiatorScreen(BEFORE_EXPIRY);

    const [opinionQuery] = callsMatching(/^SELECT instance_record_id, role, item_id, feel/);
    expect(opinionQuery).toBeDefined();
    // The one query that could leak: `role = ANY($2)` bound to nothing but the viewer's role.
    expect(opinionQuery.values[1]).toEqual(["initiator"]);

    // Nothing reached the view model: every Aspect is unanswered, from the Initiator's seat.
    expect(screen.aspects.every((aspect) => aspect.own === null)).toBe(true);
    expect(screen.report).toBeNull();
    const serialized = JSON.stringify(screen);
    expect(serialized).not.toContain('"role":"counterparty"');
    expect(serialized).not.toContain("data-feel-gap");

    // And nothing reached the markup: every select still shows "no answer chosen", and there is
    // no Gap band and no "In synch" — the two ways a score of theirs could reach the reader.
    const markup = render(screen);
    const preselected = [...markup.matchAll(/<option value="([^"]*)" selected=""/g)].map(
      (match) => match[1],
    );
    expect(preselected).toHaveLength(screen.aspects.length * 2);
    expect(preselected.every((value) => value === "")).toBe(true);
    expect(markup).not.toContain("data-feel-gap");
    expect(markup).not.toContain("In synch");
  });
});

/* ------------------------------------------------------------------ *\
 * The Recipient's page keeps its own four states
 * ------------------------------------------------------------------ */

describe("the Recipient's page is untouched", () => {
  it("still says the four words it always did, and now points at a re-send", () => {
    // The copy the Recipient reads lives in `data/pages/invite.ts` and is asserted here by value.
    // #266 changed the Initiator's panel only and left this sentence alone; #275 changed it on
    // purpose, by one clause: re-invite now exists, so "start a new instance" stopped being the
    // honest next step — the same invitation can be reissued. The heading and the seven-day fact
    // are unchanged.
    const expired = invitePageCopy.sections?.find((entry) => entry.id === "expired");

    expect(expired?.heading).toBe("This invitation has expired");
    expect(expired?.body).toBe(
      "Invitations last seven days. Ask {initiator} to send you a new one.",
    );
  });
});

/* ------------------------------------------------------------------ *\
 * The re-invite control (#275)
 * ------------------------------------------------------------------ */

describe("the Initiator's panel offers one recovery action", () => {
  const renderWith = (screen: FlowScreen, resendRefusal?: ResendRefusal): string =>
    renderToStaticMarkup(
      createElement(AssessmentInstanceView, {
        screen,
        copy: assessmentInstancePageCopy,
        ...(resendRefusal === undefined ? {} : { resendRefusal }),
      }),
    );

  const SENTENCE = (code: ResendRefusal): string =>
    fillLabel(itemLabel(sectionOf(assessmentInstancePageCopy, "invite"), code), {
      counterparty: "Rowan",
    });

  it("is drawn while the invitation is unclaimed, pre-filled with the address on the row", async () => {
    unclaimedInvitation();
    const markup = renderWith(await initiatorScreen(BEFORE_EXPIRY));

    expect(markup).toContain("data-reinvite-form");
    expect(markup).toContain(`action="${reinvitePath(INSTANCE_ID)}"`);
    expect(markup).toContain('name="email"');
    expect(markup).toContain('value="rowan@example.com"');
    // No refusal on a plain visit: the alert is the redirect's fact, not a standing panel.
    expect(markup).not.toContain("data-resend-refusal");
  });

  it("is drawn on an expired invitation too — the dead end the action exists for", async () => {
    unclaimedInvitation();
    const markup = renderWith(await initiatorScreen(AFTER_EXPIRY));

    expect(markup).toContain("data-reinvite-form");
    // And the sentence it sits under now points at the form rather than at a new instance.
    expect(markup).toContain("send Rowan a new one below");
  });

  it("is not drawn once the invitation is claimed — the seat is taken", async () => {
    unclaimedInvitation({ claimed_at: new Date("2026-11-01T12:00:00.000Z") });
    stub.state.parties = [
      { instance_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
      { instance_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
    ];

    const markup = renderWith(await initiatorScreen(AFTER_EXPIRY));
    expect(markup).toContain('data-invite-state="claimed"');
    expect(markup).not.toContain("data-reinvite-form");
  });

  it("draws the budget once the invitation has been re-sent", async () => {
    unclaimedInvitation({
      resent_at: new Date("2026-11-05T12:00:00.000Z"),
      resent_count: 2,
    });
    const markup = renderWith(await initiatorScreen(BEFORE_EXPIRY));

    expect(markup).toContain('data-resend-count="2"');
    expect(markup).toContain(`Re-invitations sent: 2 of ${RESEND_LIFETIME_CAP}`);
  });

  it("draws no budget before the first re-invite", async () => {
    unclaimedInvitation();
    expect(renderWith(await initiatorScreen(BEFORE_EXPIRY))).not.toContain("data-resend-count");
  });

  it("renders each refusal as its own sentence, above the panels", async () => {
    unclaimedInvitation();
    const screen = await initiatorScreen(BEFORE_EXPIRY);

    for (const code of ["cooldown", "cap-reached", "already-claimed"] as const) {
      const markup = renderWith(screen, code);
      expect(markup).toContain(`data-resend-refusal="${code}"`);
      expect(markup).toContain(SENTENCE(code));
      // Above the invitation panel: the alert is drawn before the section in document order.
      expect(markup.indexOf("data-resend-refusal")).toBeLessThan(
        markup.indexOf("data-invite-state"),
      );
    }
  });
});
