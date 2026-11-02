// template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: the relationship's own metadata — a name, a Mode that never moves and a Setting that moves between sessions — not the quiz's settings card)
"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  INSTANCE_NAME_MAX,
  MODE_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  ALIGNMENT_SETTINGS,
  opinionKindsFor,
  type AlignmentSetting,
} from "@/content/assessment";
import { formatDate } from "@/content/core";
import type { V1Relationship } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { useState } from "react";

/** Who is looking — the matrix's row, not a styling hint. */
export type MetaViewer = "initiator" | "counterparty" | "coach" | "admin";

/**
 * A relationship's own metadata, with the writes the §7 matrix grants — and no others.
 *
 * The matrix is short and exact, and this panel is its whole UI:
 *
 *   - **Name** — the Initiator and an admin edit it; the Counterparty and the Coach read it. The
 *     rule is `INSTANCE_NAME_MAX`, the model's own `zInstanceName`.
 *   - **Mode** — nobody edits it, the admin included. The Mode decides which Opinions the sheet
 *     asks, so a post-hoc change would invalidate answers already given; the honest move for a
 *     different Mode is a new relationship, and the panel says so instead of offering a control.
 *   - **Setting** — the Initiator and an admin move it **between sessions**; the Counterparty reads
 *     it. What moves is the verdict the report prints, never a number, a question or an answer — so
 *     the panel shows the glossary definition beside each word, and the store refuses the write while
 *     a session is open (`setRelationshipSetting`).
 *
 * The Counterparty reading rather than writing is not a disabled form: there is no control to
 * disable. What a party cannot do, they are not shown a greyed button for.
 */
export function RelationshipMetadata({ rel, viewer }: { rel: V1Relationship; viewer: MetaViewer }) {
  const store = useV1Store();
  const canEdit = viewer === "initiator" || viewer === "admin";
  const [draftName, setDraftName] = useState(rel.name ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const saveName = () => {
    const refusal = store.renameRelationship(rel.id, draftName);
    if (refusal !== null) {
      setNotice(refusal);
      setSaved(null);
      return;
    }
    setNotice(null);
    setSaved(
      draftName.trim() === ""
        ? "Name cleared — the template's title is the display name again."
        : "Name saved.",
    );
  };

  const moveSetting = (next: AlignmentSetting) => {
    const refusal = store.setRelationshipSetting(rel.id, next);
    if (refusal !== null) {
      setNotice(refusal);
      setSaved(null);
      return;
    }
    setNotice(null);
    setSaved(
      `Setting moved to ${SETTING_LABELS[next]} — the Gaps are the same numbers, and the report's verdict is re-read against the new bar.`,
    );
  };

  const sessionOpen = rel.initiatorSubmitted || rel.counterpartySubmitted;
  const sessionComplete = rel.initiatorAccepted && rel.counterpartyAccepted;
  const settingLocked = sessionOpen && !sessionComplete;

  return (
    <section
      aria-labelledby="relationship-metadata-heading"
      className="rounded-lg border border-border bg-card p-4"
      data-metadata-panel="true"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="relationship-metadata-heading" className="text-sm font-semibold text-foreground">
          Relationship settings
        </h2>
        <p className="text-xs text-muted-foreground">Created {formatDate(rel.createdAt)}</p>
      </div>

      <dl className="mt-3 space-y-3">
        {/* Name — editable by the Initiator and an admin. */}
        <div>
          <dt className="text-sm text-muted-foreground">
            <Label htmlFor={`rel-name-${rel.id}`}>Name</Label>
          </dt>
          <dd className="mt-1">
            {canEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`rel-name-${rel.id}`}
                  value={draftName}
                  maxLength={INSTANCE_NAME_MAX}
                  onChange={(event) => {
                    setDraftName(event.target.value);
                    setSaved(null);
                  }}
                  placeholder="Leave empty to use the template's title"
                  className="h-11 max-w-sm"
                  data-metadata-name-input={rel.id}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveName}
                  data-metadata-name-save={rel.id}
                >
                  Save name
                </Button>
                <span className="text-xs text-muted-foreground">
                  {draftName.trim().length}/{INSTANCE_NAME_MAX}
                </span>
              </div>
            ) : (
              <p className="text-sm text-foreground" data-metadata-name-read={rel.id}>
                {rel.name ?? "—"}
              </p>
            )}
          </dd>
        </div>

        {/* Mode — read-only for everyone, and it says why. */}
        <div>
          <dt className="text-sm text-muted-foreground">Mode</dt>
          <dd className="mt-1 text-sm text-foreground" data-metadata-mode={rel.mode}>
            {MODE_LABELS[rel.mode]} — {opinionKindsFor(rel.mode).length} Opinions per Aspect.{" "}
            <span className="text-muted-foreground">
              Fixed at creation, for everyone: the Mode decides which Opinions the sheet asks, so a
              later change would invalidate answers already given. A different Mode is a new
              relationship, not an edit.
            </span>
          </dd>
        </div>

        {/* Setting — movable between sessions by the Initiator and an admin. */}
        <div>
          <dt className="text-sm text-muted-foreground">Setting</dt>
          <dd className="mt-1 space-y-2">
            <p className="text-sm text-foreground" data-metadata-setting={rel.setting}>
              {SETTING_LABELS[rel.setting]} — {SETTING_DEFINITIONS[rel.setting]}
            </p>
            {canEdit ? (
              <div className="flex flex-wrap gap-2">
                {ALIGNMENT_SETTINGS.map((setting) => (
                  <button
                    key={setting}
                    type="button"
                    aria-pressed={rel.setting === setting}
                    disabled={settingLocked}
                    onClick={() => moveSetting(setting)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-xs",
                      rel.setting === setting
                        ? "border-action bg-action/10 text-foreground"
                        : "border-border bg-card text-foreground hover:bg-muted",
                      settingLocked && "cursor-not-allowed opacity-60",
                    )}
                    data-metadata-setting-option={setting}
                  >
                    <span className="block text-sm font-medium">{SETTING_LABELS[setting]}</span>
                    <span className="block text-muted-foreground">
                      {SETTING_DEFINITIONS[setting]}
                    </span>
                  </button>
                ))}
                <p className="w-full text-xs text-muted-foreground">
                  {settingLocked
                    ? "A session is open — the Setting moves between sessions, so the bar cannot change under an answer already given."
                    : "A Setting changes no question and no number. It moves the bar the report's verdict is judged against — and it is the counterparty's read-only fact, never their setting to move."}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Only the initiator or an admin can move the Setting. It changes no answer and no
                question — it moves the bar the report's verdict is judged against.
              </p>
            )}
          </dd>
        </div>
      </dl>

      {notice !== null && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700"
          data-metadata-notice="refused"
        >
          {notice}
        </p>
      )}
      {saved !== null && (
        <p
          className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
          data-metadata-notice="saved"
        >
          {saved}
        </p>
      )}
    </section>
  );
}
