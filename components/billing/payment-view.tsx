"use client";

// template-ancestor: components/dashboard/relationship-detail.tsx   (variation: the record list's billing deck — one panel per relationship with a `dl` of billing facts and one action row, a sticky aside of account-level cards, and a read-only band for the reader who pays for nothing)

/**
 * `/dashboard/payment` — the member's billing surface (#1132).
 *
 * The surface ports `docs/specs/v2-bundles/08-spec-design-page-payment-v2/payment.html`. **Every
 * decision is made upstream**: `lib/billing/payment-view.ts` resolves each relationship's state, its
 * fields, its note and its actions from rows and an injected instant, and this file renders what it
 * is handed. There is no comparison against a status, a trial, a pause or a clock in here — the
 * only local state is the free week's in-flight click, because a button that can be pressed twice
 * before the server answers is a second claim attempt.
 *
 * **The words are the fixture's.** `data/pages/payment.ts` holds every string, and `PanelText` is
 * either a copy id (`{ kind: "copy" }`, filled with the record's placeholders) or a literal the
 * derivation produced (a date, the price). E23's budget for this route is 0, so a sentence typed
 * here is a red build rather than a review comment.
 *
 * **Locked rules this file has to keep** (`IMPLEMENTATION-PROMPT.md` §Locked rules):
 * no shadow on a raised element (AGENTS.md C1 beats the prototype's `shadow-sm` — #1119 D-D says
 * so), no red or rose anywhere, status is colour **and** icon **and** word, and the Counterparty's
 * render carries no price, plan, trial, card or extension text at all. The last one is structural
 * rather than a filter: a Counterparty is handed no panels, so there is nothing in the props to
 * leak.
 */
import { Check, CreditCard, Info, Pause } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PageCopy, PageCopySection } from "@/content/pages";
import {
  initialsOf,
  type BillingPanel,
  type BillingView,
  type PanelText,
} from "@/lib/billing/payment-view";
import type { ExtensionOutcome } from "@/lib/member/outcomes";
import { fillLabel, itemLabel, itemLabelOr, sectionBody, sectionOf } from "@/lib/page-copy";

/** The classes the bundle gives a primary action, and its quiet sibling. */
const PRIMARY =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-action px-3 text-sm font-medium text-action-foreground transition-colors hover:bg-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:h-9";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium text-primary transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 lg:h-9";

/**
 * A `PanelText`, resolved to words.
 *
 * A copy id is read from the surface's own section — `itemLabelOr` rather than `itemLabel`,
 * because the id is chosen at runtime by the derivation (#998: a computed key cannot be resolved by
 * E23, and the throw would be a 500 at request time). `tests/payment-panels.test.ts` proves the
 * fixture carries every id the derivation can emit, so the empty string is unreachable.
 */
function words(section: PageCopySection, value: PanelText): string {
  if (value.kind === "text") return value.text;
  const template = itemLabelOr(section, value.id) ?? "";
  const filled: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value.values ?? {})) {
    filled[key] = typeof raw === "object" ? words(section, raw) : String(raw);
  }
  return fillLabel(template, filled);
}

/**
 * The status badge — **a word, an icon and a colour, never one of them alone** (locked rule 2).
 *
 * The three states that ask nothing of the reader (`Not Started`, `Paused`, `Membership Active`)
 * keep the neutral ground; the two that describe a running week take the billing chip. The icon is
 * the bundle's own: a check while something is going well, a pause mark while it is stopped.
 */
function StatusBadge({ panel, section }: { panel: BillingPanel; section: PageCopySection }) {
  const tone =
    panel.state === "trial" || panel.state === "invite-sent"
      ? "border-billing-line bg-billing-chip text-billing-ink"
      : "border-line bg-background text-foreground";
  const Icon = panel.state === "paused" ? Pause : Check;
  return (
    <span
      data-payment-badge={panel.state}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {words(section, panel.badge)}
    </span>
  );
}

/** One relationship's panel. */
function RelationshipPanel({
  panel,
  section,
  onClaim,
  pending,
  refusal,
}: {
  panel: BillingPanel;
  section: PageCopySection;
  onClaim: (panel: BillingPanel) => void;
  pending: boolean;
  refusal: string | null;
}) {
  return (
    <li
      id={`bill-${panel.relationshipId}`}
      data-payment-panel={panel.state}
      className="rounded-lg border border-billing-line bg-billing p-4 target:ring-2 target:ring-deep-calm"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-counterparty-tint text-xs font-semibold text-counterparty-ink ring-1 ring-inset ring-counterparty-line"
          aria-hidden="true"
        >
          {initialsOf(words(section, panel.partner))}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-primary">
            <Link className="hover:underline" href={panel.href}>
              {panel.title}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {fillLabel(itemLabel(section, "with"), { name: words(section, panel.partner) })}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <dl className="grid grid-cols-1 gap-4 rounded-md border border-billing-line bg-background p-4 min-[420px]:grid-cols-2 xxl:grid-cols-4">
          {panel.fields.map((field) => (
            <div key={field.label}>
              <dt className="text-xs text-muted-foreground">{itemLabel(section, field.label)}</dt>
              <dd className="mt-1 text-sm font-medium text-foreground">
                {field.label === "status" ? (
                  <StatusBadge panel={panel} section={section} />
                ) : (
                  words(section, field.value)
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">{words(section, panel.note)}</p>
        <div className="flex shrink-0 flex-wrap gap-2">
          {panel.actions.includes("continue-setup") ? (
            <Link
              className={SECONDARY}
              href={panel.payHref ?? panel.href}
              data-payment-action="continue-setup"
            >
              {itemLabel(section, "continue-setup")}
            </Link>
          ) : null}
          {panel.actions.includes("add-card") && panel.payHref !== null ? (
            <Link className={PRIMARY} href={panel.payHref} data-payment-action="add-card">
              <CreditCard className="size-4 shrink-0" aria-hidden="true" />
              {itemLabel(section, "add-card")}
            </Link>
          ) : null}
          {panel.actions.includes("get-week") ? (
            <button
              type="button"
              className={SECONDARY}
              data-payment-action="get-week"
              disabled={pending}
              onClick={() => onClaim(panel)}
            >
              {pending ? itemLabel(section, "get-week-pending") : itemLabel(section, "get-week")}
            </button>
          ) : null}
        </div>
      </div>
      {refusal === null ? null : (
        <p className="mt-2 text-sm text-muted-foreground" data-payment-refusal="">
          {refusal}
        </p>
      )}
    </li>
  );
}

/**
 * The page.
 *
 * `unreadable` is the read's own failure and it draws one band instead of the panels: a billing
 * screen that invented "no relationships" for a database that did not answer is the defect every
 * console surface in this tree already refuses.
 */
export function PaymentView({
  copy,
  view,
  unreadable,
  onClaimExtension,
}: {
  copy: PageCopy;
  view: BillingView;
  unreadable: string | null;
  onClaimExtension: (payload: { relationshipId: string }) => Promise<ExtensionOutcome>;
}) {
  const router = useRouter();
  const memberships = sectionOf(copy, "memberships");
  const method = sectionOf(copy, "payment-method");
  const history = sectionOf(copy, "billing-history");
  const trials = sectionOf(copy, "how-trials");
  const coverage = sectionOf(copy, "coverage");
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimRefusal, setClaimRefusal] = useState<{ id: string; message: string } | null>(null);

  /**
   * Take the one free week.
   *
   * The click is the screen's only write, and it writes nothing durable itself: the server action
   * re-asks the seat, the pause and the once-only rule inside `act()`'s transaction
   * (`lib/member/trial-extension.ts`). A success re-renders the route so the panel draws the state
   * the rows now hold — the offer gone, the extra week's end named — rather than a local guess.
   */
  async function claim(panel: BillingPanel) {
    setClaiming(panel.relationshipId);
    setClaimRefusal(null);
    const answer = await onClaimExtension({ relationshipId: panel.relationshipId });
    setClaiming(null);
    if (answer.ok) {
      router.refresh();
      return;
    }
    if (answer.message !== undefined && answer.message !== "") {
      setClaimRefusal({ id: panel.relationshipId, message: answer.message });
    }
  }

  const asidePayHref =
    view.panels.find((panel) => panel.actions.includes("add-card") && panel.payHref !== null)
      ?.payHref ?? null;

  return (
    <div className="w-full space-y-4">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex h-1" aria-hidden="true">
          <span className="flex-1 bg-action" />
          <span className="w-1/4 bg-deep/60" />
          <span className="w-1/6 bg-accent/50" />
        </div>
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
          <div className="min-w-0 space-y-2">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-deep">
              <CreditCard className="size-4 shrink-0" aria-hidden="true" />
              {copy.eyebrow}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-primary xxl:text-3xl">
              {copy.heading}
            </h1>
            <p className="text-base text-foreground">
              {view.role === "counterparty"
                ? itemLabel(coverage, "subtitle")
                : fillLabel(copy.subtitle ?? "", { price: view.price })}
            </p>
          </div>
        </div>
      </section>

      {unreadable === null ? null : (
        <p
          data-payment-unreadable={unreadable}
          className="rounded-lg border border-status-line bg-status p-4 text-sm text-foreground"
        >
          {itemLabel(memberships, "unreadable")}
        </p>
      )}

      {view.role === "initiator" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-detail lg:items-start">
          <section aria-labelledby="memberships-title" className="min-w-0 space-y-3">
            <h2 id="memberships-title" className="text-base font-semibold text-primary">
              {memberships.heading}
            </h2>
            {view.panels.length === 0 ? (
              <p className="rounded-lg border border-billing-line bg-billing p-4 text-sm text-foreground">
                {itemLabel(memberships, "empty")}
              </p>
            ) : (
              <ul className="space-y-4">
                {view.panels.map((panel) => (
                  <RelationshipPanel
                    key={panel.relationshipId}
                    panel={panel}
                    section={memberships}
                    pending={claiming === panel.relationshipId}
                    refusal={
                      claimRefusal?.id === panel.relationshipId ? claimRefusal.message : null
                    }
                    onClaim={(target) => {
                      void claim(target);
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-lg border bg-card p-4" aria-labelledby="method-title">
              <h2
                id="method-title"
                className="flex items-center gap-2 text-base font-semibold text-primary"
              >
                <CreditCard className="size-5 shrink-0 text-billing-ink" aria-hidden="true" />
                {method.heading}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {view.cardOnFile ? itemLabel(method, "saved") : sectionBody(method)}
              </p>
              {view.cardOnFile || asidePayHref === null ? null : (
                <Link
                  className={`${PRIMARY} mt-3`}
                  href={asidePayHref}
                  data-payment-action="aside-add-card"
                >
                  <CreditCard className="size-4 shrink-0" aria-hidden="true" />
                  {itemLabel(memberships, "add-card")}
                </Link>
              )}
            </section>

            <section className="rounded-lg border bg-card p-4" aria-labelledby="history-title">
              <h2 id="history-title" className="text-base font-semibold text-primary">
                {history.heading}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{sectionBody(history)}</p>
            </section>

            <section className="rounded-lg border border-status-line bg-status p-4">
              <h2 className="text-sm font-semibold text-primary">{trials.heading}</h2>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {(trials.items ?? []).map((item) => (
                  <li key={item.id} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-deep" aria-hidden="true" />
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      ) : null}

      {view.coverage.length === 0 ? null : (
        <div className="space-y-4">
          {view.coverage.map((band) => (
            <section
              key={band.initiator}
              aria-label={itemLabel(coverage, "aria")}
              className="rounded-lg border bg-card p-4"
            >
              <div className="flex items-start gap-3 rounded-md bg-counterparty-tint p-3 text-sm text-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-counterparty-ink" aria-hidden="true" />
                <p>
                  <span className="font-semibold">
                    {fillLabel(itemLabel(coverage, "covered"), { initiator: band.initiator })}
                  </span>{" "}
                  {itemLabel(coverage, "free")}
                </p>
              </div>
              {/* The Counterparty's one band and nothing else — no price, no trial, no card, no
                  extension, and no action control of any kind. The absence is the rule: see
                  `tests/counterparty-no-leak.test.ts`. */}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
