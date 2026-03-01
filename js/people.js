// people.js
// Loads from multiple JSON sources, supports pagination, per-column search, and sort.

const JSON_FILES = [
  "assets/data_date/personsvol1.json",
  "assets/data_date/personsvol2.json",
  "assets/data_date/persons1936v1.json",
  "assets/data_date/persons1937v1.json",
  "assets/data_date/persons1938v1.json",
  "assets/data_date/persons1939v1.json",
  "assets/data_date/persons1940v1.json",
  "assets/data_date/persons1941v1.json",
  "assets/data_date/persons1942v1.json",
  "assets/data_date/persons1943v1.json",
  "assets/data_date/persons1944v1.json",
  "assets/data_date/persons1945v1.json",
  "assets/data_date/persons1946v1.json",
  "assets/data_date/persons1947v1.json",
  "assets/data_date/persons1948v1.json",
  "assets/data_date/persons1960v1.json",
  "assets/data_date/persons1979v1.json",
  "assets/data_date/persons1982v1.json",
];

const PAGE_SIZE = 25;

const SEARCH_COLUMNS = [
  { label: "All columns",       key: null },
  { label: "Name (as appears)", key: "person_entry" },
  { label: "Standardised Name", key: "standardised_name" },
  { label: "Title",             key: "title" },
  { label: "Role / Profession", key: "role" },
  { label: "Organisation",      key: "associated_organisation" },
  { label: "Gender",            key: "gender" },
  { label: "Relation to text",  key: "relation" },
  { label: "Depicted",          key: "depicted" },
  { label: "Article",           key: "article_title" },
  { label: "Page",              key: "page_number" },
  { label: "File",              key: "filename" },
  { label: "Volume/Issue",      key: "volume_issue" },
  { label: "Date",              key: "date" },
  { label: "Context Extract",   key: "brief_extract" },
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

function matchesSearch(person) {
  if (!currentSearch) return true;
  const q = currentSearch.toLowerCase();
  if (currentSearchKey) {
    return String(person[currentSearchKey] || "").toLowerCase().includes(q);
  }
  return (
    (person.person_entry            || "").toLowerCase().includes(q) ||
    (person.standardised_name       || "").toLowerCase().includes(q) ||
    (person.title                   || "").toLowerCase().includes(q) ||
    (person.role                    || "").toLowerCase().includes(q) ||
    (person.associated_organisation || "").toLowerCase().includes(q) ||
    (person.gender                  || "").toLowerCase().includes(q) ||
    (person.relation                || "").toLowerCase().includes(q) ||
    (person.depicted                || "").toLowerCase().includes(q) ||
    (person.article_title           || "").toLowerCase().includes(q) ||
    String(person.page_number       || "").toLowerCase().includes(q) ||
    (person.filename                || "").toLowerCase().includes(q) ||
    (person.volume_issue            || "").toLowerCase().includes(q) ||
    (person.date                    || "").toLowerCase().includes(q) ||
    (person.brief_extract           || "").toLowerCase().includes(q)
  );
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function renderTable() {
  const tbody = document.querySelector("#peopleTable tbody");
  tbody.innerHTML = "";

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredData.slice(start, start + PAGE_SIZE);

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="14" style="text-align:center;padding:2rem;color:#999;">No results found.</td></tr>';
  } else {
    pageData.forEach(person => {
      const tr = document.createElement("tr");
      if (person.id) tr.id = person.id;
      tr.innerHTML = `
        <td>${person.person_entry || ""}</td>
        <td>${person.standardised_name || ""}</td>
        <td>${person.title || ""}</td>
        <td>${person.role || ""}</td>
        <td>${person.associated_organisation || ""}</td>
        <td>${person.gender || ""}</td>
        <td>${person.relation || ""}</td>
        <td>${person.depicted || ""}</td>
        <td>${person.article_title || ""}</td>
        <td>${person.page_number || ""}</td>
        <td>${person.volume_issue || ""}</td>
        <td>${person.date || ""}</td>
        <td>${person.filename || ""}</td>
        <td><details><summary>View extract</summary><p style="margin:0.5rem 0;max-width:400px;line-height:1.4;">${person.brief_extract || ""}</p></details></td>
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
      "person_entry", "standardised_name", "title", "role",
      "associated_organisation", "gender", "relation", "depicted",
      "article_title", "page_number", "volume_issue", "date", "filename", "brief_extract"
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

    document.querySelectorAll("#peopleTable th").forEach((th, index) => {
      th.addEventListener("click", () => {
        const isAsc = currentSort.index === index ? !currentSort.asc : true;
        currentSort = { index, asc: isAsc };
        document.querySelectorAll("#peopleTable th").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
        th.classList.add(isAsc ? "sort-asc" : "sort-desc");
        applyFiltersAndSort();
      });
    });
  })
  .catch(err => {
    console.error("Failed to load persons data", err);
    document.querySelector("#peopleTable tbody").innerHTML =
      '<tr><td colspan="14" style="text-align:center;padding:2rem;color:#999;">Failed to load data. Please check the console.</td></tr>';
  });
