/**
 * `/assessment/instances` — the list of instances the signed-in account is a party to (#213).
 *
 * A server component with no state and no handler: the page above it resolved the session and
 * read the rows, and this file decides only how a row reads. The words are
 * `data/pages/assessment-instances.ts` (E23); this file holds none of them.
 *
 * **What a row may say is decided before it gets here.** `MyInstance.state` is one of three
 * values from `lib/flow/state.ts`, and the third (`awaiting-other`) is the blind rule made
 * visible: the row says who is still to answer and nothing about what they have, so there is no
 * prop on this component that could draw a score, a count or a Gap. The instance screen is one
 * click away and is the only surface that draws any of those, and only once both parties have
 * submitted.
 *
 * **The marker (#252) is a second derived value, not a second sentence about the answers.**
 * `MyInstance.unlock` is `unseen` only when the row is already `complete` and this party has not
 * opened it since; the component draws the fixture's one line for it and nothing else. It is
 * rendered on the row rather than in the header, as a toast or as a badge count, because the
 * event belongs to one instance and to one person — the other party's row is unaffected (their
 * own `unlock_seen_at` decides it), and this file never sees a timestamp.
 *
 * **Which party is "you" is the session's, not the row's.** Both parties read the same two
 * names; the badge on one of them comes from `viewerRole`, which the read resolved from
 * `party.user_id`. The list is per-account, so the same instance renders as two different rows to
 * two different people — and neither of them sees a row belonging to anybody else.
 *
 * The failure state is a panel, not a digest: a list a reader opens to find their way back is the
 * last surface that should answer with Next's 500, so when the database does not answer the page
 * hands down the layer's own sentence and this draws it beside a link that reads the list again.
 */
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import type { MyInstance } from "@/lib/db/my-instances";
import type { OverviewFilter } from "@/lib/flow/overview";
import { MY_INSTANCES_PATH, instancePath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const CARD = "rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const STRONG = "font-semibold text-gray-900 dark:text-gray-100";

export function MyInstances({
  copy,
  instances,
  unreadable,
  filter = null,
}: {
  copy: PageCopy;
  instances: readonly MyInstance[];
  /** The database layer's sentence when the read did not answer; `null` when it did. */
  unreadable: string | null;
  /**
   * The one list the reader came here for, when they arrived from a console card (Console 2/5).
   *
   * `null` is the unfiltered list, which is what this route has always drawn. The page resolves
   * `?filter=` through `overviewFilterOf()` and passes the rows already filtered by
   * `matchesOverviewFilter()` — the same predicate the Overview counted with — so the length of
   * this list and the figure on the card are arithmetic over one array
   * (`lib/flow/overview.ts`). This component holds no filter of its own: it is handed the rows and
   * the id, and all it decides is which sentence to draw.
   */
  filter?: OverviewFilter | null;
}) {
  if (unreadable !== null) {
    const failure = sectionOf(copy, "unreadable");
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div
          data-my-instances-unreadable="true"
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failure.heading}</h1>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{sectionBody(failure)}</p>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{unreadable}</p>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            <a className="underline" href={MY_INSTANCES_PATH}>
              {itemLabel(failure, "reload")}
            </a>
          </p>
        </div>
      </div>
    );
  }

  const list = sectionOf(copy, "list");
  const row = sectionOf(copy, "row");
  const states = sectionOf(copy, "state");
  const marker = sectionOf(copy, "marker");
  const empty = sectionOf(copy, "empty");
  const filters = sectionOf(copy, "filter");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : <p className={`mt-3 ${MUTED}`}>{copy.subtitle}</p>}
      </header>

      {/* The console's card sends the reader here with one list in mind (Console 2/5). The band
          names it and offers the way back to every row — without it a filtered list would look
          like a list that lost somebody's relationships. */}
      {filter === null ? null : (
        <p data-my-instances-filter={filter} className={`mb-6 ${MUTED}`}>
          {itemLabel(filters, "showing")}:{" "}
          <span className={STRONG}>{itemLabel(filters, filter)}</span>{" "}
          <Link className="underline" href={MY_INSTANCES_PATH}>
            {itemLabel(filters, "show-all")}
          </Link>
        </p>
      )}

      {instances.length === 0 ? (
        filter === null ? (
          <section data-empty-state="true" className={CARD}>
            <h2 className={`text-xl ${STRONG}`}>{empty.heading}</h2>
            <p className={`mt-2 ${MUTED}`}>{sectionBody(empty)}</p>
            {empty.cta === undefined ? null : (
              <p className="mt-4">
                <Link
                  href={empty.cta.href}
                  className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
                >
                  {empty.cta.label}
                </Link>
              </p>
            )}
          </section>
        ) : (
          /**
           * A filter that keeps no rows is not the same sentence as "you are not in an assessment
           * yet": this reader has relationships, none of them in this state. Saying so, with the
           * way back to the whole list, is the difference between a filtered empty list and a page
           * that looks like it lost somebody's records.
           */
          <section data-my-instances-filter-empty={filter} className={CARD}>
            <p className={MUTED}>{itemLabel(filters, "empty")}</p>
            <p className="mt-3 text-sm">
              <Link className="underline" href={MY_INSTANCES_PATH}>
                {itemLabel(filters, "show-all")}
              </Link>
            </p>
          </section>
        )
      ) : (
        <section data-my-instances="true">
          <h2 className={`text-xl ${STRONG}`}>{list.heading}</h2>
          <p className={`mt-2 ${MUTED}`}>{sectionBody(list)}</p>

          <ul className="mt-6 space-y-4">
            {instances.map((instance) => {
              // The other party's name, or the fallback for the one row Postgres can leave
              // nameless (Counterparty row and invitation both gone — drift, not a state).
              const other = instance.otherName ?? itemLabel(row, "unnamed-party");
              const initiatorName =
                instance.viewerRole === "initiator" ? instance.viewerName : other;
              const counterpartyName =
                instance.viewerRole === "counterparty" ? instance.viewerName : other;

              return (
                <li
                  key={instance.instanceRecordId}
                  data-instance={instance.instanceRecordId}
                  data-instance-state={instance.state}
                  data-instance-unlock={instance.unlock}
                  className={CARD}
                >
                  <h3 className={`text-base ${STRONG}`}>{instance.templateTitle}</h3>

                  <dl className="mt-3 grid gap-1 sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className={MUTED}>{itemLabel(row, "initiator")}</dt>
                      <dd className="text-sm text-gray-800 dark:text-gray-100">
                        {initiatorName}
                        {instance.viewerRole === "initiator" ? (
                          <span className="ml-2 rounded bg-gray-100 px-1 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {itemLabel(row, "you")}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className={MUTED}>{itemLabel(row, "counterparty")}</dt>
                      <dd className="text-sm text-gray-800 dark:text-gray-100">
                        {counterpartyName}
                        {instance.viewerRole === "counterparty" ? (
                          <span className="ml-2 rounded bg-gray-100 px-1 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {itemLabel(row, "you")}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  </dl>

                  <p className={`mt-3 ${MUTED}`}>
                    {fillLabel(itemLabel(states, instance.state), { name: other })}
                  </p>

                  {/* The marker (#252): a quiet line on the row, never a toast, a modal or a
                      count in the header. It says the instance moved while this reader was
                      away — the one fact the state sentence above cannot carry, because it is
                      true of the same `complete` row either way. */}
                  {instance.unlock === "unseen" ? (
                    <p
                      data-instance-marker="unseen"
                      className="mt-2 rounded border border-action/40 bg-action/5 px-2 py-1 text-sm font-medium text-action"
                    >
                      {itemLabel(marker, "unseen")}
                    </p>
                  ) : null}

                  <p className="mt-2 text-sm">
                    <Link className="underline" href={instancePath(instance.instanceRecordId)}>
                      {itemLabel(row, "open")}
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
