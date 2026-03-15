// articles.js
// Loads from multiple JSON sources, supports pagination, per-column search, filter, and sort.

const JSON_FILES = [
  "assets/data_date/articlesvol1.json",
  "assets/data_date/articlesvol2.json",
  "assets/data_date/articles1936v1.json",
  "assets/data_date/articles1937v1.json",
  "assets/data_date/articles1938v1.json",
  "assets/data_date/articles1939v1.json",
  "assets/data_date/articles1940v1.json",
  "assets/data_date/articles1941v1.json",
  "assets/data_date/articles1942v1.json",
  "assets/data_date/articles1943v1.json",
  "assets/data_date/articles1944v1.json",
  "assets/data_date/articles1945v1.json",
  "assets/data_date/articles1946v1.json",
  "assets/data_date/articles1947v1.json",
  "assets/data_date/articles1948v1.json",
  "assets/data_date/articles1949v1.json",
  "assets/data_date/articles1950v1.json",
  "assets/data_date/articles1951v1.json",
  "assets/data_date/articles1952v1.json",
  "assets/data_date/articles1953v1.json",
  "assets/data_date/articles1954v1.json",
  "assets/data_date/articles1955v1.json",
  "assets/data_date/articles1956v1.json",
  "assets/data_date/articles1957v1.json",
  "assets/data_date/articles1958v1.json",
  "assets/data_date/articles1959v1.json",
  "assets/data_date/articles1960v1.json",
  "assets/data_date/articles1961v1.json",
  "assets/data_date/articles1962v1.json",
  "assets/data_date/articles1963v1.json",
  "assets/data_date/articles1964v1.json",
  "assets/data_date/articles1965v1.json",
  "assets/data_date/articles1966v1.json",
  "assets/data_date/articles1967v1.json",
  "assets/data_date/articles1968v1.json",
  "assets/data_date/articles1969v1.json",
  "assets/data_date/articles1970v1.json",
  "assets/data_date/articles1971v1.json",
  "assets/data_date/articles1972v1.json",
  "assets/data_date/articles1973v1.json",
  "assets/data_date/articles1974v1.json",
  "assets/data_date/articles1975v1.json",
  "assets/data_date/articles1976v1.json",
  "assets/data_date/articles1977v1.json",
  "assets/data_date/articles1978v1.json",
  "assets/data_date/articles1979v1.json",
  "assets/data_date/articles1980v1.json",
  "assets/data_date/articles1981v1.json",
  "assets/data_date/articles1982v1.json",
  "assets/data_date/articles1983v1.json",
  "assets/data_date/articles1984v1.json",
  "assets/data_date/articles1985v1.json",
  "assets/data_date/articles1986v1.json",
];

const PAGE_SIZE = 25;

const SEARCH_COLUMNS = [
  { label: "All columns",  key: null },
  { label: "Article Title", key: "article_title" },
  { label: "Type",          key: "article_type" },
  { label: "Page",          key: "page_number" },
  { label: "File",          key: "filename" },
  { label: "Volume/Issue",  key: "volume_issue" },
  { label: "Date",          key: "date" },
];

let allData = [];
let filteredData = [];
let currentPage = 1;
let currentSort = { index: -1, asc: true };
let currentFilter = "all";
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

function matchesSearch(article) {
  if (!currentSearch) return true;
  const q = currentSearch.toLowerCase();
  if (currentSearchKey) {
    return String(article[currentSearchKey] || "").toLowerCase().includes(q);
  }
  return (
    (article.article_title || "").toLowerCase().includes(q) ||
    (article.article_type  || "").toLowerCase().includes(q) ||
    String(article.page_number || "").toLowerCase().includes(q) ||
    (article.filename      || "").toLowerCase().includes(q) ||
    (article.volume_issue  || "").toLowerCase().includes(q) ||
    (article.date          || "").toLowerCase().includes(q)
  );
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.querySelector("#articlesTable tbody");
  tbody.innerHTML = "";

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredData.slice(start, start + PAGE_SIZE);

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#999;">No results found.</td></tr>';
  } else {
    pageData.forEach(article => {
      const tr = document.createElement("tr");
      tr.className = article.article_type === "advertisement" ? "ad-row" : "article-row";
      tr.innerHTML = `
        <td>${article.article_title || ""}</td>
        <td><span class="badge badge-${article.article_type}">${article.article_type || ""}</span></td>
        <td>${article.page_number || ""}</td>
        <td>${article.filename || ""}</td>
        <td>${article.volume_issue || ""}</td>
        <td>${article.date || ""}</td>
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
  const totalArticles = allData.filter(a => a.article_type === "article").length;
  const totalAds = allData.filter(a => a.article_type === "advertisement").length;
  document.getElementById("stats").innerHTML = `
    <strong>Total loaded:</strong> ${allData.length} entries |
    <strong>Articles:</strong> ${totalArticles} |
    <strong>Advertisements:</strong> ${totalAds} |
    <strong>Showing:</strong> ${filteredData.length} matching entries
  `;
}

// ── Filtering & sorting ───────────────────────────────────────────────────────

function applyFiltersAndSort() {
  let result = allData.slice();

  if (currentFilter === "articles") {
    result = result.filter(a => a.article_type !== "advertisement");
  } else if (currentFilter === "advertisements") {
    result = result.filter(a => a.article_type === "advertisement");
  }

  result = result.filter(matchesSearch);

  if (currentSort.index >= 0) {
    const keys = ["article_title", "article_type", "page_number", "filename", "volume_issue", "date"];
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

    const select = document.getElementById("columnSelect");
    SEARCH_COLUMNS.forEach(col => {
      const opt = document.createElement("option");
      opt.value = col.key || "";
      opt.textContent = col.label;
      select.appendChild(opt);
    });

    renderTable();

    select.addEventListener("change", () => {
      currentSearchKey = select.value || null;
      applyFiltersAndSort();
    });

    document.getElementById("searchBox").addEventListener("input", e => {
      currentSearch = e.target.value.trim();
      applyFiltersAndSort();
    });

    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        applyFiltersAndSort();
      });
    });

    document.querySelectorAll("#articlesTable th").forEach((th, index) => {
      th.addEventListener("click", () => {
        const isAsc = currentSort.index === index ? !currentSort.asc : true;
        currentSort = { index, asc: isAsc };
        document.querySelectorAll("#articlesTable th").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
        th.classList.add(isAsc ? "sort-asc" : "sort-desc");
        applyFiltersAndSort();
      });
    });
  })
  .catch(err => {
    console.error("Failed to load article data", err);
    document.querySelector("#articlesTable tbody").innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#999;">Failed to load data. Please check the console.</td></tr>';
  });
