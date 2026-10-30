"use client";

import { ReviewModal } from "@/components/quiz/review-modal";
import { GeneratedAvatar } from "@/components/media/generated-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatTimeRemaining } from "@/content/core";
import { formatStopwatch } from "@/content/quiz-result";
import { media } from "@/data/media";
import type {
  QuizDetailModel,
  QuizLeaderboardRowModel,
  QuizReviewRowModel,
} from "@/lib/quiz-detail";
import { ArrowLeft, Award, Bookmark, Clock, Share2, Star, Users } from "lucide-react";
import Link from "next/link";
import { Media } from "@/components/media/media";
import { entryOf, FALLBACK_KIND } from "@/lib/media-entry";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * What the server hands this page: the record already projected
 * (`lib/quiz-detail.ts::quizDetailModel`).
 *
 * That projection is the **quiz-scoped** model — the record plus the one campaign
 * live for that quiz (A3) plus the activity that names it: the leaderboard
 * (`selectQuizLeaderboard` over `data/quiz-results.ts`, best percent first then
 * fastest) and the reviews (`selectQuizReviews` over `data/quiz-reviews.ts`, newest
 * first). It is computed on the server at a single instant and passed down, so the
 * prize on this page is the same number the merchandised card prints: `$7.50` while
 * the campaign runs, `$10.00` before it starts and after it ends. `now` travels with
 * the model because the countdown is formatted from the same instant
 * (`formatTimeRemaining`), never from a second clock — a client component that reads
 * `new Date()` at render is the D9/#418 drift.
 *
 * The page's numbers, from whichever source it has:
 *
 * The boundary is deliberate: **engagement and identity** (title, cover, category,
 * difficulty, time limit, questions, rating, plays, seats, prize, prize badge,
 * author, summary) come from the record through the projection above. A field the
 * record does not have is **neutralised or hidden**, never filled with the template's
 * value: an absent author prints `Unknown creator` and an absent rating `—` (the
 * `ExploreQuizList` convention), an absent cover falls to `media.placeholder.src`, and
 * everything the template *invented* for a record — its `$5.00` prize, Requirements,
 * Tags, related cards, the creator's "42 quizzes", a seat count for a quiz with no
 * capacity — is hidden rather than shown. A page may not state content or numbers the
 * model does not own.
 *
 * **The leaderboard and the reviews are rows of the activity collections**, not
 * fields of the record and not this component's literals: `content/quiz-result.ts`
 * owns `QuizResult` / `QuizReview` / `QuizComment`, and `lib/quiz-detail.ts` selects
 * the ones that name this quiz. So a record with attempts renders a populated
 * Leaderboard tab, one with reviews a Reviews tab, and a record with neither renders
 * neither — not a tab with an empty state, because an empty tab is still a claim that
 * the quiz has a leaderboard. Nothing about those tabs is authored beside this
 * component: swap a row in `data/quiz-results.ts` or `data/quiz-reviews.ts` and both
 * change with no `.tsx` edit. (#41 printed `ThorFan` / `MarvelFan` here because the
 * model genuinely had no participant records; `content/quiz-result.ts` is what gives
 * it those collections, so the old rule is retired, not overridden.)
 *
 * `/quiz/<id>` for an id that is not a record (`/quiz/1`, the template's) keeps
 * rendering the template card — including the template's own leaderboard and review
 * rows — so the mock stays a visible fallback rather than a silent second source of
 * truth.
 */

interface DetailView {
  title: string;
  /** Absent when the record has no cover; the hero then renders the placeholder. */
  image?: string;
  category: string;
  /** Capitalised for the badge variant switch (`"Medium"`, not `"medium"`). */
  difficulty: string;
  timeLimit: string;
  reward: string;
  players: number;
  /** Absent when the record has no capacity — then there is no seat count to print. */
  maxPlayers?: number;
  spotsLeft: number;
  almostFull: boolean;
  questionCount: number;
  /** Absent when the record carries no rating. */
  rating?: number;
  /** Only the template carries a rating count; the model does not. */
  ratingCount?: number;
  timeLeft?: string;
  featured: boolean;
  badge?: { label: string };
  authorName: string;
  /** Stable id the author avatar is seeded from (issue #152) — the PersonRef id, or the name. */
  authorSeed: string;
  /**
   * The creator panel's stats. Only the template has them: "42 quizzes" is not in the
   * content model, so the real record's panel shows the author's name and nothing it
   * cannot back.
   */
  authorStats?: { level: string; quizzes: number; lastUpdate: string };
  summary: string;
  /**
   * Template-only content claims. The model has no requirements or tags, so a record's
   * page renders neither rather than printing "Basic knowledge of Marvel movies" over a
   * space quiz — absence prints nothing, the same rule as `ratingCount` and the prize.
   */
  requirements?: string;
  tags?: string[];
  /** Template-only related cards — they name other records, so only the template has them. */
  related?: Array<{ id: number; title: string; image?: string; difficulty: string }>;
  /**
   * The quiz's attempts, ranked — from `selectQuizLeaderboard` for a record, or the
   * template's own five rows. Empty means the tab is not rendered at all.
   */
  leaderboard?: QuizLeaderboardRowModel[];
  /**
   * The quiz's reviews, newest first — from `selectQuizReviews` for a record, or the
   * template's own three. Empty means no Reviews tab and no "Write a Review" button.
   */
  reviews?: QuizReviewRowModel[];
}

/** Sample quiz data - in a real app, you would fetch this based on the ID */
const quizData = {
  id: "1",
  title: "Space Exploration Quiz",
  category: "Science & Technology",
  difficulty: "Medium",
  timeLimit: 20,
  players: 285,
  maxPlayers: 300,
  spotsLeft: 15,
  questions: 25,
  rating: 4.8,
  ratingCount: 156,
  description:
    "Test your knowledge of the Space Exploration with this comprehensive trivia quiz. From Iron Man to the latest releases, this quiz covers characters, plot points, Easter eggs, and behind-the-scenes facts that only true fans would know.",
  requirements: "Basic knowledge of Marvel movies and TV shows. No specific preparation needed.",
  creator: {
    name: "MarvelFan2023",
    level: "Expert Quiz Creator",
    quizzes: 42,
    lastUpdate: "2023-10-15",
  },
  tags: ["Marvel", "Superheroes", "Movies", "MCU", "Avengers"],
  // The template's own rows, in the model's row shape: `percent` and `seconds` are
  // data, the tab formats them (`formatStopwatch`). 12:45 = 765 s, 13:20 = 800 s, …
  // `seed` is the row's identity for its drawn avatar (issue #152) — a template row has
  // no record id, so its handle is the seed.
  leaderboard: [
    { rank: 1, name: "ThorFan", seed: "ThorFan", percent: 98, seconds: 765 },
    {
      rank: 2,
      name: "IronManRules",
      seed: "IronManRules",
      percent: 95,
      seconds: 800,
    },
    {
      rank: 3,
      name: "CaptainAmerica",
      seed: "CaptainAmerica",
      percent: 92,
      seconds: 845,
    },
    {
      rank: 4,
      name: "BlackWidow",
      seed: "BlackWidow",
      percent: 90,
      seconds: 930,
    },
    { rank: 5, name: "HulkSmash", seed: "HulkSmash", percent: 88, seconds: 975 },
  ],
  reviews: [
    {
      id: "template-review-marvelfan",
      name: "MarvelFan",
      seed: "MarvelFan",
      rating: 5,
      body: "Excellent quiz! Really tests your knowledge of the MCU.",
    },
    {
      id: "template-review-quizlover",
      name: "QuizLover",
      seed: "QuizLover",
      rating: 4,
      body: "Good variety of questions, some were quite challenging.",
    },
    {
      id: "template-review-avenger",
      name: "Avenger",
      seed: "Avenger",
      rating: 5,
      body: "Perfect for Marvel fans. I learned some new facts too!",
    },
  ],
  relatedQuizzes: [
    {
      id: 2,
      title: "DC Extended Universe Quiz",
      difficulty: "Hard",
    },
    {
      id: 3,
      title: "Star Wars Saga Trivia",
      image: media["brain-teasers-puzzles"].src,
      difficulty: "Medium",
    },
    {
      id: 4,
      title: "Harry Potter Wizarding World",
      image: media["history-mysteries"].src,
      difficulty: "Easy",
    },
  ],
};

/** The template card, used only when the id is not a record. */
const templateView: DetailView = {
  title: quizData.title,
  category: quizData.category,
  difficulty: quizData.difficulty,
  timeLimit: `${quizData.timeLimit} min`,
  // The template has no prize in the model, and inventing one is the bug this card
  // removes: an unknown prize prints as a dash, exactly as an authoring card does.
  reward: "—",
  players: quizData.players,
  maxPlayers: quizData.maxPlayers,
  spotsLeft: quizData.spotsLeft,
  almostFull: quizData.spotsLeft <= 20,
  questionCount: quizData.questions,
  rating: quizData.rating,
  ratingCount: quizData.ratingCount,
  featured: true,
  badge: { label: "Popular" },
  authorName: quizData.creator.name,
  authorSeed: quizData.creator.name,
  authorStats: {
    level: quizData.creator.level,
    quizzes: quizData.creator.quizzes,
    lastUpdate: quizData.creator.lastUpdate,
  },
  summary: quizData.description,
  requirements: quizData.requirements,
  tags: quizData.tags,
  related: quizData.relatedQuizzes,
  // The template's own rows: a page for an id that is not a record keeps the mock
  // visible instead of printing nothing. `modelView()` fills the same two slots from
  // the activity collections.
  leaderboard: quizData.leaderboard,
  reviews: quizData.reviews,
};

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * `grid-cols-N` for the tab bar, as literal strings: a class name built by
 * interpolation is invisible to Tailwind's scanner, so the column count is a lookup.
 */
const TAB_COLUMNS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * The record's numbers, at the instant it was projected — plus the two activity tabs.
 *
 * `leaderboard` and `reviews` are passed straight through: `quizDetailModel()` already
 * selected this quiz's rows, ranked them and reduced each to the fields the tab
 * prints. An empty array here is the whole rule — the tab is not rendered.
 */
function modelView(detail: QuizDetailModel): DetailView {
  const { card, questionCount, now } = detail;
  const clock = new Date(now);
  const { stats } = card;
  return {
    title: card.title,
    // Absent, not the template's cover: the mock's own art is its art, and naming
    // it here would claim a record carries an image it does not.
    ...(card.cover === undefined ? {} : { image: card.cover.src }),
    category: card.categories[0]?.name ?? "Uncategorised",
    difficulty: cap(card.difficulty),
    timeLimit:
      card.timeLimitSeconds === 0 ? "No limit" : `${Math.round(card.timeLimitSeconds / 60)} min`,
    reward: stats.rewardCents === undefined ? "—" : formatCurrency(stats.rewardCents),
    players: stats.plays,
    ...(stats.capacity === undefined ? {} : { maxPlayers: stats.capacity }),
    spotsLeft: stats.spotsLeft ?? 0,
    almostFull: stats.almostFull,
    questionCount,
    ...(stats.rating === undefined ? {} : { rating: stats.rating }),
    timeLeft:
      stats.limitedTime && stats.limitedTimeEndsAt !== undefined
        ? formatTimeRemaining(stats.limitedTimeEndsAt, clock)
        : undefined,
    featured: card.featured === true,
    ...(stats.badge === undefined ? {} : { badge: { label: stats.badge.label } }),
    authorName: card.author?.name ?? "Unknown creator",
    authorSeed: card.author?.id ?? card.author?.name ?? "Unknown creator",
    summary: card.summary,
    leaderboard: detail.leaderboard,
    reviews: detail.reviews,
  };
}

export function QuizDetails({ id, detail }: { id: string; detail?: QuizDetailModel }) {
  const view = detail === undefined ? templateView : modelView(detail);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [userReviews, setUserReviews] = useState<QuizReviewRowModel[]>(() => view.reviews ?? []);

  // A tab exists only where its content does: a record with no attempt has an empty
  // `leaderboard` and gets no Leaderboard tab, and one with no review gets no Reviews
  // tab — not three tabs with two empty panes, and not the template's rows in their
  // place. Which rows a record carries is `quizDetailModel()`'s answer, never this
  // component's.
  const leaderboard = view.leaderboard ?? [];
  const reviews = view.reviews ?? [];
  const hasSummary = view.summary.trim().length > 0;
  const tabs: Array<{ value: string; label: string }> = [
    ...(hasSummary ? [{ value: "overview", label: "Overview" }] : []),
    ...(leaderboard.length > 0 ? [{ value: "leaderboard", label: "Leaderboard" }] : []),
    ...(reviews.length > 0 ? [{ value: "reviews", label: "Reviews" }] : []),
  ];

  const getDifficultyVariant = (difficulty: string) => {
    switch (difficulty) {
      case "Easy":
        return "success";
      case "Medium":
        return "yellow";
      case "Hard":
        return "destructive";
      default:
        return "default";
    }
  };

  // Calculate progress percentage
  const progressPercentage =
    view.maxPlayers === undefined || view.maxPlayers === 0
      ? 0
      : (view.players / view.maxPlayers) * 100;

  const handleReviewSubmit = (review: { rating: number; comment: string }) => {
    // Client-only, deliberately: there is no `data/` write path and no API, so the
    // submitted review is an optimistic row in this component's state and is gone on
    // reload. It never pretends to be a record — `review-` ids are not fixture ids.
    setUserReviews((previous) => [
      {
        id: `local-review-${previous.length + 1}`,
        name: "You",
        seed: "current-user",
        rating: review.rating,
        body: review.comment,
      },
      ...previous,
    ]);
  };
  const route = useRouter();
  const playNow = () => {
    route.push(`/quiz/${id}/play`);
  };

  /**
   * The overview pane, free of the tab chrome. A record with no attempt and no review
   * has only this pane, and one pane is not a tab bar: inside `Tabs` it would render a
   * `role="tabpanel"` whose `aria-labelledby` names a tab that does not exist. So the
   * body is defined once and rendered either as tab content or as plain content.
   */
  const overviewBody = (
    <>
      <div>
        <h2 className="text-xl font-semibold mb-2">Description</h2>
        <p className="text-muted-foreground">{view.summary}</p>
      </div>

      {view.requirements && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Requirements</h2>
          <p className="text-muted-foreground">{view.requirements}</p>
        </div>
      )}

      {view.tags && view.tags.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {view.tags.map((tag, index) => (
              <Badge key={index} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {view.related && view.related.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Related Quizzes</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {view.related.map((quiz) => (
              <Card key={quiz.id} className="overflow-hidden">
                <div className="relative h-32">
                  <Media
                    alt={quiz.title}
                    className="w-full h-full object-cover"
                    entry={entryOf(quiz.image)}
                    height={350}
                    kind={FALLBACK_KIND.quiz}
                    seed={String(quiz.id)}
                    width={600}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                    <div>
                      <Badge variant={getDifficultyVariant(quiz.difficulty)} className="mb-1">
                        {quiz.difficulty}
                      </Badge>
                      <h3 className="text-sm font-medium text-white">{quiz.title}</h3>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );

  /** A view with exactly one pane — every record — renders it without a tab bar. */
  const singlePane = tabs.length === 1 ? <div className="space-y-6">{overviewBody}</div> : null;

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/explore" className="flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Explore
          </Link>
        </Button>

        <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-6">
          <Media
            alt={view.title}
            className="w-full h-full object-cover"
            entry={entryOf(view.image)}
            fill
            kind={FALLBACK_KIND.quiz}
            seed={view.title}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col justify-end p-4 md:p-6">
            <div className="flex flex-wrap gap-2 mb-3">
              <Badge variant={getDifficultyVariant(view.difficulty)}>{view.difficulty}</Badge>
              {view.featured && (
                <Badge variant="secondary" className="bg-purple-500/80 text-white border-0">
                  Featured
                </Badge>
              )}
              {view.badge && (
                <Badge variant="secondary" className="bg-blue-500/80 text-white border-0">
                  {view.badge.label}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
              {view.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-white/90">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{view.timeLimit}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{view.players} players</span>
              </div>
              <div className="flex items-center gap-1">
                <Award className="h-4 w-4" />
                <span>{view.questionCount} questions</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>
                  {view.rating === undefined ? "—" : view.rating}
                  {view.ratingCount === undefined ? null : ` (${view.ratingCount} ratings)`}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {tabs.length > 1 ? (
              <Tabs defaultValue={tabs[0].value} className="w-full">
                <TabsList className={`grid w-full ${TAB_COLUMNS[tabs.length] ?? "grid-cols-3"}`}>
                  {tabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {hasSummary && (
                  <TabsContent value="overview" className="space-y-6 mt-6">
                    {overviewBody}
                  </TabsContent>
                )}

                {leaderboard.length > 0 && (
                  <TabsContent value="leaderboard" className="mt-6">
                    <div className="rounded-md border">
                      <div className="grid grid-cols-12 bg-muted/50 p-3 text-sm font-medium">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-5">Player</div>
                        <div className="col-span-3 text-center">Score</div>
                        <div className="col-span-3 text-center">Time</div>
                      </div>
                      {leaderboard.map((player) => (
                        <div key={player.rank} className="grid grid-cols-12 p-3 text-sm border-t">
                          <div className="col-span-1 text-center font-medium">{player.rank}</div>
                          <div className="col-span-5 flex items-center gap-2">
                            <GeneratedAvatar name={player.name} seed={player.seed} size={32} />
                            <span>{player.name}</span>
                          </div>
                          <div className="col-span-3 text-center">{player.percent}%</div>
                          <div className="col-span-3 text-center">
                            {formatStopwatch(player.seconds)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                )}

                {reviews.length > 0 && (
                  <TabsContent value="reviews" className="space-y-4 mt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">Reviews</h2>
                      <Button onClick={() => setIsReviewModalOpen(true)}>Write a Review</Button>
                    </div>

                    {userReviews.map((review) => (
                      <Card key={review.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <GeneratedAvatar name={review.name} seed={review.seed} size={40} />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">{review.name}</h3>
                                <div className="flex items-center">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Star
                                      key={i}
                                      className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
                                    />
                                  ))}
                                </div>
                              </div>
                              <p className="text-muted-foreground text-sm mt-1">{review.body}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </TabsContent>
                )}
              </Tabs>
            ) : (
              singlePane
            )}
          </div>

          <div>
            <Card>
              <CardContent className="p-6 space-y-6">
                {view.maxPlayers !== undefined && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Spots filled</span>
                      <span className="text-sm font-medium">
                        {view.players}/{view.maxPlayers}
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                    {view.almostFull && (
                      <p className="text-xs font-medium text-destructive">
                        Almost full! Only {view.spotsLeft} spots left
                      </p>
                    )}
                  </div>
                )}

                {/* The prize is the model's number, formatted — the whole point of P3:
                    this page cannot print a reward the card does not. */}
                <div
                  className="flex items-center justify-between rounded-lg border p-3"
                  data-testid="quiz-reward"
                >
                  <span className="text-sm text-muted-foreground">Prize</span>
                  <span className="font-medium text-green-600">{view.reward}</span>
                </div>

                {view.timeLeft && (
                  <div
                    className="flex items-center justify-between rounded-lg border p-3"
                    data-testid="quiz-countdown"
                  >
                    <span className="text-sm text-muted-foreground">Ends in</span>
                    <span className="font-medium">{view.timeLeft}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Category</div>
                    <div className="font-medium">{view.category}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Questions</div>
                    <div className="font-medium">{view.questionCount}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Time Limit</div>
                    <div className="font-medium">{view.timeLimit}</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground mb-1">Difficulty</div>
                    <div className="font-medium">{view.difficulty}</div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <GeneratedAvatar name={view.authorName} seed={view.authorSeed} size={40} />
                    <div>
                      <div className="font-medium">{view.authorName}</div>
                      {view.authorStats && (
                        <div className="text-xs text-muted-foreground">
                          {view.authorStats.level}
                        </div>
                      )}
                    </div>
                  </div>
                  {view.authorStats && (
                    <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Quizzes: </span>
                        <span className="font-medium">{view.authorStats.quizzes}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Updated: </span>
                        <span className="font-medium">{view.authorStats.lastUpdate}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Button onClick={playNow} className="w-full" size="lg">
                    Play Now
                  </Button>

                  <div className="flex justify-center gap-3">
                    <Button variant="outline" size="icon" className="aspect-square">
                      <Bookmark className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="aspect-square">
                      <Share2 className="h-5 w-5" />
                    </Button>
                    <Button variant="outline" size="icon" className="aspect-square">
                      <Award className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      {/* The review flow writes to this component's state and nowhere else — there is no
          API and no `data/` write path, and inventing one here would be a second source
          of truth for other people's reviews. It is mounted wherever a Reviews tab is,
          template or record, because the tab is what offers the button; what it cannot
          do is persist. */}
      {reviews.length > 0 && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          onSubmit={handleReviewSubmit}
          quizTitle={view.title}
        />
      )}
    </div>
  );
}
