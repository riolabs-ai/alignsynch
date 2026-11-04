// template-ancestor: components/layout/nav-menus.tsx   (variation: the footer band — brand-keyed link columns, a legal row and the version badge)

import { Button } from "@/components/ui/button";
import { quizCategories } from "@/content/categories";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { brand, brandIdOf, type BrandId } from "@/data/brand";
import { brandIconMark, brandMark } from "@/lib/brand-mark";
import { type NavViewer, navViewer, sees } from "@/lib/nav";
import { footerCopyFor } from "@/lib/shell-copy";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type React from "react";
import { AppVersion } from "@/components/layout/app-version";
import { BrandGlyph } from "@/components/layout/brand-glyph";
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
  const mark = brandIconMark(brand.mark) ?? brandMark(brand.logo);

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
    <>
      {/**
       * The signup band (#539 item 7), above the base footer rather than inside it.
       *
       * It used to sit between the link columns and the legal row — inside the footer's own
       * grid, which is the position #272 gave it when it replaced a deleted mailing band. A
       * newsletter is a different job from navigation: it is an ask, not a link, so it gets its
       * own band at the top of the footer with its own ground and its own measure, and the base
       * footer below it keeps one job (where things are). The words still come from
       * `data/pages/shell.ts`'s `footer-news`, and the form is still `NewsSignup` — this moves
       * where it stands, not what it says.
       */}
      <section
        aria-label={news.heading}
        className="border-t border-border bg-background"
        data-footer-news=""
      >
        <div className="marketing-container py-10">{<NewsSignup section={news} />}</div>
      </section>

      <footer className="relative overflow-hidden bg-muted pt-16 pb-8">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-1 bg-action"></div>
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-muted blur-3xl opacity-70"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-muted blur-3xl opacity-70"></div>

        <div className="marketing-container relative z-10">
          {/* Main footer content */}
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Company info */}
            <div className="lg:col-span-4 space-y-6">
              <div className="flex items-center gap-3">
                {mark ? (
                  /**
                   * The brand's icon, at the same factor as the header (#539 items 1 and 5).
                   *
                   * Measured before this card: the footer drew the 818×127 lockup at 206×32, so
                   * its monogram was ~43×32, inside the `h-8 w-auto` slot #470 left behind. The
                   * square mark at a 96px box draws the visible monogram at 96×62 — 2.2× the
                   * width and 1.94× the height — and the wordmark is set in type beside it
                   * instead of shipped inside a 206px PNG. That is one change answering both
                   * owner reports: the icon was too small, and the lockup block was too large.
                   *
                   * `alt={brand.name}` because the image *is* the brand's name for a screen
                   * reader, and the type beside it is `aria-hidden` so the name is announced
                   * once. The whole file is placed — no window, no crop, nothing `#470` fixed is
                   * reintroduced.
                   */
                  <Image
                    src={mark.src}
                    alt={brand.name}
                    width={mark.width}
                    height={mark.height}
                    className="h-24 w-24 shrink-0"
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
                {mark ? (
                  <span aria-hidden="true" className="text-xl font-bold tracking-tight text-action">
                    {brand.name}
                  </span>
                ) : (
                  <span className="text-2xl font-bold text-action">{copy.heading}</span>
                )}
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
              {/* Two link groups, two columns (#539 item 6). `md:grid-cols-3` was a third column
                  with nothing in it, which at 768 left both groups bunched at the left edge and
                  ~240px of dead space to their right — the "left-weighted middle" the owner
                  called broken. The footer has exactly two groups (Quick links, Contact), so the
                  grid is two wide from `sm` up and one below it. */}
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
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
                      <Link href={contact.cta.href}>{contact.cta.label}</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom footer */}
          <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-6">
              <p className="text-slate-500 dark:text-slate-400 text-center md:text-left">
                © {new Date().getFullYear()} {itemLabel(legal, "copyright")}
              </p>
              <div className="flex flex-wrap justify-center gap-6">
                <Link
                  href="/privacy"
                  className="text-slate-500 dark:text-slate-400 hover:text-action transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <span>{itemLabel(legal, "privacy")}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                  href="/terms"
                  className="text-slate-500 dark:text-slate-400 hover:text-action transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <span>{itemLabel(legal, "terms")}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                  href="/privacy"
                  className="text-slate-500 dark:text-slate-400 hover:text-action transition-colors flex items-center gap-1 whitespace-nowrap"
                >
                  <span>{itemLabel(legal, "cookies")}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
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
    </>
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
}: {
  brandId: BrandId;
  viewer: NavViewer;
  links: PageCopySection;
  alignLinks: PageCopySection;
  categories: PageCopySection;
  hiddenNav: readonly string[];
}) {
  switch (brandId) {
    case "quizhub":
      return <QuizHubLinkColumns links={links} categories={categories} hiddenNav={hiddenNav} />;
    case "alignsynch":
      return (
        <>
          <AlignSynchLinkColumn links={alignLinks} />
          {sees(viewer, "quiz-surfaces") && (
            <QuizHubLinkColumns links={links} categories={categories} hiddenNav={hiddenNav} />
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
function FooterLinkRow({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="text-slate-600 dark:text-slate-400 hover:text-action transition-colors flex items-center group"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-2 group-hover:bg-action transition-colors"></span>
        {label}
      </Link>
    </li>
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
}: {
  links: PageCopySection;
  categories: PageCopySection;
  hiddenNav: readonly string[];
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
          <FooterLinkRow href="/pricing" label={itemLabel(links, "pricing")} />
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
function AlignSynchLinkColumn({ links }: { links: PageCopySection }) {
  return (
    <div className="space-y-5">
      <FooterColumnHeading>{links.heading}</FooterColumnHeading>
      <ul className="space-y-3">
        <FooterLinkRow href="/#templates" label={itemLabel(links, "templates")} />
        <FooterLinkRow href="/#questions" label={itemLabel(links, "how-it-works")} />
        <FooterLinkRow href="/help" label={itemLabel(links, "help")} />
      </ul>
    </div>
  );
}
