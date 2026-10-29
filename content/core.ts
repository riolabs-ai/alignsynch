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

/** Absolute instant -> "2 days ago". Replaces `date: "2 days ago"` fixtures. */
export function formatRelative(iso: string, now: Date = new Date()): string {
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
