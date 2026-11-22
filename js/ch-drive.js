/* Chapter 2: overdrive / distortion / fuzz. */
(function () {
  const { h } = SD;
  const accent = SD.accentOf('drive');
  const fx = SD.fx.drive();
  fx.outputNode.connect(SD.master);
  const redraw = () => { transfer.draw(); waveC.draw(); harm.draw(); };
  const mode = SD.segmented({ label: 'Drive type', options: [
    { value: 'overdrive', label: 'Overdrive', tip: 'Soft, rounded clipping. Warm and bluesy.' },
    { value: 'distortion', label: 'Distortion', tip: 'Hard clipping and lots of gain. Tight rock and metal.' },
    { value: 'fuzz', label: 'Fuzz', tip: 'Extreme, lopsided clipping. The wave goes square. 60s buzz.' },
  ], value: 'overdrive', onChange: (v) => { fx.set('mode', v); redraw(); } });
  const pct = (v) => Math.round(v * 100) + '%';
  const kDrive = SD.knob({ label: 'Drive', tip: 'How hard the signal slams into the ceiling. More = more grit.', min: 0, max: 1, value: 0.3, format: pct, onInput: (v) => { fx.set('drive', v); redraw(); } });
  const kTone = SD.knob({ label: 'Tone', tip: 'Treble after the clipping. Low = warm, high = fizzy.', min: 0, max: 1, value: 0.55, format: (v) => (v < 0.35 ? 'dark ' : v > 0.7 ? 'bright ' : '') + pct(v), onInput: (v) => fx.set('tone', v) });
  const kLevel = SD.knob({ label: 'Level', tip: 'Output volume. Match it to the bypass level for a fair comparison.', min: 0, max: 1, value: 0.7, format: pct, onInput: (v) => fx.set('level', v) });

  const pedal = SD.pedal({ name: 'Hot Toast', sub: 'overdrive · distortion · fuzz', fx, knobs: [kDrive, kTone, kLevel], top: mode.el, onToggle: redraw });

  const transfer = SD.canvas({ label: 'Transfer curve', hint: 'how input maps to output', height: 230 });
  const waveC = SD.canvas({ label: 'One cycle', hint: 'shaded = clipped off', height: 230 });
  const harm = SD.canvas({ label: 'Harmonics added', hint: 'the “grit”', height: 150 });

  const curve = () => (pedal.on ? SD.driveCurve(fx.params.mode, fx.params.drive) : (x) => x);
  const font = '10px "DM Mono", monospace';

  transfer.draw = () => {
    const { g, w, h: H } = transfer;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const s = Math.min(w - 70, H - 44), ox = (w - s) / 2 + 16, oy = 8;
    const X = (v) => ox + ((v + 1) / 2) * s, Y = (v) => oy + (1 - (v + 1) / 2) * s;
    g.strokeStyle = SD.COL.grid; g.lineWidth = 1;
    for (let i = -1; i <= 1; i += 0.5) {
      g.beginPath(); g.moveTo(X(i), Y(-1)); g.lineTo(X(i), Y(1)); g.stroke();
      g.beginPath(); g.moveTo(X(-1), Y(i)); g.lineTo(X(1), Y(i)); g.stroke();
    }
    g.strokeStyle = SD.COL.grid2; g.strokeRect(X(-1), Y(1), s, s);
    g.setLineDash([5, 5]); SD.strokePath(g, [[X(-1), Y(-1)], [X(1), Y(1)]], SD.COL.ink3, 1.5); g.setLineDash([]);
    const f = curve(), pts = [];
    for (let i = 0; i <= 200; i++) { const x = i / 100 - 1; pts.push([X(x), Y(f(x))]); }
    SD.strokePath(g, pts, accent, 3.2);
    g.font = font; g.fillStyle = SD.COL.ink3;
    [-1, 0, 1].forEach((v) => {
      const t = v > 0 ? '+1' : String(v);
      g.textAlign = 'center'; g.fillText(t, X(v), oy + s + 13);
      g.textAlign = 'right'; g.fillText(t, ox - 5, Y(v) + 3.5);
    });
    g.fillStyle = SD.COL.ink2; g.textAlign = 'center';
    g.fillText('input amplitude (−1 to +1)', X(0), oy + s + 28);
    g.save(); g.translate(ox - 26, Y(0)); g.rotate(-Math.PI / 2); g.fillText('output amplitude', 0, 0); g.restore();
    g.fillStyle = SD.COL.ink3; g.textAlign = 'left'; g.fillText('clean', X(0.35) + 6, Y(0.35) + 14);
  };

  // One cycle of a sine: the drive-boosted wave (dashed) vs. what comes out (solid). The gap is what gets clipped.
  waveC.draw = () => {
    const { g, w, h: H } = waveC;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const fr = { L: 44, R: 10, T: 10, B: 32 }, YR = 1.6;
    const X = (t) => fr.L + t * (w - fr.L - fr.R), Y = (v) => fr.T + (1 - (v + YR) / (2 * YR)) * (H - fr.T - fr.B);
    const f = curve(), slope = f(0.001) / 0.001; // small-signal gain = how hard the input is pushed
    g.font = font; g.lineWidth = 1;
    [-1, 0, 1].forEach((v) => {
      g.strokeStyle = v === 0 ? SD.COL.grid2 : SD.alpha('#2b2320', 0.3);
      if (v) g.setLineDash([3, 5]);
      g.beginPath(); g.moveTo(fr.L, Y(v)); g.lineTo(w - fr.R, Y(v)); g.stroke(); g.setLineDash([]);
      g.fillStyle = SD.COL.ink3; g.textAlign = 'right'; g.fillText(v > 0 ? '+1' : String(v), fr.L - 5, Y(v) + 3.5);
    });
    [0, 0.25, 0.5, 0.75, 1].forEach((t) => { g.textAlign = 'center'; g.fillStyle = SD.COL.ink3; g.fillText(t === 0 ? '0' : t === 1 ? '1' : String(t), X(t), H - fr.B + 13); });
    const n = 240, boost = [], out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = 0.9 * Math.sin(2 * Math.PI * t);
      boost.push([X(t), Y(SD.clamp(slope * x, -YR, YR))]);
      out.push([X(t), Y(f(x))]);
    }
    if (pedal.on) {
      g.beginPath(); boost.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      for (let i = n; i >= 0; i--) g.lineTo(out[i][0], out[i][1]);
      g.closePath(); g.fillStyle = SD.alpha(accent, 0.22); g.fill();
      g.setLineDash([5, 5]); SD.strokePath(g, boost, SD.COL.ink3, 1.5); g.setLineDash([]);
    }
    SD.strokePath(g, out, accent, 3);
    g.textAlign = 'left'; g.fillStyle = SD.COL.ink3;
    g.fillText('ceiling', w - fr.R - 50, Y(1) - 4);
    const lx = X(0.53);
    if (pedal.on) { g.fillText('- - pushed in', lx, fr.T + 10); g.fillStyle = accent; g.fillText('— comes out', lx, fr.T + 23); }
    else g.fillText('bypassed: clean sine', lx, fr.T + 10);
    SD.axisTitles(waveC, fr, 'time (fraction of one cycle)', 'amplitude');
  };

  harm.draw = () => {
    const { g, w, h: H } = harm;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const fr = { L: 44, R: 8, T: 8, B: 32 };
    const f = curve(), N = 512, K = 12, y = new Float32Array(N);
    for (let i = 0; i < N; i++) y[i] = f(0.9 * Math.sin((2 * Math.PI * i) / N));
    const mags = [];
    for (let k = 1; k <= K; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < N; i++) { const a = (2 * Math.PI * k * i) / N; re += y[i] * Math.cos(a); im -= y[i] * Math.sin(a); }
      mags.push(Math.hypot(re, im));
    }
    const ref = mags[0] || 1, bw = (w - fr.L - fr.R) / K, ph = H - fr.T - fr.B;
    const Yd = (db) => H - fr.B - SD.clamp((db + 50) / 50, 0, 1) * ph;
    g.font = font; g.lineWidth = 1;
    [0, -25, -50].forEach((db) => {
      g.strokeStyle = SD.COL.grid; g.beginPath(); g.moveTo(fr.L, Yd(db)); g.lineTo(w - fr.R, Yd(db)); g.stroke();
      g.fillStyle = SD.COL.ink3; g.textAlign = 'right'; g.fillText(String(db), fr.L - 5, Yd(db) + 3.5);
    });
    g.textAlign = 'center';
    mags.forEach((m, i) => {
      const db = SD.gainToDb(m / ref), hh = H - fr.B - Yd(db);
      const x = fr.L + i * bw + bw * 0.18;
      g.fillStyle = i === 0 ? SD.COL.ink2 : accent;
      if (hh > 1) { g.beginPath(); g.roundRect ? g.roundRect(x, H - fr.B - hh, bw * 0.64, hh, 4) : g.rect(x, H - fr.B - hh, bw * 0.64, hh); g.fill(); }
      g.fillStyle = SD.COL.ink3;
      if (bw > 30 || i % 2 === 0) g.fillText(i === 0 ? 'note' : i + 1 + '×', x + bw * 0.32, H - fr.B + 13);
    });
    SD.axisTitles(harm, fr, 'harmonic (× the note’s frequency)', 'dB vs note');
  };

  SD.bench('drive', { label: 'Hot Toast drive', sources: ['riff', 'held', 'lick', 'sine'], source: 'riff', dest: () => fx.inputNode, pedal, graphs: [transfer, waveC, harm], graphLayout: 'two' });
  harm.el.style.gridColumn = '1 / -1';
})();
