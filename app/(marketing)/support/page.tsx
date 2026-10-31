import { SupportPage } from "@/components/support/support-page";
import { brand } from "@/data/brand";
import { supportPageCopy } from "@/data/pages/support";
import { sectionOf } from "@/lib/page-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: `Get help and support for your ${brand.name} account`,
};

/**
 * `/support` and its article pages are public surfaces (#317): they live in `app/(marketing)/`,
 * so the help centre a signed-out visitor reaches carries the marketing chrome and not the
 * product shell. `/pricing`, `/terms`, `/privacy` and `/` moved with them; `app/(auth)/` keeps its
 * own chrome, and every route behind the app keeps the shell.
 */
export default function Support() {
  return (
    <SupportPage
      hero={supportPageCopy}
      categories={sectionOf(supportPageCopy, "help-categories")}
      faqs={sectionOf(supportPageCopy, "faqs")}
      contact={sectionOf(supportPageCopy, "contact")}
      knowledgeBase={sectionOf(supportPageCopy, "knowledge-base")}
      supportEmail={brand.supportEmail}
    />
  );
}
