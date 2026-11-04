// template-ancestor: components/support/help-page.tsx   (variation: the contact band — an outcome line, the one form and nothing else)

import { Card } from "@/components/ui/card";
import type { PageCopy } from "@/content/pages";
import type { ContactState } from "@/lib/contact/validation";
import { itemOf, sectionBody, sectionOf } from "@/lib/page-copy";
import { ContactForm } from "./contact-form";

/**
 * `/help`'s contact band: the heading, the outcome line and the one form.
 *
 * **A section, not a page.** The route already renders the help centre
 * (`components/support/help-page.tsx`, the split's public half); this band is mounted under it so
 * a reader who did not find an answer can send a message without leaving the page. The page file
 * decides the order, this file decides the form's surroundings, and `contact-form.tsx` draws the
 * three fields.
 *
 * **The outcome is a query value.**
 * `/help?contact=sent|received|failed|invalid|throttled` is what `app/api/contact/route.ts`'s 303
 * writes, and the matching sentence is `data/pages/help.ts`'s `states` band. `sent` and `received`
 * are two sentences on purpose: `received` is what a stored message whose notification failed
 * gets, so it says the message is safe without claiming a delivery. `failed` says the row is not
 * there and does not thank the sender — there is no path that says "sent" for a message Postgres
 * refused.
 *
 * **No words here.** The heading, the sentence, the labels, the placeholders, the note, the
 * submit and the five outcomes all resolve from `data/pages/help.ts`; `data:check` E23 holds this
 * directory to a budget of zero literals.
 */
export function ContactSection({
  copy,
  state,
  startedAt,
}: {
  /** The route's whole fixture (`data/pages/help.ts`), one band per part of this section. */
  copy: PageCopy;
  /** The outcome the query named, or `undefined` for a plain visit. */
  state?: ContactState;
  /** Rendered into the form's hidden `startedAt` — the minimum-fill rule's only input. */
  startedAt: number;
}) {
  const contact = sectionOf(copy, "contact");
  const form = sectionOf(copy, "form");
  const states = sectionOf(copy, "states");
  /**
   * Resolved by id from the `states` band. `state` is already narrowed to `ContactState` by
   * `contactStateOf()` and the fixture carries one item per state, so this cannot miss; the
   * E23 id check cannot see a dynamic id, which is why the two lists are kept adjacent in
   * `lib/contact/validation.ts` and this file.
   */
  const band = state === undefined ? undefined : itemOf(states, state);
  const settled = state === "sent" || state === "received";

  return (
    <section id="contact" className="marketing-container pb-16">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {contact.heading}
        </h2>
        {contact.body !== undefined && (
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {sectionBody(contact)}
          </p>
        )}
      </div>

      {/*
        The outcome band sits directly under the heading, above the form a reader may be about to
        fill in again. `role="status"` because it is a state being told, not an alert demanding
        action, and the colour is `action` for a settled answer and `amber` for one that needs a
        retry — the same two hues the app uses everywhere else.
      */}
      {band !== undefined && (
        <div
          role="status"
          className={
            settled
              ? "mt-6 max-w-3xl rounded-md border border-action/40 bg-muted p-4"
              : "mt-6 max-w-3xl rounded-md border border-amber-300 bg-amber-50 p-4"
          }
        >
          <h3 className="font-semibold text-foreground">{band.label}</h3>
          {band.body !== undefined && (
            <p className="mt-1 text-sm text-muted-foreground">{band.body}</p>
          )}
        </div>
      )}

      <Card className="mt-8 max-w-3xl p-6 sm:p-8">
        <ContactForm copy={form} startedAt={startedAt} />
      </Card>
    </section>
  );
}
