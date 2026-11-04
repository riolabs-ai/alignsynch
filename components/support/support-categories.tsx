"use client";

// template-ancestor: components/ui/card.tsx   (variation: the category cards — one per subject with an icon, a count and a description)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { FileQuestion, HelpCircle, Lock, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";
import { supportCategories, type SupportFaqCategory } from "@/data/support-categories";
import type { SupportCategory } from "./category";

interface SupportCategoriesProps {
  selectedCategory: SupportCategory;
  setSelectedCategory: (category: SupportCategory) => void;
  copy: PageCopySection;
}

/**
 * The rail's icons, one per answered category. The words are the `help-categories` items,
 * keyed by id.
 */
const ICONS: Record<SupportFaqCategory, ReactNode> = {
  account: <Users className="h-4 w-4" />,
  "quiz-creation": <FileQuestion className="h-4 w-4" />,
  privacy: <Lock className="h-4 w-4" />,
  technical: <Settings className="h-4 w-4" />,
  general: <HelpCircle className="h-4 w-4" />,
};

/**
 * The rail's order: the filter sentinel first, then every category this build offers.
 *
 * It is **derived** from `data/support-categories.ts` (#288, #313), not written a second time, so
 * a category cannot appear in the rail with no row behind it — selecting one used to be an empty
 * panel. The list is the build's, so the alignment product does not offer "Quiz Creation" for a
 * product with no quizzes; `content/article.ts` keeps that slug for QuizHub's articles.
 */
const CATEGORIES: { id: SupportCategory; icon: ReactNode }[] = [
  { id: "all", icon: <HelpCircle className="h-4 w-4" /> },
  ...supportCategories.map((id) => ({ id, icon: ICONS[id] })),
];

export function SupportCategories({
  selectedCategory,
  setSelectedCategory,
  copy,
}: SupportCategoriesProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-2">
          {CATEGORIES.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "ghost"}
              /**
               * The label wraps inside the rail (#539 item 9), and the selected row is the
               * tinted panel rather than a solid one (#539 item 3).
               *
               * **The overrun, measured before this card:** at 768 the rail is one column of
               * four (`md:col-span-1`, 168px) and the row's content box is 134px, while
               * `whitespace-nowrap` (the Button primitive's own class) forced "Technical
               * Issues" to paint 159px — 25px outside its own button and 8px outside the rail,
               * at 1024 the same label sits in a 190px row and fits, so the bug only showed in
               * one band. `whitespace-normal` + `break-words` + `min-w-0` let the label take a
               * second line instead, which is the honest answer for a label: a truncated
               * "Technical Issu…" is a worse row than a taller one. `h-auto`/`py-2` is what
               * lets the row grow, and the icon is `shrink-0` so it keeps its 16px square.
               *
               * The selected state was `bg-action text-white` — the heaviest fill in the page,
               * on the smallest control. It is now the template's tinted-panel treatment
               * (QuizHub's own active rows are a soft `accent` ground, not a solid brand
               * block): `bg-action/10` with an inset `ring-action/20` and `text-action`, so the
               * accent says "this one" without repainting the rail. Catalogued in
               * `docs/ui-registry.md` under `/help`.
               */
              className={cn(
                "h-auto w-full min-w-0 justify-start whitespace-normal rounded-md px-3 py-2 text-left leading-snug",
                selectedCategory === category.id
                  ? "bg-action/10 font-medium text-action ring-1 ring-inset ring-action/20 hover:bg-action/15"
                  : "text-muted-foreground",
              )}
              onClick={() => setSelectedCategory(category.id)}
            >
              <span className="mr-2 shrink-0">{category.icon}</span>
              <span className="min-w-0 break-words">{itemLabel(copy, category.id)}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
