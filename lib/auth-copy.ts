/**
 * The auth surfaces' brand-selected copy (issue #225).
 *
 * `/login` and `/register` are one card each, shared by both brands: the fields, the
 * error states, the buttons. What differs is the *product's* voice — the sentence beside
 * the form and, on `/login`, the two tiles under it. Those come from brand-suffixed
 * sections in the route's own fixture (`data/pages/login.ts`, `data/pages/register.ts`)
 * and this module is the one place that picks between them, the way
 * `lib/shell-copy.ts::footerCopyFor` picks the footer's.
 *
 * Why the choice lives in `lib/` rather than in the two page modules: the same sentences
 * are read by a server module (`app/(auth)/login/page.tsx`) and would be re-derived by
 * any second caller, and a brand read in two places is the drift these fixtures exist to
 * prevent. Why the brand id arrives as an *argument*: a value import of `data/brand`
 * here would pull zod into the client bundle — the views import this module's types and
 * receive the resolved copy as a prop.
 *
 * ## What the projection does and does not touch
 *
 * It swaps whole sections, or merges one field into a shared section:
 *
 *   loginCopyFor     `subtitle` becomes the brand's hero sentence, `sign-in.body` becomes
 *                    the brand's card line, and the `stats` band is the brand's own. The
 *                    card's fifteen field labels, its error states and its buttons are the
 *                    shared section, untouched.
 *   registerCopyFor  `heading`/`subtitle` become the brand's hero, `mobile.body` becomes
 *                    the brand's mobile line. The wizard — its three steps, six interests,
 *                    skill level, date of birth and phone number — is not copy a skin
 *                    picks, and it is returned exactly as the fixture declares it.
 *
 * Every id below is literal at a `sectionOf` call, so a renamed section throws at the
 * fixture read (and `data:check` holds the same ids to `data/pages/budget.ts`) rather than
 * a heading that silently disappears. The `never` on each default is what keeps a third
 * brand from inheriting the quiz words by accident.
 */
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { sectionBody, sectionOf } from "./page-copy";

/**
 * Assemble `/login`'s copy from the three parts a brand owns, over the one shared card.
 *
 * Both branches of `loginCopyFor` go through here, so they differ only in the ids they
 * name: the hero sentence, the line above the form, and the stat band. `subtitle` is
 * required by the view and optional in the schema, so it is checked once, here — and the
 * stat band comes back under the id the view asks for (`stats`), whichever section of the
 * fixture it was written in, so the component has one contract on both brands.
 */
function signInPage(
  copy: PageCopy,
  parts: { subtitle: string | undefined; prompt: string; stats: PageCopySection },
): PageCopy {
  if (parts.subtitle === undefined) {
    throw new Error(
      "PageCopy: /login has no hero sentence — the panel beside the form renders `subtitle`, so a fixture without one draws an empty paragraph",
    );
  }
  return {
    heading: copy.heading,
    subtitle: parts.subtitle,
    sections: [
      { ...sectionOf(copy, "sign-in"), body: parts.prompt },
      { ...parts.stats, id: "stats" },
    ],
  };
}

/**
 * `/login`'s copy for one brand.
 *
 * The returned object carries the ids the view resolves (`sign-in`, `stats`) on both
 * brands, which is the point: the view asks for two ids and renders whatever words the
 * build selected.
 */
export function loginCopyFor(copy: PageCopy, brandId: BrandId): PageCopy {
  switch (brandId) {
    case "quizhub":
      return signInPage(copy, {
        subtitle: copy.subtitle,
        prompt: sectionBody(sectionOf(copy, "sign-in")),
        stats: sectionOf(copy, "stats"),
      });
    case "alignsynch":
      return signInPage(copy, {
        subtitle: sectionBody(sectionOf(copy, "hero-alignsynch")),
        prompt: sectionBody(sectionOf(copy, "sign-in-alignsynch")),
        stats: sectionOf(copy, "stats-alignsynch"),
      });
    default: {
      // A brand added to `data/brand.ts` without a login hero lands here and fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no /login copy for brand ${String(unhandled)}`);
    }
  }
}

/**
 * `/register`'s copy for one brand.
 *
 * The quiz build's hero is the fixture's own page-level `heading`/`subtitle`, so that
 * branch returns the fixture itself — byte for byte what shipped, no object allocated.
 * The alignment build reads its hero out of `hero-alignsynch` and its mobile line out of
 * `mobile-alignsynch`, and every other section (the wizard) travels through unchanged.
 */
export function registerCopyFor(copy: PageCopy, brandId: BrandId): PageCopy {
  switch (brandId) {
    case "quizhub":
      return copy;
    case "alignsynch": {
      const hero = sectionOf(copy, "hero-alignsynch");
      if (hero.heading === undefined) {
        throw new Error('PageCopy: section "hero-alignsynch" has no heading — it is a hero');
      }
      const mobile = sectionOf(copy, "mobile-alignsynch");
      return {
        ...copy,
        heading: hero.heading,
        subtitle: sectionBody(hero),
        sections: (copy.sections ?? []).map((section) =>
          section.id === "mobile" ? { ...section, body: sectionBody(mobile) } : section,
        ),
      };
    }
    default: {
      // A brand added to `data/brand.ts` without a register hero lands here and fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no /register copy for brand ${String(unhandled)}`);
    }
  }
}
