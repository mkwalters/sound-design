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
  const play = h('button', { type: 'button', class: 'play-btn sparkle' }, h('span', { class: 'play-icon' }), h('span', { class: 'play-label' }, 'Play tone'));
  play.addEventListener('click', () => (SD.player.isOwner(owner) ? SD.player.stop() : SD.player.start(owner, startFn, out)));
  SD.player.on(() => {
    const on = SD.player.isOwner(owner);
    play.classList.toggle('playing', on);
    play.querySelector('.play-label').textContent = on ? 'Stop' : 'Play tone';
  });

  const kPitch = SD.knob({ label: 'Pitch', tip: 'How fast the wave wiggles. Faster means a higher note.', min: 55, max: 1760, value: 220, scale: 'log', format: (v) => `${Math.round(v)} Hz · ${noteName(v)}`,
    onInput: (v) => { p.freq = v; if (osc) osc.frequency.setTargetAtTime(v, ctx.currentTime, 0.02); } });
  const kAmp = SD.knob({ label: 'Volume', tip: 'How tall the wave is. Taller means louder.', min: 0, max: 1, value: 0.6, format: (v) => Math.round(v * 100) + '%',
    onInput: (v) => { p.amp = v; if (gain) gain.gain.setTargetAtTime(v * 0.32, ctx.currentTime, 0.02); } });
  const shape = SD.segmented({ label: 'Wave shape', options: [
    { value: 'sine', label: 'Sine', tip: 'Pure and smooth: just one frequency.' },
    { value: 'triangle', label: 'Triangle', tip: 'Mellow, with a few soft harmonics.' },
    { value: 'square', label: 'Square', tip: 'Hollow and buzzy, with odd harmonics.' },
    { value: 'sawtooth', label: 'Saw', tip: 'Bright and brassy: every harmonic.' },
  ], value: 'sine', onChange: (v) => { p.shape = v; if (osc) osc.type = v; harm.draw(); } });

  const pedal = SD.pedal({ name: 'Wave Lab', sub: 'tone generator', knobs: [kPitch, kAmp],
    middle: h('div', { class: 'ctl-group' }, h('span', { class: 'ctl-label' }, 'shape'), shape.el) });
  // the footswitch on the wave lab just plays/stops
  pedal.el.querySelector('.footswitch').replaceWith(play);
  pedal.el.querySelector('.fs-hint').remove();
  pedal.el.querySelector('.led').remove();

  const wave = SD.canvas({ label: 'Waveform', hint: '20 milliseconds of sound', height: 210 });
  const harm = SD.canvas({ label: 'Hidden harmonics', hint: 'what the shape is made of', height: 170 });

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
    const fr = { L: 44, R: 8, T: 8, B: 30 };
    const mid = fr.T + (H - fr.T - fr.B) / 2, A = (H - fr.T - fr.B) / 2 - 4, pw = w - fr.L - fr.R;
    g.lineWidth = 1; g.font = '10px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3;
    [-1, 0, 1].forEach((v) => {
      g.strokeStyle = v ? SD.COL.grid : SD.COL.grid2; g.beginPath(); g.moveTo(fr.L, mid - v * A); g.lineTo(w - fr.R, mid - v * A); g.stroke();
      g.textAlign = 'right'; g.fillText(v > 0 ? '+1' : String(v), fr.L - 5, mid - v * A + 3.5);
    });
    g.textAlign = 'center';
    [0, 5, 10, 15, 20].forEach((ms) => g.fillText(String(ms), fr.L + (ms / 20) * pw, H - fr.B + 13));
    SD.axisTitles(wave, fr, 'time (ms)', 'amplitude');
    const win = 0.02, pts = [];
    const n = Math.max(400, Math.floor(w * 1.5));
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * win;
      const v = shapeFn(p.shape, t * p.freq + scroll);
      pts.push([fr.L + (i / n) * pw, mid - v * p.amp * A]);
    }
    g.save();
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.lineTo(fr.L + pw, mid); g.lineTo(fr.L, mid); g.closePath();
    g.fillStyle = SD.alpha(accent, 0.12); g.fill();
    g.restore();
    SD.strokePath(g, pts, accent, 2.6);
  };
  harm.draw = () => {
    const { g, w, h: H } = harm;
    g.clearRect(0, 0, w, H);
    const fr = { L: 44, R: 8, T: 8, B: 30 }, N = 12, bw = (w - fr.L - fr.R) / N, ph = H - fr.T - fr.B;
    const amp = (k) => {
      if (p.shape === 'sine') return k === 1 ? 1 : 0;
      if (p.shape === 'square') return k % 2 ? 1 / k : 0;
      if (p.shape === 'sawtooth') return 1 / k;
      return k % 2 ? 1 / (k * k) : 0;
    };
    g.font = '10px "DM Mono", monospace'; g.lineWidth = 1;
    [0, 0.5, 1].forEach((a) => {
      const y = H - fr.B - Math.sqrt(a) * ph;
      g.strokeStyle = SD.COL.grid; g.beginPath(); g.moveTo(fr.L, y); g.lineTo(w - fr.R, y); g.stroke();
      g.fillStyle = SD.COL.ink3; g.textAlign = 'right'; g.fillText(String(a), fr.L - 5, y + 3.5);
    });
    g.textAlign = 'center';
    for (let k = 1; k <= N; k++) {
      const a = amp(k), bh = Math.sqrt(a) * ph;
      const x = fr.L + (k - 1) * bw + bw * 0.18;
      g.fillStyle = k === 1 ? accent : SD.alpha(accent, 0.55);
      if (bh > 0) { g.beginPath(); g.roundRect ? g.roundRect(x, H - fr.B - bh, bw * 0.64, bh, 4) : g.rect(x, H - fr.B - bh, bw * 0.64, bh); g.fill(); }
      g.fillStyle = SD.COL.ink3;
      if (bw > 30 || k % 2 === 1) g.fillText(k === 1 ? 'note' : k + '×', x + bw * 0.32, H - fr.B + 13);
    }
    SD.axisTitles(harm, fr, 'harmonic (× the note’s frequency)', 'strength');
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
  [['Drive', 'drive', 'drive'], ['Comp', 'comp', 'comp'], ['Wah', 'filter', 'filter'], ['Trem', 'trem', 'trem'],
    ['Chorus', 'chorus', 'chorus'], ['Phaser', 'phaser', 'phaser'], ['Delay', 'delay', 'delay'], ['Reverb', 'reverb', 'reverb']]
    .forEach(([n, c, id], i) => mini.append(h('a', { class: 'mini-pedal', href: '#' + id, style: { '--c': `var(--c-${c})`, '--d': i * 0.3 + 's' } },
      h('span', { class: 'ml' }), h('span', { class: 'mk' }, h('i'), h('i')), h('b', null, n), h('span', { class: 'ms' }))));
})();
