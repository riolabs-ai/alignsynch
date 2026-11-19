/* AlignSynch v2.0 prototype behaviour — vanilla, no deps. In the Next.js port each block maps to
   component state: tabs → Radix Tabs, role → session member, setting → relationship.setting. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const setState = (el, on) => { el.dataset.state = on ? "active" : "inactive"; };

  /* Mobile nav sheet */
  const nav = $("#mobile-nav");
  $$("[data-open-nav]").forEach(b => b.addEventListener("click", () => { nav.hidden = false; $("[data-close-nav].size-10", nav)?.focus(); }));
  $$("[data-close-nav]").forEach(b => b.addEventListener("click", () => { nav.hidden = true; }));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && nav && !nav.hidden) nav.hidden = true; });

  /* Tabs (Radix semantics: roving tabindex, arrows, Home/End, hash deep-link) */
  const tabs = $$("[role=tab][data-tab]");
  function selectTab(key, focus) {
    tabs.forEach(t => {
      const on = t.dataset.tab === key;
      t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; setState(t, on);
      $("#panel-" + t.dataset.tab).hidden = !on;
      if (on && focus) t.focus();
      if (on) t.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    if ($("[data-tab-query]")) { const u = new URL(location.href); u.searchParams.set("tab", key); u.hash = ""; history.replaceState(null, "", u); }
    else history.replaceState(null, "", "#" + key);
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t.dataset.tab));
    t.addEventListener("keydown", e => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return; e.preventDefault();
      selectTab(tabs[(n + tabs.length) % tabs.length].dataset.tab, true);
    });
  });
  const h = location.hash.slice(1);
  if (tabs.length && tabs.some(t => t.dataset.tab === h)) selectTab(h);
  // Pass 9: ?tab=<key> (Templates: library | mine) opens that tab without a hash jump
  const qtab = new URLSearchParams(location.search).get("tab");
  if (tabs.length && !h && qtab && tabs.some(t => t.dataset.tab === qtab)) { selectTab(qtab); history.replaceState(null, "", location.pathname + location.search); }
  $$("[data-tab-link]").forEach(a => a.addEventListener("click", e => { if (tabs.some(t => t.dataset.tab === a.dataset.tabLink)) { e.preventDefault(); selectTab(a.dataset.tabLink, true); } }));
  // In-page links like "Add a Card" → #payment open that tab and bring it into view.
  window.addEventListener("hashchange", () => {
    const k = location.hash.slice(1);
    if (tabs.some(t => t.dataset.tab === k)) { selectTab(k, true); const y = $("[role=tablist]").getBoundingClientRect().top + scrollY - 80; scrollTo({ top: y, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
  });

  /* Relationship state. ?state=draft|invited|joined|waiting|live|trial-ended|trial-ended-extended, or an arrival:
     ?from=wizard (Invite Sent), ?from=wizard&draft=1 (Draft), ?from=join (Counterparty just accepted).
     In the port this is derived from the relationship + member rows, never a query string. */
  const qs = new URLSearchParams(location.search);
  const from = qs.get("from");
  const STATES = ["draft", "invited", "joined", "waiting", "live", "trial-ended", "trial-ended-extended"];
  const variant = STATES.includes(qs.get("state")) ? qs.get("state")
    : from === "wizard" ? (qs.get("draft") === "1" ? "draft" : "invited") : from === "join" ? "joined" : "live";  // from=extend lands on live
  const prelive = variant === "draft" || variant === "invited";
  // Trial ended with no card: Stage 6 is PAUSED, never closed. Everything tagged "live" stays visible
  // (read-only) except [data-exact] blocks (status line, Next Step, membership facts).
  const paused = variant === "trial-ended" || variant === "trial-ended-extended";
  const pending = !paused && variant !== "live";
  document.body.dataset.variant = variant;
  $$("[data-variant-show]").forEach(el => {
    const t = el.dataset.variantShow.split(" ");
    el.hidden = !(t.includes(variant) || (paused && t.includes("paused")) || (paused && t.includes("live") && !el.hasAttribute("data-exact"))
      || (pending && t.includes("pending")) || (prelive && t.includes("prelive")) || (!prelive && t.includes("stage6")));
  });
  // ?ext=1: the one free extra week is running (prototype swap; the port reads trial_extended_at).
  const extended = qs.get("ext") === "1";
  $$("[data-ext]").forEach(el => { el.hidden = el.dataset.ext !== (extended ? "1" : "0"); });
  $$("[data-state-link]").forEach(a => { const on = a.dataset.stateLink === variant; setState(a, on); if (on) a.setAttribute("aria-current", "page"); });
  const banner = $("[data-wizard-banner]");
  const arrival = from === "wizard" ? (variant === "draft" ? "draft" : "sent") : from === "join" ? "join" : from === "extend" ? "extend" : null;
  if (banner && arrival) {
    banner.hidden = false;
    $$("[data-banner-show]", banner).forEach(el => { el.hidden = el.dataset.bannerShow !== arrival; });
    $$("[data-suggested]", banner).forEach(el => { el.hidden = qs.get("suggested") !== "1"; });
    $("[data-dismiss-banner]", banner).addEventListener("click", () => {
      banner.hidden = true; ["from", "draft", "suggested"].forEach(k => qs.delete(k));
      if (!qs.get("state")) qs.set("state", variant);
      history.replaceState(null, "", location.pathname + "?" + qs + location.hash);
    });
  }

  /* Role preview (prototype only) */
  const AV = {
    initiator: '<span class="relative flex size-9 shrink-0 overflow-hidden rounded-full"><span class="flex h-full w-full items-center justify-center rounded-full bg-initiator-solid text-sm font-semibold text-white">MR</span></span>',
    counterparty: '<span class="relative flex size-9 shrink-0 overflow-hidden rounded-full"><span class="flex h-full w-full items-center justify-center rounded-full bg-counterparty-solid text-sm font-semibold text-white">ER</span></span>',
  };
  const fixed = document.body.dataset.roleFixed;
  function setRole(role) {
    document.body.dataset.role = role;
    $$("[data-role-btn]").forEach(b => { const on = b.dataset.roleBtn === role; setState(b, on); b.setAttribute("aria-pressed", on); });
    $$("[data-show-role]").forEach(el => { el.hidden = el.dataset.showRole !== role; });
    $$("[data-you-tag]").forEach(el => { el.hidden = el.dataset.youTag !== role; });
    $$("[data-settings-input]").forEach(i => { i.disabled = role !== "initiator" || paused; });
    if (paused) $$("[data-pause-lock]").forEach(b => { b.disabled = true; });
    const av = $("[data-you-avatar]"); if (av) av.innerHTML = AV[role];
    if (!prelive && !fixed) try { localStorage.setItem("as-role", role); } catch (e) {}
  }
  $$("[data-role-btn]").forEach(b => b.addEventListener("click", () => setRole(b.dataset.roleBtn)));
  let saved = "initiator"; try { saved = localStorage.getItem("as-role") || "initiator"; } catch (e) {}
  let startRole = fixed || qs.get("role") || (from === "join" ? "counterparty" : saved);
  if (prelive && !fixed) {  // Elena can't see the relationship before she accepts
    startRole = "initiator";
    $$("[data-role-btn='counterparty']").forEach(b => { b.disabled = true; b.title = "Elena hasn’t joined yet"; });
  }
  setRole(startRole);

  /* Likes */
  $$("[aria-pressed][aria-label^='Like']").forEach(b => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true"; const s = $("span", b); const n = +s.textContent + (on ? 1 : -1);
    s.textContent = n; b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", "Like, " + n);
    b.classList.toggle("bg-mist", on);
  }));

  /* Composer (preview only) */
  const post = $("[data-post]");
  if (post) post.addEventListener("click", () => {
    const ta = $("#composer"); const text = ta.value.trim(); if (!text) { ta.focus(); return; }
    const role = document.body.dataset.role; const first = role === "initiator" ? "Marcus" : "Elena";
    const art = document.createElement("article");
    art.className = "rounded-md border border-action/40 p-4";
    art.innerHTML = `<div class="flex items-start gap-3">${AV[role].replace("size-9", "size-8").replace("text-sm", "text-xs")}<div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="font-medium">${first}</span><span class="text-xs text-muted-foreground">Just now · Preview</span></div><p class="mt-2 text-sm leading-6"></p></div></div>`;
    $("p", art).textContent = text;
    const list = $("#panel-discussion [data-variant-show='live']"); list.hidden = false;
    const empty = $("#panel-discussion [data-variant-show='pending']"); if (empty) empty.hidden = true;
    list.prepend(art); ta.value = "";
  });

  /* Align: Setting re-scores every status; filters */
  const ICON = { check: '<path d="M20 6 9 17l-5-5"/>', flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>', approx: '<path d="M5 9.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"/><path d="M5 15.5a6.5 6.5 0 0 1 7 0 6.5 6.5 0 0 0 7 0"/>' };
  const svg = n => `<svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
  const BASE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold";
  function statusChip(g, setting) {
    let [label, tone, ic] = g === 0 ? ["In Synch", "border-synch-mark bg-synch-tint text-synch", "check"]
      : g === 1 ? ["Small Gap", "border-small-gap-mark bg-small-gap-tint text-small-gap", "approx"]
      : ["Gap", "border-gap-mark bg-gap-tint text-gap", "flag"];
    const ok = g !== 1 ? "" : setting === "soft" ? '<span class="font-medium">· OK</span>' : '<span class="font-medium">· Not OK under Full</span>';
    if (g === 1 && setting === "full") tone = "border-gap-mark bg-gap-tint text-gap";
    return `<span class="${BASE} ${tone}" data-qh="components/ui/badge" data-status-chip data-gap="${g}">${svg(ic)}${label}${ok}</span>`;
  }
  const aligned = (g, s) => g === 0 || (g === 1 && s === "soft");
  let setting = "soft", filter = "all";
  function render() {
    $$("[data-row-chip]").forEach(c => { c.innerHTML = statusChip(+c.closest("[data-row]").dataset.gap, setting); });
    $$("[data-aspect-chip]").forEach(c => { c.innerHTML = statusChip(Math.min(+c.closest("[data-aspect]").dataset.worst, 2), setting); });
    const ws = $$("[data-aspect-list] [data-aspect]").map(a => +a.dataset.worst);
    if (!ws.length) return;
    const nA = ws.filter(w => aligned(w, setting)).length;
    $("[data-aligned]").textContent = nA;
    $("[data-count='synch']").textContent = ws.filter(w => w === 0).length;
    $("[data-count='small']").textContent = ws.filter(w => w === 1).length;
    $("[data-count='gap']").textContent = ws.filter(w => w >= 2).length;
    // Under Full a 1-step Gap is not OK: repaint its band and its summary segment in Gap colours.
    $$("[data-row]").forEach(r => { const b = $("[data-band]", r); if (b && +r.dataset.gap === 1) { const soft = setting === "soft";  // Full: the Small Gap outline turns vivid Gap orange
      ["ring-small-gap-mark", "outline", "outline-1", "outline-offset-2", "outline-small-gap"].forEach(c => b.classList.toggle(c, soft));
      ["ring-gap-mark", "ring-offset-1", "ring-offset-background"].forEach(c => b.classList.toggle(c, !soft)); } });
    // Summary segments: under Full a Small Gap keeps its word and ≈ icon but takes the vivid Gap colour.
    $$("[data-seg]").forEach(sg => { if (+sg.dataset.worst !== 1) return; const bar = $("[data-seg-bar]", sg); const soft = setting === "soft";
      bar.classList.toggle("bg-small-gap-mark", soft); bar.classList.toggle("ring-1", soft); bar.classList.toggle("ring-inset", soft); bar.classList.toggle("ring-small-gap", soft); bar.classList.toggle("text-foreground", soft);
      bar.classList.toggle("bg-gap-mark", !soft); bar.classList.toggle("text-white", !soft);
      const w = $("[data-seg-word]", sg); if (w) w.textContent = soft ? "Small Gap · OK" : "Small Gap · Not OK";
      sg.setAttribute("aria-label", sg.dataset.title + ": " + w.textContent); });
    $("[data-count-talk]").textContent = ws.length - nA; $("[data-count-aligned]").textContent = nA;
    $("[data-headline]").textContent = setting === "soft"
      ? "You agree on more than you differ. Two Aspects need a conversation."
      : "Under Full, every difference counts. Four Aspects need a conversation, two of them only by one step.";
    $("[data-setting-note]").textContent = setting === "soft" ? "A Small Gap (1 step) counts as aligned." : "Only In Synch (0 steps) counts as aligned.";
    $$("[data-aspect-list] [data-aspect]").forEach(a => {
      const w = +a.dataset.worst; const ok = aligned(w, setting);
      a.hidden = filter === "talk" ? ok : filter === "aligned" ? !ok : false;
      const v = $("[data-verdict]", a);
      v.textContent = w === 0 ? "Aligned under either Alignment Tolerance." : w === 1 ? (setting === "soft" ? "Under Soft, this counts as aligned." : "Under Full, this needs a conversation.") : "Worth a conversation.";
    });
  }
  $$("[data-setting-btn]").forEach(b => b.addEventListener("click", () => {
    setting = b.dataset.settingBtn;
    $$("[data-setting-btn]").forEach(x => { const on = x === b; setState(x, on); x.setAttribute("aria-checked", on); });
    render();
  }));
  $$("[data-filter]").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.filter;
    $$("[data-filter]").forEach(x => { const on = x === b; setState(x, on); x.setAttribute("aria-pressed", on); });
    render();
  }));
  render();

  /* Counterparty join: 3 steps, ?step=1|2|3. Auth is a visual mock. */
  const steps = $$("[data-step]");
  if (steps.length) {
    const go = (n, focus) => {
      n = Math.min(Math.max(+n || 1, 1), steps.length);
      steps.forEach(s => { s.hidden = +s.dataset.step !== n; });
      $$("[data-step-dot]").forEach(d => {
        const k = +d.dataset.stepDot; d.dataset.state = k < n ? "done" : k === n ? "current" : "todo";
        if (k === n) d.setAttribute("aria-current", "step"); else d.removeAttribute("aria-current");
      });
      $$("[data-step-count]").forEach(c => { c.textContent = n; });
      const u = new URLSearchParams(location.search); u.set("step", n);
      history.replaceState(null, "", location.pathname + "?" + u);
      if (focus) { window.scrollTo(0, 0); const h = $(`[data-step="${n}"] h1`); if (h) h.focus(); }
    };
    $$("[data-go]").forEach(b => b.addEventListener("click", e => { e.preventDefault(); go(b.dataset.go, true); }));
    $$("[data-auth-tab]").forEach(b => b.addEventListener("click", () => {
      $$("[data-auth-tab]").forEach(x => { const on = x === b; setState(x, on); x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; });
      $$("[data-auth-pane]").forEach(p => { p.hidden = p.dataset.authPane !== b.dataset.authTab; });
    }));
    $$("[data-auth-form]").forEach(f => f.addEventListener("submit", e => { e.preventDefault(); go(3, true); }));
    const accept = $("[data-accept]");
    if (accept) accept.addEventListener("click", () => {
      const sug = $("#suggestion"); const s = sug && sug.value.trim() ? "&suggested=1" : "";
      location.href = "../03-spec-design-page-relationship-detail-v2/relationship-detail.html?role=counterparty&from=join" + s;
    });
    go(new URLSearchParams(location.search).get("step") || 1, false);
  }

  /* Pass 8 · Create Relationship wizard (Stages 1–5). ?stage=1..5, ?from=template|my-template */
  const wz = $("[data-wizard]");
  if (wz) {
    const q = new URLSearchParams(location.search);
    const NAMES = ["Details", "Settings", "Aspects", "Account", "Invite"];
    const PLAN_Q = { single: "Single", family: "Family", annual: "Single Annual" };
    const from = q.get("from") === "my-template" ? "my-template" : "template";
    if (q.get("from") === "public" || q.get("from") === "pricing") {
      $$("[data-back-template]").forEach(a => { a.href = "relationship-template-public.html"; });
      $$("[data-exit]").forEach(a => { a.href = "relationship-templates.html"; a.querySelector("span").textContent = "Exit"; });
      $$("[data-from-link]").forEach(a => { a.href = "relationship-templates.html#catalog"; });
    }
    $$("[data-from-show]").forEach(e => { e.hidden = e.dataset.fromShow !== from; });
    if (from === "my-template") {
      $$("[data-back-template]").forEach(a => { a.href = "../06-spec-design-page-templates-v2/my-template-detail.html"; a.querySelector("span").textContent = "Back to My Template"; });
      $$("[data-exit]").forEach(a => { a.href = "../06-spec-design-page-templates-v2/my-template-detail.html"; });
      $$("[data-from-link]").forEach(a => { a.href = "../06-spec-design-page-templates-v2/templates.html?tab=mine"; });
    }
    let max = 1, cur = 1;
    const val = n => { const e = $(`[name="${n}"]:checked`); return e ? e.value : ""; };
    function refresh() {
      const t = $("#rel-title").value.trim() || "Untitled Relationship";
      const on = $$("[data-aspect-toggle]").filter(i => i.checked).length;
      const out = {
        title: t,
        role: (val("role") === "sister" ? "Sister" : "Brother") + " · Initiator",
        mode: val("mode") === "advanced" ? "Advanced · Feel, Wish, Think, Guess" : "Basic · Feel and Wish",
        tolerance: val("tolerance") === "full" ? "Full · Small Gap Not OK" : "Soft · Small Gap OK",
        aspects: on + (on === 1 ? " Aspect" : " Aspects"),
        plan: "Free Trial · Starts When Elena Accepts" + (PLAN_Q[q.get("plan")] ? " · then " + PLAN_Q[q.get("plan")] : ""),
        message: $("#cp-msg").value
      };
      $$("[data-out]").forEach(e => { if (out[e.dataset.out] !== undefined) e.textContent = out[e.dataset.out]; });
      const per = val("mode") === "advanced" ? 1.2 : 0.6;
      $$("[data-aspect-count]").forEach(e => { e.textContent = on; });
      $$("[data-aspect-min]").forEach(e => { e.textContent = Math.max(1, Math.round(on * per)); });
    }
    function paint() {
      $$("[data-stage]").forEach(s => { s.hidden = +s.dataset.stage !== cur; });
      $$("[data-gauge-stage]").forEach(g => { g.hidden = +g.dataset.gaugeStage !== cur; });
      $$("[data-rail]").forEach(b => {
        const n = +b.dataset.rail, st = n < cur || (n <= max && n !== cur) ? "done" : n === cur ? "current" : "todo";
        b.dataset.state = st; b.disabled = n > max || n === cur;
        if (n === cur) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        $(`[data-rail-sub="${n}"]`).textContent = st === "done" ? "Done" : st === "current" ? "In Progress" : n === cur + 1 ? "Up Next" : "Later";
      });
      $$("[data-bar]").forEach(b => { const n = +b.dataset.bar; b.dataset.state = n === cur ? "current" : n <= max ? "done" : "todo"; });
      $$("[data-stage-num]").forEach(e => { e.textContent = cur; });
      $$("[data-stage-name]").forEach(e => { e.textContent = NAMES[cur - 1]; });
      document.title = `Stage ${cur} · ${NAMES[cur - 1]} · Create Relationship · AlignSynch v2.0 prototype`;
    }
    function valid() {
      if (cur !== 1) return true;
      const ok = $("#rel-title").value.trim().length > 0;
      const err = $("[data-title-error]");
      err.classList.toggle("hidden", ok); err.classList.toggle("flex", !ok);
      $("#rel-title").setAttribute("aria-invalid", !ok);
      if (!ok) $("#rel-title").focus();
      return ok;
    }
    function go(n, focus = true) {
      n = Math.min(5, Math.max(1, +n || 1));
      if (n > cur && !valid()) return;
      cur = n; max = Math.max(max, n); paint(); refresh();
      const u = new URL(location.href); u.searchParams.set("stage", n); history.replaceState(null, "", u);
      if (focus) { window.scrollTo(0, 0); $(`#stage-${n}-title`).focus(); }
    }
    $$("[data-wz-go]").forEach(b => b.addEventListener("click", () => go(b.dataset.wzGo)));
    $$("[data-rail]").forEach(b => b.addEventListener("click", () => go(b.dataset.rail)));
    wz.addEventListener("input", refresh); wz.addEventListener("change", refresh);
    // Aspects: keep at least one on
    const lockLast = () => {
      const on = $$("[data-aspect-toggle]").filter(x => x.checked);
      $$("[data-aspect-min-note]").forEach(e => { e.hidden = on.length !== 1; });
      on.forEach(x => { x.disabled = on.length === 1; });
      if (on.length > 1) $$("[data-aspect-toggle]").forEach(x => { x.disabled = false; });
      $$("[data-aspect-total]").forEach(e => { e.textContent = $$("[data-aspect-toggle]").length; });
      refresh();
    };
    wz.addEventListener("change", e => { if (e.target.matches("[data-aspect-toggle]")) lockLast(); });
    wz.addEventListener("aspect-change", lockLast);
    // Stage 4 auth tabs (mock) → signed-in
    const at = $$("[data-wz-auth-tab]");
    function authTab(k, f) {
      at.forEach(t => { const on = t.dataset.wzAuthTab === k; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; t.dataset.state = on ? "active" : "inactive"; if (on && f) t.focus(); });
      $$("[data-wz-auth]").forEach(f2 => { f2.hidden = f2.dataset.wzAuth !== k; });
    }
    at.forEach((t, i) => {
      t.addEventListener("click", () => authTab(t.dataset.wzAuthTab));
      t.addEventListener("keydown", e => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); authTab(at[(i + 1) % 2].dataset.wzAuthTab, true); } });
    });
    $$("[data-wz-auth]").forEach(f => f.addEventListener("submit", e => {
      e.preventDefault(); $("[data-auth-box]").hidden = true; const s = $("[data-signed-in]"); s.hidden = false;
    }));
    go(q.get("stage") || 1, false);
    if (+q.get("stage") > 1) { max = +q.get("stage"); paint(); }
    // Pass 10 · ?edit=draft|invited: re-enter Stages 1–3 from Relationship Detail. Account and Invite are already done.
    const edit = ["draft", "invited"].includes(q.get("edit")) ? q.get("edit") : null;
    if (edit) {
      const back = `../03-spec-design-page-relationship-detail-v2/relationship-detail.html?state=${edit}`;
      document.title = "Edit Relationship · AlignSynch v2.0 prototype";
      $$("header p.truncate").forEach(p => { p.textContent = "Edit Relationship"; });
      $$("[data-exit]").forEach(a => { a.href = back; a.querySelector("span").textContent = "Cancel"; });
      $$("[data-back-template]").forEach(a => { a.href = back; a.querySelector("span").textContent = "Cancel"; });
      $$("[data-rail='4'], [data-rail='5']").forEach(b => { b.closest("li").hidden = true; });
      $$("[data-bar='4'], [data-bar='5']").forEach(b => { b.hidden = true; });
      $$("[data-proto-bar]").forEach(b => { b.hidden = true; });
      max = 3; paint();
      const n3 = $("[data-stage='3'] [data-wz-next]"); const save = n3.cloneNode(true);
      save.removeAttribute("data-wz-go"); save.querySelector("span").textContent = "Save Changes"; save.dataset.wzSave = "";
      save.addEventListener("click", () => { location.href = back + "&notice=saved"; }); n3.replaceWith(save);
      $$("[data-stage='1'], [data-stage='2']").forEach(st => {
        const f = $("[data-wz-next]", st).parentElement; const sv = document.createElement("a");
        sv.href = back + "&notice=saved"; sv.className = "inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium text-primary hover:bg-mist lg:h-10"; sv.textContent = "Save Changes"; sv.dataset.wzSave = "";
        f.prepend(sv);
      });
      const note = document.createElement("p");
      note.className = "flex items-start gap-2 rounded-md border border-status-line bg-status px-3 py-2 text-sm text-foreground";
      note.innerHTML = edit === "invited" ? "Elena hasn’t joined yet, so you can still change everything. She sees the new version when she opens the invite." : "This is a draft. Change anything, then send the invite when you’re ready.";
      note.dataset.editNote = ""; $("[data-wizard] .min-w-0.space-y-4").prepend(note);
    }
  }

  /* Pass 8 · list filters (My Relationships, Library, My Templates): data-filter + data-*-search, empty states */
  const fbtns = $$("[data-filter]");
  if (fbtns.length) {
    const items = $$("[data-rel-filter]"); const search = $("[data-rel-search]");
    let f = "all";
    const apply = () => {
      const t = (search?.value || "").trim().toLowerCase(); let n = 0;
      items.forEach(i => { const ok = (f === "all" || i.dataset.relFilter.split(" ").includes(f)) && (!t || i.textContent.toLowerCase().includes(t)); i.hidden = !ok; if (ok) n++; });
      fbtns.forEach(b => { const on = b.dataset.filter === f; b.dataset.state = on ? "active" : "inactive"; b.setAttribute("aria-pressed", on); });
      const e = $("[data-empty-filter]"); if (e) e.hidden = n > 0;
      const l = $("[data-filter-live]"); if (l) l.textContent = n + (n === 1 ? " result" : " results");
    };
    fbtns.forEach(b => b.addEventListener("click", () => { f = b.dataset.filter; apply(); }));
    search?.addEventListener("input", apply);
    $$("[data-filter-reset]").forEach(b => b.addEventListener("click", () => { f = "all"; if (search) search.value = ""; apply(); }));
    const qf = new URLSearchParams(location.search).get("filter"); if (qf && fbtns.some(b => b.dataset.filter === qf)) { f = qf; apply(); }
  }
  if (new URLSearchParams(location.search).get("empty") === "1") {
    $$("[data-has-rels]").forEach(e => { e.hidden = true; }); $$("[data-empty-all]").forEach(e => { e.hidden = false; });
  }

  /* Pass 8 · template proposal (mock submit) */
  $$("[data-proposal]").forEach(f => f.addEventListener("submit", e => { e.preventDefault(); f.hidden = true; const d = $("[data-proposal-done]"); d.hidden = false; d.querySelector("p").focus?.(); }));

  /* Pass 8 · chat: general view, or ?relationship=<id> opens one thread (list hides below lg) */
  if ($("[data-chat]")) {
    const rq = new URLSearchParams(location.search).get("relationship");
    const th = rq && $(`[data-thread="${rq}"]`);
    if (th) {
      th.hidden = false; $("[data-thread-empty]").classList.replace("lg:flex", "lg:hidden");
      $("[data-thread-list]").classList.add("hidden", "lg:block");
      $(`[data-thread-link="${rq}"]`)?.setAttribute("aria-current", "page");
    }
  }
  $$("[data-tag-chip]").forEach(c => c.addEventListener("click", () => { const g = c.parentElement; $$("[data-tag-chip]", g).forEach(o => o.setAttribute("aria-pressed", o === c && c.getAttribute("aria-pressed") !== "true")); }));
  $$("[data-chat-form]").forEach(f => f.addEventListener("submit", e => {
    e.preventDefault(); const t = $("textarea", f); if (!t.value.trim()) return;
    const sec = f.closest("[data-thread]"); const ol = $("[aria-label=Messages]", sec);
    const mine = $$("li.flex-row-reverse", ol).pop(); if (!mine) return;
    const li = mine.cloneNode(true); const box = $(".rounded-lg.border", li);
    const tag = $$("[data-tag-chip][aria-pressed=true]", f)[0];
    box.textContent = t.value.trim();
    if (tag) { const sp = document.createElement("span"); sp.className = "mt-2 flex flex-wrap items-center gap-1.5"; sp.innerHTML = `<span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">${tag.textContent}</span>`; box.append(sp); }
    $("p span", li).nextSibling.textContent = " · Just now"; ol.append(li); t.value = "";
  }));

  /* Pass 8 · payment page: add-card mock, one-time extension, Counterparty view never shows payment */
  if ($("[data-billing-owner]")) {
    const pq = new URLSearchParams(location.search);
    if (pq.get("role") === "counterparty") { $("[data-billing-owner]").hidden = true; $("[data-billing-cp]").hidden = false; $$("[data-you-avatar]").forEach(a => a.hidden = true); }
    const form = $("[data-card-form]");
    $$("[data-add-card-open]").forEach(b => b.addEventListener("click", () => { $("[data-card-none]").hidden = true; form.hidden = false; $("#cc-name").focus(); }));
    $$("[data-card-cancel]").forEach(b => b.addEventListener("click", () => { form.hidden = true; $("[data-card-none]").hidden = false; }));
    form.addEventListener("submit", e => {
      e.preventDefault(); form.hidden = true; $("[data-card-saved]").hidden = false;
      $$("[data-add-card-open]").forEach(b => b.hidden = true); $$("[data-extend-once]").forEach(b => b.hidden = true);
      const n = $("[data-bill='cofound'] [data-bill-note]"); if (n) n.textContent = "Card added. Stage 6 is running again.";
    });
    $$("[data-extend-once]").forEach(b => b.addEventListener("click", () => {
      b.hidden = true; const n = b.closest("[data-bill]").querySelector("[data-bill-note]");
      n.textContent = "7 more days added, until Nov 23. Stage 6 is running again. This extra week is one time only.";
    }));
  }

  /* Pass 9 · relationship-template.html?public=1 renders the marketing-shell variant */
  if (/relationship-template\.html$/.test(location.pathname)) {
    const q9 = new URLSearchParams(location.search);
    if (q9.get("public") === "1") { q9.delete("public"); location.replace("relationship-template-public.html" + (q9.toString() ? "?" + q9 : "") + location.hash); }
  }
  /* Pass 9 · public shell: mobile menu; ?from=pricing&plan=<id> step banner + plan carried on every template/wizard link */
  $$("[data-pub-menu]").forEach(b => b.addEventListener("click", () => { const m = $("#pub-menu"); m.hidden = !m.hidden; b.setAttribute("aria-expanded", !m.hidden); }));
  {
    const pq = new URLSearchParams(location.search); const plan = pq.get("plan");
    const PLANS = { single: ["Single", "$9.99 / month"], family: ["Family", "$19.99 / month"], annual: ["Single Annual", "$99 / year"] };
    if (plan && PLANS[plan]) {
      $$("[data-plan-banner]").forEach(b => { b.hidden = false; });
      $$("[data-plan-name]").forEach(n => { n.hidden = n.dataset.planName !== plan; });
      $$("a[href]").forEach(a => {
        const h = a.getAttribute("href");
        if (!/(^|\/)(relationship-template-public\.html|wizard\.html)/.test(h)) return;
        const [base, hash] = h.split("#"); const u = new URL(base, location.href);
        u.searchParams.set("plan", plan); if (pq.get("from") === "pricing" && !u.searchParams.get("from")) u.searchParams.set("from", "pricing");
        a.setAttribute("href", base.split("?")[0] + u.search + (hash ? "#" + hash : ""));
      });
      $$("[data-plan-chosen]").forEach(e => { e.hidden = false; });
      $$("[data-plan-label]").forEach(e => { e.textContent = PLANS[plan][0]; });
      $$("[data-plan-price]").forEach(e => { e.textContent = PLANS[plan][1]; });
      window.__plan = PLANS[plan];
    }
  }

  /* ===== Pass 10 · shared UX: store, toast, one neutral modal, kebab menus, Aspect drawer ===== */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ICO = {
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', check: '<path d="M20 6 9 17l-5-5"/>', lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  };
  const svg10 = (n, c = "size-4") => `<svg class="${c} shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
  const BTN = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-11 px-4 lg:h-10";
  const BTN_ACTION = BTN + " bg-action text-action-foreground hover:bg-action-hover";
  const BTN_GHOST = BTN + " text-primary hover:bg-mist";
  const INPUT = "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10";
  const AREA_C = "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  // Toast (components/ui/toast): one polite live region, bottom centre on mobile, bottom right on desktop.
  function toast(msg, link) {
    let r = $("[data-toast-region]");
    if (!r) { r = document.createElement("div"); r.dataset.toastRegion = ""; r.setAttribute("role", "status"); r.setAttribute("aria-live", "polite");
      r.className = "pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"; document.body.append(r); }
    const t = document.createElement("div");
    t.className = "pointer-events-auto flex max-w-sm items-center gap-3 rounded-md border bg-action px-4 py-3 text-sm text-action-foreground shadow-lg";
    t.innerHTML = `${svg10("check", "size-4 text-action-foreground")}<span class="min-w-0 flex-1">${esc(msg)}</span>` + (link ? `<a href="${link[1]}" class="shrink-0 font-semibold underline underline-offset-4">${esc(link[0])}</a>` : "");
    if (link && link[2]) { const a = t.querySelector("a"); a.addEventListener("click", e => { e.preventDefault(); link[2](); t.remove(); }); }
    r.append(t); setTimeout(() => t.remove(), 5200);
  }
  // One neutral modal (components/ui/alert-dialog) for every confirm and small form. Destructive confirms are graphite with an ×.
  function modal({ title, body = "", confirm = "Confirm", ico = "x", fields = [], cancel = "Cancel" }) {
    return new Promise(res => {
      const d = document.createElement("dialog");
      d.className = "w-[calc(100%-2rem)] max-w-md rounded-lg border bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/40";
      d.setAttribute("aria-labelledby", "modal-title"); d.dataset.modal = "";
      const f = fields.map((x, i) => {
        const id = "mf-" + i;
        if (x.type === "select") return `<div class="space-y-1.5"><label for="${id}" class="text-sm font-medium">${esc(x.label)}</label><select id="${id}" name="${x.name}" class="${INPUT}">${x.options.map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join("")}</select></div>`;
        if (x.type === "radio") return `<fieldset class="space-y-2"><legend class="text-sm font-medium">${esc(x.label)}</legend><div class="grid gap-2 sm:grid-cols-3">${x.options.map((o, j) => `<label class="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-action has-[:checked]:bg-mist"><input type="radio" name="${x.name}" value="${esc(o[0])}" ${j === 0 ? "checked" : ""} class="size-4 accent-action">${esc(o[1])}</label>`).join("")}</div></fieldset>`;
        const hint = x.hint ? `<p class="text-xs text-muted-foreground">${esc(x.hint)}</p>` : "";
        return `<div class="space-y-1.5"><label for="${id}" class="text-sm font-medium">${esc(x.label)}</label>` + (x.type === "area"
          ? `<textarea id="${id}" name="${x.name}" rows="3" class="${AREA_C}" ${x.required ? "required" : ""}>${esc(x.value || "")}</textarea>`
          : `<input id="${id}" name="${x.name}" value="${esc(x.value || "")}" class="${INPUT}" ${x.required ? "required" : ""}>`) + hint + `</div>`;
      }).join("");
      d.innerHTML = `<form method="dialog" class="space-y-4 p-5"><div><h2 id="modal-title" class="text-lg font-semibold text-primary">${esc(title)}</h2>${body ? `<p class="mt-1.5 text-sm text-foreground">${body}</p>` : ""}</div>${f}
        <div class="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button value="cancel" formnovalidate class="${BTN_GHOST}" data-modal-cancel>${esc(cancel)}</button><button value="ok" class="${BTN_ACTION}" data-modal-ok>${ico ? svg10(ico) : ""}<span>${esc(confirm)}</span></button></div></form>`;
      document.body.append(d);
      const back = document.activeElement;
      d.addEventListener("close", () => {
        const ok = d.returnValue === "ok"; const vals = {};
        $$("[name]", d).forEach(i => { if (i.type === "radio") { if (i.checked) vals[i.name] = i.value; } else vals[i.name] = i.value; });
        d.remove(); back?.focus?.(); res(ok ? vals : null);
      });
      d.showModal(); ($("input, textarea, select", d) || $("[data-modal-ok]", d)).focus();
    });
  }
  window.AS = { toast, modal, store };

  // Kebab / dropdown menus: click or Enter opens, arrows move, Escape or outside click closes.
  const closeMenus = except => $$("[data-kebab-menu]").forEach(m => { if (m !== except && !m.hidden) { m.hidden = true; m.parentElement.querySelector("[data-kebab-btn]").setAttribute("aria-expanded", "false"); } });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-kebab-btn]");
    if (b) { const m = b.parentElement.querySelector("[data-kebab-menu]"); closeMenus(m); m.hidden = !m.hidden; b.setAttribute("aria-expanded", !m.hidden); if (!m.hidden) $("[role=menuitem]", m)?.focus(); e.stopPropagation(); return; }
    if (!e.target.closest("[data-kebab-menu]")) closeMenus();
    else if (e.target.closest("[role=menuitem]")) setTimeout(() => closeMenus(), 0);
  });
  document.addEventListener("keydown", e => {
    const m = e.target.closest?.("[data-kebab-menu]"); if (!m) return;
    const items = $$("[role=menuitem]", m).filter(i => !i.hidden); const i = items.indexOf(e.target);
    if (e.key === "Escape") { closeMenus(); m.parentElement.querySelector("[data-kebab-btn]").focus(); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus(); }
  });
  // Account menu follows the previewed role
  const syncYou = () => { const cp = document.body.dataset.role === "counterparty";
    $$("[data-you-name]").forEach(e => { e.textContent = cp ? "Elena Reyes" : "Marcus Reyes"; }); $$("[data-you-email]").forEach(e => { e.textContent = cp ? "elena.r@example.com" : "marcus.reyes@example.com"; }); };
  new MutationObserver(syncYou).observe(document.body, { attributes: true, attributeFilter: ["data-role"] }); syncYou();
  $$("[data-sign-out]").forEach(a => a.addEventListener("click", () => { try { localStorage.removeItem("as-role"); } catch (e) {} }));
  if (qs.get("signed-out") === "1") toast("You’re signed out.");

  // Aspect drawer (components/ui/sheet, right side). Title, prompt, left and right poles. The 1–5 scale is locked, never a field.
  function aspectDrawer(a, isNew) {
    return new Promise(res => {
      const d = document.createElement("dialog");
      d.className = "fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-full max-w-md overflow-y-auto border-l bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/40";
      d.setAttribute("aria-labelledby", "drawer-title"); d.dataset.aspectDrawer = "";
      const cells = [1, 2, 3, 4, 5].map(k => `<span class="flex items-center justify-center bg-scale-${k} text-xs font-medium text-foreground">${k}</span>`).join("");
      const fld = (n, l, v, area, hint) => `<div class="space-y-1.5"><label for="ad-${n}" class="text-sm font-medium">${l}</label>${area ? `<textarea id="ad-${n}" name="${n}" rows="3" class="${AREA_C}" required>${esc(v)}</textarea>` : `<input id="ad-${n}" name="${n}" value="${esc(v)}" class="${INPUT}" required maxlength="40">`}${hint ? `<p class="text-xs text-muted-foreground">${hint}</p>` : ""}</div>`;
      d.innerHTML = `<form method="dialog" class="flex min-h-full flex-col">
        <div class="flex items-start justify-between gap-3 border-b p-5"><div><p class="text-xs font-semibold uppercase tracking-wider text-deep">${isNew ? "New Aspect" : "Edit Aspect"}</p><h2 id="drawer-title" class="text-lg font-semibold text-primary">${isNew ? "Add an Aspect" : esc(a.title)}</h2></div>
          <button value="cancel" formnovalidate class="${BTN_GHOST} h-10 w-10 px-0" aria-label="Close">${svg10("x")}</button></div>
        <div class="flex-1 space-y-4 p-5">
          ${fld("title", "Title", a.title, false, "A short name, like Old Roles.")}
          ${fld("prompt", "Prompt", a.prompt, true, "The question you both answer.")}
          <div class="grid grid-cols-2 gap-3">${fld("left", "1 Means", a.left)}${fld("right", "5 Means", a.right)}</div>
          <div class="rounded-md border bg-paper p-3"><p class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">${svg10("lock", "size-3.5")}Scale Locked · 1–5 for every Aspect</p>
            <div class="mt-2 grid h-6 grid-cols-5 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10" aria-hidden="true">${cells}</div>
            <div class="mt-1 flex justify-between gap-2 text-xs text-muted-foreground"><span>1 · <span data-pv="left">${esc(a.left)}</span></span><span class="text-right">5 · <span data-pv="right">${esc(a.right)}</span></span></div></div>
        </div>
        <div class="flex flex-col-reverse gap-2 border-t p-5 sm:flex-row sm:justify-end"><button value="cancel" formnovalidate class="${BTN_GHOST}">Cancel</button><button value="ok" class="${BTN_ACTION}" data-drawer-save>${isNew ? "Add Aspect" : "Save Aspect"}</button></div></form>`;
      document.body.append(d);
      d.addEventListener("input", e => { const p = e.target.name; const pv = $(`[data-pv="${p}"]`, d); if (pv) pv.textContent = e.target.value; });
      const back = document.activeElement;
      d.addEventListener("close", () => {
        const ok = d.returnValue === "ok"; const v = {}; $$("[name]", d).forEach(i => { v[i.name] = i.value.trim(); });
        d.remove(); back?.focus?.(); res(ok ? v : null);
      });
      d.showModal(); $("#ad-title", d).focus();
    });
  }
  const readRow = r => { const v = {}; ["title", "prompt", "left", "right"].forEach(k => { v[k] = $(`[data-f="${k}"]`, r)?.textContent.trim() || ""; }); return v; };
  const writeRow = (r, v) => {
    ["title", "prompt", "left", "right"].forEach(k => $$(`[data-f="${k}"]`, r).forEach(e => { e.textContent = v[k]; }));
    $$("[role=img][aria-label^='Scale']", r).forEach(e => e.setAttribute("aria-label", `Scale 1 ${v.left} to 5 ${v.right}`));
    $$("[data-asp-edit]", r).forEach(b => b.setAttribute("aria-label", "Edit " + v.title));
    $$("[role=switch]", r).forEach(b => b.setAttribute("aria-label", "Include " + v.title));
  };
  document.addEventListener("click", async e => {
    const ed = e.target.closest("[data-asp-edit]");
    if (ed) { const r = ed.closest("[data-asp-row]"); const v = await aspectDrawer(readRow(r), false); if (v) { writeRow(r, v); r.dispatchEvent(new Event("aspect-change", { bubbles: true })); toast(`Saved ${v.title}`); } return; }
    const ad = e.target.closest("[data-asp-add]");
    if (ad) {
      const list = $(ad.dataset.aspAdd); const v = await aspectDrawer({ title: "", prompt: "", left: "", right: "" }, true); if (!v) return;
      const rows = $$("[data-asp-row]", list); const r = rows[0].cloneNode(true); const n = rows.length + 1;
      writeRow(r, v); $$("[data-asp-n]", r).forEach(x => { x.textContent = String(n).padStart(2, "0"); });
      $$("[data-edited]", r).forEach(x => x.remove());
      $$("input[role=switch]", r).forEach(i => { i.id = "asp-new-" + n; i.checked = true; i.disabled = false; });
      list.append(r); r.dispatchEvent(new Event("aspect-change", { bubbles: true })); $("[data-asp-edit]", r)?.focus(); toast(`Added ${v.title}`);
    }
  });

  /* ===== Pass 10 · My Templates mock state (localStorage "as-mt"): Save a Copy, Duplicate, Archive, Restore, Delete ===== */
  const MT_BASE = { bs: ["Brother–Sister · Our Version", 1], wk: ["Weekend Load", 1], ev: ["Family Event Planning", 0] };
  const mt = () => store.get("as-mt", { added: [], archived: [], deleted: [] });
  const mtSave = v => store.set("as-mt", v);
  const mtName = id => (MT_BASE[id] || [])[0] || (mt().added.find(a => a.id === id) || {}).name;
  function addCopy(name, base, n) {
    const s = mt(); const id = "c" + Date.now().toString(36); s.added.push({ id, name, base, n: +n || 5 }); mtSave(s); return id;
  }
  const list = $("[data-mt-list]");
  function mtCard(a) {
    const src = $("[data-mt='ev']") || $("[data-mt]"); const c = src.cloneNode(true);
    c.dataset.mt = a.id; c.dataset.mtUsed = "0";
    $$("[data-f='name']", c).forEach(e => { e.textContent = a.name; }); $$("[data-f='base']", c).forEach(e => { e.textContent = a.base; });
    $$("[data-f='n']", c).forEach(e => { e.textContent = a.n; }); $$("[data-f='updated']", c).forEach(e => { e.textContent = "Today"; });
    $$("[data-mt-link]", c).forEach(e => { e.href = "../06-spec-design-page-templates-v2/my-template-detail.html?id=" + a.id; });
    $$("[data-mt-edit]", c).forEach(e => { e.href = "../06-spec-design-page-templates-v2/my-template-detail.html?id=" + a.id + "&edit=1"; });
    $$("[aria-label]", c).forEach(e => { e.setAttribute("aria-label", e.getAttribute("aria-label").replace(/(for|from|Restore) .*/, "$1 " + a.name)); });
    $$("[data-kebab-menu]", c).forEach(m => { m.hidden = true; m.setAttribute("aria-label", "More actions for " + a.name); });
    return c;
  }
  function mtPaint() {
    if (!list) return;
    const s = mt(); const arch = $("[data-mt-archived-list]");
    s.added.forEach(a => { if (!$(`[data-mt="${a.id}"]`)) list.append(mtCard(a)); });
    $$("[data-mt]").forEach(c => {
      const id = c.dataset.mt;
      if (s.deleted.includes(id)) { c.remove(); return; }
      const ar = s.archived.includes(id);
      (ar ? arch : list).append(c);
      $$("[data-kebab], [data-mt-create]", c).forEach(e => { e.hidden = ar; });
      $$("[data-act='mt-restore']", c).forEach(e => { e.hidden = !ar; });
    });
    const n = $$("[data-mt]", arch).length; $("[data-mt-archived]").hidden = !n; $("[data-mt-archived-count]").textContent = n;
    const pill = $("#tab-mine span.rounded-full"); if (pill) pill.textContent = $$("[data-mt]", list).length;
    const nw = qs.get("new"); const c = nw && $(`[data-mt="${nw}"]`);
    if (c) { c.classList.add("ring-2", "ring-deep"); c.scrollIntoView({ block: "nearest" }); }
  }
  mtPaint();
  // My Template detail: ?id=<id>; unused copies can be deleted, used ones only archived
  const det = $("[data-mt-detail]");
  if (det) {
    const id = qs.get("id") || "bs"; det.dataset.mtDetail = id;
    const name = mtName(id) || mtName("bs"); $$("[data-mt-title]").forEach(e => { e.textContent = name; }); document.title = name + " · AlignSynch v2.0 prototype";
    $$("header [aria-current=page]").forEach(e => { e.textContent = name; });
    const used = id in MT_BASE ? MT_BASE[id][1] : 0;
    $$("[data-mt-usedin]").forEach(e => { e.hidden = !used; });
    $$("[data-mt-delete-note]").forEach(e => { e.hidden = !used; e.classList.toggle("flex", !!used); });
    $$("[data-mt-delete]").forEach(b => { b.disabled = !!used; });
    const focusFirst = () => { const b = $("[data-asp-edit]"); b?.scrollIntoView({ block: "center" }); b?.focus(); };
    if (qs.get("edit") === "1") setTimeout(focusFirst, 50);
    $$("[data-edit-focus]").forEach(a => a.addEventListener("click", e => { e.preventDefault(); focusFirst(); }));
  }

  /* ===== Pass 10 · relationship actions: invite hygiene, abandon, leave, removal, edit details, fork ===== */
  const NOTICE = {
    saved: "Changes saved.", "invite-cancelled": "Invite cancelled. The old link no longer works. It’s a draft again.",
    abandoned: "Draft abandoned.", archived: "Template archived. Restore it any time.", deleted: "Template deleted.",
    "assessment-saved": "Saved. Pick up where you left off any time.", submitted: "Answers submitted. They stay private until you both finish.",
  };
  if (NOTICE[qs.get("notice")]) setTimeout(() => toast(NOTICE[qs.get("notice")]), 300);
  const relCard = el => el.closest("[data-rel]");
  const setStatus = (card, label) => { const b = $("[data-rel-status]", card) || $("[data-qh='components/ui/badge']", card); if (!b) return; $("svg", b)?.remove(); b.textContent = label; };
  function closedState(msg) {
    const main = $("main"); if ($("[data-closed-banner]")) return;
    const b = document.createElement("div"); b.dataset.closedBanner = ""; b.setAttribute("role", "status");
    b.className = "mb-4 flex items-start gap-3 rounded-lg border border-line bg-background p-4 text-sm text-foreground";
    b.innerHTML = `${svg10("lock", "mt-0.5 size-4 text-muted-foreground")}<div><p class="font-semibold">Relationship Closed</p><p>${esc(msg)}</p></div>`;
    const bar = $("[data-proto-bar]", main); (bar ? bar.after(b) : main.prepend(b));
    $$("[data-pause-lock], [data-member-act], #composer, [data-post]").forEach(x => { x.disabled = true; });
    b.scrollIntoView({ block: "nearest" });
  }
  const other = () => document.body.dataset.role === "counterparty" ? "Marcus" : "Elena";
  document.addEventListener("click", async e => {
    const t = e.target.closest("[data-act], a[href^='#act-']"); if (!t) return;
    const act = t.dataset.act || t.getAttribute("href").slice(5); e.preventDefault();
    const card = relCard(t);
    if (act === "save-copy") {
      const id = addCopy(t.dataset.tplName + " · My Copy", t.dataset.tplName, t.dataset.tplN); mtPaint();
      toast(`Saved ${t.dataset.tplName} to My Templates`, ["View", "../06-spec-design-page-templates-v2/templates.html?tab=mine&new=" + id]);
    } else if (act === "fork") {
      const id = addCopy("Staying Close Through Busy Seasons · Elena’s Copy", "Staying Close Through Busy Seasons", 5);
      toast("Saved these Aspects as a My Template", ["View", "../06-spec-design-page-templates-v2/templates.html?tab=mine&new=" + id]);
    } else if (act === "mt-duplicate") {
      const c = t.closest("[data-mt]"); const nm = $("[data-f='name']", c).textContent;
      const id = addCopy(nm + " · Copy", $("[data-f='base']", c).textContent, $("[data-f='n']", c).textContent); mtPaint();
      const nc = $(`[data-mt="${id}"]`); c.after(nc); toast(`Duplicated ${nm}`); $("[data-mt-link]", nc).focus();
    } else if (act === "mt-archive") {
      const c = t.closest("[data-mt]"); const id = c.dataset.mt; const s = mt(); s.archived.push(id); mtSave(s); mtPaint();
      toast(`Archived ${$("[data-f='name']", c).textContent}`, ["Undo", "#", () => { const s2 = mt(); s2.archived = s2.archived.filter(x => x !== id); mtSave(s2); mtPaint(); }]);
    } else if (act === "mt-restore") {
      const c = t.closest("[data-mt]"); const s = mt(); s.archived = s.archived.filter(x => x !== c.dataset.mt); mtSave(s); mtPaint(); toast(`Restored ${$("[data-f='name']", c).textContent}`);
    } else if (act === "mt-archive-detail") {
      const s = mt(); s.archived.push(det.dataset.mtDetail); mtSave(s); location.href = "../06-spec-design-page-templates-v2/templates.html?tab=mine&notice=archived";
    } else if (act === "mt-delete") {
      const ok = await modal({ title: "Delete This Template?", body: "No relationship uses it. This can’t be undone.", confirm: "Delete Permanently", cancel: "Keep It" });
      if (ok) { const s = mt(); s.deleted.push(det.dataset.mtDetail); mtSave(s); location.href = "../06-spec-design-page-templates-v2/templates.html?tab=mine&notice=deleted"; }
    } else if (act === "copy-link") {
      try { navigator.clipboard?.writeText("https://alignsynch.app/invite/7f3k-elena").catch(() => {}); } catch (err) {}
      toast("Invite link copied. Paste it in a text or chat.");
    } else if (act === "remind") { t.classList.add("pointer-events-none", "opacity-70"); toast("Reminder sent to Elena.");
    } else if (act === "resend") {
      t.disabled = true; const sp = $("span", t); if (sp) sp.textContent = "Invite Resent";
      const tb = $("#panel-members [data-variant-show='invited'] tbody");
      if (tb) tb.insertAdjacentHTML("beforeend", `<tr class="border-b"><td class="px-3 py-3 whitespace-nowrap text-muted-foreground">Nov 16, 2026</td><td class="px-3 py-3"><span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-line bg-background px-2.5 py-0.5 text-xs font-medium text-foreground">Invite Resent</span></td><td class="px-3 py-3 text-muted-foreground">To elena.r@example.com</td></tr>`);
      toast("Invite sent again to elena.r@example.com");
    } else if (act === "cancel-invite") {
      const ok = await modal({ title: "Cancel This Invite?", body: "The link stops working, so they can’t join with it. Your draft stays and you can invite again.", confirm: "Cancel Invite", cancel: "Keep Invite" });
      if (!ok) return;
      if (card) { card.dataset.relFilter = "draft"; setStatus(card, "Draft"); $("[data-rel-next]", card).textContent = "Invite cancelled. Send a new one when you’re ready."; toast("Invite cancelled. It’s a draft again."); }
      else location.href = "../03-spec-design-page-relationship-detail-v2/relationship-detail.html?state=draft&notice=invite-cancelled";
    } else if (act === "abandon") {
      const ok = await modal({ title: "Abandon This Draft?", body: "Nobody was invited, so nobody else is affected. This can’t be undone.", confirm: "Abandon Draft", cancel: "Keep Draft" });
      if (!ok) return;
      if (card) { card.remove(); toast("Draft abandoned."); } else location.href = "../05-spec-design-page-start-my-relationships-v2/my-relationships.html?notice=abandoned";
    } else if (act === "leave") {
      const who = card ? card.dataset.relWho : other();
      const ok = await modal({ title: "Leave This Relationship?", body: `Stage 6 closes for you and ${esc(who)}. Answers and the discussion stay readable. Nothing is deleted.`, confirm: "Leave Relationship", cancel: "Stay" });
      if (!ok) return;
      if (card) { card.dataset.relFilter = "closed"; setStatus(card, "Closed"); $("[data-rel-next]", card).textContent = "Closed. Answers stay readable."; toast("You left. Stage 6 is closed."); }
      else { closedState(`Stage 6 is closed for you and ${who}. Answers and the discussion stay readable.`); toast("You left. Stage 6 is closed."); }
    } else if (act === "request-removal") {
      const v = await modal({ title: "Request My Removal", body: "We remove your name and answers from this relationship within 30 days, then close it. Marcus is told you left.", confirm: "Send Request", fields: [{ type: "area", name: "reason", label: "Anything We Should Know?", hint: "Optional. Marcus never sees this." }] });
      if (!v) return; closedState("You asked to be removed. Your name and answers are removed within 30 days."); toast("Removal request sent.");
    } else if (act === "edit-details") {
      const dt = k => $(`[data-detail="${k}"]`)?.textContent.trim() || "";
      const v = await modal({ title: "Edit Details", confirm: "Save Details", ico: null, fields: [{ name: "title", label: "Relationship Title", value: dt("title"), required: true }, { type: "area", name: "desc", label: "Your Shared Goal", value: dt("desc") }] });
      if (!v) return; $$("[data-detail='title']").forEach(x => { x.textContent = v.title; }); $$("[data-detail='desc']").forEach(x => { x.textContent = v.desc; }); toast("Details saved. Elena sees the update.");
    } else if (act === "decline-invite") {
      $$("[data-decline-hide]").forEach(x => { x.hidden = true; }); const d = $("[data-declined]"); d.hidden = false; $("h2, h1", d)?.focus();
    } else if (act === "decline-reason") {
      t.disabled = true; toast("Thanks. Marcus will see your note.");
    } else if (act === "propose") {
      const v = await modal({ title: "Propose a Change", body: `Nothing changes until ${other()} agrees. Agreed changes apply from Round 2.`, confirm: "Send Proposal", ico: null, fields: [
        { type: "radio", name: "kind", label: "Change", options: [["reword", "Reword"], ["off", "Turn Off"], ["add", "Add New"]] },
        { type: "select", name: "aspect", label: "Aspect", options: [["Contact Frequency", "Contact Frequency"], ["Old Roles", "Old Roles"], ["Showing Up", "Showing Up"], ["Parent Decisions", "Parent Decisions"], ["Feeling Respected", "Feeling Respected"]] },
        { type: "area", name: "text", label: "New Wording or Reason", hint: "For Add New, write the new Aspect’s question.", required: true }] });
      if (!v) return; store.set("as-prop", { by: document.body.dataset.role, ...v, status: "pending" }); renderProp(); toast(`Proposal sent to ${other()}.`);
    } else if (act === "prop-withdraw") { store.set("as-prop", null); renderProp(); toast("Proposal withdrawn.");
    } else if (act === "prop-accept") { const p = store.get("as-prop"); p.status = "accepted"; store.set("as-prop", p); renderProp(); toast("Change agreed. It applies from Round 2.");
    } else if (act === "prop-decline") { const p = store.get("as-prop"); p.status = "declined"; store.set("as-prop", p); renderProp(); toast("Proposal declined. Nothing changed.");
    } else if (act === "prop-dismiss") { store.set("as-prop", null); renderProp(); }
  });
  // Live Aspect change proposals: shown to the other party with Accept / Decline. Nothing changes silently.
  function renderProp() {
    const slot = $("[data-prop-slot]"); if (!slot) return;
    const p = store.get("as-prop"); if (!p) { slot.innerHTML = ""; slot.hidden = true; return; }
    slot.hidden = false;
    const me = document.body.dataset.role; const mine = p.by === me;
    const byName = p.by === "counterparty" ? "Elena" : "Marcus"; const toName = p.by === "counterparty" ? "Marcus" : "Elena";
    const what = p.kind === "off" ? `turn off <b>${esc(p.aspect)}</b>` : p.kind === "add" ? `add a new Aspect: “${esc(p.text)}”` : `reword <b>${esc(p.aspect)}</b> to “${esc(p.text)}”`;
    const warn = p.kind === "off" ? `<p class="mt-1 text-xs text-muted-foreground">From Round 2 it’s off. Round 1 answers for it stay readable.</p>` : "";
    const btn = (l, a, primary) => `<button type="button" class="${primary ? BTN_ACTION : BTN_GHOST} h-10 lg:h-9" data-act="${a}" data-pause-lock>${l}</button>`;
    let head, body, acts;
    if (p.status === "pending") {
      head = mine ? `Waiting on ${toName}` : `${byName} Proposes a Change`;
      body = mine ? `You proposed to ${what}.` : `${byName} wants to ${what}.`;
      acts = mine ? btn("Withdraw", "prop-withdraw") : btn("Decline", "prop-decline") + btn("Accept", "prop-accept", true);
    } else {
      head = p.status === "accepted" ? "Change Agreed" : "Proposal Declined";
      body = p.status === "accepted" ? `You both agreed to ${what}. It applies from Round 2.` : `The proposal to ${what} was declined. Nothing changed.`;
      acts = btn("Dismiss", "prop-dismiss");
    }
    slot.innerHTML = `<div class="flex flex-col gap-3 rounded-md border border-status-line bg-status p-4 sm:flex-row sm:items-start sm:justify-between" role="status" data-prop-card="${p.status}">
      <div class="min-w-0"><p class="text-sm font-semibold text-primary">${head}</p><p class="mt-0.5 text-sm text-foreground">${body}</p>${p.status === "pending" ? warn : ""}</div>
      <div class="flex shrink-0 flex-wrap gap-2">${acts}</div></div>`;
    if (paused) $$("[data-pause-lock]", slot).forEach(b => { b.disabled = true; });
  }
  new MutationObserver(renderProp).observe(document.body, { attributes: true, attributeFilter: ["data-role"] }); renderProp();

  /* ===== Pass 10 · assessment.html: one Aspect at a time, autosave, Save and Exit, resume, review, submit ===== */
  const as = $("[data-assess]");
  if (as) {
    const cp = qs.get("role") === "counterparty"; const KEY = "as-assess-" + (cp ? "counterparty" : "initiator");
    const detail = cp ? "../03-spec-design-page-relationship-detail-v2/relationship-detail.html?state=joined&role=counterparty" : "../03-spec-design-page-relationship-detail-v2/relationship-detail.html?state=joined&role=initiator";
    document.body.dataset.role = cp ? "counterparty" : "initiator";
    $$("[data-q-other]").forEach(e => { e.textContent = cp ? "Marcus" : "Elena"; });
    $$("[data-exit]").forEach(a => { a.href = detail; });
    const N = $$("[data-q]").length - 1; let st = store.get(KEY, { ans: {}, at: 1 });
    const save = () => { store.set(KEY, st); const s = $("[data-q-saved]"); if (s) s.textContent = "Saved just now"; };
    $$("[data-ans]").forEach(i => { const v = st.ans[i.dataset.ans + "-" + i.dataset.kind]; if (+v === +i.value) i.checked = true; });
    as.addEventListener("change", e => { const i = e.target; if (!i.dataset.ans) return; st.ans[i.dataset.ans + "-" + i.dataset.kind] = +i.value; save(); const h = $("[data-q-hint]", i.closest("[data-q]")); h.classList.add("hidden"); h.classList.remove("flex"); });
    const complete = n => { const sec = $(`[data-q="${n}"]`); return $$("fieldset", sec).every(f => $("input:checked", f)); };
    function show(n, focus = true) {
      st.at = n; save();
      $$("[data-q]").forEach(s => { s.hidden = String(s.dataset.q) !== String(n); });
      const cur = n === "review" ? N + 1 : +n;
      $$("[data-qbar]").forEach(b => { const k = +b.dataset.qbar; b.dataset.state = k < cur ? "done" : k === cur ? "current" : "todo"; });
      $$("[data-q-progress]").forEach(e => { e.textContent = n === "review" ? "Review" : `Aspect ${n} of ${N}`; });
      if (n === "review") $$("[data-rv]").forEach(e => { e.textContent = st.ans[e.dataset.rv] || "–"; });
      if (focus) { scrollTo(0, 0); $(`#q-${n}-title`)?.focus(); }
    }
    $$("[data-q-go]").forEach(b => b.addEventListener("click", () => show(+b.dataset.qGo)));
    $$("[data-q-next]").forEach(b => b.addEventListener("click", () => {
      const sec = b.closest("[data-q]"); const n = +sec.dataset.q;
      if (!complete(n)) { const h = $("[data-q-hint]", sec); h.classList.remove("hidden"); h.classList.add("flex"); return; }
      show(n >= N ? "review" : n + 1);
    }));
    $$("[data-q-save]").forEach(b => b.addEventListener("click", () => { save(); location.href = detail + "&notice=assessment-saved"; }));
    $$("[data-q-submit]").forEach(b => b.addEventListener("click", () => {
      store.set(KEY, null);
      location.href = (cp ? "../03-spec-design-page-relationship-detail-v2/relationship-detail.html?state=live&role=counterparty" : "../03-spec-design-page-relationship-detail-v2/relationship-detail.html?state=waiting&role=initiator") + "&notice=submitted";
    }));
    $$("[data-q-reset]").forEach(b => b.addEventListener("click", () => { store.set(KEY, null); location.href = location.pathname + location.search; }));
    const answered = Object.keys(st.ans).length;
    if (answered && st.at) { const r = $("[data-q-resume]"); r.classList.remove("hidden"); r.classList.add("flex"); $("[data-q-resume-at]").textContent = st.at === "review" ? "Review" : `Aspect ${st.at} of ${N}`; }
    show(st.at || 1, false);
  }

  /* ===== Pass 10 · settings.html ===== */
  $$("[data-settings-save]").forEach(b => b.addEventListener("click", () => toast(b.dataset.settingsSave)));
  document.addEventListener("click", async e => {
    if (!e.target.closest("[data-act='delete-account']")) return;
    const ok = await modal({ title: "Delete Your Account?", body: "Every relationship you’re in closes. Your account is removed immediately and cannot be restored.", confirm: "Delete Account", cancel: "Keep Account" });
    if (ok) toast("Account deleted. You’re signed out.");
  });
  // Pass 10 · ?step=1#decline opens the declined panel directly (flow map link)
  if (location.hash === "#decline" && $("[data-declined]")) { $$("[data-decline-hide]").forEach(x => { x.hidden = true; }); $("[data-declined]").hidden = false; }
})();
