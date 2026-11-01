/**
 * The second half of `?next=` validation: a same-site path that this build actually ships (#351).
 *
 * `lib/auth/paths.ts::safeNextPath` answers the first question — *is this a path on this site?* —
 * and nothing more, because it is imported by client components and may not read a flag. This
 * module answers the second, and it is **server-only**: "does this build ship that surface?" is
 * `lib/flags.ts`'s answer, and that module refuses to run in a browser on purpose.
 *
 * The defect it closes is the same one #351 fixes at the landing page. `/login?next=/dashboard/user`
 * is a perfectly same-site path, so `safeNextPath` keeps it; on an AlignSynch build the route it
 * names answers 404 (its `requireQuizProduct()` runs before the session is resolved), so the Neon
 * session verifier the callback appended is never exchanged and the person who just signed in is
 * signed out. The same is true of any quiz-only surface a stale link, a bookmark or the shell's own
 * hidden nav could carry: a `next` is only worth honouring if the build can render it.
 *
 * "Does not ship" is already answered by `hiddenNavHrefs()` — a gated surface is hidden *and* 404s,
 * which is the invariant `lib/flags.ts` documents — so there is no second list here to disagree with
 * the sidebar. The match is on the **pathname only** (query and fragment stripped):
 *
 *   - exact equality with a static key (`/explore`, `/dashboard/user`);
 *   - and, for a key with a dynamic segment (`/quiz/[id]`, `/categories/[slug]`, `/my-quizzes/[id]`,
 *     `/tournaments/[id]`, `/creator-tips/[slug]`), its static prefix (`/quiz/`) as a prefix of the
 *     pathname — because a nav or a link always carries the concrete href, never the pattern.
 *
 * Anything that is not a known gated surface — `/settings`, `/dashboard`, `/assessment/instances`,
 * a path nobody has heard of — is returned untouched: the shell ships it or the app answers its own
 * 404, and neither is this module's business.
 */
import { safeNextPath } from "@/lib/auth/paths";
import { hiddenNavHrefs } from "@/lib/flags";

/** `/quiz/abc?tab=1#top` → `/quiz/abc`. Never a URL parse: the input is a path, not a location. */
export function pathnameOf(path: string): string {
  const cut = path.search(/[?#]/);
  return cut === -1 ? path : path.slice(0, cut);
}

/**
 * The static part of a route pattern: `/categories/[slug]` → `/categories/`, `/explore` → `null`.
 *
 * The slash is kept so the prefix cannot match a longer sibling (`/my-quizzes/` never matches
 * `/my-quizzes-archive`).
 */
export function staticPrefixOf(pattern: string): string | null {
  const segment = pattern.indexOf("[");
  return segment === -1 ? null : pattern.slice(0, segment);
}

/** Does a concrete pathname name one of `hidden`'s surfaces? */
export function namesHiddenSurface(pathname: string, hidden: readonly string[]): boolean {
  return hidden.some((href) => {
    if (href === pathname) return true;
    const prefix = staticPrefixOf(href);
    return prefix !== null && pathname.startsWith(prefix);
  });
}

/**
 * Where `/login` should send this request after a successful sign-in.
 *
 * `requested` is the raw `?next=` value (untrusted, possibly absent); `destination` is this brand's
 * post-sign-in page (`AFTER_SIGN_IN_BY_BRAND[brandId]`). The order is the two questions above:
 * same-site first, then exists-on-this-build — an unsafe value has already become `destination` by
 * the time the flags are read, and `destination` is by definition a page this build renders.
 *
 * A shipped path is returned **verbatim**, query string included: `?next=/dashboard/user?tab=wallet`
 * on a quiz build is the wallet pane of a surface that build has, and rewriting it into its own
 * pathname would lose the tab. A hidden one becomes `destination` whole, query dropped — the query
 * belonged to a surface that is not there.
 */
export function signInDestination(
  requested: string | null | undefined,
  destination: string,
): string {
  const safe = safeNextPath(requested, destination);
  return namesHiddenSurface(pathnameOf(safe), hiddenNavHrefs()) ? destination : safe;
}
