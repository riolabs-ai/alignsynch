#!/usr/bin/env node
/**
 * scripts/nav-menu.ts — the rail's document, checked and previewed (#861).
 *
 * `data/nav-menu.json` is the Admin sidebar: groups, rows, order, rung and visibility, in one
 * file. That move is only safe if a broken rail cannot be committed, so this script is the
 * second half of the contract `content/nav.ts` states in prose — the schema proves the shape, and
 * this proves the *references*:
 *
 *   --check     schema valid; `id`, `href` and label id unique; every `href` resolves in
 *               `content/routes.ts`; every `icon` is a `NavIconName`; every group and row label is
 *               an item of `nav-alignsynch` in `data/pages/shell.ts`; every `needs` is a rung of
 *               `content/role-ladder.ts`; every `hidden` row carries a reason. Every failure names
 *               the group and the row it is in, because "groups.2.items.7.icon: invalid" sends the
 *               reader to a JSON pointer instead of to the line an editor typed.
 *   --tree      the rail as ASCII, resolved through `lib/nav-menu.ts::menuFor` — the same filter
 *               the sidebar runs, so what it prints is what the shell draws for that rung.
 *   --unplaced  every `page.tsx` under `app/(mainlayout)/admin/**` with no rail row. Three today,
 *               on purpose: they are the live proof this verb works, and placing them is a
 *               separate change.
 *
 * `--check` runs in every lane of `scripts/verify.sh` (it reads files only, ~0.1 s) and is never
 * a CI-only step: the YAML calls the gate script and nothing else.
 *
 * **Pure — no React, no database, no clock.** It reads the document, the route manifest, the
 * ladder, the shell's copy fixture and the admin page tree, and it writes to stdout. Nothing here
 * renders, connects or waits, which is why it can afford to run in the docs lane.
 *
 * **Runs as plain source.** `node scripts/nav-menu.ts --check` on a fresh clone, with no compile
 * step: Node 24 strips the types, and the repo's resolver (`scripts/ts-resolver.mjs`) is
 * registered below so the `@/` alias and this tree's extensionless imports resolve — the same hook
 * the `db:*` scripts pass on the command line, registered here so the command is one word. The
 * `nav:menu` package script therefore needs no flags of its own.
 *
 * **Why the repo's modules are loaded dynamically.** The entry file has to run *before* the
 * resolver it registers can help it, so every import of this tree's TypeScript source happens
 * after `register()` — which, with this tsconfig's `target`, means inside `main()` rather than as
 * a top-level `await` (a top-level await needs `target: es2017`, and the app's target is ES6).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

register("./ts-modules.mjs", import.meta.url);

type NavModule = typeof import("../content/nav");
type NavMenuModule = typeof import("../lib/nav-menu");
type PageCopyModule = typeof import("../lib/page-copy");
type RouteManifestModule = typeof import("../content/route-manifest");
type RoutesModule = typeof import("../content/routes");
type RoleLadderModule = typeof import("../content/role-ladder");
type ShellModule = typeof import("../data/pages/shell");

type UserRole = RoleLadderModule["USER_ROLES"][number];

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOCUMENT_PATH = "data/nav-menu.json";
const ADMIN_ROOT = "app/(mainlayout)/admin";

/**
 * A brand whose rail this document describes.
 *
 * `alignsynch` is the only one: `components/layout/nav-menus.tsx`'s `switch` draws the quiz brand's
 * own fixed menu, which has no rungs. `--brand quizhub` says so rather than printing an empty tree,
 * because "the document does not govern this brand" is the answer to the question a reader is
 * asking.
 */
const BRANDS = ["alignsynch", "quizhub"] as const;
type BrandId = (typeof BRANDS)[number];

let nav: NavModule;
let navMenu: NavMenuModule;
let pageCopy: PageCopyModule;
let routeManifestModule: RouteManifestModule;
let routes: RoutesModule;
let ladder: RoleLadderModule;
let shell: ShellModule;

/** Load this tree's TypeScript source, now that the resolver can read it. */
async function load(): Promise<void> {
  nav = await import("../content/nav");
  navMenu = await import("../lib/nav-menu");
  pageCopy = await import("../lib/page-copy");
  routeManifestModule = await import("../content/route-manifest");
  routes = await import("../content/routes");
  ladder = await import("../content/role-ladder");
  shell = await import("../data/pages/shell");
}

/* ------------------------------------------------------------------ *
 * Output
 * ------------------------------------------------------------------ */

function usageText(): string {
  return `nav:menu — the rail's document (#861)

  pnpm nav:menu --check                                    schema, ids, hrefs, icons, labels, rungs
  pnpm nav:menu --tree [--as <role>] [--brand <brand>]     the rail as one rung sees it
  pnpm nav:menu --unplaced                                 admin pages with no rail row

roles:  ${ladder.USER_ROLES.join(" < ")}
brands: ${BRANDS.join(" | ")} (the document governs alignsynch; quizhub draws its own menu)`;
}

/** Every finding this run makes, in the order they were found. */
const findings: string[] = [];

function finding(message: string): void {
  findings.push(message);
}

/* ------------------------------------------------------------------ *
 * --check
 * ------------------------------------------------------------------ */

/** `undefined` past the end of a path — an issue path can name a key the object never had. */
function valueAt(root: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[key as PropertyKey];
  }
  return current;
}

/**
 * Where a schema issue lives, in the words the editor used: the group id and the row id, with the
 * JSON path beside them for a pointer. A zod path is enough for a machine and useless for a
 * person, and the whole point of this check is that a one-line edit gets a one-line answer.
 */
function describePath(root: unknown, path: readonly PropertyKey[]): string {
  const parts = path.map(String);
  const itemsAt = parts.lastIndexOf("items");
  const groupsAt = parts.indexOf("groups");
  if (itemsAt >= 2 && groupsAt >= 0) {
    const groupIndex = Number(parts[itemsAt - 1]);
    const rowIndex = Number(parts[itemsAt + 1]);
    const rowId = valueAt(root, ["groups", groupIndex, "items", rowIndex, "id"]);
    const groupId = valueAt(root, ["groups", groupIndex, "id"]);
    const where = typeof groupId === "string" ? `group "${groupId}"` : `groups[${groupIndex}]`;
    const row = typeof rowId === "string" ? `row "${rowId}"` : `items[${rowIndex}]`;
    return `${where} · ${row} (${parts.join(".")})`;
  }
  if (groupsAt === 0 && parts.length >= 2) {
    const groupIndex = Number(parts[1]);
    const groupId = valueAt(root, ["groups", groupIndex, "id"]);
    const where = typeof groupId === "string" ? `group "${groupId}"` : `groups[${groupIndex}]`;
    return `${where} (${parts.join(".")})`;
  }
  return parts.length > 0 ? parts.join(".") : "document";
}

/** The raw value a failing issue is about, so the message quotes what the editor typed. */
function receivedAt(root: unknown, path: readonly PropertyKey[]): string {
  const value = valueAt(root, path);
  if (value === undefined) return "";
  return ` — got ${JSON.stringify(value)}`;
}

function readDocument(): unknown {
  const source = readFileSync(join(ROOT, DOCUMENT_PATH), "utf8");
  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    finding(`${DOCUMENT_PATH}: not valid JSON — ${(error as Error).message}`);
    return undefined;
  }
}

function check(): number {
  const raw = readDocument();
  if (raw === undefined) return report();

  const parsed = nav.zNavDocument.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const message = issue.message.split("\n")[0];
      finding(`${describePath(raw, issue.path)}: ${message}${receivedAt(raw, issue.path)}`);
    }
    return report();
  }

  const document = parsed.data;
  if (document.version > nav.NAV_DOCUMENT_VERSION) {
    finding(
      `${DOCUMENT_PATH}: version ${document.version} — this build reads version ${nav.NAV_DOCUMENT_VERSION} (bump content/nav.ts's NAV_DOCUMENT_VERSION in the same change)`,
    );
  }

  const navSection = pageCopy.sectionOf(shell.shellPageCopy, "nav-alignsynch");
  const labelIds = new Set((navSection.items ?? []).map((item) => item.id));
  const icons = new Set<string>(nav.NAV_ICON_NAMES);
  const rungs = new Set<string>(ladder.USER_ROLES);

  const groupIds = new Set<string>();
  const rowIds = new Set<string>();
  const hrefs = new Set<string>();
  const labelUses = new Map<string, string>();
  let rows = 0;
  let hidden = 0;
  let adminRows = 0;

  for (const group of document.groups) {
    const groupAt = `group "${group.id}"`;
    if (groupIds.has(group.id)) finding(`${groupAt}: the group id is used twice`);
    groupIds.add(group.id);
    if (!labelIds.has(group.label)) {
      finding(
        `${groupAt}: heading "${group.label}" is not an item of "nav-alignsynch" in data/pages/shell.ts`,
      );
    }

    for (const row of group.items) {
      rows += 1;
      if (row.href.startsWith("/admin")) adminRows += 1;
      const at = `${groupAt} · row "${row.id}"`;

      if (rowIds.has(row.id)) finding(`${at}: the row id is used twice`);
      rowIds.add(row.id);

      if (hrefs.has(row.href)) finding(`${at}: "${row.href}" is drawn by another row already`);
      hrefs.add(row.href);

      if (!icons.has(row.icon)) {
        finding(`${at}: icon "${row.icon}" is not a NavIconName (${[...icons].join(", ")})`);
      }
      if (!rungs.has(row.needs)) {
        finding(
          `${at}: needs "${row.needs}" is not a rung of content/role-ladder.ts (${ladder.USER_ROLES.join(" < ")})`,
        );
      }
      if (routeManifestModule.matchRoute(routes.routeManifest, row.href) === undefined) {
        finding(`${at}: href "${row.href}" resolves no route in content/routes.ts`);
      }

      const labelId = row.label ?? row.id;
      if (!labelIds.has(labelId)) {
        finding(
          `${at}: label id "${labelId}" is not an item of "nav-alignsynch" in data/pages/shell.ts`,
        );
      } else if (labelUses.has(labelId)) {
        finding(
          `${at}: both this row and ${labelUses.get(labelId)} draw "${labelId}" — one word, one row`,
        );
      } else {
        labelUses.set(labelId, at);
      }

      if (row.hidden === true) {
        hidden += 1;
        if ((row.reason ?? "").trim() === "") {
          finding(`${at}: hidden with no reason — a hidden row says why it is kept`);
        }
      }
    }
  }

  if (findings.length > 0) return report();

  console.log(
    `nav:menu — ${DOCUMENT_PATH} v${document.version} · ${document.groups.length} groups · ${rows} rows (${adminRows} admin, ${hidden} hidden)`,
  );
  console.log(
    `  ${hrefs.size} hrefs resolve · ${icons.size} icons · ${labelUses.size} labels · ${ladder.USER_ROLES.length} rungs · 0 findings`,
  );
  return 0;
}

function report(): number {
  for (const message of findings) console.error(`✗ ${message}`);
  console.error(
    `\nnav:menu — ${findings.length} finding${findings.length === 1 ? "" : "s"} in ${DOCUMENT_PATH}; the rail would not build`,
  );
  return 1;
}

/* ------------------------------------------------------------------ *
 * --tree
 * ------------------------------------------------------------------ */

function tree(role: UserRole, brand: BrandId): number {
  if (brand !== "alignsynch") {
    console.log(
      `brand=${brand} — this document governs the AlignSynch rail only. The quiz brand draws its own fixed menu (QuizHubMenu in components/layout/nav-menus.tsx), which has no rungs and no document.`,
    );
    return 0;
  }

  const navSection = pageCopy.sectionOf(shell.shellPageCopy, "nav-alignsynch");
  const groups = navMenu.menuFor(role);

  const raw = readDocument();
  const parsed = raw === undefined ? undefined : nav.zNavDocument.safeParse(raw);
  const document = parsed?.success === true ? parsed.data : undefined;
  const hiddenRows =
    document?.groups.flatMap((group) =>
      group.items.filter((row) => row.hidden === true).map((row) => ({ group: group.id, row })),
    ) ?? [];

  const drawn = groups.reduce((total, group) => total + group.items.length, 0);
  const labels = groups.flatMap((group) =>
    group.items.map((item) => pageCopy.itemLabel(navSection, item.id)),
  );
  const labelWidth = Math.max(...labels.map((label) => label.length), 0);
  const hrefWidth = Math.max(
    ...groups.flatMap((group) => group.items.map((item) => item.href.length)),
    0,
  );

  console.log(`rail · brand=alignsynch · role=${role} · ${groups.length} groups · ${drawn} rows`);

  groups.forEach((group, groupIndex) => {
    const lastGroup = groupIndex === groups.length - 1;
    console.log(
      `${lastGroup ? "└─" : "├─"} ${pageCopy.itemLabel(navSection, group.label)} (${group.label})`,
    );
    group.items.forEach((item, rowIndex) => {
      const lastRow = rowIndex === group.items.length - 1;
      const trunk = lastGroup ? "   " : "│  ";
      const marks: string[] = [item.needs];
      if (item.exact === true) marks.push("exact");
      if (item.tourAnchor !== undefined) marks.push(`tour:${item.tourAnchor}`);
      console.log(
        `${trunk}${lastRow ? "└─" : "├─"} ${pageCopy.itemLabel(navSection, item.id).padEnd(labelWidth)}  ${item.href.padEnd(hrefWidth)}  [${marks.join(", ")}]`,
      );
    });
  });

  if (hiddenRows.length > 0) {
    console.log(`\nhidden — ${hiddenRows.length} row(s) in the document, drawn by nobody:`);
    for (const entry of hiddenRows) {
      console.log(
        `  · ${entry.group} · row "${entry.row.id}" — ${entry.row.reason ?? "(no reason)"}`,
      );
    }
  }

  return 0;
}

/* ------------------------------------------------------------------ *
 * --unplaced
 * ------------------------------------------------------------------ */

/**
 * Every static admin page route under `app/(mainlayout)/admin`, with the file that renders it.
 *
 * A dynamic page (`/admin/instances/[id]`) is not listed: it is a detail of its parent's row, and
 * a rail row for every id would be a rail of placeholders. The verb is about *destinations nobody
 * can reach*, and a detail page is reached from the list that draws it.
 */
function adminPages(directory = ADMIN_ROOT) {
  const pages: { route: string; file: string }[] = [];
  const walk = (path: string, route: string): void => {
    for (const entry of readdirSync(join(ROOT, path)).sort()) {
      const child = `${path}/${entry}`;
      if (statSync(join(ROOT, child)).isDirectory()) {
        // A route group (`(mainlayout)`) is a folder the URL does not carry.
        walk(child, `${route}${/^\(.+\)$/.test(entry) ? "" : `/${entry}`}`);
        continue;
      }
      if (entry !== "page.tsx") continue;
      if (/(^|\/)\[[^\]]+\](\/|$)/.test(route)) continue;
      pages.push({ route, file: child });
    }
  };
  walk(directory, "/admin");
  return pages;
}

function unplaced(): number {
  const raw = readDocument();
  const parsed = raw === undefined ? undefined : nav.zNavDocument.safeParse(raw);
  const placed = new Set(
    parsed?.success === true
      ? parsed.data.groups.flatMap((group) => group.items.map((row) => row.href))
      : [],
  );

  const pages = adminPages();
  const orphans = pages.filter((page) => !placed.has(page.route));
  const width = Math.max(...orphans.map((page) => page.route.length), 0);

  console.log(
    `${orphans.length} of ${pages.length} admin page(s) have no row in ${DOCUMENT_PATH}:`,
  );
  for (const page of orphans) console.log(`  ${page.route.padEnd(width)}  ${page.file}`);
  if (orphans.length === 0) {
    console.log("  (every admin page has a row — nothing is reachable only by URL)");
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function usage(message?: string): number {
  if (message !== undefined) console.error(`✗ ${message}`);
  console.error(usageText());
  return 2;
}

async function main(argv: readonly string[]): Promise<number> {
  let verb: "check" | "tree" | "unplaced" | undefined;
  let role: UserRole = "owner";
  let brand: BrandId = "alignsynch";

  await load();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? undefined : argument.slice(equals + 1);
    const next = (): string | undefined => inline ?? argv[index + 1];

    switch (flag) {
      case "--check":
      case "--tree":
      case "--unplaced": {
        const named = flag.slice(2) as "check" | "tree" | "unplaced";
        if (verb !== undefined && verb !== named) {
          return usage(`${verb} and ${flag} are separate verbs — run one at a time`);
        }
        verb = named;
        break;
      }
      case "--as": {
        const value = next();
        if (value === undefined) return usage("--as needs a role");
        if (!(ladder.USER_ROLES as readonly string[]).includes(value)) {
          return usage(`--as "${value}" is not a role (${ladder.USER_ROLES.join(" | ")})`);
        }
        role = value as UserRole;
        if (inline === undefined) index += 1;
        break;
      }
      case "--brand": {
        const value = next();
        if (value === undefined) return usage("--brand needs a brand");
        if (!(BRANDS as readonly string[]).includes(value)) {
          return usage(`--brand "${value}" is not a brand (${BRANDS.join(" | ")})`);
        }
        brand = value as BrandId;
        if (inline === undefined) index += 1;
        break;
      }
      case "--help":
      case "-h":
        return usage();
      default:
        return usage(`unknown argument "${argument}"`);
    }
  }

  switch (verb) {
    case "check":
      return check();
    case "tree":
      return tree(role, brand);
    case "unplaced":
      return unplaced();
    default:
      return usage("say what to do: --check, --tree or --unplaced");
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
