// portraits.js
// Displays a gallery of portrait pages with associated depicted persons.
// Also renders a searchable table of all "depicted" persons from the JSON data.
// When a name is searched/matched, the relevant gallery image frame lights up.

// ── JSON sources (same as people.js) ─────────────────────────────────────────
const JSON_FILES = [
  "assets/data/personsvol1.json",
  "assets/data/personsvol2.json",
  "assets/data/persons1941v1.json",
  "assets/data/persons1943v1.json",
  "assets/data/persons1947v1.json",
  "assets/data/persons1960v1.json",
  "assets/data/persons1979v1.json",
  "assets/data/persons1982v1.json",
];

// ── Gallery pages configuration ───────────────────────────────────────────────
// Each entry defines one image in the gallery.
// `persons` lists the names (as they appear in person_entry / standardised_name)
// that are depicted on that page — used for search-to-highlight matching.
const GALLERY_PAGES = [
  {
    filename: "1926_page_0094r.png",
    src: "assets/images/portraits/1926_page_0094r.png",
    caption: "Dr. & Mrs. Ferranti with their Son and Daughters on the Steps of Baslow Hall",
    volume: "The Electrical Age, Vol. 1 (1926), p. 167",
    persons: [
      "Dr. de Ferranti",
      "Mrs. de Ferranti",
      "Sebastian Ziani de Ferranti",
    ],
  },
  {
    filename: "1926_page_0194r.png",
    src: "assets/images/portraits/1926_page_0194r.png",
    caption: "A Group of Interesting Women (top); With the I.M.E.A. at Bath (bottom)",
    volume: "The Electrical Age, Vol. 1 (1926), p. 349",
    persons: [
      "Councillor Mrs. Gregory",
      "Miss Haslett",
      "Mrs. Purse",
      "Miss Purse",
      "Miss Streimer",
      "Mrs. Groot",
      "Mrs. Hollis",
      "Mrs. Hyecroft",
      "Mrs. Howie",
      "Mrs. Clayton",
    ],
  },
  {
    filename: "1926_page_0251l.png",
    src: "assets/images/portraits/1926_page_0251l.png",
    caption: "A Chance Remark at the E.A.W. Leeds Luncheon (cartoon illustration)",
    volume: "The Electrical Age, Vol. 1 (1926), p. 452",
    persons: [],
  },
  {
    filename: "1926_page_0296l.png",
    src: "assets/images/portraits/1926_page_0296l.png",
    caption: "Miss Anna Holm, the energetic Secretary of the North-East Coast Branch, resting against the Roman Wall",
    volume: "The Electrical Age, Vol. 1 (1926), p. 534",
    persons: [
      "Miss Anna Holm",
      "Anna Holm",
    ],
  },
  {
    filename: "1930_page_0146r.png",
    src: "assets/images/portraits/1930_page_0146r.png",
    caption: "Faraday Lecturing at the Royal Institution (painting by Alexander Blaikley, showing Faraday, the Prince of Wales, Prince Alfred, Professor Tyndall, and Mrs. Faraday)",
    volume: "The Electrical Age (1930), p. 245",
    persons: [
      "Michael Faraday",
      "Professor Tyndall",
      "Mrs. Faraday",
    ],
  },
  {
    filename: "Electric Living (Summer 1979)_0047.jpg",
    src: "assets/images/portraits/Electric Living (Summer 1979)_0047.jpg",
    caption: "Mrs. Kibble, Assistant Test Manager for Thorn Ericsson, installed three main frame 64K computers in international G.P.O. telephone exchanges with up to 20,000 lines",
    volume: "Electric Living, Summer 1979, p. 9",
    persons: [
      "Mrs. Kibble",
    ],
  },
  {
    filename: "The Electrical Age - Number 4 (January 1960)_0096.jpg",
    src: "assets/images/portraits/The Electrical Age - Number 4 (January 1960)_0096.jpg",
    caption: "Portraits: Mrs. D. Barkwith · Miss M. Powell · Miss F. M. Pugh, M.A., C.A. · Mrs. A. Maxwell · Miss R. Brown · Mrs. Mark Fraser, M.B.E.",
    volume: "The Electrical Age, No. 4 (January 1960), p. 9",
    persons: [
      "Mrs. D. Barkwith",
      "Miss M. Powell",
      "Miss F. M. Pugh",
      "Mrs. A. Maxwell",
      "Miss R. Brown",
      "Mrs. Mark Fraser",
    ],
  },
];

// ── State ─────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25;
let allDepicted = [];
let filteredDepicted = [];
let currentPage = 1;
let currentSort = { index: -1, asc: true };
let currentSearch = "";
let currentSearchKey = null;

const SEARCH_COLUMNS = [
  { label: "All columns",       key: null },
  { label: "Name (as appears)", key: "person_entry" },
  { label: "Standardised Name", key: "standardised_name" },
  { label: "Title",             key: "title" },
  { label: "Role / Profession", key: "role" },
  { label: "Organisation",      key: "associated_organisation" },
  { label: "Article",           key: "article_title" },
  { label: "Page",              key: "page_number" },
  { label: "File",              key: "filename" },
  { label: "Context Extract",   key: "brief_extract" },
];

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

function normalise(str) {
  return (str || "").toLowerCase().trim();
}

// Check whether a search term matches any depicted person on a gallery page.
// Returns true if the page should be highlighted.
function pageMatchesSearch(galleryPage, searchTerm) {
  if (!searchTerm) return false;
  const q = normalise(searchTerm);
  return galleryPage.persons.some(name => normalise(name).includes(q));
}

// ── Gallery ───────────────────────────────────────────────────────────────────

function buildGallery() {
  const container = document.getElementById("galleryContainer");
  container.innerHTML = "";

  GALLERY_PAGES.forEach(page => {
    const figure = document.createElement("figure");
    figure.className = "portrait-figure";
    figure.dataset.filename = page.filename;

    // Store person names as a data attribute for highlight matching
    figure.dataset.persons = JSON.stringify(page.persons);

    figure.innerHTML = `
      <a href="${page.src}" target="_blank">
        <img src="${page.src}" alt="${page.caption}" loading="lazy">
      </a>
      <figcaption>
        <strong>${page.volume}</strong><br>
        ${page.caption}
        ${page.persons.length > 0
          ? `<div class="person-tags">${page.persons.map(p => `<span class="person-tag">${p}</span>`).join("")}</div>`
          : ""}
        <div class="filename-label">${page.filename}</div>
      </figcaption>
    `;

    container.appendChild(figure);
  });
}

function updateGalleryHighlights() {
  document.querySelectorAll(".portrait-figure").forEach(figure => {
    const persons = JSON.parse(figure.dataset.persons || "[]");
    const q = currentSearch.toLowerCase().trim();

    if (q && persons.some(name => name.toLowerCase().includes(q))) {
      figure.classList.add("highlighted");
      figure.classList.remove("dimmed");
    } else if (q) {
      figure.classList.add("dimmed");
      figure.classList.remove("highlighted");
    } else {
      figure.classList.remove("highlighted", "dimmed");
    }
  });

  // Scroll to first highlighted figure if any
  const first = document.querySelector(".portrait-figure.highlighted");
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// ── Table ─────────────────────────────────────────────────────────────────────

function matchesSearch(person) {
  if (!currentSearch) return true;
  const q = currentSearch.toLowerCase();
  if (currentSearchKey) {
    return String(person[currentSearchKey] || "").toLowerCase().includes(q);
  }
  return (
    (person.person_entry           || "").toLowerCase().includes(q) ||
    (person.standardised_name      || "").toLowerCase().includes(q) ||
    (person.title                  || "").toLowerCase().includes(q) ||
    (person.role                   || "").toLowerCase().includes(q) ||
    (person.associated_organisation|| "").toLowerCase().includes(q) ||
    (person.article_title          || "").toLowerCase().includes(q) ||
    String(person.page_number      || "").toLowerCase().includes(q) ||
    (person.filename               || "").toLowerCase().includes(q) ||
    (person.brief_extract          || "").toLowerCase().includes(q)
  );
}

function renderTable() {
  const tbody = document.querySelector("#depictedTable tbody");
  tbody.innerHTML = "";

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageData = filteredDepicted.slice(start, start + PAGE_SIZE);

  if (pageData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#999;">No results found.</td></tr>';
  } else {
    pageData.forEach(person => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${person.person_entry || ""}</td>
        <td>${person.standardised_name || ""}</td>
        <td>${person.title || ""}</td>
        <td>${person.role || ""}</td>
        <td>${person.associated_organisation || ""}</td>
        <td>${person.article_title || ""}</td>
        <td>${person.page_number || ""}</td>
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
  const totalPages = Math.max(1, Math.ceil(filteredDepicted.length / PAGE_SIZE));
  const container = document.getElementById("pagination");
  let html = `<button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""}>‹ Prev</button>`;
  html += `<span style="margin:0 1rem;">Page ${currentPage} of ${totalPages}</span>`;
  html += `<button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""}>Next ›</button>`;
  container.innerHTML = html;
}

function renderStats() {
  document.getElementById("stats").innerHTML = `
    <strong>Total depicted individuals loaded:</strong> ${allDepicted.length} entries |
    <strong>Showing:</strong> ${filteredDepicted.length} matching entries
  `;
}

function applyFiltersAndSort() {
  let result = allDepicted.filter(matchesSearch);

  if (currentSort.index >= 0) {
    const keys = [
      "person_entry", "standardised_name", "title", "role",
      "associated_organisation", "article_title", "page_number",
      "filename", "brief_extract"
    ];
    const key = keys[currentSort.index];
    result.sort((a, b) => {
      const av = String(a[key] || "");
      const bv = String(b[key] || "");
      return currentSort.asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  filteredDepicted = result;
  currentPage = 1;
  renderTable();
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredDepicted.length / PAGE_SIZE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderTable();
  document.getElementById("depictedTable").scrollIntoView({ behavior: "smooth" });
}

// ── Init ──────────────────────────────────────────────────────────────────────

// Build gallery immediately (doesn't need JSON data)
buildGallery();

// Load JSON data for the table
Promise.all(JSON_FILES.map(loadFile))
  .then(arrays => {
    const allData = arrays.flat();

    // Filter to only depicted persons
    allDepicted = allData.filter(p => {
      const d = normalise(p.depicted);
      return d === "yes" || d === "true" || d === "1";
    });

    filteredDepicted = allDepicted.slice();

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
      updateGalleryHighlights();
    });

    // Search box — drives both table and gallery highlights
    document.getElementById("searchBox").addEventListener("input", e => {
      currentSearch = e.target.value.trim();
      applyFiltersAndSort();
      updateGalleryHighlights();
    });

    // Column sort
    document.querySelectorAll("#depictedTable th").forEach((th, index) => {
      th.addEventListener("click", () => {
        const isAsc = currentSort.index === index ? !currentSort.asc : true;
        currentSort = { index, asc: isAsc };
        document.querySelectorAll("#depictedTable th").forEach(h => h.classList.remove("sort-asc", "sort-desc"));
        th.classList.add(isAsc ? "sort-asc" : "sort-desc");
        applyFiltersAndSort();
      });
    });
  })
  .catch(err => {
    console.error("Failed to load persons data", err);
    document.querySelector("#depictedTable tbody").innerHTML =
      '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#999;">Failed to load data. Please check the console.</td></tr>';
  });
