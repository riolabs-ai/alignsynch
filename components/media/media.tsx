"use client";

import Image from "next/image";
import { useState } from "react";

import {
  fallbackOf,
  generatedMedia,
  isFileMedia,
  isRemoteMedia,
  type GeneratedMediaEntry,
  type MediaEntry,
  type MediaKind,
  pickMedia,
} from "@/content/media";
import { avatarGradient, initialsOf, seedHash } from "@/components/media/generated-avatar";
import { cn } from "@/lib/utils";

/**
 * Media — the one component that renders a `MediaEntry` (issue #155, phase 1).
 *
 * Every slot used to decide for itself what an absent image looked like. Twenty-two of them
 * wrote `src={cover?.src ?? media.placeholder.src}` — the same 1024 px placeholder behind
 * every card that had no cover — and the two remote images (the flags) had no fallback at
 * all. This component is that decision made once:
 *
 *   file  -> the image on disk, at its intrinsic size or filling the slot
 *   remote -> somebody else's URL, with a neutral generated plate behind the failure
 *   generated -> an inline SVG over a CSS gradient, drawn from the seed. No bytes, no
 *                request of its own
 *
 * TIER ORDER. `pickMedia` picks file over remote over generated, so a call site never
 * orders them: give it what the record carries (`entry`) and what the record would fall
 * back to (`fallback`), and the tier decides.
 *
 * FAULT TOLERANCE. `onError` on either image branch sets `failed`, and the same box paints
 * the generated default for `fallbackOf(entry)` instead. The generated tier is drawn at the
 * same size as the image it replaces — `fill` stays `fill`, a sized avatar keeps its
 * diameter — so nothing reflows when a 404 lands, and no broken-image icon is ever painted.
 * A failure is expected, not exceptional: the browser logs the network error itself, and
 * this component adds nothing to the console.
 *
 * NO RANDOMNESS. The gradient and the mark are pure functions of `entry.seed` /
 * `entry.fallbackSeed`, so the server, the browser and a screenshot all paint the same
 * picture and a second render of the same entry is byte-identical markup.
 *
 * A CLIENT component because `onError` is a browser event: there is no way to notice a dead
 * remote image during a static render, which is exactly why the fallback has to exist in the
 * client. It holds no state beyond "this entry failed".
 */

export interface MediaProps {
  /** What the record says it has — a file, a remote URL, or a drawn default. */
  readonly entry?: MediaEntry | undefined;
  /** A second candidate. `pickMedia` applies the tier order across both. */
  readonly fallback?: MediaEntry | undefined;
  /** Seeds the drawn default when neither candidate names one (a record with no image). */
  readonly seed?: string;
  /**
   * Accessible description. Defaults to the entry's own `alt`; an empty one means the media
   * is decoration and is hidden from the accessibility tree.
   */
  readonly alt?: string;
  /** Kind of the drawn default, when `seed` is what produces it. */
  readonly kind?: MediaKind;
  /** Fill a positioned parent instead of taking an intrinsic size. */
  readonly fill?: boolean;
  /** Pixel size for a non-`fill` slot. Falls back to the entry's own intrinsic size. */
  readonly width?: number;
  readonly height?: number;
  readonly sizes?: string;
  readonly priority?: boolean;
  /** Called once the image's bytes have decoded. Never fires for the drawn default. */
  readonly onLoad?: () => void;
  readonly className?: string;
}

const dimsOf = (entry: MediaEntry): { width: number; height: number } | undefined => {
  if (isFileMedia(entry)) return { width: entry.width, height: entry.height };
  if (isRemoteMedia(entry) && entry.width !== undefined && entry.height !== undefined) {
    return { width: entry.width, height: entry.height };
  }
  return undefined;
};

/**
 * The drawn default: a CSS gradient seeded by the entry, an inline SVG mark on top, and the
 * initials instead of the mark when the media is a person's avatar (never a face — #152).
 *
 * `role="img"` plus `aria-label` when it stands in for something described; `aria-hidden`
 * when `alt` is empty, because a screen reader announcing a gradient is noise.
 */
function GeneratedMedia({
  entry,
  alt,
  fill,
  width,
  height,
  className,
}: {
  entry: GeneratedMediaEntry;
  alt: string;
  fill: boolean;
  width?: number;
  height?: number;
  className?: string;
}) {
  const gradient = avatarGradient(entry.seed);
  const initials = entry.kind === "avatar" ? initialsOf(alt) : undefined;
  const described = alt.trim() !== "";

  return (
    <span
      aria-hidden={described ? undefined : true}
      aria-label={described ? alt : undefined}
      className={cn(
        "flex select-none items-center justify-center overflow-hidden",
        entry.kind === "avatar" && "rounded-full",
        fill ? "absolute inset-0 h-full w-full" : "block",
        className,
      )}
      data-media="generated"
      data-seed={entry.seed}
      role="img"
      style={{
        backgroundImage: gradient.css,
        color: gradient.ink,
        ...(fill ? {} : { width: width ?? "100%", height: height ?? "100%" }),
        ...(initials === undefined ? {} : { fontSize: Math.round((height ?? width ?? 40) * 0.42) }),
      }}
    >
      {initials === undefined ? (
        <MediaMark seed={entry.seed} />
      ) : (
        <span aria-hidden="true" className="font-semibold leading-none">
          {initials}
        </span>
      )}
    </span>
  );
}

/**
 * The abstract mark: two rings positioned and rotated by disjoint slices of the seed's hash,
 * stroked in the gradient's own ink so it stays legible against every colour that gradient
 * can produce. Inline SVG, so it is a string in the markup and never a request.
 *
 * Nothing here is random and nothing reads a clock — `seedHash` is the FNV-1a this repo
 * already uses for avatars and category tiles.
 */
export function MediaMark({ seed }: { seed: string }) {
  const hash = seedHash(seed);
  const centreX = 34 + (hash % 33);
  const centreY = 34 + ((hash >>> 8) % 33);
  const ring = 14 + ((hash >>> 16) % 12);
  const angle = (hash >>> 4) % 360;
  const stroke = 1.5 + ((hash >>> 12) % 3) / 2;

  return (
    <svg
      aria-hidden="true"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 100 100"
    >
      <g
        fill="none"
        opacity="0.55"
        stroke="currentColor"
        strokeWidth={stroke}
        transform={`rotate(${angle} 50 50)`}
      >
        <circle cx={centreX} cy={centreY} r={ring} />
        <circle cx={100 - centreX} cy={100 - centreY} r={Math.round(ring * 0.6)} />
      </g>
    </svg>
  );
}

export function Media({
  entry,
  fallback,
  seed,
  alt,
  kind,
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  onLoad,
  className,
}: MediaProps) {
  const [failed, setFailed] = useState(false);

  const chosen =
    pickMedia(entry, fallback) ?? (seed === undefined ? undefined : generatedMedia(seed, kind));

  /**
   * Nothing to draw and no seed to draw from: render nothing at all. An empty `div` would be
   * an invisible box that still takes layout space, and a placeholder file would be the one
   * shared image this issue is deleting.
   */
  if (chosen === undefined) return null;

  const current = failed ? fallbackOf(chosen) : chosen;
  const description = alt ?? current.alt;
  /**
   * The box comes from the entry that was chosen, not from what is painted: a generated
   * default has no intrinsic size, so sizing it from itself would collapse a failed image
   * to zero and reflow everything around it. The default fills the box its entry reserved.
   */
  const dims = dimsOf(chosen);

  if (!isFileMedia(current) && !isRemoteMedia(current)) {
    return (
      <GeneratedMedia
        alt={description}
        className={className}
        entry={current}
        fill={fill}
        height={height ?? dims?.height}
        width={width ?? dims?.width}
      />
    );
  }

  const src = isFileMedia(current) ? current.src : current.url;
  const onError = () => setFailed(true);

  if (fill) {
    return (
      <Image
        alt={description}
        className={className}
        fill
        onError={onError}
        onLoad={onLoad}
        priority={priority}
        sizes={sizes ?? "100vw"}
        src={src}
      />
    );
  }

  return (
    <Image
      alt={description}
      className={className}
      height={height ?? dims?.height ?? 100}
      onError={onError}
      onLoad={onLoad}
      priority={priority}
      src={src}
      width={width ?? dims?.width ?? 100}
    />
  );
}
