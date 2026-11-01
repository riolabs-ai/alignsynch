// template-ancestor: components/assessment-flow/instance-view.tsx
"use client";

import { formatCurrency } from "@/content/core";
import {
  MAX_RELATIONSHIP_ASPECTS,
  V1_RELATIONSHIP_PLAN,
  type V1FlowAspect,
  type V1FlowDraft,
} from "@/data/v1/fixtures";
import { useV1Store } from "@/lib/v1/store";
import { LoadingState, NotFoundState, SectionIntro } from "@/components/v1/v1-ui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

/** The invite link a counterparty is given — the same shape the relationship detail prints. */
function inviteLinkOf(inviteToken: string): string {
  return `alignsynch.com/v1/claim/${inviteToken}`;
}

/**
 * The relationship flow — name → personalize → purchase → invite, one screen at a time.
 *
 * The first three steps write through to a persisted draft (`lib/v1/store.tsx`), so an abandoned
 * flow resumes from the relationship list. The purchase step is mocked and clearly labelled: one
 * plan, one price, no charge, and the counterparty never pays. Completing purchase commits the
 * draft into a real relationship and the invite step works off that relationship.
 */
export function RelationshipFlow({ draftId }: { draftId: string }) {
  const store = useV1Store();
  const { hydrated, drafts, relationships, templates, persona } = store;
  const router = useRouter();

  const [committedId, setCommittedId] = useState<string | null>(null);
  const [justPurchased, setJustPurchased] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-8">
        <LoadingState rows={4} />
      </div>
    );
  }

  const committed =
    committedId === null ? undefined : relationships.find((rel) => rel.id === committedId);
  const draft = drafts.find((candidate) => candidate.id === draftId);

  // Once the draft is committed, the invite step renders from the relationship it became.
  if (committed !== undefined) {
    return (
      <InviteStep
        counterpartyName={committed.counterpartyDisplayName ?? committed.counterpartyName ?? ""}
        inviteLink={inviteLinkOf(committed.inviteToken ?? "")}
        copyState={copyState}
        email={email}
        emailSent={emailSent}
        onCopy={async () => {
          const link = inviteLinkOf(committed.inviteToken ?? "");
          try {
            await copyText(link);
            setCopyState("copied");
          } catch {
            setCopyState("failed");
          }
        }}
        onEmailChange={setEmail}
        onSend={() => setEmailSent(true)}
        onGo={() => router.push(`/v1/relationships/${committed.id}`)}
      />
    );
  }

  if (draft === undefined) {
    return (
      <div className="mx-auto max-w-2xl p-4 sm:p-8">
        <NotFoundState
          message="This draft has been completed or removed. The relationship is in your list."
          back="/v1/initiator/relationships"
        />
      </div>
    );
  }

  const template = templates.find((candidate) => candidate.id === draft.templateId);
  const backToTemplate = `/v1/initiator/templates/${draft.templateId}`;

  const commitAndInvite = () => {
    const rel = store.commitDraft(draft.id);
    setCommittedId(rel.id);
  };

  if (draft.step === "name") {
    return (
      <NameStep
        templateTitle={template?.title ?? "this template"}
        counterpartyName={draft.counterpartyName}
        counterpartyEmail={draft.counterpartyEmail}
        persona={persona}
        backToTemplate={backToTemplate}
        onContinue={(name, emailValue) => {
          store.updateDraft(draft.id, {
            counterpartyName: name,
            counterpartyEmail: emailValue,
            step: "personalize",
          });
        }}
      />
    );
  }

  if (draft.step === "personalize") {
    return (
      <PersonalizeStep
        draftId={draft.id}
        aspects={draft.aspects}
        onUseThese={() => store.updateDraft(draft.id, { step: "purchase" })}
        onChange={store.updateDraft}
      />
    );
  }

  // purchase — the only step with three faces: not bought, receipt, already-owned.
  return (
    <PurchaseStep
      counterpartyName={draft.counterpartyName.trim()}
      purchase={draft.purchase}
      justPurchased={justPurchased}
      onBuy={() => {
        store.updateDraft(draft.id, {
          purchase: {
            plan: V1_RELATIONSHIP_PLAN.id,
            amountCents: V1_RELATIONSHIP_PLAN.priceCents,
            purchasedAt: new Date().toISOString(),
          },
        });
        setJustPurchased(true);
      }}
      onContinue={commitAndInvite}
      onBack={() => store.updateDraft(draft.id, { step: "personalize" })}
    />
  );
}

/** Copy to the clipboard, throwing when it cannot be written (the "copy failed" branch). */
async function copyText(text: string): Promise<void> {
  if (navigator.clipboard === undefined || !window.isSecureContext) {
    throw new Error("clipboard unavailable");
  }
  await navigator.clipboard.writeText(text);
}

/* ------------------------------------------------------------------ *
 * Step 2 — name it
 * ------------------------------------------------------------------ */

function NameStep({
  templateTitle,
  counterpartyName,
  counterpartyEmail,
  persona,
  backToTemplate,
  onContinue,
}: {
  templateTitle: string;
  counterpartyName: string;
  counterpartyEmail: string;
  persona: string;
  backToTemplate: string;
  onContinue: (name: string, email: string) => void;
}) {
  const [name, setName] = useState(counterpartyName);
  const [emailValue, setEmailValue] = useState(counterpartyEmail);

  const canContinue = name.trim() !== "";

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Name this relationship"
        subtitle="Who is this with? A display name is all we need — their email is optional."
      />

      {persona === "visitor" && (
        <p className="text-xs text-muted-foreground">
          You&apos;re not signed in — in this prototype the persona bar stands in for a real
          account.
        </p>
      )}

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <label className="block text-sm font-medium text-foreground">
          Their name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="The person this relationship is with"
            className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Their email <span className="font-normal text-muted-foreground">(optional)</span>
          <input
            type="email"
            value={emailValue}
            onChange={(event) => setEmailValue(event.target.value)}
            placeholder="you@example.com"
            className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {templateTitle} — you can personalize the aspects next.
        </p>
      </div>

      {!canContinue && (
        <p className="text-sm text-muted-foreground">Enter their name to continue.</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <Link
          href={backToTemplate}
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back
        </Link>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => onContinue(name.trim(), emailValue.trim())}
          className="inline-flex h-11 items-center rounded-md bg-action px-5 text-sm font-medium text-action-foreground hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step 3 — personalize
 * ------------------------------------------------------------------ */

function PersonalizeStep({
  draftId,
  aspects,
  onUseThese,
  onChange,
}: {
  draftId: string;
  aspects: readonly V1FlowAspect[];
  onUseThese: () => void;
  onChange: (draftId: string, patch: Partial<Pick<V1FlowDraft, "step" | "aspects">>) => void;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);

  const blank = aspects.filter(
    (aspect) =>
      aspect.prompt.trim() === "" ||
      aspect.leftValue.trim() === "" ||
      aspect.rightValue.trim() === "",
  ).length;
  const problem =
    aspects.length === 0
      ? "A relationship needs at least one aspect. Add one back, or start over."
      : blank > 0
        ? `${blank} aspect${blank === 1 ? "" : "s"} still ${blank === 1 ? "needs" : "need"} a question and both ends.`
        : null;

  const setAspect = (
    index: number,
    field: "prompt" | "leftValue" | "rightValue",
    value: string,
  ) => {
    const next = aspects.map((aspect, at) =>
      at === index ? { ...aspect, [field]: value } : aspect,
    );
    onChange(draftId, { aspects: next });
    setRefusal(null);
  };

  const remove = (index: number) => {
    const next = aspects.filter((_, at) => at !== index);
    onChange(draftId, { aspects: next });
    setRefusal(null);
  };

  const add = () => {
    if (aspects.length >= MAX_RELATIONSHIP_ASPECTS) return;
    const next = [
      ...aspects,
      { id: crypto.randomUUID(), prompt: "", leftValue: "", rightValue: "" },
    ];
    onChange(draftId, { aspects: next });
    setRefusal(null);
  };

  const submit = () => {
    if (problem !== null) {
      setRefusal(problem);
      return;
    }
    onUseThese();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Personalize the aspects"
        subtitle="The template's starter aspects are pre-loaded. Remove, reword, or add your own."
      />

      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium text-foreground">
          {aspects.length} of {MAX_RELATIONSHIP_ASPECTS} aspects
        </p>
        <button
          type="button"
          onClick={add}
          disabled={aspects.length >= MAX_RELATIONSHIP_ASPECTS}
          className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add one
        </button>
      </div>

      {aspects.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          No aspects left. Add one back — a relationship needs at least one.
        </div>
      ) : (
        <ul className="space-y-3">
          {aspects.map((aspect, index) => (
            <li key={aspect.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Aspect {index + 1}</p>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-destructive hover:bg-muted"
                >
                  Remove
                </button>
              </div>
              <label className="mt-3 block text-sm font-medium text-foreground">
                Question
                <textarea
                  value={aspect.prompt}
                  onChange={(event) => setAspect(index, "prompt", event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                />
              </label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="block text-sm font-medium text-foreground">
                  Left value
                  <input
                    value={aspect.leftValue}
                    onChange={(event) => setAspect(index, "leftValue", event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Right value
                  <input
                    value={aspect.rightValue}
                    onChange={(event) => setAspect(index, "rightValue", event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(problem !== null || refusal !== null) && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {refusal ?? problem}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange(draftId, { step: "name" })}
          className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
        >
          Back
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={problem !== null}
          className="inline-flex h-11 items-center rounded-md bg-action px-5 text-sm font-medium text-action-foreground hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Use these aspects
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step 4 — purchase (one plan, one price, mocked)
 * ------------------------------------------------------------------ */

function PurchaseStep({
  counterpartyName,
  purchase,
  justPurchased,
  onBuy,
  onContinue,
  onBack,
}: {
  counterpartyName: string;
  purchase: { plan: string; amountCents: number; purchasedAt: string } | null;
  justPurchased: boolean;
  onBuy: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const price = formatCurrency(V1_RELATIONSHIP_PLAN.priceCents);
  const owned = purchase !== null;

  // Already owned before this session — the purchase is skipped, said out loud.
  if (owned && !justPurchased) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
        <SectionIntro
          title="You already own this relationship"
          subtitle="No purchase is needed — the payment step is skipped."
        />
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-foreground">
            This relationship was bought on{" "}
            {purchase?.purchasedAt.slice(0, 10) ?? "an earlier date"}. Your counterparty pays
            nothing.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-11 items-center rounded-md bg-action px-5 text-sm font-medium text-action-foreground hover:bg-action/90"
          >
            Continue to invite
          </button>
        </div>
      </div>
    );
  }

  // Receipt — the mock purchase just completed.
  if (owned && justPurchased) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
        <SectionIntro title="Receipt" subtitle="Your mock purchase is complete." />
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{V1_RELATIONSHIP_PLAN.name}</p>
            <p className="text-sm font-semibold text-foreground">{price}</p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              Mock payment — no charge
            </span>
          </div>
          <p className="mt-3 text-sm text-foreground">
            Purchased for {counterpartyName || "your counterparty"}. Your counterparty pays nothing.
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex h-11 items-center rounded-md bg-action px-5 text-sm font-medium text-action-foreground hover:bg-action/90"
          >
            Continue to invite
          </button>
        </div>
      </div>
    );
  }

  // The one plan, one price.
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title="Buy this relationship"
        subtitle="One plan, one price, bought once by you."
      />

      <div className="rounded-lg border-2 border-action bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-foreground">{V1_RELATIONSHIP_PLAN.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Bought once by you. Your counterparty pays nothing.
            </p>
          </div>
          <p className="text-2xl font-semibold text-foreground">{price}</p>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            Mock payment — no charge
          </span>
        </div>

        <p className="mt-4 text-sm font-medium text-foreground">What&apos;s included</p>
        <ul className="mt-2 space-y-1.5">
          {V1_RELATIONSHIP_PLAN.includes.map((line) => (
            <li key={line} className="flex gap-2 text-sm text-muted-foreground">
              <span aria-hidden="true">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium text-foreground">Your counterparty pays nothing.</p>

        <button
          type="button"
          onClick={onBuy}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-action px-5 text-sm font-medium text-action-foreground hover:bg-action/90"
        >
          Complete mock purchase
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          This is a prototype — the payment is mocked, no card is charged and no key is used.
        </p>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
      >
        Back
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Step 5 — invite
 * ------------------------------------------------------------------ */

function InviteStep({
  counterpartyName,
  inviteLink,
  copyState,
  email,
  emailSent,
  onCopy,
  onEmailChange,
  onSend,
  onGo,
}: {
  counterpartyName: string;
  inviteLink: string;
  copyState: "idle" | "copied" | "failed";
  email: string;
  emailSent: boolean;
  onCopy: () => void;
  onEmailChange: (value: string) => void;
  onSend: () => void;
  onGo: () => void;
}) {
  const who = counterpartyName.trim() === "" ? "your counterparty" : counterpartyName;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <SectionIntro
        title={`Invite ${who}`}
        subtitle="The relationship is ready. Send the link, or invite by email."
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-foreground">
          What {who} will see: a page inviting them to answer the same aspects from their side. They
          never pay — the relationship is already yours.
        </p>

        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">Invite link</p>
          <div className="mt-1 flex items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              className="h-11 flex-1 rounded-md border border-input bg-muted/50 px-3 text-sm text-foreground"
            />
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted"
            >
              {copyState === "copied" ? "Copied" : "Copy"}
            </button>
          </div>
          {copyState === "copied" && (
            <p className="mt-1 text-xs text-green-700">Link copied to the clipboard.</p>
          )}
          {copyState === "failed" && (
            <p className="mt-1 text-xs text-red-700">
              Copy failed — select the link above and copy it manually.
            </p>
          )}
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground">
            Email <span className="font-normal">(optional)</span>
          </p>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="their@example.com"
              className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm"
            />
            <button
              type="button"
              disabled={email.trim() === "" || emailSent}
              onClick={onSend}
              className="inline-flex h-11 items-center rounded-md bg-action px-4 text-sm font-medium text-action-foreground hover:bg-action/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send invite
            </button>
          </div>
          {emailSent && (
            <p className="mt-1 text-xs text-muted-foreground">
              Invite sent to {email.trim()} — mocked, no email was delivered in this prototype.
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onGo}
          className="inline-flex h-11 items-center rounded-md bg-action px-5 text-sm font-medium text-action-foreground hover:bg-action/90"
        >
          Go to the relationship
        </button>
      </div>
    </div>
  );
}
