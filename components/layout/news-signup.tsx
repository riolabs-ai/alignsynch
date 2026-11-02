"use client";
// template-ancestor: components/home/newsletter-section.tsx   (variation: the same centred band — icon, heading, one line, one field — carried into the footer as a bordered panel instead of a full-bleed overlay, and posting to a route handler instead of a client store)

/**
 * The footer's news signup — one field, one button, and one sentence at a time.
 *
 * **Why this is a client component and not a server action.** `components/layout/footer.tsx`
 * has no `"use client"`, but two client pages mount it (`components/categories/categories-page.tsx`
 * and `components/tournaments/tournament-page.tsx`), so everything the footer value-imports lands
 * in a browser bundle. A server action defined beside the write would drag `lib/db/**` across that
 * boundary — exactly the 500 `data:check` E34 exists to catch — so the form posts to a route
 * handler (`app/api/news/subscribe/route.ts`) instead. Nothing in this module's import graph
 * reaches a server-only module: the state list is `lib/news/states.ts`, which imports nothing.
 *
 * **Two paths, one answer.** With JavaScript the submit stays on the page and the route's JSON
 * body becomes the sentence below the field. Without it the form's own `action` posts and the
 * route answers with a small page that says the same sentence and links back — the same write, the
 * same states, no silently different behaviour for a reader whose bundle failed to load.
 *
 * **Every word is the fixture's.** `data/pages/shell.ts`'s `footer-news` band resolves through
 * `itemLabel`/`sectionBody`; this file holds no string a reader can see (E23 keeps
 * `components/layout/**` at a budget of 0), and `state → item id` is the only mapping it owns.
 *
 * `source` is the path the person was standing on, taken from `usePathname()` and sent with the
 * submission so the row records where the signup came from. The route re-checks it: a posted path
 * that is not root-relative is stored as `/`, because that value is also what a no-JavaScript
 * submit is redirected with.
 */
import { Mail } from "lucide-react";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import type React from "react";
import type { PageCopySection } from "@/content/pages";
import { type NewsSignupState, newsSignupStateOf } from "@/lib/news/states";
import { itemLabel, sectionBody } from "@/lib/page-copy";

/** Where the form posts, and the one URL this feature has. */
export const NEWS_SIGNUP_ENDPOINT = "/api/news/subscribe";

/** The fixture item that carries each state's sentence. `idle` and `pending` have none. */
const MESSAGE_ITEM: Record<NewsSignupState, string> = {
  subscribed: "subscribed",
  duplicate: "duplicate",
  "stored-send-failed": "send-failed",
  invalid: "invalid",
  "storage-failed": "storage-failed",
};

/** The form in flight is a state of its own, so the button says what is happening. */
type FormStatus = "idle" | "pending" | NewsSignupState;

/** A state this form is willing to render — the wire value is checked, never trusted. */
function stateOf(body: unknown): NewsSignupState {
  const candidate =
    typeof body === "object" && body !== null && "state" in body
      ? (body as { state?: unknown }).state
      : undefined;
  return newsSignupStateOf(typeof candidate === "string" ? candidate : undefined);
}

export function NewsSignup({ section }: { section: PageCopySection }) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const path = usePathname() ?? "/";
  const fieldId = useId();
  const headingId = useId();
  const statusId = useId();

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus("pending");
    try {
      const response = await fetch(NEWS_SIGNUP_ENDPOINT, {
        method: "POST",
        body: data,
        headers: { accept: "application/json" },
      });
      setStatus(stateOf(await response.json()));
    } catch {
      // The request never reached the route, so nothing can be claimed about the write. The
      // storage-failed sentence is the only one that says "nothing was stored".
      setStatus("storage-failed");
    }
  }

  const message =
    status === "idle" || status === "pending" ? null : itemLabel(section, MESSAGE_ITEM[status]);

  return (
    <section
      id="news-signup"
      aria-labelledby={headingId}
      className="mt-12 rounded-2xl border border-slate-200 bg-slate-50/70 px-6 py-9 sm:px-10 dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-action/10 text-action">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 id={headingId} className="text-xl font-bold tracking-tight">
          {section.heading}
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {sectionBody(section)}
        </p>
        <div className="mt-6 w-full max-w-lg text-left">
          <form
            action={NEWS_SIGNUP_ENDPOINT}
            method="post"
            onSubmit={submit}
            noValidate
            className="flex flex-col gap-3 sm:flex-row sm:items-start"
          >
            <input type="hidden" name="source" value={path} />
            <label htmlFor={fieldId} className="sr-only">
              {itemLabel(section, "field-label")}
            </label>
            <input
              id={fieldId}
              type="email"
              name="email"
              required
              autoComplete="email"
              aria-describedby={message === null ? undefined : statusId}
              placeholder={itemLabel(section, "placeholder")}
              className="w-full flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-action focus:outline-none focus:ring-2 focus:ring-action/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={status === "pending"}
              className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {status === "pending" ? itemLabel(section, "pending") : itemLabel(section, "submit")}
            </button>
          </form>
          {/*
          One live region, and it never says "success" about a write that did not happen: the
          sentence is the route's state resolved through the fixture, so the five outcomes cannot
          drift from the five things the handler can answer.
        */}
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            className="mt-3 min-h-5 text-sm text-slate-600 dark:text-slate-400"
          >
            {message}
          </p>
        </div>
      </div>
    </section>
  );
}

/** The ids the fixture must carry for this form, for the test that holds the two together. */
export const NEWS_SIGNUP_ITEM_IDS = [
  "field-label",
  "placeholder",
  "submit",
  "pending",
  ...Object.values(MESSAGE_ITEM),
  "confirm-subject",
  "confirm-body",
  "back",
] as const;
