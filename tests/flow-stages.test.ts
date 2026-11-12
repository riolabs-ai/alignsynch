/**
 * The flow is five stages, and the spec that says so is binding (#735, #825).
 *
 * `docs/specs/flow-stages.md` fixes four things this file checks, and each of them has drifted
 * before: the five words and their order, the `Stage {n} of 5` line, the absence of a seventh
 * stage, and the fact that `Align` is **not a cell at all** — it is the dashboard's surface, and
 * the rail that says where somebody is uses five words only.
 *
 * The card asked for a test that *bites*, so every assertion here is against what renders or
 * against the source the gate ships, never against a second copy of the words:
 *
 *   words     `data/pages/lifecycle.ts`, the one home, read directly;
 *   count     the rendered rail, for every `current` it can be given;
 *   no seventh  the flow's copy and the whole `app/(mainlayout)/assessment` tree, scanned for
 *             the retired word and for an `ongoing` path segment — a rail word is one place a
 *             stage can come back, and a route is the other;
 *   no Align  the rendered rail on every stage, and `SentState` over two real `projectScreen()`
 *             projections: the confirmation draws the band at Invite and no sixth cell, because
 *             #825 moved Align out of the flow.
 *
 * The projection is the shipped one (`lib/flow/screen.ts`), so the two screens are built the way
 * the route builds them and the status under test is `instanceStatusOf()`'s answer, not a string
 * this file typed.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SentState } from "@/components/assessment-flow/sent-state";
import { StageRail } from "@/components/assessment-flow/stage-rail";
import type { Assessment } from "@/content/assessment";
import { assessments } from "@/data/assessments";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { assessmentSentPageCopy } from "@/data/pages/assessment-sent";
import { lifecycleStageSection } from "@/data/pages/lifecycle";
import type { FlowInvite, FlowScreen } from "@/lib/flow/screen";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";
import { instancePath } from "@/lib/flow/paths";
import { alignAvailableOf } from "@/lib/flow/stage";
import type { ItemRow, PartyRow } from "@/lib/db/rows";

/**
 * `StageShell`'s only Next dependency is `useRouter`, and nothing here navigates. Stubbing it
 * keeps a render a render.
 */
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

/** The five words the spec fixes, in order — written once here so a rename is one line of diff. */
const STAGES = ["Details", "Settings", "Aspects", "Account", "Invite"] as const;

/**
 * The copy the flow ships, and the components that draw it. The scan is deliberately the flow's
 * own set: `Ongoing` is a tournament state in another domain (`data/pages/tournaments.ts`), and a
 * check that could not tell the two apart would be a check nobody could keep green.
 */
const FLOW_COPY = [
  "data/pages/lifecycle.ts",
  "data/pages/assessment-create.ts",
  "data/pages/assessment-sent.ts",
  "data/pages/assessment-instance.ts",
];
const FLOW_COMPONENTS = "components/assessment-flow";
const FLOW_ROUTES = join("app", "(mainlayout)", "assessment");

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/** Every file under a directory, relative to the repo root. */
function tree(dir: string): string[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((entry) => join(dir, entry))
    .filter((entry) => /\.(ts|tsx)$/.test(entry));
}

/** The retired seventh word, matched case-insensitively: the defect is the word, not its case. */
const RETIRED = /ongoing/i;

describe("the five stage words", () => {
  it("are Details · Settings · Aspects · Account · Invite, in that order", () => {
    expect(lifecycleStageSection.id).toBe("stages");
    expect(
      lifecycleStageSection.items
        ?.filter((item) => /^[1-5]$/.test(item.id))
        .map((item) => item.label),
    ).toEqual([...STAGES]);
  });

  it("print `Stage {n} of 5` for every stage the rail can show", () => {
    for (let current = 1; current <= STAGES.length; current += 1) {
      const html = renderToStaticMarkup(
        createElement(StageRail, { copy: assessmentCreatePageCopy, current }),
      );
      expect(html, `stage ${current}`).toContain(`Stage ${current} of 5`);
    }
  });

  it("draw five cells, however many the stage count says", () => {
    const html = renderToStaticMarkup(
      createElement(StageRail, { copy: assessmentCreatePageCopy, current: 1 }),
    );
    expect(html.split("data-step-cell=").length - 1).toBe(5);
    for (const name of STAGES) expect(html).toContain(name);
  });
});

describe("there is no seventh stage", () => {
  it("names the retired word nowhere in the flow's copy or components", () => {
    const files = [...FLOW_COPY, ...tree(FLOW_COMPONENTS)];
    for (const file of files) {
      expect(source(file), `${file} names a stage the spec removed`).not.toMatch(RETIRED);
    }
  });

  it("leaves no `ongoing` route in the app tree", () => {
    for (const file of tree(FLOW_ROUTES)) {
      expect(file, `${file} is a route the spec removed`).not.toMatch(RETIRED);
      expect(source(file), `${file} links the retired stage`).not.toMatch(RETIRED);
    }
  });
});

/* ---------------------------------------------------------------- *
 * Align is not a cell
 * ---------------------------------------------------------------- */

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the flow-stages test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-flow-stages";

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

/** An unclaimed seat: the relationship exists, but nobody has agreed to answer anything. */
const unclaimedParties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery", accepted_at: null },
];

/** Both seats bound and answering — one shared assessment, in progress. */
const sharedParties: PartyRow[] = [
  { session_record_id: INSTANCE_ID, role: "initiator", name: "Avery", accepted_at: null },
  { session_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan", accepted_at: null },
];

function screenOver(parties: PartyRow[], answered: number): FlowScreen {
  const rows: FlowInstanceRows = {
    record: {
      id: INSTANCE_ID,
      slug: "relationship-basics-flow-stages",
      record_type: "assessment",
      status: "draft",
      date: new Date("2026-11-08T09:00:00.000Z"),
      title: template.title,
      summary: "answered by Avery",
    },
    items,
    options: [],
    instance: {
      record_id: INSTANCE_ID,
      template_record_id: template.id,
      relationship_id: "relationship-flow-stages",
      mode: "basic",
      setting: "soft",
    },
    parties,
    opinions: [],
    answerCounts: { initiator: answered, counterparty: 0 },
  };
  // The invitation row is what the screen's status band reads; the stage's condition is the
  // status derived from the party rows above, not from the invite.
  return projectScreen({ rows, template, viewerRole: "initiator", invite: INVITE });
}

const INVITE: FlowInvite = {
  email: "rowan@example.com",
  counterpartyName: "Rowan",
  expiresAt: "2026-11-22T09:00:00.000Z",
  state: "unclaimed",
  resentAt: null,
  resentCount: 0,
  link: null,
};

function sentHtml(screen: FlowScreen): string {
  return renderToStaticMarkup(
    createElement(SentState, {
      copy: assessmentSentPageCopy,
      screen,
      resendAction: "/assessment/instances/x/invite",
      openHref: instancePath(screen.instanceRecordId),
      signedIn: false,
    }),
  );
}

/** The rail's cells, cut out of a rendered page so a match cannot come from elsewhere. */
function railOf(html: string): string {
  const start = html.indexOf("<nav");
  return html.slice(start, html.indexOf("</nav>", start));
}

describe("Align is the dashboard's surface, not a rail cell", () => {
  it("is drawn at Invite on the confirmation, with no sixth cell and no conditional state", () => {
    for (const screen of [screenOver(unclaimedParties, 0), screenOver(sharedParties, 1)]) {
      const html = sentHtml(screen);
      const rail = railOf(html);
      // The count line sits under the band, outside `<nav>`; the cells are inside it.
      expect(html).toContain("Stage 5 of 5");
      expect(rail.split("data-step-cell=").length - 1).toBe(5);
      expect(html).not.toContain('data-step-cell="6"');
      expect(html).not.toContain(">Align<");
      // Nothing in the band is drawn "unavailable" any more — the state the sixth cell used.
      expect(html).not.toContain('data-step-state="unavailable"');
    }
  });

  it("is not a step the create flow advances into either", () => {
    for (let current = 1; current <= STAGES.length; current += 1) {
      const html = renderToStaticMarkup(
        createElement(StageRail, { copy: assessmentCreatePageCopy, current }),
      );
      expect(html, `stage ${current}`).not.toContain('data-step-cell="6"');
      expect(html, `stage ${current}`).not.toContain('data-step-state="unavailable"');
    }
  });

  it("still answers the status question the dashboard asks — is there anything to align?", () => {
    // The rule outlived the cell: a relationship has something to align once a second seat
    // exists and the sheets are being filled. `docs/specs/flow-stages.md` states it.
    expect(alignAvailableOf("awaiting_counterparty")).toBe(false);
    expect(alignAvailableOf("voided")).toBe(false);
    expect(alignAvailableOf("answering")).toBe(true);
    expect(alignAvailableOf("awaiting_payment")).toBe(true);
    expect(alignAvailableOf("complete")).toBe(true);
  });
});
