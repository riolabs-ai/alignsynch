// template-ancestor: components/ui/card.tsx   (variation: the contact band — a heading, one sentence and the link to the one public form)

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import Link from "next/link";

/**
 * The support page's contact band: what the form is, and where it is.
 *
 * **Why a link and not a form** (owner, 2026-11-02). This slot used to mount `ContactForm` — four
 * fields, a category select and a submit control that was permanently disabled, above a banner
 * apologising that nothing typed there would leave the page (#290). A second, weaker copy of a
 * form is not a contact path; it is a promise the page cannot keep, and it also printed an
 * address-shaped example placeholder on a public route.
 *
 * There is exactly one form now, on `/help`, and it is the real one: it stores the message in
 * Postgres first and mails it second (`app/api/contact/route.ts`), so a failed send is still a
 * received message. This component renders that fact and the link to it, and nothing else.
 *
 * **No words here.** The heading, the sentence and the link's label are
 * `data/pages/support.ts`'s `contact` band; `data:check` E23 holds this file to a budget of 0
 * literals and checks `cta.href` against the route manifest.
 */
export function ContactPointer({ copy }: { copy: PageCopySection }) {
  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">{copy.heading}</h2>
      {copy.body !== undefined && (
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{copy.body}</p>
      )}
      {copy.cta !== undefined && (
        <Button asChild variant={"action"} className="mt-6">
          <Link href={copy.cta.href}>{copy.cta.label}</Link>
        </Button>
      )}
    </Card>
  );
}
