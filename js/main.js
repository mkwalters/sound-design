/* Page chrome: chapter rail, scroll progress, dock, audio unlock. */
(function () {
  const { h, ctx } = SD;

  // Unlock audio on first interaction so LFO animations run in sync with the audio clock.
  const unlock = () => { if (ctx.state !== 'running') ctx.resume(); };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, unlock, { once: true, capture: true }));

  // ---- chapter rail ----
  const sections = [...document.querySelectorAll('.chapter')];
  const rail = document.getElementById('rail');
  const ol = h('ol');
  const links = sections.map((s) => {
    const c = getComputedStyle(s).getPropertyValue('--accent').trim();
    const a = h('a', { href: '#' + s.id, style: { '--c': c } }, h('span', { class: 'jack' }), h('span', { class: 'rail-label' }, s.dataset.title));
    ol.append(h('li', null, a));
    return a;
  });
  rail.append(ol);
  const visible = new Map();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => visible.set(e.target.id, e.intersectionRatio));
    let best = null, bestR = 0;
    sections.forEach((s) => { const r = visible.get(s.id) || 0; if (r > bestR) { bestR = r; best = s.id; } });
    const bi = sections.findIndex((s) => s.id === best);
    links.forEach((a, i) => { a.classList.toggle('active', i === bi); a.classList.toggle('done', bi >= 0 && i < bi); });
  }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
  sections.forEach((s) => io.observe(s));

  // ---- progress bar ----
  const bar = document.getElementById('progress');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (max > 0 ? (scrollY / max) * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- dock ----
  const dock = document.getElementById('dock');
  const text = document.getElementById('dock-text');
  const stop = document.getElementById('dock-stop');
  const update = (cur) => {
    dock.classList.toggle('playing', !!cur);
    stop.disabled = !cur;
    if (!cur) { text.textContent = 'Nothing playing'; return; }
    const srcName = typeof cur.src === 'string' && SD.sources[cur.src] ? SD.sources[cur.src].label + ' → ' : '';
    text.textContent = srcName + cur.owner.label;
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
      SD.toast('Loaded! Pick “' + SD.sources.user.label + '” as a source on any pedal.');
    } catch (err) {
      SD.toast('Sorry, that file could not be decoded.');
    }
    e.target.value = '';
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') SD.player.stop(); });
})();
