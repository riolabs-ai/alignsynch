/**
 * `/templates/relationship` — the templates this account can use (#console 5/5).
 *
 * The four built-ins, plus anything the signed-in account wrote. Row actions: open, duplicate,
 * archive (unarchive on an archived row). The "new template" entry point is one link to
 * `/templates/relationship/new`, which already works and is not rebuilt here.
 *
 * **The session is the filter.** `currentUser()` resolves the account from the request's own
 * cookies, and `listLibraryTemplates(user.userId)` returns `author_user_id IS NULL OR
 * author_user_id = $1` — the platform's templates plus this account's, and nobody else's. Signed
 * out is the other gated routes' answer: `redirect(/login?next=…)` with this path preserved.
 *
 * **No auth environment is not "signed out" here — it is the configuration error, deliberately.**
 * `currentUser()` builds the auth server outside its `try` and throws
 * `NEON_AUTH_BASE_URL is not set` when `NEON_AUTH_*` is absent: a console page must not turn a
 * deployment mistake into an endless signed-out session (`lib/auth/session.ts`). So on a tree with
 * no auth env — a fresh clone, a preview without secrets, the gate build — a *request* here
 * answers 500 with that error, and that is the documented answer, not a defect (kanban t_c6398125
 * kept the 500 and documented it). `/support` and `/how-it-works` answer the login redirect
 * instead because they call `currentUserIfConfigured()`; this page does not.
 *
 * **A template written before the author column existed reads as a built-in.** It has
 * `author_user_id IS NULL`, exactly like a seeded one, and there is no backfill that could say
 * otherwise. The page says so in its own band (`legacy` in the fixture) rather than leaving a
 * person to wonder why the template they wrote last month is not under "Mine".
 *
 * **The tab, the status and the search are query parameters, and this module applies them.**
 * Plain links and a plain GET form, so every state of the screen is a URL a `curl` can ask for
 * and there is no client bundle to render six rows — the same reason `/assessment`'s create
 * forms are plain forms. The filtering itself is `filterLibrary()` in
 * `lib/flow/template-library.ts`, a pure function the unit suite drives without a database.
 *
 * **A write's notice is resolved here, from an id.** The three POST endpoints redirect with the
 * record's id (`?archived=`, `?unarchived=`, `?duplicated=`), and this page looks that id up in
 * the list it just read: a stale or crafted id draws nothing, and no title anybody typed travels
 * in a URL. `?problem=` carries one of two codes and never a sentence.
 *
 * `force-dynamic` for the reason every gated route carries it: the session is per-request and the
 * list is a database read, so `pnpm build` must pass with `DATABASE_URL` unset.
 */
import { TemplateLibrary, type LibraryNotice } from "@/components/assessment-flow/template-library";
import {
  groupCountsOf,
  parseRealmFilter,
  templatesInRealm,
} from "@/components/assessment-flow/template-card";
import { templateLibraryPageCopy } from "@/data/pages/assessment-templates";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { listLibraryTemplates } from "@/lib/db/template-library";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import {
  filterLibrary,
  libraryStateOf,
  parseLibraryStatus,
  parseLibraryView,
  type LibraryTemplate,
} from "@/lib/flow/template-library";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  /**
   * Read from the fixture, never spelled here: the catalogue's title is one string
   * (`data/pages/assessment-templates.ts::heading`) and the page's own `<h1>` renders the same
   * field, so a rename cannot leave the tab saying one thing and the page another.
   */
  title: templateLibraryPageCopy.heading,
};

type LibraryParams = {
  readonly view?: string | string[];
  readonly status?: string | string[];
  readonly q?: string | string[];
  readonly realm?: string | string[];
  readonly archived?: string | string[];
  readonly unarchived?: string | string[];
  readonly duplicated?: string | string[];
  /** #743 — a delete landed. Carries no title: the row it named is the one that is gone. */
  readonly deleted?: string | string[];
  /** #743 — the slug a delete was refused for, so the notice can name that row's title. */
  readonly refused?: string | string[];
  readonly problem?: string | string[];
};

/** The first value of a search param — Next hands a repeated param back as an array. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The notice a redirect asked for, resolved against the list the page already read.
 *
 * Written as one branch per parameter rather than a computed key, for the reason the template
 * form's refusal reader is: the ids are the fixture's, and a typo has to be a red build rather
 * than a blank band. The title is the *record's*, never the query string's.
 */
function noticeOf(
  templates: readonly LibraryTemplate[],
  params: LibraryParams,
): LibraryNotice | null {
  const problem = first(params.problem);
  if (problem === "template-not-yours" || problem === "unknown-template") {
    return { id: problem === "template-not-yours" ? "refused" : "missing", title: null };
  }
  /**
   * #743 — the two delete refusals name the template, because their row still exists: the
   * refusal is "this one cannot be destroyed", which is only useful with the row named and the
   * alternative offered. `refused` carries the **slug** and the title is read off the list, the
   * same way `archived` carries an id and never a title — a title in a query string is a
   * sentence a crafted link could write onto somebody's screen.
   */
  if (problem === "template-has-versions" || problem === "template-has-relationships") {
    const id = problem === "template-has-versions" ? "has-versions" : "has-relationships";
    const named = first(params.refused) ?? "";
    const found = templates.find((template) => template.slug === named);
    if (found !== undefined) return { id, title: found.title };
    // A refusal whose row this list no longer carries (a filter changed in another tab) still
    // has to say what happened, so it says it without a title rather than not at all.
    return { id, title: null };
  }
  // #743 — a delete landed. Its sentence carries no `{title}`: the row it would name is gone,
  // and the value in the query string is only ever a flag (`1`), which the notice proves by
  // ignoring it rather than echoing it.
  if (first(params.deleted) !== undefined) return { id: "deleted", title: null };
  const archived = first(params.archived);
  if (archived !== undefined) {
    const found = templates.find((template) => template.id === archived);
    if (found !== undefined) return { id: "archived", title: found.title };
  }
  const unarchived = first(params.unarchived);
  if (unarchived !== undefined) {
    const found = templates.find((template) => template.id === unarchived);
    if (found !== undefined) return { id: "unarchived", title: found.title };
  }
  const duplicated = first(params.duplicated);
  if (duplicated !== undefined) {
    const found = templates.find((template) => template.id === duplicated);
    if (found !== undefined) return { id: "duplicated", title: found.title };
  }
  return null;
}

export default async function TemplateLibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibraryParams>;
}) {
  const user = await currentUser();
  if (user === null) redirect(loginPathFor(TEMPLATE_LIBRARY_PATH));

  const params = await searchParams;
  const filter = {
    view: parseLibraryView(first(params.view)),
    status: parseLibraryStatus(first(params.status)),
    query: (first(params.q) ?? "").slice(0, 120),
    realm: parseRealmFilter(first(params.realm)),
  };

  let visible: readonly LibraryTemplate[] = [];
  let unreadable: string | null = null;
  try {
    visible = await listLibraryTemplates(user.userId);
  } catch (error) {
    // "The database did not answer" is a state this screen can describe; a schema failure is a
    // code defect and keeps throwing, exactly as the instance screen decides it.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("template-library: the list could not be read", error);
    unreadable = error.reason;
  }

  /**
   * The tab, the status and the search narrow the rows; the realm narrows what is left.
   *
   * `filterLibrary` is `lib/flow`'s pure function and stays as it is — a realm is not an
   * authorship fact, it is the type taxonomy's field (`REALMS`), so the second narrowing is a
   * projection of the rows the first one returned and needs no database column.
   */
  const narrowed = filterLibrary(visible, filter);
  const shown = templatesInRealm(narrowed, filter.realm);

  return (
    <TemplateLibrary
      copy={templateLibraryPageCopy}
      shown={shown}
      state={libraryStateOf(visible, shown)}
      filter={filter}
      counts={groupCountsOf(narrowed)}
      notice={unreadable === null ? noticeOf(visible, params) : null}
      unreadable={unreadable}
    />
  );
}
