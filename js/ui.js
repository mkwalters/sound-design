/* UI building blocks: element helper, knobs, segmented controls, pedals, canvases, transports, frame loop. */
(function () {
  const SD = window.SD;

  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) sk.startsWith('--') ? e.style.setProperty(sk, v[sk]) : (e.style[sk] = v[sk]); }
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  }
  SD.h = h;
  SD.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- toast ----------
  let toastEl, toastT;
  SD.toast = (msg) => {
    if (!toastEl) { toastEl = h('div', { class: 'toast', role: 'status' }); document.body.append(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  };

  // ---------- tooltips: any element with data-tip (and optional data-tip-title) ----------
  const tipEl = h('div', { class: 'tip', role: 'tooltip', 'aria-hidden': 'true' });
  document.body.append(tipEl);
  let tipTarget = null, tipTimer = 0;
  function placeTip() {
    if (!tipTarget) return;
    const r = tipTarget.getBoundingClientRect();
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    const x = SD.clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8);
    let y = r.top - th - 10, below = false;
    if (y < 8) { y = r.bottom + 10; below = true; }
    tipEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    tipEl.classList.toggle('below', below);
    tipEl.style.setProperty('--ax', r.left + r.width / 2 - x + 'px');
  }
  function showTip(el) {
    const text = el.dataset.tip;
    if (!text) return;
    tipTarget = el;
    tipEl.innerHTML = '';
    if (el.dataset.tipTitle) tipEl.append(h('b', null, el.dataset.tipTitle));
    tipEl.append(text);
    tipEl.classList.add('show');
    placeTip();
  }
  function hideTip() { tipEl.classList.remove('show'); tipTarget = null; }
  SD.hideTip = hideTip;
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const t = e.target.closest('[data-tip]');
    if (t && t !== tipTarget) showTip(t);
    else if (!t && tipTarget && !tipTarget.classList.contains('dragging')) hideTip();
  });
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    showTip(t);
    clearTimeout(tipTimer);
    tipTimer = setTimeout(hideTip, 2400);
  });
  document.addEventListener('focusin', (e) => { const t = e.target.closest('[data-tip]'); if (t && e.target.matches(':focus-visible')) showTip(t); });
  document.addEventListener('focusout', (e) => { if (e.target === tipTarget || (tipTarget && tipTarget.contains(e.target))) hideTip(); });
  addEventListener('scroll', hideTip, { passive: true });
  SD.placeTip = placeTip;

  // ---------- drag + keyboard behaviour shared by knobs and the wah treadle ----------
  function dragControl(target, getN, setN, opts = {}) {
    target.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      target.focus({ preventScroll: true });
      target.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, sn = getN();
      target.classList.add('dragging');
      const move = (ev) => {
        const sens = (ev.shiftKey ? 4 : 1) * (opts.sens || 200);
        const d = opts.vertical ? sy - ev.clientY : ev.clientX - sx + (sy - ev.clientY);
        setN(sn + d / sens);
      };
      const up = (ev) => {
        if (tipTarget === target || (tipTarget && target.contains(tipTarget))) {
          const r = target.getBoundingClientRect();
          if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) hideTip();
        }
        target.removeEventListener('pointermove', move);
        target.removeEventListener('pointerup', up);
        target.removeEventListener('pointercancel', up);
        target.classList.remove('dragging');
      };
      target.addEventListener('pointermove', move);
      target.addEventListener('pointerup', up);
      target.addEventListener('pointercancel', up);
    });
    target.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 0.1 : 0.02;
      const k = e.key;
      let d = 0;
      if (k === 'ArrowUp' || k === 'ArrowRight') d = step;
      else if (k === 'ArrowDown' || k === 'ArrowLeft') d = -step;
      else if (k === 'PageUp') d = 0.1;
      else if (k === 'PageDown') d = -0.1;
      else if (k === 'Home') { setN(0); e.preventDefault(); return; }
      else if (k === 'End') { setN(1); e.preventDefault(); return; }
      if (d) { setN(getN() + d); e.preventDefault(); }
    });
  }
  SD.dragControl = dragControl;

  // ---------- knob ----------
  SD.knob = function (o) {
    const { min, max } = o;
    const log = o.scale === 'log';
    const toN = (v) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
    const fromN = (n) => {
      let v = log ? min * Math.pow(max / min, n) : min + (max - min) * n;
      if (o.step) v = Math.round(v / o.step) * o.step;
      return v;
    };
    let n = SD.clamp(toN(o.value), 0, 1), value = o.value;
    const def = o.value;
    const dial = h('div', { class: 'knob-dial', role: 'slider', tabindex: 0, 'aria-label': o.label + (o.tip ? '. ' + o.tip : '') });
    const read = h('div', { class: 'knob-value' });
    const el = h('div', { class: 'knob' + (o.small ? ' small' : ''), 'data-tip': o.tip || null, 'data-tip-title': o.tip ? o.label : null },
      dial, h('div', { class: 'knob-label' }, o.label), read);
    const fmt = o.format || ((v) => String(Math.round(v * 100) / 100));
    function render() {
      dial.style.setProperty('--angle', -135 + 270 * n + 'deg');
      const t = fmt(value);
      read.textContent = t;
      dial.setAttribute('aria-valuetext', t);
      dial.setAttribute('aria-valuenow', String(Math.round(n * 100)));
    }
    function setN(nn, silent) {
      n = SD.clamp(nn, 0, 1);
      value = fromN(n);
      render();
      if (!silent && o.onInput) o.onInput(value);
    }
    dial.setAttribute('aria-valuemin', '0');
    dial.setAttribute('aria-valuemax', '100');
    dragControl(dial, () => n, setN);
    dial.addEventListener('dblclick', () => setN(toN(def)));
    render();
    return {
      el,
      get value() { return value; },
      set(v, silent) { n = SD.clamp(toN(v), 0, 1); value = v; render(); if (!silent && o.onInput) o.onInput(v); },
    };
  };

  // ---------- segmented control ----------
  SD.segmented = function (o) {
    const el = h('div', { class: 'seg' + (o.small ? ' small' : ''), role: 'radiogroup', 'aria-label': o.label || null });
    let val;
    const btns = o.options.map((op) => {
      const b = h('button', { type: 'button', class: 'seg-btn', role: 'radio', 'data-tip': op.tip || null, 'data-tip-title': op.tip ? op.label : null }, op.label);
      b.addEventListener('click', () => set(op.value));
      el.append(b);
      return [op.value, b];
    });
    function set(v, silent) {
      val = v;
      btns.forEach(([k, b]) => { b.classList.toggle('active', k === v); b.setAttribute('aria-checked', String(k === v)); });
      if (!silent && o.onChange) o.onChange(v);
    }
    set(o.value, true);
    return { el, set, get value() { return val; } };
  };

  // ---------- pedal enclosure ----------
  SD.pedal = function (o) {
    const led = h('span', { class: 'led', 'aria-hidden': 'true' });
    const fs = h('button', { class: 'footswitch', type: 'button', 'aria-pressed': 'true', 'aria-label': `${o.name}: on/off`,
      'data-tip': 'Stomp to switch the effect off and on. Compare!', 'data-tip-title': 'Footswitch' });
    const screws = ['s1', 's2', 's3', 's4'].map((s) => h('span', { class: 'screw ' + s, 'aria-hidden': 'true' }));
    const el = h('div', { class: 'pedal on' + (o.compact ? ' compact' : '') + (o.cls ? ' ' + o.cls : ''), style: o.color ? { '--c': o.color } : null },
      screws,
      o.top ? h('div', { class: 'pedal-top' }, o.top) : null,
      o.knobs && o.knobs.length ? h('div', { class: 'pedal-knobs' }, o.knobs.map((k) => k.el || k)) : null,
      o.middle || null,
      h('div', { class: 'pedal-name' }, h('b', null, o.name), o.sub ? h('small', null, o.sub) : null),
      h('div', { class: 'pedal-row' },
        h('div', { class: 'pedal-foot' }, led, fs, o.compact ? null : h('span', { class: 'fs-hint' }, 'stomp')),
        o.extraFoot || null),
      o.bottom || null);
    let on = true;
    function setOn(v, silent) {
      on = v;
      el.classList.toggle('on', on);
      fs.setAttribute('aria-pressed', String(on));
      if (o.fx) o.fx.setOn(on);
      if (!silent && o.onToggle) o.onToggle(on);
    }
    fs.addEventListener('click', () => setOn(!on));
    if (o.startOff) setOn(false, true);
    return { el, led, setOn, get on() { return on; } };
  };

  // ---------- canvas with DPR-aware resize ----------
  SD.canvas = function (o = {}) {
    const c = h('canvas');
    const box = h('div', { class: 'graph-canvas', style: { height: (o.height || 200) + 'px' } }, c);
    const el = h('figure', { class: 'graph' },
      o.label ? h('figcaption', null, h('span', null, o.label), o.hint ? h('span', { class: 'hint' }, o.hint) : null) : null, box);
    const g = c.getContext('2d');
    const api = { el, canvas: c, g, w: 0, h: 0, draw: null };
    const ro = new ResizeObserver(() => {
      const r = box.getBoundingClientRect();
      if (!r.width) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.w = r.width; api.h = r.height;
      if (api.draw) api.draw();
    });
    ro.observe(box);
    return api;
  };

  // ---------- sparkle: a .play-btn.sparkle shimmers until it is first pressed ----------
  document.addEventListener('click', (e) => { const b = e.target.closest('.play-btn.sparkle'); if (b) b.classList.remove('sparkle'); }, true);

  // ---------- frame loop (only runs callbacks for visible elements) ----------
  const recs = [];
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    (en.target.__recs || []).forEach((r) => (r.visible = en.isIntersecting));
  }), { rootMargin: '120px' });
  SD.onFrame = (fn, el) => {
    const rec = { fn, visible: !el };
    recs.push(rec);
    if (el) { el.__recs = (el.__recs || []).concat(rec); io.observe(el); }
  };
  SD.tickers = new Set(); // audio-side tickers that always run (e.g. auto-wah, phaser sweep)
  function loop(t) {
    const s = t / 1000;
    SD.tickers.forEach((fn) => fn(s));
    for (const r of recs) if (r.visible) r.fn(s);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ---------- transport (play button + source chips) ----------
  SD.transport = function (o) {
    const owner = { label: o.label || 'Demo' };
    let src = o.value;
    const label = h('span', { class: 'play-label' }, 'Play');
    const play = h('button', { type: 'button', class: 'play-btn sparkle' }, h('span', { class: 'play-icon', 'aria-hidden': 'true' }), label);
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Sound source' });
    function renderChips() {
      chips.innerHTML = '';
      const ids = o.sources.concat(o.noExtras ? [] : Object.keys(SD.sources).filter((k) => SD.sources[k].extra));
      let prevSynth = null;
      ids.forEach((id) => {
        const def = SD.sources[id];
        if (!def || (def.available && !def.available())) return;
        const isSynth = !!def.synth;
        if (prevSynth !== null && prevSynth !== isSynth) chips.append(h('span', { class: 'chip-sep', 'aria-hidden': 'true' }));
        prevSynth = isSynth;
        const b = h('button', { type: 'button', class: 'chip' + (id === src ? ' active' : '') + (def.live ? ' live' : ''), 'aria-pressed': String(id === src) }, def.label);
        b.addEventListener('click', () => {
          src = id;
          renderChips();
          if (def.live) SD.toast('Live input: use headphones to avoid feedback!');
          start();
        });
        chips.append(b);
      });
    }
    function start() { SD.player.start(owner, src, o.dest()); }
    play.addEventListener('click', () => (SD.player.isOwner(owner) ? SD.player.stop() : start()));
    SD.player.on(() => {
      const on = SD.player.isOwner(owner);
      play.classList.toggle('playing', on);
      label.textContent = on ? (SD.player.current.loading ? 'Loading…' : 'Stop') : 'Play';
    });
    SD.onSources(renderChips);
    renderChips();
    const el = h('div', { class: 'transport' }, play, chips);
    return { el, owner, start, get source() { return src; }, setSource(id) { src = id; renderChips(); } };
  };

  // ---------- plotting helpers ----------
  const COL = { ink: '#2b2320', ink2: '#5d5049', ink3: '#8b7d70', grid: 'rgba(43,35,32,0.09)', grid2: 'rgba(43,35,32,0.18)', paper: '#fffaf0' };
  SD.COL = COL;
  SD.accentOf = (id) => getComputedStyle(document.getElementById(id)).getPropertyValue('--accent').trim() || '#d1495b';
  SD.alpha = (hex, a) => {
    const m = hex.replace('#', '');
    const n = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };

  const FREQ_TICKS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
  SD.freqLabel = (f) => (f >= 1000 ? (f / 1000) + 'k' : String(f));
  /* Draw a frequency-response frame; returns mapping functions. */
  /* Axis titles: x centred under the plot area, y rotated along the left edge. */
  SD.axisTitles = function (cv, fr, xt, yt) {
    const { g, w, h: H } = cv;
    g.save();
    g.font = '10px "DM Mono", monospace'; g.fillStyle = COL.ink2; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (xt) g.fillText(xt, fr.L + (w - fr.L - fr.R) / 2, H - 3);
    if (yt) { g.translate(10, fr.T + (H - fr.T - fr.B) / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText(yt, 0, 0); }
    g.restore();
  };
  SD.freqFrame = function (cv, o = {}) {
    const { g, w, h: H } = cv;
    const L = 46, R = 8, T = 8, B = 32;
    const fmin = o.fmin || 20, fmax = o.fmax || 20000;
    const dbMin = o.dbMin ?? -30, dbMax = o.dbMax ?? 15;
    const x = (f) => L + (Math.log(f / fmin) / Math.log(fmax / fmin)) * (w - L - R);
    const y = (db) => T + (1 - (db - dbMin) / (dbMax - dbMin)) * (H - T - B);
    g.clearRect(0, 0, w, H);
    g.font = '10.5px "DM Mono", monospace';
    g.lineWidth = 1;
    g.fillStyle = COL.ink3;
    g.textAlign = 'center';
    FREQ_TICKS.forEach((f) => {
      if (f < fmin || f > fmax) return;
      g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(x(f), T); g.lineTo(x(f), H - B); g.stroke();
      g.fillText(SD.freqLabel(f), x(f), H - B + 13);
    });
    g.textAlign = 'right';
    const step = o.dbStep || 10;
    for (let db = Math.ceil(dbMin / step) * step; db <= dbMax; db += step) {
      g.strokeStyle = db === 0 ? COL.grid2 : COL.grid;
      g.beginPath(); g.moveTo(L, y(db)); g.lineTo(w - R, y(db)); g.stroke();
      g.fillText((db > 0 ? '+' : '') + db, L - 5, y(db) + 3.5);
    }
    SD.axisTitles(cv, { L, R, T, B }, 'frequency (Hz) · lows ← → highs', 'level (dB)');
    return { x, y, L, R, T, B, fmin, fmax, dbMin, dbMax };
  };
  SD.logFreqs = (n, fmin = 20, fmax = 20000) => {
    const a = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = fmin * Math.pow(fmax / fmin, i / (n - 1));
    return a;
  };
  SD.strokePath = (g, pts, color, width = 2.5) => {
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'round';
    g.stroke();
  };
  SD.dbToGain = (db) => Math.pow(10, db / 20);
  SD.gainToDb = (gn) => 20 * Math.log10(Math.max(gn, 1e-6));

  /* A bench = transport + pedal + graphs, mounted into #bench-<id>. */
  SD.bench = function (id, o) {
    const root = document.getElementById('bench-' + id);
    const tr = SD.transport({ label: o.label, sources: o.sources, value: o.source, dest: o.dest });
    const head = h('div', { class: 'bench-head' }, tr.el, o.headExtra || null);
    const graphs = h('div', { class: 'bench-graphs' + (o.graphLayout ? ' ' + o.graphLayout : '') }, o.graphs.map((gr) => gr.el || gr));
    root.append(head, h('div', { class: 'bench-body' }, h('div', { class: 'bench-pedal' }, o.pedal.el), graphs));
    return { root, transport: tr };
  };
})();
