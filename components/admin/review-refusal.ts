/**
 * The one sentence a refused review write draws (#665 follow-up).
 *
 * **A refusal is a sentence, never the server's diagnostic text.** The actions answer a `code`
 * (`role-too-low`, `no-change`, `signed-out`, …) and this module turns it into the words the
 * fixture holds — the same rule the inbox keeps in `components/admin/support-thread.tsx`. A code
 * the fixture has no sentence for falls back to `failed`, which is honest about the one thing a
 * reader needs: nothing was written.
 *
 * **Why a module and not a helper in each component.** The checklist and the thread can both be
 * refused, and two copies of this lookup is how one of them ends up rendering a raw code to an
 * operator. It lives under `components/` as a plain module with no directive, so both client
 * components import it without either one owning it.
 */
import type { PageCopySection } from "@/content/pages";
import { fillLabel, itemLabel } from "@/lib/page-copy";

/** A refusal's sentence, from the `refusals` section of the surface's copy fixture. */
export function refusalSentence(refusals: PageCopySection, code: string): string {
  const item = refusals.items?.find((candidate) => candidate.id === code);
  return item === undefined ? itemLabel(refusals, "failed") : fillLabel(item.label, {});
}
