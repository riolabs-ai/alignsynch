/**
 * data:check tests — written BEFORE the schema exists.
 *
 * Each case is a drift measured in the current fixtures (content-model.md §4, D1–D18).
 * A case that passes without the schema is not testing the schema, so `data:check`
 * runs these first (see scripts/data-check.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { zArticleCollection, zNewsArticle } from "../../content/article";
import { zCategory, zCategories } from "../../content/category";
import { zQuiz, zQuizCard, selectQuizCard } from "../../content/quiz";
import { zContact, zConversation, zNotification, zMessage } from "../../content/social";
import { findDeadLinks, findMissingAssets } from "../ui-refs";

const iso = "2025-05-15T00:00:00.000Z";

/* ---------------------------------------------------------------- *
 * D4 — the answer key was an index, not an id
 * ---------------------------------------------------------------- */
describe("zQuestion", () => {
  const base = {
    id: "quiz-1-q1",
    prompt: "Which ancient wonder was in Alexandria?",
    options: [
      { id: "a", text: "Colossus of Rhodes" },
      { id: "b", text: "Lighthouse of Alexandria" },
    ],
  };

  it("rejects the legacy `correctAnswer` index (D4)", () => {
    const result = zQuiz.safeParse(makeQuiz({ questions: [{ ...base, correctAnswer: 1 }] }));
    assert.equal(result.success, false);
  });

  it("rejects a correctOptionId that names no option", () => {
    const result = zQuiz.safeParse(makeQuiz({ questions: [{ ...base, correctOptionId: "c" }] }));
    assert.equal(result.success, false);
    assert.match(JSON.stringify(result.error?.issues), /correctOptionId/);
  });

  it("rejects duplicate option ids", () => {
    const result = zQuiz.safeParse(
      makeQuiz({
        questions: [
          {
            ...base,
            options: [
              { id: "a", text: "one" },
              { id: "a", text: "two" },
            ],
            correctOptionId: "a",
          },
        ],
      }),
    );
    assert.equal(result.success, false);
  });

  it("accepts an id-keyed answer and keeps the same option text", () => {
    const result = zQuiz.safeParse(makeQuiz({ questions: [{ ...base, correctOptionId: "b" }] }));
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
    assert.equal(result.data?.questions[0].options[1].text, "Lighthouse of Alexandria");
  });
});

/* ---------------------------------------------------------------- *
 * D5 / D1 — difficulty casing, seconds, no hand-rolled duplicate types
 * ---------------------------------------------------------------- */
describe("zQuiz", () => {
  it('rejects the Capitalized difficulty "Medium" (D5)', () => {
    assert.equal(zQuiz.safeParse(makeQuiz({ difficulty: "Medium" })).success, false);
  });

  it("rejects a numeric id (D3)", () => {
    assert.equal(zQuiz.safeParse(makeQuiz({ id: 1 as unknown as string })).success, false);
  });

  it("rejects `description` and `timeLimit` (the legacy quiz field names)", () => {
    const legacy = {
      ...makeQuiz(),
      description: "Test your knowledge",
      timeLimit: 1200,
    };
    assert.equal(zQuiz.safeParse(legacy).success, false);
  });

  it("rejects a settings object that still says `timeLimit` (minutes)", () => {
    const quiz = { ...makeQuiz(), settings: { ...makeQuiz().settings, timeLimit: 20 } };
    assert.equal(zQuiz.safeParse(quiz).success, false);
  });

  it("rejects a quiz whose seats are over-subscribed", () => {
    const quiz = makeQuiz({ stats: { plays: 5000, capacity: 1000 } });
    assert.equal(zQuiz.safeParse(quiz).success, false);
  });

  it("rejects a category id that is only a display name", () => {
    assert.equal(zQuiz.safeParse(makeQuiz({ categoryIds: ["History"] })).success, false);
  });

  it("rejects a JSX-ish cover (D10)", () => {
    assert.equal(zQuiz.safeParse(makeQuiz({ cover: { src: 1 } as never })).success, false);
  });

  it("accepts a minimal content quiz and defaults stats/settings", () => {
    const parsed = zQuiz.safeParse(makeQuiz());
    assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
    assert.deepEqual(parsed.data?.stats, {
      plays: 0,
      isTournament: false,
      recentPlayers: [],
    });
  });
});

/* ---------------------------------------------------------------- *
 * D2 — a card is a projection, not an authored record
 * ---------------------------------------------------------------- */
describe("selectQuizCard", () => {
  it("derives spotsLeft / almostFull / limitedTime from stats", () => {
    const quiz = zQuiz.parse(
      makeQuiz({
        stats: {
          plays: 47,
          capacity: 50,
          limitedTimeEndsAt: "2025-05-16T00:00:00.000Z",
        },
      }),
    );
    const card = selectQuizCard(quiz, undefined, new Date("2025-05-15T12:00:00.000Z"));
    assert.equal(card.stats.spotsLeft, 3);
    assert.equal(card.stats.almostFull, true);
    assert.equal(card.stats.limitedTime, true);
    assert.equal(zQuizCard.safeParse(card).success, true);
  });

  it('does not accept an authored `reward: "$10.00"` on a card', () => {
    const quiz = zQuiz.parse(makeQuiz({ stats: { plays: 1, rewardCents: 1000 } }));
    const card = selectQuizCard(quiz);
    assert.equal(
      zQuizCard.safeParse({ ...card, stats: { ...card.stats, reward: "$10.00" } }).success,
      false,
    );
  });
});

/* ---------------------------------------------------------------- *
 * D15 / D6 — one category table, ids are kind-prefixed
 * ---------------------------------------------------------------- */
describe("zCategory", () => {
  const row = { id: "history", scope: "quiz", slug: "history", name: "History", featured: false };

  it("rejects a numeric id (the current data/categories.tsx)", () => {
    assert.equal(zCategory.safeParse({ ...row, id: 14 }).success, false);
  });

  it("rejects a display name in `id`", () => {
    assert.equal(
      zCategory.safeParse({ ...row, id: "Video Game", slug: "video-game" }).success,
      false,
    );
  });

  it("rejects an editorial row whose id is not scope-prefixed", () => {
    assert.equal(
      zCategory.safeParse({ id: "technical", scope: "kb", slug: "technical", name: "Technical" })
        .success,
      false,
    );
  });

  it("rejects a stored `count` (derived, never authored)", () => {
    assert.equal(zCategory.safeParse({ ...row, count: 2 }).success, false);
  });

  it("rejects duplicate ids across scopes", () => {
    const tip = { id: "tip-technical", scope: "tip", slug: "technical", name: "Technical Tips" };
    const kb = { id: "kb-technical", scope: "kb", slug: "technical", name: "Technical" };
    assert.equal(zCategories.safeParse([row, tip, tip]).success, false);
    assert.equal(zCategories.safeParse([row, tip, kb]).success, true);
  });
});

/* ---------------------------------------------------------------- *
 * D8 — three body shapes collapse to ContentBlock[]
 * ---------------------------------------------------------------- */
describe("zNewsArticle", () => {
  const article = {
    id: "news-hello",
    kind: "news",
    slug: "hello",
    title: "Hello",
    summary: "A summary",
    categoryIds: ["news-quiz-tips"],
    publishedAt: iso,
    readMinutes: 4,
    author: { name: "Sarah Johnson", avatar: { src: "/avatars/sarah.webp", alt: "" } },
    cover: { src: "/news/news1.png", alt: "" },
    body: [
      { type: "heading", text: "Intro", level: 2 },
      { type: "paragraph", text: "Body" },
    ],
  };

  it("rejects the legacy `content: section[]` body", () => {
    const { body, ...rest } = article;
    assert.equal(zNewsArticle.safeParse({ ...rest, content: body }).success, false);
  });

  it("rejects a bare-string category (D16)", () => {
    assert.equal(zNewsArticle.safeParse({ ...article, categoryIds: ["Quiz Tips"] }).success, false);
  });

  it("rejects an in-body image with no alt", () => {
    const body = [{ type: "image", image: { src: "/x.png", alt: "" } }];
    assert.equal(zNewsArticle.safeParse({ ...article, body }).success, false);
  });

  it("rejects a duplicate article id across kinds", () => {
    const result = zArticleCollection.safeParse({
      news: [article],
      tips: [{ ...article, kind: "tip" }],
      kb: [],
    });
    assert.equal(result.success, false);
  });
});

/* ---------------------------------------------------------------- *
 * D10 / D12 / D9 — social: no JSX, no stored preview, no prose time
 * ---------------------------------------------------------------- */
describe("social", () => {
  it("rejects a JSX icon key shape that is not a string (D10)", () => {
    assert.equal(
      zNotification.safeParse({
        id: "notif-1",
        type: "achievement",
        title: "Trophy",
        body: "You earned a badge",
        iconKey: 42,
        createdAt: iso,
        link: "/profile/achievements",
      }).success,
      false,
    );
  });

  it('rejects a prose timestamp ("10m ago", D9)', () => {
    assert.equal(
      zNotification.safeParse({
        id: "notif-1",
        type: "achievement",
        title: "Trophy",
        body: "You earned a badge",
        iconKey: "trophy",
        createdAt: "10m ago",
        link: "/profile/achievements",
      }).success,
      false,
    );
  });

  it("rejects a contact with lastSeen prose instead of lastSeenAt", () => {
    assert.equal(
      zContact.safeParse({
        id: "contact-2",
        name: "Sarah",
        status: "offline",
        lastSeen: "2 hours ago",
      }).success,
      false,
    );
  });

  it("rejects a message that is both text and image (XOR)", () => {
    assert.equal(
      zMessage.safeParse({
        id: "msg-1",
        senderId: "contact-1",
        body: "hi",
        image: { src: "/x.png", alt: "" },
        sentAt: iso,
        status: "sent",
      }).success,
      false,
    );
  });

  it("rejects a stored conversation preview with a wrong avatar (D12)", () => {
    const conversation = {
      id: "conv-1",
      contactId: "contact-1",
      messages: [{ id: "msg-1-1", senderId: "contact-1", body: "hi", sentAt: iso, status: "read" }],
      unread: 2,
      lastMessage: { text: "hi", timestamp: iso },
    };
    assert.equal(zConversation.safeParse(conversation).success, false);
  });
});

/* ---------------------------------------------------------------- *
 * E10 — hardcoded references resolve (issue #20)
 * ---------------------------------------------------------------- */
describe("ui-refs", () => {
  const ROUTES = new Set(["/", "/dashboard/user", "/register"]);

  /** `/quiz/[id]` is the only dynamic pattern the real manifest needs here. */
  const resolves = (route: string) => ROUTES.has(route) || /^\/quiz\/[^/]+$/.test(route);

  /** Mirrors `public/`: one real avatar and the placeholder, query string stripped first. */
  const exists = (asset: string) => asset === "/avatars/alex.png" || asset === "/placeholder.svg";

  const dead = (source: string) => findDeadLinks([{ path: "components/x.tsx", source }], resolves);
  const missing = (source: string) =>
    findMissingAssets([{ path: "components/x.tsx", source }], exists);

  it("flags a hardcoded href no route resolves, with file and line", () => {
    const found = dead('<Link href="/dashboard" className="x" />');
    assert.equal(found.length, 1);
    assert.equal(found[0].file, "components/x.tsx");
    assert.equal(found[0].line, 1);
    assert.equal(found[0].value, "/dashboard");
  });

  it("accepts the route the sidebar now points at, query string and all", () => {
    assert.deepEqual(dead('<Link href="/dashboard/user?tab=wallet">Wallet</Link>'), []);
    assert.deepEqual(dead('<Link href={"/register"}>Join</Link>'), []);
    assert.deepEqual(dead('<Link href="/quiz/world-history">Play</Link>'), []);
  });

  it("ignores external, scheme and fragment hrefs", () => {
    // The template href is assembled, not written out: a literal `${` in a plain
    // string trips biome's noTemplateCurlyInString guard.
    const dollar = String.fromCharCode(36);
    const source = [
      '<a href="https://example.com/x">x</a>',
      '<a href="#top">top</a>',
      '<a href="mailto:support@quizhub.com">mail</a>',
      `<Link href={\`/quiz/${dollar}{id}\`}>template</Link>`,
    ].join("\n");
    assert.deepEqual(dead(source), []);
  });

  it("catches navigation written as a router call", () => {
    const found = dead('<Button onClick={() => router.push("/signup")}>Join</Button>');
    assert.equal(found.length, 1);
    assert.equal(found[0].value, "/signup");
  });

  it("flags an asset literal with no file under public/, and only that one", () => {
    const source = [
      'const a = { avatar: "/testimonials/jessica.png" };',
      'const b = { avatar: "/avatars/alex.png" };',
      'const c = { src: "/placeholder.svg?height=400" };',
    ].join("\n");
    const found = missing(source);
    assert.equal(found.length, 1);
    assert.equal(found[0].value, "/testimonials/jessica.png");
    assert.equal(found[0].line, 1);
  });

  it("counts lines from the real file body, not the first match", () => {
    const source = [
      'import Link from "next/link";',
      "",
      "export function X() {",
      '  return <Link href="/signup" />;',
      "}",
    ].join("\n");
    assert.equal(dead(source)[0].line, 4);
  });
});

/* ---------------------------------------------------------------- *
 * helper
 * ---------------------------------------------------------------- */
function makeQuiz(overrides: Record<string, unknown> = {}) {
  return {
    id: "quiz-1",
    kind: "quiz",
    slug: "quiz-1",
    title: "World History",
    summary: "A quiz about world history.",
    categoryIds: ["history"],
    tags: [],
    difficulty: "medium",
    questions: [],
    settings: {
      timeLimitSeconds: 1200,
      questionTimerSeconds: 0,
      passingScore: 70,
      shuffleQuestions: false,
      showExplanations: true,
      allowRetakes: true,
      visibility: "public",
    },
    ...overrides,
  };
}
