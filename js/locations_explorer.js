// locations_explorer.js
// Supports up to 10 simultaneous locations with a dynamic slot system,
// smart dropdown ordering (starts-with before contains), and chunked
// co-occurrence loading.

// ── Data paths ────────────────────────────────────────────────────────────────

const DATA = {
    locSummary:  'assets/data/loc_summary.json',
    locYear:     'assets/data/loc_year.json',
    ukIntYear:   'assets/data/uk_int_year.json',
    tierYear:    'assets/data/tier_year.json',
    issueDiv:    'assets/data/issue_diversity.json',
    artTypeLoc:  'assets/data/art_type_loc.json',
    artTypeYear: 'assets/data/art_type_year.json',
    debut:       'assets/data/debut_year.json',
    locIssues:   'assets/data/loc_issues.json',
    locList:     'assets/data/location_list.json',
    coocManifest:'assets/data/cooc/manifest.json',
};

// ── Palette — 10 distinct colours ────────────────────────────────────────────
// Designed to be distinguishable against the cream (#fdfaf3) background.

const PALETTE = [
    '#2c2c2c', // 0  charcoal  (site primary)
    '#b8860b', // 1  dark gold
    '#1D9E75', // 2  teal
    '#D85A30', // 3  coral
    '#7F77DD', // 4  purple
    '#185FA5', // 5  blue
    '#639922', // 6  green
    '#D4537E', // 7  pink
    '#BA7517', // 8  amber
    '#5F5E5A', // 9  dark gray
];
const DASH_STYLES = [
    [],           // solid
    [6, 3],       // dashed
    [3, 3],       // dotted
    [8, 2, 2, 2], // dash-dot
    [10, 3],      // long dash
    [4, 2],       // short dash
    [1, 3],       // very dotted
    [8, 3, 3, 3], // dash-dot-dot
    [12, 4],      // very long dash
    [2, 2],       // fine dot
];

const MAX_LOCS = 10;
const ROLLING  = 5;
const TOP_CHART = 15;

const P = {
    teal:'#1D9E75', tealLt:'#9FE1CB',
    blue:'#378ADD', grayLt:'#D3D1C7',
    purple:'#7F77DD', coral:'#D85A30',
};
const TIER_COLORS = {
    'London':P.blue, 'Rest of England':P.teal,
    'Devolved nations':P.purple, 'International':P.coral,
    'Unknown':P.grayLt,
};

// ── State ─────────────────────────────────────────────────────────────────────

let DB      = {};
let charts  = {};
let selected = [];  // ordered array of location strings (max 10)

// ── Utilities ─────────────────────────────────────────────────────────────────

function cleanJSON(t){ return t.replace(/:\s*NaN\s*([,\}])/g,': null$1'); }

async function loadJSON(url){
    const r = await fetch(url);
    if(!r.ok) throw new Error(r.status+' '+url);
    return JSON.parse(cleanJSON(await r.text()));
}

function roll(arr, w){
    return arr.map((_,i)=>{
        const sl = arr.slice(Math.max(0,i-Math.floor(w/2)), i+Math.ceil(w/2));
        const vs = sl.filter(v=>v!=null);
        return vs.length ? vs.reduce((a,b)=>a+b,0)/vs.length : null;
    });
}
function short(loc,n=40){
    if(!loc) return '';
    const s=loc.split(',')[0].trim();
    return s.length<=n?s:s.slice(0,n-1)+'…';
}
function pct(v){ return v!=null?(v*100).toFixed(1)+'%':'—'; }
function color(i){ return PALETTE[i%PALETTE.length]; }
function dash(i) { return DASH_STYLES[i%DASH_STYLES.length]; }

function destroyChart(id){ if(charts[id]){charts[id].destroy();delete charts[id];} }
function mkChart(id,cfg){
    destroyChart(id);
    const c=document.getElementById(id);
    if(!c) return;
    charts[id]=new Chart(c,cfg);
}
function baseOpts(extra={}){
    return {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, ...extra.plugins },
        scales:{
            x:{ ticks:{color:'#73726c',font:{size:9.5}},
                grid:{color:'rgba(0,0,0,0.05)'}, border:{display:false}, ...extra.xScale },
            y:{ ticks:{color:'#73726c',font:{size:9.5}},
                grid:{color:'rgba(0,0,0,0.05)'}, border:{display:false}, ...extra.yScale },
        },
        ...extra,
    };
}

function makeLegend(containerId, items){
    // items: [{color, dash, label}]
    const el = document.getElementById(containerId);
    if(!el) return;
    el.innerHTML = items.map(it=>{
        const dashStyle = it.dash&&it.dash.length
            ? `background:repeating-linear-gradient(90deg,${it.color} 0,${it.color} ${it.dash[0]}px,transparent ${it.dash[0]}px,transparent ${it.dash[0]+(it.dash[1]||4)}px)`
            : `background:${it.color}`;
        return `<span><span class="legend-line" style="${dashStyle}"></span>${it.label}</span>`;
    }).join('');
}

// ── Load all data ─────────────────────────────────────────────────────────────

async function loadAll(){
    const entries = Object.entries(DATA).filter(([k])=>k!=='coocManifest');
    const results = await Promise.all(entries.map(async([k,url])=>{
        try{ return [k, await loadJSON(url)]; } catch{ return [k,[]]; }
    }));
    results.forEach(([k,v])=>{ DB[k]=v; });

    // Build indexes
    DB.locIndex = {};
    (DB.locSummary||[]).forEach(r=>{ DB.locIndex[r.Location]=r; });

    DB.locYearByLoc = {};
    (DB.locYear||[]).forEach(r=>{
        if(!DB.locYearByLoc[r.Location]) DB.locYearByLoc[r.Location]=[];
        DB.locYearByLoc[r.Location].push(r);
    });

    DB.artByType = {};
    (DB.artTypeLoc||[]).forEach(r=>{
        if(!DB.artByType[r.Art_Type]) DB.artByType[r.Art_Type]=[];
        DB.artByType[r.Art_Type].push(r);
    });

    DB.artYearByType = {};
    (DB.artTypeYear||[]).forEach(r=>{
        if(!DB.artYearByType[r.Art_Type]) DB.artYearByType[r.Art_Type]=[];
        DB.artYearByType[r.Art_Type].push(r);
    });

    DB.locIssuesIndex = {};
    (DB.locIssues||[]).forEach(r=>{ DB.locIssuesIndex[r.Location]=r.Issues||[]; });

    const yrs = (DB.ukIntYear||[]).map(r=>r.Year).filter(Boolean).sort();
    DB.yrMin = yrs[0]||1926;
    DB.yrMax = yrs[yrs.length-1]||1986;
    DB.allYears = Array.from({length:DB.yrMax-DB.yrMin+1},(_,i)=>DB.yrMin+i);

    // Co-occurrence chunks
    DB.cooc = [];
    try{
        const manifest = await loadJSON(DATA.coocManifest);
        const fetched  = await Promise.all(
            Array.from({length:manifest.chunks||0},(_,i)=>
                loadJSON(`assets/data/cooc/cooc_${String(i).padStart(3,'0')}.json`).catch(()=>[])
            )
        );
        DB.cooc = fetched.flat();
    } catch(e){ DB.cooc=[]; }

    const nLocs = (DB.locSummary||[]).length;
    const nRecs = (DB.locSummary||[]).reduce((s,r)=>s+(r.Mentions||0),0);
    document.getElementById('header-meta').textContent =
        `${DB.yrMin}–${DB.yrMax} · ${nRecs.toLocaleString()} records · ${nLocs.toLocaleString()} distinct locations`;

    buildSlots(DB.locList||[]);
}

// ── Slot system ───────────────────────────────────────────────────────────────

let allLocs = [];

function buildSlots(locs){
    allLocs = locs;
    renderSlots();
}

function renderSlots(){
    const container = document.getElementById('slots');
    container.innerHTML = '';

    // One slot per selected location (filled, showing label + remove)
    selected.forEach((loc, i)=>{
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.innerHTML = `
            <div class="slot-swatch" style="background:${color(i)}"></div>
            <div class="slot-filled-label" title="${loc}">${short(loc,60)}</div>
            <span class="slot-remove" title="Remove" onclick="removeLoc(${i})">✕</span>`;
        container.appendChild(slot);
    });

    // One empty search slot (if under limit)
    if(selected.length < MAX_LOCS){
        const slotId = 'slot-new';
        const ddId   = 'dd-new';
        const slot   = document.createElement('div');
        slot.className = 'slot';
        const num = selected.length+1;
        slot.innerHTML = `
            <div class="slot-swatch" style="background:${color(selected.length)}"></div>
            <div class="slot-inner">
                <input type="text" id="${slotId}"
                       placeholder="${selected.length===0?'Type to search locations…':'Add another location…'}"
                       autocomplete="off">
                <div class="loc-dropdown" id="${ddId}"></div>
            </div>`;
        container.appendChild(slot);
        attachDropdown(slotId, ddId);
    } else {
        const cap = document.createElement('div');
        cap.style.cssText = 'font-family:Georgia,serif;font-size:0.82rem;color:#999;font-style:italic;padding:0.3rem 0';
        cap.textContent = 'Maximum of 10 locations reached. Remove one to add another.';
        container.appendChild(cap);
    }

    renderPills();
}

function attachDropdown(inputId, ddId){
    const input  = document.getElementById(inputId);
    const dd     = document.getElementById(ddId);
    if(!input||!dd) return;
    let active = -1;

    function getMatches(q){
        if(!q||q.length<1) return {sw:[],inc:[]};
        const ql  = q.toLowerCase();
        const pool = allLocs.filter(l=>!selected.includes(l));
        return {
            sw:  pool.filter(l=>l.toLowerCase().startsWith(ql)).slice(0,50),
            inc: pool.filter(l=>!l.toLowerCase().startsWith(ql)&&l.toLowerCase().includes(ql)).slice(0,50),
        };
    }

    function show(q){
        const {sw,inc} = getMatches(q);
        dd.innerHTML=''; active=-1;
        if(!sw.length&&!inc.length){ dd.style.display='none'; return; }

        function addItem(loc){
            const div=document.createElement('div');
            div.className='dd-item';
            div.textContent=loc;
            div.addEventListener('mousedown',e=>{ e.preventDefault(); pickLoc(loc); });
            dd.appendChild(div);
        }
        function addGroup(label){
            const div=document.createElement('div');
            div.className='dd-group-label';
            div.textContent=label;
            dd.appendChild(div);
        }

        if(sw.length){ if(inc.length) addGroup('Starting with "'+q+'"'); sw.forEach(addItem); }
        if(inc.length){ if(sw.length) addGroup('Also containing "'+q+'"'); inc.forEach(addItem); }
        dd.style.display='block';
    }

    function items(){ return [...dd.querySelectorAll('.dd-item')]; }

    input.addEventListener('input',()=>show(input.value));
    input.addEventListener('focus',()=>{ if(input.value.length>=1) show(input.value); });
    input.addEventListener('blur', ()=>setTimeout(()=>{ dd.style.display='none'; },130));
    input.addEventListener('keydown',e=>{
        const its=items();
        if(e.key==='ArrowDown'){ active=Math.min(active+1,its.length-1); its.forEach((el,i)=>el.classList.toggle('active',i===active)); }
        else if(e.key==='ArrowUp'){ active=Math.max(active-1,0); its.forEach((el,i)=>el.classList.toggle('active',i===active)); }
        else if(e.key==='Enter'&&active>=0){ pickLoc(its[active].textContent); }
        else if(e.key==='Escape'){ dd.style.display='none'; }
    });
}

function pickLoc(loc){
    if(selected.includes(loc)||selected.length>=MAX_LOCS) return;
    selected.push(loc);
    renderSlots();
    triggerRender();
}

function removeLoc(i){
    selected.splice(i,1);
    renderSlots();
    if(selected.length===0){
        document.getElementById('placeholder').style.display='block';
        document.getElementById('content').style.display='none';
        Object.keys(charts).forEach(destroyChart);
    } else {
        triggerRender();
    }
}

function renderPills(){
    const el = document.getElementById('active-pills');
    el.innerHTML = selected.map((loc,i)=>
        `<span class="active-pill" style="background:${color(i)}">
            ${short(loc,45)}
            <span class="pill-x" onclick="removeLoc(${i})">✕</span>
        </span>`
    ).join('');
}

// ── Trigger render ────────────────────────────────────────────────────────────

function triggerRender(){
    if(!selected.length) return;
    document.getElementById('placeholder').style.display='none';
    document.getElementById('content').style.display='block';
    renderOverview();
    renderMentionsTime();
    renderGeoContext();
    renderUKIntl();
    renderIssueDiversity();
    renderAdVsNonAd();
    renderCoOccurrence();
    renderDebut();
}

// ── I. Overview ───────────────────────────────────────────────────────────────

function tierPill(tier){
    const key=tier==='Rest of England'?'Rest':tier.split(' ')[0];
    return `<span class="tier-pill tier-${key}">${tier}</span>`;
}

function renderOverview(){
    const grid = document.getElementById('overview-cards');
    grid.innerHTML = selected.map((loc,i)=>{
        const r = DB.locIndex[loc];
        if(!r) return `<div class="overview-card"><div class="overview-card-hdr" style="background:${color(i)}">${short(loc,40)}</div><div class="overview-card-body"><div class="no-data">No data found.</div></div></div>`;
        const shift = r.Shift||0;
        const shiftLabel = shift>0?'▲ Growing':shift<0?'▼ Declining':'→ Stable';
        const shiftCol   = shift>0?P.teal:shift<0?P.coral:'#888';
        return `<div class="overview-card">
            <div class="overview-card-hdr" style="background:${color(i)}" title="${loc}">${short(loc,38)}</div>
            <div class="overview-card-body">
                <div class="ov-row"><span class="ov-key">Rank</span><span>#${r.Rank} of ${(DB.locSummary||[]).length.toLocaleString()}</span></div>
                <div class="ov-row"><span class="ov-key">Mentions</span><span>${(r.Mentions||0).toLocaleString()} (${pct(r.Pct_of_Total)})</span></div>
                <div class="ov-row"><span class="ov-key">Tier</span><span>${tierPill(r.Tier||'Unknown')}</span></div>
                <div class="ov-row"><span class="ov-key">Country</span><span>${r.Country||'—'}</span></div>
                <div class="ov-row"><span class="ov-key">Years</span><span>${r.First_Year||'—'}–${r.Last_Year||'—'}</span></div>
                <div class="ov-row"><span class="ov-key">Issues</span><span>${(r.Issues_Count||0).toLocaleString()}</span></div>
                <div class="ov-row"><span class="ov-key">Ad share</span><span>${pct(r.Ad_Share)}</span></div>
                <div class="ov-row"><span class="ov-key">Shift</span><span style="color:${shiftCol}">${shiftLabel} (${(shift*100).toFixed(2)}pp)</span></div>
            </div>
        </div>`;
    }).join('');

    // Finding sentence
    const sorted = selected.slice().sort((a,b)=>(DB.locIndex[b]?.Mentions||0)-(DB.locIndex[a]?.Mentions||0));
    const top    = sorted[0];
    const rTop   = DB.locIndex[top];
    let finding  = '';
    if(selected.length===1 && rTop){
        finding = `${short(top,55)} is ranked #${rTop.Rank} overall with ${(rTop.Mentions||0).toLocaleString()} mentions (${pct(rTop.Pct_of_Total)} of all records). It falls within the ${rTop.Tier} tier and spans ${rTop.First_Year}–${rTop.Last_Year}.`;
    } else if(rTop){
        finding = `Of the ${selected.length} selected locations, ${short(top,40)} has the most mentions (${(rTop.Mentions||0).toLocaleString()}). `;
        const last = sorted[sorted.length-1];
        const rLast = DB.locIndex[last];
        if(rLast && last!==top) finding += `${short(last,40)} has the fewest (${(rLast.Mentions||0).toLocaleString()}).`;
    }
    document.getElementById('overview-finding').textContent = finding;
}

// ── II. Mentions over time ─────────────────────────────────────────────────────

function renderMentionsTime(){
    const allYrs = DB.allYears;

    // Absolute
    const absDs = [];
    selected.forEach((loc,i)=>{
        const m={};
        (DB.locYearByLoc[loc]||[]).forEach(r=>{ m[r.Year]=r.Mentions||0; });
        const vals = allYrs.map(y=>m[y]||0);
        absDs.push({label:short(loc,34),data:vals,
            backgroundColor:color(i)+'55',borderColor:color(i),
            borderWidth:1.2,borderRadius:1,order:10+i,type:'bar'});
        absDs.push({label:short(loc,34)+' avg',data:roll(vals,ROLLING),type:'line',
            borderColor:color(i),borderWidth:2,borderDash:dash(i),
            pointRadius:0,tension:0.4,fill:false,order:i});
    });

    makeLegend('legend-abs', selected.map((loc,i)=>({
        color:color(i), dash:dash(i), label:short(loc,38)})));
    document.getElementById('cap-abs').textContent =
        `Annual mention counts with ${ROLLING}-year rolling averages.`;
    mkChart('ch-abs',{type:'bar',data:{labels:allYrs,datasets:absDs},options:baseOpts()});

    // Share — top 8 context + selected
    const top8 = (DB.locSummary||[]).sort((a,b)=>b.Mentions-a.Mentions).slice(0,8).map(r=>r.Location);
    const context = [...new Set([...top8,...selected])];
    const shareDs = context.map((loc)=>{
        const selIdx = selected.indexOf(loc);
        const isSel  = selIdx>=0;
        const lym={};
        (DB.locYearByLoc[loc]||[]).forEach(r=>{ lym[r.Year]=(r.Share_of_Year||0)*100; });
        return {
            label: short(loc,34),
            data:  allYrs.map(y=>lym[y]||0),
            borderColor: isSel ? color(selIdx) : '#ccc',
            borderWidth: isSel ? 2.5 : 0.8,
            borderDash:  isSel ? dash(selIdx) : [],
            pointRadius: 0, tension:0.3, fill:false,
        };
    });

    makeLegend('legend-share', selected.map((loc,i)=>({
        color:color(i), dash:dash(i), label:short(loc,38)})));
    mkChart('ch-share',{type:'line',data:{labels:allYrs,datasets:shareDs},
        options:baseOpts({yScale:{ticks:{callback:v=>v.toFixed(1)+'%',color:'#73726c',font:{size:9.5}}}})});
}

// ── III. Geographic tier context ──────────────────────────────────────────────

function renderGeoContext(){
    const tierOrder = ['London','Rest of England','Devolved nations','International'];
    const tierYr    = DB.tierYear||[];
    const years     = tierYr.map(r=>r.Year);
    const selTiers  = [...new Set(selected.map(l=>DB.locIndex[l]?.Tier).filter(Boolean))];

    const tierDs = tierOrder.map(t=>{
        const vals = tierYr.map(r=>(r[t]||0)*100);
        const isSel = selTiers.includes(t);
        return {label:t,data:roll(vals,ROLLING),borderColor:TIER_COLORS[t]||P.grayLt,
                borderWidth:isSel?2.8:1,pointRadius:0,tension:0.35,fill:false,
                borderDash:isSel?[]:[4,3]};
    });
    mkChart('ch-tier',{type:'line',data:{labels:years,datasets:tierDs},
        options:baseOpts({plugins:{legend:{display:true,position:'bottom',
            labels:{font:{size:8.5},color:'#73726c',boxWidth:20,padding:6}}},
            yScale:{ticks:{callback:v=>v.toFixed(0)+'%',color:'#73726c',font:{size:9.5}}}})});

    // Rank chart — use first selected location's tier
    const refLoc  = selected[0];
    const refTier = DB.locIndex[refLoc]?.Tier||'Unknown';
    const peers   = (DB.locSummary||[]).filter(r=>r.Tier===refTier)
                        .sort((a,b)=>b.Mentions-a.Mentions).slice(0,20);
    const labels  = peers.map(p=>short(p.Location,34));
    const vals    = peers.map(p=>p.Mentions||0);
    const bgColors = peers.map(p=>{
        const si = selected.indexOf(p.Location);
        return si>=0 ? color(si) : P.grayLt;
    });
    const h = Math.max(260, peers.length*28+40);
    document.getElementById('ch-rank-wrap').style.height=h+'px';
    document.getElementById('cap-rank').textContent =
        `Top 20 in the "${refTier}" tier. Selected location(s) highlighted in their assigned colour.`;
    mkChart('ch-rank',{type:'bar',data:{labels,datasets:[{data:vals,backgroundColor:bgColors,borderRadius:1}]},
        options:{...baseOpts(),indexAxis:'y',plugins:{legend:{display:false}},
            scales:{x:{ticks:{color:'#73726c',font:{size:9}},grid:{color:'rgba(0,0,0,0.05)'},border:{display:false}},
                    y:{ticks:{color:'#73726c',font:{size:8.5}},grid:{display:false},border:{display:false}}}}});
}

// ── IV. UK vs International ────────────────────────────────────────────────────

function renderUKIntl(){
    const ukData = DB.ukIntYear||[];
    const years  = ukData.map(d=>d.Year);
    const ukRoll = roll(ukData.map(d=>(d.UK_Share||0)*100),ROLLING);
    const inRoll = roll(ukData.map(d=>(d.Intl_Share||0)*100),ROLLING);

    const ds = [
        {label:'UK overall',data:ukRoll,borderColor:'#aaa',borderWidth:1.5,
         borderDash:[],pointRadius:0,tension:0.35,fill:false},
        {label:'International overall',data:inRoll,borderColor:'#ccc',borderWidth:1.5,
         borderDash:[4,3],pointRadius:0,tension:0.35,fill:false},
    ];

    selected.forEach((loc,i)=>{
        const m={};
        (DB.locYearByLoc[loc]||[]).forEach(r=>{ m[r.Year]=(r.Share_of_Year||0)*100; });
        ds.push({label:short(loc,34),data:years.map(y=>m[y]||0),
            borderColor:color(i),borderWidth:2,borderDash:dash(i),
            pointRadius:0,tension:0.35,fill:false});
    });

    makeLegend('legend-uk', selected.map((loc,i)=>({
        color:color(i), dash:dash(i), label:short(loc,38)})));

    const tierInfo = selected.map(l=>`${short(l,28)}: ${DB.locIndex[l]?.Tier||'?'}`).join(' · ');
    document.getElementById('cap-uk').textContent =
        'Grey lines = overall UK / International rolling averages. Coloured lines = selected location shares. '+tierInfo+'.';

    mkChart('ch-uk',{type:'line',data:{labels:years,datasets:ds},
        options:baseOpts({yScale:{ticks:{callback:v=>v.toFixed(0)+'%',color:'#73726c',font:{size:9.5}}}})});
}

// ── V & VI. Issue diversity ────────────────────────────────────────────────────

function renderIssueDiversity(){
    const issData = DB.issueDiv||[];
    if(!issData.length){
        ['iss-ctry-wrap','iss-loc-wrap'].forEach(id=>document.getElementById(id).style.display='none');
        document.getElementById('iss-nodata').style.display='block';
        return;
    }
    ['iss-ctry-wrap','iss-loc-wrap'].forEach(id=>document.getElementById(id).style.display='block');
    document.getElementById('iss-nodata').style.display='none';

    const yearCtry={},yearLoc={},yearCnt={};
    issData.forEach(r=>{
        yearCtry[r.Year]=(yearCtry[r.Year]||0)+(r.Distinct_Countries||0);
        yearLoc[r.Year] =(yearLoc[r.Year] ||0)+(r.Distinct_Locations||0);
        yearCnt[r.Year] =(yearCnt[r.Year] ||0)+1;
    });
    const mYears = Object.keys(yearCtry).map(Number).sort();
    const rollC  = roll(mYears.map(y=>yearCtry[y]/yearCnt[y]),ROLLING);
    const rollL  = roll(mYears.map(y=>yearLoc[y] /yearCnt[y]),ROLLING);

    function makeIssChart(id, rollVals, field){
        const ds = [
            {label:'All issues',type:'scatter',
             data:issData.map(r=>({x:r.Year,y:r[field]||0})),
             backgroundColor:P.grayLt,pointRadius:3,order:99},
            {label:`${ROLLING}-yr mean`,type:'line',
             data:mYears.map((y,i)=>({x:y,y:rollVals[i]})),
             borderColor:'#888',borderWidth:1.5,pointRadius:0,tension:0.4,fill:false,order:98},
        ];
        selected.forEach((loc,i)=>{
            const locIss = new Set(DB.locIssuesIndex[loc]||[]);
            const pts = issData.filter(r=>locIss.has(r.Issue));
            if(pts.length) ds.push({
                label:short(loc,28),type:'scatter',
                data:pts.map(r=>({x:r.Year,y:r[field]||0})),
                backgroundColor:color(i),pointRadius:6,pointStyle:'star',order:i});
        });
        mkChart(id,{type:'scatter',data:{datasets:ds},options:{
            ...baseOpts({plugins:{legend:{display:true,position:'bottom',
                labels:{font:{size:8.5},color:'#73726c',boxWidth:14,padding:5}}}}),
            scales:{x:{type:'linear',ticks:{color:'#73726c',font:{size:9},stepSize:10},
                       grid:{color:'rgba(0,0,0,0.05)'},border:{display:false}},
                    y:{ticks:{color:'#73726c',font:{size:9}},
                       grid:{color:'rgba(0,0,0,0.05)'},border:{display:false}}}}});
    }
    makeIssChart('ch-iss-ctry',rollC,'Distinct_Countries');
    makeIssChart('ch-iss-loc', rollL,'Distinct_Locations');
}

// ── VII. Ad vs Non-ad ─────────────────────────────────────────────────────────

function renderAdVsNonAd(){
    function hBar(id, artType){
        const src    = (DB.artByType[artType]||[]).sort((a,b)=>b.Mentions-a.Mentions).slice(0,TOP_CHART);
        const labels = src.map(r=>short(r.Location,34));
        const vals   = src.map(r=>r.Mentions||0);
        const bgc    = src.map(r=>{
            const si = selected.indexOf(r.Location);
            return si>=0 ? color(si) : P.grayLt;
        });
        const h = Math.max(200,src.length*26+40);
        document.getElementById(id+'-wrap').style.height=h+'px';
        mkChart(id,{type:'bar',data:{labels,datasets:[{data:vals,backgroundColor:bgc,borderRadius:1}]},
            options:{...baseOpts(),indexAxis:'y',plugins:{legend:{display:false}},
                scales:{x:{ticks:{color:'#73726c',font:{size:9}},grid:{color:'rgba(0,0,0,0.05)'},border:{display:false}},
                        y:{ticks:{color:'#73726c',font:{size:8.5}},grid:{display:false},border:{display:false}}}}});
    }
    hBar('ch-ad',   'Advertisement');
    hBar('ch-nonad','Non-advertisement');

    const artTypes  = ['Advertisement','Non-advertisement'];
    const artColors = {'Advertisement':'#888','Non-advertisement':'#bbb'};
    const artDashes = {'Advertisement':[],'Non-advertisement':[5,3]};
    const ds = artTypes.map(t=>{
        const m={};
        (DB.artYearByType[t]||[]).forEach(r=>{ m[r.Year]=r.UK_Share||0; });
        return {label:t,data:roll(DB.allYears.map(y=>(m[y]||0)*100),ROLLING),
                borderColor:artColors[t],borderDash:artDashes[t],
                borderWidth:1.5,pointRadius:0,tension:0.35,fill:false};
    });
    document.getElementById('cap-ad').textContent =
        'UK share of mentions by content type ('+ROLLING+'-year rolling average).';
    mkChart('ch-uk-type',{type:'line',data:{labels:DB.allYears,datasets:ds},
        options:baseOpts({plugins:{legend:{display:true,position:'bottom',
            labels:{font:{size:8.5},color:'#73726c',boxWidth:20,padding:7}}},
            yScale:{ticks:{callback:v=>v.toFixed(0)+'%',color:'#73726c',font:{size:9.5}}}})});
}

// ── VIII. Co-occurrence ────────────────────────────────────────────────────────

function renderCoOccurrence(){
    const container = document.getElementById('cooc-charts');
    const nodata    = document.getElementById('cooc-nodata');
    const finding   = document.getElementById('cooc-finding');
    container.innerHTML='';

    const allPairs = selected.map((loc,i)=>{
        const pairs = (DB.cooc||[])
            .filter(r=>r.Location_A===loc||r.Location_B===loc)
            .map(r=>({partner:r.Location_A===loc?r.Location_B:r.Location_A,
                       together:r.Issues_Together,lift:r.Lift}))
            .sort((a,b)=>b.Lift-a.Lift).slice(0,15);
        return {loc,i,pairs};
    }).filter(d=>d.pairs.length>0);

    if(!allPairs.length){
        nodata.style.display='block';
        container.style.display='none';
        finding.textContent='';
        return;
    }
    nodata.style.display='none';
    container.style.display='block';

    finding.textContent = allPairs.map(({loc,pairs})=>{
        const top=pairs[0];
        return top ? `${short(loc,35)}: top partner ${short(top.partner,30)} (lift ${top.lift.toFixed(2)})` : '';
    }).filter(Boolean).join(' · ');

    // One figure block per selected location
    allPairs.forEach(({loc,i,pairs},blockIdx)=>{
        const canvasId = `ch-cooc-${blockIdx}`;
        const tableId  = `cooc-tbl-${blockIdx}`;
        const h = Math.max(180, pairs.length*28+50);

        const wrapper = document.createElement('div');
        wrapper.className = 'figure-block';
        wrapper.style.marginBottom = '1rem';
        wrapper.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:0.5rem">
                <div style="width:12px;height:12px;background:${color(i)};border-radius:2px;flex-shrink:0"></div>
                <strong style="font-family:Georgia;font-size:0.88rem">${short(loc,60)}</strong>
            </div>
            <div class="chart-wrap" style="height:${h}px"><canvas id="${canvasId}"></canvas></div>
            <div class="figure-caption">Lift score per partner. Darker bar = lift ≥ 2.</div>
            <div id="${tableId}"></div>`;
        container.appendChild(wrapper);

        mkChart(canvasId,{type:'bar',
            data:{labels:pairs.map(p=>short(p.partner,36)),
                  datasets:[{data:pairs.map(p=>p.lift),
                      backgroundColor:pairs.map(p=>p.lift>=2?color(i):color(i)+'66'),
                      borderRadius:1}]},
            options:{...baseOpts(),indexAxis:'y',plugins:{legend:{display:false}},
                scales:{x:{ticks:{color:'#73726c',font:{size:9}},grid:{color:'rgba(0,0,0,0.05)'},border:{display:false}},
                        y:{ticks:{color:'#73726c',font:{size:8.5}},grid:{display:false},border:{display:false}}}}});

        const rows = pairs.slice(0,10).map(p=>
            `<tr><td>${p.partner}</td>
             <td style="text-align:right">${p.together}</td>
             <td style="text-align:right">${p.lift.toFixed(2)}</td></tr>`).join('');
        document.getElementById(tableId).innerHTML =
            `<table class="cooc-table" style="margin-top:0.6rem"><thead>
             <tr><th>Partner location</th>
             <th style="text-align:right">Issues together</th>
             <th style="text-align:right">Lift</th></tr>
             </thead><tbody>${rows}</tbody></table>`;
    });
}

// ── IX. Debut ─────────────────────────────────────────────────────────────────

function renderDebut(){
    const debut  = DB.debut||[];
    const years  = debut.map(r=>r.Year);
    const newL   = debut.map(r=>r.New_Locations||0);
    const cumul  = debut.map(r=>r.Cumulative||0);

    function findDebut(loc){
        const r=debut.find(r=>(r.New_Loc_List||'').split('|').includes(loc));
        return r?r.Year:null;
    }

    const debutParts = [];
    selected.forEach((loc,i)=>{
        const dy = findDebut(loc);
        if(dy) debutParts.push(`${short(loc,35)} first appeared in ${dy}`);
    });
    document.getElementById('debut-finding').textContent =
        debutParts.length ? debutParts.join('; ')+'.' : '';

    document.getElementById('cap-debut').textContent =
        'Bars: new locations per year. Line: cumulative total (right axis). '+
        'Vertical markers show first appearance year for each selected location.';

    const ds = [
        {label:'New locations',data:newL,backgroundColor:'#AFA9EC',borderRadius:1,order:10,yAxisID:'y',type:'bar'},
        {label:'Cumulative',data:cumul,type:'line',borderColor:'#7F77DD',borderWidth:2,
         pointRadius:0,tension:0.4,fill:false,order:0,yAxisID:'y2'},
    ];

    mkChart('ch-debut',{type:'bar',data:{labels:years,datasets:ds},
        options:{responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:true,position:'bottom',
                labels:{font:{size:8.5},color:'#73726c',boxWidth:20,padding:7}},
                annotation:{annotations:Object.fromEntries(
                    selected.map((loc,i)=>{
                        const dy=findDebut(loc);
                        if(!dy) return [null,null];
                        const xi=years.indexOf(dy);
                        return [`line${i}`,{type:'line',scaleID:'x',value:xi,
                            borderColor:color(i),borderWidth:2,borderDash:[5,3]}];
                    }).filter(([k])=>k!==null)
                )}},
            scales:{
                x:{ticks:{color:'#73726c',font:{size:9.5}},grid:{color:'rgba(0,0,0,0.05)'},border:{display:false}},
                y:{ticks:{color:'#73726c',font:{size:9.5}},grid:{color:'rgba(0,0,0,0.05)'},border:{display:false},
                   title:{display:true,text:'New locations',color:'#73726c',font:{size:9}}},
                y2:{position:'right',ticks:{color:'#7F77DD',font:{size:9.5}},
                    grid:{display:false},border:{display:false},
                    title:{display:true,text:'Cumulative',color:'#7F77DD',font:{size:9}}},
            }}});
}

// ── Boot ──────────────────────────────────────────────────────────────────────

loadAll().catch(err=>{
    console.error('Failed to load explorer data:',err);
    document.getElementById('header-meta').textContent=
        'Error loading data — check the assets/data/ folder is present.';
});
