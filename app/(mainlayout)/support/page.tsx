import { SupportPage } from "@/components/support/support-page";
import { supportPageCopy } from "@/data/pages/support";
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - QuizHub",
  description: "Get help and support for your QuizHub  account",
};

export default function Support() {
  return (
    <SupportPage
      hero={supportPageCopy}
      categories={sectionOf(supportPageCopy, "help-categories")}
      faqs={sectionOf(supportPageCopy, "faqs")}
      contact={sectionOf(supportPageCopy, "contact")}
      knowledgeBase={sectionOf(supportPageCopy, "knowledge-base")}
    />
  );
}
