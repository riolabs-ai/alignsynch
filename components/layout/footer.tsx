// template-ancestor: components/layout/nav-menus.tsx   (variation: the footer band — brand-keyed link columns, a legal row and the version badge)

import { Button } from "@/components/ui/button";
import { quizCategories } from "@/content/categories";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { brand, brandIdOf, type BrandId } from "@/data/brand";
import { brandMark } from "@/lib/brand-mark";
import { leavesApp } from "@/lib/marketing-routes";
import { type NavViewer, navViewer, sees } from "@/lib/nav";
import { footerCopyFor } from "@/lib/shell-copy";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { AppVersion } from "@/components/layout/app-version";
import { BrandGlyph } from "@/components/layout/brand-glyph";
import { LeavingLink } from "@/components/layout/leaving-link";
import { NewsSignup } from "@/components/layout/news-signup";

/**
 * The footer — the one shell band the pages render themselves, so it takes the whole
 * shell copy and resolves its own sections (`data/pages/shell.ts`, WU-7). `data:check`
 * E23 attributes this file to the `shell` surface through the budget entry's `mounts`:
 * the layout mounts the header and sidebar, the pages mount this.
 *
 * The subject column is **derived**, never re-typed: `quizCategories` is the one table
 * that owns a subject's name and slug, and the column is the rows flagged `featured`.
 * The old `FOOTER_SUBJECTS` re-listed five slugs the table already had, which is how a
 * footer column and a browse page drift apart. Order is the table's order.
 *
 * **The palette is the brand's (issue #187).** This file held 16 of the 31 matching lines in
 * the card's scope — 28 indigo / purple / violet literals — on every page of both builds, and
 * it carried six gradients built out of them. The mapping, and why each one:
 *
 *   - the icon chips and their glyphs: a purple 100 tint becomes `bg-muted`, the purple 500
 *     and 600 glyphs become `text-action`. A tinted surface is `muted`; a glyph that names an
 *     action is the brand's action colour.
 *   - every hover and the column rules: the purple 600 hover becomes `hover:text-action`; a
 *     purple→indigo 500 gradient becomes `bg-action`. A 48px rule under a heading has no
 *     second stop to say anything, so it is a solid brand bar rather than a recoloured
 *     gradient — the restraint the marketing page already shows.
 *   - the 1px band at the top and the two blurred discs: a three-stop purple, indigo and blue
 *     becomes `bg-action`, and the indigo 100 / purple 100 discs become `bg-muted`. They are
 *     decoration, and decoration that only ever existed as two hues of the leaked palette
 *     becomes one brand bar and two neutral discs.
 *   - the ground: the white-to-slate pair becomes `from-background to-muted`, which is the same
 *     two stops the theme already names (`slate-100` and `--muted` are within a percent of
 *     each other on both brands).
 *   - the product mark: the open book (`BrandGlyph`) in a solid brand box, and a wordmark filled
 *     by the same action colour, become `brandMark(brand.logo)`. The record's mark when it has
 *     one, the book glyph and the typed name when `data/media.ts` calls it a fallback. The mark
 *     is drawn whole — no crop window (owner, brand marks; see the slot itself).
 *
 * The old class names are deliberately not quoted here: the acceptance test is a `git grep` for
 * the three palette prefixes over the card's paths, and a comment that repeats a banned literal
 * makes that grep a lie about the code. The mapping is the same statement in prose.
 */
export function Footer({
  copy,
  viewer = navViewer(),
  brandId = brandIdOf(brand),
  hiddenNav,
  leaving = false,
}: {
  copy: PageCopy;
  viewer?: NavViewer;
  /** Overridable for the node test that proves both brands' columns; a page never passes it. */
  brandId?: BrandId;
  /**
   * The gated hrefs the shell must not draw, resolved on the server by
   * `lib/flags.ts::hiddenNavHrefs()` and passed down — **required, with no default** (#175
   * follow-up). This module has no `"use client"`, but `components/categories/categories-page.tsx`
   * and `components/tournaments/tournament-page.tsx` are client components that mount it, so it
   * is in a client bundle wherever they are. A default would let a mount quietly fall back to
   * "draw everything" in exactly the bundles that cannot ask the server; leaving it required makes
   * the compiler name every mount instead, and `tests/leaderboard-links.test.ts` scans the sources
   * for a new one.
   */
  hiddenNav: readonly string[];
  /**
   * This mount is **inside the app** — set by every dashboard mount, never by the marketing
   * layout. It is the one thing the footer cannot answer alone: the same band renders on
   * `app/(marketing)` and inside the shell (`/tournaments/[id]`, `/affiliate`, the creator tips),
   * so its public destinations — `/pricing`, `/help`, `/privacy`, `/terms` and the front page's
   * two anchors — open in a new tab on the app side and stay in the tab on the public side. The
   * other direction is the point of `leaving`: a reader on `/pricing` who follows "Pricing" in
   * the footer must not get a second tab of the page they are already on.
   *
   * `scripts/leaving-links.ts` (E39) fails a dashboard mount that forgets it, because a default
   * would make the marketing behaviour the silent answer everywhere.
   */
  leaving?: boolean;
}) {
  /**
   * The footer's brand-selected sections (issue #188, stage S3). The line under the wordmark and
   * the contact block are one pair each, and this is the only place the choice is made — the same
   * shape as `searchSectionFor`, so the header palette and this footer cannot disagree about which
   * brand they are. The mailing-list band left this pair with its section (#272).
   */
  const { brand: brandBlurb, contact } = footerCopyFor(copy, brandId);
  const links = sectionOf(copy, "footer-links");
  const alignLinks = sectionOf(copy, "footer-links-alignsynch");
  const categories = sectionOf(copy, "footer-categories");
  const legal = sectionOf(copy, "footer-legal");

  /**
   * The link columns are the brand's (issue #156). A footer is part of navigation: before
   * this, the AlignSynch front page ended on a Quick Links column whose third row was
   * `/leaderboard`, and a Categories column of quiz subjects. The switch is the same shape
   * `app/(marketing)/page.tsx` uses for its front page, so a third brand cannot inherit the
   * quiz columns by accident — it fails to compile until its own are chosen.
   *
   * `viewer` is the capability stub from `lib/nav.ts`: the quiz columns come back for a
   * viewer allowed to see the quiz product, and are not rendered at all otherwise. No route
   * is deleted; every one of them still answers a request (see the PR's surface table).
   */
  const linkColumns = footerLinkColumns({
    brandId,
    viewer,
    links,
    alignLinks,
    categories,
    hiddenNav,
    leaving,
  });
  /**
   * The product mark, resolved from the brand record (#187).
   *
   * `brandMark` is the same call `components/layout/sidebar.tsx` makes: `undefined` for
   * `brand.logo` when the registry marks the file a `fallback`, so the template build keeps the
   * book mark it has always drawn (`BrandGlyph`, the open book the icon set is drawn from) and
   * gains no markup, and the real size and `src` of an exported lockup otherwise. A footer that
   * hardcoded its own glyph was drawing "a generic quiz icon" on an AlignSynch page — the exact
   * sentence in issue #187 — so the mark is read from the record here for the same reason the
   * sidebar reads it.
   */
  const mark = brandMark(brand.logo);

  /**
   * The footer's news band.
   *
   * It stands where the band #272 deleted stood — under the link columns, above the legal row —
   * because that is where a footer's signup belongs and it is the position the old markup had.
   * It appears on every page that mounts this footer, which is why it lives here and not on a
   * band of `/`: the card's acceptance is "every marketing route", and the marketing chrome is
   * this component.
   *
   * The section is handed down as data; the form is a client component
   * (`components/layout/news-signup.tsx`) that reads its words from it, so this file still holds
   * no copy and still value-imports nothing that reaches `lib/db/**`.
   */
  const news = sectionOf(copy, "footer-news");

  return (
    <footer className="relative overflow-hidden bg-muted pt-16 pb-8 sm:px-4 xl:px-8">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-action"></div>
      <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-muted blur-3xl opacity-70"></div>
      <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-muted blur-3xl opacity-70"></div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Main footer content */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Company info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center space-x-2">
              {mark ? (
                /**
                 * The brand's mark, at the size the record exports it.
                 *
                 * `alt=""` because the mark *is* the name — the lockup sets "AlignSynch"
                 * itself — so a description here would have a screen reader say the brand
                 * twice, and the type beside it (below) is not drawn when a lockup is.
                 *
                 * **No window, no crop (owner, brand marks).** This slot used to render the
                 * 818×127 file inside a 44×32 `overflow-hidden` span, which showed the AS
                 * monogram and clipped the wordmark off at the right edge. That is a crop of a
                 * fixed asset, which the owner's rule forbids beside redraw and re-tint
                 * (`tests/brand-immutable.test.ts` records it), and it was never load-bearing:
                 * the footer's brand column is 380 px at 1440 and the full column at 390, so
                 * the 206 px lockup has always had room. `h-8 w-auto` is the whole file at its
                 * natural aspect ratio; `max-w-none` is gone with the window that needed it.
                 */
                <Image
                  src={mark.src}
                  alt=""
                  width={mark.width}
                  height={mark.height}
                  className="h-8 w-auto"
                />
              ) : (
                <div className="bg-action p-2 rounded-lg">
                  <BrandGlyph className="h-6 w-6 text-action-foreground" />
                </div>
              )}
              {/* The name in type only when there is no lockup to say it — the template's
                  placeholder logo resolves to no mark, and its footer has always been the
                  glyph plus the word. A fallback mark and a typed wordmark together would set
                  the brand's name twice. */}
              {!mark && <span className="text-2xl font-bold text-action">{copy.heading}</span>}
            </div>
            <p className="text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
              {sectionBody(brandBlurb)}
            </p>

            {/*
             * No social row (issue #272). It drew four icons — Facebook, Twitter, Instagram and
             * YouTube — and every one pointed at a bare `#`: a claim of social presence on every page,
             * reachable by tab and announced as a link, that went nowhere. Nothing in this repo
             * names an account behind any of them, and an icon for an account nobody can reach is
             * fabricated presence rather than an empty state. If those accounts ever exist the row
             * comes back with the real URLs and a verified status code; until then its absence is
             * the honest render.
             */}
          </div>

          {/* Links Sections */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {linkColumns}

              {/* Contact */}
              <div className="space-y-5">
                <h3 className="text-base font-bold relative inline-block">
                  {contact.heading}
                  <span className="absolute -bottom-1 left-0 w-12 h-0.5 bg-action"></span>
                </h3>
                {/*
                 * One sentence and one link (owner, 2026-11-02). The row that stood here printed
                 * `brand.supportEmail` — an address on every public page of both builds, and a
                 * mail link is not a contact path a visitor without a mail client can use. The
                 * destination is now the form on `/help`, where a message is stored before it is
                 * mailed, so nothing is lost when the sender has no mail app.
                 *
                 * The fixture carries no address at all (`footer-contact` / its alignment twin),
                 * and `contact.cta.href` is E23's to check against the route manifest.
                 */}
                {contact.body !== undefined && (
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {sectionBody(contact)}
                  </p>
                )}
                {contact.cta !== undefined && (
                  <Button asChild variant={"action"}>
                    {/*
                      The fixture's destination, so the rule cannot read it: `/help` is the public
                      form and a dashboard reader who presses "Contact us" is leaving the app
                      (E39, `leaving` above). Read at runtime through `leavesApp`, the same table
                      `NavRow` uses, so the footer's own marketing mount stays in one tab.
                    */}
                    {leaving && leavesApp(contact.cta.href) ? (
                      <LeavingLink href={contact.cta.href} label={contact.cta.label} />
                    ) : (
                      <Link href={contact.cta.href}>{contact.cta.label}</Link>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/*
         * The news signup. It replaced the comment that stood here — #272 had removed a
         * mailing band because it took an address with no sender behind it. The sender is real
         * now: `app/api/news/subscribe/route.ts` writes the address to `news_signup` and sends
         * through `lib/flow/email.ts`, so the band can make the promise its markup implies.
         */}
        <NewsSignup section={news} />

        {/* Bottom footer */}
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} {itemLabel(legal, "copyright")}
            </p>
            <div className="flex flex-wrap justify-center gap-6 mt-4 md:mt-0">
              <LegalRowLink href="/privacy" label={itemLabel(legal, "privacy")} leaving={leaving} />
              <LegalRowLink href="/terms" label={itemLabel(legal, "terms")} leaving={leaving} />
              <LegalRowLink href="/privacy" label={itemLabel(legal, "cookies")} leaving={leaving} />
            </div>
          </div>
        </div>

        {/*
         * The version badge — the very bottom of the footer (issue #269), below the copyright
         * and the legal row, centred so it reads as the document's signature rather than as a
         * fourth legal link. `AppVersion` owns the URL, the version and the words; this file
         * only decides where it stands.
         */}
        <div className="mt-6 flex justify-center">
          <AppVersion copy={copy} />
        </div>
      </div>
    </footer>
  );
}

/** The three column parts the brand switch chooses between, as one value. */
function footerLinkColumns({
  brandId,
  viewer,
  links,
  alignLinks,
  categories,
  hiddenNav,
  leaving,
}: {
  brandId: BrandId;
  viewer: NavViewer;
  links: PageCopySection;
  alignLinks: PageCopySection;
  categories: PageCopySection;
  hiddenNav: readonly string[];
  leaving: boolean;
}) {
  switch (brandId) {
    case "quizhub":
      return (
        <QuizHubLinkColumns
          links={links}
          categories={categories}
          hiddenNav={hiddenNav}
          leaving={leaving}
        />
      );
    case "alignsynch":
      return (
        <>
          <AlignSynchLinkColumn links={alignLinks} leaving={leaving} />
          {sees(viewer, "quiz-surfaces") && (
            <QuizHubLinkColumns
              links={links}
              categories={categories}
              hiddenNav={hiddenNav}
              leaving={leaving}
            />
          )}
        </>
      );
    default: {
      // A brand added to `data/brand.ts` without footer columns lands here and fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no footer navigation for brand ${String(unhandled)}`);
    }
  }
}

/** One row of a footer column: the bullet, the `Link`, the label. */
function FooterLinkRow({
  href,
  label,
  leaving = false,
}: {
  href: string;
  label: string;
  /** This row points at the public site and the mount is inside the app — see `Footer.leaving`. */
  leaving?: boolean;
}) {
  const row = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-2 group-hover:bg-action transition-colors"></span>
      {label}
    </>
  );
  return (
    <li>
      {leaving ? (
        <LeavingLink href={href} label={label} className={FOOTER_ROW_CLASS}>
          {row}
        </LeavingLink>
      ) : (
        <Link href={href} className={FOOTER_ROW_CLASS}>
          {row}
        </Link>
      )}
    </li>
  );
}

/** The row's class string — one definition, so the two branches above cannot drift apart. */
const FOOTER_ROW_CLASS =
  "text-slate-600 dark:text-slate-400 hover:text-action transition-colors flex items-center group";

/**
 * One row of the legal band. The same question as `FooterLinkRow` at a quieter type scale — the
 * band already carried an `ExternalLink` marker when every one of these routes was a document,
 * so the leaving branch adds only the `target`/`rel`/name that was missing.
 */
function LegalRowLink({ href, label, leaving }: { href: string; label: string; leaving: boolean }) {
  const className =
    "text-slate-500 dark:text-slate-400 hover:text-action transition-colors flex items-center gap-1";
  if (leaving) {
    return <LeavingLink href={href} label={label} className={className} iconClassName="h-3 w-3" />;
  }
  return (
    <Link href={href} className={className}>
      <span>{label}</span>
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
    </Link>
  );
}

/** A column's heading and bullet rule — the same rule every column in this footer draws. */
function FooterColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-bold relative inline-block">
      {children}
      <span className="absolute -bottom-1 left-0 w-12 h-0.5 bg-action"></span>
    </h3>
  );
}

/**
 * The quiz product's two columns: Quick Links and the featured quiz subjects.
 *
 * Unchanged in output for `BRAND=quizhub` with every surface on — same rows, same order, same
 * hrefs — and reachable on the alignment brand only for a viewer with the quiz capability.
 *
 * `hiddenNav` drops the Quick Links rows whose destination is flagged off (#175 follow-up): the
 * `/leaderboard` row since #175, and the `/affiliate` row since #291 gated that route. The
 * footer is the widest of the four surfaces that used to advertise `/leaderboard` while the flag
 * answered 404: this one mounts on `/`, `/pricing`, `/affiliate`, `/creator-tips`, its detail
 * pages, `/categories` and `/tournaments`. The row is filtered here, not before the call, because
 * the label is the fixture's and only the destination is gated.
 */
function QuizHubLinkColumns({
  links,
  categories,
  hiddenNav,
  leaving = false,
}: {
  links: PageCopySection;
  categories: PageCopySection;
  hiddenNav: readonly string[];
  leaving?: boolean;
}) {
  return (
    <>
      <div className="space-y-5">
        <FooterColumnHeading>{links.heading}</FooterColumnHeading>
        <ul className="space-y-3">
          <FooterLinkRow href="/dashboard/user" label={itemLabel(links, "dashboard")} />
          <FooterLinkRow href="/create/editor" label={itemLabel(links, "create-quiz")} />
          {!hiddenNav.includes("/leaderboard") && (
            <FooterLinkRow href="/leaderboard" label={itemLabel(links, "leaderboard")} />
          )}
          {!hiddenNav.includes("/affiliate") && (
            <FooterLinkRow href="/affiliate" label={itemLabel(links, "affiliate")} />
          )}
          <FooterLinkRow href="/pricing" label={itemLabel(links, "pricing")} leaving={leaving} />
        </ul>
      </div>

      <div className="space-y-5">
        <FooterColumnHeading>{categories.heading}</FooterColumnHeading>
        <ul className="space-y-3">
          {quizCategories
            .filter((category) => category.featured)
            .map((category) => (
              <FooterLinkRow
                key={category.id}
                href={`/categories/${category.slug}`}
                label={category.name}
              />
            ))}
        </ul>
      </div>
    </>
  );
}

/**
 * The alignment product's column — the sidebar's destinations minus Home, because a footer
 * column whose first row is the page you are standing on is furniture.
 *
 * The hrefs are literal JSX for the reason `components/layout/nav-menus.tsx` gives: E10 only
 * sees a `href="…"` attribute, and `/`'s two anchor bands are the only honest targets for
 * Templates and How it works until a listing route ships.
 */
function AlignSynchLinkColumn({
  links,
  leaving = false,
}: {
  links: PageCopySection;
  leaving?: boolean;
}) {
  return (
    <div className="space-y-5">
      <FooterColumnHeading>{links.heading}</FooterColumnHeading>
      <ul className="space-y-3">
        <FooterLinkRow href="/#templates" label={itemLabel(links, "templates")} leaving={leaving} />
        <FooterLinkRow
          href="/#questions"
          label={itemLabel(links, "how-it-works")}
          leaving={leaving}
        />
        <FooterLinkRow href="/help" label={itemLabel(links, "help")} leaving={leaving} />
      </ul>
    </div>
  );
}
