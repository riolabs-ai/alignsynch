"use client";

// template-ancestor: components/support/support-faq.tsx   (variation: the accordion over the affiliate programme's own questions, no search and no groups)

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { PageCopySection } from "@/content/pages";
import { itemLabel, itemValue } from "@/lib/page-copy";
import { Link } from "lucide-react";

/** Which question renders in which position; the words are `itemLabel`/`itemValue` of the same id. */
const FAQ_IDS = [
  "how-it-works",
  "who-can-join",
  "how-much-can-i-earn",
  "when-paid",
  "cookie-duration",
  "promotional-materials",
  "social-media",
  "referral-limit",
] as const;

export function AffiliateFAQ({ copy }: { copy: PageCopySection }) {
  return (
    <section className="py-16 bg-slate-50 dark:bg-slate-800/50">
      <div className="container px-4 mx-auto">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{copy.heading}</h2>
          <p className="text-slate-600 dark:text-slate-400">{copy.body}</p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_IDS.map((id, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b border-slate-200 dark:border-slate-700"
              >
                <AccordionTrigger className="text-left font-medium py-4 hover:no-underline">
                  {itemLabel(copy, id)}
                </AccordionTrigger>
                <AccordionContent className="text-slate-600 dark:text-slate-400 pb-4">
                  {itemValue(copy, id)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-12 text-center">
          <p className="mb-4 text-slate-600 dark:text-slate-400">
            {itemLabel(copy, "still-have-questions")}
          </p>
          <Link
            href="#"
            className="inline-flex items-center text-primary hover:underline font-medium"
          >
            {itemLabel(copy, "contact-support")}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 ml-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
