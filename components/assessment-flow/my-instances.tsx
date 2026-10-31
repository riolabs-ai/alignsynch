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
import { MY_INSTANCES_PATH, instancePath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const CARD = "rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const STRONG = "font-semibold text-gray-900 dark:text-gray-100";

export function MyInstances({
  copy,
  instances,
  unreadable,
}: {
  copy: PageCopy;
  instances: readonly MyInstance[];
  /** The database layer's sentence when the read did not answer; `null` when it did. */
  unreadable: string | null;
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
  const empty = sectionOf(copy, "empty");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : <p className={`mt-3 ${MUTED}`}>{copy.subtitle}</p>}
      </header>

      {instances.length === 0 ? (
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
