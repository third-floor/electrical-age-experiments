// persons_explorer.js
// Interactive explorer for comparing up to 10 persons across the full dataset.
// Data fields used: standardised_name, person_entry, title, role,
// associated_organisation, gender, relation, depicted, article_title,
// date, volume_issue, filename, brief_extract, brief_context.

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

// ── Palette ───────────────────────────────────────────────────────────────────

const PALETTE = [
  '#2c2c2c','#b8860b','#1D9E75','#D85A30',
  '#7F77DD','#185FA5','#639922','#D4537E',
  '#BA7517','#5F5E5A',
];
const DASH_STYLES = [
  [],           // solid
  [6,3],        // dashed
  [3,3],        // dotted
  [8,2,2,2],    // dash-dot
  [10,3],       // long dash
  [4,2],        // short dash
  [1,3],        // very dotted
  [8,3,3,3],    // dash-dot-dot
  [12,4],       // very long dash
  [2,2],        // fine dot
];

const MAX_PERSONS = 10;
const ROLLING     = 5;
const TOP_CHART   = 15;

function color(i)  { return PALETTE[i % PALETTE.length]; }
function dash(i)   { return DASH_STYLES[i % DASH_STYLES.length]; }

// ── State ─────────────────────────────────────────────────────────────────────

let allRecords    = []; // every person record loaded
let personIndex   = []; // search index: { label, subLabel, record }
let allYears      = [];
let yearMin, yearMax;

// { name -> [records] } keyed by standardised_name (normalised)
let recordsByName = {};

let selected = [];  // ordered array of standardised_name strings (max 10)
let charts   = {};
let allPersonNames = []; // sorted list of all distinct standardised_names

// ── Helpers ───────────────────────────────────────────────────────────────────

function cleanJSON(t) { return t.replace(/:\s*NaN\s*([,\}])/g, ': null$1'); }

function loadFile(url) {
  return fetch(url).then(r => r.text()).then(t => JSON.parse(cleanJSON(t))).catch(() => []);
}

function roll(arr, w) {
  return arr.map((_, i) => {
    const sl = arr.slice(Math.max(0, i - Math.floor(w/2)), i + Math.ceil(w/2));
    const vs = sl.filter(v => v != null);
    return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
  });
}

function short(s, n = 40) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
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
    plugins: { legend: { display: false }, ...extra.plugins },
    scales: {
      x: { ticks: { color: '#73726c', font: { size: 9.5 } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false }, ...extra.xScale },
      y: { ticks: { color: '#73726c', font: { size: 9.5 } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false }, ...extra.yScale },
    },
    ...extra,
  };
}

function makeLegend(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = items.map(it => {
    const dashStyle = it.dash && it.dash.length
      ? `background:repeating-linear-gradient(90deg,${it.color} 0,${it.color} ${it.dash[0]}px,transparent ${it.dash[0]}px,transparent ${it.dash[0]+(it.dash[1]||4)}px)`
      : `background:${it.color}`;
    return `<span><span class="legend-line" style="${dashStyle}"></span>${it.label}</span>`;
  }).join('');
}

function pct(v) { return v != null ? (v * 100).toFixed(1) + '%' : '—'; }

// ── Data loading & indexing ───────────────────────────────────────────────────

async function loadAll() {
  document.getElementById('loading-status').textContent = 'Loading person data…';

  const arrays = await Promise.all(PERSON_FILES.map(loadFile));
  allRecords = arrays.flat();

  document.getElementById('loading-status').textContent = 'Building indexes…';

  // Group records by standardised_name (lowercased for consistency)
  recordsByName = {};
  allRecords.forEach(r => {
    const name = (r.standardised_name || r.person_entry || '').trim();
    if (!name) return;
    if (!recordsByName[name]) recordsByName[name] = [];
    recordsByName[name].push(r);
  });

  allPersonNames = Object.keys(recordsByName).sort();

  // Build search index (one entry per unique name, subLabel shows roles/orgs)
  const seenNames = new Set();
  allRecords.forEach(r => {
    const name = (r.standardised_name || r.person_entry || '').trim();
    if (!name || seenNames.has(name)) return;
    seenNames.add(name);
    const recs   = recordsByName[name];
    const roles  = [...new Set(recs.map(x => x.role).filter(Boolean))].slice(0, 2).join(', ');
    const orgs   = [...new Set(recs.map(x => x.associated_organisation).filter(Boolean))].slice(0, 1).join('');
    personIndex.push({
      label:    name,
      subLabel: [roles, orgs, `${recs.length} mention${recs.length !== 1 ? 's' : ''}`].filter(Boolean).join(' · '),
      record:   recs[0],
    });
  });
  personIndex.sort((a, b) => a.label.localeCompare(b.label));

  // Year range
  const years = allRecords.map(r => r.date ? +r.date.slice(0, 4) : null).filter(Boolean);
  yearMin = Math.min(...years);
  yearMax = Math.max(...years);
  allYears = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMin + i);

  const total = allPersonNames.length;
  const mentions = allRecords.length;
  document.getElementById('header-meta').textContent =
    `${yearMin}–${yearMax} · ${mentions.toLocaleString()} records · ${total.toLocaleString()} distinct persons`;
  document.getElementById('loading-status').textContent = '';
  document.getElementById('loading-bar').style.display  = 'none';

  buildSlots(allPersonNames);
}

// ── Slot / search UI ──────────────────────────────────────────────────────────

function buildSlots(names) {
  renderSlots();
}

function renderSlots() {
  const container = document.getElementById('slots');
  container.innerHTML = '';

  selected.forEach((name, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.innerHTML = `
      <div class="slot-swatch" style="background:${color(i)}"></div>
      <div class="slot-filled-label" title="${name}">${short(name, 60)}</div>
      <span class="slot-remove" title="Remove" onclick="removePerson(${i})">✕</span>`;
    container.appendChild(slot);
  });

  if (selected.length < MAX_PERSONS) {
    const slotId = 'slot-new';
    const ddId   = 'dd-new';
    const slot   = document.createElement('div');
    slot.className = 'slot';
    slot.innerHTML = `
      <div class="slot-swatch" style="background:${color(selected.length)}"></div>
      <div class="slot-inner">
        <input type="text" id="${slotId}"
               placeholder="${selected.length === 0 ? 'Type to search persons…' : 'Add another person…'}"
               autocomplete="off">
        <div class="loc-dropdown" id="${ddId}"></div>
      </div>`;
    container.appendChild(slot);
    attachDropdown(slotId, ddId);
  } else {
    const cap = document.createElement('div');
    cap.style.cssText = 'font-family:Georgia,serif;font-size:0.82rem;color:#999;font-style:italic;padding:0.3rem 0';
    cap.textContent = 'Maximum of 10 persons reached. Remove one to add another.';
    container.appendChild(cap);
  }

  renderPills();
}

function attachDropdown(inputId, ddId) {
  const input = document.getElementById(inputId);
  const dd    = document.getElementById(ddId);
  if (!input || !dd) return;
  let active = -1;

  function getMatches(q) {
    if (!q || q.length < 1) return { sw: [], inc: [] };
    const ql   = q.toLowerCase();
    const pool = personIndex.filter(e => !selected.includes(e.label));
    return {
      sw:  pool.filter(e =>  e.label.toLowerCase().startsWith(ql)).slice(0, 50),
      inc: pool.filter(e => !e.label.toLowerCase().startsWith(ql) && e.label.toLowerCase().includes(ql)).slice(0, 50),
    };
  }

  function show(q) {
    const { sw, inc } = getMatches(q);
    dd.innerHTML = ''; active = -1;
    if (!sw.length && !inc.length) { dd.style.display = 'none'; return; }

    function addGroup(label) {
      const div = document.createElement('div');
      div.className = 'dd-group-label'; div.textContent = label; dd.appendChild(div);
    }
    function addItem(entry) {
      const div = document.createElement('div');
      div.className = 'dd-item';
      div.innerHTML = `<span class="dd-title">${entry.label}</span><span class="dd-meta">${entry.subLabel}</span>`;
      div.addEventListener('mousedown', e => { e.preventDefault(); pickPerson(entry.label); });
      dd.appendChild(div);
    }
    if (sw.length)  { if (inc.length) addGroup(`Starting with "${q}"`); sw.forEach(addItem); }
    if (inc.length) { if (sw.length)  addGroup(`Also containing "${q}"`); inc.forEach(addItem); }
    dd.style.display = 'block';
  }

  function items() { return [...dd.querySelectorAll('.dd-item')]; }

  input.addEventListener('input',  () => show(input.value));
  input.addEventListener('focus',  () => { if (input.value.length >= 1) show(input.value); });
  input.addEventListener('blur',   () => setTimeout(() => { dd.style.display = 'none'; }, 130));
  input.addEventListener('keydown', e => {
    const its = items();
    if      (e.key === 'ArrowDown') { active = Math.min(active + 1, its.length - 1); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'ArrowUp')   { active = Math.max(active - 1, 0); its.forEach((el, i) => el.classList.toggle('active', i === active)); }
    else if (e.key === 'Enter' && active >= 0) { pickPerson(its[active].querySelector('.dd-title').textContent); }
    else if (e.key === 'Escape')    { dd.style.display = 'none'; }
  });
}

function pickPerson(name) {
  if (selected.includes(name) || selected.length >= MAX_PERSONS) return;
  selected.push(name);
  // Reset expand state for new slot index
  const newIdx = selected.length - 1;
  ['roles','orgs','articles','comenon'].forEach(s => delete expandState[`${s}:${newIdx}`]);
  renderSlots();
  triggerRender();
}

function removePerson(i) {
  const removedName = selected[i];
  selected.splice(i, 1);
  // Clear co-mention cache for removed person; also clear expand state for all
  delete _coMentionCache[removedName];
  Object.keys(expandState).forEach(k => delete expandState[k]);
  renderSlots();
  if (selected.length === 0) {
    document.getElementById('placeholder').style.display = 'block';
    document.getElementById('content').style.display     = 'none';
    Object.keys(charts).forEach(destroyChart);
  } else {
    triggerRender();
  }
}

function renderPills() {
  const el = document.getElementById('active-pills');
  el.innerHTML = selected.map((name, i) =>
    `<span class="active-pill" style="background:${color(i)}">
      ${short(name, 45)}
      <span class="pill-x" onclick="removePerson(${i})">✕</span>
    </span>`
  ).join('');
}

// ── Trigger full render ───────────────────────────────────────────────────────

function triggerRender() {
  if (!selected.length) return;
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('content').style.display     = 'block';

  renderOverview();
  renderMentionsOverTime();
  renderRelationBreakdown();
  renderRoleCloud();
  renderOrganisations();
  renderGenderContext();
  renderArticleContext();
  renderCoMentioned();
  renderDebut();
}

// ── I. Overview cards ─────────────────────────────────────────────────────────

function renderOverview() {
  const grid = document.getElementById('overview-cards');
  grid.innerHTML = selected.map((name, i) => {
    const recs   = recordsByName[name] || [];
    const years  = recs.map(r => r.date ? +r.date.slice(0,4) : null).filter(Boolean);
    const roles  = [...new Set(recs.map(r => r.role).filter(Boolean))];
    const orgs   = [...new Set(recs.map(r => r.associated_organisation).filter(Boolean))];
    const genders = [...new Set(recs.map(r => r.gender).filter(Boolean))];
    const relations = [...new Set(recs.map(r => r.relation).filter(Boolean))];
    const depictedCount = recs.filter(r => r.depicted === 'Yes').length;
    const first  = years.length ? Math.min(...years) : '—';
    const last   = years.length ? Math.max(...years) : '—';

    function row(k, v) { return v ? `<div class="ov-row"><span class="ov-key">${k}</span><span>${v}</span></div>` : ''; }

    return `<div class="overview-card">
      <div class="overview-card-hdr" style="background:${color(i)}" title="${name}">${short(name, 36)}</div>
      <div class="overview-card-body">
        ${row('Mentions', recs.length.toLocaleString())}
        ${row('Years active', first !== '—' ? `${first}–${last}` : '—')}
        ${row('Issues', [...new Set(recs.map(r => r.volume_issue).filter(Boolean))].length)}
        ${row('Gender', genders.join(', ') || '—')}
        ${row('Relations', relations.join(', ') || '—')}
        ${row('Depicted', depictedCount > 0 ? `Yes (${depictedCount}×)` : 'No')}
        ${row('Roles', roles.slice(0,3).join('; ') || '—')}
        ${row('Organisations', orgs.slice(0,2).join('; ') || '—')}
      </div>
    </div>`;
  }).join('');

  // Finding sentence
  const sorted = selected.slice().sort((a, b) => (recordsByName[b]||[]).length - (recordsByName[a]||[]).length);
  let finding = '';
  if (selected.length === 1) {
    const recs = recordsByName[sorted[0]] || [];
    finding = `${short(sorted[0], 50)} appears ${recs.length.toLocaleString()} time${recs.length !== 1 ? 's' : ''} across the dataset.`;
  } else {
    const top = sorted[0], bot = sorted[sorted.length - 1];
    finding = `Of the ${selected.length} selected persons, ${short(top,40)} has the most mentions (${(recordsByName[top]||[]).length.toLocaleString()}). ${short(bot,40)} has the fewest (${(recordsByName[bot]||[]).length.toLocaleString()}).`;
  }
  document.getElementById('overview-finding').textContent = finding;
}

// ── II. Mentions over time ────────────────────────────────────────────────────

function renderMentionsOverTime() {
  // Build year→count maps per person
  const datasets = [];
  selected.forEach((name, i) => {
    const recs = recordsByName[name] || [];
    const m = {};
    recs.forEach(r => { if (r.date) { const y = +r.date.slice(0,4); m[y] = (m[y]||0) + 1; } });
    const vals = allYears.map(y => m[y] || 0);

    datasets.push({
      label: short(name, 34),
      data: vals,
      backgroundColor: color(i) + '55',
      borderColor: color(i),
      borderWidth: 1.2,
      borderRadius: 1,
      order: 10 + i,
      type: 'bar',
    });
    datasets.push({
      label: short(name, 34) + ' avg',
      data: roll(vals, ROLLING),
      type: 'line',
      borderColor: color(i),
      borderDash: dash(i),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.4,
      fill: false,
      order: i,
    });
  });

  makeLegend('legend-mentions', selected.map((name, i) => ({ color: color(i), dash: dash(i), label: short(name, 38) })));
  mkChart('ch-mentions', {
    type: 'bar',
    data: { labels: allYears, datasets },
    options: baseOpts(),
  });

  // Share of all mentions per year
  const totalByYear = {};
  allRecords.forEach(r => { if (r.date) { const y = +r.date.slice(0,4); totalByYear[y] = (totalByYear[y]||0) + 1; } });

  const shareDs = selected.map((name, i) => {
    const recs = recordsByName[name] || [];
    const m = {};
    recs.forEach(r => { if (r.date) { const y = +r.date.slice(0,4); m[y] = (m[y]||0) + 1; } });
    return {
      label: short(name, 34),
      data: allYears.map(y => totalByYear[y] ? (m[y]||0) / totalByYear[y] * 100 : 0),
      borderColor: color(i),
      borderDash: dash(i),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.3,
      fill: false,
    };
  });

  makeLegend('legend-share', selected.map((name, i) => ({ color: color(i), dash: dash(i), label: short(name, 38) })));
  mkChart('ch-share', {
    type: 'line',
    data: { labels: allYears, datasets: shareDs },
    options: baseOpts({ yScale: { ticks: { callback: v => v.toFixed(2) + '%', color: '#73726c', font: { size: 9.5 } } } }),
  });
}

// ── III. Relation breakdown ───────────────────────────────────────────────────

function renderRelationBreakdown() {
  const RELATIONS = ['mentioned', 'subject', 'author', 'speaker', 'depicted', 'other'];
  const RCOLS     = { mentioned: '#888', subject: '#1D9E75', author: '#185FA5', speaker: '#b8860b', depicted: '#D85A30', other: '#ccc' };

  const datasets = RELATIONS.map(rel => ({
    label: rel,
    data: selected.map(name => {
      const recs = recordsByName[name] || [];
      return recs.filter(r => {
        const rv = (r.relation || '').toLowerCase();
        return rel === 'other' ? !RELATIONS.slice(0,-1).includes(rv) : rv === rel;
      }).length;
    }),
    backgroundColor: RCOLS[rel] || '#ccc',
    borderRadius: 2,
  }));

  mkChart('ch-relation', {
    type: 'bar',
    data: { labels: selected.map(n => short(n, 22)), datasets },
    options: {
      ...baseOpts({
        plugins: {
          legend: { display: true, position: 'bottom', labels: { font: { size: 8.5 }, color: '#73726c', boxWidth: 14, padding: 6 } },
        },
      }),
      scales: {
        x: { stacked: true, ticks: { color: '#73726c', font: { size: 9 } }, grid: { display: false }, border: { display: false } },
        y: { stacked: true, ticks: { color: '#73726c', font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
      },
    },
  });

  // Relation over time for first selected person (if only 1) or all
  const relTimeDs = [];
  selected.forEach((name, i) => {
    const recs = recordsByName[name] || [];
    const m = {};
    recs.forEach(r => { if (r.date) { const y = +r.date.slice(0,4); m[y] = (m[y]||0) + 1; } });
    const subjectM = {};
    recs.filter(r => (r.relation||'').toLowerCase() === 'subject').forEach(r => {
      if (r.date) { const y = +r.date.slice(0,4); subjectM[y] = (subjectM[y]||0) + 1; }
    });
    relTimeDs.push({
      label: short(name, 28) + ' (subject)',
      data: roll(allYears.map(y => m[y] ? (subjectM[y]||0)/m[y]*100 : null), ROLLING),
      borderColor: color(i),
      borderDash: dash(i),
      borderWidth: 1.8,
      pointRadius: 0,
      tension: 0.35,
      fill: false,
    });
  });

  mkChart('ch-rel-time', {
    type: 'line',
    data: { labels: allYears, datasets: relTimeDs },
    options: baseOpts({
      plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 8.5 }, color: '#73726c', boxWidth: 20, padding: 6 } } },
      yScale: { ticks: { callback: v => v != null ? v.toFixed(0) + '%' : '', color: '#73726c', font: { size: 9.5 } } },
    }),
  });
}

// ── IV. Role cloud / top roles ────────────────────────────────────────────────
// expandState tracks how many rows to show per section per person.
// Key format: "section:personIndex"  value: number of rows to show (or Infinity)
const expandState = {};

const EXPAND_STEP = 10;
const EXPAND_INITIAL = 10;

function getExpand(section, idx) {
  const key = `${section}:${idx}`;
  return expandState[key] !== undefined ? expandState[key] : EXPAND_INITIAL;
}
function setExpand(section, idx, val) {
  expandState[`${section}:${idx}`] = val;
}

function expandableTable(section, idx, allEntries, renderRow, total) {
  // allEntries: sorted array of all entries
  // renderRow: fn(entry, idx_in_full_list) -> <tr> html string
  // total: allEntries.length
  const limit   = getExpand(section, idx);
  const showing = Math.min(limit, total);
  const hidden  = total - showing;

  const rowsHtml = allEntries.slice(0, showing).map((e, ri) => renderRow(e, ri)).join('');

  let btnHtml = '';
  if (hidden > 0) {
    const next = Math.min(showing + EXPAND_STEP, total);
    const nextMore = next - showing;
    btnHtml = `<div class="expand-row">
      <button class="expand-tbl-btn" onclick="expandTable('${section}',${idx},${next})">Show ${nextMore} more (${hidden} remaining)</button>
      <button class="expand-tbl-btn expand-tbl-all" onclick="expandTable('${section}',${idx},Infinity)">Show all ${total}</button>
    </div>`;
  } else if (total > EXPAND_INITIAL) {
    btnHtml = `<div class="expand-row">
      <button class="expand-tbl-btn expand-tbl-collapse" onclick="expandTable('${section}',${idx},${EXPAND_INITIAL})">Collapse</button>
    </div>`;
  }

  return rowsHtml + btnHtml;
}

function expandTable(section, personIdx, val) {
  setExpand(section, personIdx, val === Infinity ? Infinity : +val);
  // Re-render only the affected section
  if (section === 'roles') renderRoleCloud();
  else if (section === 'orgs') renderOrganisations();
  else if (section === 'articles') renderArticleContext();
  else if (section === 'comenon') renderCoMentioned();
}

function renderRoleCloud() {
  const container = document.getElementById('role-cards');
  container.innerHTML = selected.map((name, i) => {
    const recs  = recordsByName[name] || [];
    const roleCounts = {};
    recs.forEach(r => { if (r.role) roleCounts[r.role] = (roleCounts[r.role]||0) + 1; });
    const allRoles = Object.entries(roleCounts).sort((a,b) => b[1] - a[1]);
    const total    = allRoles.length;

    if (!total) {
      return `<div class="expand-card">
        <div class="expand-card-hdr" style="background:${color(i)}">${short(name,38)}</div>
        <div class="expand-card-body"><div class="no-data">No role data.</div></div>
      </div>`;
    }

    const tableBody = expandableTable('roles', i, allRoles, ([role, count]) => {
      const pct = Math.round(count / recs.length * 100);
      return `<tr>
        <td style="width:60px;padding-right:0.5rem">
          <div class="role-bar-wrap"><div class="role-bar" style="width:${pct}%;background:${color(i)}"></div></div>
        </td>
        <td>${role}</td>
        <td class="tbl-count">${count}</td>
        <td class="tbl-count">${pct}%</td>
      </tr>`;
    }, total);

    return `<div class="expand-card">
      <div class="expand-card-hdr" style="background:${color(i)}">${short(name,38)}
        <span class="card-total">${total} role${total!==1?'s':''}</span>
      </div>
      <div class="expand-card-body">
        <table class="expand-tbl">
          <thead><tr><th style="width:60px"></th><th>Role</th><th class="tbl-count">Count</th><th class="tbl-count">Share</th></tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

// ── V. Organisations ──────────────────────────────────────────────────────────

function renderOrganisations() {
  const container = document.getElementById('org-cards');
  container.innerHTML = selected.map((name, i) => {
    const recs = recordsByName[name] || [];
    const orgCounts = {};
    recs.forEach(r => {
      if (r.associated_organisation) orgCounts[r.associated_organisation] = (orgCounts[r.associated_organisation]||0) + 1;
    });
    const allOrgs = Object.entries(orgCounts).sort((a,b) => b[1] - a[1]);
    const total   = allOrgs.length;

    if (!total) {
      return `<div class="expand-card">
        <div class="expand-card-hdr" style="background:${color(i)}">${short(name,36)}</div>
        <div class="expand-card-body"><div class="no-data">No organisation data.</div></div>
      </div>`;
    }

    const tableBody = expandableTable('orgs', i, allOrgs, ([org, count]) =>
      `<tr><td>${org}</td><td class="tbl-count">${count}×</td></tr>`, total);

    return `<div class="expand-card">
      <div class="expand-card-hdr" style="background:${color(i)}">${short(name,36)}
        <span class="card-total">${total} org${total!==1?'s':''}</span>
      </div>
      <div class="expand-card-body">
        <table class="expand-tbl">
          <thead><tr><th>Organisation</th><th class="tbl-count">Count</th></tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

// ── VI. Gender context ────────────────────────────────────────────────────────

function renderGenderContext() {
  // Overall gender split of ALL persons in dataset over time (context)
  const totalByYearGender = { F: {}, M: {}, U: {} };
  allRecords.forEach(r => {
    if (!r.date) return;
    const y = +r.date.slice(0,4);
    const g = r.gender === 'F' ? 'F' : r.gender === 'M' ? 'M' : 'U';
    totalByYearGender[g][y] = (totalByYearGender[g][y]||0) + 1;
  });
  const totByYear = {};
  allRecords.forEach(r => { if (r.date) { const y = +r.date.slice(0,4); totByYear[y] = (totByYear[y]||0) + 1; } });

  const fShare = roll(allYears.map(y => totByYear[y] ? (totalByYearGender.F[y]||0)/totByYear[y]*100 : null), ROLLING);

  const gDs = [{
    label: 'Female share (all persons)',
    data: fShare,
    borderColor: '#D4537E',
    borderWidth: 1.5,
    borderDash: [4,3],
    pointRadius: 0,
    tension: 0.35,
    fill: false,
  }];

  // Overlay each selected person's own gender mentions over time
  selected.forEach((name, i) => {
    const recs = recordsByName[name] || [];
    const gender = (recs[0] || {}).gender || 'U';
    const m = {};
    recs.forEach(r => { if (r.date) { const y = +r.date.slice(0,4); m[y] = (m[y]||0) + 1; } });
    gDs.push({
      label: `${short(name,28)} (${gender})`,
      data: allYears.map(y => totByYear[y] ? (m[y]||0)/totByYear[y]*100 : 0),
      borderColor: color(i),
      borderDash: dash(i),
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.35,
      fill: false,
    });
  });

  makeLegend('legend-gender', [
    { color: '#D4537E', dash: [4,3], label: 'Female share (all)' },
    ...selected.map((name,i) => ({ color: color(i), dash: dash(i), label: short(name,38) })),
  ]);

  mkChart('ch-gender', {
    type: 'line',
    data: { labels: allYears, datasets: gDs },
    options: baseOpts({ yScale: { ticks: { callback: v => v != null ? v.toFixed(2)+'%' : '', color: '#73726c', font: { size: 9.5 } } } }),
  });
}

// ── VII. Article context ──────────────────────────────────────────────────────

function renderArticleContext() {
  const container = document.getElementById('article-cards');
  container.innerHTML = selected.map((name, i) => {
    const recs = recordsByName[name] || [];
    const artCounts = {};
    recs.forEach(r => { if (r.article_title) artCounts[r.article_title] = (artCounts[r.article_title]||0) + 1; });
    const allArts = Object.entries(artCounts).sort((a,b) => b[1] - a[1]);
    const total   = allArts.length;

    if (!total) {
      return `<div class="expand-card">
        <div class="expand-card-hdr" style="background:${color(i)}">${short(name,36)}</div>
        <div class="expand-card-body"><div class="no-data">No article data.</div></div>
      </div>`;
    }

    const tableBody = expandableTable('articles', i, allArts, ([art, count]) =>
      `<tr><td title="${art}">${short(art, 60)}</td><td class="tbl-count">${count}×</td></tr>`, total);

    return `<div class="expand-card">
      <div class="expand-card-hdr" style="background:${color(i)}">${short(name,36)}
        <span class="card-total">${total} article${total!==1?'s':''}</span>
      </div>
      <div class="expand-card-body">
        <table class="expand-tbl">
          <thead><tr><th>Article title</th><th class="tbl-count">Count</th></tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');

  // Article type split: advertisement vs non-advertisement context
  // We don't have article type here, so show depicted Y/N split instead
  const depDs = [{
    label: 'Depicted',
    data: selected.map(name => (recordsByName[name]||[]).filter(r => r.depicted === 'Yes').length),
    backgroundColor: '#D85A30',
    borderRadius: 2,
  }, {
    label: 'Not depicted',
    data: selected.map(name => (recordsByName[name]||[]).filter(r => r.depicted !== 'Yes').length),
    backgroundColor: '#d3d1c7',
    borderRadius: 2,
  }];

  mkChart('ch-depicted', {
    type: 'bar',
    data: { labels: selected.map(n => short(n,22)), datasets: depDs },
    options: {
      ...baseOpts({
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 8.5 }, color: '#73726c', boxWidth: 14, padding: 6 } } },
      }),
      scales: {
        x: { stacked: true, ticks: { color: '#73726c', font: { size: 9 } }, grid: { display: false }, border: { display: false } },
        y: { stacked: true, ticks: { color: '#73726c', font: { size: 9 } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
      },
    },
  });
}

// ── VIII. Co-mentioned persons ────────────────────────────────────────────────

// Cache co-mention results so re-renders for expand don't recompute
const _coMentionCache = {};

function renderCoMentioned() {
  const container = document.getElementById('co-mention-cards');
  container.innerHTML = '';

  selected.forEach((name, i) => {
    // Use cache if available
    if (!_coMentionCache[name]) {
      const recs  = recordsByName[name] || [];
      const files = new Set(recs.map(r => r.filename).filter(Boolean));
      const coCounts = {};
      allRecords.forEach(r => {
        if (!r.filename || !files.has(r.filename)) return;
        const coName = (r.standardised_name || r.person_entry || '').trim();
        if (!coName || coName === name) return;
        coCounts[coName] = (coCounts[coName]||0) + 1;
      });
      _coMentionCache[name] = Object.entries(coCounts).sort((a,b) => b[1] - a[1]);
    }

    const allCo = _coMentionCache[name];
    const total  = allCo.length;

    const wrapper = document.createElement('div');
    wrapper.className = 'expand-card';
    wrapper.style.marginBottom = '1rem';

    if (!total) {
      wrapper.innerHTML = `
        <div class="expand-card-hdr" style="background:${color(i)}">${short(name,60)}</div>
        <div class="expand-card-body"><div class="no-data">No co-mentioned persons found.</div></div>`;
      container.appendChild(wrapper);
      return;
    }

    const tableBody = expandableTable('comenon', i, allCo, ([coName, count]) =>
      `<tr><td>${coName}</td><td class="tbl-count">${count}</td></tr>`, total);

    wrapper.innerHTML = `
      <div class="expand-card-hdr" style="background:${color(i)}">${short(name,60)}
        <span class="card-total">${total} co-mentioned person${total!==1?'s':''}</span>
      </div>
      <div class="expand-card-body">
        <table class="expand-tbl">
          <thead><tr><th>Person</th><th class="tbl-count">Shared files</th></tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>`;
    container.appendChild(wrapper);
  });
}

// ── IX. First appearance / debut ─────────────────────────────────────────────

function renderDebut() {
  // Cumulative unique persons per year
  const debutByYear = {};
  const seenForDebut = new Set();
  // Sort all records by date
  const sorted = allRecords.filter(r => r.date).slice().sort((a,b) => a.date.localeCompare(b.date));
  sorted.forEach(r => {
    const name = (r.standardised_name || r.person_entry || '').trim();
    const y    = +r.date.slice(0,4);
    if (!name || seenForDebut.has(name)) return;
    seenForDebut.add(name);
    debutByYear[y] = (debutByYear[y]||0) + 1;
  });

  const newPerYear  = allYears.map(y => debutByYear[y] || 0);
  let cumulative = 0;
  const cumulPerYear = newPerYear.map(n => { cumulative += n; return cumulative; });

  const debutParts = selected.map(name => {
    const recs = recordsByName[name] || [];
    const firstDate = recs.filter(r=>r.date).map(r=>r.date).sort()[0];
    return firstDate ? `${short(name,35)} first appeared in ${firstDate.slice(0,4)}` : null;
  }).filter(Boolean);

  document.getElementById('debut-finding').textContent = debutParts.length ? debutParts.join('; ') + '.' : '';

  const ds = [
    { label: 'New persons', data: newPerYear, backgroundColor: '#AFA9EC', borderRadius: 1, order: 10, yAxisID: 'y', type: 'bar' },
    { label: 'Cumulative',  data: cumulPerYear, type: 'line', borderColor: '#7F77DD', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: false, order: 0, yAxisID: 'y2' },
  ];

  // Vertical lines for each selected person's debut
  const annotations = {};
  selected.forEach((name, i) => {
    const recs = recordsByName[name] || [];
    const firstDate = recs.filter(r=>r.date).map(r=>r.date).sort()[0];
    if (!firstDate) return;
    const yr  = +firstDate.slice(0,4);
    const xi  = allYears.indexOf(yr);
    if (xi < 0) return;
    annotations[`line${i}`] = { type: 'line', scaleID: 'x', value: xi, borderColor: color(i), borderWidth: 2, borderDash: [5,3] };
  });

  mkChart('ch-debut', {
    type: 'bar',
    data: { labels: allYears, datasets: ds },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 8.5 }, color: '#73726c', boxWidth: 20, padding: 7 } },
        annotation: { annotations },
      },
      scales: {
        x: { ticks: { color: '#73726c', font: { size: 9.5 } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
        y:  { ticks: { color: '#73726c', font: { size: 9.5 } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false }, title: { display: true, text: 'New persons', color: '#73726c', font: { size: 9 } } },
        y2: { position: 'right', ticks: { color: '#7F77DD', font: { size: 9.5 } }, grid: { display: false }, border: { display: false }, title: { display: true, text: 'Cumulative', color: '#7F77DD', font: { size: 9 } } },
      },
    },
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.getElementById('loading-bar').style.display = 'block';
loadAll().catch(err => {
  console.error('Failed to load person data:', err);
  document.getElementById('loading-status').textContent = 'Error loading data — check assets/data_date/ folder.';
});
