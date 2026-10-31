/**
 * The template library — who may see a template, and what "Mine" means (#console 5/5).
 *
 * The rule the console turns on is one column: `record.author_user_id`
 * (`db/migrations/0011_console_columns.sql`). It is **NULL for a built-in** and set for a
 * template a person wrote, and this module is the single place that comparison is made —
 * everything else (the SQL, the screen, the row actions) asks this function rather than
 * spelling `author_user_id === viewer` a second time.
 *
 * Three consequences, and each one is deliberate:
 *
 *   - **"Mine" is exactly `authorUserId === viewerUserId`.** Not "not built-in", not
 *     "created after I signed up": a template written by another account is neither mine nor a
 *     built-in, and it is not visible to me at all (`canUseTemplate` below). That is what stops
 *     the screen from being a directory of everybody's work.
 *   - **An unattributed template is a built-in.** A template authored before
 *     `0011_console_columns.sql` has `author_user_id IS NULL` and is indistinguishable from a
 *     seeded one — there is no backfill and no sentinel account, so the absence *is* the fact
 *     and it reads as "the platform wrote it". The screen says so in words, because a person
 *     who wrote a template last month will look for it under "Mine" and not find it.
 *   - **A signed-out viewer has no "Mine".** `viewerUserId` is `null` and no row is theirs;
 *     the list still shows the built-ins, which is what a catalogue is.
 *
 * No React, no `lib/db`, no fixture import: `scripts/data-check` never loads this, but the
 * vitest suite does, and a pure function is what lets the three states be tested without a
 * database.
 */
import type { PublishStatus } from "@/content/core";

/** Where a template came from, as the screen labels it. */
export type TemplateAuthorship = "built-in" | "mine" | "other";

/**
 * One row of the library, as the read hands it over and the view draws it.
 *
 * `authorship` is resolved here rather than in the component, for the reason the whole module
 * exists: a row that decided its own authorship could disagree with the filter that selected it.
 */
export interface LibraryTemplate {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: PublishStatus;
  /** `record.date`, as the model's one UTC instant. */
  readonly createdAt: string;
  /** `count(item)` — how many Aspects the template asks. */
  readonly aspectCount: number;
  /** Instances copied from this template. Archiving never changes it. */
  readonly instanceCount: number;
  readonly authorship: TemplateAuthorship;
}

/** The tabs: every template this account may use, only theirs, only the platform's. */
export const LIBRARY_VIEWS = ["all", "mine", "built-in"] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];

/** The status filter, over `PublishStatus` — `all` is the absence of a filter, not a status. */
export const LIBRARY_STATUSES = ["all", "published", "archived"] as const;
export type LibraryStatus = (typeof LIBRARY_STATUSES)[number];

/**
 * Who a template belongs to, from the viewer's side: the platform (no author), this account,
 * or somebody else.
 *
 * `"other"` is a real value rather than a corner of `"built-in"`: a row written by another
 * account is neither, and a label that called it a built-in would be the screen lying about
 * where the words came from. The read never returns one (its SQL excludes them), the filter
 * below treats one as invisible, and `canUseTemplate` refuses it.
 */
export function authorshipOf(
  authorUserId: string | null | undefined,
  viewerUserId: string | null,
): TemplateAuthorship {
  const author = authorUserId ?? null;
  if (author === null || author === "") return "built-in";
  return author === viewerUserId ? "mine" : "other";
}

/**
 * May this viewer use (open, duplicate, start an instance from) this template?
 *
 * The one predicate the read, the row actions and `createInstanceFromTemplate` share. A
 * built-in is usable by every account, a template is usable by the account that wrote it and
 * by nobody else, and a template written before the author column existed is a built-in.
 */
export function canUseTemplate(
  authorUserId: string | null | undefined,
  viewerUserId: string | null,
): boolean {
  const author = authorUserId ?? null;
  if (author === null || author === "") return true;
  return viewerUserId !== null && author === viewerUserId;
}

/** The tab a query parameter names, or `all` for anything unrecognised (a typed URL). */
export function parseLibraryView(value: string | undefined): LibraryView {
  return LIBRARY_VIEWS.find((view) => view === value) ?? "all";
}

/** The status filter a query parameter names, or `all`. */
export function parseLibraryStatus(value: string | undefined): LibraryStatus {
  return LIBRARY_STATUSES.find((status) => status === value) ?? "all";
}

/** What a row's archive control asks for: the state this row is *not* in. */
export function archiveTargetOf(status: PublishStatus): "archived" | "published" {
  return status === "archived" ? "published" : "archived";
}

/**
 * Apply the tab, the status filter and the search box, in that order.
 *
 * Search is a case-insensitive substring over the title only. The summary is not searched on
 * purpose: it is derived text ("Written in the app: 5 Aspects…") for authored templates and
 * fixture prose for built-ins, so a match on it would be a match on the app's own sentence
 * rather than on anything the author chose. The list is small enough that a title match is the
 * honest question — the catalogue spec rejected a search box for the same reason and this one
 * exists because this screen is the author's management surface, not a picker.
 */
export function filterLibrary(
  templates: readonly LibraryTemplate[],
  filter: { readonly view: LibraryView; readonly status: LibraryStatus; readonly query: string },
): readonly LibraryTemplate[] {
  const query = filter.query.trim().toLowerCase();
  return templates.filter((template) => {
    // A row belonging to another account is not a row this screen may draw, whatever tab is
    // selected. The read never returns one; this is the second half of the same rule.
    if (template.authorship === "other") return false;
    if (filter.view === "mine" && template.authorship !== "mine") return false;
    if (filter.view === "built-in" && template.authorship !== "built-in") return false;
    if (filter.status !== "all" && template.status !== filter.status) return false;
    if (query !== "" && !template.title.toLowerCase().includes(query)) return false;
    return true;
  });
}

/**
 * The three states the screen has to be able to draw, named so the view cannot invent a fourth:
 *
 *   `empty`      the account can use no template at all — no built-ins in this database and
 *                nothing of its own. Not the same fact as a filter that matched nothing.
 *   `no-match`   there are templates, the current tab/status/search excludes them all.
 *   `list`       at least one row.
 */
export type LibraryState = "empty" | "no-match" | "list";

export function libraryStateOf(
  visible: readonly LibraryTemplate[],
  shown: readonly LibraryTemplate[],
): LibraryState {
  if (visible.length === 0) return "empty";
  return shown.length === 0 ? "no-match" : "list";
}
