// connections_explorer.js — v3
// Improvements in this version:
//  1. Virtual scrolling on disambiguation table (only renders visible rows)
//  2. Lazy-load JSON files (loads on first search, by year group)
//  3. Unified search across all three types simultaneously
//  4. Smarter shared-name detection (normalised, fuzzy, title-stripped)
//  5. Relevance scoring (multi-signal, sorts connections by strength)
//  6. Click any result card to make it the new anchor
//  7. Shared article-title highlight (separate colour from shared name)

// ── Data paths ────────────────────────────────────────────────────────────────

const BASE = 'assets/data_date/';

// Vol files loaded immediately on startup (small).
// Year files are loaded lazily in batches on first search.
const VOL_FILES = {
  articles:  ['articlesvol1.json',  'articlesvol2.json' ],
  locations: ['locationsvol1.json', 'locationsvol2.json'],
  persons:   ['personsvol1.json',   'personsvol2.json'  ],
};

// Explicit year file lists — one entry per known JSON file.
const ARTICLE_YEAR_FILES = [
  'articles1936v1.json','articles1937v1.json','articles1938v1.json','articles1939v1.json',
  'articles1940v1.json','articles1941v1.json','articles1942v1.json','articles1943v1.json',
  'articles1944v1.json','articles1945v1.json','articles1946v1.json','articles1947v1.json',
  'articles1948v1.json','articles1949v1.json','articles1950v1.json','articles1951v1.json',
  'articles1952v1.json','articles1953v1.json','articles1954v1.json','articles1955v1.json',
  'articles1956v1.json','articles1957v1.json','articles1958v1.json','articles1959v1.json',
  'articles1960v1.json','articles1961v1.json','articles1962v1.json','articles1963v1.json',
  'articles1964v1.json','articles1965v1.json','articles1966v1.json','articles1967v1.json',
  'articles1968v1.json','articles1969v1.json','articles1970v1.json','articles1971v1.json',
  'articles1972v1.json','articles1973v1.json','articles1974v1.json','articles1975v1.json',
  'articles1976v1.json','articles1977v1.json','articles1978v1.json','articles1979v1.json',
  'articles1980v1.json','articles1981v1.json','articles1982v1.json','articles1983v1.json',
  'articles1984v1.json','articles1985v1.json','articles1986v1.json',
];

const LOCATION_YEAR_FILES = [
  'locations1936v1.json','locations1937v1.json','locations1938v1.json','locations1939v1.json',
  'locations1940v1.json','locations1941v1.json','locations1942v1.json','locations1943v1.json',
  'locations1944v1.json','locations1945v1.json','locations1946v1.json','locations1947v1.json',
  'locations1948v1.json','locations1949v1.json','locations1950v1.json','locations1951v1.json',
  'locations1952v1.json','locations1953v1.json','locations1954v1.json','locations1955v1.json',
  'locations1956v1.json','locations1957v1.json','locations1958v1.json','locations1959v1.json',
  'locations1960v1.json','locations1961v1.json','locations1962v1.json','locations1963v1.json',
  'locations1964v1.json','locations1965v1.json','locations1966v1.json','locations1967v1.json',
  'locations1968v1.json','locations1969v1.json','locations1970v1.json','locations1971v1.json',
  'locations1972v1.json','locations1973v1.json','locations1974v1.json','locations1975v1.json',
  'locations1976v1.json','locations1977v1.json','locations1978v1.json','locations1979v1.json',
  'locations1980v1.json','locations1981v1.json','locations1982v1.json','locations1983v1.json',
  'locations1984v1.json','locations1985v1.json','locations1986v1.json',
];

const PERSON_YEAR_FILES = [
  'persons1936v1.json','persons1937v1.json','persons1938v1.json','persons1939v1.json',
  'persons1940v1.json','persons1941v1.json','persons1942v1.json','persons1943v1.json',
  'persons1944v1.json','persons1945v1.json','persons1946v1.json','persons1947v1.json',
  'persons1948v1.json','persons1949v1.json','persons1950v1.json','persons1951v1.json',
  'persons1952v1.json','persons1953v1.json','persons1954v1.json','persons1955v1.json',
  'persons1956v1.json','persons1957v1.json','persons1958v1.json','persons1959v1.json',
  'persons1960v1.json','persons1961v1.json','persons1962v1.json','persons1963v1.json',
  'persons1964v1.json','persons1965v1.json','persons1966v1.json','persons1967v1.json',
  'persons1968v1.json','persons1969v1.json','persons1970v1.json','persons1971v1.json',
  'persons1972v1.json','persons1973v1.json','persons1974v1.json','persons1975v1.json',
  'persons1976v1.json','persons1977v1.json','persons1978v1.json','persons1979v1.json',
  'persons1980v1.json','persons1981v1.json','persons1982v1.json','persons1983v1.json',
  'persons1984v1.json','persons1985v1.json','persons1986v1.json',
];

// Zip them together by index so we load one year across all three types at once
const YEAR_FILE_TRIPLES = ARTICLE_YEAR_FILES.map((a, i) => ({
  articles:  a,
  locations: LOCATION_YEAR_FILES[i],
  persons:   PERSON_YEAR_FILES[i],
}));

// Track which year files have been fetched
const loadedYears   = new Set();
let   volsLoaded    = false;
let   allYearsLoaded = false;
let   loadInProgress = false;

// ── DB ────────────────────────────────────────────────────────────────────────

const DB = {
  articles:  [],
  locations: [],
  persons:   [],
  articlesByFile:  {},
  articlesByKey:   {},
  locationsByFile: {},
  locationsByKey:  {},
  personsByFile:   {},
  personsByKey:    {},
  pageRegistry:    [],
  pageRegistryBuilt: false,
};

// Unified search index: one flat array across all types
// Each entry: { label, labelNorm, type, subLabel, record }
let unifiedIndex = [];

// ── State ─────────────────────────────────────────────────────────────────────

let anchor          = null;
let anchorType      = null;
let viewMode        = 'card';
let expandedSections = new Set();

// Shared-name sets, computed per render
let sharedNames       = new Set(); // normalised names shared across connections
let sharedArticles    = new Set(); // normalised article titles shared across connections
const INITIAL_SHOW    = 10;

// ── Text normalisation ────────────────────────────────────────────────────────
// Strips titles (Miss, Mr, Dr, …), punctuation, extra spaces; lowercases.
// Used for fuzzy matching — we never store the normalised form permanently.

const TITLE_RE = /^(mr\.?|mrs\.?|ms\.?|miss\.?|dr\.?|prof\.?|rev\.?|sir\.?|lady\.?|lord\.?|the\s+)/i;

function normalise(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(TITLE_RE, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rough similarity: returns true if two normalised strings are likely the same
// person/place. Uses token-overlap (Jaccard ≥ 0.5) as the fuzzy measure.
function fuzzyMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  ta.forEach(t => { if (tb.has(t)) inter++; });
  const union = ta.size + tb.size - inter;
  return inter / union >= 0.5;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanJSON(text) {
  return text.replace(/:\s*NaN\s*([,\}])/g, ': null$1');
}

async function fetchFile(url) {
  try {
    const r = await fetch(url);
    const t = await r.text();
    return JSON.parse(cleanJSON(t));
  } catch { return []; }
}

function pageKey(date, page) { return `${date || ''}|${page || ''}`; }

function addToIndex(records, byFile, byKey) {
  records.forEach(r => {
    const fn = r.filename || '';
    if (fn) { if (!byFile[fn]) byFile[fn] = []; byFile[fn].push(r); }
    const k = pageKey(r.date, r.page_number);
    if (k !== '|') { if (!byKey[k]) byKey[k] = []; byKey[k].push(r); }
  });
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(r => { if (seen.has(r)) return false; seen.add(r); return true; });
}

function buildPageRegistry() {
  if (DB.pageRegistryBuilt) {
    // Rebuild from scratch since we may have new records
    DB.pageRegistry = [];
  }
  const seen = new Set();
  [...DB.articles, ...DB.locations, ...DB.persons].forEach(r => {
    const fn = r.filename || '', pg = parseInt(r.page_number, 10), dt = r.date || '';
    if (!fn || isNaN(pg)) return;
    const key = `${fn}|${pg}|${dt}`;
    if (!seen.has(key)) { seen.add(key); DB.pageRegistry.push({ filename: fn, page: pg, date: dt }); }
  });
  DB.pageRegistry.sort((a, b) => {
    if (a.date < b.date) return -1; if (a.date > b.date) return 1;
    if (a.filename < b.filename) return -1; if (a.filename > b.filename) return 1;
    return a.page - b.page;
  });
  DB.pageRegistryBuilt = true;
}

function nearbyPages(radius = 2) {
  const fn = anchor.filename || '';
  const pg = parseInt(anchor.page_number, 10);

  // Try exact filename + page match first
  let idx = DB.pageRegistry.findIndex(r => r.filename === fn && r.page === pg);

  // Fallback: if anchor's page number isn't in the registry under this filename
  // (can happen when location/person page_number is a print page rather than a
  // file-sequence page), find any registry entry with the same filename and use
  // the closest page to anchor's page number.
  if (idx === -1 && fn) {
    const candidates = DB.pageRegistry
      .map((r, i) => ({ i, r }))
      .filter(({ r }) => r.filename === fn);
    if (candidates.length > 0) {
      // Pick the entry whose page is closest to anchor's page (or just the first)
      const best = isNaN(pg)
        ? candidates[0]
        : candidates.reduce((a, b) => Math.abs(a.r.page - pg) <= Math.abs(b.r.page - pg) ? a : b);
      idx = best.i;
    }
  }

  if (idx === -1) return [];
  const results = [];
  for (let d = -radius; d <= radius; d++) {
    if (d === 0) continue;
    const ni = idx + d;
    if (ni < 0 || ni >= DB.pageRegistry.length) continue;
    results.push({ ...DB.pageRegistry[ni], offset: d });
  }
  return results;
}

// ── Lazy loading ──────────────────────────────────────────────────────────────

// Maps singular type name -> DB plural key prefix
const TYPE_TO_DB = { article: 'articles', location: 'locations', person: 'persons' };

async function ensureVolsLoaded() {
  if (volsLoaded) return;
  const types = ['article', 'location', 'person'];
  const volKeys = { article: 'articles', location: 'locations', person: 'persons' };
  const sets = await Promise.all(types.map(async type => {
    const records = (await Promise.all(VOL_FILES[volKeys[type]].map(f => fetchFile(BASE + f)))).flat();
    return { type, records };
  }));
  sets.forEach(({ type, records }) => {
    const dbKey = TYPE_TO_DB[type];
    DB[dbKey].push(...records);
    addToIndex(records, DB[`${dbKey}ByFile`], DB[`${dbKey}ByKey`]);
    addToUnifiedIndex(records, type);
  });
  buildPageRegistry();
  volsLoaded = true;
}

async function ensureAllYearsLoaded(progressCb) {
  if (allYearsLoaded) return;
  if (loadInProgress) return;
  loadInProgress = true;

  const unloaded = YEAR_FILE_TRIPLES.filter((_, i) => !loadedYears.has(i));
  let done = 0;
  // Load in small concurrent batches to avoid flooding the server
  const BATCH = 8;
  for (let i = 0; i < unloaded.length; i += BATCH) {
    const batch = unloaded.slice(i, i + BATCH);
    await Promise.all(batch.map(async (triple, bi) => {
      const idx = i + bi;
      // triple keys are plural ('articles','locations','persons'); convert to singular for type funcs
      const pluralToSingular = { articles: 'article', locations: 'location', persons: 'person' };
      const sets = await Promise.all(
        Object.entries(triple).map(async ([pluralKey, filename]) => {
          const records = await fetchFile(BASE + filename);
          return { pluralKey, records };
        })
      );
      sets.forEach(({ pluralKey, records }) => {
        const singularType = pluralToSingular[pluralKey];
        DB[pluralKey].push(...records);
        addToIndex(records, DB[`${pluralKey}ByFile`], DB[`${pluralKey}ByKey`]);
        addToUnifiedIndex(records, singularType);
      });
      loadedYears.add(idx);
      done++;
    }));
    if (progressCb) progressCb(done, unloaded.length);
  }

  buildPageRegistry();
  unifiedIndex.sort((a, b) => a.label.localeCompare(b.label));
  allYearsLoaded = true;
  loadInProgress = false;

  // Update dataset meta
  document.getElementById('dataset-meta').textContent =
    `${DB.articles.length.toLocaleString()} articles · ${DB.locations.length.toLocaleString()} locations · ${DB.persons.length.toLocaleString()} persons`;
}

// ── Unified search index ──────────────────────────────────────────────────────

function recordLabel(r, type) {
  if (type === 'article')  return (r.article_title  || '').trim();
  if (type === 'location') return (r.location_entry  || '').trim();
  return (r.standardised_name || r.person_entry || '').trim();
}

function recordSubLabel(r, type) {
  if (type === 'article')
    return [r.date, r.volume_issue, r.page_number ? `p.${r.page_number}` : ''].filter(Boolean).join(' · ');
  if (type === 'location')
    return [r.location_standardised, r.date, r.page_number ? `p.${r.page_number}` : ''].filter(Boolean).join(' · ');
  return [r.role, r.associated_organisation, r.date, r.page_number ? `p.${r.page_number}` : ''].filter(Boolean).join(' · ');
}

const _indexSeen = new Set();

function addToUnifiedIndex(records, type) {
  records.forEach(r => {
    const label = recordLabel(r, type);
    const key   = `${type}||${label}||${r.filename || ''}||${r.page_number || ''}`;
    if (!label || _indexSeen.has(key)) return;
    _indexSeen.add(key);
    unifiedIndex.push({
      label,
      labelNorm: normalise(label),
      type,
      subLabel:  recordSubLabel(r, type),
      record:    r,
    });
  });
}

function getMatches(q) {
  if (!q || q.length < 2) return [];
  const ql   = q.toLowerCase();
  const qn   = normalise(q);
  const sw   = []; // starts-with
  const inc  = []; // contains but not starts-with

  unifiedIndex.forEach(e => {
    const ll = e.label.toLowerCase();
    if      (ll.startsWith(ql))               sw.push(e);
    else if (ll.includes(ql))                 inc.push(e);
    else if (e.labelNorm.startsWith(qn))      sw.push(e);
    else if (e.labelNorm.includes(qn))        inc.push(e);
  });

  return [...sw.slice(0, 80), ...inc.slice(0, 40)];
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

const TYPE_COLOURS = { article: '#1565c0', location: '#136348', person: '#4527a0' };

function attachDropdown() {
  const input = document.getElementById('conn-search');
  const dd    = document.getElementById('conn-dd');
  let active  = -1;
  let ddEntries = []; // current visible entries (for keyboard nav)

  function items() { return [...dd.querySelectorAll('.dd-item')]; }

  async function show(q) {
    if (!q || q.length < 2) { dd.style.display = 'none'; return; }

    // If we don't have all data yet, show spinner inline and kick off load
    if (!allYearsLoaded) {
      showLoadingInDD();
      await ensureAllYearsLoaded(updateDDProgress);
    }

    const matches = getMatches(q);
    dd.innerHTML = ''; active = -1; ddEntries = matches;

    if (!matches.length) { dd.style.display = 'none'; return; }

    // Group into starts-with vs contains, and by type within each
    const ql = q.toLowerCase();
    const sw  = matches.filter(e => e.label.toLowerCase().startsWith(ql) || e.labelNorm.startsWith(normalise(q)));
    const inc = matches.filter(e => !sw.includes(e));

    function addGroup(label) {
      const div = document.createElement('div');
      div.className = 'dd-group-label';
      div.textContent = label;
      dd.appendChild(div);
    }

    function addItem(e, i) {
      const div = document.createElement('div');
      div.className = 'dd-item';
      div.dataset.idx = i;
      const dot = `<span class="dd-type-dot" style="background:${TYPE_COLOURS[e.type]}"></span>`;
      div.innerHTML = `${dot}<span class="dd-title">${e.label}</span><span class="dd-meta">${e.subLabel}</span>`;
      div.addEventListener('mousedown', ev => { ev.preventDefault(); pickAnchor(e.record, e.type, q); });
      dd.appendChild(div);
    }

    let i = 0;
    if (sw.length)  { if (inc.length) addGroup(`Best matches`); sw.forEach(e  => addItem(e, i++)); }
    if (inc.length) { if (sw.length)  addGroup(`Also contains "${q}"`); inc.forEach(e => addItem(e, i++)); }

    dd.style.display = 'block';
  }

  function showLoadingInDD() {
    dd.innerHTML = '<div class="dd-loading">Loading data… <span id="dd-prog"></span></div>';
    dd.style.display = 'block';
  }
  function updateDDProgress(done, total) {
    const el = document.getElementById('dd-prog');
    if (el) el.textContent = `${Math.round(done/total*100)}%`;
  }

  let debounceTimer;
  input.addEventListener('input',  () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => show(input.value), 120); });
  input.addEventListener('focus',  () => { if (input.value.length >= 2) show(input.value); });
  input.addEventListener('blur',   () => setTimeout(() => { dd.style.display = 'none'; }, 160));
  input.addEventListener('keydown', e => {
    const its = items();
    if      (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, its.length - 1); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); active = Math.max(active - 1, 0); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'Enter' && active >= 0) { its[active].dispatchEvent(new MouseEvent('mousedown')); }
    else if (e.key === 'Escape') { dd.style.display = 'none'; input.blur(); }
  });
}

// ── View-mode toggle ──────────────────────────────────────────────────────────

function attachViewToggle() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      viewMode = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
      if (anchor) renderConnections();
    });
  });
}

// ── Anchor selection & disambiguation ─────────────────────────────────────────

function pickAnchor(record, type, query) {
  const label = recordLabel(record, type);
  const idx   = type === 'article' ? unifiedIndex.filter(e => e.type === 'article')
              : type === 'location' ? unifiedIndex.filter(e => e.type === 'location')
              : unifiedIndex.filter(e => e.type === 'person');
  const dupes = idx.filter(e => e.label === label);

  document.getElementById('conn-search').value     = label;
  document.getElementById('conn-dd').style.display = 'none';

  if (dupes.length > 1) {
    showDisambiguation(dupes, type, label);
  } else {
    setAnchor(record, type);
  }
}

function setAnchor(record, type) {
  anchor = record; anchorType = type;
  expandedSections.clear();
  hideDisambiguation();
  renderConnections();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Disambiguation (with virtual scrolling) ───────────────────────────────────

const DISAMBIG_ROW_H = 36;  // px, approximate rendered row height
const DISAMBIG_BUFFER = 5;  // rows rendered above/below viewport

let _disambigEntries = [];
let _disambigType    = '';
let _vsScrollTop     = 0;

function showDisambiguation(entries, type, name) {
  _disambigEntries = entries;
  _disambigType    = type;

  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('content').style.display     = 'none';

  let panel = document.getElementById('disambig-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'disambig-panel';
    const sa = document.getElementById('search-area');
    sa.parentNode.insertBefore(panel, sa.nextSibling);
  }

  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const cols = type === 'article'
    ? ['Title', 'Type', 'Page', 'Date', 'Vol / Issue', 'File']
    : type === 'location'
    ? ['Location', 'Standardised', 'Article', 'Page', 'Date', 'Vol / Issue', 'File']
    : ['Name', 'As appears', 'Role', 'Organisation', 'Article', 'Page', 'Date', 'Vol / Issue', 'File'];

  const viewportH = Math.min(400, entries.length * DISAMBIG_ROW_H);
  const totalH    = entries.length * DISAMBIG_ROW_H;

  panel.innerHTML = `
    <div class="disambig-header">
      <span class="disambig-title">Multiple matches for <em>${name}</em></span>
      <span class="disambig-sub">${entries.length} ${typeLabel} records — click a row to explore it</span>
    </div>
    <div class="disambig-table-wrap" id="disambig-scroll" style="height:${viewportH}px;overflow-y:auto;position:relative;">
      <table class="disambig-table" style="width:100%;border-collapse:collapse;">
        <thead id="disambig-thead"><tr>${cols.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead>
        <tbody id="disambig-tbody" style="position:relative;"></tbody>
      </table>
      <div id="disambig-spacer" style="height:${totalH}px;position:absolute;top:0;left:0;width:1px;pointer-events:none;"></div>
    </div>`;

  panel.style.display = 'block';

  const scrollEl = document.getElementById('disambig-scroll');
  _vsScrollTop   = 0;
  renderDisambigRows(scrollEl, 0);

  scrollEl.addEventListener('scroll', () => {
    renderDisambigRows(scrollEl, scrollEl.scrollTop);
  });
}

function renderDisambigRows(scrollEl, scrollTop) {
  const entries   = _disambigEntries;
  const type      = _disambigType;
  const viewportH = scrollEl.clientHeight;
  const firstRow  = Math.max(0, Math.floor(scrollTop / DISAMBIG_ROW_H) - DISAMBIG_BUFFER);
  const lastRow   = Math.min(entries.length - 1, Math.ceil((scrollTop + viewportH) / DISAMBIG_ROW_H) + DISAMBIG_BUFFER);

  const tbody  = document.getElementById('disambig-tbody');
  if (!tbody) return;

  // Spacer rows above and below rendered slice
  const topH    = firstRow * DISAMBIG_ROW_H;
  const bottomH = (entries.length - lastRow - 1) * DISAMBIG_ROW_H;

  function rowCells(r) {
    if (type === 'article')  return [r.article_title, r.article_type, r.page_number, r.date, r.volume_issue, r.filename];
    if (type === 'location') return [r.location_entry, r.location_standardised, r.article_title, r.page_number, r.date, r.volume_issue, r.filename];
    return [r.standardised_name || r.person_entry, r.person_entry, r.role, r.associated_organisation, r.article_title, r.page_number, r.date, r.volume_issue, r.filename];
  }

  let html = `<tr style="height:${topH}px"></tr>`;
  for (let i = firstRow; i <= lastRow; i++) {
    const e = entries[i];
    html += `<tr class="disambig-row" data-idx="${i}" style="height:${DISAMBIG_ROW_H}px;cursor:pointer;">
      ${rowCells(e.record).map(v => `<td>${v || ''}</td>`).join('')}
      <td><button class="disambig-pick-btn" data-idx="${i}">Select</button></td>
    </tr>`;
  }
  html += `<tr style="height:${bottomH}px"></tr>`;
  tbody.innerHTML = html;

  tbody.querySelectorAll('.disambig-pick-btn').forEach(btn => {
    btn.addEventListener('click', ev => { ev.stopPropagation(); setAnchor(entries[+btn.dataset.idx].record, type); });
  });
  tbody.querySelectorAll('.disambig-row').forEach(row => {
    row.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') return; setAnchor(entries[+row.dataset.idx].record, type); });
  });
}

function hideDisambiguation() {
  const panel = document.getElementById('disambig-panel');
  if (panel) panel.style.display = 'none';
}

// ── Relevance scoring ─────────────────────────────────────────────────────────
// Score each connection record against the anchor. Higher = more signals shared.
// Signals (cumulative):
//   +4  same filename
//   +3  same page_number + date
//   +2  same article_title (exact, normalised)
//   +1  article_title fuzzy match
//   +2  same standardised location / person name (exact normalised)
//   +1  location / person name fuzzy match
//   +0.5 same volume_issue
//   -1  nearby page (not direct) — base score for proximity-only connections

function scoreRecord(r, dataType, proximityTag) {
  let score = proximityTag ? -1 : 0; // nearby pages start below direct

  const af = anchor.filename     || '';
  const rf = r.filename          || '';
  const ak = pageKey(anchor.date, anchor.page_number);
  const rk = pageKey(r.date,      r.page_number);

  if (af && af === rf)  score += 4;
  if (ak !== '|' && ak === rk) score += 3;
  if (anchor.volume_issue && anchor.volume_issue === r.volume_issue) score += 0.5;

  // Article title match
  const aat = normalise(anchor.article_title || '');
  const rat = normalise(r.article_title      || '');
  if (aat && rat) {
    if (aat === rat)           score += 2;
    else if (fuzzyMatch(aat, rat)) score += 1;
  }

  // Name match (location or person) — compare anchor's own name to record's name
  const anchorName = normalise(recordLabel(anchor, anchorType));
  const recName    = normalise(recordLabel(r, dataType));
  if (anchorName && recName) {
    if (anchorName === recName)           score += 2;
    else if (fuzzyMatch(anchorName, recName)) score += 1;
  }

  return score;
}

// ── Shared-name & shared-article computation ──────────────────────────────────
//
// ★ Shared name  — the record's PRIMARY name (location name, person name, or
//   article title) appears more than once as a primary name across all
//   connection records. Means two or more connections share the same identity.
//
// ◆ Shared article — the record's article_title field matches (fuzzy) the
//   ANCHOR's own article title (or the anchor's primary name if the anchor is
//   an article). Means this connection was explicitly mentioned in the same
//   article as the thing we're exploring.
//
// Both use normalised + fuzzy matching so minor formatting differences don't
// prevent a match, but we never tally article_title fields as "names" — that
// was the bug causing false positives.

function nameOfRecord(r, dataType) {
  return normalise(recordLabel(r, dataType));
}

function articleTitleOf(r) {
  return normalise(r.article_title || '');
}

function computeSharedSets(allItems) {
  // ★ Shared name: a connection record's primary name fuzzy-matches the
  // ANCHOR's own primary name. E.g. if you searched for "Miss Sutton", any
  // other person record named "Sutton, Miss" in the results gets flagged.
  // This is intentionally anchor-centric: it highlights recurrences of the
  // thing you searched for, not arbitrary coincidences between results.
  const anchorPrimaryName = nameOfRecord(anchor, anchorType);
  sharedNames = anchorPrimaryName ? new Set([anchorPrimaryName]) : new Set();
  // (sharedFlags does the fuzzy comparison per-record, so we just store the anchor name)

  // ◆ Shared article: connection record's article_title matches the anchor's
  // article title — means it was mentioned in the same article as the anchor.
  const anchorArticleTitle = normalise(
    anchorType === 'article' ? (anchor.article_title || '') : (anchor.article_title || '')
  );
  sharedArticles = anchorArticleTitle ? new Set([anchorArticleTitle]) : new Set();
}

// Returns { sharedName: bool, sharedArticle: bool } for a single connection record.
function sharedFlags(r, dataType) {
  const n = nameOfRecord(r, dataType);
  const a = articleTitleOf(r);

  // ★ Shared name: this record's primary name matches the anchor's primary name.
  // For persons we use fuzzy matching (catches title/format differences like
  // "Miss Sutton" vs "Sutton, Miss"). For locations and articles we use exact
  // normalised match only — place names are too similar to fuzzy-match safely.
  let sharedName = false;
  if (n) {
    if (sharedNames.has(n)) {
      sharedName = true;
    } else if (dataType === 'person' || anchorType === 'person') {
      for (const sn of sharedNames) {
        if (fuzzyMatch(n, sn)) { sharedName = true; break; }
      }
    }
  }

  // ◆ Shared article: this connection record's article_title matches the
  // anchor's article title — i.e. it was mentioned in the same article.
  // Only meaningful when the record has an article_title field (locations &
  // persons do; articles themselves use their title as primary name instead).
  // Uses exact normalised match only — fuzzy is too loose for article titles
  // (e.g. "Eastern Area" would wrongly match "North-Eastern Area").
  let sharedArticle = false;
  if (a && dataType !== 'article') {
    sharedArticle = sharedArticles.has(a);
  }

  return { sharedName, sharedArticle };
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderConnections() {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('content').style.display     = 'block';
  document.getElementById('anchor-card').innerHTML      = buildAnchorCard();

  const fn  = anchor.filename || '';
  const dpk = pageKey(anchor.date, anchor.page_number);

  // Direct connections: same filename, OR same page+date but ONLY within the
  // same file. We never pull in records from other files just because they
  // share a date — that causes huge false-positive floods on popular issue dates.
  function directRecords(byFile, byKey) {
    const fromFile = byFile[fn] || [];
    // page+date match restricted to records that also share the filename
    const fromPage = fn
      ? (byKey[dpk] || []).filter(r => (r.filename || '') === fn)
      : (byKey[dpk] || []);
    return dedup([...fromFile, ...fromPage]);
  }

  const directArticles  = directRecords(DB.articlesByFile,  DB.articlesByKey ).filter(r => r !== anchor);
  const directLocations = directRecords(DB.locationsByFile, DB.locationsByKey).filter(r => anchorType !== 'location' || r !== anchor);
  const directPersons   = directRecords(DB.personsByFile,   DB.personsByKey  ).filter(r => anchorType !== 'person'   || r !== anchor);

  const nearby = nearbyPages(2);
  const nearbyArticles = [], nearbyLocations = [], nearbyPersons = [];
  const seenA = new Set([...directArticles, anchor]);
  const seenL = new Set([...directLocations, ...(anchorType === 'location' ? [anchor] : [])]);
  const seenP = new Set([...directPersons,   ...(anchorType === 'person'   ? [anchor] : [])]);

  nearby.forEach(np => {
    const nfn  = np.filename;
    const nkey = pageKey(np.date, np.page);
    const tag  = np.offset < 0
      ? `${Math.abs(np.offset)} page${Math.abs(np.offset) > 1 ? 's' : ''} before`
      : `${np.offset} page${np.offset > 1 ? 's' : ''} after`;
    // Nearby: same filename of the neighbour page, or same page+date within that file
    function nearbyRecords(byFile, byKey) {
      const fromFile = byFile[nfn] || [];
      const fromPage = nfn
        ? (byKey[nkey] || []).filter(r => (r.filename || '') === nfn)
        : (byKey[nkey] || []);
      return dedup([...fromFile, ...fromPage]);
    }
    nearbyRecords(DB.articlesByFile,  DB.articlesByKey ).filter(r => !seenA.has(r)).forEach(r => { nearbyArticles.push({ record: r, tag }); seenA.add(r); });
    nearbyRecords(DB.locationsByFile, DB.locationsByKey).filter(r => !seenL.has(r)).forEach(r => { nearbyLocations.push({ record: r, tag }); seenL.add(r); });
    nearbyRecords(DB.personsByFile,   DB.personsByKey  ).filter(r => !seenP.has(r)).forEach(r => { nearbyPersons.push({ record: r, tag }); seenP.add(r); });
  });

  // Compute shared sets
  const allItems = [
    ...directArticles.map(r  => ({ record: r, dataType: 'article'  })),
    ...directLocations.map(r => ({ record: r, dataType: 'location' })),
    ...directPersons.map(r   => ({ record: r, dataType: 'person'   })),
    ...nearbyArticles.map(({ record: r })  => ({ record: r, dataType: 'article'  })),
    ...nearbyLocations.map(({ record: r }) => ({ record: r, dataType: 'location' })),
    ...nearbyPersons.map(({ record: r })   => ({ record: r, dataType: 'person'   })),
  ];
  computeSharedSets(allItems);

  applyViewContainers();

  renderSubSection('direct-articles',  directArticles,  'article',  null);
  renderSubSection('direct-locations', directLocations, 'location', null);
  renderSubSection('direct-persons',   directPersons,   'person',   null);
  renderNearbySubSection('nearby-articles',  nearbyArticles,  'article');
  renderNearbySubSection('nearby-locations', nearbyLocations, 'location');
  renderNearbySubSection('nearby-persons',   nearbyPersons,   'person');

  updateCount('direct-articles-count',  directArticles.length);
  updateCount('direct-locations-count', directLocations.length);
  updateCount('direct-persons-count',   directPersons.length);
  updateCount('nearby-articles-count',  nearbyArticles.length);
  updateCount('nearby-locations-count', nearbyLocations.length);
  updateCount('nearby-persons-count',   nearbyPersons.length);

  toggleEmpty('direct-articles-empty',  directArticles.length  === 0);
  toggleEmpty('direct-locations-empty', directLocations.length === 0);
  toggleEmpty('direct-persons-empty',   directPersons.length   === 0);
  toggleEmpty('nearby-articles-empty',  nearbyArticles.length  === 0);
  toggleEmpty('nearby-locations-empty', nearbyLocations.length === 0);
  toggleEmpty('nearby-persons-empty',   nearbyPersons.length   === 0);

  const hasShared = sharedNames.size || sharedArticles.size;
  document.getElementById('shared-legend').style.display = hasShared ? 'flex' : 'none';
}

function applyViewContainers() {
  ['direct-articles','direct-locations','direct-persons','nearby-articles','nearby-locations','nearby-persons'].forEach(id => {
    const tw = document.getElementById(`${id}-table`);
    const cw = document.getElementById(`${id}-wrap`);
    if (tw) tw.style.display = viewMode === 'table' ? 'block' : 'none';
    if (cw) cw.style.display = viewMode === 'table' ? 'none'  : 'grid';
  });
}

function updateCount(id, n) { const el = document.getElementById(id); if (el) el.textContent = n; }
function toggleEmpty(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; }

// ── Sub-section renderers ─────────────────────────────────────────────────────

// Sort by descending relevance score, then shared flags (sharedName > sharedArticle > neither)
function sortByRelevance(items, dataType, isNearby) {
  // items: either plain records (direct) or {record, tag} (nearby)
  return [...items].sort((a, b) => {
    const ra = isNearby ? a.record : a;
    const rb = isNearby ? b.record : b;
    const ta = isNearby ? a.tag   : null;
    const tb = isNearby ? b.tag   : null;
    const sa = scoreRecord(ra, dataType, ta);
    const sb = scoreRecord(rb, dataType, tb);
    if (sb !== sa) return sb - sa;
    // Tiebreak: sharedName > sharedArticle > none
    const fa = sharedFlags(ra, dataType);
    const fb = sharedFlags(rb, dataType);
    return ((fb.sharedName ? 2 : 0) + (fb.sharedArticle ? 1 : 0))
         - ((fa.sharedName ? 2 : 0) + (fa.sharedArticle ? 1 : 0));
  });
}

function renderSubSection(id, records, dataType) {
  const sorted = sortByRelevance(records, dataType, false);
  const highCount = sorted.filter(r => { const f = sharedFlags(r, dataType); return f.sharedName || f.sharedArticle; }).length;
  const limit   = expandedSections.has(id) ? sorted.length : highCount + INITIAL_SHOW;
  const visible = sorted.slice(0, Math.min(limit, sorted.length));
  const hidden  = sorted.length - visible.length;

  if (viewMode === 'table') {
    const tbody = document.getElementById(`${id}-body`);
    if (tbody) tbody.innerHTML = visible.map(r => buildTableRow(r, dataType, null, sharedFlags(r, dataType))).join('');
  } else {
    const wrap = document.getElementById(`${id}-wrap`);
    if (wrap) wrap.innerHTML = visible.map(r => buildCard(r, dataType, null, sharedFlags(r, dataType))).join('');
  }
  renderExpandButton(id, hidden, sorted.length, false);
}

function renderNearbySubSection(id, items, dataType) {
  const sorted = sortByRelevance(items, dataType, true);
  const highCount = sorted.filter(({ record: r }) => { const f = sharedFlags(r, dataType); return f.sharedName || f.sharedArticle; }).length;
  const limit   = expandedSections.has(id) ? sorted.length : highCount + INITIAL_SHOW;
  const visible = sorted.slice(0, Math.min(limit, sorted.length));
  const hidden  = sorted.length - visible.length;

  if (viewMode === 'table') {
    const tbody = document.getElementById(`${id}-body`);
    if (tbody) tbody.innerHTML = visible.map(({ record: r, tag }) => buildTableRow(r, dataType, tag, sharedFlags(r, dataType))).join('');
  } else {
    const wrap = document.getElementById(`${id}-wrap`);
    if (wrap) wrap.innerHTML = visible.map(({ record: r, tag }) => buildCard(r, dataType, tag, sharedFlags(r, dataType))).join('');
  }
  renderExpandButton(id, hidden, sorted.length, true);
}

function renderExpandButton(id, hiddenCount, total, isNearby) {
  const btnId = `${id}-expand-btn`;
  let btn = document.getElementById(btnId);
  if (hiddenCount <= 0) { if (btn) btn.remove(); return; }
  if (!btn) {
    btn = document.createElement('div');
    btn.id = btnId;
    btn.className = 'expand-btn-wrap';
    const ref = document.getElementById(`${id}-table`) || document.getElementById(`${id}-wrap`);
    if (ref && ref.parentNode) ref.parentNode.insertBefore(btn, ref.nextSibling);
  }
  btn.innerHTML = `<button class="expand-btn" onclick="expandSection('${id}')">Show all ${total} matches (${hiddenCount} more)</button>`;
}

function expandSection(id) {
  expandedSections.add(id);
  if (anchor) renderConnections();
}

// ── Field helper ──────────────────────────────────────────────────────────────

function field(label, value) {
  if (!value && value !== 0) return '';
  return `<div class="conn-field"><span class="conn-label">${label}</span><span class="conn-value">${value}</span></div>`;
}

// ── Anchor card ───────────────────────────────────────────────────────────────

function buildAnchorCard() {
  const r = anchor, type = anchorType;
  const name = recordLabel(r, type) || '—';
  let fields = '';
  if (type === 'article') {
    fields = field('Type', r.article_type) + field('Page', r.page_number) + field('Date', r.date) + field('Vol/Issue', r.volume_issue) + field('File', r.filename);
  } else if (type === 'location') {
    fields = field('Standardised', r.location_standardised) + field('Context', r.brief_context) + field('Article', r.article_title) + field('Page', r.page_number) + field('Date', r.date) + field('Vol/Issue', r.volume_issue) + field('File', r.filename);
  } else {
    fields = field('As appears', r.person_entry) + field('Title', r.title) + field('Role', r.role) + field('Organisation', r.associated_organisation) + field('Gender', r.gender) + field('Relation', r.relation) + field('Article', r.article_title) + field('Page', r.page_number) + field('Date', r.date) + field('Vol/Issue', r.volume_issue) + field('File', r.filename);
  }
  return `<div class="conn-card conn-${type} anchor-card-full">
    <div class="conn-card-hdr conn-hdr-${type}">
      <span class="conn-type-badge">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
      <span class="conn-card-title">${name}</span>
    </div>
    <div class="conn-card-body">${fields}</div>
  </div>`;
}

// ── Card builder (with click-to-explore) ──────────────────────────────────────

// flags: { sharedName, sharedArticle }
function buildCard(r, dataType, proximityTag, flags) {
  let title = '', fields = '';
  if (dataType === 'article') {
    title  = r.article_title || '—';
    fields = field('Type', r.article_type) + field('Page', r.page_number) + field('Date', r.date) + field('Vol/Issue', r.volume_issue) + field('File', r.filename);
  } else if (dataType === 'location') {
    title  = r.location_entry || '—';
    fields = field('Standardised', r.location_standardised) + field('Context', r.brief_context) + field('Article', r.article_title) + field('Page', r.page_number) + field('Date', r.date) + field('Vol/Issue', r.volume_issue) + field('File', r.filename) + (r.brief_extract ? `<details class="conn-extract"><summary>View extract</summary><p>${r.brief_extract}</p></details>` : '');
  } else {
    title  = r.standardised_name || r.person_entry || '—';
    fields = field('As appears', r.person_entry) + field('Title', r.title) + field('Role', r.role) + field('Organisation', r.associated_organisation) + field('Gender', r.gender) + field('Relation', r.relation) + field('Depicted', r.depicted) + field('Article', r.article_title) + field('Page', r.page_number) + field('Date', r.date) + field('Vol/Issue', r.volume_issue) + field('File', r.filename) + (r.brief_extract ? `<details class="conn-extract"><summary>View extract</summary><p>${r.brief_extract}</p></details>` : '');
  }

  const score = scoreRecord(r, dataType, proximityTag);
  const proximityHtml = proximityTag ? `<div class="proximity-tag">📍 ${proximityTag}</div>` : '';

  let banners = '';
  if (flags.sharedName)    banners += `<div class="shared-banner shared-banner-name">★ Shared name</div>`;
  if (flags.sharedArticle) banners += `<div class="shared-banner shared-banner-article">◆ Shared article</div>`;

  const cls = [
    `conn-card conn-${dataType}`,
    flags.sharedName    ? 'conn-shared-name'    : '',
    flags.sharedArticle ? 'conn-shared-article' : '',
  ].filter(Boolean).join(' ');

  // Encode record ref for click-to-explore (store as dataset attributes)
  const encodedType = dataType;
  const encodedFile = (r.filename     || '').replace(/"/g, '&quot;');
  const encodedPage = (r.page_number  || '').toString();
  const encodedDate = (r.date         || '').replace(/"/g, '&quot;');

  return `<div class="${cls}" data-explore-type="${encodedType}" data-explore-file="${encodedFile}" data-explore-page="${encodedPage}" data-explore-date="${encodedDate}" title="Click to explore connections for this record">
    <div class="conn-card-hdr conn-hdr-${dataType}">
      <span class="conn-type-badge">${dataType.charAt(0).toUpperCase() + dataType.slice(1)}</span>
      <span class="conn-card-title">${title}</span>
      <span class="explore-hint">→</span>
    </div>
    <div class="conn-card-body">${proximityHtml}${banners}${fields}</div>
  </div>`;
}

// ── Table row builder ─────────────────────────────────────────────────────────

function buildTableRow(r, dataType, proximityTag, flags) {
  const typeLabel  = dataType.charAt(0).toUpperCase() + dataType.slice(1);
  const proximity  = proximityTag ? `<span class="proximity-tag">📍 ${proximityTag}</span>` : '';
  let cls = '';
  if (flags.sharedName && flags.sharedArticle) cls = ' class="shared-both-row"';
  else if (flags.sharedName)    cls = ' class="shared-name-row"';
  else if (flags.sharedArticle) cls = ' class="shared-article-row"';

  let stars = '';
  if (flags.sharedName)    stars += '★ ';
  if (flags.sharedArticle) stars += '◆ ';

  let name = '', detail = '';
  if (dataType === 'article') {
    name = r.article_title || ''; detail = r.article_type || '';
  } else if (dataType === 'location') {
    name = r.location_entry || ''; detail = r.location_standardised || '';
  } else {
    name = r.standardised_name || r.person_entry || '';
    detail = [r.role, r.associated_organisation].filter(Boolean).join(' · ');
  }

  const encodedFile = (r.filename || '').replace(/"/g, '&quot;');
  return `<tr${cls} data-explore-type="${dataType}" data-explore-file="${encodedFile}" data-explore-page="${r.page_number || ''}" data-explore-date="${r.date || ''}" style="cursor:pointer;" title="Click to explore">
    <td>${stars}${name}</td>
    <td>${typeLabel}</td>
    <td>${detail}</td>
    <td>${r.page_number  || ''}</td>
    <td>${r.date         || ''}</td>
    <td>${r.volume_issue || ''}</td>
    <td>${r.filename     || ''}</td>
    <td>${proximity}</td>
  </tr>`;
}

// ── Click-to-explore (event delegation) ──────────────────────────────────────

function attachClickToExplore() {
  document.getElementById('content').addEventListener('click', e => {
    const card = e.target.closest('[data-explore-type]');
    if (!card) return;
    if (e.target.tagName === 'SUMMARY' || e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;

    const type = card.dataset.exploreType;
    const file = card.dataset.exploreFile;
    const page = card.dataset.explorePage;
    const date = card.dataset.exploreDate;

    // Find the matching record in DB
    const pool = type === 'article' ? DB.articles : type === 'location' ? DB.locations : DB.persons;
    const match = pool.find(r =>
      (r.filename     || '') === file &&
      (r.page_number  || '').toString() === page &&
      (r.date         || '') === date
    );

    if (match) setAnchor(match, type);
  });
}

// ── Initial load (vols only; year files lazy) ─────────────────────────────────

async function loadAll() {
  document.getElementById('loading-bar').style.display = 'block';
  document.getElementById('loading-status').textContent = 'Loading index data…';

  await ensureVolsLoaded();

  document.getElementById('loading-bar').style.display  = 'none';
  document.getElementById('loading-status').textContent  = '';
  document.getElementById('search-area').style.display   = 'block';
  document.getElementById('view-toggle').style.display   = 'flex';
  document.getElementById('dataset-meta').textContent    =
    `${DB.articles.length.toLocaleString()} articles · ${DB.locations.length.toLocaleString()} locations · ${DB.persons.length.toLocaleString()} persons (full index loading on first search…)`;

  attachDropdown();
  attachViewToggle();
  attachClickToExplore();

  // Start loading all years in background so it's ready by the time someone searches
  ensureAllYearsLoaded(null);
}

loadAll().catch(err => {
  console.error('Failed to load data', err);
  document.getElementById('loading-status').textContent = 'Error loading data — check the assets/data_date/ folder is present.';
});
