import { Button } from "@/components/ui/button";
import { quizCategories } from "@/content/categories";
import type { PageCopy, PageCopySection } from "@/content/pages";
import { brand, brandIdOf, type BrandId } from "@/data/brand";
import { type NavViewer, navViewer, sees } from "@/lib/nav";
import { footerCopyFor } from "@/lib/shell-copy";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { ArrowRight, BookOpen, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import type React from "react";

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
 */
export function Footer({
  copy,
  viewer = navViewer(),
  brandId = brandIdOf(brand),
}: {
  copy: PageCopy;
  viewer?: NavViewer;
  /** Overridable for the node test that proves both brands' columns; a page never passes it. */
  brandId?: BrandId;
}) {
  /**
   * The footer's brand-selected sections (issue #188, stage S3). The line under the wordmark,
   * the contact block and the newsletter band are one pair each, and this is the only place
   * the choice is made — the same shape as `searchSectionFor`, so the header palette and this
   * footer cannot disagree about which brand they are.
   */
  const { brand: brandBlurb, contact, newsletter } = footerCopyFor(copy, brandId);
  const links = sectionOf(copy, "footer-links");
  const alignLinks = sectionOf(copy, "footer-links-alignsynch");
  const categories = sectionOf(copy, "footer-categories");
  const legal = sectionOf(copy, "footer-legal");

  /**
   * The link columns are the brand's (issue #156). A footer is part of navigation: before
   * this, the AlignSynch front page ended on a Quick Links column whose third row was
   * `/leaderboard`, and a Categories column of quiz subjects. The switch is the same shape
   * `app/(mainlayout)/page.tsx` uses for its front page, so a third brand cannot inherit the
   * quiz columns by accident — it fails to compile until its own are chosen.
   *
   * `viewer` is the capability stub from `lib/nav.ts`: the quiz columns come back for a
   * viewer allowed to see the quiz product, and are not rendered at all otherwise. No route
   * is deleted; every one of them still answers a request (see the PR's surface table).
   */
  const linkColumns = footerLinkColumns({ brandId, viewer, links, alignLinks, categories });

  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-white to-slate-100 dark:from-slate-950 dark:to-slate-900 pt-16 pb-8 sm:px-4 xl:px-8">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500"></div>
      <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-indigo-100 dark:bg-indigo-900/20 blur-3xl opacity-70"></div>
      <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-purple-100 dark:bg-purple-900/20 blur-3xl opacity-70"></div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Main footer content */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Company info */}
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center space-x-2">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-2 rounded-lg">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                {copy.heading}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 max-w-xs leading-relaxed">
              {sectionBody(brandBlurb)}
            </p>

            <div className="flex space-x-3">
              <Link href="#" aria-label="Facebook">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-slate-200 dark:border-slate-700">
                  <svg
                    className="h-5 w-5 text-blue-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </Link>
              <Link href="#" aria-label="Twitter">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-slate-200 dark:border-slate-700">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </div>
              </Link>
              <Link href="#" aria-label="Instagram">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-slate-200 dark:border-slate-700">
                  <svg
                    className="h-5 w-5 text-pink-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </Link>
              <Link href="#" aria-label="YouTube">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 border border-slate-200 dark:border-slate-700">
                  <svg
                    className="h-5 w-5 text-red-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </Link>
            </div>
          </div>

          {/* Links Sections */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {linkColumns}

              {/* Contact */}
              <div className="space-y-5">
                <h3 className="text-base font-bold relative inline-block">
                  {contact.heading}
                  <span className="absolute -bottom-1 left-0 w-12 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500"></span>
                </h3>
                <ul className="space-y-4">
                  <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                      <MapPin className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-slate-600 dark:text-slate-400">
                      {itemLabel(contact, "address")}
                    </span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                      <Phone className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-slate-600 dark:text-slate-400">
                      {itemLabel(contact, "phone")}
                    </span>
                  </li>
                  <li className="flex items-center space-x-3">
                    <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">
                      <Mail className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-slate-600 dark:text-slate-400">
                      {itemLabel(contact, "email")}
                    </span>
                  </li>
                </ul>
                <Button variant={"gradient"}>{itemLabel(contact, "cta")}</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-16 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xl font-bold mb-2">{newsletter.heading}</h3>
              <p className="text-slate-600 dark:text-slate-400">{newsletter.body}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="email"
                  placeholder={itemLabel(newsletter, "placeholder")}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400"
                />
              </div>
              <Button variant={"gradient"}>
                {itemLabel(newsletter, "subscribe")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-slate-500 dark:text-slate-400">
              © {new Date().getFullYear()} {itemLabel(legal, "copyright")}
            </p>
            <div className="flex flex-wrap justify-center gap-6 mt-4 md:mt-0">
              <Link
                href="#"
                className="text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
              >
                <span>{itemLabel(legal, "privacy")}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="#"
                className="text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
              >
                <span>{itemLabel(legal, "terms")}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
              <Link
                href="#"
                className="text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
              >
                <span>{itemLabel(legal, "cookies")}</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
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
}: {
  brandId: BrandId;
  viewer: NavViewer;
  links: PageCopySection;
  alignLinks: PageCopySection;
  categories: PageCopySection;
}) {
  switch (brandId) {
    case "quizhub":
      return <QuizHubLinkColumns links={links} categories={categories} />;
    case "alignsynch":
      return (
        <>
          <AlignSynchLinkColumn links={alignLinks} />
          {sees(viewer, "quiz-surfaces") && (
            <QuizHubLinkColumns links={links} categories={categories} />
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
        className="text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center group"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mr-2 group-hover:bg-purple-500 transition-colors"></span>
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
      <span className="absolute -bottom-1 left-0 w-12 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500"></span>
    </h3>
  );
}

/**
 * The quiz product's two columns: Quick Links and the featured quiz subjects.
 *
 * Unchanged in output for `BRAND=quizhub` — same rows, same order, same hrefs — and reachable
 * on the alignment brand only for a viewer with the quiz capability.
 */
function QuizHubLinkColumns({
  links,
  categories,
}: {
  links: PageCopySection;
  categories: PageCopySection;
}) {
  return (
    <>
      <div className="space-y-5">
        <FooterColumnHeading>{links.heading}</FooterColumnHeading>
        <ul className="space-y-3">
          <FooterLinkRow href="/dashboard/user" label={itemLabel(links, "dashboard")} />
          <FooterLinkRow href="/create/editor" label={itemLabel(links, "create-quiz")} />
          <FooterLinkRow href="/leaderboard" label={itemLabel(links, "leaderboard")} />
          <FooterLinkRow href="/affiliate" label={itemLabel(links, "affiliate")} />
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
        <FooterLinkRow href="/support" label={itemLabel(links, "support")} />
      </ul>
    </div>
  );
}
