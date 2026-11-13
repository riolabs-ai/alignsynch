(() => {
  const tabs = [...document.querySelectorAll("[data-help-tab]")];
  const panels = [...document.querySelectorAll("[data-help-panel]")];
  const searchInput = document.querySelector("#help-search");
  const searchForm = document.querySelector("#help-search-form");
  const searchResults = document.querySelector("#search-results");
  const resultsList = document.querySelector("#results-list");
  const resultsCount = document.querySelector("#results-count");
  const noResults = document.querySelector("#no-results");
  const activeTitle = document.querySelector("#active-title");
  const activeKicker = document.querySelector("#active-kicker");
  const sectionLabels = {
    answers: { title: "What would you like to know?", kicker: "QUICK ANSWERS" },
    guides: { title: "Step-by-step guidance", kicker: "GUIDES" },
    glossary: { title: "Make sense of the language", kicker: "RELATIONSHIP GLOSSARY" },
  };
  let activeSection = "answers";
  let selectedFaqCategory = "all";
  let selectedTermCategory = "all";

  function showPanel(section) {
    activeSection = section;
    for (const tab of tabs) {
      const selected = tab.dataset.helpTab === section;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.helpPanel !== section;
    const copy = sectionLabels[section];
    activeTitle.textContent = copy.title;
    activeKicker.textContent = copy.kicker;
    searchResults.hidden = true;
  }

  function applyFaqFilter(category) {
    selectedFaqCategory = category;
    for (const button of document.querySelectorAll("[data-faq-filter]")) {
      const selected = button.dataset.faqFilter === category;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    for (const item of document.querySelectorAll(".faq-item")) {
      item.classList.toggle(
        "filtered-out",
        category !== "all" && item.dataset.category !== category,
      );
    }
  }

  function applyTermFilter(category) {
    selectedTermCategory = category;
    for (const button of document.querySelectorAll("[data-term-filter]")) {
      const selected = button.dataset.termFilter === category;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    for (const item of document.querySelectorAll(".term-card")) {
      item.classList.toggle(
        "filtered-out",
        category !== "all" && item.dataset.category !== category,
      );
    }
  }

  function runSearch() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    if (!query) {
      showPanel(activeSection);
      return;
    }

    const matches = [...document.querySelectorAll(".search-source")].filter((item) => {
      const searchable =
        `${item.dataset.title || ""} ${item.textContent || ""}`.toLocaleLowerCase();
      return searchable.includes(query);
    });
    resultsList.replaceChildren();
    noResults.hidden = matches.length > 0;
    resultsCount.textContent = `${matches.length} ${matches.length === 1 ? "match" : "matches"} for “${searchInput.value.trim()}”`;

    for (const item of matches) {
      const link = document.createElement("a");
      link.className = "result-link";
      link.href = `#${item.id}`;
      link.dataset.searchTarget = item.id;

      const content = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent =
        item.dataset.title || item.querySelector("h4, strong")?.textContent?.trim() || "Help topic";
      const excerpt = document.createElement("span");
      const text = (item.innerText || item.textContent || "")
        .replace(title.textContent, "")
        .replace(/\s+/g, " ")
        .trim();
      excerpt.textContent = text.length > 156 ? `${text.slice(0, 153).trim()}…` : text;
      content.append(title, excerpt);

      const arrow = document.createElement("b");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      link.append(content, arrow);
      resultsList.append(link);
    }

    for (const panel of panels) panel.hidden = true;
    searchResults.hidden = false;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      showPanel(tab.dataset.helpTab);
      searchInput.value = "";
    });
    tab.addEventListener("keydown", (event) => {
      let next = null;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      tabs[next].focus();
      showPanel(tabs[next].dataset.helpTab);
      searchInput.value = "";
    });
  });

  document.querySelectorAll("[data-faq-filter]").forEach((button) => {
    button.addEventListener("click", () => applyFaqFilter(button.dataset.faqFilter));
  });
  document.querySelectorAll("[data-term-filter]").forEach((button) => {
    button.addEventListener("click", () => applyTermFilter(button.dataset.termFilter));
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
    document.querySelector("#help-library").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  searchInput.addEventListener("input", runSearch);
  document.querySelector("#clear-search").addEventListener("click", () => {
    searchInput.value = "";
    showPanel(activeSection);
    searchInput.focus();
  });
  document.querySelectorAll("[data-search-sample]").forEach((button) => {
    button.addEventListener("click", () => {
      searchInput.value = button.dataset.searchSample;
      runSearch();
      document
        .querySelector("#help-library")
        .scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.addEventListener("click", (event) => {
    const result = event.target.closest("[data-search-target]");
    const openTarget = event.target.closest("[data-open-target]");
    const targetId = result?.dataset.searchTarget || openTarget?.dataset.openTarget;
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    const section = target.dataset.section || "answers";
    showPanel(section);
    searchInput.value = "";
    applyFaqFilter("all");
    applyTermFilter("all");
    if (target instanceof HTMLDetailsElement) target.open = true;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLDetailsElement)
        target.querySelector("summary")?.focus({ preventScroll: true });
      else target.focus?.({ preventScroll: true });
    }, 25);
  });

  document.querySelector("#contact-preview-form").addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelector("#contact-preview-status").hidden = false;
  });

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target?.dataset.section) {
      showPanel(target.dataset.section);
      if (target instanceof HTMLDetailsElement) target.open = true;
    }
  }

  showPanel(activeSection);
  applyFaqFilter(selectedFaqCategory);
  applyTermFilter(selectedTermCategory);
})();
