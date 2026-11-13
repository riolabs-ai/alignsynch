"use client";

/**
 * template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: the detail screen's per-row actions become five audited repairs — each band is a form, the row's own facts decide which are offered, and the result is a refusal sentence or a one-time link)
 *
 * `/admin/instances/[id]` — the five relationship repairs (#503).
 *
 * The screen is the operator's answer to "this relationship is stuck": a header with the row's own
 * facts, the two seats with the three facts the repairs act on, the invitation, and then five
 * bands — unlock, reissue, withdraw, void, accept-on-behalf — each its own form.
 *
 * **A reason is optional, and the bands ask for none** (#732). `act()` records one when a caller
 * still has it and `NULL` when nobody does, so a repair is a button, not a paragraph to write
 * before the button works.
 *
 * **Which bands are offered comes from the row, which the row itself does not guarantee.** A seat
 * with no unlock mark offers nothing to clear; a claimed or missing invitation offers nothing to
 * reissue, and a withdrawn one offers nothing either — a revoke is terminal, so the same
 * invitation cannot be brought back by the band beside it; a voided session offers neither an
 * invitation nor an acceptance. Those are *disabled* controls with a sentence, not hidden ones — an
 * operator looking for the button needs to know it exists and why it is unavailable, and the store
 * refuses each of them anyway (`OpRefused`), so the UI's own checks are courtesy twice over.
 *
 * **Nothing here decides a permission.** The floors live in `lib/admin/roles.ts` and are enforced by
 * `act()` inside the transaction; this component cannot know the actor's rung, so a repair the actor
 * may not take comes back as `role-too-low` and is drawn like any other refusal.
 *
 * **The one-time link.** A reissue mints a token that exists in exactly two places: the URL this
 * component holds in state, and the row's hash. It is not in the audit row, it is not in any read
 * this screen makes, and a reload loses it — which is what "shown once" has to mean if the token is
 * never written down.
 *
 * Literal-free (E23): every word is `data/pages/admin-relationship.ts`; the model's own labels
 * (`MODE_LABELS`, `SETTING_LABELS`) and the instants (`formatDate`) are the exceptions the repo
 * already makes.
 */
import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MODE_LABELS, SETTING_LABELS } from "@/content/assessment";
import { formatDate } from "@/content/core";
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { AdminRelationshipDetail, AdminSeat } from "@/lib/db/admin-relationship";
import type { InstanceStatus } from "@/lib/flow/state";
import { ADMIN_AUDIT_PATH } from "@/lib/admin/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

import type { RepairInput, RepairOutcome } from "@/lib/admin/repairs";

/** What the screen is doing right now: nothing, or the last repair's outcome. */
type Phase = { readonly kind: "idle" } | { readonly kind: "done"; readonly outcome: RepairOutcome };

/**
 * The status the derivation answers, mapped onto the copy id that names it.
 *
 * The derivation's vocabulary is snake_case (`instanceStatusOf()` answers `awaiting_counterparty`)
 * and a page-copy id is kebab-case, so the join is stated here once rather than by a
 * `replace("_", "-")` that would silently pass an unknown status through as a missing id. Typed
 * `Record<InstanceStatus, string>`, so a fourth status is a compile error until it has words.
 */
const STATUS_COPY_ID: Record<InstanceStatus, string> = {
  awaiting_counterparty: "awaiting-counterparty",
  answering: "answering",
  /* #619 — sealed and unpaid: the console reads it as its own state, not as an error. */
  awaiting_payment: "awaiting-payment",
  complete: "complete",
  voided: "voided",
};

/**
 * The repair a band drives, read off the band itself.
 *
 * A band's section id is `op-<repair>` (`op-void`, `op-force-close`) — the fixture's convention,
 * and the id `sectionOf()` already resolves. Deriving the name instead of repeating it as a JSX
 * attribute keeps the fixture the one place the five repairs are named: a sixth band arrives here
 * with its own name, and E23 does not count a fixture read as copy.
 */
function repairOfBand(section: PageCopySection): string {
  return section.id.slice(3);
}

/** A section's heading, or the empty string — `sectionHeading` is not a reader the repo has. */
function headingOf(section: PageCopySection): string {
  return section.heading ?? "";
}

/** Fill `{name}` in a sentence without inventing a second string. */
function say(
  section: PageCopySection,
  id: string,
  values: Record<string, string | number>,
): string {
  return fillLabel(itemLabel(section, id), values);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

/** One seat: its name, its answered count, and the three facts the repairs act on. */
function Seat({
  seat,
  aspects,
  copy,
}: {
  seat: AdminSeat;
  aspects: number;
  copy: PageCopySection;
}) {
  return (
    <div data-seat={seat.role} className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {itemLabel(copy, seat.role)}
        </p>
        <Badge variant={seat.hasAccount ? "success" : "outline"}>
          {itemLabel(copy, seat.hasAccount ? "account" : "no-account")}
        </Badge>
      </div>
      <p className="mt-1 text-base font-medium">{seat.name}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {say(copy, "answered", { answered: seat.answered, aspects })}
      </p>
      <p className="mt-1 text-sm">
        {seat.acceptedAt === null
          ? itemLabel(copy, "not-accepted")
          : say(copy, "accepted", { at: formatDate(seat.acceptedAt) })}
      </p>
      {seat.impersonatedBy === null ? null : (
        <p data-impersonated="true" className="mt-1 text-sm font-medium text-amber-700">
          {say(copy, "admin-set", { by: seat.impersonatedBy })}
        </p>
      )}
      <p className="mt-1 text-sm text-muted-foreground">
        {seat.unlockSeenAt === null
          ? itemLabel(copy, "not-unlocked")
          : say(copy, "unlocked", { at: formatDate(seat.unlockSeenAt) })}
      </p>
    </div>
  );
}

/** One repair band: the sentence, the fields only this repair needs, the reason, the button. */
function RepairBand({
  section,
  repair,
  instanceRecordId,
  formCopy,
  action,
  disabled,
  disabledReason,
  seatPicker,
  emailField,
  onResult,
}: {
  section: PageCopySection;
  repair: string;
  instanceRecordId: string;
  formCopy: PageCopySection;
  action: (input: RepairInput) => Promise<RepairOutcome>;
  disabled: boolean;
  disabledReason: string | null;
  seatPicker?: readonly AdminSeat[];
  emailField?: string | null;
  onResult: (outcome: RepairOutcome) => void;
}) {
  const [seat, setSeat] = useState(seatPicker?.[0]?.role ?? "initiator");
  const [email, setEmail] = useState(emailField ?? "");
  const [busy, setBusy] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || busy) return;
    const input: RepairInput = {
      repair,
      instanceRecordId,
      ...(repair === "unlock" || repair === "force-close" ? { role: seat } : {}),
      ...(repair === "resend" ? { email } : {}),
    };
    setBusy(true);
    void action(input)
      .then((outcome) => {
        onResult(outcome);
      })
      .finally(() => setBusy(false));
  };

  return (
    <Card data-repair={repair}>
      <CardHeader>
        <CardTitle>{headingOf(section)}</CardTitle>
        <CardDescription>{sectionBody(section)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit}>
          {seatPicker === undefined ? null : (
            <div className="space-y-1">
              <Label htmlFor={`${repair}-seat`}>{itemLabel(section, "party")}</Label>
              <select
                id={`${repair}-seat`}
                className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
                name="role"
                value={seat}
                onChange={(event) => setSeat(event.target.value as AdminSeat["role"])}
              >
                {seatPicker.map((option) => (
                  <option key={option.role} value={option.role}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {emailField === undefined ? null : (
            <div className="space-y-1">
              <Label htmlFor={`${repair}-email`}>{itemLabel(section, "email")}</Label>
              {/* Controlled, and only controlled (#980). The invitation's address is the *seed*
                  — `useState(emailField)` above — never a second declaration of the same value:
                  React reads `value` and `defaultValue` together as uncontrolled, keeps the first
                  one and may ignore every later `value`, which is a field that shows one address
                  and submits another. `submit()` already reads `email` out of state, so state is
                  the truth and an untouched field still reissues to the party who was invited. */}
              <Input
                id={`${repair}-email`}
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          )}
          <Button type="submit" disabled={disabled || busy} variant="outline">
            {busy ? itemLabel(formCopy, "submitting") : itemLabel(section, "button")}
          </Button>
          {disabled && disabledReason !== null ? (
            <p className="text-sm text-muted-foreground">{disabledReason}</p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function RelationshipOperations({
  copy,
  detail,
  action,
}: {
  copy: PageCopy;
  detail: AdminRelationshipDetail;
  /** The server action. Passed in rather than imported so this module never reaches `app/`. */
  action: (input: RepairInput) => Promise<RepairOutcome>;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const facts = sectionOf(copy, "facts");
  const statusCopy = sectionOf(copy, "status");
  const seatsCopy = sectionOf(copy, "seats");
  const inviteCopy = sectionOf(copy, "invite");
  const formCopy = sectionOf(copy, "form");
  const refusals = sectionOf(copy, "refusals");
  const done = sectionOf(copy, "done");

  const unlockBand = sectionOf(copy, "op-unlock");
  const resendBand = sectionOf(copy, "op-resend");
  const revokeBand = sectionOf(copy, "op-revoke");
  const voidBand = sectionOf(copy, "op-void");
  const forceBand = sectionOf(copy, "op-force-close");

  const onResult = (outcome: RepairOutcome) => {
    setPhase({ kind: "done", outcome });
  };

  const outcome = phase.kind === "done" ? phase.outcome : null;
  const invite = detail.invite;
  const unmarkedSeats = detail.seats.filter((seat) => seat.unlockSeenAt !== null);
  const openSeats = detail.seats.filter((seat) => seat.acceptedAt === null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="mt-1 max-w-3xl text-muted-foreground">{copy.subtitle}</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{detail.name}</CardTitle>
          <CardDescription>{detail.templateTitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label={itemLabel(facts, "id")} value={detail.instanceRecordId} />
            <Fact label={itemLabel(facts, "mode")} value={MODE_LABELS[detail.mode as "basic"]} />
            <Fact
              label={itemLabel(facts, "setting")}
              value={SETTING_LABELS[detail.setting as "soft"]}
            />
            <Fact
              label={itemLabel(facts, "status")}
              value={itemLabel(statusCopy, STATUS_COPY_ID[detail.status])}
            />
            <Fact label={itemLabel(facts, "aspects")} value={String(detail.aspects)} />
            {detail.voidedAt === null ? null : (
              <Fact label={itemLabel(statusCopy, "voided")} value={formatDate(detail.voidedAt)} />
            )}
          </dl>
        </CardContent>
      </Card>

      <section data-seats="true" className="space-y-3">
        <h2 className="text-lg font-semibold">{headingOf(seatsCopy)}</h2>
        <p className="text-sm text-muted-foreground">{sectionBody(seatsCopy)}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {detail.seats.map((seat) => (
            <Seat key={seat.role} seat={seat} aspects={detail.aspects} copy={seatsCopy} />
          ))}
        </div>
      </section>

      <Card data-invite="true">
        <CardHeader>
          <CardTitle>{headingOf(inviteCopy)}</CardTitle>
          <CardDescription>{sectionBody(inviteCopy)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {invite === null ? (
            <p>{itemLabel(inviteCopy, "none")}</p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground">{itemLabel(inviteCopy, "email")}: </span>
                {invite.email}
              </p>
              {/* A `<p>` may not contain the `Badge` primitive (#980 proof): `Badge` is a `<div>`,
                  so this row was invalid HTML the server wrote and the client refused to hydrate —
                  React regenerated the whole tree and logged `<p> cannot contain a nested <div>`.
                  A `<div>` row keeps the same `space-y-2 text-sm` rhythm and the same words. */}
              <div>
                <span className="text-muted-foreground">{itemLabel(inviteCopy, "state")}: </span>
                <Badge variant={invite.state === "unclaimed" ? "outline" : "secondary"}>
                  {itemLabel(inviteCopy, invite.state)}
                </Badge>
              </div>
              <p>
                {say(inviteCopy, "expires", { at: formatDate(invite.expiresAt) })} ·{" "}
                {say(inviteCopy, "resent", { count: invite.resentCount })}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {outcome === null ? null : (
        <Card
          data-outcome={outcome.ok ? "ok" : outcome.code}
          className={outcome.ok ? "border-emerald-300" : "border-destructive/50"}
        >
          <CardHeader>
            <CardTitle>
              {outcome.ok ? headingOf(done) : itemLabel(refusals, outcome.code)}
            </CardTitle>
            {outcome.ok ? <CardDescription>{sectionBody(done)}</CardDescription> : null}
          </CardHeader>
          {outcome.ok ? (
            <CardContent className="space-y-2 text-sm">
              <p>{say(done, "logged", { action: outcome.action })}</p>
              {outcome.link === undefined ? null : (
                <p className="break-all font-mono text-xs" data-invite-link="true">
                  {itemLabel(done, "link")}: {outcome.link}
                </p>
              )}
              {/* #503 — the repair and its audit row committed together, so the log is where an
                  operator verifies what they just did. A dead label here would be the screen
                  claiming a log it does not link to. */}
              <p>
                <Link
                  href={ADMIN_AUDIT_PATH}
                  className="text-action font-medium hover:underline"
                  data-audit-link="true"
                >
                  {itemLabel(done, "audit")}
                </Link>
              </p>
            </CardContent>
          ) : null}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RepairBand
          section={unlockBand}
          formCopy={formCopy}
          repair={repairOfBand(unlockBand)}
          instanceRecordId={detail.instanceRecordId}
          action={action}
          seatPicker={unmarkedSeats}
          disabled={unmarkedSeats.length === 0}
          disabledReason={itemLabel(seatsCopy, "not-unlocked")}
          onResult={onResult}
        />
        <RepairBand
          section={resendBand}
          formCopy={formCopy}
          repair={repairOfBand(resendBand)}
          instanceRecordId={detail.instanceRecordId}
          action={action}
          emailField={invite?.email ?? null}
          disabled={
            invite === null ||
            invite.claimedAt !== null ||
            invite.revokedAt !== null ||
            detail.voided
          }
          disabledReason={
            invite === null
              ? itemLabel(inviteCopy, "none")
              : invite.claimedAt !== null
                ? itemLabel(inviteCopy, "claimed")
                : invite.revokedAt !== null
                  ? itemLabel(inviteCopy, "revoked")
                  : itemLabel(refusals, "instance-voided")
          }
          onResult={onResult}
        />
        <RepairBand
          section={revokeBand}
          formCopy={formCopy}
          repair={repairOfBand(revokeBand)}
          instanceRecordId={detail.instanceRecordId}
          action={action}
          disabled={invite === null || invite.claimedAt !== null || invite.revokedAt !== null}
          disabledReason={
            invite === null
              ? itemLabel(inviteCopy, "none")
              : invite.claimedAt !== null
                ? itemLabel(inviteCopy, "claimed")
                : itemLabel(inviteCopy, "revoked")
          }
          onResult={onResult}
        />
        <RepairBand
          section={voidBand}
          formCopy={formCopy}
          repair={repairOfBand(voidBand)}
          instanceRecordId={detail.instanceRecordId}
          action={action}
          disabled={detail.voided}
          disabledReason={itemLabel(refusals, "already-voided")}
          onResult={onResult}
        />
        <RepairBand
          section={forceBand}
          formCopy={formCopy}
          repair={repairOfBand(forceBand)}
          instanceRecordId={detail.instanceRecordId}
          action={action}
          seatPicker={openSeats}
          disabled={detail.voided || openSeats.length === 0}
          disabledReason={
            detail.voided
              ? itemLabel(refusals, "instance-voided")
              : itemLabel(refusals, "already-accepted")
          }
          onResult={onResult}
        />
      </div>
    </div>
  );
}
