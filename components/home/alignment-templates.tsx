"use client";

// template-ancestor: components/home/featured-quizzes.tsx   (variation: the templates band's three views behind one Tabs row — the QuizHub curation control, over a public catalogue, a built library and a session-gated door, with the panels themselves rendered on the server)

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ReactNode, useState } from "react";

/**
 * One view of the templates band: the value the toggle holds, the words on its trigger, and the
 * panel — which is built by the *server* component and handed in as a node.
 *
 * That split is the point. `components/home/featured-quizzes.tsx` and
 * `components/home/quizzes-by-difficulty.tsx` are the ancestor: a horizontal `TabsList` above the
 * cards, `value`/`onValueChange` over `useState`, the active trigger rendered distinct by the
 * primitive's own `data-[state=active]` styling. This file is that control and nothing else — it
 * holds no catalogue, imports no fixture, and reaches no database, so the marketing page's
 * client graph gains a tabs primitive and loses nothing else. `data:check` E34 walks exactly that
 * boundary, and a band that imported the taxonomy to draw its own cards would drag the fixture
 * (and zod with it) into the browser for no interaction at all.
 */
export interface TemplateView {
  readonly value: string;
  readonly label: string;
  /** The panel, rendered on the server and passed down — never a component this file imports. */
  readonly panel: ReactNode;
}

/**
 * The three-view toggle.
 *
 * `TabsContent` without `forceMount` unmounts the panels that are not active, so the served HTML
 * carries one view rather than three — which is what keeps a signed-out page's markup free of
 * anything it is not showing, and what makes "open the tab" the only way to see the other two.
 */
export function TemplateToggle({ views }: { views: readonly TemplateView[] }) {
  const [value, setValue] = useState(views[0]?.value ?? "");

  return (
    <Tabs className="mt-8" onValueChange={setValue} value={value}>
      {/*
        `h-auto flex-wrap` on narrow screens: the three labels are longer than 390px of viewport,
        and the rail's fixed height plus its inline-flex row pushed the last trigger past the
        right edge — the page then scrolled sideways under a thumb, which is the one layout bug a
        string assertion cannot see.
      */}
      <TabsList className="h-auto w-full flex-wrap justify-start sm:w-auto">
        {views.map((view) => (
          <TabsTrigger data-template-tab={view.value} key={view.value} value={view.value}>
            {view.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {views.map((view) => (
        <TabsContent
          className="mt-8"
          data-template-view={view.value}
          key={view.value}
          value={view.value}
        >
          {view.panel}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default TemplateToggle;
