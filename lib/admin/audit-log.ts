/**
 * `/admin/audit` as a value: the filter a URL carries, the one statement that filter becomes, and
 * the two projections the screen draws (#501b, completing #501).
 *
 * **Pure, and that is not decoration.** `lib/admin/act.ts` writes the log and `lib/db/admin-audit.ts`
 * reads it; everything in between — which axes a URL may name, which rows a view holds, what a
 * `before`/`after` value is allowed to show — is a function with no `pg`, no React and no clock.
 * `tests/admin-audit-log.test.ts` seeds three rows through `act()` and then drives the *rendered
 * SQL* of this module against them, so "each filter returns exactly its rows" is answerable with
 * no database, the same way `lib/admin/roles.ts` answers the ladder with no session.
 *
 * **The filter is the URL, not component state.** The sibling list (`components/my-quizzes/
 * my-quizzes.tsx`) filters in the browser because its rows are already in hand; an audit log only
 * grows, so its filters are `WHERE` clauses and the axes live in the query string
 * (`?actor=&action=&table=&from=&to=`). A filtered view is then a link somebody can paste into an
 * incident, which is the whole reason an operator opens this screen.
 *
 * **A value in the log is not a value on the page.** `before`/`after` are JSONB and may carry a
 * party's name, so nothing here returns them as a blob: `auditChangeOf()` splits a value into
 * named fields and truncates each one to `AUDIT_PREVIEW_MAX`. The screen shows the key and the
 * truncation, and the full value only after a click — a screenshot of this table cannot leak a
 * name that the operator did not ask to see.
 *
 * **The vocabulary is the write path's, imported rather than restated.** `AUDIT_TARGET_TABLES` and
 * `AdminAction` are what `act()` refuses an unknown value against; a second list here would be a
 * filter that offers a table nothing writes, or hides one something does. They live in
 * `lib/admin/roles.ts` — pure, beside the action names — precisely so this module can import them
 * without reaching `lib/db/`: `components/admin` renders this screen and must stay a props-only
 * domain.
 */
import { zUserRole, type UserRole } from "@/content/identity";
import {
  ADMIN_ACTIONS,
  AUDIT_TARGET_TABLES,
  type AdminAction,
  type AuditTargetTable,
  isAdminAction,
} from "@/lib/admin/roles";

/** The route. One spelling, read by the page, the gate's `next` and the log's own links. */
export const ADMIN_AUDIT_PATH = "/admin/audit";

/**
 * Rows one view draws.
 *
 * The log is append-only, so an unfiltered read grows forever and a screen that rendered all of it
 * would get slower every week — the failure mode an audit log hits first. 200 is a screenful an
 * operator scrolls; the filter axes are how they get to anything older, and the count line says
 * when the cap was reached instead of pretending the list ended.
 */
export const AUDIT_PAGE_SIZE = 200;

/**
 * How much of a `before`/`after` value the table shows before a click.
 *
 * 48 characters, roughly a name and a word: enough for an operator to recognise a field, short
 * enough that a full `{ "name": "…" }` never renders unopened. The full text is what the
 * disclosure holds, and `auditChangeOf()` is the only thing that produces either.
 */
export const AUDIT_PREVIEW_MAX = 48;

/* ------------------------------------------------------------------ *
 * A row
 * ------------------------------------------------------------------ */

/**
 * One row of `admin_action`, as the screen draws it.
 *
 * `action` and `targetTable` are `string`, not the closed unions, and that is the log's honesty:
 * the table is append-only, so a row may name an action this build has never heard of (an older
 * deploy wrote it, or a newer one did). Printing what the row says is correct; refusing to render
 * it would hide history the moment the vocabulary changed. `isAdminAction()` is what decides
 * whether the filter *offers* a name, and a stored name it does not recognise still renders.
 *
 * `actorEmail` is `null` on a database with no `neon_auth` schema (a scratch branch) and for an
 * account deleted upstream — 0023 stores no foreign key on purpose, so the log outlives the
 * account. The screen prints the user id in that case rather than a blank.
 */
export interface AdminActionRow {
  readonly id: string;
  readonly actorUserId: string;
  readonly actorEmail: string | null;
  /** The rung at the time of the write; `null` for a row written before migration 0024. */
  readonly actorRole: UserRole | null;
  readonly action: string;
  readonly targetTable: string;
  readonly targetId: string;
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
  /** ISO instant: the row crosses to a component, so no `Date` objects. */
  readonly createdAt: string;
}

/* ------------------------------------------------------------------ *
 * The filter
 * ------------------------------------------------------------------ */

/** One axis of the view. `""` means "not filtered", which is what an absent query parameter is. */
export interface AuditFilter {
  /** A user id, or an address. Matched exactly — a filter that guesses is a filter nobody trusts. */
  readonly actor: string;
  readonly action: AdminAction | "";
  readonly table: AuditTargetTable | "";
  /** `YYYY-MM-DD`, inclusive, UTC — the shape `<input type="date">` submits. */
  readonly from: string;
  /** `YYYY-MM-DD`, inclusive: the clause is `< to + 1 day`, so the day itself is inside the view. */
  readonly to: string;
}

export const NO_AUDIT_FILTER: AuditFilter = {
  actor: "",
  action: "",
  table: "",
  from: "",
  to: "",
};

/** The axes, in the order a URL spells them, so a link is stable across a render. */
export const AUDIT_FILTER_KEYS = ["actor", "action", "table", "from", "to"] as const;

export type AuditFilterKey = (typeof AUDIT_FILTER_KEYS)[number];

/** A page's `searchParams`, as Next hands them over: a value may repeat (`?actor=a&actor=b`). */
export type AuditSearchParams = Record<string, string | string[] | undefined>;

/** `YYYY-MM-DD`, and a day that exists — `2026-02-31` is a string, not a date. */
export function isAuditDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(instant)) return false;
  return new Date(instant).toISOString().slice(0, 10) === value;
}

/** One parameter's first value, trimmed. A repeated key takes the first — the URL is a view, not a set. */
function first(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

/**
 * What a URL asks for, with every unrecognised value dropped rather than refused.
 *
 * A page that 400s on `?action=whatever` turns a mistyped link into an error screen; a page that
 * ignores it renders the view without that axis, and the chip row shows what *was* applied, so a
 * dropped value is visible rather than silent. The one thing never dropped silently is a value
 * the vocabulary does know: it is matched exactly (`isAdminAction`, `AUDIT_TARGET_TABLES`).
 */
export function parseAuditFilter(params: AuditSearchParams): AuditFilter {
  const actor = first(params.actor);
  const action = first(params.action);
  const table = first(params.table);
  const from = first(params.from);
  const to = first(params.to);

  return {
    // 128 is `zUserId`'s ceiling: a longer "actor" cannot be an id this app issued, and passing it
    // to Postgres would only be a longer string to compare.
    actor: actor.length > 128 ? "" : actor,
    action: isAdminAction(action) ? action : "",
    table: (AUDIT_TARGET_TABLES as readonly string[]).includes(table)
      ? (table as AuditTargetTable)
      : "",
    // A `from` after the `to` is a window nothing can satisfy; it is kept, because an empty view is
    // the honest answer to a window that contains no day, and silently swapping the ends would
    // render somebody else's query as if it had been theirs.
    from: isAuditDate(from) ? from : "",
    to: isAuditDate(to) ? to : "",
  };
}

/** Does this view ask for anything? The unfiltered view is the log's own order, newest first. */
export function auditFilterIsEmpty(filter: AuditFilter): boolean {
  return AUDIT_FILTER_KEYS.every((key) => filter[key] === "");
}

/** The axes that are set, in URL order — what the chip row draws. */
export function activeAuditAxes(filter: AuditFilter): readonly AuditFilterKey[] {
  return AUDIT_FILTER_KEYS.filter((key) => filter[key] !== "");
}

/**
 * A view's address: the path plus the axes that are set, and nothing else.
 *
 * Built from `parseAuditFilter`'s output rather than from the request's raw query string, so a
 * generated link cannot carry a parameter the screen does not apply (`?page=2`, `?utm=…`).
 */
export function auditFilterHref(filter: AuditFilter): string {
  const query = new URLSearchParams();
  for (const key of AUDIT_FILTER_KEYS) {
    const value = filter[key];
    if (value !== "") query.set(key, value);
  }
  const encoded = query.toString();
  return encoded === "" ? ADMIN_AUDIT_PATH : `${ADMIN_AUDIT_PATH}?${encoded}`;
}

/**
 * The same view with one axis removed — what a chip's × links to.
 *
 * Keeping the other axes is the point: an operator narrowing a log one axis at a time would
 * otherwise re-enter every earlier filter whenever they widened one.
 */
export function auditFilterWithout(filter: AuditFilter, axis: AuditFilterKey): string {
  return auditFilterHref({ ...filter, [axis]: "" });
}

/**
 * The one query the view is read by.
 *
 * **Every value is a bind parameter.** The filter comes from a URL, so a value that reached the
 * text would be an injection with an operator's session attached to it; `tests/admin-audit-log.test.ts`
 * asserts the statement carries no address and no action name in its text.
 *
 * **`withEmail` is a fact about the database, not a preference.** An address lives in
 * `neon_auth."user"`, which 0023 refuses to require (a scratch branch has no auth schema), so the
 * caller asks `to_regclass` first and this function builds the join — or not — from the answer. The
 * filter's actor axis follows the same fact: with an auth schema it matches an id *or* an address;
 * without one, only the id, because there is no address to match.
 *
 * `created_at` is compared as an instant, in UTC, because every date in this tree is: `from` binds
 * that day's midnight and `to` binds the midnight after it, so both ends are inclusive and no
 * label depends on the host's timezone.
 */
export interface AuditStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}

export function auditSelect(
  filter: AuditFilter,
  options: { readonly withEmail: boolean; readonly limit?: number },
): AuditStatement {
  const values: unknown[] = [];
  const clauses: string[] = [];

  if (filter.actor !== "") {
    values.push(filter.actor);
    const at = `$${values.length}`;
    clauses.push(
      options.withEmail
        ? `(a.actor_user_id = ${at} OR lower(u.email) = lower(${at}))`
        : `a.actor_user_id = ${at}`,
    );
  }
  if (filter.action !== "") {
    values.push(filter.action);
    clauses.push(`a.action = $${values.length}`);
  }
  if (filter.table !== "") {
    values.push(filter.table);
    clauses.push(`a.target_table = $${values.length}`);
  }
  if (filter.from !== "") {
    values.push(`${filter.from}T00:00:00.000Z`);
    clauses.push(`a.created_at >= $${values.length}`);
  }
  if (filter.to !== "") {
    const until = Date.parse(`${filter.to}T00:00:00.000Z`) + 86_400_000;
    values.push(new Date(until).toISOString());
    clauses.push(`a.created_at < $${values.length}`);
  }

  values.push(options.limit ?? AUDIT_PAGE_SIZE);

  const text = [
    "SELECT a.id::text AS id,",
    "       a.actor_user_id,",
    options.withEmail ? "       u.email AS actor_email," : "       NULL::text AS actor_email,",
    "       a.actor_role,",
    "       a.action,",
    "       a.target_table,",
    "       a.target_id,",
    "       a.reason,",
    "       a.before,",
    "       a.after,",
    "       a.created_at",
    options.withEmail
      ? '  FROM admin_action a\n  LEFT JOIN neon_auth."user" u ON u.id::text = a.actor_user_id'
      : "  FROM admin_action a",
    clauses.length === 0 ? "" : ` WHERE ${clauses.join(" AND ")}`,
    " ORDER BY a.created_at DESC, a.id DESC",
    ` LIMIT $${values.length}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { text, values };
}

/**
 * The statement that answers "is there an auth schema here?", for the reason above.
 *
 * `to_regclass` returns NULL rather than raising for a missing relation, which is why the guard is
 * a query and not a `LEFT JOIN` the caller hopes will work.
 */
export const AUTH_SCHEMA_PROBE_SQL =
  "SELECT to_regclass('neon_auth.\"user\"') IS NOT NULL AS present";

/* ------------------------------------------------------------------ *
 * before / after, as fields
 * ------------------------------------------------------------------ */

/**
 * One field of a `before`/`after` value, as the disclosure draws it: the key, the truncation, and
 * the text behind the click.
 *
 * `preview` is never the full value — `truncated` says whether a click has anything more to show,
 * so the screen can skip a disclosure that would open onto itself.
 */
export interface AuditChangeField {
  readonly key: string;
  readonly preview: string;
  readonly full: string;
  readonly truncated: boolean;
}

/** A value as text: strings verbatim (no quotes to escape), everything else as JSON. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // A value JSON cannot serialise (a cycle from a driver that hands objects through) would
    // otherwise throw inside a render. Its type is still a fact worth printing.
    return typeof value;
  }
}

/**
 * A `before`/`after` value as keyed fields, truncated.
 *
 * `null` is "there was nothing here" — a create has no before, a delete no after (0023's columns
 * say so) — and it answers `[]`, not a field whose value is the word "null". An array is keys
 * `0..n-1`, an object is its own keys, and a bare scalar has no key to print: it is one field
 * under `value`, so the shape the disclosure draws is the same for every row.
 */
export function auditChangeOf(value: unknown): readonly AuditChangeField[] {
  if (value === null || value === undefined) return [];

  if (typeof value !== "object") {
    const full = textOf(value);
    return [field("value", full)];
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, item] as const);

  return entries.map(([key, item]) => field(key, textOf(item)));
}

function field(key: string, full: string): AuditChangeField {
  // A newline in a value would make a one-line preview two, and the truncation count would be a
  // number the reader cannot check against what they see.
  const flat = full.replace(/\s+/g, " ").trim();
  const truncated = flat.length > AUDIT_PREVIEW_MAX;
  return {
    key,
    // `slice` cuts a name mid-character; the ellipsis is the word "there is more", not a guess.
    preview: truncated ? `${flat.slice(0, AUDIT_PREVIEW_MAX)}…` : flat,
    full: flat,
    truncated,
  };
}

/* ------------------------------------------------------------------ *
 * Where a target lives
 * ------------------------------------------------------------------ */

/**
 * The route that shows a target, when there is one an operator may open.
 *
 * **One entry, and it is a *list*.** `/assessment/instances/[instanceId]` exists, and it resolves
 * the viewer from a cookie or a session and answers 404 to anyone who is not a party (`app/
 * (mainlayout)/assessment/instances/[instanceId]/page.tsx` records why), so linking an operator
 * there is a link to a refusal. The registry lists every instance across accounts and takes no
 * relationship parameter, which makes it the honest destination: the row says which instance, and
 * the link opens the table that can show it.
 *
 * `record` deliberately has no entry. A `record` id is a quiz *or* a template, and the two live at
 * different routes (`/my-quizzes/[id]`, `/assessment/templates/[templateId]`); picking one for an
 * id of unknown kind is a link that sometimes lies, which is worse than a cell that does not link.
 * A table added here is a route somebody checked answers 200 for an admin.
 */
const AUDIT_TARGET_ROUTES: Partial<Record<AuditTargetTable, (id: string) => string>> = {
  session: () => "/admin/instances",
};

/** The cell's text: `table#id`, the log's own handle for what was written. */
export function auditTargetLabel(table: string, id: string): string {
  return `${table}#${id}`;
}

/** A link to the surface that can show the target, or `null` when no route answers for an operator. */
export function auditTargetHref(table: string, id: string): string | null {
  if (!(AUDIT_TARGET_TABLES as readonly string[]).includes(table)) return null;
  const route = AUDIT_TARGET_ROUTES[table as AuditTargetTable];
  return route === undefined ? null : route(id);
}

/* ------------------------------------------------------------------ *
 * The actor, as two facts
 * ------------------------------------------------------------------ */

/**
 * The address to print, or the id when there is no address.
 *
 * A row whose account was deleted upstream keeps its `actor_user_id` (0023 has no foreign key on
 * purpose) and loses every other fact about the person. Printing the id is honest — it is what the
 * log holds — and printing nothing would make two different people look like the same blank cell.
 */
export function auditActorIdentity(row: AdminActionRow): string {
  return row.actorEmail ?? row.actorUserId;
}

/** `member` / `support` / … or `null` — the row's rung, parsed against the live vocabulary. */
export function auditActorRole(row: AdminActionRow): UserRole | null {
  if (row.actorRole === null) return null;
  const parsed = zUserRole.safeParse(row.actorRole);
  return parsed.success ? parsed.data : null;
}

/** Every action the filter may offer: the write path's closed list, in its declared order. */
export const AUDIT_ACTION_OPTIONS: readonly AdminAction[] = ADMIN_ACTIONS;

/** Every target table the filter may offer. */
export const AUDIT_TABLE_OPTIONS: readonly AuditTargetTable[] = AUDIT_TARGET_TABLES;
