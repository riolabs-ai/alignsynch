"use client";

/**
 * template-ancestor: components/admin/template-editor.tsx   (variation: the same editor band — one field set, then the save/publish pair — with the words previewed through the real band as they are typed, a version list that restores by saving, and no Aspect editor because a mail has one body and no items)
 *
 * `/admin/email-templates/<id>` — one transactional mail, its override and its history (#1138).
 *
 * **The preview is the server's, on every keystroke.** The band is a pure function but the register
 * is a set of functions, so the browser cannot render a mail it cannot be handed. Instead the page
 * passes `onPreview`, a server action that calls the same `previewEmailTemplate()` the save path's
 * rule comes from; this component calls it 250 ms after typing stops and draws what comes back. So
 * the preview cannot disagree with what a send would render, and a refusal arrives **as a refusal**
 * — the words are not drawn, the problem is named (#1138 requirement 3: "it must fail the same
 * checks as a Counterparty screen").
 *
 * **Draft, published and default are three different texts, and the form says which it is showing.**
 * The fields open on the draft, else the published words, else the code default; the source note
 * above them names which. A save writes a draft; Publish promotes the *stored* draft, so leaving the
 * form dirty and pressing Publish publishes what was last saved, not what is on screen — which is
 * the behaviour the issue asks for ("a draft does not change production mail until Publish") and the
 * one an operator is most likely to get wrong, hence the note rather than a silent surprise.
 *
 * **Restore is a save.** A history row's "Restore to draft" posts that row's words through the same
 * `onSave` the form uses, so a restore is audited, validated and drafted exactly like an edit — there
 * is no second write path to forget a rule in.
 *
 * **No new control.** The field set is #1138's (subject, preheader, body), the chips are that
 * template's own `placeholders`, the buttons are the four the issue names (Save draft, Publish,
 * Reset to Default, Send Test), and the version list is requirement 7's. Nothing here is drawn that
 * the issue does not ask for.
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/content/core";
import type { EmailClass } from "@/lib/email/band";
import type { EmailRecipient } from "@/lib/email/templates/index";
import type { OverrideProblem } from "@/lib/email/override";
import type {
  EmailTemplateOutcome,
  EmailTemplatePost,
  EmailTemplatePreview,
  EmailTemplateState,
} from "@/lib/admin/email-templates";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { useEffect, useRef, useState, useTransition } from "react";
import { refusalLabel } from "./email-template-registry";

/** What the page hands over: the default, the live rows and the history, all as values. */
export interface EmailTemplateEditorViewProps {
  readonly id: string;
  readonly numeral: number;
  readonly emailClass: EmailClass;
  readonly recipient: EmailRecipient;
  readonly editable: boolean;
  readonly placeholders: readonly string[];
  readonly defaultSubject: string;
  readonly defaultPreheader: string;
  readonly defaultBody: string | null;
  /**
   * The first paint's preview: the draft (or the published words, or the default) already rendered
   * through the band on the server. The client shows this until the first keystroke replaces it, so
   * the screen is never an empty `<pre>` waiting for a round trip.
   */
  readonly initialText: string;
  readonly initialHtml: string;
  readonly published?: {
    readonly version: number;
    readonly subject: string;
    readonly preheader: string;
    readonly body: string;
  };
  readonly draft?: {
    readonly subject: string;
    readonly preheader: string;
    readonly body: string;
  };
  readonly versions: readonly {
    readonly id: string;
    readonly version: number;
    readonly status: EmailTemplateState | "retired";
    readonly subject: string;
    readonly preheader: string;
    readonly body: string;
    readonly editorUserId: string;
    readonly createdAt: string;
  }[];
}

/** What a test send answers: the transport's three outcomes, or the refusal that stopped it. */
export type EmailTemplateTestOutcome =
  | { readonly ok: true; readonly outcome: "sent" | "unset" | "failed" }
  | { readonly ok: false; readonly code: string; readonly problems?: readonly OverrideProblem[] };

/** The fields one save carries — the post shape, minus the id this component supplies. */
export type EmailTemplateFields = Omit<EmailTemplatePost, "templateId">;

/** The tone a state gets, matching the list's. */
const STATE_VARIANT: Record<string, "secondary" | "success" | "outline"> = {
  default: "outline",
  draft: "secondary",
  published: "success",
  retired: "outline",
};

/** One labelled field: a label, the input, and the id both share. */
function Field({
  id,
  label,
  value,
  onChange,
  multiline,
  readOnly,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline === true ? (
        <Textarea
          id={id}
          value={value}
          readOnly={readOnly === true}
          rows={10}
          className="font-mono text-xs"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          readOnly={readOnly === true}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

/** The problems behind a refusal, as the fixture's one sentence each. */
function ProblemList({
  problems,
  refusals,
}: {
  problems: readonly OverrideProblem[];
  refusals: PageCopySection;
}) {
  if (problems.length === 0) return null;
  return (
    <ul data-email-template-problems className="space-y-1 text-sm">
      {problems.map((problem) => (
        <li key={`${problem.code}:${problem.detail ?? ""}`}>
          {refusalLabel(refusals, problem.code)}
          {problem.detail === undefined ? null : (
            <span className="ml-1 font-mono text-xs">{problem.detail}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function EmailTemplateEditor({
  copy,
  view,
  onSave,
  onPublish,
  onReset,
  onTest,
  onPreview,
}: {
  copy: PageCopy;
  view: EmailTemplateEditorViewProps;
  onSave: (post: EmailTemplatePost) => Promise<EmailTemplateOutcome>;
  onPublish: (post: { templateId: string }) => Promise<EmailTemplateOutcome>;
  onReset: (post: { templateId: string }) => Promise<EmailTemplateOutcome>;
  onTest: (post: EmailTemplatePost) => Promise<EmailTemplateTestOutcome>;
  onPreview: (post: EmailTemplatePost) => Promise<EmailTemplatePreview>;
}) {
  const fields = sectionOf(copy, "fields");
  const previewSection = sectionOf(copy, "preview");
  const actions = sectionOf(copy, "actions");
  const versions = sectionOf(copy, "versions");
  const statuses = sectionOf(copy, "status");
  const classSection = sectionOf(copy, "class");
  const recipient = sectionOf(copy, "recipient");
  const refusals = sectionOf(copy, "refusals");
  const readOnly = sectionOf(copy, "read-only");

  const initial = view.draft ?? view.published;
  const [subject, setSubject] = useState(initial?.subject ?? view.defaultSubject);
  const [preheader, setPreheader] = useState(initial?.preheader ?? view.defaultPreheader);
  const [body, setBody] = useState(initial?.body ?? view.defaultBody ?? "");
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ id: string } | null>(null);
  const [problems, setProblems] = useState<readonly OverrideProblem[]>([]);
  const [rendered, setRendered] = useState<EmailTemplatePreview | null>(null);
  const firstPreview = useRef(true);

  /** Every call carries the register id, so the actions this screen posts to need no closure. */
  const postOf = (fields: EmailTemplateFields): EmailTemplatePost => ({
    templateId: view.id,
    ...fields,
  });
  // The live preview: 250 ms after typing stops, one server render, drawn as it comes back. The
  // timer is the only state this effect owns, and it is cleared on every keystroke so a slow reply
  // cannot overwrite a newer one.
  //
  // The post is built here rather than through `postOf` so the dependency list stays the three
  // fields it really depends on: a helper defined in the render would be a new identity every
  // keystroke, and listing it would re-arm the timer on renders that changed nothing.
  useEffect(() => {
    if (!view.editable) return;
    if (firstPreview.current) {
      firstPreview.current = false;
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        setRendered(await onPreview({ templateId: view.id, subject, preheader, body }));
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [body, onPreview, preheader, subject, view.editable, view.id]);

  function run(kind: string, work: () => Promise<void>): void {
    setNotice(null);
    setProblems([]);
    setBusy(kind);
    startTransition(async () => {
      await work();
      setBusy(null);
    });
  }

  function save(next: EmailTemplateFields, done: string): void {
    run(done, async () => {
      const outcome = await onSave(postOf(next));
      if (outcome.ok) {
        setNotice({ id: done });
        return;
      }
      setProblems(outcome.problems ?? []);
      setNotice({ id: outcome.code });
    });
  }

  const shown: EmailTemplatePreview = rendered ?? {
    ok: true,
    subject: view.defaultSubject,
    text: view.initialText,
    html: view.initialHtml,
    overridden: false,
  };
  const sourceNote =
    view.draft !== undefined
      ? itemLabel(fields, "draft-source")
      : view.published !== undefined
        ? itemLabel(fields, "published-source")
        : itemLabel(fields, "default-source");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="font-mono text-base">{view.id}</span>
          </CardTitle>
          <CardDescription>
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{itemLabel(classSection, view.emailClass)}</Badge>
              <Badge variant="outline">{itemLabel(recipient, view.recipient)}</Badge>
              <Badge
                variant={
                  STATE_VARIANT[
                    view.published !== undefined
                      ? "published"
                      : view.draft !== undefined
                        ? "draft"
                        : "default"
                  ]
                }
              >
                {itemLabel(
                  statuses,
                  view.published !== undefined
                    ? "published"
                    : view.draft !== undefined
                      ? "draft"
                      : "default",
                )}
              </Badge>
              {view.published !== undefined && view.draft !== undefined ? (
                <Badge variant="secondary">{itemLabel(statuses, "draft")}</Badge>
              ) : null}
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      {view.editable ? (
        <Card>
          <CardHeader>
            <CardTitle>{fields.heading}</CardTitle>
            <CardDescription>{sectionBody(fields)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p data-email-template-source className="text-sm text-muted-foreground">
              {sourceNote}
            </p>
            <Field
              id="email-subject"
              label={itemLabel(fields, "subject")}
              value={subject}
              onChange={setSubject}
            />
            <Field
              id="email-preheader"
              label={itemLabel(fields, "preheader")}
              value={preheader}
              onChange={setPreheader}
            />
            <Field
              id="email-body"
              label={itemLabel(fields, "body")}
              value={body}
              multiline
              onChange={setBody}
            />
            <div className="flex flex-col gap-2">
              <Label>{itemLabel(fields, "chips")}</Label>
              <ul data-email-template-chips className="flex flex-wrap gap-2">
                {view.placeholders.map((name) => (
                  <li key={name}>
                    <code className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">
                      {`{{${name}}}`}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => save({ subject, preheader, body }, "saved")}
              >
                {busy === "saved" ? itemLabel(actions, "saving") : itemLabel(actions, "save")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null || view.draft === undefined}
                onClick={() =>
                  run("published", async () => {
                    const outcome = await onPublish({ templateId: view.id });
                    if (outcome.ok) {
                      setNotice({ id: "published" });
                      return;
                    }
                    setProblems(outcome.problems ?? []);
                    setNotice({ id: outcome.code });
                  })
                }
              >
                {busy === "published"
                  ? itemLabel(actions, "publishing")
                  : itemLabel(actions, "publish")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  busy !== null || (view.published === undefined && view.draft === undefined)
                }
                onClick={() =>
                  run("reset-done", async () => {
                    const outcome = await onReset({ templateId: view.id });
                    if (outcome.ok) {
                      setNotice({ id: "reset-done" });
                      return;
                    }
                    setNotice({ id: outcome.code });
                  })
                }
              >
                {busy === "reset-done"
                  ? itemLabel(actions, "resetting")
                  : itemLabel(actions, "reset")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  run("test", async () => {
                    const outcome = await onTest(postOf({ subject, preheader, body }));
                    if (!outcome.ok) {
                      setProblems(outcome.problems ?? []);
                      setNotice({ id: outcome.code });
                      return;
                    }
                    // A test that the provider refused is `test-failed`; a deployment with no key
                    // never attempted a send and says so, which is a different sentence.
                    setNotice({
                      id:
                        outcome.outcome === "sent"
                          ? "test-note"
                          : outcome.outcome === "unset"
                            ? "unset"
                            : "test-failed",
                    });
                  })
                }
              >
                {busy === "test" ? itemLabel(actions, "testing") : itemLabel(actions, "test")}
              </Button>
            </div>
            {notice === null ? null : (
              <p data-email-template-notice={notice.id} className="text-sm">
                {refusalLabel(refusals, notice.id)}
              </p>
            )}
            <ProblemList problems={problems} refusals={refusals} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{readOnly.heading}</CardTitle>
            <CardDescription>{sectionBody(readOnly)}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{previewSection.heading}</CardTitle>
          <CardDescription>{sectionBody(previewSection)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{itemLabel(previewSection, "sample")}</p>
          {!shown.ok ? (
            <div
              data-email-template-preview-refused
              className="rounded-lg border border-border p-4"
            >
              <p className="font-medium">{itemLabel(previewSection, "refused")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {itemLabel(previewSection, "refused-body")}
              </p>
              <ProblemList problems={shown.problems} refusals={refusals} />
            </div>
          ) : (
            <>
              {shown.overridden ? (
                <p data-email-template-preview-overridden className="text-sm text-muted-foreground">
                  {itemLabel(previewSection, "overridden")}
                </p>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label>{itemLabel(previewSection, "text")}</Label>
                <pre
                  data-email-template-preview-text
                  className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs whitespace-pre-wrap"
                >
                  {shown.text}
                </pre>
              </div>
              <div className="flex flex-col gap-2">
                <Label>{itemLabel(previewSection, "html")}</Label>
                <pre
                  data-email-template-preview-html
                  className="overflow-x-auto rounded-lg border border-border bg-muted/30 p-4 text-xs"
                >
                  {shown.html}
                </pre>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{versions.heading}</CardTitle>
          <CardDescription>{sectionBody(versions)}</CardDescription>
        </CardHeader>
        <CardContent>
          {view.versions.length === 0 ? (
            // Rule 7: an empty list draws a bordered block, not a bare sentence in the space —
            // "no version yet" is a state the screen is in, and a line of grey text reads as a
            // layout that failed to load.
            <div
              data-email-template-no-versions
              className="rounded-lg border bg-muted/40 p-6 text-sm text-muted-foreground"
            >
              {itemLabel(versions, "none")}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {["version", "status", "editor", "at", "restore"].map((id) => (
                    <TableHead key={id}>{itemLabel(versions, id)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.versions.map((version) => (
                  <TableRow key={version.id} data-email-template-version={version.id}>
                    <TableCell className="tabular-nums">{version.version}</TableCell>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[version.status] ?? "outline"}>
                        {version.status === "retired"
                          ? itemLabel(versions, "retired")
                          : itemLabel(statuses, version.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{version.editorUserId}</TableCell>
                    <TableCell>{formatDate(version.createdAt)}</TableCell>
                    <TableCell>
                      {view.editable ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() =>
                            save(
                              {
                                subject: version.subject,
                                preheader: version.preheader,
                                body: version.body,
                              },
                              "restored",
                            )
                          }
                        >
                          {busy === "restored"
                            ? itemLabel(versions, "restoring")
                            : itemLabel(versions, "restore")}
                        </Button>
                      ) : null}
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
