// template-ancestor: components/assessment-flow/template-form.tsx   (variation: the public contact form — three fields, one submit, no captcha)

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";

/**
 * The public contact form: a name, a reply address, a message, one submit.
 *
 * **No CAPTCHA, and no third-party script** (owner, 2026-11-02: "no dependancy capthca"). What
 * stands in for one is invisible to a person and useless to a script:
 *
 *   - `website` — a honeypot. It is inside a `hidden` wrapper, out of the tab order and hidden
 *     from assistive tech; a person never sees it, and a bot that fills every field is caught by
 *     the route handler, which answers with the ordinary success page and writes nothing.
 *   - `startedAt` — the instant the page rendered, carried in a hidden input. A submit sooner
 *     than `CONTACT_MIN_FILL_MS` is a script's, and the same silent answer applies.
 *   - the per-client rate limit, counted in Postgres by `app/api/contact/route.ts`.
 *
 * **It is a plain HTML form.** `method="post"` and `action="/api/contact"` mean it works with
 * JavaScript off, with no client state, no `"use client"` and nothing to hydrate — which is also
 * why this file is a server component and why the submission cannot silently do nothing. A 303
 * comes back to `/help?contact=…` and the page renders the matching sentence from its fixture.
 *
 * **No words here.** Every label, placeholder and the submit's text resolve from
 * `data/pages/help.ts` through `itemLabel`, and E23 fails the build on a literal in this file.
 * The one string-shaped attribute that is *not* copy is `autoComplete="name"` / `"email"` — the
 * W3C tokens a password manager reads, which E23 already classifies as markup.
 */
export function ContactForm({
  copy,
  startedAt,
}: {
  /** `data/pages/help.ts`'s `form` band. */
  copy: PageCopySection;
  /** The instant this render happened — the minimum-fill rule's only input. */
  startedAt: number;
}) {
  return (
    <form method="post" action="/api/contact" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">{itemLabel(copy, "name")}</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          maxLength={120}
          required
          placeholder={itemLabel(copy, "name-placeholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{itemLabel(copy, "email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          placeholder={itemLabel(copy, "email-placeholder")}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">{itemLabel(copy, "message")}</Label>
        <Textarea
          id="message"
          name="message"
          rows={6}
          maxLength={5000}
          required
          placeholder={itemLabel(copy, "message-placeholder")}
        />
      </div>

      {/*
        The honeypot. `hidden` keeps it out of the layout, `aria-hidden` out of the accessibility
        tree, and `tabIndex={-1}` out of the tab order — a person with a keyboard never lands in
        it. The label is `sr-only` rather than absent so the field is not an unlabelled input for
        a stray screen reader; its words are the fixture's like every other string here.
      */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="website">{itemLabel(copy, "honeypot")}</Label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <input type="hidden" name="startedAt" value={startedAt} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" variant={"action"}>
          {itemLabel(copy, "submit")}
        </Button>
        <p className="text-sm text-muted-foreground">{itemLabel(copy, "note")}</p>
      </div>
    </form>
  );
}
