// locations.js
// Loads from multiple JSON sources, supports pagination, per-column search, and sort.

const JSON_FILES = [
  "assets/data/locationsvol1.json",
  "assets/data/locationsvol2.json",
  "assets/data/locations1936v1.json",
  "assets/data/locations1937v1.json",
  "assets/data/locations1938v1.json",
  "assets/data/locations1939v1.json",
  "assets/data/locations1940v1.json",
  "assets/data/locations1941v1.json",
  "assets/data/locations1942v1.json",
  "assets/data/locations1943v1.json",
  "assets/data/locations1944v1.json",
  "assets/data/locations1945v1.json",
  "assets/data/locations1946v1.json",
  "assets/data/locations1947v1.json",
  "assets/data/locations1948v1.json",
  "assets/data/locations1960v1.json",
  "assets/data/locations1979v1.json",
  "assets/data/locations1982v1.json",
];

const PAGE_SIZE = 25;

const SEARCH_COLUMNS = [
  { label: "All columns",          key: null },
  { label: "Location (as appears)", key: "location_entry" },
  { label: "Standardised Location", key: "location_standardised" },
  { label: "Context",              key: "brief_context" },
  { label: "Article",              key: "article_title" },
  { label: "Page",                 key: "page_number" },
  { label: "File",                 key: "filename" },
  { label: "Text Extract",         key: "brief_extract" },
];

let allData = [];
let filteredData = [];
let currentPage = 1;
let currentSort = { index: -1, asc: true };
let currentSearch = "";
let currentSearchKey = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanJSON(text) {
  return text.replace(/:\s*NaN\s*([,\}])/g, ': null$1');
}

function loadFile(url) {
  return fetch(url)
    .then(r => r.text())
    .then(t => JSON.parse(cleanJSON(t)))
    .catch(() => []);
}

function matchesSearch(loc) {
  if (!currentSearch) return true;
  const q = currentSearch.toLowerCase();
  if (currentSearchKey) {
    return String(loc[currentSearchKey] || "").toLowerCase().includes(q);
  }
  return (
    (loc.location_entry        || "").toLowerCase().includes(q) ||
    (loc.location_standardised || "").toLowerCase().includes(q) ||
    (loc.brief_context         || "").toLowerCase().includes(q) ||
    (loc.article_title         || "").toLowerCase().includes(q) ||
    String(loc.page_number     || "").toLowerCase().includes(q) ||
    (loc.filename              || "").toLowerCase().includes(q) ||
    (loc.brief_extract         || "").toLowerCase().includes(q)
  );
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.querySelector("#locationsTable tbody");
  tbody.innerHTML = "";

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredData.slice(start, start + PAGE_SIZE);

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#999;">No results found.</td></tr>';
  } else {
    pageData.forEach(loc => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${loc.location_entry || ""}</td>
        <td>${loc.location_standardised || ""}</td>
        <td>${loc.brief_context || ""}</td>
        <td>${loc.article_title || ""}</td>
        <td>${loc.page_number || ""}</td>
        <td>${loc.filename || ""}</td>
        <td><details><summary>View extract</summary><p style="margin:0.5rem 0;max-width:400px;line-height:1.4;">${loc.brief_extract || ""}</p></details></td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderPagination();
  renderStats();
}

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
  const container = document.getElementById("pagination");
  let html = `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>‹ Prev</button>`;
  html += `<span style="margin:0 1rem;">Page ${currentPage} of ${totalPages}</span>`;
  html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""}>Next ›</button>`;
  container.innerHTML = html;
}

function renderStats() {
  document.getElementById("stats").innerHTML = `
    <strong>Total loaded:</strong> ${allData.length} entries |
    <strong>Showing:</strong> ${filteredData.length} matching entries
  `;
}

// ── Filtering & sorting ───────────────────────────────────────────────────────

function applyFiltersAndSort() {
  let result = allData.filter(matchesSearch);

  if (currentSort.index >= 0) {
    const keys = [
      "location_entry", "location_standardised", "brief_context",
      "article_title", "page_number", "filename", "brief_extract"
    ];
    const key = keys[currentSort.index];
    result.sort((a, b) => {
      const av = String(a[key] || "");
      const bv = String(b[key] || "");
      return currentSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  filteredData = result;
  currentPage = 1;
  renderTable();
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goToPage(page) {
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Init ──────────────────────────────────────────────────────────────────────

Promise.all(JSON_FILES.map(loadFile))
  .then(arrays => {
    allData = arrays.flat();
    filteredData = allData.slice();

    // Build column selector dropdown
    const select = document.getElementById("columnSelect");
    SEARCH_COLUMNS.forEach(col => {
      const opt = document.createElement("option");
      opt.value = col.key || "";
      opt.textContent = col.label;
      select.appendChild(opt);
    });

    renderTable();

    // Column selector
    select.addEventListener("change", () => {
      currentSearchKey = select.value || null;
      applyFiltersAndSort();
    });

    // Search box
    document.getElementById("searchBox").addEventListener("input", e => {
      currentSearch = e.target.value.trim();
      applyFiltersAndSort();
    });

    // Column sort
    document.querySelectorAll("#locationsTable th").forEach((th, index) => {
      th.addEventListener("click", () => {
        const isAsc = currentSort.index === index ? !currentSort.asc : true;
        currentSort = { index, asc: isAsc };
        document.querySelectorAll("#locationsTable th").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
        th.classList.add(isAsc ? "sort-asc" : "sort-desc");
        applyFiltersAndSort();
      });
    });
  })
  .catch(err => {
    console.error("Failed to load location data", err);
    document.querySelector("#locationsTable tbody").innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#999;">Failed to load data. Please check the console.</td></tr>';
  });
