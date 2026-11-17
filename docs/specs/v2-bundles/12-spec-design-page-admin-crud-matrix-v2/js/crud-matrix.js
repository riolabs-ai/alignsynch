/* Admin CRUD & Permissions matrix: render rows, filters (URL-shareable), failure state. Preview only. */
(function () {
  const ROOT = document.getElementById("matrix-app");
  if (!ROOT) return;

  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    approx: '<path d="M5 9.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"/><path d="M5 15.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  };
  const svg = (name, cls) =>
    `<svg class="${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

  const CHIP = {
    covered: ["Covered", "synch", "check", "border-synch-mark bg-synch-tint text-synch"],
    hinted: ["Hinted", "small-gap", "approx", "border-small-gap-mark bg-small-gap-tint text-small-gap"],
    missing: ["Missing", "gap", "flag", "border-gap-mark bg-gap-tint text-gap"],
    "n/a": ["N/A", "neutral", "", "border-line bg-background font-medium text-foreground"],
    exists: ["Exists", "neutral", "", "border-line bg-background font-medium text-foreground"],
    "not-found": ["Not Found", "neutral", "", "border-line bg-background font-medium text-foreground"],
    conflict: ["Conflict", "gap", "flag", "border-gap-mark bg-gap-tint text-gap"],
    P0: ["P0", "action", "", "border-transparent bg-action text-action-foreground"],
    P1: ["P1", "tint", "", "border-action/40 bg-action/5 font-medium text-primary"],
    P2: ["P2", "soft", "", "border-transparent bg-secondary text-foreground"],
    "Won't": ["Won't", "neutral", "", "border-line bg-background font-medium text-foreground"],
    "—": ["—", "neutral", "", "border-line bg-background font-medium text-foreground"],
  };
  const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold";

  function chip(key, title) {
    const spec = CHIP[key] || CHIP["n/a"];
    const ico = spec[2] ? svg(spec[2], "size-3.5") : "";
    const t = title ? ` title="${esc(title)}"` : "";
    return `<span class="${BASE} ${spec[3]}" data-qh="components/ui/badge"${t}>${ico}${spec[0]}</span>`;
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function linkify(text) {
    if (!text || text === "—") return "—";
    const src = esc(text);
    return src
      .replace(/(?:\.\.\/[a-z0-9-]+\/)?\b([a-z0-9-]+\.html)((?:\?[^\s)#]+)?(?:#[^\s),;]+)?)/g, (m, page, rest) => {
        return `<a class="text-primary underline underline-offset-2" href="${m}">${esc(m)}</a>`;
      })
      .replace(/#(\d{3,5})\b/g, '<a class="text-primary underline underline-offset-2" href="https://github.com/riolabs-ai/alignsynch/issues/$1">#$1</a>');
  }

  function readData() {
    if (new URLSearchParams(location.search).get("broken") === "1") {
      return { error: "Prototype preview of a missing source (?broken=1). The product page shows this when docs/specs/v2-prototype/crud-matrix.md cannot be parsed." };
    }
    const el = document.getElementById("crud-matrix-source");
    if (!el || !el.textContent.trim()) return { error: "The matrix source is missing from this page." };
    try {
      const data = JSON.parse(el.textContent);
      if (!data || !Array.isArray(data.rows) || data.rows.length === 0) {
        return { error: "The matrix source was parsed but it has no rows." };
      }
      return { data };
    } catch (err) {
      return { error: "The matrix source could not be parsed. " + (err && err.message ? err.message : "") };
    }
  }

  const KEYS = ["object", "role", "status", "upstream", "priority"];

  function filtersFromUrl() {
    const q = new URLSearchParams(location.search);
    const f = {};
    KEYS.forEach((k) => {
      const v = q.get(k);
      if (v) f[k] = v;
    });
    return f;
  }

  function writeUrl(f) {
    const u = new URL(location.href);
    KEYS.forEach((k) => {
      if (f[k]) u.searchParams.set(k, f[k]);
      else u.searchParams.delete(k);
    });
    u.searchParams.delete("broken");
    history.replaceState(null, "", u.pathname.split("/").pop() + u.search + u.hash);
  }

  function matches(row, f) {
    if (f.object && row.objectSlug !== f.object) return false;
    if (f.role && row.roleSlug !== f.role) return false;
    if (f.status && row.prototype !== f.status) return false;
    if (f.upstream && row.upstream !== f.upstream) return false;
    if (f.priority) {
      const want = f.priority === "wont" ? "Won't" : f.priority === "none" ? "—" : f.priority.toUpperCase();
      if (row.mvp !== want) return false;
    }
    return true;
  }

  function rowAttrs(row) {
    return `data-row data-object="${esc(row.objectSlug)}" data-role="${esc(row.roleSlug)}" data-status="${esc(row.prototype)}" data-upstream="${esc(row.upstream)}" data-mvp="${esc(row.mvp)}"`;
  }

  function card(row) {
    return `<article class="rounded-lg border bg-card p-4" ${rowAttrs(row)} data-qh="components/ui/card (matrix row)">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-primary">${esc(row.object)}</h3>
          <p class="mt-0.5 text-sm text-foreground"><span class="font-medium">${esc(row.action)}</span><span class="text-muted-foreground"> · ${esc(row.role)}</span></p>
        </div>
        <div class="flex flex-wrap gap-1.5">${chip(row.prototype, row.prototypeNote)}${chip(row.mvp)}</div>
      </div>
      <p class="mt-2 text-sm text-foreground">${linkify(row.page)}</p>
      <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span>Upstream</span>${chip(row.upstream, row.upstreamNote)}
      </div>
      <p class="mt-2 text-sm text-muted-foreground">${linkify(row.rationale)}</p>
    </article>`;
  }

  function tr(row) {
    return `<tr class="border-t" ${rowAttrs(row)}>
      <td class="px-3 py-2.5 align-top text-sm font-medium text-foreground">${esc(row.object)}</td>
      <td class="px-3 py-2.5 align-top text-sm text-foreground">${esc(row.action)}</td>
      <td class="px-3 py-2.5 align-top text-sm text-foreground">${esc(row.role)}</td>
      <td class="px-3 py-2.5 align-top">${chip(row.prototype, row.prototypeNote)}</td>
      <td class="px-3 py-2.5 align-top text-sm text-foreground">${linkify(row.page)}</td>
      <td class="px-3 py-2.5 align-top">${chip(row.upstream, row.upstreamNote)}</td>
      <td class="px-3 py-2.5 align-top">${chip(row.mvp)}</td>
      <td class="px-3 py-2.5 align-top text-sm text-muted-foreground">${linkify(row.rationale)}</td>
    </tr>`;
  }

  function showFailure(reason) {
    const fail = document.getElementById("matrix-failure");
    const live = document.getElementById("matrix-live");
    if (live) live.hidden = true;
    if (fail) {
      fail.hidden = false;
      const p = fail.querySelector("[data-fail-reason]");
      if (p) p.textContent = reason;
    }
    const shown = document.getElementById("matrix-shown-count");
    if (shown) shown.textContent = "The matrix could not be loaded.";
  }

  const got = readData();
  if (got.error) {
    showFailure(got.error);
    return;
  }
  const data = got.data;

  function apply() {
    const f = filtersFromUrl();
    KEYS.forEach((k) => {
      const el = document.getElementById("filter-" + k);
      if (el) el.value = f[k] || "";
    });
    const clear = document.getElementById("filter-clear");
    if (clear) clear.hidden = !Object.keys(f).length;

    const rows = data.rows.filter((r) => matches(r, f));
    const cards = document.getElementById("matrix-cards");
    const body = document.getElementById("matrix-body");
    const empty = document.getElementById("matrix-empty");
    const shown = document.getElementById("matrix-shown-count");
    if (cards) cards.innerHTML = rows.map(card).join("");
    if (body) body.innerHTML = rows.map(tr).join("");
    if (empty) empty.hidden = rows.length > 0;
    if (shown) {
      shown.textContent = rows.length === data.rows.length
        ? `${data.rows.length} Rows`
        : `Showing ${rows.length} of ${data.rows.length} Rows`;
    }
    const live = document.getElementById("matrix-filter-live");
    if (live) live.textContent = shown ? shown.textContent : "";
  }

  document.getElementById("matrix-filters")?.addEventListener("change", (e) => {
    const t = e.target;
    if (!t || !t.id || !t.id.startsWith("filter-")) return;
    const f = filtersFromUrl();
    const key = t.id.slice("filter-".length);
    if (t.value) f[key] = t.value;
    else delete f[key];
    writeUrl(f);
    apply();
  });
  document.getElementById("filter-clear")?.addEventListener("click", () => {
    writeUrl({});
    apply();
  });

  apply();
})();
