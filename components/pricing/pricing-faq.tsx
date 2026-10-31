"use client";

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
 * The list is pruned to the questions this app can answer today (#286). A row whose
 * honest answer is "there is no such feature" is a row that sells something the build
 * does not contain, so the seven that had no code behind them were removed rather than
 * reworded into a denial. Nothing was widened to fill the space: the generator row names
 * the template library it actually reads, and the deletion row names the mailbox because
 * the settings button it would otherwise point at does nothing.
 */
export function pricingFaqCategories(
  brand: Pick<Brand, "name" | "supportEmail">,
): PricingFaqCategory[] {
  return [
    {
      name: "General",
      questions: [
        {
          question: `What is ${brand.name}?`,
          answer: `${brand.name} is a comprehensive platform that allows users to create, share, and take quizzes on various topics. It's designed for educators, content creators, businesses, and quiz enthusiasts who want to create engaging learning experiences.`,
        },
        {
          question: `How do I get started with ${brand.name}?`,
          answer:
            "Getting started is easy! Simply sign up for a free account, explore the dashboard, and create your first quiz using our intuitive editor. You can also take existing quizzes to get familiar with the platform.",
        },
        {
          question: `Can I try ${brand.name} before purchasing?`,
          answer:
            "Nothing is charged while you are trying it: there is no paid subscription to manage yet, so there is no checkout, no billing cycle, and no card on file. You can use the app and see what it does first.",
        },
      ],
    },
    {
      name: "Features",
      questions: [
        {
          question: "What types of quizzes can I create?",
          answer: `${brand.name} builds a quiz from multiple-choice questions: each question offers a list of named answers, at least two, and one of them is marked correct. Its second template, the assessment, asks each item on a fixed five-point band, 1 to 5, and names the value at each end of that band. Those two response scales — a list of options and the 1-to-5 band — are the whole question model, and a question is its prompt plus its scale.`,
        },
        {
          question: "How does quiz generation work?",
          answer:
            "It assembles a draft from the built-in template library and retitles it with your topic. No language model is involved: it does not read the topic for meaning and does not write new questions, it selects existing templates and puts your topic in their titles, so the draft is a starting point to edit.",
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
