/**
 * **The create endpoint cannot publish — #957's server half.**
 *
 * #957 removed the catalogue's per-card form, so no screen can reach `POST /assessment/new` with a
 * bare post any more. That closed the *render*; it did not close the **request**. The endpoint kept
 * the pre-#688 one-form create for a post that carried no `draft=1` and no stage-1 draft cookie,
 * and that path wrote a relationship **published**, minted an invitation and mailed it — with no
 * plan joined and no card on file, which is exactly what #911's send gate exists to stop.
 *
 * Measured against `localhost:3001` before the fix (signed in as a creator made through the app's
 * own sign-up): `303 → /assessment/instances/<id>?invite=sent`, `relationship.status = published`,
 * `published_at` stamped, one `party` row, one `session_invite`, zero `plan_grant`, one card-capture
 * row. A `curl` could do what the product says only stage 5 may do.
 *
 * So the assertions here are about the **request**, not a render:
 *
 *   1. a post with no `draft=1` is refused with a 303 and a **named reason** (`?problem=`) — the
 *      house shape (#427), never a JSON body and never a 500 — and the store is never asked;
 *   2. the same post is refused even when the browser *does* hold a stage-1 draft: the draft is
 *      what stage 4 saves, and publishing is stage 5's decision, not a form field;
 *   3. the stage-4 form itself still writes the draft, to stage 5, with `draft: true` — the path
 *      #825 requires and this card must not break;
 *   4. the named reason has a sentence and a door in the fixture, so the band it lands on is not
 *      a wall (#870) — the door is stage 1 of that same template.
 *
 * The store is stubbed at its module boundary (`tests/answer-sheet-refusal.test.ts`'s pattern), so
 * this is the route's contract with no database. `scripts/flow-e2e.mjs` is the live half.
 */
import { describe, expect, it, vi } from "vitest";

import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { CREATE_NOT_FROM_FLOW, createRefusal } from "@/lib/flow/create-copy";
import {
  EMPTY_CREATE_DRAFT,
  type CreateDraft,
  serializeCreateDraft,
} from "@/lib/flow/create-draft";
import { createCommitPath, createRelationshipPath } from "@/lib/flow/paths";
import { createDraftCookieName } from "@/lib/flow/session";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const TEMPLATE_ID = "assessment-relationship-basics";
const TEMPLATE_SLUG = "relationship-basics";
const INSTANCE_ID = "assessment-instance-server-half";

/** What the route asked the store for, per test — empty means the create never happened. */
const stub = vi.hoisted(() => ({
  creates: [] as { draft?: boolean; templateRecordId?: string }[],
  draftCookie: null as null | string,
}));

/**
 * The store, stubbed whole: the route imports a class (`instanceof FlowError`) and one function, and
 * pulling the real module in would drag `pg` into a suite that never opens a connection.
 */
vi.mock("@/lib/flow/store", () => {
  class FlowError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  }
  return {
    FlowError,
    createInstanceFromTemplate: async (input: { draft?: boolean; templateRecordId?: string }) => {
      stub.creates.push({ draft: input.draft, templateRecordId: input.templateRecordId });
      return {
        instanceRecordId: "assessment-instance-server-half",
        initiatorToken: "initiator-token",
        inviteToken: "invite-token",
        templateTitle: "Relationship Basics",
      };
    },
  };
});

// The template resolves to its slug; no database read is involved in resolving a refusal's target.
vi.mock("@/lib/db/template-library", () => ({
  templateSlugOf: async (id: string) => (id === "" ? "" : "relationship-basics"),
}));

// Signed in: this is the crafted *request* being measured, not the signed-out door.
vi.mock("@/lib/auth/session", () => ({
  currentUserIfConfigured: async () => ({
    userId: "user-server-half",
    email: "creator@example.test",
  }),
}));

/** A cookie jar with no write refusal and no Next request behind it. */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const name2 = createDraftCookieName("assessment-relationship-basics");
      if (name !== name2 || stub.draftCookie === null) return undefined;
      return { name, value: stub.draftCookie };
    },
    set: () => undefined,
    delete: () => undefined,
  }),
}));

import { POST } from "@/app/(mainlayout)/assessment/new/route";

/** The pre-#688 one-form create: the fields a `curl` would send, and no `draft` key at all. */
function bareRequest(): Request {
  const form = new FormData();
  form.set("templateRecordId", TEMPLATE_ID);
  form.set("mode", "basic");
  form.set("alignmentSetting", "soft");
  form.set("initiatorName", "Avery Probe");
  form.set("counterpartyName", "Rowan Probe");
  form.set("email", "rowan@example.test");
  return new Request("http://localhost:3000/assessment/new", { method: "POST", body: form });
}

/** Stage 4's own form: the template and the flag, nothing else. */
function stageFourRequest(): Request {
  const form = new FormData();
  form.set("templateRecordId", TEMPLATE_ID);
  form.set("draft", "1");
  return new Request("http://localhost:3000/assessment/new", { method: "POST", body: form });
}

const DRAFT: CreateDraft = {
  ...EMPTY_CREATE_DRAFT,
  initiatorFirst: "Avery",
  initiatorLast: "Probe",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Probe",
  email: "rowan@example.test",
  title: "Quarterly check-in",
  mode: "basic",
  alignmentSetting: "soft",
};

describe("a create that did not come through the flow", () => {
  it("is refused with a named reason, and writes nothing", async () => {
    stub.creates.length = 0;
    stub.draftCookie = null;

    const response = await POST(bareRequest());

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe(createRelationshipPath(TEMPLATE_SLUG));
    expect(location.searchParams.get("problem")).toBe(CREATE_NOT_FROM_FLOW);
    // The point of the whole card: the store was never reached, so no row, no invitation, no mail.
    expect(stub.creates).toEqual([]);
  });

  it("is refused even when the browser holds a stage-1 draft", async () => {
    stub.creates.length = 0;
    // The draft cookie is exactly what stages 1–3 write; publishing is still stage 5's decision.
    stub.draftCookie = serializeCreateDraft(DRAFT);

    const response = await POST(bareRequest());

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    // It walked the flow, so the refusal lands above stage 4's own card rather than at stage 1.
    expect(location.pathname).toBe(createCommitPath(TEMPLATE_SLUG));
    expect(location.searchParams.get("problem")).toBe(CREATE_NOT_FROM_FLOW);
    expect(stub.creates).toEqual([]);
  });

  it("still writes stage 4's draft, and sends nothing", async () => {
    stub.creates.length = 0;
    stub.draftCookie = serializeCreateDraft(DRAFT);

    const response = await POST(stageFourRequest());

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    // Stage 5 is where the send is decided; the create's own redirect reports no `invite=` outcome.
    expect(location.pathname).toBe("/templates/relationship/relationship-basics/create/invite");
    expect(location.searchParams.get("instance")).toBe(INSTANCE_ID);
    expect(location.searchParams.get("invite")).toBeNull();
    expect(stub.creates).toEqual([{ draft: true, templateRecordId: TEMPLATE_ID }]);
  });

  it("names a sentence and a door in the fixture, so the band is not a wall", () => {
    const refusal = createRefusal(CREATE_NOT_FROM_FLOW, undefined, { slug: TEMPLATE_SLUG });

    expect(refusal).not.toBeNull();
    expect(refusal?.sentence.trim().length ?? 0).toBeGreaterThan(20);
    // The door is the flow's own stage 1 — the address every catalogue card opens since #957.
    expect(refusal?.link?.href).toBe(createRelationshipPath(TEMPLATE_SLUG));
    expect(refusal?.link?.label).toBe("Start the relationship");
    // And it is a fixture string, not prose in a component: the band reads copy, never markup.
    const problems = sectionOf(assessmentCreatePageCopy, "problems");
    expect(itemLabel(problems, CREATE_NOT_FROM_FLOW).trim().length).toBeGreaterThan(20);
  });
});
