/* Monroe University centralized active study time v1.2.
   Credits foreground, recently interactive time only. Server remains authoritative. */
(function (root) {
  'use strict';
  const BASE = 'https://irnrjzeejalbbqdrbzmj.supabase.co/functions/v1/participation-active-time';
  const STEP = 15000, IDLE = 90000, WARN = 60000, MAX_GAP = 30000;
  root.MonroeActiveTime = root.MonroeActiveTime || {};

  function init(config) {
    if (!config || typeof config.session !== 'function' || typeof config.token !== 'function') return null;
    if (root.MonroeActiveTime.current) root.MonroeActiveTime.current.stop();

    let lastAction = Date.now(), lastTick = Date.now(), lastUserEvent = 0;
    let busy = false, stopped = false, awaitingInteraction = document.hidden;
    let lastSession = '', currentSeconds = null, generation = 0;
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

    function interaction(ev) {
      if (stopped || document.hidden || ev.isTrusted === false) return;
      const now = Date.now();
      if (ev.type === 'mousemove' && now - lastUserEvent < 4000) return;
      lastUserEvent = now;
      const wasPaused = awaitingInteraction || now - lastAction >= IDLE;
      // Never include the time spent paused or in another tab.
      if (wasPaused) lastTick = now;
      awaitingInteraction = false;
      lastAction = now;
      hide();
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(type => document.addEventListener(type, interaction, { passive: true }));

    function visibilityChange() {
      lastTick = Date.now();
      awaitingInteraction = true;
      hide();
      // Explicitly require an interaction, even if tab was hidden for <90 seconds.
      // In-flight heartbeat cannot accrue any hidden time because it was bounded at dispatch.
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

    async function tick() {
      const now = Date.now(), from = lastTick;
      lastTick = now;
      if (stopped || busy || document.hidden) return;
      const id = config.session();
      if (!id) { lastSession = ''; currentSeconds = null; awaitingInteraction = true; return; }
      if (id !== lastSession) {
        lastSession = id;
        currentSeconds = null;
        generation++;
        // Start with a clean timestamp; old session intervals cannot transfer.
        lastTick = now;
        lastAction = now;
        awaitingInteraction = document.hidden;
        busy = true;
        const thisGeneration = generation;
        try {
          const v = await request('read', 0, id);
          if (!stopped && thisGeneration === generation && v && Number.isFinite(v.active_seconds)) {
            currentSeconds = v.active_seconds;
            document.dispatchEvent(new CustomEvent('monroe:active-time', { detail: { sessionId: id, seconds: currentSeconds } }));
          }
        } finally { busy = false; lastTick = Date.now(); }
        return;
      }
      const idle = now - lastAction;
      if (awaitingInteraction || idle >= IDLE) {
        awaitingInteraction = true;
        show('Study-time credit paused. Interact with the lab to resume.');
        return;
      }
      if (idle >= WARN) show('No activity detected. Your timer will pause after 90 seconds without interaction.');
      // Clock jumps, sleep, and throttled intervals earn no time.
      if (now - from > MAX_GAP || now <= from) return;
      // Do not credit beyond the 90-second idle boundary, even on the last tick.
      const eligibleEnd = Math.min(now, lastAction + IDLE);
      const seconds = Math.max(0, Math.min(20, Math.floor((eligibleEnd - from) / 1000)));
      if (!seconds) return;
      busy = true;
      const thisGeneration = generation;
      try {
        const v = await request('heartbeat', seconds, id);
        if (!stopped && thisGeneration === generation && v && Number.isFinite(v.active_seconds)) {
          currentSeconds = v.active_seconds;
          document.dispatchEvent(new CustomEvent('monroe:active-time', { detail: { sessionId: id, seconds: currentSeconds } }));
        }
      } catch (_) { /* Network errors must not fabricate study time. */ }
      finally { busy = false; lastTick = Date.now(); }
    }

    const clock = setInterval(tick, STEP);
    const tracker = {
      stop() {
        if (stopped) return;
        stopped = true;
        generation++;
        clearInterval(clock);
        events.forEach(type => document.removeEventListener(type, interaction));
        document.removeEventListener('visibilitychange', visibilityChange);
        panel.remove();
        if (root.MonroeActiveTime.current === tracker) root.MonroeActiveTime.current = null;
      },
      getSeconds() { return currentSeconds; }
    };
    root.MonroeActiveTime.current = tracker;
    return tracker;
  }
  root.MonroeActiveTime.init = init;
})(window);
