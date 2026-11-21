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
 *               `content/routes.ts`; every `icon` is a `NavIconName`; every row label — and every
 *               group heading a group *declares* (a title-less group declares none) — is an item of
 *               `nav-alignsynch` in `data/pages/shell.ts`; every `needs` is a rung of
 *               `content/role-ladder.ts`; every `capability` is a `NAV_CAPABILITY` in
 *               `lib/nav.ts`; every `hidden` row carries a reason. Every failure names
 *               the group and the row it is in, because "groups.2.items.7.icon: invalid" sends the
 *               reader to a JSON pointer instead of to the line an editor typed.
 *   --tree      the rail as ASCII, resolved through `lib/nav-menu.ts::menuFor` — the same filter
 *               the sidebar runs, so what it prints is what the shell draws for that rung.
 *   --unplaced  every `page.tsx` under `app/(mainlayout)/admin/**` with no rail row. Four today,
 *               on purpose (the console's three sub-pages and `/admin/templates`): they are the live
 *               proof this verb works, and placing them is a separate change. Since #862 the same
 *               four are named in `data/nav-menu.json`'s `unlisted` list with a reason — the verb
 *               still reports them because it asks about a *row*, and an `unlisted` surface has
 *               none; `--inventory` and `--tree` are the verbs that answer "is anything missing".
 *   --inventory the **derived** half (#862): walk `app/**` into routes with their brand boundary and
 *               role floor, and write `data/nav-inventory.json` — the committed view the shell
 *               reconciles against. `--check` compares instead of writing and fails on drift, which
 *               is what `data:check` E43 does for itself; the verb is the writer a human runs after
 *               adding a route.
 *
 * **`--source` is a truth test, not a setting.** `both` (the default) draws the document and the
 * `Unplaced` group; `derived` ignores the document entirely ("what does the tree actually contain?");
 * `document` trusts the file and draws no findings. `--tree` respects it, and the served rail reads
 * the same three values from the build's own `NAV_SOURCE` (see `lib/nav-menu.ts`).
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
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

register("./ts-modules.mjs", import.meta.url);

type NavModule = typeof import("../content/nav");
type NavMenuModule = typeof import("../lib/nav-menu");
type NavReconcileModule = typeof import("../lib/nav-reconcile");
type NavInventoryModule = typeof import("./nav-inventory");
type ChromeNavModule = typeof import("../lib/nav");
type PageCopyModule = typeof import("../lib/page-copy");
type RouteManifestModule = typeof import("../content/route-manifest");
type RoutesModule = typeof import("../content/routes");
type RoleLadderModule = typeof import("../content/role-ladder");
type ShellModule = typeof import("../data/pages/shell");

type UserRole = RoleLadderModule["USER_ROLES"][number];
/** The reconciler's source union, as a type — a module namespace exports values, not types. */
type NavSource = import("../lib/nav-reconcile").NavSource;

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DOCUMENT_PATH = "data/nav-menu.json";
const INVENTORY_PATH = "data/nav-inventory.json";
const APP_ROOT = "app";
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
let reconcile: NavReconcileModule;
let inventoryModule: NavInventoryModule;
let chrome: ChromeNavModule;
let pageCopy: PageCopyModule;
let routeManifestModule: RouteManifestModule;
let routes: RoutesModule;
let ladder: RoleLadderModule;
let shell: ShellModule;

/** Load this tree's TypeScript source, now that the resolver can read it. */
async function load(): Promise<void> {
  nav = await import("../content/nav");
  navMenu = await import("../lib/nav-menu");
  reconcile = await import("../lib/nav-reconcile");
  inventoryModule = await import("./nav-inventory");
  chrome = await import("../lib/nav");
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
  return `nav:menu — the rail's document (#861) and the tree it reconciles against (#862)

  pnpm nav:menu --check [--inventory-check]          schema, ids, hrefs, icons, labels, rungs, unlisted
  pnpm nav:menu --tree [--as <role>] [--source <s>]  the rail as one rung sees it
  pnpm nav:menu --unplaced                           admin pages with no rail row
  pnpm nav:menu --inventory                          write data/nav-inventory.json from app/**
  pnpm nav:menu --inventory --check                  compare instead — exit 1 on drift

roles:   ${ladder.USER_ROLES.join(" < ")}
sources: ${reconcile.NAV_SOURCES.join(" | ")} (default ${reconcile.DEFAULT_NAV_SOURCE})
brands:  ${BRANDS.join(" | ")} (the document governs alignsynch; quizhub draws its own menu)`;
}

/** Everything the reconciler needs on hand: the tree as it is on disk, walked once. */
function appSources(): { path: string; source: string }[] {
  const sources: { path: string; source: string }[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(join(ROOT, path)).sort()) {
      const child = `${path}/${entry}`;
      if (statSync(join(ROOT, child)).isDirectory()) {
        walk(child);
        continue;
      }
      if (!entry.endsWith(".tsx") && !entry.endsWith(".ts")) continue;
      sources.push({ path: child, source: readFileSync(join(ROOT, child), "utf8") });
    }
  };
  walk(APP_ROOT);
  return sources;
}

/** The inventory of this tree, as the CLI sees it — the same call `data:check` E43 makes. */
function currentInventory(): ReturnType<NavInventoryModule["inventoryFrom"]> {
  return inventoryModule.inventoryFrom(appSources());
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
  const capabilities = new Set<string>(chrome.NAV_CAPABILITIES);

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
    // A group may omit `label` (a title-less run above the first heading — `group-project-spec`).
    // The absence is what says "draw no heading", so the check is on the declared id only: a
    // heading that *is* declared must still resolve to a word the fixture carries.
    if (group.label !== undefined && !labelIds.has(group.label)) {
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
      if (row.capability !== undefined && !capabilities.has(row.capability)) {
        finding(
          `${at}: capability "${row.capability}" is not a NAV_CAPABILITY in lib/nav.ts (${[...capabilities].join(", ")})`,
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

  /**
   * #862 — the `unlisted` list: the surfaces the rail does not owe.
   *
   * A run of groups says what the rail draws; this says what it deliberately does not, and the two
   * halves must not overlap: an `unlisted` href that is also a row would be a door with two
   * statements, and the row would win silently in a render.
   */
  const unlistedHrefs = new Set<string>();
  for (const entry of document.unlisted ?? []) {
    const at = `unlisted "${entry.href}"`;
    if (unlistedHrefs.has(entry.href)) finding(`${at}: named twice`);
    unlistedHrefs.add(entry.href);
    if (hrefs.has(entry.href)) {
      finding(`${at}: a group's row already places this destination — one statement, one door`);
    }
    if (entry.reason.trim() === "") {
      finding(`${at}: no reason — an unlisted surface says why the rail does not owe it`);
    }
    if (routeManifestModule.matchRoute(routes.routeManifest, entry.href) === undefined) {
      finding(`${at}: resolves no route in content/routes.ts`);
    }
  }

  if (findings.length > 0) return report();

  const unlisted = unlistedHrefs.size;
  console.log(
    `nav:menu — ${DOCUMENT_PATH} v${document.version} · ${document.groups.length} groups · ${rows} rows (${adminRows} admin, ${hidden} hidden) · ${unlisted} unlisted`,
  );
  console.log(
    `  ${hrefs.size} hrefs resolve · ${icons.size} icons · ${labelUses.size} labels · ${ladder.USER_ROLES.length} rungs · 0 findings`,
  );
  // #862 — the census, every run: the document checked against the tree it is supposed to cover.
  console.log(`  ${reconcile.coverageLine(navMenu.navCoverage())} (E43)`);
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

function tree(role: UserRole, brand: BrandId, source: NavSource): number {
  if (brand !== "alignsynch") {
    console.log(
      `brand=${brand} — this document governs the AlignSynch rail only. The quiz brand draws its own fixed menu (QuizHubMenu in components/layout/nav-menus.tsx), which has no rungs and no document.`,
    );
    return 0;
  }

  const navSection = pageCopy.sectionOf(shell.shellPageCopy, "nav-alignsynch");
  const rebuilt = navMenu.railFor(role, undefined, source);
  const groups = rebuilt.groups;

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

  console.log(
    `rail · brand=alignsynch · role=${role} · source=${source} · ${groups.length} groups · ${drawn} rows · ${rebuilt.unplaced.length} unplaced`,
  );

  groups.forEach((group, groupIndex) => {
    const lastGroup = groupIndex === groups.length - 1;
    // A title-less group prints its id and says so, rather than a resolved heading it does not have.
    const heading =
      group.label === undefined
        ? `(no heading) (${group.id})`
        : `${pageCopy.itemLabel(navSection, group.label)} (${group.label})`;
    console.log(`${lastGroup ? "└─" : "├─"} ${heading}`);
    group.items.forEach((item, rowIndex) => {
      const lastRow = rowIndex === group.items.length - 1;
      const trunk = lastGroup ? "   " : "│  ";
      const marks: string[] = [item.needs];
      if (item.capability !== undefined) marks.push(`cap:${item.capability}`);
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

  if (rebuilt.unplaced.length > 0) {
    const width = Math.max(...rebuilt.unplaced.map((surface) => surface.href.length), 0);
    console.log(`\nunplaced — ${rebuilt.unplaced.length} door(s) the rail does not draw:`);
    for (const surface of rebuilt.unplaced) {
      console.log(`  · ${surface.href.padEnd(width)}  [${surface.kind}] ${surface.reason}`);
    }
  } else if (source !== "document") {
    console.log("\nunplaced — none: every route in the tree is placed or accounted for");
  }

  return 0;
}

/* ------------------------------------------------------------------ *
 * --inventory
 * ------------------------------------------------------------------ */

/**
 * `data/nav-inventory.json` — the tree, committed (#862).
 *
 * The shell reconciles at import time with no I/O, so the derived half has to be a file in the
 * bundle. It is generated, never authored: `--inventory` walks `app/**` and writes it, `--check`
 * compares the file with a fresh walk and names the first difference, and `data:check` **E43**
 * makes the same comparison in every gate lane — so a page added without a regeneration is a red
 * build rather than a rail that quietly disagrees with the tree.
 */
function inventory(write: boolean): number {
  const built = currentInventory();
  const document = reconcile.inventoryDocument(built);
  const json = `${JSON.stringify(document, null, 2)}\n`;
  const path = join(ROOT, INVENTORY_PATH);

  if (write) {
    writeFileSync(path, json, "utf8");
    console.log(
      `nav:inventory — wrote ${INVENTORY_PATH} · ${document.walked} page.tsx walked · ${document.surfaces.length} static routes`,
    );
    return 0;
  }

  const existing = readFileSync(path, "utf8");
  if (JSON.stringify(JSON.parse(existing)) === JSON.stringify(document)) {
    console.log(
      `nav:inventory — ${INVENTORY_PATH} is current · ${document.walked} page.tsx walked · ${document.surfaces.length} static routes`,
    );
    return 0;
  }
  finding(
    `${INVENTORY_PATH} disagrees with app/** — run \`pnpm nav:menu --inventory\` (the tree is the truth, the file is the copy)`,
  );
  return report();
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
  let verb: "check" | "tree" | "unplaced" | "inventory" | undefined;
  let role: UserRole = "owner";
  let brand: BrandId = "alignsynch";
  let compare = false;

  await load();

  // After `load()`: the default lives in the reconciler, and a module cannot be read before it is
  // imported — an initialiser here would run first and see `undefined`.
  let source: NavSource = reconcile.DEFAULT_NAV_SOURCE;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? undefined : argument.slice(equals + 1);
    const next = (): string | undefined => inline ?? argv[index + 1];

    switch (flag) {
      case "--check": {
        // `--inventory --check` compares; `--check` alone is the document's own validation.
        compare = true;
        if (verb === undefined) verb = "check";
        if (verb !== "check" && verb !== "inventory") {
          return usage("--check goes with --inventory or on its own — not with --tree");
        }
        break;
      }
      case "--tree":
      case "--unplaced":
      case "--inventory": {
        const named = flag.slice(2) as "tree" | "unplaced" | "inventory";
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
      case "--source": {
        const value = next();
        if (value === undefined) return usage("--source needs one of: document | derived | both");
        if (!(reconcile.NAV_SOURCES as readonly string[]).includes(value)) {
          return usage(
            `--source "${value}" is not a source (${reconcile.NAV_SOURCES.join(" | ")})`,
          );
        }
        source = value as NavSource;
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
      return tree(role, brand, source);
    case "unplaced":
      return unplaced();
    case "inventory":
      return inventory(!compare);
    default:
      return usage("say what to do: --check, --tree, --unplaced or --inventory");
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
