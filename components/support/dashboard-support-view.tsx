// template-ancestor: components/support/account-support-page.tsx   (variation: the same page for a signed-in member — the knowledge base list and the request form are mounted here instead of a pointer at /help, and the outcome band is drawn from a stored row rather than a link)

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import type { ContactState } from "@/lib/contact/validation";
import { DASHBOARD_ARTICLE_BASE } from "@/lib/flow/paths";
import type { SupportCategory } from "./category";
import { KnowledgeBase } from "./knowledge-base";
import { SupportRequestForm } from "./support-request-form";

/**
 * The one category this page draws. `KnowledgeBase` takes a `SupportCategory`, and "all" is the
 * taxonomy's own id (`data/support-categories.ts`) rather than a word a reader sees — so it is a
 * constant here, not a copy literal the fixture would have to carry.
 */
const ALL_CATEGORIES: SupportCategory = "all";

/** The confirmation the page may draw: the state the action reported, and the row it stored. */
export interface SupportOutcome {
  readonly state: ContactState;
  /** The member's own row, re-read by id and by their address. `undefined` when none matched. */
  readonly thread: { readonly id: string; readonly status: string } | undefined;
}

interface DashboardSupportViewProps {
  /** `data/pages/dashboard-support.ts`. */
  copy: PageCopy;
  /** The account's own words for the form, resolved by the route from the session. */
  name: string;
  email: string;
  /** The instant this render happened, for the form's minimum-fill rule. */
  startedAt: number;
  /** The server action the submit posts to. */
  action: (formData: FormData) => void | Promise<void>;
  /** What a submission just did, or `null` for a request that has not submitted. */
  outcome: SupportOutcome | null;
}

/**
 * `/dashboard/support`, drawn (#542 phase 1).
 *
 * **Everything on this page is a fact about this account.** The list is `publishedArticles("kb")`
 * through the same `KnowledgeBase` the public help centre renders — one catalogue, two chromes —
 * and its links are rewritten to this route's article path (`articleHrefBase`) so following an
 * entry keeps the reader inside the dashboard. The form's identity is the session's, and the
 * outcome band is the row the action stored.
 *
 * **The outcome is derived, never asserted.** A `thread` renders the `thread` band with `{id}` and
 * `{status}` filled from the row; a state with no row (the spam answer, a store that refused) falls
 * back to that state's sentence from the fixture. That is the difference between "we said it was
 * sent" and "the database has message X with status new" — the page cannot print the first as if it
 * were the second.
 *
 * **No marketing copy.** The bands explain what happens to a message the member is writing and
 * where else the answers live; they do not pitch the product, which the card forbids for a reader
 * who already has an account.
 */
export function DashboardSupportView({
  copy,
  name,
  email,
  startedAt,
  action,
  outcome,
}: DashboardSupportViewProps) {
  const knowledgeCopy = sectionOf(copy, "knowledge-base");
  const categoryCopy = sectionOf(copy, "help-categories");
  const request = sectionOf(copy, "request");
  const form = sectionOf(copy, "form");
  const states = sectionOf(copy, "states");
  const threadBand = sectionOf(copy, "thread");
  const whatHappens = sectionOf(copy, "what-happens");

  const thread = outcome?.thread;
  const state = outcome?.state;

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      {state === undefined ? null : (
        <section
          data-support-outcome={thread === undefined ? state : "thread"}
          aria-live="polite"
          className="rounded-xl border border-border bg-card p-4"
        >
          {thread === undefined ? (
            <>
              <h2 className="text-sm font-semibold">{itemLabel(states, state)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{itemBody(states, state)}</p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">
                  {fillLabel(itemLabel(threadBand, "reference"), {
                    id: thread.id.slice(0, 8),
                    status: thread.status,
                  })}
                </h2>
                <Badge variant="outline">{thread.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {fillLabel(itemBody(threadBand, "reference"), {
                  id: thread.id.slice(0, 8),
                  status: thread.status,
                })}
              </p>
            </>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <KnowledgeBase
            selectedCategory={ALL_CATEGORIES}
            copy={knowledgeCopy}
            categoryCopy={categoryCopy}
            articleHrefBase={DASHBOARD_ARTICLE_BASE}
          />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{request.heading}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{sectionBody(request)}</p>
              <h3 className="text-sm font-semibold">{form.heading}</h3>
              <SupportRequestForm
                copy={form}
                name={name}
                email={email}
                startedAt={startedAt}
                action={action}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{whatHappens.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{sectionBody(whatHappens)}</p>
              <ul className="mt-4 space-y-3">
                {(whatHappens.items ?? []).map((item) => (
                  <li key={item.id}>
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.body === undefined ? null : (
                      <p className="text-sm text-muted-foreground">{item.body}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
