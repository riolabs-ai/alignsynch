/**
 * The read boundary, proved without a connection (#145).
 *
 * `lib/db/rows.ts` maps rows to the content model and `safeParse`s the result. These cases do
 * two jobs:
 *
 *   1. **the mirror is exact** — the rows a seed would write for a fixture map back to an
 *      object deep-equal to that fixture, so the database cannot quietly disagree with
 *      `data/assessments.ts`;
 *   2. **the schema still decides** — a think without a guess, a party that skipped an Aspect,
 *      a drifted copy and an option-scale item on an assessment are each rejected, which is
 *      what makes the zod parse the boundary rather than decoration.
 *
 * No `DATABASE_URL`, no `pg`, no clock: this file is also the answer to "does the gate need a
 * database" — it runs inside `pnpm test` with none set.
 */
import { describe, expect, test } from "vitest";
import {
  assessmentSessionFromRows,
  assessmentTemplateFromRows,
  authoredAspectProblems,
  copyDriftProblems,
  isoInstantOf,
  itemIdsOf,
  orderedItems,
  type AssessmentSessionRows,
  type AssessmentTemplateRows,
  type ItemRow,
} from "@/lib/db/rows";
import { assessmentSessions, assessments } from "@/data/assessments";
import {
  SESSION_NAME_MAX,
  sessionNameOf,
  type Assessment,
  type AssessmentSession,
} from "@/content/assessment";

/** The rows the seed writes for a session, written the way `db-seed.mjs` writes them. */
function sessionRows(session: AssessmentSession): AssessmentSessionRows {
  return {
    record: {
      id: session.id,
      slug: session.slug,
      record_type: session.type,
      status: session.status,
      date: session.date,
      title: session.title,
      summary: session.summary,
    },
    items: session.items.map((item, position) => ({
      record_id: session.id,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: item.scale.kind,
      left_value: item.leftValue,
      right_value: item.rightValue,
    })),
    options: [],
    session: {
      record_id: session.id,
      template_record_id: session.templateId,
      relationship_id: `relationship-${session.id}`,
      mode: session.mode,
      setting: session.setting,
      // The relationship's own name (`0011_console_columns.sql`); NULL is unnamed, and the read
      // falls back to the template title rather than inventing one.
      name: session.name ?? null,
    },
    parties: session.parties.map((party) => ({
      session_record_id: session.id,
      role: party.role,
      name: party.name,
    })),
    opinions: session.parties.flatMap((party) =>
      party.opinions.map((answer) => ({
        session_record_id: session.id,
        role: party.role,
        item_id: answer.itemId,
        feel: answer.opinions.feel,
        wish: answer.opinions.wish,
        think: answer.opinions.think ?? null,
        guess: answer.opinions.guess ?? null,
      })),
    ),
  };
}

/** The rows the seed writes for a template. */
function templateRows(template: Assessment): AssessmentTemplateRows {
  return {
    record: {
      id: template.id,
      slug: template.slug,
      record_type: template.type,
      status: template.status,
      date: template.date,
      title: template.title,
      summary: template.summary,
    },
    items: template.items.map((item, position) => ({
      record_id: template.id,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: item.scale.kind,
      left_value: item.leftValue,
      right_value: item.rightValue,
    })),
    options: [],
  };
}

/** Replace the row at `index` — the row interfaces are `readonly`, so rows are rebuilt, not edited. */
function replacing<T>(rows: readonly T[], index: number, patch: Partial<T>): T[] {
  return rows.map((row, position) => (position === index ? { ...row, ...patch } : row));
}

describe("rows → model", () => {
  test.each(assessmentSessions.map((session) => [session.slug, session] as const))(
    "the rows for %s map back to the fixture",
    (_slug, session) => {
      // `lifecycle` is the one field the rows cannot carry: it is the **seeded relationship's**
      // state (`relationship.status`, its instants and its reasons — `content/assessment.ts::
      // zSeededLifecycle`), and the database keeps it on the relationship, not on the record this
      // mapper reads. Everything the record holds round-trips exactly.
      const { lifecycle: _seeded, ...content } = session;
      expect(assessmentSessionFromRows(sessionRows(session))).toEqual(content);
    },
  );

  test.each(assessments.map((template) => [template.slug, template] as const))(
    "the rows for template %s map back to the fixture",
    (_slug, template) => {
      expect(assessmentTemplateFromRows(templateRows(template))).toEqual(template);
    },
  );

  test("the parties come back initiator-first whatever order the rows arrive in", () => {
    const session = assessmentSessions[0];
    const rows = sessionRows(session);
    const reversed = { ...rows, parties: [...rows.parties].reverse() };

    expect(assessmentSessionFromRows(reversed).parties).toEqual(session.parties);
  });

  test("items are ordered by position, not by the query's row order", () => {
    const session = assessmentSessions[0];
    const rows = sessionRows(session);
    const shuffled = { ...rows, items: [...rows.items].reverse() };

    expect(assessmentSessionFromRows(shuffled).items).toEqual(session.items);
  });

  test("a TIMESTAMPTZ string with an offset becomes the model's UTC instant", () => {
    expect(isoInstantOf("2026-10-24T09:00:00+00:00")).toBe("2026-10-24T09:00:00.000Z");
    expect(isoInstantOf(new Date("2026-10-24T09:00:00.000Z"))).toBe("2026-10-24T09:00:00.000Z");
  });
});

describe("the schema still decides", () => {
  test("think without guess is rejected, and the error says so", () => {
    const rows = sessionRows(assessmentSessions[0]);
    const halfPair = { ...rows, opinions: replacing(rows.opinions, 0, { think: 4, guess: null }) };

    expect(() => assessmentSessionFromRows(halfPair)).toThrow(/Think and Guess come together/);
  });

  test("a party that skipped an Aspect is rejected, naming the party and the field", () => {
    const rows = sessionRows(assessmentSessions[0]);
    // Row 5 is the counterparty's first answer: drop it and that party answers four Aspects.
    const unanswered = {
      ...rows,
      opinions: rows.opinions.filter((_row, index) => index !== 5),
    };

    expect(() => assessmentSessionFromRows(unanswered)).toThrow(
      /parties\.1\.opinions\.0\.opinions\.feel/,
    );
  });

  test("a score item with no Left/Right Value is rejected", () => {
    const rows = sessionRows(assessmentSessions[0]);
    const noLeftValue = { ...rows, items: replacing(rows.items, 0, { left_value: null }) };

    expect(() => assessmentSessionFromRows(noLeftValue)).toThrow(/leftValue/);
  });

  test("an option-scale item is not an Aspect", () => {
    const template = templateRows(assessments[0]);
    const withOptionItem = {
      ...template,
      items: replacing(template.items, 0, {
        scale_kind: "options",
        left_value: null,
        right_value: null,
      }),
    };

    expect(() => assessmentTemplateFromRows(withOptionItem)).toThrow(
      /record "relationship-basics"/,
    );
  });

  test("a record whose type is not `assessment` is rejected", () => {
    const template = templateRows(assessments[0]);
    const wrongType = {
      ...template,
      record: { ...template.record, record_type: "lesson" },
    };

    expect(() => assessmentTemplateFromRows(wrongType)).toThrow(/type/);
  });

  /** #213 — the mode is a column, and the parse is what makes a bad value drift. */
  test("a session row's mode round-trips through the schema", () => {
    for (const session of assessmentSessions) {
      const rows = sessionRows(session);
      expect(assessmentSessionFromRows(rows).mode).toBe(session.mode);
    }
    // Both values are exercised by the fixture itself: three Basic rows, one Advanced.
    expect(assessmentSessions.map((session) => session.mode)).toContain("advanced");
    expect(assessmentSessions.map((session) => session.mode)).toContain("basic");
  });

  test("a mode the model does not define is rejected, and the session is named", () => {
    const rows = sessionRows(assessmentSessions[0]);
    const drifted = { ...rows, session: { ...rows.session, mode: "nonsense" } };

    expect(() => assessmentSessionFromRows(drifted)).toThrow(/session "avery-rowan"/);
    expect(() => assessmentSessionFromRows(drifted)).toThrow(/mode/);
  });
});

/**
 * The three columns of `0011_console_columns.sql` (#289 follow-up), at the read boundary.
 *
 * The claim under test is the one the migration makes: every one of them is an **absence** on a
 * row that predates it, and the absence is what a surface falls back from — no generated author,
 * no copied title, no invented instant. Each case therefore parses rows that carry the column as
 * `NULL` and asserts the parsed object has no key at all, which is what `safeParse` would have
 * stripped had the schema not known the field.
 */
describe("the console's three columns (#289 follow-up)", () => {
  test("an existing session parses with `name` NULL, and the fallback is the template title", () => {
    // Most of the dataset predates the column; #1079's population names seven of its rows, and both
    // halves are asserted here — an unnamed row falls back to the template's title, a named one keeps
    // its own words.
    for (const session of assessmentSessions) {
      const template = assessments.find((candidate) => candidate.id === session.templateId);
      expect(template).toBeDefined();
      // Narrowed here rather than asserted: a template that does not resolve is a fixture defect
      // the line above already fails on.
      if (template === undefined) continue;

      const rows = sessionRows(session);
      expect(rows.session.name).toBe(session.name ?? null);

      const parsed = assessmentSessionFromRows(rows);
      if (session.name === undefined) {
        expect("name" in parsed).toBe(false);
        expect(sessionNameOf(parsed, template.title)).toBe(template.title);
        // An explicit `NULL` is the same fact as an absent column, and reads the same way.
        expect(
          sessionNameOf(
            assessmentSessionFromRows({ ...rows, session: { ...rows.session, name: null } }),
            template.title,
          ),
        ).toBe(template.title);
      } else {
        expect(sessionNameOf(parsed, template.title)).toBe(session.name);
      }
    }

    // The fallback reads the *argument*, not the copy's own title: a caller that resolves a
    // different title gets that one back, which is what makes "the template's title" a fact about
    // the template rather than a coincidence of the copy.
    const session = assessmentSessions[0];
    expect(
      sessionNameOf(assessmentSessionFromRows(sessionRows(session)), "Parent & Child (2026)"),
    ).toBe("Parent & Child (2026)");
  });

  test("a named session round-trips its own name, and the fallback does not override it", () => {
    const session = assessmentSessions[0];
    const rows = sessionRows(session);
    const named = { ...rows, session: { ...rows.session, name: "Avery & Rowan, October" } };
    const parsed = assessmentSessionFromRows(named);

    expect(parsed.name).toBe("Avery & Rowan, October");
    expect(sessionNameOf(parsed, "Parent & Child")).toBe("Avery & Rowan, October");
  });

  test("a blank or over-long name is rejected, and the session is named", () => {
    const rows = sessionRows(assessmentSessions[0]);
    const blank = { ...rows, session: { ...rows.session, name: "   " } };
    const overLong = {
      ...rows,
      session: { ...rows.session, name: "n".repeat(SESSION_NAME_MAX + 1) },
    };

    // `NULL` is unnamed; a padded string is a band nobody chose, and the model refuses it.
    expect(() => assessmentSessionFromRows(blank)).toThrow(/session "avery-rowan"/);
    expect(() => assessmentSessionFromRows(overLong)).toThrow(/name/);
  });

  test("a record with no author reads as the platform's, and an authored one keeps its id", () => {
    const template = assessments[0];
    const rows = templateRows(template);

    const anonymous = assessmentTemplateFromRows(rows);
    expect("authorUserId" in anonymous).toBe(false);
    expect(
      "authorUserId" in
        assessmentTemplateFromRows({ ...rows, record: { ...rows.record, author_user_id: null } }),
    ).toBe(false);

    const authored = assessmentTemplateFromRows({
      ...rows,
      record: { ...rows.record, author_user_id: "auth-user-8f21" },
    });
    expect(authored.authorUserId).toBe("auth-user-8f21");
    // The session's own record row carries it too: a session is a record, and the author of
    // the copy is the person who created it.
    const session = assessmentSessions[0];
    const sessionWithAuthor = {
      ...sessionRows(session),
      record: { ...sessionRows(session).record, author_user_id: "auth-user-8f21" },
    };
    expect(assessmentSessionFromRows(sessionWithAuthor).authorUserId).toBe("auth-user-8f21");
  });

  test("a party's submitted_at is the model's instant, and NULL is 'not recorded'", () => {
    const session = assessmentSessions[0];
    const rows = sessionRows(session);
    // The parties arrive as `to_jsonb(p)` from the query, so the column is a string there.
    const submitted = {
      ...rows,
      parties: replacing(rows.parties, 0, { submitted_at: "2026-10-24T09:00:00+00:00" }),
    };
    const parsed = assessmentSessionFromRows(submitted);

    expect(parsed.parties[0]).toMatchObject({
      role: session.parties[0].role,
      submittedAt: "2026-10-24T09:00:00.000Z",
    });
    // The other seat was never given an instant, and "no instant" is not "no answer".
    expect("submittedAt" in parsed.parties[1]).toBe(false);
    expect(parsed.parties[1].opinions.length).toBe(session.parties[1].opinions.length);
  });
});

describe("copy drift (the DB port of E31)", () => {
  const template = assessments[0];
  const session = assessmentSessions[0];

  test("a copy that matches its template is not a problem", () => {
    expect(
      copyDriftProblems({
        sessionId: session.id,
        templateId: template.id,
        copyIds: itemIdsOf(templateRows(session).items),
        templateIds: itemIdsOf(templateRows(template).items),
      }),
    ).toEqual([]);
  });

  test("a renamed Aspect is named with both lists", () => {
    const drifted = templateRows(session);
    const renamed = {
      ...drifted,
      items: replacing(drifted.items, 0, { item_id: "aspect-drifted" }),
    };

    const problems = copyDriftProblems({
      sessionId: session.id,
      templateId: template.id,
      copyIds: itemIdsOf(renamed.items),
      templateIds: itemIdsOf(templateRows(template).items),
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(session.id);
    expect(problems[0]).toContain("aspect-drifted");
    expect(problems[0]).toContain(template.id);
  });

  test("the same Aspects in a different order is drift too", () => {
    const items = templateRows(session).items;
    // Order is `position`, so a reordering is a changed position — not a reversed array.
    const reordered = items.map((item, index) => ({ ...item, position: items.length - 1 - index }));

    expect(
      copyDriftProblems({
        sessionId: session.id,
        templateId: template.id,
        copyIds: itemIdsOf(reordered),
        templateIds: itemIdsOf(templateRows(template).items),
      }),
    ).toHaveLength(1);
  });
});

test("orderedItems is a sort, not a mutation", () => {
  const rows = [{ position: 2 }, { position: 0 }, { position: 1 }];
  expect(orderedItems(rows).map((row) => row.position)).toEqual([0, 1, 2]);
  expect(rows.map((row) => row.position)).toEqual([2, 0, 1]);
});

/**
 * **V4's other question** (#699).
 *
 * A copy that added, removed or reordered an Aspect is not drift: it is the list the creator wrote
 * at stage 3, and the create stamps `session.aspects_authored_at` so the verifier can tell the two
 * apart. These cases are the split, side by side — the same rows asked both questions:
 *
 *   - the **equality** rule (`copyDriftProblems`) still fails them, which is the copied case and
 *     must keep failing;
 *   - the **structure** rule (`authoredAspectProblems`) passes the ones that are real lists and
 *     names the ones that are not.
 */
describe("an authored copy — the structure V4 asks instead of equality (#699)", () => {
  const session = assessmentSessions[0];

  /** The rows the create wrote: the session's own list, positions dense from 0. */
  function copyItems(): ItemRow[] {
    return session.items.map((item, position) => ({
      record_id: session.id,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: item.scale.kind,
      left_value: item.leftValue,
      right_value: item.rightValue,
    }));
  }

  function withAdded(items: readonly ItemRow[], over: Partial<ItemRow> = {}): ItemRow[] {
    return [
      ...items,
      {
        record_id: session.id,
        item_id: "aspect-added-at-create",
        position: items.length,
        prompt: "How often do you say thank you?",
        scale_kind: "score",
        left_value: "Never",
        right_value: "Daily",
        ...over,
      },
    ];
  }

  test("an added Aspect is a list, and still not a copy", () => {
    const items = withAdded(copyItems());

    // The equality rule says what it always said — this copy is not its version's.
    expect(
      copyDriftProblems({
        sessionId: session.id,
        templateId: session.templateId,
        copyIds: itemIdsOf(items),
        templateIds: itemIdsOf(copyItems()),
      }),
    ).toHaveLength(1);

    // The structure rule is the question an authored copy answers, and it passes.
    expect(authoredAspectProblems({ sessionId: session.id, items })).toEqual([]);
  });

  test("a reordered list is a list", () => {
    const items = copyItems();
    const reversed = items.map((item, index) => ({ ...item, position: items.length - 1 - index }));
    expect(authoredAspectProblems({ sessionId: session.id, items: reversed })).toEqual([]);
  });

  test("an emptied list is named — a relationship asks at least one", () => {
    const problems = authoredAspectProblems({ sessionId: session.id, items: [] });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(session.id);
    expect(problems[0]).toContain("none");
  });

  test("a repeated id is named", () => {
    const items = copyItems();
    const repeated = replacing(items, 1, { item_id: items[0]?.item_id ?? "" });
    const problems = authoredAspectProblems({ sessionId: session.id, items: repeated });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("twice");
  });

  test("a hole in the positions is named — the order both seats answer in", () => {
    const items = copyItems();
    const holed = replacing(items, 1, { position: 9 });
    const problems = authoredAspectProblems({ sessionId: session.id, items: holed });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("positions");
  });

  test("a blank question is not an Aspect, and a blank one with a space passes the schema", () => {
    const items = copyItems();
    const blank = replacing(items, 0, { prompt: "" });
    const [problem] = authoredAspectProblems({ sessionId: session.id, items: blank });
    expect(problem).toContain(items[0]?.item_id ?? "");
    expect(problem).toContain("not an Aspect");

    // `zAspect` says `.min(1)`, so a single space is a schema pass and still not a question.
    const spaced = replacing(items, 0, { prompt: "   " });
    const [spacedProblem] = authoredAspectProblems({ sessionId: session.id, items: spaced });
    expect(spacedProblem).toContain("blank question");
  });

  test("an option-scale row is not an Aspect of a relationship", () => {
    const items = withAdded(copyItems(), { scale_kind: "options" });
    const problems = authoredAspectProblems({ sessionId: session.id, items });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("not an Aspect");
  });
});
