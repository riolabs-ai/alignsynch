// template-ancestor: components/contact/contact-form.tsx   (variation: the in-app request form — the reader is signed in, so the name and address are the account's and read-only, the message is the only field, and the submit is a server action that returns to this page instead of the public help centre)

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";

/**
 * The dashboard's contact form (#542 phase 1): one field a person fills, two it reads, one submit.
 *
 * **The identity is the session's, not the form's.** Name and address are rendered from the
 * signed-in account as read-only inputs — they are the same three columns `contact_message` stores,
 * so the row is indistinguishable from one the public form wrote, but nobody can type somebody
 * else's address into it. That is also what makes the confirmation honest: the page reads the row
 * back by id *and* by this account's address, so a message it can confirm is a message it wrote.
 *
 * **A server action, not `action="/api/contact"`.** The public route answers a 303 to `/help`,
 * which would throw a signed-in reader out of the workspace mid-task; this form's action stores the
 * message through `lib/contact/submit.ts` (the same ordering: spam, validation, throttle, store,
 * mail) and redirects back to `/dashboard/support` with the outcome. The page renders the sentence.
 *
 * **The honeypot and the fill-time field are carried the same way the public form carries them** —
 * `website` inside a `hidden` wrapper out of the tab order, and `startedAt` from the render. A bot
 * that fills every field or posts instantly gets the ordinary success answer and writes nothing;
 * a person never notices either.
 *
 * **No words here.** Every label, placeholder and the submit resolve from
 * `data/pages/dashboard-support.ts` through `itemLabel`, which is what holds this file at 0 copy
 * literals (E23).
 */
export function SupportRequestForm({
  copy,
  name,
  email,
  startedAt,
  action,
}: {
  /** The fixture's `form` band. */
  copy: PageCopySection;
  /** The account's display name, as the session resolved it. */
  name: string;
  /** The account's address — the reply goes here, and it is also the row's authorization key. */
  email: string;
  /** The instant this render happened, for the minimum-fill rule. */
  startedAt: number;
  /** The server action the page hands down (`app/(mainlayout)/dashboard/support/actions.ts`). */
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="request-name">{itemLabel(copy, "name")}</Label>
          <Input id="request-name" name="name" value={name} readOnly autoComplete="name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="request-email">{itemLabel(copy, "email")}</Label>
          <Input
            id="request-email"
            name="email"
            type="email"
            value={email}
            readOnly
            autoComplete="email"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{itemLabel(copy, "email-note")}</p>

      <div className="space-y-2">
        <Label htmlFor="request-message">{itemLabel(copy, "message")}</Label>
        <Textarea
          id="request-message"
          name="message"
          rows={6}
          maxLength={5000}
          required
          placeholder={itemLabel(copy, "message-placeholder")}
        />
      </div>

      {/* The honeypot: invisible to a person, filled by a script. */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="request-website">{itemLabel(copy, "honeypot")}</Label>
        <input id="request-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <input type="hidden" name="startedAt" value={startedAt} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" variant="action">
          {itemLabel(copy, "submit")}
        </Button>
        <p className="text-sm text-muted-foreground">{itemLabel(copy, "note")}</p>
      </div>
    </form>
  );
}
