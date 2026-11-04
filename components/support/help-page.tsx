"use client";

// template-ancestor: components/explore/explore-quizzes-page.tsx   (variation: the public help hub — a sticky category filter and two answer panels, with no contact form anywhere in the page)

import type { PageCopy } from "@/content/pages";
import { sectionOf } from "@/lib/page-copy";
import { useRef, useState } from "react";
import type { SupportCategory } from "./category";
import { type HelpTab, HelpHeader } from "./help-header";
import { KnowledgeBase } from "./knowledge-base";
import { SupportCategories, SupportCategoryChips } from "./support-categories";
import { SupportFAQ } from "./support-faq";

interface HelpPageProps {
  /** The route's whole fixture (`data/pages/help.ts`); each panel takes its own section. */
  copy: PageCopy;
}

/**
 * The public help centre: the category filter, the FAQ and the knowledge base.
 *
 * **The two columns, and why they collapsed** (owner, 2026-11-04). The rail and the answers were
 * meant to sit side by side at `md` and up, but the answers carried `md:col-span-3` inside a grid
 * that declares two tracks (`200px minmax(0,1fr)`). A span larger than the track count creates
 * implicit columns, so the answer panel was pushed to a *second row* under a full-height list of
 * categories: measured at 1440 before this card, the rail sat at y=265 and the FAQ at y=627, and
 * the reported experience is exactly that — click, then scroll to the bottom to see what you
 * clicked. One column count, no spans, and the panel is beside the rail again.
 *
 * **Sticky, in both shapes.** At `md` and up the rail is `md:sticky md:top-24`, so it stays in
 * view while a long FAQ scrolls past it and a click lands on an answer already on screen. Below
 * `md` the filter is the same six choices as one horizontally scrolling chip row pinned under the
 * marketing header (`top-20`, its 80px bar), because a card of six stacked rows is ~300px of
 * furniture between the tab a reader pressed and the answer they pressed it for. The chip row is
 * outside the grid so it can stick against the section rather than against its own short cell.
 *
 * Both shapes are drawn by `support-categories.tsx` from one list and one selection, so the narrow
 * row and the wide rail can never disagree about what is selected or what a build offers.
 *
 * **No contact form, by construction.** The old `/support` hub mounted one behind a third tab and
 * apologised for it in its own banner (#290). This page has two tabs, neither of them a form; the
 * form and the band that says where a person is are the route's next row
 * (`components/contact/contact-section.tsx`), where the band is the column beside the form.
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
  const chipBarRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * A choice of category, and — below `md` — the panel brought back under the filter row.
   *
   * Tapping a chip while the answers have scrolled up behind it used to change the list somewhere
   * above the viewport: the reader tapped a filter and saw nothing move, then scrolled up to find
   * the answer. `scroll-mt-36` on the panel leaves the header (81px) and the pinned chip row
   * (53px) clear, so the panel's own heading and its first row land at the top of what the reader
   * can see. The comparison does the shape decision by itself: at `md` and up the chip bar is
   * `display: none` and its bottom is 0, so the rail never moves the page — the panel is already
   * beside it.
   */
  function chooseCategory(category: SupportCategory) {
    setSelectedCategory(category);
    const panel = panelRef.current;
    const bar = chipBarRef.current;
    if (panel === null || bar === null) return;
    if (panel.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom) return;
    panel.scrollIntoView({ block: "start" });
  }

  return (
    <div className="marketing-container py-8">
      <HelpHeader activeTab={activeTab} setActiveTab={setActiveTab} copy={copy} />

      {/* Narrow: one scrolling row of filters, pinned under the sticky header (h-20). */}
      <div
        ref={chipBarRef}
        className="sticky top-20 z-10 -mx-6 mt-6 border-b bg-background/95 px-6 py-2 backdrop-blur md:hidden"
      >
        <SupportCategoryChips
          selectedCategory={selectedCategory}
          setSelectedCategory={chooseCategory}
          copy={categories}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-8 md:mt-8 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[220px_minmax(0,1fr)]">
        {/*
          The rail's cell is stretched to the row's height by the grid's default `stretch`, which
          is what gives the sticky card room to travel; `min-w-0` on the panel stops a long answer
          from widening the track.
        */}
        <div className="hidden md:block">
          <div className="sticky top-24">
            <SupportCategories
              selectedCategory={selectedCategory}
              setSelectedCategory={chooseCategory}
              copy={categories}
            />
          </div>
        </div>

        <div ref={panelRef} className="min-w-0 scroll-mt-36">
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
    </div>
  );
}
