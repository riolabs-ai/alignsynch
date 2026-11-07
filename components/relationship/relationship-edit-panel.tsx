"use client";

// template-ancestor: components/admin/template-editor.tsx   (variation: one relationship's every editable field in a single form surface — meta, Aspects, the pin, the invitee and the invitation's window — with the cost of the change computed from real rows and shown before the save, where the editor has a save band and an answer-sheet preview)

/**
 * The relationship edit surface — #623, for the initiator and for staff on the console.
 *
 * **One component, two mount points, and the difference is only the copy and the action.** The
 * member's screen passes `publishRelationshipAction`'s sibling (`editRelationshipAction`) and the
 * dashboard's fixture; the console passes the staff action and its own fixture. Everything the
 * panel decides is a value it is handed (`RelationshipEditState`), so neither mount can grant
 * itself a field the other does not have — the authority is `lib/member/relationship-edit.ts`'s
 * ownership and rung check, not this component's props.
 *
 * **The invalidation is a step, not a toast.** The save button is disabled until a preview has run,
 * and when the preview comes back with a cost the panel renders it per seat
 * ("turning off Aspect 3 discards 2 answers from Avery") and demands a check before the write is
 * offered. That is the owner's decision on #623, and it is the reason the preview is a server call:
 * the counts come from the `opinion` rows, and a component cannot read a database (E34).
 *
 * **A count is not an answer.** The panel prints how many answers a change strands, never a value —
 * the blind rule #623 lists as non-negotiable, and the same line `lib/db/admin-relationship.ts`
 * draws for the operator's repair screen.
 *
 * **`mode` and `setting` are facts here, not controls.** They are chosen at publish and written once
 * (`db-verify` V18 refuses an `UPDATE session` that touches them), so this panel prints them with
 * the reason they are fixed. A control that the server would refuse is the "disabled button that
 * explains nothing" #533's card names as the failure to avoid.
 */
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSurface } from "@/components/ui/form-surface";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { buildTemplateRecord } from "@/lib/admin/template-draft";
import { refusalSentence, type EditOutcome, type EditPreviewOutcome } from "@/lib/member/outcomes";
import type { EditInvalidation } from "@/lib/relationship/edit";
import type { RelationshipEditState } from "@/lib/relationship/edit-view";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { useState, useTransition } from "react";

/** One Aspect while it is being edited. `id` is absent only for a row added in this edit. */
interface AspectState {
  readonly id?: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

const BLANK_ASPECT: AspectState = { prompt: "", leftValue: "", rightValue: "" };

/** The payload both calls take — one shape, so the preview and the save cannot disagree. */
export interface RelationshipEditPayload {
  relationshipId?: string;
  instanceRecordId?: string;
  record?: unknown;
  versionId?: string | null;
  counterpartyName?: string;
  counterpartyEmail?: string;
  inviteDays?: number;
  reason?: string;
  confirm?: boolean;
}

export function RelationshipEditPanel({
  copy,
  state,
  instanceRecordId,
  onPreview,
  onEdit,
}: {
  copy: PageCopy;
  state: RelationshipEditState;
  /**
   * The console's id, when this is the staff mount. The console's URL names a *session* record and
   * the member's names the relationship; the panel passes whichever its page was given rather than
   * translating ids it does not own.
   */
  instanceRecordId?: string;
  onPreview: (payload: RelationshipEditPayload) => Promise<EditPreviewOutcome>;
  onEdit: (payload: RelationshipEditPayload) => Promise<EditOutcome>;
}) {
  const editCopy = sectionOf(copy, "edit");

  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(state.title);
  const [summary, setSummary] = useState(state.summary);
  const [aspects, setAspects] = useState<AspectState[]>(
    state.aspects.map((aspect) => ({ ...aspect })),
  );
  const [versionId, setVersionId] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState(state.invite?.name ?? "");
  const [counterpartyEmail, setCounterpartyEmail] = useState(state.invite?.email ?? "");
  const [inviteDays, setInviteDays] = useState<string>(
    state.invite === null ? "" : String(state.invite.daysLeft),
  );
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<EditPreviewOutcome | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<EditOutcome | null>(null);

  const claimed = state.invite?.claimed === true;

  function patchAspect(index: number, patch: Partial<AspectState>): void {
    setAspects((current) =>
      current.map((aspect, at) => (at === index ? { ...aspect, ...patch } : aspect)),
    );
  }

  function payload(confirm: boolean): RelationshipEditPayload {
    return {
      ...(instanceRecordId === undefined
        ? { relationshipId: state.relationshipId }
        : { instanceRecordId }),
      record: buildTemplateRecord({
        id: state.record.id,
        slug: state.record.slug,
        title,
        summary,
        status: state.record.status,
        date: state.record.date,
        aspects,
      }),
      versionId,
      ...(claimed ? {} : { counterpartyName, counterpartyEmail }),
      ...(claimed || inviteDays.trim() === "" ? {} : { inviteDays: Number(inviteDays) }),
      reason,
      ...(confirm ? { confirm: true } : {}),
    };
  }

  /** Ask the server what this edit costs. Nothing is written by this call. */
  function askCost(): void {
    setPreview(null);
    setOutcome(null);
    setConfirmed(false);
    startTransition(async () => {
      const answer = await onPreview(payload(false));
      setPreview(answer);
    });
  }

  function save(): void {
    setOutcome(null);
    startTransition(async () => {
      const answer = await onEdit(payload(true));
      setOutcome(answer);
      if (answer.ok) setPreview(null);
    });
  }

  const costs = preview?.ok === true ? preview.invalidations : [];
  const blocked = preview?.ok === true ? preview.blocked : null;
  const canSave =
    preview !== null &&
    preview.ok === true &&
    blocked === null &&
    (costs.length === 0 || confirmed);

  const previewRefusal =
    preview !== null && !preview.ok
      ? refusalSentence(preview.code, preview.message, (id) => {
          const known = (editCopy.items ?? []).find((item) => item.id === id);
          return known?.label ?? null;
        })
      : null;
  const saveRefusal =
    outcome !== null && !outcome.ok
      ? refusalSentence(outcome.code, outcome.message, (id) => {
          const known = (editCopy.items ?? []).find((item) => item.id === id);
          return known?.label ?? null;
        })
      : null;

  return (
    <FormSurface data-relationship-edit>
      <CardHeader>
        <CardTitle>{editCopy.heading}</CardTitle>
        <CardDescription>{sectionBody(editCopy)}</CardDescription>
      </CardHeader>
      <div className="space-y-4 p-6 pt-0">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-title">{itemLabel(editCopy, "title")}</Label>
          <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-summary">{itemLabel(editCopy, "summary")}</Label>
          <Textarea
            id="edit-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>

        {/* The two settings, printed with the reason they are not controls. */}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{itemLabel(editCopy, "mode")}</dt>
            <dd data-relationship-mode={state.mode}>
              {itemLabel(editCopy, state.mode === "advanced" ? "mode-advanced" : "mode-basic")}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{itemLabel(editCopy, "setting")}</dt>
            <dd data-relationship-setting={state.setting}>
              {itemLabel(editCopy, state.setting === "full" ? "setting-full" : "setting-soft")}
            </dd>
          </div>
        </dl>
        {state.sessionExists ? (
          <p data-edit-locked className="text-sm text-muted-foreground">
            {itemLabel(editCopy, "locked-mode")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{itemLabel(editCopy, "mode-help")}</p>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium">{itemLabel(editCopy, "aspects")}</p>
          <ul data-edit-aspects className="space-y-3">
            {aspects.map((aspect, index) => (
              <li key={aspect.id ?? `new-${index}`} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`edit-prompt-${index}`}>{itemLabel(editCopy, "prompt")}</Label>
                  <Input
                    id={`edit-prompt-${index}`}
                    value={aspect.prompt}
                    onChange={(event) => patchAspect(index, { prompt: event.target.value })}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`edit-left-${index}`}>{itemLabel(editCopy, "left")}</Label>
                    <Input
                      id={`edit-left-${index}`}
                      value={aspect.leftValue}
                      onChange={(event) => patchAspect(index, { leftValue: event.target.value })}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`edit-right-${index}`}>{itemLabel(editCopy, "right")}</Label>
                    <Input
                      id={`edit-right-${index}`}
                      value={aspect.rightValue}
                      onChange={(event) => patchAspect(index, { rightValue: event.target.value })}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setAspects((current) => current.filter((_, at) => at !== index))}
                >
                  {itemLabel(editCopy, "remove")}
                </Button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            onClick={() => setAspects((current) => [...current, BLANK_ASPECT])}
          >
            {itemLabel(editCopy, "add")}
          </Button>
        </div>

        {state.versions.length > 1 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-pin">{itemLabel(editCopy, "pin")}</Label>
            <select
              id="edit-pin"
              className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
              value={versionId ?? ""}
              onChange={(event) =>
                setVersionId(event.target.value === "" ? null : event.target.value)
              }
            >
              <option value="">{itemLabel(editCopy, "pin-current")}</option>
              {state.versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {fillLabel(itemLabel(editCopy, "pin-option"), {
                    version: version.version,
                    instant: version.publishedAt,
                  })}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{itemLabel(editCopy, "pin-help")}</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-invitee">{itemLabel(editCopy, "invitee")}</Label>
            <Input
              id="edit-invitee"
              value={counterpartyName}
              disabled={claimed}
              onChange={(event) => setCounterpartyName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-invitee-email">{itemLabel(editCopy, "invitee-email")}</Label>
            <Input
              id="edit-invitee-email"
              value={counterpartyEmail}
              disabled={claimed}
              onChange={(event) => setCounterpartyEmail(event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-window">{itemLabel(editCopy, "window")}</Label>
          <Input
            id="edit-window"
            value={inviteDays}
            disabled={claimed}
            onChange={(event) => setInviteDays(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            {claimed ? itemLabel(editCopy, "claimed") : itemLabel(editCopy, "window-help")}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-reason">{itemLabel(editCopy, "reason")}</Label>
          <Input
            id="edit-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={askCost} disabled={pending}>
            {pending && preview === null
              ? itemLabel(editCopy, "previewing")
              : itemLabel(editCopy, "preview")}
          </Button>
          <Button type="button" onClick={save} disabled={pending || !canSave}>
            {pending && preview !== null
              ? itemLabel(editCopy, "saving")
              : itemLabel(editCopy, "save")}
          </Button>
          {outcome?.ok === true ? (
            <p data-relationship-edited={outcome.actionId} className="text-sm">
              {fillLabel(itemLabel(editCopy, "saved"), {
                version: outcome.version ?? 0,
                discarded: outcome.discardedAnswers,
                actionId: outcome.actionId,
              })}
            </p>
          ) : null}
          {previewRefusal === null ? null : (
            <p
              data-edit-preview-refusal={preview?.ok === false ? preview.code : ""}
              className="text-sm"
            >
              {previewRefusal}
            </p>
          )}
          {saveRefusal === null ? null : (
            <p data-edit-refusal={outcome?.ok === false ? outcome.code : ""} className="text-sm">
              {saveRefusal}
            </p>
          )}
        </div>

        {blocked === null ? null : (
          <p
            data-edit-blocked={blocked.code}
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            {itemLabel(
              editCopy,
              blocked.code === "answers-sealed" ? "blocked-adds" : "blocked-mode",
            )}
          </p>
        )}

        {costs.length === 0 ? null : (
          <div data-edit-costs className="space-y-2 rounded-md border p-3">
            <p className="text-sm font-medium">{itemLabel(editCopy, "cost-heading")}</p>
            <ul className="space-y-1 text-sm">
              {costs.map((cost) => (
                <li key={`${cost.code}:${cost.aspectId ?? cost.from ?? ""}`}>
                  {costSentence(cost, editCopy)}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {itemLabel(editCopy, "confirm")}
            </label>
          </div>
        )}
      </div>
    </FormSurface>
  );
}

/** The clause per invalidation code, out of the fixture — never a sentence typed in a component. */
function clauseOf(code: EditInvalidation["code"], section: PageCopySection): string {
  if (code === "discards-answers") return itemLabel(section, "cost-discards");
  if (code === "rewrites-question") return itemLabel(section, "cost-rewrites");
  if (code === "adds-question") return itemLabel(section, "cost-adds");
  if (code === "changes-mode") return itemLabel(section, "cost-mode");
  return itemLabel(section, "cost-setting");
}

/**
 * One cost row: a sentence per seat when answers are at stake, the bare clause otherwise.
 *
 * The fills are the owner's own sentence shape — "turning off Aspect 3 discards 2 answers from
 * <name>" — with the Aspect's words and the seat's name substituted. The count is all that is
 * printed about the other party's answers; never a value.
 */
function costSentence(cost: EditInvalidation, section: PageCopySection): string {
  const clause = clauseOf(cost.code, section);
  if (cost.seats.length === 0) return clause;
  return cost.seats
    .map((seat) =>
      fillLabel(clause, {
        aspect: cost.prompt ?? cost.aspectId ?? "",
        answers: seat.answers,
        name: seat.name,
      }),
    )
    .join(" ");
}
