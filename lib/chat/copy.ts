/**
 * The two vocabularies the chat surface looks up by a *derived* name — a status and a state (#1131).
 *
 * ## Why these are functions and not interpolated ids
 *
 * E23's reader matches **literal** ids (`pageItemOf(copy, "chip-gap")`); a template literal
 * (`pageItemOf(copy, \`chip-${status}\`)`) it cannot see, so the fixture item would read as unused and
 * a typo would render `undefined` at runtime instead of failing the build. One branch per value, one
 * literal id per branch, and the check keeps its teeth.
 *
 * ## Why they are not in a component
 *
 * The conversation list is a server component and the thread is a client one, and the same three
 * state words appear in both. A shared module is the only place both can read without one importing
 * the other's `"use client"` boundary.
 *
 * Pure: a `PageCopy` in, a string out. No React, no clock, no `content/` import beyond the reader.
 */
import type { AlignmentStatus } from "@/content/gaps";
import type { PageCopy } from "@/content/pages";
import type { ChatThreadState } from "@/lib/chat/thread";
import { pageItemOf } from "@/lib/page-copy";

/**
 * The status's word: In Synch, Small Gap, Small Gap · Not OK Under Full, or Gap.
 *
 * The third one is not a fourth status — it is the 1-step Gap read under **Full** tolerance, and it
 * exists as its own string because the distinction would otherwise be carried by colour alone, which
 * the epic's locked rule forbids.
 */
export function chatStatusWord(copy: PageCopy, status: AlignmentStatus): string {
  if (status === "in-synch") return pageItemOf(copy, "chip-synch").label;
  if (status === "gap") return pageItemOf(copy, "chip-gap").label;
  if (status === "small-gap-tight") return pageItemOf(copy, "chip-not-ok").label;
  return pageItemOf(copy, "chip-small").label;
}

/** The thread's state chip: Stage 6 Live, Waiting on Invite, or Paused · Read-Only. */
export function chatThreadStateLabel(copy: PageCopy, state: ChatThreadState): string {
  if (state === "paused") return pageItemOf(copy, "state-paused").label;
  if (state === "waiting") return pageItemOf(copy, "state-waiting").label;
  return pageItemOf(copy, "state-live").label;
}
