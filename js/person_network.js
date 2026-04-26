// person_network.js — v2
// Adds per-section filter bars (text + year range) that live-update both
// the table and the charts without re-computing the base data associations.

// ── Data paths ────────────────────────────────────────────────────────────────

const BASE = 'assets/data_date/';

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

// ── Chart palette ─────────────────────────────────────────────────────────────

const PALETTE = [
  '#1565c0','#c62828','#2e7d32','#6a1b9a',
  '#e65100','#00695c','#ad1457','#4527a0',
  '#558b2f','#0277bd',
];
const DASH_STYLES = [ [], [6,3], [3,3], [8,2,2,2], [10,3] ];

function color(i)     { return PALETTE[i % PALETTE.length]; }
function dashStyle(i) { return DASH_STYLES[i % DASH_STYLES.length]; }

// ── Module state ──────────────────────────────────────────────────────────────

let allPersonRecords   = [];
let allLocationRecords = [];

let personsByName   = {};
let personsByFile   = {};
let locationsByFile = {};
let locationsByStd  = {};

let allYears = [];
let yearMin, yearMax;

let personSearchIndex = [];
let anchorName = null;

// Full unfiltered result arrays — computed once per anchor selection
let _allLocEntries = [];
let _allCoEntries  = [];

let charts = {};

const expandState = {};
const EXPAND_INITIAL = 15;
const EXPAND_STEP    = 15;

// Filter state per section
const filterState = {
  loc: { q: '', yearFrom: '', yearTo: '' },
  co:  { q: '', yearFrom: '', yearTo: '' },
};

let drawerOpen = false;

// ── Utilities ─────────────────────────────────────────────────────────────────

function cleanJSON(t) { return t.replace(/:\s*NaN\s*([,\}])/g, ': null$1'); }

function loadFile(url) {
  return fetch(url).then(r => r.text()).then(t => JSON.parse(cleanJSON(t))).catch(() => []);
}

function short(s, n = 45) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '\u2026';
}

function roll(arr, w) {
  return arr.map((_, i) => {
    const sl = arr.slice(Math.max(0, i - Math.floor(w / 2)), i + Math.ceil(w / 2));
    const vs = sl.filter(v => v != null && !isNaN(v));
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  });
}

// Safely escape HTML, then wrap matched query text in <mark>
function highlight(text, q) {
  const escaped = (text || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  if (!q || !q.trim()) return escaped;
  const re = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return escaped.replace(re, m => `<mark class="filter-hl">${m}</mark>`);
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function mkChart(id, cfg) {
  destroyChart(id);
  const c = document.getElementById(id);
  if (!c) return;
  charts[id] = new Chart(c, cfg);
}

function baseOpts(extra = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false },
      ...extra.plugins,
    },
    scales: {
      x: {
        ticks: { color: '#73726c', font: { size: 9.5, family: 'Georgia, serif' }, maxTicksLimit: 15 },
        grid: { color: 'rgba(0,0,0,0.04)' },
        border: { display: false },
        ...extra.xScale,
      },
      y: {
        ticks: { color: '#73726c', font: { size: 9.5, family: 'Georgia, serif' } },
        grid: { color: 'rgba(0,0,0,0.04)' },
        border: { display: false },
        ...extra.yScale,
      },
    },
    ...extra,
  };
}

// ── Filter logic ──────────────────────────────────────────────────────────────

// Returns entries from `all` that pass the current filter for `section`.
// Text match is against the primary name (e.std for loc, e.name for co).
// Year filter keeps entries that have co-mentions within [yearFrom, yearTo].

function applyFilter(all, section) {
  const { q, yearFrom, yearTo } = filterState[section];
  const ql = q.trim().toLowerCase();
  const yf = yearFrom ? +yearFrom : null;
  const yt = yearTo   ? +yearTo   : null;

  return all.filter(e => {
    const primaryName = section === 'loc' ? (e.std || '') : (e.name || '');
    if (ql && !primaryName.toLowerCase().includes(ql)) return false;

    if (yf !== null || yt !== null) {
      const inRange = Object.keys(e.yearMap).some(y => {
        const yr = +y;
        return (yf === null || yr >= yf) && (yt === null || yr <= yt) && e.yearMap[y] > 0;
      });
      if (!inRange) return false;
    }

    return true;
  });
}

function isFiltered(section) {
  const { q, yearFrom, yearTo } = filterState[section];
  return !!(q.trim() || yearFrom || yearTo);
}

function updateFilterStatus(section, shown, total) {
  const el = document.getElementById(`${section}-filter-status`);
  if (!el) return;
  if (isFiltered(section)) {
    el.textContent = `${shown.toLocaleString()} of ${total.toLocaleString()} match${shown !== 1 ? 'es' : ''}`;
    el.style.display = 'inline';
    el.className = shown === 0 ? 'filter-status filter-status-none' : 'filter-status';
  } else {
    el.textContent  = '';
    el.style.display = 'none';
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadAll() {
  setStatus('Loading person records\u2026');
  const pArrays = await Promise.all(PERSON_FILES.map(loadFile));
  allPersonRecords = pArrays.flat();

  setStatus('Loading location records\u2026');
  const lArrays = await Promise.all(LOCATION_FILES.map(loadFile));
  allLocationRecords = lArrays.flat();

  setStatus('Building indexes\u2026');
  buildIndexes();

  const years = allPersonRecords.map(r => r.date ? +r.date.slice(0, 4) : null).filter(Boolean);
  yearMin = Math.min(...years);
  yearMax = Math.max(...years);
  allYears = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i);

  document.getElementById('header-meta').textContent =
    `${yearMin}\u2013${yearMax} \u00b7 ${allPersonRecords.length.toLocaleString()} person records \u00b7 ` +
    `${Object.keys(personsByName).length.toLocaleString()} distinct persons \u00b7 ` +
    `${allLocationRecords.length.toLocaleString()} location records`;

  setStatus('');
  document.getElementById('loading-bar').style.display = 'none';
  document.getElementById('search-area').style.display = 'block';

  attachSearchDropdown();
  attachDrawer();
  attachFilterListeners();
}

function setStatus(msg) {
  document.getElementById('loading-status').textContent = msg;
}

function buildIndexes() {
  personsByName = {};
  allPersonRecords.forEach(r => {
    const name = (r.standardised_name || r.person_entry || '').trim();
    if (!name) return;
    if (!personsByName[name]) personsByName[name] = [];
    personsByName[name].push(r);
  });

  personsByFile = {};
  allPersonRecords.forEach(r => {
    const fn = r.filename || '';
    if (!fn) return;
    if (!personsByFile[fn]) personsByFile[fn] = [];
    personsByFile[fn].push(r);
  });

  locationsByFile = {};
  allLocationRecords.forEach(r => {
    const fn = r.filename || '';
    if (!fn) return;
    if (!locationsByFile[fn]) locationsByFile[fn] = [];
    locationsByFile[fn].push(r);
  });

  locationsByStd = {};
  allLocationRecords.forEach(r => {
    const std = (r.location_standardised || r.location_entry || '').trim();
    if (!std) return;
    if (!locationsByStd[std]) locationsByStd[std] = [];
    locationsByStd[std].push(r);
  });

  const seen = new Set();
  allPersonRecords.forEach(r => {
    const name = (r.standardised_name || r.person_entry || '').trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    const recs  = personsByName[name];
    const roles = [...new Set(recs.map(x => x.role).filter(Boolean))].slice(0, 2).join(', ');
    const orgs  = [...new Set(recs.map(x => x.associated_organisation).filter(Boolean))].slice(0, 1).join('');
    personSearchIndex.push({
      label:    name,
      subLabel: [roles, orgs, `${recs.length} mention${recs.length !== 1 ? 's' : ''}`].filter(Boolean).join(' \u00b7 '),
    });
  });
  personSearchIndex.sort((a, b) => a.label.localeCompare(b.label));
}

// ── Person search dropdown ────────────────────────────────────────────────────

function attachSearchDropdown() {
  const input = document.getElementById('person-search');
  const dd    = document.getElementById('person-dd');
  let active  = -1;

  function getMatches(q) {
    if (!q || q.length < 1) return { sw: [], inc: [] };
    const ql = q.toLowerCase();
    return {
      sw:  personSearchIndex.filter(e =>  e.label.toLowerCase().startsWith(ql)).slice(0, 60),
      inc: personSearchIndex.filter(e => !e.label.toLowerCase().startsWith(ql) && e.label.toLowerCase().includes(ql)).slice(0, 40),
    };
  }

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
      div.innerHTML = `<span class="dd-title">${entry.label}</span><span class="dd-meta">${entry.subLabel}</span>`;
      div.addEventListener('mousedown', e => { e.preventDefault(); selectPerson(entry.label); });
      dd.appendChild(div);
    }
    if (sw.length)  { if (inc.length) addGroup(`Starting with "${q}"`); sw.forEach(addItem); }
    if (inc.length) { if (sw.length)  addGroup(`Also containing "${q}"`); inc.forEach(addItem); }
    dd.style.display = 'block';
  }

  function items() { return [...dd.querySelectorAll('.dd-item')]; }

  input.addEventListener('input',   () => show(input.value));
  input.addEventListener('focus',   () => { if (input.value.length >= 1) show(input.value); });
  input.addEventListener('blur',    () => setTimeout(() => { dd.style.display = 'none'; }, 150));
  input.addEventListener('keydown', e => {
    const its = items();
    if      (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, its.length - 1); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); active = Math.max(active - 1, 0); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'Enter' && active >= 0) { its[active].dispatchEvent(new MouseEvent('mousedown')); }
    else if (e.key === 'Escape') { dd.style.display = 'none'; input.blur(); }
  });
}

// ── Filter bar listeners ──────────────────────────────────────────────────────

function attachFilterListeners() {
  // Debounce helper for text inputs
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // Location filters
  document.getElementById('loc-filter-q').addEventListener('input', debounce(function() {
    filterState.loc.q = this.value;
    expandState.loc = EXPAND_INITIAL;
    reRenderLocationFiltered();
  }, 120));

  document.getElementById('loc-filter-from').addEventListener('change', function() {
    filterState.loc.yearFrom = this.value;
    expandState.loc = EXPAND_INITIAL;
    reRenderLocationFiltered();
  });
  document.getElementById('loc-filter-to').addEventListener('change', function() {
    filterState.loc.yearTo = this.value;
    expandState.loc = EXPAND_INITIAL;
    reRenderLocationFiltered();
  });
  document.getElementById('loc-filter-clear').addEventListener('click', () => {
    filterState.loc = { q: '', yearFrom: '', yearTo: '' };
    document.getElementById('loc-filter-q').value    = '';
    document.getElementById('loc-filter-from').value = '';
    document.getElementById('loc-filter-to').value   = '';
    expandState.loc = EXPAND_INITIAL;
    reRenderLocationFiltered();
  });

  // Co-person filters
  document.getElementById('co-filter-q').addEventListener('input', debounce(function() {
    filterState.co.q = this.value;
    expandState.co = EXPAND_INITIAL;
    reRenderCoFiltered();
  }, 120));

  document.getElementById('co-filter-from').addEventListener('change', function() {
    filterState.co.yearFrom = this.value;
    expandState.co = EXPAND_INITIAL;
    reRenderCoFiltered();
  });
  document.getElementById('co-filter-to').addEventListener('change', function() {
    filterState.co.yearTo = this.value;
    expandState.co = EXPAND_INITIAL;
    reRenderCoFiltered();
  });
  document.getElementById('co-filter-clear').addEventListener('click', () => {
    filterState.co = { q: '', yearFrom: '', yearTo: '' };
    document.getElementById('co-filter-q').value    = '';
    document.getElementById('co-filter-from').value = '';
    document.getElementById('co-filter-to').value   = '';
    expandState.co = EXPAND_INITIAL;
    reRenderCoFiltered();
  });
}

// Re-render location section from filtered entries (no data recomputation)
function reRenderLocationFiltered() {
  if (!_allLocEntries.length) return;
  const filtered = applyFilter(_allLocEntries, 'loc');
  updateFilterStatus('loc', filtered.length, _allLocEntries.length);
  renderLocationBarChart(filtered);
  renderLocationTrendChart(filtered.slice(0, 5));
  renderLocationTable(filtered);
}

function reRenderCoFiltered() {
  if (!_allCoEntries.length) return;
  const filtered = applyFilter(_allCoEntries, 'co');
  updateFilterStatus('co', filtered.length, _allCoEntries.length);
  renderPersonBarChart(filtered);
  renderPersonTrendChart(filtered.slice(0, 5));
  renderPersonTable(filtered);
}

// ── Anchor selection ──────────────────────────────────────────────────────────

function selectPerson(name) {
  anchorName = name;
  document.getElementById('person-search').value     = name;
  document.getElementById('person-dd').style.display = 'none';

  // Reset filter state
  filterState.loc = { q: '', yearFrom: '', yearTo: '' };
  filterState.co  = { q: '', yearFrom: '', yearTo: '' };
  ['loc-filter-q','loc-filter-from','loc-filter-to',
   'co-filter-q', 'co-filter-from', 'co-filter-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['loc-filter-status','co-filter-status'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
  Object.keys(expandState).forEach(k => delete expandState[k]);
  closeDrawer();

  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('content').style.display     = 'block';

  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Master render ─────────────────────────────────────────────────────────────

function renderAll() {
  const anchorRecs  = personsByName[anchorName] || [];
  const anchorFiles = new Set(anchorRecs.map(r => r.filename).filter(Boolean));

  // Location associations
  const locMap = {};
  anchorFiles.forEach(fn => {
    const locs      = locationsByFile[fn] || [];
    const pRecsHere = (personsByFile[fn] || []).filter(r =>
      (r.standardised_name || r.person_entry || '').trim() === anchorName
    );
    locs.forEach(lr => {
      const std = (lr.location_standardised || lr.location_entry || '').trim();
      if (!std) return;
      if (!locMap[std]) locMap[std] = { count: 0, yearMap: {}, personRecs: [], locRecs: [], _seenFiles: new Set() };
      locMap[std].count++;
      const yr = lr.date ? +lr.date.slice(0, 4) : null;
      if (yr) locMap[std].yearMap[yr] = (locMap[std].yearMap[yr] || 0) + 1;
      locMap[std].locRecs.push(lr);
      if (!locMap[std]._seenFiles.has(fn)) {
        locMap[std]._seenFiles.add(fn);
        locMap[std].personRecs.push(...pRecsHere);
      }
    });
  });

  _allLocEntries = Object.entries(locMap)
    .map(([std, data]) => ({ std, ...data }))
    .sort((a, b) => b.count - a.count);

  // Co-person associations
  const coMap = {};
  anchorFiles.forEach(fn => {
    const others    = (personsByFile[fn] || []).filter(r =>
      (r.standardised_name || r.person_entry || '').trim() !== anchorName
    );
    const pRecsHere = (personsByFile[fn] || []).filter(r =>
      (r.standardised_name || r.person_entry || '').trim() === anchorName
    );
    others.forEach(or => {
      const coName = (or.standardised_name || or.person_entry || '').trim();
      if (!coName) return;
      if (!coMap[coName]) coMap[coName] = { count: 0, yearMap: {}, anchorRecs: [], coRecs: [], _seenFiles: new Set() };
      coMap[coName].count++;
      const yr = or.date ? +or.date.slice(0, 4) : null;
      if (yr) coMap[coName].yearMap[yr] = (coMap[coName].yearMap[yr] || 0) + 1;
      coMap[coName].coRecs.push(or);
      if (!coMap[coName]._seenFiles.has(fn)) {
        coMap[coName]._seenFiles.add(fn);
        coMap[coName].anchorRecs.push(...pRecsHere);
      }
    });
  });

  _allCoEntries = Object.entries(coMap)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.count - a.count);

  // Set min/max on year pickers to match this person's actual data span
  ['loc-filter-from','loc-filter-to','co-filter-from','co-filter-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.min = yearMin; el.max = yearMax; el.placeholder = id.endsWith('from') ? yearMin : yearMax; }
  });

  renderAnchorCard(anchorRecs);
  renderLocationSection(_allLocEntries);
  renderPersonSection(_allCoEntries);
}

// ── Anchor card ───────────────────────────────────────────────────────────────

function renderAnchorCard(recs) {
  const genders  = [...new Set(recs.map(r => r.gender).filter(Boolean))];
  const roles    = [...new Set(recs.map(r => r.role).filter(Boolean))];
  const orgs     = [...new Set(recs.map(r => r.associated_organisation).filter(Boolean))];
  const years    = recs.map(r => r.date ? +r.date.slice(0, 4) : null).filter(Boolean);
  const first    = years.length ? Math.min(...years) : '\u2014';
  const last     = years.length ? Math.max(...years) : '\u2014';
  const depicted = recs.filter(r => r.depicted === 'Yes').length;

  function row(k, v) {
    return v ? `<div class="anchor-row"><span class="anchor-key">${k}</span><span class="anchor-val">${v}</span></div>` : '';
  }
  document.getElementById('anchor-card').innerHTML = `
    <div class="anchor-inner">
      <div class="anchor-name">${anchorName}</div>
      <div class="anchor-meta">
        ${row('Total mentions', recs.length.toLocaleString())}
        ${row('Period', first !== '\u2014' ? `${first}\u2013${last}` : '\u2014')}
        ${row('Gender', genders.join(', ') || '\u2014')}
        ${row('Depicted', depicted > 0 ? `Yes (${depicted}\u00d7)` : 'Not depicted')}
        ${row('Roles', roles.slice(0, 4).join('; ') || '\u2014')}
        ${row('Organisations', orgs.slice(0, 3).join('; ') || '\u2014')}
      </div>
    </div>`;
}

// ── Section A: Locations ──────────────────────────────────────────────────────

function renderLocationSection(entries) {
  const total = entries.length;
  document.getElementById('loc-total').textContent =
    `${total.toLocaleString()} distinct location${total !== 1 ? 's' : ''}`;

  if (!total) {
    document.getElementById('loc-empty').style.display   = 'block';
    document.getElementById('loc-content').style.display = 'none';
    document.getElementById('loc-filter-bar').style.display = 'none';
    return;
  }
  document.getElementById('loc-empty').style.display      = 'none';
  document.getElementById('loc-content').style.display    = 'block';
  document.getElementById('loc-filter-bar').style.display = 'flex';
  updateFilterStatus('loc', entries.length, _allLocEntries.length);

  renderLocationBarChart(entries);
  renderLocationTrendChart(entries.slice(0, 5));
  renderLocationTable(entries);
}

function renderLocationBarChart(entries) {
  const top = entries.slice(0, 20);
  destroyChart('ch-loc-bar');
  const c = document.getElementById('ch-loc-bar');
  if (!c) return;
  charts['ch-loc-bar'] = new Chart(c, {
    type: 'bar',
    data: {
      labels: top.map(e => short(e.std, 30)),
      datasets: [{
        label: 'Co-mentions',
        data: top.map(e => e.count),
        backgroundColor: top.map((_, i) => color(i) + 'cc'),
        borderColor: top.map((_, i) => color(i)),
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      ...baseOpts(),
      indexAxis: 'y',
      scales: {
        x: { ticks: { color: '#73726c', font: { size: 9.5, family: 'Georgia, serif' } }, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false } },
        y: { ticks: { color: '#2c2c2c', font: { size: 9, family: 'Georgia, serif' } }, grid: { display: false }, border: { display: false } },
      },
    },
  });
}

function renderLocationTrendChart(topEntries) {
  const datasets = topEntries.map((e, i) => ({
    label:       short(e.std, 30),
    data:        roll(allYears.map(y => e.yearMap[y] || 0), 3),
    borderColor: color(i),
    borderDash:  dashStyle(i),
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    tension:     0.4,
    fill:        false,
  }));

  const legendEl = document.getElementById('loc-trend-legend');
  if (legendEl) {
    legendEl.innerHTML = topEntries.map((e, i) => {
      const d = dashStyle(i);
      const css = d.length
        ? `background:repeating-linear-gradient(90deg,${color(i)} 0,${color(i)} ${d[0]}px,transparent ${d[0]}px,transparent ${d[0]+(d[1]||4)}px)`
        : `background:${color(i)}`;
      return `<span class="legend-item"><span class="legend-line" style="${css}"></span>${short(e.std, 35)}</span>`;
    }).join('');
  }

  destroyChart('ch-loc-trend');
  const c = document.getElementById('ch-loc-trend');
  if (!c) return;
  charts['ch-loc-trend'] = new Chart(c, {
    type: 'line',
    data: { labels: allYears, datasets },
    options: baseOpts(),
  });
}

function renderLocationTable(entries) {
  renderExpandableSection('loc-table', entries, (e, i) => buildLocRow(e, i), 'loc');
}

function buildLocRow(e, rowIdx) {
  const years    = Object.keys(e.yearMap).map(Number);
  const yearRange = years.length ? `${Math.min(...years)}\u2013${Math.max(...years)}` : '\u2014';
  const peakYear  = Object.entries(e.yearMap).sort((a, b) => b[1] - a[1])[0];
  return `<tr class="data-row" data-section="loc" data-idx="${rowIdx}" title="Click to view individual entries">
    <td class="td-name">${highlight(e.std, filterState.loc.q)}</td>
    <td class="td-count">${e.count}</td>
    <td class="td-meta">${yearRange}</td>
    <td class="td-meta">${peakYear ? `${peakYear[0]} (${peakYear[1]})` : '\u2014'}</td>
    <td class="td-drill"><span class="drill-btn">View entries \u2192</span></td>
  </tr>`;
}

// ── Section B: Co-persons ─────────────────────────────────────────────────────

function renderPersonSection(entries) {
  const total = entries.length;
  document.getElementById('co-total').textContent =
    `${total.toLocaleString()} co-mentioned person${total !== 1 ? 's' : ''}`;

  if (!total) {
    document.getElementById('co-empty').style.display   = 'block';
    document.getElementById('co-content').style.display = 'none';
    document.getElementById('co-filter-bar').style.display = 'none';
    return;
  }
  document.getElementById('co-empty').style.display      = 'none';
  document.getElementById('co-content').style.display    = 'block';
  document.getElementById('co-filter-bar').style.display = 'flex';
  updateFilterStatus('co', entries.length, _allCoEntries.length);

  renderPersonBarChart(entries);
  renderPersonTrendChart(entries.slice(0, 5));
  renderPersonTable(entries);
}

function renderPersonBarChart(entries) {
  const top = entries.slice(0, 20);
  destroyChart('ch-co-bar');
  const c = document.getElementById('ch-co-bar');
  if (!c) return;
  charts['ch-co-bar'] = new Chart(c, {
    type: 'bar',
    data: {
      labels: top.map(e => short(e.name, 30)),
      datasets: [{
        label: 'Co-mentions',
        data: top.map(e => e.count),
        backgroundColor: top.map((_, i) => color(i) + 'cc'),
        borderColor: top.map((_, i) => color(i)),
        borderWidth: 1,
        borderRadius: 2,
      }],
    },
    options: {
      ...baseOpts(),
      indexAxis: 'y',
      scales: {
        x: { ticks: { color: '#73726c', font: { size: 9.5, family: 'Georgia, serif' } }, grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false } },
        y: { ticks: { color: '#2c2c2c', font: { size: 9, family: 'Georgia, serif' } }, grid: { display: false }, border: { display: false } },
      },
    },
  });
}

function renderPersonTrendChart(topEntries) {
  const datasets = topEntries.map((e, i) => ({
    label:       short(e.name, 30),
    data:        roll(allYears.map(y => e.yearMap[y] || 0), 3),
    borderColor: color(i),
    borderDash:  dashStyle(i),
    borderWidth: 2,
    pointRadius: 2,
    pointHoverRadius: 4,
    tension:     0.4,
    fill:        false,
  }));

  const legendEl = document.getElementById('co-trend-legend');
  if (legendEl) {
    legendEl.innerHTML = topEntries.map((e, i) => {
      const d = dashStyle(i);
      const css = d.length
        ? `background:repeating-linear-gradient(90deg,${color(i)} 0,${color(i)} ${d[0]}px,transparent ${d[0]}px,transparent ${d[0]+(d[1]||4)}px)`
        : `background:${color(i)}`;
      return `<span class="legend-item"><span class="legend-line" style="${css}"></span>${short(e.name, 35)}</span>`;
    }).join('');
  }

  destroyChart('ch-co-trend');
  const c = document.getElementById('ch-co-trend');
  if (!c) return;
  charts['ch-co-trend'] = new Chart(c, {
    type: 'line',
    data: { labels: allYears, datasets },
    options: baseOpts(),
  });
}

function renderPersonTable(entries) {
  renderExpandableSection('co-table', entries, (e, i) => buildCoRow(e, i), 'co');
}

function buildCoRow(e, rowIdx) {
  const recs      = personsByName[e.name] || [];
  const roles     = [...new Set(recs.map(r => r.role).filter(Boolean))].slice(0, 2).join(', ');
  const years     = Object.keys(e.yearMap).map(Number);
  const yearRange = years.length ? `${Math.min(...years)}\u2013${Math.max(...years)}` : '\u2014';
  const peakYear  = Object.entries(e.yearMap).sort((a, b) => b[1] - a[1])[0];
  return `<tr class="data-row" data-section="co" data-idx="${rowIdx}" title="Click to view individual entries">
    <td class="td-name">${highlight(e.name, filterState.co.q)}</td>
    <td class="td-count">${e.count}</td>
    <td class="td-meta">${roles || '\u2014'}</td>
    <td class="td-meta">${yearRange}</td>
    <td class="td-meta">${peakYear ? `${peakYear[0]} (${peakYear[1]})` : '\u2014'}</td>
    <td class="td-drill"><span class="drill-btn">View entries \u2192</span></td>
  </tr>`;
}

// ── Expandable table ──────────────────────────────────────────────────────────

function renderExpandableSection(containerId, entries, rowBuilder, section) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const limit   = expandState[section] !== undefined ? expandState[section] : EXPAND_INITIAL;
  const showing = Math.min(limit, entries.length);
  const hidden  = entries.length - showing;

  window[`_entries_${section}`] = entries;

  let html = entries.slice(0, showing).map((e, i) => rowBuilder(e, i)).join('');

  if (hidden > 0) {
    html += `<tr class="expand-row-tr">
      <td colspan="10">
        <div class="expand-row-btns">
          <button class="expand-tbl-btn" onclick="expandSection('${section}', ${showing + EXPAND_STEP})">Show ${Math.min(EXPAND_STEP, hidden)} more (${hidden} remaining)</button>
          <button class="expand-tbl-btn expand-tbl-all" onclick="expandSection('${section}', ${entries.length})">Show all ${entries.length}</button>
        </div>
      </td>
    </tr>`;
  } else if (entries.length > EXPAND_INITIAL) {
    html += `<tr class="expand-row-tr">
      <td colspan="10">
        <div class="expand-row-btns">
          <button class="expand-tbl-btn expand-tbl-collapse" onclick="expandSection('${section}', ${EXPAND_INITIAL})">Collapse</button>
        </div>
      </td>
    </tr>`;
  }

  container.innerHTML = html;

  container.querySelectorAll('.data-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx  = +row.dataset.idx;
      const sec  = row.dataset.section;
      const ents = window[`_entries_${sec}`];
      if (ents && ents[idx]) openDrawer(ents[idx], sec);
    });
  });
}

function expandSection(section, limit) {
  expandState[section] = limit;
  const ents = window[`_entries_${section}`];
  if (!ents) return;
  if (section === 'loc') renderLocationTable(ents);
  else                   renderPersonTable(ents);
}

// ── Drawer ────────────────────────────────────────────────────────────────────

function attachDrawer() {
  document.getElementById('drawer-close').addEventListener('click', closeDrawer);
  document.getElementById('drawer-overlay').addEventListener('click', closeDrawer);
}

function openDrawer(entry, section) {
  const title = document.getElementById('drawer-title');
  const sub   = document.getElementById('drawer-subtitle');
  const body  = document.getElementById('drawer-body');
  let html = '';

  if (section === 'loc') {
    title.textContent = entry.std;
    sub.textContent   = `${entry.count} co-mention${entry.count !== 1 ? 's' : ''} with ${anchorName}`;

    const peakCount = Math.max(...Object.values(entry.yearMap), 1);
    const yearBars  = Object.entries(entry.yearMap).sort((a, b) => +a[0] - +b[0])
      .map(([yr, cnt]) => {
        const pct = Math.round(cnt / peakCount * 100);
        return `<div class="yr-bar-row"><span class="yr-label">${yr}</span><div class="yr-bar-wrap"><div class="yr-bar" style="width:${pct}%"></div></div><span class="yr-cnt">${cnt}</span></div>`;
      }).join('');
    html += `<div class="drawer-section-hdr">Frequency by year</div><div class="yr-bars">${yearBars}</div>`;
    html += `<div class="drawer-section-hdr">Location entries (${entry.locRecs.length})</div>`;
    entry.locRecs.forEach(r => { html += buildLocationCard(r); });
    if (entry.personRecs.length) {
      html += `<div class="drawer-section-hdr">${anchorName} entries from same files (${entry.personRecs.length})</div>`;
      entry.personRecs.forEach(r => { html += buildPersonCard(r); });
    }
  } else {
    title.textContent = entry.name;
    sub.textContent   = `${entry.count} co-mention${entry.count !== 1 ? 's' : ''} with ${anchorName} (shared files)`;

    const peakCount = Math.max(...Object.values(entry.yearMap), 1);
    const yearBars  = Object.entries(entry.yearMap).sort((a, b) => +a[0] - +b[0])
      .map(([yr, cnt]) => {
        const pct = Math.round(cnt / peakCount * 100);
        return `<div class="yr-bar-row"><span class="yr-label">${yr}</span><div class="yr-bar-wrap"><div class="yr-bar" style="width:${pct}%"></div></div><span class="yr-cnt">${cnt}</span></div>`;
      }).join('');
    html += `<div class="drawer-section-hdr">Frequency by year</div><div class="yr-bars">${yearBars}</div>`;
    html += `<div class="drawer-section-hdr">${entry.name} entries (${entry.coRecs.length})</div>`;
    entry.coRecs.forEach(r => { html += buildPersonCard(r); });
    if (entry.anchorRecs.length) {
      html += `<div class="drawer-section-hdr">${anchorName} entries from same files (${entry.anchorRecs.length})</div>`;
      entry.anchorRecs.forEach(r => { html += buildPersonCard(r); });
    }
  }

  body.innerHTML = html;
  document.getElementById('entry-drawer').classList.add('open');
  document.getElementById('drawer-overlay').classList.add('visible');
  drawerOpen = true;
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  document.getElementById('entry-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('visible');
  drawerOpen = false;
  document.body.style.overflow = '';
}

function buildPersonCard(r) {
  function f(k, v) {
    return v ? `<div class="entry-field"><span class="ef-key">${k}</span><span class="ef-val">${v}</span></div>` : '';
  }
  return `<div class="entry-card entry-card-person">
    <div class="entry-card-title">${r.standardised_name || r.person_entry || '\u2014'}</div>
    ${f('As appears', r.person_entry)}
    ${f('Title', r.title)}
    ${f('Role', r.role)}
    ${f('Organisation', r.associated_organisation)}
    ${f('Gender', r.gender)}
    ${f('Relation', r.relation)}
    ${f('Depicted', r.depicted)}
    ${f('Article', r.article_title)}
    ${f('Page', r.page_number)}
    ${f('Date', r.date)}
    ${f('Vol/Issue', r.volume_issue)}
    ${f('File', r.filename)}
    ${r.brief_extract ? `<div class="entry-extract"><details><summary>View extract</summary><p>${r.brief_extract}</p></details></div>` : ''}
  </div>`;
}

function buildLocationCard(r) {
  function f(k, v) {
    return v ? `<div class="entry-field"><span class="ef-key">${k}</span><span class="ef-val">${v}</span></div>` : '';
  }
  return `<div class="entry-card entry-card-location">
    <div class="entry-card-title">${r.location_standardised || r.location_entry || '\u2014'}</div>
    ${f('As appears', r.location_entry !== r.location_standardised ? r.location_entry : '')}
    ${f('Context', r.brief_context)}
    ${f('Article', r.article_title)}
    ${f('Page', r.page_number)}
    ${f('Date', r.date)}
    ${f('Vol/Issue', r.volume_issue)}
    ${f('File', r.filename)}
    ${r.brief_extract ? `<div class="entry-extract"><details><summary>View extract</summary><p>${r.brief_extract}</p></details></div>` : ''}
  </div>`;
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && drawerOpen) closeDrawer();
});

document.getElementById('loading-bar').style.display = 'block';
loadAll().catch(err => {
  console.error('Failed to load data:', err);
  setStatus('Error loading data \u2014 check the assets/data_date/ folder is present.');
});
