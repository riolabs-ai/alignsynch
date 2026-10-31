import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";
import { cn } from "@/lib/utils";

/**
 * The running version, linked to its GitHub release (issue #269).
 *
 * One component, four mounts: `/login` (centred under the credentials card), the bottom of
 * the marketing footer, the bottom of the signed-in left sidebar, and the bottom of the
 * `/welcome` band (`components/marketing/marketing-footer.tsx` — the second footer this tree
 * has, so "the footer" is two files and the badge is in both).
 *
 * **The version has exactly one source: `package.json`'s `version`.** `next.config.mjs` reads
 * it at build time and declares it in its `env` block, and this module reads the inlined value.
 * There is no second constant to drift and no literal here — the value is public, which is why
 * `env` (inlined into the browser bundle) is the right channel and a client component can print
 * it. An unset value means the build did not go through `next.config.mjs`: that is a
 * configuration defect, not a state this component is allowed to paper over with a fallback.
 *
 * **The link is the exact tag, deliberately** — `releases/tag/v<version>`, never
 * `releases/latest`. If `package.json` says a version nobody tagged, the badge 404s, and that
 * is the point: a badge that always resolves but never names the deployed build identifies
 * nothing. `docs/RELEASING.md` makes tagging before deploying the release step's job.
 *
 * The words are fixtures, not literals (E23): each surface's `PageCopy` carries a `version`
 * section whose two items are the visible label and the accessible title, with `{version}`
 * filled here. A mount whose fixture lacks that section fails `pnpm data:check`, and a
 * misspelled id fails it too, so a blank badge is a red build rather than a shipped blank.
 *
 * The element is a real `<a href>`: keyboard reachable in document order, announced with the
 * version in its name, and it needs no JavaScript to work.
 */

/**
 * Where the release notes live. A constant of this repository and not brand data: both brands
 * ship from one remote, so a second `Brand` field would be a value neither could change.
 * A plain string literal (not JSX text, not an attribute) is not page copy, and E10 ignores it
 * because it is not a site-relative `href`.
 */
const RELEASE_TAG = "https://github.com/riolabs-ai/alignsynch/releases/tag/v";

export function AppVersion({
  copy,
  compact = false,
  className,
}: {
  copy: PageCopy;
  /** The rail's short form for the collapsed sidebar — the same fixture, its `compact` item. */
  compact?: boolean;
  className?: string;
}) {
  /**
   * `process.env.APP_VERSION` is replaced by the bundler with the string `next.config.mjs`
   * declared — in the server render and in the browser bundle alike, which is what keeps the
   * two renders identical (a runtime lookup would hydrate a different value than it served).
   */
  const version = process.env.APP_VERSION ?? "";
  const section = sectionOf(copy, "version");
  const values = { version };
  /**
   * Both ids are resolved unconditionally: E23 reads a literal id out of this file, so an
   * unused branch still has to name a label the fixture really carries.
   */
  const long = fillLabel(itemLabel(section, "label"), values);
  const short = fillLabel(itemLabel(section, "compact"), values);

  return (
    <a
      href={`${RELEASE_TAG}${version}`}
      title={fillLabel(itemLabel(section, "title"), values)}
      className={cn(
        /**
         * `slate-600`, not the `slate-500` the legal row uses: the footer's ground is `bg-muted`
         * (#f1f5f9), and #64748b on it measures 4.34:1 — under AA for 12px text. #475569 measures
         * 6.92:1 there and 7.58:1 on the sidebar's white, so one token passes on all three
         * surfaces. In dark mode `slate-400` on the dark ground is 6.96:1.
         */
        "text-xs text-slate-600 transition-colors underline-offset-4 hover:text-action hover:underline dark:text-slate-400",
        className,
      )}
    >
      {compact ? short : long}
    </a>
  );
}
