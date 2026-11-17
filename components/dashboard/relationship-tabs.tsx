"use client";

// template-ancestor: components/ui/tabs.tsx   (variation: the record's own section strip — hash-addressable, keyboard-driven, and every panel stays mounted so a deep link and a plain load draw the same record)
/**
 * #1124 — the six-tab layer of `/dashboard/relationships/[id]`.
 *
 * **The tabs do not decide anything; they only say which section is in front.** The relationship,
 * its seat rules and its write flags all arrive as props, and this file renders the strip and the
 * panels it was handed — so the same six tabs work for an Initiator, a Counterparty, a draft and a
 * paused relationship without a conditional in here.
 *
 * **Hash-addressable, in both directions.** `#aspects` opens the Aspects tab on load (that is the
 * link the bundle's own reference renders use), and switching a tab writes the hash back with
 * `history.replaceState` — never a push, because moving between two views of one record is not a
 * new page in the history and Back must leave the record, not step through its tabs.
 *
 * **Every panel stays mounted.** `forceMount` plus `data-[state=inactive]:hidden` keeps the
 * inactive sections in the document instead of unmounting them, which is what makes one page
 * carry six sections without six server round trips when a reader comes back to a tab — and it is
 * also why this layer can be asserted from a static render (`tests/relationship-detail-tabs.test.tsx`).
 * `hidden` is display:none, so an invisible panel is out of the accessibility tree and out of the
 * tab order exactly as an unmounted one would be.
 *
 * **Keyboard is Radix's, and it is real.** `role="tablist"`, roving `tabIndex`, Left/Right/Home/End
 * between triggers, `aria-selected` on the active one and `aria-controls`/`aria-labelledby` tying
 * each panel to its trigger. The strip is focus-visible (the primitive's ring), wraps rather than
 * overflowing at 360 px, and every trigger is at least 44 px tall so a thumb can hit it.
 *
 * The labels arrive as `tabs`, resolved from the route's fixture: E23 gives this route's copy a
 * budget of zero literals, and the owner's tab words are fixture strings, not component strings.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The tab ids, in the bundle's order. The hash is the id — one vocabulary, so a link and a
 * trigger can never disagree about what "the Aspects tab" is called.
 */
export const RELATIONSHIP_TAB_IDS = [
  "discussion",
  "aspects",
  "members",
  "details",
  "settings",
  "payment",
] as const;

export type RelationshipTabId = (typeof RELATIONSHIP_TAB_IDS)[number];

/**
 * Which tab a hash names, or `undefined` for a hash this page does not own (`#main`, an anchor a
 * sibling surface wrote, nothing at all). Pure and exported: the mapping is the one thing here a
 * test can pin without a DOM, and an unknown hash must leave the default tab in place rather than
 * blank the strip.
 */
export function relationshipTabFromHash(hash: string): RelationshipTabId | undefined {
  const value = hash.replace(/^#/, "").trim().toLowerCase();
  return (RELATIONSHIP_TAB_IDS as readonly string[]).includes(value)
    ? (value as RelationshipTabId)
    : undefined;
}

export function RelationshipTabs({
  label,
  emptyLabel,
  tabs,
  panels,
  initialTab = RELATIONSHIP_TAB_IDS[0],
}: {
  /** The tablist's accessible name, from the fixture. */
  label: string;
  /** What the strip says if it is handed no sections at all — E40's bordered block, not blank space. */
  emptyLabel: string;
  tabs: readonly { readonly id: string; readonly label: string }[];
  panels: Readonly<Record<string, ReactNode>>;
  initialTab?: RelationshipTabId;
}) {
  const [value, setValue] = useState<string>(initialTab);

  /*
   * Read the hash after mount, not during render: the server has no `window`, and a render that
   * consulted it would disagree with the HTML it hydrated (React #418, the hydration trap this
   * repo has already paid for). One effect, one listener, and an unknown hash changes nothing.
   */
  useEffect(() => {
    const apply = (): void => {
      const wanted = relationshipTabFromHash(window.location.hash);
      if (wanted !== undefined) setValue(wanted);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function select(next: string): void {
    setValue(next);
    /* `replace`, not `push`: the tabs are views of one record, and Back belongs to the list. */
    window.history.replaceState(null, "", `#${next}`);
  }

  return (
    <Tabs value={value} onValueChange={select} className="space-y-4" data-relationship-tabs="true">
      <TabsList
        aria-label={label}
        className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border bg-card p-1"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            data-relationship-tab={tab.id}
            className="min-h-11 flex-1 rounded-md px-3 text-sm font-medium data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-none sm:flex-none"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.length === 0 ? (
        /*
         * Rule 7 of the reference pattern set: a list with no rows draws an explicit block, never
         * blank space. Six sections always come from the fixture, so this is the guard that says a
         * broken binding out loud instead of rendering an empty page.
         */
        <p
          data-relationship-tabs-empty="true"
          className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground"
        >
          {emptyLabel}
        </p>
      ) : null}

      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          forceMount
          data-relationship-panel={tab.id}
          className="mt-0 space-y-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=inactive]:hidden"
        >
          {panels[tab.id]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
