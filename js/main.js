/* Page chrome: one chapter per page, Next/Back pager, thin progress bar, dock. */
(function () {
  const { h, ctx } = SD;

  // Unlock audio on first interaction so LFO animations run in sync with the audio clock.
  const unlock = () => { if (ctx.state !== 'running') ctx.resume(); };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, unlock, { once: true, capture: true }));

  // ---- pages ----
  const pages = [...document.querySelectorAll('.page')];
  const ids = pages.map((p) => p.id);
  const accent = (p) => getComputedStyle(p).getPropertyValue('--accent').trim() || getComputedStyle(document.documentElement).getPropertyValue('--c-intro').trim();
  let cur = -1;

  // progress: one thin segment per page
  const prog = document.getElementById('progress');
  const segs = pages.map((p, i) => {
    const b = h('button', { type: 'button', 'aria-label': `Go to ${p.dataset.title}`, 'data-tip': p.dataset.title, style: { '--seg': accent(p) } });
    b.addEventListener('click', () => go(i));
    prog.append(b);
    return b;
  });

  const back = document.getElementById('pg-back');
  const next = document.getElementById('pg-next');
  back.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur === pages.length - 1 ? 0 : cur + 1));

  function go(i, fromHash) {
    i = SD.clamp(i, 0, pages.length - 1);
    if (i === cur) return;
    SD.player.stop();
    SD.hideTip && SD.hideTip();
    if (cur >= 0) pages[cur].classList.remove('active');
    cur = i;
    pages[i].classList.add('active');
    window.scrollTo(0, 0);
    segs.forEach((s, k) => { s.classList.toggle('done', k < i); s.classList.toggle('cur', k === i); s.setAttribute('aria-current', k === i ? 'step' : 'false'); });
    back.classList.toggle('hidden', i === 0);
    next.innerHTML = '';
    if (i === 0) next.append('Start →');
    else if (i === pages.length - 1) next.append('Start over ↺');
    else next.append(h('span', { class: 'nx' }, 'Next:'), pages[i + 1].dataset.title + ' →');
    document.title = (i ? pages[i].dataset.title + ' · ' : '') + 'Stompbox School';
    if (!fromHash && location.hash.slice(1) !== ids[i]) history.pushState(null, '', '#' + ids[i]);
  }
  const fromLocation = () => { const k = ids.indexOf(location.hash.slice(1)); go(k < 0 ? 0 : k, true); };
  addEventListener('popstate', fromLocation);
  addEventListener('hashchange', fromLocation);
  // in-page links like href="#drive" navigate between pages
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const k = ids.indexOf(a.getAttribute('href').slice(1));
    if (k >= 0) { e.preventDefault(); go(k); }
  });
  fromLocation();

  // keyboard: ← / → change pages (unless a knob or input has focus)
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { SD.player.stop(); return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t.closest && t.closest('[role="slider"], input, textarea, select, [role="radiogroup"]')) return;
    if (e.key === 'ArrowRight') { go(cur + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(cur - 1); e.preventDefault(); }
  });
  // Space = play/stop this page's demo, B = bypass (stomp) its pedal.
  // A button reached with Tab keeps Space for itself; one that was merely clicked does not.
  let tabbing = false;
  addEventListener('keydown', (e) => { if (e.key === 'Tab') tabbing = true; }, true);
  addEventListener('pointerdown', () => { tabbing = false; }, true);
  const ownsKey = (t) => !!(t.closest && (t.closest('input, textarea, select') || (tabbing && t.closest('button, a'))));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || ownsKey(e.target)) return;
    const ctl = SD.pageCtl[ids[cur]] || {};
    if (e.key === ' ') {
      e.preventDefault();
      if (e.repeat) return;
      if (ctl.play) ctl.play(); else if (cur === 0) go(1);
    } else if ((e.key === 'b' || e.key === 'B') && ctl.bypass && !e.repeat) ctl.bypass();
  });
  addEventListener('keyup', (e) => { if (e.key === ' ' && !ownsKey(e.target)) e.preventDefault(); });

  // ---- dock ----
  const dock = document.getElementById('dock');
  const text = document.getElementById('dock-text');
  const stop = document.getElementById('dock-stop');
  const update = (c) => {
    dock.classList.toggle('playing', !!c);
    stop.disabled = !c;
    if (!c) { text.textContent = 'Nothing playing'; return; }
    const srcName = typeof c.src === 'string' && SD.sources[c.src] ? SD.sources[c.src].label + ' → ' : '';
    text.textContent = (c.loading ? 'Loading… ' : '') + srcName + c.owner.label;
  };
  SD.player.on(update);
  update(null);
  stop.addEventListener('click', () => SD.player.stop());
  document.getElementById('dock-vol').addEventListener('input', (e) => SD.setVolume(+e.target.value));
  document.getElementById('dock-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      await SD.loadUserFile(f);
      SD.toast('Loaded! Pick “' + SD.sources.user.label + '” on any pedal.');
    } catch (err) {
      SD.toast('Sorry, that file could not be decoded.');
    }
    e.target.value = '';
  });
})();
