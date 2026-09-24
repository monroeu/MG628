(() => {
  'use strict';

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
    homeBase: new URL('./', document.baseURI),
    statusEndpoint: 'https://irnrjzeejalbbqdrbzmj.supabase.co/functions/v1/course-participation-status',
    refreshMs: 60000,
    specialLabels: {
      1: 'Open Weeks 1–2 →'
    }
  };

  const WEEK_RE = /^WEEKS?\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*$/i;
  const STATUS_RE = /^(COMING\s+SOON|AVAILABLE\s+NOW|PARTICIPATION\s+CLOSED|OPENS\s+LATER|CHECKING[.…]*)$/i;
  let lastStatusMap = null;
  let refreshTimer = null;

  function weekFolder(weekNumber) {
    return `${CONFIG.folderPrefix}${String(weekNumber).padStart(CONFIG.digits, '0')}`;
  }

  function weekIndexUrl(weekNumber) {
    return new URL(`${weekFolder(weekNumber)}/index.html`, CONFIG.homeBase);
  }

  function weekOpenUrl(weekNumber) {
    return new URL(`${weekFolder(weekNumber)}/`, CONFIG.homeBase);
  }

  function normalizePath(path) {
    return String(path || '')
      .replace(/^\/+/, '')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .toLowerCase();
  }

  function folderFromPath(path) {
    const normalized = normalizePath(path);
    const match = normalized.match(/(?:^|\/)(week\d{2})(?:\/|$)/i);
    return match ? match[1].toLowerCase() : null;
  }

  async function exists(url) {
    try {
      let response = await fetch(url.href, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin'
      });

      if (response.status === 405 || response.status === 501) {
        response = await fetch(url.href, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin'
        });
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
        method: 'GET',
        mode: 'cors',
        cache: 'no-store',
        credentials: 'omit',
        headers: { 'Accept': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.assignments)) throw new Error('Invalid status response');

      const map = new Map();
      for (const assignment of payload.assignments) {
        const folder = folderFromPath(assignment.page_path);
        if (!folder) continue;
        map.set(folder, {
          slug: assignment.slug || '',
          title: assignment.title || '',
          pagePath: normalizePath(assignment.page_path),
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

  function textIsWeekLabel(el) {
    const text = (el.textContent || '').trim();
    return text.length <= 30 ? WEEK_RE.exec(text) : null;
  }

  function findWeekLabelElements() {
    const explicit = [...document.querySelectorAll('[data-week]')]
      .map(card => {
        const week = Number(card.dataset.week);
        if (!Number.isInteger(week) || week < 1) return null;
        return { week, card, label: card.querySelector('[data-week-label]') || null };
      })
      .filter(Boolean);

    if (explicit.length) return explicit;

    const candidates = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,div,strong')];
    const seen = new Set();
    const found = [];

    for (const el of candidates) {
      const match = textIsWeekLabel(el);
      if (!match) continue;
      const week = Number(match[1]);
      if (!Number.isInteger(week) || week < 1 || seen.has(week)) continue;

      const card = el.closest(
        '[data-week], .week-card, .activity-card, .module-card, .weekly-card, .card, article, li'
      ) || el.parentElement;

      if (!card) continue;
      seen.add(week);
      found.push({ week, card, label: el });
    }

    return found.sort((a, b) => a.week - b.week);
  }

  function findStatusElement(card) {
    const explicit = card.querySelector('[data-week-status]');
    if (explicit) return explicit;

    const nodes = [...card.querySelectorAll('span,p,small,strong,div')];
    return nodes.find(node => {
      const text = (node.textContent || '').trim();
      return text.length <= 40 && STATUS_RE.test(text);
    }) || null;
  }

  function findOpenLink(card, week) {
    const explicit = card.querySelector('[data-week-link]');
    if (explicit) return explicit;

    const links = [...card.querySelectorAll('a')];
    return links.find(a => /open\s+week/i.test((a.textContent || '').trim()))
      || links.find(a => (a.getAttribute('href') || '').includes(weekFolder(week)))
      || null;
  }

  function ensureStatusElement(card) {
    let status = findStatusElement(card);
    if (status) return status;

    status = document.createElement('span');
    status.dataset.weekStatus = '';
    status.className = 'week-status';
    card.appendChild(status);
    return status;
  }

  function ensureOpenLink(card, week) {
    let link = findOpenLink(card, week);
    if (link) return link;

    link = document.createElement('a');
    link.dataset.weekLink = '';
    link.className = CONFIG.linkClass;
    card.appendChild(link);
    return link;
  }

  function resetStateClasses(card) {
    card.classList.remove(CONFIG.activeClass, CONFIG.closedClass, CONFIG.scheduledClass, CONFIG.inactiveClass);
  }

  function disableLink(card, week) {
    const link = findOpenLink(card, week);
    if (!link) return;
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.setAttribute('tabindex', '-1');
    link.hidden = true;
  }

  function setAvailable(card, week) {
    resetStateClasses(card);
    card.classList.add(CONFIG.activeClass);
    card.dataset.available = 'true';
    card.dataset.participationStatus = 'available';

    const status = ensureStatusElement(card);
    status.textContent = CONFIG.activeStatus;
    status.setAttribute('aria-label', `Week ${week} available now`);

    const link = ensureOpenLink(card, week);
    link.href = weekOpenUrl(week).href;
    link.textContent = card.dataset.openLabel || CONFIG.specialLabels[week] || `Open Week ${week} →`;
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.hidden = false;
  }

  function setClosed(card, week) {
    resetStateClasses(card);
    card.classList.add(CONFIG.closedClass);
    card.dataset.available = 'false';
    card.dataset.participationStatus = 'closed';

    const status = ensureStatusElement(card);
    status.textContent = CONFIG.closedStatus;
    status.setAttribute('aria-label', `Week ${week} participation closed`);
    disableLink(card, week);
  }

  function setScheduled(card, week) {
    resetStateClasses(card);
    card.classList.add(CONFIG.scheduledClass);
    card.dataset.available = 'false';
    card.dataset.participationStatus = 'scheduled';

    const status = ensureStatusElement(card);
    status.textContent = CONFIG.scheduledStatus;
    status.setAttribute('aria-label', `Week ${week} participation opens later`);
    disableLink(card, week);
  }

  function setComingSoon(card, week) {
    resetStateClasses(card);
    card.classList.add(CONFIG.inactiveClass);
    card.dataset.available = 'false';
    card.dataset.participationStatus = 'coming-soon';

    const status = ensureStatusElement(card);
    status.textContent = CONFIG.inactiveStatus;
    status.setAttribute('aria-label', `Week ${week} coming soon`);
    disableLink(card, week);
  }

  async function updateWeekCard(item, statusMap) {
    const fileExists = await exists(weekIndexUrl(item.week));
    if (fileExists === null) return;
    if (fileExists === false) {
      setComingSoon(item.card, item.week);
      return;
    }

    const folder = weekFolder(item.week).toLowerCase();
    const backend = statusMap ? statusMap.get(folder) : null;

    // Fail closed: an HTML file by itself never activates participation.
    if (!backend) {
      setComingSoon(item.card, item.week);
      return;
    }

    if (backend.status === 'available' && backend.published) setAvailable(item.card, item.week);
    else if (backend.status === 'scheduled' && backend.published) setScheduled(item.card, item.week);
    else setClosed(item.card, item.week);
  }

  async function refresh() {
    const weekCards = findWeekLabelElements();
    if (!weekCards.length) {
      console.warn('[MG628] No weekly activity cards were found.');
      return;
    }

    const statusMap = await fetchPublicationStatus();
    if (!statusMap) {
      // Preserve current state if the status service is unavailable.
      document.documentElement.dataset.weekStatusError = 'true';
      return;
    }

    delete document.documentElement.dataset.weekStatusError;
    await Promise.all(weekCards.map(item => updateWeekCard(item, statusMap)));
    document.documentElement.dataset.weekLinksChecked = 'true';
    window.dispatchEvent(new CustomEvent('mg628:week-links-updated', {
      detail: { weeksChecked: weekCards.map(x => x.week) }
    }));
  }

  function scheduleRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      if (!document.hidden) refresh();
    }, CONFIG.refreshMs);
  }

  function init() {
    refresh();
    scheduleRefresh();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
