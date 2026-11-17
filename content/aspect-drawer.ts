/**
 * The Aspect drawer's vocabulary (#1133) — **one drawer, one set of words**, mounted by three
 * screens.
 *
 * The `aspect-drawer` section is spread into each page fixture that mounts the drawer
 * (`data/pages/assessment-create.ts` for wizard Stage 3, `data/pages/dashboard-relationship-detail.ts`
 * for a relationship's own Aspects tab, and `data/pages/dashboard-template-editor.ts` for a My
 * Template's Edit) instead of being typed three times: the drawer is the same drawer everywhere,
 * and three copies of "Scale Locked · 1–5 for every Aspect" would drift the first time somebody
 * reworded one. A page may still override a single row by declaring the same item id in its own
 * section — no page does today, and none should, which is why the list lives here.
 *
 * **Why this is in `content/` and not `data/pages/`.** A module under `data/pages/` is a *route's*
 * copy and is registered as one in `data/pages/index.ts`; a shared vocabulary that no route owns
 * has no route key to register under, so it lives beside the schemas as plain data. Nothing here
 * imports React or Next, so `data:check` compiles it with the rest of `content/`.
 *
 * **The words are the bundle's, not invented.** Every label below is drawn from
 * `docs/specs/v2-bundles/06-spec-design-page-templates-v2/js/proto.js::aspectDrawer()` — the
 * eyebrow, the two headings, `Title` / `Prompt` / `1 Means` / `5 Means` with the artifact's own
 * hints, the locked-scale line, `Cancel`, and `Add Aspect` / `Save Aspect`. `name-new` and
 * `title-help` are the two sentences the artifact did not need because its prototype held a title;
 * they say what this model actually does (the name is the row's id, and it stays fixed).
 */

/** The section id every mounting page declares. `AspectDrawer` reads this by default. */
export const ASPECT_DRAWER_SECTION_ID = "aspect-drawer";

/** One row of the drawer's vocabulary. Structurally a `zPageCopyItem` without the optional tails. */
export interface AspectDrawerItem {
  readonly id: string;
  readonly label: string;
}

/**
 * The drawer's words, in the order a reader meets them.
 *
 * `required` carries a `{field}` placeholder `fillLabel` fills with the refused field's own label,
 * so a refusal reads "The question both seats answer is required" and never names a column.
 */
export const ASPECT_DRAWER_ITEMS: readonly AspectDrawerItem[] = [
  { id: "eyebrow-new", label: "New Aspect" },
  { id: "eyebrow-edit", label: "Edit Aspect" },
  { id: "heading-new", label: "Add an Aspect" },
  { id: "title-label", label: "Title" },
  { id: "name-new", label: "Named when it is created" },
  {
    id: "title-help",
    label:
      "The name is the row's own id, and answers are keyed to it — reword the prompt instead of renaming it.",
  },
  { id: "prompt-label", label: "Prompt" },
  { id: "prompt-help", label: "The question you both answer." },
  { id: "left-label", label: "1 Means" },
  { id: "right-label", label: "5 Means" },
  { id: "scale-locked", label: "Scale Locked · 1–5 for every Aspect" },
  { id: "scale-name", label: "The locked 1 to 5 answer scale" },
  { id: "close", label: "Close" },
  { id: "cancel", label: "Cancel" },
  { id: "save-new", label: "Add Aspect" },
  { id: "save-edit", label: "Save Aspect" },
  { id: "unsaved", label: "Discard the changes to this Aspect?" },
  { id: "refused", label: "That Aspect was not saved." },
  { id: "required", label: "{field} is required." },
];

/**
 * The whole section, ready to spread into a page fixture's `sections` array.
 *
 * A function and not a constant object, because a fixture's sections are parsed by zod and two
 * fixtures spreading one shared object would share one parsed row — a change to one page's copy
 * would then be invisible to the other's `data:check` pass.
 */
export function aspectDrawerSection(): {
  readonly id: string;
  readonly heading: string;
  readonly body: string;
  readonly items: readonly AspectDrawerItem[];
} {
  return {
    id: ASPECT_DRAWER_SECTION_ID,
    heading: "One Aspect",
    body: "An Aspect is one question both seats answer, on the locked 1–5 band. Its two ends are what a 1 and a 5 mean.",
    items: [...ASPECT_DRAWER_ITEMS],
  };
}
