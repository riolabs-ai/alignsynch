"use client";

// template-ancestor: components/explore/explore-quizzes-page.tsx   (variation: the public help hub — a category rail and two answer panels, with no contact form anywhere in the page)

import { Button } from "@/components/ui/button";
import type { PageCopy } from "@/content/pages";
import { sectionBody, sectionOf } from "@/lib/page-copy";
import Link from "next/link";
import { useState } from "react";
import type { SupportCategory } from "./category";
import { type HelpTab, HelpHeader } from "./help-header";
import { KnowledgeBase } from "./knowledge-base";
import { SupportCategories } from "./support-categories";
import { SupportFAQ } from "./support-faq";

interface HelpPageProps {
  /** The route's whole fixture (`data/pages/help.ts`); each panel takes its own section. */
  copy: PageCopy;
}

/**
 * The public help centre: the category rail, the FAQ and the knowledge base.
 *
 * **No contact form, by construction.** The old `/support` hub mounted one behind a third tab and
 * apologised for it in its own banner (#290). This page has two tabs, neither of them a form, and
 * the band at the foot of the page tells a reader where a person is instead of pretending to be
 * one — the account page inside the app, which opens for a signed-in member.
 *
 * The panels are the shipped ones (`support-faq.tsx`, `knowledge-base.tsx`,
 * `support-categories.tsx`), not copies: one FAQ, one article grid and one taxonomy for both
 * surfaces, so the answers cannot drift between the public page and the account page that links
 * back here.
 */
export function HelpPage({ copy }: HelpPageProps) {
  const [activeTab, setActiveTab] = useState<HelpTab>("faq");
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory>("all");
  const categories = sectionOf(copy, "help-categories");
  const human = sectionOf(copy, "human");
  const humanCta = human.cta;

  return (
    <div className="container mx-auto py-8">
      <HelpHeader activeTab={activeTab} setActiveTab={setActiveTab} copy={copy} />

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-4">
        <div className="md:col-span-1">
          <SupportCategories
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            copy={categories}
          />
        </div>

        <div className="md:col-span-3">
          {activeTab === "faq" ? (
            <SupportFAQ
              selectedCategory={selectedCategory}
              copy={sectionOf(copy, "faqs")}
              categoryCopy={categories}
            />
          ) : (
            <KnowledgeBase
              selectedCategory={selectedCategory}
              copy={sectionOf(copy, "knowledge-base")}
              categoryCopy={categories}
            />
          )}
        </div>
      </div>

      {/*
        The one band about a person. Its words are the fixture's (`human`), and its destination is
        the account page — `/support`, which redirects a signed-out click back here. The band says
        that out loud, so the redirect is a stated rule rather than a surprise.
      */}
      <section className="mt-8 rounded-lg border bg-muted/40 p-6 md:flex md:items-center md:justify-between md:gap-8">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold">{human.heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{sectionBody(human)}</p>
        </div>
        {humanCta !== undefined && (
          <Button asChild className="mt-4 shrink-0 md:mt-0">
            <Link href={humanCta.href}>{humanCta.label}</Link>
          </Button>
        )}
      </section>
    </div>
  );
}
