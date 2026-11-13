// @vitest-environment jsdom
/**
 * `/admin/instances/[id]` — the reissue band's address field is **controlled**, and it is the
 * address the operator typed that reaches the server (#980).
 *
 * The atlas capture on `main` `c2029a5e` logged, at every width:
 *
 *     A component contains an input of type email with both `value` and `defaultValue` props
 *
 * React's answer to that pair is to treat the input as uncontrolled from then on: the initial
 * `defaultValue` wins and later `value` changes may be ignored, so the operator could type a
 * corrected address, read it back on screen, and submit the old one. The screen's own copy calls
 * the field "Send to a corrected address (optional)" and `submit()` reads the address out of
 * state — so state is the truth and the server's address is only the seed. The fix is one deleted
 * prop, and this file is what says so:
 *
 *   1. **The field seeds from the server's address** — the invitation's email is in the input on
 *      first paint, so an untouched field still reissues to the party who was invited.
 *   2. **Nothing logs the controlled/uncontrolled warning on mount.** The spy is the acceptance
 *      criterion the card names, not a proxy for it: React emits exactly this line at exactly
 *      this condition.
 *   3. **What is typed is what is submitted** — the payload `action` receives carries the edited
 *      address, and an untouched field submits the seeded one.
 *
 * jsdom and `createRoot`, not `renderToStaticMarkup`: the claim is about an interaction across a
 * re-render, and a static render has neither state nor a submit. `tests/
 * admin-relationship-operations.test.tsx` keeps the static half (which bands exist, what they say).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RelationshipOperations } from "@/components/admin/relationship-operations";
import { adminRelationshipPageCopy } from "@/data/pages/admin-relationship";
import type { RepairInput } from "@/lib/admin/repairs";
import type { AdminRelationshipDetail, AdminSeat } from "@/lib/db/admin-relationship";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** The address the server has on the invitation, and the one the operator corrects it to. */
const INVITED = "rowan@example.com";
const CORRECTED = "rowan.reyes@example.com";

const EXPIRY_INSTANT = "2026-11-19T10:00:00.000Z";

function seat(overrides: Partial<AdminSeat> = {}): AdminSeat {
  return {
    role: "initiator",
    name: "Avery",
    hasAccount: true,
    answered: 3,
    acceptedAt: null,
    impersonatedBy: null,
    unlockSeenAt: null,
    ...overrides,
  };
}

/** A live relationship with an unclaimed invitation — the row that offers the reissue band. */
function detail(): AdminRelationshipDetail {
  return {
    instanceRecordId: "inst-1",
    relationshipId: "relationship-inst-1",
    slug: "avery-rowan",
    name: "Avery & Rowan",
    templateTitle: "Parent & Child",
    mode: "basic",
    setting: "soft",
    status: "answering",
    voided: false,
    voidedAt: null,
    aspects: 3,
    seats: [seat(), seat({ role: "counterparty", name: "Rowan", hasAccount: false })],
    invite: {
      email: INVITED,
      expiresAt: EXPIRY_INSTANT,
      claimedAt: null,
      revokedAt: null,
      state: "unclaimed",
      resentCount: 0,
    },
  };
}

let container: HTMLDivElement;
let root: Root;
/** Every `console.error` line the mount produced, joined — the warning React would print. */
let logged: string[];
let submitted: RepairInput[];

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  submitted = [];
  logged = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

/** Mount the screen and hand back the reissue band's form and its address input. */
function mount(): { form: HTMLFormElement; input: HTMLInputElement } {
  act(() => {
    root.render(
      <RelationshipOperations
        copy={adminRelationshipPageCopy}
        detail={detail()}
        action={async (input) => {
          submitted.push(input);
          return { ok: false, code: "failed" };
        }}
      />,
    );
  });

  const band = container.querySelector('[data-repair="resend"]');
  expect(band, "the screen drew no reissue band").not.toBeNull();
  const form = band?.querySelector("form");
  const input = band?.querySelector('input[name="email"]');
  expect(form, "the reissue band is not a form").not.toBeNull();
  expect(input, "the reissue band drew no address input").not.toBeNull();
  return { form: form as HTMLFormElement, input: input as HTMLInputElement };
}

/**
 * Type into the input the way a browser does.
 *
 * React 19 keeps its own value tracker on the node, so setting `input.value` alone is swallowed;
 * the native setter plus a bubbling `input` event is the sequence a keystroke produces.
 */
function type(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  act(() => {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Press the band's submit button and let the action's promise settle. */
async function submit(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("the reissue band's address field is controlled (#980)", () => {
  it("seeds the input with the invitation's address and logs no controlled/uncontrolled warning", () => {
    const { input } = mount();

    expect(input.value).toBe(INVITED);

    expect(
      logged.filter((line) => line.includes("defaultValue")),
      "React warned that the address input mixes value and defaultValue",
    ).toEqual([]);
  });

  it("submits the corrected address the operator typed, not the one the server sent", async () => {
    const { form, input } = mount();

    type(input, CORRECTED);
    expect(input.value).toBe(CORRECTED);

    await submit(form);

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({
      repair: "resend",
      instanceRecordId: "inst-1",
      email: CORRECTED,
    });
  });

  it("submits the invitation's address when the operator corrects nothing", async () => {
    const { form } = mount();

    await submit(form);

    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toMatchObject({ repair: "resend", email: INVITED });
  });
});
