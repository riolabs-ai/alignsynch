/**
 * **The draft that could not be created says so calmly — #1226.**
 *
 * `POST /assessment/new` answered every unnameable throw as a JSON 500 (#1205), which is right for
 * a `curl` and wrong for a person: a browser form post printed
 * `{"code":"create-failed","sqlstate":"42703","message":"column …"}` in the window. The card adds a
 * state, it does not re-plumb the route, so this file pins both halves of the split:
 *
 *   1. **A browser form post is sent to the drawn screen.** `Accept: text/html` → 303
 *      `/assessment/new/failed?template=<slug>`; the SQLSTATE and the driver's sentence stay in the
 *      server log and never reach the address or the page.
 *   2. **Every other caller keeps the body it reads.** No `Accept`, or `application/json`, is still
 *      the named 500 `tests/create-error-shape.test.ts` pins — that is the QA walk's evidence and a
 *      support script's greppable cause.
 *   3. **The refusal path is untouched.** A `FlowError` is still a 303 `?problem=` back to the stage
 *      that posted it, because those are the person's own errors and this screen is not one.
 *   4. **The screen is the artifact's.** The four strings are `create-failed.html`'s verbatim, the
 *      two actions are real links, and no database word appears in the render.
 *
 * The store is stubbed at its module boundary, exactly as `create-error-shape.test.ts` does, so
 * this is the route's contract with no database. The render is `renderToStaticMarkup` over the real
 * component and the real fixture: no server, no session, no clock.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateFailedState } from "@/components/assessment-flow/create-failed";
import { assessmentCreateFailedPageCopy } from "@/data/pages/assessment-create-failed";
import {
  CREATE_FAILED_PATH,
  createCommitPath,
  createFailedPath,
  createRelationshipPath,
  templateSlugParam,
} from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** What the store does on the next create, per case. */
const stub = vi.hoisted(() => ({
  failure: null as null | Error,
}));

vi.mock("@/lib/flow/store", () => {
  class FlowError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "FlowError";
      this.code = code;
    }
  }
  return {
    FlowError,
    createSessionFromTemplate: async () => {
      if (stub.failure !== null) throw stub.failure;
      return {
        sessionRecordId: "assessment-session-create-failed",
        initiatorToken: "initiator-token",
        inviteToken: "invite-token",
        templateTitle: "Relationship Basics",
      };
    },
  };
});

// The template resolves to its slug; a create that names none resolves to the empty string.
vi.mock("@/lib/db/template-library", () => ({
  templateSlugOf: async (id: string) => (id === "" ? "" : "relationship-basics"),
}));

vi.mock("@/lib/auth/session", () => ({
  currentUserIfConfigured: async () => ({
    userId: "user-create-failed",
    email: "creator@example.test",
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

import { POST } from "@/app/(mainlayout)/assessment/new/route";

const TEMPLATE_ID = "assessment-relationship-basics";

/** The `Accept` header a browser's form submission carries — measured from Chrome. */
const BROWSER_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

/** Stage 4's form: the template and the flag. An optional `Accept`, so the caller decides. */
function stageFourRequest(options: { accept?: string; templateRecordId?: string } = {}): Request {
  const form = new FormData();
  form.set("templateRecordId", options.templateRecordId ?? TEMPLATE_ID);
  form.set("draft", "1");
  const headers = new Headers();
  if (options.accept !== undefined) headers.set("accept", options.accept);
  return new Request("http://localhost:3000/assessment/new", {
    method: "POST",
    body: form,
    headers,
  });
}

/** A `pg` `DatabaseError`, as the driver builds it — the throw production answered in 2026-11-18. */
function databaseError(code: string, message: string): Error {
  const error = new Error(message);
  Object.assign(error, { code, severity: "ERROR", routine: "errorMissingColumn" });
  return error;
}

/** Run the route with the store set to throw, keeping the server log out of the test output. */
async function postWithFailure(
  failure: Error,
  options: { accept?: string; templateRecordId?: string } = {},
): Promise<{ response: Response; logged: unknown[][] }> {
  stub.failure = failure;
  const logged: unknown[][] = [];
  const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logged.push(args);
  });
  try {
    return { response: await POST(stageFourRequest(options)), logged };
  } finally {
    spy.mockRestore();
    stub.failure = null;
  }
}

const MISSING_COLUMN = databaseError(
  "42703",
  'column "state" of relation "session" does not exist',
);

describe("a create the store could not finish, posted from a browser form", () => {
  it("redirects to the drawn screen instead of printing the database's sentence", async () => {
    const { response, logged } = await postWithFailure(MISSING_COLUMN, { accept: BROWSER_ACCEPT });

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe(CREATE_FAILED_PATH);
    expect(location.searchParams.get("template")).toBe("relationship-basics");

    // The body is not a JSON document the browser would print: there is no body at all.
    expect(await response.text()).toBe("");

    // The address carries no cause — a crafted share of this URL says nothing about the deployment.
    expect(location.toString()).not.toContain("42703");
    expect(location.toString()).not.toContain("column");

    // And the log line is byte-for-byte the one #1205 shipped, which is where the cause lives.
    const line = logged.find((args) => args[0] === "create-failed");
    expect(line).toEqual([
      "create-failed",
      "42703",
      'column "state" of relation "session" does not exist',
    ]);
  });

  it("lands on the screen without a query when the post named no template", async () => {
    const { response } = await postWithFailure(MISSING_COLUMN, {
      accept: BROWSER_ACCEPT,
      templateRecordId: "",
    });

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe(CREATE_FAILED_PATH);
    expect(location.search).toBe("");
  });

  it("still answers the named JSON 500 to a caller that does not ask for HTML", async () => {
    // No `Accept` at all: a `curl`, a QA walk, the flow's own harness.
    const bare = await postWithFailure(MISSING_COLUMN);
    expect(bare.response.status).toBe(500);
    const bareBody = (await bare.response.json()) as { code?: string; sqlstate?: string };
    expect(bareBody.code).toBe("create-failed");
    expect(bareBody.sqlstate).toBe("42703");

    // And an explicitly non-HTML accept is the same caller class, not a browser.
    const json = await postWithFailure(MISSING_COLUMN, { accept: "application/json" });
    expect(json.response.status).toBe(500);
    expect(json.response.headers.get("location")).toBeNull();
  });

  it("keeps a refusal a redirect to the stage that posted it, not this screen", async () => {
    const { FlowError } = await import("@/lib/flow/store");
    const { response } = await postWithFailure(
      new FlowError("template-has-no-aspects", "that template asks nothing of either seat"),
      { accept: BROWSER_ACCEPT },
    );

    expect(response.status).toBe(303);
    const location = new URL(response.headers.get("location") ?? "");
    // No draft cookie in this harness, so the refusal lands on the flow's door — the stage-1 address
    // `refusalTarget()` chooses for a post that came without one. Unchanged by this card.
    expect(location.pathname).toBe(createRelationshipPath("relationship-basics"));
    expect(location.searchParams.get("problem")).toBe("template-has-no-aspects");
    expect(location.pathname).not.toBe(CREATE_FAILED_PATH);
  });
});

describe("the address the screen is given", () => {
  it("carries the template as a handle and nothing else", () => {
    expect(createFailedPath("relationship-basics")).toBe(
      "/assessment/new/failed?template=relationship-basics",
    );
    expect(createFailedPath("")).toBe(CREATE_FAILED_PATH);
    expect(createFailedPath("   ")).toBe(CREATE_FAILED_PATH);
  });

  it("reads back only a value shaped like a record's slug", () => {
    expect(templateSlugParam("relationship-basics")).toBe("relationship-basics");
    expect(templateSlugParam("relationship-basics-2")).toBe("relationship-basics-2");
    // Everything below is a crafted address: each is treated as absent rather than built into a link.
    expect(templateSlugParam(undefined)).toBe("");
    expect(templateSlugParam("")).toBe("");
    expect(templateSlugParam("../admin")).toBe("");
    expect(templateSlugParam("Relationship-Basics")).toBe("");
    expect(templateSlugParam("a--b")).toBe("");
    expect(templateSlugParam("a/b")).toBe("");
  });
});

describe("the drawn screen", () => {
  const markup = renderToStaticMarkup(
    createElement(CreateFailedState, {
      copy: assessmentCreateFailedPageCopy,
      retryHref: createCommitPath("relationship-basics"),
      dashboardHref: "/dashboard",
    }),
  );

  it("draws the artifact's strings, verbatim", () => {
    // `create-failed.html:61-65`.
    expect(markup).toContain("Couldn&#x27;t Create This Draft");
    expect(markup).toContain("Try Again Shortly.");
    expect(markup).toContain(">Try Again<");
    expect(markup).toContain(">Back to Dashboard<");
  });

  it("offers two real links, and Try Again goes back into the create flow", () => {
    expect(markup).toContain('href="/dashboard/templates/relationship-basics/create/commit"');
    expect(markup).toContain('href="/dashboard"');
  });

  it("says nothing about the database", () => {
    for (const word of ["42703", "sqlstate", "column", "postgres", "session"]) {
      expect(markup.toLowerCase()).not.toContain(word);
    }
  });

  it("is a status region labelled by its heading, with the icon as the mark", () => {
    expect(markup).toContain('data-tone="status"');
    expect(markup).toContain('aria-labelledby="create-failed-title"');
    expect(markup).toContain('id="create-failed-title"');
    // The icon is decorative; the heading is the word the status rule asks for.
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("bg-status-chip");
    expect(markup).toContain("border-status-line");
  });

  it("uses the design tokens rather than raw status hues", () => {
    for (const raw of ["amber", "slate", "red-", "gray-"]) {
      expect(markup).not.toContain(raw);
    }
  });

  it("falls back to the library when no template is named", () => {
    const fallback = renderToStaticMarkup(
      createElement(CreateFailedState, {
        copy: assessmentCreateFailedPageCopy,
        retryHref: "/dashboard/templates",
        dashboardHref: "/dashboard",
      }),
    );
    expect(fallback).toContain('href="/dashboard/templates"');
  });

  it("keeps the fixture's four strings as the whole surface", () => {
    const actions = sectionOf(assessmentCreateFailedPageCopy, "actions");
    expect(assessmentCreateFailedPageCopy.heading).toBe("Couldn't Create This Draft");
    expect(assessmentCreateFailedPageCopy.subtitle).toBe(
      "Try Again Shortly. Nothing was sent and nothing was charged.",
    );
    expect(itemLabel(actions, "retry")).toBe("Try Again");
    expect(itemLabel(actions, "dashboard")).toBe("Back to Dashboard");
  });

  it("says what did not happen — nothing sent, nothing charged (copy rule 9)", () => {
    // The guide promises three things, and the third is the one that says the failure cost them
    // nothing: `guides/initiator/if-a-draft-cant-be-created.md`, and copy rule 9 in one line.
    expect(assessmentCreateFailedPageCopy.subtitle).toContain("Nothing was sent");
    expect(assessmentCreateFailedPageCopy.subtitle).toContain("nothing was charged");
    expect(markup).toContain("Nothing was sent and nothing was charged.");
  });
});
