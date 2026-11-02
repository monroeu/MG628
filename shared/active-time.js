/* Monroe University centralized active study time v1.3.
   Credits foreground, recently interactive time only. Server remains authoritative.
   Changes from v1.2 (same server API, same request format):
   1. Keeps the time that passes while a heartbeat is in flight (v1.2 dropped it every 15 s).
   2. Carries fractions of a second forward instead of discarding them (v1.2 rounded down every 15 s).
   3. On the tick that detects 90 s of inactivity, credits the time up to the idle boundary.
   4. If a heartbeat fails, keeps up to 60 s of earned time and resends it (max 20 s per request).
   5. Optional config.engaged(): return true while the student is genuinely engaged without
      touching the page (e.g. narration audio playing in the visible tab). Pages that use it
      must also run their own presence check (see the CS650 lab).
   6. Only one tab per session earns time; a second open tab cannot double-count.
   7. Uses a monotonic clock, so changing the computer's clock cannot add or remove time. */
(function (root) {
  'use strict';
  const BASE = 'https://irnrjzeejalbbqdrbzmj.supabase.co/functions/v1/participation-active-time';
  const STEP = 15000, IDLE = 90000, WARN = 60000, MAX_GAP = 30000, MAX_SEND = 20, MAX_BACKLOG = 60;
  const mono = () => (root.performance && performance.now ? performance.now() : Date.now());
  root.MonroeActiveTime = root.MonroeActiveTime || {};

  function init(config) {
    if (!config || typeof config.session !== 'function' || typeof config.token !== 'function') return null;
    if (root.MonroeActiveTime.current) root.MonroeActiveTime.current.stop();
    const engaged = typeof config.engaged === 'function' ? config.engaged : () => false;
    const tabId = (root.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random());

    let lastAction = mono(), lastTick = mono(), lastUserEvent = 0;
    let busy = false, stopped = false, awaitingInteraction = document.hidden;
    let lastSession = '', currentSeconds = null, generation = 0;
    let earnedMs = 0;            // earned but not yet sent (includes fractions of a second)
    const panel = document.createElement('aside');
    panel.setAttribute('aria-live', 'polite');
    panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:99999;background:#123e32;color:white;padding:10px 14px;border-radius:8px;max-width:300px;font:13px/1.4 Arial,sans-serif;box-shadow:0 2px 8px #0003;display:none';
    const heading = document.createElement('strong');
    heading.textContent = 'Active study-time tracking';
    const warning = document.createElement('div');
    warning.style.marginTop = '5px';
    panel.append(heading, warning);
    document.body.append(panel);
    const show = text => { warning.textContent = text; panel.style.display = 'block'; };
    const hide = () => { panel.style.display = 'none'; };

    // ---- one earning tab per session (prevents double counting across tabs/windows) ----
    const lockKey = id => 'monroe-active-time-owner:' + id;
    function ownsLock(id, claim) {
      try {
        const raw = localStorage.getItem(lockKey(id));
        const cur = raw ? JSON.parse(raw) : null;
        const fresh = cur && Date.now() - cur.t < 2 * STEP;
        if (cur && cur.tab !== tabId && fresh && !claim) return false;
        localStorage.setItem(lockKey(id), JSON.stringify({ tab: tabId, t: Date.now() }));
        return true;
      } catch (_) { return true; } // storage blocked: fall back to v1.2 behaviour
    }

    function markActive(now) {
      const wasPaused = awaitingInteraction || now - lastAction >= IDLE;
      if (wasPaused) lastTick = now;  // never include paused or hidden time
      awaitingInteraction = false;
      lastAction = now;
      hide();
    }
    function interaction(ev) {
      if (stopped || document.hidden || ev.isTrusted === false) return;
      const now = mono();
      if (ev.type === 'mousemove' && now - lastUserEvent < 4000) return;
      lastUserEvent = now;
      markActive(now);
      const id = config.session();
      if (id) ownsLock(id, true);      // the tab the student is using takes over earning
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove', 'wheel'];
    events.forEach(type => document.addEventListener(type, interaction, { passive: true, capture: true }));

    function visibilityChange() {
      lastTick = mono();
      awaitingInteraction = true;
      hide();
    }
    document.addEventListener('visibilitychange', visibilityChange);

    async function request(action, elapsed, sessionId) {
      const token = await config.token();
      if (!token) return null;
      const response = await fetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ action, session_id: sessionId, elapsed_seconds: elapsed, event_id: crypto.randomUUID() })
      });
      if (!response.ok) return null;
      return response.json();
    }
    function publish(id, v) {
      if (v && Number.isFinite(v.active_seconds)) {
        currentSeconds = v.active_seconds;
        document.dispatchEvent(new CustomEvent('monroe:active-time', { detail: { sessionId: id, seconds: currentSeconds } }));
      }
    }

    async function tick() {
      if (stopped || busy) return;                 // in-flight request: keep accumulating, lose nothing
      const now = mono(), from = lastTick;
      if (document.hidden) { lastTick = now; return; }
      const id = config.session();
      if (!id) { lastSession = ''; currentSeconds = null; awaitingInteraction = true; earnedMs = 0; lastTick = now; return; }
      if (id !== lastSession) {
        lastSession = id; currentSeconds = null; generation++; earnedMs = 0;
        lastTick = now; lastAction = now; awaitingInteraction = document.hidden;
        busy = true; const g = generation;
        try { const v = await request('read', 0, id); if (!stopped && g === generation) publish(id, v); }
        catch (_) {} finally { busy = false; }
        return;
      }
      if (!awaitingInteraction && engaged()) lastAction = now;   // e.g. narration playing in this visible tab
      lastTick = now;
      if (now - from > MAX_GAP || now <= from) return;            // sleep, throttling, clock oddities earn nothing
      if (!awaitingInteraction) {
        const idle = now - lastAction;
        const eligibleEnd = Math.min(now, lastAction + IDLE);     // never credit past the idle boundary
        if (eligibleEnd > from && ownsLock(id, false)) earnedMs = Math.min(earnedMs + (eligibleEnd - from), MAX_BACKLOG * 1000);
        if (idle >= IDLE) { awaitingInteraction = true; show('Study-time credit paused. Interact with the lab to resume.'); }
        else if (idle >= WARN) show('No activity detected. Your timer will pause after 90 seconds without interaction.');
      } else {
        show('Study-time credit paused. Interact with the lab to resume.');
      }
      const seconds = Math.min(MAX_SEND, Math.floor(earnedMs / 1000));
      if (!seconds) return;
      busy = true; const g = generation;
      try {
        const v = await request('heartbeat', seconds, id);
        if (!stopped && g === generation && v) { earnedMs -= seconds * 1000; publish(id, v); }
      } catch (_) { /* keep earnedMs; it is resent next tick (backlog capped at 60 s) */ }
      finally { busy = false; }
    }

    const clock = setInterval(tick, STEP);
    const tracker = {
      stop() {
        if (stopped) return;
        stopped = true; generation++;
        clearInterval(clock);
        events.forEach(type => document.removeEventListener(type, interaction, { capture: true }));
        document.removeEventListener('visibilitychange', visibilityChange);
        panel.remove();
        if (root.MonroeActiveTime.current === tracker) root.MonroeActiveTime.current = null;
      },
      getSeconds() { return currentSeconds; },
      // for pages with their own presence check: call when the student confirms they are there
      confirmPresence() { markActive(mono()); }
    };
    root.MonroeActiveTime.current = tracker;
    return tracker;
  }
  root.MonroeActiveTime.init = init;
})(window);
