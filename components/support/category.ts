/**
 * The support hub's one category type.
 *
 * It is re-exported from the content model (`content/article.ts`), never re-declared: a second
 * hand-written copy of the union was drift D16, and the taxonomy it mirrors is
 * `data/support-categories.ts` (#313). This module exists so the panels that take a category —
 * the rail, the FAQ, the knowledge base and the contact form's select — import it from one place
 * now that the hub's old shell (`support-page.tsx`) is split into the public `/help` and the
 * in-app `/support`.
 */
export type { SupportCategory } from "@/content/article";
