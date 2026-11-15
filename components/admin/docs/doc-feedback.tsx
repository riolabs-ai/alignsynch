"use client";

/**
 * template-ancestor: components/admin/broadcast-composer.tsx   (variation: the composer's compose-and-send band keeps its shape — a labelled field, a submit beside a cancel, and one sentence per answer under the controls — while the two panes collapse to a single box, the audience counts become a character hint, and the send receipt becomes an issue number a reader can point at)
 *
 * `/admin/docs/[...slug]` — "report a problem", at the foot of one document (#894).
 *
 * **What it sends.** Three facts the reader cannot forge into the issue: the document's manifest
 * path (a prop, not re-derived from `window.location`), the heading that was above the fold when
 * they opened the panel (`activeHeadingOf` over the article's own headings, so it is the page's
 * words and not a field), and the note they typed. The kind picks the label.
 *
 * **What it says back.** `feedbackNoticeOf()` maps the answer to one fixture sentence, and only the
 * `filed` branch is a `role="status"` carrying a number — a refusal is a `role="alert"` saying
 * nothing was recorded. A response this panel cannot read is read as `failed` by
 * `feedbackPhaseOf()`, so a proxy's error page and a truncated body cannot become a thank-you.
 *
 * **Why the form stays open after a failure.** The note is unchanged in the textarea, so "try
 * again" is a press rather than a retyping. On success the form closes and the message is cleared —
 * a second note about the same paragraph is a different issue, and a success leaves nothing on
 * screen that could be resubmitted by accident.
 *
 * **No token, no fetch helper, no server module.** The panel posts to a route; `feedbackPhaseOf()`
 * and the bounds come from `lib/docs/feedback.ts`, which imports nothing at all. `lib/docs/
 * feedback-github.ts` — the only reader of the token — is unreachable from here by construction and
 * `scripts/client-graph.ts` refuses the edge if someone adds it.
 *
 * Literal-free (E23): every word is `data/pages/admin-docs-document.ts`'s `feedback` band.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormSurface } from "@/components/ui/form-surface";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopySection } from "@/content/pages";
import {
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  type FeedbackKind,
  type FeedbackPhase,
  activeHeadingOf,
  feedbackNoticeOf,
  feedbackPhaseOf,
} from "@/lib/docs/feedback";
import { fillLabel, itemLabel, sectionBody } from "@/lib/page-copy";

export interface DocFeedbackProps {
  /** The `feedback` band of `data/pages/admin-docs-document.ts`. */
  copy: PageCopySection;
  /** The manifest row's path — the issue's address, and the only thing the reader cannot choose. */
  path: string;
  /** The page's own title, used when not one markdown heading is above the fold. */
  title: string;
}

/** The fixture item that names each kind, so the two radio labels are one map rather than a branch. */
const KIND_ITEM: Record<FeedbackKind, string> = {
  correction: "kind-correction",
  missing: "kind-missing",
};

/** The id the textarea's label points at. One document, one panel, so a constant is enough. */
const MESSAGE_ID = "doc-feedback-message";

/**
 * The heading the reader is looking at, read off the article this panel sits under.
 *
 * `getBoundingClientRect().top` is a viewport coordinate, so it is only meaningful in a browser —
 * which is the only place this runs. An empty article, or one scrolled entirely below the fold,
 * answers `""` and the document's own title is used instead.
 */
function headingInView(fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const nodes = Array.from(
    document.querySelectorAll("article h1, article h2, article h3, article h4"),
  );
  const headings = nodes.map((node) => ({
    text: (node.textContent ?? "").trim(),
    top: node.getBoundingClientRect().top,
  }));
  return activeHeadingOf(headings) || fallback;
}

export function DocFeedback({ copy, path, title }: DocFeedbackProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>(FEEDBACK_KINDS[0]);
  const [message, setMessage] = useState("");
  const [heading, setHeading] = useState(title);
  const [phase, setPhase] = useState<FeedbackPhase | null>(null);
  const [pending, setPending] = useState(false);

  const notice = phase === null ? null : feedbackNoticeOf(phase);

  /** Opening the panel is when the reader decided something was wrong, so the heading is taken here. */
  function openPanel() {
    setHeading(headingInView(title));
    setPhase(null);
    setOpen(true);
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setPhase(null);
    try {
      const response = await fetch("/api/docs/feedback", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ kind, path, heading, message }),
      });
      // A body this panel cannot read is `null`, and `feedbackPhaseOf()` answers `failed` for it.
      const answer: unknown = await response.json().catch(() => null);
      const answered = feedbackPhaseOf(answer);
      setPhase(answered);
      if (answered.kind === "filed") {
        setOpen(false);
        setMessage("");
      }
    } catch {
      // The request never reached the route: no note exists, and the sentence says so.
      setPhase({ kind: "failed" });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormSurface className="p-4" data-doc-feedback="">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">
            {copy.heading ?? itemLabel(copy, "open")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sectionBody(copy)}</p>
        </div>
        {open ? null : (
          <Button type="button" variant="outline" onClick={openPanel}>
            {itemLabel(copy, "open")}
          </Button>
        )}
      </div>

      {open ? (
        <form className="mt-4 space-y-3" onSubmit={send} data-doc-feedback-form="">
          <fieldset className="space-y-2">
            <p className="text-sm font-medium text-foreground">{itemLabel(copy, "kind-label")}</p>
            <RadioGroup
              value={kind}
              onValueChange={(next) => setKind(next === "missing" ? "missing" : "correction")}
              className="flex flex-wrap gap-4"
            >
              {FEEDBACK_KINDS.map((option) => (
                <div key={option} className="flex items-center gap-2">
                  <RadioGroupItem value={option} id={`doc-feedback-kind-${option}`} />
                  <Label htmlFor={`doc-feedback-kind-${option}`} className="font-normal">
                    {itemLabel(copy, KIND_ITEM[option])}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor={MESSAGE_ID}>{itemLabel(copy, "message-label")}</Label>
            <Textarea
              id={MESSAGE_ID}
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="w-full min-w-0"
            />
            <p className="text-xs text-muted-foreground">
              {fillLabel(itemLabel(copy, "message-hint"), {
                min: FEEDBACK_MESSAGE_MIN,
                max: FEEDBACK_MESSAGE_MAX,
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? itemLabel(copy, "sending") : itemLabel(copy, "submit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setPhase(null);
              }}
            >
              {itemLabel(copy, "close")}
            </Button>
          </div>
        </form>
      ) : null}

      {notice === null ? null : (
        <p
          role={notice.tone}
          data-doc-feedback-notice={notice.tone}
          className={
            notice.tone === "status"
              ? "mt-3 rounded-md border border-action/40 bg-action/5 px-3 py-2 text-sm text-foreground"
              : "mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-foreground"
          }
        >
          {fillLabel(itemLabel(copy, notice.id), notice.values)}
        </p>
      )}
    </FormSurface>
  );
}
