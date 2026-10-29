/**
 * The shared content core — zod is the single source of truth.
 *
 * Every type in `content/` is `z.infer`red from a schema, so a record can never
 * drift from its type. The drifts this file retires:
 *
 *  D1  two hand-written `Quiz` interfaces, both imported as `Quiz`
 *  D3  numeric ids that collide across collections  -> kebab-case string ids
 *  D9  six time formats, `Date.now()` at module import -> ONE ISO-8601 instant
 *  D10 `JSX.Element` / `StaticImageData` inside data -> `ImageRef` / `PersonRef`
 *  D17 three identity namespaces -> one `PersonRef`
 *
 * Rules encoded here:
 *  - every object is `strict()`: an unknown key is a validation error, not a
 *    silently carried field. That is what turns a fixture drift into a red test.
 *  - `featured` is omit-or-true, so `featured: false` is unrepresentable.
 *  - this module has no framework imports: it runs under plain node, which is
 *    what lets `data:check` validate fixtures without a bundler.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** Kebab-case identifier: `quiz-1`, `quiz-ultimate-world-history-trivia`, `quiz-1-q2`. */
export const zId = z
  .string()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "id must be kebab-case: [a-z0-9-], no leading/trailing/double hyphen",
  );

/**
 * URL identity, independent of `id`, derived once from the title at migration
 * and then frozen: a changed slug is a broken URL, not a rename.
 */
export const zSlug = zId;

/** ONE instant type for the whole content model. Absolute, UTC, offset allowed. */
export const zIsoDateTime = z.string().datetime({ offset: true });

/** `easy | medium | hard`, lowercase (D5: `"Medium"` in currentQuiz and searchdata). */
export const zDifficulty = z.enum(["easy", "medium", "hard"]);

/** The enum's members, in display order — the ONE list a difficulty control iterates. */
export const DIFFICULTIES = zDifficulty.options;

/**
 * Display label for a difficulty. The enum value is the identity; this table is the only
 * place it becomes text, so a component never types `"Easy"` (or `"Hard"`) itself.
 */
export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function difficultyLabel(difficulty: Difficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

/**
 * Narrowing guard for the one place a string arrives from outside the model: a `<Select>`
 * hands back `string`, so the enum decides whether it is a difficulty instead of a cast
 * (`value as "easy" | "medium" | "hard"`) that would accept anything.
 */
export function isDifficulty(value: string): value is Difficulty {
  return zDifficulty.safeParse(value).success;
}

/**
 * Publication state. The fixtures encode this three ways (`published: boolean`,
 * `status: "active" | "draft"`, `visibility`) and no record carries a date.
 */
export const zPublishStatus = z.enum(["draft", "published", "archived"]);

/** The four content kinds. Also the four category scopes. */
export const zContentKind = z.enum(["quiz", "news", "tip", "kb"]);
export type ContentKind = z.infer<typeof zContentKind>;

/* ------------------------------------------------------------------ *
 * Refs
 * ------------------------------------------------------------------ */

export const zImageRef = z
  .object({
    /** Public URL path or absolute URL. */
    src: z.string().min(1),
    /** Empty is legal for a cover (the title carries the meaning); content images require one. */
    alt: z.string().default(""),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    blurDataUrl: z.string().optional(),
  })
  .strict();

export const zPersonRef = z
  .object({
    /** Optional: most fixture authors/contact names are not accounts. No ids are invented. */
    id: zId.optional(),
    name: z.string().min(1),
    avatar: zImageRef.optional(),
    role: z.string().optional(),
    bio: z.string().optional(),
  })
  .strict();

export type ImageRef = z.infer<typeof zImageRef>;
export type PersonRef = z.infer<typeof zPersonRef>;
export type Difficulty = z.infer<typeof zDifficulty>;
export type PublishStatus = z.infer<typeof zPublishStatus>;

/**
 * Next.js `StaticImageData`, described structurally so this module never imports
 * `next/image` (a type-only import would still drag the framework into the
 * fixture validator's build).
 */
export interface StaticImageLike {
  src: string;
  height?: number;
  width?: number;
  blurDataURL?: string;
}

/**
 * Boundary helper: a static image import (or a plain string path) -> `ImageRef`.
 * The model never holds a `StaticImageData`; `blurDataURL` -> `blurDataUrl` is the
 * one casing change.
 */
export function staticToImageRef(input: string | StaticImageLike | ImageRef, alt = ""): ImageRef {
  if (typeof input === "string") {
    if (!input.trim()) throw new Error("staticToImageRef: empty src");
    return { src: input, alt };
  }
  if (!input || typeof input.src !== "string" || !input.src.trim()) {
    throw new Error("staticToImageRef: object without a usable src");
  }
  const ref: ImageRef = { src: input.src, alt };
  if (typeof input.width === "number") ref.width = input.width;
  if (typeof input.height === "number") ref.height = input.height;
  const blur = (input as StaticImageLike).blurDataURL ?? (input as ImageRef).blurDataUrl;
  if (blur) ref.blurDataUrl = blur;
  return ref;
}

/* ------------------------------------------------------------------ *
 * Content base — every kind extends this
 * ------------------------------------------------------------------ */

export const zContentBase = z
  .object({
    /** Globally unique across every kind, prefixed: `quiz-1`, `tip-1`, `news-hello`. */
    id: zId,
    kind: zContentKind,
    slug: zSlug,
    title: z.string().min(1),
    /** Absorbs `description` (quiz, kb), `excerpt` (news, tip) and `text` previews. */
    summary: z.string().min(1),
    /** The ONLY join key into the taxonomy (D6/D7). Never empty. */
    categoryIds: z.array(zId).min(1),
    /** Free-text facets. Search/SEO only — never used for navigation. */
    tags: z.array(z.string().min(1)).default([]),
    /** Absorbs `image`, `coverImage` and `thumbnail`. */
    cover: zImageRef.optional(),
    author: zPersonRef.optional(),
    /**
     * The instant it went live, when known. Optional because none of the 21
     * authored quizzes carries a date (D11) and a draft has not been published.
     * Publication state is `status`; it is never inferred from this field.
     */
    publishedAt: zIsoDateTime.optional(),
    /** When the record was authored. Distinct from `publishedAt`. */
    createdAt: zIsoDateTime.optional(),
    /** Was `readTime`. */
    readMinutes: z.number().int().positive().optional(),
    /** Omit-or-true: `featured: false` is a validation error, not a style choice. */
    featured: z.literal(true).optional(),
  })
  .strict();

export type ContentBase = z.infer<typeof zContentBase>;

/* ------------------------------------------------------------------ *
 * Formatters — render-time only, so no prose is ever stored
 * ------------------------------------------------------------------ */

/**
 * The fixture clock — the one instant every relative label is measured against.
 *
 * All instants in `data/` are fixed ISO literals, so "now" has to be fixed too. A label
 * computed from `new Date()` is rendered once by the server and recomputed at hydration; the
 * two runs straddle the fixture timestamps and React throws error #418 (`text content does not
 * match server-rendered HTML`) on every route that renders the shell. Passing the wall clock
 * around does not help either — it only moves the disagreement from the module to the request.
 *
 * `DEMO_NOW_ISO` is later than every social fixture instant (E10 in `pnpm data:check` keeps it
 * that way), so no label can read "in 1 hour" either. Every relative or calendar label below is
 * therefore a pure function of its ISO argument: server and client agree by construction.
 */
export const DEMO_NOW_ISO = "2026-10-29T12:00:00.000Z";

const MS_PER_DAY = 86_400_000;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const pad2 = (value: number): string => String(value).padStart(2, "0");

const CURRENCY = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

/** `reward: "$10.00"` is stored as `rewardCents: 1000`; this is the only place it becomes a string. */
export function formatCurrency(cents: number, opts: { trimZeroCents?: boolean } = {}): string {
  const value = cents / 100;
  return opts.trimZeroCents && Number.isInteger(value)
    ? `$${value.toFixed(0)}`
    : CURRENCY.format(value);
}

/** Absolute instant -> display date. Replaces the six stored formats of D9. */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

/**
 * UTC calendar-day key, `2026-10-29`. The bucketing key for "group the messages of one day":
 * a locale/timezone-derived key (`.toLocaleDateString()`) buckets differently on the server
 * and in the browser, which changes the DOM shape and hydrates as a mismatch.
 */
export function formatDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Whole UTC calendar days from `iso` to `nowIso`: 0 = the same day, 1 = yesterday. */
export function dayDelta(iso: string, nowIso: string = DEMO_NOW_ISO): number {
  const dayOf = (value: string) => Date.parse(`${formatDayKey(value)}T00:00:00.000Z`);
  return Math.round((dayOf(nowIso) - dayOf(iso)) / MS_PER_DAY);
}

/**
 * `07:27 AM`. Hand-formatted from UTC getters rather than `toLocaleTimeString`: the host
 * timezone changes the value and the ICU version changes the space before `AM`, either of
 * which is a hydration mismatch. Chat times are authored in UTC, so they render in UTC.
 */
export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  const hours = date.getUTCHours();
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${pad2(hours12)}:${pad2(date.getUTCMinutes())} ${hours < 12 ? "AM" : "PM"}`;
}

/** `Thu` */
export function formatWeekdayShort(iso: string): string {
  return WEEKDAY_NAMES[new Date(iso).getUTCDay()].slice(0, 3);
}

/** `Oct 29` */
export function formatMonthDay(iso: string): string {
  const date = new Date(iso);
  return `${MONTH_NAMES[date.getUTCMonth()].slice(0, 3)} ${date.getUTCDate()}`;
}

/** `Thursday, October 29` */
export function formatDateLong(iso: string): string {
  const date = new Date(iso);
  return `${WEEKDAY_NAMES[date.getUTCDay()]}, ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** `Thursday, October 29 at 07:27 AM` — the tooltip under a chat message. */
export function formatDateTimeLong(iso: string): string {
  return `${formatDateLong(iso)} at ${formatClockTime(iso)}`;
}

/**
 * Absolute instant -> `Today` / `Yesterday` / `Thursday, October 29`, measured against the
 * fixture clock instead of the wall clock.
 */
export function formatDayHeading(iso: string): string {
  const delta = dayDelta(iso);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  return formatDateLong(iso);
}

/**
 * Absolute instant -> "2 days ago". Replaces `date: "2 days ago"` fixtures.
 *
 * `now` defaults to the fixture clock, never to `new Date()`: see `DEMO_NOW_ISO`. Pass an
 * explicit `now` only from a non-rendering caller (tests, a script) — never from a component
 * that is server-rendered and then hydrated.
 */
export function formatRelative(iso: string, now: Date = new Date(DEMO_NOW_ISO)): string {
  const deltaSeconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  const future = deltaSeconds > 0;
  const magnitude = Math.abs(deltaSeconds);
  const units: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const [unit, size] of units) {
    if (magnitude >= size) {
      const value = Math.floor(magnitude / size);
      return rtf.format(future ? value : -value, unit);
    }
  }
  return rtf.format(future ? magnitude : -magnitude, "second");
}

/**
 * `expiresIn: 172800` (a seconds-until snapshot) becomes an absolute instant;
 * this renders the countdown, so two viewers see the same remaining time.
 */
export function formatTimeRemaining(endsAtIso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((new Date(endsAtIso).getTime() - now.getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? "" : "s"} left`;
  }
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** `formatPlayerCount(2453) === "2.5k"`. */
export function formatPlayerCount(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}
