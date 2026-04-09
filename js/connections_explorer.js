// connections_explorer.js
// Loads articles, locations and persons JSON files, then finds connections
// between records that share the same filename OR same page_number + date.
// Nearby-page connections (±2 pages) are also surfaced and flagged.

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

let DB = {
  articles:  [],
  locations: [],
  persons:   [],
  // indexes built after load
  articlesByFile:  {},  // filename -> [records]
  articlesByKey:   {},  // "date|page" -> [records]
  locationsByFile: {},
  locationsByKey:  {},
  personsByFile:   {},
  personsByKey:    {},
  // ordered page registry: [{ filename, page_number (int), date }, ...]
  pageRegistry: [],
};

let selectedArticle = null; // the chosen anchor article record

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

function pageKey(date, page) {
  return `${date||''}|${page||''}`;
}

function buildIndex(records, byFile, byKey) {
  records.forEach(r => {
    const fn = r.filename || '';
    if (fn) {
      if (!byFile[fn]) byFile[fn] = [];
      byFile[fn].push(r);
    }
    const k = pageKey(r.date, r.page_number);
    if (k !== '|') {
      if (!byKey[k]) byKey[k] = [];
      byKey[k].push(r);
    }
  });
}

// Build a sorted list of distinct (filename, page_number, date) tuples
// so we can find ±2 page neighbours.
function buildPageRegistry() {
  const seen = new Set();
  const all  = [...DB.articles, ...DB.locations, ...DB.persons];
  all.forEach(r => {
    const fn  = r.filename || '';
    const pg  = parseInt(r.page_number, 10);
    const dt  = r.date || '';
    if (!fn || isNaN(pg)) return;
    const key = `${fn}|${pg}|${dt}`;
    if (!seen.has(key)) {
      seen.add(key);
      DB.pageRegistry.push({ filename: fn, page: pg, date: dt });
    }
  });
  // Sort by date then by filename then by page
  DB.pageRegistry.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return  1;
    if (a.filename < b.filename) return -1;
    if (a.filename > b.filename) return  1;
    return a.page - b.page;
  });
}

// Given an anchor article, find nearby pages (±2) in the registry
function nearbyPages(anchor, radius = 2) {
  const anchorFn  = anchor.filename || '';
  const anchorPg  = parseInt(anchor.page_number, 10);

  // Find index in registry where filename matches and page is closest
  const idx = DB.pageRegistry.findIndex(
    r => r.filename === anchorFn && r.page === anchorPg
  );
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

// ── Search / autocomplete ─────────────────────────────────────────────────────

let searchIndex = []; // {label, record} — deduplicated article titles

function buildSearchIndex() {
  const seen = new Set();
  DB.articles.forEach(r => {
    const t = (r.article_title || '').trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    searchIndex.push({ label: t, record: r });
  });
  searchIndex.sort((a, b) => a.label.localeCompare(b.label));
}

function getMatches(q) {
  if (!q || q.length < 2) return { sw: [], inc: [] };
  const ql = q.toLowerCase();
  const sw  = searchIndex.filter(e => e.label.toLowerCase().startsWith(ql)).slice(0, 60);
  const inc = searchIndex.filter(e => !e.label.toLowerCase().startsWith(ql) && e.label.toLowerCase().includes(ql)).slice(0, 60);
  return { sw, inc };
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function attachDropdown() {
  const input = document.getElementById('article-search');
  const dd    = document.getElementById('article-dd');
  let active  = -1;

  function items() { return [...dd.querySelectorAll('.dd-item')]; }

  function show(q) {
    const { sw, inc } = getMatches(q);
    dd.innerHTML = ''; active = -1;
    if (!sw.length && !inc.length) { dd.style.display = 'none'; return; }

    function addGroup(label) {
      const div = document.createElement('div');
      div.className = 'dd-group-label';
      div.textContent = label;
      dd.appendChild(div);
    }
    function addItem(entry) {
      const div = document.createElement('div');
      div.className = 'dd-item';
      div.innerHTML = `<span class="dd-title">${entry.label}</span>
        <span class="dd-meta">${entry.record.date || ''} · ${entry.record.volume_issue || ''}</span>`;
      div.addEventListener('mousedown', e => { e.preventDefault(); pickArticle(entry.record); });
      dd.appendChild(div);
    }

    if (sw.length) { if (inc.length) addGroup(`Starting with "${q}"`); sw.forEach(addItem); }
    if (inc.length) { if (sw.length) addGroup(`Also containing "${q}"`); inc.forEach(addItem); }
    dd.style.display = 'block';
  }

  input.addEventListener('input',  () => show(input.value));
  input.addEventListener('focus',  () => { if (input.value.length >= 2) show(input.value); });
  input.addEventListener('blur',   () => setTimeout(() => { dd.style.display = 'none'; }, 150));
  input.addEventListener('keydown', e => {
    const its = items();
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, its.length - 1); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'Enter' && active >= 0) { const t = its[active].querySelector('.dd-title'); if (t) pickArticle(searchIndex.find(e => e.label === t.textContent)?.record); }
    else if (e.key === 'Escape') { dd.style.display = 'none'; }
  });
}

// ── Core: pick article & render connections ───────────────────────────────────

function pickArticle(record) {
  if (!record) return;
  selectedArticle = record;

  const input = document.getElementById('article-search');
  input.value = record.article_title || '';
  document.getElementById('article-dd').style.display = 'none';

  renderConnections();
}

function renderConnections() {
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('content').style.display     = 'block';

  const anchor = selectedArticle;

  // ── Anchor card ────────────────────────────────────────────────────────────
  document.getElementById('anchor-card').innerHTML = buildArticleCard(anchor, 'anchor');

  // ── Direct connections (same filename) ────────────────────────────────────
  const sameFile = anchor.filename || '';
  const directArticles  = (DB.articlesByFile[sameFile]  || []).filter(r => r !== anchor);
  const directLocations = (DB.locationsByFile[sameFile] || []);
  const directPersons   = (DB.personsByFile[sameFile]   || []);

  // Also same page_number + date (may overlap with filename match)
  const dpk = pageKey(anchor.date, anchor.page_number);
  const pgArticles  = (DB.articlesByKey[dpk]  || []).filter(r => r !== anchor && !directArticles.includes(r));
  const pgLocations = (DB.locationsByKey[dpk] || []).filter(r => !directLocations.includes(r));
  const pgPersons   = (DB.personsByKey[dpk]   || []).filter(r => !directPersons.includes(r));

  const allDirectArticles  = [...directArticles,  ...pgArticles];
  const allDirectLocations = [...directLocations, ...pgLocations];
  const allDirectPersons   = [...directPersons,   ...pgPersons];

  renderSection('direct-articles-body',  allDirectArticles,  'article',  false);
  renderSection('direct-locations-body', allDirectLocations, 'location', false);
  renderSection('direct-persons-body',   allDirectPersons,   'person',   false);

  updateCount('direct-articles-count',  allDirectArticles.length);
  updateCount('direct-locations-count', allDirectLocations.length);
  updateCount('direct-persons-count',   allDirectPersons.length);

  // ── Nearby connections (±2 pages) ─────────────────────────────────────────
  const nearby = nearbyPages(anchor, 2);
  const nearbyArticles  = [];
  const nearbyLocations = [];
  const nearbyPersons   = [];

  nearby.forEach(np => {
    const nfn  = np.filename;
    const nkey = pageKey(np.date, np.page);
    const tag  = np.offset < 0 ? `${Math.abs(np.offset)} page${Math.abs(np.offset)>1?'s':''} before` : `${np.offset} page${np.offset>1?'s':''} after`;

    function collect(byFile, byKey, target, seenDirect) {
      const fromFile = (byFile[nfn] || []).filter(r => !seenDirect.includes(r));
      const fromKey  = (byKey[nkey]  || []).filter(r => !seenDirect.includes(r) && !fromFile.includes(r));
      [...fromFile, ...fromKey].forEach(r => target.push({ record: r, tag }));
    }

    collect(DB.articlesByFile,  DB.articlesByKey,  nearbyArticles,  [...allDirectArticles,  anchor]);
    collect(DB.locationsByFile, DB.locationsByKey, nearbyLocations, allDirectLocations);
    collect(DB.personsByFile,   DB.personsByKey,   nearbyPersons,   allDirectPersons);
  });

  renderNearbySection('nearby-articles-body',  nearbyArticles,  'article');
  renderNearbySection('nearby-locations-body', nearbyLocations, 'location');
  renderNearbySection('nearby-persons-body',   nearbyPersons,   'person');

  updateCount('nearby-articles-count',  nearbyArticles.length);
  updateCount('nearby-locations-count', nearbyLocations.length);
  updateCount('nearby-persons-count',   nearbyPersons.length);

  // Show/hide empty states
  toggleEmpty('direct-articles-empty',  allDirectArticles.length  === 0);
  toggleEmpty('direct-locations-empty', allDirectLocations.length === 0);
  toggleEmpty('direct-persons-empty',   allDirectPersons.length   === 0);
  toggleEmpty('nearby-articles-empty',  nearbyArticles.length     === 0);
  toggleEmpty('nearby-locations-empty', nearbyLocations.length    === 0);
  toggleEmpty('nearby-persons-empty',   nearbyPersons.length      === 0);
}

function updateCount(id, n) {
  const el = document.getElementById(id);
  if (el) el.textContent = n;
}

function toggleEmpty(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? 'block' : 'none';
}

// ── Card builders ─────────────────────────────────────────────────────────────

function field(label, value) {
  if (!value && value !== 0) return '';
  return `<div class="conn-field"><span class="conn-label">${label}</span><span class="conn-value">${value}</span></div>`;
}

function buildArticleCard(r, cls = '') {
  return `<div class="conn-card conn-article ${cls}">
    <div class="conn-card-hdr conn-hdr-article">
      <span class="conn-type-badge">Article</span>
      <span class="conn-card-title">${r.article_title || '—'}</span>
    </div>
    <div class="conn-card-body">
      ${field('Type',   r.article_type)}
      ${field('Page',   r.page_number)}
      ${field('Date',   r.date)}
      ${field('Vol/Issue', r.volume_issue)}
      ${field('File',   r.filename)}
    </div>
  </div>`;
}

function buildLocationCard(r) {
  return `<div class="conn-card conn-location">
    <div class="conn-card-hdr conn-hdr-location">
      <span class="conn-type-badge">Location</span>
      <span class="conn-card-title">${r.location_entry || '—'}</span>
    </div>
    <div class="conn-card-body">
      ${field('Standardised', r.location_standardised)}
      ${field('Context',      r.brief_context)}
      ${field('Article',      r.article_title)}
      ${field('Page',         r.page_number)}
      ${field('Date',         r.date)}
      ${field('Vol/Issue',    r.volume_issue)}
      ${field('File',         r.filename)}
      ${r.brief_extract ? `<details class="conn-extract"><summary>View extract</summary><p>${r.brief_extract}</p></details>` : ''}
    </div>
  </div>`;
}

function buildPersonCard(r) {
  return `<div class="conn-card conn-person">
    <div class="conn-card-hdr conn-hdr-person">
      <span class="conn-type-badge">Person</span>
      <span class="conn-card-title">${r.standardised_name || r.person_entry || '—'}</span>
    </div>
    <div class="conn-card-body">
      ${field('As appears',  r.person_entry)}
      ${field('Title',       r.title)}
      ${field('Role',        r.role)}
      ${field('Organisation',r.associated_organisation)}
      ${field('Gender',      r.gender)}
      ${field('Relation',    r.relation)}
      ${field('Depicted',    r.depicted)}
      ${field('Article',     r.article_title)}
      ${field('Page',        r.page_number)}
      ${field('Date',        r.date)}
      ${field('Vol/Issue',   r.volume_issue)}
      ${field('File',        r.filename)}
      ${r.brief_extract ? `<details class="conn-extract"><summary>View extract</summary><p>${r.brief_extract}</p></details>` : ''}
    </div>
  </div>`;
}

function buildCard(r, type) {
  if (type === 'article')  return buildArticleCard(r);
  if (type === 'location') return buildLocationCard(r);
  if (type === 'person')   return buildPersonCard(r);
  return '';
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderSection(bodyId, records, type, nearby) {
  const el = document.getElementById(bodyId);
  if (!el) return;
  el.innerHTML = records.map(r => buildCard(r, type)).join('');
}

function renderNearbySection(bodyId, items, type) {
  const el = document.getElementById(bodyId);
  if (!el) return;
  el.innerHTML = items.map(({ record, tag }) => {
    const card = buildCard(record, type);
    // inject the proximity tag
    return card.replace('class="conn-card-body"',
      `class="conn-card-body"><div class="proximity-tag">📍 ${tag}</div>`);
  }).join('');
}

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadAll() {
  document.getElementById('loading-bar').style.display = 'block';
  document.getElementById('loading-status').textContent = 'Loading articles…';

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
  buildSearchIndex();

  const nA = DB.articles.length;
  const nL = DB.locations.length;
  const nP = DB.persons.length;

  document.getElementById('dataset-meta').textContent =
    `${nA.toLocaleString()} articles · ${nL.toLocaleString()} locations · ${nP.toLocaleString()} persons`;

  document.getElementById('loading-bar').style.display = 'none';
  document.getElementById('loading-status').textContent = '';
  document.getElementById('search-area').style.display = 'block';

  attachDropdown();
}

loadAll().catch(err => {
  console.error('Failed to load data', err);
  document.getElementById('loading-status').textContent = 'Error loading data — check the assets/data_date/ folder is present.';
});
