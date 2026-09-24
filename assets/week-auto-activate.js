(() => {
  'use strict';

  const scriptEl = document.currentScript;
  const scriptUrl = new URL(scriptEl?.src || 'assets/week-auto-activate.js', document.baseURI);
  const courseRoot = new URL('../', scriptUrl);

  const CONFIG = {
    folderPrefix: 'week',
    digits: 2,
    activeStatus: 'AVAILABLE NOW',
    closedStatus: 'PARTICIPATION CLOSED',
    scheduledStatus: 'OPENS LATER',
    inactiveStatus: 'COMING SOON',
    activeClass: 'is-available',
    closedClass: 'is-closed',
    scheduledClass: 'is-scheduled',
    inactiveClass: 'is-coming-soon',
    linkClass: 'auto-week-link',
    homeBase: courseRoot,
    statusEndpoint: 'https://irnrjzeejalbbqdrbzmj.supabase.co/functions/v1/course-participation-status',
    refreshMs: 60000,
    specialLabels: { 1: 'Open Weeks 1–2 →' }
  };

  const WEEK_RE = /^WEEKS?\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*$/i;
  const STATUS_RE = /^(COMING\s+SOON|AVAILABLE\s+NOW|PARTICIPATION\s+CLOSED|OPENS\s+LATER|CHECKING[.…]*)$/i;
  let refreshTimer = null;
  let lastStatusMap = null;

  function weekFolder(weekNumber) {
    return `${CONFIG.folderPrefix}${String(weekNumber).padStart(CONFIG.digits, '0')}`;
  }
  function weekIndexUrl(weekNumber) { return new URL(`${weekFolder(weekNumber)}/index.html`, CONFIG.homeBase); }
  function weekOpenUrl(weekNumber) { return new URL(`${weekFolder(weekNumber)}/`, CONFIG.homeBase); }
  function normalizePath(path) {
    return String(path || '').replace(/^\/+/, '').replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
  }
  function folderFromPath(path) {
    const match = normalizePath(path).match(/(?:^|\/)(week\d{2})(?:\/|$)/i);
    return match ? match[1].toLowerCase() : null;
  }
  function weekNumberFromFolder(folder) {
    const m = String(folder || '').match(/week(\d{2})/i);
    return m ? Number(m[1]) : 999;
  }
  function assignmentLabel(a) {
    const title = String(a.title || '');
    const range = title.match(/weeks?\s*(\d+)\s*[–-]\s*(\d+)/i);
    if (range) return `Weeks ${range[1]}–${range[2]}`;
    const one = title.match(/week\s*(\d+)/i);
    if (one) return `Week ${one[1]}`;
    const folder = folderFromPath(a.pagePath || a.page_path);
    const n = weekNumberFromFolder(folder);
    return Number.isFinite(n) && n !== 999 ? `Week ${n}` : (title || 'Week');
  }

  async function exists(url) {
    try {
      let response = await fetch(url.href, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url.href, { method: 'GET', cache: 'no-store', credentials: 'same-origin' });
      }
      return response.ok;
    } catch (error) {
      console.warn('[MG628] Could not check weekly HTML file:', url.href, error);
      return null;
    }
  }

  async function fetchPublicationStatus() {
    try {
      const response = await fetch(`${CONFIG.statusEndpoint}?t=${Date.now()}`, {
        method: 'GET', mode: 'cors', cache: 'no-store', credentials: 'omit', headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.assignments)) throw new Error('Invalid status response');
      const map = new Map();
      for (const assignment of payload.assignments) {
        const folder = folderFromPath(assignment.page_path);
        if (!folder) continue;
        map.set(folder, {
          slug: assignment.slug || '', title: assignment.title || '', pagePath: normalizePath(assignment.page_path),
          published: assignment.published === true,
          status: assignment.status || (assignment.published ? 'available' : 'closed')
        });
      }
      lastStatusMap = map;
      return map;
    } catch (error) {
      console.warn('[MG628] Could not retrieve Supabase participation status:', error);
      return null;
    }
  }

  function injectGlobalNavStyles() {
    if (document.getElementById('mg628-global-nav-style')) return;
    const style = document.createElement('style');
    style.id = 'mg628-global-nav-style';
    style.textContent = `
      :root{--mg628-nav-bg:#103f2f;--mg628-nav-fg:#fff;--mg628-nav-gold:#d6a84b;--mg628-nav-muted:#d7e5df;--mg628-nav-closed:#c8d1cd}
      #mg628-global-nav{position:sticky;top:0;z-index:9999;background:var(--mg628-nav-bg);color:var(--mg628-nav-fg);border-bottom:3px solid var(--mg628-nav-gold);font-family:Inter,Segoe UI,Arial,sans-serif}
      #mg628-global-nav *{box-sizing:border-box}
      .mg628-nav-inner{width:min(1180px,94vw);margin:auto;min-height:56px;display:flex;align-items:center;gap:14px}
      .mg628-nav-brand{color:#fff;text-decoration:none;font-weight:900;letter-spacing:.03em;white-space:nowrap}
      .mg628-nav-toggle{margin-left:auto;border:1px solid rgba(255,255,255,.35);background:transparent;color:#fff;border-radius:8px;min-width:44px;min-height:44px;padding:8px 12px;font:inherit;font-weight:800;cursor:pointer}
      .mg628-nav-links{display:none;width:100%;padding:0 0 12px;gap:6px;flex-direction:column}
      .mg628-nav-links.is-open{display:flex}
      .mg628-nav-links a,.mg628-nav-links .mg628-nav-state{min-height:44px;display:flex;align-items:center;padding:9px 11px;border-radius:8px;color:#fff;text-decoration:none;font-weight:750;white-space:nowrap}
      .mg628-nav-links a:hover,.mg628-nav-links a:focus-visible,.mg628-nav-links a[aria-current="page"]{background:rgba(255,255,255,.14);outline:none}
      .mg628-nav-links .mg628-nav-state{color:var(--mg628-nav-closed);cursor:default;font-weight:650}
      .mg628-nav-links .mg628-nav-state.scheduled{color:#f3d996}
      .mg628-nav-status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:7px;background:currentColor;flex:0 0 auto}
      body>.course-topbar,body>.topbar{display:none!important}
      @media(min-width:760px){
        .mg628-nav-toggle{display:none}.mg628-nav-inner{gap:22px}.mg628-nav-links{display:flex!important;width:auto;margin-left:auto;padding:0;flex-direction:row;align-items:center;gap:3px}
      }
      @media print{#mg628-global-nav{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function currentPath() { return new URL(location.href).pathname.replace(/\/index\.html$/i, '/'); }
  function samePath(url) {
    try { return new URL(url, location.href).pathname.replace(/\/index\.html$/i, '/') === currentPath(); }
    catch (_) { return false; }
  }

  function ensureGlobalNav() {
    injectGlobalNavStyles();
    let root = document.getElementById('mg628-global-nav');
    if (root) return root;
    root = document.createElement('header');
    root.id = 'mg628-global-nav';
    root.innerHTML = `
      <div class="mg628-nav-inner">
        <a class="mg628-nav-brand" href="${CONFIG.homeBase.href}">MG628</a>
        <button class="mg628-nav-toggle" type="button" aria-expanded="false" aria-controls="mg628-nav-links">Menu</button>
        <nav class="mg628-nav-links" id="mg628-nav-links" aria-label="MG628 course navigation">
          <a data-mg628-nav="home" href="${CONFIG.homeBase.href}">Home</a>
          <span id="mg628-dynamic-week-links" style="display:contents"></span>
          <a data-mg628-nav="instructor" href="${new URL('instructor/', CONFIG.homeBase).href}">Instructor</a>
        </nav>
      </div>`;
    document.body.insertBefore(root, document.body.firstChild);
    const toggle = root.querySelector('.mg628-nav-toggle');
    const links = root.querySelector('#mg628-nav-links');
    toggle.addEventListener('click', () => {
      const open = !links.classList.contains('is-open');
      links.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', e => {
      if (e.target.closest('a') && innerWidth < 760) {
        links.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false');
      }
    });
    for (const a of root.querySelectorAll('a')) if (samePath(a.href)) a.setAttribute('aria-current', 'page');
    return root;
  }

  async function renderGlobalWeekLinks(statusMap) {
    const nav = ensureGlobalNav();
    const host = nav.querySelector('#mg628-dynamic-week-links');
    if (!host || !statusMap) return;
    const rows = [...statusMap.entries()].sort((a,b)=>weekNumberFromFolder(a[0])-weekNumberFromFolder(b[0]));
    const rendered = [];
    for (const [folder, a] of rows) {
      const pageUrl = new URL(a.pagePath, CONFIG.homeBase);
      const fileExists = await exists(pageUrl);
      if (fileExists !== true) continue;
      const label = assignmentLabel(a);
      if (a.published && a.status === 'available') {
        const link = document.createElement('a');
        link.href = new URL(a.pagePath.replace(/index\.html$/i,''), CONFIG.homeBase).href;
        link.textContent = label;
        link.dataset.weekFolder = folder;
        if (samePath(link.href)) link.setAttribute('aria-current','page');
        rendered.push(link);
      } else {
        const state = document.createElement('span');
        state.className = `mg628-nav-state ${a.status === 'scheduled' ? 'scheduled' : 'closed'}`;
        state.dataset.weekFolder = folder;
        state.innerHTML = `<span class="mg628-nav-status-dot" aria-hidden="true"></span>${label} · ${a.status === 'scheduled' ? 'Opens later' : 'Closed'}`;
        rendered.push(state);
      }
    }
    host.replaceChildren(...rendered);
  }

  function textIsWeekLabel(el) {
    const text = (el.textContent || '').trim();
    return text.length <= 30 ? WEEK_RE.exec(text) : null;
  }
  function findWeekLabelElements() {
    const explicit = [...document.querySelectorAll('[data-week]')].map(card => {
      const week = Number(card.dataset.week);
      return Number.isInteger(week) && week > 0 ? {week,card,label:card.querySelector('[data-week-label]')||null} : null;
    }).filter(Boolean);
    if (explicit.length) return explicit;
    const candidates = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,strong')];
    const seen = new Set(), found=[];
    for (const el of candidates) {
      const match=textIsWeekLabel(el); if(!match) continue;
      const week=Number(match[1]); if(!Number.isInteger(week)||week<1||seen.has(week)) continue;
      const card=el.closest('[data-week], .week-card, .activity-card, .module-card, .weekly-card, .card, article, li')||el.parentElement;
      if(!card) continue; seen.add(week); found.push({week,card,label:el});
    }
    return found.sort((a,b)=>a.week-b.week);
  }
  function findStatusElement(card) {
    const explicit=card.querySelector('[data-week-status]'); if(explicit) return explicit;
    return [...card.querySelectorAll('span,p,small,strong,div')].find(node=>{const t=(node.textContent||'').trim();return t.length<=40&&STATUS_RE.test(t)})||null;
  }
  function findOpenLink(card,week){
    const explicit=card.querySelector('[data-week-link]');if(explicit)return explicit;
    const links=[...card.querySelectorAll('a')];
    return links.find(a=>/open\s+week/i.test((a.textContent||'').trim()))||links.find(a=>(a.getAttribute('href')||'').includes(weekFolder(week)))||null;
  }
  function ensureStatusElement(card){let s=findStatusElement(card);if(s)return s;s=document.createElement('span');s.dataset.weekStatus='';s.className='week-status';card.appendChild(s);return s}
  function ensureOpenLink(card,week){let l=findOpenLink(card,week);if(l)return l;l=document.createElement('a');l.dataset.weekLink='';l.className=CONFIG.linkClass;card.appendChild(l);return l}
  function resetStateClasses(card){card.classList.remove(CONFIG.activeClass,CONFIG.closedClass,CONFIG.scheduledClass,CONFIG.inactiveClass)}
  function disableLink(card,week){const l=findOpenLink(card,week);if(!l)return;l.removeAttribute('href');l.setAttribute('aria-disabled','true');l.setAttribute('tabindex','-1');l.hidden=true}
  function setAvailable(card,week){resetStateClasses(card);card.classList.add(CONFIG.activeClass);card.dataset.available='true';card.dataset.participationStatus='available';const s=ensureStatusElement(card);s.textContent=CONFIG.activeStatus;const l=ensureOpenLink(card,week);l.href=weekOpenUrl(week).href;l.textContent=card.dataset.openLabel||CONFIG.specialLabels[week]||`Open Week ${week} →`;l.removeAttribute('aria-disabled');l.removeAttribute('tabindex');l.hidden=false}
  function setClosed(card,week){resetStateClasses(card);card.classList.add(CONFIG.closedClass);card.dataset.available='false';card.dataset.participationStatus='closed';ensureStatusElement(card).textContent=CONFIG.closedStatus;disableLink(card,week)}
  function setScheduled(card,week){resetStateClasses(card);card.classList.add(CONFIG.scheduledClass);card.dataset.available='false';card.dataset.participationStatus='scheduled';ensureStatusElement(card).textContent=CONFIG.scheduledStatus;disableLink(card,week)}
  function setComingSoon(card,week){resetStateClasses(card);card.classList.add(CONFIG.inactiveClass);card.dataset.available='false';card.dataset.participationStatus='coming-soon';ensureStatusElement(card).textContent=CONFIG.inactiveStatus;disableLink(card,week)}
  async function updateWeekCard(item,statusMap){
    const fileExists=await exists(weekIndexUrl(item.week)); if(fileExists===null)return;
    if(fileExists===false){setComingSoon(item.card,item.week);return}
    const backend=statusMap?statusMap.get(weekFolder(item.week).toLowerCase()):null;
    if(!backend){setComingSoon(item.card,item.week);return}
    if(backend.status==='available'&&backend.published)setAvailable(item.card,item.week);
    else if(backend.status==='scheduled'&&backend.published)setScheduled(item.card,item.week);
    else setClosed(item.card,item.week);
  }

  async function refresh(){
    ensureGlobalNav();
    const statusMap=await fetchPublicationStatus();
    if(!statusMap){document.documentElement.dataset.weekStatusError='true';return}
    delete document.documentElement.dataset.weekStatusError;
    await renderGlobalWeekLinks(statusMap);
    const weekCards=findWeekLabelElements();
    if(weekCards.length) await Promise.all(weekCards.map(item=>updateWeekCard(item,statusMap)));
    document.documentElement.dataset.weekLinksChecked='true';
    window.dispatchEvent(new CustomEvent('mg628:week-links-updated',{detail:{weeksChecked:weekCards.map(x=>x.week)}}));
  }
  function scheduleRefresh(){if(refreshTimer)clearInterval(refreshTimer);refreshTimer=setInterval(()=>{if(!document.hidden)refresh()},CONFIG.refreshMs)}
  function init(){ensureGlobalNav();refresh();scheduleRefresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
