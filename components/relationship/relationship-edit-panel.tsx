"use client";

// template-ancestor: components/admin/template-editor.tsx   (variation: one relationship's every editable field in a single form surface — meta, the pin, the invitee and the invitation's window — with the cost of the change computed from real rows and shown before the save, where the editor has a save band and an answer-sheet preview)

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
 *
 * **The Aspects are not on this surface, and that is #935.** The detail screen already draws them
 * through `AspectList` (`components/assessment-flow/aspect-list.tsx`) — rows, a pointer drag that
 * reorders them, an in-place editor and its own save — so a second, always-open stack of forms here
 * printed the same five questions twice and offered two different writers for one fact. The owner
 * read that off the running screen and asked for the drag list to be kept and the stacked forms
 * removed. So this panel carries **no aspect state**: `payload()` rebuilds the record from
 * `state.aspects`, the rows the page read, which makes the write a no-op for them instead of an
 * overwrite by an array this surface can no longer show anyone.
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
  variant = "page",
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
  /**
   * #795 — **which column this panel is drawn in.** `page` (the default, and what the console's
   * staff mount keeps) is the shipped form: a `text-2xl` `CardTitle` and two-column field rows.
   * `panel` is the member detail screen's 320 px actions rail, where the artifact
   * (`docs/mockups/one-card-one-detail-v2.html` §5) draws every working panel at the shell's
   * `text-base` heading and a 24 px title would be the size that makes two pages read as two
   * products. The field rows collapse to one column for the same reason: `sm:` reads the viewport,
   * not this rail, so two 130 px inputs is what `sm:grid-cols-2` would produce here.
   *
   * It is a variant rather than a second panel because the authority, the fields and the actions are
   * identical on both mounts — the console is not a different surface, it is the same one in a
   * wider column.
   */
  variant?: "page" | "panel";
  onPreview: (payload: RelationshipEditPayload) => Promise<EditPreviewOutcome>;
  onEdit: (payload: RelationshipEditPayload) => Promise<EditOutcome>;
}) {
  const editCopy = sectionOf(copy, "edit");
  const rail = variant === "panel";

  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(state.title);
  const [summary, setSummary] = useState(state.summary);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [counterpartyName, setCounterpartyName] = useState(state.invite?.name ?? "");
  const [counterpartyEmail, setCounterpartyEmail] = useState(state.invite?.email ?? "");
  const [inviteDays, setInviteDays] = useState<string>(
    state.invite === null ? "" : String(state.invite.daysLeft),
  );
  const [preview, setPreview] = useState<EditPreviewOutcome | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<EditOutcome | null>(null);

  const claimed = state.invite?.claimed === true;
  /**
   * The version this relationship is bound to — the fact #711's revision flow protects.
   *
   * `state.versions` marks the bound row with `current`, so this is a read of the same list the pin
   * control draws, not a second derivation. `state.versionId` is the writer's view of it; the list
   * is what the reader sees, and they agree because both come from `readVersions()` in one read.
   */
  const boundVersion = state.versions.find((version) => version.current);

  /**
   * The record the edit posts — and the Aspects in it are the ones the page read, never a copy this
   * panel can edit (#935). `state.aspects` is the row set the detail's `AspectList` shows; posting
   * anything else here would be a second writer for one fact, and posting nothing (`items: []`)
   * would delete every Aspect on a title change. So the list travels exactly as read: the server's
   * arithmetic sees no move, and the Aspect save stays where the drag is.
   */
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
        aspects: state.aspects,
      }),
      versionId,
      ...(claimed ? {} : { counterpartyName, counterpartyEmail }),
      ...(claimed || inviteDays.trim() === "" ? {} : { inviteDays: Number(inviteDays) }),
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
      {rail ? (
        <div className="space-y-2 p-6 pb-0">
          <h2 className="text-base font-semibold text-foreground">{editCopy.heading}</h2>
          <p className="text-sm text-muted-foreground">{sectionBody(editCopy)}</p>
        </div>
      ) : (
        <CardHeader>
          <CardTitle>{editCopy.heading}</CardTitle>
          <CardDescription>{sectionBody(editCopy)}</CardDescription>
        </CardHeader>
      )}
      <div className={rail ? "space-y-4 p-6" : "space-y-4 p-6 pt-0"}>
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
        <dl className={rail ? "grid gap-2 text-sm" : "grid gap-2 text-sm sm:grid-cols-2"}>
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
        {/*
          #711 — which version this relationship was answered under. It is printed whether or not
          the pin control is drawn (that control needs two versions to be worth a select), because
          the sentence is the whole protection the revision flow offers: publishing N+1 leaves this
          number alone, and a reader who cannot see the number has to take that on trust.
        */}
        <p
          data-relationship-version={
            boundVersion === undefined ? "none" : String(boundVersion.version)
          }
          className="text-sm text-muted-foreground"
        >
          {boundVersion === undefined
            ? itemLabel(editCopy, "version-none")
            : fillLabel(itemLabel(editCopy, "version"), { version: boundVersion.version })}
        </p>
        {state.sessionExists ? (
          <p data-edit-locked className="text-sm text-muted-foreground">
            {itemLabel(editCopy, "locked-mode")}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{itemLabel(editCopy, "mode-help")}</p>
        )}

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

        <div className={rail ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
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
