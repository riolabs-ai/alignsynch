/**
 * template-ancestor: components/ui/alert.tsx   (variation: the failure page hand-written in place of components/ui/alert.tsx — a page, not a panel)
 *
 * The assessment screen when the database did not answer — a page, not a digest (#204).
 *
 * Every other failure on this route is already honest: a slug no instance carries is a 404
 * (`notFound()`), and a row that does not parse throws, because that is a code or data defect
 * the gate is supposed to catch. The one case that had no words was the database being
 * unreachable, and Next's default answer to it is `<h1>500</h1>` plus a digest a reader cannot
 * act on — the worst possible screen on the only route that proves the product works.
 *
 * So the read path says *why* (`DatabaseUnavailableError.reason`) and this component prints it,
 * beside the slug that was asked for and what the reader can do. Two rules it follows:
 *
 *   - **It never shows an assessment.** No partial rows, no "last known" values, no empty
 *     report: a Gap drawn from nothing would be a lie about two people's answers.
 *   - **It never shows a spinner.** This is a failure state, and a spinner would claim the page
 *     is still coming. There is a reload link, which is a thing the reader can actually do.
 *
 * The status code is the one thing this cannot choose: a page in the App Router cannot set a
 * response status, and throwing to an `error.tsx` boundary would produce exactly the digest page
 * this component exists to replace. The sentence carries the truth; the server log carries the
 * stack (see `lib/db/client.ts`), and the reload is safe because nothing is cached across
 * requests.
 */
export function AssessmentUnreadable({ slug, reason }: { slug: string; reason: string }) {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div
        // Read back by the render test: this panel is the failure state, and a test should not
        // have to guess at it from a class name.
        data-assessment-unreadable={slug}
        role="alert"
        className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          This assessment could not be read
        </h1>
        <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{reason}</p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          The assessment <span className="font-mono">{slug}</span> was not deleted: the screen asks
          the database for it on every visit, and this visit did not get an answer. Nothing on this
          page came from a cache, and no answers were shown, guessed or reused.
        </p>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          {/* A plain link, not a router push: the page a reader needs is this same URL, read
              again from the database. */}
          <a className="underline" href={`/assessment/${encodeURIComponent(slug)}`}>
            Try reading it again
          </a>
        </p>
      </div>
    </div>
  );
}

export default AssessmentUnreadable;
