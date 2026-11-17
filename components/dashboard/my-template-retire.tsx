// template-ancestor: components/admin/template-editor.tsx   (variation: the same retire band mounted on the template's own page rather than inside the editor — the band, its dialog and its three writes are that file's; what is local is the state machine and the delete-on-success navigation to the list, because this page has no editor around the band to hand the outcome to)
"use client";

/**
 * The retire band on a My Template's own page (#1130) — the same three writes #1109 shipped.
 *
 * **The band is the editor's, not a second one.** The markup, the dialog and the three sentences are
 * `RetireBand` in `components/admin/template-editor.tsx` — the member's editor and this page draw one
 * band over one pair of server actions, so a change to the words or the controls cannot land on one
 * screen and miss the other. What this file owns is the state machine around it: which write is in
 * flight, what it answered, and where a successful delete goes.
 *
 * **The destroy control is offered only where it could succeed.** `deleteMyTemplate()` refuses a
 * template any relationship was created from, so `usedCount > 0` passes no `onDelete` at all and the
 * band's own sentence says why. The published case cannot be decided from this read, so the control
 * stays available there and the store answers `template-published` — the refusal is the rule, and the
 * band prints the store's sentence when it comes back.
 *
 * **A delete leaves the page.** The row this screen reads no longer exists after it, so a refresh
 * would be a 404; the list is where the person goes, which is what the editor does on the same answer.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { RetireBand } from "@/components/admin/template-editor";
import type { PublishStatus } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type {
  TemplateVersionFormPayload,
  TemplateVersionOutcome,
} from "@/lib/admin/template-draft";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

type RetireKind = "archive" | "restore" | "delete";

export function MyTemplateRetire({
  copy,
  title,
  status,
  templateId,
  usedCount,
  deleteHref,
  onArchive,
  onRestore,
  onDelete,
}: {
  copy: PageCopy;
  title: string;
  status: PublishStatus;
  templateId: string;
  usedCount: number;
  deleteHref: string;
  onArchive: (payload: TemplateVersionFormPayload) => Promise<TemplateVersionOutcome>;
  onRestore: (payload: TemplateVersionFormPayload) => Promise<TemplateVersionOutcome>;
  onDelete: (payload: TemplateVersionFormPayload) => Promise<TemplateVersionOutcome>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{
    readonly kind: RetireKind;
    readonly answer: TemplateVersionOutcome;
  } | null>(null);

  /**
   * One of the three writes. The payload is the id and nothing else: these are facts about the row,
   * not about a form, so nothing typed elsewhere on the page can be swept into a retire.
   */
  function retire(
    kind: RetireKind,
    write: ((payload: TemplateVersionFormPayload) => Promise<TemplateVersionOutcome>) | undefined,
  ): void {
    if (write === undefined) return;
    setOutcome(null);
    startTransition(async () => {
      const answer = await write({ templateId });
      setOutcome({ kind, answer });
      if (!answer.ok) return;
      if (kind === "delete") router.push(deleteHref);
      else router.refresh();
    });
  }

  const publishCopy = sectionOf(copy, "publish");
  const refusals = sectionOf(copy, "refusals");

  const notice =
    outcome === null || !outcome.answer.ok
      ? null
      : fillLabel(
          itemLabel(
            publishCopy,
            outcome.kind === "archive"
              ? "archived"
              : outcome.kind === "restore"
                ? "restored"
                : "deleted",
          ),
          { actionId: outcome.answer.actionId },
        );

  const answer = outcome?.answer ?? null;
  const refusal =
    answer === null || answer.ok
      ? null
      : ((refusals.items ?? []).find((item) => item.id === answer.code)?.label ??
        itemLabel(refusals, "failed"));

  return (
    <div className="space-y-2">
      <RetireBand
        copy={publishCopy}
        title={title}
        status={status}
        pending={pending}
        outcome={outcome}
        notice={notice}
        refusal={refusal}
        onArchive={onArchive}
        onRestore={onRestore}
        /* A used template is archive-only: passing no writer disables the control. */
        onDelete={usedCount === 0 ? onDelete : undefined}
        onRetire={retire}
      />
      {usedCount === 0 ? null : (
        <p data-template-archive-only className="text-sm text-muted-foreground">
          {fillLabel(itemLabel(sectionOf(copy, "used"), "archive-only"), {
            count: String(usedCount),
          })}
        </p>
      )}
    </div>
  );
}
