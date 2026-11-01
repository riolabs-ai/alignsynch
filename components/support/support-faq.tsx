"use client";

// template-ancestor: components/ui/accordion.tsx   (variation: the FAQ — brand-keyed groups, a search field and one accordion per group)

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
import { brand, brandIdOf, brands, type BrandId } from "@/data/brand";
import {
  isSupportFaqCategory,
  supportCategories,
  type SupportFaqCategory,
} from "@/data/support-categories";
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

/** One product's rows, every category present — see `SupportFaqRows` below. */
export type SupportFaqRows = Record<SupportFaqCategory, SupportFaqQuestion[]>;

/** What a product's rows are a function of: the name it prints and the mailbox it answers at. */
type SupportFaqWriter = (brand: Pick<Brand, "name" | "supportEmail">) => SupportFaqRows;

/**
 * The rows both products answer with the same words, because both products have these facts.
 *
 * One copy and not two: the account form, the privacy sentence and the "reload, then write to us"
 * answer describe the tree, not a product, and a second copy is a second place for the wording to
 * drift apart. A row belongs here only while the surface it names is the same module on both
 * brands — `components/support/**` and `app/(mainlayout)/settings` are, which is why these three
 * categories are shared and `general` is not.
 */
function sharedFaqRows(
  brand: Pick<Brand, "name" | "supportEmail">,
): Pick<SupportFaqRows, "account" | "privacy" | "technical"> {
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
  };
}

/**
 * QuizHub's rows — the quiz product's own words, unchanged.
 *
 * These are the rows `/support` has shipped since #288: two authoring answers and the two `general`
 * rows that send a reader to `/explore`, `/create/editor` and `/creator-tips`. Every one of those
 * destinations is a page this build mounts, so the rows are facts here and a defect on the other
 * brand — which is exactly why they are no longer the only set (`alignSynchFaqRows`).
 */
function quizHubFaqRows(brand: Pick<Brand, "name" | "supportEmail">): SupportFaqRows {
  return {
    ...sharedFaqRows(brand),
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

/**
 * AlignSynch's rows — the assessment product's words, about what this build does, and naming only
 * its own routes.
 *
 * The two `general` answers used to be QuizHub's: they sent the reader to `/explore`, `/create/editor`
 * and `/creator-tips`, and #300 (`product.quiz-surfaces`) answers 404 for all three on this build.
 * A support page is the one surface a reader believes while nothing else works, so its worst
 * failure is a confident instruction that lands on a 404 — the same defect class as #309, with
 * fewer words around it.
 *
 * Every sentence below names something in this tree, in the words of the code that does it:
 *
 *   /assessment           the published templates, each with the create form (#146)
 *   the create form       name, the other person's name and their email (#146)
 *   one submission        `createInstanceFromTemplate()` writes the instance, the Initiator's seat
 *                         and the invitation together (`lib/flow/store.ts`)
 *   the invitation link   a single-use token (`lib/flow/tokens.ts`), drawn on the instance screen
 *                         whenever it exists, emailed or not (#220, #257)
 *   seven days            `INVITE_TTL_MS`, the column `expires_at` is written from
 *   neither reads first   `lib/flow` freezes the answers once both parties submit; the report is
 *                         the first place the two sets meet, and a Gap is its subtraction
 *                         (`content/record.ts::gapOf`)
 *
 * What is absent is the point: no row names a catalogue, an editor, creator tips, a tournament or a
 * plan, because this build ships none of them. The one thing these rows cannot do is make the
 * product sound like the other one with the noun swapped, which is what the shared rows above are
 * for and why they are shared rather than copied.
 */
function alignSynchFaqRows(brand: Pick<Brand, "name" | "supportEmail">): SupportFaqRows {
  return {
    ...sharedFaqRows(brand),
    /**
     * Nothing, and that is the row: this product has no authoring surface for a reading, so the
     * category has no answers. It is not offered either — `supportCategoriesByBrand.alignsynch`
     * leaves `quiz-creation` out, so the rail cannot select it and the "all" flatten cannot reach
     * it — but the key stays present because `SupportFaqRows` is a `Record`, and a product that has
     * nothing to say under a category should say so here rather than leave it undefined for a
     * caller to trip over.
     */
    "quiz-creation": [],
    general: [
      {
        question: `What is ${brand.name}?`,
        answer: `${brand.name} asks you and one other person the same questions about your relationship, once for how it is now and once for how you wish it to be, and puts the two sets of answers side by side so you can see the Gap between them. You start from a template at /assessment and read the report once you have both answered.`,
      },
      {
        question: "How do I get started?",
        answer:
          "Create an account at /register, then open /assessment and choose a template. The form asks for your name, the other person's name and their email address, and one submission creates the instance and an invitation for them. The invitation is a single-use link that stays claimable for seven days, and the instance screen shows it to you to pass on, emailed or not. You answer every question before either of you can read the other's answers.",
      },
      {
        question: "How do I contact support?",
        answer: `Email ${brand.supportEmail}. Include the page you were on and what you expected to happen, and for a bug, what happened instead.`,
      },
    ],
  };
}

/**
 * The rows, per product — the same `Record<BrandId, …>` shape `data/knowledge-base.ts` and
 * `data/support-categories.ts` use, so a third brand fails `tsc` until somebody writes its rows
 * instead of silently inheriting the quiz product's `/explore`.
 *
 * The rows stay in this feature rather than in `data/`: they are record-shaped blocks with no
 * schema in P2 (`content/article.ts` has no `Faq`), the same split `components/pricing/pricing-faq.tsx`
 * uses. What they are not is brand-blind — the two writers above are the two products, and the
 * table is what keeps the choice one place.
 */
export const supportFaqRowsByBrand: Readonly<Record<BrandId, SupportFaqWriter>> = {
  quizhub: quizHubFaqRows,
  alignsynch: alignSynchFaqRows,
};

/**
 * The rows one product answers, by the id `BRAND` takes.
 *
 * An id and not a `Brand` record, for the same reason `supportCategoriesFor` takes one: the record
 * carries no id of its own, and pairing a record with a table key is a pair that can disagree. Here
 * the id *is* the product — the writer reads its name and mailbox out of `data/brand.ts` — so
 * "AlignSynch's rows under QuizHub's name" is not a call anybody can make. A brand added to the
 * table without a key fails `tsc`; a key without a writer fails it too.
 */
export function supportFaqGroups(brandId: BrandId): SupportFaqRows {
  return supportFaqRowsByBrand[brandId](brands[brandId]);
}

export function SupportFAQ({ selectedCategory, copy, categoryCopy }: SupportFAQProps) {
  const [searchQuery, setSearchQuery] = useState("");

  /**
   * The rows **this build** answers: the taxonomy and the rows are resolved from the same id, so a
   * build cannot offer a category it has no answers for, or answer with another product's words.
   */
  const allFaqs = supportFaqGroups(brandIdOf(brand));

  /**
   * A category the rail does not offer has no rows, and an empty panel is the bug #288
   * removed the empty categories to avoid: anything that is not one of these falls back to
   * the whole list rather than to "No FAQs found".
   */
  const category: SupportFaqCategory | "all" = isSupportFaqCategory(selectedCategory)
    ? selectedCategory
    : "all";

  const faqs =
    category === "all" ? supportCategories.flatMap((id) => allFaqs[id]) : allFaqs[category];

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
