/* Chapter 1: a wave playground — pitch, loudness, shape. */
(function () {
  const { h, ctx } = SD;
  const accent = SD.accentOf('sound');
  const p = { freq: 220, amp: 0.6, shape: 'sine' };
  let osc = null, gain = null;
  const out = ctx.createGain();
  out.connect(SD.master);

  const NOTES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const noteName = (f) => { const m = Math.round(69 + 12 * Math.log2(f / 440)); return NOTES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); };

  const owner = { label: 'Wave playground' };
  const startFn = (dest) => {
    osc = ctx.createOscillator(); osc.type = p.shape; osc.frequency.value = p.freq;
    gain = ctx.createGain(); gain.gain.value = p.amp * 0.32;
    osc.connect(gain).connect(dest); osc.start();
    return () => { osc && osc.stop(); osc = null; gain = null; };
  };
  const play = h('button', { type: 'button', class: 'play-btn' }, h('span', { class: 'play-icon' }), h('span', { class: 'play-label' }, 'Play tone'));
  play.addEventListener('click', () => (SD.player.isOwner(owner) ? SD.player.stop() : SD.player.start(owner, startFn, out)));
  SD.player.on(() => {
    const on = SD.player.isOwner(owner);
    play.classList.toggle('playing', on);
    play.querySelector('.play-label').textContent = on ? 'Stop' : 'Play tone';
  });

  const kPitch = SD.knob({ label: 'Pitch', min: 55, max: 1760, value: 220, scale: 'log', format: (v) => `${Math.round(v)} Hz · ${noteName(v)}`,
    onInput: (v) => { p.freq = v; if (osc) osc.frequency.setTargetAtTime(v, ctx.currentTime, 0.02); } });
  const kAmp = SD.knob({ label: 'Volume', min: 0, max: 1, value: 0.6, format: (v) => Math.round(v * 100) + '%',
    onInput: (v) => { p.amp = v; if (gain) gain.gain.setTargetAtTime(v * 0.32, ctx.currentTime, 0.02); } });
  const shape = SD.segmented({ label: 'Wave shape', options: [
    { value: 'sine', label: 'Sine' }, { value: 'triangle', label: 'Triangle' }, { value: 'square', label: 'Square' }, { value: 'sawtooth', label: 'Saw' },
  ], value: 'sine', onChange: (v) => { p.shape = v; if (osc) osc.type = v; harm.draw(); } });

  const pedal = SD.pedal({ name: 'Wave Lab', sub: 'tone generator', knobs: [kPitch, kAmp],
    middle: h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-label' }, 'shape'), shape.el) });
  // the footswitch on the wave lab just plays/stops
  pedal.el.querySelector('.footswitch').replaceWith(play);
  pedal.el.querySelector('.fs-hint').remove();
  pedal.el.querySelector('.led').remove();

  const wave = SD.canvas({ label: 'Waveform', hint: '20 milliseconds of sound', height: 190 });
  const harm = SD.canvas({ label: 'Hidden harmonics', hint: 'what the shape is made of', height: 150 });

  const shapeFn = (s, ph) => {
    const x = ph - Math.floor(ph);
    if (s === 'square') return x < 0.5 ? 1 : -1;
    if (s === 'sawtooth') return 2 * x - 1;
    if (s === 'triangle') return 1 - 4 * Math.abs(x - 0.5);
    return Math.sin(2 * Math.PI * x);
  };
  let scroll = 0, lastT = 0;
  wave.draw = () => {
    const { g, w, h: H } = wave;
    g.clearRect(0, 0, w, H);
    const mid = H / 2;
    g.strokeStyle = SD.COL.grid2; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();
    g.font = '10.5px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3;
    g.fillText('loud ↑', 4, 14); g.fillText('time →', w - 50, H - 6);
    const win = 0.02, pts = [];
    const n = Math.max(400, Math.floor(w * 1.5));
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * win;
      const v = shapeFn(p.shape, t * p.freq + scroll);
      pts.push([(i / n) * w, mid - v * p.amp * (H / 2 - 14)]);
    }
    g.save();
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineTo(w, mid); g.lineTo(0, mid); g.closePath();
    g.fillStyle = SD.alpha(accent, 0.12); g.fill();
    g.restore();
    SD.strokePath(g, pts, accent, 2.6);
  };
  harm.draw = () => {
    const { g, w, h: H } = harm;
    g.clearRect(0, 0, w, H);
    const N = 12, bw = (w - 20) / N;
    const amp = (k) => {
      if (p.shape === 'sine') return k === 1 ? 1 : 0;
      if (p.shape === 'square') return k % 2 ? 1 / k : 0;
      if (p.shape === 'sawtooth') return 1 / k;
      return k % 2 ? 1 / (k * k) : 0;
    };
    g.font = '10.5px "DM Mono", monospace'; g.textAlign = 'center';
    for (let k = 1; k <= N; k++) {
      const a = amp(k), bh = Math.sqrt(a) * (H - 34);
      const x = 10 + (k - 1) * bw + bw * 0.18;
      g.fillStyle = k === 1 ? accent : SD.alpha(accent, 0.55);
      if (bh > 0) { g.beginPath(); g.roundRect ? g.roundRect(x, H - 18 - bh, bw * 0.64, bh, 4) : g.rect(x, H - 18 - bh, bw * 0.64, bh); g.fill(); }
      g.fillStyle = SD.COL.ink3;
      if (bw > 30 || k % 2 === 1) g.fillText(k === 1 ? 'note' : k + '×', x + bw * 0.32, H - 4);
    }
  };
  SD.onFrame((t) => {
    const dt = Math.min(0.05, t - lastT); lastT = t;
    scroll += dt * 0.6; // slow drift so it feels alive
    wave.draw();
  }, wave.el);

  SD.bench('sound', { label: 'Wave playground', sources: [], dest: () => out, pedal, graphs: [wave, harm] });
  // The wave lab has its own play button inside the pedal; hide the generic transport.
  document.querySelector('#bench-sound .bench-head').remove();

  // ---- hero mini pedalboard ----
  const mini = document.getElementById('mini-board');
  [['Drive', '#ee7b30', 'drive'], ['Comp', '#2e86ab', 'comp'], ['Wah', '#8e5fc0', 'filter'], ['Trem', '#e2a72e', 'trem'],
    ['Chorus', '#2bb3a3', 'chorus'], ['Phaser', '#e85d8e', 'phaser'], ['Delay', '#4c9a5a', 'delay'], ['Reverb', '#4a5bd4', 'reverb']]
    .forEach(([n, c, id], i) => mini.append(h('a', { class: 'mini-pedal', href: '#' + id, style: { '--c': c, '--d': i * 0.3 + 's' } },
      h('span', { class: 'ml' }), h('span', { class: 'mk' }, h('i'), h('i')), h('b', null, n), h('span', { class: 'ms' }))));
})();
