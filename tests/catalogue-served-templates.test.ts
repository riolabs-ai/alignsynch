/**
 * The catalogue and the create route are **one set** (#1099).
 *
 * ## The defect, as a test
 *
 * `/relationship-templates` drew a card per purchasable relationship type — twenty-seven "use this
 * template" links — while `/templates/relationship/<slug>/create` resolved the template from the
 * **database** (`readLibraryTemplate`). Two sources, no check between them. Production's branch had
 * only ever received the four fixture-era template rows, so on 2026-11-15 it advertised 27 create
 * links and answered **404 for 25 of them** (`colleagues`, `team`, `spouses`, …). The demo branch
 * had them all, which is why nothing local could see it.
 *
 * The fix is not a looser read (`readLibraryTemplate`'s authorization is unchanged, and this file
 * proves it still refuses a draft, an instance and somebody else's template). It is:
 *
 *   * the shelf is `lib/platform-templates.ts` — the published templates `data/assessments.ts`
 *     authors, which is what `scripts/db-templates-import.mjs` writes — so the page cannot draw a
 *     card for a template that set does not hold;
 *   * this file holds the two ends equal, so a purchasable type with no template, or a template
 *     nobody imported, is a red build rather than a dead link a stranger finds.
 *
 * ## What the store is, and what it is not
 *
 * The database below is built from `platformTemplates` — the seed's own source — and answers the
 * two statements `readLibraryTemplate` issues, applying the same four clauses its SQL does. So the
 * resolution cases prove the **mapper and the rule** (a platform published template with no session
 * still reads; a draft, an instance and a foreign author do not), and they prove the advertised set
 * is inside what a branch seeded from the fixtures can serve. They cannot prove a particular
 * deployed branch holds those rows: that is the acceptance run against the host, and the census the
 * import prints.
 */
import { describe, expect, it, vi } from "vitest";

import { templatesPageCopy } from "@/data/pages/templates";
import { REALMS, purchasableRelationshipTypes } from "@/data/relationship-types";
import { readLibraryTemplate } from "@/lib/db/template-library";
import {
  isPlatformTemplate,
  platformTemplateSlugs,
  platformTemplates,
} from "@/lib/platform-templates";
import { visitorOf } from "@/lib/start-path";
import { templateCard } from "@/lib/template-catalogue";
import { templatesPage } from "@/lib/templates-page";

/** One template row on the fake branch, plus the one fact that decides whether it is a template. */
interface BranchRecord {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly date: string;
  readonly authorUserId: string | null;
  readonly hasSession: boolean;
  /**
   * The published `template_version` payload, or `null` for a template with no version — which the
   * create route treats as "cannot be copied" (#870), so the import has to write one.
   */
  readonly payload: object | null;
  readonly items: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly leftValue: string;
    readonly rightValue: string;
  }[];
}

/** The fixture templates as rows a seeded branch holds, in the shape the read's SQL sees. */
function seededBranch(
  overrides: Readonly<Record<string, Partial<BranchRecord>>> = {},
): BranchRecord[] {
  return platformTemplates.map((template) => ({
    id: template.id,
    slug: template.slug,
    title: template.title,
    summary: template.summary,
    status: template.status,
    date: template.date,
    authorUserId: null,
    hasSession: false,
    payload: { ...template },
    items: template.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
    })),
    ...overrides[template.slug],
  }));
}

/**
 * A branch, and `queryRows` answering the two statements `readLibraryTemplate` issues.
 *
 * `vi.hoisted` because `vi.mock` runs before the module graph loads. The whole client module is
 * replaced: `readLibraryTemplate` is the only consumer under test, and a real pool would need a
 * `DATABASE_URL` the gate does not have.
 */
const branch = vi.hoisted(() => ({ records: [] as unknown[] }));

vi.mock("@/lib/db/client", () => ({
  queryRows: async (text: string, values: readonly unknown[] = []): Promise<unknown[]> => {
    const records = branch.records as BranchRecord[];
    const viewer = (values[1] ?? null) as string | null;

    // The row read. Its column list contains a `FROM item` sub-select, so it is matched first.
    if (text.includes("FROM record r")) {
      const handle = values[0] as string;
      return records
        .filter((record) => record.slug === handle || record.id === handle)
        .filter(
          (record) =>
            record.status !== "draft" ||
            (record.authorUserId !== null && record.authorUserId === viewer),
        )
        .filter((record) => !record.hasSession)
        .filter((record) => record.authorUserId === null || record.authorUserId === viewer)
        .map((record) => ({
          id: record.id,
          slug: record.slug,
          title: record.title,
          summary: record.summary,
          status: record.status,
          date: record.date,
          author_user_id: record.authorUserId,
          aspects: record.items.length,
          instances: 0,
          live_payload: record.payload,
        }));
    }

    // The Aspect read, for a template with no published version.
    if (text.includes("FROM item")) {
      const record = records.find((candidate) => candidate.id === values[0]);
      if (record === undefined) return [];
      return record.items.map((item, position) => ({
        item_id: item.id,
        position,
        prompt: item.prompt,
        left_value: item.leftValue,
        right_value: item.rightValue,
      }));
    }

    throw new Error(
      `the test's branch was asked a statement it does not answer: ${text.slice(0, 80)}`,
    );
  },
}));

/** A signed-out visitor, the audience the catalogue was built for (#690, #317). */
const VISITOR = visitorOf("alignsynch");

/** Every `/templates/relationship/<slug>/create` the page renders, read off the model. */
function advertised(model: ReturnType<typeof templatesPage>): string[] {
  return model.catalogue.realms
    .flatMap((group) => group.cards)
    .map((card) => card.start)
    .map((href) => href.split("/")[3] ?? "");
}

describe("the shelf is what the platform serves", () => {
  const model = templatesPage(templatesPageCopy, VISITOR);
  const slugs = advertised(model);

  it("advertises exactly the purchasable types, so a new type without a template is a red build", () => {
    // Both directions in one assertion: a missing card and an unserved card both fail here.
    expect(slugs).toEqual(purchasableRelationshipTypes.map((type) => type.id));
    expect(model.catalogue.total).toBe(purchasableRelationshipTypes.length);
  });

  it("advertises only slugs the platform's template set holds", () => {
    expect(slugs.filter((slug) => !isPlatformTemplate(slug))).toEqual([]);
    for (const slug of slugs) expect(platformTemplateSlugs).toContain(slug);
  });

  it("counts the flow's blank start as a served template too", () => {
    // `/templates/relationship/blank-template/create` is the closing band's action (#1042) and the
    // address `tests/blank-start.test.ts` pins; it is a create link like any card's.
    expect(isPlatformTemplate("blank-template")).toBe(true);
  });

  it("drops the card whose template the platform does not serve", () => {
    const shorter = templatesPage(
      templatesPageCopy,
      VISITOR,
      purchasableRelationshipTypes,
      REALMS,
      platformTemplates.filter((template) => template.slug !== "team"),
    );
    expect(advertised(shorter)).not.toContain("team");
    expect(advertised(shorter)).toHaveLength(slugs.length - 1);
    expect(shorter.catalogue.total).toBe(model.catalogue.total - 1);
    expect(shorter.catalogue.count).not.toBe(model.catalogue.count);
  });

  it("refuses a card for a type outside the served set, in the one projection every surface uses", () => {
    const team = purchasableRelationshipTypes.find((type) => type.id === "team");
    expect(team).toBeDefined();
    if (team === undefined) return;
    // The catalogue filters before projecting, so this is the shared guard every other surface
    // (the front page's shelf, a type's own page) would hit first.
    expect(() => templateCard(templatesPageCopy, { ...team, id: "team-not-a-template" })).toThrow(
      /not a template the platform serves/,
    );
  });
});

describe("every advertised href resolves for a signed-out visitor", () => {
  it("reads back a template with Aspects and a version for every card the page draws", async () => {
    branch.records = seededBranch();
    const slugs = advertised(templatesPage(templatesPageCopy, VISITOR));

    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      const detail = await readLibraryTemplate(slug, null);
      expect(detail, `${slug} is advertised and did not resolve`).toBeDefined();
      expect(detail?.template.slug).toBe(slug);
      expect(detail?.template.authorship).toBe("built-in");
      expect(detail?.aspects.length).toBeGreaterThan(0);
      // Stage 1 draws the form only for a template that can be copied; no version is a blocked
      // form (`#870`, `#962`), which is not the screen the card promised.
      expect(detail?.hasVersion, `${slug} has no template_version`).toBe(true);
    }
  });

  it("reads the blank start back as well — the closing band links it", async () => {
    branch.records = seededBranch();
    const detail = await readLibraryTemplate("blank-template", null);
    expect(detail?.template.slug).toBe("blank-template");
    expect(detail?.aspects.length).toBeGreaterThan(0);
  });
});

describe("the read's own rules still refuse — nothing was widened to pass", () => {
  it("answers nothing for a template the branch never received", async () => {
    branch.records = seededBranch();
    expect(await readLibraryTemplate("a-template-nobody-imported", null)).toBeUndefined();
  });

  it("answers nothing for a template the import has not run for yet", async () => {
    // The exact production state this card fixes: `colleagues` is advertised by the taxonomy and
    // the branch holds no row for it, so the route is a 404 until the import runs.
    branch.records = seededBranch().filter((record) => record.slug !== "colleagues");
    expect(await readLibraryTemplate("colleagues", null)).toBeUndefined();
  });

  it("answers nothing for a draft, for an instance, and for somebody else's template", async () => {
    branch.records = seededBranch({
      team: { status: "draft" },
      spouses: { hasSession: true },
      friends: { authorUserId: "user-other" },
    });
    expect(await readLibraryTemplate("team", null)).toBeUndefined();
    expect(await readLibraryTemplate("spouses", null)).toBeUndefined();
    expect(await readLibraryTemplate("friends", null)).toBeUndefined();
    // …while a platform template beside them still answers, so the three refusals are the rule and
    // not a broken store.
    expect(await readLibraryTemplate("colleagues", null)).toBeDefined();
  });
});
