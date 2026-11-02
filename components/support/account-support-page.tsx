// template-ancestor: components/ui/card.tsx   (variation: the account support page — a contact-form card beside three bands of the same shape, each a heading, a paragraph and its rows)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";
import { ContactForm } from "./contact-form";

interface AccountSupportPageProps {
  /** The route's whole fixture (`data/pages/support.ts`), one section per band. */
  copy: PageCopy;
  /** The brand's mailbox, from the brand record — the form's honest fallback address. */
  supportEmail: string;
}

/**
 * The account support page: the contact form, and the three bands that tell the truth about it.
 *
 * **Server component.** Every word arrives from the fixture, the form is the one client island
 * (`contact-form.tsx`), and nothing here reads a session — the route module resolved it before
 * mounting this page (`app/(mainlayout)/support/page.tsx`), which is what keeps the redirect and
 * the render in one decision instead of two.
 *
 * **The auxiliary content is the card's judgement, made concrete.** `what-this-form-does` states
 * the form's real state (no sender, nothing stored, write to the mailbox instead);
 * `what-to-include` names the three things a support message needs (the relationship, the page and
 * browser, what was expected); `where-else` links the public help centre and the account's own
 * settings, which answer most of what reaches support without a reply.
 */
export function AccountSupportPage({ copy, supportEmail }: AccountSupportPageProps) {
  const contact = sectionOf(copy, "contact");
  const formState = sectionOf(copy, "what-this-form-does");
  const include = sectionOf(copy, "what-to-include");
  const whereElse = sectionOf(copy, "where-else");

  return (
    <div className="container mx-auto max-w-6xl py-8">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight">{copy.heading}</h1>
        {copy.subtitle !== undefined && (
          <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ContactForm
            copy={contact}
            categoryCopy={sectionOf(copy, "help-categories")}
            supportEmail={supportEmail}
          />
        </div>

        <div className="space-y-6">
          <InfoCard section={formState} body={sectionBody(formState)}>
            <BandRows section={formState} ids={["not-sent", "not-stored", "write-instead"]} />
          </InfoCard>

          <InfoCard section={include} body={sectionBody(include)}>
            <BandRows section={include} ids={["relationship", "browser", "expected"]} />
          </InfoCard>

          <InfoCard section={whereElse} body={sectionBody(whereElse)}>
            {/*
              The two destinations are the page's own links, not fixture hrefs: the labels are copy
              (`where-else`), and E10 reads the literal `href`s here exactly as it reads the rail's.
            */}
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/help">{itemLabel(whereElse, "help")}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/settings">{itemLabel(whereElse, "settings")}</Link>
              </Button>
            </div>
          </InfoCard>
        </div>
      </div>
    </div>
  );
}

/** One auxiliary band: the heading and paragraph from the fixture, then whatever it carries. */
function InfoCard({
  section,
  body,
  children,
}: {
  section: PageCopySection;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{section.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{body}</p>
        {children}
      </CardContent>
    </Card>
  );
}

/** An item's label and paragraph, one row each — the shape the three bands share. */
function BandRows({ section, ids }: { section: PageCopySection; ids: readonly string[] }) {
  return (
    <ul className="mt-4 space-y-3">
      {ids.map((id) => (
        <li key={id}>
          <p className="text-sm font-medium">{itemLabel(section, id)}</p>
          <p className="text-sm text-muted-foreground">{itemBody(section, id)}</p>
        </li>
      ))}
    </ul>
  );
}
