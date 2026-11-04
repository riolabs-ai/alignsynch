"use client";

// template-ancestor: components/ui/card.tsx   (variation: the category filter — a card of rows on md+, a scrolling chip row below it)

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PageCopySection } from "@/content/pages";
import { itemLabel } from "@/lib/page-copy";
import { cn } from "@/lib/utils";
import { FileQuestion, HelpCircle, Lock, Settings, Users } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { supportCategories, type SupportFaqCategory } from "@/data/support-categories";
import type { SupportCategory } from "./category";

interface SupportCategoriesProps {
  selectedCategory: SupportCategory;
  setSelectedCategory: (category: SupportCategory) => void;
  copy: PageCopySection;
}

/**
 * The filter's icons, one per answered category. The words are the `help-categories` items,
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
 * The filter's order: the sentinel first, then every category this build offers.
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

/**
 * The one selected-state treatment both shapes paint.
 *
 * It was `bg-action text-white` — the heaviest fill in the page, on the smallest control. It is
 * now the template's tinted-panel treatment (QuizHub's own active rows are a soft `accent` ground,
 * not a solid brand block): `bg-action/10` with an inset `ring-action/20` and `text-action`, so the
 * accent says "this one" without repainting the rail. Catalogued in `docs/ui-registry.md` under
 * `/help`.
 */
const SELECTED =
  "bg-action/10 font-medium text-action ring-1 ring-inset ring-action/20 hover:bg-action/15";

/**
 * Keep the chosen chip inside the row after a tap.
 *
 * The row is 342px wide at 390 and the six filters are wider than that, so the fifth and sixth are
 * off-screen until the row is scrolled; selecting one by keyboard or by a partly visible tap would
 * otherwise leave the row showing a stretch of filters with the active one just outside it. The
 * row is `position: relative`, so `offsetLeft` is measured from the row's own content box.
 */
function centreChip(row: HTMLDivElement | null, chip: HTMLElement) {
  if (row === null) return;
  const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
  row.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}

/**
 * The filter as the vertical rail beside the answers — the shape for `md` and up.
 *
 * **The label wraps inside the rail (#539 item 9).** **The overrun, measured before that card:** at
 * 768 the rail was one column of four (168px) and the row's content box 134px, while
 * `whitespace-nowrap` (the Button primitive's own class) forced "Technical Issues" to paint 159px —
 * 25px outside its own button and 8px outside the rail; at 1024 the same label sits in a 190px row
 * and fits, so the bug only showed in one band. `whitespace-normal` + `break-words` + `min-w-0` let
 * the label take a second line instead, which is the honest answer for a label: a truncated
 * "Technical Issu…" is a worse row than a taller one. `h-auto`/`py-2` is what lets the row grow, and
 * the icon is `shrink-0` so it keeps its 16px square.
 */
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
              aria-pressed={selectedCategory === category.id}
              className={cn(
                "h-auto w-full min-w-0 justify-start whitespace-normal rounded-md px-3 py-2 text-left leading-snug",
                selectedCategory === category.id ? SELECTED : "text-muted-foreground",
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

/**
 * The same six filters as one horizontally scrolling row — the shape for below `md`.
 *
 * A card of six stacked rows is ~300px of furniture between the tab a reader just pressed and the
 * answer they pressed it for, which is the owner's report of `/help` verbatim ("click then scroll
 * to the bottom to see what you click"). One row of chips is ~40px, sits under the tab band, and
 * the answers begin immediately below it. `overflow-x-auto` is on this row, never on the page: the
 * page itself must not scroll sideways at any width, and a filter row that did not scroll would
 * wrap into the stacked card this shape exists to remove.
 *
 * Both shapes read `CATEGORIES` and the caller's one selection, so the narrow row and the wide rail
 * cannot disagree about what a build offers or about what is chosen.
 */
export function SupportCategoryChips({
  selectedCategory,
  setSelectedCategory,
  copy,
}: SupportCategoriesProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <fieldset className="min-w-0">
      {/* The rail's own heading, resolved from the fixture rather than typed here. */}
      <legend className="sr-only">{copy.heading}</legend>
      <div
        ref={rowRef}
        className="relative flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CATEGORIES.map((category) => (
          <Button
            key={category.id}
            variant="ghost"
            aria-pressed={selectedCategory === category.id}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-sm",
              selectedCategory === category.id
                ? SELECTED
                : "text-muted-foreground ring-1 ring-inset ring-border",
            )}
            onClick={(event) => {
              setSelectedCategory(category.id);
              centreChip(rowRef.current, event.currentTarget);
            }}
          >
            <span className="mr-1.5 shrink-0">{category.icon}</span>
            <span className="whitespace-nowrap">{itemLabel(copy, category.id)}</span>
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
