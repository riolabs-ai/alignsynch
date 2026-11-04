// template-ancestor: components/ui/card.tsx   (variation: the account support page — a contact-form card beside three bands of the same shape, each a heading, a paragraph and its rows)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeavingLink } from "@/components/layout/leaving-link";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { itemBody, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";
import { ContactPointer } from "./contact-pointer";

interface AccountSupportPageProps {
  /** The route's whole fixture (`data/pages/support.ts`), one section per band. */
  copy: PageCopy;
}

/**
 * The account support page: the contact band, and the three bands that tell the truth about it.
 *
 * **Server component.** Every word arrives from the fixture, and nothing here reads a session —
 * the route module resolved it before mounting this page (`app/(mainlayout)/support/page.tsx`),
 * which is what keeps the redirect and the render in one decision instead of two.
 *
 * **The contact band is a link, not a form** (owner, 2026-11-02). `ContactPointer` sends the
 * reader to `/help`, where the one form stores the message before mailing it; this page used to
 * mount a second form whose submit was permanently disabled. The auxiliary content still earns
 * its place: `what-this-form-does` states what happens to a message (stored first, mailed
 * second), `what-to-include` names the three things a support message needs (the relationship,
 * the page and browser, what was expected), and `where-else` links the public help centre and the
 * account's own settings, which answer most of what reaches support without a reply.
 */
export function AccountSupportPage({ copy }: AccountSupportPageProps) {
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
          <ContactPointer copy={contact} />
        </div>

        <div className="space-y-6">
          <InfoCard section={formState} body={sectionBody(formState)}>
            <BandRows section={formState} ids={["stored", "mailed", "reply"]} />
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
                <LeavingLink href="/help" label={itemLabel(whereElse, "help")} />
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
