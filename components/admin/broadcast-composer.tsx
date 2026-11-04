"use client";

/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: the editor's compose-and-preview step keeps its two panes — the authoring form on the left, the live preview on the right — and its save bar becomes the dry-run/send bar; the per-item accordion is dropped because a notice has one subject and one body, and the publication badge becomes the mail-key mode banner, with the audience counts where the character counts were)
 *
 * `/admin/broadcast` — the compose screen for one notice to the news list (#507, epic #500).
 *
 * **The template, and the axes it varies** (the template doctrine's three questions):
 *
 *   quiz-editor (compose step)          this screen
 *   ----------------------------------  ------------------------------------------------
 *   two panes: form, live preview       the same two panes, same reading direction
 *   an accordion per question           dropped — a notice has exactly one subject and
 *                                       one body, so there is nothing to fold
 *   character/word counters             the audience counts: consented, held by the
 *                                       cooldown, and the cap
 *   save / publish bar                  dry run / send bar, plus the audited reason field
 *   a publication badge                 the mail-key mode banner, because a test key is the
 *                                       one state where sending must be impossible
 *
 * The public surface this screen stands in for is the footer's news band
 * (`components/home/newsletter-section.tsx`, mounted by `components/layout/footer.tsx`) — the place
 * a person typed the address this screen may now write to. The card names that file under
 * `components/layout/`; the tree's footer band lives under `components/home/`, and the link between
 * the two is the `footer-news` copy section both read.
 *
 * **`support` never renders this.** The page's `requireAdmin()` answers a `support` session with the
 * 404 an unknown URL gets, so a component that checked the role would be checking it twice and the
 * second check would be the one to rot. What this component does with the role is say it out loud —
 * the compose band prints the actor's rung beside the floor — and then posts anyway, because the
 * refusal is the server's (`act()` re-reads the rung inside the transaction).
 *
 * **No address, anywhere.** Every number this component receives is a count; every row in the sends
 * table is a send, and the body is its hash. There is no prop, no state and no rendered node that
 * could carry a recipient list — which is the card's fourth hard rule held by the shape of the props
 * rather than by remembering not to render one.
 *
 * **Literal-free (E23).** Every word is `data/pages/admin-broadcast.ts`; the mode's banner, the four
 * refusal sentences per state and the two table headings are all ids in that fixture.
 */
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTimeLong } from "@/content/core";
import type { PageCopy } from "@/content/pages";
import type { UserRole } from "@/content/identity";
import type { BroadcastListCounts, BroadcastSendRow } from "@/lib/db/news-signups";
import {
  BROADCAST_COOLDOWN_HOURS,
  BROADCAST_SEGMENTS,
  type BroadcastFormInput,
  type BroadcastPreviewResult,
  type BroadcastSendResult,
} from "@/lib/admin/broadcast-rules";
import type { MailKeyMode } from "@/lib/email/key-mode";
import { fillLabel, itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The two segment values, as values — a JSX attribute holding one of these is not copy (E23). */
const [SEGMENT_ALL, SEGMENT_SINCE] = BROADCAST_SEGMENTS;

/** What the page hands the screen. Counts, sends, the deployment's mode — and no addresses. */
export interface BroadcastComposerProps {
  readonly copy: PageCopy;
  readonly counts: BroadcastListCounts;
  readonly sends: readonly BroadcastSendRow[];
  /** The mode `lib/email/key-mode.ts` resolved on the server. The banner is drawn from it. */
  readonly keyMode: MailKeyMode;
  /** The endpoint mail would go to — printed only in capture mode, so the banner can name it. */
  readonly endpoint: string;
  /** The sender address a message would carry. */
  readonly sender: string;
  readonly role: UserRole;
  /** `broadcast.send`'s floor, from `lib/admin/roles.ts` — the rung the band names. */
  readonly floor: UserRole;
  /** `act()`'s reason floor, so the field says the number the server enforces. */
  readonly reasonMin: number;
  /** The database did not answer: render the failure panel and claim nothing. */
  readonly unreadable: string | null;
  /** `/admin/audit`, so a finished send links to the entry it wrote. A route, not a sentence. */
  readonly auditPath: string;
  readonly preview: (input: BroadcastFormInput) => Promise<BroadcastPreviewResult>;
  readonly send: (input: BroadcastFormInput) => Promise<BroadcastSendResult>;
}

/** The one refusal sentence for a code, from the fixture — never a code printed at a person. */
function refusalText(copy: PageCopy, code: string): string {
  return itemLabel(sectionOf(copy, "refusals"), code);
}

/** The banner an operator must not be able to miss, per mode. */
const BANNER_ITEM: Record<MailKeyMode, string> = {
  test: "banner-test",
  captured: "banner-captured",
  live: "banner-live",
  unset: "banner-unset",
};

/** How loud each mode's banner is. A test key and a missing key are both refusals. */
const BANNER_VARIANT: Record<MailKeyMode, "destructive" | "warning" | "success" | "muted"> = {
  test: "destructive",
  captured: "warning",
  live: "success",
  unset: "destructive",
};

export function BroadcastComposer({
  copy,
  counts,
  sends,
  keyMode,
  endpoint,
  sender,
  role,
  floor,
  reasonMin,
  unreadable,
  auditPath,
  preview,
  send,
}: BroadcastComposerProps) {
  const composeCopy = sectionOf(copy, "compose");
  const previewCopy = sectionOf(copy, "preview");
  const countsCopy = sectionOf(copy, "counts");
  const listCopy = sectionOf(copy, "list");
  const sendsCopy = sectionOf(copy, "sends");
  const doneCopy = sectionOf(copy, "done");
  const bannerCopy = sectionOf(copy, "key-mode");
  const unreadableCopy = sectionOf(copy, "unreadable");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segmentKind, setSegmentKind] = useState<string>(SEGMENT_ALL);
  const [segmentSince, setSegmentSince] = useState("");
  const [reason, setReason] = useState("");
  const [dryRun, setDryRun] = useState<BroadcastPreviewResult | null>(null);
  const [sent, setSent] = useState<BroadcastSendResult | null>(null);
  const [pending, setPending] = useState<"preview" | "send" | null>(null);
  const [broken, setBroken] = useState(false);

  const form = (): BroadcastFormInput => ({ subject, body, segmentKind, segmentSince, reason });

  /** A stale count is a lie: any edit clears the dry run and any finished send. */
  const edited = () => {
    setDryRun(null);
    setSent(null);
  };

  const runPreview = async () => {
    setPending("preview");
    setBroken(false);
    try {
      setDryRun(await preview(form()));
    } catch {
      setBroken(true);
    } finally {
      setPending(null);
    }
  };

  const runSend = async () => {
    setPending("send");
    setBroken(false);
    try {
      setSent(await send(form()));
    } catch {
      setBroken(true);
    } finally {
      setPending(null);
    }
  };

  const banner = itemLabel(bannerCopy, BANNER_ITEM[keyMode]);

  return (
    <div className="space-y-6">
      {unreadable !== null && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle>{unreadableCopy.heading ?? copy.heading}</CardTitle>
            <CardDescription>{sectionBody(unreadableCopy)}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">
              {fillLabel(itemLabel(unreadableCopy, "reason"), { reason: unreadable })}
            </p>
          </CardContent>
        </Card>
      )}

      <Card data-mail-key-mode={keyMode} className="border-l-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant={BANNER_VARIANT[keyMode]}>{bannerCopy.heading ?? copy.heading}</Badge>
          </CardTitle>
          <CardDescription>{fillLabel(banner, { endpoint })}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" data-mail-key-banner>
            {fillLabel(itemBody(bannerCopy, BANNER_ITEM[keyMode]), { endpoint })}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{composeCopy.heading ?? copy.heading}</CardTitle>
            <CardDescription>{sectionBody(composeCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="broadcast-subject">{itemLabel(composeCopy, "subject")}</Label>
              <Input
                id="broadcast-subject"
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  edited();
                }}
                placeholder={itemLabel(composeCopy, "subject-placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="broadcast-body">{itemLabel(composeCopy, "body")}</Label>
              <Textarea
                id="broadcast-body"
                rows={8}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value);
                  edited();
                }}
                placeholder={itemLabel(composeCopy, "body-placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{itemLabel(composeCopy, "segment")}</Label>
              <RadioGroup
                value={segmentKind}
                onValueChange={(value) => {
                  setSegmentKind(value);
                  edited();
                }}
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={SEGMENT_ALL} id="segment-all" />
                  <Label htmlFor="segment-all">{itemLabel(composeCopy, "segment-all")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value={SEGMENT_SINCE} id="segment-since" />
                  <Label htmlFor="segment-since">{itemLabel(composeCopy, "segment-since")}</Label>
                </div>
              </RadioGroup>
            </div>
            {segmentKind === SEGMENT_SINCE && (
              <div className="space-y-2">
                <Label htmlFor="broadcast-since">{itemLabel(composeCopy, "since")}</Label>
                <Input
                  id="broadcast-since"
                  type="date"
                  value={segmentSince}
                  onChange={(event) => {
                    setSegmentSince(event.target.value);
                    edited();
                  }}
                />
              </div>
            )}
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="broadcast-reason">{itemLabel(composeCopy, "reason")}</Label>
              <Input
                id="broadcast-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  edited();
                }}
                placeholder={fillLabel(itemLabel(composeCopy, "reason-placeholder"), {
                  min: reasonMin,
                })}
              />
              <p className="text-xs text-muted-foreground">
                {fillLabel(itemLabel(composeCopy, "role"), { role, floor })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={runPreview}
                disabled={pending !== null}
              >
                {itemLabel(composeCopy, "dry-run")}
              </Button>
              <Button type="button" onClick={runSend} disabled={pending !== null}>
                {pending === "send"
                  ? itemLabel(composeCopy, "sending")
                  : itemLabel(composeCopy, "send")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{previewCopy.heading ?? copy.heading}</CardTitle>
            <CardDescription>{sectionBody(previewCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {fillLabel(itemLabel(previewCopy, "from"), { sender })}
            </p>
            {subject === "" && body === "" ? (
              <p className="text-sm text-muted-foreground">{itemLabel(previewCopy, "empty")}</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  {itemLabel(previewCopy, "subject-prefix")}
                </p>
                <p className="text-base font-semibold" data-broadcast-preview-subject>
                  {subject}
                </p>
                <Separator />
                <p className="whitespace-pre-wrap text-sm" data-broadcast-preview-body>
                  {body}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{countsCopy.heading ?? copy.heading}</CardTitle>
          <CardDescription>{sectionBody(countsCopy)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dryRun === null ? (
            <p className="text-sm text-muted-foreground">{itemLabel(countsCopy, "idle")}</p>
          ) : dryRun.ok ? (
            <div className="space-y-1" data-broadcast-dry-run={dryRun.count}>
              <p className="text-2xl font-bold tabular-nums">
                {fillLabel(itemLabel(countsCopy, "send-count"), { count: dryRun.count })}
              </p>
              <p className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(countsCopy, "consented"), { count: dryRun.consented })}
              </p>
              <p className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(countsCopy, "held"), {
                  hours: BROADCAST_COOLDOWN_HOURS,
                  count: dryRun.heldByCooldown,
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {fillLabel(itemLabel(countsCopy, "cap"), { count: dryRun.cap })}
              </p>
              {dryRun.count === 0 && (
                <p className="text-sm text-destructive">{itemLabel(countsCopy, "none")}</p>
              )}
              {dryRun.overCap && (
                <p className="text-sm text-destructive">{itemLabel(countsCopy, "over-cap")}</p>
              )}
              <p className="font-mono text-xs text-muted-foreground" data-broadcast-body-hash>
                {fillLabel(itemLabel(countsCopy, "hash"), { hash: dryRun.bodyHash })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-destructive">{refusalText(copy, dryRun.code)}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{listCopy.heading ?? copy.heading}</CardTitle>
          <CardDescription>{sectionBody(listCopy)}</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["total", counts.total],
                ["consented", counts.consented],
                ["unsubscribed", counts.unsubscribed],
                ["bounced", counts.bounced],
                ["complained", counts.complained],
                ["cooling", counts.cooling],
              ] as const
            ).map(([id, value]) => (
              <div key={id}>
                <dt className="text-sm text-muted-foreground">{itemLabel(listCopy, id)}</dt>
                <dd className="text-2xl font-bold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {sent !== null && (
        <Card className={sent.ok ? "border-green-400" : "border-destructive"}>
          <CardHeader>
            <CardTitle>{doneCopy.heading ?? copy.heading}</CardTitle>
            <CardDescription>{sectionBody(doneCopy)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2" data-broadcast-send={sent.ok ? "ok" : sent.code}>
            {sent.ok ? (
              <>
                <p className="text-sm">
                  {fillLabel(itemLabel(doneCopy, "sent"), {
                    sent: sent.sent,
                    count: sent.recipientCount,
                    failed: sent.failed,
                  })}
                </p>
                <p className="text-sm">
                  <Link
                    className="underline underline-offset-4"
                    href={auditPath}
                    data-broadcast-audit-link
                  >
                    {itemLabel(doneCopy, "audit")}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {sent.actionId}
                  </span>
                </p>
              </>
            ) : (
              <p className="text-sm text-destructive">{refusalText(copy, sent.code)}</p>
            )}
          </CardContent>
        </Card>
      )}

      {broken && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{refusalText(copy, "failed")}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{sendsCopy.heading ?? copy.heading}</CardTitle>
          <CardDescription>{sectionBody(sendsCopy)}</CardDescription>
        </CardHeader>
        <CardContent>
          {sends.length === 0 ? (
            <p className="text-sm text-muted-foreground">{itemLabel(sendsCopy, "empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{itemLabel(sendsCopy, "when")}</TableHead>
                  <TableHead>{itemLabel(sendsCopy, "subject")}</TableHead>
                  <TableHead>{itemLabel(sendsCopy, "segment")}</TableHead>
                  <TableHead className="text-right">{itemLabel(sendsCopy, "count")}</TableHead>
                  <TableHead>{itemLabel(sendsCopy, "hash")}</TableHead>
                  <TableHead>{itemLabel(sendsCopy, "mode")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sends.map((row) => (
                  <TableRow key={row.id} data-broadcast-send-row={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDateTimeLong(row.createdAt)}
                    </TableCell>
                    <TableCell>{row.subject}</TableCell>
                    <TableCell>
                      {row.segment === SEGMENT_SINCE && row.segmentSince !== null
                        ? fillLabel(itemLabel(sendsCopy, "segment-since"), {
                            date: formatDate(row.segmentSince),
                          })
                        : itemLabel(sendsCopy, "segment-all")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.recipientCount}</TableCell>
                    <TableCell className="font-mono text-xs">{row.bodyHash.slice(0, 16)}</TableCell>
                    <TableCell>
                      <Badge variant={row.keyMode === "live" ? "success" : "warning"}>
                        {row.keyMode}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
