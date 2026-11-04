import { ContactSection } from "@/components/contact/contact-section";
import { HelpPage } from "@/components/support/help-page";
import { brand } from "@/data/brand";
import { helpPageCopy } from "@/data/pages/help";
import { contactStateOf } from "@/lib/contact/validation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  /** One string, `<h1>` and `<title>` alike: the fixture's heading. */
  title: helpPageCopy.heading,
  description: `Answers, FAQs and articles for ${brand.name}`,
};

/**
 * The contact form's `startedAt` is read on every request, so the page cannot be prerendered: a
 * build-time instant would make the minimum-fill rule fire on a timestamp that is hours old, and
 * every submission would pass a check it never ran. `force-dynamic` is the rule `/explore` carries
 * for its campaign window — a value that is a function of "now" belongs to the request.
 */
export const dynamic = "force-dynamic";

/**
 * `/help` — the public help centre, in the marketing chrome, plus the one contact form.
 *
 * **Why it is in `(marketing)` and not `(mainlayout)`.** This is the split's public half: FAQ,
 * knowledge base and the contact form, with no app shell — a reader with no account is exactly
 * who this page is for, and a sidebar full of destinations they cannot open would be chrome
 * promising them the product. The route group is the mechanism (#317), not an `if`: the page gets
 * the public header, the public footer, and nothing else.
 *
 * **Two bands, two jobs** (owner, 2026-11-02). The answers come first — `HelpPage`, the split's
 * page — and the form follows under them (`ContactSection`), because a form is what a reader
 * wants *after* the FAQ failed them. That row carries two columns at `md` and up: the form, and
 * the "need a person" band beside it (owner, 2026-11-04). The band used to sit at the foot of the
 * help centre, which put the alternative to the form below the form rather than beside it. There
 * used to be three contact paths: an address link in the
 * footer, one on the pricing page, and a disabled form on `/support`. There is one now, here, and
 * it stores the message in Postgres before it mails it (`app/api/contact/route.ts`).
 *
 * **No address is rendered on this page.** The mailbox is the brand record's `supportEmail`, read
 * on the server and never printed: a form cannot be scraped for an address, and a visitor without
 * a mail client can still reach a person.
 *
 * The help bands are a client island (`help-page.tsx`) because the two answer panels are tabbed;
 * the words, the tab labels, the "need a person" band and every label of the form are all
 * `data/pages/help.ts`, so no sentence is written in a component (E23, budget 0).
 */
export default async function Help({
  searchParams,
}: {
  /** Next 16: a Promise, and the only input the outcome band has. */
  searchParams: Promise<{ contact?: string | string[] }>;
}) {
  const query = await searchParams;
  const state = contactStateOf(query.contact);

  return (
    <>
      <HelpPage copy={helpPageCopy} />
      <ContactSection copy={helpPageCopy} state={state} startedAt={Date.now()} />
    </>
  );
}
