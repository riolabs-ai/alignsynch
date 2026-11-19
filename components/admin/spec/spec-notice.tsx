// template-ancestor: components/admin/permissions/permissions-console.tsx   (variation: the failure panel is a whole page rather than a band above a table — one sentence of what is missing, the file's path, the reason it could not be read, and the two doors out, all inside the reader's frame)
/**
 * The honest panel — what `/admin/spec*` draws when the register cannot be read (s04b, AS-09).
 *
 * **Two facts and no apology.** The path, so a reader knows which file to publish, and the reason,
 * so the person fixing it knows whether it is absent or malformed. Nothing is logged as an error:
 * a tree that has not been given its register yet is an expected state, not an incident, and a
 * page that shouted into the log for it would page somebody at three in the morning.
 *
 * **It answers 200.** The page's gate still ran, the reader is still who they are, and the
 * register's absence is content — a 404 here would be indistinguishable from the gate's refusal,
 * which is the one answer this surface must keep unambiguous.
 *
 * **A dead end with two doors.** The controls are the two the artifact draws, both in-app routes
 * (`/how-it-works`, `/support`): the fix is a regeneration, and the reader cannot perform it, so
 * the panel hands them the explanation and somewhere useful to go.
 *
 * Server component: no state, no handler, no clock.
 */
import Link from "next/link";

import type { PageCopy } from "@/content/pages";
import { fillLabel, pageItemOf } from "@/lib/page-copy";

/** The source file's name, printed in the sentence about how the register is produced. */
const SOURCE_FILE = "spec-scope-v2/VALIDATION.csv";

export function SpecNotice({
  copy,
  path,
  reason,
}: {
  copy: PageCopy;
  /** The register's repo-relative path, printed verbatim so the reader knows what is missing. */
  path: string;
  /** Why it could not be read — `SpecUnreadable`'s sentence. */
  reason: string | null;
}) {
  const words = (id: string) => pageItemOf(copy, id).label;

  return (
    <div
      className="space-y-3 rounded-lg border border-dashed border-input bg-card p-6"
      data-spec-notice=""
    >
      <h1 className="text-xl font-semibold">{words("notice-heading")}</h1>
      <p className="max-w-prose text-sm text-muted-foreground">{words("notice-body")}</p>
      <div className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
        <p>
          <span className="font-bold">{words("notice-source")}</span>
          <span aria-hidden="true"> </span>
          <code className="font-mono">{path}</code>
        </p>
        {reason === null ? null : (
          <p data-spec-notice-reason={reason}>
            <span className="font-bold">{words("notice-reason")}</span>
            <span aria-hidden="true"> </span>
            <span className="text-muted-foreground">{reason}</span>
          </p>
        )}
        <p className="text-muted-foreground">
          {fillLabel(words("notice-regenerate"), { file: SOURCE_FILE })}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/how-it-works"
          className="inline-flex h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          {words("notice-how-it-works")}
        </Link>
        <Link
          href="/support"
          className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover"
        >
          {words("notice-support")}
        </Link>
      </div>
    </div>
  );
}
