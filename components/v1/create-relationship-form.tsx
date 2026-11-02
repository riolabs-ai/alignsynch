// template-ancestor: components/create/quiz-editor.tsx   (variation: the create entry — Mode, Setting and a counterparty seat, four fields and no question editor, because the Aspects come from the template)
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ASSESSMENT_MODES,
  INSTANCE_NAME_MAX,
  MODE_LABELS,
  OPINION_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
  ALIGNMENT_SETTINGS,
  opinionKindsFor,
  type AlignmentSetting,
  type AssessmentMode,
} from "@/content/assessment";
import { formatCurrency } from "@/content/core";
import {
  RELATIONSHIP_PRICE_CENTS,
  REALM_GROUP,
  type RelationshipType,
} from "@/data/v1/relationship-types";
import { PERSONA_META } from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

/**
 * `/v1/templates/[type]/create` — the one form that turns a template into a relationship (#404 §6).
 *
 * Six decisions, in the order a person makes them, and only two are required:
 *
 *   1. **Template** — fixed by the route segment, and printed rather than picked.
 *   2. **Name** — optional, ≤ `INSTANCE_NAME_MAX`; absent means the template's title is the name.
 *   3. **You** — printed, not edited: the Initiator is the persona you are signed in as.
 *   4. **Who you are asking** — an optional name for the counterparty's **seat**. It is display only:
 *      the seat is filled when they claim the invitation, because the blind rule waits for their own
 *      submission and a name typed by someone else is not a party.
 *   5. **Mode** — Basic or Advanced, **fixed at creation**. Submit stays disabled until it is chosen.
 *   6. **Setting** — Soft or Full, with the glossary definition beside each word, because it is the
 *      bar this relationship's report will be judged against.
 *
 * The two required choices start empty on purpose: a default would be this form deciding a bar for
 * two people who never saw the question. Nothing else is required to create — payment is the shop's
 * checkout and the invite is sent from the relationship page, so this screen never asks for a card
 * and never sends a link.
 *
 * Validation mirrors the model, never looser: the name is trimmed and capped at the schema's own
 * limit, and Mode/Setting are the two zod enums' values.
 *
 * **Why "your name" is not a field.** In this prototype the persona *is* the session: every
 * `/v1/<persona>/relationships/<id>` page is gated by `relationshipsVisibleTo()` on that persona's
 * own name (`lib/v1/persona.ts`), and the Initiator's gate matches
 * `PERSONA_META.initiator.name`. A name typed here that differs from the persona would therefore
 * create a relationship with no page its creator could open. So the row's initiator is always the
 * persona — `createRelationshipFromType` takes no name at all — and this screen shows it rather
 * than offering a rename it could not honour.
 */
export function CreateRelationshipForm({ type }: { type: RelationshipType }) {
  const { createRelationshipFromType, setPersona } = useV1Store();
  const router = useRouter();
  const [name, setName] = useState("");
  const [inviteeName, setInviteeName] = useState("");
  const [mode, setMode] = useState<AssessmentMode | null>(null);
  const [setting, setSetting] = useState<AlignmentSetting | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ready = mode !== null && setting !== null && !submitting;

  const submit = () => {
    if (mode === null || setting === null) return;
    setSubmitting(true);
    // The persona is the session in this prototype: starting a relationship is being its Initiator,
    // so the detail page the form hands off to renders the Initiator's view of what was just made.
    setPersona("initiator");
    const rel = createRelationshipFromType(type, {
      name: name.trim() === "" ? undefined : name.trim(),
      inviteeName: inviteeName.trim() === "" ? undefined : inviteeName.trim(),
      mode,
      setting,
    });
    router.push(`/v1/initiator/relationships/${rel.id}`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-3 text-xs">
        <Link href="/v1/templates" className="font-medium text-action hover:underline">
          ← Relationship types
        </Link>
        <Link href={`/v1/templates/${type.id}`} className="font-medium text-action hover:underline">
          ← {type.name} template
        </Link>
      </nav>

      <div>
        <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Create a relationship</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          From the {type.name} template · {type.realm} ({REALM_GROUP[type.realm]}) ·{" "}
          {type.aspects.length} Aspects. The Aspects are the template&apos;s own — nothing here
          edits them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Who and what</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="rel-name">Name this relationship (optional)</Label>
            <Input
              id="rel-name"
              value={name}
              maxLength={INSTANCE_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              placeholder={type.name}
              data-create-field="name"
            />
            <p className="text-xs text-muted-foreground">
              {name.trim().length}/{INSTANCE_NAME_MAX} — leave it empty and the template&apos;s
              title is the name.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">You ({type.roles.initiator})</p>
              <p className="text-sm text-foreground" data-create-field="initiatorName">
                {PERSONA_META.initiator.name}
              </p>
              <p className="text-xs text-muted-foreground">
                The persona you are signed in as is the Initiator of this relationship — your
                dashboard is where it will appear.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rel-invitee">Who you are asking (optional)</Label>
              <Input
                id="rel-invitee"
                value={inviteeName}
                onChange={(event) => setInviteeName(event.target.value)}
                placeholder={type.roles.counterparty}
                data-create-field="inviteeName"
              />
              <p className="text-xs text-muted-foreground">
                A name for the seat, nothing more. They join by link from the relationship page and
                claim it themselves — this form sends nothing and asks for no email.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mode — chosen once, never changed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            The Mode is the whole play, for both parties: it decides which Opinions every Aspect
            asks.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ASSESSMENT_MODES.map((option) => {
              const kinds = opinionKindsFor(option)
                .map((kind) => OPINION_LABELS[kind])
                .join(", ");
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={mode === option}
                  onClick={() => setMode(option)}
                  className={cn(
                    "rounded-md border px-3 py-3 text-left",
                    mode === option
                      ? "border-action bg-action/10"
                      : "border-border bg-card hover:bg-muted",
                  )}
                  data-create-mode={option}
                >
                  <span className="block text-sm font-medium text-foreground">
                    {MODE_LABELS[option]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {kinds} on every Aspect
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Setting — the bar the report is judged against
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            A Setting asks no extra question: it is the tolerance over the Gaps, and it can move
            between sessions. The counterparty never moves it.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ALIGNMENT_SETTINGS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={setting === option}
                onClick={() => setSetting(option)}
                className={cn(
                  "rounded-md border px-3 py-3 text-left",
                  setting === option
                    ? "border-action bg-action/10"
                    : "border-border bg-card hover:bg-muted",
                )}
                data-create-setting={option}
              >
                <span className="block text-sm font-medium text-foreground">
                  {SETTING_LABELS[option]}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {SETTING_DEFINITIONS[option]}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          One relationship costs {formatCurrency(RELATIONSHIP_PRICE_CENTS)}. You pay; the other
          person joins by link and pays nothing. This starts the relationship unsubscribed —
          subscribing is the shop&apos;s checkout, which you can reach from the relationship
          afterwards.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="h-11"
            data-create-submit="true"
          >
            Create relationship
          </Button>
          <p className="text-xs text-muted-foreground" data-create-ready={ready ? "true" : "false"}>
            {mode === null || setting === null
              ? "Choose a Mode and a Setting to continue — neither has a default."
              : `Creates an ${MODE_LABELS[mode]} relationship under the ${SETTING_LABELS[setting]} Setting.`}
          </p>
        </div>
      </div>
    </div>
  );
}
