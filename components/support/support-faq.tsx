"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Brand } from "@/content/brand";
import type { PageCopySection } from "@/content/pages";
import { brand } from "@/data/brand";
import { itemLabel } from "@/lib/page-copy";
import { Search } from "lucide-react";
import { useState } from "react";
import type { SupportCategory } from "./support-page";

interface SupportFAQProps {
  selectedCategory: SupportCategory;
  copy: PageCopySection;
  categoryCopy: PageCopySection;
}

/** One FAQ row: the question and the answer the accordion shows under it. */
export type SupportFaqQuestion = { question: string; answer: string };

/**
 * The categories that have answers (#288).
 *
 * This list is the whole taxonomy the support page offers, and `support-categories.tsx`
 * builds the rail from it, so a category cannot be selectable and empty: adding a key here
 * without rows, or a row under a key that is not here, is the bug this constant prevents.
 *
 * Two members of `KB_CATEGORY_SLUGS` are absent — the two this issue removed answers for —
 * and that union in `content/article.ts` stays as it is, because the knowledge-base fixture
 * carries one article per category and those files are not this surface's. What was removed
 * is the claim, not the slug: those rows priced a subscription, a payout path and a prize
 * for a business this app has no provider, table or route for. A support FAQ whose job is
 * to deny features is worse than a shorter one.
 *
 * The rows that remain each name something in this tree: `app/(mainlayout)/settings`,
 * `app/(mainlayout)/profile/[username]`, `content/record.ts`'s two scales, the create
 * editor, and `brand.supportEmail`. Nothing here answers with a date, a vendor the code
 * does not integrate with, a support-hours figure, or a promise.
 */
export const SUPPORT_FAQ_CATEGORIES = [
  "account",
  "quiz-creation",
  "privacy",
  "technical",
  "general",
] as const;

export type SupportFaqCategory = (typeof SUPPORT_FAQ_CATEGORIES)[number];

/** Is this the union's filter sentinel, or a category this file actually answers? */
export function isSupportFaqCategory(category: SupportCategory): category is SupportFaqCategory {
  return (SUPPORT_FAQ_CATEGORIES as readonly SupportCategory[]).includes(category);
}

/**
 * The support FAQ rows, as a function of the brand.
 *
 * The rows are record-shaped blocks with no schema in P2, so they stay in this feature
 * (the same split `components/pricing/pricing-faq.tsx` uses). The product's name and its
 * support address are not copy: every row that prints one reads it from the record, so
 * `supportFaqGroups(alignSynch)` differs from the shipped render in those words and
 * nothing else.
 */
export function supportFaqGroups(
  brand: Pick<Brand, "name" | "supportEmail">,
): Record<SupportFaqCategory, SupportFaqQuestion[]> {
  return {
    account: [
      {
        question: "How do I edit my profile?",
        answer:
          "Open Account Settings (/settings) and change your display name, handle, bio or country, then save. The first save creates your profile; after that the same form updates it.",
      },
      {
        question: "Can I change my username?",
        answer:
          "Your username is the handle in Account Settings, and it is also your profile address. Change it whenever you need to; the one rule is that a handle belongs to one person, so a name somebody else already holds will not save.",
      },
      {
        question: "Who can see my profile?",
        answer:
          "Anyone who opens your profile address. That page shows your display name, handle, bio and country, and nothing else about your account. Only you can change it, from Account Settings.",
      },
    ],
    "quiz-creation": [
      {
        question: "How do I write a quiz?",
        answer:
          "The editor is at /create/editor. It takes a title, a summary, your questions, and settings for the time limit, passing score, visibility and retakes. Your work stays in the browser while you edit it — saving and publishing confirm on screen but do not write a record.",
      },
      {
        question: "What kinds of questions can a quiz have?",
        answer:
          "Every question is a prompt plus one of two response scales: a set of named options, where one option is the answer, or a five-point 1–5 band. A question with options can also carry an explanation, which a player sees with the answer.",
      },
    ],
    privacy: [
      {
        question: "What does the app store about me?",
        answer:
          "Two things. Your sign-in — email and password — belongs to the managed auth service the app signs in through, and the app never reads or stores your password. Your profile — display name, handle, bio and country — is a row in the app's own database, written when you save Account Settings.",
      },
    ],
    technical: [
      {
        question: "A page looks out of date, or a button does nothing. What should I try?",
        answer: `Reload the page. If it still looks wrong, clear this site's data, sign in again and retry the action. If it keeps happening, email ${brand.supportEmail} with the page you were on and what you saw.`,
      },
    ],
    general: [
      {
        question: `What is ${brand.name}?`,
        answer: `${brand.name} is a web app for taking quizzes and drafting your own: browse the catalogue at /explore, play a quiz, and open /create/editor to write one.`,
      },
      {
        question: "How do I get started?",
        answer:
          "Create an account at /register, then open /explore and play one. When you want to write your own, /create/editor opens the editor, and /creator-tips collects what makes a question work.",
      },
      {
        question: "How do I contact support?",
        answer: `Email ${brand.supportEmail}. Include the page you were on and what you expected to happen, and for a bug, what happened instead.`,
      },
    ],
  };
}

export function SupportFAQ({ selectedCategory, copy, categoryCopy }: SupportFAQProps) {
  const [searchQuery, setSearchQuery] = useState("");

  /** The rows, with the product name and the support address read from the record. */
  const allFaqs = supportFaqGroups(brand);

  /**
   * A category the rail does not offer has no rows, and an empty panel is the bug #288
   * removed the empty categories to avoid: anything that is not one of these falls back to
   * the whole list rather than to "No FAQs found".
   */
  const category: SupportFaqCategory | "all" = isSupportFaqCategory(selectedCategory)
    ? selectedCategory
    : "all";

  const faqs =
    category === "all" ? SUPPORT_FAQ_CATEGORIES.flatMap((id) => allFaqs[id]) : allFaqs[category];

  // Filter FAQs based on search query
  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Card className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h2 className="text-2xl font-bold">
          {itemLabel(categoryCopy, category)} {copy.heading}
        </h2>
        <div className="relative w-full md:w-64 mt-4 md:mt-0">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={itemLabel(copy, "search-placeholder")}
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredFaqs.length > 0 ? (
        <Accordion type="single" collapsible className="w-full">
          {filteredFaqs.map((faq) => (
            <AccordionItem key={faq.question} value={faq.question}>
              <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted-foreground">{itemLabel(copy, "empty")}</p>
        </div>
      )}
    </Card>
  );
}
