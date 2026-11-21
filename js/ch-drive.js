/* Chapter 2: overdrive / distortion / fuzz. */
(function () {
  const { h } = SD;
  const accent = SD.accentOf('drive');
  const fx = SD.fx.drive();
  fx.outputNode.connect(SD.master);
  const inA = SD.ctx.createAnalyser(), outA = SD.ctx.createAnalyser();
  inA.fftSize = outA.fftSize = 4096;
  fx.inputNode.connect(inA); fx.outputNode.connect(outA);
  const ib = new Float32Array(4096), ob = new Float32Array(4096);
  let live = false;

  const redraw = () => { transfer.draw(); waveC.draw(); harm.draw(); };
  const mode = SD.segmented({ label: 'Drive type', options: [
    { value: 'overdrive', label: 'Overdrive', tip: 'Soft, rounded clipping. Warm and bluesy.' },
    { value: 'distortion', label: 'Distortion', tip: 'Hard clipping and lots of gain. Tight rock and metal.' },
    { value: 'fuzz', label: 'Fuzz', tip: 'Extreme, lopsided clipping. The wave goes square. 60s buzz.' },
  ], value: 'overdrive', onChange: (v) => { fx.set('mode', v); redraw(); } });
  const pct = (v) => Math.round(v * 100) + '%';
  const kDrive = SD.knob({ label: 'Drive', tip: 'How hard the signal slams into the ceiling. More = more grit.', min: 0, max: 1, value: 0.6, format: pct, onInput: (v) => { fx.set('drive', v); redraw(); } });
  const kTone = SD.knob({ label: 'Tone', tip: 'Treble after the clipping. Low = warm, high = fizzy.', min: 0, max: 1, value: 0.55, format: (v) => (v < 0.35 ? 'dark ' : v > 0.7 ? 'bright ' : '') + pct(v), onInput: (v) => fx.set('tone', v) });
  const kLevel = SD.knob({ label: 'Level', tip: 'Output volume. Match it to the bypass level for a fair comparison.', min: 0, max: 1, value: 0.7, format: pct, onInput: (v) => fx.set('level', v) });

  const pedal = SD.pedal({ name: 'Hot Toast', sub: 'overdrive · distortion · fuzz', fx, knobs: [kDrive, kTone, kLevel], top: mode.el, onToggle: redraw });

  const transfer = SD.canvas({ label: 'Transfer curve', hint: 'input → output', height: 210 });
  const waveC = SD.canvas({ label: 'The wave', hint: 'live while playing', height: 210 });
  const harm = SD.canvas({ label: 'Harmonics added', hint: 'the “grit”', height: 120 });

  const curve = () => (pedal.on ? SD.driveCurve(fx.params.mode, fx.params.drive) : (x) => x);

  transfer.draw = () => {
    const { g, w, h: H } = transfer;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const s = Math.min(w, H) - 28, ox = (w - s) / 2, oy = 8;
    const X = (v) => ox + ((v + 1) / 2) * s, Y = (v) => oy + (1 - (v + 1) / 2) * s;
    g.strokeStyle = SD.COL.grid; g.lineWidth = 1;
    for (let i = -1; i <= 1; i += 0.5) {
      g.beginPath(); g.moveTo(X(i), Y(-1)); g.lineTo(X(i), Y(1)); g.stroke();
      g.beginPath(); g.moveTo(X(-1), Y(i)); g.lineTo(X(1), Y(i)); g.stroke();
    }
    g.strokeStyle = SD.COL.grid2; g.strokeRect(X(-1), Y(1), s, s);
    // clean reference
    g.setLineDash([5, 5]); SD.strokePath(g, [[X(-1), Y(-1)], [X(1), Y(1)]], SD.COL.ink3, 1.5); g.setLineDash([]);
    const f = curve(), pts = [];
    for (let i = 0; i <= 200; i++) { const x = i / 100 - 1; pts.push([X(x), Y(f(x))]); }
    SD.strokePath(g, pts, accent, 3.2);
    g.font = '10.5px "DM Mono", monospace'; g.fillStyle = SD.COL.ink3;
    g.textAlign = 'center'; g.fillText('input level →', X(0), oy + s + 16);
    g.save(); g.translate(ox - 8, Y(0)); g.rotate(-Math.PI / 2); g.fillText('output →', 0, 0); g.restore();
    g.textAlign = 'left'; g.fillText('clean', X(0.35) + 6, Y(0.35) + 14);
  };

  waveC.draw = () => {
    const { g, w, h: H } = waveC;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const mid = H / 2, A = H / 2 - 18, f = curve();
    g.strokeStyle = SD.COL.grid2; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, mid); g.lineTo(w, mid); g.stroke();
    g.setLineDash([3, 5]);
    g.strokeStyle = SD.alpha('#2b2320', 0.25);
    [-1, 1].forEach((s) => { g.beginPath(); g.moveTo(0, mid - s * A); g.lineTo(w, mid - s * A); g.stroke(); });
    g.setLineDash([]);
    const inP = [], outP = [];
    if (live) {
      // trigger on a rising zero crossing of the input; show ~20 ms; each trace scaled to its own peak
      inA.getFloatTimeDomainData(ib); outA.getFloatTimeDomainData(ob);
      let st = 0; for (let i = 1; i < 2000; i++) if (ib[i - 1] < 0 && ib[i] >= 0) { st = i; break; }
      const span = Math.round(SD.ctx.sampleRate * 0.02);
      let pi = 1e-4, po = 1e-4;
      for (let i = 0; i < span; i++) { pi = Math.max(pi, Math.abs(ib[st + i] || 0)); po = Math.max(po, Math.abs(ob[st + i] || 0)); }
      const step = Math.max(1, Math.floor(span / 600));
      for (let i = 0; i < span; i += step) {
        const x = (i / span) * w;
        inP.push([x, mid - ((ib[st + i] || 0) / pi) * 0.9 * A]);
        outP.push([x, mid - ((ob[st + i] || 0) / po) * A]);
      }
    } else {
      const n = 300;
      for (let i = 0; i <= n; i++) {
        const ph = (i / n) * 2.5, x = 0.9 * Math.sin(2 * Math.PI * ph);
        inP.push([(i / n) * w, mid - x * A]);
        outP.push([(i / n) * w, mid - f(x) * A]);
      }
    }
    g.setLineDash([5, 5]); SD.strokePath(g, inP, SD.COL.ink3, 1.5); g.setLineDash([]);
    SD.strokePath(g, outP, accent, 3);
    g.font = '10.5px "DM Mono", monospace';
    g.fillStyle = SD.COL.ink3; g.fillText('- - in', 6, 14);
    g.fillStyle = accent; g.fillText('— out', 56, 14);
    g.fillStyle = SD.COL.ink3; g.fillText('ceiling', w - 52, mid - A - 4);
  };

  harm.draw = () => {
    const { g, w, h: H } = harm;
    if (!w) return;
    g.clearRect(0, 0, w, H);
    const f = curve(), N = 512, K = 12, y = new Float32Array(N);
    for (let i = 0; i < N; i++) y[i] = f(0.9 * Math.sin((2 * Math.PI * i) / N));
    const mags = [];
    for (let k = 1; k <= K; k++) {
      let re = 0, im = 0;
      for (let i = 0; i < N; i++) { const a = (2 * Math.PI * k * i) / N; re += y[i] * Math.cos(a); im -= y[i] * Math.sin(a); }
      mags.push(Math.hypot(re, im));
    }
    const ref = mags[0] || 1, bw = (w - 20) / K;
    g.font = '10.5px "DM Mono", monospace'; g.textAlign = 'center';
    mags.forEach((m, i) => {
      const db = SD.gainToDb(m / ref), hh = SD.clamp((db + 50) / 50, 0, 1) * (H - 34);
      const x = 10 + i * bw + bw * 0.18;
      g.fillStyle = i === 0 ? SD.COL.ink2 : accent;
      if (hh > 1) { g.beginPath(); g.roundRect ? g.roundRect(x, H - 18 - hh, bw * 0.64, hh, 4) : g.rect(x, H - 18 - hh, bw * 0.64, hh); g.fill(); }
      g.fillStyle = SD.COL.ink3;
      if (bw > 30 || i % 2 === 0) g.fillText(i === 0 ? 'note' : i + 1 + '×', x + bw * 0.32, H - 4);
    });
  };

  SD.onFrame(() => {
    const was = live;
    live = !!(SD.player.current && SD.player.current.owner === bench.transport.owner);
    if (live || was) waveC.draw();
  }, document.getElementById('bench-drive'));

  const bench = SD.bench('drive', { label: 'Hot Toast drive', sources: ['sine', 'saw', 'chug', 'chords', 'lick'], source: 'sine', dest: () => fx.inputNode, pedal, graphs: [transfer, waveC, harm], graphLayout: 'two' });
  harm.el.style.gridColumn = '1 / -1';
})();
