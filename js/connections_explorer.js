// connections_explorer.js
// Loads articles, locations and persons JSON files, then finds connections
// between records that share the same filename OR same page_number + date.
// Nearby-page connections (±2 pages) are also surfaced and flagged.
// Supports searching by article title, location name, or person name.
// Supports card and table display modes.
// Highlights records whose name appears in multiple connections.

// ── Data paths ────────────────────────────────────────────────────────────────

const BASE = 'assets/data_date/';

const ARTICLE_FILES = [
  'articlesvol1.json','articlesvol2.json',
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
].map(f => BASE + f);

const LOCATION_FILES = [
  'locationsvol1.json','locationsvol2.json',
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
].map(f => BASE + f);

const PERSON_FILES = [
  'personsvol1.json','personsvol2.json',
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
].map(f => BASE + f);

// ── State ─────────────────────────────────────────────────────────────────────

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
};

let articleIndex  = [];
let locationIndex = [];
let personIndex   = [];

let anchor     = null;
let anchorType = null;
let viewMode   = 'card';

let sharedArticleTitles = new Set();
let sharedLocationNames = new Set();
let sharedPersonNames   = new Set();

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanJSON(text) {
  return text.replace(/:\s*NaN\s*([,\}])/g, ': null$1');
}

function loadFile(url) {
  return fetch(url).then(r => r.text()).then(t => JSON.parse(cleanJSON(t))).catch(() => []);
}

function pageKey(date, page) { return `${date || ''}|${page || ''}`; }

function buildIndex(records, byFile, byKey) {
  records.forEach(r => {
    const fn = r.filename || '';
    if (fn) { if (!byFile[fn]) byFile[fn] = []; byFile[fn].push(r); }
    const k = pageKey(r.date, r.page_number);
    if (k !== '|') { if (!byKey[k]) byKey[k] = []; byKey[k].push(r); }
  });
}

function buildPageRegistry() {
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
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(r => { if (seen.has(r)) return false; seen.add(r); return true; });
}

function nearbyPages(radius = 2) {
  const fn = anchor.filename || '';
  const pg = parseInt(anchor.page_number, 10);
  const idx = DB.pageRegistry.findIndex(r => r.filename === fn && r.page === pg);
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

// ── Search index construction ─────────────────────────────────────────────────

function buildSearchIndexes() {
  // Deduplicate by (name + filename + page) so the same physical mention isn't
  // listed twice, but different occurrences of the same name across different
  // pages/files each get their own dropdown entry.

  const seenA = new Set();
  DB.articles.forEach(r => {
    const t   = (r.article_title || '').trim();
    const key = `${t}||${r.filename || ''}||${r.page_number || ''}`;
    if (!t || seenA.has(key)) return; seenA.add(key);
    articleIndex.push({
      label:    t,
      subLabel: [r.date, r.volume_issue, r.page_number ? `p.${r.page_number}` : ''].filter(Boolean).join(' · '),
      record:   r,
    });
  });
  articleIndex.sort((a, b) => a.label.localeCompare(b.label) || a.subLabel.localeCompare(b.subLabel));

  const seenL = new Set();
  DB.locations.forEach(r => {
    const t   = (r.location_entry || '').trim();
    const key = `${t}||${r.filename || ''}||${r.page_number || ''}`;
    if (!t || seenL.has(key)) return; seenL.add(key);
    locationIndex.push({
      label:    t,
      subLabel: [r.location_standardised, r.date, r.page_number ? `p.${r.page_number}` : ''].filter(Boolean).join(' · '),
      record:   r,
    });
  });
  locationIndex.sort((a, b) => a.label.localeCompare(b.label) || a.subLabel.localeCompare(b.subLabel));

  const seenP = new Set();
  DB.persons.forEach(r => {
    const t   = (r.standardised_name || r.person_entry || '').trim();
    const key = `${t}||${r.filename || ''}||${r.page_number || ''}`;
    if (!t || seenP.has(key)) return; seenP.add(key);
    personIndex.push({
      label:    t,
      subLabel: [r.role, r.associated_organisation, r.date, r.page_number ? `p.${r.page_number}` : ''].filter(Boolean).join(' · '),
      record:   r,
    });
  });
  personIndex.sort((a, b) => a.label.localeCompare(b.label) || a.subLabel.localeCompare(b.subLabel));
}

function getMatches(q, index) {
  if (!q || q.length < 2) return { sw: [], inc: [] };
  const ql = q.toLowerCase();
  return {
    sw:  index.filter(e =>  e.label.toLowerCase().startsWith(ql)).slice(0, 50),
    inc: index.filter(e => !e.label.toLowerCase().startsWith(ql) && e.label.toLowerCase().includes(ql)).slice(0, 50),
  };
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function attachDropdown() {
  const input    = document.getElementById('conn-search');
  const dd       = document.getElementById('conn-dd');
  const typesSel = document.getElementById('search-type');
  let active     = -1;

  function currentIndex() {
    const t = typesSel.value;
    return t === 'location' ? locationIndex : t === 'person' ? personIndex : articleIndex;
  }
  function items() { return [...dd.querySelectorAll('.dd-item')]; }

  function show(q) {
    const type = typesSel.value;
    const { sw, inc } = getMatches(q, currentIndex());
    dd.innerHTML = ''; active = -1;
    if (!sw.length && !inc.length) { dd.style.display = 'none'; return; }

    function addGroup(label) {
      const div = document.createElement('div'); div.className = 'dd-group-label'; div.textContent = label; dd.appendChild(div);
    }
    function addItem(entry) {
      const div = document.createElement('div'); div.className = 'dd-item';
      div.innerHTML = `<span class="dd-title">${entry.label}</span><span class="dd-meta">${entry.subLabel}</span>`;
      div.addEventListener('mousedown', e => { e.preventDefault(); pickAnchor(entry.record, type); });
      dd.appendChild(div);
    }
    if (sw.length)  { if (inc.length) addGroup(`Starting with "${q}"`); sw.forEach(addItem); }
    if (inc.length) { if (sw.length)  addGroup(`Also containing "${q}"`); inc.forEach(addItem); }
    dd.style.display = 'block';
  }

  input.addEventListener('input',  () => show(input.value));
  input.addEventListener('focus',  () => { if (input.value.length >= 2) show(input.value); });
  input.addEventListener('blur',   () => setTimeout(() => { dd.style.display = 'none'; }, 150));
  input.addEventListener('keydown', e => {
    const its = items();
    if      (e.key === 'ArrowDown')              { active = Math.min(active + 1, its.length - 1); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'ArrowUp')                { active = Math.max(active - 1, 0); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'Enter' && active >= 0)   { its[active].dispatchEvent(new MouseEvent('mousedown')); }
    else if (e.key === 'Escape')                 { dd.style.display = 'none'; }
  });
  typesSel.addEventListener('change', () => {
    const ph = { article: 'Type an article title…', location: 'Type a location name…', person: 'Type a person name…' };
    input.placeholder = ph[typesSel.value] || 'Search…';
    input.value = ''; dd.style.display = 'none';
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

// ── Anchor selection ──────────────────────────────────────────────────────────

function pickAnchor(record, type) {
  anchor = record; anchorType = type;
  const label = type === 'article'  ? (record.article_title  || '')
              : type === 'location' ? (record.location_entry  || '')
              :                       (record.standardised_name || record.person_entry || '');
  document.getElementById('conn-search').value = label;
  document.getElementById('conn-dd').style.display = 'none';
  renderConnections();
}

// ── Shared-name computation ───────────────────────────────────────────────────

function nameOf(r, dataType) {
  if (dataType === 'article')  return (r.article_title  || '').trim();
  if (dataType === 'location') return (r.location_entry  || '').trim();
  return (r.standardised_name || r.person_entry || '').trim();
}

function computeSharedNames(allItems) {
  // A name is "shared" if the same name string appears in 2+ distinct records
  // across the full result set (including the anchor).
  const counts = { article: {}, location: {}, person: {} };
  const tally = (r, dt) => {
    const n = nameOf(r, dt);
    if (n) counts[dt][n] = (counts[dt][n] || 0) + 1;
  };
  tally(anchor, anchorType);
  allItems.forEach(({ record, dataType }) => tally(record, dataType));

  sharedArticleTitles = new Set(Object.keys(counts.article).filter(k  => counts.article[k]  > 1));
  sharedLocationNames = new Set(Object.keys(counts.location).filter(k => counts.location[k] > 1));
  sharedPersonNames   = new Set(Object.keys(counts.person).filter(k   => counts.person[k]   > 1));
}

function isShared(r, dataType) {
  if (dataType === 'article')  return sharedArticleTitles.has(nameOf(r, 'article'));
  if (dataType === 'location') return sharedLocationNames.has(nameOf(r, 'location'));
  return sharedPersonNames.has(nameOf(r, 'person'));
}

// ── Main render ───────────────────────────────────────────────────────────────

function renderConnections() {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('content').style.display     = 'block';

  document.getElementById('anchor-card').innerHTML = buildAnchorCard();

  const fn  = anchor.filename || '';
  const dpk = pageKey(anchor.date, anchor.page_number);

  const directArticles  = dedup([...(DB.articlesByFile[fn]  || []), ...(DB.articlesByKey[dpk]  || [])]).filter(r => r !== anchor);
  const directLocations = dedup([...(DB.locationsByFile[fn] || []), ...(DB.locationsByKey[dpk] || [])]).filter(r => anchorType !== 'location' || r !== anchor);
  const directPersons   = dedup([...(DB.personsByFile[fn]   || []), ...(DB.personsByKey[dpk]   || [])]).filter(r => anchorType !== 'person'   || r !== anchor);

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

    dedup([...(DB.articlesByFile[nfn]  || []), ...(DB.articlesByKey[nkey]  || [])]).filter(r => !seenA.has(r)).forEach(r => { nearbyArticles.push({ record: r, tag }); seenA.add(r); });
    dedup([...(DB.locationsByFile[nfn] || []), ...(DB.locationsByKey[nkey] || [])]).filter(r => !seenL.has(r)).forEach(r => { nearbyLocations.push({ record: r, tag }); seenL.add(r); });
    dedup([...(DB.personsByFile[nfn]   || []), ...(DB.personsByKey[nkey]   || [])]).filter(r => !seenP.has(r)).forEach(r => { nearbyPersons.push({ record: r, tag }); seenP.add(r); });
  });

  // Compute shared names across everything
  const allItems = [
    ...directArticles.map(r  => ({ record: r, dataType: 'article'  })),
    ...directLocations.map(r => ({ record: r, dataType: 'location' })),
    ...directPersons.map(r   => ({ record: r, dataType: 'person'   })),
    ...nearbyArticles.map(({ record: r })  => ({ record: r, dataType: 'article'  })),
    ...nearbyLocations.map(({ record: r }) => ({ record: r, dataType: 'location' })),
    ...nearbyPersons.map(({ record: r })   => ({ record: r, dataType: 'person'   })),
  ];
  computeSharedNames(allItems);

  // Apply view mode wrappers
  applyViewContainers();

  renderSubSection('direct-articles',  directArticles,  'article');
  renderSubSection('direct-locations', directLocations, 'location');
  renderSubSection('direct-persons',   directPersons,   'person');
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

  const hasShared = sharedArticleTitles.size || sharedLocationNames.size || sharedPersonNames.size;
  document.getElementById('shared-legend').style.display = hasShared ? 'flex' : 'none';
}

function applyViewContainers() {
  const ids = ['direct-articles','direct-locations','direct-persons','nearby-articles','nearby-locations','nearby-persons'];
  ids.forEach(id => {
    const tableWrap = document.getElementById(`${id}-table`);
    const cardsWrap = document.getElementById(`${id}-wrap`);
    if (!tableWrap || !cardsWrap) return;
    tableWrap.style.display = viewMode === 'table' ? 'block' : 'none';
    cardsWrap.style.display = viewMode === 'table' ? 'none'  : 'grid';
  });
}

function updateCount(id, n) { const el = document.getElementById(id); if (el) el.textContent = n; }
function toggleEmpty(id, show) { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; }

// ── Sub-section renderers ─────────────────────────────────────────────────────

function sharedFirst(records, dataType) {
  return [...records].sort((a, b) => (isShared(a, dataType) ? 0 : 1) - (isShared(b, dataType) ? 0 : 1));
}

function renderSubSection(id, records, dataType) {
  const sorted = sharedFirst(records, dataType);
  if (viewMode === 'table') {
    const tbody = document.getElementById(`${id}-body`);
    if (tbody) tbody.innerHTML = sorted.map(r => buildTableRow(r, dataType, null, isShared(r, dataType))).join('');
  } else {
    const wrap = document.getElementById(`${id}-wrap`);
    if (wrap) wrap.innerHTML = sorted.map(r => buildCard(r, dataType, null, isShared(r, dataType))).join('');
  }
}

function renderNearbySubSection(id, items, dataType) {
  const sorted = [...items].sort((a, b) => (isShared(a.record, dataType) ? 0 : 1) - (isShared(b.record, dataType) ? 0 : 1));
  if (viewMode === 'table') {
    const tbody = document.getElementById(`${id}-body`);
    if (tbody) tbody.innerHTML = sorted.map(({ record: r, tag }) => buildTableRow(r, dataType, tag, isShared(r, dataType))).join('');
  } else {
    const wrap = document.getElementById(`${id}-wrap`);
    if (wrap) wrap.innerHTML = sorted.map(({ record: r, tag }) => buildCard(r, dataType, tag, isShared(r, dataType))).join('');
  }
}

// ── Field helper ──────────────────────────────────────────────────────────────

function field(label, value) {
  if (!value && value !== 0) return '';
  return `<div class="conn-field"><span class="conn-label">${label}</span><span class="conn-value">${value}</span></div>`;
}

// ── Anchor card ───────────────────────────────────────────────────────────────

function buildAnchorCard() {
  const r = anchor, type = anchorType;
  const name = type === 'article'  ? (r.article_title || '—')
             : type === 'location' ? (r.location_entry || '—')
             : (r.standardised_name || r.person_entry || '—');
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

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCard(r, dataType, proximityTag, shared) {
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
  const proximityHtml = proximityTag ? `<div class="proximity-tag">📍 ${proximityTag}</div>` : '';
  const sharedBanner  = shared ? `<div class="shared-banner">★ Shared name</div>` : '';
  return `<div class="conn-card conn-${dataType}${shared ? ' conn-shared' : ''}">
    <div class="conn-card-hdr conn-hdr-${dataType}">
      <span class="conn-type-badge">${dataType.charAt(0).toUpperCase() + dataType.slice(1)}</span>
      <span class="conn-card-title">${title}</span>
    </div>
    <div class="conn-card-body">${proximityHtml}${sharedBanner}${fields}</div>
  </div>`;
}

// ── Table row builder ─────────────────────────────────────────────────────────

function buildTableRow(r, dataType, proximityTag, shared) {
  const sharedCls  = shared ? ' class="shared-row"' : '';
  const sharedStar = shared ? '★ ' : '';
  const typeLabel  = dataType.charAt(0).toUpperCase() + dataType.slice(1);
  const proximity  = proximityTag ? `<span class="proximity-tag">📍 ${proximityTag}</span>` : '';

  let name = '', detail = '';
  if (dataType === 'article') {
    name   = r.article_title || '';
    detail = r.article_type  || '';
  } else if (dataType === 'location') {
    name   = r.location_entry        || '';
    detail = r.location_standardised || '';
  } else {
    name   = r.standardised_name || r.person_entry || '';
    detail = [r.role, r.associated_organisation].filter(Boolean).join(' · ');
  }

  return `<tr${sharedCls}>
    <td>${sharedStar}${name}</td>
    <td>${typeLabel}</td>
    <td>${detail}</td>
    <td>${r.page_number  || ''}</td>
    <td>${r.date         || ''}</td>
    <td>${r.volume_issue || ''}</td>
    <td>${r.filename     || ''}</td>
    <td>${proximity}</td>
  </tr>`;
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadAll() {
  document.getElementById('loading-bar').style.display = 'block';
  document.getElementById('loading-status').textContent = 'Loading data…';

  const [articleArrays, locationArrays, personArrays] = await Promise.all([
    Promise.all(ARTICLE_FILES.map(loadFile)),
    Promise.all(LOCATION_FILES.map(loadFile)),
    Promise.all(PERSON_FILES.map(loadFile)),
  ]);

  DB.articles  = articleArrays.flat();
  DB.locations = locationArrays.flat();
  DB.persons   = personArrays.flat();

  document.getElementById('loading-status').textContent = 'Building indexes…';

  buildIndex(DB.articles,  DB.articlesByFile,  DB.articlesByKey);
  buildIndex(DB.locations, DB.locationsByFile, DB.locationsByKey);
  buildIndex(DB.persons,   DB.personsByFile,   DB.personsByKey);
  buildPageRegistry();
  buildSearchIndexes();

  document.getElementById('dataset-meta').textContent =
    `${DB.articles.length.toLocaleString()} articles · ${DB.locations.length.toLocaleString()} locations · ${DB.persons.length.toLocaleString()} persons`;

  document.getElementById('loading-bar').style.display  = 'none';
  document.getElementById('loading-status').textContent  = '';
  document.getElementById('search-area').style.display   = 'block';
  document.getElementById('view-toggle').style.display   = 'flex';

  attachDropdown();
  attachViewToggle();
}

loadAll().catch(err => {
  console.error('Failed to load data', err);
  document.getElementById('loading-status').textContent = 'Error loading data — check the assets/data_date/ folder is present.';
});
