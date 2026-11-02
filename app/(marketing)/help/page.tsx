import { HelpPage } from "@/components/support/help-page";
import { brand } from "@/data/brand";
import { helpPageCopy } from "@/data/pages/help";
import type { Metadata } from "next";

export const metadata: Metadata = {
  /** One string, `<h1>` and `<title>` alike: the fixture's heading. */
  title: helpPageCopy.heading,
  description: `Answers, FAQs and articles for ${brand.name}`,
};

/**
 * `/help` — the public help centre, in the marketing chrome.
 *
 * **Why it is in `(marketing)` and not `(mainlayout)`.** This is the split's public half: FAQ and
 * knowledge base, no contact form, and no app shell — a reader with no account is exactly who this
 * page is for, and a sidebar full of destinations they cannot open would be chrome promising them
 * the product. The route group is the mechanism (#317), not an `if`: the page gets the public
 * header, the public footer, and nothing else.
 *
 * **It is not `/support` renamed.** `/support` still exists, one route group over, as the account
 * page a signed-in member reaches; a signed-out request there is redirected back here. The two
 * pages share their panels (`components/support/**`) and their taxonomy, and they deliberately do
 * not share a contact form: a public form that cannot send is the defect the old hub apologised
 * for in its own banner, and the honest public surface is answers.
 *
 * The page is a client island (`help-page.tsx`) because the two answer panels are tabbed; the
 * words, the tab labels and the "need a person" band are all `data/pages/help.ts`, so no sentence
 * is written in the component (E23, budget 0).
 */
export default function Help() {
  return <HelpPage copy={helpPageCopy} />;
}
