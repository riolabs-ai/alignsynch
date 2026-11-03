"use client";

/**
 * template-ancestor: components/my-quizzes/quiz-details.tsx   (variation: the detail screen's per-row actions become five audited repairs — each band is a form with a required reason, the row's own facts decide which are offered, and the result is a refusal sentence or a one-time link)
 *
 * `/admin/instances/[id]` — the five relationship repairs (#503).
 *
 * The screen is the operator's answer to "this relationship is stuck": a header with the row's own
 * facts, the two seats with the three facts the repairs act on, the invitation, and then five
 * bands — unlock, reissue, withdraw, void, accept-on-behalf — each its own form with its own
 * reason.
 *
 * **The reason is a form field and a contract.** `minLength={reasonMin}` is the browser's
 * help, and it is not the enforcement: `act()` trims and refuses under eight characters before it
 * opens a transaction, and the same refusal maps back to a sentence here (`reason-too-short`). A
 * form attribute a caller can strip is a hint, never a rule.
 *
 * **Which bands are offered comes from the row, which the row itself does not guarantee.** A seat
 * with no unlock mark offers nothing to clear; a claimed or missing invitation offers nothing to
 * reissue; a voided session offers neither an invitation nor an acceptance. Those are *disabled*
 * controls with a sentence, not hidden ones — an operator looking for the button needs to know it
 * exists and why it is unavailable, and the store refuses each of them anyway (`OpRefused`), so the
 * UI's own checks are courtesy twice over.
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
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

import type { RepairInput, RepairOutcome } from "@/app/(mainlayout)/admin/instances/[id]/actions";

/** What the screen is doing right now: nothing, or the last repair's outcome. */
type Phase = { readonly kind: "idle" } | { readonly kind: "done"; readonly outcome: RepairOutcome };

/** A section's heading, or the empty string — `sectionHeading` is not a reader the repo has. */
function headingOf(section: PageCopySection): string {
  return section.heading ?? "";
}

/** Fill `{name}` in a sentence without inventing a second string. */
function say(section: PageCopySection, id: string, values: Record<string, string | number>): string {
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
  reasonMin,
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
  /** `REASON_MIN_LENGTH`, handed down: importing it here would pull `pg` into the bundle (E34). */
  reasonMin: number;
  onResult: (outcome: RepairOutcome) => void;
}) {
  const [reason, setReason] = useState("");
  const [seat, setSeat] = useState(seatPicker?.[0]?.role ?? "initiator");
  const [email, setEmail] = useState(emailField ?? "");
  const [busy, setBusy] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || busy) return;
    const input: RepairInput = {
      repair,
      instanceRecordId,
      reason,
      ...(repair === "unlock" || repair === "force-close" ? { role: seat } : {}),
      ...(repair === "resend" ? { email } : {}),
    };
    setBusy(true);
    void action(input)
      .then((outcome) => {
        onResult(outcome);
        if (outcome.ok) setReason("");
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
              <Input
                id={`${repair}-email`}
                name="email"
                type="email"
                defaultValue={emailField ?? ""}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`${repair}-reason`}>{itemLabel(formCopy, "reason")}</Label>
            <Input
              id={`${repair}-reason`}
              name="reason"
              required
              minLength={reasonMin}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              {say(formCopy, "reason-short", { min: reasonMin })}
            </p>
          </div>
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
  reasonMin,
}: {
  copy: PageCopy;
  detail: AdminRelationshipDetail;
  /** The server action. Passed in rather than imported so this module never reaches `app/`. */
  action: (input: RepairInput) => Promise<RepairOutcome>;
  /** `REASON_MIN_LENGTH` from the server page — importing it here would pull `pg` in (E34). */
  reasonMin: number;
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
              value={itemLabel(statusCopy, detail.status)}
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
              <p>
                <span className="text-muted-foreground">{itemLabel(inviteCopy, "state")}: </span>
                <Badge variant={invite.state === "unclaimed" ? "outline" : "secondary"}>
                  {itemLabel(inviteCopy, invite.state)}
                </Badge>
              </p>
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
            </CardContent>
          ) : null}
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RepairBand
          section={unlockBand}
          reasonMin={reasonMin}
          formCopy={formCopy}
          repair="unlock"
          instanceRecordId={detail.instanceRecordId}
          action={action}
          seatPicker={unmarkedSeats}
          disabled={unmarkedSeats.length === 0}
          disabledReason={itemLabel(seatsCopy, "not-unlocked")}
          onResult={onResult}
        />
        <RepairBand
          section={resendBand}
          reasonMin={reasonMin}
          formCopy={formCopy}
          repair="resend"
          instanceRecordId={detail.instanceRecordId}
          action={action}
          emailField={invite?.email ?? null}
          disabled={invite === null || invite.claimedAt !== null || detail.voided}
          disabledReason={
            invite === null
              ? itemLabel(inviteCopy, "none")
              : invite.claimedAt !== null
                ? itemLabel(inviteCopy, "claimed")
                : itemLabel(refusals, "instance-voided")
          }
          onResult={onResult}
        />
        <RepairBand
          section={revokeBand}
          reasonMin={reasonMin}
          formCopy={formCopy}
          repair="revoke"
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
          reasonMin={reasonMin}
          formCopy={formCopy}
          repair="void"
          instanceRecordId={detail.instanceRecordId}
          action={action}
          disabled={detail.voided}
          disabledReason={itemLabel(refusals, "already-voided")}
          onResult={onResult}
        />
        <RepairBand
          section={forceBand}
          reasonMin={reasonMin}
          formCopy={formCopy}
          repair="force-close"
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
