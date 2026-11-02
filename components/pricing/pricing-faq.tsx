"use client";

// template-ancestor: components/support/support-faq.tsx   (variation: the FAQ with a search field and brand-keyed categories)

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import type { Brand } from "@/content/brand";
import type { PageCopySection } from "@/content/pages";
import { brand } from "@/data/brand";
import { fillLabel, itemLabel } from "@/lib/page-copy";
import { Search } from "lucide-react";
import { useState } from "react";

/** One group of FAQ rows, as the accordion renders it. */
export type PricingFaqCategory = {
  name: string;
  questions: { question: string; answer: string }[];
};

/**
 * The FAQ rows, as a function of the brand.
 *
 * The rows themselves are record-shaped blocks with no schema in P2 (see
 * `data/pages/pricing.ts`, "not here, on purpose"), so they stay in this feature. What
 * they must not own is the product's name: a sentence that spells it is a sentence a
 * second brand cannot render, so every row below reads `brand.name` (and the contact
 * line reads `brand.supportEmail`) and the projection is what `tests/brand-shell.test.ts`
 * renders with a different record.
 *
 * **These are the questions this product can answer (owner, 2026-11-02).** The page carried the
 * QuizHub FAQ — what quizzes you can build, how quiz generation works — and those are not this
 * product. Rather than reword another product's answer, the rows that had no counterpart here
 * were deleted, and the rows below describe what the build actually does: a two-party alignment
 * assessment, a template the practice authors, a blind answer from each side, the report, the
 * Gap and its Steps, the coach seat, and the data the app holds. Nothing here claims a customer,
 * a rating, an earnings figure or a feature behind no code.
 */
export function pricingFaqCategories(
  brand: Pick<Brand, "name" | "supportEmail">,
): PricingFaqCategory[] {
  return [
    {
      name: "The assessment",
      questions: [
        {
          question: `What is ${brand.name}?`,
          answer: `${brand.name} runs a two-party alignment assessment. You pick a relationship type, keep the Aspects you actually work on, and send the assessment to the two people in that relationship. Each answers the same Aspects separately, blind to the other's answers — and the report shows where they align, and the Gap where they don't.`,
        },
        {
          question: `How do I get started with ${brand.name}?`,
          answer:
            "Sign up for a free account, start from a template in the library or write the Aspects yourself, and send the invitation link to the other party. Once both people have answered and accepted their sheets, the report is ready to read.",
        },
        {
          question: "What is a Gap?",
          answer:
            "The distance between two answers on the same Aspect. Basic Mode asks how the relationship feels to each side and how each wishes it to be, so the Feel Gap and the Wish Gap fall out of the pair. Advanced Mode adds Think and Guess. The report names every Gap by kind and size, and the Steps that follow from it.",
        },
        {
          question: "Can I use my own questions?",
          answer:
            "Yes — a template is yours. You write the Aspects for one relationship type, the things you actually ask about in session, and the same template runs with every relationship of that type. The templates already in the library are starting points to edit or ignore.",
        },
        {
          question: "Who can see my answers before I submit?",
          answer:
            "Nobody but you. A party reads their own sheet and nothing else until the session is complete, and a session is complete when both parties have accepted their answers — not merely submitted them. The coach reads nothing before then either, so the report cannot be shaped by the person running the session.",
        },
      ],
    },
    {
      name: "Plans",
      questions: [
        {
          question: `Can I try ${brand.name} before purchasing?`,
          answer:
            "Yes. The Free plan works today: one active relationship at a time and Basic Mode, with no card and no subscription. A paid plan is bought through a card checkout, monthly or yearly; in this release that checkout runs on test keys, so no card is charged.",
        },
        {
          question: "What is the difference between Basic Mode and Advanced Mode?",
          answer:
            "Basic Mode asks two questions of every Aspect: how it feels to each side, and how each wishes it to be — Feel and Wish, which produce the Feel Gap and the Wish Gap. Advanced Mode adds Think and Guess. The Free plan is Basic Mode only; both paid plans include both modes.",
        },
        {
          question: "Can I cancel or change plans?",
          answer: `Not from inside the app yet: the subscription panel in settings is a mock — it changes what it displays, not what you are charged. Write to ${brand.supportEmail} and a plan change is made by hand.`,
        },
      ],
    },
    {
      name: "Account & Security",
      questions: [
        {
          question: `How secure is my data on ${brand.name}?`,
          answer:
            "Here is what the app actually does. Traffic between it and its database is encrypted in transit. We never hold your password: sign-in runs through Neon's Managed Auth, which owns the credential, and this app has no password column of its own. Your assessment data lives in Neon's managed Postgres, in us-east-2. The only emails this app sends are two transactional ones — an invitation, and a notice when the other party has answered — and there is no marketing email; it loads no analytics or advertising tracker, so nothing here profiles your visit. We hold no certification and have commissioned no independent audit.",
        },
        {
          question: "Can I delete my account and data?",
          answer: `Not from inside the app yet: the settings screen draws the delete control, but the action is not wired up, and there is no self-serve way to remove an account. Ask at ${brand.supportEmail} and the account and its data are removed by hand.`,
        },
      ],
    },
  ];
}

export function PricingFaq({ copy }: { copy: PageCopySection }) {
  const [searchQuery, setSearchQuery] = useState("");

  /** The rows, with the product name and the contact address read from the record. */
  const faqCategories = pricingFaqCategories(brand);

  // Filter questions based on search query
  const filteredFaqs = searchQuery
    ? faqCategories
        .map((category) => ({
          ...category,
          questions: category.questions.filter(
            (q) =>
              q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              q.answer.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
        }))
        .filter((category) => category.questions.length > 0)
    : faqCategories;

  return (
    <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
      <div className="container px-4 mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{copy.heading}</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {copy.body}
          </p>

          <div className="mt-8 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="search"
                placeholder={itemLabel(copy, "search-placeholder")}
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          {filteredFaqs.map((category) => (
            <div key={category.name} className="mb-8">
              <h3 className="text-xl font-semibold mb-4">{category.name}</h3>
              <Accordion type="single" collapsible className="space-y-4">
                {category.questions.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    value={`${category.name}-${index}`}
                    className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-800 shadow-sm"
                  >
                    <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-700/50 font-medium text-left">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2 text-slate-600 dark:text-slate-300">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}

          {filteredFaqs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">
                {fillLabel(itemLabel(copy, "no-results"), { query: searchQuery })}
              </p>
              <p className="mt-2">
                {itemLabel(copy, "no-results-hint")}{" "}
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-action hover:text-action/80"
                >
                  {itemLabel(copy, "clear-search")}
                </button>
              </p>
            </div>
          )}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            {itemLabel(copy, "contact-prompt")}{" "}
            <a
              href={`mailto:${brand.supportEmail}`}
              className="text-action hover:text-action/80 font-medium"
            >
              {itemLabel(copy, "contact-email")}
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}
