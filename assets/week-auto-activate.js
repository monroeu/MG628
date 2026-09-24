(() => {
  'use strict';

  const CONFIG = {
    folderPrefix: 'week',
    digits: 2,
    activeStatus: 'AVAILABLE NOW',
    inactiveStatus: 'COMING SOON',
    activeClass: 'is-available',
    inactiveClass: 'is-coming-soon',
    linkClass: 'auto-week-link',
    homeBase: new URL('./', document.baseURI),
    specialLabels: {
      1: 'Open Weeks 1–2 →'
    }
  };

  const WEEK_RE = /^WEEKS?\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*$/i;
  const STATUS_RE = /^(COMING\s+SOON|AVAILABLE\s+NOW|CHECKING[.…]*)$/i;

  function weekFolder(weekNumber) {
    return `${CONFIG.folderPrefix}${String(weekNumber).padStart(CONFIG.digits, '0')}`;
  }

  function weekIndexUrl(weekNumber) {
    return new URL(`${weekFolder(weekNumber)}/index.html`, CONFIG.homeBase);
  }

  function weekOpenUrl(weekNumber) {
    return new URL(`${weekFolder(weekNumber)}/`, CONFIG.homeBase);
  }

  async function exists(url) {
    try {
      let response = await fetch(url.href, {
        method: 'HEAD',
        cache: 'no-store',
        credentials: 'same-origin'
      });

      // Fallback for hosts that do not support HEAD cleanly.
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url.href, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin'
        });
      }
      return response.ok;
    } catch (error) {
      console.warn('[MG628] Could not check weekly activity:', url.href, error);
      return null; // Network error: preserve existing homepage state.
    }
  }

  function textIsWeekLabel(el) {
    const text = (el.textContent || '').trim();
    return text.length <= 30 ? WEEK_RE.exec(text) : null;
  }

  function findWeekLabelElements() {
    // Prefer explicit data-week markup if it is added later.
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
      return text.length <= 30 && STATUS_RE.test(text);
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

  function setAvailable(card, week) {
    card.classList.add(CONFIG.activeClass);
    card.classList.remove(CONFIG.inactiveClass);
    card.dataset.available = 'true';

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

  function setComingSoon(card, week) {
    card.classList.add(CONFIG.inactiveClass);
    card.classList.remove(CONFIG.activeClass);
    card.dataset.available = 'false';

    const status = ensureStatusElement(card);
    status.textContent = CONFIG.inactiveStatus;
    status.setAttribute('aria-label', `Week ${week} coming soon`);

    const link = findOpenLink(card, week);
    if (link) {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('tabindex', '-1');
      link.hidden = true;
    }
  }

  async function activateWeekCard(item) {
    const result = await exists(weekIndexUrl(item.week));
    if (result === true) setAvailable(item.card, item.week);
    else if (result === false) setComingSoon(item.card, item.week);
    // null means a network error; preserve whatever was already on the page.
  }

  async function init() {
    const weekCards = findWeekLabelElements();
    if (!weekCards.length) {
      console.warn('[MG628] No weekly activity cards were found.');
      return;
    }

    await Promise.all(weekCards.map(activateWeekCard));
    document.documentElement.dataset.weekLinksChecked = 'true';
    window.dispatchEvent(new CustomEvent('mg628:week-links-updated', {
      detail: { weeksChecked: weekCards.map(x => x.week) }
    }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
