"use client";

import type { SupportCategory } from "@/content/article";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { useState } from "react";
import { ContactForm } from "./contact-form";
import { KnowledgeBase } from "./knowledge-base";
import { SupportCategories } from "./support-categories";
import { SupportFAQ } from "./support-faq";
import { SupportHeader } from "./support-header";

/** Re-exported from the content model — a second hand-written copy of this
 * union was drift D16. */
export type { SupportCategory } from "@/content/article";

/**
 * The support hub's shell. Every panel's words arrive as a section from
 * `data/pages/support.ts` via the route module and are forwarded untouched; the hero
 * takes the whole `PageCopy` because it renders the route's `h1` and `subtitle`, and
 * `categories` is the one shared list of taxonomy names that the rail, the contact
 * select and both panel headings read.
 */
interface SupportPageProps {
  hero: PageCopy;
  categories: PageCopySection;
  faqs: PageCopySection;
  contact: PageCopySection;
  knowledgeBase: PageCopySection;
}

export function SupportPage({ hero, categories, faqs, contact, knowledgeBase }: SupportPageProps) {
  const [activeTab, setActiveTab] = useState<"faq" | "contact" | "knowledge">("faq");
  const [selectedCategory, setSelectedCategory] = useState<SupportCategory>("all");

  return (
    <div className="container mx-auto py-4">
      <SupportHeader activeTab={activeTab} setActiveTab={setActiveTab} copy={hero} />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-1">
          <SupportCategories
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            copy={categories}
          />
        </div>

        <div className="md:col-span-3">
          {activeTab === "faq" && (
            <SupportFAQ selectedCategory={selectedCategory} copy={faqs} categoryCopy={categories} />
          )}
          {activeTab === "contact" && (
            <ContactForm
              selectedCategory={selectedCategory}
              copy={contact}
              categoryCopy={categories}
            />
          )}
          {activeTab === "knowledge" && (
            <KnowledgeBase
              selectedCategory={selectedCategory}
              copy={knowledgeBase}
              categoryCopy={categories}
            />
          )}
        </div>
      </div>
    </div>
  );
}
