/* Chapter 10: the full pedalboard — reorderable chain + presets. */
(function () {
  const { h, ctx } = SD;
  const root = document.getElementById('bench-board');
  const pct = (v) => Math.round(v * 100) + '%';
  const hz = (v) => v.toFixed(1) + ' Hz';
  const MODS = {
    chorus: { rate: 0.8, depth: 0.5, delay: 18, feedback: 0, mix: 0.5 },
    flanger: { rate: 0.18, depth: 0.85, delay: 2.6, feedback: 0.72, mix: 0.5 },
  };

  const DEFS = {
    wah: { name: 'Quack', sub: 'auto‑wah', color: 'var(--c-filter)', make: () => { const f = SD.fx.filter(); f.setMany({ auto: 'env' }); return f; },
      knobs: [{ k: 'sens', label: 'Sens', tip: 'How much harder picking opens the wah.', min: 0, max: 1, v: 0.5, fmt: pct }, { k: 'res', label: 'Reso', tip: 'Height of the wah peak.', min: 0, max: 1, v: 0.5, fmt: pct }] },
    comp: { name: 'Squeezebox', sub: 'compressor', color: 'var(--c-comp)', make: SD.fx.comp,
      knobs: [{ k: 'threshold', label: 'Thresh', tip: 'Louder than this gets squashed.', min: -60, max: 0, v: -30, fmt: (v) => Math.round(v) + 'dB' }, { k: 'ratio', label: 'Ratio', tip: 'How hard it squashes.', min: 1, max: 20, v: 4, scale: 'log', fmt: (v) => v.toFixed(0) + ':1' }] },
    drive: { name: 'Hot Toast', sub: 'drive', color: 'var(--c-drive)', make: SD.fx.drive,
      seg: { k: 'mode', options: [['overdrive', 'OD'], ['distortion', 'Dist'], ['fuzz', 'Fuzz']], v: 'overdrive' },
      knobs: [{ k: 'drive', label: 'Drive', tip: 'How much grit.', min: 0, max: 1, v: 0.55, fmt: pct }, { k: 'tone', label: 'Tone', tip: 'Dark ↔ fizzy.', min: 0, max: 1, v: 0.55, fmt: pct }] },
    chorus: { name: 'Shimmer', sub: 'chorus · flanger', color: 'var(--c-chorus)', make: SD.fx.chorus,
      seg: { k: 'preset', options: [['chorus', 'Chorus'], ['flanger', 'Flanger']], v: 'chorus' },
      knobs: [{ k: 'rate', label: 'Rate', tip: 'Speed of the wobble.', min: 0.05, max: 5, v: 0.8, scale: 'log', fmt: hz }, { k: 'depth', label: 'Depth', tip: 'How far it wobbles.', min: 0, max: 1, v: 0.5, fmt: pct }] },
    phaser: { name: 'Swoosh', sub: 'phaser', color: 'var(--c-phaser)', make: SD.fx.phaser,
      knobs: [{ k: 'rate', label: 'Rate', tip: 'Speed of the wobble.', min: 0.05, max: 5, v: 0.4, scale: 'log', fmt: hz }, { k: 'depth', label: 'Depth', tip: 'How far it wobbles.', min: 0, max: 1, v: 0.75, fmt: pct }] },
    trem: { name: 'Wobble', sub: 'tremolo', color: 'var(--c-trem)', make: SD.fx.trem,
      knobs: [{ k: 'rate', label: 'Rate', tip: 'Speed of the wobble.', min: 0.5, max: 12, v: 5, scale: 'log', fmt: hz }, { k: 'depth', label: 'Depth', tip: 'How far it wobbles.', min: 0, max: 1, v: 0.6, fmt: pct }] },
    delay: { name: 'Canyon', sub: 'delay', color: 'var(--c-delay)', make: SD.fx.delay,
      knobs: [{ k: 'time', label: 'Time', tip: 'Gap between repeats.', min: 0.02, max: 1.5, v: 0.45, scale: 'log', fmt: (v) => Math.round(v * 1000) + 'ms' }, { k: 'feedback', label: 'Fdbk', tip: 'How many repeats.', min: 0, max: 0.95, v: 0.4, fmt: pct }, { k: 'mix', label: 'Mix', tip: 'Effect vs. dry signal.', min: 0, max: 1, v: 0.4, fmt: pct }] },
    reverb: { name: 'Big Room', sub: 'reverb', color: 'var(--c-reverb)', make: SD.fx.reverb,
      seg: { k: 'type', options: [['room', 'Room'], ['hall', 'Hall'], ['spring', 'Spring']], v: 'hall' },
      knobs: [{ k: 'decay', label: 'Decay', tip: 'How long the room rings.', min: 0.3, max: 8, v: 2.5, scale: 'log', fmt: (v) => v.toFixed(1) + 's' }, { k: 'mix', label: 'Mix', tip: 'Effect vs. dry signal.', min: 0, max: 1, v: 0.35, fmt: pct }] },
  };
  const STD = ['wah', 'comp', 'drive', 'chorus', 'phaser', 'trem', 'delay', 'reverb'];

  const input = ctx.createGain();
  const analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;
  analyser.connect(SD.master);

  const units = {};
  STD.forEach((id) => {
    const d = DEFS[id], fx = d.make();
    const controls = {};
    d.knobs.forEach((kd) => {
      fx.set(kd.k, kd.v);
      controls[kd.k] = SD.knob({ label: kd.label, tip: kd.tip, min: kd.min, max: kd.max, value: kd.v, scale: kd.scale, small: true, format: kd.fmt, onInput: (v) => fx.set(kd.k, v) });
    });
    let seg = null;
    if (d.seg) {
      seg = SD.segmented({ small: true, options: d.seg.options.map(([value, label]) => ({ value, label })), value: d.seg.v, onChange: (v) => {
        if (d.seg.k === 'preset') {
          fx.setMany(MODS[v]);
          controls.rate.set(MODS[v].rate, true); controls.depth.set(MODS[v].depth, true);
        } else fx.set(d.seg.k, v);
      } });
      controls[d.seg.k] = seg;
      if (d.seg.k !== 'preset') fx.set(d.seg.k, d.seg.v);
    }
    const left = h('button', { type: 'button', class: 'move-btn', 'aria-label': `Move ${d.name} earlier` }, '◀');
    const right = h('button', { type: 'button', class: 'move-btn', 'aria-label': `Move ${d.name} later` }, '▶');
    left.addEventListener('click', () => move(id, -1));
    right.addEventListener('click', () => move(id, +1));
    const pedal = SD.pedal({ name: d.name, sub: d.sub, color: d.color, fx, compact: true, startOff: true, top: seg ? seg.el : null,
      knobs: Object.values(controls).filter((c) => c !== seg), bottom: h('div', { class: 'move-btns' }, left, right) });
    units[id] = { id, fx, pedal, controls, left, right };
  });

  let order = STD.slice();
  const row = h('div', { class: 'board-row' });
  function render() {
    row.innerHTML = '';
    row.append(h('div', { class: 'board-io' }, h('span', { class: 'io-icon', 'aria-hidden': 'true' }, '🎸'), 'in'));
    order.forEach((id, i) => {
      const u = units[id];
      u.left.disabled = i === 0; u.right.disabled = i === order.length - 1;
      row.append(u.pedal.el);
    });
    row.append(h('div', { class: 'board-io' }, h('span', { class: 'io-icon', 'aria-hidden': 'true' }, '🔊'), 'amp'));
  }
  function wire() {
    input.disconnect();
    order.forEach((id) => units[id].fx.outputNode.disconnect());
    let prev = input;
    order.forEach((id) => { prev.connect(units[id].fx.inputNode); prev = units[id].fx.outputNode; });
    prev.connect(analyser);
  }
  function move(id, dir) {
    const i = order.indexOf(id), j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    render(); wire();
    const el = units[id].pedal.el;
    el.classList.remove('moved'); void el.offsetWidth; el.classList.add('moved');
    (dir < 0 ? units[id].left : units[id].right).focus();
    presetSeg.set(null, true);
  }

  const PRESETS = [
    { id: 'dry', label: 'All off', on: {} },
    { id: 'clean', label: 'Clean sparkle', src: 'arp', on: { comp: { threshold: -32, ratio: 4 }, chorus: { preset: 'chorus', depth: 0.55 }, reverb: { type: 'hall', decay: 2.4, mix: 0.3 } } },
    { id: 'rock', label: 'Rock lead', src: 'lick', on: { drive: { mode: 'overdrive', drive: 0.7, tone: 0.55 }, delay: { time: 0.45, feedback: 0.35, mix: 0.3 }, reverb: { type: 'room', decay: 1.2, mix: 0.25 } } },
    { id: 'grunge', label: 'Grunge', src: 'riff', on: { drive: { mode: 'distortion', drive: 0.75, tone: 0.5 }, chorus: { preset: 'chorus', rate: 0.6, depth: 0.75 } } },
    { id: 'surf', label: 'Surf', src: 'sparse', on: { trem: { rate: 6.5, depth: 0.6 }, reverb: { type: 'spring', decay: 2.5, mix: 0.45 } } },
    { id: 'funk', label: 'Funk', src: 'funk', on: { wah: { sens: 0.6, res: 0.6 }, comp: { threshold: -36, ratio: 6 }, phaser: { rate: 0.5, depth: 0.6 } } },
    { id: 'shoegaze', label: 'Shoegaze', src: 'held', on: { drive: { mode: 'fuzz', drive: 0.55, tone: 0.4 }, chorus: { preset: 'flanger', rate: 0.15, depth: 0.8 }, delay: { time: 0.6, feedback: 0.6, mix: 0.4 }, reverb: { type: 'hall', decay: 7, mix: 0.6 } } },
    { id: 'backwards', label: 'Backwards!', src: 'lick', order: ['reverb', 'delay', 'drive', 'wah', 'comp', 'chorus', 'phaser', 'trem'],
      on: { reverb: { type: 'hall', decay: 3, mix: 0.5 }, delay: { time: 0.375, feedback: 0.5, mix: 0.5 }, drive: { mode: 'distortion', drive: 0.8, tone: 0.5 } } },
  ];
  function applyPreset(pid) {
    const pr = PRESETS.find((p) => p.id === pid);
    order = (pr.order || STD).slice();
    STD.forEach((id) => {
      const u = units[id], cfg = pr.on[id];
      u.pedal.setOn(!!cfg);
      if (cfg) Object.entries(cfg).forEach(([k, v]) => u.controls[k] && u.controls[k].set(v));
    });
    render(); wire();
    if (pr.src && pr.src !== tr.source) {
      tr.setSource(pr.src);
      if (SD.player.isOwner(tr.owner)) tr.start();
    }
  }
  const presetSeg = SD.segmented({ label: 'Board presets', options: PRESETS.map((p) => ({ value: p.id, label: p.label })), value: 'dry', onChange: applyPreset });

  const tr = SD.transport({ label: 'Pedalboard', sources: ['arp', 'lick', 'riff', 'funk', 'held', 'drums'], value: 'arp', dest: () => input });

  const scope = SD.canvas({ label: 'Output waveform', height: 120 });
  const spec = SD.canvas({ label: 'Output spectrum', height: 120 });
  const tbuf = new Float32Array(analyser.fftSize), fbuf = new Float32Array(analyser.frequencyBinCount);
  const ACC = SD.accentOf('board');
  const FR = { L: 44, R: 8, T: 6, B: 30 };
  let scopeGain = 0.2;
  SD.onFrame(() => {
    const playing = SD.player.isOwner(tr.owner);
    if (scope.w) {
      const { g, w, h: H } = scope;
      const pw = w - FR.L - FR.R, mid = FR.T + (H - FR.T - FR.B) / 2, A = (H - FR.T - FR.B) / 2;
      const spanMs = (1000 / ctx.sampleRate) * 1000;
      g.clearRect(0, 0, w, H);
      g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3; g.lineWidth = 1;
      [-1, 0, 1].forEach((v) => {
        g.strokeStyle = v ? SD.COL.grid : SD.COL.grid2; g.beginPath(); g.moveTo(FR.L, mid - v * A); g.lineTo(w - FR.R, mid - v * A); g.stroke();
        g.textAlign = 'right'; g.fillText(v > 0 ? '+1' : String(v), FR.L - 5, mid - v * A + 3.5);
      });
      g.textAlign = 'center';
      [0, 10, 20].forEach((ms) => g.fillText(String(ms), FR.L + (ms / spanMs) * pw, H - FR.B + 13));
      SD.axisTitles(scope, FR, 'time (ms)', 'amp.');
      if (playing) {
        analyser.getFloatTimeDomainData(tbuf);
        let start = 0; for (let i = 1; i < 1024; i++) if (tbuf[i - 1] < 0 && tbuf[i] >= 0) { start = i; break; }
        let pk = 0; for (let i = 0; i < tbuf.length; i++) pk = Math.max(pk, Math.abs(tbuf[i]));
        scopeGain = Math.max(pk, scopeGain * 0.97, 0.05);
        const pts = []; for (let i = 0; i < 1000; i++) pts.push([FR.L + (i / 999) * pw, mid - SD.clamp((tbuf[start + i] || 0) / scopeGain, -1, 1) * A]);
        SD.strokePath(g, pts, ACC, 1.8);
      }
    }
    if (spec.w) {
      const { g, w, h: H } = spec;
      const pw = w - FR.L - FR.R, base = H - FR.B, ph = H - FR.T - FR.B;
      const X = (f) => FR.L + (Math.log(f / 30) / Math.log(16000 / 30)) * pw;
      g.clearRect(0, 0, w, H);
      g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3; g.lineWidth = 1; g.textAlign = 'center';
      [100, 1000, 10000].forEach((f) => { g.strokeStyle = SD.COL.grid; g.beginPath(); g.moveTo(X(f), FR.T); g.lineTo(X(f), base); g.stroke(); g.fillText(SD.freqLabel(f), X(f), H - FR.B + 13); });
      g.textAlign = 'right'; [[-100, 0], [-25, 1]].forEach(([db, a]) => g.fillText(String(db), FR.L - 5, base - a * ph + 3.5));
      SD.axisTitles(spec, FR, 'frequency (Hz)', 'dB');
      if (playing) {
        analyser.getFloatFrequencyData(fbuf);
        const binHz = ctx.sampleRate / analyser.fftSize;
        g.beginPath(); g.moveTo(FR.L, base);
        for (let x = 0; x <= pw; x += 2) {
          const f = 30 * Math.pow(16000 / 30, x / pw), b = Math.min(fbuf.length - 1, Math.round(f / binHz));
          g.lineTo(FR.L + x, base - SD.clamp((fbuf[b] + 100) / 75, 0, 1) * ph);
        }
        g.lineTo(FR.L + pw, base); g.closePath(); g.fillStyle = SD.alpha(ACC, 0.35); g.fill();
      }
    }
  }, root);

  root.append(
    h('div', { class: 'bench-head' }, tr.el),
    h('div', { class: 'board-presets' }, h('span', { class: 'lbl' }, 'Presets'), presetSeg.el),
    h('div', { class: 'board-top' }, scope.el, spec.el),
    h('div', { class: 'board' }, row, h('p', { class: 'board-hint' }, 'stomp to switch on · ◀ ▶ to reorder · drag knobs to tweak')),
  );
  render(); wire();
})();
