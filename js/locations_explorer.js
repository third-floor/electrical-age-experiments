// locations_explorer.js
// Drives the Location Explorer page.
// Reads pre-computed JSON files from assets/data/ and renders all analysis
// panels for a selected location using Chart.js.

// ════════════════════════════════════════════════════════════════════════════
//  DATA PATHS  — all files are produced by export_json.py (run in Colab)
// ════════════════════════════════════════════════════════════════════════════

const DATA = {
    locSummary:   'assets/data/loc_summary.json',
    locYear:      'assets/data/loc_year.json',
    ukIntYear:    'assets/data/uk_int_year.json',
    tierYear:     'assets/data/tier_year.json',
    issueDiv:     'assets/data/issue_diversity.json',
    artTypeLoc:   'assets/data/art_type_loc.json',
    artTypeYear:  'assets/data/art_type_year.json',
    cooc:         'assets/data/cooccurrence.json',
    debut:        'assets/data/debut_year.json',
    locIssues:    'assets/data/loc_issues.json',
    locList:      'assets/data/location_list.json',
};

// ════════════════════════════════════════════════════════════════════════════
//  PALETTE
// ════════════════════════════════════════════════════════════════════════════

const P = {
    blue:    '#378ADD', blueLt:  '#85B7EB',
    teal:    '#1D9E75', tealLt:  '#9FE1CB',
    coral:   '#D85A30', coralLt: '#F0997B',
    purple:  '#7F77DD', purpleLt:'#AFA9EC',
    amber:   '#BA7517', amberLt: '#EF9F27',
    gray:    '#888780', grayLt:  '#D3D1C7',
    black:   '#2c2c2c',
};

const TIER_COLORS = {
    'London':           P.blue,
    'Rest of England':  P.teal,
    'Devolved nations': P.purple,
    'International':    P.coral,
    'Unknown':          P.grayLt,
};

const LINE_STYLES = [
    { color: P.blue,   dash: [],        },
    { color: P.teal,   dash: [6, 3],    },
    { color: P.coral,  dash: [3, 3],    },
    { color: P.purple, dash: [8, 2, 2, 2] },
    { color: P.amber,  dash: [],        },
    { color: P.gray,   dash: [6, 3],    },
    { color: '#639922',dash: [3, 3],    },
    { color: '#D4537E',dash: [8, 2, 2, 2] },
];

const ROLLING = 5;
const TOP_CHART = 15;

// ════════════════════════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════════════════════════

let DB = {};             // all loaded data
let charts = {};         // active Chart.js instances (destroyed before redraw)
let selectedLoc = null;

// ════════════════════════════════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════════════════════════════════

function cleanJSON(text) {
    return text.replace(/:\s*NaN\s*([,\}])/g, ': null$1');
}

async function loadJSON(url) {
    const r = await fetch(url);
    const t = await r.text();
    return JSON.parse(cleanJSON(t));
}

function rolling(arr, w) {
    return arr.map((_, i) => {
        const slice = arr.slice(Math.max(0, i - Math.floor(w / 2)),
                                i + Math.ceil(w / 2));
        const vals  = slice.filter(v => v !== null && v !== undefined);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
}

function shortLoc(loc, n = 40) {
    if (!loc) return '';
    const seg = loc.split(',')[0].trim();
    return seg.length <= n ? seg : seg.slice(0, n - 1) + '…';
}

function fmtPct(v) {
    return v !== null && v !== undefined ? (v * 100).toFixed(1) + '%' : '—';
}

function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function makeChart(id, config) {
    destroyChart(id);
    const canvas = document.getElementById(id);
    if (!canvas) return;
    charts[id] = new Chart(canvas, config);
}

function baseOptions(extra = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, ...extra.plugins },
        scales: {
            x: {
                ticks: { color: '#73726c', font: { size: 9.5 } },
                grid:  { color: 'rgba(0,0,0,0.05)' },
                border: { display: false },
                ...extra.xScale,
            },
            y: {
                ticks: { color: '#73726c', font: { size: 9.5 } },
                grid:  { color: 'rgba(0,0,0,0.05)' },
                border: { display: false },
                ...extra.yScale,
            },
        },
        ...extra,
    };
}

// ════════════════════════════════════════════════════════════════════════════
//  LOAD ALL DATA
// ════════════════════════════════════════════════════════════════════════════

async function loadAll() {
    const entries = await Promise.all(
        Object.entries(DATA).map(async ([key, url]) => {
            try { return [key, await loadJSON(url)]; }
            catch { return [key, []]; }
        })
    );
    entries.forEach(([k, v]) => DB[k] = v);

    // Index loc_summary by Location for O(1) lookup
    DB.locIndex = {};
    (DB.locSummary || []).forEach(r => { DB.locIndex[r.Location] = r; });

    // Index locYear by Location
    DB.locYearByLoc = {};
    (DB.locYear || []).forEach(r => {
        if (!DB.locYearByLoc[r.Location]) DB.locYearByLoc[r.Location] = [];
        DB.locYearByLoc[r.Location].push(r);
    });

    // Index artTypeLoc by Art_Type → array
    DB.artByType = {};
    (DB.artTypeLoc || []).forEach(r => {
        if (!DB.artByType[r.Art_Type]) DB.artByType[r.Art_Type] = [];
        DB.artByType[r.Art_Type].push(r);
    });

    // Index artTypeYear by Art_Type
    DB.artYearByType = {};
    (DB.artTypeYear || []).forEach(r => {
        if (!DB.artYearByType[r.Art_Type]) DB.artYearByType[r.Art_Type] = [];
        DB.artYearByType[r.Art_Type].push(r);
    });

    // Index locIssues by Location
    DB.locIssuesIndex = {};
    (DB.locIssues || []).forEach(r => {
        DB.locIssuesIndex[r.Location] = r.Issues || [];
    });

    // Year range
    const years = (DB.ukIntYear || []).map(r => r.Year).filter(Boolean).sort();
    DB.yrMin = years[0] || 1926;
    DB.yrMax = years[years.length - 1] || 1986;
    DB.allYears = Array.from({ length: DB.yrMax - DB.yrMin + 1 },
                              (_, i) => DB.yrMin + i);

    // Header meta
    const nLocs = (DB.locSummary || []).length;
    const nRecs = (DB.locSummary || []).reduce((s, r) => s + (r.Mentions || 0), 0);
    document.getElementById('header-meta').textContent =
        `${DB.yrMin}–${DB.yrMax} · ${nRecs.toLocaleString()} location records · ` +
        `${nLocs.toLocaleString()} distinct locations`;

    buildDropdown(DB.locList || []);
}

// ════════════════════════════════════════════════════════════════════════════
//  DROPDOWN / SEARCH
// ════════════════════════════════════════════════════════════════════════════

function buildDropdown(locs) {
    const input    = document.getElementById('loc-input');
    const dropdown = document.getElementById('loc-dropdown');
    let ddActive   = -1;

    function showMatches(q) {
        const matches = q.length < 2
            ? []
            : locs.filter(l => l.toLowerCase().includes(q.toLowerCase())).slice(0, 80);

        dropdown.innerHTML = '';
        ddActive = -1;

        if (!matches.length) { dropdown.style.display = 'none'; return; }

        matches.forEach((loc, i) => {
            const div = document.createElement('div');
            div.className = 'dd-item';
            div.textContent = loc;
            div.addEventListener('mousedown', e => {
                e.preventDefault();
                selectLoc(loc);
            });
            dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
    }

    input.addEventListener('input', () => showMatches(input.value));
    input.addEventListener('focus', () => { if (input.value.length >= 2) showMatches(input.value); });
    input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 120));

    input.addEventListener('keydown', e => {
        const items = dropdown.querySelectorAll('.dd-item');
        if (e.key === 'ArrowDown') {
            ddActive = Math.min(ddActive + 1, items.length - 1);
            items.forEach((el, i) => el.classList.toggle('active', i === ddActive));
        } else if (e.key === 'ArrowUp') {
            ddActive = Math.max(ddActive - 1, 0);
            items.forEach((el, i) => el.classList.toggle('active', i === ddActive));
        } else if (e.key === 'Enter' && ddActive >= 0) {
            selectLoc(items[ddActive].textContent);
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });
}

function selectLoc(loc) {
    selectedLoc = loc;
    document.getElementById('loc-input').value = '';
    document.getElementById('loc-dropdown').style.display = 'none';

    const pill = document.getElementById('selected-pill');
    pill.textContent = shortLoc(loc, 55);
    pill.style.display = 'inline-block';

    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('content').style.display     = 'block';

    renderAll(loc);
}

// ════════════════════════════════════════════════════════════════════════════
//  RENDER ALL PANELS
// ════════════════════════════════════════════════════════════════════════════

function renderAll(loc) {
    renderOverview(loc);
    renderMentionsTime(loc);
    renderGeoContext(loc);
    renderUKIntl(loc);
    renderIssueDiversity(loc);
    renderAdVsNonAd(loc);
    renderCoOccurrence(loc);
    renderDebut(loc);
}

// ── 1. Overview ───────────────────────────────────────────────────────────────

function renderOverview(loc) {
    const r = DB.locIndex[loc];
    if (!r) { document.getElementById('stat-grid').innerHTML = '<p class="no-data">No summary data found.</p>'; return; }

    const tier     = r.Tier || 'Unknown';
    const tierKey  = tier === 'Rest of England' ? 'Rest' : tier.split(' ')[0];
    const tierHtml = `<span class="tier-pill tier-${tierKey}">${tier}</span>`;

    const shift    = r.Shift !== null && r.Shift !== undefined ? r.Shift : 0;
    const shiftDir = shift > 0 ? '▲ Growing' : shift < 0 ? '▼ Declining' : '→ Stable';
    const shiftCol = shift > 0 ? P.teal : shift < 0 ? P.coral : P.gray;

    document.getElementById('stat-grid').innerHTML = `
        <div class="stat-card">
            <div class="stat-label">Overall rank</div>
            <div class="stat-value">#${(r.Rank || '—').toLocaleString()}</div>
            <div class="stat-sub">of ${(DB.locSummary || []).length.toLocaleString()} locations</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total mentions</div>
            <div class="stat-value">${(r.Mentions || 0).toLocaleString()}</div>
            <div class="stat-sub">${fmtPct(r.Pct_of_Total)} of all records</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Geographic tier</div>
            <div class="stat-value" style="font-size:1rem;padding-top:0.3rem">${tierHtml}</div>
            <div class="stat-sub">${r.Country || '—'}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Year range</div>
            <div class="stat-value">${r.First_Year || '—'}–${r.Last_Year || '—'}</div>
            <div class="stat-sub">${(r.Issues_Count || 0).toLocaleString()} issues</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Ad mentions</div>
            <div class="stat-value">${(r.Ad_Mentions || 0).toLocaleString()}</div>
            <div class="stat-sub">${fmtPct(r.Ad_Share)} of total</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Shift (first→second half)</div>
            <div class="stat-value" style="font-size:1.1rem;color:${shiftCol}">${shiftDir}</div>
            <div class="stat-sub">${(shift * 100).toFixed(2)} pp · rank #${r.Shift_Rank || '—'}</div>
        </div>
    `;

    document.getElementById('overview-finding').textContent =
        `${shortLoc(loc, 60)} is ranked #${r.Rank} overall with ${(r.Mentions||0).toLocaleString()} ` +
        `mentions (${fmtPct(r.Pct_of_Total)} of all records). ` +
        `It falls within the ${tier} tier and spans ${r.First_Year}–${r.Last_Year}. ` +
        `Its share of mentions ${shift > 0 ? 'grew' : shift < 0 ? 'declined' : 'remained stable'} ` +
        `between the first and second halves of the journal's run ` +
        `(${(shift * 100).toFixed(2)} percentage points).`;
}

// ── 2. Mentions over time ─────────────────────────────────────────────────────

function renderMentionsTime(loc) {
    const locData = (DB.locYearByLoc[loc] || []);
    const yearMap = {};
    locData.forEach(r => { yearMap[r.Year] = r; });

    const years    = DB.allYears;
    const mentions = years.map(y => yearMap[y]?.Mentions || 0);
    const roll     = rolling(mentions, ROLLING);

    document.getElementById('cap-abs').textContent =
        `Annual mention counts for ${shortLoc(loc, 50)} (bars) with ${ROLLING}-year rolling average (line).`;

    makeChart('ch-abs', {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                { label: 'Mentions', data: mentions, backgroundColor: P.blueLt,
                  borderRadius: 1, order: 2 },
                { label: `${ROLLING}-yr avg`, data: roll, type: 'line',
                  borderColor: P.blue, borderWidth: 2, pointRadius: 0,
                  tension: 0.4, fill: false, order: 1 },
            ],
        },
        options: baseOptions({ plugins: { legend: { display: false } } }),
    });

    // Share comparison with top 8
    const top8 = (DB.locSummary || [])
        .sort((a, b) => b.Mentions - a.Mentions)
        .slice(0, 8).map(r => r.Location);
    if (!top8.includes(loc)) top8.splice(7, 1, loc);

    const datasets = top8.map((l, i) => {
        const lm  = DB.locYearByLoc[l] || [];
        const lym = {};
        lm.forEach(r => { lym[r.Year] = r.Share_of_Year || 0; });
        const vals = years.map(y => (lym[y] || 0) * 100);
        const st   = LINE_STYLES[i % LINE_STYLES.length];
        const isSel = l === loc;
        return {
            label:           shortLoc(l, 36),
            data:            vals,
            borderColor:     isSel ? P.black : st.color,
            borderWidth:     isSel ? 2.5 : 1,
            borderDash:      isSel ? [] : st.dash,
            pointRadius:     0,
            tension:         0.3,
            fill:            false,
        };
    });

    makeChart('ch-share', {
        type: 'line',
        data: { labels: years, datasets },
        options: baseOptions({
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: { font: { size: 8.5 }, color: '#73726c',
                              boxWidth: 20, padding: 8 },
                },
            },
            yScale: {
                ticks: {
                    callback: v => v.toFixed(1) + '%',
                    color: '#73726c', font: { size: 9.5 },
                },
            },
        }),
    });
}

// ── 3. Geographic tier context ────────────────────────────────────────────────

function renderGeoContext(loc) {
    const r        = DB.locIndex[loc];
    const selTier  = r?.Tier || 'Unknown';
    const tierOrder = ['London','Rest of England','Devolved nations','International'];

    // Tier shares over time
    const tierYr = DB.tierYear || [];
    const years  = tierYr.map(r => r.Year);

    const tierDatasets = tierOrder.map(t => {
        const vals = tierYr.map(r => (r[t] || 0) * 100);
        const roll = rolling(vals, ROLLING);
        const isSel = t === selTier;
        return {
            label: t, data: roll,
            borderColor: TIER_COLORS[t] || P.gray,
            borderWidth: isSel ? 2.8 : 1.2,
            pointRadius: 0, tension: 0.35, fill: false,
            borderDash:  isSel ? [] : [4, 3],
        };
    });

    makeChart('ch-tier', {
        type: 'line',
        data: { labels: years, datasets: tierDatasets },
        options: baseOptions({
            plugins: {
                legend: {
                    display: true, position: 'bottom',
                    labels: { font: { size: 8.5 }, color: '#73726c',
                              boxWidth: 20, padding: 6 },
                },
            },
            yScale: { ticks: { callback: v => v.toFixed(0) + '%', color: '#73726c', font: { size: 9.5 } } },
        }),
    });

    // Rank within tier — top 20 peers
    const peers = (DB.locSummary || [])
        .filter(row => row.Tier === selTier)
        .sort((a, b) => b.Mentions - a.Mentions)
        .slice(0, 20);

    const labels = peers.map(p => shortLoc(p.Location, 36));
    const vals   = peers.map(p => p.Mentions || 0);
    const colors = peers.map(p => p.Location === loc ? P.black : P.grayLt);
    const inTop  = peers.some(p => p.Location === loc);

    document.getElementById('cap-rank').textContent =
        `Top 20 locations in the "${selTier}" tier by total mentions. ` +
        (inTop ? 'Selected location highlighted.' :
                 `Selected location falls outside the top 20 in this tier.`);

    // Resize wrapper height to fit bars
    const wrapH = Math.max(240, peers.length * 28 + 40);
    document.getElementById('ch-rank-wrap').style.height = wrapH + 'px';

    makeChart('ch-rank', {
        type: 'bar',
        data: {
            labels,
            datasets: [{ data: vals, backgroundColor: colors, borderRadius: 1 }],
        },
        options: {
            ...baseOptions(),
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#73726c', font: { size: 9 } },
                     grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                y: { ticks: { color: '#73726c', font: { size: 8.5 } },
                     grid: { display: false }, border: { display: false } },
            },
        },
    });
}

// ── 4. UK vs International ────────────────────────────────────────────────────

function renderUKIntl(loc) {
    const r      = DB.locIndex[loc];
    const isUK   = ['London','Rest of England','Devolved nations'].includes(r?.Tier);
    const ukData = DB.ukIntYear || [];
    const years  = ukData.map(d => d.Year);

    const ukRoll   = rolling(ukData.map(d => (d.UK_Share || 0) * 100),   ROLLING);
    const intlRoll = rolling(ukData.map(d => (d.Intl_Share || 0) * 100), ROLLING);

    // This location's own annual share
    const locYrMap = {};
    (DB.locYearByLoc[loc] || []).forEach(d => { locYrMap[d.Year] = d.Share_of_Year || 0; });
    const locShare = years.map(y => (locYrMap[y] || 0) * 100);

    document.getElementById('cap-uk').textContent =
        `This location falls in the ${r?.Tier || 'Unknown'} tier (${isUK ? 'UK' : 'International'}). ` +
        `Solid lines show the overall UK and international rolling averages. ` +
        `The dashed line shows this location's own annual share.`;

    makeChart('ch-uk', {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                { label: 'UK (rolling avg)', data: ukRoll,
                  borderColor: P.blue, borderWidth: 2, pointRadius: 0,
                  tension: 0.35, fill: false },
                { label: 'International (rolling avg)', data: intlRoll,
                  borderColor: P.coral, borderWidth: 2, pointRadius: 0,
                  tension: 0.35, fill: false },
                { label: shortLoc(loc, 32) + ' share', data: locShare,
                  borderColor: P.black, borderWidth: 1.5, borderDash: [5, 3],
                  pointRadius: 0, tension: 0.35, fill: false },
            ],
        },
        options: baseOptions({
            plugins: {
                legend: {
                    display: true, position: 'bottom',
                    labels: { font: { size: 8.5 }, color: '#73726c',
                              boxWidth: 20, padding: 8 },
                },
            },
            yScale: { ticks: { callback: v => v.toFixed(0) + '%', color: '#73726c', font: { size: 9.5 } } },
        }),
    });
}

// ── 5 & 6. Issue diversity ────────────────────────────────────────────────────

function renderIssueDiversity(loc) {
    const issData = DB.issueDiv || [];
    if (!issData.length) {
        document.getElementById('iss-ctry-wrap').style.display = 'none';
        document.getElementById('iss-loc-wrap').style.display  = 'none';
        document.getElementById('iss-nodata').style.display    = 'block';
        return;
    }

    document.getElementById('iss-nodata').style.display    = 'none';
    document.getElementById('iss-ctry-wrap').style.display = 'block';
    document.getElementById('iss-loc-wrap').style.display  = 'block';

    const locIssues = new Set(DB.locIssuesIndex[loc] || []);

    // Year-level means
    const yearCtry = {}, yearLoc = {}, yearCounts = {};
    issData.forEach(r => {
        if (!yearCtry[r.Year]) { yearCtry[r.Year] = 0; yearLoc[r.Year] = 0; yearCounts[r.Year] = 0; }
        yearCtry[r.Year]   += r.Distinct_Countries || 0;
        yearLoc[r.Year]    += r.Distinct_Locations || 0;
        yearCounts[r.Year] += 1;
    });

    const mYears = Object.keys(yearCtry).map(Number).sort();
    const meanCtry = mYears.map(y => yearCtry[y] / yearCounts[y]);
    const meanLoc  = mYears.map(y => yearLoc[y]  / yearCounts[y]);
    const rollCtry = rolling(meanCtry, ROLLING);
    const rollLoc  = rolling(meanLoc,  ROLLING);

    // Issues that contain this location
    const selIssues = issData.filter(r => locIssues.has(r.Issue));

    function makeIssChart(id, annualRoll, selField, years, yLabel) {
        const ptYears  = selIssues.map(r => r.Year);
        const ptVals   = selIssues.map(r => r[selField] || 0);

        makeChart(id, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'All issues',
                        data: issData.map(r => ({ x: r.Year, y: r[selField] || 0 })),
                        backgroundColor: P.grayLt, pointRadius: 3,
                        pointHoverRadius: 5, order: 3,
                    },
                    {
                        label: `${ROLLING}-yr mean`,
                        data: years.map((y, i) => ({ x: y, y: annualRoll[i] })),
                        type: 'line', borderColor: P.teal,
                        borderWidth: 2, pointRadius: 0, tension: 0.4,
                        fill: false, order: 2,
                    },
                    {
                        label: 'Issues with selected location',
                        data: ptYears.map((y, i) => ({ x: y, y: ptVals[i] })),
                        backgroundColor: P.coral, pointRadius: 6,
                        pointStyle: 'star', order: 1,
                    },
                ],
            },
            options: {
                ...baseOptions(),
                plugins: {
                    legend: {
                        display: true, position: 'bottom',
                        labels: { font: { size: 8.5 }, color: '#73726c',
                                  boxWidth: 14, padding: 6 },
                    },
                },
                scales: {
                    x: { type: 'linear', ticks: { color: '#73726c', font: { size: 9 }, stepSize: 5 },
                         grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                    y: { ticks: { color: '#73726c', font: { size: 9 } },
                         grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false },
                         title: { display: true, text: yLabel, color: '#73726c', font: { size: 9 } } },
                },
            },
        });
    }

    makeIssChart('ch-iss-ctry', rollCtry, 'Distinct_Countries', mYears, 'Distinct countries');
    makeIssChart('ch-iss-loc',  rollLoc,  'Distinct_Locations',  mYears, 'Distinct locations');
}

// ── 7. Ad vs Non-ad ───────────────────────────────────────────────────────────

function renderAdVsNonAd(loc) {
    function makeHBar(id, artType, selLoc) {
        const src    = (DB.artByType[artType] || [])
            .sort((a, b) => b.Mentions - a.Mentions)
            .slice(0, TOP_CHART);
        const labels = src.map(r => shortLoc(r.Location, 36));
        const vals   = src.map(r => r.Mentions || 0);
        const colors = src.map(r => r.Location === selLoc ? P.black : P.grayLt);
        const h      = Math.max(200, src.length * 26 + 40);

        document.getElementById(id.replace('ch-', 'ch-') + '-wrap') &&
            (document.getElementById(id + '-wrap').style.height = h + 'px');

        makeChart(id, {
            type: 'bar',
            data: {
                labels,
                datasets: [{ data: vals, backgroundColor: colors, borderRadius: 1 }],
            },
            options: {
                ...baseOptions(),
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#73726c', font: { size: 9 } },
                         grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                    y: { ticks: { color: '#73726c', font: { size: 8.5 } },
                         grid: { display: false }, border: { display: false } },
                },
            },
        });
    }

    makeHBar('ch-ad',    'Advertisement',    loc);
    makeHBar('ch-nonad', 'Non-advertisement', loc);

    // UK share per type over time
    const artTypes = ['Advertisement', 'Non-advertisement'];
    const artColors = { 'Advertisement': P.blue, 'Non-advertisement': P.teal };
    const allYrs = DB.allYears;

    const datasets = artTypes.map(t => {
        const src = (DB.artYearByType[t] || []).sort((a, b) => a.Year - b.Year);
        const yrMap = {};
        src.forEach(r => { yrMap[r.Year] = r.UK_Share || 0; });
        const vals = allYrs.map(y => (yrMap[y] || 0) * 100);
        return {
            label: t,
            data: rolling(vals, ROLLING),
            borderColor: artColors[t],
            borderWidth: 2, pointRadius: 0, tension: 0.35, fill: false,
        };
    });

    document.getElementById('cap-ad').textContent =
        'UK share of mentions by content type (' + ROLLING + '-year rolling average). ' +
        'Shows whether advertising and editorial content tracked the same geographic patterns.';

    makeChart('ch-uk-type', {
        type: 'line',
        data: { labels: allYrs, datasets },
        options: baseOptions({
            plugins: {
                legend: {
                    display: true, position: 'bottom',
                    labels: { font: { size: 8.5 }, color: '#73726c',
                              boxWidth: 20, padding: 8 },
                },
            },
            yScale: { ticks: { callback: v => v.toFixed(0) + '%', color: '#73726c', font: { size: 9.5 } } },
        }),
    });
}

// ── 8. Co-occurrence ──────────────────────────────────────────────────────────

function renderCoOccurrence(loc) {
    const pairs = (DB.cooc || []).filter(
        r => r.Location_A === loc || r.Location_B === loc
    ).map(r => ({
        partner: r.Location_A === loc ? r.Location_B : r.Location_A,
        together: r.Issues_Together,
        lift: r.Lift,
    })).sort((a, b) => b.Lift - a.Lift).slice(0, 20);

    const chartWrap = document.getElementById('cooc-chart-wrap');
    const tableWrap = document.getElementById('cooc-table-wrap');
    const nodata    = document.getElementById('cooc-nodata');
    const finding   = document.getElementById('cooc-finding');

    if (!pairs.length) {
        chartWrap.style.display = 'none';
        tableWrap.innerHTML     = '';
        nodata.style.display    = 'block';
        finding.textContent     = '';
        return;
    }

    nodata.style.display    = 'none';
    chartWrap.style.display = 'block';

    const top3 = pairs.slice(0, 3);
    finding.textContent =
        `Top co-occurrence partners (by lift): ` +
        top3.map(p => `${shortLoc(p.partner, 40)} (lift ${p.lift.toFixed(2)}, ` +
                       `${p.together} issues together)`).join('; ') + '.';

    const h = Math.max(200, pairs.length * 28 + 60);
    document.getElementById('ch-cooc-wrap').style.height = h + 'px';

    makeChart('ch-cooc', {
        type: 'bar',
        data: {
            labels: pairs.map(p => shortLoc(p.partner, 38)),
            datasets: [{
                data: pairs.map(p => p.lift),
                backgroundColor: pairs.map(p => p.lift >= 2 ? P.teal : P.blueLt),
                borderRadius: 1,
            }],
        },
        options: {
            ...baseOptions(),
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                annotation: {
                    annotations: {
                        chance: {
                            type: 'line', scaleID: 'x', value: 1,
                            borderColor: P.coral, borderWidth: 1.5,
                            borderDash: [5, 3],
                        },
                    },
                },
            },
            scales: {
                x: { ticks: { color: '#73726c', font: { size: 9 } },
                     grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                y: { ticks: { color: '#73726c', font: { size: 8.5 } },
                     grid: { display: false }, border: { display: false } },
            },
        },
    });

    // Table
    const rows = pairs.slice(0, 12).map(p => `
        <tr>
            <td>${p.partner}</td>
            <td style="text-align:right">${p.together}</td>
            <td style="text-align:right">${p.lift.toFixed(2)}</td>
        </tr>`).join('');

    tableWrap.innerHTML = `
        <table class="cooc-table" style="margin-top:1.25rem">
            <thead>
                <tr>
                    <th>Partner location</th>
                    <th style="text-align:right">Issues together</th>
                    <th style="text-align:right">Lift score</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

// ── 9. Debut year ─────────────────────────────────────────────────────────────

function renderDebut(loc) {
    const debutData  = DB.debut || [];
    const debutRow   = debutData.find(
        r => (r.New_Loc_List || '').split('|').includes(loc)
    );
    const debutYear  = debutRow?.Year || null;
    const years      = debutData.map(r => r.Year);
    const newLocs    = debutData.map(r => r.New_Locations || 0);
    const cumul      = debutData.map(r => r.Cumulative || 0);

    const finding  = document.getElementById('debut-finding');
    const cap      = document.getElementById('cap-debut');

    if (debutYear) {
        const atCumul = debutRow?.Cumulative || 0;
        const newThat = debutRow?.New_Locations || 0;
        finding.textContent =
            `${shortLoc(loc, 55)} first appeared in ${debutYear}, alongside ` +
            `${(newThat - 1).toLocaleString()} other new locations that year. ` +
            `The cumulative vocabulary stood at ${atCumul.toLocaleString()} distinct locations at that point.`;
    } else {
        finding.textContent = 'First appearance year could not be determined from the debut table.';
    }

    cap.textContent = 'Bars: new locations per year. Line: cumulative distinct locations (right axis). ' +
        (debutYear ? `Vertical marker shows ${shortLoc(loc, 40)}'s first appearance (${debutYear}).` : '');

    makeChart('ch-debut', {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                { label: 'New locations', data: newLocs,
                  backgroundColor: P.purpleLt, borderRadius: 1, order: 2, yAxisID: 'y' },
                { label: 'Cumulative', data: cumul, type: 'line',
                  borderColor: P.purple, borderWidth: 2, pointRadius: 0,
                  tension: 0.4, fill: false, order: 1, yAxisID: 'y2' },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true, position: 'bottom',
                    labels: { font: { size: 8.5 }, color: '#73726c',
                              boxWidth: 20, padding: 8 },
                },
                annotation: debutYear ? {
                    annotations: {
                        debutLine: {
                            type: 'line', scaleID: 'x',
                            value: years.indexOf(debutYear),
                            borderColor: P.coral, borderWidth: 1.5,
                            borderDash: [5, 3],
                        },
                    },
                } : {},
            },
            scales: {
                x: { ticks: { color: '#73726c', font: { size: 9.5 } },
                     grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
                y: { ticks: { color: '#73726c', font: { size: 9.5 } },
                     grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false },
                     title: { display: true, text: 'New locations', color: '#73726c', font: { size: 9 } } },
                y2: { position: 'right', ticks: { color: P.purple, font: { size: 9.5 } },
                      grid: { display: false }, border: { display: false },
                      title: { display: true, text: 'Cumulative', color: P.purple, font: { size: 9 } } },
            },
        },
    });
}

// ════════════════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════════════════

loadAll().catch(err => {
    console.error('Failed to load location explorer data:', err);
    document.getElementById('header-meta').textContent =
        'Error loading data — check that the assets/data/ folder is present.';
});
